"use client"

import { useOptimistic, useTransition } from "react"
import { useTranslations } from "next-intl"
import { useRouter } from "@i18n/navigation"

import { clx } from "@modules/common/components/ui"
import { updateLocale } from "@lib/data/locale-actions"
import { Locale } from "@lib/data/locales"

type LanguageSelectProps = {
  locales: Locale[]
  currentLocale: string | null
}

const LanguageSelect = ({ locales, currentLocale }: LanguageSelectProps) => {
  const t = useTranslations("layout")
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const active = (currentLocale ?? "ro").toLowerCase()
  // The switch itself (server action + refresh) takes a moment, and until it
  // lands the highlight used to stay on the old language — which read as
  // "the first click didn't work". Move the highlight immediately; it
  // reverts on its own if the switch fails.
  const [selected, setSelected] = useOptimistic(active)

  const selectedIndex = Math.max(
    0,
    locales.findIndex((l) => l.code.toLowerCase() === selected)
  )

  const handleChange = (code: string) => {
    const next = code.toLowerCase()
    if (next === selected || isPending) return
    startTransition(async () => {
      setSelected(next)
      await updateLocale(code)
      router.refresh()
    })
  }

  return (
    <div className="flex items-center justify-between font-sans text-[14px] uppercase tracking-[0.2em] text-[var(--theme-text-muted)]">
      <span>{t("Limbă")}</span>
      <div
        className="relative flex items-center border border-[var(--theme-border)]"
        aria-busy={isPending}
      >
        {/* Sliding highlight */}
        <span
          aria-hidden
          className={clx(
            "absolute inset-y-0 left-0 bg-hunter-gold transition-transform duration-300 motion-reduce:transition-none",
            isPending && "animate-pulse"
          )}
          style={{
            width: `${100 / locales.length}%`,
            transform: `translateX(${selectedIndex * 100}%)`,
            transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)",
          }}
        />
        {locales.map((l, i) => {
          const isSelected = selected === l.code.toLowerCase()
          return (
            <button
              key={l.code}
              onClick={() => handleChange(l.code)}
              aria-pressed={isSelected}
              className={clx(
                "relative z-10 w-10 py-0.5 font-sans text-[11px] uppercase tracking-[2px] transition-colors duration-300",
                i > 0 && "border-l border-[var(--theme-border)]",
                isSelected
                  ? "text-hunter-dark"
                  : "text-[var(--theme-text-muted)] hover:text-hunter-gold",
                "cursor-pointer"
              )}
            >
              {l.code.toUpperCase()}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default LanguageSelect
