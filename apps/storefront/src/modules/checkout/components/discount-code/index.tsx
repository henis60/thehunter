"use client"

import React from "react"
import { applyPromotions } from "@lib/data/cart"
import { convertToLocale } from "@lib/util/money"
import { HttpTypes } from "@medusajs/types"
import { useTranslations } from "next-intl"
import ErrorMessage from "../error-message"
import { emitCartUpdated } from "@lib/util/cart-events"
import {
  isStaleDeploymentError,
  reloadForNewDeployment,
} from "@lib/util/stale-deployment"

type DiscountCodeProps = {
  cart: HttpTypes.StoreCart
}

const DiscountCode: React.FC<DiscountCodeProps> = ({ cart }) => {
  const t = useTranslations("checkout")
  const [isOpen, setIsOpen] = React.useState(false)
  const [errorMessage, setErrorMessage] = React.useState("")
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [removingCode, setRemovingCode] = React.useState<string | null>(null)

  const { promotions = [] } = cart

  const toggleOpen = () => {
    setErrorMessage("")
    setIsOpen((o) => !o)
  }

  const removePromotionCode = async (code: string) => {
    if (removingCode) return
    setRemovingCode(code)
    try {
      const remaining = promotions
        .filter((p) => p.code !== code && p.code !== undefined)
        .map((p) => p.code!)
      const updatedCart = await applyPromotions(remaining)
      emitCartUpdated(updatedCart)
    } catch {
      setErrorMessage(t("A apărut o eroare Reîncearcă"))
    } finally {
      setRemovingCode(null)
    }
  }

  const addPromotionCode = async (formData: FormData) => {
    if (isSubmitting) return
    setErrorMessage("")
    const code = formData.get("code")
    const codeStr = code?.toString().trim()
    if (!codeStr) return
    const input = document.getElementById("promotion-input") as HTMLInputElement
    const existing = promotions.filter((p) => p.code).map((p) => p.code!)
    if (existing.some((c) => c.toLowerCase() === codeStr.toLowerCase())) {
      setErrorMessage(t("Codul promoțional este deja aplicat"))
      return
    }
    const codes = [...existing, codeStr]
    setIsSubmitting(true)
    try {
      const updatedCart = await applyPromotions(codes)
      const applied = updatedCart?.promotions?.some(
        (p) => p.code?.toLowerCase() === codeStr.toLowerCase()
      )
      if (!applied) {
        setErrorMessage(t("Codul promoțional nu este valid sau a expirat"))
      } else {
        // The cart's payment session is commonly invalidated/recreated once
        // totals change — Review (and anything else in checkout) needs to
        // see the fresh cart to notice that and re-initiate, or its
        // "preparing payment" state spins forever until a hard reload. See
        // CartRefreshOnUpdate, now mounted in the checkout layout.
        emitCartUpdated(updatedCart)
      }
    } catch (e) {
      // applyPromotions actually throws for an invalid/expired code (Medusa
      // rejects it server-side) rather than silently omitting it from
      // cart.promotions — so this catch, not the `!applied` branch above, is
      // what really runs for a bad code. Show the same specific message
      // there is meant to cover; a stale-deployment error is the one other
      // realistic failure mode for this action, and still gets its own
      // recovery reload instead.
      if (isStaleDeploymentError(e)) {
        reloadForNewDeployment()
        setErrorMessage(t("A apărut o eroare Reîncearcă"))
      } else {
        setErrorMessage(t("Codul promoțional nu este valid sau a expirat"))
      }
    } finally {
      setIsSubmitting(false)
    }
    if (input) input.value = ""
  }

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={toggleOpen}
        data-testid="add-discount-button"
        className="flex items-center gap-2 font-sans text-[11px] uppercase tracking-[3px] text-[var(--theme-text-muted)] hover:text-hunter-gold transition-colors w-fit"
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <line x1="5" y1="1" x2="5" y2="9" />
          <line x1="1" y1="5" x2="9" y2="5" />
        </svg>
        {t("Cod promoțional")}
      </button>

      {isOpen && (
        <form action={addPromotionCode} className="flex gap-2 w-full">
          <input
            id="promotion-input"
            name="code"
            type="text"
            autoFocus={false}
            disabled={isSubmitting}
            data-testid="discount-input"
            className="flex-1 min-w-0 h-9 bg-transparent border border-[var(--theme-border)] px-3 font-sans text-[13px] uppercase tracking-[2px] text-[var(--theme-text)] placeholder:text-[var(--theme-text-muted)] focus:outline-none focus:border-hunter-gold/50 transition-colors disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isSubmitting}
            data-testid="discount-apply-button"
            className="shrink-0 h-9 font-sans text-[11px] uppercase tracking-[3px] px-4 border border-[var(--theme-border)] text-[var(--theme-text-muted)] hover:border-hunter-gold/50 hover:text-hunter-gold transition-colors whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? t("Se aplică…") : t("Aplică")}
          </button>
        </form>
      )}

      <ErrorMessage error={errorMessage} data-testid="discount-error-message" />

      {promotions.length > 0 && (
        <div className="flex flex-col gap-2">
          {promotions.map((promotion) => (
            <div
              key={promotion.id}
              className="flex items-center justify-between"
              data-testid="discount-row"
            >
              <div className="flex items-center gap-2">
                <span
                  className="font-sans text-[11px] uppercase tracking-[2px] text-hunter-gold border border-hunter-gold/30 px-2 py-0.5"
                  data-testid="discount-code"
                >
                  {promotion.code}
                </span>
                {promotion.application_method?.value !== undefined && (
                  <span className="font-sans text-[11px] text-[var(--theme-text-muted)]">
                    {promotion.application_method.type === "percentage"
                      ? `−${promotion.application_method.value}%`
                      : promotion.application_method.currency_code
                      ? `−${convertToLocale({
                          amount: +promotion.application_method.value,
                          currency_code: promotion.application_method.currency_code,
                        })}`
                      : null}
                  </span>
                )}
              </div>
              {!promotion.is_automatic && (
                <button
                  onClick={() => promotion.code && removePromotionCode(promotion.code)}
                  disabled={removingCode === promotion.code}
                  data-testid="remove-discount-button"
                  aria-label={t("Șterge codul")}
                  className="text-[var(--theme-text-muted)] hover:text-hunter-gold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                    <line x1="1" y1="1" x2="9" y2="9" />
                    <line x1="9" y1="1" x2="1" y2="9" />
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default DiscountCode
