import { getTranslations } from "next-intl/server"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import Image from "next/image"

function Section({
  id,
  label,
  title,
  children,
}: {
  id?: string
  label?: string
  title: string
  children: React.ReactNode
}) {
  return (
    <section id={id} className="grid grid-cols-1 small:grid-cols-[180px_1fr] gap-4 small:gap-10 border-t border-[var(--theme-border)] pt-8 scroll-mt-24">
      <div>
        {label && (
          <p className="font-sans text-[11px] uppercase tracking-[4px] text-[var(--theme-text-muted)] mb-2">
            {label}
          </p>
        )}
        <h2 className="font-display text-2xl leading-tight text-[var(--theme-text)]">
          {title}
        </h2>
      </div>
      <div className="font-sans text-sm leading-relaxed text-[var(--theme-text-muted)] flex flex-col gap-4 max-w-2xl">
        {children}
      </div>
    </section>
  )
}

const CustomerServiceTemplate = async () => {
  const t = await getTranslations("customer-service")

  return (
    <div className="bg-[var(--theme-bg)] w-full min-h-screen">
      {/* Header */}
      <div className="page-container pt-6 pb-5">
        <div className="mb-3">
          <span className="font-sans text-[12px] uppercase tracking-[5px] text-[var(--theme-text-muted)]">
            {t("Asistență")}
          </span>
        </div>
        <h1 className="font-display text-4xl small:text-6xl text-[var(--theme-text)] leading-[0.95]">
          {t("Relații cu")} <span className="italic text-hunter-gold">{t("clienții")}</span>
        </h1>
        <p className="mt-4 max-w-md font-serif text-lg text-[var(--theme-text-muted)] leading-relaxed">
          {t("Tot ce trebuie să știi despre comenzi, livrare, retur, mărimi și drepturile tale ca și consumator"
          )}
        </p>
      </div>

      {/* Sections */}
      <div className="page-container py-10 flex flex-col gap-12">
        <Section title={t("Contact și program")}>
          <p>
            {t("Ne poți scrie oricând pe email la")}{" "}
            <a
              href="mailto:contact@thehunter.ro"
              className="text-[var(--theme-text)] border-b border-hunter-gold/40 hover:border-hunter-gold transition-colors"
            >
              contact@thehunter.ro
            </a>{" "}
            {t("sau ne poți suna la")}{" "}
            <a
              href="tel:+40765080667"
              className="text-[var(--theme-text)] border-b border-hunter-gold/40 hover:border-hunter-gold transition-colors"
            >
              +40 765 080 667
            </a>
            .
          </p>
          <p>
            {t("Program de lucru: luni – vineri 07:00 – 18:00, sâmbătă 09:00 – 14:30 Răspundem la mesaje în maximum 24 de ore în zilele lucrătoare"
            )}
          </p>
          <p>
            {t("Ne găsești și la adresa")}{" "}
            <a
              href="https://maps.app.goo.gl/zdCeRp3LB2uJeLX49"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--theme-text)] border-b border-hunter-gold/40 hover:border-hunter-gold transition-colors"
            >
              {t("Bulevardul Unirii 7, Baia Mare")}
            </a>
            .
          </p>
          <p>
            {t("Pentru a programa o consultație sau o sesiune made to measure, scrie-ne un mesaj și revenim cu detalii despre pași și termene"
            )}
          </p>
          <LocalizedClientLink
            href="/contact"
            className="shrink-0 h-11 px-6 inline-flex items-center justify-center border border-[var(--theme-border)] font-sans text-[12px] uppercase tracking-[3px] text-[var(--theme-text)] hover:border-hunter-gold hover:text-hunter-gold active:border-hunter-gold active:text-hunter-gold transition-colors w-fit"
          >
            {t("Deschide formularul de contact")}
          </LocalizedClientLink>
        </Section>

        <Section title={t("Comenzi și livrare")}>
          <p>
            {t("Plasezi comanda direct din magazin: alegi produsul, mărimea și culoarea, apoi finalizezi în câțiva pași Primești confirmarea pe email imediat"
            )}
          </p>
          <p>
            <span className="text-[var(--theme-text)]">{t("Plată:")}</span>{" "}
            {t("online, securizat, cu cardul")}
          </p>
          <p>
            <span className="text-[var(--theme-text)]">{t("Livrare:")}</span>{" "}
            {t("prin curier, în 3–5 zile lucrătoare, în toată România Vei primi un cod de urmărire (tracking) pentru a-ți monitoriza coletul"
            )}
          </p>
          <div className="pt-2">
            <Image
              src="/payments/netopia-badge-light.png"
              alt="Plăți securizate cu Netopia Payments"
              width={1852}
              height={349}
              className="h-7 w-auto dark:hidden"
            />
            <Image
              src="/payments/netopia-badge-dark.png"
              alt="Plăți securizate cu Netopia Payments"
              width={1852}
              height={349}
              className="hidden h-7 w-auto dark:block"
            />
          </div>
        </Section>

        <Section id="retur" title={t("Retur, schimb și rambursare")}>
          <p>
            {t("Conform legislației din România și UE, ai dreptul de retragere în")}{" "}
            <span className="text-[var(--theme-text)]">{t("14 zile")}</span>{" "}
            {t("de la primirea produselor standard, fără a fi nevoie să justifici decizia")}
          </p>
          <p>
            {t("Returul se inițiază scriindu-ne pe email Produsele trebuie să fie nepurtate, în stare originală și cu eticheta atașată Rambursarea se face în maximum 14 zile de la primirea înștiințării de retragere"
            )}
          </p>
          <p className="text-[var(--theme-text)]">
            {t("Important: produsele personalizate sau confecționate la comandă (pe măsură) sunt exceptate de la dreptul de retragere și nu pot fi returnate, conform legii"
            )}
          </p>
        </Section>

        <Section title={t("Mărimi și produs")}>
          <p>
            {t("Consultă ghidul de mărimi înainte de comandă pentru a alege corect Dacă ești între două mărimi, scrie-ne și te ajutăm"
            )}
          </p>
          <p>
            {t("Respectă instrucțiunile de îngrijire de pe etichetă pentru a păstra calitatea materialelor Culorile reale pot diferi ușor față de fotografii, în funcție de ecran și de iluminare"
            )}
          </p>
        </Section>

        <Section title={t("Garanție și conformitate")}>
          <p>
            {t("Beneficiezi de garanția legală de conformitate de")}{" "}
            <span className="text-[var(--theme-text)]">{t("2 ani")}</span>
            {t(", conform legislației UE")}
          </p>
          <p>
            {t("Dacă ai primit un produs cu defect, scrie-ne pe email cu numărul comenzii și o descriere a problemei, iar noi ne ocupăm de reparare, înlocuire sau rambursare, după caz"
            )}
          </p>
        </Section>

        <Section title={t("Informații legale")}>
          <ul className="flex flex-col gap-1.5">
            <li>{t("Denumire firmă:")} S.C. BOJO HOUSE S.R.L.</li>
            <li>{t("Nr Reg Comerțului:")} J24/356/2023</li>
            <li>{t("CUI:")} 47739604</li>
            <li>{t("Adresă:")} Str. Piața Eroilor, nr. 2, Târgu Lăpuș, Maramureș</li>
          </ul>
          <div className="flex flex-col gap-1.5">
            <a
              href="https://anpc.ro"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--theme-text)] border-b border-hunter-gold/40 hover:border-hunter-gold transition-colors w-fit"
            >
              {t("ANPC - Autoritatea Națională pentru Protecția Consumatorilor")}
            </a>
            <a
              href="https://ec.europa.eu/consumers/odr"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--theme-text)] border-b border-hunter-gold/40 hover:border-hunter-gold transition-colors w-fit"
            >
              {t("Platforma SOL / ODR a Comisiei Europene")}
            </a>
          </div>
          <p>
            {t("Litigiile pot fi soluționate și pe cale alternativă (SAL), prin intermediul ANPC")}
          </p>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            <LocalizedClientLink
              href="/terms-of-use"
              className="font-sans text-[12px] uppercase tracking-[3px] text-[var(--theme-text-muted)] hover:text-hunter-gold transition-colors"
            >
              {t("Termeni și condiții")}
            </LocalizedClientLink>
            <LocalizedClientLink
              href="/privacy-policy"
              className="font-sans text-[12px] uppercase tracking-[3px] text-[var(--theme-text-muted)] hover:text-hunter-gold transition-colors"
            >
              {t("Politica de confidențialitate")}
            </LocalizedClientLink>
            <LocalizedClientLink
              href="/cookie-policy"
              className="font-sans text-[12px] uppercase tracking-[3px] text-[var(--theme-text-muted)] hover:text-hunter-gold transition-colors"
            >
              {t("Politica de cookies")}
            </LocalizedClientLink>
          </div>
        </Section>

        <div className="bg-[var(--theme-surface)] border border-[var(--theme-border)] p-5 small:p-8 flex flex-col small:flex-row items-stretch small:items-center justify-between gap-5 small:gap-6">
          <div>
            <p className="font-display text-[20px] leading-[1.1] text-[var(--theme-text)] mb-1.5 small:mb-2">
              {t("Întrebări frecvente")}
            </p>
            <p className="font-sans text-[14px] text-[var(--theme-text-muted)]">
              {t("Încă ai întrebări? Răspunsurile la cele mai comune întrebări despre comenzi, livrare, retur și plată sunt pe pagina dedicată"
              )}
            </p>
          </div>
          <LocalizedClientLink
            href="/faq"
            className="shrink-0 h-11 px-6 inline-flex items-center justify-center border border-[var(--theme-border)] font-sans text-[12px] uppercase tracking-[3px] text-[var(--theme-text)] hover:border-hunter-gold hover:text-hunter-gold active:border-hunter-gold active:text-hunter-gold transition-colors"
          >
            {t("Vezi întrebările frecvente")}
          </LocalizedClientLink>
        </div>
      </div>
    </div>
  )
}

export default CustomerServiceTemplate
