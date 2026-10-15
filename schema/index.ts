// Single source of truth for the data model. Every YAML file in data/ is parsed with these
// schemas; the TypeScript types and the editor JSON Schemas are derived from them.
import * as z from 'zod'
import { COUNTRY_CODES } from './countries.ts'

const CROCKFORD = '[0-9a-hjkmnp-tv-z]'
const CURRENT_YEAR = new Date().getFullYear()

// ---------- identifiers ----------

export const VESSEL_ID_PATTERN = new RegExp(`^lvb_${CROCKFORD}{6}$`)
export const OPERATOR_ID_PATTERN = new RegExp(`^op_${CROCKFORD}{4}$`)
export const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/

export const VesselId = z.string().regex(VESSEL_ID_PATTERN, 'must be lvb_ + 6 Crockford base32 characters, e.g. lvb_7k2m9q').brand<'VesselId'>()
export type VesselId = z.infer<typeof VesselId>

export const OperatorId = z.string().regex(OPERATOR_ID_PATTERN, 'must be op_ + 4 Crockford base32 characters, e.g. op_3fh8').brand<'OperatorId'>()
export type OperatorId = z.infer<typeof OperatorId>

export const RegionId = z.string().regex(SLUG_PATTERN, 'must be a lowercase slug, e.g. galapagos or red-sea').brand<'RegionId'>()
export type RegionId = z.infer<typeof RegionId>

// ---------- vocabularies ----------

export const CountryCode = z.enum(COUNTRY_CODES, { error: 'must be an ISO 3166-1 alpha-2 country code in capitals, e.g. EC' })
export type CountryCode = z.infer<typeof CountryCode>

export const HULL_MATERIALS = ['steel', 'wood', 'aluminium', 'fiberglass', 'composite'] as const
export const PROPULSIONS = ['motor', 'sail', 'motor_sail'] as const

export const HullMaterial = z.enum(HULL_MATERIALS)
export const Propulsion = z.enum(PROPULSIONS)

// <material>_<propulsion>, e.g. steel_motor, wood_motor_sail.
export const Hull = z.templateLiteral([HullMaterial, '_', Propulsion], {
  error: `must be <material>_<propulsion> with material ${HULL_MATERIALS.join('|')} and propulsion ${PROPULSIONS.join('|')}, e.g. steel_motor`,
})
export type Hull = z.infer<typeof Hull>

export const VESSEL_STATUSES = ['active', 'retired', 'lost', 'merged'] as const
export const VesselStatus = z.enum(VESSEL_STATUSES)
export type VesselStatus = z.infer<typeof VesselStatus>

export const OPERATOR_STATUSES = ['active', 'defunct', 'merged'] as const
export const OperatorStatus = z.enum(OPERATOR_STATUSES)
export type OperatorStatus = z.infer<typeof OperatorStatus>

// ---------- primitives ----------

const Text = z.string().regex(/^\S(.*\S)?$/, 'must be non-empty, without leading or trailing spaces')

const DATE_PATTERN = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/

function isRealDate(value: number | string): boolean {
  const match = DATE_PATTERN.exec(String(value))
  if (!match) return false
  const [, y, m, d] = match.map(Number) as [number, number, number?, number?]
  if (m === undefined || Number.isNaN(m)) return true
  if (m < 1 || m > 12) return false
  if (d === undefined || Number.isNaN(d)) return true
  return d >= 1 && d <= new Date(Date.UTC(y, m, 0)).getUTCDate()
}

// A year (2019) or a partial ISO date ("2019-05", "2019-05-14").
export const PartialDate = z
  .union([z.int().min(1850).max(2100), z.string().regex(DATE_PATTERN, 'must be YYYY, YYYY-MM or YYYY-MM-DD')])
  .refine(isRealDate, 'is not a real date')
export type PartialDate = z.infer<typeof PartialDate>

function isValidImo(imo: number): boolean {
  const digits = String(imo)
  let sum = 0
  for (let i = 0; i < 6; i++) sum += Number(digits[i]) * (7 - i)
  return sum % 10 === Number(digits[6])
}

export const Imo = z.int().min(1_000_000, 'must be 7 digits').max(9_999_999, 'must be 7 digits').refine(isValidImo, 'has an invalid IMO check digit')

// Ship-station MMSIs start with a Maritime Identification Digit from 2 to 7.
export const Mmsi = z.int().min(200_000_000, 'must be 9 digits starting with 2–7').max(799_999_999, 'must be 9 digits starting with 2–7')

export const CallSign = z.string().regex(/^[A-Z0-9][A-Z0-9-]{2,9}$/, 'must be 3–10 capital letters, digits or hyphens, e.g. HC-2081')

const Meters = z.number().positive().max(200, 'over 200 m is not a liveaboard')

const Sources = z
  .array(z.url({ protocol: /^https?$/, error: 'must be an http(s) URL' }))
  .refine((urls) => new Set(urls).size === urls.length, 'contains duplicate URLs')

// ---------- names ----------

export const NameEntry = z
  .strictObject({
    name: Text,
    from: PartialDate.nullable(),
    to: PartialDate.nullable(),
  })
  .refine((n) => n.from === null || n.to === null || String(n.from) <= String(n.to), { message: 'from must not be after to', path: ['to'] })
export type NameEntry = z.infer<typeof NameEntry>

const Names = z
  .array(NameEntry)
  .min(1, 'needs at least one name')
  .refine((names) => names.filter((n) => n.to === null).length <= 1, 'only one name can be current (to: null)')

// ---------- records ----------

export const VesselShape = z.strictObject({
  id: VesselId,
  names: Names,
  hull: Hull.nullable(),
  built: z.strictObject({
    year: z.int().min(1850).max(CURRENT_YEAR + 2).nullable(),
    yard: Text.nullable(),
  }),
  imo: Imo.nullable(),
  mmsi: Mmsi.nullable(),
  call_sign: CallSign.nullable(),
  flag: CountryCode.nullable(),
  loa_m: Meters.nullable(),
  beam_m: Meters.nullable(),
  gt: z.int().positive().max(100_000).nullable(),
  operator: OperatorId.nullable(),
  region: RegionId.nullable(),
  status: VesselStatus,
  merged_into: VesselId.nullable(),
  sources: Sources,
  notes: z.string(),
})

export const Vessel = VesselShape.superRefine((v, ctx) => {
  if (v.loa_m !== null && v.beam_m !== null && v.beam_m >= v.loa_m) {
    ctx.addIssue({ code: 'custom', path: ['beam_m'], message: 'must be smaller than loa_m' })
  }
  checkMerge(v, ctx)
})
export type Vessel = z.infer<typeof Vessel>

export const OperatorShape = z.strictObject({
  id: OperatorId,
  names: Names,
  country: CountryCode.nullable(),
  website: z.url({ protocol: /^https?$/, error: 'must be an http(s) URL' }).nullable(),
  status: OperatorStatus,
  merged_into: OperatorId.nullable(),
  sources: Sources,
  notes: z.string(),
})

export const Operator = OperatorShape.superRefine(checkMerge)
export type Operator = z.infer<typeof Operator>

export const Region = z.strictObject({
  id: RegionId,
  name: Text,
  countries: z.array(CountryCode).min(1, 'needs at least one country'),
})
export type Region = z.infer<typeof Region>

export const Regions = z.array(Region)

function checkMerge(record: { id: string; status: string; merged_into: string | null }, ctx: z.RefinementCtx): void {
  if (record.status === 'merged' && record.merged_into === null) {
    ctx.addIssue({ code: 'custom', path: ['merged_into'], message: 'is required when status is merged' })
  }
  if (record.status !== 'merged' && record.merged_into !== null) {
    ctx.addIssue({ code: 'custom', path: ['merged_into'], message: 'is only allowed when status is merged' })
  }
  if (record.merged_into === record.id) {
    ctx.addIssue({ code: 'custom', path: ['merged_into'], message: 'cannot point to itself' })
  }
}
