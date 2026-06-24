import type { IconProps } from '@/types'

interface ChevronIconProps extends IconProps {
  /** Which way the chevron points. Default "down" (rotate via className). */
  direction?: 'down' | 'right'
}

/** Chevron — points down by default, or right when `direction="right"`. */
export const ChevronIcon = ({ size, className, direction = 'down' }: ChevronIconProps) => {
  const px = size ?? (direction === 'right' ? 10 : 12)

  return direction === 'right' ? (
    <svg width={px} height={px} viewBox="0 0 10 10" fill="none" aria-hidden="true" className={className}>
      <path d="M3 2l4 3-4 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ) : (
    <svg width={px} height={px} viewBox="0 0 16 16" fill="none" aria-hidden="true" className={className}>
      <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
