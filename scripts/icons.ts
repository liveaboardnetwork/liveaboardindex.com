// Generates the favicon set, web manifest and social card into public/ from src/brand.ts.
// Output is committed; rerun after changing the mark or site name: npm run icons
import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { Resvg } from '@resvg/resvg-js'
import { BRAND_COLORS, markSvg } from '../src/brand.ts'
import { site } from '../src/site.ts'
import { root } from './data.ts'

const pub = path.join(root, 'public')
const fontDir = path.join(root, 'scripts/.cache/fonts')
const FONTS = {
  'Newsreader.ttf': 'https://github.com/google/fonts/raw/main/ofl/newsreader/Newsreader%5Bopsz,wght%5D.ttf',
  'Inter.ttf': 'https://github.com/google/fonts/raw/main/ofl/inter/Inter%5Bopsz,wght%5D.ttf',
} as const

const onInk = { tile: BRAND_COLORS.ink, boat: BRAND_COLORS.cream }

function png(svg: string, width: number): Buffer {
  const fontFiles = Object.keys(FONTS).map((f) => path.join(fontDir, f))
  return new Resvg(svg, { fitTo: { mode: 'width', value: width }, font: { fontFiles, loadSystemFonts: false } }).render().asPng()
}

// ICO container with embedded PNGs (supported by every browser since IE Vista era).
function ico(images: Array<{ size: number; data: Buffer }>): Buffer {
  const header = Buffer.alloc(6 + 16 * images.length)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(images.length, 4)
  let offset = header.length
  images.forEach(({ size, data }, i) => {
    const e = 6 + 16 * i
    header.writeUInt8(size >= 256 ? 0 : size, e)
    header.writeUInt8(size >= 256 ? 0 : size, e + 1)
    header.writeUInt16LE(1, e + 4)
    header.writeUInt16LE(32, e + 6)
    header.writeUInt32LE(data.length, e + 8)
    header.writeUInt32LE(offset, e + 12)
    offset += data.length
  })
  return Buffer.concat([header, ...images.map((i) => i.data)])
}

function escXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function socialCard(): string {
  const mark = markSvg({ colors: onInk }).replace('<svg ', '<svg x="96" y="96" width="72" height="72" ')
  const { ink, cream, muted } = BRAND_COLORS
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="${cream}"/>
  ${mark}
  <text x="188" y="145" xml:space="preserve" font-family="Inter" font-size="34" font-weight="600" letter-spacing="-1.4" fill="${ink}">liveaboard<tspan font-weight="400" fill="${muted}"> index</tspan></text>
  <text x="92" y="380" font-family="Newsreader" font-size="88" font-weight="300" letter-spacing="-2.5" fill="${ink}">${escXml(site.tagline.lead)}</text>
  <text x="96" y="460" font-family="Inter" font-size="34" fill="${muted}">${escXml(site.tagline.rest)}</text>
  <text x="96" y="550" font-family="Inter" font-size="26" font-weight="500" fill="${ink}">${new URL(site.url).host}</text>
</svg>`
}

await mkdir(fontDir, { recursive: true })
for (const [file, url] of Object.entries(FONTS)) {
  const target = path.join(fontDir, file)
  if (existsSync(target)) continue
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`)
  await writeFile(target, Buffer.from(await res.arrayBuffer()))
}

const favicon = markSvg({ colors: onInk })
const maskable = markSvg({ colors: onInk, radius: 0, scale: 0.8 })
const files: Record<string, string | Buffer> = {
  'favicon.svg': `${favicon}\n`,
  'favicon.ico': ico([16, 32, 48].map((size) => ({ size, data: png(favicon, size) }))),
  'apple-touch-icon.png': png(markSvg({ colors: onInk, radius: 0 }), 180),
  'icon-192.png': png(favicon, 192),
  'icon-512.png': png(favicon, 512),
  'icon-maskable-512.png': png(maskable, 512),
  'og.png': png(socialCard(), 1200),
  'site.webmanifest': `${JSON.stringify(
    {
      name: site.name,
      short_name: site.name,
      description: site.description,
      start_url: '/',
      display: 'browser',
      background_color: BRAND_COLORS.cream,
      theme_color: BRAND_COLORS.cream,
      icons: [
        { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
        { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    null,
    2,
  )}\n`,
}
for (const [file, body] of Object.entries(files)) await writeFile(path.join(pub, file), body)
console.log(`Wrote ${Object.keys(files).join(', ')} to public/`)
