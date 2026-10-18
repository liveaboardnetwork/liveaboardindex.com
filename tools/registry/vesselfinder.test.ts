import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parseImoPage, parseMmsiPage, parseSearch } from './vesselfinder.ts'

// Trimmed from real VesselFinder pages (October 2026).
const SEARCH = `
<div class="pagination-totals">2 ships</div><span>page 1 / 1</span>
<table class="results"><tr><th>Vessel</th></tr>
<tr>    <td class="v2"><a class="ship-link" href="/vessels/details/312611000">
  <div class="flag-icon-med flag-icon" style="background-image: url(https://static.vesselfinder.net/images/flags/4x3/bz.svg)" title="Belize"></div>
  <div class="slna">BELIZE AGGRESSOR III</div>
  <div class="slty">Diving ops</div></a></td>
  <td class="v3 hidden-mobile">-</td><td class="v4 hidden-mobile">-</td>
  <td class="v5 hidden-mobile">-</td><td class="v6 hidden-mobile">34 / 6</td></tr>
<tr>    <td class="v2"><a class="ship-link" href="/vessels/details/8972417">
  <div class="flag-icon-med flag-icon" style="background-image: url(https://static.vesselfinder.net/images/flags/4x3/bz.svg)" title="Belize"></div>
  <div class="slna">BELIZE AGGRESSOR III</div>
  <div class="slty">Passenger (Cruise) Ship</div></a></td>
  <td class="v3 hidden-mobile">1994</td><td class="v4 hidden-mobile">188</td>
  <td class="v5 hidden-mobile">-</td><td class="v6 hidden-mobile">-</td></tr>
</table>`

const MMSI = `<title>BELIZE AGGRESSOR III, Diving ops - Details and current position - MMSI 312611000 - VesselFinder</title>
<div class="djson" data-json='{ "v":true,"mmsi":312611000,"ship_lat":17,"ship_lon":-88,"ship_type":34}'></div>
<tr><td class="n3">MMSI</td><td class="v3 v3np">312611000</td></tr>
<tr><td class="n3">Callsign</td><td class="v3">V3PP5</td></tr>
<tr><td class="n3">AIS Type</td><td class="v3">Diving ops</td></tr>
<tr><td class="n3">Length / Beam</td><td class="v3">34 / 6 m</td></tr>`

const IMO = `<title>BELIZE AGGRESSOR III, Passenger (Cruise) Ship - IMO 8972417 - VesselFinder</title>
<div class="djson" data-json='{ "v":false,"mmsi":0,"ship_lat":91,"ship_lon":181}'></div>
<tr><td class="tpc1">Vessel Name</td><td class="tpc2">BELIZE AGGRESSOR III</td></tr>
<tr><td class="tpc1">Ship Type</td><td class="tpc2">Passenger (Cruise) Ship</td></tr>
<tr><td class="tpc1">Year of Build</td><td class="tpc2">1994</td></tr>
<tr><td class="tpc1">Length Overall <small>(m)</small></td><td class="tpc2">33.53</td></tr>
<tr><td class="tpc1">Gross Tonnage</td><td class="tpc2">188</td></tr>`

test('parseSearch reads both record kinds with flag, build year, tonnage and dimensions', () => {
  const page = parseSearch(SEARCH)
  assert.equal(page.total, 2)
  assert.equal(page.pages, 1)
  assert.deepEqual(page.rows, [
    { id: 312611000, kind: 'mmsi', name: 'BELIZE AGGRESSOR III', type: 'Diving ops', flag: 'bz', built: null, gt: null, length_m: 34, beam_m: 6 },
    { id: 8972417, kind: 'imo', name: 'BELIZE AGGRESSOR III', type: 'Passenger (Cruise) Ship', flag: 'bz', built: 1994, gt: 188, length_m: null, beam_m: null },
  ])
})

test('parseSearch handles an empty result', () => {
  assert.deepEqual(parseSearch('<div class="pagination-totals">0 ships</div>'), { total: 0, pages: 0, rows: [] })
})

test('parseMmsiPage reads call sign, AIS type, dimensions and position', () => {
  assert.deepEqual(parseMmsiPage(312611000, MMSI), {
    mmsi: 312611000,
    name: 'BELIZE AGGRESSOR III',
    call_sign: 'V3PP5',
    ais_type: 'Diving ops',
    length_m: 34,
    beam_m: 6,
    position: { lat: 17, lon: -88 },
  })
})

test('parseImoPage reads registry particulars and treats mmsi 0 and the 91/181 position as unknown', () => {
  assert.deepEqual(parseImoPage(8972417, IMO), {
    imo: 8972417,
    name: 'BELIZE AGGRESSOR III',
    type: 'Passenger (Cruise) Ship',
    built: 1994,
    gt: 188,
    loa_m: 33.53,
    mmsi: null,
  })
})
