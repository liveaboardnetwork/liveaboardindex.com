import { randomInt } from 'node:crypto'

// Crockford base32, lowercase: no i, l, o, u.
export const CROCKFORD = '0123456789abcdefghjkmnpqrstvwxyz'

export const VESSEL_ID = /^lvb_[0-9a-hjkmnp-tv-z]{6}$/
export const OPERATOR_ID = /^op_[0-9a-hjkmnp-tv-z]{4}$/

export function randomCode(length) {
  let code = ''
  for (let i = 0; i < length; i++) code += CROCKFORD[randomInt(CROCKFORD.length)]
  return code
}

export function newVesselId() {
  return `lvb_${randomCode(6)}`
}

export function newOperatorId() {
  return `op_${randomCode(4)}`
}
