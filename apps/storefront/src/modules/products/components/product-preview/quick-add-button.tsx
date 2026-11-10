"use client"

import { addToCart } from "@lib/data/cart"
import { emitCartUpdated } from "@lib/util/cart-events"
import { useRouter } from "@i18n/navigation"
import { useLocale, useTranslations } from "next-intl"
import { useState } from "react"

type Props = {
  variantId: string | null
  productHandle: string
  hasMultipleOptions: boolean
}

export default function QuickAddButton({ variantId, productHandle, hasMultipleOptions }: Props) {
  const t = useTranslations("products")
  const locale = useLocale()
  const [adding, setAdding] = useState(false)
  const countryCode = "ro"
  const router = useRouter()

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    if (!variantId) return

    setAdding(true)
    const freshCart = await addToCart({ variantId, quantity: 1, countryCode, locale })
    emitCartUpdated(freshCart, { action: "add" })
    setAdding(false)
  }

  return (
    <button
      onClick={handleClick}
      disabled={adding}
      className="absolute bottom-3.5 left-3.5 right-3.5 z-20 py-2.5 font-sans text-[9px] uppercase tracking-[4px] text-hunter-gold bg-hunter-dark/70 backdrop-blur-sm border border-hunter-gold/40 hover:border-hunter-gold hover:bg-hunter-dark/90 transition-all duration-300 opacity-0 group-hover:opacity-100 translate-y-1 group-hover:translate-y-0 disabled:opacity-50"
    >
      {adding ? t("Se adaugă…") : t("Adaugă în coș")}
    </button>
  )
}
