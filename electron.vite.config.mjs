import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { config } from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const env = config({ path: resolve(__dirname, '.env') }).parsed ?? {}

export default defineConfig({
  main: {
    entry: 'src/main/index.ts',
    plugins: [externalizeDepsPlugin()],
    define: {
      __GROQ_API_KEY__: JSON.stringify(env.GROQ_API_KEY ?? ''),
      __DEEPGRAM_API_KEY__: JSON.stringify(env.DEEPGRAM_API_KEY ?? ''),
      __ANTHROPIC_API_KEY__: JSON.stringify(env.ANTHROPIC_API_KEY ?? ''),
      __SUPABASE_URL__: JSON.stringify(env.SUPABASE_URL ?? ''),
      __SUPABASE_SERVICE_ROLE_KEY__: JSON.stringify(env.SUPABASE_SERVICE_ROLE_KEY ?? ''),
    },
  },
  preload: {
    entry: 'src/preload/index.ts',
    plugins: [externalizeDepsPlugin()],
  },
  renderer: {
    plugins: [react()],
    define: {
      __SUPABASE_URL__: JSON.stringify(env.SUPABASE_URL ?? ''),
      __SUPABASE_ANON_KEY__: JSON.stringify(env.SUPABASE_ANON_KEY ?? ''),
    },
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src/renderer/src'),
        '@components': resolve(__dirname, 'src/renderer/src/components'),
        '@hooks': resolve(__dirname, 'src/renderer/src/hooks'),
        '@lib': resolve(__dirname, 'src/renderer/src/lib'),
        '@i18n': resolve(__dirname, 'src/renderer/src/i18n'),
      },
    },
  },
})
