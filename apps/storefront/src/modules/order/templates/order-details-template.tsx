"use client"

import { HttpTypes } from "@medusajs/types"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import React, { useEffect, useState } from "react"
import { lineItemsToTrackItems, trackPurchase } from "@lib/util/analytics"
import { orderTrackingUrl } from "@lib/util/order-tracking"
import { useTranslations } from "next-intl"
import { useRouter } from "@i18n/navigation"

type OrderDetailsTemplateProps = {
  order: HttpTypes.StoreOrder
  // True on the standalone /comanda/[id] success page, which has no
  // AccountNav around it to supply a mobile title bar — false (default) for
  // the /profil/comenzi/[displayId] account page, which does.
  standalone?: boolean
  // False when the viewer isn't the order's own logged-in customer — only
  // possible on the standalone page, reachable by guests right after
  // checkout. Hide the button rather than show it and fail on click: the
  // account page never passes this, so it defaults to visible there.
  canDownloadInvoice?: boolean
  // Items/OrderDetails/ShippingDetails/OrderSummary are all async Server
  // Components (they call next-intl/server's getTranslations) — this
  // template is a Client Component (GA4 tracking, invoice-download state),
  // and a Client Component can't directly import and render an async Server
  // Component descendant (Next throws "is an async Client Component"). The
  // caller (a Server Component page) renders each and passes the result
  // down as a plain slot instead.
  itemsSlot: React.ReactNode
  orderDetailsSlot: React.ReactNode
  shippingDetailsSlot: React.ReactNode
  orderSummarySlot: React.ReactNode
}

// On mobile each section reads as a bordered card (the account pages'
// visual motif); on desktop the border disappears and the parent's
// divide-y hairlines take over. Horizontal padding is mobile-only —
// the section components bring their own small:px-8.
const Section = ({ children }: { children: React.ReactNode }) => (
  <div className="border border-[var(--theme-border)] px-4 small:px-0 small:border-0">
    {children}
  </div>
)

const OrderDetailsTemplate: React.FC<OrderDetailsTemplateProps> = ({
  order,
  standalone,
  canDownloadInvoice = true,
  itemsSlot,
  orderDetailsSlot,
  shippingDetailsSlot,
  orderSummarySlot,
}) => {
  const router = useRouter()
  const t = useTranslations("order")
  const [downloading, setDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState<string | null>(null)
  const trackUrl = orderTrackingUrl(order)

  // GA4 purchase — only on the standalone post-checkout success page (not when
  // viewing a past order in the account). A sessionStorage guard prevents a
  // duplicate hit on refresh/remount; GA also dedupes by transaction_id.
  useEffect(() => {
    if (!standalone) return
    const key = `ga_purchase_${order.id}`
    try {
      if (sessionStorage.getItem(key)) return
      sessionStorage.setItem(key, "1")
    } catch {}
    trackPurchase({
      transactionId: String(order.display_id ?? order.id),
      value: order.total ?? 0,
      currency: order.currency_code?.toUpperCase() || "RON",
      tax: order.tax_total ?? undefined,
      shipping: order.shipping_total ?? undefined,
      items: lineItemsToTrackItems(order.items),
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order.id, standalone])

  const handleDownloadInvoice = async () => {
    setDownloading(true)
    setDownloadError(null)
    try {
      const response = await fetch(`/api/invoice/${order.id}`)
      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        setDownloadError(
          err.message ?? err.error ?? t("Factura nu este disponibilă încă")
        )
        return
      }
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `factura-${order.display_id}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      setDownloadError(t("Eroare la descărcarea facturii"))
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="w-full h-full flex flex-col">
      {/* Header — on the account page, mobile gets its title from
          AccountNav's mobile bar instead, so it's hidden here below small:.
          Mobile stacks back-link above title; desktop places the title on
          the left with the back-link aligned to the right of it. */}
      <div
        className={
          standalone
            ? "flex flex-col small:flex-row small:items-center small:justify-between gap-3 pt-4 pb-6 small:px-8 small:pt-8"
            : "hidden small:flex small:flex-row-reverse small:items-center small:justify-between gap-3 small:px-8 small:pt-8 small:pb-6"
        }
      >
        {!standalone ? (
          <LocalizedClientLink
            href="/profil/comenzi"
            className="inline-flex items-end gap-1.5 font-sans text-[10px] uppercase tracking-[3px] text-[var(--theme-text-muted)] hover:text-hunter-gold transition-colors"
            data-testid="back-to-overview-button"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polyline points="15 6 9 12 15 18" />
            </svg>
            {t("Înapoi")}
          </LocalizedClientLink>
        ) : null}
        <h1 className="font-display text-[28px] small:text-[32px] leading-[1] text-[var(--theme-text)]">
          {t("Comanda #{displayId}", { displayId: order.display_id ?? "" })}
        </h1>
      </div>

      {/* Mobile: bordered cards (matching the account menu / active orders);
          desktop: flat sections with hairline dividers, as before. */}
      <div
        className="flex-1 flex flex-col gap-5 small:gap-0 small:divide-y small:divide-[var(--theme-border)]"
        data-testid="order-details-container"
      >
        {/* Products lead the page, flat (no card) */}
        {itemsSlot}
        <Section>{orderDetailsSlot}</Section>
        <Section>{shippingDetailsSlot}</Section>
        <Section>{orderSummarySlot}</Section>

        {/* Courier tracking — same full-width-on-mobile action as the
            buttons below, outside the details card. */}
        {trackUrl && (
          <div className="small:px-8 pt-1 small:pt-6 pb-2 small:pb-8 !border-t-0 flex flex-col small:items-end">
            <a
              href={trackUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full small:w-auto h-12 small:px-8 flex items-center justify-center border border-[var(--theme-border)] text-[var(--theme-text)] hover:border-hunter-gold hover:text-hunter-gold transition-colors font-sans uppercase tracking-[3px] text-[12px]"
              data-testid="order-track-link"
            >
              {t("Urmărește comanda")}
            </a>
          </div>
        )}

        {/* Invoice download — primary action */}
        {canDownloadInvoice && (
          <div className="small:px-8 pt-1 small:pt-6 pb-2 small:pb-8 !border-t-0 flex flex-col small:items-end">
            <button
              onClick={handleDownloadInvoice}
              disabled={downloading}
              className="w-full small:w-auto h-12 small:px-8 bg-hunter-gold text-hunter-dark hover:bg-hunter-gold/90 transition-colors font-sans uppercase tracking-[3px] text-[12px] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {downloading ? t("Se descarcă") : t("Descarcă factura")}
            </button>
            {downloadError && (
              <p className="mt-3 text-sm text-red-500">{downloadError}</p>
            )}
          </div>
        )}
        {standalone && (
          <div className="small:px-8 pt-1 small:pt-6 pb-2 small:pb-8 !border-t-0 flex flex-col small:items-end">
            <button
              onClick={() => router.push("/")}
              className="w-full small:w-auto h-12 small:px-8 bg-hunter-gold text-hunter-dark hover:bg-hunter-gold/90 transition-colors font-sans uppercase tracking-[3px] text-[12px] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t("Continuă cumpărăturile")}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default OrderDetailsTemplate
