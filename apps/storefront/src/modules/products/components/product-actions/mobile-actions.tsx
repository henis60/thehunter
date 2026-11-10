"use client"

import { HttpTypes } from "@medusajs/types"
import { getProductPrice } from "@lib/util/get-product-price"
import {
  isSimpleProduct,
  isInStoreOnly,
  COLOR_OPTION_NAMES as COLOR_TITLES,
} from "@lib/util/product"
import { Button } from "@modules/common/components/ui"
import OptionSelect from "./option-select"
import { useMemo, useEffect, useRef, useState } from "react"
import { useTranslations } from "next-intl"
import { createPortal } from "react-dom"
import { AnimatePresence, m as motion } from "framer-motion"
import { useScrollLock } from "@lib/hooks/use-scroll-lock"

type MobileActionsProps = {
  product: HttpTypes.StoreProduct
  variant?: HttpTypes.StoreProductVariant
  options: Record<string, string | undefined>
  updateOptions: (title: string, value: string) => void
  inStock?: boolean
  handleAddToCart: () => void
  isAdding?: boolean
  show: boolean
  optionsDisabled: boolean
}

const MobileActions: React.FC<MobileActionsProps> = ({
  product,
  variant,
  options,
  updateOptions,
  inStock,
  handleAddToCart,
  isAdding,
  show,
  optionsDisabled,
}) => {
  const t = useTranslations("products")
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  useScrollLock(open)

  const sheetRef = useRef<HTMLDivElement>(null)
  const dragY = useRef(0)
  const startY = useRef(0)
  const dragging = useRef(false)
  const [dragOffset, setDragOffset] = useState(0)

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    if (!open) return
    setDragOffset(0)
  }, [open])

  const onTouchStart = (e: React.TouchEvent) => {
    dragging.current = true
    startY.current = e.touches[0].clientY
    dragY.current = 0
  }
  const onTouchMove = (e: React.TouchEvent) => {
    if (!dragging.current) return
    const delta = e.touches[0].clientY - startY.current
    if (delta < 0) return
    dragY.current = delta
    setDragOffset(delta)
  }
  const onTouchEnd = () => {
    dragging.current = false
    if (dragY.current > 80) {
      setDragOffset(0)
      setOpen(false)
    } else setDragOffset(0)
  }

  const price = getProductPrice({ product, variantId: variant?.id })
  const selectedPrice = useMemo(() => {
    if (!price) return null
    return price.variantPrice || price.cheapestPrice || null
  }, [price])

  const variantInStock = (v: HttpTypes.StoreProductVariant) => {
    if (!v.manage_inventory) return true
    if (v.allow_backorder) return true
    return (v.inventory_quantity || 0) > 0
  }

  // Whole product unpurchasable — the sticky bar must not invite a tap into
  // a sheet where nothing can be selected.
  const productOutOfStock = useMemo(() => {
    if (!product.variants?.length) return false
    return !product.variants.some(variantInStock)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.variants])

  const isColorOpt = (optId: string) =>
    COLOR_TITLES.includes(
      product.options?.find((o) => o.id === optId)?.title?.toLowerCase() ?? ""
    )
  const vmap = (v: HttpTypes.StoreProductVariant) =>
    v.options?.reduce((acc, o) => {
      if (o.option_id) acc[o.option_id] = o.value
      return acc
    }, {} as Record<string, string>) ?? {}

  const getDisabledValues = (optionId: string): Set<string> => {
    const allValues =
      product.options
        ?.find((o) => o.id === optionId)
        ?.values?.map((v) => v.value ?? "") ?? []
    if (isColorOpt(optionId)) {
      const available = new Set(
        (product.variants ?? []).map((v) => vmap(v)[optionId]).filter(Boolean)
      )
      return new Set(allValues.filter((v) => !available.has(v)))
    }
    const others = Object.entries(options).filter(
      ([id, val]) => id !== optionId && !!val
    ) as [string, string][]
    // Same rule as the desktop picker: a value is only selectable if some
    // matching variant is actually purchasable. Stock was ignored here, so
    // the sheet happily offered sold-out sizes.
    const available = new Set<string>()
    product.variants?.forEach((v) => {
      const map = vmap(v)
      if (
        others.every(([id, val]) => map[id] === val) &&
        map[optionId] &&
        variantInStock(v)
      )
        available.add(map[optionId])
    })
    return new Set(allValues.filter((v) => !available.has(v)))
  }

  const isSimple = isSimpleProduct(product)
  const inStoreOnly = isInStoreOnly(product)
  // No option on this product actually offers a choice (mirrors the
  // desktop options list, which hides these too) — there's nothing to pick,
  // so the sticky button should add to cart directly instead of opening a
  // sheet with nothing meaningful in it.
  const hasPickableOptions = (product.options ?? []).some(
    (o) => (o.values?.length ?? 0) > 1
  )

  return (
    <>
      {/* Sticky bar — just appears, no transition. */}
      {show && (
        <div className="lg:hidden inset-x-0 bottom-0 fixed z-50">
          {inStoreOnly ? (
            <div className="bg-[var(--theme-bg)] border-t border-[var(--theme-border)] flex items-center gap-3 px-4 py-3">
              <div className="flex-1 min-w-0">
                <p className="font-sans text-[12px] uppercase tracking-[2px] text-[var(--theme-text)] truncate">
                  {product.title}
                </p>
                {selectedPrice && (
                  <p className="font-sans text-[13px] text-hunter-gold mt-0.5">
                    {selectedPrice.calculated_price}
                  </p>
                )}
              </div>
              <div className="font-sans text-[10px] uppercase tracking-[4px] text-[#cfd8d2] border border-[rgba(207,216,210,0.35)] px-4 py-2.5 text-center">
                {t("Disponibil în magazin")}
              </div>
            </div>
          ) : (
            <div className="bg-[var(--theme-bg)] border-t border-[var(--theme-border)] px-6 py-3">
              <Button
                onClick={() =>
                  hasPickableOptions ? setOpen(true) : handleAddToCart()
                }
                disabled={
                  isAdding ||
                  productOutOfStock ||
                  (!hasPickableOptions && !inStock)
                }
                variant="primary"
                className="w-full h-12 rounded-none !bg-hunter-gold !text-hunter-dark !border-transparent hover:!bg-hunter-gold-b font-sans uppercase tracking-[3px] text-[13px] transition-colors"
              >
                {isAdding
                  ? t("Se adaugă…")
                  : productOutOfStock || (!hasPickableOptions && !inStock)
                  ? t("Stoc epuizat")
                  : t("Adaugă în coș")}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Bottom sheet portal */}
      {mounted &&
        createPortal(
          <>
            <AnimatePresence>
              {open && (
                <motion.div
                  key="ma-backdrop"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="fixed inset-0 z-[9020] bg-black/50 lg:hidden"
                  onClick={() => setOpen(false)}
                />
              )}
            </AnimatePresence>
            <AnimatePresence>
              {open && (
                <motion.div
                  key="ma-sheet"
                  ref={sheetRef}
                  initial={{ y: "100%" }}
                  animate={{ y: dragOffset }}
                  exit={{ y: "100%" }}
                  transition={
                    dragging.current
                      ? { duration: 0 }
                      : {
                          duration: 0.38,
                          ease: [0.22, 1, 0.36, 1] as [
                            number,
                            number,
                            number,
                            number
                          ],
                        }
                  }
                  className="fixed inset-x-0 bottom-0 z-[9021] bg-[var(--theme-bg)] border-t border-[var(--theme-border)] lg:hidden"
                >
                  {/* Drag handle */}
                  <div
                    className="flex justify-center pt-3 pb-2 cursor-grab active:cursor-grabbing touch-none"
                    onTouchStart={onTouchStart}
                    onTouchMove={onTouchMove}
                    onTouchEnd={onTouchEnd}
                  >
                    <div className="w-10 h-1 rounded-full bg-[var(--theme-border)]" />
                  </div>

                  {/* Options */}
                  <div
                    className="px-6 py-5 flex flex-col gap-6 overflow-y-auto max-h-[60dvh]"
                    data-scroll-lock-allow="true"
                  >
                    {(product.options || []).map((option) => (
                      <div key={option.id}>
                        <OptionSelect
                          option={option}
                          current={options[option.id]}
                          updateOption={updateOptions}
                          title={option.title ?? ""}
                          disabled={optionsDisabled}
                          disabledValues={getDisabledValues(option.id)}
                          variants={product.variants}
                        />
                      </div>
                    ))}
                  </div>

                  {/* Footer */}
                  <div className="px-6 py-4 border-t border-[var(--theme-border)] flex gap-3">
                    <button
                      onClick={() => setOpen(false)}
                      className="flex-1 py-3 font-sans text-[12px] uppercase tracking-[3px] border border-[var(--theme-border)] text-[var(--theme-text-muted)] hover:border-[var(--theme-text-muted)] transition-colors"
                    >
                      {t("Înapoi")}
                    </button>
                    <button
                      onClick={() => {
                        handleAddToCart()
                        setOpen(false)
                      }}
                      disabled={!inStock || !variant || isAdding}
                      className="flex-[2] py-3 font-sans text-[12px] uppercase tracking-[3px] bg-hunter-gold text-hunter-dark transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {isAdding
                        ? t("Se adaugă…")
                        : !variant
                        ? t("Selectează")
                        : !inStock
                        ? t("Stoc epuizat")
                        : t("Adaugă în coș")}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </>,
          document.body
        )}
    </>
  )
}

export default MobileActions
