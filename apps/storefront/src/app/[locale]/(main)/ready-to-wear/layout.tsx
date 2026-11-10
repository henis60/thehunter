import { Suspense } from "react"
import { HttpTypes } from "@medusajs/types"
import { getTranslations } from "next-intl/server"
import { Link } from "@i18n/navigation"

import {
  listCollections,
  getCollectionWithProductCategories,
} from "@lib/data/collections"
import { listCategories } from "@lib/data/categories"
import { setRequestLocaleValue } from "@lib/util/request-locale"
import StoreView from "@modules/store/components/store-view"

// Static + ISR: fetches the collection/category lists with cookie-free,
// tag-cached calls. This is a LAYOUT (not the page) so it persists across
// category/collection navigation — only the page segment (the product grid)
// remounts when the URL's dynamic slug changes. Previously this all lived in
// the page itself, so every category/collection click threw away and
// rebuilt the whole sidebar/header (scroll position, open dropdowns,
// animations) even though none of it actually depends on the slug — it
// looked like the entire page was reloading.
export const revalidate = 3600

export default async function ReadyToWearLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  // See (main)/layout.tsx — Next may render this nested layout concurrently
  // with the root [locale]/layout.tsx, so re-seed from this segment's own
  // params before the Promise.all below reads it.
  const { locale } = await params
  setRequestLocaleValue(locale)

  const [{ collections }, categories] = await Promise.all([
    listCollections(),
    listCategories(),
  ])

  // Every collection's subcategories, fetched up front (cached, revalidated
  // hourly like everything else on this page) so selecting a collection on
  // the client is a synchronous lookup — same as plain categories — instead
  // of an on-demand fetch. That on-demand fetch was the actual source of the
  // "glitch": no matter how the loading state was animated, there was always
  // a network gap where the previous collection's subcategories were either
  // still showing (wrong) or being swapped out (visible flicker).
  const categoriesWithChildren = new Set(
    categories
      .filter((c) => (c.category_children?.length ?? 0) > 0)
      .map((c) => c.id)
  )
  const collectionCategoriesEntries = await Promise.all(
    collections.map(async (c) => {
      const full = await getCollectionWithProductCategories(c.id)
      const seen = new Set<string>()
      const cats: HttpTypes.StoreProductCategory[] = []
      for (const product of full?.products ?? []) {
        for (const cat of (product as any).categories ?? []) {
          if (!seen.has(cat.id) && !categoriesWithChildren.has(cat.id)) {
            seen.add(cat.id)
            cats.push(cat)
          }
        }
      }
      return [c.id, cats] as const
    })
  )
  const collectionCategoriesMap = Object.fromEntries(
    collectionCategoriesEntries
  )

  const t = await getTranslations("home")
  const topCategories = categories.filter((c) => !c.parent_category)

  return (
    // Suspense around StoreView: it reads useSearchParams client-side, which
    // must sit under a boundary for the layout to prerender statically. With
    // no `fallback`, React renders NOTHING while suspended — and since this
    // route is static/ISR, that empty gap IS the cached HTML crawlers see
    // (confirmed: zero headings AND zero links server-side, StoreView's own
    // <h1>/sidebar only exist after client hydration runs useSearchParams).
    //
    // The fallback below is a real <h1> (generic "Ready to Wear" — the
    // category-specific label needs client-only URL data) plus a plain,
    // server-rendered link list to every category/collection. It isn't
    // trying to reproduce StoreSidebar's interactive UI (active-state
    // highlighting, onClick handlers) — a crawler only reads `href`s, and
    // duplicating that component's client-owned callbacks here would be
    // both risky and pointless for that audience. Real visitors see this
    // for a single frame at most before hydration swaps in the actual
    // interactive sidebar.
    <Suspense
      fallback={
        <div className="bg-[var(--theme-bg)] w-full min-h-screen">
          <div className="border-b border-[var(--theme-border)]">
            <div className="page-container py-5 small:py-7">
              <h1 className="font-display text-2xl small:text-3xl text-[var(--theme-text)] leading-none">
                {t("Ready to Wear")}
              </h1>
            </div>
          </div>
          <nav
            aria-label={t("Ready to Wear")}
            className="page-container py-6 flex flex-col gap-4"
          >
            {collections.length > 0 && (
              <ul className="flex flex-wrap gap-x-4 gap-y-2">
                {collections.map((c) => (
                  <li key={c.id}>
                    <Link
                      href={`/ready-to-wear/${c.handle}`}
                      className="font-sans text-[12px] uppercase tracking-[2px] text-[var(--theme-text-muted)]"
                    >
                      {c.title}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            {topCategories.length > 0 && (
              <ul className="flex flex-wrap gap-x-4 gap-y-2">
                {topCategories.map((c) => (
                  <li key={c.id}>
                    <Link
                      href={`/ready-to-wear/${c.handle}`}
                      className="font-sans text-[12px] uppercase tracking-[2px] text-[var(--theme-text-muted)]"
                    >
                      {c.name}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </nav>
        </div>
      }
    >
      <StoreView
        collections={collections}
        categories={categories}
        collectionCategoriesMap={collectionCategoriesMap}
      >
        {children}
      </StoreView>
    </Suspense>
  )
}
