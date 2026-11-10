"use client"

import { useRef, useState } from "react"
import { animate } from "framer-motion"
import { useTranslations } from "next-intl"

export default function GiftCard() {
  const t = useTranslations("home")
  const amounts = ["300 lei", "500 lei", "1.000 lei", "2.000 lei"]
  const [selected, setSelected] = useState(0)
  const amountRef = useRef<HTMLDivElement>(null)
  const shineRef = useRef<HTMLDivElement>(null)
  const busy = useRef(false)

  async function selectAmount(idx: number) {
    if (idx === selected || busy.current) return
    busy.current = true
    await animate(
      amountRef.current!,
      { scale: 0.8, opacity: 0, y: 4 },
      { duration: 0.2, ease: [0.23, 1, 0.32, 1] }
    )
    setSelected(idx)
    await animate(
      amountRef.current!,
      { scale: 1, opacity: 1, y: 0 },
      { duration: 0.2, ease: [0.23, 1, 0.32, 1] }
    )
    triggerShine()
    busy.current = false
  }

  function triggerShine() {
    if (!shineRef.current) return
    animate(shineRef.current, { x: "0%" }, { duration: 0 }).then(() =>
      animate(
        shineRef.current!,
        { x: "380%" },
        {
          duration: 0.7,
          ease: [0.23, 1, 0.32, 1],
        }
      )
    )
  }

  return (
    <section className="section gc-sec" id="giftcard">
      <div className="section-inner">
        <div className="gc-wrap">
          <div className="relative flex items-center justify-center rv from-l">
            <div
              className="gc-card elevated"
              id="gcCard"
              onMouseEnter={triggerShine}
            >
              <div ref={shineRef} className="gc-shine-wrap">
                <div className="gc-shine-sweep" />
              </div>
              <div className="gc-card-logo">
                <div className="gc-logo-1">{t("The Hunter")}</div>
                <div className="gc-logo-divider"></div>
                <div className="gc-logo-2">{t("House")}</div>
              </div>
              <div ref={amountRef} className="gc-card-amount" id="gcCardAmount">
                {amounts[selected]}
              </div>
            </div>
          </div>
          <div className="rv">
            <div className="kicker">
              <span>{t("Gift Card")}</span>
              <span className="font-sans text-[12px] uppercase tracking-[3px] text-hunter-gold leading-none">
                {t("Coming Soon")}
              </span>
            </div>
            <h2 className="sec-title">
              {t("Cadoul perfect")}
              <br />
              {t("pentru un")} <em>{t("gentleman")}</em>
            </h2>
            <p className="gc-desc">
              {t("Un card cadou The Hunter House poate fi folosit pentru orice serviciu – Made to Measure, Ready to Wear, consultație de stil sau o seară la The Hunter Bar")}
            </p>
            <div className="gc-amounts" id="gcAmounts">
              {amounts.map((amount, idx) => (
                <div
                  key={amount}
                  className={`gc-amt${selected === idx ? " on" : ""}`}
                  onClick={() => selectAmount(idx)}
                >
                  <span>{amount}</span>
                </div>
              ))}
            </div>
            <div className="gc-note">
              {t("Valabil 12 luni · Disponibil fizic sau digital · Personalizabil")}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
