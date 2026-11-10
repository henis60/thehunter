"use client"

import { useTranslations } from "next-intl"
import Image from "next/image"

import LocalizedClientLink from "@modules/common/components/localized-client-link"

const COLUMN_1: { href: string; label: string }[] = [
  { href: "/contact", label: "Contact" },
  { href: "/faq", label: "Întrebări frecvente" },
  { href: "/relatii-clienti", label: "Relații cu clienții" },
]

const COLUMN_2: { href: string; label: string }[] = [
  { href: "/terms-of-use", label: "Termeni și condiții" },
  { href: "/privacy-policy", label: "Politica de confidențialitate" },
  { href: "/cookie-policy", label: "Politica de cookies" },
]

function FooterLink({
  href,
  children,
}: {
  href: string
  children: React.ReactNode
}) {
  return (
    <LocalizedClientLink
      href={href}
      className="font-serif text-[17px] leading-none text-[rgba(232,213,163,0.75)] hover:text-hunter-gold transition-colors w-fit inline-block py-3"
    >
      {children}
    </LocalizedClientLink>
  )
}

export default function HomepageFooter() {
  const t = useTranslations("home")
  return (
    <footer className="w-full bg-[#0D0D0D] border-t border-[rgba(201,168,76,0.15)]">
      <div className="content-container flex flex-col gap-6 pt-8 pb-4">
        <div className="grid grid-cols-1 xsmall:grid-cols-3 gap-x-8 gap-y-6">
          <nav className="flex flex-col items-center gap-0 xsmall:items-start">
            {COLUMN_1.map((link) => (
              <FooterLink key={link.href} href={link.href}>
                {t(link.label)}
              </FooterLink>
            ))}
          </nav>

          <nav className="flex flex-col items-center gap-0 xsmall:items-start">
            {COLUMN_2.map((link) => (
              <FooterLink key={link.href} href={link.href}>
                {t(link.label)}
              </FooterLink>
            ))}
          </nav>

          <div className="flex flex-wrap items-center justify-center gap-5 xsmall:justify-end">
            {/* Netopia partner brand requirement: payment badge — brand
                manual explicitly forbids recoloring/altering the logo
                ("A nu fi folosite alte culori pentru logotip sau părți ale
                acestuia"), so no grayscale/opacity treatment here. Footer bg
                is fixed dark (#0D0D0D, not theme-aware), so always use the
                dark/white-text variant. `fill` + object-contain in a
                fixed-size box avoids relying on width/height math to keep
                the aspect ratio correct. */}
            <div className="relative h-7 w-[148px]">
              <Image
                src="/payments/netopia-badge-dark.png"
                alt="Plăți securizate cu Netopia Payments"
                fill
                className="object-contain object-left"
              />
            </div>
            {/* Legally required (OUG/ANPC ADR regulation): SAL
                dispute-resolution pictogram on the homepage, linking
                externally to the ANPC SAL platform. Legal spec (Art. 2)
                mandates this pictogram at 250x50px — kept at the asset's
                full native height (50px) rather than shrunk for aesthetics. */}
            <a
              href="https://reclamatiisal.anpc.ro"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Soluționarea Alternativă a Litigiilor - ANPC"
            >
              <Image
                src="/payments/anpc-sal-pictograma.png"
                alt="ANPC - Soluționarea Alternativă a Litigiilor"
                width={201}
                height={50}
                className="h-[50px] w-auto"
              />
            </a>
          </div>
        </div>

        <div className="flex flex-col small:flex-row items-center justify-between gap-2 pt-3 border-t border-[rgba(201,168,76,0.1)]">
          <div className="flex flex-wrap items-baseline justify-center gap-x-2 whitespace-nowrap">
            <LocalizedClientLink
              href="/"
              className="font-display text-sm tracking-[0.12em] flex items-baseline gap-1.5"
            >
              <span className="text-[#E8D5A3] uppercase">The Hunter</span>
              <span className="italic text-hunter-gold uppercase">house</span>
            </LocalizedClientLink>
            <span className="font-serif italic text-xs text-hunter-gold/70">
              — {t("Return of the Elegant Gentleman")}
            </span>
          </div>

          <span className="font-sans text-[11px] uppercase tracking-[3px] text-[rgba(232,213,163,0.6)]">
            © {new Date().getFullYear()} {t("Toate drepturile rezervate")}
          </span>
        </div>
      </div>
    </footer>
  )
}
