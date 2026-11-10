"use client"

import { useEffect, useRef, useState } from "react"
import { AnimatePresence, m as motion, useReducedMotion } from "framer-motion"
import { useTranslations } from "next-intl"
import AppointmentDatePicker from "@modules/programare/components/appointment-date-picker"
import { useRecaptcha } from "@lib/hooks/use-recaptcha"
import { useScrollLock } from "@lib/hooks/use-scroll-lock"
import { submitContactForm } from "@lib/data/public-forms"
import { isValidEmail, isValidPhone } from "@lib/util/validation"

const inputClass = (err?: boolean) =>
  `w-full h-10 bg-transparent border px-3 font-sans text-sm text-[var(--theme-text)] placeholder:text-[var(--theme-text-muted)] focus:outline-none transition-colors ${
    err
      ? "border-red-400/60"
      : "border-[var(--theme-border)] focus:border-hunter-gold/60"
  }`

const labelClass =
  "font-sans text-[11px] uppercase tracking-[3px] text-[var(--theme-text-muted)] mb-2 flex items-center gap-1"

const Label = ({
  htmlFor,
  children,
  error,
}: {
  htmlFor?: string
  children: React.ReactNode
  error?: boolean
}) => (
  <label htmlFor={htmlFor} className={labelClass}>
    {children}
    <span
      className={`text-sm normal-case tracking-normal transition-colors ${
        error ? "text-red-400/80" : "text-hunter-gold/50"
      }`}
    >
      *
    </span>
  </label>
)

type Status = "idle" | "loading" | "success" | "error"

export default function AppointmentModal({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const t = useTranslations("layout")
  const STEPS = [t("Data & Ora"), t("Contact")]
  // step 0 = intro, step 1 = Data & Ora, step 2 = Contact
  const [step, setStep] = useState(0)
  const [status, setStatus] = useState<Status>("idle")
  const [errorMsg, setErrorMsg] = useState(
    t("Nu am putut trimite cererea Încearcă din nou")
  )
  const { preload, getToken } = useRecaptcha()

  const [date, setDate] = useState("")
  const [time, setTime] = useState("")
  const [dateError, setDateError] = useState(false)

  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [message, setMessage] = useState("")
  const [errors, setErrors] = useState<Record<string, boolean>>({})

  const reset = () => {
    setStep(0)
    setStatus("idle")
    setDate("")
    setTime("")
    setDateError(false)
    setName("")
    setEmail("")
    setPhone("")
    setMessage("")
    setErrors({})
    setErrorMsg(t("Nu am putut trimite cererea Încearcă din nou"))
  }

  // A mis-aimed click on the backdrop (or the X button) just hides the
  // modal — it must not wipe a form the user may have spent a minute
  // filling in. Data only clears on an explicit fresh start (after a
  // successful submission).
  const handleDismiss = () => {
    onClose()
  }
  const handleCloseAfterSuccess = () => {
    reset()
    onClose()
  }

  useScrollLock(open)

  // Smooth height transitions: the content area animates to the measured
  // height of its inner wrapper whenever that changes (step switch, time
  // slots appearing, validation messages, …). Starts at "auto" so the
  // modal doesn't grow from 0 on open.
  // A spring (not a fixed-duration tween) so that when the target height
  // changes again mid-animation (calendar opening right after a step
  // switch, etc.) it continues from its current velocity instead of
  // restarting from rest — the restart is what made it look choppy. The
  // step indicator uses the same spring so the panel's two growing/shrinking
  // parts move in sync.
  const reduceMotion = useReducedMotion()
  const heightSpring = reduceMotion
    ? { duration: 0 }
    : { type: "spring" as const, stiffness: 320, damping: 36, mass: 0.9 }
  const contentRef = useRef<HTMLDivElement>(null)
  const [contentHeight, setContentHeight] = useState<number | "auto">("auto")
  const [resizing, setResizing] = useState(false)

  useEffect(() => {
    if (!open) {
      setContentHeight("auto")
      return
    }
    const el = contentRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      setContentHeight(el.getBoundingClientRect().height)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleDismiss()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const goTo = (next: number) => setStep(next)

  const nextStep = () => {
    if (step === 1) {
      if (!date) {
        setDateError(true)
        return
      }
      setDateError(false)
      goTo(2)
    }
  }

  const handleSubmit = async () => {
    const e: Record<string, boolean> = {}
    if (name.trim().length < 2) e.name = true
    if (!isValidEmail(email)) e.email = true
    if (!isValidPhone(phone)) e.phone = true
    if (message.trim().length < 2) e.message = true
    if (Object.keys(e).length) {
      setErrors(e)
      return
    }
    setErrors({})
    setStatus("loading")
    setErrorMsg(t("Nu am putut trimite cererea Încearcă din nou"))

    try {
      const recaptchaToken = await getToken("appointment")
      if (!recaptchaToken) {
        setStatus("error")
        return
      }

      const res = await submitContactForm({
        name,
        email,
        type: "appointment",
        recaptchaToken,
        message: [
          `${t("Telefon")}: ${phone || "—"}`,
          `${t("Data")}: ${date || "—"}${time ? ` ${t("la")} ${time}` : ""}`,
          "",
          message,
        ].join("\n"),
      })

      if (!res.success) {
        if (res.reason === "rate_limited") {
          setErrorMsg(
            t("Prea multe încercări Te rugăm să revii peste câteva minute")
          )
        }
        setStatus("error")
        return
      }
      setStatus("success")
    } catch {
      setStatus("error")
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[9020] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {/* Overlay */}
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={handleDismiss}
          />

          {/* Panel */}
          <motion.div
            className="relative z-10 w-full max-w-md max-h-[85vh] flex flex-col overflow-hidden bg-[var(--theme-bg)] border border-[var(--theme-border)] shadow-2xl"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            onFocusCapture={preload}
            role="dialog"
            aria-modal="true"
            aria-labelledby="appointment-modal-title"
          >
            {/* Header */}
            <div className="shrink-0 flex items-center justify-between px-6 pt-5 pb-4 border-b border-[var(--theme-border)]">
              <div>
                <p className="font-sans text-[11px] uppercase tracking-[3px] text-hunter-gold/70 mb-0.5">
                  {t("The Hunter House")}
                </p>
                <h2
                  id="appointment-modal-title"
                  className="font-display text-lg text-[var(--theme-text)]"
                >
                  {t("Consultanță Made to Measure")}
                </h2>
              </div>
              <button
                onClick={handleDismiss}
                className="w-7 h-7 flex items-center justify-center text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] transition-colors cursor-pointer"
                aria-label={t("Închide")}
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path
                    d="M1 1L11 11M11 1L1 11"
                    stroke="currentColor"
                    strokeWidth="1.2"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>

            {/* Step indicator */}
            {status !== "success" && (
              <motion.div
                className="shrink-0 overflow-hidden"
                initial={false}
                animate={{
                  height: step === 0 ? 0 : "auto",
                  opacity: step === 0 ? 0 : 1,
                }}
                transition={heightSpring}
              >
                <div className="flex border-b border-[var(--theme-border)]">
                  {STEPS.map((label, i) => {
                    const n = i + 1
                    const active = step === n
                    const done = step > n
                    return (
                      <div
                        key={n}
                        onClick={() => done && goTo(n)}
                        className={`flex-1 flex items-center justify-center py-3 border-b-2 transition-colors ${
                          active
                            ? "border-hunter-gold"
                            : done
                            ? "border-hunter-gold/30 cursor-pointer hover:border-hunter-gold/60"
                            : "border-transparent"
                        }`}
                      >
                        <span
                          className={`font-sans text-[11px] uppercase tracking-[2px] transition-colors ${
                            active
                              ? "text-[var(--theme-text)]"
                              : done
                              ? "text-[var(--theme-text-muted)]"
                              : "text-[var(--theme-text-muted)] opacity-50"
                          }`}
                        >
                          {label}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </motion.div>
            )}

            {/* Content */}
            <motion.div
              className={`min-h-0 ${
                resizing ? "overflow-hidden" : "overflow-y-auto"
              }`}
              initial={false}
              animate={{ height: contentHeight }}
              transition={heightSpring}
              onAnimationStart={() => setResizing(true)}
              onAnimationComplete={() => setResizing(false)}
            >
              <div ref={contentRef} className="px-6 py-5">
                <motion.div
                  key={status === "success" ? "success" : step}
                  initial={reduceMotion ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.25, delay: 0.05 }}
                >
                  {status === "success" ? (
                    <div
                      key="success"
                      className="text-center py-6 flex flex-col items-center gap-3"
                    >
                      <div className="w-10 h-10 rounded-full border border-hunter-gold/40 flex items-center justify-center mb-2">
                        <svg
                          width="16"
                          height="12"
                          viewBox="0 0 16 12"
                          fill="none"
                        >
                          <path
                            d="M1 6L6 11L15 1"
                            stroke="rgba(201,168,76,0.8)"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </div>
                      <p className="font-display text-xl text-[var(--theme-text)]">
                        {t("Cerere trimisă!")}
                      </p>
                      <p className="font-sans text-sm text-[var(--theme-text-muted)]">
                        {t(
                          "Te contactăm în maximum 24 de ore pentru a confirma programarea"
                        )}
                      </p>
                      <button
                        onClick={handleCloseAfterSuccess}
                        className="mt-2 h-11 w-100 px-8 font-sans text-[13px] uppercase tracking-[3px] border border-[var(--theme-border)] text-[var(--theme-text-muted)] hover:border-hunter-gold hover:text-hunter-gold transition-colors cursor-pointer"
                      >
                        {t("Închide")}
                      </button>
                    </div>
                  ) : step === 0 ? (
                    <div key="intro" className="flex flex-col gap-5 py-2">
                      <p className="font-sans text-sm text-[var(--theme-text-muted)] leading-relaxed">
                        {t(
                          "O întâlnire personalizată în care discutăm despre stilul tău, alegem materialele potrivite și definim fiecare detaliu al costumului dorit Te ghidăm în procesul de creare a unei ținute realizate special pentru tine"
                        )}
                      </p>
                      <div className="flex flex-col gap-2.5 border-t border-[var(--theme-border)] pt-4">
                        {[
                          t(
                            "Alegerea materialelor și a detaliilor potrivite stilului tău"
                          ),
                          t("Măsurători precise pentru o potrivire impecabilă"),
                          t("Recomandări de croială și personalizare"),
                          t(
                            "Crearea unei ținute unice, realizate special pentru tine"
                          ),
                        ].map((item) => (
                          <div key={item} className="flex items-start gap-2.5">
                            <span className="mt-[6px] shrink-0 w-1 h-1 rounded-full bg-hunter-gold/50" />
                            <p className="font-sans text-[14px] text-[var(--theme-text-muted)] leading-relaxed">
                              {item}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : step === 1 ? (
                    <div key="step1">
                      <AppointmentDatePicker
                        inline
                        hasError={dateError}
                        initialDate={date}
                        initialTime={time}
                        onSelect={(d, t) => {
                          setDate(d)
                          setTime(t)
                          setDateError(false)
                        }}
                      />
                    </div>
                  ) : (
                    <div key="step2" className="flex flex-col gap-3">
                      <div className="flex flex-col gap-3">
                        <div>
                          <Label htmlFor="m-name" error={errors.name}>
                            {t("Nume")}
                          </Label>
                          <input
                            id="m-name"
                            type="text"
                            autoComplete="name"
                            enterKeyHint="next"
                            value={name}
                            onChange={(e) => {
                              setName(e.target.value)
                              if (errors.name)
                                setErrors((prev) => ({ ...prev, name: false }))
                            }}
                            className={inputClass(errors.name)}
                          />
                        </div>
                        <div>
                          <Label htmlFor="m-email" error={errors.email}>
                            {t("Email")}
                          </Label>
                          <input
                            id="m-email"
                            type="email"
                            autoComplete="email"
                            enterKeyHint="next"
                            value={email}
                            onChange={(e) => {
                              setEmail(e.target.value)
                              if (errors.email)
                                setErrors((prev) => ({ ...prev, email: false }))
                            }}
                            className={inputClass(errors.email)}
                          />
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="m-phone" error={errors.phone}>
                          {t("Telefon")}
                        </Label>
                        <input
                          id="m-phone"
                          type="tel"
                          inputMode="tel"
                          autoComplete="tel"
                          enterKeyHint="next"
                          value={phone}
                          onChange={(e) => {
                            setPhone(e.target.value)
                            if (errors.phone)
                              setErrors((prev) => ({ ...prev, phone: false }))
                          }}
                          className={inputClass(errors.phone)}
                        />
                      </div>
                      <div>
                        <Label htmlFor="m-message" error={errors.message}>
                          {t("Mesaj")}
                        </Label>
                        <textarea
                          id="m-message"
                          rows={3}
                          value={message}
                          onChange={(e) => {
                            setMessage(e.target.value)
                            if (errors.message)
                              setErrors((prev) => ({ ...prev, message: false }))
                          }}
                          className={`w-full bg-transparent border px-3 py-2.5 font-sans text-sm text-[var(--theme-text)] placeholder:text-[var(--theme-text-muted)] focus:outline-none transition-colors resize-none ${
                            errors.message
                              ? "border-red-400/60"
                              : "border-[var(--theme-border)] focus:border-hunter-gold/60"
                          }`}
                        />
                      </div>
                      {status === "error" && (
                        <p className="font-sans text-xs text-red-400">
                          {errorMsg}
                        </p>
                      )}
                    </div>
                  )}
                </motion.div>
              </div>
            </motion.div>

            {/* Footer nav */}
            {status !== "success" && (
              <div className="shrink-0 px-6 pb-5 pt-1">
                {step === 0 ? (
                  <button
                    onClick={() => goTo(1)}
                    className="w-full h-9 font-sans text-[11px] uppercase tracking-[3px] bg-hunter-gold text-hunter-dark hover:opacity-90 transition-opacity cursor-pointer"
                  >
                    {t("Începe programarea")}
                  </button>
                ) : step === 1 ? (
                  <button
                    onClick={nextStep}
                    className="w-full h-9 font-sans text-[11px] uppercase tracking-[3px] bg-hunter-gold text-hunter-dark hover:opacity-90 transition-opacity cursor-pointer"
                  >
                    {t("Continuă")}
                  </button>
                ) : (
                  <button
                    onClick={handleSubmit}
                    disabled={status === "loading"}
                    className="w-full h-9 font-sans text-[11px] uppercase tracking-[3px] bg-hunter-gold text-hunter-dark hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer"
                  >
                    {status === "loading"
                      ? t("Se trimite")
                      : t("Trimite cererea")}
                  </button>
                )}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
