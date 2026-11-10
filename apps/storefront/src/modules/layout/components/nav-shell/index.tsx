"use client"

import { usePathname } from "@i18n/navigation"
import { useEffect, useState } from "react"

const NavShell = ({ children }: { children: React.ReactNode }) => {
  const pathname = usePathname()
  const segments = pathname?.split("/").filter(Boolean) ?? []
  const isMeridian = segments[0] === "meridian"
  // The Meridian landing page gets the same transparent-over-hero treatment
  // as the true homepage — it has its own full-bleed dark hero directly
  // under the nav, so an opaque chrome background would clash with it.
  const isLanding = segments.length === 0 || isMeridian
  // Meridian gets the same hide-until-scroll logo treatment as the true
  // homepage, since it also has its own full-bleed hero directly under nav.
  const hideLogoUntilScroll = segments.length === 0 || isMeridian

  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  return (
    <div className="sticky top-0 inset-x-0 z-[9001] group">
      <header
        className={
          "relative h-16 mx-auto transition-all duration-300 border-b " +
          (isLanding
            ? scrolled
              ? "bg-black/30 backdrop-blur-md border-white/10 text-white"
              : "bg-transparent border-transparent text-white" +
                (hideLogoUntilScroll ? " nav-at-hero" : "")
            : "bg-[var(--theme-chrome)] border-[var(--theme-border)] dark:border-hunter-gold/20 text-[var(--theme-text)]")
        }
      >
        <nav className="content-container flex items-center justify-between w-full h-full font-sans text-[12px] uppercase tracking-[3px]">
          {children}
        </nav>
      </header>
    </div>
  )
}

export default NavShell
