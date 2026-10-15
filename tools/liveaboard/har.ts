// Summarizes a liveaboard.com HAR export: first-party endpoints and the GA4 ecommerce items
// (their internal boat ID, name, operator and list) found in analytics hits.
//
//   npm run tools:har -- ~/Downloads/www.liveaboard.com.har
import { readFile } from 'node:fs/promises'

interface HarEntry {
  request: { method: string; url: string; postData?: { text?: string } }
  response: { status: number; content: { mimeType?: string; text?: string } }
}

const file = process.argv[2]
if (!file) {
  console.error('Usage: npm run tools:har -- <file.har>')
  process.exit(1)
}

const har = JSON.parse(await readFile(file, 'utf8')) as { log: { entries: HarEntry[] } }
const entries = har.log.entries

console.log('First-party requests:')
const seen = new Set<string>()
for (const e of entries) {
  const url = new URL(e.request.url)
  if (!url.hostname.endsWith('liveaboard.com')) continue
  const key = `${e.request.method} ${url.pathname}`
  if (seen.has(key)) continue
  seen.add(key)
  console.log(`  ${key}${url.search ? ` ${url.search}` : ''} → ${e.response.status} ${e.response.content.mimeType ?? ''}`)
}

// GA4 hits encode items as pr1=id5901~nmCalipso Dive~brCalipso Galapagos~...
const FIELDS: Record<string, string> = { id: 'id', nm: 'name', br: 'operator', pr: 'price', c3: 'region', ln: 'list' }
const items = new Map<string, Record<string, string>>()
for (const e of entries) {
  if (!e.request.url.includes('/g/collect')) continue
  const params = new URLSearchParams(new URL(e.request.url).search)
  for (const line of (e.request.postData?.text ?? '').split(/\r?\n/)) for (const [k, v] of new URLSearchParams(line)) params.set(k, v)
  for (const [key, value] of params) {
    if (!/^pr\d+$/.test(key)) continue
    const item: Record<string, string> = {}
    for (const part of value.split('~')) {
      const code = Object.keys(FIELDS).find((c) => part.startsWith(c))
      if (code) item[FIELDS[code] ?? code] = part.slice(code.length)
    }
    if (item['id']) items.set(item['id'], { ...items.get(item['id']), ...item })
  }
}

console.log(`\nBoats seen in analytics (${items.size}):`)
for (const item of items.values()) console.log(`  ${item['id']}  ${item['name']}  · ${item['operator'] ?? '?'}  · ${item['region'] ?? '?'}`)
