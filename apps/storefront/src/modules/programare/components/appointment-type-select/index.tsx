"use client"

import { Listbox, Transition } from "@headlessui/react"
import { useTranslations } from "next-intl"
import { Fragment, useState } from "react"

const OPTIONS = [
  "Consultație personalizată",
  "Sesiune made-to-measure",
]

const labelClass =
  "font-sans text-[10px] uppercase tracking-[3px] text-[var(--theme-text-muted)] mb-2 block"

export default function AppointmentTypeSelect({ hasError, onSelect }: { hasError?: boolean; onSelect?: (v: string) => void }) {
  const t = useTranslations("programare")
  const [selected, setSelected] = useState("")

  const handleChange = (v: string) => {
    setSelected(v)
    onSelect?.(v)
  }

  return (
    <div>
      <label className={`${labelClass} flex items-center gap-1.5`}>
        {t("Tip programare")}
        <span className={`text-base normal-case tracking-normal transition-colors ${hasError && !selected ? "text-red-400/80" : "text-hunter-gold/50"}`}>*</span>
      </label>
      <input type="hidden" name="type" value={selected} />
      <Listbox value={selected} onChange={handleChange}>
        <div className="relative">
          <Listbox.Button className={`relative w-full h-10 px-3 pr-8 text-left bg-transparent border focus:outline-none focus:border-hunter-gold/50 hover:border-hunter-gold/50 transition-colors flex items-center ${hasError && !selected ? "border-red-400/60" : "border-[var(--theme-border)]"}`}>
            <span
              className={`font-sans text-sm truncate ${
                !selected ? "text-[var(--theme-text-muted)]" : "text-[var(--theme-text)]"
              }`}
            >
              {selected ? t(selected) : t("Alege tipul")}
            </span>
            <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--theme-text-muted)]">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 9l6 6 6-6" />
              </svg>
            </span>
          </Listbox.Button>

          <Transition
            as={Fragment}
            leave="transition ease-in duration-100"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <Listbox.Options className="absolute z-20 w-full bg-[var(--theme-bg)] border border-[var(--theme-border)] shadow-lg focus:outline-none">
              {OPTIONS.map((opt) => (
                <Listbox.Option
                  key={opt}
                  value={opt}
                  className="cursor-pointer select-none px-3 py-2.5 hover:bg-[var(--theme-surface)] transition-colors"
                >
                  {({ selected: sel }) => (
                    <div className="flex items-center gap-2.5">
                      <span
                        className={`w-1.5 h-1.5 rounded-full shrink-0 transition-colors ${
                          sel ? "bg-hunter-gold" : "bg-transparent border border-[var(--theme-border)]"
                        }`}
                      />
                      <span
                        className={`font-sans text-sm ${
                          sel ? "text-hunter-gold" : "text-[var(--theme-text)]"
                        }`}
                      >
                        {t(opt)}
                      </span>
                    </div>
                  )}
                </Listbox.Option>
              ))}
            </Listbox.Options>
          </Transition>
        </div>
      </Listbox>
    </div>
  )
}
