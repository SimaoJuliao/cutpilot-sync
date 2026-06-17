/**
 * retakeDetection.ts
 * Shared retake-chain detection used by:
 *   - buildPrompt.ts  → annotates the transcript with ←RETAKE for Claude
 *   - refineEdl.ts     → deterministically removes retake time-spans from the EDL
 *
 * A "retake chain" is a group of nearby phrases that are takes of the SAME line
 * (the speaker stumbled and started over). We keep the last/fullest take and mark
 * the rest as retakes. Matching tolerates filler-word prefixes, inflection, and
 * rewording — validated against a real 45-min source video (zero false positives).
 */

import type { Transcript, ScribeWord } from '../../../src/renderer/src/types/electron'

// ── Token helpers ────────────────────────────────────────────────────────────

// Hesitation/filler words a speaker often inserts before restarting a sentence.
// Stripped from the START of each phrase so "Ah… Então hoje vamos" still
// matches a clean "Hoje vamos" restart.
const FILLER_WORDS = new Set([
  'ah', 'uh', 'hum', 'hmm', 'eh', 'ok', 'okay',
  'pera', 'epá', 'pá', 'tipo', 'pronto', 'portanto', 'então',
])

// strip punctuation but keep accented PT/EN letters
const normToken = (s: string): string =>
  s.toLowerCase().replace(/[^\wáéíóúãõâêîôûàçüñ]/g, '').trim()

/** Normalised word tokens of a phrase, with leading fillers stripped. */
const contentTokens = (phrase: ScribeWord[]): string[] => {
  const ts = phrase.map(w => normToken(w.text)).filter(Boolean)
  while (ts.length > 0 && FILLER_WORDS.has(ts[0])) ts.shift()
  return ts
}

// Two words count as "the same" if equal, or if one is a prefix of the other
// (≥4 chars) — tolerates inflection so "prepara" matches "preparar", "criptos"
// matches "criptomoedas", etc.
const wordsMatch = (x: string, y: string): boolean =>
  x === y || (Math.min(x.length, y.length) >= 4 && (x.startsWith(y) || y.startsWith(x)))

/** Substantial (≥3-char) tokens — drops articles/prepositions noise. */
const substantial = (tokens: string[]): string[] => tokens.filter(w => w.length >= 3)

/** How many of `a`'s words have an inflection-tolerant match in `b`. */
const sharedCount = (a: string[], b: string[]): number => {
  let n = 0
  for (const x of a) if (b.some(y => wordsMatch(x, y))) n++
  return n
}

/** Same opening, tolerating ONE changed word in the first four —
 *  catches "Isto faria com que…" restarted as "Isto faz com que…". */
const fuzzyPrefixMatch = (a: string[], b: string[]): boolean => {
  const ta = a.slice(0, 4)
  const tb = b.slice(0, 4)
  if (ta.length < 3 || tb.length < 3) return false
  const n = Math.min(ta.length, tb.length)
  let same = 0
  for (let k = 0; k < n; k++) if (wordsMatch(ta[k], tb[k])) same++
  return same >= 3 && same >= n - 1
}

/** Vocabulary overlap (Jaccard) — catches retakes that restart with a
 *  different opening but repeat the same content. Conservative: requires
 *  at least 5 substantial words on each side. */
const jaccardSimilarity = (a: string[], b: string[]): number => {
  const sa = substantial(a)
  const sb = substantial(b)
  if (sa.length < 5 || sb.length < 5) return 0
  const shared = sharedCount(sa, sb)
  const ua = new Set(sa).size
  const ub = new Set(sb).size
  return shared / (ua + ub - shared)
}

/** Containment — how much of the SHORTER take is repeated in the longer one.
 *  Catches an early partial take ("SpaceX prepara para o maior IPO…") that is
 *  fully contained in the complete later take, where Jaccard stays low because
 *  the complete take adds a lot of new words. */
const overlapCoefficient = (a: string[], b: string[]): number => {
  const sa = substantial(a)
  const sb = substantial(b)
  const [small, big] = sa.length <= sb.length ? [sa, sb] : [sb, sa]
  if (small.length < 5) return 0
  return sharedCount(small, big) / small.length
}

/** Two phrases look like takes of the same line. */
const isSimilarTake = (a: string[], b: string[]): boolean =>
  fuzzyPrefixMatch(a, b) || jaccardSimilarity(a, b) >= 0.6 || overlapCoefficient(a, b) >= 0.8

// ── Phrase grouping + chain detection ─────────────────────────────────────────

const RETAKE_WINDOW = 120 // seconds — max gap between members of one retake chain

/** Group word entries into phrase-lines, breaking on ≥0.5s silence or speaker
 *  change (same rule as the video-use skill). */
export const groupPhrases = (words: ScribeWord[]): ScribeWord[][] => {
  const phrases: ScribeWord[][] = []
  let current: ScribeWord[] = []

  for (const w of words) {
    if (current.length === 0) { current.push(w); continue }

    const prev = current[current.length - 1]
    const gap = w.start - prev.end
    const speakerChanged = w.speaker !== undefined
      && prev.speaker !== undefined
      && w.speaker !== prev.speaker

    if (gap >= 0.5 || speakerChanged) { phrases.push(current); current = [w] }
    else { current.push(w) }
  }
  if (current.length > 0) phrases.push(current)

  return phrases
}

export interface RetakeChain {
  members: number[]      // all phrase indices in the chain, in order
  retakes: number[]      // members to CUT (the botched/earlier takes)
  keeper: number | null  // the take to KEEP — null when the chain is all fragments
}

/**
 * Group phrases into retake chains.
 *
 * For each phrase i, collect the chain of later phrases similar to the chain's
 * FIRST member OR its most recent member (so successive rewordings stay in one
 * chain), within RETAKE_WINDOW. The KEEPER is the last member (the final, most
 * complete delivery); the rest are retakes — unless the last member is itself a
 * short fragment of the chain's longest take, in which case the chain has no good
 * keeper (the real delivery is a separate phrase outside the chain) and every
 * member is a retake.
 */
export const detectRetakeChains = (phrases: ScribeWord[][]): RetakeChain[] => {
  const chains: RetakeChain[] = []
  const claimed = new Set<number>()
  const phraseTokens = phrases.map(contentTokens)

  for (let i = 0; i < phrases.length; i++) {
    if (claimed.has(i)) continue             // already part of a chain
    if (phraseTokens[i].length < 3) continue // too short to anchor a chain

    const members: number[] = [i]
    let prevEnd = phrases[i][phrases[i].length - 1].end
    let longestIdx = i // fullest member so far — the best representative of the chain

    for (let j = i + 1; j < phrases.length; j++) {
      const startJ = phrases[j][0].start
      if (startJ - prevEnd > RETAKE_WINDOW) break
      const last = members[members.length - 1]
      // Match against the anchor, the most recent take, OR the fullest take so
      // far — the last bridges chains broken by intervening fragments (e.g. a
      // stray "e" between two full takes of the same line).
      if (
        isSimilarTake(phraseTokens[i], phraseTokens[j]) ||
        isSimilarTake(phraseTokens[last], phraseTokens[j]) ||
        isSimilarTake(phraseTokens[longestIdx], phraseTokens[j])
      ) {
        members.push(j)
        prevEnd = phrases[j][phrases[j].length - 1].end
        if (phraseTokens[j].length > phraseTokens[longestIdx].length) longestIdx = j
      }
    }

    if (members.length < 2) continue
    members.forEach(m => claimed.add(m))

    const lastIdx = members[members.length - 1]
    const longest = Math.max(...members.map(c => phraseTokens[c].length))
    const lastIsFragment = phraseTokens[lastIdx].length < longest * 0.5
    const keeper = lastIsFragment ? null : lastIdx
    const retakes = members.filter(m => m !== keeper)
    chains.push({ members, retakes, keeper })
  }

  return chains
}

/** Indices of phrases that are retake attempts (for the ←RETAKE prompt hint). */
export const detectRetakeIndices = (phrases: ScribeWord[][]): Set<number> => {
  const idx = new Set<number>()
  for (const c of detectRetakeChains(phrases)) for (const r of c.retakes) idx.add(r)
  return idx
}

export interface TimeInterval { start: number; end: number }

export interface RetakeChainSpan {
  topic: TimeInterval          // whole chain span — used to test if Claude kept this topic
  cuts: TimeInterval[]         // retake-member spans to remove
  keeper: TimeInterval | null  // span of the take to guarantee in the output
}

/** Per-chain time spans for deterministic enforcement in refineEdl. */
export const detectRetakeChainSpans = (transcript: Transcript): RetakeChainSpan[] => {
  const words = transcript.words.filter(w => w.type !== 'spacing')
  const phrases = groupPhrases(words)
  const span = (i: number): TimeInterval => ({
    start: phrases[i][0].start,
    end: phrases[i][phrases[i].length - 1].end,
  })

  return detectRetakeChains(phrases).map(ch => ({
    topic: {
      start: Math.min(...ch.members.map(m => phrases[m][0].start)),
      end: Math.max(...ch.members.map(m => phrases[m][phrases[m].length - 1].end)),
    },
    cuts: ch.retakes.map(span),
    keeper: ch.keeper === null ? null : span(ch.keeper),
  }))
}
