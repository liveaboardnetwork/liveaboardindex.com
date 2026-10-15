// Validates data/ and generates the static boat pages and JSON API into dist/.
// Run after `vite build`. With --check it only validates.
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import YAML from 'yaml'
import { OPERATOR_ID, VESSEL_ID } from './ids.mjs'

const SITE = 'https://liveaboardindex.com'
const REPO = 'https://github.com/liveaboardnetwork/liveaboardindex.com'
const VESSEL_STATUSES = ['active', 'retired', 'lost', 'merged']
const OPERATOR_STATUSES = ['active', 'defunct', 'merged']
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/
const DATE = /^\d{4}(-\d{2}(-\d{2})?)?$/

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outDir = path.join(root, 'dist')
const checkOnly = process.argv.includes('--check')
const errors = []

const operators = (await loadDir('operators', OPERATOR_ID)).map(normalizeOperator)
const vessels = (await loadDir('vessels', VESSEL_ID)).map(normalizeVessel)

const operatorById = new Map(operators.map((o) => [o.id, o]))
const vesselById = new Map(vessels.map((v) => [v.id, v]))

operators.forEach(validateOperator)
vessels.forEach(validateVessel)
checkUnique('imo')
checkUnique('mmsi')

if (errors.length) {
  console.error(`Data errors (${errors.length}):`)
  for (const error of errors) console.error(`  - ${error}`)
  process.exit(1)
}

for (const o of operators) Object.assign(o, derive(o, 'operators'))
for (const v of vessels) Object.assign(v, derive(v, 'boats'))
for (const record of [...operators, ...vessels]) {
  if (record.merged_into) {
    const target = (record.id.startsWith('op_') ? operatorById : vesselById).get(record.merged_into)
    record.url = target.url
  }
}

console.log(`Data OK: ${vessels.length} vessels, ${operators.length} operators`)
if (checkOnly) process.exit(0)

const liveVessels = vessels.filter((v) => v.status !== 'merged').sort(byName)
const liveOperators = operators.filter((o) => o.status !== 'merged').sort(byName)
const regions = groupBy(liveVessels.filter((v) => v.region), (v) => v.region)

// API
await emitJson('api/v1/boats.json', liveVessels.map(compactVessel))
for (const v of vessels) {
  await emitJson(`api/v1/boats/${v.id}.json`, publicRecord(v), 2)
  if (v.status === 'merged') continue
  if (v.imo) await emitJson(`api/v1/lookup/imo/${v.imo}.json`, { id: v.id })
  if (v.mmsi) await emitJson(`api/v1/lookup/mmsi/${v.mmsi}.json`, { id: v.id })
}
for (const [region, boats] of regions) {
  await emitJson(`api/v1/regions/${region}.json`, boats.map(compactVessel))
}
for (const o of operators) await emitJson(`api/v1/operators/${o.id}.json`, publicRecord(o), 2)

// Pages
await emit('boats/index.html', listPage('Boats', liveVessels))
for (const v of vessels) {
  if (v.status !== 'merged') await emit(`boats/${v.id}/${v.slug}.html`, vesselPage(v))
  await emitAliases('boats', v)
}

await emit('regions/index.html', regionIndexPage())
for (const [region, boats] of regions) {
  await emit(`regions/${region}.html`, listPage(regionName(region), boats, `/regions/${region}`))
}

await emit('operators/index.html', operatorIndexPage())
for (const o of operators) {
  if (o.status !== 'merged') await emit(`operators/${o.id}/${o.slug}.html`, operatorPage(o))
  await emitAliases('operators', o)
}

await emit('404.html', notFoundPage())
console.log(`Generated pages and API in ${path.relative(root, outDir)}/`)

// ---------- loading & validation ----------

async function loadDir(kind, idPattern) {
  const dir = path.join(root, 'data', kind)
  const files = (await readdir(dir).catch(() => [])).filter((f) => f.endsWith('.yaml')).sort()
  const records = []
  for (const file of files) {
    const rel = `data/${kind}/${file}`
    let doc
    try {
      doc = YAML.parse(await readFile(path.join(dir, file), 'utf8'))
    } catch (error) {
      errors.push(`${rel}: invalid YAML (${error.message.split('\n')[0]})`)
      continue
    }
    if (!doc || typeof doc !== 'object') {
      errors.push(`${rel}: expected a YAML mapping`)
      continue
    }
    if (!idPattern.test(doc.id)) errors.push(`${rel}: id "${doc.id}" must match ${idPattern}`)
    else if (file !== `${doc.id}.yaml`) errors.push(`${rel}: file must be named ${doc.id}.yaml`)
    records.push({ ...doc, _file: rel })
  }
  return records
}

function normalizeVessel(v) {
  return {
    _file: v._file,
    id: v.id,
    names: normalizeNames(v.names),
    hull: v.hull ?? null,
    built: { year: v.built?.year ?? null, yard: v.built?.yard ?? null },
    imo: v.imo ?? null,
    mmsi: v.mmsi ?? null,
    call_sign: v.call_sign ?? null,
    flag: v.flag ?? null,
    loa_m: v.loa_m ?? null,
    beam_m: v.beam_m ?? null,
    gt: v.gt ?? null,
    operator: v.operator ?? null,
    region: v.region ?? null,
    status: v.status ?? 'active',
    merged_into: v.merged_into ?? null,
    sources: v.sources ?? [],
    notes: v.notes ?? '',
  }
}

function normalizeOperator(o) {
  return {
    _file: o._file,
    id: o.id,
    names: normalizeNames(o.names),
    country: o.country ?? null,
    website: o.website ?? null,
    status: o.status ?? 'active',
    merged_into: o.merged_into ?? null,
    sources: o.sources ?? [],
    notes: o.notes ?? '',
  }
}

function normalizeNames(names) {
  if (!Array.isArray(names)) return names
  return names.map((n) => ({
    name: n?.name ?? null,
    from: n?.from == null ? null : String(n.from),
    to: n?.to == null ? null : String(n.to),
  }))
}

function validateNames(record) {
  const { names, _file } = record
  if (!Array.isArray(names) || names.length === 0) {
    errors.push(`${_file}: names must be a non-empty list`)
    return
  }
  names.forEach((n, i) => {
    if (typeof n.name !== 'string' || !n.name.trim()) errors.push(`${_file}: names[${i}].name is required`)
    for (const key of ['from', 'to']) {
      if (n[key] != null && !DATE.test(n[key])) errors.push(`${_file}: names[${i}].${key} must be YYYY, YYYY-MM or YYYY-MM-DD`)
    }
  })
  if (names.filter((n) => n.to == null).length > 1) errors.push(`${_file}: only one name can have to: null (the current one)`)
}

function validateMerge(record, statuses, byId, pattern) {
  const { _file, status, merged_into, id } = record
  if (!statuses.includes(status)) errors.push(`${_file}: status must be one of ${statuses.join(', ')}`)
  if (status === 'merged') {
    if (!pattern.test(merged_into ?? '')) errors.push(`${_file}: status merged requires merged_into`)
    else if (merged_into === id) errors.push(`${_file}: cannot be merged into itself`)
    else if (!byId.has(merged_into)) errors.push(`${_file}: merged_into ${merged_into} does not exist`)
    else if (byId.get(merged_into).status === 'merged') errors.push(`${_file}: merged_into ${merged_into} is itself merged; point to the surviving record`)
  } else if (merged_into != null) {
    errors.push(`${_file}: merged_into is only allowed when status is merged`)
  }
}

function validateVessel(v) {
  const f = v._file
  validateNames(v)
  validateMerge(v, VESSEL_STATUSES, vesselById, VESSEL_ID)
  if (v.imo != null && !validImo(v.imo)) errors.push(`${f}: imo ${v.imo} is not a valid 7-digit IMO number`)
  if (v.mmsi != null && !/^\d{9}$/.test(String(v.mmsi))) errors.push(`${f}: mmsi must be 9 digits`)
  if (v.flag != null && !/^[A-Z]{2}$/.test(v.flag)) errors.push(`${f}: flag must be a 2-letter ISO country code`)
  if (v.region != null && !SLUG.test(v.region)) errors.push(`${f}: region must be a lowercase slug like "galapagos"`)
  if (v.hull != null && !/^[a-z0-9_]+$/.test(v.hull)) errors.push(`${f}: hull must be snake_case like "steel_motor"`)
  if (v.operator != null && !operatorById.has(v.operator)) errors.push(`${f}: operator ${v.operator} does not exist in data/operators`)
  for (const key of ['loa_m', 'beam_m', 'gt']) {
    if (v[key] != null && !(typeof v[key] === 'number' && v[key] > 0)) errors.push(`${f}: ${key} must be a positive number`)
  }
  const year = v.built.year
  if (year != null && !(Number.isInteger(year) && year >= 1800 && year <= new Date().getFullYear() + 2)) {
    errors.push(`${f}: built.year must be a plausible year`)
  }
  if (!Array.isArray(v.sources) || v.sources.some((s) => typeof s !== 'string')) errors.push(`${f}: sources must be a list of URLs`)
}

function validateOperator(o) {
  validateNames(o)
  validateMerge(o, OPERATOR_STATUSES, operatorById, OPERATOR_ID)
  if (o.country != null && !/^[A-Z]{2}$/.test(o.country)) errors.push(`${o._file}: country must be a 2-letter ISO country code`)
  if (!Array.isArray(o.sources) || o.sources.some((s) => typeof s !== 'string')) errors.push(`${o._file}: sources must be a list of URLs`)
}

function validImo(imo) {
  const digits = String(imo)
  if (!/^\d{7}$/.test(digits)) return false
  let sum = 0
  for (let i = 0; i < 6; i++) sum += Number(digits[i]) * (7 - i)
  return sum % 10 === Number(digits[6])
}

function checkUnique(key) {
  const seen = new Map()
  for (const v of vessels) {
    if (v[key] == null || v.status === 'merged') continue
    const other = seen.get(String(v[key]))
    if (other) errors.push(`${v._file}: ${key} ${v[key]} is already used by ${other.id}`)
    else seen.set(String(v[key]), v)
  }
}

// ---------- derived data ----------

function currentName(record) {
  return (record.names.find((n) => n.to == null) ?? record.names.at(-1)).name
}

function slugify(text) {
  const slug = text.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  return slug || 'unnamed'
}

function derive(record, section) {
  const name = currentName(record)
  const slug = slugify(name)
  return { name, slug, url: `/${section}/${record.id}/${slug}` }
}

function publicRecord(record) {
  const { _file, slug, ...rest } = record
  return rest
}

function compactVessel(v) {
  return {
    id: v.id,
    name: v.name,
    url: v.url,
    imo: v.imo,
    mmsi: v.mmsi,
    flag: v.flag,
    region: v.region,
    operator: v.operator,
    hull: v.hull,
    loa_m: v.loa_m,
    status: v.status,
  }
}

// ---------- output ----------

async function emit(rel, content) {
  const file = path.join(outDir, rel)
  await mkdir(path.dirname(file), { recursive: true })
  await writeFile(file, content)
}

function emitJson(rel, data, indent) {
  return emit(rel, JSON.stringify(data, null, indent) + '\n')
}

// /boats/<id> and every past-name slug resolve statically; anything else falls to 404.html.
async function emitAliases(section, record) {
  await emit(`${section}/${record.id}.html`, redirectPage(record.url))
  const slugs = new Set(record.names.map((n) => slugify(n.name)))
  if (record.status !== 'merged') slugs.delete(record.slug)
  for (const slug of slugs) await emit(`${section}/${record.id}/${slug}.html`, redirectPage(record.url))
}

// ---------- HTML ----------

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
}

function layout({ title, canonical, body }) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${esc(title)} · Liveaboard Index</title>
    ${canonical ? `<link rel="canonical" href="${SITE}${esc(canonical)}" />` : ''}
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <link rel="stylesheet" href="/site.css" />
  </head>
  <body>
    <header>
      <a class="brand" href="/">Liveaboard Index</a>
      <nav><a href="/boats/">Boats</a><a href="/regions/">Regions</a><a href="/operators/">Operators</a></nav>
    </header>
    <main>
${body}
    </main>
  </body>
</html>
`
}

function redirectPage(target) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Redirecting…</title>
    <meta name="robots" content="noindex" />
    <link rel="canonical" href="${SITE}${esc(target)}" />
    <meta http-equiv="refresh" content="0; url=${esc(target)}" />
    <script>location.replace(${JSON.stringify(target)} + location.search + location.hash)</script>
  </head>
  <body><a href="${esc(target)}">${esc(target)}</a></body>
</html>
`
}

function dash(value, suffix = '') {
  return value == null || value === '' ? '<span class="muted">—</span>' : `${esc(value)}${suffix}`
}

function humanize(value) {
  return value == null ? null : value.replace(/_/g, ' ')
}

function regionName(region) {
  return region.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ')
}

function operatorLink(id) {
  const o = id && operatorById.get(id)
  return o ? `<a href="${esc(o.url)}">${esc(o.name)}</a>` : dash(null)
}

function regionLink(region) {
  return region ? `<a href="/regions/${esc(region)}">${esc(regionName(region))}</a>` : dash(null)
}

function boatTable(boats) {
  if (!boats.length) return '<p class="muted">No boats yet.</p>'
  const rows = boats
    .map(
      (v) => `        <tr>
          <td><a href="${esc(v.url)}">${esc(v.name)}</a></td>
          <td>${dash(v.flag)}</td>
          <td>${regionLink(v.region)}</td>
          <td>${operatorLink(v.operator)}</td>
          <td class="num">${dash(v.loa_m, ' m')}</td>
          <td class="num">${dash(v.imo)}</td>
          <td class="num">${dash(v.mmsi)}</td>
          <td>${esc(v.status)}</td>
        </tr>`,
    )
    .join('\n')
  return `      <table class="boats">
        <thead><tr><th>Name</th><th>Flag</th><th>Region</th><th>Operator</th><th class="num">LOA</th><th class="num">IMO</th><th class="num">MMSI</th><th>Status</th></tr></thead>
        <tbody>
${rows}
        </tbody>
      </table>`
}

function listPage(title, boats, canonical = '/boats/') {
  return layout({
    title,
    canonical,
    body: `      <h1>${esc(title)}</h1>
      <p class="muted">${boats.length} boat${boats.length === 1 ? '' : 's'} · <a href="/api/v1/boats.json">JSON</a></p>
      <input id="filter" type="search" placeholder="Filter by name, IMO, MMSI, flag…" autocomplete="off" />
${boatTable(boats)}
      <script>
        document.getElementById('filter').addEventListener('input', (e) => {
          const q = e.target.value.trim().toLowerCase()
          for (const row of document.querySelectorAll('table.boats tbody tr')) {
            row.hidden = q !== '' && !row.textContent.toLowerCase().includes(q)
          }
        })
      </script>`,
  })
}

function namesList(names) {
  const range = (n) => `${n.from ?? '?'} – ${n.to ?? 'present'}`
  return `<ul class="names">${names.map((n) => `<li>${esc(n.name)} <span class="muted">${esc(range(n))}</span></li>`).join('')}</ul>`
}

function sourcesList(sources) {
  if (!sources.length) return dash(null)
  return `<ul>${sources.map((s) => `<li><a href="${esc(s)}" rel="nofollow noopener">${esc(s)}</a></li>`).join('')}</ul>`
}

function facts(rows) {
  return `      <dl class="facts">
${rows.map(([label, value]) => `        <dt>${label}</dt><dd>${value}</dd>`).join('\n')}
      </dl>`
}

function vesselPage(v) {
  return layout({
    title: v.name,
    canonical: v.url,
    body: `      <p class="muted"><a href="/boats/">Boats</a> / <code>${esc(v.id)}</code></p>
      <h1>${esc(v.name)}</h1>
${facts([
  ['Status', esc(v.status)],
  ['Names', namesList(v.names)],
  ['Region', regionLink(v.region)],
  ['Operator', operatorLink(v.operator)],
  ['Hull', dash(humanize(v.hull))],
  ['Built', v.built.year || v.built.yard ? `${dash(v.built.year)} · ${dash(v.built.yard)}` : dash(null)],
  ['IMO', dash(v.imo)],
  ['MMSI', dash(v.mmsi)],
  ['Call sign', dash(v.call_sign)],
  ['Flag', dash(v.flag)],
  ['Length (LOA)', dash(v.loa_m, ' m')],
  ['Beam', dash(v.beam_m, ' m')],
  ['Gross tonnage', dash(v.gt)],
  ['Sources', sourcesList(v.sources)],
  ...(v.notes ? [['Notes', esc(v.notes)]] : []),
])}
      <p class="muted"><a href="/api/v1/boats/${esc(v.id)}.json">JSON</a> · <a href="${REPO}/blob/main/${esc(v._file)}">Edit on GitHub</a> · <a href="${REPO}/commits/main/${esc(v._file)}">History</a></p>`,
  })
}

function regionIndexPage() {
  const items = [...regions]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([region, boats]) => `<li><a href="/regions/${esc(region)}">${esc(regionName(region))}</a> <span class="muted">${boats.length}</span></li>`)
  return layout({
    title: 'Regions',
    canonical: '/regions/',
    body: `      <h1>Regions</h1>
      ${items.length ? `<ul>${items.join('')}</ul>` : '<p class="muted">No regions yet.</p>'}`,
  })
}

function operatorIndexPage() {
  const items = liveOperators.map((o) => {
    const fleet = liveVessels.filter((v) => v.operator === o.id).length
    return `<li><a href="${esc(o.url)}">${esc(o.name)}</a> <span class="muted">${fleet}</span></li>`
  })
  return layout({
    title: 'Operators',
    canonical: '/operators/',
    body: `      <h1>Operators</h1>
      ${items.length ? `<ul>${items.join('')}</ul>` : '<p class="muted">No operators yet.</p>'}`,
  })
}

function operatorPage(o) {
  const fleet = liveVessels.filter((v) => v.operator === o.id)
  return layout({
    title: o.name,
    canonical: o.url,
    body: `      <p class="muted"><a href="/operators/">Operators</a> / <code>${esc(o.id)}</code></p>
      <h1>${esc(o.name)}</h1>
${facts([
  ['Status', esc(o.status)],
  ['Names', namesList(o.names)],
  ['Country', dash(o.country)],
  ['Website', o.website ? `<a href="${esc(o.website)}" rel="nofollow noopener">${esc(o.website)}</a>` : dash(null)],
  ['Sources', sourcesList(o.sources)],
  ...(o.notes ? [['Notes', esc(o.notes)]] : []),
])}
      <h2>Fleet</h2>
${boatTable(fleet)}
      <p class="muted"><a href="/api/v1/operators/${esc(o.id)}.json">JSON</a> · <a href="${REPO}/blob/main/${esc(o._file)}">Edit on GitHub</a></p>`,
  })
}

// Any /boats/<id>/<wrong-slug> lands here; resolve the ID and redirect to the canonical URL.
// IDs are normalized the Crockford way so dictated or mistyped IDs (O→0, I/L→1, uppercase) still work.
function notFoundPage() {
  return layout({
    title: 'Not found',
    body: `      <h1>Not found</h1>
      <p id="status">This page does not exist. <a href="/boats/">Browse all boats</a>.</p>
      <script>
        const match = location.pathname.match(/^\\/(boats|operators)\\/([a-z]+)_([0-9a-z]+)/i)
        if (match) {
          const section = match[1].toLowerCase()
          const code = match[3].toLowerCase().replace(/o/g, '0').replace(/[il]/g, '1')
          const id = match[2].toLowerCase() + '_' + code
          document.getElementById('status').textContent = 'Looking up ' + id + '…'
          fetch('/api/v1/' + section + '/' + id + '.json')
            .then((res) => (res.ok ? res.json() : Promise.reject()))
            .then((record) => location.replace(record.url + location.search + location.hash))
            .catch(() => {
              document.getElementById('status').innerHTML = 'No record with ID <code>' + id + '</code>. <a href="/boats/">Browse all boats</a>.'
            })
        }
      </script>`,
  })
}

function byName(a, b) {
  return a.name.localeCompare(b.name)
}

function groupBy(items, key) {
  const map = new Map()
  for (const item of items) {
    const k = key(item)
    if (!map.has(k)) map.set(k, [])
    map.get(k).push(item)
  }
  return map
}
