"use client"

import { addToCart } from "@lib/data/cart"
import { emitCartUpdated } from "@lib/util/cart-events"
import { HttpTypes } from "@medusajs/types"
import { useState, useMemo, useEffect, useRef } from "react"
import { useLocale, useTranslations } from "next-intl"
import { createPortal } from "react-dom"
import { COLOR_OPTION_NAMES as COLOR_TITLES } from "@lib/util/product"

const COLOR_MAP: Record<string, string> = {
  black: "#1a1a1a",
  white: "#f4f2ee",
  "off-white": "#ede8df",
  ivory: "#e8e2d5",
  cream: "#ddd4be",
  beige: "#c8b89a",
  sand: "#b8a688",
  grey: "#8a9198",
  gray: "#8a9198",
  "light grey": "#b8bfc5",
  "light gray": "#b8bfc5",
  "dark grey": "#474f58",
  "dark gray": "#474f58",
  charcoal: "#3a4149",
  navy: "#1e2e45",
  blue: "#4a6d8c",
  "light blue": "#7a9db8",
  "sky blue": "#6a96b0",
  "dark blue": "#1e3055",
  red: "#8c3a3a",
  burgundy: "#5e2530",
  wine: "#5e2530",
  green: "#2d4f38",
  "hunter green": "#1e3d30",
  olive: "#5e5828",
  khaki: "#8a7d52",
  brown: "#5e3a18",
  camel: "#a07d42",
  tan: "#a07840",
  cognac: "#6e3818",
  gold: "#a8883a",
  yellow: "#a89050",
  orange: "#8c4e28",
  pink: "#c4919f",
  "light pink": "#d4a8b2",
  rose: "#b06870",
  blush: "#c09090",
  purple: "#5e4070",
  lilac: "#9a8ab0",
  lavender: "#b0a8c8",
  silver: "#a8adb2",
}

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

const sortOptionValues = (
  values: HttpTypes.StoreProductOptionValue[],
  isColor: boolean,
  option?: HttpTypes.StoreProductOption,
  variants?: HttpTypes.StoreProductVariant[]
) => {
  if (isColor) {
    // Colors follow variant_rank (matches image grouping — see Galerie
    // media), same as the product page's option-select.tsx — raw
    // option.values order is not consistent across store/preview APIs, so
    // returning it as-is here made color order diverge from the product
    // page. `variants` isn't sorted by the API either, so it's re-ranked
    // before deriving order from it.
    if (!option || !variants) return values
    const rankedVariants = [...variants].sort(
      (a, b) => (a.variant_rank ?? 0) - (b.variant_rank ?? 0)
    )
    const seen: string[] = []
    for (const v of rankedVariants) {
      const val = v.options?.find((o) => o.option_id === option.id)?.value
      if (val && !seen.includes(val)) seen.push(val)
    }
    const ordered = seen
      .map((val) => values.find((v) => v.value === val))
      .filter((v): v is HttpTypes.StoreProductOptionValue => Boolean(v))
    for (const v of values) {
      if (v.value && !seen.includes(v.value)) ordered.push(v)
    }
    return ordered.length ? ordered : values
  }
  return [...values].sort((a, b) => {
    const ai = SIZE_ORDER.indexOf((a.value ?? "").toUpperCase())
    const bi = SIZE_ORDER.indexOf((b.value ?? "").toUpperCase())
    if (ai === -1 && bi === -1)
      return (a.value ?? "").localeCompare(b.value ?? "")
    if (ai === -1) return 1
    if (bi === -1) return -1
    return ai - bi
  })
}

type Props = {
  variants: HttpTypes.StoreProductVariant[]
  options: HttpTypes.StoreProductOption[]
  productHandle: string
  title?: string
  onVariantSelect?: (variant: HttpTypes.StoreProductVariant | null) => void
  mobileOnly?: boolean
  desktopOnly?: boolean
}

export default function QuickAddOverlay({
  variants,
  options,
  productHandle: _productHandle,
  title,
  onVariantSelect,
  mobileOnly,
  desktopOnly,
}: Props) {
  const t = useTranslations("products")
  const locale = useLocale()
  const countryCode = "ro"
  const [selected, setSelected] = useState<Record<string, string>>({})
  const [adding, setAdding] = useState(false)
  const [added, setAdded] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [dragOffset, setDragOffset] = useState(0)
  const dragY = useRef(0)
  const startY = useRef(0)
  const dragging = useRef(false)

  useEffect(() => setMounted(true), [])
  useEffect(() => {
    if (!mobileOpen) {
      setDragOffset(0)
      return
    }
    const scrollbarWidth =
      window.innerWidth - document.documentElement.clientWidth
    document.documentElement.style.overflow = "hidden"
    document.documentElement.style.paddingRight = `${scrollbarWidth}px`
    return () => {
      document.documentElement.style.overflow = ""
      document.documentElement.style.paddingRight = ""
    }
  }, [mobileOpen])

  const closeOverlay = () => {
    setSelected({})
    setAdded(false)
    setMobileOpen(false)
  }

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

  const onDragStart = (e: React.TouchEvent) => {
    dragging.current = true
    startY.current = e.touches[0].clientY
    dragY.current = 0
  }
  const onDragMove = (e: React.TouchEvent) => {
    if (!dragging.current) return
    const delta = e.touches[0].clientY - startY.current
    if (delta < 0) return
    dragY.current = delta
    setDragOffset(delta)
  }
  const onDragEnd = () => {
    dragging.current = false
    if (dragY.current > 80) {
      setDragOffset(0)
      closeOverlay()
    } else setDragOffset(0)
  }

  const isColorOption = (option: HttpTypes.StoreProductOption) => {
    const titleMatch = [
      "color",
      "colour",
      "culoare",
      "colors",
      "colours",
    ].includes((option.title ?? "").toLowerCase())
    if (titleMatch) return true
    const vals = option.values ?? []
    if (vals.length === 0) return false
    const mapped = vals.filter(
      (v) => COLOR_MAP[(v.value ?? "").toLowerCase()] !== undefined
    )
    return mapped.length >= Math.ceil(vals.length / 2)
  }

  // Single-value options are always selected (re-applied after any reset,
  // e.g. post add-to-cart or closing the sheet) — no real choice to make.
  useEffect(() => {
    const autoSelected: Record<string, string> = { ...selected }
    let changed = false

    options.forEach((opt) => {
      const only = opt.values?.length === 1 ? opt.values[0].value : undefined
      if (only && autoSelected[opt.id ?? ""] !== only) {
        autoSelected[opt.id ?? ""] = only
        changed = true
      }
    })

    if (changed) {
      setSelected(autoSelected)
    }
  }, [options, selected])

  const selectLabel = useMemo(() => {
    // Ignore options with a single value — there's no real choice to make,
    // so they shouldn't drive the prompt (e.g. "Selectează culoarea" when
    // there's only one color).
    const missing = options.find(
      (o) => !selected[o.id ?? ""] && (o.values?.length ?? 0) > 1
    )
    if (!missing) return t("Selectează")
    const isColor = COLOR_TITLES.includes(missing.title?.toLowerCase() ?? "")
    return isColor ? t("Selectează culoarea") : t("Selectează mărimea")
  }, [options, selected])

  // Options with only one value have nothing to actually choose (mirrors
  // the product page, which hides the whole options block when there's
  // only one variant) — don't render a picker row for them at all.
  const pickableOptions = useMemo(
    () => options.filter((o) => (o.values?.length ?? 0) > 1),
    [options]
  )

  const mobileTriggerLabel = useMemo(() => {
    // Prefer the first option that actually offers more than one value.
    const meaningful =
      options.find((o) => (o.values?.length ?? 0) > 1) ?? options[0]
    if (!meaningful) return t("Alege mărimea")
    const isColor = COLOR_TITLES.includes(meaningful.title?.toLowerCase() ?? "")
    return isColor ? t("Alege culoarea") : t("Alege mărimea")
  }, [options])

  const selectedVariant = useMemo(() => {
    const selectedCount = Object.keys(selected).length
    if (selectedCount === 0) return null
    if (selectedCount < options.length) return null
    return (
      variants.find((v) =>
        v.options?.every((o) => selected[o.option_id ?? ""] === o.value)
      ) ?? null
    )
  }, [selected, variants, options])

  const effectiveVariant = useMemo(() => {
    if (variants.length === 1) return variants[0]
    return selectedVariant
  }, [variants, selectedVariant])

  const inStock = effectiveVariant
    ? !effectiveVariant.manage_inventory ||
      (effectiveVariant.inventory_quantity ?? 0) > 0 ||
      effectiveVariant.allow_backorder
    : false

  // Whether ANY variant of this product could ever be added — if every
  // variant is out of stock, no combination the sheet could offer would
  // help, so it shouldn't open at all; just show "Stoc epuizat".
  const anyVariantInStock = useMemo(
    () =>
      variants.some(
        (v) =>
          !v.manage_inventory ||
          (v.inventory_quantity ?? 0) > 0 ||
          v.allow_backorder
      ),
    [variants]
  )

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
    setMobileOpen(false)
  }

  const handleOptionClick = (
    e: React.MouseEvent,
    optionId: string,
    value: string
  ) => {
    e.preventDefault()
    e.stopPropagation()
    const opt = options.find((o) => o.id === optionId)
    const isColorOpt = COLOR_TITLES.includes(opt?.title?.toLowerCase() ?? "")
    let next = { ...selected, [optionId]: value }

    if (isColorOpt && next[optionId]) {
      // Changing color keeps the chosen size when the new color still has
      // it; otherwise the size is deselected (never silently swapped).
      const sizeOpt = options.find(
        (o) => !COLOR_TITLES.includes(o.title?.toLowerCase() ?? "")
      )
      if (sizeOpt) {
        const available = new Set(
          variants
            .filter((v) => vmap(v)[optionId] === next[optionId])
            .map((v) => vmap(v)[sizeOpt.id])
            .filter(Boolean)
        )
        const current = selected[sizeOpt.id]
        if (current && !available.has(current)) {
          const { [sizeOpt.id]: _dropped, ...rest } = next
          next = rest
        }
      }
    }

    setSelected(next)

    if (onVariantSelect) {
      const count = Object.values(next).filter(Boolean).length
      if (count === options.length) {
        const match =
          variants.find((v) =>
            v.options?.every((o) => next[o.option_id ?? ""] === o.value)
          ) ?? null
        onVariantSelect(match)
      } else if (count === 0) {
        onVariantSelect(null)
      }
    }
  }

  return (
    <>
      {/* Mobile trigger — opens the portal bottom sheet only when there's
          actually something to choose AND at least one variant could be
          added. Out of stock: disabled, shows "Stoc epuizat", no sheet.
          Single effective variant + in stock: adds directly, no sheet. */}
      {!desktopOnly && (
        <button
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            if (!anyVariantInStock) return
            if (pickableOptions.length === 0) {
              handleAdd(e)
              return
            }
            setMobileOpen(true)
          }}
          disabled={!anyVariantInStock || adding}
          className="w-full py-2 font-sans text-[10px] uppercase tracking-[3px] border border-[var(--theme-border)] text-[var(--theme-text-muted)] bg-[var(--theme-bg)] transition-colors duration-150 active:border-hunter-gold active:text-hunter-gold disabled:opacity-40 disabled:cursor-not-allowed"
          aria-label={mobileTriggerLabel}
        >
          {!anyVariantInStock
            ? t("Stoc epuizat")
            : adding
            ? t("Se adaugă…")
            : t("Adaugă în coș")}
        </button>
      )}

      {/* Desktop panel — rendered flat, parent handles show/hide. When
          there's nothing to pick (single effective variant), only the Add
          to Cart button renders — no wrapping bordered/padded panel. */}
      {!mobileOnly && (
        <div
          className={
            pickableOptions.length
              ? "px-3 pt-3 pb-3 flex flex-col gap-2 bg-[var(--theme-bg)] border border-[var(--theme-border)]"
              : ""
          }
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
          }}
        >
          {pickableOptions.map((option) => {
            const isColorOpt = COLOR_TITLES.includes(
              option?.title?.toLowerCase() ?? ""
            )
            const sortedValues = sortOptionValues(
              option.values ?? [],
              isColorOpt,
              option,
              variants
            )
            return (
              <div
                key={option.id}
                className="flex items-center gap-1 flex-wrap"
              >
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
                      className={`min-w-[28px] px-1.5 py-1 font-sans text-[10px] uppercase tracking-[1.5px] border transition-all duration-150 ${
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
              adding || !inStock || (!effectiveVariant && options.length > 0)
            }
            className="w-full py-2 font-sans text-[10px] uppercase tracking-[4px] transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed border"
            style={{
              background: added ? "transparent" : "#c9a84c",
              color: added ? "#c9a84c" : "#0d0d0d",
              borderColor: added ? "#c9a84c" : "transparent",
            }}
          >
            {adding
              ? t("Se adaugă…")
              : added
              ? t("✓ Adăugat")
              : !effectiveVariant && options.length > 0
              ? selectLabel
              : !inStock
              ? t("Stoc epuizat")
              : t("Adaugă în coș")}
          </button>
        </div>
      )}

      {/* Mobile portal bottom sheet */}
      {mounted &&
        createPortal(
          <>
            <div
              className={`fixed inset-0 z-[9020] bg-black/50 sm:hidden transition-opacity duration-200 ${
                mobileOpen ? "opacity-100" : "opacity-0"
              }`}
              style={{ pointerEvents: mobileOpen ? "auto" : "none" }}
              onTouchEnd={(e) => {
                e.preventDefault()
                ;(
                  window as typeof window & { __overlayClosedAt?: number }
                ).__overlayClosedAt = Date.now()
                closeOverlay()
              }}
              onClick={closeOverlay}
            />
            <div
              style={{
                transform: `translateY(${mobileOpen ? dragOffset : 1000}px)`,
                transition: dragging.current
                  ? "none"
                  : "transform 0.32s cubic-bezier(0.22,1,0.36,1)",
                pointerEvents: mobileOpen ? "auto" : "none",
              }}
              aria-hidden={!mobileOpen}
              className="fixed inset-x-0 bottom-0 z-[9021] bg-[var(--theme-bg)] rounded-t-2xl sm:hidden"
            >
                  {/* Drag handle */}
                  <div
                    className="flex justify-center pt-3 pb-2 cursor-grab active:cursor-grabbing touch-none"
                    onTouchStart={onDragStart}
                    onTouchMove={onDragMove}
                    onTouchEnd={onDragEnd}
                  >
                    <div className="w-9 h-1 rounded-full bg-[var(--theme-border)]" />
                  </div>

                  {/* Options */}
                  <div className="px-6 py-5 flex flex-col gap-6 overflow-y-auto max-h-[50dvh]">
                    {pickableOptions.map((option) => {
                      const isColorOpt = COLOR_TITLES.includes(
                        option?.title?.toLowerCase() ?? ""
                      )
                      const sortedValues = sortOptionValues(
                        option.values ?? [],
                        isColorOpt,
                        option,
                        variants
                      )
                      return (
                        <div key={option.id} className="flex flex-col gap-3">
                          <span className="font-sans text-[12px] uppercase tracking-[3px] text-[var(--theme-text-muted)]">
                            {option.title}
                          </span>
                          <div className="flex flex-wrap gap-2">
                            {sortedValues.map((v) => {
                              const isSelected =
                                selected[option.id ?? ""] === v.value
                              const unavailable = getDisabledValues(
                                option.id ?? ""
                              ).has(v.value ?? "")
                              return (
                                <button
                                  key={v.id}
                                  onClick={(e) =>
                                    !unavailable &&
                                    handleOptionClick(
                                      e,
                                      option.id ?? "",
                                      v.value ?? ""
                                    )
                                  }
                                  disabled={unavailable}
                                  className={`inline-flex items-center justify-center h-8 min-w-[48px] px-3 border font-sans text-[13px] leading-none uppercase tracking-[2px] transition-colors duration-150 ${
                                    isSelected
                                      ? "border-hunter-gold bg-hunter-gold/10 text-[var(--theme-text)]"
                                      : unavailable
                                      ? "border-[var(--theme-border)] text-[var(--theme-text-muted)] opacity-30 line-through cursor-not-allowed"
                                      : "border-[var(--theme-border)] text-[var(--theme-text-muted)] hover:border-[var(--theme-text-muted)]"
                                  }`}
                                >
                                  {v.value}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Footer */}
                  <div className="px-6 py-4 border-t border-[var(--theme-border)] flex gap-3">
                    <button
                      onTouchEnd={(e) => {
                        e.preventDefault()
                        closeOverlay()
                      }}
                      onClick={closeOverlay}
                      className="flex-1 py-3 font-sans text-[12px] uppercase tracking-[3px] border border-[var(--theme-border)] text-[var(--theme-text-muted)] hover:border-[var(--theme-text-muted)] transition-colors"
                    >
                      {t("Înapoi")}
                    </button>
                    <button
                      onClick={handleAdd}
                      disabled={
                        adding ||
                        !inStock ||
                        (!effectiveVariant && options.length > 0)
                      }
                      className="flex-[2] py-3 font-sans text-[12px] uppercase tracking-[3px] bg-hunter-gold text-hunter-dark transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {adding
                        ? t("Se adaugă…")
                        : added
                        ? t("Adăugat ✓")
                        : !effectiveVariant && options.length > 0
                        ? selectLabel
                        : !inStock
                        ? t("Stoc epuizat")
                        : t("Adaugă în coș")}
                    </button>
                  </div>
                </div>
          </>,
          document.body
        )}
    </>
  )
}
