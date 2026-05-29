import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

// shadcn/ui class merger helper
export const cn = (...inputs: ClassValue[]): string => twMerge(clsx(inputs))

// Format seconds → MM:SS
export const fmtTime = (seconds: number): string => {
  const m   = Math.floor(seconds / 60)
  const sec = Math.round(seconds % 60)
  return `${m}:${String(sec).padStart(2, '0')}`
}

// Browser-safe dirname (no Node path module in renderer)
export const dirname = (fullPath: string): string => {
  if (!fullPath) return ''
  return fullPath.replace(/[/\\][^/\\]+$/, '')
}

// Extract filename from full path
export const basename = (fullPath: string): string =>
  fullPath.split(/[\\/]/).pop() ?? fullPath
