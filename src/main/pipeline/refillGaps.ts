/**
 * refillGaps.ts
 * Additive recovery of speech the full-file Deepgram pass dropped.
 *
 * When a speaker repeats takes, Deepgram's full-file processing sometimes drops a
 * clean take entirely — the audio is there, but no words land in the transcript.
 * Re-transcribing that span IN ISOLATION recovers it (no full-file dedup).
 *
 * This pass NEVER touches the base transcript's existing words — it only inserts
 * recovered words into regions that had none. Worst case (unrecoverable audio):
 * the gap re-transcribes empty and nothing changes. No regression risk.
 *
 * Pipeline:
 *   1. silencedetect → speech intervals; cross-ref with word coverage → "gaps"
 *      (speech energy, zero transcribed words)
 *   2. re-transcribe each gap as an isolated short clip
 *   3. merge recovered words (inside the gap) back into the transcript
 */

import { spawn, execFile } from 'child_process'
import { promisify } from 'util'
import { statSync, existsSync, unlinkSync, createReadStream } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import axios from 'axios'
import type { ScribeWord } from '../../../src/renderer/src/types/electron'
import { getFFmpegPath } from './ffmpeg'
import { runPool } from './concurrency'

const execFileAsync = promisify(execFile)

// silencedetect threshold. -23dB keeps only clear speech (real words peak well
// above this, ~-13dB) and treats breaths/room noise as silence — this keeps the
// false-gap count down so a short MIN_GAP doesn't flood with empty clips.
const SILENCE_NOISE = '-23dB'
const SILENCE_MIN = '0.4'   // a gap must be ≥ this to count as silence (s)
const MIN_GAP = 0.5         // ignore uncovered speech shorter than this (s) — low
                            //   enough to catch a single dropped word ("trillion")
const MAX_GAP = 15          // skip very long spans — not a simple dropped take (s)
const CONTEXT = 2.5         // padding around the gap when extracting the clip (s);
                            //   enough lead-in for the ASR to transcribe a trailing
                            //   word — context words outside the gap are discarded
const MAX_GAPS = 50         // safety cap on re-transcription calls per video
const CONCURRENCY = 3       // isolated clips re-transcribed in parallel
// Conservative floor: drop only clearly-junk low-confidence words. Confidence
// does NOT cleanly separate ASR gibberish from real words (mid-confidence noise
// exists), so this only removes the bottom tier — real recoveries observed ≥0.54.
const MIN_CONFIDENCE = 0.4

interface Gap { start: number; end: number }

// On a 1–3s clip, detect_language sometimes mis-guesses the language and returns
// gibberish in another script (e.g. a quiet PT clip transcribed as Cyrillic).
// Only accept Latin-script words so we never inject garbage into the transcript.
const isLatinScript = (s: string): boolean =>
  s.length > 0 && !/[^\p{Script=Latin}\p{P}\p{N}\p{Zs}'’"]/u.test(s)

interface DgClipResponse {
  results?: {
    channels?: Array<{
      alternatives?: Array<{
        words?: Array<{ word: string; punctuated_word?: string; start: number; end: number; confidence?: number }>
      }>
    }>
  }
}

// ─────────────────────────────────────────────────────────────────────────────

const parseSilences = (stderr: string): [number, number][] => {
  const out: [number, number][] = []
  const re = /silence_start:\s*(-?[\d.]+)[\s\S]*?silence_end:\s*([\d.]+)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(stderr))) out.push([Math.max(0, parseFloat(m[1])), parseFloat(m[2])])
  return out
}

const audioDuration = (stderr: string, words: ScribeWord[]): number => {
  const m = stderr.match(/Duration:\s*(\d+):(\d+):(\d+\.\d+)/)
  if (m) return +m[1] * 3600 + +m[2] * 60 + parseFloat(m[3])
  const last = words.filter(w => w.type === 'word').at(-1)
  return last ? last.end + 5 : 0
}

/** Find spans with speech energy but no transcribed words. */
const detectGaps = async (audioPath: string, words: ScribeWord[]): Promise<Gap[]> => {
  const stderr = await new Promise<string>((resolve) => {
    let buf = ''
    const ff = spawn(getFFmpegPath(), ['-vn', '-i', audioPath, '-af', `silencedetect=noise=${SILENCE_NOISE}:d=${SILENCE_MIN}`, '-f', 'null', '-'])
    ff.stderr.on('data', (d: Buffer) => { buf += d.toString() })
    ff.on('close', () => resolve(buf))
    ff.on('error', () => resolve(buf))
  })

  const dur = audioDuration(stderr, words)
  const silences = parseSilences(stderr)

  // speech = complement of silence
  const speech: [number, number][] = []
  let cur = 0
  for (const [s, e] of silences) { if (s > cur) speech.push([cur, s]); cur = Math.max(cur, e) }
  if (cur < dur) speech.push([cur, dur])

  // merged word coverage
  const wi: [number, number][] = []
  for (const w of words.filter(w => w.type === 'word').sort((a, b) => a.start - b.start)) {
    const last = wi[wi.length - 1]
    if (last && w.start <= last[1] + 0.35) last[1] = Math.max(last[1], w.end)
    else wi.push([w.start, w.end])
  }

  // uncovered sub-intervals within each speech segment
  const gaps: Gap[] = []
  for (const [s, e] of speech) {
    let p = s
    const inside = wi.filter(([a, b]) => b > s && a < e).sort((x, y) => x[0] - y[0])
    for (const [a, b] of inside) { if (a > p) gaps.push({ start: p, end: a }); p = Math.max(p, b) }
    if (e > p) gaps.push({ start: p, end: e })
  }

  return gaps.filter(g => g.end - g.start >= MIN_GAP && g.end - g.start <= MAX_GAP).slice(0, MAX_GAPS)
}

/** Re-transcribe one gap as an isolated clip; return recovered words inside it. */
const transcribeGap = async (audioPath: string, gap: Gap, apiKey: string): Promise<ScribeWord[]> => {
  const clipPath = join(tmpdir(), `cps_gap_${Date.now()}_${Math.round(gap.start * 1000)}.wav`)
  const clipStart = Math.max(0, gap.start - CONTEXT)
  const clipDur = (gap.end - gap.start) + 2 * CONTEXT

  try {
    await execFileAsync(getFFmpegPath(), [
      '-y', '-ss', String(clipStart), '-i', audioPath, '-t', String(clipDur),
      '-ac', '1', '-ar', '16000', '-c:a', 'pcm_s16le', clipPath,
    ])

    // `multi` (not detect_language) for the isolated clip: detect_language is
    // flaky on 1–6s audio (returns empty, or mis-detects the language and emits
    // gibberish), whereas the multilingual model reliably handles the PT speech
    // and the English terms mixed into it ("one trillion") — and there's no
    // full-file dedup at this small scale.
    const params = new URLSearchParams({ model: 'nova-3', language: 'multi', filler_words: 'true', punctuate: 'true' })
    const res = await axios.post(`https://api.deepgram.com/v1/listen?${params}`, createReadStream(clipPath), {
      headers: { Authorization: `Token ${apiKey}`, 'Content-Type': 'audio/wav', 'Content-Length': String(statSync(clipPath).size) },
      maxContentLength: Infinity, maxBodyLength: Infinity, timeout: 2 * 60 * 1000,
    })

    const dgWords = (res.data as DgClipResponse).results?.channels?.[0]?.alternatives?.[0]?.words ?? []
    const recovered: ScribeWord[] = []
    for (const w of dgWords) {
      const start = clipStart + w.start
      const end = clipStart + w.end
      const text = w.punctuated_word ?? w.word
      // keep only words whose centre falls inside the gap (discard context padding),
      // that are Latin-script (reject language-mis-detection garbage), and above the
      // low-confidence floor (reject the worst ASR noise on unclear audio)
      const centre = (start + end) / 2
      if (centre >= gap.start && centre <= gap.end && isLatinScript(text) && (w.confidence ?? 1) >= MIN_CONFIDENCE) {
        recovered.push({ text, start, end, type: 'word' })
      }
    }
    return recovered
  } catch (e) {
    console.warn(`[refillGaps] gap @${gap.start.toFixed(1)}s failed:`, e instanceof Error ? e.message : e)
    return []
  } finally {
    try { if (existsSync(clipPath)) unlinkSync(clipPath) } catch { /* skip */ }
  }
}

/**
 * Recover dropped speech and merge it into `words`. Best-effort: any failure
 * leaves the base transcript untouched. `audioPath` must still exist (caller
 * deletes it after this resolves).
 */
export const refillGaps = async (
  audioPath: string,
  words: ScribeWord[],
  apiKey: string,
  onProgress?: (fraction: number) => void,
): Promise<ScribeWord[]> => {
  let gaps: Gap[]
  try { gaps = await detectGaps(audioPath, words) } catch { return words }
  if (gaps.length === 0) return words

  console.log(`[refillGaps] ${gaps.length} speech gaps without words — re-transcribing isolated`)

  const recovered: ScribeWord[] = []
  let done = 0
  await runPool(gaps, CONCURRENCY, async (gap) => {
    recovered.push(...await transcribeGap(audioPath, gap, apiKey))
    onProgress?.(++done / gaps.length)
  })

  if (recovered.length === 0) {
    console.log('[refillGaps] no recoverable speech in gaps')
    return words
  }
  console.log(`[refillGaps] recovered ${recovered.length} words across ${gaps.length} gaps`)

  return [...words, ...recovered].sort((a, b) => a.start - b.start)
}
