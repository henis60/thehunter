import { getTranslations } from "next-intl/server"

import ContactForm from "@modules/contact/components/contact-form"
import AccountFaqStrip from "@modules/account/components/account-faq-strip"

const ContactTemplate = async () => {
  const t = await getTranslations("contact")
  return (
    <div className="bg-[var(--theme-bg)] w-full min-h-screen">
      {/* Header */}
      <div className="page-container pt-6 pb-4">
        <div className="mb-3">
          <span className="font-sans text-[12px] uppercase tracking-[5px] text-[var(--theme-text-muted)]">
            {t("Contact")}
          </span>
        </div>
        <h1 className="font-display text-4xl small:text-6xl text-[var(--theme-text)] leading-[0.95] mb-3">
          {t("Contactează-ne")}
        </h1>
        <p className="max-w-md font-serif text-lg text-[var(--theme-text-muted)] leading-relaxed">
          {t("Ai o întrebare despre o comandă, un produs sau o colaborare? Scrie-ne și revenim cât mai curând")}
        </p>
      </div>

      {/* Body */}
      <div className="page-container pb-8 flex flex-col gap-8">
        {/* Form */}
        <div className="bg-[var(--theme-surface)] border border-[var(--theme-border)] p-6 small:p-8">
          <ContactForm />
        </div>

        {/* Details + map */}
        <div className="grid grid-cols-1 small:grid-cols-2 gap-6 small:gap-10 items-stretch">
          {/* Contact details */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-4 small:gap-x-8 small:gap-y-6 self-center">
            <div>
              <p className="font-sans text-[10px] small:text-[11px] uppercase tracking-[4px] text-[var(--theme-text-muted)] mb-1 small:mb-2">
                {t("Email")}
              </p>
              <a
                href="mailto:contact@thehunter.ro"
                className="font-serif text-sm small:text-lg text-[var(--theme-text)] hover:text-hunter-gold transition-colors break-all"
              >
                contact@thehunter.ro
              </a>
            </div>
            <div>
              <p className="font-sans text-[10px] small:text-[11px] uppercase tracking-[4px] text-[var(--theme-text-muted)] mb-1 small:mb-2">
                {t("Telefon")}
              </p>
              <a
                href="tel:+40765080667"
                className="font-serif text-sm small:text-lg text-[var(--theme-text)] hover:text-hunter-gold transition-colors"
              >
                +40 765 080 667
              </a>
            </div>
            <div>
              <p className="font-sans text-[10px] small:text-[11px] uppercase tracking-[4px] text-[var(--theme-text-muted)] mb-1 small:mb-2">
                {t("Locație")}
              </p>
              <a
                href="https://maps.app.goo.gl/zdCeRp3LB2uJeLX49"
                target="_blank"
                rel="noopener noreferrer"
                className="font-serif text-sm small:text-lg text-[var(--theme-text)] hover:text-hunter-gold transition-colors"
              >
                {t("Bulevardul Unirii 7, Baia Mare")}
              </a>
            </div>
            <div>
              <p className="font-sans text-[10px] small:text-[11px] uppercase tracking-[4px] text-[var(--theme-text-muted)] mb-1 small:mb-2">
                {t("Program")}
              </p>
              <p className="font-serif text-sm small:text-lg text-[var(--theme-text)] leading-snug">
                {t("Luni – Vineri · 07:00 – 18:00")}
                <br />
                {t("Sâmbătă · 09:00 – 14:30")}
              </p>
            </div>
          </div>

          {/* Map */}
          <a
            href="https://maps.app.goo.gl/zdCeRp3LB2uJeLX49"
            target="_blank"
            rel="noopener noreferrer"
            className="block border border-[var(--theme-border)] min-h-[200px]"
          >
            <iframe
              title={t("Hartă - Bulevardul Unirii 7, Baia Mare")}
              src="https://www.google.com/maps?q=Bulevardul+Unirii+7,+Baia+Mare&output=embed"
              width="100%"
              height="100%"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              className="block w-full h-full min-h-[200px] grayscale-[0.3] pointer-events-none"
              style={{ border: 0 }}
            />
          </a>
        </div>

        {/* FAQ link */}
        <AccountFaqStrip />
      </div>
    </div>
  )
}

export default ContactTemplate
