import { strings } from '@i18n'

const t = strings.onboarding

// ── Icons ─────────────────────────────────────────────────────────────────────

const ScreenIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <rect x="1.5" y="2.5" width="17" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
    <path d="M7 17.5h6M10 14.5v3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
  </svg>
)

const CamIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <rect x="1.5" y="5.5" width="12" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
    <path d="M13.5 8.5l5-3v9l-5-3" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    <circle cx="7.5" cy="10" r="2" stroke="currentColor" strokeWidth="1.1" />
  </svg>
)

const AIIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <path d="M10 2v2M10 16v2M2 10h2M16 10h2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    <circle cx="10" cy="10" r="4.5" stroke="currentColor" strokeWidth="1.3" />
    <circle cx="10" cy="10" r="1.5" fill="currentColor" />
    <path d="M6.5 6.5l1.2 1.2M12.3 12.3l1.2 1.2M13.5 6.5l-1.2 1.2M7.7 12.3l-1.2 1.2"
      stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
  </svg>
)

const ExportIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <rect x="3" y="2.5" width="10" height="13" rx="1" stroke="currentColor" strokeWidth="1.3" />
    <path d="M8 5.5h4M8 8.5h4M8 11.5h2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    <path d="M13 13l4 4M15 13h2v2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

// ── Steps data ────────────────────────────────────────────────────────────────

const STEPS = [
  {
    n: '01',
    label: t.step1Label,
    desc: t.step1Desc,
    icon: <div className="flex gap-2">
      <span className="text-primary"><ScreenIcon /></span>
      <span className="text-primary/60"><CamIcon /></span>
    </div>,
  },
  {
    n: '02',
    label: t.step2Label,
    desc: t.step2Desc,
    icon: <span className="text-primary"><AIIcon /></span>,
  },
  {
    n: '03',
    label: t.step3Label,
    desc: t.step3Desc,
    icon: <span className="text-primary"><ExportIcon /></span>,
  },
] as const

// ── Component ─────────────────────────────────────────────────────────────────

interface OnboardingProps {
  onDone: () => void
}

const Onboarding = ({ onDone }: OnboardingProps) => (
  <section
    className="flex flex-col items-center justify-center h-full px-10 gap-0 overflow-y-auto"
    aria-labelledby="onboarding-title"
  >

    {/* Eyebrow */}
    <p className="font-mono text-[10px] text-muted-foreground/60 tracking-[0.4em] uppercase mb-5 animate-fade-in"
      aria-hidden="true">
      {t.eyebrow}
    </p>

    {/* Hero title */}
    <h1
      id="onboarding-title"
      className="font-display text-[58px] leading-[0.9] text-center text-foreground uppercase
                 animate-fade-up delay-100 mb-7"
    >
      {t.titleLine1}{' '}
      <span className="text-primary">{t.titleLine2}</span>{' '}
      {t.titleLine3}
    </h1>

    {/* Divider */}
    <div className="flex items-center gap-3 mb-7 animate-fade-up delay-200" aria-hidden="true">
      <div className="h-px w-12 bg-border" />
      <div className="w-1 h-1 rounded-full bg-border" />
      <div className="h-px w-12 bg-border" />
    </div>

    {/* Steps */}
    <ol className="flex flex-col gap-0 mb-6 w-full max-w-[300px] animate-fade-up delay-300 list-none">
      {STEPS.map(({ n, label, desc, icon }, i) => (
        <li key={n} className="flex gap-4 relative">
          {/* Connector line between steps */}
          {i < STEPS.length - 1 && (
            <div className="absolute left-[19px] top-[36px] w-px h-[calc(100%-12px)] bg-border/50" aria-hidden="true" />
          )}

          {/* Step number circle */}
          <div className="shrink-0 flex flex-col items-center">
            <div className="w-10 h-10 rounded-full border border-border/60 flex items-center justify-center bg-card">
              {icon}
            </div>
          </div>

          {/* Content */}
          <div className="pb-5 pt-2">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="font-mono text-[10px] text-muted-foreground/50 tracking-widest">{n}</span>
              <span className="font-display text-base tracking-wide text-foreground uppercase">{label}</span>
            </div>
            <p className="text-muted-foreground text-[11px] leading-relaxed">{desc}</p>
          </div>
        </li>
      ))}
    </ol>

    {/* Dual-video callout */}
    <div className="w-full max-w-[300px] mb-7 animate-fade-up delay-400
                    border border-primary/25 bg-primary/5 px-4 py-3">
      <div className="flex items-start gap-3">
        <div className="flex gap-1 mt-0.5 shrink-0">
          <span className="text-primary/80"><ScreenIcon /></span>
          <span className="text-primary/40"><CamIcon /></span>
        </div>
        <div>
          <p className="font-display text-sm tracking-wide text-primary uppercase mb-0.5">
            {t.dualVideoTitle}
          </p>
          <p className="text-muted-foreground text-[11px] leading-relaxed">
            {t.dualVideoDesc}
          </p>
        </div>
      </div>
    </div>

    {/* CTA */}
    <button
      onClick={onDone}
      className="animate-fade-up delay-500 w-full max-w-[300px] h-12
                 bg-primary text-primary-foreground
                 font-display text-xl tracking-[0.12em] uppercase
                 hover:bg-primary/90 active:scale-[0.98] transition-all duration-150"
      aria-label={`${t.startBtn} — ${t.oneTimeNote}`}
    >
      {t.startBtn}
    </button>

    <p className="mt-4 text-[10px] text-muted-foreground/40 tracking-widest animate-fade-in delay-600">
      {t.oneTimeNote}
    </p>

  </section>
)

export default Onboarding
