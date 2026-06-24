import type { IconProps } from '@/types'

/** Padlock. */
export const LockIcon = ({ size = 13, className }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true" className={className}>
    <rect x="3" y="7" width="10" height="8" rx="1" stroke="currentColor" strokeWidth="1.3" />
    <path d="M5 7V5a3 3 0 0 1 6 0v2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
  </svg>
)
