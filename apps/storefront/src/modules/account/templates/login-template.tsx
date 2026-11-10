"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"

import Register from "@modules/account/components/register"
import Login from "@modules/account/components/login"
import ForgotPassword from "@modules/account/components/forgot-password"

export enum LOGIN_VIEW {
  SIGN_IN = "sign-in",
  REGISTER = "register",
  FORGOT_PASSWORD = "forgot-password",
}

type Props = {
  redirectTo?: string
}

const LoginTemplate = ({ redirectTo }: Props) => {
  const t = useTranslations("account")
  const [currentView, setCurrentView] = useState(LOGIN_VIEW.SIGN_IN)

  return (
    <div className="flex flex-col flex-1 min-h-[60vh]">
      {currentView === LOGIN_VIEW.FORGOT_PASSWORD && (
        <div className="page-container pt-3 small:pt-6 pb-0">
          <button
            onClick={() => setCurrentView(LOGIN_VIEW.SIGN_IN)}
            className="inline-flex items-end gap-2 text-[var(--theme-text-muted)] hover:text-[var(--theme-gold)] transition-colors font-sans text-[13px] uppercase tracking-[3px]"
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
      )}
      <div className="flex flex-col items-center justify-center small:justify-start flex-1 px-5 py-6 small:px-6 small:py-16">
        <div className="w-full max-w-sm">
          {currentView === LOGIN_VIEW.SIGN_IN ? (
            <Login setCurrentView={setCurrentView} redirectTo={redirectTo} />
          ) : currentView === LOGIN_VIEW.REGISTER ? (
            <Register setCurrentView={setCurrentView} />
          ) : (
            <ForgotPassword setCurrentView={setCurrentView} />
          )}
        </div>
      </div>
    </div>
  )
}

export default LoginTemplate
