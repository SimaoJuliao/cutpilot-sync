import { cn } from '@lib'
import { strings } from '@i18n'
import useStepUpload from './useStepUpload'

const t = strings.stepUpload

// Film-frame corner brackets
const FrameCorners = ({ active, success }: { active: boolean; success: boolean }) => {
  const color = success ? 'border-success' : active ? 'border-primary' : 'border-border'
  const trans  = 'transition-colors duration-200'
  return (
    <>
      <span className={cn('absolute top-4 left-4 w-6 h-6 border-t-2 border-l-2', color, trans)} />
      <span className={cn('absolute top-4 right-4 w-6 h-6 border-t-2 border-r-2', color, trans)} />
      <span className={cn('absolute bottom-4 left-4 w-6 h-6 border-b-2 border-l-2', color, trans)} />
      <span className={cn('absolute bottom-4 right-4 w-6 h-6 border-b-2 border-r-2', color, trans)} />
    </>
  )
}

interface StepUploadProps {
  onNext: (path: string) => void
}

const StepUpload = ({ onNext }: StepUploadProps) => {
  const {
    file, fileName, dragging, ffmpegOk,
    handlePick, handleDragOver, handleDragLeave, handleDrop,
  } = useStepUpload()

  // Keyboard support — Enter/Space opens the file picker
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handlePick()
    }
  }

  const dropLabel = file
    ? `Vídeo selecionado: ${fileName}. ${t.swapHint}`
    : `${t.dropPrompt}. Formatos suportados: ${t.dropFormats}`

  return (
    <section
      className="flex flex-col items-center justify-center h-full px-12 gap-6 animate-fade-up"
      aria-label="Selecionar vídeo"
    >

      {/* Drop zone */}
      <div
        role="button"
        tabIndex={0}
        aria-label={dropLabel}
        aria-pressed={!!file}
        onClick={handlePick}
        onKeyDown={handleKeyDown}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          'relative w-full max-w-sm cursor-pointer select-none',
          'flex flex-col items-center justify-center py-16 px-8',
          'transition-all duration-200',
          dragging && 'scale-[1.02]',
        )}
      >
        <FrameCorners active={dragging} success={!!file && !dragging} />

        {file ? (
          <div className="text-center space-y-2">
            <p className="font-display text-4xl text-success" aria-hidden="true">{t.readyLabel}</p>
            <p className="text-foreground/80 text-sm font-mono truncate max-w-[260px]" title={fileName ?? ''}>
              {fileName}
            </p>
            <p className="text-muted-foreground/65 text-[11px] tracking-widest uppercase mt-1">
              {t.swapHint}
            </p>
          </div>
        ) : (
          <div className="text-center space-y-3">
            {/* Film reel icon */}
            <svg
              width="48" height="48" viewBox="0 0 48 48" fill="none"
              className="mx-auto opacity-50"
              aria-hidden="true"
            >
              <circle cx="24" cy="24" r="21" stroke="currentColor" strokeWidth="1.5" />
              <circle cx="24" cy="24" r="7"  stroke="currentColor" strokeWidth="1.5" />
              <circle cx="24" cy="11" r="3"  fill="currentColor" opacity="0.6" />
              <circle cx="24" cy="37" r="3"  fill="currentColor" opacity="0.6" />
              <circle cx="11" cy="24" r="3"  fill="currentColor" opacity="0.6" />
              <circle cx="37" cy="24" r="3"  fill="currentColor" opacity="0.6" />
            </svg>
            <p className="text-foreground/80 text-sm leading-snug">{t.dropPrompt}</p>
            <p className="text-muted-foreground/65 text-[11px] tracking-widest uppercase">
              {t.dropFormats}
            </p>
          </div>
        )}
      </div>

      {/* FFmpeg warning */}
      {ffmpegOk === false && (
        <p className="text-destructive text-xs text-center tracking-wide" role="alert">
          {t.ffmpegWarning}{' '}
          <a
            href="https://ffmpeg.org/download.html"
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-2"
            aria-label="Instalar FFmpeg (abre em nova janela)"
          >
            {t.ffmpegLink}
          </a>
        </p>
      )}

      {/* CTA */}
      <button
        disabled={!file || ffmpegOk === false}
        onClick={() => file && onNext(file)}
        aria-disabled={!file || ffmpegOk === false}
        className={cn(
          'w-full max-w-sm h-11 font-display text-lg tracking-[0.12em] uppercase',
          'bg-primary text-primary-foreground',
          'hover:bg-primary/90 active:scale-[0.98] transition-all duration-150',
          'disabled:opacity-30 disabled:cursor-not-allowed disabled:scale-100',
        )}
      >
        {t.startBtn}
      </button>
    </section>
  )
}

export default StepUpload
