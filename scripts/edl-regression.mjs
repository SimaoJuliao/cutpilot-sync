/**
 * edl-regression.mjs
 * Regression harness for the deterministic EDL layer (refineEdl + retake detection).
 *
 * Runs the EDL-stage pipeline over every cached transcript with a keep-everything
 * EDL (so ALL retake chains are active) and snapshots what the deterministic layer
 * decides to keep: retake chains, keepers, and the final kept text per range.
 *
 *   npm run edl:save    — snapshot current behaviour as the baseline
 *   npm run edl:check   — re-run and diff against the baseline (exit 1 on any change)
 *
 * Workflow: `edl:save` BEFORE touching detection code, `edl:check` after — any
 * changed line shows exactly which video/sentence gained or lost content. This
 * protects the golden rule: a fix for one video must never lose good content in
 * another.
 *
 * Baselines live in .edl-baselines/ (gitignored — transcripts are private content;
 * they must never land in the public repo). Uses the app's transcription cache, so
 * it covers every video transcribed in the last 30 days.
 */

import { build } from 'esbuild'
import { readdirSync, readFileSync, writeFileSync, mkdirSync, unlinkSync, existsSync, mkdtempSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { tmpdir, homedir } from 'node:os'
import { pathToFileURL, fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const BASELINE_DIR = join(ROOT, '.edl-baselines')

// ── CLI ───────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2)
const mode = args.find(a => !a.startsWith('--'))
const cacheDirArg = args.find(a => a.startsWith('--cache-dir='))?.slice('--cache-dir='.length)

if (mode !== 'save' && mode !== 'check') {
  console.log('Usage: node scripts/edl-regression.mjs <save|check> [--cache-dir=path]')
  process.exit(2)
}

// Same location as transcriptionCache.ts (app.getPath('userData')/cache/transcriptions)
const defaultCacheDir = () => {
  if (process.platform === 'win32') return join(process.env.APPDATA ?? join(homedir(), 'AppData', 'Roaming'), 'CutPilotSync', 'cache', 'transcriptions')
  if (process.platform === 'darwin') return join(homedir(), 'Library', 'Application Support', 'CutPilotSync', 'cache', 'transcriptions')
  return join(homedir(), '.config', 'CutPilotSync', 'cache', 'transcriptions')
}
const CACHE_DIR = cacheDirArg ? resolve(cacheDirArg) : defaultCacheDir()

if (!existsSync(CACHE_DIR)) {
  console.error(`[edl-regress] transcription cache not found: ${CACHE_DIR}`)
  console.error('[edl-regress] transcribe at least one video in the app first, or pass --cache-dir=')
  process.exit(2)
}

// ── Bundle the pipeline (pure TS, no electron at runtime) ─────────────────────

const loadPipeline = async () => {
  const outfile = join(mkdtempSync(join(tmpdir(), 'edl-regress-')), 'pipeline.mjs')
  await build({
    stdin: {
      contents: `
        export { refineEdl } from './src/main/pipeline/refineEdl.ts'
        export { detectRetakeChainSpans } from './src/main/pipeline/retakeDetection.ts'
      `,
      resolveDir: ROOT,
      loader: 'ts',
    },
    bundle: true,
    format: 'esm',
    platform: 'node',
    outfile,
    logLevel: 'silent',
  })
  return import(pathToFileURL(outfile).href)
}

// ── Snapshot one transcript ───────────────────────────────────────────────────

const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${(s % 60).toFixed(2).padStart(5, '0')}`

const textIn = (words, start, end) =>
  words.filter(w => w.end > start && w.start < end).map(w => w.text).join(' ')

const snapshot = (pipeline, transcript) => {
  const words = transcript.words.filter(w => w.type === 'word').sort((a, b) => a.start - b.start)
  if (words.length === 0) return null

  // Keep-everything EDL: every retake chain counts as "touched by Claude", so the
  // whole deterministic layer (cuts, keepers, keep-clips, snapping, trims) runs.
  const keepAll = [{ start: 0, end: words[words.length - 1].end + 1 }]

  // refineEdl logs its summary — silence it so snapshots drive the output.
  const realLog = console.log
  console.log = () => {}
  let chains, refined
  try {
    chains = pipeline.detectRetakeChainSpans(transcript)
    refined = pipeline.refineEdl(keepAll, transcript)
  } finally {
    console.log = realLog
  }

  const lines = []
  lines.push(`# words: ${words.length} | preview: "${words.slice(0, 10).map(w => w.text).join(' ')}"`)
  lines.push('')
  lines.push(`## retake chains: ${chains.length}`)
  for (const ch of chains) {
    const keeper = ch.keeper
      ? `keeper ${fmt(ch.keeper.start)}-${fmt(ch.keeper.end)} | "${textIn(words, ch.keeper.start, ch.keeper.end).split(' ').slice(0, 20).join(' ')}"`
      : 'keeper none'
    lines.push(`- topic ${fmt(ch.topic.start)}-${fmt(ch.topic.end)} | cuts ${ch.cuts.length} | ${keeper}`)
  }
  lines.push('')
  const total = refined.reduce((s, r) => s + (r.end - r.start), 0)
  lines.push(`## kept ranges: ${refined.length} | ${total.toFixed(1)}s`)
  for (const r of refined) {
    lines.push(`[${fmt(r.start)}-${fmt(r.end)}] ${textIn(words, r.start, r.end)}`)
  }
  return lines.join('\n') + '\n'
}

// ── Minimal LCS line diff ─────────────────────────────────────────────────────

const diffLines = (a, b) => {
  const A = a.split('\n'), B = b.split('\n')
  const n = A.length, m = B.length
  const lcs = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1))
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      lcs[i][j] = A[i] === B[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1])

  const out = []
  let i = 0, j = 0
  while (i < n || j < m) {
    if (i < n && j < m && A[i] === B[j]) { i++; j++ }
    else if (j < m && (i >= n || lcs[i][j + 1] >= lcs[i + 1][j])) out.push(`    + ${B[j++]}`)
    else out.push(`    - ${A[i++]}`)
  }
  return out
}

// ── Main ──────────────────────────────────────────────────────────────────────

const pipeline = await loadPipeline()

const cacheKeys = readdirSync(CACHE_DIR).filter(f => f.endsWith('.json')).map(f => f.slice(0, -5)).sort()
console.log(`[edl-regress] cache: ${CACHE_DIR} (${cacheKeys.length} transcripts)`)
console.log(`[edl-regress] baselines: ${BASELINE_DIR}\n`)

mkdirSync(BASELINE_DIR, { recursive: true })
const baselineKeys = readdirSync(BASELINE_DIR).filter(f => f.endsWith('.txt')).map(f => f.slice(0, -4))

const snapshots = new Map()
for (const key of cacheKeys) {
  try {
    const { transcript } = JSON.parse(readFileSync(join(CACHE_DIR, `${key}.json`), 'utf-8'))
    const snap = snapshot(pipeline, transcript)
    if (snap) snapshots.set(key, snap)
    else console.log(`  EMPTY    ${key}  (transcript sem palavras — ignorado)`)
  } catch (e) {
    console.log(`  ERROR    ${key}  (${e instanceof Error ? e.message : e})`)
  }
}

if (mode === 'save') {
  for (const [key, snap] of snapshots) {
    writeFileSync(join(BASELINE_DIR, `${key}.txt`), snap, 'utf-8')
    console.log(`  SAVED    ${key}  ${snap.match(/preview: "([^"]*)"/)?.[1] ?? ''}`)
  }
  // Drop baselines whose cache entry is gone (evicted/re-transcribed) — save
  // means "sync baselines to the current cache state".
  for (const key of baselineKeys.filter(k => !snapshots.has(k))) {
    unlinkSync(join(BASELINE_DIR, `${key}.txt`))
    console.log(`  REMOVED  ${key}  (transcript já não está em cache)`)
  }
  console.log(`\n[edl-regress] ${snapshots.size} baselines saved`)
} else {
  let changed = 0, ok = 0, fresh = 0
  for (const [key, snap] of snapshots) {
    const preview = snap.match(/preview: "([^"]*)"/)?.[1] ?? ''
    const baselinePath = join(BASELINE_DIR, `${key}.txt`)
    if (!existsSync(baselinePath)) { fresh++; console.log(`  NEW      ${key}  ${preview}  (sem baseline — corre npm run edl:save)`); continue }
    const baseline = readFileSync(baselinePath, 'utf-8')
    if (baseline === snap) { ok++; console.log(`  OK       ${key}  ${preview}`) }
    else {
      changed++
      console.log(`  CHANGED  ${key}  ${preview}`)
      console.log(diffLines(baseline, snap).join('\n'))
    }
  }
  for (const key of baselineKeys.filter(k => !snapshots.has(k)))
    console.log(`  STALE    ${key}  (baseline sem transcript em cache — ignorado)`)

  console.log(`\n[edl-regress] ${ok} OK, ${changed} CHANGED, ${fresh} NEW`)
  if (changed > 0) {
    console.log('[edl-regress] REGRESSION? Revê o diff acima — se a mudança for intencional, corre npm run edl:save')
    process.exitCode = 1
  }
}
