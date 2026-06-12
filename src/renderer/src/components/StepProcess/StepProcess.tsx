import type { RenderResult } from '@/types'
import { strings } from '@i18n'
import { useStepProcess } from './useStepProcess'
import type { ProcessPhase } from './useStepProcess'

const t = strings.stepProcess

// ── Animated waveform ─────────────────────────────────────────────────────────

const WAVE_HEIGHTS = [0.3, 0.6, 1, 0.8, 0.5, 0.9, 0.4, 0.7, 1, 0.6, 0.35, 0.75, 0.9, 0.5]
const WAVE_DELAYS = [0, 0.15, 0.3, 0.45, 0.6, 0.18, 0.48, 0.72, 0.1, 0.38, 0.55, 0.2, 0.65, 0.42]

const Waveform = ({ active }: { active: boolean }) => (
  <div className="flex items-center gap-[4px] h-11" aria-hidden="true">
    {WAVE_HEIGHTS.map((h, i) => (
      <span
        key={i}
        className="wave-bar"
        style={{
          height: active ? `${h * 100}%` : '25%',
          animationDelay: active ? `${WAVE_DELAYS[i]}s` : '0s',
          animationPlayState: active ? 'running' : 'paused',
          opacity: active ? 0.7 : 0.2,
          transition: 'opacity 0.4s',
        }}
      />
    ))}
  </div>
)

// ── Progress ring ─────────────────────────────────────────────────────────────

const Ring = ({ pct, done }: { pct: number; done: boolean }) => {
  const r = 64
  const circ = 2 * Math.PI * r
  const dash = circ * (1 - pct / 100)

  return (
    <div
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`${t.progressAriaPrefix}: ${pct}%`}
      className={`relative inline-flex items-center justify-center ${!done ? 'animate-glow' : ''}`}
    >
      <svg width="168" height="168" style={{ transform: 'rotate(-90deg)' }} aria-hidden="true">
        {/* Outer glow ring */}
        <circle cx="84" cy="84" r={r + 9} fill="none"
          stroke={done ? 'hsl(145 52% 48% / 0.08)' : 'hsl(32 97% 55% / 0.08)'}
          strokeWidth="8"
          style={{ transition: 'stroke 0.4s ease' }}
        />
        {/* Background track */}
        <circle cx="84" cy="84" r={r} fill="none"
          stroke="hsl(var(--border) / 0.5)" strokeWidth="3" />
        {/* Progress arc */}
        <circle cx="84" cy="84" r={r} fill="none"
          stroke={done ? 'hsl(var(--success))' : 'hsl(var(--primary))'}
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={dash}
          style={{
            transition: 'stroke-dashoffset 0.55s cubic-bezier(0.4,0,0.2,1), stroke 0.4s ease',
            filter: done
              ? 'drop-shadow(0 0 5px hsl(145 52% 48% / 0.6))'
              : 'drop-shadow(0 0 5px hsl(32 97% 55% / 0.6))',
          }}
        />
        {/* Tick marks */}
        {Array.from({ length: 32 }).map((_, i) => {
          const a = (i / 32) * 2 * Math.PI
          const cos = Math.cos(a), sin = Math.sin(a)
          const major = i % 4 === 0
          return (
            <line key={i}
              x1={84 + (80 + (major ? 1 : 0)) * cos}
              y1={84 + (80 + (major ? 1 : 0)) * sin}
              x2={84 + 84 * cos}
              y2={84 + 84 * sin}
              stroke={`hsl(var(--border) / ${major ? 0.5 : 0.25})`}
              strokeWidth={major ? 1.4 : 0.9}
            />
          )
        })}
      </svg>

      {/* Center */}
      <div className="absolute flex flex-col items-center" aria-hidden="true">
        {done ? (
          <span className="font-display text-5xl text-success">✓</span>
        ) : (
          <>
            <span className="font-display text-[44px] leading-none text-foreground tabular-nums">{pct}</span>
            <span className="font-mono text-[10px] text-muted-foreground/50 tracking-widest">%</span>
          </>
        )}
      </div>
    </div>
  )
}

// ── Phase step indicator ──────────────────────────────────────────────────────

const PHASES: ProcessPhase[] = ['transcribe', 'analyse', 'export']
const PCT_THRESHOLDS = { transcribe: 0, analyse: 35, export: 65 }

const PhaseSteps = ({ phase, pct }: { phase: ProcessPhase; pct: number }) => (
  <div className="flex items-center gap-3" aria-hidden="true">
    {PHASES.map((p, i) => {
      const threshold = PCT_THRESHOLDS[p]
      const past = pct > threshold && p !== phase
      const active = p === phase
      return (
        <div key={p} className="flex items-center gap-3">
          {i > 0 && (
            <div className={`h-px w-12 transition-all duration-500 ${past ? 'bg-primary/40' : 'bg-border/40'}`} />
          )}
          <div className={`flex items-center gap-1.5 transition-all duration-300 ${active ? 'opacity-100' : past ? 'opacity-50' : 'opacity-25'
            }`}>
            <div className={`w-2 h-2 rounded-full transition-colors duration-300 ${active ? 'bg-primary' : past ? 'bg-primary/60' : 'bg-border'
              }`} />
            <span className="font-mono text-[11px] tracking-widest uppercase text-muted-foreground">
              {p === 'transcribe' ? t.phaseTranscribeShort : p === 'analyse' ? t.phaseAnalyseShort : t.phaseExportShort}
            </span>
          </div>
        </div>
      )
    })}
  </div>
)

// ── Component ─────────────────────────────────────────────────────────────────

interface StepProcessProps {
  videoPath: string
  webcamPath?: string
  syncOffsetSec?: number
  pipPosition?: import('@/types').PipPosition
  onDone: (result: RenderResult) => void
}

export const StepProcess = ({ videoPath, webcamPath, syncOffsetSec, pipPosition, onDone }: StepProcessProps) => {
  const { pct, msg, phase, error } = useStepProcess(videoPath, onDone, webcamPath, syncOffsetSec, pipPosition)

  if (error) {
    return (
      <section
        role="alert"
        aria-live="assertive"
        className="flex flex-col items-center justify-center h-full gap-6 px-12 animate-fade-up"
      >
        <div className="w-12 h-12 rounded-full border border-destructive/30 bg-destructive/10
                        flex items-center justify-center">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="M10 6v5M10 14.5v.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            <path d="M9.13 2.5L1.5 16.5a1 1 0 0 0 .87 1.5h15.26a1 1 0 0 0 .87-1.5L10.87 2.5a1 1 0 0 0-1.74 0Z"
              stroke="hsl(var(--destructive))" strokeWidth="1.4" strokeLinejoin="round" />
          </svg>
        </div>

        <div className="text-center space-y-2 max-w-xs">
          <p className="font-display text-2xl tracking-wide uppercase text-foreground/80">
            {t.errorTitle}
          </p>
          <p className="text-muted-foreground/55 text-[11px] leading-relaxed font-mono">
            {error}
          </p>
        </div>

        <button
          onClick={() => window.location.reload()}
          className="h-9 px-8 font-mono text-xs tracking-widest uppercase rounded
                     border border-border/50 text-muted-foreground/55
                     hover:border-foreground/30 hover:text-foreground transition-colors"
        >
          {t.retryBtn}
        </button>
      </section>
    )
  }

  const isActive = phase !== 'done' && phase !== 'error'

  return (
    <section
      className="flex flex-col items-center justify-center h-full gap-8 animate-fade-up"
      aria-label="A processar o vídeo"
    >
      {/* Ring */}
      <Ring pct={pct} done={phase === 'done'} />

      {/* Waveform */}
      <Waveform active={isActive} />

      {/* Status */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="text-center space-y-2 px-8"
      >
        <p className="text-foreground/80 text-[15px] font-mono tracking-wide">{msg}</p>
        {isActive && (
          <p className="text-muted-foreground/60 text-[11px] tracking-widest uppercase">
            {t.patience}
          </p>
        )}
      </div>

      {/* Phase steps */}
      {phase !== 'done' && <PhaseSteps phase={phase} pct={pct} />}
    </section>
  )
}
