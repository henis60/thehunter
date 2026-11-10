"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { useRecaptcha } from "@lib/hooks/use-recaptcha"
import { submitNewsletterSignup } from "@lib/data/public-forms"

type Status = "idle" | "loading" | "success" | "error"

const Newsletter = () => {
  const t = useTranslations("home")
  const [status, setStatus] = useState<Status>("idle")
  const [errorMsg, setErrorMsg] = useState("")
  const { preload, getToken } = useRecaptcha()

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setStatus("loading")
    setErrorMsg("")

    const email = (new FormData(e.currentTarget).get("EMAIL") as string)?.trim()

    if (!email) {
      setErrorMsg(t("Te rugăm să introduci adresa de email"))
      setStatus("error")
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setErrorMsg(t("Adresa de email nu este validă"))
      setStatus("error")
      return
    }

    try {
      const recaptchaToken = await getToken("newsletter")
      if (!recaptchaToken) {
        throw new Error("recaptcha")
      }

      const res = await submitNewsletterSignup({ email, recaptchaToken })

      if (!res.success) {
        setErrorMsg(
          res.reason === "rate_limited"
            ? t("Prea multe încercări Te rugăm să revii peste câteva minute")
            : res.message || t("Înscrierea nu a putut fi finalizată Încearcă din nou")
        )
        setStatus("error")
        return
      }

      setStatus("success")
    } catch {
      setErrorMsg(t("Înscrierea nu a putut fi finalizată Încearcă din nou"))
      setStatus("error")
    }
  }

  return (
    <>
      <div className="subscribe-layout subscribe-layout--inline" id="subscribe">
        <div className="subscribe-form-wrap rv">
          <div className="subscribe-panel">
                <p className="subscribe-panel-label">{t("Abonare rapidă")}</p>
                <p className="subscribe-panel-copy">
                  {t("Primești lansări, evenimente și colecții noi înaintea tuturor")}
                </p>

                <p
                  style={{
                    fontFamily: "var(--rl)",
                    fontSize: "10px",
                    letterSpacing: "1.5px",
                    textTransform: "uppercase",
                    color: "rgba(232,213,163,0.3)",
                    margin: "0 0 22px",
                  }}
                >
                  {t("Niciun spam Te poți dezabona oricând")}
                </p>

                {status === "success" ? (
                  <div
                    style={{
                      background: "rgba(27,77,62,0.3)",
                      border: "1px solid rgba(201,168,76,0.35)",
                      padding: "12px 14px",
                    }}
                  >
                    <p
                      style={{
                        fontFamily: "var(--rl)",
                        fontSize: "12px",
                        letterSpacing: "2px",
                        textTransform: "uppercase",
                        color: "rgba(232,213,163,0.85)",
                        margin: 0,
                        textAlign: "center",
                      }}
                    >
                      {t("Mulțumim! Te-ai înscris cu succes")}
                    </p>
                  </div>
                ) : (
                  <form
                    onSubmit={handleSubmit}
                    onFocusCapture={preload}
                    noValidate
                  >
                    <div style={{ display: "flex" }}>
                      <input
                        type="email"
                        id="EMAIL"
                        name="EMAIL"
                        autoComplete="email"
                        placeholder={t("adresa@emailcom")}
                        className="newsletter-email-input"
                        style={{
                          flex: 1,
                          minWidth: 0,
                          fontFamily: "var(--rl)",
                          fontSize: "17px",
                          letterSpacing: "2px",
                          background: "rgba(255,255,255,0.04)",
                          border: "1px solid rgba(201,168,76,0.25)",
                          borderRight: "none",
                          color: "var(--ivory)",
                          padding: "0 14px",
                          outline: "none",
                          caretColor: "var(--gold)",
                        }}
                        onFocus={(e) =>
                          (e.currentTarget.style.borderColor =
                            "rgba(201,168,76,0.65)")
                        }
                        onBlur={(e) =>
                          (e.currentTarget.style.borderColor =
                            "rgba(201,168,76,0.25)")
                        }
                      />
                      <button
                        type="submit"
                        disabled={status === "loading"}
                        className="newsletter-submit-btn"
                        style={{
                          cursor: status === "loading" ? "default" : "pointer",
                          opacity: status === "loading" ? 0.55 : 1,
                        }}
                      >
                        {status === "loading" ? t("Se înscrie…") : t("Înscrie-mă")}
                      </button>
                    </div>

                    <p
                      style={{
                        margin: "16px 0 0",
                        fontFamily: "var(--rl)",
                        fontSize: "10px",
                        color: "rgba(232,213,163,0.3)",
                        letterSpacing: "0.5px",
                      }}
                    >
                      {t("Protejat de reCAPTCHA")}{" "}
                      <a
                        href="https://policies.google.com/privacy"
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          color: "rgba(201,168,76,0.5)",
                          textDecoration: "underline",
                        }}
                      >
                        {t("Confidențialitate")}
                      </a>{" "}
                      &amp;{" "}
                      <a
                        href="https://policies.google.com/terms"
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          color: "rgba(201,168,76,0.5)",
                          textDecoration: "underline",
                        }}
                      >
                        {t("Termeni")}
                      </a>
                    </p>

                    {status === "error" && (
                      <div style={{ marginTop: "12px" }}>
                        <p
                          style={{
                            fontFamily: "var(--rl)",
                            fontSize: "11px",
                            letterSpacing: "1px",
                            color: "rgba(200,120,120,0.75)",
                            margin: 0,
                            textAlign: "center",
                          }}
                        >
                          {errorMsg}
                        </p>
                      </div>
                    )}
                  </form>
                )}
              </div>
            </div>
          </div>
    </>
  )
}

export default Newsletter
