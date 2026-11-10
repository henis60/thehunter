"use client"

import { useTranslations } from "next-intl"

const PaymentTest = ({ className }: { className?: string }) => {
  const t = useTranslations("checkout")
  return (
    <span className={`font-sans text-[11px] uppercase tracking-[2px] text-hunter-gold/70 ${className ?? ""}`}>
      {t("Test mode")}
    </span>
  )
}

export default PaymentTest
