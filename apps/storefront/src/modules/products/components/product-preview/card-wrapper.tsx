"use client"

import { HttpTypes } from "@medusajs/types"
import { useState, useCallback } from "react"
import { useTranslations } from "next-intl"
import CardImages from "./card-images"
import DesktopQuickAdd from "./desktop-quick-add"
import { isInStoreOnly } from "@lib/util/product"

// Reveals on hover anywhere over the card link (group), floating above the
// image bottom with an inset gap from the edges.
function HoverOverlay({
  dark,
  children,
}: {
  dark?: boolean
  children: React.ReactNode
}) {
  return (
    <div
      className={`hidden sm:block absolute inset-x-0 bottom-0 z-30 py-3.5 font-sans text-[11px] uppercase tracking-[3px] border text-center pointer-events-none translate-y-2 opacity-0 transition-all duration-300 ease-out group-hover:translate-y-0 group-hover:opacity-100 ${
        dark
          ? "border-white/40 text-white bg-black"
          : "border-[var(--theme-border)] text-[var(--theme-text)] bg-[var(--theme-bg)]"
      }`}
    >
      {children}
    </div>
  )
}

function getVariantImage(
  variant: HttpTypes.StoreProductVariant
): string | null {
  // variant.images is Medusa's real, explicit assignment (set in the admin
  // via the media widget's "Asociază culori" — @medusajs/product's
  // getVariantImages()), and its order mirrors the product gallery's own
  // order for whichever images are assigned to this variant. There used to
  // be a fallback here that guessed a variant's image by matching the
  // variant's position among a product's colors to the Nth image in the
  // gallery — since that's pure index arithmetic with no real link to which
  // photo is actually of which color, reordering the gallery in admin
  // shifted every guess, seemingly at random. An unassigned variant now
  // falls through to the product's normal gallery/thumbnail instead of a
  // guess.
  return variant.images?.length
    ? ((variant.images[0] as HttpTypes.StoreProductImage).url ?? null)
    : null
}

type Props = {
  product: HttpTypes.StoreProduct
  isFeatured?: boolean
  forceDark?: boolean
}

export default function CardWrapper({ product, isFeatured, forceDark }: Props) {
  const t = useTranslations("products")
  const variants = product.variants ?? []
  const options = product.options ?? []

  const [activeImage, setActiveImage] = useState<string | null>(null)
  const [activeVariant, setActiveVariant] = useState<HttpTypes.StoreProductVariant | null>(null)

  const handleVariantSelect = useCallback(
    (variant: HttpTypes.StoreProductVariant | null) => {
      setActiveVariant(variant)
      setActiveImage(variant ? getVariantImage(variant) : null)
    },
    []
  )

  return (
    <div>
      <CardImages
        product={product}
        isFeatured={isFeatured}
        noOverlay={!!forceDark}
        activeImage={activeImage}
        activeVariant={activeVariant}
        onVariantSelect={handleVariantSelect}
      />

      {/* Desktop overlays — revealed on hover anywhere over the card link */}
      {!forceDark && !isInStoreOnly(product) && (
        <DesktopQuickAdd
          variants={variants}
          options={options}
          productHandle={product.handle ?? ""}
          onVariantSelect={handleVariantSelect}
        />
      )}
      {!forceDark && isInStoreOnly(product) && (
        <HoverOverlay>{t("Disponibil în magazin")}</HoverOverlay>
      )}
    </div>
  )
}
