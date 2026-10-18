// Decides which VesselFinder records, if any, are the same hull as one of our vessels.
// Pure functions: no I/O, so every rule here is unit-tested in match.test.ts.
import type { SearchRow } from './vesselfinder.ts'

const ROMAN: Record<string, string> = { I: '1', II: '2', III: '3', IV: '4', V: '5', VI: '6', VII: '7', VIII: '8', IX: '9', X: '10' }
// Hull-type prefixes registries add or drop: motor/sailing yacht, motor vessel, Indonesian
// Kapal Motor / Kapal Layar Motor, research vessel.
const PREFIX = /^(?:MY|MV|SY|MS|KM|KLM|RV)\s+/
const SUFFIX = /\s+(?:LIVEABOARD|LIVE ABOARD|YACHT)$/

/** Comparable form of a vessel name: "M/Y Galaxy Diver II" and "GALAXY DIVER 2" are equal. */
export function normalizeName(name: string): string {
  let n = name
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toUpperCase()
    .replace(/&/g, ' AND ')
    .replace(/\b([A-Z])\/([A-Z])\b/g, '$1$2')
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim()
  for (let prev = ''; prev !== n; ) {
    prev = n
    n = n.replace(PREFIX, '').replace(SUFFIX, '')
  }
  return n
    .split(' ')
    .map((token, i) => (i > 0 && ROMAN[token]) || token)
    .join(' ')
}

// AIS stores ship names in 20 characters; VesselFinder rejects queries over 32.
export const AIS_NAME_LENGTH = 20
const MAX_QUERY_LENGTH = 32

/**
 * What VesselFinder's search box should get: the name without prefixes or punctuation, numerals
 * untouched. Long names also get their first 20 characters, the most a transponder can broadcast.
 */
export function searchQueries(name: string): string[] {
  const q = name
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/^(?:M\/?Y|M\/?V|S\/?Y|KM|KLM)\.?\s+/i, '')
    .replace(/\s+(?:liveaboard|live aboard)$/i, '')
    .replace(/[^A-Za-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!q) return []
  const capped = q.length <= MAX_QUERY_LENGTH ? q : q.slice(0, q.lastIndexOf(' ', MAX_QUERY_LENGTH) > 0 ? q.lastIndexOf(' ', MAX_QUERY_LENGTH) : MAX_QUERY_LENGTH)
  return [...new Set([capped, ...(q.length > AIS_NAME_LENGTH ? [q.slice(0, AIS_NAME_LENGTH).trim()] : [])])]
}

/**
 * How a record's name relates to ours: `exact` after normalizing, or `truncated` when an AIS name
 * cut at 20 characters is the start of ours ("ALL STAR BLACKBEARDS" for "All Star Blackbeards Sea Explorer").
 */
export function nameMatch(ours: string, row: Pick<SearchRow, 'name' | 'kind'>): 'exact' | 'truncated' | null {
  const a = normalizeName(ours)
  const b = normalizeName(row.name)
  if (a === b) return 'exact'
  const cut = row.kind === 'mmsi' && row.name.trim().length >= AIS_NAME_LENGTH - 1
  return cut && b.length > 0 && a.startsWith(b) ? 'truncated' : null
}

// Types a liveaboard is registered or broadcast as. "Passenger" wins over anything else in the
// type: converted hulls keep combined types like "Passenger/Ro-Ro Cargo Ship".
const TRUSTED_TYPE = /diving|passenger|cruise|yacht|pleasure|sailing/i
// No type information at all: says nothing for or against. Common on small local transponders.
const UNKNOWN_TYPE = /^(?:unknown|other type|other|-)?$/i
// Types a liveaboard is never registered as.
const IMPOSSIBLE_TYPE = /tanker|cargo|container|bulk|carrier|tug|towing|dredg|supply|offshore|military|law enforce|pilot|search and rescue|anti.?pollution|port tender|reefer|ro-ro|barge/i

/** `unclear` is a real type that isn't a liveaboard's (fishing, for example): possible, never automatic. */
export type TypeTrust = 'trusted' | 'unknown' | 'unclear' | 'impossible'

/**
 * Registry (IMO) types are surveyed, so an impossible one rules the record out. AIS (MMSI) types are
 * whatever the crew keyed into the transponder, so there it only makes the match doubtful.
 */
export function typeTrust(type: string, kind: SearchRow['kind'] = 'imo'): TypeTrust {
  if (TRUSTED_TYPE.test(type)) return 'trusted'
  if (IMPOSSIBLE_TYPE.test(type)) return kind === 'imo' ? 'impossible' : 'unclear'
  return UNKNOWN_TYPE.test(type.trim()) ? 'unknown' : 'unclear'
}

/** Relative length difference, or null when either side is unknown. */
export function lengthDelta(ours: number | null, theirs: number | null): number | null {
  return ours && theirs ? Math.abs(ours - theirs) / ours : null
}

// AIS lengths are whole meters and often measured differently from marketing LOA; 15% absorbs that
// while still telling a 30 m boat from a 40 m one.
export const MAX_LENGTH_DELTA = 0.15
// Agreement this close counts as positive evidence, not just "not contradicting".
export const CLOSE_LENGTH_DELTA = 0.05

export interface Target {
  names: string[]
  loa_m: number | null
  /** Uppercase ISO codes of the vessel's region, e.g. ['EC']. */
  countries: string[]
}

export interface Candidate {
  row: SearchRow
  trust: TypeTrust
  name: 'exact' | 'truncated'
  flagInRegion: boolean
  delta: number | null
  /** Lengths disagree beyond MAX_LENGTH_DELTA. Our lengths come from booking sites and are often wrong, so this is a doubt, not a veto. */
  lengthConflict: boolean
}

/** Rows that could be this vessel: a matching name and a type a liveaboard can have. */
export function candidates(target: Target, rows: SearchRow[]): Candidate[] {
  const seen = new Set<number>()
  const out: Candidate[] = []
  for (const row of rows) {
    if (seen.has(row.id)) continue
    const matches = target.names.map((n) => nameMatch(n, row))
    const name = matches.includes('exact') ? 'exact' : matches.includes('truncated') ? 'truncated' : null
    if (!name) continue
    seen.add(row.id)
    const trust = typeTrust(row.type, row.kind)
    if (trust === 'impossible') continue
    const delta = lengthDelta(target.loa_m, row.length_m)
    out.push({
      row,
      trust,
      name,
      flagInRegion: row.flag !== null && target.countries.includes(row.flag.toUpperCase()),
      delta,
      lengthConflict: delta !== null && delta > MAX_LENGTH_DELTA,
    })
  }
  return out
}

// With this many same-name records the flag alone is weak evidence: a common name ("Valentina")
// has local namesakes, and the liveaboard itself may not be among them.
export const COMMON_NAME_RECORDS = 5

export type Decision = { status: 'none' } | { status: 'ambiguous'; options: Candidate[] } | { status: 'picked'; candidate: Candidate; evidence: string[]; doubts: string[] }

/**
 * Picks the one record of a kind (IMO or MMSI) that is this vessel. Same-name records are narrowed
 * first to those flagged in the vessel's region, then to those whose length agrees; a record only
 * wins if it is the last one standing.
 */
export function pick(all: Candidate[], kind: SearchRow['kind']): Decision {
  const pool = all.filter((c) => c.row.kind === kind)
  if (pool.length === 0) return { status: 'none' }
  const narrowed = [(c: Candidate) => c.flagInRegion, (c: Candidate) => !c.lengthConflict].reduce(
    (remaining, keep) => (remaining.length > 1 && remaining.some(keep) ? remaining.filter(keep) : remaining),
    pool,
  )
  const chosen = narrowed.length === 1 ? narrowed[0] : undefined
  if (!chosen) return { status: 'ambiguous', options: narrowed }

  const evidence: string[] = []
  const doubts: string[] = []
  const closeLength = chosen.delta !== null && chosen.delta <= CLOSE_LENGTH_DELTA
  if (pool.length > 1) evidence.push(`singled out from ${pool.length} same-name ${kind.toUpperCase()} records`)
  if (chosen.flagInRegion) evidence.push(`flag ${chosen.row.flag?.toUpperCase()} is in the region`)
  if (closeLength) evidence.push(`length within ${Math.round((chosen.delta ?? 0) * 100)}%`)
  if (chosen.name === 'truncated') doubts.push(`only the first ${AIS_NAME_LENGTH} characters match ("${chosen.row.name}")`)
  if (chosen.trust === 'unclear') doubts.push(`type "${chosen.row.type}" is not a passenger/diving/yacht type`)
  if (chosen.lengthConflict) doubts.push(`length ${chosen.row.length_m} m is ${Math.round((chosen.delta ?? 0) * 100)}% off ours`)
  if (!chosen.flagInRegion && !closeLength) doubts.push('neither the flag nor a close length confirms it')
  else if (pool.length >= COMMON_NAME_RECORDS && !closeLength) doubts.push(`common name (${pool.length} records) and no close length to confirm it`)
  return { status: 'picked', candidate: chosen, evidence, doubts }
}

/** IMO and MMSI picks must describe the same hull to be used together. */
export function pairDoubts(imo: SearchRow, mmsi: SearchRow, linkedMmsi: number | null): string[] {
  const doubts: string[] = []
  if (linkedMmsi !== null && linkedMmsi !== mmsi.id) doubts.push(`IMO ${imo.id} is linked to MMSI ${linkedMmsi}, not ${mmsi.id}`)
  if (imo.flag && mmsi.flag && imo.flag !== mmsi.flag) doubts.push(`IMO record flag ${imo.flag.toUpperCase()} ≠ AIS flag ${mmsi.flag.toUpperCase()}`)
  const delta = lengthDelta(imo.length_m, mmsi.length_m)
  if (delta !== null && delta > MAX_LENGTH_DELTA) doubts.push(`IMO length ${imo.length_m} m vs AIS ${mmsi.length_m} m`)
  return doubts
}
