import type { IconProps } from '@/types'

/** Export / file with arrow. */
export const ExportIcon = ({ size = 22, className }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden="true" className={className}>
    <rect x="3" y="2.5" width="10" height="13" rx="1" stroke="currentColor" strokeWidth="1.3" />
    <path d="M8 5.5h4M8 8.5h4M8 11.5h2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    <path d="M13 13l4 4M15 13h2v2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)
