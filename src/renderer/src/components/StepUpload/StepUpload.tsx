import { cn } from '@lib'
import { strings } from '@i18n'
import useStepUpload from './useStepUpload'

const t = strings.stepUpload

// ── Icons ─────────────────────────────────────────────────────────────────────

const ScreenIcon = ({ size = 28 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <rect x="2" y="3" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
    <path d="M8 21h8M12 17v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <circle cx="12" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.2" />
  </svg>
)

const CamIcon = ({ size = 24 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <rect x="2" y="7" width="14" height="11" rx="2" stroke="currentColor" strokeWidth="1.5" />
    <path d="M16 10.5l6-4v11l-6-4" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    <circle cx="9" cy="12.5" r="2.5" stroke="currentColor" strokeWidth="1.2" />
  </svg>
)

const CheckIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
    <circle cx="9" cy="9" r="8" stroke="currentColor" strokeWidth="1.3" />
    <path d="M5.5 9l2.5 2.5 4.5-4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

// ── Types ─────────────────────────────────────────────────────────────────────

export interface UploadResult {
  videoPath: string
  webcamPath?: string
  syncOffsetSec?: number
}

interface StepUploadProps {
  onNext: (result: UploadResult) => void
}

// ── Component ─────────────────────────────────────────────────────────────────

const StepUpload = ({ onNext }: StepUploadProps) => {
  const {
    file, fileName, dragging,
    handlePick, handleDragOver, handleDragLeave, handleDrop,
    webcamFile, webcamFileName, webcamDragging, syncOffsetSec,
    handleWebcamPick, handleWebcamDragOver, handleWebcamDragLeave,
    handleWebcamDrop, handleWebcamRemove, setSyncOffsetSec,
    ffmpegOk,
  } = useStepUpload()

  const handleKey = (e: React.KeyboardEvent, fn: () => void) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn() }
  }

  const handleStart = () => {
    if (!file) return
    onNext({ videoPath: file, webcamPath: webcamFile ?? undefined, syncOffsetSec })
  }

  return (
    <section
      className="flex flex-col h-full px-8 pt-6 pb-5 gap-4 animate-fade-up"
      aria-label="Selecionar vídeos"
    >
      {/* Header */}
      <div>
        <p className="font-mono text-[10px] text-muted-foreground/40 tracking-[0.4em] uppercase">
          {t.sectionTitle}
        </p>
      </div>

      {/* ── Two-column drop zones ── */}
      <div className="flex gap-4 flex-1 min-h-0">

        {/* LEFT — Main video (primary, larger) */}
        <div className="flex flex-col gap-2 flex-[3]">
          {/* Label */}
          <div className="flex items-center gap-2">
            <span className={file ? 'text-success' : 'text-primary/60'}>
              <ScreenIcon size={13} />
            </span>
            <span className="font-mono text-[10px] tracking-[0.3em] uppercase text-foreground/60">
              {t.mainLabel}
            </span>
            <span className="font-mono text-[9px] text-muted-foreground/35 tracking-widest">
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
              'cursor-pointer select-none rounded-md border transition-all duration-250',
              dragging
                ? 'border-primary/60 bg-primary/5 scale-[1.005]'
                : file
                  ? 'border-success/40 bg-success/5 hover:bg-success/8'
                  : 'border-border/50 bg-card/30 hover:border-border hover:bg-card/60',
            )}
          >
            {/* Corner accents */}
            {!file && !dragging && (
              <>
                <span className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-primary/20 rounded-tl-md" />
                <span className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-primary/20 rounded-tr-md" />
                <span className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-primary/20 rounded-bl-md" />
                <span className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-primary/20 rounded-br-md" />
              </>
            )}

            {file ? (
              <div className="flex flex-col items-center gap-3 px-8 text-center">
                <span className="text-success"><CheckIcon /></span>
                <div>
                  <p className="font-display text-[40px] leading-none text-success uppercase mb-2">
                    {t.readyLabel}
                  </p>
                  <p className="font-mono text-xs text-foreground/50 truncate max-w-[240px]"
                    title={fileName ?? ''}>
                    {fileName}
                  </p>
                </div>
                <p className="font-mono text-[10px] text-muted-foreground/35 tracking-widest uppercase">
                  {t.swapHint}
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4 px-10 text-center">
                <span className={cn(
                  'transition-colors duration-200',
                  dragging ? 'text-primary/60' : 'text-muted-foreground/20',
                )}>
                  <ScreenIcon size={44} />
                </span>
                <div className="space-y-1.5">
                  <p className="text-foreground/50 text-sm">
                    {dragging ? 'Soltar aqui' : t.dropPrompt}
                  </p>
                  <p className="font-mono text-[10px] text-muted-foreground/30 tracking-widest uppercase">
                    {t.dropFormats}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT — Webcam (secondary, smaller) */}
        <div className="flex flex-col gap-2 flex-[2]">
          {/* Label */}
          <div className="flex items-center gap-2">
            <span className={webcamFile ? 'text-success' : 'text-muted-foreground/35'}>
              <CamIcon size={13} />
            </span>
            <span className="font-mono text-[10px] tracking-[0.3em] uppercase text-muted-foreground/45">
              {t.webcamLabel}
            </span>
            <span className="font-mono text-[9px] text-primary/35 border border-primary/20
                             px-1.5 py-px rounded tracking-widest uppercase">
              {t.webcamOptional}
            </span>
          </div>

          {/* Drop zone */}
          {webcamFile ? (
            <div className="flex-1 flex flex-col rounded-md border border-success/30 bg-success/5">
              {/* File row */}
              <div className="flex items-center gap-2.5 px-4 py-3 border-b border-success/15">
                <span className="text-success/60 shrink-0"><CamIcon size={13} /></span>
                <span className="font-mono text-[11px] text-foreground/55 truncate flex-1"
                  title={webcamFileName ?? ''}>
                  {webcamFileName}
                </span>
                <button
                  type="button"
                  onClick={handleWebcamRemove}
                  className="text-muted-foreground/25 hover:text-destructive/60 transition-colors shrink-0 text-xs"
                  aria-label="Remover câmara"
                >✕</button>
              </div>

              {/* Sync offset */}
              <div className="flex-1 flex flex-col items-center justify-center gap-3 px-5 py-4">
                <div className="text-center">
                  <p className="font-mono text-[10px] text-muted-foreground/40 tracking-widest uppercase mb-3">
                    {t.syncOffsetLabel}
                  </p>
                  <div className="flex items-center gap-2 justify-center">
                    <input
                      id="sync-offset"
                      type="number"
                      step="0.1"
                      min="-60"
                      max="60"
                      value={syncOffsetSec}
                      onChange={(e) => setSyncOffsetSec(parseFloat(e.target.value) || 0)}
                      className="w-20 h-8 bg-background/60 border border-border/50
                                 text-foreground/70 font-mono text-sm text-center tabular-nums
                                 rounded focus:outline-none focus:border-primary/50"
                    />
                    <span className="font-mono text-xs text-muted-foreground/35">seg.</span>
                  </div>
                  <p className="font-mono text-[10px] text-muted-foreground/30 mt-2">
                    {t.syncOffsetHint}
                  </p>
                </div>
              </div>
            </div>
          ) : (
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
                'flex-1 flex flex-col items-center justify-center gap-3 px-6',
                'cursor-pointer select-none rounded-md border border-dashed transition-all duration-200',
                webcamDragging
                  ? 'border-primary/40 bg-primary/5 scale-[1.005]'
                  : 'border-border/30 hover:border-border/55 hover:bg-card/30',
              )}
            >
              <span className={cn(
                'transition-colors duration-200',
                webcamDragging ? 'text-primary/50' : 'text-muted-foreground/18',
              )}>
                <CamIcon size={32} />
              </span>
              <div className="text-center space-y-1.5">
                <p className="text-muted-foreground/40 text-xs">
                  {webcamDragging ? 'Soltar aqui' : t.webcamPrompt}
                </p>
                <p className="font-mono text-[10px] text-muted-foreground/25 tracking-widest uppercase">
                  {t.webcamHint}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* FFmpeg warning */}
      {ffmpegOk === false && (
        <p className="text-destructive text-xs text-center tracking-wide" role="alert">
          {t.ffmpegWarning}{' '}
          <a href="https://ffmpeg.org/download.html" target="_blank" rel="noreferrer"
            className="underline underline-offset-2">{t.ffmpegLink}</a>
        </p>
      )}

      {/* CTA */}
      <button
        disabled={!file || ffmpegOk === false}
        onClick={handleStart}
        aria-disabled={!file || ffmpegOk === false}
        className={cn(
          'w-full h-11 font-display text-lg tracking-[0.14em] uppercase rounded',
          'bg-primary text-primary-foreground',
          'hover:bg-primary/90 active:scale-[0.99] transition-all duration-150',
          'disabled:opacity-25 disabled:cursor-not-allowed disabled:scale-100',
          'flex items-center justify-center gap-2',
        )}
      >
        {t.startBtn}
        {webcamFile && (
          <span className="font-mono text-[10px] opacity-60 tracking-wider lowercase">
            + câmara
          </span>
        )}
      </button>

    </section>
  )
}

export default StepUpload
