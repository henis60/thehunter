"use client"

import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"

import LocalizedClientLink from "@modules/common/components/localized-client-link"

// "Back" should return to wherever the visitor actually came from (shop grid,
// homepage, cart drawer, a search result, etc.), not always the shop grid.
// router.back() gives real browser-history behavior, but only when there IS
// a same-site previous page — a direct visit / new tab / external referrer
// (Google, a shared link) has nothing meaningful to go back to, so those
// fall through to the plain link below instead of leaving the site or
// no-op'ing on an empty history stack.
export default function ProductBackLink({ fallbackHref }: { fallbackHref: string }) {
  const t = useTranslations("products")
  const router = useRouter()

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    try {
      if (
        document.referrer &&
        new URL(document.referrer).origin === window.location.origin
      ) {
        e.preventDefault()
        router.back()
      }
    } catch {
      // Malformed referrer — fall through to the normal link navigation.
    }
  }

  return (
    <LocalizedClientLink
      href={fallbackHref}
      onClick={handleClick}
      className="inline-flex items-end gap-2 text-[var(--theme-text-muted)] hover:text-[var(--theme-gold)] transition-colors font-sans text-[12px] uppercase tracking-[3px]"
    >
      <svg
        width="18"
        height="18"
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
      <span>{t("Înapoi")}</span>
    </LocalizedClientLink>
  )
}
