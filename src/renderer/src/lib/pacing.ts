/**
 * pacing.ts
 * How much silence the finished video is allowed to keep.
 *
 * The raw cut keeps every pause the speaker made, which on a delivered
 * 12-minute edit meant a pause every ~6 seconds. Capping them is a per-video
 * editorial choice — a tutorial breathes, a news round-up should not — so the
 * value is the user's, not a constant.
 *
 * The tiers are measured, not guessed. On two real 12-minute recordings,
 * counting silences of 0.25s or longer in the finished cut:
 *
 *   tier      pauses      segments      longest silence
 *   0 (off)   123 / 128    74 /  90      1.79s
 *   0.25s     101 /  98   109 / 118      0.69s
 *   0.15s      26 /  45   162 / 150      0.49s
 *   0.10s      17 /  30   178 / 182      0.43s
 *
 * No setting lost a word or cut next to audible speech. The cost is render
 * time: every segment is cut by its own ffmpeg call, so the default tier
 * roughly doubles the cutting stage and the tightest one a little more.
 */

import type { MaxPauseSec } from '@/types'
import { strings } from '@i18n'

const t = strings.stepUpload

/** The offered tiers, in the order they are shown. */
export const PACING_TIERS: ReadonlyArray<{
  sec: MaxPauseSec
  title: string
  desc: string
  /** Warn that this tier costs noticeably more render time. */
  slower?: boolean
}> = [
  { sec: 0, title: t.pacingOffTitle, desc: t.pacingOffDesc },
  { sec: 0.25, title: t.pacingRelaxedTitle, desc: t.pacingMaxDesc.replace('{s}', '0,25') },
  { sec: 0.15, title: t.pacingTightTitle, desc: t.pacingMaxDesc.replace('{s}', '0,15') },
  { sec: 0.1, title: t.pacingTightestTitle, desc: t.pacingTightestDesc, slower: true },
]

/**
 * Tight enough that the pauses stop being noticeable, without the render cost
 * of the tightest tier. Not "off": the client complaint that prompted this
 * feature was about the untightened output, so leaving the default there would
 * keep shipping the thing they objected to.
 */
export const DEFAULT_MAX_PAUSE_SEC: MaxPauseSec = 0.15
