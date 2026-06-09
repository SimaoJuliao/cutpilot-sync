/**
 * phrases.ts
 * Shared phrase-grouping used by both buildPrompt (what Claude sees) and
 * refineRanges (how we cut). Keeping ONE definition guarantees the cut units
 * match the units Claude reasoned about.
 *
 * A "phrase" is a run of continuous speech: words are grouped together until a
 * silence ≥ PHRASE_GAP or a speaker change — the natural sentence/breath unit.
 */

import type { ScribeWord } from '../../../src/renderer/src/types/electron'

export const PHRASE_GAP = 0.5 // seconds of silence that ends a phrase

export const groupPhrases = (words: ScribeWord[], gap = PHRASE_GAP): ScribeWord[][] => {
  const spoken = words.filter(w => w.type !== 'spacing')
  const phrases: ScribeWord[][] = []
  let current: ScribeWord[] = []

  for (const w of spoken) {
    if (current.length === 0) { current.push(w); continue }

    const prev = current[current.length - 1]
    const speakerChanged =
      w.speaker !== undefined && prev.speaker !== undefined && w.speaker !== prev.speaker

    if (w.start - prev.end >= gap || speakerChanged) { phrases.push(current); current = [w] }
    else current.push(w)
  }
  if (current.length > 0) phrases.push(current)

  return phrases
}
