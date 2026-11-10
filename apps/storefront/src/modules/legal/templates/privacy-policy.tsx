import { getTranslations } from "next-intl/server"

function Section({
  label,
  title,
  children,
}: {
  label?: string
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="grid grid-cols-1 small:grid-cols-[180px_1fr] gap-4 small:gap-10 border-t border-[var(--theme-border)] pt-8">
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

const PrivacyPolicyTemplate = async () => {
  const t = await getTranslations("legal")
  return (
    <div className="bg-[var(--theme-bg)] w-full min-h-screen">
      {/* Header */}
      <div className="page-container pt-6 pb-5">
        <div className="mb-3">
          <span className="font-sans text-[12px] uppercase tracking-[5px] text-[var(--theme-text-muted)]">
            {t("Legal")}
          </span>
        </div>
        <h1 className="font-display text-4xl small:text-6xl text-[var(--theme-text)] leading-[0.95]">
          {t("Politica de")} <span className="italic text-hunter-gold">{t("Confidențialitate")}</span>
        </h1>
        <p className="mt-4 max-w-md font-serif text-lg text-[var(--theme-text-muted)] leading-relaxed">
          {t("Cum colectăm, folosim și protejăm datele tale personale, conform GDPR")}
        </p>
      </div>

      {/* Sections */}
      <div className="page-container py-10 flex flex-col gap-12">
        <Section label={t("GDPR")} title={t("Operatorul de date")}>
          <p>
            {t("Datele tale cu caracter personal sunt prelucrate de")}{" "}
            <span className="text-[var(--theme-text)]">
              S.C. BOJO HOUSE S.R.L.
            </span>
            {", "}
            {t("cu sediul în")} Str. Piața Eroilor, nr. 2, Târgu Lăpuș, Maramureș,{" "}
            {t("CUI")} 47739604{", "}
            {t("înregistrată la Registrul Comerțului sub nr")} J24/356/2023.
          </p>
          <p>
            {t("Pentru orice întrebare legată de datele tale, ne poți scrie la")}{" "}
            <a
              href="mailto:contact@thehunter.ro"
              className="text-[var(--theme-text)] border-b border-hunter-gold/40 hover:border-hunter-gold transition-colors"
            >
              contact@thehunter.ro
            </a>
            .
          </p>
        </Section>

        <Section title={t("Ce date colectăm")}>
          <ul className="flex flex-col gap-1.5 list-disc pl-5">
            <li>{t("Date de identificare și contact: nume, email, telefon, adresă")}</li>
            <li>{t("Date despre comenzi: produse, valoare, istoric")}</li>
            <li>{t("Date de livrare: adresă, detalii curier")}</li>
            <li>
              {t("Date tehnice: adresă IP, tip de browser, cookies (vezi politica de cookies)")}
            </li>
          </ul>
        </Section>

        <Section title={t("Scopul prelucrării")}>
          <ul className="flex flex-col gap-1.5 list-disc pl-5">
            <li>{t("Procesarea și livrarea comenzilor")}</li>
            <li>{t("Emiterea documentelor fiscale")}</li>
            <li>{t("Asistență și comunicare cu tine")}</li>
            <li>{t("Respectarea obligațiilor legale")}</li>
            <li>{t("Marketing, doar cu acordul tău explicit")}</li>
          </ul>
        </Section>

        <Section title={t("Temeiul legal")}>
          <p>
            {t("Prelucrăm datele în baza executării contractului (comanda ta), a obligațiilor legale (ex fiscale), a interesului legitim și, după caz, a"
            )}{" "}
            <span className="text-[var(--theme-text)]">{t("consimțământului")}</span> {t("tău")}
          </p>
        </Section>

        <Section title={t("Cât timp păstrăm datele")}>
          <p>
            {t("Păstrăm datele atât cât este necesar pentru scopurile de mai sus și conform termenelor legale (ex documentele contabile se păstrează conform legislației în vigoare)"
            )}
          </p>
        </Section>

        <Section title={t("Cui dezvăluim datele")}>
          <p>
            {t("Putem transmite date către furnizori de servicii care ne ajută să îți onorăm comanda: curieri, procesatori de plăți, furnizori IT Aceștia prelucrează datele doar în limita instrucțiunilor noastre"
            )}
          </p>
        </Section>

        <Section label={t("GDPR Art 15–21")} title={t("Drepturile tale")}>
          <p>
            {t("Conform GDPR, ai dreptul de acces, rectificare, ștergere, restricționare, portabilitate și opoziție, precum și dreptul de a-ți retrage consimțământul oricând"
            )}
          </p>
          <p>
            {t("Îți poți exercita drepturile scriindu-ne la")}{" "}
            <a
              href="mailto:contact@thehunter.ro"
              className="text-[var(--theme-text)] border-b border-hunter-gold/40 hover:border-hunter-gold transition-colors"
            >
              contact@thehunter.ro
            </a>
            {t(" De asemenea, ai dreptul de a depune o plângere la")}{" "}
            <a
              href="https://www.dataprotection.ro"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--theme-text)] border-b border-hunter-gold/40 hover:border-hunter-gold transition-colors"
            >
              {t("ANSPDCP")}
            </a>
            .
          </p>
        </Section>
      </div>
    </div>
  )
}

export default PrivacyPolicyTemplate
