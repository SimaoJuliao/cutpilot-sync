/* global __ANTHROPIC_API_KEY__ */
import Anthropic from '@anthropic-ai/sdk'
import type { EdlRange } from '../../../src/renderer/src/types/electron'
import { STATIC_RULES } from './buildPrompt'

// Sonnet gives significantly better editorial judgment than Haiku for this task.
// Haiku is fast but tends to be too conservative — it keeps instead of cutting when unsure.
const MODEL = 'claude-sonnet-4-6'
const MAX_TOKENS = 8192

export const callClaude = async (
  prompt: string,
  apiKey: string,
  onChunk: (chunk: string) => void,
): Promise<EdlRange[]> => {
  const client = new Anthropic({ apiKey })

  let fullText = ''

  // STATIC_RULES is sent as a cached system block — identical across every video,
  // so Anthropic's prompt cache fires after the first call within a 5-minute window.
  // Only the transcript (the large, variable part) is charged at full input price.
  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: [
      {
        type: 'text',
        text: STATIC_RULES,
        cache_control: { type: 'ephemeral' },
      },
    ],
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

  const finalMsg = await stream.finalMessage()
  const usage = finalMsg.usage as typeof finalMsg.usage & {
    cache_creation_input_tokens?: number
    cache_read_input_tokens?: number
  }
  console.log(
    `[callClaude] tokens — input: ${usage.input_tokens} | cache_write: ${usage.cache_creation_input_tokens ?? 0} | cache_read: ${usage.cache_read_input_tokens ?? 0} | output: ${usage.output_tokens}`,
  )

  // Extract the JSON array from the response (Claude may add stray text)
  const jsonMatch = fullText.match(/\[[\s\S]*\]/)
  if (!jsonMatch) throw new Error('Claude não retornou JSON válido — tenta novamente ou muda para um modelo mais capaz')

  const parsed = JSON.parse(jsonMatch[0]) as unknown
  if (!Array.isArray(parsed) || parsed.length === 0) throw new Error('A resposta não contém segmentos válidos')

  const valid = (parsed as EdlRange[]).filter((r) => {
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
