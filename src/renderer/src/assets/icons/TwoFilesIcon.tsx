import type { IconProps } from '@/types'

/** Two overlapping frames — "two separate files" output mode. */
export const TwoFilesIcon = ({ size = 22, className }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
    <rect x="3" y="6" width="13" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
    <rect x="8" y="9" width="13" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.5" fill="var(--card)" />
  </svg>
)
