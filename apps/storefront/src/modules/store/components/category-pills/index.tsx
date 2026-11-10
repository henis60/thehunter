"use client"

import { Link } from "@i18n/navigation"
import { HttpTypes } from "@medusajs/types"
import { useEffect, useRef, useState, forwardRef } from "react"
import { useTranslations } from "next-intl"
import { clx } from "@modules/common/components/ui"

// Medusa's admin metadata editor stores values as strings even for
// boolean-looking fields, so a category's always_open metadata can arrive as
// either `true` or `"true"` depending on how it was set. Kept in sync with
// the same helper in store-sidebar/index.tsx (desktop).
const isAlwaysOpen = (category: HttpTypes.StoreProductCategory) => {
  const value = category.metadata?.always_open
  return value === true || value === "true"
}

type Props = {
  categories: HttpTypes.StoreProductCategory[]
  collections: HttpTypes.StoreCollection[]
  selectedCategory?: string
  selectedCollection?: string
  collectionCategories?: HttpTypes.StoreProductCategory[]
  onSelectCategory: (id: string | null) => void
  onSelectCollection: (id: string | null) => void
  onSelectCollectionCategory: (collectionId: string, categoryId: string | null) => void
  onClearFilters: () => void
  /** Builds the href for a target slug, preserving current query params. */
  buildHref: (nextSlug: string[]) => string
}

// Horizontally scrollable row with edge fades that appear/disappear with scroll
const FadeScroller = forwardRef<
  HTMLDivElement,
  { children: React.ReactNode; className?: string }
>(function FadeScroller({ children, className }, forwardedRef) {
  const innerRef = useRef<HTMLDivElement>(null)
  const [fadeLeft, setFadeLeft] = useState(false)
  const [fadeRight, setFadeRight] = useState(false)

  useEffect(() => {
    const el = innerRef.current
    if (!el) return
    const update = () => {
      setFadeLeft(el.scrollLeft > 1)
      setFadeRight(Math.ceil(el.scrollLeft + el.clientWidth) < el.scrollWidth)
    }
    const resizeObs = new ResizeObserver(update)
    const mutationObs = new MutationObserver(() =>
      requestAnimationFrame(update)
    )
    resizeObs.observe(el)
    mutationObs.observe(el, { childList: true, subtree: true })
    el.addEventListener("scroll", update, { passive: true })
    const id = requestAnimationFrame(update)
    return () => {
      cancelAnimationFrame(id)
      resizeObs.disconnect()
      mutationObs.disconnect()
      el.removeEventListener("scroll", update)
    }
  }, [])

  return (
    <div className="relative">
      <div
        ref={(node) => {
          innerRef.current = node
          if (typeof forwardedRef === "function") forwardedRef(node)
          else if (forwardedRef) forwardedRef.current = node
        }}
        className={className}
      >
        {children}
      </div>
      {fadeLeft && (
        <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-6 bg-gradient-to-r from-[var(--theme-bg)] to-transparent" />
      )}
      {fadeRight && (
        <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-[var(--theme-bg)] to-transparent" />
      )}
    </div>
  )
})

/**
 * Horizontal category/collection nav — sits directly under the page
 * title/description, above the divider. Plain underlined links, no boxes.
 *
 * Selection is driven entirely by the onSelect* callbacks (owned by
 * StoreView), which update an optimistic local mirror of category/collection
 * before syncing the URL — so highlighting and the subcategory reveal below
 * update instantly, regardless of how long the navigation itself takes.
 */
export default function CategoryPills({
  categories,
  collections,
  selectedCategory,
  selectedCollection,
  collectionCategories = [],
  onSelectCategory,
  onSelectCollection,
  onSelectCollectionCategory,
  onClearFilters,
  buildHref,
}: Props) {
  const t = useTranslations("store")
  // The actual scrollable element (FadeScroller's outer div) — not the inner
  // content wrapper, whose bounds always equal the full unclipped content.
  const scrollerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const scroller = scrollerRef.current
    if (!scroller) return
    requestAnimationFrame(() => {
      const active = scroller.querySelector<HTMLElement>("[data-active='true']")
      if (!active) return
      const cr = scroller.getBoundingClientRect()
      const ar = active.getBoundingClientRect()
      if (ar.left < cr.left || ar.right > cr.right) {
        active.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" })
      }
    })
  }, [selectedCategory, selectedCollection])

  const link = (active: boolean) =>
    clx(
      "shrink-0 scroll-ml-6 scroll-mr-6 font-sans text-[14px] tracking-[0.5px] leading-none pb-1 border-b-[1.5px] whitespace-nowrap transition-colors",
      active
        ? "text-[var(--theme-text)] border-[var(--theme-text)]"
        : "text-[var(--theme-text-muted)] border-transparent hover:text-[var(--theme-text)]"
    )

  const topCategories = categories.filter((c) => !c.parent_category)
  const activeCategoryId = selectedCollection ? null : selectedCategory
  const selectedCat = activeCategoryId
    ? categories.find((c) => c.id === activeCategoryId)
    : null
  const activeParentId = selectedCat
    ? selectedCat.parent_category?.id ?? selectedCat.id
    : null
  // always_open parents already render their subs inline in the main pill
  // row above (see topCategories.flatMap) — skip them here to avoid showing
  // the same subcategories a second time in this reveal row.
  const activeParentCategory = activeParentId
    ? categories.find((c) => c.id === activeParentId)
    : null
  const subChips =
    activeParentId && !(activeParentCategory && isAlwaysOpen(activeParentCategory))
      ? categories.filter((c) => c.parent_category?.id === activeParentId)
      : []
  const activeParentHandle = activeParentId
    ? categories.find((c) => c.id === activeParentId)?.handle
    : undefined

  if (topCategories.length === 0 && collections.length === 0) return null

  return (
    <div className="small:hidden">
      <FadeScroller
        ref={scrollerRef}
        className="flex items-center gap-5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <div className="flex items-center gap-5">
          <Link
            href={buildHref([])}
            prefetch={false}
            data-active={!selectedCategory && !selectedCollection ? "true" : undefined}
            onClick={onClearFilters}
            className={link(!selectedCategory && !selectedCollection)}
          >
            {t("Toate")}
          </Link>
          {topCategories.flatMap((c) => {
            // always_open categories are pure grouping nodes: they never
            // render as their own pill — their subcategories render directly
            // in their place, always visible, at the same pill level as any
            // other category. Matches store-sidebar's desktop behavior.
            if (isAlwaysOpen(c)) {
              const subs = categories.filter(
                (sub) => sub.parent_category?.id === c.id
              )
              if (subs.length > 0) {
                return subs.map((sub) => (
                  <Link
                    key={sub.id}
                    href={
                      activeCategoryId === sub.id
                        ? buildHref([])
                        : buildHref([sub.handle])
                    }
                    prefetch={false}
                    data-active={
                      activeCategoryId === sub.id ? "true" : undefined
                    }
                    onClick={() =>
                      onSelectCategory(
                        activeCategoryId === sub.id ? null : sub.id
                      )
                    }
                    className={link(activeCategoryId === sub.id)}
                  >
                    {sub.name}
                  </Link>
                ))
              }
            }
            return (
              <Link
                key={c.id}
                href={
                  activeCategoryId === c.id ? buildHref([]) : buildHref([c.handle])
                }
                prefetch={false}
                data-active={activeCategoryId === c.id || activeParentId === c.id ? "true" : undefined}
                onClick={() => onSelectCategory(activeCategoryId === c.id ? null : c.id)}
                className={link(activeCategoryId === c.id || activeParentId === c.id)}
              >
                {c.name}
              </Link>
            )
          })}
          {collections.map((c) => (
            <Link
              key={c.id}
              href={
                selectedCollection === c.id
                  ? buildHref([])
                  : buildHref([c.handle])
              }
              prefetch={false}
              data-active={selectedCollection === c.id ? "true" : undefined}
              onClick={() => onSelectCollection(selectedCollection === c.id ? null : c.id)}
              className={link(selectedCollection === c.id)}
            >
              {c.title}
            </Link>
          ))}
        </div>
      </FadeScroller>

      {/* Subcategory reveal row — CSS-only grid-rows trick, always mounted.
          Switching between two categories that both have subcategories just
          swaps the children with no collapse/expand replay; the height
          transition only plays when toggling to/from zero subcategories. */}
      <div
        className="grid overflow-hidden transition-[grid-template-rows,opacity] duration-[280ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
        style={{
          gridTemplateRows: subChips.length > 0 ? "1fr" : "0fr",
          opacity: subChips.length > 0 ? 1 : 0,
        }}
      >
        <div className="min-h-0 overflow-hidden">
          <FadeScroller className="flex items-center gap-4 overflow-x-auto pt-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {subChips.map((sub) => (
              <Link
                key={sub.id}
                href={
                  activeCategoryId === sub.id
                    ? buildHref(activeParentHandle ? [activeParentHandle] : [])
                    : buildHref([sub.handle])
                }
                prefetch={false}
                onClick={() =>
                  onSelectCategory(activeCategoryId === sub.id ? (activeParentId as string) : sub.id)
                }
                className={link(activeCategoryId === sub.id)}
              >
                {sub.name}
              </Link>
            ))}
          </FadeScroller>
        </div>
      </div>

      {/* Collection sub-category reveal row — collectionCategories is a
          synchronous lookup (precomputed server-side for every collection),
          so this is exactly the same always-mounted grid-rows swap as plain
          categories above: no fetch, no gap, no glitch. */}
      <div
        className="grid overflow-hidden transition-[grid-template-rows,opacity] duration-[280ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
        style={{
          gridTemplateRows:
            selectedCollection && collectionCategories.length > 0 ? "1fr" : "0fr",
          opacity: selectedCollection && collectionCategories.length > 0 ? 1 : 0,
        }}
      >
        <div className="min-h-0 overflow-hidden">
          <FadeScroller className="flex items-center gap-4 overflow-x-auto pt-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {collectionCategories.map((cat) => {
              const collectionHandle = collections.find(
                (c) => c.id === selectedCollection
              )?.handle
              return (
                <Link
                  key={cat.id}
                  href={
                    selectedCategory === cat.id
                      ? buildHref(collectionHandle ? [collectionHandle] : [])
                      : buildHref(
                          collectionHandle ? [collectionHandle, cat.handle] : []
                        )
                  }
                  prefetch={false}
                  onClick={() =>
                    onSelectCollectionCategory(selectedCollection!, selectedCategory === cat.id ? null : cat.id)
                  }
                  className={link(selectedCategory === cat.id)}
                >
                  {cat.name}
                </Link>
              )
            })}
          </FadeScroller>
        </div>
      </div>
    </div>
  )
}
