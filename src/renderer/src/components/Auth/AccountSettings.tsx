import { useState } from 'react'
import { strings } from '@i18n'
import { supabase } from '@lib'
import { cn } from '@lib'
import { parseAuthError } from '@hooks'
import { LockIcon, LogoutIcon, TrashIcon, CloseIcon, ChevronIcon, WarnIcon } from '@assets/icons'

const t = strings.auth

// ── Field ─────────────────────────────────────────────────────────────────────

interface FieldProps {
  id: string; label: string; type?: string; value: string
  onChange: (v: string) => void; autoComplete?: string
  disabled?: boolean; action?: React.ReactNode
}

const Field = ({ id, label, type = 'text', value, onChange, autoComplete, disabled, action }: FieldProps) => (
  <div className="flex flex-col gap-1.5">
    <label htmlFor={id} className="font-mono text-[10px] tracking-[0.35em] uppercase text-muted-foreground/60">
      {label}
    </label>
    <div className="relative">
      <input id={id} type={type} value={value} onChange={e => onChange(e.target.value)}
        autoComplete={autoComplete} disabled={disabled}
        className={cn(
          'w-full h-10 px-3 bg-background/80 border border-border/70',
          'text-foreground text-[13px] font-mono',
          'focus:outline-none focus:border-primary/60 transition-all duration-150',
          'disabled:opacity-40',
          action && 'pr-20',
        )}
      />
      {action && <div className="absolute right-3 top-1/2 -translate-y-1/2">{action}</div>}
    </div>
  </div>
)

// ── Action row ────────────────────────────────────────────────────────────────

interface ActionRowProps {
  icon: React.ReactNode
  label: string
  onClick: () => void
  variant?: 'default' | 'danger'
}

const ActionRow = ({ icon, label, onClick, variant = 'default' }: ActionRowProps) => (
  <button type="button" onClick={onClick}
    className={cn(
      'w-full flex items-center gap-3 px-3 py-3',
      'border transition-all duration-200 group',
      variant === 'danger'
        ? 'border-destructive/25 bg-destructive/[0.03] text-destructive/70 hover:border-destructive/50 hover:bg-destructive/[0.08] hover:text-destructive'
        : 'border-border/50 bg-card/30 text-foreground/70 hover:border-primary/45 hover:bg-primary/[0.05] hover:text-foreground',
    )}
  >
    <span className={cn(
      'shrink-0 transition-colors duration-200',
      variant === 'danger' ? 'text-destructive/60 group-hover:text-destructive' : 'text-muted-foreground/60 group-hover:text-primary/80',
    )}>
      {icon}
    </span>
    <span className="flex-1 text-left font-mono text-[11px] tracking-wide">{label}</span>
    <span className={cn(
      'shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200',
      variant === 'danger' ? 'text-destructive/60' : 'text-primary/60',
    )}>
      <ChevronIcon direction="right" />
    </span>
  </button>
)

// ── Types ─────────────────────────────────────────────────────────────────────

interface AccountSettingsProps {
  email: string
  onClose: () => void
  onSignOut: () => void
}

// ── Component ─────────────────────────────────────────────────────────────────

export const AccountSettings = ({ email, onClose, onSignOut }: AccountSettingsProps) => {
  const [section, setSection] = useState<'main' | 'password' | 'delete'>('main')
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [showPw, setShowPw] = useState(false)
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
      if (!session) throw new Error(t.notAuthenticated)
      await window.api.deleteAccount(session.access_token)
      await supabase.auth.signOut()
    })
  }

  const showHideBtn = (
    <button type="button" onClick={() => setShowPw(s => !s)}
      className="font-mono text-[10px] tracking-widest uppercase text-muted-foreground/50 hover:text-muted-foreground transition-colors"
      aria-label={showPw ? t.hidePassword : t.showPassword}>
      {showPw ? t.hidePassword : t.showPassword}
    </button>
  )

  const feedback = (
    <>
      {error   && <p role="alert"  className="font-mono text-[11px] text-destructive/90">{error}</p>}
      {success && <p role="status" className="font-mono text-[11px] text-success/90">{success}</p>}
    </>
  )

  // ── Sections ──────────────────────────────────────────────────────────────

  const renderMain = () => (
    <div className="flex flex-col gap-5">

      {/* Security */}
      <div className="flex flex-col gap-2">
        <p className="font-mono text-[9px] tracking-[0.4em] text-muted-foreground/50 uppercase">
          {t.sectionSecurity}
        </p>
        <ActionRow icon={<LockIcon />} label={t.changePasswordBtn}
          onClick={() => { clear(); setPw(''); setPw2(''); setSection('password') }} />
      </div>

      {/* Session */}
      <div className="flex flex-col gap-2">
        <p className="font-mono text-[9px] tracking-[0.4em] text-muted-foreground/50 uppercase">
          {t.sectionSession}
        </p>
        <ActionRow icon={<LogoutIcon />} label={t.logoutBtn} onClick={onSignOut} />
      </div>

      {/* Danger */}
      <div className="flex flex-col gap-2">
        <p className="font-mono text-[9px] tracking-[0.4em] text-destructive/55 uppercase">
          {t.sectionDanger}
        </p>
        <ActionRow icon={<TrashIcon />} label={t.deleteAccountBtn} variant="danger"
          onClick={() => { clear(); setSection('delete') }} />
      </div>
    </div>
  )

  const renderPassword = () => (
    <form onSubmit={handleChangePassword} className="flex flex-col gap-4" noValidate>
      <Field id="pw-c" label={t.newPasswordLabel} type={showPw ? 'text' : 'password'}
        value={pw} onChange={setPw} autoComplete="new-password" disabled={loading} action={showHideBtn} />
      <Field id="pw2-c" label={t.confirmPasswordLabel} type={showPw ? 'text' : 'password'}
        value={pw2} onChange={setPw2} autoComplete="new-password" disabled={loading} />
      <button type="submit" disabled={loading}
        className="btn-shine w-full h-10 bg-primary text-primary-foreground
                   font-display text-base tracking-[0.12em] uppercase
                   hover:bg-primary/90 active:scale-[0.98] transition-all duration-150
                   disabled:opacity-40 shadow-[0_4px_16px_hsl(var(--primary)/0.2)]">
        {loading ? '…' : t.saveBtn}
      </button>
      {feedback}
      <button type="button" onClick={() => { clear(); setSection('main') }}
        className="font-mono text-[11px] text-muted-foreground/60 hover:text-muted-foreground transition-colors tracking-wide">
        {t.cancelBtn}
      </button>
    </form>
  )

  const renderDelete = () => (
    <div className="flex flex-col gap-5">
      {/* Warning card */}
      <div className="border border-destructive/30 bg-destructive/[0.05] px-4 py-4 flex flex-col gap-3">
        <div className="flex items-center gap-2 text-destructive/80">
          <WarnIcon />
          <span className="font-display text-sm tracking-wide uppercase">{t.deleteAccountBtn}</span>
        </div>
        <p className="font-mono text-[11px] text-muted-foreground/70 leading-relaxed">
          {t.deleteWarning}
        </p>
      </div>

      {feedback}

      <button type="button" onClick={handleDeleteAccount} disabled={loading}
        className={cn(
          'w-full h-10 border border-destructive/50 font-display text-sm tracking-[0.1em] uppercase',
          'text-destructive hover:bg-destructive hover:text-destructive-foreground',
          'active:scale-[0.98] transition-all duration-150 disabled:opacity-40',
        )}>
        {loading ? '…' : t.deleteConfirmBtn}
      </button>

      <button type="button" onClick={() => { clear(); setSection('main') }}
        className="font-mono text-[11px] text-muted-foreground/60 hover:text-muted-foreground transition-colors tracking-wide">
        {t.cancelBtn}
      </button>
    </div>
  )

  // ── Section titles ────────────────────────────────────────────────────────

  const SUBTITLES = {
    main: null,
    password: t.changePasswordBtn,
    delete: t.deleteAccountBtn,
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-end"
      role="dialog" aria-modal="true" aria-label={t.settingsTitle}>

      {/* Backdrop */}
      <div className="absolute inset-0 bg-background/70 backdrop-blur-sm"
        onClick={onClose} aria-hidden="true" />

      {/* Panel */}
      <section className="relative z-10 h-full w-[290px] flex flex-col animate-slide-in-right"
        style={{ background: 'linear-gradient(180deg, hsl(220,16%,11%) 0%, hsl(220,14%,9%) 100%)' }}>

        {/* Top amber line */}
        <div className="absolute top-0 left-0 right-0 h-[1.5px]
                        bg-gradient-to-r from-transparent via-primary/60 to-transparent"
          aria-hidden="true" />

        {/* Panel header */}
        <div className="h-[48px] shrink-0 flex items-center justify-between px-5
                        border-b border-border/60"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          <span className="font-mono text-[10px] tracking-[0.4em] uppercase text-muted-foreground/55">
            {strings.app.title}
          </span>
          <button type="button" onClick={onClose}
            className="text-muted-foreground/50 hover:text-foreground transition-colors p-1"
            aria-label={strings.app.closeLabel}>
            <CloseIcon />
          </button>
        </div>

        {/* User card */}
        <div className="px-5 py-5 border-b border-border/40"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          <div className="flex items-center gap-3">
            {/* Avatar */}
            <div className="w-11 h-11 rounded-full shrink-0 flex items-center justify-center
                            bg-primary/20 border-2 border-primary/40
                            shadow-[0_0_16px_hsl(var(--primary)/0.15)]">
              <span className="font-display text-[22px] leading-none text-primary uppercase">
                {email.charAt(0)}
              </span>
            </div>
            {/* Info */}
            <div className="min-w-0">
              <p className="font-mono text-[11px] text-foreground/85 truncate" title={email}>
                {email}
              </p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-success/70" aria-hidden="true" />
                <span className="font-mono text-[9px] text-muted-foreground/55 tracking-widest uppercase">
                  conta ativa
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-6"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>

          {/* Sub-section title when not on main */}
          {section !== 'main' && (
            <div className="flex items-center gap-2 mb-5">
              <button type="button" onClick={() => { clear(); setSection('main') }}
                className="font-mono text-[10px] text-muted-foreground/55 hover:text-muted-foreground
                           transition-colors tracking-wide">
                ←
              </button>
              <span className="font-display text-[22px] leading-none text-foreground uppercase">
                {SUBTITLES[section]}
              </span>
            </div>
          )}

          {section === 'main'     && renderMain()}
          {section === 'password' && renderPassword()}
          {section === 'delete'   && renderDelete()}
        </div>

        {/* Version footer */}
        <div className="shrink-0 px-5 py-3 border-t border-border/30 flex items-center justify-between"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          <span className="font-mono text-[9px] text-muted-foreground/40 tracking-widest uppercase">
            CutPilot Sync
          </span>
          <span className="font-mono text-[9px] text-muted-foreground/40 tracking-widest">
            v{__APP_VERSION__}
          </span>
        </div>

      </section>
    </div>
  )
}
