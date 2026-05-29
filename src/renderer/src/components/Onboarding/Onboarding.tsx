import { strings } from '@i18n'

const t = strings.onboarding

const STEPS = [
  { n: '01', label: t.step1 },
  { n: '02', label: t.step2 },
  { n: '03', label: t.step3 },
] as const

interface OnboardingProps {
  onDone: () => void
}

const Onboarding = ({ onDone }: OnboardingProps) => (
  <section
    className="flex flex-col items-center justify-center h-full px-14 gap-0"
    aria-labelledby="onboarding-title"
  >

    {/* Eyebrow */}
    <p
      className="font-mono text-[11px] text-muted-foreground/70 tracking-[0.4em] uppercase mb-8 animate-fade-in"
      aria-hidden="true"  /* decorative — title already describes the section */
    >
      {t.eyebrow}
    </p>

    {/* Main title */}
    <h1
      id="onboarding-title"
      className="font-display text-[64px] leading-[0.92] text-center text-foreground uppercase
                 animate-fade-up delay-100 mb-6"
    >
      {t.titleLine1}{' '}
      <span className="text-primary">{t.titleLine2}</span>{' '}
      {t.titleLine3}
    </h1>

    {/* Divider */}
    <div className="flex items-center gap-3 mb-8 animate-fade-up delay-200" aria-hidden="true">
      <div className="h-px w-16 bg-border" />
      <div className="w-1 h-1 rounded-full bg-muted-foreground/50" />
      <div className="h-px w-16 bg-border" />
    </div>

    {/* Steps — semantic ordered list */}
    <ol
      className="flex flex-col gap-3 mb-10 w-full max-w-xs animate-fade-up delay-300 list-none"
      aria-label="Como funciona"
    >
      {STEPS.map(({ n, label }) => (
        <li key={n} className="flex items-center gap-4">
          <span className="font-display text-2xl text-primary/70 w-8 shrink-0" aria-hidden="true">{n}</span>
          <span className="text-muted-foreground text-xs tracking-wide">{label}</span>
        </li>
      ))}
    </ol>

    {/* CTA */}
    <button
      onClick={onDone}
      className="animate-fade-up delay-400 w-full max-w-xs h-12 bg-primary text-primary-foreground
                 font-display text-xl tracking-[0.12em] uppercase
                 hover:bg-primary/90 active:scale-[0.98] transition-all duration-150"
      aria-label={`${t.startBtn} — ${t.oneTimeNote}`}
    >
      {t.startBtn}
    </button>

    <p className="mt-5 text-[11px] text-muted-foreground/50 tracking-widest animate-fade-in delay-600">
      {t.oneTimeNote}
    </p>
  </section>
)

export default Onboarding
