import type { Region } from '../schema/index.ts'
import { HULL_MATERIALS, OPERATOR_STATUSES, PROPULSIONS, VESSEL_STATUSES } from '../schema/index.ts'
import { AMENITIES, CABIN_BATHROOMS, CABIN_DECKS, CABIN_WINDOWS, DINING, DIVE_FACILITIES, ENGINE_MAKES, SAFETY_EQUIPMENT } from '../schema/vocab.ts'
import { API_BASE } from './api.ts'
import type { CompactOperator, CompactVessel, PublicOperator, PublicVessel } from './api.ts'
import { Badge, CodeBlock, CodeBlockScript, DataTable, DocsLayout, Layout, PageHero, esc } from './components/index.ts'
import type { DocSection, Html } from './components/index.ts'
import { site } from './site.ts'

export interface ApiDocsInput {
  boats: CompactVessel[]
  operators: CompactOperator[]
  regions: Region[]
  /** Full records used as example responses. */
  vessel: PublicVessel
  operator: PublicOperator
}

interface FieldDoc {
  type: string
  description: string
}

const list = (values: readonly string[]) => values.map((v) => `<code>${esc(v)}</code>`).join(', ')
const code = (text: string) => `<code>${esc(text)}</code>`

const VESSEL_FIELDS = {
  id: { type: 'string', description: `Permanent ID: ${code('lvb_')} + 6 Crockford base32 characters. Never changes or gets reused.` },
  name: { type: 'string', description: 'Current name.' },
  url: { type: 'string', description: 'Canonical page on liveaboardindex.com. For merged boats, the page of the boat it was merged into.' },
  names: { type: 'array', description: `Name history, oldest first: ${code('{ name, from, to }')}. ${code('to: null')} marks the current name. Dates are a year, ${code('YYYY-MM')} or ${code('YYYY-MM-DD')}.` },
  status: { type: 'string', description: `One of ${list(VESSEL_STATUSES)}.` },
  merged_into: { type: 'string | null', description: `When ${code('status')} is ${code('merged')}, the ID of the record this duplicate was merged into.` },
  region: { type: 'string | null', description: `Region ID, see ${code('/regions.json')}.` },
  operator: { type: 'string | null', description: `Operator ID (${code('op_xxxx')}).` },
  hull: { type: 'string | null', description: `${code('<material>_<propulsion>')}. Materials: ${list(HULL_MATERIALS)}. Propulsion: ${list(PROPULSIONS)}.` },
  built: { type: 'object', description: `${code('{ year, yard }')}, both nullable.` },
  refit_year: { type: 'number | null', description: 'Year of the last major refit.' },
  guests: { type: 'number | null', description: 'Maximum guests.' },
  cabins: { type: 'number | null', description: 'Guest cabins.' },
  bathrooms: { type: 'number | null', description: 'Number of bathrooms.' },
  cabin_types: {
    type: 'array',
    description: `Cabin types: ${code('{ name, count, max_guests, beds, size_m2, deck, window, bathroom, aircon, external_ids }')}. ${code('beds')} is ${code('{ single, double, bunk, convertible }')}; ${code('size_m2')} is ${code('{ min, max }')}. Deck: ${list(Object.keys(CABIN_DECKS))}. Window: ${list(Object.keys(CABIN_WINDOWS))}. Bathroom: ${list(Object.keys(CABIN_BATHROOMS))}. ${code('count')} is the number of cabins of that type, when known.`,
  },
  amenities: { type: 'string[]', description: `On-board amenities: ${list(Object.keys(AMENITIES))}.` },
  dive_facilities: { type: 'string[]', description: `Diving setup: ${list(Object.keys(DIVE_FACILITIES))}.` },
  safety: { type: 'string[]', description: `Navigation and safety equipment: ${list(Object.keys(SAFETY_EQUIPMENT))}.` },
  dining: { type: 'string[]', description: `Food and drink: ${list(Object.keys(DINING))}.` },
  languages: { type: 'string[]', description: 'Languages the crew speaks, ISO 639-1 (e.g. en, es).' },
  max_speed_kn: { type: 'number | null', description: 'Top speed, knots.' },
  cruising_speed_kn: { type: 'number | null', description: 'Cruising speed, knots.' },
  engines: { type: 'object | null', description: `${code('{ count, make, model, power_hp }')}, ${code('power_hp')} per engine. Makes: ${list(Object.keys(ENGINE_MAKES))}.` },
  tenders: { type: 'number | null', description: 'Number of tenders (dinghies / skiffs).' },
  fuel_l: { type: 'number | null', description: 'Fuel capacity, liters.' },
  water_l: { type: 'number | null', description: 'Fresh water capacity, liters.' },
  watermaker_lpd: { type: 'number | null', description: 'Watermaker output, liters per day.' },
  loa_m: { type: 'number | null', description: 'Length overall, meters.' },
  beam_m: { type: 'number | null', description: 'Beam, meters.' },
  gt: { type: 'number | null', description: 'Gross tonnage.' },
  imo: { type: 'number | null', description: 'IMO number (7 digits, check digit validated). Unique across active boats.' },
  mmsi: { type: 'number | null', description: 'MMSI (9 digits). Unique across active boats.' },
  call_sign: { type: 'string | null', description: 'Radio call sign.' },
  flag: { type: 'string | null', description: 'Flag state, ISO 3166-1 alpha-2 (e.g. EC).' },
  external_ids: { type: 'object', description: `IDs in other systems: ${code('{ liveaboard_com }')}.` },
  sources: { type: 'string[]', description: 'URLs the data was checked against.' },
  notes: { type: 'string', description: 'Free-form editorial notes; empty string if none.' },
} satisfies Record<keyof PublicVessel, FieldDoc>

const OPERATOR_FIELDS = {
  id: { type: 'string', description: `Permanent ID: ${code('op_')} + 4 Crockford base32 characters.` },
  name: { type: 'string', description: 'Current name.' },
  url: { type: 'string', description: 'Canonical page on liveaboardindex.com.' },
  names: { type: 'array', description: 'Name history, same shape as for boats.' },
  status: { type: 'string', description: `One of ${list(OPERATOR_STATUSES)}.` },
  merged_into: { type: 'string | null', description: `When merged, the ID of the operator it was merged into.` },
  country: { type: 'string | null', description: 'Home country, ISO 3166-1 alpha-2.' },
  website: { type: 'string | null', description: 'Official website.' },
  external_ids: { type: 'object', description: `IDs in other systems: ${code('{ liveaboard_com }')}.` },
  sources: { type: 'string[]', description: 'URLs the data was checked against.' },
  notes: { type: 'string', description: 'Free-form editorial notes; empty string if none.' },
} satisfies Record<keyof PublicOperator, FieldDoc>

function fieldTable(fields: Record<string, FieldDoc>): Html {
  return DataTable<[string, FieldDoc]>({
    rows: Object.entries(fields),
    columns: [
      { label: 'Field', align: 'mono', cell: ([name]) => esc(name) },
      { label: 'Type', align: 'mono', cell: ([, f]) => `<span class="muted">${esc(f.type)}</span>` },
      { label: 'Description', cell: ([, f]) => f.description },
    ],
  })
}

/** Pretty JSON; arrays longer than `max` are cut with an ellipsis line. */
function sample(value: unknown, max = 2): string {
  if (!Array.isArray(value) || value.length <= max) return JSON.stringify(value, null, 2)
  const head = JSON.stringify(value.slice(0, max), null, 2)
  return `${head.slice(0, -2)},\n  … ${value.length - max} more\n]`
}

function endpoint(path: string, example: string, description: Html, response: unknown): Html {
  const url = `${API_BASE}${example}`
  return `<div class="endpoint">
  <span class="endpoint__method">GET</span>
  <code class="endpoint__path">${esc(API_BASE + path)}</code>
</div>
<p>${description}</p>
<p class="muted">Example: <a class="link mono" href="${esc(url)}">${esc(url)}</a></p>
${CodeBlock({ code: sample(response), language: 'json', title: 'Response' })}`
}

export function apiDocsPage({ boats, operators, regions, vessel, operator }: ApiDocsInput): Html {
  const base = `${site.url}${API_BASE}`
  const region = regions.find((r) => boats.some((b) => b.region === r.id)) ?? regions[0]
  const regionBoats = boats.filter((b) => b.region === region?.id)
  const imo = vessel.imo ?? 9_999_999
  const mmsi = vessel.mmsi ?? 799_999_999

  const sections: DocSection[] = [
    {
      id: 'overview',
      title: 'Overview',
      content: `<p>The whole index is published as static JSON files over HTTPS. There is no key, no sign-up and no rate limit, and CORS is open, so you can call it straight from a browser.</p>
<p>Files are regenerated every time the index is updated. All endpoints are <code>GET</code> and live under:</p>
${CodeBlock({ code: base, title: 'Base URL' })}`,
    },
    {
      id: 'quick-start',
      title: 'Quick start',
      content: `<p>Find a boat by IMO, then fetch its full record:</p>
${CodeBlock({
  language: 'shell',
  title: 'Shell',
  code: `curl ${base}/lookup/imo/${imo}.json
# {"id":"${vessel.id}"}

curl ${base}/boats/${vessel.id}.json`,
})}
<p>The same in JavaScript. A lookup that doesn't exist returns HTTP 404:</p>
${CodeBlock({
  language: 'js',
  title: 'JavaScript',
  code: `const base = '${base}'

const res = await fetch(\`\${base}/lookup/imo/${imo}.json\`)
if (res.status === 404) throw new Error('Not in the index')
const { id } = await res.json()

const boat = await fetch(\`\${base}/boats/\${id}.json\`).then((r) => r.json())`,
})}
<p>For search or filtering, download <code>/boats.json</code> once and filter it locally. It holds every active boat:</p>
${CodeBlock({
  language: 'js',
  title: 'JavaScript',
  code: `const boats = await fetch('${base}/boats.json').then((r) => r.json())
const big = boats.filter((b) => b.guests >= 16 && b.region === '${region?.id ?? 'galapagos'}')`,
})}`,
    },
    {
      id: 'endpoints',
      title: 'Endpoints',
      content: DataTable<{ path: string; anchor: string; summary: string }>({
        rows: [
          { path: '/boats.json', anchor: 'boats', summary: 'Every active boat, compact' },
          { path: '/boats/{id}.json', anchor: 'boat', summary: 'One boat, full record' },
          { path: '/lookup/imo/{imo}.json', anchor: 'lookup', summary: 'Boat ID by IMO' },
          { path: '/lookup/mmsi/{mmsi}.json', anchor: 'lookup', summary: 'Boat ID by MMSI' },
          { path: '/regions.json', anchor: 'regions', summary: 'Every region' },
          { path: '/regions/{id}.json', anchor: 'region', summary: 'Boats in a region' },
          { path: '/operators.json', anchor: 'operators', summary: 'Every active operator' },
          { path: '/operators/{id}.json', anchor: 'operator', summary: 'One operator, full record' },
        ],
        columns: [
          { label: 'Path', align: 'mono', cell: (r) => `<a class="link" href="#${r.anchor}">${esc(r.path)}</a>` },
          { label: 'Returns', cell: (r) => esc(r.summary) },
        ],
      }),
    },
    {
      id: 'boats',
      title: 'List boats',
      sub: true,
      content: endpoint('/boats.json', '/boats.json', 'Every active boat in a compact form, sorted by name. Merged duplicates are left out.', boats),
    },
    {
      id: 'boat',
      title: 'Get a boat',
      sub: true,
      content: endpoint(
        '/boats/{id}.json',
        `/boats/${vessel.id}.json`,
        `The full record. Exists for every ID ever issued, including merged ones; see <a class="link" href="#merges">merges</a>.`,
        vessel,
      ),
    },
    {
      id: 'lookup',
      title: 'Look up by IMO or MMSI',
      sub: true,
      content: `<div class="endpoint">
  <span class="endpoint__method">GET</span>
  <code class="endpoint__path">${API_BASE}/lookup/imo/{imo}.json</code>
</div>
<div class="endpoint">
  <span class="endpoint__method">GET</span>
  <code class="endpoint__path">${API_BASE}/lookup/mmsi/{mmsi}.json</code>
</div>
<p>Returns the ID of the active boat with that number, or HTTP 404 if there is none.</p>
<p class="muted">Examples: <a class="link mono" href="${API_BASE}/lookup/imo/${imo}.json">${API_BASE}/lookup/imo/${imo}.json</a>, <a class="link mono" href="${API_BASE}/lookup/mmsi/${mmsi}.json">${API_BASE}/lookup/mmsi/${mmsi}.json</a></p>
${CodeBlock({ code: JSON.stringify({ id: vessel.id }, null, 2), language: 'json', title: 'Response' })}`,
    },
    {
      id: 'regions',
      title: 'List regions',
      sub: true,
      content: endpoint('/regions.json', '/regions.json', `Every region: ${code('{ id, name, countries }')}, with ISO country codes.`, regions),
    },
    {
      id: 'region',
      title: 'Boats in a region',
      sub: true,
      content: endpoint(
        '/regions/{id}.json',
        `/regions/${region?.id ?? 'galapagos'}.json`,
        `Active boats in the region, in the same compact form as ${code('/boats.json')}. Only regions with at least one boat have a file.`,
        regionBoats,
      ),
    },
    {
      id: 'operators',
      title: 'List operators',
      sub: true,
      content: endpoint('/operators.json', '/operators.json', 'Every active operator, with the number of active boats it runs.', operators),
    },
    {
      id: 'operator',
      title: 'Get an operator',
      sub: true,
      content: endpoint('/operators/{id}.json', `/operators/${operator.id}.json`, 'The full operator record.', operator),
    },
    {
      id: 'ids',
      title: 'IDs',
      content: `<p>Boats are ${code('lvb_')} + 6 characters, operators ${code('op_')} + 4, in lowercase Crockford base32 (no ${code('i')}, ${code('l')}, ${code('o')} or ${code('u')}). IDs are random, never change and are never reused, even if a boat is renamed, reflagged or sold.</p>
<p>Store the ID, not the name or IMO. IMO and MMSI are attributes: they can be missing, and an MMSI can change when a boat is reflagged.</p>
<p>API paths are exact and lowercase. Website URLs are forgiving: <a class="link mono" href="/boats/${vessel.id.toUpperCase()}">/boats/${esc(vessel.id.toUpperCase())}</a> and any slug redirect to the canonical page.</p>`,
    },
    {
      id: 'merges',
      title: 'Merges',
      content: `<p>When two records turn out to be the same boat, one is kept and the other gets ${code('status: "merged"')} plus ${code('merged_into')} with the surviving ID. Merged records drop out of lists and lookups, but their ${code('/boats/{id}.json')} file stays forever, so stored IDs keep resolving. Follow ${code('merged_into')} to get the current record.</p>`,
    },
    { id: 'boat-fields', title: 'Boat fields', content: fieldTable(VESSEL_FIELDS) },
    {
      id: 'operator-fields',
      title: 'Operator fields',
      content: `${fieldTable(OPERATOR_FIELDS)}
<p class="muted">List endpoints return a subset of these fields. ${code('/operators.json')} adds ${code('boats')}, the number of active boats.</p>`,
    },
    {
      id: 'versioning',
      title: 'Versioning',
      content: `<p>Within ${code('v1')}, fields may be added but are never renamed, removed or changed in type, so ignore fields you don't know. A breaking change would ship as ${code('/api/v2')} alongside v1.</p>
<p>Missing values are always ${code('null')}, never omitted.</p>`,
    },
  ]

  return Layout({
    title: 'API',
    description: `Free JSON API for ${site.name}: list and look up liveaboard boats by ID, IMO or MMSI, plus regions and operators. No key, CORS enabled.`,
    canonical: '/docs/',
    current: '/docs/',
    content: [
      PageHero({
        align: 'left',
        eyebrow: Badge({ label: 'v1' }),
        title: 'API',
        lead: 'Free, read-only JSON for every boat, region and operator in the index. No key, no rate limits, CORS enabled.',
        actions: [
          { label: 'Quick start', href: '#quick-start', variant: 'primary' },
          { label: 'boats.json', href: `${API_BASE}/boats.json`, variant: 'secondary' },
        ],
      }),
      DocsLayout({ sections }),
      CodeBlockScript(),
    ].join('\n'),
  })
}
