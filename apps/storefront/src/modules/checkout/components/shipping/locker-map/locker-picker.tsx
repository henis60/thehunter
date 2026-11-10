"use client"
import {
  Combobox,
  ComboboxButton,
  ComboboxInput,
  ComboboxOption,
  ComboboxOptions,
} from "@headlessui/react"
import { ChevronUpDown } from "@medusajs/icons"
import { EawbLocker, EawbLockerOrigin } from "@lib/data/fulfillment"
import { useTranslations } from "next-intl"
import dynamic from "next/dynamic"
import MapErrorBoundary from "./map-error-boundary"

const LockerMap = dynamic(() => import("./locker-map"), {
  ssr: false,
  loading: () => <MapSkeleton />,
})

// Matches the shipping-options loading skeleton (bordered rows with pulsing
// bars) instead of a single solid pulsing block, for a consistent loading
// language across the delivery step.
function MapSkeleton() {
  return (
    <div className="h-56 sm:h-72 md:h-80 w-full border border-[var(--theme-border)] p-4 flex flex-col gap-3 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="w-3 h-3 rounded-full bg-[var(--theme-border)]" />
        <div className="h-3 w-32 rounded bg-[var(--theme-border)]" />
      </div>
      <div className="flex items-center gap-3">
        <div className="w-3 h-3 rounded-full bg-[var(--theme-border)]" />
        <div className="h-3 w-24 rounded bg-[var(--theme-border)]" />
      </div>
    </div>
  )
}

type LockerPickerProps = {
  lockers: EawbLocker[]
  filteredLockers: EawbLocker[]
  loadingLockers: boolean
  selectedLocker: EawbLocker | null
  onSelectLocker: (locker: EawbLocker | null) => void
  lockerQuery: string
  onQueryChange: (query: string) => void
  origin: EawbLockerOrigin
}

export default function LockerPicker({
  lockers,
  filteredLockers,
  loadingLockers,
  selectedLocker,
  onSelectLocker,
  lockerQuery,
  onQueryChange,
  origin,
}: LockerPickerProps) {
  const t = useTranslations("checkout")

  if (loadingLockers) {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between px-4 py-3 border border-[var(--theme-border)] animate-pulse">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-[var(--theme-border)]" />
            <div className="h-3 w-40 rounded bg-[var(--theme-border)]" />
          </div>
        </div>
        <MapSkeleton />
      </div>
    )
  }

  if (lockers.length === 0) {
    return (
      <span className="font-serif italic text-[15px] text-[var(--theme-text-muted)]">
        {t("Niciun locker disponibil pentru acest curier în localitatea ta Alege livrare la ușă")}
      </span>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <Combobox
        value={selectedLocker}
        onChange={onSelectLocker}
        immediate
        onClose={() => onQueryChange("")}
      >
        <div className="relative w-full">
          <ComboboxInput
            className="appearance-none w-full h-10 px-3 pr-8 bg-transparent border border-[var(--theme-border)] text-[var(--theme-text)] font-sans text-[14px] focus:outline-none focus:border-[var(--theme-text-muted)] hover:border-[var(--theme-text-muted)] transition-colors"
            displayValue={(l: EawbLocker | null) => l?.name ?? ""}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder={t("Caută locker după nume sau adresă")}
            autoComplete="off"
            data-testid="locker-input"
          />
          <ComboboxButton className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--theme-text-muted)]">
            <ChevronUpDown />
          </ComboboxButton>
          <ComboboxOptions
            anchor="bottom start"
            className="z-[1200] max-h-40 overflow-auto border border-[var(--theme-border)] bg-[var(--theme-bg,#0D0D0D)] shadow-lg focus:outline-none [--anchor-gap:4px]"
            style={{ width: "var(--input-width)" }}
          >
            {filteredLockers.length === 0 ? (
              <div className="px-3 py-1.5 font-sans text-[14px] text-[var(--theme-text-muted)]">
                {t("Niciun rezultat")}
              </div>
            ) : (
              filteredLockers.map((l) => (
                <ComboboxOption
                  key={l.id}
                  value={l}
                  className="cursor-pointer px-3 py-1.5 font-sans text-[14px] leading-tight text-[var(--theme-text)] data-[focus]:bg-hunter-gold/10 data-[focus]:text-hunter-gold"
                >
                  <span className="block truncate">{l.name}</span>
                  <span className="block text-[13px] text-[var(--theme-text-muted)] truncate">
                    {l.address}
                  </span>
                </ComboboxOption>
              ))
            )}
          </ComboboxOptions>
        </div>
      </Combobox>

      <div className="relative isolate z-0">
        <MapErrorBoundary>
          <LockerMap
            lockers={filteredLockers}
            selectedLocker={selectedLocker}
            onSelect={onSelectLocker}
            origin={origin}
          />
        </MapErrorBoundary>
      </div>
    </div>
  )
}
