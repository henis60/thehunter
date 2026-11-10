"use client"

import { AnimatePresence, m as motion } from "framer-motion"
import { useTranslations } from "next-intl"
import { useEffect, useRef, useState } from "react"

const DAYS_LABEL = ["Lu", "Ma", "Mi", "Jo", "Vi", "Sâ", "Du"]
const MONTHS_RO = [
  "Ianuarie", "Februarie", "Martie", "Aprilie", "Mai", "Iunie",
  "Iulie", "August", "Septembrie", "Octombrie", "Noiembrie", "Decembrie",
]

function firstDayOffset(year: number, month: number) {
  const d = new Date(year, month, 1).getDay()
  return d === 0 ? 6 : d - 1
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function getSlots(date: Date, now: Date): string[] {
  const day = date.getDay()
  if (day === 0) return []
  const isWeekend = day === 6
  const startH = isWeekend ? 9 : 7
  const lastH = isWeekend ? 13 : 17
  // Same-day booking must not offer hours that have already passed —
  // without this a customer picking "today" at 4pm could still submit a
  // 07:00 slot.
  const earliestH = isSameDay(date, now) ? now.getHours() + 1 : startH
  const slots: string[] = []
  for (let h = Math.max(startH, earliestH); h <= lastH; h++) {
    slots.push(`${String(h).padStart(2, "0")}:00`)
  }
  return slots
}

const labelClass = "font-sans text-[11px] uppercase tracking-[3px] text-[var(--theme-text-muted)] mb-2 flex items-center gap-1"
const inputBase = "w-full h-10 bg-transparent border border-[var(--theme-border)] px-3 font-sans text-sm focus:outline-none transition-colors"
const dropUpBase =
  "absolute bottom-full mb-1 z-[9025] left-0 w-[272px] bg-white border border-gray-200 shadow-xl"
const inlineBase = "mt-2 w-full bg-white border border-gray-200"

// Parses the "DD.MM.YYYY" strings this component emits back into a Date.
function parseInitialDate(value?: string): Date | null {
  if (!value) return null
  const [day, month, year] = value.split(".").map(Number)
  if (!day || !month || !year) return null
  const d = new Date(year, month - 1, day)
  return Number.isNaN(d.getTime()) ? null : d
}

export default function AppointmentDatePicker({
  hasError,
  onSelect,
  inline = false,
  initialDate,
  initialTime,
}: {
  hasError?: boolean
  onSelect?: (date: string, time: string) => void
  // In the appointment modal the panel clips absolutely-positioned
  // dropdowns (overflow-hidden + scroll area), so the pickers render
  // in-flow there and push the content instead.
  inline?: boolean
  // Lets the parent restore a previous selection when this component
  // remounts (e.g. navigating back to this step after it was unmounted).
  initialDate?: string
  initialTime?: string
}) {
  const t = useTranslations("programare")
  const now = new Date()
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)

  const parsedInitialDate = parseInitialDate(initialDate)

  const [calOpen, setCalOpen] = useState(false)
  const [timeOpen, setTimeOpen] = useState(false)
  const [viewYear, setViewYear] = useState(parsedInitialDate?.getFullYear() ?? today.getFullYear())
  const [viewMonth, setViewMonth] = useState(parsedInitialDate?.getMonth() ?? today.getMonth())
  const [selectedDate, setSelectedDate] = useState<Date | null>(parsedInitialDate)
  const [selectedTime, setSelectedTime] = useState(initialTime ?? "")

  const calRef = useRef<HTMLDivElement>(null)
  const timeRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (calRef.current && !calRef.current.contains(e.target as Node)) setCalOpen(false)
      if (timeRef.current && !timeRef.current.contains(e.target as Node)) setTimeOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  const hiddenDate = selectedDate
    ? `${String(selectedDate.getDate()).padStart(2, "0")}.${String(selectedDate.getMonth() + 1).padStart(2, "0")}.${selectedDate.getFullYear()}`
    : ""

  const dateDisplay = selectedDate
    ? `${String(selectedDate.getDate()).padStart(2, "0")}.${String(selectedDate.getMonth() + 1).padStart(2, "0")}.${selectedDate.getFullYear()}`
    : ""

  const offset = firstDayOffset(viewYear, viewMonth)
  const days = daysInMonth(viewYear, viewMonth)
  const slots = selectedDate ? getSlots(selectedDate, now) : []

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1) }
    else setViewMonth((m) => m - 1)
  }
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1) }
    else setViewMonth((m) => m + 1)
  }

  const selectDay = (day: number) => {
    const d = new Date(viewYear, viewMonth, day)
    setSelectedDate(d)
    setSelectedTime("")
    setCalOpen(false)
    // reset time if day changes
    onSelect?.(
      `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`,
      ""
    )
  }

  const isDisabled = (day: number) => {
    const d = new Date(viewYear, viewMonth, day)
    if (d < today || d.getDay() === 0) return true
    // Today stays enabled by the date check above even after closing time —
    // without this, a customer could still pick "today" once every slot has
    // already passed and submit an appointment for no actual hour.
    if (isSameDay(d, now) && getSlots(d, now).length === 0) return true
    return false
  }

  const isSelected = (day: number) =>
    !!selectedDate &&
    selectedDate.getFullYear() === viewYear &&
    selectedDate.getMonth() === viewMonth &&
    selectedDate.getDate() === day

  const isToday = (day: number) =>
    new Date(viewYear, viewMonth, day).getTime() === today.getTime()

  return (
    <div className="flex flex-col gap-3">
      <input type="hidden" name="date" value={hiddenDate} />
      <input type="hidden" name="time" value={selectedTime} />

      {/* ── Data ── */}
      <div ref={calRef} className="relative w-full">
        <label className={labelClass}>
          {t("Data")}
          <span className={`text-sm normal-case tracking-normal ${hasError && !selectedDate ? "text-red-400/80" : "text-hunter-gold/50"}`}>*</span>
        </label>
        <button
          type="button"
          onClick={() => { setCalOpen((o) => !o); setTimeOpen(false) }}
          className={`${inputBase} flex items-center justify-between cursor-pointer ${hasError && !selectedDate ? "border-red-400/60" : "border-[var(--theme-border)] focus:border-hunter-gold/50"}`}
        >
          <span className={dateDisplay ? "text-[var(--theme-text)]" : "text-[var(--theme-text-muted)] text-sm"}>
            {dateDisplay || t("Alege data")}
          </span>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--theme-text-muted)] shrink-0">
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
        </button>

        <AnimatePresence>
          {calOpen && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
              className={inline ? inlineBase : dropUpBase}
            >
              {/* Month nav */}
              <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-100">
                <button type="button" onClick={prevMonth} className="p-1 text-gray-400 hover:text-gray-700 transition-colors">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="15 18 9 12 15 6" />
                  </svg>
                </button>
                <span className="font-sans text-[12px] uppercase tracking-[3px] text-gray-800">
                  {t(MONTHS_RO[viewMonth])} {viewYear}
                </span>
                <button type="button" onClick={nextMonth} className="p-1 text-gray-400 hover:text-gray-700 transition-colors">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>
              </div>

              {/* Grid */}
              <div className="px-2.5 pt-2.5 pb-2">
                <div className="grid grid-cols-7 mb-1">
                  {DAYS_LABEL.map((d) => (
                    <div key={d} className="text-center font-sans text-[11px] uppercase tracking-[1px] text-gray-400 py-1">{t(d)}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-0.5">
                  {Array.from({ length: offset }).map((_, i) => <div key={`e${i}`} />)}
                  {Array.from({ length: days }, (_, i) => i + 1).map((day) => {
                    const disabled = isDisabled(day)
                    const selected = isSelected(day)
                    const tod = isToday(day)
                    return (
                      <button
                        key={day}
                        type="button"
                        disabled={disabled}
                        onClick={() => selectDay(day)}
                        className={[
                          "h-7 w-full font-sans text-[13px] transition-colors",
                          disabled ? "text-gray-300 cursor-not-allowed" : "hover:bg-gray-50 cursor-pointer text-gray-800",
                          selected ? "!bg-hunter-gold !text-hunter-dark font-medium" : "",
                          tod && !selected ? "underline decoration-hunter-gold decoration-1 underline-offset-2" : "",
                        ].join(" ")}
                      >
                        {day}
                      </button>
                    )
                  })}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Ora ── */}
      <div ref={timeRef} className="relative w-full">
        <label className={labelClass}>
          {t("Ora")}
          <span className="normal-case tracking-normal text-[var(--theme-text-muted)]/60">
            {t("(opțional)")}
          </span>
        </label>
        <button
          type="button"
          disabled={!selectedDate || slots.length === 0}
          onClick={() => setTimeOpen((o) => !o)}
          className={`${inputBase} flex items-center justify-between cursor-pointer ${
            !selectedDate || slots.length === 0
              ? "opacity-40 cursor-not-allowed border-[var(--theme-border)]"
              : hasError && !selectedTime
              ? "border-red-400/60"
              : "border-[var(--theme-border)] focus:border-hunter-gold/50"
          }`}
        >
          <span className={selectedTime ? "text-[var(--theme-text)]" : "text-[var(--theme-text-muted)] text-sm"}>
            {selectedTime || "—"}
          </span>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--theme-text-muted)] shrink-0">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        </button>

        <AnimatePresence>
          {timeOpen && selectedDate && slots.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
              className={`${inline ? inlineBase : dropUpBase} p-2`}
            >
              <div className="grid grid-cols-5 gap-1">
                {slots.map((slot) => (
                  <button
                    key={slot}
                    type="button"
                    onClick={() => {
                      setSelectedTime(slot)
                      setTimeOpen(false)
                      onSelect?.(hiddenDate, slot)
                    }}
                    className={[
                      "h-7 w-full font-sans text-[13px] border transition-colors",
                      selectedTime === slot
                        ? "border-hunter-gold bg-hunter-gold text-hunter-dark"
                        : "border-gray-200 text-gray-700 hover:border-hunter-gold/60",
                    ].join(" ")}
                  >
                    {slot}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
