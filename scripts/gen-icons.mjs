// Rasterize public/icon.svg into the PNG sizes used for the home-screen / PWA
// install icons. Run with: node scripts/gen-icons.mjs
import sharp from 'sharp'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const svg = readFileSync(join(root, 'public', 'icon.svg'))

const targets = [
  { size: 180, file: 'apple-touch-icon.png' }, // iOS home screen
  { size: 192, file: 'icon-192.png' },          // PWA / Android
  { size: 512, file: 'icon-512.png' },          // PWA / Android
]

for (const t of targets) {
  await sharp(svg, { density: 384 })
    .resize(t.size, t.size)
    .png()
    .toFile(join(root, 'public', t.file))
  console.log(`wrote public/${t.file} (${t.size}x${t.size})`)
}
