"use client"

import { useSearchParams } from "next/navigation"
import { usePathname, useRouter } from "@i18n/navigation"
import { useCallback, useEffect, useState } from "react"
import { useTranslations } from "next-intl"
import { clx } from "@modules/common/components/ui"
import PriceRangeSlider from "@modules/store/components/price-range-slider"
import { useStoreFacets } from "@modules/store/context/store-facets-context"
import { useScrollLock } from "@lib/hooks/use-scroll-lock"
import { SortOptions } from "@modules/store/components/refinement-list/sort-products"

function FilterIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    >
      <line x1="4" y1="6" x2="20" y2="6" />
      <line x1="7" y1="12" x2="17" y2="12" />
      <line x1="10" y1="18" x2="14" y2="18" />
    </svg>
  )
}

export default function DesktopFilterDrawer({
  sortBy,
}: {
  sortBy: SortOptions
}) {
  const t = useTranslations("store")
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { priceBounds, colorFacets, hasProducts } = useStoreFacets()
  const [open, setOpen] = useState(false)
  useScrollLock(open)

  const SORT_OPTIONS: { value: SortOptions; label: string }[] = [
    { value: "created_at", label: t("Cele mai noi") },
    { value: "price_asc", label: t("Preț crescător") },
    { value: "price_desc", label: t("Preț descrescător") },
  ]

  // Applied filters — what the grid actually reflects right now.
  // When every matching product shares the same price, priceBounds is
  // [price, price] — the natural "no filter applied" minimum is still 0
  // (a real, usable range), not `price` again (which would make the slider
  // look pinned/maxed-out with nothing to drag). Mirrors PriceRangeSlider's
  // own singlePrice handling.
  const defaultMinPrice =
    priceBounds[1] > priceBounds[0] ? priceBounds[0] : 0
  const appliedMinPrice =
    Number(searchParams.get("minPrice")) || defaultMinPrice
  const appliedMaxPrice = Number(searchParams.get("maxPrice")) || priceBounds[1]
  const appliedColors = (searchParams.get("color") ?? "")
    .split(",")
    .filter(Boolean)
  const priceActive =
    !!searchParams.get("minPrice") || !!searchParams.get("maxPrice")
  const filterCount = (priceActive ? 1 : 0) + (appliedColors.length > 0 ? 1 : 0)
  const [draftMinPrice, setDraftMinPrice] = useState(appliedMinPrice)
  const [draftMaxPrice, setDraftMaxPrice] = useState(appliedMaxPrice)
  const [draftColors, setDraftColors] = useState(appliedColors)
  const [draftSort, setDraftSort] = useState<SortOptions>(sortBy)

  // Re-sync the draft from the URL every time the drawer opens.
  useEffect(() => {
    if (!open) return
    setDraftMinPrice(appliedMinPrice)
    setDraftMaxPrice(appliedMaxPrice)
    setDraftColors(appliedColors)
    setDraftSort(sortBy)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const pushParams = useCallback(
    (mutate: (params: URLSearchParams) => void) => {
      const params = new URLSearchParams(searchParams)
      mutate(params)
      params.delete("page")
      router.push(`${pathname}?${params.toString()}`)
    },
    [pathname, router, searchParams]
  )

  const toggleDraftColor = (label: string) =>
    setDraftColors((prev) =>
      prev.includes(label) ? prev.filter((c) => c !== label) : [...prev, label]
    )

  // A color the user already selected must stay visible even if it falls
  // outside the current facet list (e.g. combined with another filter) —
  // and lead the list so it's never scrolled out of sight by its own pick.
  // Ordered by the APPLIED selection, not the draft one, so toggling a
  // swatch doesn't reshuffle the list mid-interaction — it only reorders
  // once "Aplică filtre" commits the new selection.
  const displayedColors = [
    ...appliedColors,
    ...colorFacets.filter((c) => !appliedColors.includes(c)),
  ]

  const draftFilterCount =
    (draftMinPrice > defaultMinPrice || draftMaxPrice < priceBounds[1] ? 1 : 0) +
    (draftColors.length > 0 ? 1 : 0)

  const applyDraft = () => {
    pushParams((params) => {
      if (draftMinPrice > defaultMinPrice)
        params.set("minPrice", String(draftMinPrice))
      else params.delete("minPrice")
      if (draftMaxPrice < priceBounds[1])
        params.set("maxPrice", String(draftMaxPrice))
      else params.delete("maxPrice")
      if (draftColors.length) params.set("color", draftColors.join(","))
      else params.delete("color")
      if (draftSort !== "created_at") params.set("sortBy", draftSort)
      else params.delete("sortBy")
    })
    setOpen(false)
  }

  const clearFacets = () => {
    setDraftMinPrice(defaultMinPrice)
    setDraftMaxPrice(priceBounds[1])
    setDraftColors([])
    setDraftSort("created_at")
    pushParams((params) => {
      params.delete("minPrice")
      params.delete("maxPrice")
      params.delete("color")
      params.delete("sortBy")
    })
    setOpen(false)
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={clx(
          "flex items-center gap-2 font-sans text-[11px] uppercase tracking-[3px] transition-colors",
          filterCount > 0
            ? "text-hunter-gold"
            : "text-[var(--theme-text-muted)] hover:text-[var(--theme-text)]"
        )}
      >
        <FilterIcon />
        {t("Filtru")}
      </button>

      {/* Backdrop — above the sticky nav (z-[9001]) so the drawer covers it too */}
      <div
        className={clx(
          "fixed inset-0 z-[9020] bg-black/40 transition-opacity duration-200",
          open ? "opacity-100" : "opacity-0"
        )}
        style={{ pointerEvents: open ? "auto" : "none" }}
        onClick={() => setOpen(false)}
      />

      {/* Right-side drawer */}
      <div
        className="fixed top-0 right-0 bottom-0 z-[9021] w-[380px] max-w-[90vw] bg-[var(--theme-bg)] border-l border-[var(--theme-border)] flex flex-col transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
        style={{ transform: `translateX(${open ? "0%" : "100%"})` }}
        aria-hidden={!open}
      >
        <div className="flex items-center justify-between px-8 h-16 border-b border-[var(--theme-border)] shrink-0">
          <span className="font-sans text-[11px] uppercase tracking-[4px] text-[var(--theme-text)]">
            {t("Filtru")}
          </span>
          <button
            onClick={() => setOpen(false)}
            aria-label={t("Închide")}
            className="w-7 h-7 flex items-center justify-center text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path
                d="M1 1L11 11M11 1L1 11"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-2 flex-1">
          {/* Sortare */}
          <div className="py-4 border-b border-[var(--theme-border)]">
            <p className="font-sans text-[10px] uppercase tracking-[4px] text-[var(--theme-text-muted)] mb-3">
              {t("Sortare")}
            </p>
            <div
              className={clx(
                "flex flex-col gap-1",
                !hasProducts && "opacity-40 pointer-events-none"
              )}
            >
              {SORT_OPTIONS.map((opt) => {
                const active = draftSort === opt.value
                return (
                  <button
                    key={opt.value}
                    onClick={() => setDraftSort(opt.value)}
                    aria-pressed={active}
                    disabled={!hasProducts}
                    className={clx(
                      "flex items-center gap-2.5 py-1.5 font-sans text-[12px] uppercase tracking-[1px] transition-colors text-left",
                      active
                        ? "text-hunter-gold"
                        : "text-[var(--theme-text-muted)] hover:text-[var(--theme-text)]"
                    )}
                  >
                    <span
                      className={clx(
                        "w-3 h-3 rounded-full border transition-colors shrink-0",
                        active
                          ? "border-hunter-gold bg-hunter-gold"
                          : "border-[var(--theme-border)]"
                      )}
                    />
                    {opt.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="py-4">
            <p className="font-sans text-[10px] uppercase tracking-[4px] text-[var(--theme-text-muted)] mb-3">
              {t("Preț")}
            </p>
            <PriceRangeSlider
              bounds={priceBounds}
              value={[draftMinPrice, draftMaxPrice]}
              onCommit={([lo, hi]) => {
                setDraftMinPrice(lo)
                setDraftMaxPrice(hi)
              }}
            />
          </div>

          <div className="py-4 border-t border-[var(--theme-border)]">
            <p className="font-sans text-[10px] uppercase tracking-[4px] text-[var(--theme-text-muted)] mb-3">
              {t("Culoare")}
            </p>
            {displayedColors.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {displayedColors.map((label) => {
                  const active = draftColors.includes(label)
                  return (
                    <button
                      key={label}
                      onClick={() => toggleDraftColor(label)}
                      aria-pressed={active}
                      className={clx(
                        "px-3 py-1.5 font-sans text-[12px] uppercase tracking-[1px] border transition-colors",
                        active
                          ? "border-hunter-gold text-hunter-gold"
                          : "border-[var(--theme-border)] text-[var(--theme-text-muted)] hover:border-[var(--theme-text-muted)]"
                      )}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
            ) : (
              <p className="font-sans text-[12px] text-[var(--theme-text-muted)] opacity-40">
                {t("Nicio culoare disponibilă")}
              </p>
            )}
          </div>
        </div>

        <div className="px-6 pt-4 pb-6 border-t border-[var(--theme-border)] flex gap-3 shrink-0">
          <button
            onClick={clearFacets}
            disabled={draftFilterCount === 0}
            className="flex-1 h-11 font-sans text-[11px] uppercase tracking-[3px] border border-[var(--theme-border)] text-[var(--theme-text-muted)] whitespace-nowrap disabled:opacity-40 hover:border-[var(--theme-text-muted)] transition-colors"
          >
            {t("Resetează")}
          </button>
          <button
            onClick={applyDraft}
            className="flex-1 h-11 font-sans text-[11px] uppercase tracking-[3px] bg-hunter-gold text-hunter-dark hover:opacity-90 transition-opacity"
          >
            {t("Aplică filtre")}
          </button>
        </div>
      </div>
    </>
  )
}
