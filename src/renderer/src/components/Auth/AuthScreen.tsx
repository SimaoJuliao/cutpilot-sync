import { useState, useEffect } from 'react'
import { strings } from '@i18n'
import { supabase } from '@lib'
import { cn } from '@lib'
import { parseAuthError } from '@hooks'

const t = strings.auth
const ob = strings.onboarding

// Must match the "Minimum interval per user" setting in Supabase Auth → SMTP settings
const RESEND_COOLDOWN_SEC = 60

type View = 'login' | 'signup' | 'forgot' | 'verify' | 'reset'

// ── Input field ───────────────────────────────────────────────────────────────

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
  <div className="flex flex-col gap-1.5">
    <label htmlFor={id} className="font-mono text-[10px] tracking-[0.35em] uppercase text-muted-foreground/65">
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
          'w-full h-11 px-3 bg-card/50 border border-border/70',
          'text-foreground text-[13px] font-mono',
          'focus:outline-none focus:border-primary/70 focus:bg-card/80',
          'disabled:opacity-40 transition-all duration-150',
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

// ── Auth screen ───────────────────────────────────────────────────────────────

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
  const [resendCooldown, setResendCooldown] = useState(0)

  useEffect(() => {
    if (resendCooldown <= 0) return
    const timer = setTimeout(() => setResendCooldown(c => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [resendCooldown])

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
      setResendCooldown(RESEND_COOLDOWN_SEC)
      go('verify')
    })
  }

  const handleForgot = (e: React.FormEvent) => {
    e.preventDefault()
    run(async () => {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: 'cutpilotsync://auth/callback',
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
      setResendCooldown(RESEND_COOLDOWN_SEC)
    })
  }

  // ── UI atoms ──────────────────────────────────────────────────────────────

  const showHideBtn = (
    <button type="button" onClick={() => setShowPw(s => !s)}
      className="font-mono text-[10px] tracking-widest uppercase text-muted-foreground/50 hover:text-muted-foreground transition-colors"
      aria-label={showPw ? t.hidePassword : t.showPassword}>
      {showPw ? t.hidePassword : t.showPassword}
    </button>
  )

  const primaryBtn = (label: string) => (
    <button type="submit" disabled={loading}
      className="btn-shine w-full h-11 bg-primary text-primary-foreground
                 font-display text-lg tracking-[0.12em] uppercase
                 hover:bg-primary/90 active:scale-[0.98] transition-all duration-150
                 disabled:opacity-40 disabled:scale-100
                 shadow-[0_4px_20px_hsl(var(--primary)/0.2)]">
      {loading ? '…' : label}
    </button>
  )

  const feedback = (
    <>
      {error && <p role="alert" className="font-mono text-[11px] text-destructive/90">{error}</p>}
      {success && <p role="status" className="font-mono text-[11px] text-success/90">{success}</p>}
    </>
  )

  const backLink = (v: View, label = t.backToLogin) => (
    <button type="button" onClick={() => go(v)}
      className="font-mono text-[11px] text-muted-foreground/60 hover:text-muted-foreground transition-colors tracking-wide">
      {label}
    </button>
  )

  // ── Views ─────────────────────────────────────────────────────────────────

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
      <p className="font-mono text-[11px] text-muted-foreground/65 leading-relaxed">{t.forgotDesc}</p>
      <Field id="email-f" label={t.emailLabel} type="email" value={email} onChange={setEmail}
        autoComplete="email" disabled={loading} />
      {primaryBtn(t.sendLinkBtn)}
      {feedback}
      <div className="flex justify-start">{backLink('login')}</div>
    </form>
  )

  const renderVerify = () => (
    <div className="flex flex-col gap-5" role="status" aria-live="polite">
      {/* Envelope icon */}
      <div className="w-14 h-14 border border-primary/30 bg-primary/[0.06] flex items-center justify-center
                      shadow-[inset_0_1px_0_hsl(var(--primary)/0.1)]">
        <svg width="28" height="28" viewBox="0 0 48 48" fill="none" aria-hidden="true"
          className="text-primary/75 drop-shadow-[0_0_8px_hsl(32_97%_55%/0.3)]">
          <rect x="4" y="10" width="40" height="28" rx="1" stroke="currentColor" strokeWidth="1.5" />
          <path d="M4 14l20 13 20-13" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </div>

      <div className="space-y-1.5">
        <p className="font-mono text-[12px] text-muted-foreground/75 leading-relaxed">
          {t.verifyDesc}{' '}
          <span className="text-foreground/90">{email}</span>.
        </p>
        <p className="font-mono text-[11px] text-muted-foreground/55">{t.verifySubDesc}</p>
      </div>

      <button type="button" onClick={handleResend} disabled={loading || resendCooldown > 0}
        className="font-mono text-[11px] text-muted-foreground/65 hover:text-muted-foreground
                   transition-colors tracking-wide disabled:opacity-40 disabled:cursor-not-allowed text-left">
        {resendCooldown > 0 ? `${t.resendBtn} (${resendCooldown}s)` : t.resendBtn}
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

  const TITLES: Record<View, string> = {
    login: t.loginTitle,
    signup: t.signupTitle,
    forgot: t.forgotTitle,
    verify: t.verifyTitle,
    reset: t.resetTitle,
  }

  // ── Feature bullets — reutiliza os step labels do onboarding ──────────────

  const FEATURES = [
    { label: ob.step1Label, n: '01' },
    { label: ob.step2Label, n: '02' },
    { label: ob.step3Label, n: '03' },
  ]

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <section className="flex h-full animate-fade-up" aria-label="Autenticação">

      {/* ── LEFT — Branding panel ──────────────────────────────────────────── */}
      <div
        className="flex-[5] flex flex-col justify-center border-r border-border/30"
        style={{ padding: 'clamp(24px, 5vw, 64px)' }}
        aria-hidden="true"
      >
        {/* Eyebrow */}
        <p className="font-mono text-[10px] text-primary/70 tracking-[0.45em] uppercase mb-7
                      flex items-center gap-2">
          <span className="w-1 h-1 rounded-full bg-primary inline-block" />
          {ob.eyebrow}
        </p>

        {/* Wordmark */}
        <div className="mb-6 leading-[0.85] font-display uppercase select-none"
          style={{ fontSize: 'clamp(52px, 6.5vw, 88px)' }}>
          <div className="text-foreground/85">CUT</div>
          <div className="text-primary text-glow-amber">PILOT</div>
        </div>
        <div className="font-mono text-[11px] tracking-[0.6em] text-primary/55 uppercase mb-8 select-none">
          SYNC
        </div>

        {/* Accent */}
        <div className="flex items-center gap-3 mb-8" aria-hidden="true">
          <div className="h-px w-10 bg-primary/40" />
          <div className="w-1 h-1 rounded-full bg-primary/60" />
          <div className="h-px w-16 bg-gradient-to-r from-primary/20 to-transparent" />
        </div>

        {/* Feature steps */}
        <ul className="flex flex-col gap-3.5">
          {FEATURES.map(({ label, n }) => (
            <li key={n} className="flex items-center gap-3">
              <span className="font-mono text-[9px] text-primary/45 tracking-widest shrink-0">{n}</span>
              <span className="w-px h-3 bg-border/50 shrink-0" aria-hidden="true" />
              <span className="font-mono text-[11px] text-muted-foreground/65">{label}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Separator */}
      <div className="self-stretch w-px bg-gradient-to-b from-transparent via-border/40 to-transparent shrink-0"
        aria-hidden="true" />

      {/* ── RIGHT — Form ───────────────────────────────────────────────────── */}
      <div
        className="flex-[6] flex flex-col justify-center"
        style={{ padding: 'clamp(24px, 5vw, 64px)' }}
      >
        <div className="w-full max-w-[300px]">

          {/* Title */}
          <h1 className="font-display text-[52px] leading-[0.88] text-foreground uppercase mb-6 animate-fade-up">
            {TITLES[view]}
          </h1>

          {/* Tab switcher */}
          {(view === 'login' || view === 'signup') && (
            <div className="flex w-full border-b border-border/60 mb-6"
              role="tablist" aria-label="Modo de autenticação">
              {(['login', 'signup'] as const).map(v => (
                <button
                  key={v}
                  role="tab"
                  aria-selected={view === v}
                  type="button"
                  onClick={() => go(v)}
                  className={cn(
                    'flex-1 pb-2.5 font-display text-sm tracking-[0.1em] uppercase transition-all duration-200',
                    view === v
                      ? 'text-foreground border-b-2 border-primary -mb-px'
                      : 'text-muted-foreground/45 hover:text-muted-foreground/70',
                  )}
                >
                  {v === 'login' ? t.loginTab : t.signupTab}
                </button>
              ))}
            </div>
          )}

          {/* Form content */}
          {view === 'login'  && renderLogin()}
          {view === 'signup' && renderSignup()}
          {view === 'forgot' && renderForgot()}
          {view === 'verify' && renderVerify()}
          {view === 'reset'  && renderReset()}

        </div>
      </div>

    </section>
  )
}

export default AuthScreen
