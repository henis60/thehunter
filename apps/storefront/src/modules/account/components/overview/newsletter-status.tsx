"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import { HttpTypes } from "@medusajs/types"
import {
  subscribeToNewsletter,
  unsubscribeFromNewsletter,
} from "@lib/data/newsletter"

export default function NewsletterStatus({
  customer,
  initialSubscribed,
}: {
  customer: HttpTypes.StoreCustomer | null
  // Fetched server-side by the overview page so the box renders with the
  // rest of the page instead of popping in after a client fetch.
  initialSubscribed: boolean
}) {
  const t = useTranslations("account")
  const [subscribed, setSubscribed] = useState<boolean>(initialSubscribed)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const email = customer?.email

  const subscribe = async () => {
    if (!email || loading) return
    setLoading(true)
    setError(null)
    try {
      // Runs server-side, where the address comes from the session — the
      // browser never gets to say whose subscription it is changing.
      const result = await subscribeToNewsletter()
      if (result.success) {
        setSubscribed(true)
      } else {
        setError(result.error ?? t("Eroare necunoscută"))
      }
    } catch {
      setError(t("Eroare de rețea"))
    } finally {
      setLoading(false)
    }
  }

  const unsubscribe = async () => {
    if (!email || loading) return
    setLoading(true)
    setError(null)
    try {
      const result = await unsubscribeFromNewsletter()
      if (result.success) {
        setSubscribed(false)
      } else {
        setError(result.error ?? t("Eroare necunoscută"))
      }
    } catch {
      setError(t("Eroare de rețea"))
    } finally {
      setLoading(false)
    }
  }

  if (!email) return null

  return (
    <div className="border border-[var(--theme-border)] p-6 flex flex-col small:flex-row items-start small:items-center justify-between gap-4">
      <div>
        <p className="font-sans text-[11px] uppercase tracking-[4px] text-[var(--theme-text-muted)] mb-1.5">
          {t("Newsletter")}
        </p>
        <p className="font-display text-[18px] leading-tight text-[var(--theme-text)]">
          {subscribed ? (
            <>
              {t("Ești abonat")}
              <span className="text-hunter-gold">.</span>
            </>
          ) : (
            t("Nu ești abonat")
          )}
        </p>
        {subscribed && (
          <p className="font-sans text-[13px] text-[var(--theme-text-muted)] mt-1">
            {t("Primești noutăți exclusive pe")}{" "}
            <span className="text-[var(--theme-text)]">{email}</span>
          </p>
        )}
        {!subscribed && (
          <p className="font-sans text-[13px] text-[var(--theme-text-muted)] mt-1">
            {t("Abonează-te pentru oferte și noutăți exclusive")}
          </p>
        )}
        {error && (
          <p className="font-sans text-[13px] text-red-400 mt-1">{error}</p>
        )}
      </div>

      <button
        onClick={subscribed ? unsubscribe : subscribe}
        disabled={loading}
        className={
          subscribed
            ? "shrink-0 h-11 px-6 inline-flex items-center justify-center w-full small:w-auto border border-[var(--theme-border)] font-sans text-[12px] uppercase tracking-[3px] text-[var(--theme-text)] hover:border-hunter-gold hover:text-hunter-gold active:border-hunter-gold active:text-hunter-gold transition-colors disabled:opacity-40"
            : "shrink-0 h-11 px-6 inline-flex items-center justify-center w-full small:w-auto font-sans text-[12px] uppercase tracking-[3px] text-hunter-dark bg-hunter-gold hover:bg-hunter-gold/90 transition-colors disabled:opacity-40"
        }
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <svg
              className="animate-spin w-3.5 h-3.5"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
              />
            </svg>
            {subscribed ? t("Dezabonare") : t("Abonează-te")}
          </span>
        ) : subscribed ? (
          t("Dezabonare")
        ) : (
          t("Abonează-te")
        )}
      </button>
    </div>
  )
}
