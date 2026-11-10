"use client"

import { AnimatePresence, m as motion } from "framer-motion"
import { useLocale, useTranslations } from "next-intl"
import { convertToLocale } from "@lib/util/money"
import { HttpTypes } from "@medusajs/types"
import { XMark } from "@medusajs/icons"
import { Button } from "@modules/common/components/ui"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { BagIcon } from "@modules/layout/components/nav-icons"
import CountBadge from "@modules/common/components/count-badge"
import { usePathname } from "@i18n/navigation"
import Image from "next/image"
import { deleteLineItem, updateLineItem } from "@lib/data/cart"
import { emitCartUpdated, onCartUpdated } from "@lib/util/cart-events"
import {
  isStaleDeploymentError,
  reloadForNewDeployment,
} from "@lib/util/stale-deployment"
import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { getCartItemImageUrl } from "@lib/util/variant-image"

const CartDropdown = ({
  cart: cartState,
}: {
  cart?: HttpTypes.StoreCart | null
}) => {
  const t = useTranslations("layout")
  // deleteLineItem/updateLineItem run as Server Actions here, outside any
  // page render — they have no route [locale] param to read, so pass the
  // client's current locale explicitly (see request-locale.ts).
  const locale = useLocale()
  const [cartDrawerOpen, setCartDrawerOpen] = useState(false)
  const [mounted, setMounted] = useState(false)

  const open = () => setCartDrawerOpen(true)
  const close = () => setCartDrawerOpen(false)

  const totalItems =
    cartState?.items?.reduce((acc, item) => {
      return acc + item.quantity
    }, 0) || 0

  const subtotal = cartState?.subtotal ?? 0

  const pathname = usePathname()

  // No optimistic update — every change waits for the server response
  // before the cart re-renders. `updatingLine` disables that line's buttons
  // meanwhile so nothing can race.
  const [updatingLine, setUpdatingLine] = useState<string | null>(null)
  // Discovered ceiling from a rejected request ("not enough inventory") —
  // inventory_quantity isn't reliably present on cart line items, so this is
  // the fallback source of truth once we actually hit the limit.
  const [maxQty, setMaxQty] = useState<Record<string, number>>({})

  const handleDeleteItem = (lineId: string) => {
    setUpdatingLine(lineId)
    deleteLineItem(lineId, locale)
      .then((fresh) => emitCartUpdated(fresh))
      .catch((err) => {
        if (isStaleDeploymentError(err)) {
          reloadForNewDeployment()
          return
        }
        emitCartUpdated()
      })
      .finally(() => setUpdatingLine(null))
  }

  const handleSetQuantity = (lineId: string, quantity: number) => {
    if (updatingLine) return
    if (quantity < 1) {
      handleDeleteItem(lineId)
      return
    }

    setUpdatingLine(lineId)
    updateLineItem({ lineId, quantity, locale })
      .then((fresh) => emitCartUpdated(fresh))
      .catch((err) => {
        if (isStaleDeploymentError(err)) {
          reloadForNewDeployment()
          return
        }
        if (/inventory/i.test(err instanceof Error ? err.message : "")) {
          setMaxQty((m) => ({ ...m, [lineId]: quantity - 1 }))
        }
      })
      .finally(() => setUpdatingLine(null))
  }

  useEffect(() => {
    if (!cartDrawerOpen) {
      return
    }

    const scrollbarWidth =
      window.innerWidth - document.documentElement.clientWidth
    document.documentElement.style.overflow = "hidden"
    document.documentElement.style.paddingRight = `${scrollbarWidth}px`

    const allowSelector = '[data-scroll-lock-allow="true"]'
    const isAllowedTarget = (target: EventTarget | null) => {
      return target instanceof HTMLElement && !!target.closest(allowSelector)
    }

    const onWheel = (event: WheelEvent) => {
      if (isAllowedTarget(event.target)) {
        return
      }
      event.preventDefault()
    }

    const onTouchMove = (event: TouchEvent) => {
      if (isAllowedTarget(event.target)) {
        return
      }
      event.preventDefault()
    }

    const onKeyDown = (event: KeyboardEvent) => {
      const scrollKeys = [
        "ArrowUp",
        "ArrowDown",
        "PageUp",
        "PageDown",
        "Home",
        "End",
        " ",
      ]

      if (!scrollKeys.includes(event.key)) {
        return
      }

      if (isAllowedTarget(document.activeElement)) {
        return
      }

      event.preventDefault()
    }

    window.addEventListener("wheel", onWheel, { passive: false })
    window.addEventListener("touchmove", onTouchMove, { passive: false })
    window.addEventListener("keydown", onKeyDown)

    return () => {
      document.documentElement.style.overflow = ""
      document.documentElement.style.paddingRight = ""
      window.removeEventListener("wheel", onWheel)
      window.removeEventListener("touchmove", onTouchMove)
      window.removeEventListener("keydown", onKeyDown)
    }
  }, [cartDrawerOpen])

  useEffect(() => {
    setMounted(true)
  }, [])

  // Close on Escape key
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        close()
      }
    }

    window.addEventListener("keydown", onKeyDown)

    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  // Open the drawer ONLY on an explicit add-to-cart event (never on cart
  // hydration or page navigation), except when already on the cart page.
  useEffect(() => {
    return onCartUpdated((detail) => {
      if (detail.action === "add" && !pathname.includes("/cos")) {
        open()
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  return (
    <div className="h-full z-50">
      <button type="button" onClick={open} className="h-full flex items-center">
        <span
          className="relative flex items-center hover:opacity-60 transition-opacity"
          data-testid="nav-cart-link"
          aria-label={t("Coș ({count})", { count: totalItems })}
        >
          <BagIcon size={22} />
          <CountBadge count={totalItems} />
        </span>
      </button>

      {mounted &&
        createPortal(
          <AnimatePresence>
            {cartDrawerOpen && (
              <>
                {/* Backdrop */}
                <motion.div
                  key="backdrop"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                  className="fixed inset-0 z-[9010] bg-[rgba(6,10,8,0.55)] backdrop-blur-[2px] pointer-events-auto"
                  onClick={close}
                  data-testid="side-cart-backdrop"
                />

                {/* Drawer panel */}
                <motion.div
                  key="panel"
                  initial={{ x: "100%" }}
                  animate={{ x: 0 }}
                  exit={{ x: "100%" }}
                  transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
                  className="fixed inset-y-0 right-0 left-0 z-[9011] h-dvh sm:left-auto sm:w-[420px] will-change-transform"
                  data-testid="nav-cart-dropdown"
                >
                  <div className="flex flex-col h-full overflow-hidden bg-[var(--theme-bg)] shadow-2xl">
                    {/* Header */}
                    <div className="flex items-center justify-between px-7 h-16 border-b border-[var(--theme-border)] shrink-0">
                      <div className="flex items-baseline gap-3">
                        <h2 className="font-sans text-[12px] uppercase tracking-[0.2em] text-[var(--theme-text)]">
                          {t("Coș")}
                        </h2>
                        {totalItems > 0 && (
                          <span className="font-sans text-[12px] uppercase tracking-[0.2em] text-[var(--theme-text-muted)]">
                            ({totalItems})
                          </span>
                        )}
                      </div>
                      <button
                        data-testid="close-cart-button"
                        onClick={close}
                        aria-label={t("Închide sertarul de coș")}
                        className="inline-flex h-12 w-12 items-center justify-end text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] transition-colors"
                      >
                        <XMark />
                      </button>
                    </div>

                    {cartState && cartState.items?.length ? (
                      <>
                        {/* Items */}
                        <div
                          data-scroll-lock-allow="true"
                          className="flex-1 overflow-y-auto overscroll-contain no-scrollbar px-7 py-6 flex flex-col gap-6"
                        >
                          {cartState.items
                            .sort((a, b) =>
                              (a.created_at ?? "") > (b.created_at ?? "")
                                ? -1
                                : 1
                            )
                            .map((item) => {
                              const imgSrc = getCartItemImageUrl(item)
                              // Compare unit prices (quantity-independent) rather
                              // than line totals — total vs original_total can
                              // differ by a rounding cent from tax calculation
                              // as quantity changes, even with no real discount.
                              const compareAtUnitPrice = (item as any)
                                .compare_at_unit_price as number | undefined
                              const hasDiscount =
                                typeof compareAtUnitPrice === "number" &&
                                compareAtUnitPrice > (item.unit_price ?? 0)
                              // item.product_title is a denormalized snapshot
                              // captured at add-to-cart time (survives the
                              // product being edited/deleted later), so it
                              // never re-resolves through the translation
                              // layer — item.variant.product is the live,
                              // expanded relation and reflects the current
                              // locale.
                              const displayTitle =
                                (item.variant as any)?.product?.title ??
                                item.product_title
                              return (
                                <div
                                  key={item.id}
                                  className="flex gap-4"
                                  data-testid="cart-item"
                                >
                                  {/* Thumbnail */}
                                  <LocalizedClientLink
                                    href={`/produs/${item.product_handle}`}
                                    className="shrink-0"
                                    onClick={close}
                                  >
                                    <div className="relative w-[72px] aspect-[3/4] overflow-hidden bg-white">
                                      {imgSrc && (
                                        <Image
                                          src={imgSrc}
                                          alt={displayTitle ?? ""}
                                          fill
                                          className="object-contain object-center"
                                          sizes="72px"
                                        />
                                      )}
                                    </div>
                                  </LocalizedClientLink>

                                  {/* Info */}
                                  <div className="flex flex-col flex-1 min-w-0 py-2 justify-between">
                                    {/* Title + delete */}
                                    <div className="flex items-start justify-between gap-2">
                                      <LocalizedClientLink
                                        href={`/produs/${item.product_handle}`}
                                        data-testid="product-link"
                                        onClick={close}
                                        className="flex-1 min-w-0"
                                      >
                                        <span className="font-sans text-[12px] uppercase tracking-[2px] leading-[1.4] text-[var(--theme-text)] hover:text-hunter-gold transition-colors line-clamp-2 block">
                                          {displayTitle}
                                        </span>
                                      </LocalizedClientLink>
                                      <button
                                        onClick={() =>
                                          handleDeleteItem(item.id)
                                        }
                                        aria-label={t("Șterge")}
                                        data-testid="cart-item-remove-button"
                                        className="shrink-0 mt-[1px] text-[var(--theme-text-muted)] hover:text-hunter-gold transition-colors"
                                      >
                                        <svg
                                          width="11"
                                          height="11"
                                          viewBox="0 0 24 24"
                                          fill="none"
                                          stroke="currentColor"
                                          strokeWidth="1.5"
                                          strokeLinecap="round"
                                        >
                                          <line x1="18" y1="6" x2="6" y2="18" />
                                          <line x1="6" y1="6" x2="18" y2="18" />
                                        </svg>
                                      </button>
                                    </div>

                                    {/* Variant */}
                                    {(() => {
                                      const opts = (item.variant as any)
                                        ?.options as
                                        | { value?: string }[]
                                        | undefined
                                      const label =
                                        opts
                                          ?.map((o) => o.value)
                                          .filter(Boolean)
                                          .join(" · ") || item.variant?.title
                                      return label ? (
                                        <span
                                          className="font-serif italic text-[13px] text-[var(--theme-text-muted)] mt-0.5 block"
                                          data-testid="cart-item-variant"
                                        >
                                          {label}
                                        </span>
                                      ) : null
                                    })()}

                                    {/* Bottom row: qty stepper left, price stack right */}
                                    <div className="flex items-end justify-between mt-3">
                                      <div
                                        className={`flex items-center gap-2 border border-[var(--theme-border)] transition-opacity ${
                                          updatingLine === item.id
                                            ? "opacity-60"
                                            : ""
                                        }`}
                                      >
                                        <button
                                          onClick={() =>
                                            handleSetQuantity(
                                              item.id,
                                              item.quantity - 1
                                            )
                                          }
                                          disabled={updatingLine === item.id}
                                          aria-label={
                                            item.quantity <= 1
                                              ? t("Șterge")
                                              : t("Scade cantitate")
                                          }
                                          className="w-7 h-7 flex items-center justify-center text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] disabled:opacity-30 transition-colors"
                                        >
                                          <svg
                                            width="9"
                                            height="9"
                                            viewBox="0 0 8 2"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="1.5"
                                            strokeLinecap="round"
                                          >
                                            <line x1="1" y1="1" x2="7" y2="1" />
                                          </svg>
                                        </button>
                                        <span
                                          className="font-sans text-[12px] w-4 text-center text-[var(--theme-text)]"
                                          data-testid="cart-item-quantity"
                                          data-value={item.quantity}
                                        >
                                          {item.quantity}
                                        </span>
                                        <button
                                          onClick={() =>
                                            handleSetQuantity(
                                              item.id,
                                              item.quantity + 1
                                            )
                                          }
                                          disabled={(() => {
                                            if (updatingLine === item.id)
                                              return true
                                            const inventoryCap =
                                              !!item.variant
                                                ?.manage_inventory &&
                                              !item.variant?.allow_backorder &&
                                              typeof item.variant
                                                ?.inventory_quantity ===
                                                "number"
                                                ? item.variant
                                                    .inventory_quantity
                                                : Infinity
                                            const cap = Math.min(
                                              inventoryCap,
                                              maxQty[item.id] ?? Infinity
                                            )
                                            return item.quantity >= cap
                                          })()}
                                          aria-label={t("Crește cantitate")}
                                          className="w-7 h-7 flex items-center justify-center text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] disabled:opacity-30 transition-colors"
                                        >
                                          <svg
                                            width="9"
                                            height="9"
                                            viewBox="0 0 8 8"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="1.5"
                                            strokeLinecap="round"
                                          >
                                            <line x1="4" y1="1" x2="4" y2="7" />
                                            <line x1="1" y1="4" x2="7" y2="4" />
                                          </svg>
                                        </button>
                                      </div>

                                      <div className="flex flex-col items-end gap-0.5">
                                        <span className="font-sans text-[10px] uppercase tracking-[1.5px] text-[var(--theme-text-muted)]">
                                          {convertToLocale({
                                            amount: item.unit_price ?? 0,
                                            currency_code:
                                              cartState.currency_code,
                                          })}{" "}
                                          {t("/ buc")}
                                        </span>
                                        {hasDiscount && (
                                          <span className="font-serif italic text-[13px] text-[var(--theme-text-muted)] line-through">
                                            {convertToLocale({
                                              amount:
                                                (compareAtUnitPrice ?? 0) *
                                                item.quantity,
                                              currency_code:
                                                cartState.currency_code,
                                            })}
                                          </span>
                                        )}
                                        <span
                                          className="font-display text-[15px] text-[var(--theme-text)]"
                                          data-testid="product-price"
                                        >
                                          {convertToLocale({
                                            amount: item.total ?? 0,
                                            currency_code:
                                              cartState.currency_code,
                                          })}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              )
                            })}
                        </div>

                        {/* Footer */}
                        <div className="shrink-0 px-7 pb-7 pt-5 border-t border-[var(--theme-border)] flex flex-col gap-4">
                          <div className="flex items-baseline justify-between">
                            <span className="font-sans text-[12px] uppercase tracking-[0.2em] text-[var(--theme-text-muted)]">
                              {t("Subtotal")}
                            </span>
                            <span
                              className="font-display text-[22px] leading-none text-hunter-gold"
                              data-testid="cart-subtotal"
                              data-value={subtotal}
                            >
                              {convertToLocale({
                                amount: subtotal,
                                currency_code: cartState.currency_code,
                              })}
                            </span>
                          </div>
                          <div className="flex flex-col gap-2">
                            <LocalizedClientLink
                              href="/cos"
                              passHref
                              onClick={close}
                              className="w-full"
                            >
                              <Button
                                className="w-full h-12 rounded-none !bg-hunter-gold !text-hunter-dark !border-transparent hover:!bg-hunter-gold-b font-sans uppercase tracking-[3px] text-[13px]"
                                data-testid="go-to-cart-button"
                              >
                                {t("Vezi coșul")}
                              </Button>
                            </LocalizedClientLink>
                            <button
                              type="button"
                              onClick={close}
                              data-testid="continue-shopping-button"
                              className="w-full h-12 font-sans uppercase tracking-[3px] text-[13px] text-[var(--theme-text)] border border-[var(--theme-border)] hover:border-hunter-gold hover:text-hunter-gold transition-colors"
                            >
                              {t("Continuă cumpărăturile")}
                            </button>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="flex flex-1 flex-col items-center justify-center gap-6 px-7 pb-6 text-center">
                        <p className="font-sans text-[12px] uppercase tracking-[5px] text-[var(--theme-text-muted)]">
                          {t("Coșul este gol")}
                        </p>
                        <p className="font-sans text-sm text-[var(--theme-text-muted)] max-w-xs">
                          {t("Nu ai adăugat niciun produs în coș")}
                        </p>
                        <LocalizedClientLink
                          href="/ready-to-wear"
                          onClick={close}
                        >
                          <button className="mt-2 px-8 py-3 font-sans text-[12px] uppercase tracking-[4px] border border-hunter-gold text-hunter-gold hover:bg-hunter-gold hover:text-hunter-dark transition-colors">
                            {t("Descoperă colecția")}
                          </button>
                        </LocalizedClientLink>
                      </div>
                    )}
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>,
          document.body
        )}
    </div>
  )
}

export default CartDropdown
