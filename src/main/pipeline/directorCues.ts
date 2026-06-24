/**
 * directorCues.ts
 * Deterministic "keep this clip" enforcement.
 *
 * The speaker brackets reaction clips / screen-recordings he wants in the final
 * cut with spoken cues to the editor: an OPEN cue ("a partir daqui", "aperta
 * aqui", "mostra isto") and a later CLOSE cue ("era só até aqui", "vou passar à
 * minha fala"). The content between the two asides is the clip — even when it's a
 * different speaker (the video he is reacting to). The normal pipeline cuts it as
 * setup / other-speaker noise, so we force-keep the span between the cues.
 *
 * Conservative by design: a span is only kept when a matching OPEN→CLOSE pair is
 * found within MAX_CLIP seconds, so a stray cue phrase in normal speech does
 * nothing on its own. Validated to fire on exactly the bracketed clip and to find
 * nothing in videos without these asides.
 */

import type { Transcript, ScribeWord } from '../../../src/renderer/src/types/electron'
import { groupPhrases, type TimeInterval } from './retakeDetection'

const MAX_CLIP = 90 // a bracketed clip longer than this is implausible — ignore (s)

// lower-case, strip accents + punctuation, collapse whitespace → robust substring match
const norm = (s: string): string =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim()

// Director-to-editor asides. OPEN = "start keeping here", CLOSE = "that was the
// clip, back to me". Matched as substrings of a phrase line. "aperta aqui" is the
// usual ASR rendering of the slurred "a partir daqui".
const OPEN_CUES = [
  'a partir daqui', 'apartir daqui', 'aperta aqui',
  'mostra isto', 'mostra aqui', 'poe isto', 've isto', 'olha isto',
  'repara nisto', 'comeca aqui', 'isto entra',
]
const CLOSE_CUES = [
  'era so ate aqui', 'e so ate aqui', 'so ate aqui',
  'minha fala', 'volto eu', 'agora sou eu', 'agora vou eu',
]

const matchesAny = (text: string, cues: string[]): boolean => cues.some(c => text.includes(c))

/**
 * Spans the editor must keep regardless of Claude's EDL: the content strictly
 * between an OPEN cue and the next CLOSE cue (the cue phrases themselves are
 * excluded — they are asides to the editor, not part of the clip).
 */
export const detectKeepClips = (transcript: Transcript): TimeInterval[] => {
  const phrases = groupPhrases(transcript.words.filter(w => w.type !== 'spacing') as ScribeWord[])
  const text = phrases.map(p => norm(p.map(w => w.text).join(' ')))
  const clips: TimeInterval[] = []

  for (let i = 0; i < phrases.length; i++) {
    if (!matchesAny(text[i], OPEN_CUES)) continue
    const openEnd = phrases[i][phrases[i].length - 1].end

    for (let j = i + 1; j < phrases.length; j++) {
      const closeStart = phrases[j][0].start
      if (closeStart - openEnd > MAX_CLIP) break          // no close cue in range — not a clip
      if (matchesAny(text[j], CLOSE_CUES)) {
        if (closeStart > openEnd) clips.push({ start: openEnd, end: closeStart })
        i = j                                             // resume scanning after this clip
        break
      }
    }
  }
  return clips
}
