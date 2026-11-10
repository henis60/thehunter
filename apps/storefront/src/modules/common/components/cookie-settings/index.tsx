"use client"

import { useTranslations } from "next-intl"
import { useConsent } from "@lib/context/consent-context"

export default function CookieSettings() {
  const { accept, reject } = useConsent()
  const t = useTranslations("common")

  return (
    <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="flex gap-3">
        <button
          type="button"
          onClick={reject}
          className="h-11 rounded-none border border-[var(--theme-border)] bg-transparent px-6 font-sans text-[13px] uppercase tracking-[3px] text-[var(--theme-text)] transition-colors hover:border-[var(--theme-text)]"
        >
          {t("Doar necesare")}
        </button>
        <button
          type="button"
          onClick={accept}
          className="h-11 rounded-none bg-hunter-gold px-6 font-sans text-[13px] uppercase tracking-[3px] text-hunter-dark transition-colors hover:bg-hunter-gold-b"
        >
          {t("Accept toate")}
        </button>
      </div>
    </div>
  )
}
