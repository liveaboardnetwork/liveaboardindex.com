// Discovers liveaboard.com boat pages from their sitemap, fetches them politely (cached on disk)
// and writes the parsed boats to tools/out/liveaboard/boats.json.
//
//   npm run tools:liveaboard -- --region galapagos
//   npm run tools:liveaboard -- --limit 50 --delay 2000
//   npm run tools:liveaboard -- --offline          # reparse the cache, no network
import { existsSync } from 'node:fs'
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { parseArgs } from 'node:util'
import { parseBoatPage } from './parse.ts'
import type { LiveaboardBoat } from './parse.ts'

const BASE = 'https://www.liveaboard.com'
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36'
const toolsDir = path.resolve(import.meta.dirname, '..')
const cacheDir = path.join(toolsDir, '.cache/liveaboard')
const outDir = path.join(toolsDir, 'out/liveaboard')

const { values: args } = parseArgs({
  options: {
    region: { type: 'string' },
    limit: { type: 'string' },
    delay: { type: 'string', default: '1500' },
    offline: { type: 'boolean', default: false },
  },
})
const delay = Number(args.delay)
const limit = args.limit ? Number(args.limit) : Infinity

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function cacheFile(url: string): string {
  return path.join(cacheDir, new URL(url).pathname.replace(/^\/+/, '').replace(/\//g, '__') + '.html')
}

let lastFetch = 0
async function get(url: string): Promise<string> {
  const file = cacheFile(url)
  if (existsSync(file)) return readFile(file, 'utf8')
  if (args.offline) throw new Error(`not cached: ${url}`)
  const wait = lastFetch + delay - Date.now()
  if (wait > 0) await sleep(wait)
  lastFetch = Date.now()
  const res = await fetch(url, { headers: { 'user-agent': UA, accept: 'text/html,application/xml' } })
  if (!res.ok) throw new Error(`${res.status} ${url}`)
  const body = await res.text()
  await mkdir(path.dirname(file), { recursive: true })
  await writeFile(file, body)
  return body
}

// English diving pages shaped /diving/<region>/<slug>. These include dive sites and ports too;
// only pages with a Product JSON-LD are boats.
async function candidateUrls(): Promise<string[]> {
  if (args.offline) {
    const files = await readdir(cacheDir).catch(() => [])
    return files.filter((f) => f.startsWith('diving__')).map((f) => `${BASE}/${f.replace(/\.html$/, '').replace(/__/g, '/')}`)
  }
  const xml = await get(`${BASE}/sitemap.xml`)
  return [...xml.matchAll(/<loc>(https:\/\/www\.liveaboard\.com\/diving\/[a-z0-9-]+\/[a-z0-9-]+)<\/loc>/g)].map((m) => m[1] ?? '')
}

// Sections that share the /diving/<x>/<slug> shape but never hold boat pages.
const NOT_DESTINATIONS = new Set(['find', 'fleet', 'article', 'articles', 'season-calendar', 'scuba', 'marine-life', 'profile', 'equipment', 'underwater-photography'])

const all = await candidateUrls()
const urls = all
  .filter((u) => !args.region || u.startsWith(`${BASE}/diving/${args.region}/`))
  .filter((u) => !NOT_DESTINATIONS.has(new URL(u).pathname.split('/')[2] ?? ''))
console.log(`${urls.length} candidate pages${args.region ? ` in ${args.region}` : ''}`)

const boats: LiveaboardBoat[] = []
let skipped = 0
for (const url of urls) {
  if (boats.length >= limit) break
  try {
    const boat = parseBoatPage(url, await get(url))
    if (boat) {
      boats.push(boat)
      console.log(`  boat  ${boat.name} (${boat.operator ?? '?'})`)
    } else skipped++
  } catch (error) {
    console.warn(`  error ${url}: ${(error as Error).message}`)
  }
}

await mkdir(outDir, { recursive: true })
const outFile = path.join(outDir, args.region ? `boats-${args.region}.json` : 'boats.json')
await writeFile(outFile, JSON.stringify(boats, null, 2) + '\n')
console.log(`${boats.length} boats, ${skipped} non-boat pages skipped → ${path.relative(toolsDir, outFile)}`)
