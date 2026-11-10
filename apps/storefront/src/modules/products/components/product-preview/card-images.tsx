"use client"

import { HttpTypes } from "@medusajs/types"
import Image from "next/image"
import { useTranslations } from "next-intl"
import FavoriteButton from "./favorite-button"
import QuickAddOverlay from "./quick-add-overlay"
import { isInStoreOnly, sortedVariants } from "@lib/util/product"

type Props = {
  product: HttpTypes.StoreProduct
  isFeatured?: boolean
  noOverlay?: boolean
  activeImage?: string | null
  activeVariant?: HttpTypes.StoreProductVariant | null
  onVariantSelect?: (variant: HttpTypes.StoreProductVariant | null) => void
}

export default function CardImages({ product, isFeatured, noOverlay, activeImage, activeVariant, onVariantSelect }: Props) {
  const t = useTranslations("products")
  const allImages = product.images ?? []
  const variants = product.variants ?? []
  const options = product.options ?? []
  // variant_rank-sorted — the "first" variant otherwise depends on whatever
  // order the API returns, not the order set via Galerie media (see
  // sortedVariants()).
  const rankedVariants = sortedVariants(product)

  const mainImage = product.thumbnail ?? allImages[0]?.url
  const hoverImage = allImages[1]?.url

  // Always show mainImage as base; crossfade activeImage on top when set
  const showHover = !activeImage && !!hoverImage

  return (
    <div className="relative cursor-pointer w-full">
      <div className="relative overflow-hidden w-full bg-white" style={{ paddingBottom: "133.333%" }}>
        {mainImage && (
          <Image
            src={mainImage}
            alt={product.title ?? ""}
            fill
            sizes="(max-width: 1024px) 50vw, 25vw"
            className={`object-contain object-center transition-all duration-700 ease-out ${showHover ? "sm:group-hover:opacity-0" : activeImage ? "" : "sm:group-hover:scale-[1.06]"}`}
            priority={isFeatured}
          />
        )}

        {showHover && (
          <Image
            src={hoverImage!}
            alt={product.title ?? ""}
            fill
            sizes="(max-width: 1024px) 50vw, 25vw"
            className="object-contain object-center opacity-0 scale-[1.03] transition-all duration-700 ease-out sm:group-hover:opacity-100 sm:group-hover:scale-100"
          />
        )}

        {/* Active variant image — fades in over base image, no flash */}
        {activeImage && (
          <Image
            src={activeImage}
            alt={product.title ?? ""}
            fill
            sizes="(max-width: 1024px) 50vw, 25vw"
            className="object-contain object-center transition-opacity duration-500 ease-out opacity-0"
            onLoad={(e) => { (e.currentTarget as HTMLImageElement).style.opacity = "1" }}
          />
        )}

        <FavoriteButton
          productId={product.id}
          productHandle={product.handle ?? undefined}
          productTitle={product.title ?? undefined}
          productThumbnail={activeImage ?? product.thumbnail}
          // Before any color/size is picked, this must resolve to the exact
          // same variant the quick-add overlay defaults to (variants[0]) —
          // otherwise favoriting with nothing selected saves variantId=null,
          // and then explicitly picking that same (first) variant afterwards
          // compares as "different", letting it be added a second time
          // instead of being recognized as already favorited.
          variantId={(activeVariant ?? rankedVariants[0] ?? null)?.id ?? null}
          variantTitle={
            (((activeVariant ?? rankedVariants[0]) as any)?.options as
              | { value?: string }[]
              | undefined
            )
              ?.map((o) => o.value)
              .filter(Boolean)
              .join(" · ") ||
            (activeVariant ?? rankedVariants[0])?.title ||
            null
          }
        />
      </div>

      {/* Mobile trigger — below the image, doesn't cover the photo */}
      {!noOverlay && !isInStoreOnly(product) && (
        <div className="sm:hidden">
          <QuickAddOverlay
            variants={variants}
            options={options}
            productHandle={product.handle ?? ""}
            title={product.title ?? ""}
            onVariantSelect={onVariantSelect}
            mobileOnly
          />
        </div>
      )}

      {!noOverlay && isInStoreOnly(product) && (
        <div className="sm:hidden py-2 font-sans text-[10px] uppercase tracking-[3px] border border-[var(--theme-border)] text-[var(--theme-text-muted)] bg-[var(--theme-bg)] text-center">
          {t("Disponibil în magazin")}
        </div>
      )}
    </div>
  )
}
