import { randomInt } from 'node:crypto'
import type { OperatorId, VesselId } from '../schema/index.ts'

// Crockford base32, lowercase: no i, l, o, u.
const CROCKFORD = '0123456789abcdefghjkmnpqrstvwxyz'

function randomCode(length: number): string {
  let code = ''
  for (let i = 0; i < length; i++) code += CROCKFORD[randomInt(CROCKFORD.length)]
  return code
}

export function newVesselId(): VesselId {
  return `lvb_${randomCode(6)}` as VesselId
}

export function newOperatorId(): OperatorId {
  return `op_${randomCode(4)}` as OperatorId
}
