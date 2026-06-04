import { useState, useEffect } from 'react'
import { strings } from '@i18n'
import { useApp, useAuth } from '@hooks'
import {
  Onboarding, StepUpload, StepProcess, StepDone,
  AuthScreen, AccountSettings
} from '@components'

// ── Background effects ────────────────────────────────────────────────────────

const Background = () => (
  <>
    {/* Dot grid */}
    <div className="dot-grid pointer-events-none fixed inset-0 z-0 opacity-100" aria-hidden="true" />
    {/* Ambient amber glow — center */}
    <div
      className="ambient-glow z-0"
      style={{ width: 600, height: 600, left: '50%', top: '50%', transform: 'translate(-50%,-50%)' }}
      aria-hidden="true"
    />
    {/* Film grain */}
    <svg
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 h-full w-full z-10 opacity-[0.028] mix-blend-soft-light"
      xmlns="http://www.w3.org/2000/svg"
    >
      <filter id="grain">
        <feTurbulence type="fractalNoise" baseFrequency="0.68" numOctaves="4" stitchTiles="stitch" />
        <feColorMatrix type="saturate" values="0" />
      </filter>
      <rect width="100%" height="100%" filter="url(#grain)" />
    </svg>
  </>
)

// ── Step labels ───────────────────────────────────────────────────────────────

const STEP_LABELS: Record<string, string> = {
  upload: strings.stepLabels.upload,
  process: strings.stepLabels.process,
  done: strings.stepLabels.done,
}

const STEP_ORDER = ['upload', 'process', 'done'] as const

// ── App ───────────────────────────────────────────────────────────────────────

// macOS traffic lights (~72px) need extra left padding so the wordmark doesn't overlap them
const isMac = /mac/i.test(navigator.platform)

const App = () => {
  const { user, loading: authLoading, isResetting, finishReset, signOut } = useAuth()
  const {
    step, videoPath, webcamPath, syncOffsetSec, result,
    finishOnboarding, startProcessing, finishDone, reset,
  } = useApp(user)

  const [showSettings, setShowSettings] = useState(false)

  // Close settings panel whenever auth state changes (login / logout)
  // Without this, the panel stays open if user signs out then back in
  useEffect(() => { setShowSettings(false) }, [user?.id])

  // ── Loading ────────────────────────────────────────────────────────────────

  if (authLoading) {
    return (
      <div className="h-full flex items-center justify-center relative" aria-busy="true" aria-label="A carregar">
        <Background />
        <div className="relative z-20 flex flex-col items-center gap-4">
          <span className="font-display text-[26px] tracking-[0.35em] text-foreground/50 uppercase">
            CUTPILOT
          </span>
          <div className="flex gap-1.5" aria-hidden="true">
            {[0, 1, 2].map(i => (
              <span
                key={i}
                className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-pulse"
                style={{ animationDelay: `${i * 0.18}s` }}
              />
            ))}
          </div>
        </div>
      </div>
    )
  }

  // ── Auth gate ──────────────────────────────────────────────────────────────

  if (!user || isResetting) {
    return (
      <div className="h-full flex flex-col relative overflow-hidden">
        <Background />
        <header
          className={`h-[38px] shrink-0 relative z-20 ${isMac ? 'pl-[80px]' : ''}`}
          style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
          aria-hidden="true"
        />
        <main className="flex-1 min-h-0 relative z-20">
          <AuthScreen isResetting={isResetting} onResetDone={finishReset} />
        </main>
      </div>
    )
  }

  // ── Authenticated ──────────────────────────────────────────────────────────

  const stepIdx = STEP_ORDER.indexOf(step as typeof STEP_ORDER[number])
  const showHeader = step !== 'onboarding'

  return (
    <div className="h-full flex flex-col relative overflow-hidden">
      <Background />

      {/* Title bar */}
      <header
        className={`h-[48px] shrink-0 relative z-20 flex items-center justify-between
                   border-b border-border/80
                   ${isMac ? 'pl-[84px]' : 'pl-4'} pr-3`}
        style={{
          WebkitAppRegion: 'drag',
          background: 'linear-gradient(180deg, hsl(220,16%,12%) 0%, hsl(220,14%,9%) 100%)',
        } as React.CSSProperties}
      >
        {/* Scanline texture — gives a "broadcast monitor" depth */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.03]"
          style={{
            backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 1px, rgba(255,255,255,0.8) 1px, rgba(255,255,255,0.8) 2px)',
            backgroundSize: '100% 2px',
          }}
          aria-hidden="true"
        />

        {/* Top amber signal line */}
        <div
          className="absolute top-0 left-0 right-0 h-[1.5px]
                     bg-gradient-to-r from-transparent via-primary/70 to-transparent"
          aria-hidden="true"
        />

        {/* LEFT — Split wordmark + live indicator */}
        <div className="flex items-center gap-3 select-none" aria-label={strings.app.title}>
          {/* Pulsing live dot */}
          <div className="relative flex items-center justify-center w-3 h-3 shrink-0" aria-hidden="true">
            <span className="absolute w-3 h-3 rounded-full bg-primary/20 animate-ping [animation-duration:2.8s]" />
            <span className="w-1.5 h-1.5 rounded-full bg-primary" />
          </div>
          {/* Typographic split: display + mono */}
          <div className="flex items-baseline gap-1.5 leading-none">
            <span className="font-display text-[15px] tracking-[0.25em] text-foreground/90 uppercase">
              CUTPILOT
            </span>
            <span className="font-mono text-[9px] tracking-[0.55em] text-primary/65 uppercase">
              SYNC
            </span>
          </div>
        </div>

        {/* CENTER — Step label in angular brackets */}
        {showHeader && (
          <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-1.5 select-none">
            <span className="font-mono text-[10px] text-primary/40 leading-none" aria-hidden="true">⟨</span>
            <span className="font-mono text-[10px] tracking-[0.3em] text-muted-foreground/70 uppercase">
              {STEP_LABELS[step] ?? ''}
            </span>
            <span className="font-mono text-[10px] text-primary/40 leading-none" aria-hidden="true">⟩</span>
          </div>
        )}

        {/* RIGHT — Account button with user avatar initial */}
        <div style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          <button
            type="button"
            onClick={() => setShowSettings(true)}
            className="group flex items-center gap-2 h-8 pl-1.5 pr-3
                       border border-border/50 hover:border-primary/50
                       hover:bg-primary/[0.06] active:bg-primary/10
                       transition-all duration-200"
            aria-label={strings.app.accountBtnLabel}
          >
            {/* Icon circle */}
            <span
              className="w-5 h-5 rounded-full flex items-center justify-center shrink-0
                         bg-primary/20 border border-primary/40 text-primary/80
                         group-hover:bg-primary/30 group-hover:border-primary/65 group-hover:text-primary
                         transition-all duration-200"
              aria-hidden="true"
            >
              <svg width="11" height="11" viewBox="0 0 15 15" fill="none">
                <circle cx="7.5" cy="4.5" r="2.5" stroke="currentColor" strokeWidth="1.4" />
                <path d="M2 13c0-3.04 2.46-5.5 5.5-5.5S13 9.96 13 13"
                  stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
            </span>
            {/* Label */}
            <span className="font-mono text-[9px] tracking-[0.3em] uppercase
                             text-muted-foreground/65 group-hover:text-foreground/85
                             transition-colors duration-200">
              {strings.app.accountBtn}
            </span>
          </button>
        </div>

        {/* BOTTOM — Timeline progress with tick marks */}
        {showHeader && (
          <div className="absolute bottom-0 left-0 right-0 h-[3px]" aria-hidden="true">
            <div className="absolute inset-0 bg-border/25" />
            {/* Tick marks at 33% and 66% — like a video timeline */}
            <div className="absolute top-0 bottom-0 left-[33.33%] w-px bg-border/70" />
            <div className="absolute top-0 bottom-0 left-[66.66%] w-px bg-border/70" />
            {/* Fill */}
            <div
              className="absolute inset-y-0 left-0 bg-primary/75 transition-all duration-700 ease-out progress-glow"
              style={{ width: `${stepIdx === 0 ? 33 : stepIdx === 1 ? 66 : 100}%` }}
            />
          </div>
        )}
      </header>

      {/* Main content */}
      <main
        className="flex-1 min-h-0 relative z-20"
        aria-label={step !== 'onboarding' ? STEP_LABELS[step] ?? '' : strings.stepLabels.onboarding}
      >
        {step === 'onboarding' && <Onboarding onDone={finishOnboarding} />}
        {step === 'upload' && <StepUpload onNext={startProcessing} />}
        {step === 'process' && videoPath && (
          <StepProcess
            videoPath={videoPath}
            webcamPath={webcamPath ?? undefined}
            syncOffsetSec={syncOffsetSec}
            onDone={finishDone}
          />
        )}
        {step === 'done' && result && <StepDone result={result} onNew={reset} />}
      </main>

      {/* Settings panel */}
      {showSettings && (
        <AccountSettings
          email={user.email ?? ''}
          onClose={() => setShowSettings(false)}
          onSignOut={signOut}
        />
      )}
    </div>
  )
}

export default App
