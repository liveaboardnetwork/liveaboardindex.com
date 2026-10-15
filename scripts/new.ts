// Usage: npm run new -- boat "Calipso"
//        npm run new -- operator "Ecoventura"
import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { root } from './data.ts'
import { newOperatorId, newVesselId } from './ids.ts'

type Kind = 'boat' | 'operator'

const kinds: Record<Kind, { dir: string; schema: string; newId: () => string; body: (id: string, name: string) => string }> = {
  boat: { dir: 'vessels', schema: 'vessel', newId: newVesselId, body: boatBody },
  operator: { dir: 'operators', schema: 'operator', newId: newOperatorId, body: operatorBody },
}

const [kindArg, ...nameParts] = process.argv.slice(2)
const name = nameParts.join(' ').trim()

if ((kindArg !== 'boat' && kindArg !== 'operator') || !name) {
  console.error('Usage: npm run new -- <boat|operator> "<name>"')
  process.exit(1)
}

const kind = kinds[kindArg]
const folder = path.join(root, 'data', kind.dir)
await mkdir(folder, { recursive: true })

let id: string
do id = kind.newId()
while (existsSync(path.join(folder, `${id}.yaml`)))

const file = path.join(folder, `${id}.yaml`)
const header = `# yaml-language-server: $schema=../../schema/json/${kind.schema}.schema.json\n`
await writeFile(file, header + kind.body(id, JSON.stringify(name)))
console.log(path.relative(root, file))

function boatBody(id: string, name: string): string {
  return `id: ${id}
names:
  - { name: ${name}, from: null, to: null }   # to: null = current
hull: null                # <material>_<propulsion>, e.g. steel_motor
built: { year: null, yard: null }
imo: null
mmsi: null
call_sign: null
flag: null                # ISO country code, e.g. EC
loa_m: null
beam_m: null
gt: null
operator: null            # op_xxxx from data/operators
region: null              # id from data/regions.yaml
status: active            # active | retired | lost | merged
merged_into: null
sources: []
notes: ""
`
}

function operatorBody(id: string, name: string): string {
  return `id: ${id}
names:
  - { name: ${name}, from: null, to: null }   # to: null = current
country: null             # ISO country code, e.g. EC
website: null
status: active            # active | defunct | merged
merged_into: null
sources: []
notes: ""
`
}
