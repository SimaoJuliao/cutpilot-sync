import { useState } from 'react'
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

  // ── Loading ────────────────────────────────────────────────────────────────

  if (authLoading) {
    return (
      <div className="h-full flex items-center justify-center relative" aria-busy="true">
        <Background />
        <span className="relative z-20 font-mono text-[10px] tracking-widest uppercase text-muted-foreground/30 animate-pulse">
          …
        </span>
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

      {/* Title bar — extra left padding on macOS for traffic light buttons */}
      <header
        className={`h-[40px] shrink-0 relative z-20 flex items-center justify-between pr-5
                   bg-card/50 backdrop-blur-sm border-b border-border/40
                   ${isMac ? 'pl-[80px]' : 'pl-5'}`}
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        {/* Wordmark */}
        <span
          className="font-mono text-[10px] tracking-[0.35em] text-muted-foreground/50 uppercase select-none"
          aria-label={strings.app.title}
        >
          {strings.app.title}
        </span>

        {/* Step name — center */}
        {showHeader && (
          <span className="absolute left-1/2 -translate-x-1/2 font-mono text-[10px]
                           tracking-[0.25em] text-muted-foreground/35 uppercase select-none">
            {STEP_LABELS[step] ?? ''}
          </span>
        )}

        {/* Settings */}
        <div style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          <button
            type="button"
            onClick={() => setShowSettings(true)}
            className="flex items-center gap-1.5 px-2 py-1 rounded
                       text-muted-foreground/60 hover:text-foreground/80
                       hover:bg-white/5 active:bg-white/10
                       transition-all duration-150 group"
            aria-label={strings.app.accountBtnLabel}
          >
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
              <circle cx="7.5" cy="4.5" r="2.5" stroke="currentColor" strokeWidth="1.3" />
              <path d="M2 13c0-3.04 2.46-5.5 5.5-5.5S13 9.96 13 13"
                stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
            <span className="font-mono text-[9px] tracking-widest uppercase">
              {strings.app.accountBtn}
            </span>
          </button>
        </div>

        {/* Progress line — bottom of the header */}
        {showHeader && (
          <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-border/0" aria-hidden="true">
            <div
              className="h-full bg-primary/40 transition-all duration-700 ease-out"
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
