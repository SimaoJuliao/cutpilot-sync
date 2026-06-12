import type { IconProps } from '@/types'

/** Warning triangle. */
export const WarnIcon = ({ size = 14, className }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden="true" className={className}>
    <path d="M10 3L18.5 17.5H1.5L10 3Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    <line x1="10" y1="9" x2="10" y2="13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <circle cx="10" cy="15.5" r="0.75" fill="currentColor" />
  </svg>
)
