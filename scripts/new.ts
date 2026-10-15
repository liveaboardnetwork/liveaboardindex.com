// Usage: npm run new -- boat "Calipso"
//        npm run new -- operator "Ecoventura"
import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { root } from './data.ts'
import { newOperatorId, newVesselId } from './ids.ts'
import { emptyOperator, emptyVessel, operatorYaml, vesselYaml } from './records.ts'

const [kind, ...nameParts] = process.argv.slice(2)
const name = nameParts.join(' ').trim()

if ((kind !== 'boat' && kind !== 'operator') || !name) {
  console.error('Usage: npm run new -- <boat|operator> "<name>"')
  process.exit(1)
}

const folder = path.join(root, 'data', kind === 'boat' ? 'vessels' : 'operators')
await mkdir(folder, { recursive: true })

function freshId<T extends string>(make: () => T): T {
  let id: T
  do id = make()
  while (existsSync(path.join(folder, `${id}.yaml`)))
  return id
}

const body = kind === 'boat' ? vesselYaml(emptyVessel(freshId(newVesselId), name)) : operatorYaml(emptyOperator(freshId(newOperatorId), name))
const id = /^id: (\S+)$/m.exec(body)?.[1] ?? ''
const file = path.join(folder, `${id}.yaml`)
await writeFile(file, body)
console.log(path.relative(root, file))
