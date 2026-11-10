import { getTranslations } from "next-intl/server"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

const SignInPrompt = async () => {
  const t = await getTranslations("cart")
  return (
    <div className="flex flex-col gap-4 small:flex-row small:items-center small:justify-between small:gap-6 py-4 px-4 small:px-5 border border-[var(--theme-border)]">
      <div className="min-w-0">
        <p className="font-sans text-[11px] uppercase tracking-[2px] text-[var(--theme-text)]">
          {t("Ai deja un cont?")}
        </p>
        <p className="font-sans text-[10px] uppercase tracking-[2px] text-[var(--theme-text-muted)] mt-1 leading-relaxed">
          {t("Conectează-te pentru o experiență mai bună")}
        </p>
      </div>
      <LocalizedClientLink
        href="/profil?redirectTo=/cos"
        data-testid="sign-in-button"
        className="shrink-0 text-center font-sans text-[10px] uppercase tracking-[3px] border border-[var(--theme-border)] text-[var(--theme-text-muted)] hover:border-hunter-gold hover:text-hunter-gold transition-colors px-5 py-3 small:py-2.5 w-full small:w-auto"
      >
        {t("Intră în cont")}
      </LocalizedClientLink>
    </div>
  )
}

export default SignInPrompt
