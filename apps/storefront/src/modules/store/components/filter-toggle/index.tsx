"use client"

import { useState, useRef, useEffect } from "react"
import { useTranslations } from "next-intl"
import FilterBar from "@modules/store/components/filter-bar"
import { HttpTypes } from "@medusajs/types"

type Props = {
  collections: HttpTypes.StoreCollection[]
  categories: HttpTypes.StoreProductCategory[]
  selectedCollection?: string
  selectedCategory?: string
}

export default function FilterToggle({ collections, categories, selectedCollection, selectedCategory }: Props) {
  const t = useTranslations("store")
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 font-sans text-[11px] uppercase tracking-[3px] text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] transition-colors"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <line x1="4" y1="6" x2="20" y2="6" />
          <line x1="4" y1="12" x2="16" y2="12" />
          <line x1="4" y1="18" x2="12" y2="18" />
        </svg>
        <span>{t("Filtre")}</span>
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-3 bg-[var(--theme-bg)] border border-[var(--theme-border)] px-5 py-4 z-20 shadow-sm">
          <FilterBar
            collections={collections}
            categories={categories}
            selectedCollection={selectedCollection}
            selectedCategory={selectedCategory}
          />
        </div>
      )}
    </div>
  )
}
