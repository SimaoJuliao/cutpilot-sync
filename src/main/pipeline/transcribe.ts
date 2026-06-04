/**
 * transcribe.ts
 * Sends the video to Deepgram Nova-3 and returns a word-level transcript.
 *
 * Parameters:
 *   model:           nova-3       — best multilingual model
 *   detect_language: true         — auto-detects PT/EN/etc
 *   diarize:         true         — speaker labels (0, 1…)
 *   filler_words:    true         — keeps "uh", "um", "hmm" as cut signals
 *   punctuate:       true         — cleaner text for Claude to read
 *   smart_format:    true         — numbers, dates formatted correctly
 */

import { spawn } from 'child_process'
import { existsSync, unlinkSync, createReadStream, statSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import axios from 'axios'
import type { Transcript, ScribeWord } from '../../../src/renderer/src/types/electron'
import { getFFmpegPath } from './ffmpeg'

type ProgressCallback = (pct: number) => void

// ── Deepgram response types ───────────────────────────────────────────────────

type DeepgramWord = {
  word: string
  punctuated_word: string
  start: number
  end: number
  confidence: number
  speaker?: number
}

type DeepgramResponse = {
  results?: {
    channels?: Array<{
      alternatives?: Array<{
        words?: DeepgramWord[]
        transcript?: string
      }>
    }>
  }
  metadata?: {
    detected_language?: string
  }
}

// ── Main export ───────────────────────────────────────────────────────────────

export const transcribeVideo = async (
  videoPath: string,
  apiKey: string,
  onProgress?: ProgressCallback,
): Promise<Transcript> => {
  onProgress?.(5)

  // ── Step 1: Extract audio ──────────────────────────────────────────────────
  const audioPath = join(tmpdir(), `cps_audio_${Date.now()}.wav`)

  await new Promise<void>((resolve, reject) => {
    const ff = spawn(getFFmpegPath(), [
      '-y',
      '-i', videoPath,
      '-vn',
      '-ac', '1',
      '-ar', '16000',
      '-c:a', 'pcm_s16le',
      audioPath,
    ])
    ff.on('close', (code) => code === 0 ? resolve() : reject(new Error(`FFmpeg exit ${code}`)))
    ff.on('error', reject)
  })

  onProgress?.(20)

  // ── Step 2: Upload to Deepgram ────────────────────────────────────────────
  const fileSize = statSync(audioPath).size
  const params = new URLSearchParams({
    model: 'nova-3',
    detect_language: 'true',
    diarize: 'true',
    filler_words: 'true',   // keeps uh/um/hmm so Claude can cut them
    punctuate: 'true',
    smart_format: 'true',
  })

  onProgress?.(25)

  let response
  try {
    response = await axios.post(
      `https://api.deepgram.com/v1/listen?${params}`,
      createReadStream(audioPath),
      {
        headers: {
          Authorization: `Token ${apiKey}`,
          'Content-Type': 'audio/wav',
          'Content-Length': String(fileSize),
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        onUploadProgress: ({ loaded, total }: { loaded: number; total?: number }) => {
          if (total) onProgress?.(25 + Math.round((loaded / total) * 65))
        },
        timeout: 30 * 60 * 1000,
      }
    )
  } catch (err) {
    if (existsSync(audioPath)) unlinkSync(audioPath)
    if (axios.isAxiosError(err) && err.response) {
      const status = err.response.status
      if (status === 401) throw new Error('DEEPGRAM_API_KEY inválida — verifica o ficheiro .env')
      if (status === 402) throw new Error('Créditos Deepgram esgotados — verifica a tua conta em deepgram.com')
      if (status === 429) throw new Error('Limite Deepgram atingido. Tenta novamente dentro de momentos.')
      throw new Error(`Deepgram ${status}: ${JSON.stringify(err.response.data)}`)
    }
    throw err
  }

  if (existsSync(audioPath)) unlinkSync(audioPath)
  onProgress?.(92)

  // ── Step 3: Map Deepgram words → ScribeWord[] ────────────────────────────
  const data = response.data as DeepgramResponse
  const words = data.results?.channels?.[0]?.alternatives?.[0]?.words ?? []
  const text = data.results?.channels?.[0]?.alternatives?.[0]?.transcript ?? ''
  const lang = data.metadata?.detected_language ?? 'pt'

  // Build word entries with spacing entries between them for silence detection
  const scribeWords: ScribeWord[] = []

  for (let i = 0; i < words.length; i++) {
    const w = words[i]

    // Add spacing entry if there's a gap from the previous word
    if (i > 0) {
      const prev = words[i - 1]
      const gap = w.start - prev.end
      if (gap > 0) {
        scribeWords.push({
          text: '',
          start: prev.end,
          end: w.start,
          type: 'spacing' as const,
        })
      }
    }

    scribeWords.push({
      text: w.punctuated_word ?? w.word,
      start: w.start,
      end: w.end,
      type: 'word' as const,
      speaker: w.speaker,
    })
  }

  return {
    words: scribeWords,
    language: lang,
    text,
  }
}
