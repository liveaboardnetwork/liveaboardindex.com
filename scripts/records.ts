// Serializes records to the canonical YAML layout of data/, so hand edits, `npm run new`
// and importers all produce the same diff-friendly files.
import type { NameEntry, Operator, OperatorId, Vessel, VesselId } from '../schema/index.ts'

const RESERVED = /^(null|true|false|yes|no|on|off|~)$/i

function scalar(value: string | number | boolean | null): string {
  if (value === null) return 'null'
  if (typeof value !== 'string') return String(value)
  // No commas, braces or colons: names are written inside flow mappings ({ name: ... }).
  const plain = /^[A-Za-z][A-Za-z0-9 ._&()/'-]*$/.test(value) && !RESERVED.test(value) && !/\s$/.test(value)
  return plain ? value : JSON.stringify(value)
}

function names(list: NameEntry[]): string {
  return list.map((n) => `  - { name: ${scalar(n.name)}, from: ${scalar(n.from)}, to: ${scalar(n.to)} }`).join('\n')
}

function sources(list: string[]): string {
  return list.length ? `\n${list.map((s) => `  - ${s}`).join('\n')}` : ' []'
}

export function vesselYaml(v: Vessel): string {
  return `# yaml-language-server: $schema=../../schema/json/vessel.schema.json
id: ${v.id}
names:   # to: null = current
${names(v.names)}
hull: ${scalar(v.hull)}                # <material>_<propulsion>, e.g. steel_motor
built: { year: ${scalar(v.built.year)}, yard: ${scalar(v.built.yard)} }
imo: ${scalar(v.imo)}
mmsi: ${scalar(v.mmsi)}
call_sign: ${scalar(v.call_sign)}
flag: ${scalar(v.flag)}                # ISO country code, e.g. EC
loa_m: ${scalar(v.loa_m)}
beam_m: ${scalar(v.beam_m)}
gt: ${scalar(v.gt)}
refit_year: ${scalar(v.refit_year)}
guests: ${scalar(v.guests)}
cabins: ${scalar(v.cabins)}
operator: ${scalar(v.operator)}            # op_xxxx from data/operators
region: ${scalar(v.region)}              # id from data/regions.yaml
status: ${v.status}            # active | retired | lost | merged
merged_into: ${scalar(v.merged_into)}
external_ids: { liveaboard_com: ${scalar(v.external_ids.liveaboard_com)} }
sources:${sources(v.sources)}
notes: ${JSON.stringify(v.notes)}
`
}

export function operatorYaml(o: Operator): string {
  return `# yaml-language-server: $schema=../../schema/json/operator.schema.json
id: ${o.id}
names:   # to: null = current
${names(o.names)}
country: ${scalar(o.country)}             # ISO country code, e.g. EC
website: ${scalar(o.website)}
status: ${o.status}            # active | defunct | merged
merged_into: ${scalar(o.merged_into)}
external_ids: { liveaboard_com: ${scalar(o.external_ids.liveaboard_com)} }
sources:${sources(o.sources)}
notes: ${JSON.stringify(o.notes)}
`
}

export function emptyVessel(id: VesselId, name: string): Vessel {
  return {
    id,
    names: [{ name, from: null, to: null }],
    hull: null,
    built: { year: null, yard: null },
    imo: null,
    mmsi: null,
    call_sign: null,
    flag: null,
    loa_m: null,
    beam_m: null,
    gt: null,
    refit_year: null,
    guests: null,
    cabins: null,
    operator: null,
    region: null,
    status: 'active',
    merged_into: null,
    external_ids: { liveaboard_com: null },
    sources: [],
    notes: '',
  }
}

export function emptyOperator(id: OperatorId, name: string): Operator {
  return {
    id,
    names: [{ name, from: null, to: null }],
    country: null,
    website: null,
    status: 'active',
    merged_into: null,
    external_ids: { liveaboard_com: null },
    sources: [],
    notes: '',
  }
}
