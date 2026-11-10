"use client"
import { useTranslations } from "next-intl"
import { createTransferRequest } from "@lib/data/orders"
import { CheckCircleMiniSolid, XCircleSolid } from "@medusajs/icons"
import Input from "@modules/common/components/input"
import { SubmitButton } from "@modules/checkout/components/submit-button"
import { useActionState } from "react"
import { useEffect, useState } from "react"

export default function TransferRequestForm() {
  const t = useTranslations("account")
  const [showSuccess, setShowSuccess] = useState(false)

  const [state, formAction] = useActionState(createTransferRequest, {
    success: false,
    error: null,
    order: null,
  })

  useEffect(() => {
    if (state.success && state.order) {
      setShowSuccess(true)
    } else if (state.error) {
      // A later failed submission must not leave the earlier success banner
      // showing alongside the new error — they'd both render at once.
      setShowSuccess(false)
    }
  }, [state.success, state.order, state.error])

  return (
    <div className="flex flex-col gap-y-6 w-full">
      <div>
        <p className="font-sans text-[10px] uppercase tracking-[4px] text-[var(--theme-text-muted)] mb-2">
          {t("Revendicare comandă")}
        </p>
        <h2 className="font-display text-[22px] leading-[1.1] text-[var(--theme-text)] mb-1">
          {t("Asociază o comandă la cont")}
        </h2>
        <p className="font-sans text-[12px] text-[var(--theme-text-muted)]">
          {t("Ai plasat o comandă fără cont? Introdu ID-ul comenzii din emailul de confirmare pentru a o asocia contului tău")}
        </p>
      </div>

      <form action={formAction} className="flex flex-col small:flex-row gap-3 small:items-end">
        <div className="flex-1 max-w-sm">
          <Input
            className="w-full"
            name="order_id"
            required
            placeholder="order_01ABC..."
            label={t("ID comandă")}
          />
        </div>
        <SubmitButton className="!w-auto h-10 px-6 !py-0 !bg-transparent !text-[var(--theme-text-muted)] border border-[var(--theme-border)] hover:!opacity-100 hover:border-hunter-gold hover:!text-hunter-gold font-sans text-[11px] uppercase tracking-[3px] whitespace-nowrap self-end small:self-auto">
          {t("Trimite cerere")}
        </SubmitButton>
      </form>

      {!state.success && state.error && (
        <p className="font-sans text-[11px] text-rose-500">
          {state.error}
        </p>
      )}

      {showSuccess && (
        <div className="flex items-start justify-between gap-4 p-4 border border-[var(--theme-border)] bg-[var(--theme-surface)]">
          <div className="flex gap-3 items-start">
            <CheckCircleMiniSolid className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-sans text-[12px] text-[var(--theme-text)] mb-0.5">
                {t("Cerere trimisă pentru comanda {id}", {
                  id: state.order?.id ?? "",
                })}
              </p>
              <p className="font-sans text-[11px] text-[var(--theme-text-muted)]">
                {t("Email de confirmare trimis la {email}", {
                  email: state.order?.email ?? "",
                })}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowSuccess(false)}
            className="shrink-0 text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] transition-colors"
          >
            <XCircleSolid className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  )
}
