"use client"

import { useTranslations } from "next-intl"
import { startTransition, useState } from "react"
import { login } from "@lib/data/customer"
import { LOGIN_VIEW } from "@modules/account/templates/login-template"
import ErrorMessage from "@modules/checkout/components/error-message"
import { SubmitButton } from "@modules/checkout/components/submit-button"
import Input from "@modules/common/components/input"
import { useActionState } from "react"
import { useRecaptcha } from "@lib/hooks/use-recaptcha"

type Props = {
  setCurrentView: (view: LOGIN_VIEW) => void
  redirectTo?: string
}

const Login = ({ setCurrentView, redirectTo }: Props) => {
  const t = useTranslations("account")
  const [message, formAction, isPending] = useActionState(login, null)
  const { preload, getToken } = useRecaptcha()
  const [awaitingToken, setAwaitingToken] = useState(false)
  const [recaptchaError, setRecaptchaError] = useState<string | null>(null)
  const pending = awaitingToken || isPending

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (pending) return

    const formData = new FormData(e.currentTarget)
    if (redirectTo) {
      formData.set("redirectTo", redirectTo)
    }

    setAwaitingToken(true)
    setRecaptchaError(null)
    const token = await getToken("login")
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
      data-testid="login-page"
    >
      <h1 className="font-display text-[42px] leading-[1] text-[var(--theme-text)] mb-2">
        {t("Bine ai revenit")}
      </h1>
      <p className="font-sans text-[16px] text-[var(--theme-text-muted)] mb-10 text-center">
        {t("Autentifică-te pentru o experiență de cumpărături îmbunătățită")}
      </p>

      <form className="w-full" onSubmit={handleSubmit} onFocusCapture={preload}>
        <div className="flex flex-col w-full gap-y-3">
          <Input
            label={t("Email")}
            name="email"
            type="email"
            title={t("Introdu o adresă de email validă")}
            autoComplete="email"
            required
            enterKeyHint="next"
            data-testid="email-input"
          />
          <Input
            label={t("Parolă")}
            name="password"
            type="password"
            autoComplete="current-password"
            required
            data-testid="password-input"
          />
        </div>
        <div className="flex items-center justify-between gap-3 mt-2">
          <ErrorMessage
            error={recaptchaError || message}
            data-testid="login-error-message"
          />
          <button
            type="button"
            onClick={() => setCurrentView(LOGIN_VIEW.FORGOT_PASSWORD)}
            className="shrink-0 ml-auto font-sans text-[15px] text-[var(--theme-text-muted)] hover:text-hunter-gold transition-colors"
          >
            {t("Ai uitat parola?")}
          </button>
        </div>

        <SubmitButton
          data-testid="sign-in-button"
          pending={pending}
          className="w-full mt-4 h-12 rounded-none !bg-hunter-gold !text-hunter-dark !border-transparent font-sans uppercase tracking-[3px] text-[15px]"
        >
          {t("Autentificare")}
        </SubmitButton>

        <button
          type="button"
          onClick={() => setCurrentView(LOGIN_VIEW.REGISTER)}
          className="w-full mt-3 h-12 font-sans uppercase tracking-[3px] text-[13px] border border-[var(--theme-border)] text-[var(--theme-text-muted)] hover:border-hunter-gold hover:text-hunter-gold transition-colors"
          data-testid="switch-to-register-button"
        >
          {t("Creează un cont nou")}
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

export default Login
