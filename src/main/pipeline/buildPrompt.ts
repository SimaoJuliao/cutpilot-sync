/**
 * buildPrompt.ts
 * Converts the word-level transcript into a compact, annotated prompt
 * for Claude to produce a tight EDL.
 *
 * Key features:
 *  - Speaker labels (S0/S1) on every phrase line
 *  - Gap annotations (small/silence/noise)
 *  - Automatic RETAKE detection: phrases that repeat the same opening within
 *    120s are flagged ←RETAKE so Claude never has to infer it
 */

import type { Transcript, ScribeWord } from '../../../src/renderer/src/types/electron'

// ── Retake detection helpers ────────────────────────────────────────────────

/** Normalise the first N words of a phrase for prefix-matching. */
const prefixKey = (phrase: ScribeWord[], n = 4): string =>
  phrase
    .slice(0, Math.min(n, phrase.length))
    .map(w =>
      w.text
        .toLowerCase()
        // strip punctuation but keep accented PT/EN letters
        .replace(/[^\wáéíóúãõâêîôûàçüñ]/g, '')
        .trim()
    )
    .filter(Boolean)
    .join(' ')

// ── Main export ─────────────────────────────────────────────────────────────

export const buildPrompt = (
  transcript: Transcript,
  videoName: string,
  language = 'pt',
): string => {
  const words = transcript.words.filter(w => w.type !== 'spacing')

  // ── 1. Group words into phrase-lines ──────────────────────────────────────
  // Break on silence ≥ 0.5s OR speaker change (same rule as video-use skill)
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

  // ── 2. Detect retake chains ───────────────────────────────────────────────
  // A retake chain = group of phrases with the same 4-word prefix where each
  // member starts within RETAKE_WINDOW seconds of the previous member's end.
  //
  // IMPORTANT: we mark all EXCEPT THE LAST member as ←RETAKE.
  // The LAST occurrence is always the final, most complete delivery — that's
  // the one to keep. Earlier attempts (including the first) are the retakes.
  //
  // Algorithm:
  //   For each phrase i (skipping already-marked retakes), collect the full
  //   chain of phrases ahead that share the same prefix and are within the
  //   window. Then mark everything in the chain EXCEPT the last as RETAKE.

  const RETAKE_WINDOW = 120          // seconds between chain members
  const retakeIdx = new Set<number>()

  for (let i = 0; i < phrases.length; i++) {
    if (retakeIdx.has(i)) continue                     // already marked, skip

    const keyI = prefixKey(phrases[i])
    if (!keyI || keyI.split(' ').length < 3) continue  // prefix too short

    // Build the chain starting at i
    const chain: number[] = [i]
    let prevEnd = phrases[i][phrases[i].length - 1].end

    for (let j = i + 1; j < phrases.length; j++) {
      const startJ = phrases[j][0].start
      if (startJ - prevEnd > RETAKE_WINDOW) break      // window closed — stop looking
      if (prefixKey(phrases[j]) === keyI) {
        chain.push(j)
        prevEnd = phrases[j][phrases[j].length - 1].end
      }
    }

    if (chain.length > 1) {
      // Mark all EXCEPT the LAST (final clean delivery) as RETAKE
      for (let k = 0; k < chain.length - 1; k++) {
        retakeIdx.add(chain[k])
      }
    }
  }

  // ── 3. Format transcript lines ────────────────────────────────────────────
  const lines: string[] = []

  for (let i = 0; i < phrases.length; i++) {
    const phrase = phrases[i]
    const s = phrase[0].start
    const e = phrase[phrase.length - 1].end
    const spk = phrase[0].speaker !== undefined ? `S${phrase[0].speaker} ` : ''
    const text = phrase.map(w => w.text).join(' ').replace(/\s+/g, ' ').trim()
    const flag = retakeIdx.has(i) ? '  ←RETAKE' : ''

    lines.push(`[${s.toFixed(3)} → ${e.toFixed(3)}] ${spk} ${text}${flag}`)

    // Annotate the gap to the next phrase
    if (i < phrases.length - 1) {
      const nextStart = phrases[i + 1][0].start
      const gap = nextStart - e

      if (gap >= 10.0) lines.push(`  ━━━ ${gap.toFixed(1)}s gap (keyboard / noise / setup) ━━━`)
      else if (gap >= 2.0) lines.push(`  ··· ${gap.toFixed(1)}s silence ···`)
      else if (gap >= 0.4) lines.push(`  · ${gap.toFixed(1)}s ·`)
    }
  }

  const transcriptBlock = lines.join('\n')
  const lastWord = words.length ? words[words.length - 1].end : 0
  const totalSec = Math.round(lastWord)
  const totalMin = Math.floor(totalSec / 60)
  const totalDuration = `${totalMin}m ${totalSec % 60}s`

  // ── 4. System prompt ──────────────────────────────────────────────────────
  return `You are editing a ${language.toUpperCase()} talking-head video. Produce a tight, clean cut by selecting the best continuous ranges to keep.

SOURCE: "${videoName}" — raw duration ~${totalDuration}
Typical talking-head cleanup keeps 25–35% of raw. If your total seems above 40%, you are keeping too much — tighten retake sections first.

Format: [start → end] Sx  spoken text   (Sx = speaker; times are decimal seconds — copy exactly)

━━━ RETAKE LINES ━━━

Lines marked ←RETAKE are repeat attempts: the speaker started the same sentence again after a previous try. These MUST be omitted from your kept ranges — never include a ←RETAKE line.
  - When you skip a RETAKE, also check the phrase immediately AFTER it: if it only makes sense as the continuation/completion of the RETAKE's sentence (and that continuation is available cleanly elsewhere later), cut it too.
  - Exception: if the phrase after the RETAKE is a standalone, self-contained, punchy sentence that stands on its own, you may keep it.

━━━ CUT CRAFT RULES ━━━

WARM-UP & SETUP (cut aggressively)
- The first 10–60s are almost always setup noise: test counts, "espera lá", audio checks. Cut everything until the FIRST real content sentence.
- Phrases where the speaker addresses the editor/camera: "André, depois fazes o corte", "foca na minha cara", "passa esta parte quando eu", "esta parte era só a minha cara", "tenho que repetir aquela parte", "pera lá" (self-correction mid-setup) → CUT.

FALSE STARTS & RETAKE CHAINS
- ←RETAKE lines are already detected for you. But there may be single-attempt false starts not caught by the detector: a phrase that ends with "épá!", "não", "espera", "enganei-me", "poxa", or cuts off mid-thought → CUT that phrase.
- When in doubt whether two nearby clean versions cover the same beat, keep the LATER, more complete one and cut the earlier shorter version.

SILENCE GAPS
- Silences ≥ 400ms are primary cut targets.
- 150–400ms phrase boundaries are usable cuts.
- < 150ms: do not cut — likely mid-phrase.
- Keep intentional dramatic pauses: silence RIGHT AFTER a punchline or key statement.
- ━━━ gaps (≥ 10s) ━━━ are almost certainly keyboard noise or setup — the speech around them is likely dirty. Verify both sides before keeping.

FILLER & NOISE
- Cut: "uh", "um", "hmm", "ah", "então" / "portanto" as filler, throat-clearing, keyboard sounds.
- Keep: laughs and reactions that land at the END of a completed thought.

PACING
- Preserve emphasis peaks: punchlines, key data points, moments of energy.
- Between thoughts: 400–600ms of air feels natural.

MERGING
- Consecutive phrases with ≤ 300ms gap that belong to the SAME thought → ONE range.

GRAMMATICAL COMPLETIONS
- If a kept phrase ends with a word that takes a prepositional complement in Portuguese/English (e.g. "estratégias", "mais", "protagonistas", "impulsionados", "semana") AND the very next phrase line in the transcript is a short (1–5 word) complement starting with "de", "da", "do", "das", "dos", "em", "para", "por", "com", "neste", "desta", "deste", "of", "in", "for" — keep BOTH phrases as one contiguous range. Never strand a noun from its prepositional modifier.

PADDING
- Start 50ms before the first word of each kept range.
- End 150ms after the last word of each kept range.

━━━ OUTPUT FORMAT ━━━

Output ONLY a raw JSON array — no markdown, no explanation, no code fences.
Each item: {"start": 14.370, "end": 69.100, "label": "one short description"}
- start/end must be exact decimal seconds from the timestamps below
- List only ranges to KEEP (everything else is cut)
- Last item: {"start": -1, "end": -1, "label": "total kept: Xs"}

TRANSCRIPT:
${transcriptBlock}

JSON array now:`
}
