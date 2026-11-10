"use client"

import { useTranslations } from "next-intl"

export default function Membership() {
  const t = useTranslations("home")

  const tiers = [
    {
      id: "silver",
      name: t("Silver"),
      price: "500",
      tag: t("tag"),
      perks: t.raw("silverPerks") as string[],
    },
    {
      id: "gold",
      name: t("Gold"),
      price: "900",
      tag: t("Recomandat"),
      featured: true,
      perks: t.raw("goldPerks") as string[],
    },
    {
      id: "black",
      name: t("Black"),
      price: "1.800",
      tag: t("tag"),
      perks: t.raw("blackPerks") as string[],
    },
  ]

  return (
    <section className="section mem-sec" id="membership">
      <div className="section-inner">
        <div className="kicker rv">
          <span>{t("Membership")}</span>
          <span className="font-sans text-[11px] uppercase tracking-[3px] text-hunter-gold leading-none">
            {t("Coming Soon")}
          </span>
        </div>
        <h2 className="sec-title rv">
          {t("The Hunter")}
          <br />
          <em>{t("Club")}</em>
        </h2>
        <p className="sec-body-text rv" style={{ marginBottom: "0" }}>
          {t("Membership-ul The Hunter nu este un card de loialitate Este o invitație să faci parte dintr-o comunitate selectivă cu acces la experiențe unice")}
        </p>
        <div
          className="line-draw rv"
          style={{ marginTop: "20px", maxWidth: "320px" }}
        ></div>
        <div className="mem-grid rv-group">
          {tiers.map((tier) => (
            <div key={tier.id} className={`mem ${tier.featured ? "feat" : ""}`}>
              <div className="flex items-baseline justify-between gap-3 mb-1">
                <div className="mem-tag">{tier.tag}</div>
              </div>
              <div className="mem-name">{tier.name}</div>
              <div className="flex items-baseline gap-1.5 mb-3">
                <div className="mem-price">{tier.price}</div>
                <div className="mem-psub">{t("lei / an")}</div>
              </div>
              <div className="mem-div"></div>
              <div className="flex flex-col gap-1.5 pt-2">
                {tier.perks.map((perk, idx) => (
                  <div key={idx} className="mem-perk">
                    {perk}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
