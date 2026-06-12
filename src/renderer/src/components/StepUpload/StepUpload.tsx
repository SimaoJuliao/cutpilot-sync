import { useState } from 'react'
import { cn } from '@lib'
import { strings } from '@i18n'
import { useStepUpload } from './useStepUpload'
import { ScreenIcon, CamIcon, CheckIcon, PlusIcon, TwoFilesIcon, PipModeIcon, SlidersIcon, ChevronIcon } from '@assets/icons'

const t = strings.stepUpload

// ── Types ─────────────────────────────────────────────────────────────────────

export interface UploadResult {
  videoPath: string
  webcamPath?: string
  syncOffsetSec?: number
  pipPosition?: import('@/types').PipPosition
}

interface StepUploadProps {
  onNext: (result: UploadResult) => void
}

// ── Component ─────────────────────────────────────────────────────────────────

export const StepUpload = ({ onNext }: StepUploadProps) => {
  const {
    file, fileName, dragging,
    handlePick, handleDragOver, handleDragLeave, handleDrop,
    webcamFile, webcamFileName, webcamDragging, syncOffsetSec,
    handleWebcamPick, handleWebcamDragOver, handleWebcamDragLeave,
    handleWebcamDrop, handleWebcamRemove, setSyncOffsetSec,
    pipPosition, setPipPosition,
    ffmpegOk,
  } = useStepUpload()

  const [showAdvanced, setShowAdvanced] = useState(false)

  const handleKey = (e: React.KeyboardEvent, fn: () => void) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn() }
  }

  // Clamp + round to 1 decimal so stepping never produces float noise (e.g. 0.30000004)
  const clampStep = (v: number) => Math.min(60, Math.max(-60, Math.round(v * 10) / 10))

  // Output mode is derived from pipPosition: null = two separate files, a corner = overlay.
  const mode: 'separate' | 'pip' = pipPosition ? 'pip' : 'separate'

  // Corner geometry for the PiP monitor (active tile position + always-visible markers).
  const PIP_CORNERS = ['top-left', 'top-right', 'bottom-left', 'bottom-right'] as const
  const tileCornerCls: Record<typeof PIP_CORNERS[number], string> = {
    'top-left': 'top-0 left-0', 'top-right': 'top-0 right-0',
    'bottom-left': 'bottom-0 left-0', 'bottom-right': 'bottom-0 right-0',
  }
  const cornerDotCls: Record<typeof PIP_CORNERS[number], string> = {
    'top-left': 'top-1.5 left-1.5', 'top-right': 'top-1.5 right-1.5',
    'bottom-left': 'bottom-1.5 left-1.5', 'bottom-right': 'bottom-1.5 right-1.5',
  }
  const pipAria: Record<typeof PIP_CORNERS[number], string> = {
    'top-left': t.pipTopLeft, 'top-right': t.pipTopRight,
    'bottom-left': t.pipBottomLeft, 'bottom-right': t.pipBottomRight,
  }

  const handleStart = () => {
    if (!file) return
    onNext({
      videoPath: file,
      webcamPath: webcamFile ?? undefined,
      syncOffsetSec,
      pipPosition: (webcamFile && pipPosition) ? pipPosition : undefined,
    })
  }

  return (
    <section
      className="flex flex-col h-full px-7 pt-5 pb-5 gap-4 animate-fade-up"
      aria-label="Selecionar vídeos"
    >

      {/* FFmpeg banner */}
      {ffmpegOk === false && (
        <div role="alert" className="flex items-center gap-3 px-4 py-3
                   bg-destructive/10 border border-destructive/35 border-l-2 border-l-destructive/70">
          <svg width="15" height="15" viewBox="0 0 20 20" fill="none" aria-hidden="true"
            className="text-destructive/80 shrink-0">
            <path d="M10 3L18.5 17.5H1.5L10 3Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
            <line x1="10" y1="9" x2="10" y2="13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <circle cx="10" cy="15.5" r="0.75" fill="currentColor" />
          </svg>
          <div className="flex-1 min-w-0">
            <p className="font-mono text-[11px] text-destructive/90 tracking-wide">{t.ffmpegBannerTitle}</p>
            <p className="font-mono text-[10px] text-destructive/65 mt-0.5">{t.ffmpegBannerDesc}</p>
          </div>
          <a href="https://ffmpeg.org/download.html" target="_blank" rel="noreferrer"
            className="font-mono text-[10px] tracking-widest uppercase shrink-0
                       px-3 py-1.5 border border-destructive/40 text-destructive/80
                       hover:bg-destructive/15 hover:text-destructive transition-colors duration-150">
            {t.ffmpegBannerBtn}
          </a>
        </div>
      )}

      {/* Section header */}
      <div className="flex items-center gap-2">
        <span className="w-1 h-1 rounded-full bg-primary/70" aria-hidden="true" />
        <p className="font-mono text-[10px] text-foreground/60 tracking-[0.4em] uppercase">
          {t.sectionTitle}
        </p>
      </div>

      {/* ── Drop zones ─────────────────────────────────────────────────────── */}
      <div className="flex gap-4 flex-1 min-h-0">

        {/* ── MAIN VIDEO — primary, large ── */}
        <div className="flex flex-col gap-2 flex-[3]">

          {/* Label */}
          <div className="flex items-center gap-2">
            <span className={file ? 'text-success' : 'text-primary/80'}>
              <ScreenIcon size={13} />
            </span>
            <span className="font-mono text-[10px] tracking-[0.3em] uppercase text-foreground/80 font-medium">
              {t.mainLabel}
            </span>
            <span className="font-mono text-[9px] text-muted-foreground/60 tracking-widest">
              {t.mainSublabel}
            </span>
          </div>

          {/* Drop zone */}
          <div
            role="button"
            tabIndex={0}
            aria-label={file ? `${fileName} — ${t.swapHint}` : t.dropPrompt}
            aria-pressed={!!file}
            onClick={handlePick}
            onKeyDown={(e) => handleKey(e, handlePick)}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={cn(
              'relative flex-1 flex flex-col items-center justify-center',
              'cursor-pointer select-none transition-all duration-200',
              dragging
                ? 'border-2 border-primary/70 bg-primary/[0.06] scale-[1.005]'
                : file
                  ? 'border border-success/50 bg-success/[0.05] hover:bg-success/[0.08]'
                  : 'border border-primary/20 bg-[hsl(220,14%,12%)] hover:border-primary/40 hover:bg-[hsl(220,14%,13.5%)]',
            )}
          >
            {/* Corner accents — only when empty */}
            {!file && !dragging && (
              <>
                <span className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-primary/50 animate-corner-pulse" />
                <span className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-primary/50 animate-corner-pulse" style={{ animationDelay: '0.7s' }} />
                <span className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-primary/50 animate-corner-pulse" style={{ animationDelay: '1.4s' }} />
                <span className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-primary/50 animate-corner-pulse" style={{ animationDelay: '2.1s' }} />
              </>
            )}

            {file ? (
              /* ── Loaded state ── */
              <div className="flex flex-col items-center gap-3 px-8 text-center animate-scale-in">
                <span className="text-success drop-shadow-[0_0_10px_hsl(145_52%_48%/0.5)]">
                  <CheckIcon size={24} />
                </span>
                <div>
                  <p className="font-display text-[42px] leading-none text-success uppercase mb-2 text-glow-success">
                    {t.readyLabel}
                  </p>
                  <p className="font-mono text-xs text-foreground/60 truncate max-w-[260px]" title={fileName ?? ''}>
                    {fileName}
                  </p>
                </div>
                <span className="font-mono text-[10px] text-muted-foreground/60 tracking-widest uppercase
                                 border border-border/50 px-2 py-0.5">
                  {t.swapHint}
                </span>
              </div>
            ) : (
              /* ── Empty state ── */
              <div className="flex flex-col items-center gap-5 px-10 text-center">
                <span className={cn(
                  'transition-all duration-300',
                  dragging ? 'text-primary scale-110' : 'text-primary/40 animate-breathe',
                )}>
                  <ScreenIcon size={52} />
                </span>
                <div className="space-y-2">
                  <p className={cn(
                    'font-mono text-[13px] transition-colors duration-200',
                    dragging ? 'text-primary' : 'text-foreground/70',
                  )}>
                    {dragging ? t.dropHere : t.dropPrompt}
                  </p>
                  <p className="font-mono text-[10px] text-muted-foreground/55 tracking-widest uppercase">
                    {t.dropFormats}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── WEBCAM — secondary, dashed ── */}
        <div className="flex flex-col gap-2 flex-[2]">

          {/* Label */}
          <div className="flex items-center gap-2">
            <span className={webcamFile ? 'text-success' : 'text-muted-foreground/60'}>
              <CamIcon size={13} />
            </span>
            <span className="font-mono text-[10px] tracking-[0.3em] uppercase text-foreground/70">
              {t.webcamLabel}
            </span>
            <span className="font-mono text-[9px] text-muted-foreground/70 border border-border/60
                             px-1.5 py-px tracking-widest uppercase">
              {t.webcamOptional}
            </span>
          </div>

          {webcamFile ? (
            /* ── Webcam loaded ── */
            <div className="flex-1 flex flex-col border border-success/35 bg-success/[0.04]">

              {/* File row */}
              <div className="flex items-center gap-2.5 px-4 py-3 border-b border-success/20">
                <span className="text-success/70 shrink-0"><CamIcon size={13} /></span>
                <span className="font-mono text-[11px] text-foreground/70 truncate flex-1" title={webcamFileName ?? ''}>
                  {webcamFileName}
                </span>
                <button type="button" onClick={handleWebcamRemove}
                  className="text-muted-foreground/60 hover:text-destructive/80 transition-colors shrink-0 text-xs"
                  aria-label={t.webcamRemoveLabel}>
                  ✕
                </button>
              </div>

              {/* Result-mode chooser → reveals corner picker → advanced (sync) */}
              <div className="flex-1 flex flex-col gap-3.5 px-4 py-4">

                {/* Section label */}
                <div className="flex items-center gap-2">
                  <span className="w-1 h-1 rounded-full bg-primary/70" aria-hidden="true" />
                  <span className="font-mono text-[10px] tracking-[0.3em] uppercase text-foreground/65">
                    {t.resultLabel}
                  </span>
                </div>

                {/* Explicit choice: two clear output modes */}
                <div className="grid grid-cols-2 gap-2.5" role="group" aria-label={t.resultLabel}>
                  {([
                    { key: 'separate', icon: <TwoFilesIcon />, title: t.modeSeparateTitle, desc: t.modeSeparateDesc, onClick: () => setPipPosition(null) },
                    { key: 'pip', icon: <PipModeIcon />, title: t.modeOverlayTitle, desc: t.modeOverlayDesc, onClick: () => { if (!pipPosition) setPipPosition('bottom-right') } },
                  ] as const).map((opt) => {
                    const active = mode === opt.key
                    return (
                      <button
                        key={opt.key}
                        type="button"
                        aria-pressed={active}
                        onClick={opt.onClick}
                        className={cn(
                          'flex flex-col items-center gap-1.5 px-2 py-3.5 border transition-all duration-150',
                          active
                            ? 'border-primary/70 bg-primary/[0.08] text-foreground shadow-[0_0_14px_hsl(var(--primary)/0.12)]'
                            : 'border-border/50 bg-card/30 text-muted-foreground/65 hover:border-border/80 hover:text-foreground/80',
                        )}
                      >
                        <span className={active ? 'text-primary' : ''}>{opt.icon}</span>
                        <span className="font-mono text-[11px] tracking-wide text-center leading-tight">{opt.title}</span>
                        <span className="font-mono text-[9px] text-muted-foreground/55 text-center leading-tight">{opt.desc}</span>
                      </button>
                    )
                  })}
                </div>

                {/* Corner picker — only when overlay is chosen */}
                {pipPosition && (
                  <div className="flex flex-col gap-2 animate-fade-up">
                    <span className="font-mono text-[10px] tracking-[0.25em] uppercase text-muted-foreground/65">
                      {t.pipPositionLabel}
                    </span>

                    {/* Monitor — 16:9 screen; tap a corner, the camera tile slides there */}
                    <div className="relative w-full aspect-video bg-[hsl(220,18%,7%)] border border-border/60 overflow-hidden
                                    shadow-[inset_0_0_30px_rgba(0,0,0,0.5)]">
                      {/* Scanline texture */}
                      <div className="absolute inset-0 pointer-events-none opacity-[0.05]"
                        style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent 0 2px, rgba(255,255,255,0.7) 2px 3px)' }}
                        aria-hidden="true" />
                      {/* Screen tag */}
                      <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2
                                       font-mono text-[9px] tracking-[0.45em] uppercase text-muted-foreground/25 select-none"
                        aria-hidden="true">
                        {t.pipScreenTag}
                      </span>

                      {/* Corner targets — quadrant-sized, with an always-visible marker */}
                      {PIP_CORNERS.map((pos) => (
                        <button
                          key={pos}
                          type="button"
                          aria-label={pipAria[pos]}
                          aria-pressed={pipPosition === pos}
                          onClick={() => setPipPosition(pos)}
                          className={cn('group/c absolute w-1/2 h-1/2 z-10', tileCornerCls[pos])}
                        >
                          <span className={cn(
                            'absolute w-4 h-3 border transition-colors duration-150',
                            cornerDotCls[pos],
                            pipPosition === pos
                              ? 'border-transparent'
                              : 'border-border/70 bg-border/20 group-hover/c:border-primary/70 group-hover/c:bg-primary/25',
                          )} aria-hidden="true" />
                        </button>
                      ))}

                      {/* Active camera tile — 25% width matches the real overlay (scale=iw/4) */}
                      <div className={cn(
                        'absolute w-[25%] h-[25%] m-1 flex items-center justify-center',
                        'bg-primary/25 border border-primary shadow-[0_0_12px_hsl(var(--primary)/0.45)]',
                        'transition-all duration-300 ease-out pointer-events-none',
                        tileCornerCls[pipPosition],
                      )} aria-hidden="true">
                        <span className="text-primary"><CamIcon size={11} /></span>
                      </div>
                    </div>

                    {/* Current corner caption */}
                    <p className="font-mono text-[10px] text-center tracking-wide text-primary/80" aria-live="polite">
                      {pipAria[pipPosition]}
                    </p>
                  </div>
                )}

                {/* Advanced (collapsible) — sync offset, rarely needed */}
                <div className="mt-auto pt-1">
                  <button
                    type="button"
                    aria-expanded={showAdvanced}
                    onClick={() => setShowAdvanced((v) => !v)}
                    className={cn(
                      'w-full flex items-center justify-between gap-2 h-9 px-3 border transition-all duration-150',
                      'font-mono text-[10px] tracking-[0.2em] uppercase',
                      showAdvanced
                        ? 'border-primary/45 bg-primary/[0.07] text-foreground/85'
                        : 'border-border/55 bg-card/40 text-muted-foreground/75 hover:border-primary/45 hover:text-foreground/85 hover:bg-card/60',
                    )}
                  >
                    <span className="flex items-center gap-2">
                      <span className={showAdvanced ? 'text-primary' : 'text-muted-foreground/70'}><SlidersIcon size={13} /></span>
                      {t.advancedLabel}
                    </span>
                    <ChevronIcon size={12} className={cn('transition-transform duration-200', showAdvanced && 'rotate-180')} />
                  </button>

                  {showAdvanced && (
                    <div className="flex flex-col gap-1.5 pt-3 animate-fade-up">
                      <span className="font-mono text-[10px] tracking-wide uppercase text-muted-foreground/65">
                        {t.syncOffsetLabel}
                      </span>
                      <div className="flex items-center gap-2">
                        <div className="flex items-stretch h-8 border border-border/60 bg-background/60">
                          <button
                            type="button"
                            aria-label={t.syncDecrease}
                            onClick={() => setSyncOffsetSec(clampStep(syncOffsetSec - 0.1))}
                            className="w-7 flex items-center justify-center text-base leading-none
                                       text-muted-foreground/70 hover:text-primary hover:bg-primary/10
                                       active:bg-primary/20 transition-colors"
                          >−</button>
                          <input
                            id="sync-offset"
                            type="number"
                            step="0.1"
                            min="-60"
                            max="60"
                            value={syncOffsetSec}
                            onChange={(e) => setSyncOffsetSec(parseFloat(e.target.value) || 0)}
                            className="w-12 bg-transparent text-center font-mono text-[13px] tabular-nums
                                       text-foreground/85 border-x border-border/60 focus:outline-none
                                       focus:bg-primary/[0.06] transition-colors
                                       [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none
                                       [&::-webkit-outer-spin-button]:appearance-none"
                          />
                          <button
                            type="button"
                            aria-label={t.syncIncrease}
                            onClick={() => setSyncOffsetSec(clampStep(syncOffsetSec + 0.1))}
                            className="w-7 flex items-center justify-center text-base leading-none
                                       text-muted-foreground/70 hover:text-primary hover:bg-primary/10
                                       active:bg-primary/20 transition-colors"
                          >+</button>
                        </div>
                        <span className="font-mono text-[10px] text-muted-foreground/55">{t.secUnit}</span>
                      </div>
                      <p className="font-mono text-[9px] text-muted-foreground/45 tracking-wide">
                        {t.syncOffsetHint}
                      </p>
                    </div>
                  )}
                </div>

              </div>
            </div>
          ) : (
            /* ── Webcam empty ── */
            <div
              role="button"
              tabIndex={0}
              aria-label={t.webcamPrompt}
              onClick={handleWebcamPick}
              onKeyDown={(e) => handleKey(e, handleWebcamPick)}
              onDragOver={handleWebcamDragOver}
              onDragLeave={handleWebcamDragLeave}
              onDrop={handleWebcamDrop}
              className={cn(
                'flex-1 flex flex-col items-center justify-center gap-4 px-6',
                'cursor-pointer select-none transition-all duration-200',
                'border-2 border-dashed',
                webcamDragging
                  ? 'border-primary/50 bg-primary/[0.04]'
                  : 'border-border/40 hover:border-border/70 hover:bg-card/40',
              )}
            >
              {/* Plus + cam icon */}
              <div className={cn(
                'relative transition-colors duration-200',
                webcamDragging ? 'text-primary/70' : 'text-muted-foreground/40',
              )}>
                <CamIcon size={36} />
                <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full
                                 bg-card flex items-center justify-center border border-border/60
                                 text-muted-foreground/60">
                  <PlusIcon />
                </span>
              </div>

              <div className="text-center space-y-1.5">
                <p className="font-mono text-[12px] text-foreground/65">
                  {webcamDragging ? t.dropHere : t.webcamPrompt}
                </p>
                <p className="font-mono text-[10px] text-muted-foreground/55 tracking-wide leading-relaxed">
                  {t.webcamHint}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* CTA */}
      <button
        disabled={!file || ffmpegOk === false}
        onClick={handleStart}
        aria-disabled={!file || ffmpegOk === false}
        className={cn(
          'w-full h-11 font-display text-lg tracking-[0.14em] uppercase',
          'transition-all duration-200 flex items-center justify-center gap-2',
          file && ffmpegOk !== false
            ? 'btn-shine bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.99] shadow-[0_4px_20px_hsl(var(--primary)/0.25)]'
            : 'bg-card/60 text-muted-foreground/50 cursor-not-allowed border border-border/50',
        )}
      >
        {file ? t.startBtn : t.selectVideoBtn}
        {file && webcamFile && (
          <span className="font-mono text-[10px] opacity-60 tracking-wider lowercase">
            {t.webcamBadge}
          </span>
        )}
      </button>

    </section>
  )
}
