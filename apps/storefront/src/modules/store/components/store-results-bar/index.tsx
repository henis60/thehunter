"use client"

import { useSearchParams } from "next/navigation"
import { usePathname, useRouter } from "@i18n/navigation"
import { useCallback, useEffect, useRef, useState } from "react"
import { useTranslations } from "next-intl"
import { clx } from "@modules/common/components/ui"
import { SortOptions } from "@modules/store/components/refinement-list/sort-products"
import PriceRangeSlider from "@modules/store/components/price-range-slider"
import { useScrollLock } from "@lib/hooks/use-scroll-lock"

export type ViewMode = "grid" | "list"

function ViewToggleIcon({ view }: { view: ViewMode }) {
  // Shows the icon for the view you'd switch TO.
  return view === "grid" ? (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <rect x="3" y="4" width="18" height="6" />
      <rect x="3" y="14" width="18" height="6" />
    </svg>
  ) : (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <rect x="3" y="3" width="8" height="8" />
      <rect x="13" y="3" width="8" height="8" />
      <rect x="3" y="13" width="8" height="8" />
      <rect x="13" y="13" width="8" height="8" />
    </svg>
  )
}

function FilterIcon() {
  return (
    <svg
      width="15"
      height="15"
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

export default function StoreResultsBar({
  count,
  loading,
  view,
  onViewChange,
  colorFacets = [],
  priceBounds,
  hasProducts = true,
}: {
  count: number
  loading?: boolean
  view: ViewMode
  onViewChange: (v: ViewMode) => void
  colorFacets?: string[]
  priceBounds: [number, number]
  hasProducts?: boolean
}) {
  const t = useTranslations("store")
  const sortOptions: { value: SortOptions; label: string }[] = [
    { value: "created_at", label: t("Cele mai noi") },
    { value: "price_asc", label: t("Preț crescător") },
    { value: "price_desc", label: t("Preț descrescător") },
  ]
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [open, setOpen] = useState(false)
  useScrollLock(open)
  const [dragOffset, setDragOffset] = useState(0)
  const dragging = useRef(false)
  const startY = useRef(0)

  const onHandlePointerDown = (e: React.PointerEvent) => {
    dragging.current = true
    startY.current = e.clientY
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onHandlePointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return
    const delta = e.clientY - startY.current
    if (delta < 0) return
    setDragOffset(delta)
  }
  const onHandlePointerUp = () => {
    if (!dragging.current) return
    dragging.current = false
    if (dragOffset > 80) setOpen(false)
    setDragOffset(0)
  }

  // Applied filters — what the grid actually reflects right now.
  const appliedSortBy =
    (searchParams.get("sortBy") as SortOptions) || "created_at"
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
  const [draftSort, setDraftSort] = useState(appliedSortBy)
  const [draftMinPrice, setDraftMinPrice] = useState(appliedMinPrice)
  const [draftMaxPrice, setDraftMaxPrice] = useState(appliedMaxPrice)
  const [draftColors, setDraftColors] = useState(appliedColors)

  // Re-sync the draft from the URL every time the sheet opens.
  useEffect(() => {
    if (!open) return
    setDraftSort(appliedSortBy)
    setDraftMinPrice(appliedMinPrice)
    setDraftMaxPrice(appliedMaxPrice)
    setDraftColors(appliedColors)
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
      if (draftSort !== "created_at") params.set("sortBy", draftSort)
      else params.delete("sortBy")
      if (draftMinPrice > defaultMinPrice)
        params.set("minPrice", String(draftMinPrice))
      else params.delete("minPrice")
      if (draftMaxPrice < priceBounds[1])
        params.set("maxPrice", String(draftMaxPrice))
      else params.delete("maxPrice")
      if (draftColors.length) params.set("color", draftColors.join(","))
      else params.delete("color")
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
    <div className="small:hidden flex items-center justify-between py-4">
      {loading ? (
        <span className="h-2.5 w-16 bg-[var(--theme-surface)] animate-pulse" />
      ) : (
        <span className="font-sans text-[11px] uppercase tracking-[2px] text-[var(--theme-text-muted)]">
          {t("{count, plural, one {# produs} other {# produse}}", { count })}
        </span>
      )}

      <div className="flex items-center gap-4">
        <button
          aria-label={
            view === "grid" ? t("Vizualizare listă") : t("Vizualizare grid")
          }
          onClick={() => onViewChange(view === "grid" ? "list" : "grid")}
          className="text-[var(--theme-text)]"
        >
          <ViewToggleIcon view={view} />
        </button>

        <button
          onClick={() => setOpen(true)}
          aria-label={t("Filtre")}
          className={`relative text-[var(--theme-text)] ${
            filterCount > 0 ? "text-hunter-gold" : ""
          }`}
        >
          <FilterIcon />
        </button>
      </div>

      <>
        <div
          className={`fixed inset-0 z-[90] bg-black/40 transition-opacity duration-200 ${
            open ? "opacity-100" : "opacity-0"
          }`}
          style={{ pointerEvents: open ? "auto" : "none" }}
          onClick={() => setOpen(false)}
        />
        <div
          className="fixed left-0 right-0 bottom-0 z-[91] max-h-[80vh] bg-[var(--theme-bg)] rounded-t-2xl flex flex-col"
          style={{
            transform: `translateY(${open ? dragOffset : 1000}px)`,
            transition: dragging.current
              ? "none"
              : "transform 0.32s cubic-bezier(0.22,1,0.36,1)",
            pointerEvents: open ? "auto" : "none",
          }}
          aria-hidden={!open}
        >
          <div
            onPointerDown={onHandlePointerDown}
            onPointerMove={onHandlePointerMove}
            onPointerUp={onHandlePointerUp}
            onPointerCancel={onHandlePointerUp}
            className="flex justify-center pt-3 pb-2 shrink-0 cursor-grab active:cursor-grabbing touch-none"
          >
            <span className="w-9 h-1 rounded-full bg-[var(--theme-border)]" />
          </div>

          <div className="overflow-y-auto px-5 py-2 pb-8">
            {/* Same sections + order as the desktop drawer: sort → price → colors */}
            <div className="py-3">
              <p className="font-sans text-[10px] uppercase tracking-[4px] text-[var(--theme-text-muted)] mb-3">
                {t("Sortare")}
              </p>
              <div
                className={clx(
                  "flex flex-col gap-1",
                  !hasProducts && "opacity-40 pointer-events-none"
                )}
              >
                {sortOptions.map((opt) => {
                  const active = draftSort === opt.value
                  return (
                    <button
                      key={opt.value}
                      onClick={() => setDraftSort(opt.value)}
                      aria-pressed={active}
                      disabled={!hasProducts}
                      className={clx(
                        "flex items-center gap-2.5 py-2 font-sans text-[12px] uppercase tracking-[1px] transition-colors text-left",
                        active
                          ? "text-hunter-gold"
                          : "text-[var(--theme-text-muted)]"
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

            <div className="py-3 border-t border-[var(--theme-border)]">
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

            <div className="py-3 border-t border-[var(--theme-border)]">
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
                            : "border-[var(--theme-border)] text-[var(--theme-text-muted)]"
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

          <div className="sticky bottom-0 px-5 pt-4 pb-2 bg-[var(--theme-bg)] border-t border-[var(--theme-border)] flex gap-3">
            <button
              onClick={clearFacets}
              disabled={draftFilterCount === 0}
              className="flex-1 h-11 font-sans text-[11px] uppercase tracking-[3px] border border-[var(--theme-border)] text-[var(--theme-text-muted)] whitespace-nowrap disabled:opacity-40"
            >
              {t("Resetează")}
            </button>
            <button
              onClick={applyDraft}
              className="flex-1 h-11 font-sans text-[11px] uppercase tracking-[3px] bg-hunter-gold text-hunter-dark"
            >
              {t("Aplică filtre")}
            </button>
          </div>
        </div>
      </>
    </div>
  )
}
