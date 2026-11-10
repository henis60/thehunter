"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import Image from "next/image"
import AppointmentModal from "@modules/layout/components/appointment-modal"

const MadeToMeasureTemplate = () => {
  const [open, setOpen] = useState(false)
  const t = useTranslations("pages")

  const sections = [
    {
      title: t("Ce înseamnă Made to Measure"),
      body: t("Made to Measure nu este un costum dintr-o vitrină, ajustat ulterior Este un costum construit de la zero pe măsurătorile corpului tău - umerii, pieptul, talia, șoldurile, lungimea brațelor Fiecare element al tiparului este calibrat pentru silueta ta specifică Rezultatul este o purtare care nu poate fi replicată de niciun costum de serie, indiferent cât de bun ar fi"
      ),
    },
    {
      title: t("Consultația inițială"),
      body: t("Totul începe cu o conversație Discutăm ocazia pentru care este gândit costumul, stilul tău vizual, preferințele de siluetă - mai structural sau mai relaxat, cu cută sau fără, jacheta cu un rând de nasturi sau două Nu există răspuns greșit Croitorul ascultă și propune, nu impune La final ai o direcție clară înainte să atingem vreo țesătură"
      ),
    },
    {
      title: t("Alegerea țesăturii"),
      body: t("Lucrăm cu stocuri din cele mai bune filaturi europene - Loro Piana, Scabal, Vitale Barberis Canonico, Holland & Sherry Lână Super 120s pentru versatilitate, Super 150s și cachemire pentru ocazii de top, tweed și flanelă pentru sezon rece sau stil britanic Îți prezentăm mostrele fizic - textura și căderea nu se pot judeca pe ecran"
      ),
    },
    {
      title: t("Măsurătorile și construcția"),
      body: t("Luăm peste douăzeci de măsurători Tiparul este construit specific pentru tine, nu adaptat dintr-un tipar standard Interlining-ul cusut manual oferă structura jachetei - umărul cade natural, reverele se întorc fără să forțeze"
      ),
    },
    {
      title: t("Proba și ajustările finale"),
      body: t("A doua probă verifică ajustările și finisajele Este momentul detaliilor - lungimea exactă a mânecii, înălțimea gulerului, forma rever-ului Unele costume necesită o a treia probă dacă silueta sau cerințele sunt complexe Nu livrăm niciodată un costum care nu este perfect - preferăm să amânăm decât să compromitem"
      ),
    },
    {
      title: t("Durata și îngrijirea"),
      body: t("Un costum Made to Measure bine construit durează un deceniu sau mai mult dacă este îngrijit corect Depozitare pe umeraș anatomic, curățare chimică maximum o dată pe an, periere regulată după purtare Dacă silueta ta se schimbă în timp, costumul poate fi ajustat - tocmai pentru că este construit cu material în rezervă la cusături"
      ),
    },
  ]

  return (
    <div className="bg-[var(--theme-bg)] w-full min-h-screen">
      {/* Hero */}
      <div className="relative w-full h-[55vh] small:h-[70vh] overflow-hidden">
        <Image
          src="/landing/images/fitting.webp"
          alt="Fitting Made to Measure — Hunter House"
          fill
          className="object-cover object-center"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/20 to-black/75" />
        <div className="absolute bottom-0 left-0 right-0 page-container pb-10 small:pb-14">
          <div className="mb-4">
            <span className="font-sans text-[12px] uppercase tracking-[5px] text-white/60">
              {t("The Hunter House · Tailoring")}
            </span>
          </div>
          <h1 className="font-display text-5xl small:text-7xl text-white leading-[0.92]">
            {t("Made to")} <span className="italic text-hunter-gold">{t("Measure")}</span>
          </h1>
        </div>
      </div>

      {/* Intro */}
      <div className="page-container py-12 small:py-16">
        <p className="max-w-xl font-serif text-lg small:text-xl text-[var(--theme-text-muted)] leading-relaxed">
          {t("O experiență de croitorie personalizată, în care fiecare costum este creat după măsurătorile, stilul și preferințele tale Alegi materialele, detaliile și finisajele, iar noi construim o piesă cu o potrivire impecabilă și un caracter unic")}
        </p>
      </div>

      {/* Sections 01–02 */}
      <div className="border-t border-[var(--theme-border)]">
        <div className="page-container py-14 small:py-20">
          <div className="grid grid-cols-1 small:grid-cols-2 gap-x-20 gap-y-16">
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
        </div>
      </div>

      {/* Full-width image */}
      <div className="relative w-full h-[45vh] small:h-[60vh] overflow-hidden">
        <Image
          src="/landing/images/mtm.webp"
          alt="Made to Measure — Hunter House atelier"
          fill
          className="object-cover object-center"
        />
        <div className="absolute inset-0 bg-black/40" />
        <div className="absolute inset-0 flex items-center page-container">
          <div className="max-w-sm">
            <p className="font-sans text-[11px] uppercase tracking-[4px] text-hunter-gold mb-3">
              {t("Atelier Hunter House")}
            </p>
            <p className="font-display text-2xl small:text-3xl text-white leading-snug italic">
              {t("Peste douăzeci de măsurători Un singur costum Al tău")}
            </p>
          </div>
        </div>
      </div>

      {/* Image + sections 03–04 */}
      <div className="page-container py-14 small:py-20">
        <div className="grid grid-cols-1 small:grid-cols-2 gap-8 small:gap-16 items-center mb-16">
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
          <div className="relative aspect-[4/5] overflow-hidden">
            <Image
              src="/landing/images/atelier.webp"
              alt="Atelier Hunter House — țesături"
              fill
              className="object-cover object-center"
            />
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

      {/* CTA */}
      <div className="border-t border-[var(--theme-border)]">
        <div className="page-container py-14 flex flex-col small:flex-row items-start small:items-center justify-between gap-8">
          <div>
            <p className="font-display text-3xl small:text-4xl text-[var(--theme-text)] leading-[1.05] mb-2">
              {t("Începe cu o conversație")}
            </p>
            <p className="font-sans text-sm text-[var(--theme-text-muted)] max-w-md">
              {t("Prima întâlnire este fără obligații Îți arătăm atelierul, țesăturile și îți explicăm procesul pas cu pas")}
            </p>
          </div>
          <button
            onClick={() => setOpen(true)}
            className="shrink-0 h-11 px-8 flex items-center font-sans text-[12px] uppercase tracking-[3px] bg-hunter-gold text-hunter-dark hover:opacity-90 transition-opacity cursor-pointer"
          >
            {t("Programează o întâlnire")}
          </button>
        </div>
      </div>

      <AppointmentModal open={open} onClose={() => setOpen(false)} />
    </div>
  )
}

export default MadeToMeasureTemplate
