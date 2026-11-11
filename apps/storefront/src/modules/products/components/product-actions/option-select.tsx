"use client"

import { HttpTypes } from "@medusajs/types"
import { clx } from "@modules/common/components/ui"
import { isColorOption as isColorOptionTitle } from "@lib/util/product"
import { useTranslations } from "next-intl"
import React from "react"
import { compareSizeValues } from "@lib/util/sort-sizes"

type OptionSelectProps = {
  option: HttpTypes.StoreProductOption
  current: string | undefined
  updateOption: (title: string, value: string) => void
  title: string
  disabled: boolean
  disabledValues?: Set<string>
  variants?: HttpTypes.StoreProductVariant[] | null
  "data-testid"?: string
}

const OptionSelect: React.FC<OptionSelectProps> = ({
  option,
  current,
  updateOption,
  title,
  "data-testid": dataTestId,
  disabled,
  disabledValues,
  variants,
}) => {
  const t = useTranslations("products")
  const isColorOption = isColorOptionTitle(title)

  const rawValues = (option.values ?? []).map((v) => v.value)

  // Colors follow variant_rank (matches image grouping — see the Galerie
  // media widget, which re-ranks variants to follow drag-reordered images),
  // since the raw option.values order is not consistent across store/preview
  // APIs. The API does not itself sort the `variants` relation by rank, so it
  // must be sorted here rather than trusting array order.
  const colorOrdered = () => {
    const rankedVariants = [...(variants ?? [])].sort(
      (a, b) => (a.variant_rank ?? 0) - (b.variant_rank ?? 0)
    )
    const seen: string[] = []
    for (const v of rankedVariants) {
      const val = v.options?.find((o) => o.option_id === option.id)?.value
      if (val && !seen.includes(val)) seen.push(val)
    }
    // Append any value not covered by a variant, preserving raw order
    for (const val of rawValues) {
      if (val && !seen.includes(val)) seen.push(val)
    }
    return seen.length ? seen : rawValues
  }

  // Colors keep variant order; only sizes are sorted logically.
  const filteredOptions = isColorOption
    ? colorOrdered()
    : [...rawValues].sort(compareSizeValues)

  return (
    <div className="flex flex-col gap-y-3">
      <span className="font-sans text-[11px] uppercase tracking-[3px] text-[var(--theme-text-muted)]">
        {isColorOption ? t("Selectează culoarea") : t("Selectează mărimea")}
      </span>
      <div className="flex flex-wrap gap-2" data-testid={dataTestId}>
        {filteredOptions.map((v) => {
          const active = v === current
          const unavailable = disabledValues?.has(v) ?? false
          return (
            <button
              onClick={() => updateOption(option.id, v)}
              aria-pressed={active}
              key={v}
              className={clx(
                "inline-flex items-center justify-center h-8 min-w-[48px] px-3 border font-sans font-medium text-[12px] leading-none uppercase tracking-[2px] transition-colors duration-150",
                active
                  ? "border-hunter-gold bg-hunter-gold text-hunter-dark"
                  : unavailable
                  ? "border-[var(--theme-border)] text-[var(--theme-text-muted)] opacity-30 line-through cursor-not-allowed"
                  : "border-[var(--theme-border)] bg-transparent text-[var(--theme-text-muted)] hover:border-hunter-gold/60 hover:text-[var(--theme-text)]"
              )}
              disabled={disabled || unavailable}
              data-testid="option-button"
            >
              {v}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default OptionSelect
