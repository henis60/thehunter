"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { useRecaptcha } from "@lib/hooks/use-recaptcha"
import { submitContactForm } from "@lib/data/public-forms"

const inputClass = (err?: boolean) =>
  `w-full h-10 bg-transparent border px-3 font-sans text-sm text-[var(--theme-text)] placeholder:text-[var(--theme-text-muted)] focus:outline-none transition-colors ${
    err ? "border-red-400/60" : "border-[var(--theme-border)] focus:border-hunter-gold/50"
  }`

const Label = ({ htmlFor, children, error }: { htmlFor: string; children: React.ReactNode; error?: boolean }) => (
  <label htmlFor={htmlFor} className="font-sans text-[10px] uppercase tracking-[3px] text-[var(--theme-text-muted)] mb-2 flex items-center gap-1">
    {children}
    <span className={`text-base normal-case tracking-normal transition-colors ${error ? "text-red-400/80" : "text-hunter-gold/50"}`}>*</span>
  </label>
)

type Status = "idle" | "loading" | "success" | "error"
type Errors = Partial<Record<"name" | "email" | "message", boolean>>

function validateEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
}

// enterKeyHint="next" only changes the mobile keyboard's label — tapping it
// still fires a plain Enter keypress, which submits the form by default.
// Move focus to the next field instead so "next" actually advances.
function focusNextOnEnter(e: React.KeyboardEvent<HTMLInputElement>) {
  if (e.key !== "Enter") return
  e.preventDefault()

  const form = e.currentTarget.form
  if (!form) return

  const fields = Array.from(
    form.querySelectorAll<HTMLElement>("input, select, textarea, button")
  ).filter((el) => !el.hasAttribute("disabled") && el.offsetParent !== null)

  const index = fields.indexOf(e.currentTarget)
  if (index !== -1 && index < fields.length - 1) {
    fields[index + 1].focus()
  }
}

export default function ContactForm() {
  const t = useTranslations("contact")
  const [status, setStatus] = useState<Status>("idle")
  const [errors, setErrors] = useState<Errors>({})
  const [errorMsg, setErrorMsg] = useState(
    t("Nu am putut trimite mesajul Verifică conexiunea și încearcă din nou")
  )
  const { preload, getToken } = useRecaptcha()

  const validate = (data: FormData): Errors => {
    const e: Errors = {}
    if (String(data.get("name") ?? "").trim().length < 2) e.name = true
    if (!validateEmail(String(data.get("email") ?? "").trim())) e.email = true
    if (String(data.get("message") ?? "").trim().length < 1) e.message = true
    return e
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    const data = new FormData(form)

    const errs = validate(data)
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      return
    }

    setErrors({})
    setStatus("loading")
    setErrorMsg(t("Nu am putut trimite mesajul Verifică conexiunea și încearcă din nou"))

    try {
      const recaptchaToken = await getToken("contact")
      if (!recaptchaToken) {
        setStatus("error")
        return
      }

      const res = await submitContactForm({
        name: String(data.get("name") ?? ""),
        email: String(data.get("email") ?? ""),
        message: String(data.get("message") ?? ""),
        type: "contact",
        recaptchaToken,
      })

      if (!res.success) {
        setErrorMsg(
          res.reason === "rate_limited"
            ? t("Prea multe încercări Te rugăm să revii peste câteva minute")
            : res.message ||
                t("Nu am putut trimite mesajul Verifică conexiunea și încearcă din nou")
        )
        setStatus("error")
        return
      }

      setStatus("success")
      form.reset()
    } catch {
      setStatus("error")
    }
  }

  if (status === "success") {
    return (
      <div className="border border-[var(--theme-border)] min-h-[200px] p-8 text-center flex flex-col gap-3 justify-center">
        <p className="font-display text-2xl text-[var(--theme-text)]">{t("Îți mulțumim!")}</p>
        <p className="font-sans text-sm text-[var(--theme-text-muted)]">
          {t("Mesajul tău a fost trimis Revenim în maximum 24 de ore în zilele lucrătoare")}
        </p>
        <button
          type="button"
          onClick={() => setStatus("idle")}
          className="mt-2 self-center h-11 px-8 font-sans text-[11px] uppercase tracking-[3px] bg-hunter-gold text-hunter-dark hover:opacity-90 transition-opacity"
        >
          {t("Trimite alt mesaj")}
        </button>
      </div>
    )
  }

  return (
    <>
      <form
        onSubmit={handleSubmit}
        onFocusCapture={preload}
        noValidate
        className="flex flex-col gap-4"
      >
        <div className="grid grid-cols-1 small:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="name" error={errors.name}>{t("Nume")}</Label>
            <input id="name" name="name" type="text" autoComplete="name" enterKeyHint="next" onKeyDown={focusNextOnEnter} onChange={() => errors.name && setErrors(prev => ({ ...prev, name: false }))} className={inputClass(errors.name)} />
          </div>
          <div>
            <Label htmlFor="email" error={errors.email}>{t("Email")}</Label>
            <input id="email" name="email" type="email" autoComplete="email" enterKeyHint="next" onKeyDown={focusNextOnEnter} onChange={() => errors.email && setErrors(prev => ({ ...prev, email: false }))} className={inputClass(errors.email)} />
          </div>
        </div>
        <div>
          <Label htmlFor="message" error={errors.message}>{t("Mesaj")}</Label>
          <textarea
            id="message"
            name="message"
            rows={4}
            onChange={() => errors.message && setErrors(prev => ({ ...prev, message: false }))}
            className={`w-full bg-transparent border px-3 py-3 font-sans text-sm text-[var(--theme-text)] placeholder:text-[var(--theme-text-muted)] focus:outline-none transition-colors resize-y ${
              errors.message ? "border-red-400/60" : "border-[var(--theme-border)] focus:border-hunter-gold/50"
            }`}
          />
        </div>

        {status === "error" && (
          <p className="font-sans text-xs text-red-400">{errorMsg}</p>
        )}

        <div className="flex flex-col gap-2">
          <button
            type="submit"
            disabled={status === "loading"}
            className="self-start h-11 px-8 font-sans text-[11px] uppercase tracking-[3px] bg-hunter-gold text-hunter-dark hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {status === "loading" ? t("Se trimite") : t("Trimite mesajul")}
          </button>
          <p className="font-sans text-[10px] text-[var(--theme-text-muted)] leading-relaxed">
            {t("Protejat de reCAPTCHA")}{" "}
            <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="underline hover:text-hunter-gold transition-colors">
              {t("Confidențialitate")}
            </a>{" "}
            &amp;{" "}
            <a href="https://policies.google.com/terms" target="_blank" rel="noopener noreferrer" className="underline hover:text-hunter-gold transition-colors">
              {t("Termeni")}
            </a>
          </p>
        </div>
      </form>
    </>
  )
}
