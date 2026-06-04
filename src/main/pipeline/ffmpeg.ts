import { app } from 'electron'

/**
 * Returns the absolute path to the bundled FFmpeg binary.
 *
 * In development: uses the path directly from node_modules/ffmpeg-static.
 * In production:  electron-builder unpacks the binary outside the asar archive
 *                 (via asarUnpack), so we replace "app.asar" with "app.asar.unpacked".
 *
 * Falls back to the string "ffmpeg" if the package is unavailable,
 * which means the system-installed binary will be used instead.
 */
export const getFFmpegPath = (): string => {
  // ffmpeg-static default export is the path to the binary (or null if unsupported platform)
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const bundled: string | null = require('ffmpeg-static')
  if (!bundled) return 'ffmpeg'

  if (app.isPackaged) {
    // Packaged app: binary lives in app.asar.unpacked, not inside the asar
    return bundled.replace('app.asar', 'app.asar.unpacked')
  }

  return bundled
}
