"use client"

import { useTranslations } from "next-intl"
import { clx } from "@modules/common/components/ui"

export type SortOptions = "price_asc" | "price_desc" | "created_at"

type SortProductsProps = {
  sortBy: SortOptions
  setQueryParams: (name: string, value: SortOptions) => void
  "data-testid"?: string
}

const SortProducts = ({
  "data-testid": dataTestId,
  sortBy,
  setQueryParams,
}: SortProductsProps) => {
  const t = useTranslations("store")
  const sortOptions: { value: SortOptions; label: string }[] = [
    { value: "created_at", label: t("Cele mai noi") },
    { value: "price_asc", label: t("Preț crescător") },
    { value: "price_desc", label: t("Preț descrescător") },
  ]
  const handleChange = (value: SortOptions) => {
    setQueryParams("sortBy", value)
  }

  return (
    <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2" data-testid={dataTestId}>
      <span className="font-sans text-[10px] uppercase tracking-[5px] text-[var(--theme-text-muted)]">
        {t("Sortare")}
      </span>
      <div className="flex items-center gap-5">
        {sortOptions.map((opt) => (
          <button
            key={opt.value}
            onClick={() => handleChange(opt.value)}
            className={clx(
              "font-sans text-[11px] uppercase tracking-[3px] transition-colors pb-1 border-b",
              sortBy === opt.value
                ? "text-[var(--theme-text)] border-hunter-gold"
                : "text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] border-transparent"
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export default SortProducts
