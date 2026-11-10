import { getProductPrice } from "@lib/util/get-product-price"
import { getProductColors } from "@lib/util/product-colors"
import { HttpTypes } from "@medusajs/types"
import { useTranslations } from "next-intl"
import PreviewPrice from "./price"
import CardWrapper from "./card-wrapper"
import ProductCardLink from "./product-card-link"

function ColorSwatches({ product }: { product: HttpTypes.StoreProduct }) {
  const colors = getProductColors(product)
  if (colors.length === 0) return null

  return (
    <div className="flex items-center gap-1.5">
      {colors.slice(0, 6).map(({ label, hex }) => (
        <span
          key={label}
          title={label}
          className="h-2 w-3.5 border border-black/15 flex-shrink-0 sm:h-3 sm:w-5"
          style={{ backgroundColor: hex }}
        />
      ))}
      {colors.length > 6 && (
        <span className="text-[10px] text-white/60 ml-0.5">
          +{colors.length - 6}
        </span>
      )}
    </div>
  )
}

export default function ProductPreview({
  product,
  isFeatured,
  region: _region,
  forceDark,
}: {
  product: HttpTypes.StoreProduct
  isFeatured?: boolean
  region: HttpTypes.StoreRegion
  forceDark?: boolean
}) {
  const t = useTranslations("products")
  const { cheapestPrice } = getProductPrice({ product })

  // inventory_quantity is already fetched for every listed variant — surface
  // it, so a sold-out product is obvious from the grid instead of only after
  // opening the PDP.
  const outOfStock =
    (product.variants?.length ?? 0) > 0 &&
    !product.variants!.some((v) => {
      if (!v.manage_inventory) return true
      if (v.allow_backorder) return true
      return (v.inventory_quantity || 0) > 0
    })

  const StockOrPrice = () =>
    outOfStock ? (
      <span className="font-sans text-[11px] uppercase tracking-[2px] text-[var(--theme-text-muted)] whitespace-nowrap">
        {t("Stoc epuizat")}
      </span>
    ) : cheapestPrice ? (
      <PreviewPrice price={cheapestPrice} />
    ) : null

  return (
    <ProductCardLink
      href={`/produs/${product.handle}`}
      className="group flex flex-col relative w-full cursor-pointer"
      style={
        {
          touchAction: "manipulation",
          WebkitTapHighlightColor: "transparent",
        } as React.CSSProperties
      }
    >
      <div data-testid="product-wrapper" className="w-full">
        <CardWrapper
          product={product}
          isFeatured={isFeatured}
          forceDark={forceDark}
        />
      </div>

      {/* Card info — mobile */}
      <div
        className="mt-4 flex flex-col gap-0.5 sm:hidden"
        style={{ minHeight: "2.5rem" }}
      >
        <p
          className={`font-sans text-[10px] uppercase tracking-[2.5px] leading-snug line-clamp-2 transition-colors duration-300 ${
            forceDark
              ? "text-hunter-ivory/80 group-hover:text-hunter-gold"
              : "text-[var(--theme-text)] group-hover:text-hunter-gold"
          }`}
          data-testid="product-title"
        >
          {product.title}
        </p>
        <div className="flex items-center justify-between gap-2 [&_*]:!text-[11px]">
          <ColorSwatches product={product} />
          <div className="ml-auto">
            <StockOrPrice />
          </div>
        </div>
      </div>

      {/* Card info — desktop */}
      <div className="mt-4 hidden sm:flex flex-col gap-0.5">
        <p
          className={`font-sans text-[12px] uppercase tracking-[2px] leading-snug line-clamp-2 transition-colors duration-300 ${
            forceDark
              ? "text-hunter-ivory/80 group-hover:text-hunter-gold"
              : "text-[var(--theme-text)] group-hover:text-hunter-gold"
          }`}
          data-testid="product-title"
        >
          {product.title}
        </p>
        <div className="flex items-center justify-between gap-2">
          <ColorSwatches product={product} />
          <div className="ml-auto">
            <StockOrPrice />
          </div>
        </div>
      </div>
    </ProductCardLink>
  )
}
