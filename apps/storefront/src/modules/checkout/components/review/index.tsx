"use client"

import PaymentButton from "../payment-button"
import { useSearchParams } from "next/navigation"
import { HttpTypes } from "@medusajs/types"
import { useTranslations } from "next-intl"
import { bodyMutedClass, sectionTitleClass } from "@modules/checkout/components/typography"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { hasAllShippingMethods } from "@lib/util/dropshipping"

// Netopia is the store's only payment provider, so there's no method to pick
// — the session is initiated silently as soon as this step opens, instead of
// showing a payment-method-selection UI (the old, now-removed "Plată" step).
const Review = ({
  cart,
  availablePaymentMethods,
}: {
  cart: HttpTypes.StoreCart
  availablePaymentMethods: { id: string }[]
}) => {
  const t = useTranslations("checkout")
  const searchParams = useSearchParams()
  const isOpen = searchParams.get("pas") === "sumar"

  const paidByGiftcard = !!(
    (cart as any)?.gift_cards?.length > 0 && cart?.total === 0
  )

  const previousStepsCompleted =
    cart.shipping_address && hasAllShippingMethods(cart)

  // Nicio sesiune de plată nu se mai creează aici.
  //
  // Anterior, la deschiderea pasului se iniția o sesiune „de pre-încălzire",
  // doar ca PaymentButton să afle provider-ul din `payment_sessions[0]`. Dar
  // butonul creează oricum o sesiune proprie la click — cu browser_info și cu
  // suma finală — așa că fiecare checkout lăsa la Netopia o tranzacție în plus,
  // neplătită și fără date de facturare (apărea ca „Client" în lista lor).
  //
  // Acum provider-ul vine direct din `availablePaymentMethods`, deci sesiunea
  // se creează o singură dată, la click.

  return (
    <div className={!isOpen ? "opacity-50 pointer-events-none select-none" : ""}>
      <div className="flex items-center mb-6">
        <span className={sectionTitleClass}>
          {t("Confirmare comandă")}
        </span>
      </div>
      {isOpen && previousStepsCompleted && (
        <>
          <p className={`${bodyMutedClass} leading-relaxed mb-6`}>
            {t("Prin plasarea comenzii, confirmi că ai citit și ești de acord cu")}{" "}
            <LocalizedClientLink
              href="/terms-of-use"
              className="text-[var(--theme-text)] border-b border-hunter-gold/40 hover:border-hunter-gold transition-colors"
            >
              {t("Termenii și Condițiile")}
            </LocalizedClientLink>
            ,{" "}
            <LocalizedClientLink
              href="/relatii-clienti#retur"
              className="text-[var(--theme-text)] border-b border-hunter-gold/40 hover:border-hunter-gold transition-colors"
            >
              {t("Politica de Returnare")}
            </LocalizedClientLink>
            {" "}și{" "}
            <LocalizedClientLink
              href="/privacy-policy"
              className="text-[var(--theme-text)] border-b border-hunter-gold/40 hover:border-hunter-gold transition-colors"
            >
              {t("Politica de Confidențialitate")}
            </LocalizedClientLink>
            .
          </p>
          {/* Butonul se randează imediat: nu mai depinde de o sesiune creată
              în prealabil, deci nu mai există starea intermediară cu spinner. */}
          <PaymentButton
            cart={cart}
            // Coș achitat integral cu card cadou: nu are ce plăti la Netopia.
            // Fără metode disponibile, butonul rămâne dezactivat — exact
            // comportamentul de dinainte, când lipsa unei sesiuni producea
            // același rezultat.
            availablePaymentMethods={paidByGiftcard ? [] : availablePaymentMethods}
            data-testid="submit-order-button"
          />
        </>
      )}
    </div>
  )
}

export default Review
