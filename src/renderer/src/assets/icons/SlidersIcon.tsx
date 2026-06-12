import type { IconProps } from '@/types'

/** Sliders — "advanced" toggle. */
export const SlidersIcon = ({ size = 13, className }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden="true" className={className}>
    <path d="M3 6h9M15 6h2M3 14h2M8 14h9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <circle cx="13" cy="6" r="2" stroke="currentColor" strokeWidth="1.5" />
    <circle cx="6" cy="14" r="2" stroke="currentColor" strokeWidth="1.5" />
  </svg>
)
