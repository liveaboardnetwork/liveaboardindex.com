// Finds each vessel in the ship registries (via VesselFinder) and fills IMO, MMSI, call sign,
// flag, gross tonnage, build year and length. Only fills fields that are null and only from
// matches with no doubts; everything else lands in tools/out/registry/review.md for a human.
// To resolve a review item, put the right IMO or MMSI in the vessel's YAML and run again:
// a known ID is trusted and the rest is filled from it.
//
//   npm run tools:registry -- --only lvb_xarhya          # one vessel, dry run
//   npm run tools:registry -- --limit 20                 # first 20 incomplete vessels, dry run
//   npm run tools:registry -- --write                    # all vessels, write data/
//   npm run tools:registry -- --offline --write          # reuse the cache, no network
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { parseArgs } from 'node:util'
import { CallSign, CountryCode, Imo, Mmsi, Vessel } from '../../schema/index.ts'
import type { VesselId } from '../../schema/index.ts'
import { loadDataset, root } from '../../scripts/data.ts'
import type { VesselRecord } from '../../scripts/data.ts'
import { vesselYaml } from '../../scripts/records.ts'
import { candidates, pairDoubts, pick, searchQueries } from './match.ts'
import type { Candidate, Decision } from './match.ts'
import { HttpError, VesselFinder, detailsUrl } from './vesselfinder.ts'
import type { ImoRecord, MmsiRecord, SearchRow } from './vesselfinder.ts'

const { values: args } = parseArgs({
  options: {
    only: { type: 'string', multiple: true },
    limit: { type: 'string' },
    delay: { type: 'string', default: '2000' },
    offline: { type: 'boolean', default: false },
    write: { type: 'boolean', default: false },
  },
})

const toolsDir = path.resolve(import.meta.dirname, '..')
const outDir = path.join(toolsDir, 'out/registry')
const vf = new VesselFinder({ cacheDir: path.join(toolsDir, '.cache/vesselfinder'), delayMs: Number(args.delay), offline: args.offline })

const loaded = await loadDataset()
if (!loaded.ok) {
  console.error(`data/ has errors; fix them first (npm run check):\n  ${loaded.errors.join('\n  ')}`)
  process.exit(1)
}
const { vessels, regionById } = loaded.data

/** Fields this tool may fill, with the value VesselFinder gives. */
interface Fills {
  imo?: number
  mmsi?: number
  call_sign?: string
  flag?: CountryCode
  gt?: number
  built_year?: number
  loa_m?: number
}

type Status = 'matched' | 'review' | 'none' | 'complete' | 'error'

interface Outcome {
  id: VesselId
  name: string
  status: Status
  evidence: string[]
  doubts: string[]
  imo: ImoRecord | null
  mmsi: MmsiRecord | null
  /** Same-name records a human has to choose between. */
  options: SearchRow[]
  fills: Fills
  /** Registry values that differ from what the record already has; never written. */
  conflicts: string[]
}

const isComplete = (v: VesselRecord) => v.imo !== null && v.mmsi !== null && v.call_sign !== null && v.flag !== null && v.gt !== null && v.built.year !== null

const assignedImo = new Map(vessels.flatMap((v) => (v.imo === null ? [] : [[v.imo, v.id] as const])))
const assignedMmsi = new Map(vessels.flatMap((v) => (v.mmsi === null ? [] : [[v.mmsi, v.id] as const])))

function describe(p: Decision, kind: 'IMO' | 'MMSI', outcome: Outcome): Candidate | null {
  if (p.status === 'ambiguous') {
    outcome.doubts.push(`${p.options.length} same-name ${kind} records and nothing singles one out`)
    outcome.options.push(...p.options.map((c) => c.row))
    return null
  }
  if (p.status === 'none') return null
  outcome.evidence.push(...p.evidence.map((e) => `${kind}: ${e}`))
  outcome.doubts.push(...p.doubts.map((d) => `${kind}: ${d}`))
  return p.candidate
}

async function identify(v: VesselRecord): Promise<Outcome> {
  const outcome: Outcome = { id: v.id, name: v.name, status: 'none', evidence: [], doubts: [], imo: null, mmsi: null, options: [], fills: {}, conflicts: [] }
  const target = {
    names: v.names.map((n) => n.name),
    loa_m: v.loa_m,
    countries: v.region ? (regionById.get(v.region)?.countries ?? []) : [],
  }

  const rows: SearchRow[] = []
  if (v.imo === null || v.mmsi === null) {
    for (const query of new Set(target.names.flatMap(searchQueries))) rows.push(...(await vf.search(query)))
  }
  const found = candidates(target, rows)
  const rowById = new Map(rows.map((r) => [r.id, r]))

  let imoRow: SearchRow | null = null
  if (v.imo !== null) {
    outcome.imo = await vf.imo(v.imo)
    imoRow = rowById.get(v.imo) ?? null
    outcome.evidence.push('IMO: already in the record')
  } else {
    imoRow = describe(pick(found, 'imo'), 'IMO', outcome)?.row ?? null
    if (imoRow) outcome.imo = await vf.imo(imoRow.id)
  }

  let mmsiRow: SearchRow | null = null
  if (v.mmsi !== null) {
    outcome.mmsi = await vf.mmsi(v.mmsi)
    mmsiRow = rowById.get(v.mmsi) ?? null
    outcome.evidence.push('MMSI: already in the record')
  } else if (outcome.imo?.mmsi && !found.some((c) => c.row.kind === 'mmsi' && c.row.id !== outcome.imo?.mmsi)) {
    // The registry entry names its own transponder: stronger than any name match.
    outcome.mmsi = await vf.mmsi(outcome.imo.mmsi)
    mmsiRow = rowById.get(outcome.imo.mmsi) ?? null
    outcome.evidence.push(`MMSI: linked from IMO ${outcome.imo.imo}`)
  } else {
    mmsiRow = describe(pick(found, 'mmsi'), 'MMSI', outcome)?.row ?? null
    if (mmsiRow) outcome.mmsi = await vf.mmsi(mmsiRow.id)
  }

  if (imoRow && mmsiRow) outcome.doubts.push(...pairDoubts(imoRow, mmsiRow, outcome.imo?.mmsi ?? null))
  if (outcome.imo && v.imo === null && assignedImo.has(outcome.imo.imo)) outcome.doubts.push(`IMO ${outcome.imo.imo} already belongs to ${assignedImo.get(outcome.imo.imo)}`)
  if (outcome.mmsi && v.mmsi === null && assignedMmsi.has(outcome.mmsi.mmsi)) outcome.doubts.push(`MMSI ${outcome.mmsi.mmsi} already belongs to ${assignedMmsi.get(outcome.mmsi.mmsi)}`)

  collectFills(v, outcome, imoRow?.flag ?? mmsiRow?.flag ?? null)
  const foundAny = outcome.imo !== null || outcome.mmsi !== null
  outcome.status = outcome.doubts.length > 0 ? 'review' : foundAny ? 'matched' : 'none'
  return outcome
}

/** Validated registry values for the record's null fields; differences from set fields become conflicts. */
function collectFills(v: VesselRecord, o: Outcome, flagCode: string | null): void {
  const offer = <K extends keyof Fills>(key: K, current: unknown, value: Fills[K] | null | undefined, same = (a: unknown, b: unknown) => a === b) => {
    if (value === null || value === undefined) return
    if (current === null) o.fills[key] = value
    else if (!same(current, value)) o.conflicts.push(`${key}: record has ${String(current)}, registry says ${String(value)}`)
  }
  const valid = <T>(schema: { safeParse(x: unknown): { success: boolean; data?: T } }, x: unknown): T | null => {
    const r = schema.safeParse(x)
    return r.success ? (r.data as T) : null
  }
  if (o.imo) {
    offer('imo', v.imo, valid<number>(Imo, o.imo.imo))
    offer('gt', v.gt, o.imo.gt !== null && Number.isInteger(o.imo.gt) ? o.imo.gt : null)
    offer('built_year', v.built.year, o.imo.built !== null && o.imo.built >= 1850 && o.imo.built <= 2100 ? o.imo.built : null)
    // Registry LOA is to the centimeter, marketing LOA rounded; under a meter apart is the same boat.
    offer('loa_m', v.loa_m, o.imo.loa_m, (a, b) => Math.abs(Number(a) - Number(b)) < 1)
  }
  if (o.mmsi) {
    offer('mmsi', v.mmsi, valid<number>(Mmsi, o.mmsi.mmsi))
    offer('call_sign', v.call_sign, valid<string>(CallSign, o.mmsi.call_sign))
  }
  offer('flag', v.flag, valid<CountryCode>(CountryCode, flagCode?.toUpperCase()))
}

function apply(v: VesselRecord, o: Outcome): Vessel {
  const { name: _name, slug: _slug, url: _url, file: _file, ...record } = v
  const next: Vessel = structuredClone(record)
  const f = o.fills
  if (f.imo !== undefined) next.imo = f.imo
  if (f.mmsi !== undefined) next.mmsi = f.mmsi
  if (f.call_sign !== undefined) next.call_sign = f.call_sign
  if (f.flag !== undefined) next.flag = f.flag
  if (f.gt !== undefined) next.gt = f.gt
  if (f.built_year !== undefined) next.built.year = f.built_year
  if (f.loa_m !== undefined) next.loa_m = f.loa_m
  for (const id of [o.imo?.imo, o.mmsi?.mmsi]) {
    const url = id === undefined ? null : detailsUrl(id)
    if (url && !next.sources.includes(url)) next.sources.push(url)
  }
  return Vessel.parse(next)
}

let targets = vessels.filter((v) => v.status !== 'merged')
if (args.only?.length) targets = targets.filter((v) => args.only?.includes(v.id))
const pending = targets.filter((v) => !isComplete(v)).slice(0, args.limit ? Number(args.limit) : undefined)

const outcomes: Outcome[] = targets
  .filter(isComplete)
  .map((v) => ({ id: v.id, name: v.name, status: 'complete', evidence: [], doubts: [], imo: null, mmsi: null, options: [], fills: {}, conflicts: [] }))

console.log(`${pending.length} vessels to look up${args.offline ? ' (offline)' : ''}`)
let aborted: string | null = null
for (const [i, v] of pending.entries()) {
  let o: Outcome
  try {
    o = await identify(v)
  } catch (error) {
    if (error instanceof HttpError && (error.status === 403 || error.status === 429)) {
      aborted = `VesselFinder answered ${error.status}; stopped to stay polite. Cached pages are kept: rerun later to continue.`
      break
    }
    o = { id: v.id, name: v.name, status: 'error', evidence: [], doubts: [(error as Error).message], imo: null, mmsi: null, options: [], fills: {}, conflicts: [] }
  }
  outcomes.push(o)
  const fills = Object.entries(o.fills).map(([k, val]) => `${k}=${val}`).join(' ')
  console.log(`  [${i + 1}/${pending.length}] ${o.status.padEnd(7)} ${v.id} ${v.name}${fills ? `  ${fills}` : ''}${o.doubts.length ? `  (${o.doubts.join('; ')})` : ''}`)
}
if (aborted) console.error(`\n${aborted}`)

// Two of our vessels claiming the same hull can't both be right, so neither is written.
for (const key of ['imo', 'mmsi'] as const) {
  const claims = new Map<number, Outcome[]>()
  for (const o of outcomes) {
    const id = o.fills[key]
    if (id !== undefined) claims.set(id, [...(claims.get(id) ?? []), o])
  }
  for (const [id, claimants] of claims) {
    if (claimants.length < 2) continue
    for (const o of claimants) {
      o.doubts.push(`${key.toUpperCase()} ${id} is also proposed for ${claimants.filter((c) => c !== o).map((c) => c.id).join(', ')}`)
      o.status = 'review'
    }
    console.log(`  ${key.toUpperCase()} ${id} proposed for ${claimants.map((c) => c.name).join(' and ')}: sent to review`)
  }
}

let written = 0
if (args.write) {
  for (const o of outcomes) {
    if (o.status !== 'matched' || Object.keys(o.fills).length === 0) continue
    const v = vessels.find((x) => x.id === o.id)
    if (!v) continue
    await writeFile(path.join(root, v.file), vesselYaml(apply(v, o)))
    written++
  }
}

await mkdir(outDir, { recursive: true })
await writeFile(path.join(outDir, 'identify.json'), JSON.stringify(outcomes, null, 2) + '\n')
await writeFile(path.join(outDir, 'review.md'), reviewReport(outcomes))

const count = (s: Status) => outcomes.filter((o) => o.status === s).length
console.log(
  `\nmatched ${count('matched')} · review ${count('review')} · not found ${count('none')} · already complete ${count('complete')} · errors ${count('error')}`,
)
console.log(`Reports: ${path.relative(toolsDir, path.join(outDir, 'review.md'))}, ${path.relative(toolsDir, path.join(outDir, 'identify.json'))}`)
console.log(args.write ? `Wrote ${written} vessels. Run \`npm run check\` next.` : 'Dry run: nothing written. Add --write to fill data/.')
if (aborted) process.exit(2)

function reviewReport(all: Outcome[]): string {
  const row = (r: SearchRow) =>
    `| [${r.id}](${detailsUrl(r.id)}) | ${r.kind.toUpperCase()} | ${r.name} | ${r.type} | ${r.flag?.toUpperCase() ?? '—'} | ${r.length_m ?? '—'} m | ${r.built ?? '—'} |`
  const sections = all
    .filter((o) => o.status === 'review' || o.status === 'error' || o.conflicts.length > 0)
    .map((o) => {
      const lines = [`## ${o.name} (\`${o.id}\`) · ${o.status}`, '']
      for (const d of o.doubts) lines.push(`- Doubt: ${d}`)
      for (const e of o.evidence) lines.push(`- Evidence: ${e}`)
      for (const c of o.conflicts) lines.push(`- Conflict: ${c}`)
      if (o.imo) lines.push(`- Proposed IMO: [${o.imo.imo}](${detailsUrl(o.imo.imo)}) ${o.imo.name}, built ${o.imo.built ?? '?'}, ${o.imo.gt ?? '?'} GT`)
      if (o.mmsi) lines.push(`- Proposed MMSI: [${o.mmsi.mmsi}](${detailsUrl(o.mmsi.mmsi)}) ${o.mmsi.name}, call sign ${o.mmsi.call_sign ?? '?'}`)
      if (o.options.length) lines.push('', '| Record | Kind | Name | Type | Flag | Length | Built |', '|---|---|---|---|---|---|---|', ...o.options.map(row))
      return lines.join('\n')
    })
  return `# Registry review\n\nSet the right \`imo\` or \`mmsi\` in the vessel's YAML (or leave it null) and rerun \`npm run tools:registry\`.\n\n${sections.join('\n\n')}\n`
}
