import type { IconProps } from '@/types'

/** One frame with an inset tile — "single video, webcam overlaid" output mode. */
export const PipModeIcon = ({ size = 22, className }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
    <rect x="3" y="5" width="18" height="14" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
    <rect x="13" y="12" width="6" height="5" rx="1" fill="currentColor" />
  </svg>
)
