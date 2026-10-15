// Validates data/ and generates the static boat pages and JSON API into dist/.
// Run after `vite build`. With --check it only validates.
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import YAML from 'yaml'
import {
  boatListPage,
  notFoundPage,
  operatorIndexPage,
  operatorPage,
  redirectPage,
  regionIndexPage,
  regionName,
  vesselPage,
} from '../src/pages.js'
import { OPERATOR_ID, VESSEL_ID } from './ids.mjs'

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
const ctx = { operatorById }
await emit(
  'boats/index.html',
  boatListPage({ ...ctx, title: 'Boats', eyebrow: 'Index', canonical: '/boats/', current: '/boats/', json: '/api/v1/boats.json', boats: liveVessels }),
)
for (const v of vessels) {
  if (v.status !== 'merged') await emit(`boats/${v.id}/${v.slug}.html`, vesselPage(v, ctx))
  await emitAliases('boats', v)
}

await emit('regions/index.html', regionIndexPage(regions))
for (const [region, boats] of regions) {
  await emit(
    `regions/${region}.html`,
    boatListPage({ ...ctx, title: regionName(region), eyebrow: 'Region', canonical: `/regions/${region}`, current: '/regions/', json: `/api/v1/regions/${region}.json`, boats }),
  )
}

await emit('operators/index.html', operatorIndexPage(liveOperators, liveVessels))
for (const o of operators) {
  const fleet = liveVessels.filter((v) => v.operator === o.id)
  if (o.status !== 'merged') await emit(`operators/${o.id}/${o.slug}.html`, operatorPage(o, { ...ctx, fleet }))
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
