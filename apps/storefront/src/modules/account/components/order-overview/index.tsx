"use client"

import { useTranslations } from "next-intl"
import { Button } from "@modules/common/components/ui"

import OrderCard from "../order-card"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { HttpTypes } from "@medusajs/types"

const OrderOverview = ({ orders }: { orders: HttpTypes.StoreOrder[] }) => {
  const t = useTranslations("account")
  if (orders?.length) {
    return (
      <div className="w-full small:px-8 pt-2 small:pt-4 pb-4">
        <div className="flex flex-col divide-y divide-[var(--theme-border)]">
          {orders.map((o) => (
            <OrderCard key={o.id} order={o} />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div
      className="flex flex-col items-center justify-center gap-6 small:px-8 py-20 text-center"
      data-testid="no-orders-container"
    >
      <div>
        <p className="font-sans text-[11px] uppercase tracking-[4px] text-[var(--theme-text-muted)] mb-3">
          {t("Istoric comenzi")}
        </p>
        <h2 className="font-display text-[28px] leading-[1.1] text-[var(--theme-text)] mb-3">
          {t("Nicio comandă încă")}
        </h2>
        <p className="font-serif italic text-[16px] text-[var(--theme-text-muted)] max-w-[240px] mx-auto">
          {t("Descoperă colecția noastră și plasează prima ta comandă")}
        </p>
      </div>
      <LocalizedClientLink href="/ready-to-wear" passHref>
        <Button
          data-testid="continue-shopping-button"
          className="h-12 small:px-8 rounded-none !bg-hunter-gold !text-hunter-dark !border-transparent font-sans uppercase tracking-[3px] text-[13px]"
        >
          {t("Vezi colecția")}
        </Button>
      </LocalizedClientLink>
    </div>
  )
}

export default OrderOverview
