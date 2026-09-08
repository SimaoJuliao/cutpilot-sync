/**
 * show-transcript.mjs
 * Print a cached Deepgram transcript in readable form.
 *
 *   npm run transcript                 — the newest transcript in the app cache
 *   npm run transcript -- 144          — a named entry from .edl-corpus/
 *   npm run transcript -- --plain      — Deepgram's continuous text instead of phrase lines
 *   npm run transcript -- --find=nvid  — only phrases matching (case/accent-insensitive)
 *
 * Phrases are grouped exactly as the pipeline groups them (break on >=0.5s silence
 * or speaker change), so what you read here is what the editor model reads. Use it
 * to spot mangled proper nouns worth adding to keyterms.ts.
 */

import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { CORPUS_DIR, defaultCacheDir, jsonFilesByNewest } from './lib/paths.mjs'

const args = process.argv.slice(2)
const name = args.find(a => !a.startsWith('--'))
const plain = args.includes('--plain')
const find = args.find(a => a.startsWith('--find='))?.slice('--find='.length)

const CACHE_DIR = args.find(a => a.startsWith('--cache-dir='))?.slice('--cache-dir='.length) ?? defaultCacheDir()

// ── Resolve the source: a named corpus entry, else the newest cache entry ─────

let path, label
if (name) {
  path = join(CORPUS_DIR, `${name}.json`)
  label = `corpus/${name}`
  if (!existsSync(path)) {
    const have = existsSync(CORPUS_DIR) ? readdirSync(CORPUS_DIR).filter(f => f.endsWith('.json')).map(f => f.slice(0, -5)) : []
    console.error(`[transcript] "${name}" não está no corpus. Disponíveis: ${have.join(', ') || '(nenhum)'}`)
    process.exit(2)
  }
} else {
  if (!existsSync(CACHE_DIR)) { console.error(`[transcript] cache não encontrada: ${CACHE_DIR}`); process.exit(2) }
  const files = jsonFilesByNewest(CACHE_DIR)
  if (files.length === 0) { console.error('[transcript] a cache da app está vazia'); process.exit(2) }
  path = files[0].path
  label = `cache/${files[0].file.slice(0, -5)} (${new Date(files[0].mtime).toLocaleString()})`
}

const { transcript } = JSON.parse(readFileSync(path, 'utf-8'))
const words = transcript.words.filter(w => w.type === 'word')
if (words.length === 0) { console.error('[transcript] transcript sem palavras'); process.exit(2) }

const dur = words[words.length - 1].end
console.log(`${label}  |  ${words.length} palavras  |  ${Math.floor(dur / 60)}m${String(Math.round(dur % 60)).padStart(2, '0')}s  |  ${transcript.language}\n`)

if (plain) { console.log(transcript.text); process.exit(0) }

// Same grouping rule as groupPhrases in retakeDetection.ts
const phrases = []
let cur = []
for (const w of words) {
  if (cur.length === 0) { cur.push(w); continue }
  const prev = cur[cur.length - 1]
  const speakerChanged = w.speaker !== undefined && prev.speaker !== undefined && w.speaker !== prev.speaker
  if (w.start - prev.end >= 0.5 || speakerChanged) { phrases.push(cur); cur = [w] }
  else cur.push(w)
}
if (cur.length) phrases.push(cur)

const fmt = s => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`
const norm = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const needle = find ? norm(find) : null

let shown = 0
phrases.forEach((p, i) => {
  const text = p.map(w => w.text).join(' ')
  if (needle && !norm(text).includes(needle)) return
  shown++
  console.log(`[${String(i).padStart(3)}] ${fmt(p[0].start)}  S${p[0].speaker ?? '?'}  ${text}`)
})

if (needle) console.log(`\n${shown} frase(s) com "${find}" (de ${phrases.length})`)
