import { useState } from 'react'
import { strings } from '@i18n'
import { supabase } from '@lib'
import { cn } from '@lib'
import { parseAuthError } from '@hooks'

const t = strings.auth

// ── Reusable input field (same as AuthScreen) ────────────────────────────────

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

// ── Types ────────────────────────────────────────────────────────────────────

interface AccountSettingsProps {
  email: string
  onClose: () => void
  onSignOut: () => void
}

// ── Component ────────────────────────────────────────────────────────────────

const AccountSettings = ({ email, onClose, onSignOut }: AccountSettingsProps) => {
  const [section, setSection] = useState<'main' | 'password' | 'delete'>('main')

  // Password change
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [showPw, setShowPw] = useState(false)

  // Shared
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const clear = () => { setError(null); setSuccess(null) }

  const run = async (fn: () => Promise<void>) => {
    clear(); setLoading(true)
    try { await fn() }
    catch (err) { setError(err instanceof Error ? err.message : parseAuthError(err)) }
    finally { setLoading(false) }
  }

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault()
    if (pw !== pw2) { setError(t.errors.passwordMismatch); return }
    run(async () => {
      const { error } = await supabase.auth.updateUser({ password: pw })
      if (error) throw new Error(parseAuthError(error))
      setSuccess(t.passwordChanged)
      setPw(''); setPw2('')
      setTimeout(() => { clear(); setSection('main') }, 2000)
    })
  }

  const handleDeleteAccount = () => {
    run(async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Não estás autenticado.')
      await window.api.deleteAccount(session.access_token)
      await supabase.auth.signOut()
      // onSignOut will be triggered by the auth state change in useAuth
    })
  }

  // ── Show/hide toggle ──────────────────────────────────────────────────────

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

  // ── Feedback atom ─────────────────────────────────────────────────────────

  const feedback = (
    <>
      {error && <p role="alert" className="font-mono text-[11px] text-destructive/90 text-center">{error}</p>}
      {success && <p role="status" className="font-mono text-[11px] text-success/90 text-center">{success}</p>}
    </>
  )

  // ── Sections ──────────────────────────────────────────────────────────────

  const renderMain = () => (
    <div className="flex flex-col gap-6">

      {/* Email display */}
      <div className="flex flex-col gap-1">
        <span className="font-mono text-[10px] tracking-widest uppercase text-muted-foreground/70">
          {t.emailLabel}
        </span>
        <span className="font-mono text-xs text-foreground/80 break-all">{email}</span>
      </div>

      {/* Security section */}
      <div className="flex flex-col gap-2">
        <span className="font-mono text-[10px] tracking-widest uppercase text-muted-foreground/50">
          {t.sectionSecurity}
        </span>
        <button
          type="button"
          onClick={() => { clear(); setPw(''); setPw2(''); setSection('password') }}
          className={cn(
            'w-full h-10 px-3 flex items-center justify-between',
            'bg-muted border border-border text-left',
            'text-foreground/80 text-xs font-mono',
            'hover:border-border/80 hover:text-foreground transition-colors',
          )}
        >
          {t.changePasswordBtn}
          <span className="text-muted-foreground/40">→</span>
        </button>
      </div>

      {/* Session section */}
      <div className="flex flex-col gap-2">
        <span className="font-mono text-[10px] tracking-widest uppercase text-muted-foreground/50">
          {t.sectionSession}
        </span>
        <button
          type="button"
          onClick={onSignOut}
          className={cn(
            'w-full h-10 px-3 flex items-center',
            'bg-muted border border-border text-left',
            'text-foreground/80 text-xs font-mono',
            'hover:border-border/80 hover:text-foreground transition-colors',
          )}
        >
          {t.logoutBtn}
        </button>
      </div>

      {/* Danger zone */}
      <div className="flex flex-col gap-2">
        <span className="font-mono text-[10px] tracking-widest uppercase text-destructive/60">
          {t.sectionDanger}
        </span>
        <button
          type="button"
          onClick={() => { clear(); setSection('delete') }}
          className={cn(
            'w-full h-10 px-3 flex items-center',
            'bg-muted border border-destructive/30 text-left',
            'text-destructive/70 text-xs font-mono',
            'hover:border-destructive/60 hover:text-destructive transition-colors',
          )}
        >
          {t.deleteAccountBtn}
        </button>
      </div>
    </div>
  )

  const renderPassword = () => (
    <form onSubmit={handleChangePassword} className="flex flex-col gap-4" noValidate>
      <Field id="pw-c" label={t.newPasswordLabel} type={showPw ? 'text' : 'password'} value={pw} onChange={setPw}
        autoComplete="new-password" disabled={loading} action={showHideBtn} />
      <Field id="pw2-c" label={t.confirmPasswordLabel} type={showPw ? 'text' : 'password'} value={pw2} onChange={setPw2}
        autoComplete="new-password" disabled={loading} />
      <button
        type="submit"
        disabled={loading}
        className="w-full h-11 bg-primary text-primary-foreground font-display text-lg tracking-[0.12em] uppercase
                   hover:bg-primary/90 active:scale-[0.98] transition-all duration-150
                   disabled:opacity-40 disabled:scale-100"
      >
        {loading ? '…' : t.saveBtn}
      </button>
      {feedback}
      <button
        type="button"
        onClick={() => { clear(); setSection('main') }}
        className="font-mono text-[11px] text-muted-foreground/60 hover:text-muted-foreground transition-colors tracking-wide"
      >
        {t.cancelBtn}
      </button>
    </form>
  )

  const renderDelete = () => (
    <div className="flex flex-col gap-5">
      {/* Warning icon */}
      <div className="flex flex-col items-center gap-3 text-center">
        <svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden="true" className="text-destructive/70">
          <path d="M20 4L37 34H3L20 4Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
          <line x1="20" y1="16" x2="20" y2="24" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="20" cy="29" r="1" fill="currentColor" />
        </svg>
        <p className="font-mono text-[11px] text-muted-foreground/70 leading-relaxed max-w-[220px]">
          {t.deleteWarning}
        </p>
      </div>

      {feedback}

      <button
        type="button"
        onClick={handleDeleteAccount}
        disabled={loading}
        className={cn(
          'w-full h-11 border border-destructive/50',
          'text-destructive font-display text-base tracking-[0.10em] uppercase',
          'hover:bg-destructive hover:text-destructive-foreground',
          'active:scale-[0.98] transition-all duration-150',
          'disabled:opacity-40 disabled:scale-100',
        )}
      >
        {loading ? '…' : t.deleteConfirmBtn}
      </button>

      <button
        type="button"
        onClick={() => { clear(); setSection('main') }}
        className="font-mono text-[11px] text-muted-foreground/60 hover:text-muted-foreground transition-colors tracking-wide"
      >
        {t.cancelBtn}
      </button>
    </div>
  )

  // ── Title per section ─────────────────────────────────────────────────────

  const TITLES = {
    main: t.settingsTitle,
    password: t.changePasswordBtn.toUpperCase() + '.',
    delete: t.deleteAccountBtn.toUpperCase() + '.',
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-end"
      role="dialog"
      aria-modal="true"
      aria-label={TITLES[section]}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-background/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel — slides in from right */}
      <section
        className="relative z-10 h-full w-[280px] bg-background border-l border-border flex flex-col
                   animate-slide-in-right overflow-y-auto"
      >
        {/* Panel header */}
        <div
          className="h-[38px] shrink-0 flex items-center justify-between px-5 border-b border-border/50"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          <span className="font-mono text-[10px] tracking-widest uppercase text-muted-foreground/50">
            {strings.app.title}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground/50 hover:text-muted-foreground transition-colors"
            aria-label="Fechar definições"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 px-6 py-7 flex flex-col gap-6">
          <h2 className="font-display text-[32px] leading-[0.9] text-foreground uppercase">
            {TITLES[section]}
          </h2>
          {section === 'main' && renderMain()}
          {section === 'password' && renderPassword()}
          {section === 'delete' && renderDelete()}
        </div>
      </section>
    </div>
  )
}

export default AccountSettings
