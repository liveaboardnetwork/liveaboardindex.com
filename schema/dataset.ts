import type { Operator, OperatorId, Region, RegionId, Vessel, VesselId } from './index.ts'

// Fields computed at build time from the YAML records.
export interface Derived {
  name: string
  slug: string
  url: string
  file: string
}

export type VesselRecord = Vessel & Derived
export type OperatorRecord = Operator & Derived

export interface Dataset {
  vessels: VesselRecord[]
  operators: OperatorRecord[]
  regions: Region[]
  vesselById: Map<VesselId, VesselRecord>
  operatorById: Map<OperatorId, OperatorRecord>
  regionById: Map<RegionId, Region>
}
