"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import Image from "next/image"
import AppointmentModal from "@modules/layout/components/appointment-modal"

const WeddingGuideTemplate = () => {
  const [open, setOpen] = useState(false)
  const t = useTranslations("pages")

  const sections = [
    {
      title: t("Alege stilul potrivit"),
      body: t("Nunta ta definește registrul vestimentar Un eveniment religios clasic cheamă un costum trei piese sau chiar un morning coat; o ceremonie în grădină permite un costum în linie mai lejeră, în tonuri deschise Stilul ales de mire dictează și recomandările pentru nași și cavaleri - coerența vizuală a întregii echipe este la fel de importantă ca și purtătorul central"
      ),
    },
    {
      title: t("Made to Measure vs Ready to Wear"),
      body: t("Dacă există un moment în viață care justifică un costum creat exclusiv pentru corpul tău, acela este ziua nunții Made to Measure înseamnă fiecare cusătură gândită pentru silueta ta - lățimea umerilor, lungimea mânecilor, căderea jachetei Nu există compromis Ready to Wear de calitate, ajustat precis de croitorul nostru, rămâne o opțiune excelentă când timpul este limitat"
      ),
    },
    {
      title: t("Țesături și culori"),
      body: t("Super 120s și Super 150s sunt standardul pentru o nuntă cu pretenții - cad elegant, nu se șifonează și respiră bine pe parcursul unei zile lungi Navy și charcoal rămân clasice infailibile Dacă nunta este în aer liber sau în sezon cald, un tweed fin sau o flanelă ușoară adaugă caracter fără a sacrifica eleganța Albul pur este pentru rochie - mirele preferă ivory, cream sau chalk"
      ),
    },
    {
      title: t("Nașii și cavalerii de onoare"),
      body: t("Coerența nu înseamnă uniformitate Nașii pot purta același costum în culori complementare, sau același material în croieli ușor diferite Cavalerii se coordonează cu mirele, nu cu el Un detaliu comun - batista de buzunar, cravata, sau nuanța costumului - este suficient pentru a crea o imagine unitară și rafinată"
      ),
    },
    {
      title: t("Accesorii: detaliul care definește"),
      body: t("Cravata sau papionul este prima decizie Urmează batista de buzunar - niciodată identică cu cravata, întotdeauna complementară Butonii de manșetă cu semnificație personală sunt un detaliu care rămâne în fotografii decenii Pantofii - Oxford sau Derby în negru sau maro închis, impecabil lustruiți - completează ținuta Ceasul, dacă îl porți, discret și clasic"
      ),
    },
    {
      title: t("Consultația la Hunter House"),
      body: t("Recomandăm să programezi consultația cu minimum trei luni înainte de nuntă La Hunter House, întâlnirea inițială este fără obligații - îți arătăm țesăturile, discutăm stilul și proporțiile, și te ajutăm să construiești o ținută care să te reprezinte cu adevărat Ajustările finale se fac cu două săptămâni înainte de eveniment"
      ),
    },
  ]

  return (
    <div className="bg-[var(--theme-bg)] w-full min-h-screen">
      {/* Hero */}
      <div className="relative w-full h-[55vh] small:h-[70vh] overflow-hidden">
        <Image
          src="/landing/images/hero-suit.jpg"
          alt="Wedding suit — Hunter House"
          fill
          className="object-cover object-center"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/20 to-black/75" />
        <div className="absolute bottom-0 left-0 right-0 page-container pb-10 small:pb-14">
          <div className="mb-4">
            <span className="font-sans text-[11px] uppercase tracking-[5px] text-white/60">
              {t("The Hunter House · Tailoring")}
            </span>
          </div>
          <h1 className="font-display text-5xl small:text-7xl text-white leading-[0.92]">
            {t("Wedding")} <span className="italic text-hunter-gold">{t("Season")}</span>
          </h1>
        </div>
      </div>

      {/* Intro */}
      <div className="page-container py-12 small:py-16">
        <p className="max-w-xl font-serif text-lg small:text-xl text-[var(--theme-text-muted)] leading-relaxed">
          {t("Ziua nunții este singurul eveniment în care toată lumea te privește Un costum creat cu atenție nu este vanitate - este respect față de momentul pe care îl trăiești")}
        </p>
      </div>

      {/* Sections 01–04 */}
      <div className="border-t border-[var(--theme-border)]">
        <div className="page-container py-14 small:py-20">
          <div className="grid grid-cols-1 small:grid-cols-2 gap-x-20 gap-y-16">
            {sections.slice(0, 4).map((s) => (
              <div key={s.title}>
                <h2 className="font-display text-2xl small:text-3xl text-[var(--theme-text)] leading-[1.05] mb-4">
                  {s.title}
                </h2>
                <p className="font-sans text-sm leading-relaxed text-[var(--theme-text-muted)]">
                  {s.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Mid image — full width */}
      <div className="relative w-full h-[45vh] small:h-[60vh] overflow-hidden">
        <Image
          src="/landing/images/mtm.webp"
          alt="Made to Measure — Hunter House"
          fill
          className="object-cover object-center"
        />
        <div className="absolute inset-0 bg-black/45" />
        <div className="absolute inset-0 flex items-center page-container">
          <div className="max-w-sm">
            <p className="font-sans text-[10px] uppercase tracking-[4px] text-hunter-gold mb-3">
              {t("Made to Measure")}
            </p>
            <p className="font-display text-2xl small:text-3xl text-white leading-snug italic">
              {t("Fiecare cusătură, gândită pentru corpul tău")}
            </p>
          </div>
        </div>
      </div>

      {/* Sections 05–06 */}
      <div className="page-container py-14 small:py-20">
        <div className="grid grid-cols-1 small:grid-cols-2 gap-x-20 gap-y-16">
          {sections.slice(4).map((s) => (
            <div key={s.title}>
              <h2 className="font-display text-2xl small:text-3xl text-[var(--theme-text)] leading-[1.05] mb-4">
                {s.title}
              </h2>
              <p className="font-sans text-sm leading-relaxed text-[var(--theme-text-muted)]">
                {s.body}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Two images side by side */}
      <div className="page-container pb-14">
        <div className="grid grid-cols-2 gap-3 small:gap-5">
          <div className="relative aspect-[3/4] overflow-hidden">
            <Image
              src="/products/suit-1.webp"
              alt="Costum Hunter House"
              fill
              className="object-cover object-top"
            />
          </div>
          <div className="relative aspect-[3/4] overflow-hidden">
            <Image
              src="/products/suit-2.webp"
              alt="Costum Hunter House"
              fill
              className="object-cover object-top"
            />
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="border-t border-[var(--theme-border)]">
        <div className="page-container py-14 flex flex-col small:flex-row items-start small:items-center justify-between gap-8">
          <div>
            <p className="font-display text-3xl small:text-4xl text-[var(--theme-text)] leading-[1.05] mb-2">
              {t("Programează consultația")}
            </p>
            <p className="font-sans text-sm text-[var(--theme-text-muted)] max-w-md">
              {t("Discutăm stilul tău, alegem țesăturile și construim costumul perfect pentru ziua nunții")}
            </p>
          </div>
          <button
            onClick={() => setOpen(true)}
            className="shrink-0 h-11 px-8 flex items-center font-sans text-[11px] uppercase tracking-[3px] bg-hunter-gold text-hunter-dark hover:opacity-90 transition-opacity cursor-pointer"
          >
            {t("Programează o întâlnire")}
          </button>
        </div>
      </div>

      <AppointmentModal open={open} onClose={() => setOpen(false)} />
    </div>
  )
}

export default WeddingGuideTemplate
