import { useState, useEffect, useCallback, useRef } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@lib'

// ── Error parsing ────────────────────────────────────────────────────────────

export const parseAuthError = (err: unknown): string => {
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase()
  // Backend unreachable (DNS failure, offline, project deleted) — say so plainly
  // instead of the generic message, which sends people hunting for a typo in
  // credentials that are perfectly fine.
  if (msg.includes('fetch failed') || msg.includes('failed to fetch') ||
      msg.includes('networkerror') || msg.includes('enotfound') || msg.includes('econnrefused'))
    return 'Não foi possível ligar ao servidor. Verifica a tua ligação à internet.'
  if (msg.includes('invalid login credentials') || msg.includes('invalid credentials'))
    return 'Email ou password incorretos.'
  if (msg.includes('already registered') || msg.includes('user already registered'))
    return 'Este email já está registado.'
  if (msg.includes('password should be at least') || msg.includes('should be at least 6'))
    return 'A password deve ter pelo menos 6 caracteres.'
  if (msg.includes('invalid email') || msg.includes('invalid format') || msg.includes('unable to validate'))
    return 'Email inválido.'
  if (msg.includes('email not confirmed'))
    return 'Email ainda não confirmado. Verifica a tua caixa de entrada.'
  if (msg.includes('rate limit') || msg.includes('too many') || msg.includes('email rate limit exceeded'))
    return 'Demasiadas tentativas. Aguarda um momento antes de reenviar.'
  return 'Algo correu mal. Tenta novamente.'
}

// ── Hook ─────────────────────────────────────────────────────────────────────

// The session check must never leave the app on the splash forever. If Supabase
// cannot be reached (offline, DNS failure, deleted project) getSession() can hang
// indefinitely, so we cap it and fall through to an actionable error screen.
const SESSION_TIMEOUT_MS = 10_000

/**
 * Why the session check failed, when it did.
 *
 * Worth separating: `navigator.onLine === false` is a reliable "this machine has
 * no network", while everything else means we reached the network and the
 * backend still did not answer — a dead or paused project looks exactly like
 * this. Telling someone with working internet to check their internet sends
 * them hunting for a problem they do not have.
 */
export type ConnectionFailure = 'offline' | 'unreachable'

export interface UseAuthReturn {
  user: User | null
  loading: boolean
  connectionError: ConnectionFailure | null  // set when the session check failed/timed out
  retryConnection: () => void
  isResetting: boolean    // true while showing "set new password" after deep link
  finishReset: () => void
  signIn: (email: string, pw: string) => Promise<void>
  signUp: (email: string, pw: string) => Promise<void>
  signOut: () => Promise<void>
  sendPasswordReset: (email: string) => Promise<void>
  updatePassword: (newPw: string) => Promise<void>
  deleteAccount: () => Promise<void>
}

export const useAuth = (): UseAuthReturn => {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [connectionError, setConnectionError] = useState<ConnectionFailure | null>(null)
  const [isResetting, setIsResetting] = useState(false)

  // useRef so setting the flag is synchronous and never affected by render cycles
  const expectingRecovery = useRef(false)

  /**
   * Restore an existing session, settling exactly once — by whichever of the
   * call and the timeout finishes first. Standalone rather than inlined in the
   * mount effect so "Tentar novamente" can redo just this, instead of also
   * tearing down and rebuilding the auth subscription and deep-link listener.
   */
  const checkSession = useCallback(() => {
    setLoading(true)
    setConnectionError(null)

    let settled = false
    const settle = (sessionUser: User | null, failure: ConnectionFailure | null) => {
      if (settled) return
      settled = true
      setUser(sessionUser)
      setConnectionError(failure)
      setLoading(false)
    }
    // Read at failure time, not at mount: the network may have dropped since.
    const failed = () => settle(null, navigator.onLine ? 'unreachable' : 'offline')

    const timeout = setTimeout(() => {
      console.error(`[auth] getSession did not resolve in ${SESSION_TIMEOUT_MS}ms — backend unreachable`)
      failed()
    }, SESSION_TIMEOUT_MS)

    supabase.auth.getSession()
      .then(({ data, error }) => {
        if (error) {
          console.error('[auth] getSession error:', error)
          failed()
          return
        }
        settle(data.session?.user ?? null, null)
      })
      .catch((err) => {
        console.error('[auth] getSession failed:', err)
        failed()
      })
      .finally(() => clearTimeout(timeout))

    return () => clearTimeout(timeout)
  }, [])

  useEffect(() => {
    const cancelSessionCheck = checkSession()

    // React to auth state changes.
    // PASSWORD_RECOVERY fires in some Supabase flows; SIGNED_IN fires when we
    // call setSession() manually. We handle both using the expectingRecovery flag.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[auth] onAuthStateChange event:', event)
      setUser(session?.user ?? null)

      if (event === 'PASSWORD_RECOVERY') {
        console.log('[auth] PASSWORD_RECOVERY — showing reset form')
        expectingRecovery.current = false
        setIsResetting(true)
      } else if (event === 'SIGNED_IN' && expectingRecovery.current) {
        console.log('[auth] SIGNED_IN after recovery deep link — showing reset form')
        expectingRecovery.current = false
        setIsResetting(true)
      }
    })

    // Handle auth deep links (cutpilotsync://auth/callback#type=recovery|signup&...)
    const cleanupLink = window.api.onDeepLink((url) => {
      console.log('[deep-link] received:', url)

      // ── Implicit flow: tokens arrive in the URL fragment ──────────────────
      // cutpilotsync://auth/callback#access_token=...&type=recovery|signup&...
      const hash = url.split('#')[1] ?? ''
      const hashParams = new URLSearchParams(hash)
      const type = hashParams.get('type')

      if (type === 'recovery' || type === 'signup') {
        const access_token = hashParams.get('access_token') ?? ''
        const refresh_token = hashParams.get('refresh_token') ?? ''
        console.log(`[deep-link] implicit flow type=${type} — calling setSession`)
        if (type === 'recovery') expectingRecovery.current = true
        supabase.auth.setSession({ access_token, refresh_token })
          .then(({ error }) => {
            if (error) {
              console.error('[deep-link] setSession error:', error)
              expectingRecovery.current = false
            }
          })
        return
      }

      // ── PKCE flow fallback: a ?code= arrives instead ──────────────────────
      // cutpilotsync://auth/callback?code=...
      const query = url.split('?')[1] ?? ''
      const queryParams = new URLSearchParams(query)
      const code = queryParams.get('code')

      if (code) {
        console.log('[deep-link] PKCE flow — setting expectingRecovery flag')
        expectingRecovery.current = true
        supabase.auth.exchangeCodeForSession(code)
          .then(({ error }) => {
            if (error) {
              console.error('[deep-link] exchangeCode error:', error)
              expectingRecovery.current = false
            }
          })
        return
      }

      console.log('[deep-link] URL did not match any recovery pattern — ignored')
    })

    return () => { cancelSessionCheck(); subscription.unsubscribe(); cleanupLink() }
  }, [checkSession])

  /** "Tentar novamente" on the connection-error screen. */
  const retryConnection = checkSession

  const signIn = useCallback(async (email: string, pw: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password: pw })
    if (error) throw new Error(parseAuthError(error))
  }, [])

  const signUp = useCallback(async (email: string, pw: string) => {
    const { error } = await supabase.auth.signUp({ email, password: pw })
    if (error) throw new Error(parseAuthError(error))
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
  }, [])

  const sendPasswordReset = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'cutpilotsync://auth/callback',
    })
    if (error) throw new Error(parseAuthError(error))
  }, [])

  const updatePassword = useCallback(async (newPw: string) => {
    const { error } = await supabase.auth.updateUser({ password: newPw })
    if (error) throw new Error(parseAuthError(error))
  }, [])

  const deleteAccount = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) throw new Error('Não estás autenticado.')
    await window.api.deleteAccount(session.access_token)
    await supabase.auth.signOut()
  }, [])

  const finishReset = useCallback(() => setIsResetting(false), [])

  return {
    user, loading, connectionError, retryConnection, isResetting, finishReset,
    signIn, signUp, signOut,
    sendPasswordReset, updatePassword, deleteAccount,
  }
}
