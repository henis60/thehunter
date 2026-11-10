"use client"

import { Popover, PopoverPanel } from "@headlessui/react"
import { AnimatePresence, m as motion } from "framer-motion"
import { useTranslations } from "next-intl"
import { XMark } from "@medusajs/icons"
import { MenuIcon } from "@modules/layout/components/nav-icons"
import { HttpTypes } from "@medusajs/types"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import LanguageSelect from "../language-select"
import { Locale } from "@lib/data/locales"
import { isMetadataFlagSet } from "@lib/util/metadata-flag"

type SideMenuProps = {
  regions: HttpTypes.StoreRegion[] | null
  locales: Locale[] | null
  currentLocale: string | null
  collections?: HttpTypes.StoreCollection[]
  categories?: HttpTypes.StoreProductCategory[]
  featuredCollection?: HttpTypes.StoreCollection | null
}

type ScrollGuardProps = {
  open: boolean
  // Set right before navigating away via a menu link — tells the cleanup
  // below to land on the top of the new page instead of restoring the
  // scroll position the user was at on the page they're leaving. Without
  // this, every menu-link click restored the OLD page's scroll offset the
  // instant the menu closed, which could win the race against (or simply
  // get scrolled past by) Next's own post-navigation scroll-to-top —
  // leaving the new page wherever the previous one happened to be scrolled.
  navigatingRef: React.RefObject<boolean>
}

const SideMenuScrollGuard = ({ open, navigatingRef }: ScrollGuardProps) => {
  // Wheel/touchmove preventDefault alone is unreliable on mobile Safari
  // (rubber-band overscroll can still chain to the body). Locking body
  // overflow directly is what actually stops background scroll on mobile.
  useEffect(() => {
    if (!open) return

    const { overflow, position, width, top } = document.body.style
    const scrollY = window.scrollY
    document.body.style.overflow = "hidden"
    document.body.style.position = "fixed"
    document.body.style.width = "100%"
    document.body.style.top = `-${scrollY}px`
    return () => {
      document.body.style.overflow = overflow
      document.body.style.position = position
      document.body.style.width = width
      document.body.style.top = top
      if (navigatingRef.current) {
        navigatingRef.current = false
        window.scrollTo(0, 0)
      } else {
        window.scrollTo(0, scrollY)
      }
    }
  }, [open, navigatingRef])

  useEffect(() => {
    if (!open) return

    const allowSelector = '[data-scroll-lock-allow="true"]'
    const isAllowedTarget = (target: EventTarget | null) =>
      target instanceof HTMLElement && !!target.closest(allowSelector)

    const onWheel = (e: WheelEvent) => {
      if (!isAllowedTarget(e.target)) e.preventDefault()
    }
    const onTouchMove = (e: TouchEvent) => {
      if (!isAllowedTarget(e.target)) e.preventDefault()
    }
    const onKeyDown = (e: KeyboardEvent) => {
      const scrollKeys = [
        "ArrowUp",
        "ArrowDown",
        "PageUp",
        "PageDown",
        "Home",
        "End",
        " ",
      ]
      if (
        scrollKeys.includes(e.key) &&
        !isAllowedTarget(document.activeElement)
      )
        e.preventDefault()
    }

    window.addEventListener("wheel", onWheel, { passive: false })
    window.addEventListener("touchmove", onTouchMove, { passive: false })
    window.addEventListener("keydown", onKeyDown)
    return () => {
      window.removeEventListener("wheel", onWheel)
      window.removeEventListener("touchmove", onTouchMove)
      window.removeEventListener("keydown", onKeyDown)
    }
  }, [open])

  return null
}

const subLinkClass =
  "block py-2 small:py-2.5 font-display text-[20px] small:text-[22px] leading-[1] tracking-[0.02em] text-[var(--theme-text)] hover:text-hunter-gold transition-colors"

type SubmenuKey = "rtw" | "accesorii" | "featured" | "hunter"

function MenuTrigger({
  label,
  onOpen,
  badge,
  disabled,
}: {
  label: string
  onOpen: () => void
  badge?: string
  disabled?: boolean
}) {
  return (
    <li>
      <button
        type="button"
        onClick={disabled ? undefined : onOpen}
        disabled={disabled}
        aria-disabled={disabled}
        className={`w-full flex items-center justify-between py-2 small:py-2.5 font-display text-[20px] small:text-[22px] leading-[1] tracking-[0.02em] transition-colors duration-200 ${
          disabled
            ? "text-[var(--theme-text-muted)] cursor-default"
            : "text-[var(--theme-text)] hover:text-hunter-gold"
        }`}
      >
        <span className="flex items-center gap-2">
          {label}
          {badge && (
            <span className="font-sans text-[12px] uppercase tracking-[3px] text-hunter-gold leading-none">
              {badge}
            </span>
          )}
        </span>
        {!disabled && (
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-[var(--theme-text-muted)]"
            aria-hidden="true"
          >
            <polyline points="9 6 15 12 9 18" />
          </svg>
        )}
      </button>
    </li>
  )
}

function SubmenuHeader({
  title,
  onBack,
}: {
  title: string
  onBack: () => void
}) {
  const t = useTranslations("layout")
  return (
    <div className="flex items-center justify-between px-8 h-16 border-b border-[var(--theme-border)] shrink-0">
      <span className="font-sans text-[12px] uppercase tracking-[0.3em] text-[var(--theme-text-muted)]">
        {title}
      </span>
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 font-sans text-[12px] uppercase tracking-[3px] text-[var(--theme-text-muted)] hover:text-hunter-gold transition-colors"
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
        {t("Înapoi")}
      </button>
    </div>
  )
}

function FeaturedCollectionSubmenu({
  collection,
  categories,
  onBack,
  close,
}: {
  collection: HttpTypes.StoreCollection
  categories: HttpTypes.StoreProductCategory[]
  onBack: () => void
  close: () => void
}) {
  const t = useTranslations("layout")
  const categoriesWithChildren = new Set(
    categories
      .filter((c) => (c.category_children?.length ?? 0) > 0)
      .map((c) => c.id),
  )
  const seen = new Set<string>()
  const productCategories: HttpTypes.StoreProductCategory[] = []

  for (const product of collection.products ?? []) {
    for (const cat of (product as any).categories ?? []) {
      if (!seen.has(cat.id) && !categoriesWithChildren.has(cat.id)) {
        seen.add(cat.id)
        productCategories.push(cat)
      }
    }
  }

  return (
    <div className="flex flex-col h-full">
      <SubmenuHeader title={collection.title} onBack={onBack} />
      <nav className="flex-1 px-8 py-4 overflow-y-auto">
        <ul className="flex flex-col">
          <li>
            <LocalizedClientLink
              href={`/collections/${collection.handle}`}
              className="block py-2.5 font-sans text-[13px] uppercase tracking-[3px] text-[var(--theme-text-muted)] hover:text-hunter-gold transition-colors"
              onClick={close}
            >
              {t("Toate produsele")}
            </LocalizedClientLink>
          </li>
          {productCategories.map((c) => (
            <li key={c.id}>
              <LocalizedClientLink
                href={`/ready-to-wear/${collection.handle}/${c.handle}`}
                className={subLinkClass}
                onClick={close}
              >
                {c.name}
              </LocalizedClientLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}

function ReadyToWearSubmenu({
  categories,
  collections,
  onBack,
  close,
}: {
  categories: HttpTypes.StoreProductCategory[]
  collections: HttpTypes.StoreCollection[]
  onBack: () => void
  close: () => void
}) {
  const t = useTranslations("layout")
  // All root categories except whichever one is metadata.featured (that one
  // gets pulled out into its own "Accesorii" trigger/submenu instead) —
  // previously excluded by matching category.name === "accesorii", which
  // broke under any locale but the one that name was typed in (category.name
  // is translated).
  const nonAccesoriiCategories = categories.filter(
    (c) => !c.parent_category && !isMetadataFlagSet(c.metadata, "featured"),
  )

  return (
    <div className="flex flex-col h-full">
      <SubmenuHeader title={t("Ready to Wear")} onBack={onBack} />
      <nav className="flex-1 px-8 py-4 overflow-y-auto">
        <ul className="flex flex-col">
          <li>
            <LocalizedClientLink
              href="/ready-to-wear"
              className="block py-2.5 font-sans text-[13px] uppercase tracking-[3px] text-[var(--theme-text-muted)] hover:text-hunter-gold transition-colors"
              onClick={close}
            >
              {t("Toate produsele")}
            </LocalizedClientLink>
          </li>
          {nonAccesoriiCategories.map((c) => (
            <li key={c.id}>
              <LocalizedClientLink
                href={`/ready-to-wear/${c.handle}`}
                className={subLinkClass}
                onClick={close}
              >
                {c.name}
              </LocalizedClientLink>
            </li>
          ))}
          {collections.length > 0 && (
            <li className="mt-4 mb-1">
              <span className="font-sans text-[12px] uppercase tracking-[2.5px] text-[var(--theme-text-muted)]">
                {t("Colecții")}
              </span>
            </li>
          )}
          {collections.map((c) => (
            <li key={c.id}>
              <LocalizedClientLink
                href={`/collections/${c.handle}`}
                className={subLinkClass}
                onClick={close}
              >
                {c.title}
              </LocalizedClientLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}

function AccesoriiSubmenu({
  categories,
  onBack,
  close,
}: {
  categories: HttpTypes.StoreProductCategory[]
  onBack: () => void
  close: () => void
}) {
  const t = useTranslations("layout")
  // Flagged explicitly via metadata.featured — instead of matching on
  // category.name === "accesorii", which broke under any locale but the one
  // that name was typed in (category.name is translated).
  const parent = categories.find((c) =>
    isMetadataFlagSet(c.metadata, "featured"),
  )
  const subcategories = parent?.category_children ?? []

  return (
    <div className="flex flex-col h-full">
      <SubmenuHeader title={t("Accesorii")} onBack={onBack} />
      <nav className="flex-1 px-8 py-4 overflow-y-auto">
        <ul className="flex flex-col">
          {parent && (
            <li>
              <LocalizedClientLink
                href={`/ready-to-wear/${parent.handle}`}
                className="block py-2.5 font-sans text-[13px] uppercase tracking-[3px] text-[var(--theme-text-muted)] hover:text-hunter-gold transition-colors"
                onClick={close}
              >
                {t("Toate accesoriile")}
              </LocalizedClientLink>
            </li>
          )}
          {subcategories.map((c) => (
            <li key={c.id}>
              <LocalizedClientLink
                href={`/ready-to-wear/${c.handle}`}
                className={subLinkClass}
                onClick={close}
              >
                {c.name}
              </LocalizedClientLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}

function WorldOfTheHunterSubmenu({
  onBack,
  close,
}: {
  onBack: () => void
  close: () => void
}) {
  const t = useTranslations("layout")
  const STYLE_GUIDES = [
    { label: t("Wedding Season"), status: "coming-soon" },
    { label: t("Shooting Wear"), status: "coming-soon" },
  ]
  return (
    <div className="flex flex-col h-full">
      <SubmenuHeader title={t("World of The Hunter")} onBack={onBack} />
      <nav className="flex-1 px-8 py-4 overflow-y-auto">
        <p className="font-sans text-[13px] uppercase tracking-[2.5px] text-[var(--theme-text-muted)] mb-3">
          {t("Style Guides")}
        </p>
        <ul className="flex flex-col">
          {STYLE_GUIDES.map((g) => (
            <li key={g.label} className="relative">
              <span className="flex items-center gap-2 py-2 small:py-2.5 font-display text-[20px] small:text-[22px] leading-[1] tracking-[0.02em] text-[var(--theme-text-muted)] cursor-default">
                {g.label}
                {g.status === "coming-soon" && (
                  <span className="font-sans text-[12px] uppercase tracking-[3px] text-hunter-gold leading-none">
                    {t("Coming Soon")}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}

const SideMenu = ({
  regions,
  locales,
  currentLocale,
  collections,
  categories,
  featuredCollection,
}: SideMenuProps) => {
  const t = useTranslations("layout")
  const [mounted, setMounted] = useState(false)
  const [activeSubmenu, setActiveSubmenu] = useState<SubmenuKey | null>(null)
  // Locale is resolved client-side from the cookie so the nav can be part of
  // a static/ISR shell (the server no longer reads the locale cookie).
  const [cookieLocale, setCookieLocale] = useState<string | null>(null)
  const navigatingRef = useRef(false)

  // Nav already excluded whichever collection is metadata.featured (that
  // one is passed separately as featuredCollection) — see
  // layout/templates/nav/index.tsx.
  const otherCollections = collections ?? []

  useEffect(() => {
    setMounted(true)
    const match = document.cookie.match(/(?:^|;\s*)_medusa_locale=([^;]+)/)
    if (match) {
      setCookieLocale(decodeURIComponent(match[1]))
    }
  }, [])

  const resolvedLocale = currentLocale ?? cookieLocale

  return (
    <div className="h-full">
      <div className="flex items-center h-full">
        <Popover className="h-full flex">
          {({ open, close }) => {
            const handleClose = () => {
              setActiveSubmenu(null)
              close()
            }
            // Used by every actual navigation link in the menu (as opposed
            // to the backdrop/X button, which just dismiss the menu without
            // going anywhere) — see SideMenuScrollGuard's navigatingRef.
            const handleNavigate = () => {
              navigatingRef.current = true
              handleClose()
            }
            return (
              <>
                <SideMenuScrollGuard open={open} navigatingRef={navigatingRef} />

                <div className="relative flex h-full">
                  <Popover.Button
                    data-testid="nav-menu-button"
                    aria-label={t("Meniu")}
                    className="relative h-full flex items-center transition-all ease-out duration-200 focus:outline-none hover:opacity-60"
                  >
                    <MenuIcon size={28} />
                  </Popover.Button>
                </div>

                {mounted &&
                  createPortal(
                    <AnimatePresence>
                      {open && (
                        <>
                          {/* Backdrop */}
                          <motion.div
                            key="backdrop"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.3, ease: "easeOut" }}
                            className="fixed inset-0 z-[9010] bg-[rgba(6,10,8,0.55)] backdrop-blur-[2px] pointer-events-auto"
                            onClick={handleClose}
                            data-testid="side-menu-backdrop"
                          />

                          {/* Panel */}
                          <motion.div
                            key="panel"
                            initial={{ x: "-100%" }}
                            animate={{ x: 0 }}
                            exit={{ x: "-100%" }}
                            transition={{
                              duration: 0.42,
                              ease: [0.22, 1, 0.36, 1],
                            }}
                            className="fixed inset-y-0 left-0 right-0 z-[9011] h-dvh sm:right-auto sm:w-[380px] will-change-transform"
                          >
                            <PopoverPanel
                              static
                              className="h-full relative overflow-hidden"
                            >
                              <div
                                data-scroll-lock-allow="true"
                                data-testid="nav-menu-popup"
                                className="flex flex-col h-full overflow-y-auto overscroll-contain bg-[var(--theme-bg)] shadow-2xl"
                              >
                                {/* Header */}
                                <div className="flex items-center justify-between px-8 h-16 border-b border-[var(--theme-border)] shrink-0">
                                  <span className="font-sans text-[12px] uppercase tracking-[0.3em] text-[var(--theme-text-muted)]">
                                    {t("Meniu")}
                                  </span>
                                  <button
                                    data-testid="close-menu-button"
                                    onClick={handleClose}
                                    aria-label={t("Închide meniu")}
                                    className="inline-flex h-12 w-12 items-center justify-end text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] transition-colors"
                                  >
                                    <XMark />
                                  </button>
                                </div>

                                {/* Navigation */}
                                <nav className="flex-1 px-8 py-4 flex flex-col">
                                  {/* Primary group */}
                                  <ul className="flex flex-col">
                                    <li>
                                      <LocalizedClientLink
                                        href="/"
                                        className="flex items-center py-2 small:py-2.5 font-display text-[20px] small:text-[22px] leading-[1] tracking-[0.02em] text-[var(--theme-text)] transition-colors duration-200 hover:text-hunter-gold"
                                        onClick={handleNavigate}
                                      >
                                        {t("Acasă")}
                                      </LocalizedClientLink>
                                    </li>

                                    {/* Ready to Wear — Coming Soon, not expandable */}
                                    <MenuTrigger
                                      label={t("Ready to Wear")}
                                      onOpen={() => setActiveSubmenu("rtw")}
                                      badge={t("Coming Soon")}
                                      disabled
                                    />

                                    {/* Accesorii â†’ submeniu */}
                                    <MenuTrigger
                                      label={t("Accesorii")}
                                      onOpen={() =>
                                        setActiveSubmenu("accesorii")
                                      }
                                    />

                                    {/* Prima colecție din sortare → submeniu cu categorii */}
                                    {featuredCollection && (
                                      <MenuTrigger
                                        label={featuredCollection.title}
                                        onOpen={() =>
                                          setActiveSubmenu("featured")
                                        }
                                      />
                                    )}

                                    {/* World of The Hunter â†’ submeniu */}
                                    <MenuTrigger
                                      label={t("World of The Hunter")}
                                      onOpen={() => setActiveSubmenu("hunter")}
                                    />

                                    <li>
                                      <LocalizedClientLink
                                        href="/made-to-measure"
                                        className="flex items-center py-2 small:py-2.5 font-display text-[20px] small:text-[22px] leading-[1] tracking-[0.02em] text-[var(--theme-text)] transition-colors duration-200 hover:text-hunter-gold"
                                        onClick={handleNavigate}
                                      >
                                        {t("Made to Measure")}
                                      </LocalizedClientLink>
                                    </li>

                                    <li>
                                      <LocalizedClientLink
                                        href="/meridian"
                                        className="flex items-center py-2 small:py-2.5 font-display text-[20px] small:text-[22px] leading-[1] tracking-[0.02em] text-[var(--theme-text)] transition-colors duration-200 hover:text-hunter-gold"
                                        onClick={handleNavigate}
                                      >
                                        {t("The Hunter Meridian")}
                                      </LocalizedClientLink>
                                    </li>
                                  </ul>

                                  {/* Secondary links — bottom */}
                                  <ul className="flex flex-col mt-auto pt-10">
                                    {[
                                      { label: t("Profil"), href: "/profil" },
                                      { label: t("Contact"), href: "/contact" },
                                      {
                                        label: t("Wishlist"),
                                        href: "/wishlist",
                                      },
                                      {
                                        label: t("Relații cu clienții"),
                                        href: "/relatii-clienti",
                                      },
                                    ].map(({ label, href }) => (
                                      <li key={label}>
                                        <LocalizedClientLink
                                          href={href}
                                          className="flex items-center py-2 font-sans text-[15px] uppercase tracking-[3px] text-[var(--theme-text-muted)] transition-colors duration-200 hover:text-hunter-gold"
                                          onClick={handleNavigate}
                                        >
                                          {label}
                                        </LocalizedClientLink>
                                      </li>
                                    ))}
                                  </ul>
                                </nav>

                                {/* Footer */}
                                <div className="shrink-0 px-8 py-4 flex flex-col gap-y-4 border-t border-[var(--theme-border)]">
                                  {!!locales?.length && (
                                    <LanguageSelect
                                      locales={locales}
                                      currentLocale={resolvedLocale}
                                    />
                                  )}
                                </div>
                              </div>

                              {/* Flyout submenu — slides in from the right */}
                              <AnimatePresence>
                                {activeSubmenu && (
                                  <motion.div
                                    key={activeSubmenu}
                                    initial={{ x: "100%" }}
                                    animate={{ x: 0 }}
                                    exit={{ x: "100%" }}
                                    transition={{
                                      duration: 0.38,
                                      ease: [0.22, 1, 0.36, 1],
                                    }}
                                    className="absolute inset-0 z-10 bg-[var(--theme-bg)] shadow-2xl will-change-transform"
                                  >
                                    {activeSubmenu === "rtw" ? (
                                      <ReadyToWearSubmenu
                                        categories={categories ?? []}
                                        collections={otherCollections}
                                        onBack={() => setActiveSubmenu(null)}
                                        close={handleNavigate}
                                      />
                                    ) : activeSubmenu === "accesorii" ? (
                                      <AccesoriiSubmenu
                                        categories={categories ?? []}
                                        onBack={() => setActiveSubmenu(null)}
                                        close={handleNavigate}
                                      />
                                    ) : activeSubmenu === "featured" &&
                                      featuredCollection ? (
                                      <FeaturedCollectionSubmenu
                                        collection={featuredCollection}
                                        categories={categories ?? []}
                                        onBack={() => setActiveSubmenu(null)}
                                        close={handleNavigate}
                                      />
                                    ) : (
                                      <WorldOfTheHunterSubmenu
                                        onBack={() => setActiveSubmenu(null)}
                                        close={handleNavigate}
                                      />
                                    )}
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </PopoverPanel>
                          </motion.div>
                        </>
                      )}
                    </AnimatePresence>,
                    document.body,
                  )}
              </>
            )
          }}
        </Popover>
      </div>
    </div>
  )
}

export default SideMenu
