import { strings } from '@i18n'

const t = strings.onboarding

// ── Icons ─────────────────────────────────────────────────────────────────────

const ScreenIcon = ({ size = 22 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <rect x="1.5" y="2.5" width="17" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
    <path d="M7 17.5h6M10 14.5v3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
  </svg>
)

const CamIcon = ({ size = 22 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <rect x="1.5" y="5.5" width="12" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
    <path d="M13.5 8.5l5-3v9l-5-3" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    <circle cx="7.5" cy="10" r="2" stroke="currentColor" strokeWidth="1.1" />
  </svg>
)

const AIIcon = () => (
  <svg width="22" height="22" viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <path d="M10 2v2M10 16v2M2 10h2M16 10h2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    <circle cx="10" cy="10" r="4.5" stroke="currentColor" strokeWidth="1.3" />
    <circle cx="10" cy="10" r="1.5" fill="currentColor" />
    <path d="M6.5 6.5l1.2 1.2M12.3 12.3l1.2 1.2M13.5 6.5l-1.2 1.2M7.7 12.3l-1.2 1.2"
      stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
  </svg>
)

const ExportIcon = () => (
  <svg width="22" height="22" viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <rect x="3" y="2.5" width="10" height="13" rx="1" stroke="currentColor" strokeWidth="1.3" />
    <path d="M8 5.5h4M8 8.5h4M8 11.5h2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    <path d="M13 13l4 4M15 13h2v2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

// ── Steps ─────────────────────────────────────────────────────────────────────

const STEPS = [
  {
    n: '01',
    label: t.step1Label,
    desc: t.step1Desc,
    icon: (
      <div className="flex gap-2 items-center">
        <span className="text-primary"><ScreenIcon /></span>
        <span className="text-primary/55"><CamIcon /></span>
      </div>
    ),
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
    className="flex flex-col h-full py-8 overflow-y-auto"
    style={{ padding: 'clamp(24px, 4vw, 72px)' }}
    aria-labelledby="onboarding-title"
  >
    {/* Two-column layout — ocupa todo o espaço disponível */}
    <div className="flex-1 flex items-center gap-[clamp(32px,4vw,72px)] w-full">

      {/* ── LEFT — Pitch ─────────────────────────────────────────────────── */}
      <div className="flex-[4] flex flex-col justify-center min-w-0">

        {/* Eyebrow */}
        <p
          className="font-mono text-[10px] text-primary/70 tracking-[0.45em] uppercase
                     mb-5 animate-fade-in flex items-center gap-2"
          aria-hidden="true"
        >
          <span className="w-1 h-1 rounded-full bg-primary inline-block" />
          {t.eyebrow}
        </p>

        {/* Hero title — escala com a janela */}
        <h1
          id="onboarding-title"
          className="font-display leading-[0.86] text-foreground uppercase animate-fade-up delay-75 mb-7"
          style={{ fontSize: 'clamp(68px, 8vw, 120px)' }}
        >
          {t.titleLine1}
          <br />
          <span className="text-primary text-glow-amber">{t.titleLine2}</span>
          <br />
          <span className="text-foreground/60">{t.titleLine3}</span>
        </h1>

        {/* Decorative accent */}
        <div className="flex items-center gap-3 mb-8 animate-fade-up delay-150" aria-hidden="true">
          <div className="h-px w-10 bg-primary/30" />
          <div className="w-1 h-1 rounded-full bg-primary/50" />
          <div className="h-px w-20 bg-gradient-to-r from-primary/20 to-transparent" />
        </div>

        {/* CTA */}
        <button
          onClick={onDone}
          className="btn-shine animate-fade-up delay-200
                     w-full h-12 bg-primary text-primary-foreground
                     font-display text-xl tracking-[0.14em] uppercase
                     hover:bg-primary/90 active:scale-[0.98] transition-all duration-150
                     shadow-[0_4px_28px_hsl(var(--primary)/0.3)]"
          aria-label={`${t.startBtn} — ${t.oneTimeNote}`}
        >
          {t.startBtn}
        </button>

        <p className="mt-3 font-mono text-[11px] text-muted-foreground/65 tracking-widest text-center animate-fade-in delay-300">
          {t.oneTimeNote}
        </p>
      </div>

      {/* Vertical separator */}
      <div className="self-stretch w-px bg-gradient-to-b from-transparent via-border/40 to-transparent shrink-0" aria-hidden="true" />

      {/* ── RIGHT — Steps ────────────────────────────────────────────────── */}
      <div className="flex-[5] flex flex-col gap-2 min-w-0">

        {/* Step cards */}
        <ol className="flex flex-col gap-2 list-none">
          {STEPS.map(({ n, label, desc, icon }, i) => (
            <li
              key={n}
              className="animate-fade-up"
              style={{ animationDelay: `${0.2 + i * 0.09}s` }}
            >
              <div
                className="relative flex items-center gap-4 px-5 py-4 overflow-hidden
                           border border-border/40 border-l-2 border-l-primary/40
                           bg-card/30 hover:bg-card/55 hover:border-l-primary/70
                           transition-all duration-200 group"
              >
                {/* Watermark step number */}
                <span
                  className="absolute right-4 top-1/2 -translate-y-1/2 font-display leading-none
                             text-[56px] text-foreground/[0.04] select-none pointer-events-none"
                  aria-hidden="true"
                >
                  {n}
                </span>

                {/* Icon */}
                <div
                  className="shrink-0 w-12 h-12 rounded-full
                             border border-primary/25 bg-primary/[0.07]
                             flex items-center justify-center
                             group-hover:border-primary/45 group-hover:bg-primary/[0.11]
                             transition-all duration-200
                             shadow-[inset_0_1px_0_hsl(var(--primary)/0.1)]"
                >
                  {icon}
                </div>

                {/* Text */}
                <div className="min-w-0 pr-12">
                  <p className="font-display text-[17px] tracking-[0.05em] text-foreground uppercase mb-0.5">
                    {label}
                  </p>
                  <p className="text-muted-foreground/65 text-[12.5px] leading-relaxed">
                    {desc}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ol>

        {/* Dual-video callout */}
        <div
          className="animate-fade-up delay-400
                     border border-primary/20 border-l-2 border-l-primary/50
                     bg-primary/[0.04] px-5 py-3
                     shadow-[inset_0_1px_0_hsl(var(--primary)/0.07)]"
        >
          <div className="flex items-start gap-3">
            <div className="flex gap-1 mt-0.5 shrink-0">
              <span className="text-primary/80"><ScreenIcon size={16} /></span>
              <span className="text-primary/40"><CamIcon size={16} /></span>
            </div>
            <div>
              <p className="font-display text-base tracking-wide text-primary uppercase mb-1">
                {t.dualVideoTitle}
              </p>
              <p className="text-muted-foreground/65 text-[12.5px] leading-relaxed">
                {t.dualVideoDesc}
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  </section>
)

export default Onboarding
