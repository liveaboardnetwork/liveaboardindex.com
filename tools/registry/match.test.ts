import assert from 'node:assert/strict'
import { test } from 'node:test'
import { candidates, nameMatch, normalizeName, pairDoubts, pick, searchQueries, typeTrust } from './match.ts'
import type { SearchRow } from './vesselfinder.ts'

const row = (over: Partial<SearchRow>): SearchRow => ({
  id: 312611000,
  kind: 'mmsi',
  name: 'BELIZE AGGRESSOR III',
  type: 'Diving ops',
  flag: 'bz',
  built: null,
  gt: null,
  length_m: 34,
  beam_m: 6,
  ...over,
})

const target = { names: ['Belize Aggressor III'], loa_m: 33.5, countries: ['BZ'] }

test('normalizeName ignores case, punctuation, hull prefixes and roman numerals', () => {
  assert.equal(normalizeName('M/Y Galaxy Diver II'), 'GALAXY DIVER 2')
  assert.equal(normalizeName('GALAXY DIVER 2'), 'GALAXY DIVER 2')
  assert.equal(normalizeName('KLM Tiburón Explorer'), 'TIBURON EXPLORER')
  assert.equal(normalizeName('Amba Liveaboard'), 'AMBA')
  assert.equal(normalizeName("Nai'a"), 'NAI A')
  // A lone roman numeral as the first word is a name, not a number.
  assert.equal(normalizeName('V Explorer'), 'V EXPLORER')
})

test('searchQueries keep the registry spelling but drop prefixes and punctuation', () => {
  assert.deepEqual(searchQueries('M/Y Galaxy Diver II'), ['Galaxy Diver II'])
  assert.deepEqual(searchQueries('Poseidon Liveaboard'), ['Poseidon'])
  assert.deepEqual(searchQueries('Tiburón Explorer'), ['Tiburon Explorer'])
  assert.deepEqual(searchQueries('!!!'), [])
})

test('searchQueries add the 20-character AIS form and stay within 32 characters', () => {
  assert.deepEqual(searchQueries('All Star Blackbeards Sea Explorer'), ['All Star Blackbeards Sea', 'All Star Blackbeards'])
  for (const q of searchQueries('Maldives Legend Sea Pleasure Extra Long Name')) assert.ok(q.length <= 32)
})

test('nameMatch accepts AIS names cut at 20 characters, only for transponder records', () => {
  assert.equal(nameMatch('Belize Aggressor III', { name: 'BELIZE AGGRESSOR 3', kind: 'imo' }), 'exact')
  assert.equal(nameMatch('All Star Blackbeards Sea Explorer', { name: 'ALL STAR BLACKBEARDS', kind: 'mmsi' }), 'truncated')
  assert.equal(nameMatch('All Star Blackbeards Sea Explorer', { name: 'ALL STAR BLACKBEARDS', kind: 'imo' }), null)
  assert.equal(nameMatch('Galaxy Diver II', { name: 'GALAXY', kind: 'mmsi' }), null)
})

test('typeTrust separates liveaboard types from impossible ones', () => {
  assert.equal(typeTrust('Diving ops'), 'trusted')
  assert.equal(typeTrust('Passenger (Cruise) Ship'), 'trusted')
  assert.equal(typeTrust('Passenger/Ro-Ro Cargo Ship'), 'trusted')
  assert.equal(typeTrust('Pleasure craft'), 'trusted')
  assert.equal(typeTrust('Unknown'), 'unknown')
  assert.equal(typeTrust('Other type'), 'unknown')
  assert.equal(typeTrust('Fishing vessel'), 'unclear')
  assert.equal(typeTrust('Crude Oil Tanker'), 'impossible')
  assert.equal(typeTrust('Tug'), 'impossible')
  // A transponder's type is self-declared: suspicious, not disqualifying.
  assert.equal(typeTrust('Towing vessel', 'mmsi'), 'unclear')
})

test('pick doubts a common name singled out by flag alone', () => {
  const rows = [row({ flag: 'mx', length_m: null }), ...[1, 2, 3, 4].map((i) => row({ id: 311000000 + i, flag: 'us', length_m: null }))]
  const p = pick(candidates({ ...target, countries: ['MX'] }, rows), 'mmsi')
  assert.equal(p.status, 'picked')
  if (p.status === 'picked') assert.deepEqual(p.doubts, ['common name (5 records) and no close length to confirm it'])
})

test('candidates keep exact-name rows, drop impossible types and flag length contradictions', () => {
  const found = candidates(target, [
    row({}),
    row({}), // duplicate id
    row({ id: 312881000, name: 'BELIZE AGGRESSOR IV', length_m: 40 }),
    row({ id: 9999999, kind: 'imo', type: 'Tug' }),
    row({ id: 311000000, length_m: 60 }),
  ])
  assert.deepEqual(
    found.map((c) => [c.row.id, c.flagInRegion, c.lengthConflict]),
    [
      [312611000, true, false],
      [311000000, true, true],
    ],
  )
})

test('pick uses length to break a tie between same-name records in the region', () => {
  const p = pick(candidates(target, [row({}), row({ id: 311000000, length_m: 60 })]), 'mmsi')
  assert.equal(p.status, 'picked')
  if (p.status === 'picked') assert.equal(p.candidate.row.id, 312611000)
})

test('pick doubts a lone record whose length contradicts ours instead of dropping it', () => {
  const p = pick(candidates({ names: ['Galaxy Diver II'], loa_m: 29, countries: ['EC'] }, [row({ id: 9638721, kind: 'imo', name: 'GALAXY DIVER II', flag: 'ec', length_m: 37 })]), 'imo')
  assert.equal(p.status, 'picked')
  if (p.status === 'picked') assert.deepEqual(p.doubts, ['length 37 m is 28% off ours'])
})

test('pick does not doubt a transponder that broadcasts no type', () => {
  const p = pick(candidates(target, [row({ type: 'Unknown' })]), 'mmsi')
  assert.equal(p.status, 'picked')
  if (p.status === 'picked') assert.deepEqual(p.doubts, [])
})

test('pick takes a single candidate and reports why', () => {
  const p = pick(candidates(target, [row({})]), 'mmsi')
  assert.equal(p.status, 'picked')
  if (p.status !== 'picked') return
  assert.deepEqual(p.doubts, [])
  assert.ok(p.evidence.some((e) => e.includes('flag BZ')))
})

test('pick narrows same-name records to the one flagged in the region', () => {
  const rows = [row({ id: 735023481, name: 'CALIPSO', flag: 'ec', length_m: null }), row({ id: 247000000, name: 'CALIPSO', flag: 'it', length_m: null })]
  const p = pick(candidates({ names: ['Calipso'], loa_m: 32, countries: ['EC'] }, rows), 'mmsi')
  assert.equal(p.status, 'picked')
  if (p.status === 'picked') assert.equal(p.candidate.row.id, 735023481)
})

test('pick is ambiguous when nothing singles out a record', () => {
  const rows = [row({ id: 247000000, name: 'CALIPSO', flag: 'it' }), row({ id: 228000000, name: 'CALIPSO', flag: 'fr' })]
  assert.equal(pick(candidates({ names: ['Calipso'], loa_m: null, countries: ['EC'] }, rows), 'mmsi').status, 'ambiguous')
})

test('pick doubts a lone match that neither flag nor length confirms', () => {
  const p = pick(candidates({ ...target, countries: ['EG'], loa_m: null }, [row({})]), 'mmsi')
  assert.equal(p.status, 'picked')
  if (p.status === 'picked') assert.equal(p.doubts.length, 1)
})

test('pairDoubts catches IMO and MMSI records that are different hulls', () => {
  const imo = row({ id: 8972417, kind: 'imo', length_m: null })
  assert.deepEqual(pairDoubts(imo, row({}), null), [])
  assert.equal(pairDoubts(imo, row({}), 312881000).length, 1)
  assert.equal(pairDoubts(row({ id: 8972417, kind: 'imo', flag: 'us' }), row({}), null).length, 1)
})
