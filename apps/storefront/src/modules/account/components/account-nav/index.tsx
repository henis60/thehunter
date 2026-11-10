"use client"

import { useTranslations } from "next-intl"
import { ArrowRightOnRectangle } from "@medusajs/icons"
import { clx } from "@modules/common/components/ui"
import { usePathname } from "@i18n/navigation"
import { signout } from "@lib/data/customer"
import { emitCartUpdated } from "@lib/util/cart-events"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

const NAV_ITEMS = [
  { label: "Acasă", href: "/profil" },
  { label: "Detalii cont", href: "/profil/detalii-cont" },
  { label: "Adrese salvate", href: "/profil/adrese" },
  { label: "Comenzi", href: "/profil/comenzi" },
] as const

// The overview route doubles as the menu on mobile, so it isn't listed there.
const MOBILE_NAV_ITEMS = NAV_ITEMS.filter(({ href }) => href !== "/profil")

const isActive = (route: string, href: string) =>
  route === href || (href !== "/profil" && route.startsWith(href))

// Where "back" leads from a sub-page: order details step back to the orders
// list; everything else returns to the account overview.
const backTarget = (route: string) =>
  route.startsWith("/profil/comenzi/") ? "/profil/comenzi" : "/profil"

const handleLogout = async () => {
  // Logout drops the cart cookie server-side; clear the client-held cart
  // (badge + drawer) too. Before signout — its redirect ends execution.
  emitCartUpdated(null)
  await signout()
}

const AccountNav = () => {
  const t = useTranslations("account")
  const route = usePathname() ?? "/profil"

  return (
    <div>
      <MobileNav route={route} t={t} />
      <DesktopNav route={route} t={t} />
    </div>
  )
}

type NavT = ReturnType<typeof useTranslations>

/**
 * Mobile: the overview page IS the menu (tap-friendly full-bleed rows).
 * Sub-pages collapse the menu into a back link + section title.
 */
const MobileNav = ({ route, t }: { route: string; t: NavT }) => {
  const isOverview = route === "/profil"
  const activeItem = MOBILE_NAV_ITEMS.find(({ href }) => isActive(route, href))

  return (
    <nav
      aria-label={t("Meniu cont")}
      className="small:hidden"
      data-testid="mobile-account-nav"
    >
      {isOverview ? (
        <div className="pt-5">
          <ul className="flex flex-col divide-y divide-[var(--theme-border)] border border-[var(--theme-border)]">
            {MOBILE_NAV_ITEMS.map(({ label, href }) => (
              <li key={href}>
                <LocalizedClientLink
                  href={href}
                  className="group flex items-center justify-between gap-4 min-h-[56px] p-4 font-serif text-[18px] leading-[1] tracking-[0.02em] text-[var(--theme-text)] active:bg-[var(--theme-surface)] active:text-hunter-gold transition-colors"
                  data-testid={`${label.toLowerCase()}-link`}
                >
                  {t(label)}
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
                    className="shrink-0 text-hunter-gold/40 group-active:text-hunter-gold group-active:translate-x-0.5 transition-all"
                  >
                    <polyline points="9 6 15 12 9 18" />
                  </svg>
                </LocalizedClientLink>
              </li>
            ))}
          </ul>
        </div>
      ) : activeItem ? (
        <div>
          <LocalizedClientLink
            href={backTarget(route)}
            className="inline-flex items-end gap-2 small:py-3 small:-my-3 small:px-3 small:-mx-3 small:px-3 small:-mx-3 font-sans text-[10px] uppercase tracking-[3px] text-[var(--theme-text-muted)] hover:text-[var(--theme-gold)] active:text-[var(--theme-gold)] transition-colors"
            data-testid="account-back-link"
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
          <div className="py-4">
            <h1 className="font-serif text-[22px] leading-[1] tracking-[0.02em] text-hunter-gold">
              {route.startsWith("/profil/comenzi/")
                ? t("Comanda #{id}", { id: route.split("/").pop() ?? "" })
                : t(activeItem.label)}
            </h1>
          </div>
        </div>
      ) : null}
    </nav>
  )
}

/** Desktop: persistent sidebar with active-state rail and logout. */
const DesktopNav = ({ route, t }: { route: string; t: NavT }) => (
  <nav
    aria-label={t("Meniu cont")}
    className="hidden small:flex flex-col py-8 pr-8 gap-24 border-r border-[var(--theme-border)]"
    data-testid="account-nav"
  >
    <ul className="flex flex-col">
      {NAV_ITEMS.map(({ label, href }) => (
        <li key={href}>
          <LocalizedClientLink
            href={href}
            className={clx(
              "block py-4 pl-3 border-l-2 font-serif text-[22px] leading-[1] tracking-[0.02em] transition-colors duration-150",
              isActive(route, href)
                ? "border-hunter-gold text-[var(--theme-gold)]"
                : "border-transparent text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:border-[var(--theme-border)]"
            )}
            aria-current={isActive(route, href) ? "page" : undefined}
            data-testid={`${label.toLowerCase()}-link`}
          >
            {t(label)}
          </LocalizedClientLink>
        </li>
      ))}
    </ul>

    <button
      type="button"
      onClick={handleLogout}
      data-testid="logout-button"
      className="mt-10 w-full h-11 px-6 inline-flex items-center justify-center gap-2 border border-[var(--theme-border)] font-sans text-[11px] uppercase tracking-[3px] text-[var(--theme-text)] hover:border-hunter-gold hover:text-hunter-gold transition-colors"
    >
      <ArrowRightOnRectangle className="w-3.5 h-3.5" />
      {t("Deconectare")}
    </button>
  </nav>
)

export default AccountNav
