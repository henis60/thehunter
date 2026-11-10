"use client"

import { useTranslations } from "next-intl"
import { useActionState, useState } from "react"
import Input from "@modules/common/components/input"
import ErrorMessage from "@modules/checkout/components/error-message"
import { SubmitButton } from "@modules/checkout/components/submit-button"
import { resetPassword } from "@lib/data/customer"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

type Props = {
  token: string
}

const ResetPassword = ({ token }: Props) => {
  const t = useTranslations("account")
  const resetWithToken = resetPassword.bind(null, token)
  const [message, formAction] = useActionState(resetWithToken, null)
  const [validationError, setValidationError] = useState<string | null>(null)

  const isSuccess = message === "success"

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    const formData = new FormData(e.currentTarget)
    const password = String(formData.get("password") ?? "")
    const confirm = String(formData.get("password_confirm") ?? "")

    if (password.length < 8) {
      e.preventDefault()
      setValidationError(t("Parola trebuie să aibă minim 8 caractere"))
      return
    }
    if (password !== confirm) {
      e.preventDefault()
      setValidationError(t("Parolele nu coincid"))
      return
    }
    setValidationError(null)
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 py-16">
      <div className="w-full max-w-sm flex flex-col items-center">
        <h1 className="font-display text-[42px] leading-[1] text-[var(--theme-text)] mb-2">
          {t("Parolă Nouă")}
        </h1>
        <p className="font-sans text-[16px] text-[var(--theme-text-muted)] mb-10 text-center">
          {t("Alege o parolă nouă pentru contul tău")}
        </p>

        {isSuccess ? (
          <div className="w-full text-center flex flex-col items-center gap-6">
            <div className="border border-[var(--theme-border)] px-6 py-5 w-full">
              <p className="font-sans text-[16px] text-[var(--theme-text)] leading-relaxed">
                {t("Parola a fost schimbată cu succes Te poți autentifica acum")}
              </p>
            </div>
            <LocalizedClientLink
              href="/profil"
              className="w-full h-12 flex items-center justify-center bg-hunter-gold text-hunter-dark hover:opacity-90 transition-opacity font-sans uppercase tracking-[3px] text-[15px]"
            >
              {t("Mergi la autentificare")}
            </LocalizedClientLink>
          </div>
        ) : (
          <form className="w-full" action={formAction} onSubmit={handleSubmit}>
            <div className="flex flex-col w-full gap-y-3">
              <Input
                label={t("Parolă nouă")}
                name="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                enterKeyHint="next"
              />
              <Input
                label={t("Confirmă parola")}
                name="password_confirm"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
              />
            </div>
            <ErrorMessage error={validationError || message} />
            <SubmitButton className="w-full mt-6 h-12 rounded-none !bg-hunter-gold !text-hunter-dark !border-transparent font-sans uppercase tracking-[3px] text-[15px]">
              {t("Salvează Parola")}
            </SubmitButton>
          </form>
        )}
      </div>
    </div>
  )
}

export default ResetPassword
