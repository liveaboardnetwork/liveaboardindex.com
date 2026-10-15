// Rewrites every record in data/ in the canonical layout from records.ts.
import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import { loadDataset, root } from './data.ts'
import { operatorYaml, vesselYaml } from './records.ts'
import type { OperatorRecord, VesselRecord } from './data.ts'
import type { Operator, Vessel } from '../schema/index.ts'

const result = await loadDataset()
if (!result.ok) {
  console.error(`Fix data errors first (npm run check):\n  - ${result.errors.join('\n  - ')}`)
  process.exit(1)
}

function strip<T extends VesselRecord | OperatorRecord>(record: T): Omit<T, 'name' | 'slug' | 'url' | 'file'> {
  const { name: _name, slug: _slug, url: _url, file: _file, ...rest } = record
  return rest
}

const { vessels, operators } = result.data
await Promise.all([
  ...vessels.map((v) => writeFile(path.join(root, v.file), vesselYaml(strip(v) as Vessel))),
  ...operators.map((o) => writeFile(path.join(root, o.file), operatorYaml(strip(o) as Operator))),
])
console.log(`Formatted ${vessels.length} vessels and ${operators.length} operators.`)
