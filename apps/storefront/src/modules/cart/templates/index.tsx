import ItemsTemplate from "./items"
import Summary from "./summary"
import EmptyCartMessage from "../components/empty-cart-message"
import SignInPrompt from "../components/sign-in-prompt"
import CartRefreshOnUpdate from "../components/cart-refresh-on-update"
import CartViewTracker from "@modules/common/components/analytics/cart-view-tracker"
import { HttpTypes } from "@medusajs/types"

const CartTemplate = ({
  cart,
  customer,
}: {
  cart: HttpTypes.StoreCart | null
  customer: HttpTypes.StoreCustomer | null
}) => {
  return (
    <div className="min-h-[60dvh] pt-3 pb-6 small:pt-10 small:pb-10">
      <CartRefreshOnUpdate />
      <div className="page-container" data-testid="cart-container">
        {cart?.items?.length ? (
          <>
            <CartViewTracker cart={cart} event="view_cart" />
            {/* <div className="mb-5 small:mb-10 border-b border-[var(--theme-border)] pb-4 small:pb-6">
              <h1 className="font-sans text-[12px] small:text-[14px] uppercase tracking-[5px] text-[var(--theme-text)]">
                Coș
                <span className="ml-3 text-[var(--theme-text-muted)]">
                  ({cart.items.reduce((s, i) => s + i.quantity, 0)})
                </span>
              </h1>
            </div> */}

            <div className="grid grid-cols-1 small:grid-cols-[1fr_320px] gap-x-16 medium:gap-x-24 items-start">
              <div className="flex flex-col gap-y-8">
                {!customer && <SignInPrompt />}
                <ItemsTemplate cart={cart} />
              </div>

              <div className="sticky top-20 mt-10 small:mt-0">
                {cart.region && <Summary cart={cart} />}
              </div>
            </div>
          </>
        ) : (
          <EmptyCartMessage />
        )}
      </div>
    </div>
  )
}

export default CartTemplate
