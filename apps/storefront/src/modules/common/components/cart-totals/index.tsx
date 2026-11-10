"use client"

import { convertToLocale } from "@lib/util/money"
import { useTranslations } from "next-intl"
import React from "react"

type CartTotalsProps = {
  totals: {
    total?: number | null
    subtotal?: number | null
    tax_total?: number | null
    currency_code: string
    item_subtotal?: number | null
    shipping_subtotal?: number | null
    discount_subtotal?: number | null
  }
  // Optional: line items to fold price-list sale discounts (compare_at_unit_price)
  // into the summary — item_subtotal/discount_subtotal only ever reflect
  // cart-level promotions/coupons, so a sale with no coupon applied would
  // otherwise show "Produse" already discounted with no discount line at all.
  items?: {
    unit_price?: number | null
    compare_at_unit_price?: number | null
    quantity: number
  }[]
  showTax?: boolean
}

const CartTotals: React.FC<CartTotalsProps> = ({ totals, items, showTax = false }) => {
  const { currency_code, total, tax_total, item_subtotal, shipping_subtotal, discount_subtotal } = totals
  const t = useTranslations("common")

  const saleDiscountTotal = (items ?? []).reduce((sum, item) => {
    const compareAt = item.compare_at_unit_price ?? 0
    const unit = item.unit_price ?? 0
    return compareAt > unit ? sum + (compareAt - unit) * item.quantity : sum
  }, 0)

  const fullItemSubtotal = (item_subtotal ?? 0) + saleDiscountTotal
  const totalDiscount = (discount_subtotal ?? 0) + saleDiscountTotal

  return (
    <>
      <div className="flex flex-col gap-3 font-sans text-[14px] small:text-[15px] uppercase tracking-[2px]">
        <div className="flex justify-between text-[var(--theme-text-muted)]">
          <span>{t("Produse")}</span>
          <span data-testid="cart-subtotal" data-value={fullItemSubtotal}>
            {convertToLocale({ amount: fullItemSubtotal, currency_code })}
          </span>
        </div>

        {/* Livrarea apare doar când costă ceva — cea gratuită nu se menționează. */}
        {!!shipping_subtotal && (
          <div className="flex justify-between text-[var(--theme-text-muted)]">
            <span>{t("Livrare")}</span>
            <span data-testid="cart-shipping" data-value={shipping_subtotal}>
              {convertToLocale({ amount: shipping_subtotal, currency_code })}
            </span>
          </div>
        )}

        {!!totalDiscount && (
          <div className="flex justify-between text-hunter-gold">
            <span>{t("Reducere")}</span>
            <span data-testid="cart-discount" data-value={totalDiscount}>
              − {convertToLocale({ amount: totalDiscount, currency_code })}
            </span>
          </div>
        )}

        {showTax && (
          <div className="flex justify-between text-[var(--theme-text-muted)]">
            <span>{t("TVA")}</span>
            <span data-testid="cart-taxes" data-value={tax_total ?? 0}>
              {convertToLocale({ amount: tax_total ?? 0, currency_code })}
            </span>
          </div>
        )}
      </div>

      <div className="border-t border-[var(--theme-border)] pt-4 flex justify-between items-baseline">
        <span className="font-sans text-[14px] small:text-[15px] uppercase tracking-[3px] text-[var(--theme-text-muted)]">
          {t("Total")}
        </span>
        <span
          className="font-display text-[22px] small:text-[26px] leading-none text-hunter-gold"
          data-testid="cart-total"
          data-value={total ?? 0}
        >
          {convertToLocale({ amount: total ?? 0, currency_code })}
        </span>
      </div>
    </>
  )
}

export default CartTotals
