"use client"

import { addToCart } from "@lib/data/cart"
import { emitCartUpdated } from "@lib/util/cart-events"
import { HttpTypes } from "@medusajs/types"
import { useEffect, useState, useMemo } from "react"
import { useLocale, useTranslations } from "next-intl"
import { COLOR_OPTION_NAMES as COLOR_TITLES } from "@lib/util/product"

const SIZE_ORDER = [
  "2XS",
  "XS",
  "S",
  "M",
  "L",
  "XL",
  "2XL",
  "XXL",
  "3XL",
  "XXXL",
  "4XL",
  "5XL",
  "6XL",
  "7XL",
  "8XL",
  "9XL",
  "10XL",
  "44",
  "46",
  "48",
  "50",
  "52",
  "54",
  "56",
  "58",
  "60",
  "62",
  "64",
  "66",
  "68",
  "70",
  "72",
  "74",
  "76",
  "78",
  "80",
  "82",
  "84",
  "86",
  "88",
  "90",
  "92",
  "94",
  "96",
  "98",
  "100",
  "102",
  "104",
  "106",
  "108",
  "110",
]

const sortOptionValues = (values: HttpTypes.StoreProductOptionValue[]) =>
  [...values].sort((a, b) => {
    const ai = SIZE_ORDER.indexOf((a.value ?? "").toUpperCase())
    const bi = SIZE_ORDER.indexOf((b.value ?? "").toUpperCase())
    if (ai === -1 && bi === -1)
      return (a.value ?? "").localeCompare(b.value ?? "")
    if (ai === -1) return 1
    if (bi === -1) return -1
    return ai - bi
  })

// Colors follow variant_rank (matches image grouping — see Galerie media),
// same as the product page's option-select.tsx — the raw option.values order
// isn't consistent across store/preview APIs, so alphabetical sorting here
// made color order diverge from the product page. `variants` isn't sorted by
// the API either, so it's re-ranked here before deriving order from it.
const colorOrderedValues = (
  option: HttpTypes.StoreProductOption,
  variants: HttpTypes.StoreProductVariant[]
) => {
  const rankedVariants = [...variants].sort(
    (a, b) => (a.variant_rank ?? 0) - (b.variant_rank ?? 0)
  )
  const rawValues = option.values ?? []
  const seen: string[] = []
  for (const v of rankedVariants) {
    const val = v.options?.find((o) => o.option_id === option.id)?.value
    if (val && !seen.includes(val)) seen.push(val)
  }
  const ordered = seen
    .map((val) => rawValues.find((v) => v.value === val))
    .filter((v): v is HttpTypes.StoreProductOptionValue => Boolean(v))
  for (const v of rawValues) {
    if (v.value && !seen.includes(v.value)) ordered.push(v)
  }
  return ordered.length ? ordered : rawValues
}

type Props = {
  variants: HttpTypes.StoreProductVariant[]
  options: HttpTypes.StoreProductOption[]
  productHandle: string
  onVariantSelect?: (variant: HttpTypes.StoreProductVariant | null) => void
}

export default function DesktopQuickAdd({
  variants,
  options,
  productHandle: _productHandle,
  onVariantSelect,
}: Props) {
  const t = useTranslations("products")
  const locale = useLocale()
  const countryCode = "ro"
  const [selected, setSelected] = useState<Record<string, string>>({})
  const [adding, setAdding] = useState(false)

  // Single-value options are always selected (re-applied after any reset,
  // e.g. post add-to-cart) — there's no real choice to make.
  useEffect(() => {
    const next = { ...selected }
    let changed = false
    options.forEach((opt) => {
      const only = opt.values?.length === 1 ? opt.values[0].value : undefined
      if (only && next[opt.id ?? ""] !== only) {
        next[opt.id ?? ""] = only
        changed = true
      }
    })
    if (changed) setSelected(next)
  }, [options, selected])

  const vmap = (v: HttpTypes.StoreProductVariant) =>
    v.options?.reduce((acc, o) => {
      if (o.option_id) acc[o.option_id] = o.value
      return acc
    }, {} as Record<string, string>) ?? {}

  const getDisabledValues = (optionId: string): Set<string> => {
    const opt = options.find((o) => o.id === optionId)
    const allValues = opt?.values?.map((v) => v.value ?? "") ?? []
    const isColorOpt = COLOR_TITLES.includes(opt?.title?.toLowerCase() ?? "")
    if (isColorOpt) {
      const available = new Set(
        variants.map((v) => vmap(v)[optionId]).filter(Boolean)
      )
      return new Set(allValues.filter((v) => !available.has(v)))
    }
    const others = Object.entries(selected).filter(
      ([id, val]) => id !== optionId && !!val
    ) as [string, string][]
    if (others.length === 0) return new Set()
    const available = new Set<string>()
    variants.forEach((v) => {
      const map = vmap(v)
      if (others.every(([id, val]) => map[id] === val) && map[optionId])
        available.add(map[optionId])
    })
    return new Set(allValues.filter((v) => !available.has(v)))
  }

  const effectiveVariant = useMemo(() => {
    if (variants.length === 1) return variants[0]
    const count = Object.keys(selected).length
    if (count < options.length) return null
    return (
      variants.find((v) =>
        v.options?.every((o) => selected[o.option_id ?? ""] === o.value)
      ) ?? null
    )
  }, [selected, variants, options])

  const inStock = effectiveVariant
    ? !effectiveVariant.manage_inventory ||
      (effectiveVariant.inventory_quantity ?? 0) > 0 ||
      effectiveVariant.allow_backorder
    : false

  // Options with only one value have nothing to actually choose (mirrors
  // the product page and the mobile quick-add sheet) — don't render a
  // picker row for them, so a single-variant product only ever shows the
  // Add to Cart button.
  const pickableOptions = useMemo(
    () => options.filter((o) => (o.values?.length ?? 0) > 1),
    [options]
  )

  const selectLabel = useMemo(() => {
    const missing = pickableOptions.find((o) => !selected[o.id ?? ""])
    if (!missing) return t("Selectează")
    return COLOR_TITLES.includes(missing.title?.toLowerCase() ?? "")
      ? t("Selectează culoarea")
      : t("Selectează mărimea")
  }, [pickableOptions, selected])

  const handleOptionClick = (
    e: React.MouseEvent,
    optionId: string,
    value: string
  ) => {
    e.preventDefault()
    e.stopPropagation()
    const opt = options.find((o) => o.id === optionId)
    const isColorOpt = COLOR_TITLES.includes(opt?.title?.toLowerCase() ?? "")
    const toggled = value

    let next = { ...selected, [optionId]: toggled }

    if (isColorOpt && toggled) {
      // Changing color keeps the chosen size when the new color still has
      // it; otherwise the size is deselected (never silently swapped).
      const sizeOpt = options.find(
        (o) => !COLOR_TITLES.includes(o.title?.toLowerCase() ?? "")
      )
      if (sizeOpt) {
        const available = new Set(
          variants
            .filter((v) => vmap(v)[optionId] === toggled)
            .map((v) => vmap(v)[sizeOpt.id ?? ""])
            .filter(Boolean)
        )
        const current = selected[sizeOpt.id ?? ""]
        if (current && !available.has(current)) {
          const { [sizeOpt.id ?? ""]: _dropped, ...rest } = next
          next = rest
        }
      }
    }

    setSelected(next)

    // notify image change
    if (onVariantSelect) {
      const fullMatch =
        variants.find((v) =>
          v.options?.every((o) => next[o.option_id ?? ""] === o.value)
        ) ?? null
      onVariantSelect(fullMatch)
    }
  }

  const handleAdd = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!effectiveVariant?.id || adding) return
    setAdding(true)
    const freshCart = await addToCart({
      variantId: effectiveVariant.id,
      quantity: 1,
      countryCode,
      locale,
    })
    emitCartUpdated(freshCart, { action: "add" })
    setAdding(false)
    setSelected({})
  }

  return (
    <div
      className="hidden sm:block absolute inset-x-0 bottom-0 z-30 bg-[var(--theme-bg)] border border-[var(--theme-border)] translate-y-2 opacity-0 pointer-events-none transition-all duration-300 ease-out group-hover:translate-y-0 group-hover:opacity-100 group-hover:pointer-events-auto"
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
      }}
    >
      <div className="px-3 pt-3 pb-3 flex flex-col gap-2">
        {pickableOptions.map((option) => {
          const isColorOpt = COLOR_TITLES.includes(
            option?.title?.toLowerCase() ?? ""
          )
          const sortedValues = isColorOpt
            ? colorOrderedValues(option, variants)
            : sortOptionValues(option.values ?? [])
          return (
            <div key={option.id} className="flex items-center gap-1 flex-wrap">
              {sortedValues.map((v) => {
                const isSelected = selected[option.id ?? ""] === v.value
                const unavailable = getDisabledValues(option.id ?? "").has(
                  v.value ?? ""
                )
                return (
                  <button
                    key={v.id}
                    onClick={(e) =>
                      !unavailable &&
                      handleOptionClick(e, option.id ?? "", v.value ?? "")
                    }
                    disabled={unavailable}
                    aria-pressed={isSelected}
                    className={`min-w-[28px] px-1.5 py-1 font-sans text-[9px] uppercase tracking-[1.5px] border transition-all duration-150 ${
                      isSelected
                        ? "border-hunter-gold bg-hunter-gold text-hunter-dark"
                        : unavailable
                        ? "border-[var(--theme-border)] text-[var(--theme-text-muted)] opacity-30 line-through cursor-not-allowed"
                        : "border-[var(--theme-border)] text-[var(--theme-text-muted)] hover:border-hunter-gold/60 hover:text-[var(--theme-text)]"
                    }`}
                  >
                    {v.value}
                  </button>
                )
              })}
            </div>
          )
        })}
        <button
          onClick={handleAdd}
          disabled={
            adding || !inStock || (!effectiveVariant && pickableOptions.length > 0)
          }
          className="w-full py-2 font-sans text-[9px] uppercase tracking-[4px] border transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
          style={{
            background: "#c9a84c",
            color: "#0d0d0d",
            borderColor: "transparent",
          }}
        >
          {adding
            ? t("Se adaugă…")
            : !effectiveVariant && pickableOptions.length > 0
            ? selectLabel
            : !inStock
            ? t("Stoc epuizat")
            : t("Adaugă în coș")}
        </button>
      </div>
    </div>
  )
}
