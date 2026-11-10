"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import Image from "next/image"
import AppointmentModal from "@modules/layout/components/appointment-modal"

const HuntingGuideTemplate = () => {
  const [open, setOpen] = useState(false)
  const t = useTranslations("pages")

  const sections = [
    {
      title: t("Harris Tweed - legenda scoțiană"),
      body: t("Există puține țesături cu o poveste atât de autentică Harris Tweed este țesut manual, în casele localnicilor din insulele Outer Hebrides, Scotland, din lână pură virgilă vopsită și filată local Fiecare metraj poartă stampila de autenticitate a Harris Tweed Authority Rezistența lui este legendară - o haină din Harris Tweed durează decenii, capătă caracter cu fiecare purtare și se îmbunătățește cu timpul"
      ),
    },
    {
      title: t("Haina de vânătoare: structura"),
      body: t("O haină de vânătoare bine construită are câteva elemente esențiale: umeri cu suficientă libertate de mișcare pentru a ridica arma, plastron dublu sau căptușit în față pentru protecție, buzunare mari cu capac pentru cartuș și vânat mic, și un spate cu fantă sau cut care permite mișcarea Lungimea optimă ajunge la mijlocul coapsei Culoarea tradițională este în tonuri de pământ, olive, brunâ sau heather"
      ),
    },
    {
      title: t("Layering: arta stratificării"),
      body: t("Vânătoarea presupune ore petrecute afară, cu temperaturi variabile Principiul stratificării este simplu: un strat de bază termic, un strat intermediar de lână sau fleece, și haina exterioară Nu face greșeala unui singur strat gros - nu poți adapta temperatura O vestă matlasată sau un gilet de lână între cămașă și haină este soluția britanică clasică, elegantă și eficientă"
      ),
    },
    {
      title: t("Pantaloni și jambiere"),
      body: t("Pantalonii plus-fours - cei care se termină sub genunchi și se închid cu o curea - sunt haina autentică a vânătorii britanice Asocierea cu jambiere din lână sau woollen socks înalte este estetică și funcțională: protejează piciorul de vegetație, oferă căldură și se usucă rapid Alternativa modernă sunt pantalonii drepți din tweed sau moleskin, purtați cu bocanci înalți"
      ),
    },
    {
      title: t("Încălțăminte: alegerea corectă"),
      body: t("Bocancii din piele cu talpă de cauciuc sunt standardul - impermeabili, cu gleznă înaltă, cu un gripaj bun pe teren umed Brandurile clasice britanice ca Dubarry, Hunter sau Le Chameau au construit reputații de decenii în teren Evită orice cu talpă netedă sau piele fină Bocancul bun se îngrijește cu ceară de protecție înainte de fiecare ieșire"
      ),
    },
    {
      title: t("Accesorii cu sens"),
      body: t("Căciula de tweed sau cloth cap este piesa de rezistență - completează ansamblul și protejează capul Mănușile de piele cu căptușeală sunt esențiale în lunile reci O eșarfă de cachemire sau lână merino adaugă căldură și eleganță Cartuș-bandoliera din piele sau textil, dacă o porți vizibil, trebuie să fie de calitate - ea spune la fel de mult despre tine ca și haina"
      ),
    },
  ]

  return (
    <div className="bg-[var(--theme-bg)] w-full min-h-screen">
      {/* Hero */}
      <div className="relative w-full h-[55vh] small:h-[70vh] overflow-hidden">
        <Image
          src="/landing/images/vanatoare.webp"
          alt="Vânătoare — Heritage Collection"
          fill
          className="object-cover object-center"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/20 to-black/75" />
        <div className="absolute bottom-0 left-0 right-0 page-container pb-10 small:pb-14">
          <div className="mb-4">
            <span className="font-sans text-[12px] uppercase tracking-[5px] text-white/60">
              {t("The Hunter House · Heritage")}
            </span>
          </div>
          <h1 className="font-display text-5xl small:text-7xl text-white leading-[0.92]">
            {t("Shooting")} <span className="italic text-hunter-gold">{t("Wear")}</span>
          </h1>
        </div>
      </div>

      {/* Intro */}
      <div className="page-container py-12 small:py-16">
        <p className="max-w-xl font-serif text-lg small:text-xl text-[var(--theme-text-muted)] leading-relaxed">
          {t("Tradiția vânătorii britanice a produs un cod vestimentar rafinat în secole de practică Fiecare piesă are o funcție Fiecare alegere spune ceva despre cel care o poartă")}
        </p>
      </div>

      {/* Sections 01–02 */}
      <div className="border-t border-[var(--theme-border)]">
        <div className="page-container py-14 small:py-20">
          <div className="grid grid-cols-1 small:grid-cols-2 gap-x-20 gap-y-16 mb-16">
            {sections.slice(0, 2).map((s) => (
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

          {/* Image + sections 03–04 */}
          <div className="grid grid-cols-1 small:grid-cols-2 gap-8 small:gap-16 items-center mb-16">
            <div className="relative aspect-[4/5] overflow-hidden">
              <Image
                src="/landing/images/atelier.webp"
                alt="Atelier Hunter House"
                fill
                className="object-cover object-center"
              />
            </div>
            <div className="flex flex-col gap-12">
              {sections.slice(2, 4).map((s) => (
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

          {/* Sections 05–06 */}
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
      </div>

      {/* Full-width image */}
      <div className="relative w-full h-[40vh] small:h-[55vh] overflow-hidden">
        <Image
          src="/landing/images/ready-to-wear.webp"
          alt="Heritage Collection — Hunter House"
          fill
          className="object-cover object-center"
        />
        <div className="absolute inset-0 bg-black/30" />
      </div>

      {/* CTA */}
      <div className="border-t border-[var(--theme-border)]">
        <div className="page-container py-14 flex flex-col small:flex-row items-start small:items-center justify-between gap-8">
          <div>
            <p className="font-display text-3xl small:text-4xl text-[var(--theme-text)] leading-[1.05] mb-2">
              {t("Explorează colecția Heritage")}
            </p>
            <p className="font-sans text-sm text-[var(--theme-text-muted)] max-w-md">
              {t("Harris Tweed autentic, lână tradițională și accesorii de câmp Piesele care definesc tradiția britanică, disponibile la Hunter House")}
            </p>
          </div>
          <div className="flex flex-col small:flex-row gap-4 shrink-0">
            <button
              onClick={() => setOpen(true)}
              className="h-11 px-8 flex items-center font-sans text-[12px] uppercase tracking-[3px] bg-hunter-gold text-hunter-dark hover:opacity-90 transition-opacity cursor-pointer"
            >
              {t("Vezi colecția")}
            </button>
            <button
              onClick={() => setOpen(true)}
              className="h-11 px-8 flex items-center font-sans text-[12px] uppercase tracking-[3px] border border-[var(--theme-border)] text-[var(--theme-text-muted)] hover:text-hunter-gold hover:border-hunter-gold/40 transition-colors cursor-pointer"
            >
              {t("Consultație")}
            </button>
          </div>
        </div>
      </div>

      <AppointmentModal open={open} onClose={() => setOpen(false)} />
    </div>
  )
}

export default HuntingGuideTemplate
