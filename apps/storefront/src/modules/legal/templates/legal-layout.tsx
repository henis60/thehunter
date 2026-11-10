type LegalSection = {
  title: string
  body: React.ReactNode
}

type Props = {
  kicker: string
  title: string
  intro?: string
  sections: LegalSection[]
}

const LegalLayout = ({ kicker, title, intro, sections }: Props) => {
  return (
    <div className="bg-[var(--theme-bg)] w-full min-h-screen">
      {/* Header */}
      <div className="page-container pt-6 pb-5">
        <div className="mb-3">
          <span className="font-sans text-[12px] uppercase tracking-[5px] text-[var(--theme-text-muted)]">
            {kicker}
          </span>
        </div>
        <h1 className="font-display text-4xl small:text-6xl text-[var(--theme-text)] leading-[0.95]">
          {title}
        </h1>
        {intro && (
          <p className="mt-4 max-w-xl font-serif text-lg text-[var(--theme-text-muted)] leading-relaxed">
            {intro}
          </p>
        )}
      </div>

      {/* Sections */}
      <div className="page-container py-10 flex flex-col gap-12">
        {sections.map((s) => (
          <section
            key={s.title}
            className="border-t border-[var(--theme-border)] pt-8"
          >
            <h2 className="font-display text-2xl leading-tight text-[var(--theme-text)] mb-4">
              {s.title}
            </h2>
            <div className="font-sans text-sm leading-relaxed text-[var(--theme-text-muted)] flex flex-col gap-4">
              {s.body}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}

export default LegalLayout
