"use client"

import { useTranslations } from "next-intl"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import CartTotals from "@modules/common/components/cart-totals"
import { HttpTypes } from "@medusajs/types"
import { hasAllShippingMethods } from "@lib/util/dropshipping"

type SummaryProps = {
  cart: HttpTypes.StoreCart
}

function getCheckoutStep(cart: HttpTypes.StoreCart) {
  if (!cart?.shipping_address?.address_1 || !cart.email) return "adresa"
  if (!hasAllShippingMethods(cart)) return "livrare"
  return "sumar"
}

const Summary = ({ cart }: SummaryProps) => {
  const t = useTranslations("cart")
  const step = getCheckoutStep(cart)

  return (
    <div className="flex flex-col gap-6 border border-[var(--theme-border)] p-6 small:p-8">
      <CartTotals totals={cart} items={cart.items} />

      <div>
        <LocalizedClientLink
          href={"/finalizare-comanda?pas=" + step}
          data-testid="checkout-button"
        >
          <button className="w-full h-12 font-sans uppercase tracking-[3px] text-[12px] bg-hunter-gold text-hunter-dark hover:opacity-90 transition-opacity">
            {t("Finalizează comanda")}
          </button>
        </LocalizedClientLink>

        <LocalizedClientLink
          href="/ready-to-wear"
          className="flex items-center justify-center w-full mt-3 h-12 font-sans uppercase tracking-[3px] text-[12px] border border-[var(--theme-border)] text-[var(--theme-text-muted)] hover:border-hunter-gold hover:text-hunter-gold transition-colors"
        >
          {t("Continuă cumpărăturile")}
        </LocalizedClientLink>
      </div>
    </div>
  )
}

export default Summary
