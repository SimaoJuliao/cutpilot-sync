import type { RenderResult } from '@/types'
import { strings } from '@i18n'
import { fmtTime, basename } from '@lib'

const t = strings.stepDone

interface StepDoneProps {
  result: RenderResult
  onNew:  () => void
}

const StepDone = ({ result, onNew }: StepDoneProps) => {
  const { outputPath, duration, segments } = result
  const folderPath = outputPath.replace(/[/\\][^/\\]+$/, '')
  const fileName   = basename(outputPath)

  return (
    <section
      className="flex flex-col items-center justify-center h-full px-12 gap-8 animate-fade-up"
      aria-labelledby="done-title"
      aria-live="polite"
    >

      {/* Big display title */}
      <div className="text-center">
        <p className="font-mono text-[11px] text-muted-foreground/65 tracking-[0.4em] uppercase mb-3" aria-hidden="true">
          {t.eyebrow}
        </p>
        <h1
          id="done-title"
          className="font-display text-[72px] leading-[0.88] text-success uppercase"
        >
          {t.title}
        </h1>
      </div>

      {/* Filename */}
      <p
        className="font-mono text-xs text-muted-foreground/70 tracking-wide truncate max-w-xs"
        title={fileName}
        aria-label={`Ficheiro: ${fileName}`}
      >
        {fileName}
      </p>

      {/* Stats */}
      <dl
        className="flex items-center gap-5 font-mono text-sm"
        aria-label="Estatísticas do vídeo editado"
      >
        <div className="text-center">
          <dt className="text-muted-foreground/65 text-[11px] tracking-widest uppercase mt-0.5 order-2">
            {t.durationLabel}
          </dt>
          <dd className="text-foreground font-bold tabular-nums">
            {fmtTime(duration ?? 0)}
          </dd>
        </div>

        <div className="w-px h-8 bg-border" aria-hidden="true" />

        <div className="text-center">
          <dt className="text-muted-foreground/65 text-[11px] tracking-widest uppercase mt-0.5 order-2">
            {t.segmentsLabel}
          </dt>
          <dd className="text-foreground font-bold tabular-nums">
            {segments ?? '—'}
          </dd>
        </div>
      </dl>

      {/* Actions */}
      <div className="flex flex-col gap-3 w-full max-w-xs">
        <button
          onClick={() => window.api.openFolder(folderPath)}
          aria-label={`${t.openFolderBtn} — abrir a pasta com o vídeo editado`}
          className="h-11 w-full bg-primary text-primary-foreground
                     font-display text-lg tracking-[0.1em] uppercase
                     hover:bg-primary/90 active:scale-[0.98] transition-all duration-150"
        >
          {t.openFolderBtn}
        </button>
        <button
          onClick={onNew}
          aria-label="Editar outro vídeo — voltar ao início"
          className="h-9 w-full font-mono text-xs text-muted-foreground/70 tracking-widest uppercase
                     hover:text-foreground transition-colors"
        >
          {t.editAnotherBtn}
        </button>
      </div>
    </section>
  )
}

export default StepDone
