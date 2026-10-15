// Validates data/ and generates the static pages and JSON API into dist/.
// Run after `vite build`. With --check it only validates.
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { Region } from '../schema/index.ts'
import {
  boatListPage,
  notFoundPage,
  operatorIndexPage,
  operatorPage,
  redirectPage,
  regionIndexPage,
  vesselPage,
} from '../src/pages.ts'
import { loadDataset, root, slugify } from './data.ts'
import type { OperatorRecord, VesselRecord } from './data.ts'

const result = await loadDataset()
if (!result.ok) {
  console.error(`Data errors (${result.errors.length}):`)
  for (const error of result.errors) console.error(`  - ${error}`)
  process.exit(1)
}

const data = result.data
console.log(`Data OK: ${data.vessels.length} vessels, ${data.operators.length} operators, ${data.regions.length} regions`)
if (process.argv.includes('--check')) process.exit(0)

const outDir = path.join(root, 'dist')
const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name)
const liveVessels = data.vessels.filter((v) => v.status !== 'merged').sort(byName)
const liveOperators = data.operators.filter((o) => o.status !== 'merged').sort(byName)
const regionsWithBoats: Array<{ region: Region; boats: VesselRecord[] }> = data.regions
  .map((region) => ({ region, boats: liveVessels.filter((v) => v.region === region.id) }))
  .filter((r) => r.boats.length > 0)

async function emit(rel: string, content: string): Promise<void> {
  const file = path.join(outDir, rel)
  await mkdir(path.dirname(file), { recursive: true })
  await writeFile(file, content)
}

function emitJson(rel: string, value: unknown, indent?: number): Promise<void> {
  return emit(rel, JSON.stringify(value, null, indent) + '\n')
}

// /boats/<id> and every past-name slug resolve statically; anything else falls to 404.html.
async function emitAliases(section: 'boats' | 'operators', record: VesselRecord | OperatorRecord): Promise<void> {
  await emit(`${section}/${record.id}.html`, redirectPage(record.url))
  const slugs = new Set(record.names.map((n) => slugify(n.name)))
  if (record.status !== 'merged') slugs.delete(record.slug)
  for (const slug of slugs) await emit(`${section}/${record.id}/${slug}.html`, redirectPage(record.url))
}

function publicRecord<T extends { file: string; slug: string }>(record: T): Omit<T, 'file' | 'slug'> {
  const { file: _file, slug: _slug, ...rest } = record
  return rest
}

function compactVessel(v: VesselRecord) {
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
    guests: v.guests,
    cabins: v.cabins,
    status: v.status,
  }
}

// API
await emitJson('api/v1/boats.json', liveVessels.map(compactVessel))
for (const v of data.vessels) {
  await emitJson(`api/v1/boats/${v.id}.json`, publicRecord(v), 2)
  if (v.status === 'merged') continue
  if (v.imo !== null) await emitJson(`api/v1/lookup/imo/${v.imo}.json`, { id: v.id })
  if (v.mmsi !== null) await emitJson(`api/v1/lookup/mmsi/${v.mmsi}.json`, { id: v.id })
}
await emitJson('api/v1/regions.json', data.regions)
for (const { region, boats } of regionsWithBoats) await emitJson(`api/v1/regions/${region.id}.json`, boats.map(compactVessel))
for (const o of data.operators) await emitJson(`api/v1/operators/${o.id}.json`, publicRecord(o), 2)

// Pages
await emit(
  'boats/index.html',
  boatListPage(data, { title: 'Boats', eyebrow: 'Index', canonical: '/boats/', current: '/boats/', json: '/api/v1/boats.json', boats: liveVessels }),
)
for (const v of data.vessels) {
  if (v.status !== 'merged') await emit(`boats/${v.id}/${v.slug}.html`, vesselPage(data, v))
  await emitAliases('boats', v)
}

await emit('regions/index.html', regionIndexPage(regionsWithBoats))
for (const { region, boats } of regionsWithBoats) {
  await emit(
    `regions/${region.id}.html`,
    boatListPage(data, { title: region.name, eyebrow: 'Region', canonical: `/regions/${region.id}`, current: '/regions/', json: `/api/v1/regions/${region.id}.json`, boats }),
  )
}

await emit('operators/index.html', operatorIndexPage(liveOperators, liveVessels))
for (const o of data.operators) {
  if (o.status !== 'merged') await emit(`operators/${o.id}/${o.slug}.html`, operatorPage(data, o, liveVessels.filter((v) => v.operator === o.id)))
  await emitAliases('operators', o)
}

await emit('404.html', notFoundPage())
console.log(`Generated pages and API in ${path.relative(root, outDir)}/`)
