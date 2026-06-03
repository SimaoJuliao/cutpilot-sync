import { useState } from 'react'
import { strings } from '@i18n'
import { supabase } from '@lib'
import { cn } from '@lib'
import { parseAuthError } from '@hooks'

const t = strings.auth

type View = 'login' | 'signup' | 'forgot' | 'verify' | 'reset'

// ── Reusable input field ─────────────────────────────────────────────────────

interface FieldProps {
  id: string
  label: string
  type?: string
  value: string
  onChange: (v: string) => void
  autoComplete?: string
  disabled?: boolean
  action?: React.ReactNode
}

const Field = ({ id, label, type = 'text', value, onChange, autoComplete, disabled, action }: FieldProps) => (
  <div className="flex flex-col gap-1">
    <label htmlFor={id} className="font-mono text-[10px] tracking-widest uppercase text-muted-foreground/70">
      {label}
    </label>
    <div className="relative">
      <input
        id={id}
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        autoComplete={autoComplete}
        disabled={disabled}
        className={cn(
          'w-full h-10 px-3 bg-muted border border-border',
          'text-foreground text-xs font-mono',
          'placeholder:text-muted-foreground/40',
          'focus:outline-none focus:border-primary/60',
          'disabled:opacity-40 transition-colors',
          action && 'pr-20',
        )}
      />
      {action && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          {action}
        </div>
      )}
    </div>
  </div>
)

// ── Auth screen ──────────────────────────────────────────────────────────────

interface AuthScreenProps {
  isResetting: boolean
  onResetDone: () => void
}

const AuthScreen = ({ isResetting, onResetDone }: AuthScreenProps) => {
  const [view, setView] = useState<View>(isResetting ? 'reset' : 'login')
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Sync reset view when deep link fires after mount
  if (isResetting && view !== 'reset') setView('reset')

  const clear = () => { setError(null); setSuccess(null) }
  const go = (v: View) => { clear(); setPw(''); setPw2(''); setView(v) }

  const run = async (fn: () => Promise<void>) => {
    clear(); setLoading(true)
    try { await fn() }
    catch (err) { setError(err instanceof Error ? err.message : parseAuthError(err)) }
    finally { setLoading(false) }
  }

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    run(async () => {
      const { error } = await supabase.auth.signInWithPassword({ email, password: pw })
      if (error) throw new Error(parseAuthError(error))
    })
  }

  const handleSignup = (e: React.FormEvent) => {
    e.preventDefault()
    if (pw !== pw2) { setError(t.errors.passwordMismatch); return }
    run(async () => {
      const { error } = await supabase.auth.signUp({ email, password: pw })
      if (error) throw new Error(parseAuthError(error))
      go('verify')
    })
  }

  const handleForgot = (e: React.FormEvent) => {
    e.preventDefault()
    run(async () => {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: 'videoeditor://auth/callback',
      })
      if (error) throw new Error(parseAuthError(error))
      setSuccess(t.linkSent)
    })
  }

  const handleReset = (e: React.FormEvent) => {
    e.preventDefault()
    if (pw !== pw2) { setError(t.errors.passwordMismatch); return }
    run(async () => {
      const { error } = await supabase.auth.updateUser({ password: pw })
      if (error) throw new Error(parseAuthError(error))
      setSuccess(t.passwordReset)
      setTimeout(() => { onResetDone(); go('login') }, 2000)
    })
  }

  const handleResend = () => {
    run(async () => {
      const { error } = await supabase.auth.resend({ type: 'signup', email })
      if (error) throw new Error(parseAuthError(error))
      setSuccess(t.linkSent)
    })
  }

  // ── Shared UI atoms ────────────────────────────────────────────────────────

  const showHideBtn = (
    <button
      type="button"
      onClick={() => setShowPw(s => !s)}
      className="font-mono text-[10px] tracking-widest uppercase text-muted-foreground/50 hover:text-muted-foreground transition-colors"
      aria-label={showPw ? t.hidePassword : t.showPassword}
    >
      {showPw ? t.hidePassword : t.showPassword}
    </button>
  )

  const primaryBtn = (label: string) => (
    <button
      type="submit"
      disabled={loading}
      className="w-full h-11 bg-primary text-primary-foreground font-display text-lg tracking-[0.12em] uppercase
                 hover:bg-primary/90 active:scale-[0.98] transition-all duration-150
                 disabled:opacity-40 disabled:scale-100"
    >
      {loading ? '…' : label}
    </button>
  )

  const feedback = (
    <>
      {error && <p role="alert" className="font-mono text-[11px] text-destructive/90 text-center">{error}</p>}
      {success && <p role="status" className="font-mono text-[11px] text-success/90 text-center">{success}</p>}
    </>
  )

  const backLink = (v: View, label = t.backToLogin) => (
    <button type="button" onClick={() => go(v)}
      className="font-mono text-[11px] text-muted-foreground/60 hover:text-muted-foreground transition-colors tracking-wide">
      {label}
    </button>
  )

  // ── Views ──────────────────────────────────────────────────────────────────

  const renderLogin = () => (
    <form onSubmit={handleLogin} className="flex flex-col gap-4" aria-label="Entrar na conta" noValidate>
      <Field id="email" label={t.emailLabel} type="email" value={email} onChange={setEmail}
        autoComplete="email" disabled={loading} />
      <Field id="pw" label={t.passwordLabel} type={showPw ? 'text' : 'password'} value={pw} onChange={setPw}
        autoComplete="current-password" disabled={loading} action={showHideBtn} />
      {primaryBtn(t.loginBtn)}
      {feedback}
      <div className="flex justify-between items-center">
        <button type="button" onClick={() => go('forgot')}
          className="font-mono text-[11px] text-muted-foreground/60 hover:text-muted-foreground transition-colors tracking-wide">
          {t.forgotLink}
        </button>
        <button type="button" onClick={() => go('signup')}
          className="font-mono text-[11px] text-muted-foreground/60 hover:text-muted-foreground transition-colors tracking-wide">
          {t.noAccount}
        </button>
      </div>
    </form>
  )

  const renderSignup = () => (
    <form onSubmit={handleSignup} className="flex flex-col gap-4" aria-label="Criar conta" noValidate>
      <Field id="email-s" label={t.emailLabel} type="email" value={email} onChange={setEmail}
        autoComplete="email" disabled={loading} />
      <Field id="pw-s" label={t.passwordLabel} type={showPw ? 'text' : 'password'} value={pw} onChange={setPw}
        autoComplete="new-password" disabled={loading} action={showHideBtn} />
      <Field id="pw2-s" label={t.confirmPasswordLabel} type={showPw ? 'text' : 'password'} value={pw2} onChange={setPw2}
        autoComplete="new-password" disabled={loading} />
      {primaryBtn(t.signupBtn)}
      {feedback}
      <div className="flex justify-end">{backLink('login', t.hasAccount)}</div>
    </form>
  )

  const renderForgot = () => (
    <form onSubmit={handleForgot} className="flex flex-col gap-4" aria-label="Recuperar password" noValidate>
      <p className="font-mono text-[11px] text-muted-foreground/60 leading-relaxed">{t.forgotDesc}</p>
      <Field id="email-f" label={t.emailLabel} type="email" value={email} onChange={setEmail}
        autoComplete="email" disabled={loading} />
      {primaryBtn(t.sendLinkBtn)}
      {feedback}
      <div className="flex justify-start">{backLink('login')}</div>
    </form>
  )

  const renderVerify = () => (
    <div className="flex flex-col gap-5 items-center text-center" role="status" aria-live="polite">
      {/* Email icon */}
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none" aria-hidden="true" className="text-primary/60">
        <rect x="4" y="10" width="40" height="28" rx="1" stroke="currentColor" strokeWidth="1.5" />
        <path d="M4 14l20 13 20-13" stroke="currentColor" strokeWidth="1.5" />
      </svg>
      <p className="font-mono text-[11px] text-muted-foreground/70 leading-relaxed max-w-[240px]">
        {t.verifyDesc} <span className="text-foreground/80">{email}</span>.<br />
        <span className="mt-1 block">{t.verifySubDesc}</span>
      </p>
      <button type="button" onClick={handleResend} disabled={loading}
        className="font-mono text-[11px] text-muted-foreground/60 hover:text-muted-foreground transition-colors tracking-wide disabled:opacity-40">
        {t.resendBtn}
      </button>
      {feedback}
      <div>{backLink('login', t.differentEmail)}</div>
    </div>
  )

  const renderReset = () => (
    <form onSubmit={handleReset} className="flex flex-col gap-4" aria-label="Definir nova password" noValidate>
      <Field id="pw-r" label={t.newPasswordLabel} type={showPw ? 'text' : 'password'} value={pw} onChange={setPw}
        autoComplete="new-password" disabled={loading} action={showHideBtn} />
      <Field id="pw2-r" label={t.confirmPasswordLabel} type={showPw ? 'text' : 'password'} value={pw2} onChange={setPw2}
        autoComplete="new-password" disabled={loading} />
      {primaryBtn(t.setPasswordBtn)}
      {feedback}
    </form>
  )

  // ── Title per view ─────────────────────────────────────────────────────────

  const TITLES: Record<View, string> = {
    login: t.loginTitle,
    signup: t.signupTitle,
    forgot: t.forgotTitle,
    verify: t.verifyTitle,
    reset: t.resetTitle,
  }

  return (
    <section
      className="flex flex-col items-center justify-center h-full px-12 gap-7 animate-fade-up"
      aria-label="Autenticação"
    >
      {/* Heading */}
      <div className="w-full max-w-xs">
        <h1 className="font-display text-[44px] leading-[0.9] text-foreground uppercase mb-0">
          {TITLES[view]}
        </h1>
      </div>

      {/* Tab switcher — only on login/signup */}
      {(view === 'login' || view === 'signup') && (
        <div className="flex w-full max-w-xs border-b border-border" role="tablist" aria-label="Modo de autenticação">
          {(['login', 'signup'] as const).map(v => (
            <button
              key={v}
              role="tab"
              aria-selected={view === v}
              type="button"
              onClick={() => go(v)}
              className={cn(
                'flex-1 pb-2 font-display text-sm tracking-[0.08em] uppercase transition-colors',
                view === v
                  ? 'text-foreground border-b-2 border-primary -mb-px'
                  : 'text-muted-foreground/50 hover:text-muted-foreground/80',
              )}
            >
              {v === 'login' ? t.loginTab : t.signupTab}
            </button>
          ))}
        </div>
      )}

      {/* Form content */}
      <div className="w-full max-w-xs">
        {view === 'login' && renderLogin()}
        {view === 'signup' && renderSignup()}
        {view === 'forgot' && renderForgot()}
        {view === 'verify' && renderVerify()}
        {view === 'reset' && renderReset()}
      </div>
    </section>
  )
}

export default AuthScreen
