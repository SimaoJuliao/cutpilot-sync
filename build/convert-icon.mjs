/**
 * convert-icon.mjs
 * Gera icon.png (Linux), icon.ico (Windows) e icon.icns (macOS)
 * a partir do icon.svg — sem precisar de sites externos.
 *
 * Uso: node build/convert-icon.mjs
 */

import { readFileSync, writeFileSync } from 'fs'
import { execSync }                    from 'child_process'
import { fileURLToPath }               from 'url'
import { dirname, join }               from 'path'

const __dir = dirname(fileURLToPath(import.meta.url))
const root  = join(__dir, '..')
const svg   = join(__dir, 'icon.svg')
const png   = join(__dir, 'icon.png')

const install = (pkg) => {
  console.log(`  a instalar ${pkg}...`)
  execSync(`npm install ${pkg} --save-dev`, { stdio: 'inherit', cwd: root })
}

const tryImport = async (pkg, name = pkg) => {
  try { return await import(name) }
  catch { install(pkg); return await import(name) }
}

// ── 1. SVG → PNG 1024×1024 ───────────────────────────────────────────────────

console.log('\n① SVG → PNG 1024×1024')
const { default: sharp } = await tryImport('sharp')
await sharp(readFileSync(svg)).resize(1024, 1024).png().toFile(png)
console.log('  ✓ build/icon.png')

// ── 2. PNG → ICO (Windows) ───────────────────────────────────────────────────

console.log('\n② PNG → ICO (Windows)')
const { default: pngToIco } = await tryImport('png-to-ico')
const icoBuffer = await pngToIco([png])
writeFileSync(join(__dir, 'icon.ico'), icoBuffer)
console.log('  ✓ build/icon.ico')

// ── 3. PNG → ICNS (macOS) ────────────────────────────────────────────────────
// Usa png2icons directamente (sem electron-icon-maker que tem um bug de timer).

console.log('\n③ PNG → ICNS (macOS)')
const png2icons = await tryImport('png2icons')
const lib = png2icons.default ?? png2icons

const pngBuffer = readFileSync(png)
const icnsBuffer = lib.createICNS(pngBuffer, lib.BILINEAR, 0)
if (icnsBuffer) {
  writeFileSync(join(__dir, 'icon.icns'), icnsBuffer)
  console.log('  ✓ build/icon.icns')
} else {
  console.warn('  ⚠ Falhou a gerar icon.icns')
}

// ── Resumo ────────────────────────────────────────────────────────────────────

console.log('\n─────────────────────────────────')
console.log('Icons gerados em build/:')
console.log('  icon.png   ← Linux')
console.log('  icon.ico   ← Windows')
console.log('  icon.icns  ← macOS')
console.log('─────────────────────────────────\n')
