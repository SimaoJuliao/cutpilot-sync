/**
 * trimRepeats.ts
 * Removes INTRA-PHRASE opening repetitions that the phrase-level retake detector
 * can't see.
 *
 * When a speaker restarts a sentence within continuous speech (no ≥0.5s pause),
 * the whole thing is ONE phrase, e.g.:
 *   "O grupo de ginásios Planet Fitness, o grupo de ginásios Planet Fitness, que…"
 * Claude keeps the phrase whole (it only has phrase-level timestamps and can't
 * cut mid-phrase). Here we use the word-level timestamps to drop the earlier
 * copy by moving the range start to the final occurrence.
 *
 * Conservative: only trims an EXACT, immediately-repeated opening block (≥2
 * words), optionally after ≤1 leading word. It only ever moves the start LATER
 * (never loses later content), and iterates for triple+ restarts.
 */

import type { EdlRange, ScribeWord } from '../../../src/renderer/src/types/electron'

const MAX_BLOCK = 8  // longest repeated opening block to detect (words)
const LEAD = 0.08    // air kept before the surviving copy's first word

const norm = (s: string): string =>
  s.toLowerCase().replace(/[^\wáéíóúãõâêîôûàçüñ]/g, '').trim()

/**
 * If an immediately-repeated block sits at (or within 1 word of) `from`, returns
 * how many words to advance past the leading words + first copy; otherwise 0.
 */
const leadingRepeatLen = (w: ScribeWord[], from: number): number => {
  for (let off = 0; off <= 1; off++) {
    const base = from + off
    const remaining = w.length - base
    const maxJ = Math.min(MAX_BLOCK, Math.floor(remaining / 2))
    for (let j = maxJ; j >= 2; j--) {
      let match = true
      for (let k = 0; k < j; k++) {
        if (norm(w[base + k].text) !== norm(w[base + j + k].text)) { match = false; break }
      }
      if (match) return off + j
    }
  }
  return 0
}

export const trimHeadRepeats = (ranges: EdlRange[], words: ScribeWord[]): EdlRange[] => {
  const spoken = words.filter(w => w.type !== 'spacing')
  if (spoken.length === 0) return ranges

  let trimmed = 0
  const out = ranges.map(r => {
    const inside = spoken.filter(w => w.end > r.start && w.start < r.end)
    if (inside.length < 4) return r

    let start = 0
    for (;;) {
      const adv = leadingRepeatLen(inside, start)
      if (adv <= 0) break
      start += adv
    }

    if (start === 0 || start >= inside.length) return r
    trimmed++
    return { ...r, start: Math.max(r.start, inside[start].start - LEAD) }
  })

  if (trimmed) console.log(`[trimHeadRepeats] trimmed repeated opening on ${trimmed} segment(s)`)
  return out
}
