import { convertToLocale } from "@lib/util/money"
import {
  getOrderDisplayTotal,
  getOrderRefundedTotal,
} from "@lib/util/order-total"
import { HttpTypes } from "@medusajs/types"
import { getTranslations } from "next-intl/server"

type OrderSummaryProps = {
  order: HttpTypes.StoreOrder
}

const OrderSummary = async ({ order }: OrderSummaryProps) => {
  const t = await getTranslations("order")
  // Falsy-checking `amount` (the previous `amount ? ... : null`) hid the
  // value entirely whenever it was legitimately 0 — most visibly on
  // Shipping when a free-shipping promotion zeroed it out, leaving that row
  // blank instead of showing "0.00 LEI". Only null/undefined (field not
  // present at all) should skip rendering.
  const fmt = (amount?: number | null) =>
    amount != null
      ? convertToLocale({ amount, currency_code: order.currency_code })
      : null

  const refunded = getOrderRefundedTotal(order)

  return (
    <div className="small:px-8 py-6">
      <p className="font-sans text-[10px] uppercase tracking-[4px] text-[var(--theme-text-muted)] mb-5">
        {t("Sumar")}
      </p>
      <div className="flex flex-col gap-2">
        {/* order.subtotal already includes shipping in Medusa v2 — the
            products-only figure is item_subtotal (same as checkout) */}
        <div className="flex items-center justify-between font-sans text-[13px]">
          <span className="text-[var(--theme-text-muted)]">
            {t("Subtotal")}
          </span>
          <span className="text-[var(--theme-text)]">
            {fmt(order.item_subtotal)}
          </span>
        </div>
        {order.gift_card_total > 0 && (
          <div className="flex items-center justify-between font-sans text-[13px]">
            <span className="text-[var(--theme-text-muted)]">
              {t("Card cadou")}
            </span>
            <span className="text-emerald-500">
              − {fmt(order.gift_card_total)}
            </span>
          </div>
        )}
        {/* Transportul apare doar când costă ceva — cel gratuit nu se menționează. */}
        {order.shipping_subtotal > 0 && (
          <div className="flex items-center justify-between font-sans text-[13px]">
            <span className="text-[var(--theme-text-muted)]">
              {t("Transport")}
            </span>
            <span className="text-[var(--theme-text)]">
              {/* shipping_total is NET of any shipping-specific discount (e.g.
                a 100%-off-shipping promo zeroes it) — showing that alongside
                a separate Discount line double-counts the waived amount out
                of the math the customer can see: Subtotal + Shipping(net 0)
                - Discount(15, the waived shipping) no longer adds up to
                Total, making the summary look broken even though the
                backend total itself is correct. shipping_subtotal is the
                GROSS pre-discount cost — same convention cart-totals/
                index.tsx already uses for the cart/checkout summary — so
                Subtotal + Shipping + Discount consistently reconciles to
                Total again. */}
              {fmt(order.shipping_subtotal)}
            </span>
          </div>
        )}
        {order.discount_total > 0 && (
          <div className="flex items-center justify-between font-sans text-[13px]">
            <span className="text-[var(--theme-text-muted)]">
              {t("Reducere")}
            </span>
            <span className="text-emerald-500">
              − {fmt(order.discount_total)}
            </span>
          </div>
        )}
        {(order.tax_total ?? 0) > 0 && (
          <div className="flex items-center justify-between font-sans text-[13px]">
            <span className="text-[var(--theme-text-muted)]">{t("Taxe")}</span>
            <span className="text-[var(--theme-text)]">
              {fmt(order.tax_total)}
            </span>
          </div>
        )}
        <div className="border-t border-[var(--theme-border)] pt-3 mt-1 flex items-baseline justify-between">
          <span className="font-sans text-[10px] uppercase tracking-[3px] text-[var(--theme-text-muted)]">
            {t("Total")}
          </span>
          <span className="font-display text-[17px] leading-none text-hunter-gold">
            {fmt(getOrderDisplayTotal(order))}
          </span>
        </div>
        {/* Refunds are stored as order credit lines, which Medusa subtracts
            from order.total (a fully refunded order reports 0). Show the
            order's own total above and the refund on its own line. */}
        {refunded > 0 && (
          <div className="flex items-center justify-between font-sans text-[13px]">
            <span className="text-[var(--theme-text-muted)]">
              {t("Rambursat")}
            </span>
            <span className="text-[var(--theme-text)]">
              − {fmt(refunded)}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

export default OrderSummary
