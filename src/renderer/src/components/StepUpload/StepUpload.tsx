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

const CheckIcon = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <circle cx="10" cy="10" r="9" stroke="currentColor" strokeWidth="1.4" />
    <path d="M6 10l3 3 5-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const PlusIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
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

              {/* Sync offset */}
              <div className="flex-1 flex flex-col items-center justify-center gap-3 px-5 py-4">
                <p className="font-mono text-[10px] text-muted-foreground/70 tracking-widest uppercase">
                  {t.syncOffsetLabel}
                </p>
                <div className="flex items-center gap-2">
                  <input
                    id="sync-offset"
                    type="number"
                    step="0.1"
                    min="-60"
                    max="60"
                    value={syncOffsetSec}
                    onChange={(e) => setSyncOffsetSec(parseFloat(e.target.value) || 0)}
                    className="w-20 h-9 bg-background/80 border border-border/70
                               text-foreground/80 font-mono text-sm text-center tabular-nums
                               focus:outline-none focus:border-primary/60 transition-colors"
                  />
                  <span className="font-mono text-xs text-muted-foreground/65">{t.secUnit}</span>
                </div>
                <p className="font-mono text-[10px] text-muted-foreground/60 text-center leading-relaxed">
                  {t.syncOffsetHint}
                </p>
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

export default StepUpload
