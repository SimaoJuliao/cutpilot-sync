/**
 * refineEdl.ts
 * Deterministic post-processing of Claude's EDL.
 *
 * Claude PROPOSES the keep-ranges (editorial judgment); this layer DISPOSES of
 * what it can't be trusted to do reliably:
 *
 *   1. Retake chains — for every chain Claude touched (kept ANY take of), force
 *      the output to contain the chain's KEEPER (the fullest/last take) and
 *      remove the other takes. This fixes both failure modes: Claude keeping a
 *      botched take, AND Claude cutting the good take while keeping a botched
 *      one (which would otherwise leave the topic truncated or missing).
 *      Chains Claude cut entirely are left alone (intentional removal).
 *
 *   2. Dead air — split kept ranges at internal silences longer than MAX_SILENCE
 *      and trim each run to the speech it contains (drops pure-silence fragments
 *      and long pauses Claude left between takes).
 *
 * Operating on TIME (not text) guarantees the result regardless of how Claude
 * built its ranges. Detection is shared with buildPrompt.
 */

import type { EdlRange, Transcript } from '../../../src/renderer/src/types/electron'
import { detectRetakeChainSpans, groupPhrases, type TimeInterval } from './retakeDetection'
import { detectKeepClips } from './directorCues'

const MIN_KEEP = 0.15      // drop fragments shorter than this after surgery (s)
const MAX_SILENCE = 2.0    // gaps longer than this are dead air → split/trim (s)
const PAD = 0.12           // natural breath kept around each speech run (s)
const MAX_WORD_SPAN = 4.0     // a word longer than this MIGHT be an inflated timestamp…
const GARBAGE_DOMINANCE = 0.6 // …but only treat the phrase as garbage if that one word
                              //   also covers >60% of it (a lone 10s "Teste."). A long
                              //   word inside otherwise-dense speech (a stuttered number
                              //   spanning 4s among 25 words) is real — snap across it,
                              //   so a whole sentence is recovered even when Claude kept
                              //   just a tail fragment ("…de dólares").

const duration = (rs: EdlRange[]): number => rs.reduce((s, r) => s + (r.end - r.start), 0)
const overlapsAny = (span: TimeInterval, ranges: EdlRange[]): boolean =>
  ranges.some(r => r.start < span.end && r.end > span.start)

/** Remove every cut interval from the ranges, splitting ranges as needed. */
const subtractIntervals = (ranges: EdlRange[], cuts: TimeInterval[]): EdlRange[] => {
  let result = ranges.map(r => ({ ...r }))
  for (const cut of cuts) {
    const next: EdlRange[] = []
    for (const r of result) {
      if (cut.end <= r.start || cut.start >= r.end) { next.push(r); continue } // no overlap
      if (cut.start > r.start) next.push({ ...r, end: cut.start })             // keep head
      if (cut.end < r.end) next.push({ ...r, start: cut.end })                 // keep tail
    }
    result = next
  }
  return result
}

/** Sort by start and merge overlapping ranges (dedupes a re-added keeper). */
const mergeOverlapping = (ranges: EdlRange[]): EdlRange[] => {
  const sorted = [...ranges].sort((a, b) => a.start - b.start)
  const out: EdlRange[] = []
  for (const r of sorted) {
    const last = out[out.length - 1]
    if (last && r.start <= last.end) last.end = Math.max(last.end, r.end)
    else out.push({ ...r })
  }
  return out
}

/**
 * Clamp each range to the actual speech it contains:
 *   - a range with NO words is dropped (pure-silence fragment);
 *   - internal gaps longer than MAX_SILENCE split the range into speech runs;
 *   - each run is tightened to [firstWord − PAD, lastWord + PAD].
 */
const clampToSpeech = (ranges: EdlRange[], transcript: Transcript): EdlRange[] => {
  const words = transcript.words.filter(w => w.type === 'word').sort((a, b) => a.start - b.start)
  const out: EdlRange[] = []

  for (const r of ranges) {
    const inside = words.filter(w => w.end > r.start && w.start < r.end)
    if (inside.length === 0) continue // pure silence → drop

    let runStart = 0
    for (let i = 1; i <= inside.length; i++) {
      const gap = i < inside.length ? inside[i].start - inside[i - 1].end : Infinity
      if (gap > MAX_SILENCE) {
        const first = inside[runStart]
        const last = inside[i - 1]
        out.push({
          ...r,
          start: Math.max(r.start, first.start - PAD),
          end: Math.min(r.end, last.end + PAD),
        })
        runStart = i
      }
    }
  }
  return out
}

/**
 * Snap each range out to the boundaries of every phrase it overlaps, so a cut
 * never lands mid-phrase. Claude occasionally keeps just a sliver of a sentence —
 * the first word ("…é one trillion" kept as just "…é"), a topic kept as just
 * "Bu[rry]", or only the trailing "…de dólares" of a long figure. Since phrases are
 * silence-delimited, extending to the touched phrase's edges restores the whole
 * sentence and lands the cut in the surrounding silence.
 */
const snapToPhrases = (ranges: EdlRange[], transcript: Transcript): EdlRange[] => {
  const bounds = groupPhrases(transcript.words.filter(w => w.type !== 'spacing')).map(p => {
    const start = p[0].start
    const end = p[p.length - 1].end
    const maxWordSpan = Math.max(...p.map(w => w.end - w.start))
    // "garbage" = the phrase is essentially one inflated long-span word (dead air
    // mislabelled as a word), not genuine speech — never snap a cut across it.
    const garbage = maxWordSpan > MAX_WORD_SPAN && maxWordSpan > GARBAGE_DOMINANCE * (end - start)
    return { start, end, safe: !garbage }
  })

  return ranges.map(r => {
    // Snap each boundary to the phrase that STRICTLY contains it — i.e. a cut that
    // landed mid-phrase. Boundaries already on a phrase edge are left untouched
    // (idempotent on well-formed ranges). Snap only across "safe" (dense-speech)
    // phrases, so a full sentence is always recovered but a garbage timestamp can't
    // drag a cut across dead air.
    const startP = bounds.find(p => p.safe && p.start < r.start && r.start < p.end)
    const endP = bounds.find(p => p.safe && p.start < r.end && r.end < p.end)
    return {
      ...r,
      start: startP ? startP.start : r.start,
      end: endP ? endP.end : r.end,
    }
  })
}

// Function words that must never END a kept range. A range ending on a bare
// preposition/article/conjunction is a sentence the speaker trailed off mid-way
// (or whose final noun the ASR dropped) — e.g. "…pelas suas estratégias de" when
// the "de IA" was never finished. A real sentence almost never ends on one of
// these, so trimming back to the last content word is safe and transversal.
const TRAILING_FUNCTION = new Set([
  'de', 'da', 'do', 'das', 'dos', 'a', 'o', 'as', 'os', 'à', 'ao', 'às', 'aos',
  'em', 'no', 'na', 'nos', 'nas', 'num', 'numa', 'dum', 'duma',
  'para', 'pra', 'por', 'pelo', 'pela', 'pelos', 'pelas',
  'com', 'sem', 'sob', 'sobre', 'entre', 'até', 'desde', 'perante',
  'e', 'ou', 'que', 'se', 'mas', 'como', 'quando', 'onde', 'porque',
  'meu', 'minha', 'seu', 'sua', 'seus', 'suas', 'neste', 'nesta', 'deste', 'desta',
  'of', 'in', 'for', 'to', 'and', 'the', 'with',
])

const stripPunct = (s: string): string => s.toLowerCase().replace(/[^\wáéíóúãõâêîôûàçüñ]/g, '')

/**
 * Pull each range's end back off any trailing function-words, so a kept line never
 * ends on a dangling "…estratégias de" / "…procura da". Stops at the last content
 * word and re-applies PAD. Ranges that already end on a content word are returned
 * untouched (idempotent). Composes with snapToPhrases: if the snap extended the end
 * into a trailed-off phrase tail, this cleans it back up.
 */
const trimDanglingTails = (ranges: EdlRange[], transcript: Transcript): EdlRange[] => {
  const words = transcript.words.filter(w => w.type === 'word').sort((a, b) => a.start - b.start)
  return ranges.map(r => {
    const inside = words.filter(w => w.end > r.start && w.start < r.end)
    let last = inside.length - 1
    while (last >= 0 && TRAILING_FUNCTION.has(stripPunct(inside[last].text))) last--
    if (last < 0 || last === inside.length - 1) return r // all-function (leave) or nothing to trim
    // Cap the end at the trimmed word's start so PAD can't re-include it (the
    // dangling word usually follows the content word with no silence between).
    return { ...r, end: Math.min(r.end, inside[last].end + PAD, inside[last + 1].start) }
  })
}

/**
 * Apply deterministic retake enforcement + dead-air trimming to Claude's EDL.
 * Pure function of (ranges, transcript) — no side effects.
 */
export const refineEdl = (ranges: EdlRange[], transcript: Transcript): EdlRange[] => {
  if (ranges.length === 0) return ranges

  // 0. Snap ranges to phrase edges so Claude can't truncate a sentence mid-way.
  const snapped = snapToPhrases(ranges, transcript)

  const chains = detectRetakeChainSpans(transcript)

  // Only act on chains Claude actually included (kept ANY take of) — leave
  // topics Claude deliberately cut alone.
  const active = chains.filter(ch => overlapsAny(ch.topic, snapped))
  const cuts = active.flatMap(ch => ch.cuts)
  const keepers = active
    .map(ch => ch.keeper)
    .filter((k): k is TimeInterval => k !== null)
    .map(k => ({ start: k.start, end: k.end, label: 'retake-keeper' }))

  // Clips the speaker verbally bracketed for the editor ("a partir daqui" … "era
  // só até aqui") — force-kept even though they read as other-speaker/setup noise.
  const keepClips = detectKeepClips(transcript)
    .map(c => ({ start: c.start, end: c.end, label: 'keep-clip' }))

  // 1. Remove the botched takes, then 2. guarantee each keeper + bracketed clip is
  //    present (added AFTER the subtraction so retake cuts can't drop them).
  const enforced = mergeOverlapping([...subtractIntervals(snapped, cuts), ...keepers, ...keepClips])
  // 3. Trim dead air / drop silence fragments, then 4. trim trailing function-words
  //    so no range ends on a dangling "…de"/"…para" from a trailed-off sentence.
  const refined = trimDanglingTails(
    mergeOverlapping(clampToSpeech(enforced, transcript)).filter(r => r.end - r.start >= MIN_KEEP),
    transcript,
  ).filter(r => r.end - r.start >= MIN_KEEP)

  const keepersAdded = active.filter(ch => ch.keeper && !overlapsAny(ch.keeper, snapped)).length
  console.log(
    `[refineEdl] ranges ${ranges.length}→${refined.length} | ` +
    `active chains ${active.length}/${chains.length} | keepers restored ${keepersAdded} | ` +
    `clips kept ${keepClips.length} | kept ${duration(ranges).toFixed(1)}s→${duration(refined).toFixed(1)}s`
  )

  return refined
}
