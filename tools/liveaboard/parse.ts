// Parses a liveaboard.com boat page into a typed record.
// Sources inside the page: the schema.org Product JSON-LD (operator, rating, prices, internal IDs),
// the schema.org Event JSON-LD graph (departures) and the "Boat Specifications" <dl> list.
import * as z from 'zod'

export const Departure = z.object({
  tour_id: z.string(),
  name: z.string(),
  start: z.string(),
  end: z.string(),
  price: z.number().nullable(),
  currency: z.string().nullable(),
  availability: z.string().nullable(),
})
export type Departure = z.infer<typeof Departure>

export const LiveaboardCabin = z.object({
  liveaboard_cabin_id: z.int(),
  name: z.string(),
  /** Icon-list facts, e.g. "2 Single beds", "11.0 - 13.0 m²", "Ensuite Bathroom", "Max 2 guests". */
  facts: z.array(z.string()),
  description: z.string().nullable(),
  /** The <dl> pairs, e.g. { "Deck level of cabin": "Lower deck", "Cabin window(s)": "Porthole window" }. */
  details: z.record(z.string(), z.string()),
})
export type LiveaboardCabin = z.infer<typeof LiveaboardCabin>

export const LiveaboardBoat = z.object({
  url: z.url(),
  region_slug: z.string(),
  boat_slug: z.string(),
  liveaboard_boat_id: z.int(),
  liveaboard_operator_id: z.int(),
  name: z.string(),
  operator: z.string().nullable(),
  description: z.string().nullable(),
  rating: z.number().nullable(),
  review_count: z.int().nullable(),
  price_low: z.number().nullable(),
  price_high: z.number().nullable(),
  price_currency: z.string().nullable(),
  year_built: z.int().nullable(),
  year_renovated: z.int().nullable(),
  length_m: z.number().nullable(),
  beam_m: z.number().nullable(),
  deck_area_m2: z.number().nullable(),
  top_speed_kn: z.number().nullable(),
  cruising_speed: z.string().nullable(),
  engines: z.string().nullable(),
  max_guests: z.int().nullable(),
  cabins: z.int().nullable(),
  bathrooms: z.int().nullable(),
  tenders: z.int().nullable(),
  water_capacity: z.string().nullable(),
  fuel_capacity: z.string().nullable(),
  freshwater_maker: z.boolean().nullable(),
  specs_raw: z.record(z.string(), z.string()),
  features: z.array(z.object({ id: z.int(), label: z.string() })),
  boat_features: z.array(z.string()),
  food_drinks: z.array(z.string()),
  diving: z.array(z.string()),
  navigation_safety: z.array(z.string()),
  languages_raw: z.string().nullable(),
  gear_rental: z.boolean(),
  cabin_types: z.array(LiveaboardCabin),
  departures: z.array(Departure),
})
export type LiveaboardBoat = z.infer<typeof LiveaboardBoat>

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", nbsp: ' ' }

function text(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(#\d+|#x[0-9a-f]+|\w+);/gi, (m, e: string) => {
      if (e.startsWith('#x')) return String.fromCodePoint(parseInt(e.slice(2), 16))
      if (e.startsWith('#') && e !== '#39') return String.fromCodePoint(Number(e.slice(1)))
      return ENTITIES[e] ?? m
    })
    .replace(/\s+/g, ' ')
    .trim()
}

function jsonLd(html: string): unknown[] {
  const blocks = [...html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/g)]
  return blocks.flatMap((m) => {
    try {
      return [JSON.parse(m[1] ?? '') as unknown]
    } catch {
      return []
    }
  })
}

const LdProduct = z.object({
  '@type': z.literal('Product'),
  name: z.string(),
  sku: z.string().optional(),
  description: z.string().optional(),
  brand: z.object({ name: z.string() }).optional(),
  aggregateRating: z.object({ ratingValue: z.coerce.number(), reviewCount: z.coerce.number().int() }).optional(),
  offers: z.object({ lowPrice: z.coerce.number().optional(), highPrice: z.coerce.number().optional(), priceCurrency: z.string().optional() }).optional(),
})

const LdEvent = z.object({
  '@type': z.literal('Event'),
  '@id': z.string(),
  name: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  offers: z.object({ price: z.coerce.number().optional(), priceCurrency: z.string().optional(), availability: z.string().optional() }).optional(),
})

// Unclosed tags in their markup: <dl><dt class=...>Label <dd>Value</dl>
function specs(html: string): Record<string, string> {
  const start = html.indexOf('>Boat Specifications</h3>')
  if (start === -1) return {}
  const section = html.slice(start, html.indexOf('</div>', start))
  const out: Record<string, string> = {}
  for (const m of section.matchAll(/<dt[^>]*>([\s\S]*?)<dd[^>]*>([\s\S]*?)<\/dl>/g)) {
    out[text(m[1] ?? '')] = text(m[2] ?? '')
  }
  return out
}

function features(html: string): Array<{ id: number; label: string }> {
  const seen = new Map<number, string>()
  for (const m of html.matchAll(/<li id=feature-type-(\d+)[^>]*>\s*<span>([\s\S]*?)<\/span>/g)) {
    const id = Number(m[1])
    if (!seen.has(id)) seen.set(id, text(m[2] ?? ''))
  }
  return [...seen].map(([id, label]) => ({ id, label }))
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
// An opening tag whose quoted attributes may contain ">" (their Tailwind classes do: [&>*]:mx-3).
const OPEN = (tag: string) => `<${tag}(?:"[^"]*"|'[^']*'|[^>"'])*>`

// Section lists: <h3 class=h3>Diving</h3> <ul class="tick-list ..."><li>Nitrox available <li>...</ul>
function sectionList(html: string, title: string): string[] {
  const m = html.match(new RegExp(`<h3[^>]*>\\s*${escapeRe(title)}\\s*</h3>\\s*${OPEN('ul')}([\\s\\S]*?)</ul>`))
  if (!m) return []
  return (m[1] ?? '')
    .split(/<li[^>]*>/)
    .map(text)
    .filter(Boolean)
}

function sectionParagraph(html: string, title: string): string | null {
  const m = html.match(new RegExp(`<h3[^>]*>\\s*${escapeRe(title)}\\s*</h3>\\s*<p[^>]*>([\\s\\S]*?)(?:</p>|</div>)`))
  return m ? text(m[1] ?? '') || null : null
}

// Cabin modals: <div id=help-content-cabin-details-9274 data-element=modal> … <h5>Name</h5> <ul><li><span>fact</span>…</ul>
// </div> <div>description</div> <hr> <div><dl><dt>Label <dd>Value</dl>…
function cabinTypes(html: string): LiveaboardCabin[] {
  const clean = html.replace(/<svg[\s\S]*?<\/svg>/g, '')
  const starts = [...clean.matchAll(/id="?help-content-cabin-details-(\d+)"? data-element=modal/g)]
  return starts.flatMap((m, i) => {
    const next = starts[i + 1]?.index ?? clean.length
    const footer = clean.indexOf('Cabin is selected on the next step', m.index)
    const block = clean.slice(m.index, footer !== -1 && footer < next ? footer : Math.min(next, m.index + 20_000))
    const name = block.match(/<h5[^>]*>([\s\S]*?)<\/h5>/)
    if (!name) return []
    const list = block.match(/<\/h5>\s*<ul[^>]*>([\s\S]*?)<\/ul>/)?.[1] ?? ''
    const facts = [...list.matchAll(/<span[^>]*>([\s\S]*?)<\/span>/g)].map((s) => text(s[1] ?? '')).filter(Boolean)
    const description = block.match(/<\/ul>\s*<\/div>\s*<div[^>]*>([\s\S]*?)<\/div>\s*<hr/)?.[1]
    const details: Record<string, string> = {}
    for (const d of block.matchAll(/<dl[^>]*>\s*<dt[^>]*>([\s\S]*?)<dd[^>]*>([\s\S]*?)<\/dl>/g)) details[text(d[1] ?? '')] = text(d[2] ?? '')
    return [{ liveaboard_cabin_id: Number(m[1]), name: text(name[1] ?? ''), facts, description: description ? text(description) || null : null, details }]
  })
}

function num(value: string | undefined): number | null {
  const m = value?.replace(/[,']/g, '').match(/-?\d+(\.\d+)?/)
  return m ? Number(m[0]) : null
}

// Operators type units freely: "35.4 m", "26 meters", "32 metres", "100 feet", "129.6 ft".
function meters(value: string | undefined): number | null {
  const n = num(value)
  if (n === null || !value) return null
  if (/\b(m|meters?|metres?|mtrs?)\b/i.test(value)) return n
  if (/\b(ft|feet|foot)\b|'/i.test(value)) return Math.round(n * 0.3048 * 10) / 10
  return null
}

function squareMeters(value: string | undefined): number | null {
  return value && /(m2|m²|sqm|square met)/i.test(value) ? num(value) : null
}

function int(value: string | undefined): number | null {
  const n = num(value)
  return n === null ? null : Math.round(n)
}

/** Returns null for non-boat pages. Dive sites and ports also carry a Product JSON-LD, but only boats have an LA-<operatorId>-<boatId> sku. */
export function parseBoatPage(url: string, html: string): LiveaboardBoat | null {
  const ld = jsonLd(html)
  const product = ld.map((b) => LdProduct.safeParse(b)).find((r) => r.success)?.data
  const sku = product?.sku?.match(/^LA-(\d+)-(\d+)$/)
  if (!product || !sku) return null

  const events = ld.flatMap((b) => {
    const graph = (b as { '@graph'?: unknown[] })['@graph']
    return Array.isArray(graph) ? graph : []
  })
  const departures = events.flatMap((e) => {
    const r = LdEvent.safeParse(e)
    if (!r.success) return []
    const ev = r.data
    return [
      {
        tour_id: ev['@id'].split('-').pop() ?? ev['@id'],
        name: ev.name.trim(),
        start: ev.startDate,
        end: ev.endDate,
        price: ev.offers?.price ?? null,
        currency: ev.offers?.priceCurrency ?? null,
        availability: ev.offers?.availability?.replace('https://schema.org/', '') ?? null,
      },
    ]
  })

  const s = specs(html)
  const [, region_slug = '', boat_slug = ''] = new URL(url).pathname.match(/^\/diving\/([^/]+)\/([^/]+)/) ?? []

  return LiveaboardBoat.parse({
    url,
    region_slug,
    boat_slug,
    liveaboard_boat_id: Number(sku[2]),
    liveaboard_operator_id: Number(sku[1]),
    name: product.name.trim(),
    operator: product.brand?.name.trim() ?? null,
    description: product.description?.trim() ?? null,
    rating: product.aggregateRating?.ratingValue ?? null,
    review_count: product.aggregateRating?.reviewCount ?? null,
    price_low: product.offers?.lowPrice ?? null,
    price_high: product.offers?.highPrice ?? null,
    price_currency: product.offers?.priceCurrency ?? null,
    year_built: int(s['Year built']),
    year_renovated: int(s['Year renovated']),
    length_m: meters(s['Length']),
    beam_m: meters(s['Beam']),
    deck_area_m2: squareMeters(s['Deck area']),
    top_speed_kn: num(s['Top speed']),
    cruising_speed: s['Cruising speed'] ?? null,
    engines: s['Engines'] ?? null,
    max_guests: int(s['Max guests']),
    cabins: int(s['Number of cabins']),
    bathrooms: int(s['Number of bathrooms']),
    tenders: int(s['Tenders']),
    water_capacity: s['Water capacity'] ?? null,
    fuel_capacity: s['Fuel capacity'] ?? null,
    freshwater_maker: s['Freshwater maker'] === undefined ? null : s['Freshwater maker'].toLowerCase() === 'yes',
    specs_raw: s,
    features: features(html),
    boat_features: sectionList(html, 'Boat features'),
    food_drinks: sectionList(html, 'Food &amp; Drinks'),
    diving: sectionList(html, 'Diving'),
    navigation_safety: sectionList(html, 'Boat navigation and safety'),
    languages_raw: sectionParagraph(html, 'Languages Spoken'),
    gear_rental: /<h3[^>]*>\s*Gear Rental\s*<\/h3>/.test(html),
    cabin_types: cabinTypes(html),
    departures,
  })
}
