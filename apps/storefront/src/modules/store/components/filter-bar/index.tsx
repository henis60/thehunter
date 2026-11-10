"use client"

import { HttpTypes } from "@medusajs/types"
import { clx } from "@modules/common/components/ui"
import { useSearchParams } from "next/navigation"
import { usePathname, useRouter } from "@i18n/navigation"
import { useCallback } from "react"

type FilterBarProps = {
  collections: HttpTypes.StoreCollection[]
  categories: HttpTypes.StoreProductCategory[]
  selectedCollection?: string
  selectedCategory?: string
}

function FilterGroup({
  items,
  paramKey,
  selected,
  onSelect,
}: {
  items: { id: string; name: string }[]
  paramKey: string
  selected?: string
  onSelect: (key: string, value: string | null) => void
}) {
  if (!items.length) return null

  return (
    <div className="flex items-center gap-5">
      {items.map((item) => {
        const active = selected === item.id
        return (
          <button
            key={item.id}
            onClick={() => onSelect(paramKey, active ? null : item.id)}
            className={clx(
              "font-sans text-[12px] uppercase tracking-[3px] transition-colors pb-0.5",
              active
                ? "text-[var(--theme-text)] border-b border-hunter-gold"
                : "text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] border-b border-transparent"
            )}
          >
            {item.name}
          </button>
        )
      })}
    </div>
  )
}

export default function FilterBar({
  collections,
  categories,
  selectedCollection,
  selectedCategory,
}: FilterBarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const updateParam = useCallback(
    (key: string, value: string | null) => {
      const params = new URLSearchParams(searchParams)
      if (value) {
        params.set(key, value)
      } else {
        params.delete(key)
      }
      params.delete("page")
      router.push(`${pathname}?${params.toString()}`)
    },
    [pathname, router, searchParams]
  )

  if (!collections.length && !categories.length) return null

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
      <FilterGroup
        items={collections.map((c) => ({ id: c.id, name: c.title }))}
        paramKey="collection"
        selected={selectedCollection}
        onSelect={updateParam}
      />
      {collections.length > 0 && categories.length > 0 && (
        <span className="h-3.5 w-px bg-[var(--theme-border)]" />
      )}
      <FilterGroup
        items={categories.map((c) => ({ id: c.id, name: c.name }))}
        paramKey="category"
        selected={selectedCategory}
        onSelect={updateParam}
      />
    </div>
  )
}
