import type { IconProps } from '@/types'

/** Circled checkmark. */
export const CheckIcon = ({ size = 20, className }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden="true" className={className}>
    <circle cx="10" cy="10" r="9" stroke="currentColor" strokeWidth="1.4" />
    <path d="M6 10l3 3 5-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)
