import type { RenderResult } from '@/types'
import { strings } from '@i18n'
import { fmtTime, basename } from '@lib'
import { ScreenIcon, CamIcon, FolderIcon } from '@assets/icons'

const t = strings.stepDone

interface StepDoneProps {
  result: RenderResult
  onNew: () => void
}

export const StepDone = ({ result, onNew }: StepDoneProps) => {
  const { outputPath, duration, segments, webcamOutputPath } = result
  const folderPath = outputPath.replace(/[/\\][^/\\]+$/, '')
  const fileName = basename(outputPath)
  const hasDual = !!webcamOutputPath

  return (
    <section
      className="flex flex-col items-center justify-center h-full px-10 gap-6 animate-fade-up"
      aria-labelledby="done-title"
      aria-live="polite"
    >
      {/* Success glow + title */}
      <div className="relative text-center">
        {/* Glow blob behind title — larger and warmer */}
        <div className="absolute inset-0 -m-12 rounded-full
                        bg-[radial-gradient(ellipse,hsl(145_52%_48%/0.15)_0%,transparent_65%)]
                        pointer-events-none animate-[ambient-glow_4s_ease-in-out_infinite]"
          aria-hidden="true" />

        <p className="relative font-mono text-[10px] text-muted-foreground/40 tracking-[0.4em] uppercase mb-2 animate-fade-in">
          {t.eyebrow}
        </p>
        <h1
          id="done-title"
          className="relative font-display text-[82px] leading-[0.85] text-success uppercase
                     text-glow-success animate-scale-in"
        >
          {t.title}
        </h1>
      </div>

      {/* Stats row — staggered entrance */}
      <div className="flex gap-3 w-full max-w-sm">
        {/* Duration */}
        <div className="glass flex-1 rounded-md px-4 py-3 text-center
                        animate-fade-up border-success/10 shadow-[inset_0_1px_0_hsl(145_52%_48%/0.06)]">
          <p className="font-display text-2xl text-foreground tabular-nums">
            {fmtTime(duration ?? 0)}
          </p>
          <p className="font-mono text-[9px] text-muted-foreground/40 tracking-widest uppercase mt-0.5">
            {t.durationLabel}
          </p>
        </div>

        {/* Cuts */}
        <div className="glass flex-1 rounded-md px-4 py-3 text-center
                        animate-fade-up delay-75 border-success/10 shadow-[inset_0_1px_0_hsl(145_52%_48%/0.06)]">
          <p className="font-display text-2xl text-foreground tabular-nums">
            {segments ?? '—'}
          </p>
          <p className="font-mono text-[9px] text-muted-foreground/40 tracking-widest uppercase mt-0.5">
            {t.segmentsLabel}
          </p>
        </div>

        {/* Files (dual-video) */}
        {hasDual && (
          <div className="glass flex-1 rounded-md px-4 py-3 text-center
                          animate-fade-up delay-150 border-success/15">
            <p className="font-display text-2xl text-success tabular-nums">2</p>
            <p className="font-mono text-[9px] text-muted-foreground/40 tracking-widest uppercase mt-0.5">
              {t.filesLabel}
            </p>
          </div>
        )}
      </div>

      {/* Output files */}
      <div className="w-full max-w-sm flex flex-col gap-1.5">
        <div className="glass rounded-md flex items-center gap-3 px-4 py-2.5">
          <span className="text-muted-foreground/40 shrink-0"><ScreenIcon size={12} /></span>
          <div className="flex flex-col min-w-0 flex-1">
            <span className="font-mono text-[9px] text-muted-foreground/35 tracking-widest uppercase">
              {t.mainFileLabel}
            </span>
            <span className="font-mono text-[11px] text-foreground/60 truncate" title={fileName}>
              {fileName}
            </span>
          </div>
        </div>

        {hasDual && webcamOutputPath && (
          <div className="glass rounded-md flex items-center gap-3 px-4 py-2.5
                          border-success/20 bg-success/5">
            <span className="text-success/40 shrink-0"><CamIcon size={12} /></span>
            <div className="flex flex-col min-w-0 flex-1">
              <span className="font-mono text-[9px] text-success/35 tracking-widest uppercase">
                {t.webcamFileLabel}
              </span>
              <span className="font-mono text-[11px] text-foreground/55 truncate"
                title={basename(webcamOutputPath)}>
                {basename(webcamOutputPath)}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-2.5 w-full max-w-sm">
        <button
          onClick={() => window.api.openFolder(folderPath)}
          className="btn-shine h-11 w-full rounded bg-primary text-primary-foreground
                     font-display text-lg tracking-[0.1em] uppercase
                     flex items-center justify-center gap-2.5
                     hover:bg-primary/90 active:scale-[0.99] transition-all duration-150
                     shadow-[0_4px_20px_hsl(var(--primary)/0.25)]"
        >
          <FolderIcon />
          {t.openFolderBtn}
        </button>
        <button
          onClick={onNew}
          className="h-9 w-full font-mono text-[11px] text-muted-foreground/40
                     tracking-widest uppercase rounded
                     hover:text-muted-foreground/70 transition-colors"
        >
          {t.editAnotherBtn}
        </button>
      </div>

    </section>
  )
}
