import React from "react"
import { HttpTypes } from "@medusajs/types"
import { Heading, Text } from "@modules/common/components/ui"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

type ProductInfoProps = {
  product: HttpTypes.StoreProduct
  action?: React.ReactNode
}

const ProductInfo = ({ product, action }: ProductInfoProps) => {
  return (
    <div id="product-info" className="flex flex-col">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-wrap min-w-0">
          {product.collection ? (
            <LocalizedClientLink
              href={`/collections/${product.collection.handle}`}
              className="font-sans text-[10px] uppercase tracking-[5px] text-[var(--theme-text-muted)] hover:text-hunter-gold transition-colors"
            >
              {product.collection.title}
            </LocalizedClientLink>
          ) : (
            product.categories?.map((cat) => (
              <LocalizedClientLink
                key={cat.id}
                href={`/ready-to-wear/${cat.handle}`}
                className="font-sans text-[10px] uppercase tracking-[5px] text-[var(--theme-text-muted)] hover:text-hunter-gold transition-colors"
              >
                {cat.name}
              </LocalizedClientLink>
            ))
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {/* The page's <h1> — product pages had none server-side before this. */}
      <Heading
        level="h1"
        className="font-display text-4xl small:text-[42px] leading-[1.05] text-[var(--theme-text)]"
        data-testid="product-title"
      >
        {product.title}
      </Heading>
      {product.subtitle && (
        <Text
          className="font-serif italic text-[18px] leading-relaxed text-[var(--theme-text-muted)] whitespace-pre-line mt-4"
          data-testid="product-subtitle"
        >
          {product.subtitle}
        </Text>
      )}
    </div>
  )
}

export default ProductInfo
