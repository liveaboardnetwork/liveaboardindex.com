import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import YAML from 'yaml'
import type * as z from 'zod'
import type { Dataset, Derived } from '../schema/dataset.ts'
import { EXTERNAL_ID_KEYS, Operator, Regions, Vessel } from '../schema/index.ts'
import type { Region, RegionId } from '../schema/index.ts'

export type { Dataset, OperatorRecord, VesselRecord } from '../schema/dataset.ts'

export const root = path.resolve(import.meta.dirname, '..')

export type LoadResult = { ok: true; data: Dataset } | { ok: false; errors: string[] }

export function slugify(text: string): string {
  const slug = text
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug || 'unnamed'
}

function formatIssues(file: string, error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const where = issue.path.length ? issue.path.join('.') : '(root)'
    return `${file}: ${where}: ${issue.message}`
  })
}

async function readYaml(rel: string, errors: string[]): Promise<unknown> {
  try {
    return YAML.parse(await readFile(path.join(root, rel), 'utf8'))
  } catch (error) {
    errors.push(`${rel}: invalid YAML (${(error as Error).message.split('\n')[0]})`)
    return undefined
  }
}

async function loadRecords<T extends { id: string }>(dir: string, schema: z.ZodType<T>, errors: string[]): Promise<Array<{ file: string; record: T }>> {
  const files = (await readdir(path.join(root, 'data', dir)).catch(() => [])).filter((f) => f.endsWith('.yaml')).sort()
  const out: Array<{ file: string; record: T }> = []
  for (const name of files) {
    const file = `data/${dir}/${name}`
    const raw = await readYaml(file, errors)
    if (raw === undefined) continue
    const parsed = schema.safeParse(raw)
    if (!parsed.success) {
      errors.push(...formatIssues(file, parsed.error))
      continue
    }
    if (name !== `${parsed.data.id}.yaml`) {
      errors.push(`${file}: file must be named ${parsed.data.id}.yaml`)
      continue
    }
    out.push({ file, record: parsed.data })
  }
  return out
}

function derive<T extends { names: Array<{ name: string; to: unknown }> }>(record: T, section: string, id: string, file: string): T & Derived {
  const current = record.names.find((n) => n.to === null) ?? record.names.at(-1)
  const name = current?.name ?? id
  const slug = slugify(name)
  return { ...record, name, slug, url: `/${section}/${id}/${slug}`, file }
}

export async function loadDataset(): Promise<LoadResult> {
  const errors: string[] = []

  const regionsFile = 'data/regions.yaml'
  const regionsRaw = await readYaml(regionsFile, errors)
  const regionsParsed = Regions.safeParse(regionsRaw ?? [])
  const regions = regionsParsed.success ? regionsParsed.data : []
  if (!regionsParsed.success) errors.push(...formatIssues(regionsFile, regionsParsed.error))

  const operators = (await loadRecords('operators', Operator, errors)).map(({ file, record }) => derive(record, 'operators', record.id, file))
  const vessels = (await loadRecords('vessels', Vessel, errors)).map(({ file, record }) => derive(record, 'boats', record.id, file))

  const regionById = new Map<RegionId, Region>()
  for (const region of regions) {
    if (regionById.has(region.id)) errors.push(`${regionsFile}: region ${region.id} is defined twice`)
    regionById.set(region.id, region)
  }
  const operatorById = new Map(operators.map((o) => [o.id, o]))
  const vesselById = new Map(vessels.map((v) => [v.id, v]))

  for (const o of operators) checkMergeTarget(o, operatorById, errors)

  for (const v of vessels) {
    checkMergeTarget(v, vesselById, errors)
    if (v.operator !== null && !operatorById.has(v.operator)) errors.push(`${v.file}: operator: ${v.operator} does not exist in data/operators`)
    if (v.region !== null && !regionById.has(v.region)) errors.push(`${v.file}: region: ${v.region} is not defined in ${regionsFile}`)
  }

  checkUnique(vessels, 'imo', (v) => v.imo, errors)
  checkUnique(vessels, 'mmsi', (v) => v.mmsi, errors)
  for (const key of EXTERNAL_ID_KEYS) {
    checkUnique(vessels, `external_ids.${key}`, (v) => v.external_ids[key], errors)
    checkUnique(operators, `external_ids.${key}`, (o) => o.external_ids[key], errors)
  }

  if (errors.length) return { ok: false, errors }

  // A merged record resolves to the surviving record's canonical URL.
  for (const v of vessels) if (v.merged_into) v.url = vesselById.get(v.merged_into)!.url
  for (const o of operators) if (o.merged_into) o.url = operatorById.get(o.merged_into)!.url

  return { ok: true, data: { vessels, operators, regions, vesselById, operatorById, regionById } }
}

function checkMergeTarget<T extends { file: string; merged_into: string | null; status: string }>(record: T, byId: Map<string, T>, errors: string[]): void {
  if (record.merged_into === null) return
  const target = byId.get(record.merged_into)
  if (!target) errors.push(`${record.file}: merged_into: ${record.merged_into} does not exist`)
  else if (target.status === 'merged') errors.push(`${record.file}: merged_into: ${record.merged_into} is itself merged; point to the surviving record`)
}

function checkUnique<T extends { id: string; file: string; status: string }>(
  records: T[],
  label: string,
  get: (record: T) => number | null,
  errors: string[],
): void {
  const seen = new Map<number, T>()
  for (const record of records) {
    const value = get(record)
    if (value === null || record.status === 'merged') continue
    const other = seen.get(value)
    if (other) errors.push(`${record.file}: ${label}: ${value} is already used by ${other.id}`)
    else seen.set(value, record)
  }
}
