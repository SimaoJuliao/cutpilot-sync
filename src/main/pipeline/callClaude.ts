/* global __ANTHROPIC_API_KEY__ */
import Anthropic from '@anthropic-ai/sdk'
import type { EdlRange } from '../../../src/renderer/src/types/electron'

// Sonnet 4.5 is the right model here, not a newer one. The editorial guarantees
// that matter (which take wins, no truncated sentence, no dangling preposition)
// are enforced deterministically in refineEdl, so a stronger model changes the
// final cut very little — measured on real videos, Sonnet 5 and Opus 5 produced
// the same result while costing 2.6x more and taking twice as long. Staying on
// 4.5 also keeps temperature: 0, which the thinking models no longer accept.
const MODEL = 'claude-sonnet-4-5'

// Enforced on the wire via structured outputs — the response is guaranteed to
// be valid JSON in exactly this shape, so no extraction/repair is needed.
const EDL_SCHEMA = {
  type: 'object',
  properties: {
    ranges: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          start: { type: 'number', description: 'Keep-range start in decimal seconds, copied from the transcript timestamps' },
          end: { type: 'number', description: 'Keep-range end in decimal seconds' },
          label: { type: 'string', description: 'One short description of the kept content' },
        },
        required: ['start', 'end', 'label'],
        additionalProperties: false,
      },
    },
  },
  required: ['ranges'],
  additionalProperties: false,
}

export const callClaude = async (
  prompt: string,
  apiKey: string,
  onChunk: (chunk: string) => void,
): Promise<EdlRange[]> => {
  const client = new Anthropic({ apiKey })

  let fullText = ''

  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: 8192,
    temperature: 0,   // deterministic EDL — same transcript in, same cuts out
    output_config: { format: { type: 'json_schema', schema: EDL_SCHEMA } },
    messages: [{ role: 'user', content: prompt }],
  })

  for await (const event of stream) {
    if (
      event.type === 'content_block_delta' &&
      event.delta.type === 'text_delta'
    ) {
      const chunk = event.delta.text
      fullText += chunk
      onChunk(chunk)
    }
  }

  // Schema enforcement guarantees valid JSON — a parse failure means the
  // output was truncated (max_tokens) or the request was refused mid-stream.
  let parsed: { ranges?: EdlRange[] }
  try {
    parsed = JSON.parse(fullText) as { ranges?: EdlRange[] }
  } catch {
    throw new Error('Claude não retornou um EDL completo — tenta novamente')
  }

  const ranges = parsed.ranges
  if (!Array.isArray(ranges) || ranges.length === 0) throw new Error('A resposta não contém segmentos válidos')

  const valid = ranges.filter((r) => {
    if (typeof r.start !== 'number' || typeof r.end !== 'number') return false
    if (r.end <= r.start) {
      console.warn(`[callClaude] dropping inverted segment (start=${r.start}, end=${r.end})`)
      return false
    }
    if ((r.end - r.start) < 0.1) {
      console.warn(`[callClaude] dropping micro-segment (${r.end - r.start}s)`)
      return false
    }
    return true
  })
  if (valid.length === 0) throw new Error('Segmentos sem campos start/end numéricos ou todos invertidos — tenta novamente')

  return valid
}
