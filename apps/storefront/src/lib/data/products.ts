"use server"

import { sdk } from "@lib/config"
import { sortProducts } from "@lib/util/sort-products"
import { HttpTypes } from "@medusajs/types"
import { SortOptions } from "@modules/store/components/refinement-list/sort-products"
import { getMedusaLocaleHeaders } from "@lib/util/request-locale"
import { getGlobalCacheOptions } from "./cookies"
import { getRegion, retrieveRegion } from "./regions"

export const listProducts = async ({
  pageParam = 1,
  queryParams,
  countryCode,
  regionId,
  includeProposed = false,
  locale,
}: {
  pageParam?: number
  queryParams?: HttpTypes.FindParams & HttpTypes.StoreProductListParams
  countryCode?: string
  regionId?: string
  includeProposed?: boolean
  /** Only needed when called as a Server Action from a Client Component
   *  (e.g. infinite scroll) — there's no route [locale] param to derive it
   *  from there, so pass the client's current locale (next-intl's
   *  useLocale()) explicitly. Server Components can omit it. */
  locale?: string
}): Promise<{
  response: { products: HttpTypes.StoreProduct[]; count: number }
  nextPage: number | null
  queryParams?: HttpTypes.FindParams & HttpTypes.StoreProductListParams
}> => {
  if (!countryCode && !regionId) {
    throw new Error("Country code or region ID is required")
  }

  const limit = queryParams?.limit || 12
  const _pageParam = Math.max(pageParam, 1)
  const offset = _pageParam === 1 ? 0 : (_pageParam - 1) * limit

  let region: HttpTypes.StoreRegion | undefined | null

  if (countryCode) {
    region = await getRegion(countryCode)
  } else {
    region = await retrieveRegion(regionId!)
  }

  if (!region) {
    return {
      response: { products: [], count: 0 },
      nextPage: null,
    }
  }

  // No auth headers here: public catalog listing depends only on the
  // publishable key + region (no customer-group pricing). Reading the JWT
  // cookie would force every caller (homepage, store) to render dynamically.
  const next = getGlobalCacheOptions("products")

  return sdk.client
    .fetch<{ products: HttpTypes.StoreProduct[]; count: number }>(
      `/store/products`,
      {
        method: "GET",
        headers: getMedusaLocaleHeaders(locale),
        query: {
          limit,
          offset,
          region_id: region?.id,
          fields:
            "*variants.calculated_price,+variants.inventory_quantity,*variants.images,*variants.options,+variants.metadata,+variants.variant_rank,*options,*options.values,+metadata,+tags,",
          ...queryParams,
        },
        next,
        cache: "force-cache",
      }
    )
    .then(({ products, count }) => {
      const nextPage = count > offset + limit ? pageParam + 1 : null
      const published = products.filter((p) => {
        const status = (p as any).status
        if (includeProposed) return !["draft"].includes(status)
        return !["draft", "proposed"].includes(status)
      })

      return {
        response: {
          products: published,
          // API total, not the filtered page length — pagination needs the
          // full count. Slightly overcounts if drafts exist, acceptable.
          count,
        },
        nextPage: nextPage,
        queryParams,
      }
    })
}

/**
 * Fetches full product data (with calculated prices + inventory) for a set
 * of product ids — used by the wishlist page, which only keeps id/handle/
 * title/thumbnail in localStorage and needs the rest fetched on demand.
 */
export const getProductsByIds = async ({
  ids,
  countryCode,
  locale,
}: {
  ids: string[]
  countryCode: string
  /** See listProducts — required when called from a Client Component. */
  locale?: string
}): Promise<HttpTypes.StoreProduct[]> => {
  if (!ids.length) return []

  const {
    response: { products },
  } = await listProducts({
    queryParams: { id: ids, limit: ids.length },
    countryCode,
    locale,
  })

  return products
}

/**
 * Paginated + sorted product listing.
 *
 * For the default created_at sort the API sorts and paginates for us, so we
 * fetch only the requested page. Price sorts still fetch every matching
 * product and sort in memory, because API-side ordering by cheapest variant
 * price is unreliable (medusajs/medusa#11029, #12900) — paginated (not a
 * single capped fetch), so a catalog/category past one page's worth of
 * products doesn't silently lose the rest from the sorted view.
 */
export const listProductsWithSort = async ({
  page = 0,
  queryParams,
  sortBy = "created_at",
  countryCode,
  locale,
}: {
  page?: number
  queryParams?: HttpTypes.FindParams & HttpTypes.StoreProductParams
  sortBy?: SortOptions
  countryCode: string
  /** See listProducts — required when called from a Client Component
   *  (this is invoked directly as a Server Action from infinite scroll). */
  locale?: string
}): Promise<{
  response: { products: HttpTypes.StoreProduct[]; count: number }
  nextPage: number | null
  queryParams?: HttpTypes.FindParams & HttpTypes.StoreProductParams
}> => {
  const limit = queryParams?.limit || 12

  if (sortBy !== "price_asc" && sortBy !== "price_desc") {
    return listProducts({
      pageParam: Math.max(page, 1),
      queryParams: {
        ...queryParams,
        limit,
        order: "-created_at",
      },
      countryCode,
      locale,
    })
  }

  const FETCH_PAGE_SIZE = 100
  const products: HttpTypes.StoreProduct[] = []
  let fetchPage = 1
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const {
      response: { products: pageProducts, count: totalCount },
    } = await listProducts({
      pageParam: fetchPage,
      queryParams: {
        ...queryParams,
        limit: FETCH_PAGE_SIZE,
      },
      countryCode,
      locale,
    })
    products.push(...pageProducts)
    if (pageProducts.length === 0 || products.length >= totalCount) break
    fetchPage += 1
  }

  const sortedProducts = sortProducts(products, sortBy)

  const _page = Math.max(page, 1)
  const offset = (_page - 1) * limit
  const paginatedProducts = sortedProducts.slice(offset, offset + limit)

  const count = sortedProducts.length
  const nextPage = count > offset + limit ? _page + 1 : null

  return {
    response: {
      products: paginatedProducts,
      count,
    },
    nextPage,
    queryParams,
  }
}

/**
 * Cookie-free single-product fetch for the (statically/ISR-rendered) product
 * detail page. No cookies → no DYNAMIC_SERVER_USAGE, so a product added after
 * the last build renders on-demand without a rebuild. Static tag + ISR.
 */
export const getProductByHandle = async (
  handle: string,
  regionId: string
): Promise<HttpTypes.StoreProduct | undefined> => {
  return sdk.client
    .fetch<{ products: HttpTypes.StoreProduct[] }>(`/store/products`, {
      method: "GET",
      headers: getMedusaLocaleHeaders(),
      query: {
        handle,
        region_id: regionId,
        fields:
          // *variants.options / *options must match listProducts — without
          // them the first render can't map a selection back to a variant,
          // so the picker always resolves to variants[0]. variant_rank is
          // needed because the API doesn't itself sort the variants relation
          // by it — see colorOrdered() in option-select.tsx. +description
          // and +subtitle are needed for the PDP's meta description/OG tags
          // (subtitle is the preferred source — see generateMetadata below)
          // — Medusa's default scalar set (unlike +title, +handle) doesn't
          // include either, so every product silently fell back to the
          // title-only meta description.
          "*variants.calculated_price,+variants.inventory_quantity,*variants.images,*variants.options,+variants.variant_rank,*options,*options.values,+metadata,+tags,*categories,+shipping_profile.type,+description,+subtitle",
      },
      next: { tags: ["products"], revalidate: 3600 },
      cache: "force-cache",
    })
    .then(({ products }) => {
      const product = products[0]
      // Mirrors listProducts' filter: a draft must not be reachable (or
      // prerendered) on the public PDP. Unpublished previews go through the
      // backend's token-gated /store/preview/products route, not this one,
      // so the preview flow is unaffected.
      if (!product || (product as any).status === "draft") return undefined
      return product
    })
    .catch((error) => {
      // A single product with malformed data (e.g. a stray control character
      // in an AI-generated description, breaking the response's JSON parse)
      // must not take down the ENTIRE build — every other product/category
      // page fails to deploy too if this throws during static generation.
      // Degrade to notFound() for just this one handle instead; it retries
      // on the next ISR revalidation once the underlying data is fixed.
      console.error(`getProductByHandle(${handle}) failed:`, error)
      return undefined
    })
}

/**
 * Cookie-free list of product handles for generateStaticParams (build-time
 * prerender) and the sitemap, so both reliably get every handle without
 * reading cookies. Paginates instead of a single capped request — a fixed
 * `limit` here silently dropped every product past it from both the sitemap
 * and static generation once the catalog grew past that number.
 */
export const listProductHandles = async (
  regionId: string
): Promise<string[]> => {
  const PAGE_SIZE = 100
  const handles: string[] = []
  let offset = 0

  try {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { products, count } = await sdk.client.fetch<{
        products: HttpTypes.StoreProduct[]
        count: number
      }>(`/store/products`, {
        method: "GET",
        query: {
          limit: PAGE_SIZE,
          offset,
          fields: "handle",
          region_id: regionId,
        },
        next: { tags: ["products"], revalidate: 3600 },
        cache: "force-cache",
      })
      handles.push(
        ...products.map((p) => p.handle).filter((h): h is string => Boolean(h))
      )
      offset += PAGE_SIZE
      if (products.length === 0 || offset >= count) break
    }
  } catch (error) {
    // Return whatever pages already succeeded rather than discarding them —
    // a partial sitemap/build is better than an empty one.
    console.error("listProductHandles failed mid-pagination:", error)
  }

  return handles
}
