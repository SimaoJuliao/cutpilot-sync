import type { IconProps } from '@/types'

/** Webcam / camera. */
export const CamIcon = ({ size = 24, className }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
    <rect x="2" y="7" width="14" height="11" rx="2" stroke="currentColor" strokeWidth="1.5" />
    <path d="M16 10.5l6-4v11l-6-4" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    <circle cx="9" cy="12.5" r="2.5" stroke="currentColor" strokeWidth="1.2" />
  </svg>
)
