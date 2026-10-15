// Usage: npm run new -- boat "Calipso"
//        npm run new -- operator "Ecoventura"
import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { newOperatorId, newVesselId } from './ids.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const [kind, ...nameParts] = process.argv.slice(2)
const name = nameParts.join(' ').trim()

const kinds = {
  boat: { dir: 'vessels', newId: newVesselId, template: boatTemplate },
  operator: { dir: 'operators', newId: newOperatorId, template: operatorTemplate },
}

if (!kinds[kind] || !name) {
  console.error('Usage: npm run new -- <boat|operator> "<name>"')
  process.exit(1)
}

const { dir, newId, template } = kinds[kind]
const folder = path.join(root, 'data', dir)
await mkdir(folder, { recursive: true })

let id
do id = newId()
while (existsSync(path.join(folder, `${id}.yaml`)))

const file = path.join(folder, `${id}.yaml`)
await writeFile(file, template(id, JSON.stringify(name)))
console.log(path.relative(root, file))

function boatTemplate(id, name) {
  return `id: ${id}
names:
  - { name: ${name}, from: null, to: null }   # to: null = current
hull: null
built: { year: null, yard: null }
imo: null
mmsi: null
call_sign: null
flag: null
loa_m: null
beam_m: null
gt: null
operator: null
region: null
status: active            # active | retired | lost | merged
merged_into: null
sources: []
notes: ""
`
}

function operatorTemplate(id, name) {
  return `id: ${id}
names:
  - { name: ${name}, from: null, to: null }   # to: null = current
country: null
website: null
status: active            # active | defunct | merged
merged_into: null
sources: []
notes: ""
`
}
