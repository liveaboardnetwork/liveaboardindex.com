// Imports scraped liveaboard.com boats into data/ as typed YAML records.
// Matches vessels by external_ids.liveaboard_com, then by region + name; operators by ID, then name.
// Only fills fields that are null in existing records, so hand-curated values are never overwritten.
//
//   npm run tools:liveaboard:import -- --region galapagos --dry-run
//   npm run tools:liveaboard:import -- --region galapagos
import { readFile, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { parseArgs } from 'node:util'
import YAML from 'yaml'
import { Operator, Regions, Vessel } from '../../schema/index.ts'
import type { OperatorId, RegionId, VesselId } from '../../schema/index.ts'
import { root, slugify } from '../../scripts/data.ts'
import { newOperatorId, newVesselId } from '../../scripts/ids.ts'
import { emptyOperator, emptyVessel, operatorYaml, vesselYaml } from '../../scripts/records.ts'
import { AMENITIES, DINING, DIVE_FACILITIES, SAFETY_EQUIPMENT, vocabKeys } from '../../schema/vocab.ts'
import { UnknownLabels, vesselFacts } from './map.ts'
import { LiveaboardBoat } from './parse.ts'

const { values: args } = parseArgs({
  options: {
    region: { type: 'string' },
    'dry-run': { type: 'boolean', default: false },
  },
})
const dryRun = args['dry-run']
const input = path.resolve(import.meta.dirname, '../out/liveaboard', args.region ? `boats-${args.region}.json` : 'boats.json')
const scraped = LiveaboardBoat.array().parse(JSON.parse(await readFile(input, 'utf8')))

// Records are read with defaults for fields added to the schema later, so old files still load.
async function loadAll<T>(dir: string, parse: (raw: Record<string, unknown>) => T): Promise<Map<string, T>> {
  const folder = path.join(root, 'data', dir)
  const files = (await readdir(folder).catch(() => [])).filter((f) => f.endsWith('.yaml'))
  const out = new Map<string, T>()
  for (const f of files) {
    const raw = YAML.parse(await readFile(path.join(folder, f), 'utf8')) as Record<string, unknown>
    out.set(f.replace(/\.yaml$/, ''), parse(raw))
  }
  return out
}

const vessels = await loadAll('vessels', (raw) => Vessel.parse({ ...emptyVessel(raw['id'] as VesselId, ''), ...raw }))
const operators = await loadAll('operators', (raw) => Operator.parse({ ...emptyOperator(raw['id'] as OperatorId, ''), ...raw }))
const regionIds = new Set<string>(Regions.parse(YAML.parse(await readFile(path.join(root, 'data/regions.yaml'), 'utf8'))).map((r) => r.id))

const unknown = new UnknownLabels()
const VOCAB_ORDER = {
  amenities: vocabKeys(AMENITIES),
  dive: vocabKeys(DIVE_FACILITIES),
  safety: vocabKeys(SAFETY_EQUIPMENT),
  dining: vocabKeys(DINING),
}

const currentName = (names: Array<{ name: string; to: unknown }>) => (names.find((n) => n.to === null) ?? names.at(-1))?.name ?? ''
const changed = new Set<string>()
const log: string[] = []

function fill<T extends object, K extends keyof T>(record: T, key: K, value: T[K] | null): void {
  if (record[key] === null && value !== null) record[key] = value
}

function upsertOperator(name: string, externalId: number): OperatorId {
  const all = [...operators.values()]
  let op = all.find((o) => o.external_ids.liveaboard_com === externalId) ?? all.find((o) => slugify(currentName(o.names)) === slugify(name))
  if (!op) {
    let id: OperatorId
    do id = newOperatorId()
    while (operators.has(id))
    op = emptyOperator(id, name)
    operators.set(id, op)
    log.push(`  + operator ${id} ${name}`)
  }
  if (op.external_ids.liveaboard_com === null) op.external_ids.liveaboard_com = externalId
  changed.add(`operators/${op.id}`)
  return op.id
}

for (const boat of scraped) {
  if (!regionIds.has(boat.region_slug)) {
    log.push(`  ! skipped ${boat.name}: region ${boat.region_slug} is not in data/regions.yaml`)
    continue
  }
  const region = boat.region_slug as RegionId
  const all = [...vessels.values()]
  const nameSlug = slugify(boat.name)
  let v =
    all.find((x) => x.external_ids.liveaboard_com === boat.liveaboard_boat_id) ??
    all.find((x) => x.region === region && x.names.some((n) => nameSlug === slugify(n.name) || nameSlug.startsWith(`${slugify(n.name)}-`)))
  const isNew = !v
  if (!v) {
    let id: VesselId
    do id = newVesselId()
    while (vessels.has(id))
    v = emptyVessel(id, boat.name)
  }

  const before = JSON.stringify(v)
  const candidate = structuredClone(v)
  fill(candidate, 'region', region)
  fill(candidate, 'loa_m', boat.length_m)
  fill(candidate, 'beam_m', boat.beam_m)
  fill(candidate, 'refit_year', boat.year_renovated)
  fill(candidate, 'guests', boat.max_guests)
  fill(candidate, 'cabins', boat.cabins)
  fill(candidate.built, 'year', boat.year_built)
  const facts = vesselFacts(boat, VOCAB_ORDER, unknown)
  for (const key of ['bathrooms', 'max_speed_kn', 'cruising_speed_kn', 'engines', 'tenders', 'fuel_l', 'water_l', 'watermaker_lpd'] as const) {
    fill(candidate, key, facts[key])
  }
  for (const key of ['cabin_types', 'amenities', 'dive_facilities', 'safety', 'dining', 'languages'] as const) {
    if (candidate[key].length === 0) (candidate[key] as unknown[]) = facts[key]
  }
  if (candidate.external_ids.liveaboard_com === null) candidate.external_ids.liveaboard_com = boat.liveaboard_boat_id
  if (!candidate.sources.includes(boat.url)) candidate.sources.push(boat.url)
  if (candidate.operator === null && boat.operator) {
    candidate.operator = upsertOperator(boat.operator.replace(/\s*&\s*/g, ' & '), boat.liveaboard_operator_id)
  }

  const check = Vessel.safeParse(candidate)
  if (!check.success) {
    log.push(`  ! skipped ${boat.name}: ${check.error.issues.map((i) => `${i.path.join('.')} ${i.message}`).join('; ')}`)
    continue
  }
  vessels.set(candidate.id, check.data)
  if (JSON.stringify(check.data) !== before) {
    changed.add(`vessels/${candidate.id}`)
    log.push(`  ${isNew ? '+' : '~'} vessel ${candidate.id} ${currentName(candidate.names)}${isNew ? '' : ' (filled empty fields)'}`)
  }
}

console.log(log.join('\n'))
const unmapped = unknown.report()
if (unmapped.length) {
  console.error(`\nUnmapped liveaboard.com labels (add them to tools/liveaboard/map.ts, as a vocabulary key or null):\n  - ${unmapped.join('\n  - ')}`)
  console.error('Nothing was written.')
  process.exit(1)
}
if (dryRun) {
  console.log(`\nDry run: ${changed.size} files would be written.`)
  process.exit(0)
}
for (const key of changed) {
  const [dir, id] = key.split('/') as [string, string]
  const body = dir === 'vessels' ? vesselYaml(vessels.get(id)!) : operatorYaml(operators.get(id)!)
  await writeFile(path.join(root, 'data', dir, `${id}.yaml`), body)
}
console.log(`\nWrote ${changed.size} files. Run \`npm run check\` next.`)
