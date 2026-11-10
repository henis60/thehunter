"use client"

import { useEffect, useRef, useState } from "react"
import { m as motion, useMotionValue, animate } from "framer-motion"
import { useTranslations } from "next-intl"

type Props = {
  transparent?: boolean
  hideOnTop?: boolean
  onClick?: () => void
}

// Legacy key for the dragged position, which used to persist across visits.
// It deliberately isn't written any more — the button now resets to its
// default docked position (right edge, default border sides) on every
// refresh, so a position dragged in one session can't carry over and leave
// the button somewhere unexpected with its border omitted on the wrong side.
// Still read once on mount purely to delete stale values from devices that
// saved one under the old behaviour.
const LEGACY_POSITION_KEY = "hunter_appt_btn_pos"
// Vertical-only: keeps the button clear of the header/footer edges of the
// screen. Horizontal snapping is deliberately flush (0) — the button's
// border is drawn with one side omitted (see dockSide below), on the
// assumption it sits flush against the screen edge with no gap to reveal
// the missing side.
const EDGE_MARGIN = 8
// The sticky header (nav-shell) is h-16 (64px) and always on top (z-[9001])
// — the button must never come to rest underneath/behind it.
const HEADER_EXCLUSION = 64 + EDGE_MARGIN

export default function AppointmentButton({ transparent, hideOnTop, onClick }: Props) {
  const t = useTranslations("layout")
  const [scrolled, setScrolled] = useState(false)
  const [isScrolling, setIsScrolling] = useState(false)
  // Drag-to-reposition is a touch/mobile affordance — desktop keeps the
  // fixed vertical tab on the right edge, unaffected by any of this.
  const [isMobile, setIsMobile] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const dragX = useMotionValue(0)
  const dragY = useMotionValue(0)
  const wasDragged = useRef(false)
  // Which edge the button is currently docked to — the border is drawn with
  // one side omitted (flush against the screen edge), so this has to flip
  // along with the snap or the omitted side ends up on the wrong side.
  const [dockSide, setDockSide] = useState<"left" | "right">("right")

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)")
    const update = () => setIsMobile(mq.matches)
    update()
    mq.addEventListener("change", update)
    return () => mq.removeEventListener("change", update)
  }, [])

  // Drop any position saved by the previous (persisting) behaviour, so it
  // can't be resurrected later. Nothing is restored — the button starts from
  // its default dock/border state on every load, by design.
  useEffect(() => {
    try {
      localStorage.removeItem(LEGACY_POSITION_KEY)
    } catch {}
  }, [])

  // Snaps the button to whichever screen edge (left/right) it's closest to
  // once dropped, and clamps its vertical position to stay fully on-screen —
  // a free-floating x/y would let it get dragged half off the viewport or
  // stranded mid-screen, which reads as broken rather than "positionable".
  const snapToEdge = () => {
    const el = containerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const goRight = rect.left + rect.width / 2 > window.innerWidth / 2
    // Flush against the edge (0), not EDGE_MARGIN — the button's border
    // omits whichever side faces the edge, on the assumption there's no gap
    // to reveal it. It used to stop EDGE_MARGIN short of the true edge,
    // which read as "doesn't snap exactly to the edge".
    const targetLeft = goRight ? window.innerWidth - rect.width : 0
    const minTop = HEADER_EXCLUSION
    const maxTop = window.innerHeight - rect.height - EDGE_MARGIN
    const targetTop = Math.min(Math.max(rect.top, minTop), maxTop)

    // rect is in viewport coordinates; dragX/dragY are the transform already
    // applied on top of the element's untransformed (base) position — so the
    // base is rect minus the current transform, and the new transform is
    // just the delta from base to the snapped target.
    const baseLeft = rect.left - dragX.get()
    const baseTop = rect.top - dragY.get()
    const nextX = targetLeft - baseLeft
    const nextY = targetTop - baseTop

    animate(dragX, nextX, { type: "spring", stiffness: 420, damping: 34 })
    animate(dragY, nextY, { type: "spring", stiffness: 420, damping: 34 })
    setDockSide(goRight ? "right" : "left")
  }

  useEffect(() => {
    if (!hideOnTop) return
    const onScroll = () => setScrolled(window.scrollY > 80)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [hideOnTop])

  // Keep the golden border sweep animating while the page is being scrolled
  // (stops ~250ms after the last scroll event).
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | null = null
    const onScroll = () => {
      setIsScrolling(true)
      if (timeout) clearTimeout(timeout)
      timeout = setTimeout(() => setIsScrolling(false), 250)
    }
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => {
      window.removeEventListener("scroll", onScroll)
      if (timeout) clearTimeout(timeout)
    }
  }, [])

  const visible = !hideOnTop || scrolled

  const handleClick = () => {
    // A drag gesture ends with a native click firing on release — swallow
    // that one so dropping the button doesn't also open the modal.
    if (wasDragged.current) {
      wasDragged.current = false
      return
    }
    onClick?.()
  }

  return (
    <motion.div
      ref={containerRef}
      className={`fixed right-0 z-40 bottom-[160px] translate-y-0 small:bottom-auto small:top-[72%] small:-translate-y-1/2 ${
        isMobile ? "touch-none" : ""
      }`}
      drag={isMobile}
      dragMomentum={false}
      dragElastic={0.15}
      onDragStart={() => {
        wasDragged.current = true
      }}
      onDragEnd={snapToEdge}
      animate={{ opacity: visible ? 1 : 0, ...(isMobile ? {} : { x: visible ? 0 : 12 }) }}
      whileHover={isMobile ? undefined : { x: -5 }}
      whileDrag={{ scale: 1.08 }}
      whileTap={{ scale: 0.92 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      style={
        {
          pointerEvents: visible ? "auto" : "none",
          x: dragX,
          y: dragY,
        } as any
      }
    >
      <button
        onClick={handleClick}
        className={`flex transition-colors cursor-pointer border-y ${
          // The edge-facing side omits its border (flush against the screen
          // edge); the inner-facing side keeps it, mirroring when docked left.
          dockSide === "left" ? "border-r" : "border-l"
        } ${
          transparent
            ? "bg-transparent border-white/20 text-white/60 hover:text-hunter-gold hover:border-hunter-gold/60"
            : "bg-[var(--theme-bg)] border-[var(--theme-border)] text-[var(--theme-text-muted)] hover:text-hunter-gold hover:border-hunter-gold"
        }`}
        aria-label={t("Programare")}
      >
        <span
          className={`appt-ping absolute inset-0 pointer-events-none ${
            isScrolling ? "appt-ping--scrolling" : ""
          }`}
          aria-hidden="true"
        />

        {/* Mobile: icon */}
        <span className="flex small:hidden items-center justify-center w-9 h-9">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
        </span>

        {/* Desktop: text vertical */}
        <span className="hidden small:flex items-center justify-center font-sans text-[11px] uppercase tracking-[4px] py-5 px-2.5 [writing-mode:vertical-rl] rotate-180">
          {t("Programare")}
        </span>
      </button>
    </motion.div>
  )
}
