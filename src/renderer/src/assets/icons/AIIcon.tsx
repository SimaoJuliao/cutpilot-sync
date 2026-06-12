import type { IconProps } from '@/types'

/** AI / processing sun-burst. */
export const AIIcon = ({ size = 22, className }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden="true" className={className}>
    <path d="M10 2v2M10 16v2M2 10h2M16 10h2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    <circle cx="10" cy="10" r="4.5" stroke="currentColor" strokeWidth="1.3" />
    <circle cx="10" cy="10" r="1.5" fill="currentColor" />
    <path d="M6.5 6.5l1.2 1.2M12.3 12.3l1.2 1.2M13.5 6.5l-1.2 1.2M7.7 12.3l-1.2 1.2"
      stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
  </svg>
)
