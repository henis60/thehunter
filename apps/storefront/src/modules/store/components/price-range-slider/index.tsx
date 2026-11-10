"use client"

import { useEffect, useState } from "react"
import { clx } from "@modules/common/components/ui"

const thumbClass =
  "[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-hunter-gold [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:shadow-sm [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-hunter-gold [&::-moz-range-thumb]:border-0"

export default function PriceRangeSlider({
  bounds,
  value,
  onCommit,
}: {
  bounds: [number, number]
  value: [number, number]
  onCommit: (v: [number, number]) => void
}) {
  const [min, max] = bounds
  // Truly nothing to filter on (empty category, or nothing priced yet) —
  // still shown, just inert, rather than the whole section disappearing.
  const disabled = max <= 0
  // Every matching product shares the same price: still a real, usable
  // filter (0 up to that price), not "no range" — only the totally empty
  // case above is disabled.
  const singlePrice = !disabled && max === min
  const [lo, setLo] = useState(value[0])
  const [hi, setHi] = useState(value[1])

  useEffect(() => {
    setLo(value[0])
    setHi(value[1])
  }, [value[0], value[1]])

  const sliderMin = disabled ? 0 : singlePrice ? 0 : min
  const sliderMax = disabled ? 1 : max
  const loValue = disabled ? sliderMin : lo
  const hiValue = disabled ? sliderMax : hi

  const pct = (v: number) => ((v - sliderMin) / (sliderMax - sliderMin)) * 100

  return (
    <div className={clx("pt-1", disabled && "opacity-40")}>
      <div className="relative h-5 flex items-center">
        <div className="absolute left-0 right-0 h-[3px] bg-[var(--theme-border)] rounded-full" />
        <div
          className="absolute h-[3px] bg-hunter-gold rounded-full"
          style={{ left: `${pct(loValue)}%`, right: `${100 - pct(hiValue)}%` }}
        />
        <input
          type="range"
          disabled={disabled}
          min={sliderMin}
          max={sliderMax}
          value={loValue}
          aria-label="Preț minim"
          onChange={(e) => setLo(Math.min(Number(e.target.value), hi))}
          onMouseUp={() => onCommit([lo, hi])}
          onTouchEnd={() => onCommit([lo, hi])}
          onKeyUp={() => onCommit([lo, hi])}
          onBlur={() => onCommit([lo, hi])}
          className={clx(
            "absolute w-full h-5 appearance-none bg-transparent pointer-events-none disabled:pointer-events-none",
            thumbClass
          )}
        />
        <input
          type="range"
          disabled={disabled}
          min={sliderMin}
          max={sliderMax}
          value={hiValue}
          aria-label="Preț maxim"
          onChange={(e) => setHi(Math.max(Number(e.target.value), lo))}
          onMouseUp={() => onCommit([lo, hi])}
          onTouchEnd={() => onCommit([lo, hi])}
          onKeyUp={() => onCommit([lo, hi])}
          onBlur={() => onCommit([lo, hi])}
          className={clx(
            "absolute w-full h-5 appearance-none bg-transparent pointer-events-none disabled:pointer-events-none",
            thumbClass
          )}
        />
      </div>
      <div className="flex justify-between mt-1.5 font-sans text-[13px] text-[var(--theme-text-muted)]">
        <span>{loValue} LEI</span>
        <span>{hiValue} LEI</span>
      </div>
    </div>
  )
}
