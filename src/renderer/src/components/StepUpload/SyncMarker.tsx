import { useEffect, useRef, useState, useCallback } from 'react'
import { strings } from '@i18n'
import type { SyncProxies } from '@/types'
import { CloseIcon } from '@assets/icons'

const t = strings.stepUpload

// Sources are 29.97fps; 1/30 is close enough to step by, and it is also the
// granularity the offset is nudged at — 0.1s steps are ~3 frames, too coarse
// to land lip-sync.
const FRAME = 1 / 30

// How far the webcam may drift from its target before being pulled back. Both
// files play at the same rate, so drift is tiny; correcting too eagerly makes
// the picture stutter, which is exactly what the eye is trying to judge here.
const DRIFT_TOLERANCE = 0.08

const fmt = (s: number): string => {
  const m = Math.floor(s / 60)
  return `${String(m).padStart(2, '0')}:${(s - m * 60).toFixed(3).padStart(6, '0')}`
}

const clampStep = (v: number) => Math.min(60, Math.max(-60, Math.round(v * 1000) / 1000))

const VIDEO_CLS = 'w-full h-full object-contain'

/** Labelled 16:9 frame around one of the two pictures. */
const Frame = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex-1 min-w-0 flex flex-col gap-2">
    <span className="font-mono text-[10px] tracking-[0.25em] uppercase text-muted-foreground/70">
      {label}
    </span>
    <div className="relative bg-black/60 border border-border/60 aspect-video overflow-hidden">
      {children}
    </div>
  </div>
)

// ── Dialog ────────────────────────────────────────────────────────────────────

interface SyncMarkerProps {
  videoPath: string
  webcamPath: string
  initialOffset: number
  onApply: (offsetSec: number) => void
  onClose: () => void
}

interface Sources { videoUrl: string; webcamUrl: string; seconds: number }

export const SyncMarker = ({ videoPath, webcamPath, initialOffset, onApply, onClose }: SyncMarkerProps) => {
  const mainRef = useRef<HTMLVideoElement>(null)
  const webRef = useRef<HTMLVideoElement>(null)

  const [sources, setSources] = useState<Sources | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [offset, setOffset] = useState(initialOffset)
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [mediaError, setMediaError] = useState<string | null>(null)

  // Read inside timeupdate without re-registering the handler every change.
  const offsetRef = useRef(offset)
  offsetRef.current = offset

  // ── Load the proxies as blob URLs ─────────────────────────────────────────
  useEffect(() => {
    let alive = true
    const urls: string[] = []

    window.api.prepareSync(videoPath, webcamPath)
      .then((p: SyncProxies) => {
        if (!alive) return
        const toUrl = (bytes: ArrayBuffer) => {
          const url = URL.createObjectURL(new Blob([bytes], { type: 'video/mp4' }))
          urls.push(url)
          return url
        }
        setSources({ videoUrl: toUrl(p.video), webcamUrl: toUrl(p.webcam), seconds: p.seconds })
      })
      .catch((err: unknown) => {
        if (alive) setError(err instanceof Error ? err.message : String(err))
      })

    return () => {
      alive = false
      urls.forEach(URL.revokeObjectURL)
    }
  }, [videoPath, webcamPath])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  // ── Keeping the two in step ───────────────────────────────────────────────

  // render.ts cuts the webcam at (mainTime − offset), so the preview must show
  // exactly that pairing for what the user sees here to be what they get.
  const webcamTimeFor = (mainTime: number, off: number) => mainTime - off

  const alignWebcam = useCallback((force = false) => {
    const main = mainRef.current
    const web = webRef.current
    if (!main || !web) return
    const target = webcamTimeFor(main.currentTime, offsetRef.current)
    const inRange = target >= 0 && target <= (web.duration || 0)
    if (!inRange) { if (!web.paused) web.pause(); return }
    if (force || Math.abs(web.currentTime - target) > DRIFT_TOLERANCE) web.currentTime = target
    if (!main.paused && web.paused) web.play().catch(() => {})
  }, [])

  // Re-align whenever the offset changes, so the effect is visible immediately
  // — including mid-playback, which is the whole point of this dialog.
  useEffect(() => { alignWebcam(true) }, [offset, alignWebcam])

  const pendingPlay = useRef<Promise<void> | null>(null)

  const togglePlay = async () => {
    const main = mainRef.current
    const web = webRef.current
    if (!main || !web) return

    if (main.paused) {
      alignWebcam(true)
      const p = main.play()
      pendingPlay.current = p
      try {
        await p
        setMediaError(null)
        const target = webcamTimeFor(main.currentTime, offsetRef.current)
        if (target >= 0 && target <= (web.duration || 0)) await web.play().catch(() => {})
      } catch (err) {
        // A pause during a pending play aborts it — a benign race, not a fault.
        if (err instanceof Error && err.name === 'AbortError') return
        setMediaError(err instanceof Error ? `${err.name}: ${err.message}` : String(err))
      } finally {
        if (pendingPlay.current === p) pendingPlay.current = null
      }
    } else {
      try { await pendingPlay.current } catch { /* reported by its own handler */ }
      main.pause()
      web.pause()
    }
  }

  const seek = (to: number) => {
    const main = mainRef.current
    if (!main) return
    main.currentTime = Math.min(Math.max(0, to), duration || 0)
    alignWebcam(true)
  }

  const webTarget = webcamTimeFor(time, offset)
  const webOutOfRange = sources !== null && (webTarget < 0 || webTarget > sources.seconds)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/85 backdrop-blur-sm p-6"
      role="dialog" aria-modal="true" aria-label={t.syncMarkerTitle}
    >
      <div className="w-full max-w-[1040px] max-h-full overflow-auto border border-border/70 bg-card/95 p-6 animate-fade-up">

        <div className="flex items-start justify-between gap-4 mb-1">
          <h2 className="font-display text-[26px] leading-none text-foreground uppercase">{t.syncMarkerTitle}</h2>
          <button type="button" onClick={onClose} aria-label={t.syncMarkerClose}
            className="text-muted-foreground/60 hover:text-foreground transition-colors">
            <CloseIcon size={16} />
          </button>
        </div>
        <p className="font-mono text-[11px] leading-relaxed text-muted-foreground/70 mb-5 max-w-[80ch]">
          {t.syncMarkerIntro}
        </p>

        {error ? (
          <div role="alert" className="py-8 text-center space-y-2">
            <p className="font-mono text-[11px] text-destructive/90">{t.syncMarkerFailed}</p>
            <p className="font-mono text-[9px] text-muted-foreground/60 break-words max-w-[80ch] mx-auto">{error}</p>
          </div>
        ) : !sources ? (
          <div className="py-14 flex flex-col items-center gap-3" aria-busy="true">
            <div className="flex gap-1.5" aria-hidden="true">
              {[0, 1, 2].map(i => (
                <span key={i} className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-pulse"
                  style={{ animationDelay: `${i * 0.18}s` }} />
              ))}
            </div>
            <p className="font-mono text-[11px] text-muted-foreground/70">{t.syncMarkerPreparing}</p>
            <p className="font-mono text-[9px] text-muted-foreground/45">{t.syncMarkerPreparingHint}</p>
          </div>
        ) : (
          <>
            {/* The two pictures. Only the frame is shared — the main video drives
                the clock and carries the sound, the webcam just follows — so each
                one's wiring is written out rather than hidden behind ternaries. */}
            <div className="flex gap-4">
              <Frame label={t.syncMarkerMain}>
                <video
                  ref={mainRef}
                  src={sources.videoUrl}
                  className={VIDEO_CLS}
                  preload="auto"
                  onLoadedMetadata={e => { setDuration(e.currentTarget.duration); alignWebcam(true) }}
                  onTimeUpdate={e => { setTime(e.currentTarget.currentTime); alignWebcam() }}
                  onPlay={() => setPlaying(true)}
                  onPause={() => setPlaying(false)}
                  onError={e => setMediaError(`${t.syncMarkerMain}: ${e.currentTarget.error?.message ?? 'erro de leitura'}`)}
                  onClick={togglePlay}
                />
              </Frame>

              <Frame label={t.syncMarkerWebcam}>
                <video
                  ref={webRef}
                  src={sources.webcamUrl}
                  muted                              // the voice comes from the main file
                  className={VIDEO_CLS}
                  preload="auto"
                  onLoadedMetadata={() => alignWebcam(true)}
                  onError={e => setMediaError(`${t.syncMarkerWebcam}: ${e.currentTarget.error?.message ?? 'erro de leitura'}`)}
                  onClick={togglePlay}
                />
                {webOutOfRange && (
                  <p className="absolute inset-x-0 bottom-0 px-2 py-1 bg-background/85
                                font-mono text-[9px] text-muted-foreground/80 text-center">
                    {t.syncMarkerOutOfRange}
                  </p>
                )}
              </Frame>
            </div>

            {mediaError && (
              <p role="alert" className="mt-2 font-mono text-[9px] text-destructive/90 break-words">{mediaError}</p>
            )}

            {/* One shared timeline */}
            <input
              type="range" min={0} max={duration || 0} step={FRAME} value={time}
              onChange={e => seek(parseFloat(e.target.value))}
              aria-label={t.syncMarkerPlayPause}
              className="w-full accent-primary h-1 cursor-pointer mt-4"
            />

            {/* One transport + the offset */}
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <button type="button" onClick={togglePlay} aria-label={t.syncMarkerPlayPause}
                className="w-10 h-9 flex items-center justify-center border border-primary/50 bg-primary/10
                           text-primary hover:bg-primary/20 transition-colors font-mono text-[12px]"
              >{playing ? '❚❚' : '▶'}</button>
              <button type="button" onClick={() => seek(time - FRAME)} aria-label={t.syncMarkerPrevFrame}
                className="w-8 h-9 flex items-center justify-center border border-border/60 bg-card/40
                           text-muted-foreground/80 hover:text-primary hover:border-primary/50 transition-colors font-mono text-[11px]"
              >◀</button>
              <button type="button" onClick={() => seek(time + FRAME)} aria-label={t.syncMarkerNextFrame}
                className="w-8 h-9 flex items-center justify-center border border-border/60 bg-card/40
                           text-muted-foreground/80 hover:text-primary hover:border-primary/50 transition-colors font-mono text-[11px]"
              >▶</button>

              <span className="ml-1 font-mono text-[12px] tabular-nums text-foreground/80">{fmt(time)}</span>

              {/* Offset — nudged a frame at a time, live while playing */}
              <div className="ml-auto flex items-center gap-2">
                <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-muted-foreground/65">
                  {t.syncMarkerOffsetLabel}
                </span>
                <div className="flex items-stretch h-9 border border-border/60 bg-background/60">
                  <button type="button" aria-label={t.syncDecrease}
                    onClick={() => setOffset(o => clampStep(o - FRAME))}
                    className="w-8 flex items-center justify-center text-base leading-none
                               text-muted-foreground/70 hover:text-primary hover:bg-primary/10 transition-colors"
                  >−</button>
                  <input
                    type="number" step={0.01} min={-60} max={60} value={offset}
                    onChange={e => setOffset(clampStep(parseFloat(e.target.value) || 0))}
                    aria-label={t.syncMarkerOffsetLabel}
                    className="w-20 bg-transparent text-center font-mono text-[13px] tabular-nums
                               text-foreground/90 border-x border-border/60 focus:outline-none
                               focus:bg-primary/[0.06] transition-colors
                               [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <button type="button" aria-label={t.syncIncrease}
                    onClick={() => setOffset(o => clampStep(o + FRAME))}
                    className="w-8 flex items-center justify-center text-base leading-none
                               text-muted-foreground/70 hover:text-primary hover:bg-primary/10 transition-colors"
                  >+</button>
                </div>
                <span className="font-mono text-[10px] text-muted-foreground/55">{t.secUnit}</span>

                <button
                  type="button"
                  onClick={() => { onApply(clampStep(offset)); onClose() }}
                  className="btn-shine h-9 px-5 bg-primary text-primary-foreground
                             font-display text-base tracking-[0.12em] uppercase
                             hover:bg-primary/90 active:scale-[0.98] transition-all duration-150"
                >{t.syncMarkerApply}</button>
              </div>
            </div>

            <p className="font-mono text-[9px] text-muted-foreground/40 mt-3">
              {t.syncMarkerWindowHint.replace('{s}', String(sources.seconds))}
            </p>
          </>
        )}
      </div>
    </div>
  )
}
