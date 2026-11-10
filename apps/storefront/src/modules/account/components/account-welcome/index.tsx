"use client"

import { useTranslations } from "next-intl"
import { usePathname } from "@i18n/navigation"
import { clx } from "@modules/common/components/ui"
import { HttpTypes } from "@medusajs/types"

// On mobile, sub-pages already get a title bar from AccountNav — the big
// welcome hero would push their content below the fold, so it only renders
// on the overview route there. Desktop always shows it.
const AccountWelcome = ({
  customer,
}: {
  customer: HttpTypes.StoreCustomer
}) => {
  const t = useTranslations("account")
  const route = usePathname()
  const isOverview = route === "/profil"

  return (
    <div
      className={clx(
        "small:border-b border-[var(--theme-border)] pb-0 md:pb-10",
        !isOverview && "hidden small:block"
      )}
    >
      <p className="font-sans text-[11px] uppercase tracking-[4px] text-[var(--theme-text-muted)] mb-2">
        {t("Profil")}
      </p>
      <h1 className="font-display text-3xl small:text-4xl text-[var(--theme-text)] leading-tight">
        {t("Bun venit înapoi,")}
        <br />
        <span className="italic text-hunter-gold">{customer.first_name}</span>
      </h1>
    </div>
  )
}

export default AccountWelcome
