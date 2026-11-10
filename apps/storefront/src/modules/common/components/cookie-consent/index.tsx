"use client"

import { Link } from "@i18n/navigation"
import { useEffect, useState } from "react"
import { AnimatePresence, m as motion } from "framer-motion"
import { useTranslations } from "next-intl"
import CookieConsentBanner from "react-cookie-consent"
import { useConsent, CONSENT_COOKIE } from "@lib/context/consent-context"

export default function CookieConsent() {
  const { consent, loaded, accept, reject } = useConsent()
  const t = useTranslations("common")

  // Don't render the banner at all until the visitor scrolls, so it doesn't
  // compete with the first paint of the page.
  const [hasScrolled, setHasScrolled] = useState(false)

  useEffect(() => {
    if (window.scrollY > 0) {
      setHasScrolled(true)
      return
    }
    const onScroll = () => setHasScrolled(true)
    window.addEventListener("scroll", onScroll, { once: true, passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  // Gate on our own consent state (not the library's internal cookie check)
  // so the wrapper actually unmounts on accept/decline — that's what lets
  // AnimatePresence play the slide-down exit instead of the content just
  // vanishing.
  const shouldRender = loaded && hasScrolled && consent === null

  return (
    <AnimatePresence>
      {shouldRender && (
        <motion.div
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "tween", duration: 0.4, ease: "easeOut" }}
          className="fixed inset-x-0 bottom-0 z-50"
        >
          <CookieConsentBanner
            location="bottom"
            cookieName={CONSENT_COOKIE}
            expires={365}
            sameSite="lax"
            enableDeclineButton
            onAccept={accept}
            onDecline={reject}
            buttonText={t("Accept")}
            declineButtonText={t("Doar necesare")}
            disableStyles
            containerClasses="flex flex-col gap-3 border-t border-[var(--theme-border)] bg-[var(--theme-chrome)] px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:px-6"
            contentClasses="font-serif text-[14px] leading-snug text-[var(--theme-text-muted)] sm:text-[15px]"
            buttonWrapperClasses="flex w-full shrink-0 items-center gap-2 sm:w-auto"
            buttonClasses="h-10 flex-1 rounded-none bg-hunter-gold px-4 font-sans text-[12px] uppercase tracking-[2px] text-hunter-dark transition-colors hover:bg-hunter-gold-b sm:h-9 sm:flex-none"
            declineButtonClasses="h-10 flex-1 rounded-none border border-[var(--theme-border)] bg-transparent px-4 font-sans text-[12px] uppercase tracking-[2px] text-[var(--theme-text)] transition-colors hover:border-[var(--theme-text)] sm:h-9 sm:flex-none"
            ariaAcceptLabel={t("Accept toate cookies")}
            ariaDeclineLabel={t("Doar cookies necesare")}
          >
            {t("Acest site folosește cookies pentru a analiza traficul și a-ți oferi o experiență de navigare cât mai plăcută")}{" "}
            <Link
              href="/cookie-policy"
              className="underline underline-offset-2 transition-colors hover:text-[var(--theme-text)]"
            >
              {t("Află mai multe")}
            </Link>
            .
          </CookieConsentBanner>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
