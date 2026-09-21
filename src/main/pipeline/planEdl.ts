/**
 * planEdl.ts
 * Turns a transcript into the final list of ranges to keep.
 *
 * This is the whole editorial pipeline in one place: Claude PROPOSES the cut,
 * then two deterministic passes DISPOSE of what a model cannot be trusted to do
 * reliably —
 *
 *   1. refineEdl   — force out retake takes, clamp every range to the speech it
 *                    actually contains, pad the boundaries off the words.
 *   2. tightenPauses — cap the silence that survives, if the user asked for it.
 *
 * Order matters: tightening works on the FINAL kept ranges, so it also sees the
 * pauses created at the joins between them, which is where half of them come
 * from. It reads the audio itself rather than the ASR, so it needs the source.
 *
 * Lives here rather than in the IPC handler so the handler stays a thin adapter
 * (key check, progress forwarding) and the pipeline can be exercised — as the
 * regression harness does — without Electron.
 */

import type { EdlRange, PlanEdlOptions } from '../../../src/renderer/src/types/electron'
import { buildPrompt } from './buildPrompt'
import { callClaude } from './callClaude'
import { refineEdl } from './refineEdl'
import { getAudioEnvelope } from './audioEnvelope'
import { tightenPauses } from './tightenPauses'

export const planEdl = async (
  { transcript, videoPath, videoName, language, maxPauseSec }: PlanEdlOptions,
  apiKey: string,
  onChunk: (chunk: string) => void,
): Promise<EdlRange[]> => {
  // The envelope is local ffmpeg work on a resource Claude knows nothing about,
  // so start it now and let it run behind the API call instead of after it.
  // Kept from rejecting unhandled if Claude fails first.
  const envelope = maxPauseSec ? getAudioEnvelope(videoPath) : null
  envelope?.catch(() => { /* surfaced at the await below */ })

  const proposed = await callClaude(buildPrompt(transcript, videoName, language), apiKey, onChunk)
  const refined = refineEdl(proposed, transcript)
  if (!envelope) return refined

  const tightened = tightenPauses(refined, transcript.words, await envelope, maxPauseSec)
  console.log(`[planEdl] pausas ≤${maxPauseSec}s | segmentos ${refined.length}→${tightened.length}`)
  return tightened
}
