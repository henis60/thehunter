"use client"

import React from "react"
import { useFormStatus } from "react-dom"
import { useTranslations } from "next-intl"
import Spinner from "@modules/common/icons/spinner"

export function SubmitButton({
  children,
  className,
  pending: pendingProp,
  "data-testid": dataTestId,
}: {
  children: React.ReactNode
  variant?: string
  size?: string
  className?: string
  // useFormStatus only reports pending for forms submitted via the native
  // `action` prop — forms that dispatch their action manually (e.g. to
  // inject a reCAPTCHA token first) need to pass their own pending state in.
  pending?: boolean
  "data-testid"?: string
}) {
  const { pending: formPending } = useFormStatus()
  const pending = pendingProp ?? formPending
  const t = useTranslations("checkout")

  return (
    <button
      type="submit"
      disabled={pending}
      data-testid={dataTestId}
      className={`relative w-full py-3 bg-hunter-gold text-[#0D0D0D] font-sans text-[12px] uppercase tracking-[4px] hover:opacity-90 transition-opacity disabled:cursor-not-allowed overflow-hidden ${className ?? ""}`}
    >
      <span
        className={`flex items-center justify-center gap-2 transition-opacity duration-150 ${
          pending ? "opacity-0" : "opacity-100"
        }`}
      >
        {children}
      </span>
      {pending && (
        <span className="absolute inset-0 flex items-center justify-center gap-2">
          <Spinner size="14" />
          {t("Se procesează…")}
        </span>
      )}
    </button>
  )
}
