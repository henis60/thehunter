import { retrieveCart } from "@lib/data/cart"
import { retrieveCustomer } from "@lib/data/customer"
import { setRequestLocaleValue } from "@lib/util/request-locale"
import CartViewTracker from "@modules/common/components/analytics/cart-view-tracker"
import PaymentWrapper from "@modules/checkout/components/payment-wrapper"
import CheckoutForm from "@modules/checkout/templates/checkout-form"
import CheckoutSummary from "@modules/checkout/templates/checkout-summary"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { redirect } from "@i18n/navigation"
import { Metadata } from "next"
import { getTranslations } from "next-intl/server"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "app" })
  return {
    title: t("Checkout"),
    robots: { index: false, follow: false },
  }
}

// Per-user page — always rendered on request, never prerendered.
export const dynamic = "force-dynamic"

export default async function Checkout({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  // Next may render this page concurrently with its ancestor layouts, so
  // re-seed from this segment's own params before fetching — see
  // (main)/layout.tsx.
  const { locale } = await params
  setRequestLocaleValue(locale)

  // retrieveCart already retries without promotions internally if a
  // misconfigured promotion makes Medusa throw.
  const [cart, customer, t] = await Promise.all([
    retrieveCart(),
    retrieveCustomer().catch(() => null),
    getTranslations("checkout"),
  ])

  // No cart means it expired, was cleared, or the customer came back to an
  // already-completed order. A 404 is a dead end for all three, so send them
  // to the cart page, which renders its own "empty cart" state.
  if (!cart) {
    redirect({ href: "/cos", locale })
    // redirect() throws, but next-intl types it as void — the explicit return
    // is what lets TS narrow `cart` to non-null below.
    return null
  }

  return (
    <>
      <CartViewTracker cart={cart} event="begin_checkout" />
      <div className="content-container pt-4 pb-0">
        <LocalizedClientLink
          href="/cos"
          className="inline-flex items-end gap-2 text-[var(--theme-text-muted)] hover:text-hunter-gold transition-colors font-sans text-[13px] uppercase tracking-[3px]"
        >
          <svg
            width="18"
            height="18"
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
          <span>{t("Înapoi")}</span>
        </LocalizedClientLink>
      </div>
      <div className="grid grid-cols-1 small:grid-cols-[1fr_416px] content-container gap-x-40 pt-6 pb-12">
        <PaymentWrapper cart={cart}>
          <CheckoutForm cart={cart} customer={customer} />
        </PaymentWrapper>
        <CheckoutSummary cart={cart} />
      </div>
    </>
  )
}
