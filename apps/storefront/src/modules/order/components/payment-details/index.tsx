import { isStripeLike, paymentInfoMap } from "@lib/constants"
import { convertToLocale } from "@lib/util/money"
import { HttpTypes } from "@medusajs/types"
import { getTranslations } from "next-intl/server"

type PaymentDetailsProps = {
  order: HttpTypes.StoreOrder
}

const PaymentDetails = async ({ order }: PaymentDetailsProps) => {
  const t = await getTranslations("order")
  const payment = order.payment_collections?.[0].payments?.[0]

  if (!payment) return null

  return (
    <div className="small:px-8">
      <p className="font-sans text-[11px] uppercase tracking-[4px] text-[var(--theme-text-muted)] mb-5">
        {t("Plată")}
      </p>
      <div className="grid grid-cols-1 small:grid-cols-2 gap-6">
        <div>
          <p className="font-sans text-[11px] uppercase tracking-[3px] text-[var(--theme-text-muted)] mb-2">
            {t("Metodă de plată")}
          </p>
          <p
            className="font-sans text-[14px] text-[var(--theme-text)]"
            data-testid="payment-method"
          >
            {paymentInfoMap[payment.provider_id]?.title ?? payment.provider_id}
          </p>
        </div>
        <div>
          <p className="font-sans text-[11px] uppercase tracking-[3px] text-[var(--theme-text-muted)] mb-2">
            {t("Detalii")}
          </p>
          <p
            className="font-sans text-[14px] text-[var(--theme-text)]"
            data-testid="payment-amount"
          >
            {isStripeLike(payment.provider_id) && payment.data?.card_last4
              ? `**** **** **** ${payment.data.card_last4}`
              : convertToLocale({
                  amount: payment.amount,
                  currency_code: order.currency_code,
                })}
          </p>
        </div>
      </div>
    </div>
  )
}

export default PaymentDetails
