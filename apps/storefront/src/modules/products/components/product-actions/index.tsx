"use client"

import { addToCart } from "@lib/data/cart"
import { emitCartUpdated } from "@lib/util/cart-events"
import { HttpTypes } from "@medusajs/types"
import { Button } from "@modules/common/components/ui"
import Divider from "@modules/common/components/divider"
import OptionSelect from "@modules/products/components/product-actions/option-select"
import isEqual from "lodash/isEqual"
import { useLocale, useTranslations } from "next-intl"
import { useEffect, useMemo, useRef, useState } from "react"
import ProductPrice from "../product-price"
import MobileActions from "./mobile-actions"
import { useSetSelectedVariant } from "@modules/products/context/selected-variant-context"
import {
  isInStoreOnly,
  sortedVariants,
  COLOR_OPTION_NAMES as COLOR_TITLES,
} from "@lib/util/product"
import { getProductPrice } from "@lib/util/get-product-price"
import { trackViewItem, trackAddToCart } from "@lib/util/analytics"

type ProductActionsProps = {
  product: HttpTypes.StoreProduct
  region: HttpTypes.StoreRegion
  disabled?: boolean
}

const optionsAsKeymap = (
  variantOptions: HttpTypes.StoreProductVariant["options"]
) => {
  // Always returns {} rather than undefined for a variant with no option
  // values (Medusa's single-SKU "Default variant" pattern) — callers
  // compare this against the initial `options` state, which also defaults
  // to {}; returning undefined here made that comparison always fail,
  // leaving the single variant permanently unresolved ("Alege varianta"
  // shown forever instead of "Adaugă în coș", with nothing to actually pick).
  return (
    variantOptions?.reduce((acc: Record<string, string>, varopt) => {
      if (varopt.option_id) acc[varopt.option_id] = varopt.value
      return acc
    }, {}) ?? {}
  )
}

const isVariantInStock = (v: HttpTypes.StoreProductVariant) => {
  if (!v.manage_inventory) return true
  if (v.allow_backorder) return true
  return (v.inventory_quantity || 0) > 0
}

export default function ProductActions({
  product,
  disabled,
}: ProductActionsProps) {
  const t = useTranslations("products")
  // addToCart runs as a Server Action here, outside any page render — it
  // has no route [locale] param to read, so pass the client's current
  // locale explicitly (see request-locale.ts).
  const locale = useLocale()
  const [options, setOptions] = useState<Record<string, string | undefined>>(
    () => {
      if (product.variants?.length) {
        // Prefer the first purchasable variant — auto-selecting variants[0]
        // when it happens to be sold out made a partly-available product
        // load looking entirely unbuyable. Sorted by variant_rank first, or
        // this "first" is whatever order the API happened to return, not the
        // order set via Galerie media.
        const ranked = sortedVariants(product)
        const initial = ranked.find(isVariantInStock) ?? ranked[0]
        return optionsAsKeymap(initial.options) ?? {}
      }
      return {}
    }
  )
  const [isAdding, setIsAdding] = useState(false)
  const countryCode = "ro"

  // GA4 view_item — fire once when the product page mounts (consent-gated in
  // the helper). Uses the cheapest variant price as the representative value.
  useEffect(() => {
    const { cheapestPrice } = getProductPrice({ product })
    trackViewItem(
      {
        id: product.id,
        name: product.title ?? "",
        price: cheapestPrice?.calculated_price_number,
        category: product.collection?.title ?? undefined,
      },
      cheapestPrice?.currency_code?.toUpperCase() || "RON"
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.id])

  const selectedVariant = useMemo(() => {
    if (!product.variants || product.variants.length === 0) {
      return
    }

    return product.variants.find((v) => {
      const variantOptions = optionsAsKeymap(v.options)
      return isEqual(variantOptions, options)
    })
  }, [product.variants, options])

  const isColorOpt = (optId: string) =>
    COLOR_TITLES.includes(
      product.options?.find((o) => o.id === optId)?.title?.toLowerCase() ?? ""
    )

  const variantMap = (v: HttpTypes.StoreProductVariant) =>
    v.options?.reduce((acc, o) => {
      if (o.option_id) acc[o.option_id] = o.value
      return acc
    }, {} as Record<string, string>) ?? {}

  const variantInStock = isVariantInStock

  // update the options when a variant is selected
  const setOptionValue = (optionId: string, value: string) => {
    setOptions((prev) => {
      const next = { ...prev, [optionId]: value }
      if (isColorOpt(optionId)) {
        // When color changes, keep current size if available, else pick first available
        const sizeOpt = product.options?.find(
          (o) => !COLOR_TITLES.includes(o.title?.toLowerCase() ?? "")
        )
        if (sizeOpt) {
          const available = new Set(
            (product.variants ?? [])
              .filter((v) => variantMap(v)[optionId] === value)
              .map((v) => variantMap(v)[sizeOpt.id])
              .filter(Boolean)
          )
          const current = prev[sizeOpt.id]
          if (!current || !available.has(current)) {
            const first = sizeOpt.values?.find((v) =>
              available.has(v.value ?? "")
            )
            if (first?.value) next[sizeOpt.id] = first.value
          }
        }
      }
      return next
    })
  }

  //check if the selected options produce a valid variant
  const isValidVariant = useMemo(() => {
    return product.variants?.some((v) => {
      const variantOptions = optionsAsKeymap(v.options)
      return isEqual(variantOptions, options)
    })
  }, [product.variants, options])

  // Shared with VariantAwareGallery via context, not the URL — writing to
  // the URL via the router used to re-suspend the Suspense boundary fed by
  // ProductActionsWrapper (an async Server Component that refetches on every
  // navigation) on every variant change, wiping this component's own
  // `options` state right after. From the user's view, size/color selection
  // appeared to silently reset itself.
  const setSelectedVariantId = useSetSelectedVariant()

  useEffect(() => {
    setSelectedVariantId(isValidVariant ? selectedVariant?.id ?? null : null)
  }, [selectedVariant, isValidVariant, setSelectedVariantId])

  // check if the selected variant is in stock
  const inStock = useMemo(() => {
    // If we don't manage inventory, we can always add to cart
    if (selectedVariant && !selectedVariant.manage_inventory) {
      return true
    }

    // If we allow back orders on the variant, we can add to cart
    if (selectedVariant?.allow_backorder) {
      return true
    }

    // If there is inventory available, we can add to cart
    if (
      selectedVariant?.manage_inventory &&
      (selectedVariant?.inventory_quantity || 0) > 0
    ) {
      return true
    }

    // Otherwise, we can't add to cart
    return false
  }, [selectedVariant])

  // check if the whole product is out of stock (no purchasable variant)
  const productOutOfStock = useMemo(() => {
    if (!product.variants || product.variants.length === 0) {
      return false
    }
    return !product.variants.some((v) => {
      if (!v.manage_inventory) return true
      if (v.allow_backorder) return true
      return (v.inventory_quantity || 0) > 0
    })
  }, [product.variants])

  const getDisabledValues = (optionId: string): Set<string> => {
    const allValues =
      product.options
        ?.find((o) => o.id === optionId)
        ?.values?.map((v) => v.value ?? "") ?? []
    if (isColorOpt(optionId)) {
      // Color: only disable if no variant exists for that color at all
      const available = new Set(
        (product.variants ?? [])
          .map((v) => variantMap(v)[optionId])
          .filter(Boolean)
      )
      return new Set(allValues.filter((v) => !available.has(v)))
    }
    // Size: mark as unavailable if no matching variant exists OR it's out of stock
    const others = Object.entries(options).filter(
      ([id, val]) => id !== optionId && !!val
    ) as [string, string][]
    // No `others` (single-option product) is not a reason to skip the stock
    // check — with an empty list `every` is vacuously true, so every variant
    // is considered and sold-out sizes still get marked unavailable.
    const available = new Set<string>()
    product.variants?.forEach((v) => {
      const map = variantMap(v)
      if (
        others.every(([id, val]) => map[id] === val) &&
        map[optionId] &&
        variantInStock(v)
      ) {
        available.add(map[optionId])
      }
    })
    return new Set(allValues.filter((v) => !available.has(v)))
  }

  const actionsRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLDivElement>(null)

  // The sticky mobile bar is a stand-in for the real on-page button ONLY
  // while it hasn't fully appeared on screen yet — shown from the top of the
  // page, hidden once the real button's bottom edge has scrolled into view
  // (i.e. the whole button is visible, not just a sliver of its top), and
  // shown again if scrolled back up below that point.
  const [showMobileBar, setShowMobileBar] = useState(true)

  useEffect(() => {
    const el = buttonRef.current
    if (!el) return
    let raf = 0
    const check = () => {
      raf = 0
      // 12px early — the sticky bar's own vertical padding (py-3) — so the
      // handoff feels seamless instead of both being visible for a moment.
      setShowMobileBar(
        el.getBoundingClientRect().bottom > window.innerHeight - 12
      )
    }
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(check)
    }
    check()
    window.addEventListener("scroll", onScroll, { passive: true })
    window.addEventListener("resize", onScroll)
    return () => {
      window.removeEventListener("scroll", onScroll)
      window.removeEventListener("resize", onScroll)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [])

  // add the selected variant to the cart
  const handleAddToCart = async () => {
    if (!selectedVariant?.id) return null

    setIsAdding(true)

    const freshCart = await addToCart({
      variantId: selectedVariant.id,
      quantity: 1,
      countryCode,
      locale,
    })
    emitCartUpdated(freshCart, { action: "add" })

    const { variantPrice } = getProductPrice({
      product,
      variantId: selectedVariant.id,
    })
    trackAddToCart(
      {
        id: product.id,
        name: product.title ?? "",
        price: variantPrice?.calculated_price_number,
        quantity: 1,
        variant: selectedVariant.title ?? undefined,
        category: product.collection?.title ?? undefined,
      },
      variantPrice?.currency_code?.toUpperCase() || "RON"
    )

    setIsAdding(false)
  }

  return (
    <>
      <div className="flex flex-col gap-y-2" ref={actionsRef}>
        <div>
          {/* Material is a property of the product, not of its variants —
              keep it outside the multi-variant guard so single-variant
              products don't silently lose the block. */}
          <div className="flex flex-col gap-y-4">
            {product.material && (
              <div
                className="flex flex-col gap-y-3"
                data-testid="product-material"
              >
                <span className="font-sans text-[12px] uppercase tracking-[3px] text-[var(--theme-text-muted)]">
                  {t("Material")}
                </span>
                <div className="flex flex-wrap gap-2">
                  {product.material.split(",").map((m) => {
                    const value = m.trim()
                    if (!value) return null
                    return (
                      <span
                        key={value}
                        className="inline-flex items-center justify-center h-8 px-3 bg-[var(--theme-surface)] font-serif text-sm text-[var(--theme-text)] cursor-default select-none"
                      >
                        {value}
                      </span>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
          {(product.variants?.length ?? 0) > 1 && (
            <div className="flex flex-col gap-y-4 mt-4">
              {/* Options with only one value have nothing to actually
                  choose — don't render a picker row for them at all. */}
              {(product.options || [])
                .filter((option) => (option.values?.length ?? 0) > 1)
                .map((option) => {
                return (
                  <div key={option.id}>
                    <OptionSelect
                      option={option}
                      current={options[option.id]}
                      updateOption={setOptionValue}
                      title={option.title ?? ""}
                      data-testid="product-options"
                      disabled={!!disabled || isAdding}
                      disabledValues={getDisabledValues(option.id)}
                      variants={product.variants}
                    />
                  </div>
                )
              })}
              <Divider />
            </div>
          )}
        </div>

        <ProductPrice product={product} variant={selectedVariant} />

        <div ref={buttonRef}>
          {isInStoreOnly(product) ? (
            <div className="w-full font-sans text-[10px] uppercase tracking-[4px] text-[#cfd8d2] border border-[rgba(207,216,210,0.35)] px-3 py-[10px] text-center cursor-default">
              {t("Disponibil în magazin")}
            </div>
          ) : (
            <Button
              onClick={handleAddToCart}
              disabled={
                !inStock ||
                !selectedVariant ||
                !!disabled ||
                isAdding ||
                !isValidVariant
              }
              variant="primary"
              className="w-full h-12 rounded-none !bg-hunter-gold !text-hunter-dark !border-transparent hover:!bg-hunter-gold-b font-sans uppercase tracking-[3px] text-[13px] transition-colors disabled:!bg-[var(--theme-surface)] disabled:!text-[var(--theme-text-muted)]"
              isLoading={isAdding}
              data-testid="add-product-button"
            >
              {productOutOfStock
                ? t("Indisponibil")
                : !selectedVariant || !isValidVariant
                ? // Mirrors the mobile sheet: an unresolved selection is a
                  // prompt to pick, not a sold-out product. (The old
                  // `!options` test was dead — options is always an object.)
                  t("Alege varianta")
                : !inStock
                ? t("Indisponibil")
                : t("Adaugă în coș")}
            </Button>
          )}
        </div>
        <MobileActions
          product={product}
          variant={selectedVariant}
          options={options}
          updateOptions={setOptionValue}
          inStock={inStock}
          handleAddToCart={handleAddToCart}
          isAdding={isAdding}
          show={showMobileBar}
          optionsDisabled={!!disabled || isAdding}
        />
      </div>
    </>
  )
}
