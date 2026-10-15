// Writes JSON Schemas for the YAML files so the editor autocompletes and flags errors.
// Region and operator IDs are inlined as enums, so rerun this after adding either.
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import YAML from 'yaml'
import * as z from 'zod'
import { OperatorId, OperatorShape, RegionId, Regions, VesselShape } from '../schema/index.ts'
import { root } from './data.ts'

async function regionIds(): Promise<string[]> {
  const raw: unknown = YAML.parse(await readFile(path.join(root, 'data/regions.yaml'), 'utf8').catch(() => '[]'))
  return Array.isArray(raw) ? raw.flatMap((r: unknown) => (r && typeof r === 'object' && 'id' in r && typeof r.id === 'string' ? [r.id] : [])) : []
}

async function operatorIds(): Promise<string[]> {
  const files = await readdir(path.join(root, 'data/operators')).catch(() => [])
  return files.filter((f) => f.endsWith('.yaml')).map((f) => f.replace(/\.yaml$/, ''))
}

function oneOf(ids: string[], fallback: z.ZodType): z.ZodType {
  const [first, ...rest] = ids
  return first === undefined ? fallback : z.enum([first, ...rest])
}

const vessel = VesselShape.extend({
  region: oneOf(await regionIds(), RegionId).nullable(),
  operator: oneOf(await operatorIds(), OperatorId).nullable(),
})

const schemas: Record<string, z.ZodType> = {
  vessel,
  operator: OperatorShape,
  regions: Regions,
}

const outDir = path.join(root, 'schema/json')
await mkdir(outDir, { recursive: true })
for (const [name, schema] of Object.entries(schemas)) {
  const json = z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' })
  await writeFile(path.join(outDir, `${name}.schema.json`), JSON.stringify(json, null, 2) + '\n')
}
console.log(`Wrote ${Object.keys(schemas).length} JSON Schemas to schema/json/`)
