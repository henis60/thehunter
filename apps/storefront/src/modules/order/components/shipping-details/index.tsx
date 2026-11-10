import { convertToLocale } from "@lib/util/money"
import { HttpTypes } from "@medusajs/types"
import { getTranslations } from "next-intl/server"

type ShippingDetailsProps = {
  order: HttpTypes.StoreOrder
}

const ShippingDetails = async ({ order }: ShippingDetailsProps) => {
  const t = await getTranslations("order")
  const addr = order.shipping_address
  // Livrarea gratuită (de ex. produsele în dropshipping) nu se menționează.
  const paidShippingMethods = (order.shipping_methods ?? []).filter(
    (sm) => (sm.total ?? 0) > 0,
  )

  return (
    <div className="small:px-8 py-6">
      <p className="font-sans text-[10px] uppercase tracking-[4px] text-[var(--theme-text-muted)] mb-5">
        {t("Livrare")}
      </p>
      <div className="grid grid-cols-1 small:grid-cols-3 gap-6">
        <div data-testid="shipping-address-summary">
          <p className="font-sans text-[10px] uppercase tracking-[3px] text-[var(--theme-text-muted)] mb-2">
            {t("Adresă de livrare")}
          </p>
          <div className="flex flex-col gap-0.5 font-sans text-[13px] text-[var(--theme-text)]">
            <span>
              {addr?.first_name} {addr?.last_name}
            </span>
            <span>
              {addr?.address_1}
              {addr?.address_2 && `, ${addr.address_2}`}
            </span>
            <span>
              {addr?.postal_code}, {addr?.city}
            </span>
            <span>{addr?.country_code?.toUpperCase()}</span>
          </div>
        </div>

        <div data-testid="shipping-contact-summary">
          <p className="font-sans text-[10px] uppercase tracking-[3px] text-[var(--theme-text-muted)] mb-2">
            {t("Contact")}
          </p>
          <div className="flex flex-col gap-0.5 font-sans text-[13px] text-[var(--theme-text)]">
            {addr?.phone && <span>{addr.phone}</span>}
            <span>{order.email}</span>
          </div>
        </div>

        {paidShippingMethods.length > 0 && (
          <div data-testid="shipping-method-summary">
            <p className="font-sans text-[10px] uppercase tracking-[3px] text-[var(--theme-text-muted)] mb-2">
              {t("Metodă de livrare")}
            </p>
            <div className="flex flex-col gap-2">
              {paidShippingMethods.map((sm) => (
                <div
                  key={sm.id}
                  className="flex flex-col gap-0.5 font-sans text-[13px] text-[var(--theme-text)]"
                >
                  <span>{(sm as { name?: string }).name}</span>
                  <span className="text-[var(--theme-text-muted)]">
                    {convertToLocale({
                      amount: sm.total ?? 0,
                      currency_code: order.currency_code,
                    })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default ShippingDetails
