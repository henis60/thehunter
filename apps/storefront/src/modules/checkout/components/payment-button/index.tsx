"use client"

import { isManual, isNetopia } from "@lib/constants"
import { initiateNetopiaPayment, placeOrder } from "@lib/data/cart"
import { HttpTypes } from "@medusajs/types"
import React, { useState } from "react"
import { useLocale, useTranslations } from "next-intl"
import ErrorMessage from "../error-message"
import { getDisplayableErrorMessage } from "@lib/util/stale-deployment"
import Spinner from "@modules/common/icons/spinner"
import { hasAllShippingMethods } from "@lib/util/dropshipping"

type PaymentButtonProps = {
  cart: HttpTypes.StoreCart
  availablePaymentMethods: { id: string }[]
  "data-testid": string
}

const PaymentButton: React.FC<PaymentButtonProps> = ({
  cart,
  availablePaymentMethods,
  "data-testid": dataTestId,
}) => {
  const t = useTranslations("checkout")
  const notReady =
    !cart ||
    !cart.shipping_address ||
    !cart.billing_address ||
    !cart.email ||
    !hasAllShippingMethods(cart)

  // Provider-ul se ia din metodele disponibile, NU dintr-o sesiune de plată
  // existentă. Înainte, pasul de review crea o sesiune doar ca butonul să afle
  // provider-ul de aici — iar butonul crea la click încă una, cu datele
  // complete. Rezultatul: două tranzacții la Netopia pentru fiecare checkout,
  // dintre care una mereu neplătită. O sesiune existentă (revenire în pas,
  // reîncărcare) rămâne prioritară, ca să nu schimbăm provider-ul sub o plată
  // deja începută.
  const paymentSession = cart.payment_collection?.payment_sessions?.[0]
  const providerId =
    paymentSession?.provider_id ?? availablePaymentMethods[0]?.id

  switch (true) {
    case isManual(providerId):
      return (
        <ManualTestPaymentButton notReady={notReady} data-testid={dataTestId} />
      )
    case isNetopia(providerId):
      return (
        <NetopiaPaymentButton
          notReady={notReady}
          cart={cart}
          providerId={providerId!}
          data-testid={dataTestId}
        />
      )
    default:
      return (
        <button
          disabled
          className="w-full py-3 bg-hunter-gold text-[#0D0D0D] font-sans text-[12px] uppercase tracking-[4px] opacity-40 cursor-not-allowed"
        >
          {t("Selectează o metodă de plată")}
        </button>
      )
  }
}

const ManualTestPaymentButton = ({ notReady }: { notReady: boolean }) => {
  const t = useTranslations("checkout")
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const onPaymentCompleted = async () => {
    await placeOrder()
      .catch((err) => {
        setErrorMessage(getDisplayableErrorMessage(err, t("A apărut o eroare Reîncearcă")))
      })
      .finally(() => {
        setSubmitting(false)
      })
  }

  const handlePayment = () => {
    setSubmitting(true)

    onPaymentCompleted()
  }

  return (
    <>
      <button
        disabled={notReady || submitting}
        onClick={handlePayment}
        data-testid="submit-order-button"
        className={`relative w-full py-3 bg-hunter-gold text-[#0D0D0D] font-sans text-[12px] uppercase tracking-[4px] hover:opacity-90 transition-opacity disabled:cursor-not-allowed overflow-hidden ${
          notReady ? "opacity-40" : ""
        }`}
      >
        <span
          className={`flex items-center justify-center gap-2 transition-opacity duration-150 ${
            submitting ? "opacity-0" : "opacity-100"
          }`}
        >
          {t("Plasează comanda")}
        </span>
        {submitting && (
          <span className="absolute inset-0 flex items-center justify-center gap-2">
            <Spinner size="14" />
            {t("Se procesează…")}
          </span>
        )}
      </button>
      <ErrorMessage
        error={errorMessage}
        data-testid="manual-payment-error-message"
      />
    </>
  )
}

// Fingerprint de browser recomandat de Netopia pentru scoring 3DS/fraudă.
// Colectat client-side (backend-ul Medusa nu are acces la navigator/screen).
function collectBrowserInfo(): Record<string, string> {
  if (typeof window === "undefined") return {}
  const nav = window.navigator
  const scr = window.screen
  return {
    BROWSER_USER_AGENT: nav.userAgent,
    OS: nav.platform ?? "",
    OS_VERSION: "",
    MOBILE: /Mobi|Android/i.test(nav.userAgent) ? "true" : "false",
    SCREEN_POINT: "false",
    SCREEN_PRINT: `Current Resolution: ${scr.width}x${scr.height}, Available Resolution: ${scr.availWidth}x${scr.availHeight}, Color Depth: ${scr.colorDepth}`,
    BROWSER_COLOR_DEPTH: String(scr.colorDepth),
    BROWSER_SCREEN_HEIGHT: String(scr.height),
    BROWSER_SCREEN_WIDTH: String(scr.width),
    BROWSER_PLUGINS: Array.from(nav.plugins ?? [])
      .map((p) => p.name)
      .join(", "),
    BROWSER_JAVA_ENABLED: "false",
    BROWSER_LANGUAGE: nav.language ?? "",
    BROWSER_TZ: Intl.DateTimeFormat().resolvedOptions().timeZone ?? "",
    BROWSER_TZ_OFFSET: String(new Date().getTimezoneOffset() * -1),
  }
}

const NetopiaPaymentButton = ({
  cart,
  providerId,
  notReady,
  "data-testid": dataTestId,
}: {
  cart: HttpTypes.StoreCart
  providerId: string
  notReady: boolean
  "data-testid"?: string
}) => {
  const t = useTranslations("checkout")
  const locale = useLocale()
  const [submitting, setSubmitting] = useState(false)
  // Avertismentul stă separat de `errorMessage`: nu e o eroare a clientului și
  // nu trebuie șters când acesta apasă butonul (handlePayment golește erorile).
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handlePayment = async () => {
    setSubmitting(true)
    setErrorMessage(null)
    try {
      const redirectUrl = await initiateNetopiaPayment(cart.id, providerId, collectBrowserInfo(), locale)
      if (!redirectUrl) {
        setErrorMessage(t("Nu am putut iniția plata Reîncearcă"))
        setSubmitting(false)
        return
      }
      // `replace` (nu `href`): checkout-ul rămâne în afara istoricului, așa că
      // butonul Back din pagina Netopia nu readuce o pagină posibil coruptă.
      window.location.replace(redirectUrl)
    } catch (err) {
      setErrorMessage(getDisplayableErrorMessage(err, t("A apărut o eroare Reîncearcă")))
      setSubmitting(false)
    }
  }

  return (
    <>
      <button
        disabled={notReady || submitting}
        onClick={handlePayment}
        data-testid={dataTestId}
        className={`relative w-full py-3 bg-hunter-gold text-[#0D0D0D] font-sans text-[12px] uppercase tracking-[4px] hover:opacity-90 transition-opacity disabled:cursor-not-allowed overflow-hidden ${
          notReady ? "opacity-40" : ""
        }`}
      >
        {/* This is the checkout's most consequential click — a plain text
            swap gave no real sense that anything was happening while the
            redirect URL request was in flight. A visible spinner reassures
            the customer the button registered, without the
            disabled:opacity-40 dimming used elsewhere (which read as
            "broken" here, not "loading"). */}
        <span
          className={`flex items-center justify-center gap-2 transition-opacity duration-150 ${
            submitting ? "opacity-0" : "opacity-100"
          }`}
        >
          {t("Plătește cu cardul")}
        </span>
        {submitting && (
          <span className="absolute inset-0 flex items-center justify-center gap-2">
            <Spinner size="14" />
            {t("Se redirecționează…")}
          </span>
        )}
      </button>
      <ErrorMessage
        error={errorMessage}
        data-testid="netopia-payment-error-message"
      />
    </>
  )
}

export default PaymentButton
