import { useState }                                               from 'react'
import { strings }                                               from '@i18n'
import { useApp, useAuth }                                       from '@hooks'
import { Onboarding, StepUpload, StepProcess, StepDone,
         AuthScreen, AccountSettings }                           from '@components'

// ── Film grain overlay ────────────────────────────────────────────────────────

const Grain = () => (
  <svg
    aria-hidden="true"
    className="pointer-events-none fixed inset-0 h-full w-full z-50 opacity-[0.032] mix-blend-soft-light"
    xmlns="http://www.w3.org/2000/svg"
  >
    <filter id="grain">
      <feTurbulence type="fractalNoise" baseFrequency="0.72" numOctaves="4" stitchTiles="stitch" />
      <feColorMatrix type="saturate" values="0" />
    </filter>
    <rect width="100%" height="100%" filter="url(#grain)" />
  </svg>
)

// ── Step labels ───────────────────────────────────────────────────────────────

const STEP_LABELS: Record<string, string> = {
  upload:  'Carregar vídeo',
  process: 'A processar',
  done:    'Concluído',
}

// ── App ───────────────────────────────────────────────────────────────────────

const App = () => {
  const { user, loading: authLoading, isResetting, finishReset, signOut }                 = useAuth()
  const { step, videoPath, result, finishOnboarding, startProcessing, finishDone, reset } = useApp(user)

  const [showSettings, setShowSettings] = useState(false)

  // ── Loading splash (session restore) ──────────────────────────────────────

  if (authLoading) {
    return (
      <div className="h-full flex items-center justify-center" aria-busy="true" aria-label="A carregar…">
        <Grain />
        <span className="font-mono text-[10px] tracking-widest uppercase text-muted-foreground/40">
          …
        </span>
      </div>
    )
  }

  // ── Auth gate ─────────────────────────────────────────────────────────────

  if (!user || isResetting) {
    return (
      <div className="h-full flex flex-col relative overflow-hidden">
        <Grain />

        {/* Minimal drag region */}
        <header
          className="h-[38px] shrink-0"
          style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
          aria-hidden="true"
        />

        <main className="flex-1 min-h-0">
          <AuthScreen isResetting={isResetting} onResetDone={finishReset} />
        </main>
      </div>
    )
  }

  // ── Authenticated app ─────────────────────────────────────────────────────

  return (
    <div className="h-full flex flex-col relative overflow-hidden">
      <Grain />

      {/* Title bar */}
      <header
        className="h-[38px] shrink-0 flex items-center justify-between px-5"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        <span
          className="font-display text-xs text-muted-foreground/50 tracking-[0.25em]"
          aria-label={strings.app.title}
        >
          {strings.app.title}
        </span>

        <div
          className="flex items-center gap-3"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          {/* Step progress indicator */}
          {step !== 'onboarding' && (
            <nav aria-label="Progresso">
              <ol className="flex gap-1.5 list-none" role="list">
                {(['upload', 'process', 'done'] as const).map((s) => {
                  const isCurrent = s === step
                  const isDone    = s === 'done' && step === 'done'
                  return (
                    <li key={s} aria-label={STEP_LABELS[s]} aria-current={isCurrent ? 'step' : undefined}>
                      <div
                        className={
                          isCurrent
                            ? 'w-4 h-1 rounded-full bg-primary'
                            : isDone
                              ? 'w-1 h-1 rounded-full bg-primary/60'
                              : 'w-1 h-1 rounded-full bg-border'
                        }
                      />
                    </li>
                  )
                })}
              </ol>
            </nav>
          )}

          {/* Settings gear icon */}
          <button
            type="button"
            onClick={() => setShowSettings(true)}
            className="text-muted-foreground/40 hover:text-muted-foreground/80 transition-colors"
            aria-label="Definições da conta"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <circle cx="7" cy="7" r="2" stroke="currentColor" strokeWidth="1.2" />
              <path
                d="M7 1v1M7 12v1M1 7h1M12 7h1M2.64 2.64l.71.71M10.65 10.65l.71.71M2.64 11.36l.71-.71M10.65 3.35l.71-.71"
                stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      </header>

      {/* Main content */}
      <main
        className="flex-1 min-h-0"
        aria-label={step !== 'onboarding' ? STEP_LABELS[step] : 'Boas-vindas'}
      >
        {step === 'onboarding' && <Onboarding onDone={finishOnboarding} />}
        {step === 'upload'     && <StepUpload  onNext={startProcessing} />}
        {step === 'process' && videoPath && <StepProcess videoPath={videoPath} onDone={finishDone} />}
        {step === 'done'    && result    && <StepDone    result={result}    onNew={reset} />}
      </main>

      {/* Account settings panel */}
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
