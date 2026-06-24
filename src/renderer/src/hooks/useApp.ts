import { useState, useEffect, useCallback, useRef } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@lib'
import type { RenderResult, PipPosition } from '@/types'

const ONBOARDED_KEY = 'cps_onboarded'

export type Step = 'onboarding' | 'upload' | 'process' | 'done'

export interface ProcessParams {
  videoPath: string
  webcamPath?: string
  syncOffsetSec?: number
  pipPosition?: PipPosition
}

export interface AppState {
  step: Step
  videoPath: string | null
  webcamPath: string | null
  syncOffsetSec: number
  pipPosition: PipPosition | null
  result: RenderResult | null
}

export interface AppActions {
  finishOnboarding: () => void
  startProcessing: (params: ProcessParams) => void
  finishDone: (res: RenderResult) => void
  reset: () => void
}

export const useApp = (user: User | null): AppState & AppActions => {
  const [step, setStep] = useState<Step>('onboarding')
  const [videoPath, setVideoPath] = useState<string | null>(null)
  const [webcamPath, setWebcamPath] = useState<string | null>(null)
  const [syncOffsetSec, setSyncOffsetSec] = useState(0)
  const [pipPosition, setPipPosition] = useState<PipPosition | null>(null)
  const [result, setResult] = useState<RenderResult | null>(null)

  // Initialize step once the user is known.
  // Source of truth is Supabase metadata (works cross-device / fresh sessions).
  // localStorage is ignored — it was used before auth existed and is now stale.
  const initialized = useRef(false)
  useEffect(() => {
    if (user && !initialized.current) {
      initialized.current = true
      const done = !!user.user_metadata?.onboarding_completed
      setStep(done ? 'upload' : 'onboarding')
      // Clean up the old localStorage key so it never interferes again
      localStorage.removeItem(ONBOARDED_KEY)
    }
  }, [user])

  const finishOnboarding = useCallback(() => {
    setStep('upload')
    // Persist to Supabase so any device / fresh login skips onboarding
    supabase.auth.updateUser({ data: { onboarding_completed: true } })
      .catch(err => console.error('[useApp] failed to save onboarding state:', err))
  }, [])

  const startProcessing = useCallback(({ videoPath: path, webcamPath: wc, syncOffsetSec: offset, pipPosition: pip }: ProcessParams) => {
    setVideoPath(path)
    setWebcamPath(wc ?? null)
    setSyncOffsetSec(offset ?? 0)
    setPipPosition(pip ?? null)
    setStep('process')
  }, [])

  const finishDone = useCallback((res: RenderResult) => {
    setResult(res)
    setStep('done')
  }, [])

  const reset = useCallback(() => {
    setVideoPath(null)
    setWebcamPath(null)
    setSyncOffsetSec(0)
    setPipPosition(null)
    setResult(null)
    setStep('upload')
  }, [])

  return { step, videoPath, webcamPath, syncOffsetSec, pipPosition, result, finishOnboarding, startProcessing, finishDone, reset }
}
