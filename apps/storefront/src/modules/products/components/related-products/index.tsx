import { listProducts } from "@lib/data/products"
import { getRegion } from "@lib/data/regions"
import { HttpTypes } from "@medusajs/types"
import { getTranslations } from "next-intl/server"
import Product from "../product-preview"

type RelatedProductsProps = {
  product: HttpTypes.StoreProduct
  countryCode: string
}

// Generic connector/filler words — matching on these alone would pair
// unrelated products just because of shared filler, which the
// category/collection matching below already covers.
const TITLE_STOPWORDS = new Set([
  "buzunar",
  "de",
  "cu",
  "si",
  "pentru",
  "model",
  "modele",
])

// Lowercase, diacritic-free significant words from a title (e.g. "Cravată
// Medalion Geometric" → ["medalion", "geometric"]) — the first word is
// always the product-type noun (Cravată/Batistă/Butoni/...), dropped
// unconditionally rather than via a maintained list, and short/generic
// remaining words are filtered out too.
function titleKeywords(title: string): string[] {
  const [, ...rest] = title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/[\s-]+/)
  return rest.filter((w) => w.length >= 4 && !TITLE_STOPWORDS.has(w))
}

export default async function RelatedProducts({
  product,
  countryCode,
}: RelatedProductsProps) {
  const t = await getTranslations("products")
  const region = await getRegion(countryCode)
  if (!region) return null

  // Fetch every product with full fields — paginated, not a single capped
  // request, so a catalog past one page's worth of products doesn't
  // silently lose candidates from either section below.
  const FETCH_PAGE_SIZE = 100
  const allProducts: HttpTypes.StoreProduct[] = []
  let fetchPage = 1
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const {
      response: { products: pageProducts, count: totalCount },
    } = await listProducts({
      pageParam: fetchPage,
      queryParams: {
        limit: FETCH_PAGE_SIZE,
        region_id: region.id,
        // *options/*variants.options/+variants.variant_rank are needed for
        // the card's color swatches (getProductColors) — without them
        // product.options is empty and ColorSwatches renders nothing.
        fields:
          "*variants.calculated_price,+variants.inventory_quantity,+variants.options,+variants.variant_rank,*options,*options.values,+metadata,+tags,+type,+categories.id",
      },
      countryCode,
    })
    allProducts.push(...pageProducts)
    if (pageProducts.length === 0 || allProducts.length >= totalCount) break
    fetchPage += 1
  }

  // "Fits with" — other products that have a tag whose value matches the current product's handle
  const currentHandle = product.handle ?? ""
  const fitsWithProducts = allProducts.filter(
    (p) => p.id !== product.id && (p.tags ?? []).some((t) => t.value?.trim() === currentHandle)
  )

  // "You may also like" — ranked by shared significant title words first
  // (e.g. "Cravată Medalion Geometric" pairs with other "medalion geometric"
  // products regardless of category/collection), then topped up with
  // same-collection (or same-category, as a fallback) matches so the section
  // isn't empty just because nothing else shares a keyword.
  const excludeIds = new Set([product.id, ...fitsWithProducts.map((p) => p.id)])
  const currentKeywords = new Set(titleKeywords(product.title ?? ""))
  const productCategoryIds = new Set((product.categories ?? []).map((c) => c.id))

  const candidates = allProducts.filter((p) => !excludeIds.has(p.id))

  const keywordMatches = candidates
    .map((p) => ({
      product: p,
      score: titleKeywords(p.title ?? "").filter((w) => currentKeywords.has(w))
        .length,
    }))
    .filter((m) => m.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((m) => m.product)

  const collectionOrCategoryMatches = candidates.filter((p) => {
    if (product.collection_id) return p.collection_id === product.collection_id
    if (productCategoryIds.size === 0) return false
    return (p.categories ?? []).some((c) => productCategoryIds.has(c.id))
  })

  const similarProductsMap = new Map<string, HttpTypes.StoreProduct>()
  for (const p of [...keywordMatches, ...collectionOrCategoryMatches]) {
    if (!similarProductsMap.has(p.id)) similarProductsMap.set(p.id, p)
  }
  const similarProducts = Array.from(similarProductsMap.values()).slice(0, 4)

  if (!fitsWithProducts.length && !similarProducts.length) return null

  return (
    <>
      {fitsWithProducts.length > 0 && (
        <div className="border-t border-[var(--theme-border)] content-container py-16">
          <div className="mb-10">
            <p className="font-sans text-[11px] uppercase tracking-[8px] text-hunter-green dark:text-hunter-green-m mb-3">
              {t("Completează ținuta")}
            </p>
            <h2 className="font-display text-3xl text-[var(--theme-text)]">
              {t("Se potrivește")} <span className="italic text-hunter-gold">{t("cu")}</span>
            </h2>
          </div>
          <ul className="grid grid-cols-2 small:grid-cols-3 medium:grid-cols-4 gap-x-5 gap-y-10">
            {fitsWithProducts.map((p) => (
              <li key={p.id}>
                <Product region={region} product={p} />
              </li>
            ))}
          </ul>
        </div>
      )}

      {similarProducts.length > 0 && (
        <div className="border-t border-[var(--theme-border)] content-container py-16">
          <div className="mb-10">
            <p className="font-sans text-[11px] uppercase tracking-[5px] text-[var(--theme-text-muted)] hover:text-hunter-gold transition-colors mb-3">
              {t("S-ar putea să-ți placă")}
            </p>
            <h2 className="font-display text-3xl text-[var(--theme-text)]">
              {t("Produse")} <span className="italic text-hunter-gold">{t("similare")}</span>
            </h2>
          </div>
          <ul className="grid grid-cols-2 small:grid-cols-3 medium:grid-cols-4 gap-x-5 gap-y-10">
            {similarProducts.map((p) => (
              <li key={p.id}>
                <Product region={region} product={p} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  )
}
