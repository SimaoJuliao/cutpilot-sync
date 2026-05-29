import type { RenderResult } from '@/types'
import { strings } from '@i18n'
import useStepProcess from './useStepProcess'

const t = strings.stepProcess

interface RingProps { pct: number; done: boolean }

const Ring = ({ pct, done }: RingProps) => {
  const r     = 54
  const circ  = 2 * Math.PI * r
  const dash  = circ * (1 - pct / 100)
  const color = done ? 'hsl(var(--success))' : 'hsl(var(--primary))'

  return (
    <div
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`Progresso: ${pct}%`}
      className={`relative inline-flex items-center justify-center ${!done ? 'animate-glow' : ''}`}
    >
      <svg width="140" height="140" style={{ transform: 'rotate(-90deg)' }} aria-hidden="true">
        {/* Tick marks — like a film reel */}
        {Array.from({ length: 24 }).map((_, i) => {
          const angle = (i * 360) / 24
          const rad   = (angle * Math.PI) / 180
          const x1    = 70 + 66 * Math.cos(rad)
          const y1    = 70 + 66 * Math.sin(rad)
          const x2    = 70 + 70 * Math.cos(rad)
          const y2    = 70 + 70 * Math.sin(rad)
          return (
            <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
              stroke="hsl(var(--border))" strokeWidth="1" />
          )
        })}
        {/* Track */}
        <circle cx="70" cy="70" r={r} fill="none"
          stroke="hsl(var(--border))" strokeWidth="4" />
        {/* Fill */}
        <circle cx="70" cy="70" r={r} fill="none"
          stroke={color}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={dash}
          style={{ transition: 'stroke-dashoffset 0.6s cubic-bezier(0.4,0,0.2,1), stroke 0.4s ease' }}
        />
      </svg>

      {/* Percentage — visual only, screen reader uses aria-valuenow */}
      <div className="absolute text-center" aria-hidden="true">
        <span className="font-display text-3xl text-foreground tabular-nums">{pct}</span>
        <span className="font-mono text-xs text-muted-foreground/50 ml-0.5">%</span>
      </div>
    </div>
  )
}

interface StepProcessProps {
  videoPath: string
  onDone:    (result: RenderResult) => void
}

const StepProcess = ({ videoPath, onDone }: StepProcessProps) => {
  const { pct, msg, phase, error } = useStepProcess(videoPath, onDone)

  if (error) {
    return (
      <section
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
        className="flex flex-col items-center justify-center h-full gap-7 px-12 animate-fade-up"
        aria-label={`Erro: ${error}`}
      >

        {/* Warning icon */}
        <svg
          width="52" height="52" viewBox="0 0 52 52" fill="none"
          className="text-destructive/70"
          aria-hidden="true"
        >
          <path d="M26 6L48 44H4L26 6Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
          <line x1="26" y1="22" x2="26" y2="33" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <circle cx="26" cy="39" r="1.2" fill="currentColor" />
        </svg>

        {/* Message */}
        <div className="text-center space-y-2 max-w-xs">
          <p className="font-display text-xl tracking-[0.08em] uppercase text-foreground/80">
            {t.errorTitle}
          </p>
          <p className="text-muted-foreground/60 text-[11px] leading-relaxed font-mono tracking-wide">
            {error}
          </p>
        </div>

        {/* Retry */}
        <button
          onClick={() => window.location.reload()}
          aria-label={`${t.retryBtn} — recarregar a aplicação`}
          className="h-9 px-8 font-mono text-xs tracking-widest uppercase
                     border border-border/60 text-muted-foreground/60
                     hover:border-foreground/30 hover:text-foreground transition-colors"
        >
          {t.retryBtn}
        </button>

      </section>
    )
  }

  return (
    <section
      className="flex flex-col items-center justify-center h-full gap-7 animate-fade-up"
      aria-label="A processar o vídeo"
    >
      <Ring pct={pct} done={phase === 'done'} />

      {/* Status messages — announced to screen readers as they change */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="text-center space-y-1.5"
      >
        <p className="text-foreground/80 text-xs font-mono tracking-wide">{msg}</p>
        {phase !== 'done' && (
          <p className="text-muted-foreground/60 text-[11px] tracking-widest uppercase">
            {t.patience}
          </p>
        )}
      </div>
    </section>
  )
}

export default StepProcess
