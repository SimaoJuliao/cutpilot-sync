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

import type { Transcript } from '../../../src/renderer/src/types/electron'
import { groupPhrases, detectRetakeIndices } from './retakeDetection'

// ── Main export ─────────────────────────────────────────────────────────────

export const buildPrompt = (
  transcript: Transcript,
  videoName: string,
  language = 'pt',
): string => {
  const words = transcript.words.filter(w => w.type !== 'spacing')

  // ── 1. Group words into phrases + detect retake chains (shared detector) ──
  const phrases = groupPhrases(words)
  const retakeIdx = detectRetakeIndices(phrases)

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

WARM-UP & SETUP (judge phrase by phrase — never sweep a time range)
- Cut the phrases that are genuinely setup: mic/test counts ("teste, teste", "teste uns 3"), audio checks, "espera lá".
- Phrases where the speaker addresses the editor/camera: "André, depois fazes o corte", "foca na minha cara", "passa esta parte quando eu", "esta parte era só a minha cara", "tenho que repetir aquela parte", "pera lá" (self-correction mid-setup) → CUT.
- NEVER cut a run of phrases just because they come early, and never cut forward "until the first real sentence". Each opening phrase is decided on its own: a phrase that states a fact, figure or headline IS content even when it sits between two setup phrases, and even when it is the very first thing said.
- Openings are often a montage of headline teasers (each a separate one-line topic, frequently closing with something like "temos isto e muito mais"). Those teasers are content — keep them all, not just the last one.
- The ASR mangles proper nouns and figures, so a real sentence can read as nonsense (a company name transcribed as an unrelated everyday word, an index or amount rendered wrongly). If a phrase still asserts information — a value, a change, an event — it is content: KEEP it. Cut only phrases that carry no information at all.

FALSE STARTS & RETAKE CHAINS
- ←RETAKE lines are already detected for you. But there may be single-attempt false starts not caught by the detector: a phrase that ends with "épá!", "não", "espera", "enganei-me", "poxa", or cuts off mid-thought → CUT that phrase.
- REPHRASED REPEATS: if two nearby phrases convey the SAME information with different wording (e.g. "E a avaliação total ficaria nos 1.77 bilhões…" followed by "Isto faz com que a avaliação ficasse nos 1.77 bilhões…"), they are takes of the same line even if neither is marked — keep ONLY the later one.
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

Respond with the kept ranges: {"ranges": [{"start": 14.370, "end": 69.100, "label": "one short description"}, ...]}
- start/end must be exact decimal seconds copied from the timestamps below
- List only ranges to KEEP (everything else is cut), in timeline order

TRANSCRIPT:
${transcriptBlock}`
}
