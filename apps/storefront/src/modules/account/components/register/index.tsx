"use client"

import { useTranslations } from "next-intl"
import { startTransition, useActionState, useState } from "react"
import Input from "@modules/common/components/input"
import { LOGIN_VIEW } from "@modules/account/templates/login-template"
import ErrorMessage from "@modules/checkout/components/error-message"
import { SubmitButton } from "@modules/checkout/components/submit-button"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { signup } from "@lib/data/customer"
import { useRecaptcha } from "@lib/hooks/use-recaptcha"

type Props = {
  setCurrentView: (view: LOGIN_VIEW) => void
}

const Register = ({ setCurrentView }: Props) => {
  const t = useTranslations("account")
  const [message, formAction, isPending] = useActionState(
    signup as (state: string | null, formData: FormData) => Promise<string | null>,
    null as string | null
  )
  const { preload, getToken } = useRecaptcha()
  const [awaitingToken, setAwaitingToken] = useState(false)
  const [recaptchaError, setRecaptchaError] = useState<string | null>(null)
  const pending = awaitingToken || isPending

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (pending) return

    const formData = new FormData(e.currentTarget)

    setAwaitingToken(true)
    setRecaptchaError(null)
    const token = await getToken("register")
    setAwaitingToken(false)

    if (!token) {
      setRecaptchaError(
        t(
          "Verificarea de securitate a eșuat Reîncearcă sau dezactivează temporar blocantele de reclame"
        )
      )
      return
    }

    formData.set("recaptchaToken", token)
    startTransition(() => formAction(formData))
  }

  return (
    <div
      className="w-full max-w-sm flex flex-col items-center"
      data-testid="register-page"
    >
      <h1 className="font-display text-[42px] leading-[1] text-[var(--theme-text)] mb-2">
        {t("Creează un Cont")}
      </h1>
      <p className="font-sans text-[16px] text-[var(--theme-text-muted)] mb-10 text-center">
        {t("Creează-ți profilul și accesează o experiență de cumpărături îmbunătățită")}
      </p>

      <form
        className="w-full flex flex-col"
        onSubmit={handleSubmit}
        onFocusCapture={preload}
      >
        <div className="flex flex-col w-full gap-y-3">
          <Input
            label={t("Prenume")}
            name="first_name"
            required
            autoComplete="given-name"
            enterKeyHint="next"
            data-testid="first-name-input"
          />
          <Input
            label={t("Nume")}
            name="last_name"
            required
            autoComplete="family-name"
            enterKeyHint="next"
            data-testid="last-name-input"
          />
          <Input
            label={t("Email")}
            name="email"
            required
            type="email"
            autoComplete="email"
            enterKeyHint="next"
            data-testid="email-input"
          />
          <Input
            label={t("Telefon")}
            name="phone"
            type="tel"
            autoComplete="tel"
            pattern="^\+?[0-9][0-9\s\-.()]{6,16}[0-9]$"
            title={t("Introdu un număr de telefon valid")}
            enterKeyHint="next"
            data-testid="phone-input"
          />
          <Input
            label={t("Parolă")}
            name="password"
            required
            minLength={8}
            type="password"
            autoComplete="new-password"
            data-testid="password-input"
          />
        </div>
        <ErrorMessage
          error={recaptchaError || message}
          data-testid="register-error"
        />
        <p className="font-sans text-[13px] text-[var(--theme-text-muted)] mt-6 leading-relaxed">
          {t("Prin crearea unui cont, ești de acord cu")}{" "}
          <LocalizedClientLink
            href="/privacy-policy"
            className="text-[var(--theme-text)] hover:text-hunter-gold underline underline-offset-2 transition-colors"
          >
            {t("Politica de Confidențialitate")}
          </LocalizedClientLink>{" "}
          {t("și")}{" "}
          <LocalizedClientLink
            href="/terms-of-use"
            className="text-[var(--theme-text)] hover:text-hunter-gold underline underline-offset-2 transition-colors"
          >
            {t("Termenii de Utilizare")}
          </LocalizedClientLink>
          .
        </p>
        <SubmitButton
          pending={pending}
          className="w-full mt-4 h-12 rounded-none !bg-hunter-gold !text-hunter-dark !border-transparent font-sans uppercase tracking-[3px] text-[15px]"
          data-testid="register-button"
        >
          {t("Creează Cont")}
        </SubmitButton>

        <button
          type="button"
          onClick={() => setCurrentView(LOGIN_VIEW.SIGN_IN)}
          className="w-full mt-3 h-12 font-sans uppercase tracking-[3px] text-[13px] border border-[var(--theme-border)] text-[var(--theme-text-muted)] hover:border-hunter-gold hover:text-hunter-gold transition-colors"
          data-testid="switch-to-login-button"
        >
          {t("Am deja un cont")}
        </button>

        <p className="font-sans text-[13px] text-[var(--theme-text-muted)] mt-4 text-center leading-relaxed">
          {t("Protejat de reCAPTCHA")}{" "}
          <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="underline hover:text-hunter-gold transition-colors">{t("Confidențialitate")}</a>
          {" "}&amp;{" "}
          <a href="https://policies.google.com/terms" target="_blank" rel="noopener noreferrer" className="underline hover:text-hunter-gold transition-colors">{t("Termeni")}</a>
        </p>
      </form>

    </div>
  )
}

export default Register
