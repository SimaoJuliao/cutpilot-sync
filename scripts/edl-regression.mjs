/**
 * edl-regression.mjs
 * Regression harness for the deterministic EDL layer (refineEdl + retake detection).
 *
 * Runs the EDL-stage pipeline over every corpus transcript with a keep-everything
 * EDL (so ALL retake chains are active) and snapshots what the deterministic layer
 * decides to keep: retake chains, keepers, and the final kept text per range.
 *
 *   npm run edl:add -- --as=144   — copy the newest app-cache transcript into the corpus
 *   npm run edl:save              — snapshot current behaviour as the baseline
 *   npm run edl:check             — re-run and diff the baseline (exit 1 on any change)
 *
 * Workflow: `edl:save` BEFORE touching detection code, `edl:check` after — any
 * changed line shows exactly which video/sentence gained or lost content. This
 * protects the golden rule: a fix for one video must never lose good content in
 * another.
 *
 * The corpus (.edl-corpus/) is the reason this is trustworthy. The app's own
 * transcription cache re-keys entries whenever a video is re-transcribed or the
 * params version is bumped, so a harness reading it silently loses coverage — it
 * once dropped from 6 videos to 1 between runs, and baselines for the missing
 * ones went with them. `edl:add` copies transcripts into the corpus, where they
 * stay until deliberately deleted.
 *
 * Corpus and baselines are gitignored: transcripts are private content and must
 * never land in the public repo.
 */

import { build } from 'esbuild'
import { readdirSync, readFileSync, writeFileSync, mkdirSync, unlinkSync, existsSync, mkdtempSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { pathToFileURL } from 'node:url'
import { ROOT, BASELINE_DIR, CORPUS_DIR, defaultCacheDir, jsonFilesByNewest } from './lib/paths.mjs'

// ── CLI ───────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2)
const mode = args.find(a => !a.startsWith('--'))
const cacheDirArg = args.find(a => a.startsWith('--cache-dir='))?.slice('--cache-dir='.length)
const asArg = args.find(a => a.startsWith('--as='))?.slice('--as='.length)

if (!['add', 'save', 'check'].includes(mode)) {
  console.log('Usage: node scripts/edl-regression.mjs <add|save|check> [--as=label] [--cache-dir=path]')
  console.log('  add    copy transcripts from the app cache into .edl-corpus/')
  console.log('         --as=<label> takes the NEWEST cache entry and names it <label>')
  console.log('         (no --as imports every cache entry not already in the corpus)')
  console.log('  save   snapshot the corpus as the baseline')
  console.log('  check  re-run the corpus and diff against the baseline')
  process.exit(2)
}

if (asArg && !/^[\w.-]+$/.test(asArg)) {
  console.error(`[edl-regress] invalid --as label: ${asArg} (letters, digits, . _ - only)`)
  process.exit(2)
}

const CACHE_DIR = cacheDirArg ? resolve(cacheDirArg) : defaultCacheDir()

// ── add: import from the app cache into the corpus ────────────────────────────

const transcriptHash = (raw) => createHash('sha256').update(JSON.stringify(JSON.parse(raw).transcript)).digest('hex').slice(0, 16)

const previewOf = (raw) => {
  const words = JSON.parse(raw).transcript.words.filter(w => w.type === 'word')
  return words.slice(0, 9).map(w => w.text).join(' ')
}

if (mode === 'add') {
  if (!existsSync(CACHE_DIR)) {
    console.error(`[edl-regress] transcription cache not found: ${CACHE_DIR}`)
    console.error('[edl-regress] transcribe a video in the app first, or pass --cache-dir=')
    process.exit(2)
  }
  mkdirSync(CORPUS_DIR, { recursive: true })

  const cacheFiles = jsonFilesByNewest(CACHE_DIR)

  if (cacheFiles.length === 0) {
    console.error('[edl-regress] the app cache is empty — transcribe a video first')
    process.exit(2)
  }

  // Content hashes already in the corpus, so re-adding the same transcript is a no-op.
  const have = new Set(readdirSync(CORPUS_DIR).filter(f => f.endsWith('.json'))
    .map(f => transcriptHash(readFileSync(join(CORPUS_DIR, f), 'utf-8'))))

  const picked = asArg ? [cacheFiles[0]] : cacheFiles
  let added = 0
  for (const { file, path } of picked) {
    const raw = readFileSync(path, 'utf-8')
    const hash = transcriptHash(raw)
    if (have.has(hash)) { console.log(`  SKIP   ${file}  (já no corpus)`); continue }
    const name = asArg ?? file.slice(0, -5)
    writeFileSync(join(CORPUS_DIR, `${name}.json`), raw, 'utf-8')
    have.add(hash)
    added++
    console.log(`  ADDED  ${name}  "${previewOf(raw)}"`)
  }
  const total = readdirSync(CORPUS_DIR).filter(f => f.endsWith('.json')).length
  console.log(`\n[edl-regress] ${added} adicionado(s) — corpus tem agora ${total} transcript(s) em ${CORPUS_DIR}`)
  console.log('[edl-regress] corre `npm run edl:save` para gravar a baseline')
  process.exit(0)
}

// ── save / check read the corpus, never the volatile app cache ────────────────

if (!existsSync(CORPUS_DIR) || readdirSync(CORPUS_DIR).filter(f => f.endsWith('.json')).length === 0) {
  console.error(`[edl-regress] corpus vazio: ${CORPUS_DIR}`)
  console.error('[edl-regress] corre `npm run edl:add` para importar transcripts da cache da app')
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

const corpusKeys = readdirSync(CORPUS_DIR).filter(f => f.endsWith('.json')).map(f => f.slice(0, -5)).sort()
console.log(`[edl-regress] corpus: ${CORPUS_DIR} (${corpusKeys.length} transcripts)`)
console.log(`[edl-regress] baselines: ${BASELINE_DIR}\n`)

mkdirSync(BASELINE_DIR, { recursive: true })
const baselineKeys = readdirSync(BASELINE_DIR).filter(f => f.endsWith('.txt')).map(f => f.slice(0, -4))

const snapshots = new Map()
for (const key of corpusKeys) {
  try {
    const { transcript } = JSON.parse(readFileSync(join(CORPUS_DIR, `${key}.json`), 'utf-8'))
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
  // Drop baselines for transcripts deliberately removed from the corpus — save
  // means "sync baselines to the current corpus".
  for (const key of baselineKeys.filter(k => !snapshots.has(k))) {
    unlinkSync(join(BASELINE_DIR, `${key}.txt`))
    console.log(`  REMOVED  ${key}  (já não está no corpus)`)
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
    console.log(`  STALE    ${key}  (baseline sem transcript no corpus — ignorado)`)

  console.log(`\n[edl-regress] ${ok} OK, ${changed} CHANGED, ${fresh} NEW`)
  if (changed > 0) {
    console.log('[edl-regress] REGRESSION? Revê o diff acima — se a mudança for intencional, corre npm run edl:save')
    process.exitCode = 1
  }
}
