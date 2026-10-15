// Shapes of the public JSON API. Shared by the build (which writes the files) and the docs (which describe them).
import type { OperatorRecord, VesselRecord } from '../schema/dataset.ts'

export const API_BASE = '/api/v1'

export function publicRecord<T extends { file: string; slug: string }>(record: T): Omit<T, 'file' | 'slug'> {
  const { file: _file, slug: _slug, ...rest } = record
  return rest
}

export type PublicVessel = ReturnType<typeof publicRecord<VesselRecord>>
export type PublicOperator = ReturnType<typeof publicRecord<OperatorRecord>>

export function compactVessel(v: VesselRecord) {
  return {
    id: v.id,
    name: v.name,
    url: v.url,
    imo: v.imo,
    mmsi: v.mmsi,
    flag: v.flag,
    region: v.region,
    operator: v.operator,
    hull: v.hull,
    loa_m: v.loa_m,
    guests: v.guests,
    cabins: v.cabins,
    status: v.status,
  }
}

export type CompactVessel = ReturnType<typeof compactVessel>

export function compactOperator(o: OperatorRecord, boats: number) {
  return {
    id: o.id,
    name: o.name,
    url: o.url,
    country: o.country,
    status: o.status,
    boats,
  }
}

export type CompactOperator = ReturnType<typeof compactOperator>
