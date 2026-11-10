"use client"

import { useLocale, useTranslations } from "next-intl"
import { updateLineItem, deleteLineItem } from "@lib/data/cart"
import { emitCartUpdated } from "@lib/util/cart-events"
import {
  isStaleDeploymentError,
  reloadForNewDeployment,
} from "@lib/util/stale-deployment"
import { convertToLocale } from "@lib/util/money"
import { HttpTypes } from "@medusajs/types"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import Image from "next/image"
import { useState } from "react"
import { getCartItemImageUrl } from "@lib/util/variant-image"

type ItemProps = {
  item: HttpTypes.StoreCartLineItem
  type?: "full" | "preview"
  currencyCode: string
}

const Item = ({ item, type = "full", currencyCode }: ItemProps) => {
  const t = useTranslations("cart")
  // updateLineItem/deleteLineItem run as Server Actions here, outside any
  // page render — they have no route [locale] param to read, so pass the
  // client's current locale explicitly (see request-locale.ts).
  const locale = useLocale()
  const imgSrc = getCartItemImageUrl(item)
  // item.product_title is a denormalized snapshot captured at add-to-cart
  // time (so the cart survives the product being edited/deleted later) — it
  // never re-resolves through Medusa's translation layer. item.variant.product
  // is the live, expanded relation (see retrieveCart's fields), so it reflects
  // the current request's locale; fall back to the snapshot if it's missing.
  const displayTitle =
    (item.variant as any)?.product?.title ?? item.product_title
  const [updating, setUpdating] = useState(false)
  // Discovered ceiling from a rejected request (server said "not enough
  // inventory") — the `inventory_quantity` field isn't reliably present on
  // cart line items, so this is the fallback source of truth once we hit it.
  const [maxQty, setMaxQty] = useState<number | null>(null)

  const inventoryCap =
    item.variant?.manage_inventory &&
    !item.variant?.allow_backorder &&
    typeof item.variant?.inventory_quantity === "number"
      ? item.variant.inventory_quantity
      : Infinity
  const effectiveCap = Math.min(inventoryCap, maxQty ?? Infinity)

  // No optimistic update — the displayed quantity only ever comes from
  // `item.quantity` (server-confirmed). Buttons are disabled while a request
  // is in flight so nothing can race.
  const changeQuantity = (nextQty: number) => {
    if (updating || nextQty > effectiveCap) return

    if (nextQty < 1) {
      setUpdating(true)
      deleteLineItem(item.id, locale)
        .then((fresh) => emitCartUpdated(fresh))
        .catch((err) => {
          if (isStaleDeploymentError(err)) reloadForNewDeployment()
        })
        .finally(() => setUpdating(false))
      return
    }

    setUpdating(true)
    updateLineItem({ lineId: item.id, quantity: nextQty, locale })
      .then((fresh) => emitCartUpdated(fresh))
      .catch((err) => {
        if (isStaleDeploymentError(err)) {
          reloadForNewDeployment()
          return
        }
        if (/inventory/i.test(err instanceof Error ? err.message : "")) {
          setMaxQty(item.quantity)
        }
      })
      .finally(() => setUpdating(false))
  }

  // compare_at_unit_price is the price-list "was" price (e.g. a sale), set
  // once when the item was added to the cart — distinct from
  // original_total/total, which only diverge when a cart-level promotion
  // (coupon code) is applied. A sale price with no coupon needs this field,
  // or the discount silently doesn't show anywhere in cart/checkout.
  const hasDiscount =
    typeof item.compare_at_unit_price === "number" &&
    item.compare_at_unit_price > (item.unit_price ?? 0)
  const originalTotal = (item.compare_at_unit_price ?? 0) * item.quantity

  if (type === "preview") {
    return (
      <div className="flex gap-3 py-3">
        <div className="relative w-12 aspect-[3/4] shrink-0 overflow-hidden bg-white">
          {imgSrc && (
            <Image
              src={imgSrc}
              alt={displayTitle ?? ""}
              fill
              className="object-contain object-center"
              sizes="48px"
            />
          )}
        </div>
        <div className="flex flex-col flex-1 min-w-0 justify-between py-2">
          <p className="font-sans text-[11px] uppercase tracking-[2px] text-[var(--theme-text)] truncate">
            {displayTitle}
          </p>
          {(() => {
            const opts = (item.variant as any)?.options as
              | { value: string }[]
              | undefined
            const label = opts?.length
              ? opts
                  .map((o) => o.value)
                  .filter(Boolean)
                  .join(" · ") || item.variant?.title
              : item.variant?.title
            return label ? (
              <p className="font-serif italic text-[13px] text-[var(--theme-text-muted)]">
                {label}
              </p>
            ) : null
          })()}
          <p className="font-sans text-[12px] text-[var(--theme-text)]">
            {convertToLocale({
              amount: item.total ?? 0,
              currency_code: currencyCode,
            })}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex gap-5 py-5 small:py-6" data-testid="product-row">
      {/* Image */}
      <LocalizedClientLink
        href={`/produs/${item.product_handle}`}
        className="shrink-0"
      >
        <div className="relative w-[90px] small:w-[110px] aspect-[3/4] overflow-hidden bg-white">
          {imgSrc && (
            <Image
              src={imgSrc}
              alt={displayTitle ?? ""}
              fill
              className="object-contain object-center"
              sizes="(max-width: 640px) 90px, 110px"
            />
          )}
        </div>
      </LocalizedClientLink>

      {/* Info */}
      <div className="flex flex-col flex-1 min-w-0 justify-between py-2">
        {/* Title + delete */}
        <div>
          <div className="flex items-start justify-between gap-4">
            <LocalizedClientLink
              href={`/produs/${item.product_handle}`}
              data-testid="product-link"
              className="flex-1 min-w-0"
            >
              <span className="font-sans text-[13px] small:text-[15px] uppercase tracking-[2.5px] leading-[1.6] text-[var(--theme-text)] hover:text-hunter-gold transition-colors">
                {displayTitle}
              </span>
            </LocalizedClientLink>
            <button
              onClick={() => changeQuantity(0)}
              disabled={updating}
              aria-label={t("Șterge")}
              data-testid="product-delete-button"
              className="shrink-0 text-[var(--theme-text-muted)] hover:text-hunter-gold transition-colors mt-[2px] disabled:opacity-30"
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Variant */}
          {(() => {
            const opts = (item.variant as any)?.options as
              | { value?: string; option?: { title?: string } }[]
              | undefined
            const fromOpts = opts
              ?.map((o) => o.value)
              .filter(Boolean)
              .join(" · ")
            const label = fromOpts || item.variant?.title
            return label ? (
              <p className="font-serif italic text-[14px] small:text-[16px] text-[var(--theme-text-muted)] mt-1">
                {label}
              </p>
            ) : null
          })()}
        </div>

        {/* Bottom row: qty stepper left, price stack right */}
        <div className="flex items-end justify-between mt-5">
          {/* Qty stepper */}
          <div
            className={`flex items-center gap-3 border border-[var(--theme-border)] transition-opacity ${
              updating ? "opacity-60" : ""
            }`}
          >
            <button
              onClick={() => changeQuantity(item.quantity - 1)}
              disabled={updating}
              aria-label={item.quantity <= 1 ? t("Șterge") : t("Scade cantitate")}
              className="w-7 h-7 flex items-center justify-center text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] disabled:opacity-30 transition-colors"
            >
              <svg
                width="9"
                height="9"
                viewBox="0 0 10 2"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              >
                <line x1="1" y1="1" x2="9" y2="1" />
              </svg>
            </button>
            <span
              className="font-sans text-[13px] w-4 text-center text-[var(--theme-text)]"
              data-testid="product-select-button"
              data-value={item.quantity}
            >
              {item.quantity}
            </span>
            <button
              onClick={() => changeQuantity(item.quantity + 1)}
              disabled={updating || item.quantity >= effectiveCap}
              className="w-7 h-7 flex items-center justify-center text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] disabled:opacity-30 transition-colors"
              aria-label={t("Crește cantitate")}
            >
              <svg
                width="9"
                height="9"
                viewBox="0 0 10 10"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              >
                <line x1="5" y1="1" x2="5" y2="9" />
                <line x1="1" y1="5" x2="9" y2="5" />
              </svg>
            </button>
          </div>

          {/* Price stack */}
          <div className="flex flex-col items-end gap-0.5">
            <span className="font-sans text-[11px] small:text-[12px] uppercase tracking-[1.5px] text-[var(--theme-text-muted)]">
              {convertToLocale({
                amount: item.unit_price ?? 0,
                currency_code: currencyCode,
              })}
              {t(" / buc")}
            </span>
            <div className="relative flex flex-col items-end">
              {hasDiscount && (
                <span className="font-serif italic text-[13px] text-[var(--theme-text-muted)] line-through">
                  {convertToLocale({
                    amount: originalTotal,
                    currency_code: currencyCode,
                  })}
                </span>
              )}
              <span
                className="font-display text-[17px] small:text-[18px] text-[var(--theme-text)]"
                data-testid="product-price"
              >
                {convertToLocale({
                  amount: item.total ?? 0,
                  currency_code: currencyCode,
                })}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Item
