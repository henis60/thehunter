"use client"

import { completeNetopiaBySession } from "@lib/data/cart"
import { orderIdToSlug } from "@lib/util/order-slug"
import { useSearchParams } from "next/navigation"
import { useRouter } from "@i18n/navigation"
import { useEffect, useRef, useState } from "react"
import { useTranslations } from "next-intl"

const POLL_INTERVAL_MS = 2500
const MAX_POLLS = 20

type Stage = "verifying" | "rejected" | "timeout" | "stale"

export default function NetopiaReturnClient() {
  const t = useTranslations("checkout")
  const searchParams = useSearchParams()
  const router = useRouter()
  const sessionId = searchParams.get("session_id")
  const failedParam = searchParams.get("failed")
  const [stage, setStage] = useState<Stage>(
    failedParam === "1" ? "rejected" : "verifying"
  )
  const polls = useRef(0)

  useEffect(() => {
    if (!sessionId) {
      router.replace("/cos")
      return
    }

    // Backend a semnalat deja că plata a eșuat — nu mai facem polling
    if (failedParam === "1") {
      setTimeout(() => router.replace("/finalizare-comanda?pas=sumar"), 4000)
      return
    }

    const poll = async () => {
      const result = await completeNetopiaBySession(sessionId)

      if (result.orderId) {
        router.replace(`/comanda/${orderIdToSlug(result.orderId)}`)
        return
      }

      if (result.stale) {
        // This tab's payment session was replaced by a newer one for the
        // same cart. No order can come from it, so don't poll or claim one.
        setStage("stale")
        setTimeout(() => router.replace("/finalizare-comanda?pas=sumar"), 8000)
        return
      }

      if (result.failed) {
        setStage("rejected")
        setTimeout(() => router.replace("/finalizare-comanda?pas=sumar"), 4000)
        return
      }

      polls.current += 1
      if (polls.current >= MAX_POLLS) {
        setStage("timeout")
        setTimeout(() => router.replace("/"), 6000)
        return
      }

      setTimeout(poll, POLL_INTERVAL_MS)
    }

    setTimeout(poll, POLL_INTERVAL_MS)
  }, [sessionId, router])

  const messages: Record<Stage, { heading: string; body: string }> = {
    verifying: {
      heading: t("Confirmare comandă"),
      body: t(
        "Plata ta este procesată în siguranță Te rugăm să nu închizi această fereastră"
      ),
    },
    rejected: {
      heading: t("Plată respinsă"),
      body: t(
        "Tranzacția nu a putut fi finalizată Vei fi redirecționat înapoi la checkout"
      ),
    },
    stale: {
      heading: t("Sesiune de plată înlocuită"),
      body: t(
        "Această plată aparține unei sesiuni mai vechi Dacă ai fost taxat suma îți va fi returnată Te redirecționăm la checkout"
      ),
    },
    timeout: {
      heading: t("Plată în procesare"),
      body: t(
        "Comanda ta a fost înregistrată Vei primi un email de confirmare în scurt timp"
      ),
    },
  }

  const { heading, body } = messages[stage]

  // SVG ring sizes
  const R = 44
  const C = 2 * Math.PI * R // circumference ≈ 276.5

  return (
    <>
      <style>{`
        @keyframes seal-draw {
          0%   { stroke-dashoffset: ${C}; }
          60%  { stroke-dashoffset: 0; }
          100% { stroke-dashoffset: 0; }
        }
        @keyframes seal-rotate {
          from { transform: rotate(-90deg); }
          to   { transform: rotate(270deg); }
        }
        @keyframes dot-pulse {
          0%, 100% { opacity: 0.3; transform: scale(0.85); }
          50%       { opacity: 1;   transform: scale(1); }
        }
        @keyframes fade-up {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes shimmer {
          0%   { opacity: 0.55; }
          50%  { opacity: 1; }
          100% { opacity: 0.55; }
        }
        .seal-ring {
          stroke-dasharray: ${C};
          stroke-dashoffset: ${C};
          transform-origin: center;
          animation: seal-draw 2.4s cubic-bezier(0.4, 0, 0.2, 1) infinite;
        }
        .seal-rotate {
          animation: seal-rotate 2.4s linear infinite;
          transform-origin: center;
        }
        .dot { animation: dot-pulse 1.6s ease-in-out infinite; }
        .dot:nth-child(2) { animation-delay: 0.25s; }
        .dot:nth-child(3) { animation-delay: 0.5s; }
        .content-fade { animation: fade-up 0.7s ease both; }
        .gold-shimmer { animation: shimmer 2.8s ease-in-out infinite; }

        @media (prefers-reduced-motion: reduce) {
          .seal-ring, .seal-rotate, .dot, .gold-shimmer {
            animation: none !important;
          }
          .seal-ring { stroke-dashoffset: 0; }
        }
      `}</style>

      <div
        className="overflow-hidden flex flex-col items-center justify-center px-6"
        style={{ backgroundColor: "#ffffff", height: "calc(100vh - 64px)" }}
      >
        {/* Animated seal */}
        <div
          className="content-fade mb-10 relative"
          style={{ animationDelay: "80ms" }}
        >
          <svg
            width={100}
            height={100}
            viewBox="0 0 100 100"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            {/* Static outer ring */}
            <circle
              cx={50}
              cy={50}
              r={R}
              stroke="#C9A84C"
              strokeWidth={0.5}
              opacity={0.18}
            />
            {/* Animated arc */}
            <g className="seal-rotate">
              <circle
                className="seal-ring"
                cx={50}
                cy={50}
                r={R}
                stroke="#C9A84C"
                strokeWidth={1.5}
                strokeLinecap="round"
              />
            </g>

            {stage === "verifying" && (
              /* Central diamond mark */
              <g>
                <rect
                  x={46.5}
                  y={46.5}
                  width={7}
                  height={7}
                  stroke="#C9A84C"
                  strokeWidth={1}
                  opacity={0.7}
                  transform="rotate(45 50 50)"
                  className="gold-shimmer"
                />
              </g>
            )}

            {(stage === "rejected" || stage === "stale") && (
              <g
                stroke="#722F37"
                strokeWidth={1.5}
                strokeLinecap="round"
                opacity={0.85}
              >
                <line x1={44} y1={44} x2={56} y2={56} />
                <line x1={56} y1={44} x2={44} y2={56} />
              </g>
            )}

            {stage === "timeout" && (
              <polyline
                points="43,50 48,55 58,44"
                stroke="#C9A84C"
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
                opacity={0.85}
              />
            )}
          </svg>
        </div>

        {/* Heading */}
        <h1
          className="content-fade font-display text-center mb-5"
          style={{
            color: "#0D1F17",
            fontSize: "clamp(1.5rem, 4vw, 2rem)",
            fontWeight: 400,
            lineHeight: 1.2,
            letterSpacing: "0.01em",
            textWrap: "balance",
            animationDelay: "200ms",
          }}
        >
          {heading}
        </h1>

        {/* Body */}
        <p
          className="content-fade font-serif text-center"
          style={{
            color: "#374151",
            opacity: 0.75,
            fontSize: "1.05rem",
            fontWeight: 300,
            maxWidth: 340,
            lineHeight: 1.7,
            animationDelay: "280ms",
          }}
        >
          {body}
        </p>
      </div>
    </>
  )
}
