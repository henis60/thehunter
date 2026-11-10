"use client"

import { useTranslations } from "next-intl"
import { startTransition, useActionState, useState } from "react"
import Input from "@modules/common/components/input"
import { LOGIN_VIEW } from "@modules/account/templates/login-template"
import ErrorMessage from "@modules/checkout/components/error-message"
import { SubmitButton } from "@modules/checkout/components/submit-button"
import { requestPasswordReset } from "@lib/data/customer"
import { useRecaptcha } from "@lib/hooks/use-recaptcha"

type Props = {
  setCurrentView: (view: LOGIN_VIEW) => void
}

const ForgotPassword = ({ setCurrentView }: Props) => {
  const t = useTranslations("account")
  const [message, formAction, isPending] = useActionState(requestPasswordReset, null)
  const { preload, getToken } = useRecaptcha()
  const [awaitingToken, setAwaitingToken] = useState(false)
  const [recaptchaError, setRecaptchaError] = useState<string | null>(null)
  const pending = awaitingToken || isPending

  const isSuccess = message === "success"

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (pending) return

    const formData = new FormData(e.currentTarget)

    setAwaitingToken(true)
    setRecaptchaError(null)
    const token = await getToken("password_reset")
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
    <div className="w-full max-w-sm flex flex-col items-center">
      <h1 className="font-display text-[42px] leading-[1] text-[var(--theme-text)] mb-2">
        {t("Resetare Parolă")}
      </h1>
      <p className="font-sans text-[16px] text-[var(--theme-text-muted)] mb-10 text-center">
        {t("Introdu adresa de email și îți vom trimite un link pentru resetarea parolei")}
      </p>

      {isSuccess ? (
        <div className="w-full text-center">
          <div className="border border-[var(--theme-border)] px-6 py-5 mb-8">
            <p className="font-sans text-[16px] text-[var(--theme-text)] leading-relaxed">
              {t("Dacă adresa de email există în sistem, vei primi un link de resetare în câteva minute")}
            </p>
          </div>
          <button
            onClick={() => setCurrentView(LOGIN_VIEW.SIGN_IN)}
            className="w-full h-12 flex items-center justify-center gap-2 bg-hunter-gold text-hunter-dark hover:opacity-90 transition-opacity font-sans uppercase tracking-[3px] text-[15px]"
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
          </button>
        </div>
      ) : (
        <form
          className="w-full"
          onSubmit={handleSubmit}
          onFocusCapture={preload}
        >
          <Input
            label={t("Email")}
            name="email"
            type="email"
            autoComplete="email"
            required
          />
          <ErrorMessage error={isSuccess ? null : recaptchaError || message} />
          <SubmitButton
            pending={pending}
            className="w-full mt-6 h-12 rounded-none !bg-hunter-gold !text-hunter-dark !border-transparent font-sans uppercase tracking-[3px] text-[15px]"
          >
            {t("Trimite Link")}
          </SubmitButton>
          <p className="font-sans text-[13px] text-[var(--theme-text-muted)] mt-4 text-center leading-relaxed">
            {t("Protejat de reCAPTCHA")}{" "}
            <a
              href="https://policies.google.com/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-hunter-gold transition-colors"
            >
              {t("Confidențialitate")}
            </a>{" "}
            &amp;{" "}
            <a
              href="https://policies.google.com/terms"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-hunter-gold transition-colors"
            >
              {t("Termeni")}
            </a>
          </p>
        </form>
      )}
    </div>
  )
}

export default ForgotPassword
