"use client"

import { useTranslations } from "next-intl"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import Accordion from "@modules/products/components/product-tabs/accordion"
import { serializeJsonLd } from "@lib/util/json-ld"

type FaqItem = { q: string; a: string }
type FaqGroup = { title: string; items: FaqItem[] }

const FAQTemplate = () => {
  const t = useTranslations("faq")

  const groups: FaqGroup[] = [
    {
      title: t("Comenzi"),
      items: [
        {
          q: t("Cum plasez o comandă?"),
          a: t("Alege produsul dorit, selectează mărimea și culoarea, apoi adaugă-l în coș La finalizarea comenzii completezi datele de livrare și de plată, iar imediat după confirmare primești un email cu rezumatul comenzii și detaliile de urmărire"
          ),
        },
        {
          q: t("Pot modifica sau anula o comandă?"),
          a: t("Da, atâta timp cât comanda nu a fost încă expediată Contactează-ne cât mai repede posibil, cu numărul comenzii la îndemână, și facem modificarea sau anularea După expediere, poți folosi politica de retur"
          ),
        },
        {
          q: t("Cum urmăresc statusul comenzii?"),
          a: t("După expediere primești pe email codul AWB și un link de urmărire Poți verifica oricând statusul și din contul tău, la secțiunea Comenzile mele"
          ),
        },
      ],
    },
    {
      title: t("Livrare"),
      items: [
        {
          q: t("Cât durează livrarea?"),
          a: t("Comenzile sunt procesate în 1–2 zile lucrătoare, iar coletul ajunge de regulă în 3–5 zile lucrătoare la adresa ta sau la punctul de ridicare ales"
          ),
        },
        {
          q: t("Cât costă transportul?"),
          a: t("Costul de livrare se calculează automat la finalizarea comenzii, în funcție de metoda aleasă Tariful exact îți este afișat înainte de plasarea comenzii"
          ),
        },
        {
          q: t("Livrați în toată România?"),
          a: t("Da, livrăm în toată țara prin curier rapid, atât la adresă, cât și la punctele de ridicare disponibile"
          ),
        },
      ],
    },
    {
      title: t("Retururi & Schimburi"),
      items: [
        {
          q: t("Care este politica de retur?"),
          a: t("Poți returna produsele în termen de 14 zile de la primire, fără să fie nevoie să motivezi decizia Produsele trebuie să fie nepurtate, cu etichetele atașate și în ambalajul original"
          ),
        },
        {
          q: t("Cât durează rambursarea banilor?"),
          a: t("După ce primim și verificăm produsul returnat, îți rambursăm contravaloarea în maximum 14 zile, folosind aceeași metodă de plată cu care ai achitat comanda"
          ),
        },
        {
          q: t("Cum schimb mărimea unui produs?"),
          a: t("Contactează-ne și îți spunem pașii pentru schimbul de mărime, în limita stocului disponibil Dacă mărimea dorită nu mai este disponibilă, îți oferim rambursarea integrală"
          ),
        },
      ],
    },
    {
      title: t("Plată"),
      items: [
        {
          q: t("Ce metode de plată acceptați?"),
          a: t("Acceptăm plata online securizată cu cardul (Visa, Mastercard) Tranzacțiile sunt procesate printr-un furnizor de plăți autorizat, cu protecție 3D Secure"
          ),
        },
        {
          q: t("Plata online este sigură?"),
          a: t("Da Datele cardului sunt criptate și procesate direct de furnizorul de plăți, prin conexiune securizată Acestea nu sunt stocate pe site-ul nostru și nu avem acces la ele"
          ),
        },
        {
          q: t("Primesc factură pentru comandă?"),
          a: t("Da, pentru fiecare comandă emitem factură, pe care o primești pe email împreună cu confirmarea comenzii"
          ),
        },
      ],
    },
  ]

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: groups.flatMap((group) =>
      group.items.map((item) => ({
        "@type": "Question",
        name: item.q,
        acceptedAnswer: {
          "@type": "Answer",
          text: item.a,
        },
      }))
    ),
  }

  return (
    <div className="bg-[var(--theme-bg)] w-full min-h-screen">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(faqSchema) }}
      />
      {/* Header */}
      <div className="page-container pt-6 pb-5">
        <div className="mb-3">
          <span className="font-sans text-[11px] uppercase tracking-[5px] text-[var(--theme-text-muted)]">
            {t("Ajutor")}
          </span>
        </div>
        <h1 className="font-display text-4xl small:text-6xl text-[var(--theme-text)] leading-[0.95]">
          {t("Întrebări")} <span className="italic text-hunter-gold">{t("frecvente")}</span>
        </h1>
        <p className="mt-4 max-w-md font-serif text-lg text-[var(--theme-text-muted)] leading-relaxed">
          {t("Răspunsuri la cele mai comune întrebări despre comenzi, livrare, retururi și plată"
          )}
        </p>
      </div>

      {/* Groups */}
      <div className="page-container py-10 flex flex-col gap-14">
        {groups.map((group) => (
          <section key={group.title}>
            <p className="font-sans text-[10px] uppercase tracking-[4px] text-[var(--theme-text-muted)] mb-5">
              {group.title}
            </p>
            <Accordion type="multiple">
              {group.items.map((item) => (
                <Accordion.Item key={item.q} title={item.q} value={item.q}>
                  <p className="font-sans text-sm leading-relaxed text-[var(--theme-text-muted)] max-w-2xl">
                    {item.a}
                  </p>
                </Accordion.Item>
              ))}
            </Accordion>
          </section>
        ))}

        {/* Contact footer */}
        <div className="bg-[var(--theme-surface)] border border-[var(--theme-border)] p-5 small:p-8 flex flex-col small:flex-row items-stretch small:items-center justify-between gap-5 small:gap-6">
          <div>
            <p className="font-display text-[20px] leading-[1.1] text-[var(--theme-text)] mb-1.5 small:mb-2">
              {t("Nu ai găsit răspunsul?")}
            </p>
            <p className="font-sans text-[13px] text-[var(--theme-text-muted)]">
              {t("Scrie-ne și te ajutăm cu plăcere")}
            </p>
          </div>
          <LocalizedClientLink
            href="/contact"
            className="shrink-0 h-11 px-6 inline-flex items-center justify-center border border-[var(--theme-border)] font-sans text-[11px] uppercase tracking-[3px] text-[var(--theme-text)] hover:border-hunter-gold hover:text-hunter-gold active:border-hunter-gold active:text-hunter-gold transition-colors"
          >
            {t("Contactează-ne")}
          </LocalizedClientLink>
        </div>
      </div>
    </div>
  )
}

export default FAQTemplate
