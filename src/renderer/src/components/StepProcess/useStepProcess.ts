import { useState, useEffect, useRef } from 'react'
import type { RenderResult, PipPosition } from '@/types'
import { dirname, basename } from '@lib'

export type ProcessPhase = 'transcribe' | 'analyse' | 'export' | 'done' | 'error'

import { strings } from '@i18n'

const tp = strings.stepProcess

// Human-friendly messages — no mention of ElevenLabs or Claude
const PHASE_MSG: Record<ProcessPhase, string> = {
  transcribe: tp.phaseTranscribe,
  analyse: tp.phaseAnalyse,
  export: tp.phaseExport,
  done: tp.phaseDone,
  error: '',
}

/** Convert raw technical error strings into user-friendly Portuguese messages */
const friendlyError = (raw: string): string => {
  // Always log the raw error so devs can debug in the console
  console.error('[pipeline error]', raw)

  // If the main process already produced a friendly Portuguese message, pass it
  // through unchanged — no need to replace it with something more generic.
  // We detect this by checking for known prefixes thrown by our pipeline modules.
  if (
    raw.startsWith('Limite de transcrição') ||
    raw.startsWith('GROQ_API_KEY') ||
    raw.startsWith('ANTHROPIC_API_KEY') ||
    raw.startsWith('Claude não retornou') ||
    raw.startsWith('A resposta não contém') ||
    raw.startsWith('Segmentos sem campos') ||
    raw.startsWith('EDL inválido')
  ) return raw

  // Try to extract a JSON error body (Anthropic / Groq may embed JSON in the message)
  const jsonMatch = raw.match(/\{[\s\S]*\}/)
  if (jsonMatch) {
    try {
      const body = JSON.parse(jsonMatch[0]) as Record<string, unknown>
      const type = (body?.error as Record<string, unknown>)?.type
        ?? (body?.detail as Record<string, unknown>)?.type ?? ''
      const code = (body?.error as Record<string, unknown>)?.code
        ?? (body?.detail as Record<string, unknown>)?.code ?? ''
      const msg = String((body?.error as Record<string, unknown>)?.message
        ?? (body?.detail as Record<string, unknown>)?.message ?? '')

      if (type === 'overloaded_error')
        return 'O serviço de IA está temporariamente sobrecarregado. Tenta novamente daqui a pouco.'
      if (type === 'rate_limit_error' || code === 'rate_limit_exceeded')
        return 'Demasiados pedidos. Aguarda um momento e tenta novamente.'
      if (type === 'authentication_error' || type === 'permission_error')
        return 'Chave de API inválida ou sem permissões. Verifica as configurações da app.'
      if (type === 'billing_error' || msg.toLowerCase().includes('credit') || msg.toLowerCase().includes('billing'))
        return 'Saldo insuficiente na conta de API. Contacta o administrador.'
      if (code === 'quota_exceeded' || msg.toLowerCase().includes('quota'))
        return 'Cota de transcrição esgotada. Tenta mais tarde ou contacta o suporte.'
    } catch { /* not valid JSON, fall through to string matching */ }
  }

  const r = raw.toLowerCase()

  // Our own pipeline errors (fallback — should normally be caught by the prefix check above)
  if (r.includes('a resposta não contém') || r.includes('segmentos válidos'))
    return 'A IA não encontrou segmentos para cortar. Verifica se o vídeo tem voz audível.'
  if (r.includes('edl inválido') || r.includes('no valid ranges'))
    return 'Não foi possível gerar os cortes. Tenta novamente ou usa um vídeo diferente.'
  if (r.includes('não retornou json') || r.includes('json válido'))
    return 'A IA não conseguiu analisar o vídeo. Tenta novamente.'

  // API & network errors
  if (r.includes('overloaded') || r.includes('529') || r.includes('503'))
    return 'O serviço de IA está temporariamente sobrecarregado. Tenta novamente daqui a pouco.'
  if (r.includes('rate_limit') || r.includes('rate limit') || r.includes('429'))
    return 'Demasiados pedidos. Aguarda um momento e tenta novamente.'
  if (r.includes('quota_exceeded') || r.includes('quota'))
    return 'Os créditos de transcrição esgotaram. Tenta mais tarde ou contacta o suporte.'
  if (r.includes('401') || r.includes('unauthorized') || r.includes('authentication'))
    return 'Chave de API inválida. Verifica as configurações da app.'
  if (r.includes('billing') || r.includes('credit'))
    return 'Saldo insuficiente na conta de API. Contacta o administrador.'
  if (r.includes('não configurada') || r.includes('api_key'))
    return 'A app não está configurada corretamente. Contacta o suporte.'
  if (r.includes('ffmpeg'))
    return 'Erro ao processar o vídeo. Certifica-te que o ficheiro não está corrompido.'
  if (r.includes('enoent') || r.includes('no such file'))
    return 'Ficheiro não encontrado. Tenta selecionar o vídeo novamente.'
  if (r.includes('econnrefused') || r.includes('etimedout') || r.includes('enotfound'))
    return 'Sem ligação à internet. Verifica a tua rede e tenta novamente.'
  if (r.includes('timeout'))
    return 'A operação demorou demasiado tempo. Verifica a tua ligação e tenta novamente.'

  return 'Algo correu mal. Tenta novamente ou usa um vídeo diferente.'
}

// Map each phase's sub-progress (0-100) to the overall 0-100 bar
const toOverall = (phase: ProcessPhase, sub: number): number => {
  if (phase === 'transcribe') return Math.round(sub * 0.35)        // 0 → 35
  if (phase === 'analyse') return 35 + Math.round(sub * 0.30)   // 35 → 65
  if (phase === 'export') return 65 + Math.round(sub * 0.34)   // 65 → 99
  return 100
}

export interface UseStepProcessReturn {
  pct: number
  msg: string
  phase: ProcessPhase
  error: string | null
}

export const useStepProcess = (
  videoPath: string,
  onDone: (result: RenderResult) => void,
  webcamPath?: string,
  syncOffsetSec?: number,
  pipPosition?: PipPosition,
): UseStepProcessReturn => {
  const [phase, setPhase] = useState<ProcessPhase>('transcribe')
  const [pct, setPct] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true

    const run = async () => {
      // ── 1. Transcription ──────────────────────────────────────────────────
      setPhase('transcribe')

      window.api.onTranscribeProgress((p) => {
        setPct(toOverall('transcribe', p))
      })

      const transcript = await window.api.transcribe(videoPath)
        .finally(() => window.api.removeAllListeners('transcribe-progress'))

      setPct(35)

      // ── 2. AI analysis (Claude) ────────────────────────────────────────────
      setPhase('analyse')

      // Animate progress smoothly while waiting for Claude (no real sub-progress)
      let fake = 0
      const ticker = setInterval(() => {
        fake = Math.min(fake + 4, 90)
        setPct(toOverall('analyse', fake))
      }, 600)

      const videoName = basename(videoPath).replace(/\.[^.]+$/, '')
      const language = transcript.language ?? 'pt'

      const edlRanges = await window.api
        .callClaude({ transcript, videoName, language })
        .finally(() => {
          clearInterval(ticker)
          window.api.removeAllListeners('claude-progress')
        })

      setPct(65)

      // ── 3. Render / export ─────────────────────────────────────────────────
      setPhase('export')

      window.api.onRenderProgress(({ pct: p }) => {
        setPct(toOverall('export', p))
      })

      const outputDir = `${dirname(videoPath)}/editado`
      const result = await window.api
        .render({
          videoPath,
          edlJSON: JSON.stringify(edlRanges),
          outputDir,
          webcamPath: webcamPath,
          syncOffsetSec: syncOffsetSec ?? 0,
          pipPosition,
        })
        .finally(() => window.api.removeAllListeners('render-progress'))

      setPct(100)
      setPhase('done')
      setTimeout(() => onDone(result), 800)
    }

    run().catch((e: unknown) => {
      const raw = e instanceof Error ? e.message : String(e)
      setError(friendlyError(raw))
      setPhase('error')
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return { pct, msg: PHASE_MSG[phase], phase, error }
}
