"use client"

import { useTranslations } from "next-intl"
import { usePathname } from "@i18n/navigation"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

export default function AccountBackLink() {
  const t = useTranslations("account")
  const route = usePathname()

  if (route === "/account") return null

  return (
    <LocalizedClientLink
      href="/account"
      className="small:hidden inline-flex items-center gap-1.5 font-sans text-[12px] uppercase tracking-[3px] text-[var(--theme-text-muted)] hover:text-hunter-gold transition-colors mt-4 mb-2"
      data-testid="account-back-link"
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <polyline points="15 6 9 12 15 18" />
      </svg>
      {t("Înapoi la profil")}
    </LocalizedClientLink>
  )
}
