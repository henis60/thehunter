import { getTranslations } from "next-intl/server"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

export default async function Footer() {
  const t = await getTranslations("layout")
  return (
    <footer className="w-full bg-[var(--theme-chrome)] border-t border-[var(--theme-border)]">
      <div className="content-container flex flex-wrap items-center justify-between gap-x-6 gap-y-1 py-3">
        <LocalizedClientLink
          href="/"
          className="font-display text-sm tracking-[0.12em] flex items-baseline gap-1.5"
        >
          <span className="text-[var(--theme-text)] uppercase">The Hunter</span>
          <span className="italic text-hunter-gold uppercase">house</span>
        </LocalizedClientLink>

        <span className="hidden medium:inline font-serif italic text-xs text-hunter-gold/70">
          {t("Return of the Elegant Gentleman")}
        </span>

        <span className="font-sans text-[10px] uppercase tracking-[3px] text-[var(--theme-text-muted)]">
          {t("© {year} Toate drepturile rezervate", { year: new Date().getFullYear() })}
        </span>
      </div>
    </footer>
  )
}
