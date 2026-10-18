// VesselFinder client: name search, AIS (MMSI) pages and registry (IMO) pages, cached on disk.
// VesselFinder keeps two kinds of record: one per AIS transponder (9-digit MMSI) and one per
// registry entry (7-digit IMO). Small vessels often have both, unlinked; matching pairs them.
import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const BASE = 'https://www.vesselfinder.com'
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36'

export interface SearchRow {
  id: number
  kind: 'imo' | 'mmsi'
  name: string
  type: string
  /** Lowercase code from the flag icon; VesselFinder also uses pseudo-codes like `xa` (Azores). */
  flag: string | null
  built: number | null
  gt: number | null
  length_m: number | null
  beam_m: number | null
}

export interface SearchPage {
  total: number
  pages: number
  rows: SearchRow[]
}

export interface MmsiRecord {
  mmsi: number
  name: string
  call_sign: string | null
  ais_type: string | null
  length_m: number | null
  beam_m: number | null
  /** Last AIS position, rounded by VesselFinder to whole degrees. */
  position: { lat: number; lon: number } | null
}

export interface ImoRecord {
  imo: number
  name: string
  type: string | null
  built: number | null
  gt: number | null
  loa_m: number | null
  /** Only set when VesselFinder links the registry entry to a transponder. */
  mmsi: number | null
}

export class HttpError extends Error {
  readonly status: number
  readonly url: string
  constructor(status: number, url: string) {
    super(`${status} ${url}`)
    this.status = status
    this.url = url
  }
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", '#039': "'", nbsp: ' ' }
const decode = (s: string) => s.replace(/&(#?\w+);/g, (m, e: string) => ENTITIES[e] ?? m).trim()

/** "-", "" and "0" all mean unknown on VesselFinder. */
function number(s: string | undefined): number | null {
  const t = s?.trim()
  if (!t || t === '-') return null
  const n = Number(t.replace(/,/g, ''))
  return Number.isFinite(n) && n > 0 ? n : null
}

function text(s: string | undefined): string | null {
  const t = s === undefined ? '' : decode(s)
  return t === '' || t === '-' ? null : t
}

/** "34 / 6" or "34 / 6 m" → both dimensions; either side may be "-". */
function dimensions(s: string | undefined): { length_m: number | null; beam_m: number | null } {
  const [l, b] = (s ?? '').replace(/\s*m$/, '').split('/')
  return { length_m: number(l), beam_m: number(b) }
}

export function parseSearch(html: string): SearchPage {
  const flat = html.replace(/\s+/g, ' ')
  const total = Number(flat.match(/pagination-totals">\s*([\d,]+) ships?/)?.[1]?.replace(/,/g, '') ?? 0)
  const pages = Number(flat.match(/page \d+ \/ (\d+)/)?.[1] ?? (total > 0 ? 1 : 0))
  const rows: SearchRow[] = []
  for (const tr of flat.split('<tr>').slice(1)) {
    const id = tr.match(/href="\/vessels\/details\/(\d+)"/)?.[1]
    const name = tr.match(/class="slna">([^<]*)</)?.[1]
    if (!id || name === undefined) continue
    const cell = (n: number) => tr.match(new RegExp(`class="v${n}[^"]*">([^<]*)<`))?.[1]
    rows.push({
      id: Number(id),
      kind: id.length === 7 ? 'imo' : 'mmsi',
      name: decode(name),
      type: text(tr.match(/class="slty">([^<]*)</)?.[1]) ?? 'Unknown',
      flag: tr.match(/flags\/4x3\/([a-z]{2})\.svg/)?.[1] ?? null,
      built: number(cell(3)),
      gt: number(cell(4)),
      ...dimensions(cell(6)),
    })
  }
  return { total, pages, rows }
}

function dataJson(html: string): Record<string, unknown> {
  const raw = html.match(/data-json='([^']*)'/)?.[1]
  if (!raw) return {}
  try {
    return JSON.parse(decode(raw)) as Record<string, unknown>
  } catch {
    return {}
  }
}

const pageName = (html: string) => decode(html.match(/<title>([^<,]*)/)?.[1] ?? '')

export function parseMmsiPage(mmsi: number, html: string): MmsiRecord {
  const field = (label: string) => html.match(new RegExp(`<td class="n3">${label}</td><td class="v3[^"]*">([^<]*)<`))?.[1]
  const json = dataJson(html)
  const lat = typeof json['ship_lat'] === 'number' ? json['ship_lat'] : null
  const lon = typeof json['ship_lon'] === 'number' ? json['ship_lon'] : null
  return {
    mmsi,
    name: pageName(html),
    call_sign: text(field('Callsign'))?.toUpperCase() ?? null,
    ais_type: text(field('AIS Type')),
    ...dimensions(field('Length / Beam')),
    // 91/181 is VesselFinder's "no position" sentinel.
    position: lat !== null && lon !== null && Math.abs(lat) <= 90 && Math.abs(lon) <= 180 ? { lat, lon } : null,
  }
}

export function parseImoPage(imo: number, html: string): ImoRecord {
  const field = (label: string) => html.match(new RegExp(`<td class="tpc1">${label}(?: <small>[^<]*</small>)?</td><td class="tpc2">([^<]*)<`))?.[1]
  const mmsi = dataJson(html)['mmsi']
  return {
    imo,
    name: text(field('Vessel Name')) ?? pageName(html),
    type: text(field('Ship Type')),
    built: number(field('Year of Build')),
    gt: number(field('Gross Tonnage')),
    loa_m: number(field('Length Overall')),
    mmsi: typeof mmsi === 'number' && mmsi > 0 ? mmsi : null,
  }
}

export const detailsUrl = (id: number) => `${BASE}/vessels/details/${id}`

export class VesselFinder {
  private readonly options: { cacheDir: string; delayMs: number; offline: boolean }
  private lastFetch = 0

  constructor(options: { cacheDir: string; delayMs: number; offline: boolean }) {
    this.options = options
  }

  private async get(url: string, cacheName: string): Promise<string> {
    const file = path.join(this.options.cacheDir, `${cacheName}.html`)
    if (existsSync(file)) return readFile(file, 'utf8')
    if (this.options.offline) throw new Error(`not cached: ${url}`)
    const wait = this.lastFetch + this.options.delayMs - Date.now()
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait))
    this.lastFetch = Date.now()
    const res = await fetch(url, { headers: { 'user-agent': UA, accept: 'text/html' } })
    if (!res.ok) throw new HttpError(res.status, url)
    const body = await res.text()
    await mkdir(this.options.cacheDir, { recursive: true })
    await writeFile(file, body)
    return body
  }

  /** All result rows for a name query, following pagination up to `maxPages`. */
  async search(query: string, maxPages = 3): Promise<SearchRow[]> {
    const rows: SearchRow[] = []
    const slug = query.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    for (let page = 1; page <= maxPages; page++) {
      const params = new URLSearchParams({ name: query, ...(page > 1 ? { page: String(page) } : {}) })
      const result = parseSearch(await this.get(`${BASE}/vessels?${params}`, `search__${slug}__${page}`))
      rows.push(...result.rows)
      if (page >= result.pages) break
    }
    return rows
  }

  async mmsi(mmsi: number): Promise<MmsiRecord> {
    return parseMmsiPage(mmsi, await this.get(detailsUrl(mmsi), `details__${mmsi}`))
  }

  async imo(imo: number): Promise<ImoRecord> {
    return parseImoPage(imo, await this.get(detailsUrl(imo), `details__${imo}`))
  }
}
