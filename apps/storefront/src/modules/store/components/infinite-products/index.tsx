"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
import { usePathname, useRouter } from "@i18n/navigation"
import { useLocale, useTranslations } from "next-intl"
import { HttpTypes } from "@medusajs/types"

import { listProductsWithSort } from "@lib/data/products"
import { getProductPrice } from "@lib/util/get-product-price"
import { getProductColors } from "@lib/util/product-colors"
import ProductPreview from "@modules/products/components/product-preview"
import AnimatedProductCard from "@modules/store/components/animated-product-card"
import { SortOptions } from "@modules/store/components/refinement-list/sort-products"
import StoreResultsBar, {
  ViewMode,
} from "@modules/store/components/store-results-bar"
import { useSetStoreFacets } from "@modules/store/context/store-facets-context"
import { useStoreCatalog } from "@modules/store/context/store-catalog-context"
import SkeletonProductPreview from "@modules/skeletons/components/skeleton-product-preview"

const VIEW_MODE_STORAGE_KEY = "store-view-mode"

// Category/collection navigation on /ready-to-wear remounts this component
// (dynamic route segment change), which would otherwise reset the view
// toggle back to its default — persist it so it survives across the whole
// shop section instead.
function readStoredViewMode(): ViewMode {
  if (typeof window === "undefined") return "grid"
  return window.localStorage.getItem(VIEW_MODE_STORAGE_KEY) === "list"
    ? "list"
    : "grid"
}

function SkeletonCard() {
  return (
    <li>
      <SkeletonProductPreview />
    </li>
  )
}

type Props = {
  initialProducts: HttpTypes.StoreProduct[]
  /** Total product count from the API — drives hasMore. */
  count: number
  region: HttpTypes.StoreRegion
  countryCode: string
  limit: number
  /** Sort the server rendered the initial batch with. */
  initialSort: SortOptions
  collectionId?: string
  categoryId?: string
  productsIds?: string[]
  /**
   * When true (the /ready-to-wear page), collection/category come from the
   * URL path client-side and changes trigger a refetch. Category/collection
   * pages keep their fixed props instead.
   */
  urlFiltered?: boolean
  /** Only needed when urlFiltered — resolves the path's handles back to ids. */
  categories?: HttpTypes.StoreProductCategory[]
  collections?: HttpTypes.StoreCollection[]
  /** Fixed category pages: the pre-expanded id list (category + all its
   *  descendants) the server rendered with, so client refetches (e.g. on
   *  sort change) keep including subcategory products. */
  categoryIds?: string[]
}

const STORE_BASE_PATH = "/ready-to-wear"

/**
 * Continuous loading product grid. The server renders the first batch
 * (static/ISR-friendly); this component appends more via the
 * listProductsWithSort server action when the sentinel scrolls into view,
 * and refetches from page 1 when ?sortBy= changes client-side.
 */
export default function InfiniteProducts({
  initialProducts,
  count,
  region,
  countryCode,
  limit,
  initialSort,
  collectionId,
  categoryId,
  productsIds,
  urlFiltered = false,
  categories: categoriesProp,
  collections: collectionsProp,
  categoryIds,
}: Props) {
  // Falls back to the /ready-to-wear layout's context when not passed as a
  // prop — the layout provides these once and persists across category/
  // collection navigation, instead of this component's parent (the page,
  // which fully remounts on every dynamic-segment change) re-fetching and
  // re-passing them down.
  const t = useTranslations("store")
  // listProductsWithSort runs as a Server Action here, outside any page
  // render — it has no route [locale] param to read, so the client's
  // current locale must be passed explicitly (see request-locale.ts).
  const locale = useLocale()
  const catalog = useStoreCatalog()
  const categories = categoriesProp ?? catalog?.categories ?? []
  const collections = collectionsProp ?? catalog?.collections ?? []

  const searchParams = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()
  // Starts at "grid" to match the server-rendered markup, then syncs from
  // localStorage once mounted — reading it in the initializer instead would
  // mismatch the SSR'd HTML whenever the stored preference is "list".
  const [view, setViewState] = useState<ViewMode>("grid")
  useEffect(() => {
    setViewState(readStoredViewMode())
  }, [])
  const setView = useCallback((next: ViewMode) => {
    setViewState(next)
    window.localStorage.setItem(VIEW_MODE_STORAGE_KEY, next)
  }, [])
  const sortBy = (searchParams.get("sortBy") as SortOptions) || "created_at"
  // On /ready-to-wear, collection/category come from the path
  // (/ready-to-wear/<handle> or /ready-to-wear/<collection>/<category>) and
  // are resolved back to ids here; on fixed category/collection pages
  // they're just the static props baked into the page.
  let effectiveCollectionId = collectionId
  let effectiveCategoryId = categoryId
  if (urlFiltered) {
    const slug = pathname.startsWith(STORE_BASE_PATH)
      ? pathname.slice(STORE_BASE_PATH.length).split("/").filter(Boolean)
      : []
    effectiveCollectionId = undefined
    effectiveCategoryId = undefined
    // Category handles can contain slashes (nested subcategory handles like
    // "accesorii/cravate"), so try matching the whole remaining path against
    // a category handle first before treating it as collection(+category).
    if (slug.length > 0) {
      const fullPath = slug.join("/")
      const cat = categories.find((c) => c.handle === fullPath)
      if (cat) {
        effectiveCategoryId = cat.id
      } else if (slug.length === 1) {
        effectiveCollectionId = collections.find(
          (c) => c.handle === slug[0]
        )?.id
      } else {
        effectiveCollectionId = collections.find(
          (c) => c.handle === slug[0]
        )?.id
        effectiveCategoryId = categories.find(
          (c) => c.handle === slug.slice(1).join("/")
        )?.id
      }
    }
  }

  // Price/color facets — client-side only (the API has no support for
  // these filters), applied on top of whatever's been loaded so far.
  const minPrice = urlFiltered
    ? Number(searchParams.get("minPrice")) || undefined
    : undefined
  const maxPrice = urlFiltered
    ? Number(searchParams.get("maxPrice")) || undefined
    : undefined
  const selectedColors = urlFiltered
    ? (searchParams.get("color") ?? "").split(",").filter(Boolean)
    : []
  // A page that happens to contain zero matches for the active price/color
  // filter doesn't mean "no more results" — `loadMore` keeps firing (the
  // sentinel stays visible with nothing rendered above it) until it pages
  // through the whole catalog or finds a match. At the normal small page
  // size that's a long chain of near-instant round trips (and real load on
  // Cloudflare's rate limit). Fetching much bigger pages whenever a facet
  // filter is active turns that into 1-2 requests instead — included in
  // filtersKey below so toggling a facet filter resets pagination instead of
  // mixing page numbers computed at two different page sizes.
  const hasFacetFilterActive = !!minPrice || !!maxPrice || selectedColors.length > 0

  // Filters the server-rendered `initialProducts` were fetched with (always
  // the unfiltered defaults on /store, since that page is static).
  const initialFiltersKey = JSON.stringify([
    initialSort,
    collectionId,
    categoryId,
    false,
  ])
  // Refetch from page 1 when the URL-driven filters (sort, collection,
  // category, facet-filter-active) differ from what the current list was
  // fetched with — covers user changes and landing directly on a filtered
  // URL whose static HTML used the defaults.
  const filtersKey = JSON.stringify([
    sortBy,
    effectiveCollectionId,
    effectiveCategoryId,
    hasFacetFilterActive,
  ])
  // True when the URL already asks for a different view than what got
  // server-rendered (e.g. a hard reload of /ready-to-wear/costume). In that case
  // we must NOT paint `initialProducts` even for a single frame — that's the
  // wrong (unfiltered) catalog — so the very first render starts empty +
  // loading instead, and the effect below fetches the correct page 1.
  const needsInitialRefetch = filtersKey !== initialFiltersKey

  const [products, setProducts] = useState(() =>
    needsInitialRefetch ? [] : initialProducts
  )
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(needsInitialRefetch)
  const [hasMore, setHasMore] = useState(() =>
    needsInitialRefetch ? true : initialProducts.length < count
  )
  // Total product count for whatever's currently selected — the `count` prop
  // is only the server-rendered default (unfiltered) total, so it must be
  // replaced with the refetch's own count once a category/collection filter
  // changes it, otherwise the displayed number never updates.
  const [totalCount, setTotalCount] = useState(count)
  const activeFilters = useRef<string>(
    needsInitialRefetch ? "" : initialFiltersKey
  )
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  // A category with no products of its own still shows its subcategories'
  // products — expand the selected category into itself + all descendants
  // (the flat `categories` list carries each entry's category_children).
  const expandCategoryIds = useCallback(
    (id: string): string[] => {
      const ids = [id]
      const stack = [id]
      while (stack.length) {
        const cur = stack.pop()!
        const cat = categories.find((c) => c.id === cur)
        for (const child of cat?.category_children ?? []) {
          if (!ids.includes(child.id)) {
            ids.push(child.id)
            stack.push(child.id)
          }
        }
      }
      return ids
    },
    [categories]
  )

  const effectiveLimit = hasFacetFilterActive ? Math.max(limit, 100) : limit

  const buildQueryParams = useCallback(
    () => ({
      limit: effectiveLimit,
      ...(effectiveCollectionId
        ? { collection_id: [effectiveCollectionId] }
        : {}),
      ...(effectiveCategoryId
        ? {
            category_id: urlFiltered
              ? expandCategoryIds(effectiveCategoryId)
              : categoryIds ?? [effectiveCategoryId],
          }
        : {}),
      ...(productsIds ? { id: productsIds } : {}),
    }),
    [
      effectiveLimit,
      effectiveCollectionId,
      effectiveCategoryId,
      productsIds,
      urlFiltered,
      expandCategoryIds,
      categoryIds,
    ]
  )
  useEffect(() => {
    if (filtersKey === activeFilters.current) return
    let cancelled = false
    setLoading(true)
    listProductsWithSort({
      page: 1,
      queryParams: buildQueryParams(),
      sortBy,
      countryCode,
      locale,
    })
      .then(({ response }) => {
        if (cancelled) return
        activeFilters.current = filtersKey
        setProducts(response.products)
        setPage(1)
        setHasMore(response.products.length < response.count)
        setTotalCount(response.count)
      })
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [filtersKey, sortBy, buildQueryParams, countryCode, locale])

  // A fast/continuous scroll can keep the sentinel intersecting across many
  // consecutive page loads, each one re-triggering `loadMore` the instant
  // the previous fetch resolves — on a quick connection this fires fast
  // enough to trip Cloudflare's per-IP rate limit for a real visitor, not a
  // bot. Enforce a minimum gap between fetch starts (rescheduling instead of
  // dropping the trigger, so a fast scroller still gets every page, just not
  // faster than this).
  const lastLoadAtRef = useRef(0)
  const MIN_LOAD_INTERVAL_MS = 400

  const loadMore = useCallback(() => {
    if (loading || !hasMore) return
    // Don't append while the displayed list doesn't match the URL filters —
    // the refetch effect above is about to replace it from page 1.
    if (filtersKey !== activeFilters.current) return

    const elapsed = Date.now() - lastLoadAtRef.current
    if (elapsed < MIN_LOAD_INTERVAL_MS) {
      setTimeout(loadMore, MIN_LOAD_INTERVAL_MS - elapsed)
      return
    }
    lastLoadAtRef.current = Date.now()

    setLoading(true)
    const nextPage = page + 1
    listProductsWithSort({
      page: nextPage,
      queryParams: buildQueryParams(),
      sortBy,
      countryCode,
      locale,
    })
      .then(({ response }) => {
        setProducts((prev) => {
          // Guard against duplicates if a product shifted between pages.
          const seen = new Set(prev.map((p) => p.id))
          const fresh = response.products.filter((p) => !seen.has(p.id))
          const merged = [...prev, ...fresh]
          setHasMore(merged.length < response.count && fresh.length > 0)
          return merged
        })
        setPage(nextPage)
      })
      .finally(() => setLoading(false))
  }, [
    loading,
    hasMore,
    page,
    filtersKey,
    sortBy,
    buildQueryParams,
    countryCode,
    locale,
  ])

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel || !hasMore) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore()
      },
      { rootMargin: "600px 0px" }
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [loadMore, hasMore])

  // Colors + price bounds must reflect the WHOLE matching catalog, not just
  // what's been loaded via infinite scroll so far — otherwise the Filtre
  // sheet's options grow (and a selected color can vanish from the list)
  // as the user scrolls. Fetched once per filter change, decoupled from the
  // paginated `products` used for display.
  const [facetProducts, setFacetProducts] = useState<HttpTypes.StoreProduct[]>(
    []
  )
  useEffect(() => {
    if (!urlFiltered) return
    let cancelled = false
    listProductsWithSort({
      page: 1,
      queryParams: { ...buildQueryParams(), limit: 200 },
      sortBy: "created_at",
      countryCode,
      locale,
    }).then(({ response }) => {
      if (!cancelled) setFacetProducts(response.products)
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlFiltered, filtersKey, countryCode, locale])

  const colorFacets = useMemo(() => {
    if (!urlFiltered) return []
    const seen = new Set<string>()
    for (const p of facetProducts) {
      for (const { label } of getProductColors(p)) seen.add(label)
    }
    return Array.from(seen)
  }, [facetProducts, urlFiltered])

  // Price bounds across the whole matching catalog — drives the slider range.
  const priceBounds = useMemo((): [number, number] => {
    if (!urlFiltered) return [0, 0]
    let lo = Infinity
    let hi = 0
    for (const p of facetProducts) {
      const price = getProductPrice({ product: p }).cheapestPrice
        ?.calculated_price_number
      if (price === undefined) continue
      if (price < lo) lo = price
      if (price > hi) hi = price
    }
    return lo === Infinity ? [0, 0] : [Math.floor(lo), Math.ceil(hi)]
  }, [facetProducts, urlFiltered])

  // Report facets up to StoreView (via context) so the desktop "Filtru"
  // button — rendered next to Sort, outside this subtree — can show them.
  const setStoreFacets = useSetStoreFacets()
  const hasProducts = totalCount > 0
  useEffect(() => {
    if (!urlFiltered) return
    setStoreFacets({ priceBounds, colorFacets, hasProducts })
  }, [urlFiltered, priceBounds, colorFacets, hasProducts, setStoreFacets])

  const hasFacetFilter = !!minPrice || !!maxPrice || selectedColors.length > 0

  // Price/color aren't supported by the API — filtered client-side over
  // whatever's been loaded via infinite scroll so far.
  const displayedProducts = useMemo(() => {
    if (!hasFacetFilter) return products
    return products.filter((p) => {
      if (minPrice || maxPrice) {
        const price = getProductPrice({ product: p }).cheapestPrice
          ?.calculated_price_number
        if (price === undefined) return false
        if (minPrice && price < minPrice) return false
        if (maxPrice && price > maxPrice) return false
      }
      if (selectedColors.length > 0) {
        const productColors = getProductColors(p).map((c) => c.label)
        if (!selectedColors.some((c) => productColors.includes(c))) return false
      }
      return true
    })
  }, [products, hasFacetFilter, minPrice, maxPrice, selectedColors])

  // Client-side facets can filter a loaded page down to almost nothing —
  // keep fetching until at least a minimum is on screen (4 on mobile, 6 on
  // desktop) or the catalog runs out, so the grid never opens near-empty
  // while more matching products exist on later pages.
  useEffect(() => {
    if (!hasMore || loading) return
    const minVisible = window.matchMedia("(min-width: 1024px)").matches ? 6 : 4
    if (displayedProducts.length < minVisible) loadMore()
  }, [displayedProducts.length, hasMore, loading, loadMore])

  return (
    <>
      {urlFiltered && (
        <StoreResultsBar
          count={hasFacetFilter ? displayedProducts.length : totalCount}
          loading={loading && filtersKey !== activeFilters.current}
          view={view}
          onViewChange={setView}
          colorFacets={colorFacets}
          priceBounds={priceBounds}
          hasProducts={hasProducts}
        />
      )}

      <div className="small:pb-0 pb-8">
        <ul
          className={
            view === "list"
              ? "grid grid-cols-1 w-full small:grid-cols-2 medium:grid-cols-3 gap-y-8 small:gap-x-8 small:gap-y-16"
              : "grid grid-cols-2 w-full small:grid-cols-2 medium:grid-cols-3 gap-x-3 gap-y-8 small:gap-x-8 small:gap-y-16"
          }
          data-testid="products-list"
        >
          {displayedProducts.map((p, i) => (
            <AnimatedProductCard key={p.id} index={i}>
              <ProductPreview product={p} region={region} />
            </AnimatedProductCard>
          ))}
          {loading &&
            Array.from({ length: products.length === 0 ? 6 : 3 }).map(
              (_, i) => <SkeletonCard key={`skeleton-${i}`} />
            )}
        </ul>
      </div>

      {displayedProducts.length === 0 && !loading && (
        <div
          className="flex flex-col items-center justify-center py-16 gap-5 text-center"
          data-testid="no-products-message"
        >
          <p className="font-serif text-base text-[var(--theme-text-muted)]">
            {hasFacetFilter
              ? t("Niciun produs nu corespunde filtrelor selectate")
              : t("Momentan nu există produse în această categorie")}
          </p>
          {hasFacetFilter && (
            <button
              onClick={() => {
                const params = new URLSearchParams(searchParams)
                params.delete("minPrice")
                params.delete("maxPrice")
                params.delete("color")
                params.delete("page")
                const qs = params.toString()
                router.push(qs ? `${pathname}?${qs}` : pathname)
              }}
              className="h-11 px-6 inline-flex items-center border border-[var(--theme-border)] font-sans text-[11px] uppercase tracking-[3px] text-[var(--theme-text)] hover:border-hunter-gold hover:text-hunter-gold active:border-hunter-gold active:text-hunter-gold transition-colors"
              data-testid="reset-filters-button"
            >
              {t("Resetează filtrele")}
            </button>
          )}
        </div>
      )}

      {hasMore && <div ref={sentinelRef} aria-hidden className="h-px" />}
    </>
  )
}
