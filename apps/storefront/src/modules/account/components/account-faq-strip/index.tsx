import { getTranslations } from "next-intl/server"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

const AccountFaqStrip = async () => {
  const t = await getTranslations("account")
  return (
    <div className="bg-[var(--theme-surface)] border border-[var(--theme-border)] p-5 small:p-8 mt-8 small:mt-16 flex flex-col small:flex-row items-stretch small:items-center justify-between gap-5 small:gap-6">
      <div>
        <p className="font-display text-[20px] leading-[1.1] text-[var(--theme-text)] mb-1.5 small:mb-2">
          {t("Ai întrebări?")}
        </p>
        <p className="font-sans text-[13px] text-[var(--theme-text-muted)]">
          {t("Găsește răspunsuri pe pagina de întrebări frecvente")}
        </p>
      </div>
      <LocalizedClientLink
        href="/faq"
        className="shrink-0 h-11 px-6 inline-flex items-center justify-center border border-[var(--theme-border)] font-sans text-[11px] uppercase tracking-[3px] text-[var(--theme-text)] hover:border-hunter-gold hover:text-hunter-gold active:border-hunter-gold active:text-hunter-gold transition-colors"
      >
        {t("Întrebări frecvente")}
      </LocalizedClientLink>
    </div>
  )
}

export default AccountFaqStrip
