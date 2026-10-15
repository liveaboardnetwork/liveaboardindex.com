// Maps liveaboard.com labels and free-text specs onto the closed vocabularies in schema/vocab.ts.
// Every label they use must be listed: a vocabulary key, or null to drop it on purpose
// (marketing, booking policy or route info rather than a fact about the vessel).
// Unknown labels make the import fail so they get mapped instead of silently lost.
import type { CabinType, Engines } from '../../schema/index.ts'
import { ENGINE_MAKES, LANGUAGE_CODES } from '../../schema/vocab.ts'
import type { Amenity, CabinDeck, CabinWindow, DiningOption, DiveFacility, EngineMake, LanguageCode, SafetyItem } from '../../schema/vocab.ts'
import type { LiveaboardBoat, LiveaboardCabin } from './parse.ts'

export const AMENITY_LABELS: Record<string, Amenity | null> = {
  'En-Suite bathrooms': 'ensuite_bathrooms',
  'Aircon Cabins': 'aircon_cabins',
  'Seaview Cabins': 'seaview_cabins',
  'Family Cabins': 'family_cabins',
  'Non-Smoking Rooms': 'non_smoking_cabins',
  'TV in cabins': 'tv_in_cabins',
  'Warm Water Showers': 'hot_showers',
  'Outside Showers': 'outside_showers',
  'Indoor Saloon': 'indoor_saloon',
  'Air Conditioned saloon': 'aircon_saloon',
  'Outdoor Dining': 'outdoor_dining',
  Bar: 'bar',
  'BBQ Area': 'bbq',
  'Sun Deck': 'sun_deck',
  'Observation Deck': 'observation_deck',
  'Leisure Deck': 'leisure_deck',
  'Jacuzzi / Hot Tub': 'jacuzzi',
  Library: 'library',
  'Audio & video entertainment': 'entertainment',
  'Free Internet': 'internet',
  'Paid Internet': 'internet',
  'Charging stations': 'charging_stations',
  'Camera Station': 'camera_station',
  'Camera room': 'camera_station',
  'Separate Rinse for u/w Camera': 'camera_rinse',
  'Laundry Service': 'laundry',
  'Daily housekeeping': 'housekeeping',
  'Kayaks On-Board': 'kayaks',
  'Snorkeling Equipment': 'snorkeling_gear',
  'Naturalist Guide': 'naturalist_guide',
  'Non-Diver (Snorkeler) Friendly': 'non_diver_friendly',
  'Custom built for diving': 'purpose_built_dive',
  'Available for Charter': 'private_charter',
  'Nearly 1:1 Crew-to-Guest Ratio': null,
  'Local & International Crew': null,
  'Naturalist Itineraries': null,
}

export const DINING_LABELS: Record<string, DiningOption | null> = {
  'Local Food': 'local_food',
  'Western Food': 'western_food',
  'Vegetarian Options': 'vegetarian',
  'Vegan Options': 'vegan',
  'Buffet style': 'buffet',
  'Set Menu Dinner': 'set_menu',
  'Snacks All Day': 'snacks',
  'Beer available': 'beer',
  'Wine Available': 'wine',
  'Fine Wines Selection': 'wine',
  'Free Wine w/Dinner': 'wine',
  'Al Fresco Dining': null,
  'Fine Cuisine': null,
  'Welcome Cocktails': null,
  'Free Soft Drinks': null,
  'Full-board Option': null,
}

export const DIVE_LABELS: Record<string, DiveFacility | null> = {
  'Dive deck': 'dive_deck',
  'Shaded Diving Area': 'shaded_dive_area',
  'Tenders for diving': 'dive_tenders',
  'Rinse Hoses': 'rinse_hoses',
  'Nitrox available': 'nitrox',
  'Free Nitrox': 'nitrox',
  'DIN Adaptors': 'din_adaptors',
  'Sidemount Diving': 'sidemount',
  'Sidemount diving – Single Tank Only': 'sidemount',
  'Tech diving': 'tech_diving',
}

export const SAFETY_LABELS: Record<string, SafetyItem | null> = {
  Radar: 'radar',
  GPS: 'gps',
  'Radio VHF/DSC/SSB': 'vhf_dsc_ssb',
  'Satellite & mobile phones': 'satellite_phone',
  'Depth Sounder': 'depth_sounder',
  Fishfinder: 'fishfinder',
  'Search light': 'searchlight',
  'E.P.I.R.B. Distress System': 'epirb',
  'Emergency flares': 'flares',
  'Emergency Rafts': 'life_rafts',
  'Life Vests': 'life_vests',
  'Fire Alarm & Fire Extinguishers': 'fire_suppression',
  'Bilge pump alarm': 'bilge_alarm',
  'Engine room CCTV': 'engine_room_cctv',
  Oxygen: 'oxygen',
  'First Aid Kits': 'first_aid_kit',
  'Crew trained in first aid': 'crew_first_aid',
}

const DECK_LABELS: Record<string, CabinDeck> = {
  'Lower deck': 'lower',
  'Main deck': 'main',
  'Upper deck': 'upper',
  'Sun deck': 'sun',
  'Across decks': 'across',
}

const WINDOW_LABELS: Record<string, CabinWindow> = {
  'No window': 'none',
  'Porthole window': 'porthole',
  'Standard window': 'standard',
  'Picture window': 'picture',
  'Panoramic window': 'panoramic',
}

// Cabin facts that describe booking policy, not the cabin.
const IGNORED_CABIN_FACTS = new Set(['Solo traveler friendly', 'Privacy optional', 'Private cabin'])

export class UnknownLabels {
  readonly found = new Map<string, Set<string>>()
  add(kind: string, label: string, boat: string): void {
    const key = `${kind}: "${label}"`
    this.found.set(key, (this.found.get(key) ?? new Set()).add(boat))
  }
  report(): string[] {
    return [...this.found].map(([key, boats]) => `${key} (${[...boats].join(', ')})`)
  }
}

/** Maps labels in vocabulary order, deduplicated. */
function mapLabels<T extends string>(labels: string[], table: Record<string, T | null>, order: readonly T[], kind: string, boat: string, unknown: UnknownLabels): T[] {
  const out = new Set<T>()
  for (const label of labels) {
    if (!(label in table)) unknown.add(kind, label, boat)
    else if (table[label]) out.add(table[label])
  }
  return order.filter((key) => out.has(key))
}

const languageNames = new Intl.DisplayNames(['en'], { type: 'language' })
const LANGUAGE_BY_NAME = new Map<string, LanguageCode>(LANGUAGE_CODES.map((code) => [languageNames.of(code)?.toLowerCase() ?? code, code]))

// "The crew speaks English, Spanish and French."
function languages(raw: string | null, boat: string, unknown: UnknownLabels): LanguageCode[] {
  if (!raw) return []
  const names = raw
    .replace(/^the crew speaks?\s*/i, '')
    .replace(/\.$/, '')
    .split(/,|\band\b/)
    .map((s) => s.trim())
    .filter(Boolean)
  return names.flatMap((name) => {
    const code = LANGUAGE_BY_NAME.get(name.toLowerCase())
    if (!code) unknown.add('language', name, boat)
    return code ? [code] : []
  })
}

const num = (s: string | null | undefined) => {
  const m = s?.replace(/[,']/g, '').match(/\d+(\.\d+)?/)
  return m ? Number(m[0]) : null
}

const US_GALLON_L = 3.785411784

/** "2291 gallons", "16 tonnes", "5000 liters" → liters. Unknown units → null. */
function liters(s: string | null): number | null {
  const n = num(s)
  if (n === null || !s) return null
  if (/gal/i.test(s)) return Math.round(n * US_GALLON_L)
  if (/\b(t|tons?|tonnes?)\b/i.test(s)) return Math.round(n * 1000)
  if (/\b(l|lt|ltrs?|liters?|litres?)\b/i.test(s)) return Math.round(n)
  return null
}

/** Only rated outputs ("… per day") count; "Yes" or a bare volume says nothing about capacity. */
function watermakerLpd(s: string | null): number | null {
  return s && /per day|\/ ?day|daily/i.test(s) ? liters(s.replace(/per day|\/ ?day|daily/i, '')) : null
}

const MAKE_PATTERNS: Array<[EngineMake, RegExp]> = (Object.keys(ENGINE_MAKES) as EngineMake[]).map((make) => [
  make,
  new RegExp(`\\b${ENGINE_MAKES[make].replace(/ /g, '\\s*')}\\b`, 'i'),
])

// "2 Cummins NTA855-M 400 hp and 1800 rpm", "2 x MTU 6062 475 HP", "500 HP MWM", "Detroit Diesel 6V92 350HP"
export function engines(s: string | null): Engines | null {
  if (!s) return null
  const found = MAKE_PATTERNS.find(([, re]) => re.test(s))
  const count = s.match(/^\s*(\d)\s*(?:x\s*)?(?=[A-Za-z])/i)?.[1]
  const hp = s.match(/(\d[\d,.]*)\s*hp\b/i)?.[1]
  // The model is the token right after the make, if it has a digit and isn't the horsepower.
  const after = found ? (s.split(found[1])[1] ?? '') : ''
  const token = after.match(/^\s*([A-Z0-9][A-Z0-9-]*)\b(?!\s*hp\b)/i)?.[1]
  const result: Engines = {
    count: count ? Number(count) : null,
    make: found?.[0] ?? null,
    model: token && /\d/.test(token) ? token : null,
    power_hp: hp ? Math.round(Number(hp.replace(/,/g, ''))) : null,
  }
  return Object.values(result).every((v) => v === null) ? null : result
}

// "1 Double or Twin (convertible)", "2 Single beds", "1 Single + 1 Double bed", "1 Bunk bed (singles)"
function beds(fact: string): CabinType['beds'] | undefined {
  if (!/\bbed|double|twin|single|bunk|queen|king/i.test(fact)) return undefined
  const out = { single: 0, double: 0, bunk: 0, convertible: /convertible|double or twin|twin or double/i.test(fact) }
  for (const part of fact.split('+')) {
    const n = num(part) ?? 1
    if (/bunk/i.test(part)) out.bunk += n
    else if (/double|queen|king/i.test(part)) out.double += n
    else if (/single|twin/i.test(part)) out.single += n
  }
  return out.single + out.double + out.bunk > 0 ? out : undefined
}

export function cabinType(c: LiveaboardCabin, boat: string, unknown: UnknownLabels): CabinType {
  const cabin: CabinType = {
    name: c.name,
    count: null,
    max_guests: null,
    beds: null,
    size_m2: null,
    deck: null,
    window: null,
    bathroom: null,
    aircon: null,
    external_ids: { liveaboard_com: c.liveaboard_cabin_id },
  }
  for (const fact of c.facts) {
    const size = fact.match(/^([\d.]+)\s*(?:-\s*([\d.]+)\s*)?m²$/)
    const bed = beds(fact)
    if (size) cabin.size_m2 = { min: Number(size[1]), max: Number(size[2] ?? size[1]) }
    else if (/^Max \d+ guests?$/.test(fact)) cabin.max_guests = num(fact)
    else if (/^Ensuite Bathroom$/i.test(fact)) cabin.bathroom = 'ensuite'
    else if (/^Shared Bathroom$/i.test(fact)) cabin.bathroom = 'shared'
    else if (/^Aircon/i.test(fact)) cabin.aircon = true
    else if (/^Fan\b/i.test(fact)) cabin.aircon = false
    else if (bed) cabin.beds = bed
    else if (!IGNORED_CABIN_FACTS.has(fact)) unknown.add('cabin fact', fact, boat)
  }
  const deck = c.details['Deck level of cabin']
  const window = c.details['Cabin window(s)']
  if (deck) cabin.deck = DECK_LABELS[deck] ?? (unknown.add('cabin deck', deck, boat), null)
  if (window) cabin.window = WINDOW_LABELS[window] ?? (unknown.add('cabin window', window, boat), null)
  return cabin
}

export interface VesselFacts {
  bathrooms: number | null
  max_speed_kn: number | null
  cruising_speed_kn: number | null
  engines: Engines | null
  tenders: number | null
  fuel_l: number | null
  water_l: number | null
  watermaker_lpd: number | null
  cabin_types: CabinType[]
  amenities: Amenity[]
  dive_facilities: DiveFacility[]
  safety: SafetyItem[]
  dining: DiningOption[]
  languages: LanguageCode[]
}

export function vesselFacts(
  b: LiveaboardBoat,
  order: { amenities: readonly Amenity[]; dive: readonly DiveFacility[]; safety: readonly SafetyItem[]; dining: readonly DiningOption[] },
  unknown: UnknownLabels,
): VesselFacts {
  const dive = mapLabels(b.diving, DIVE_LABELS, order.dive, 'diving', b.name, unknown)
  const tenders = num(b.specs_raw['Tenders'])
  return {
    bathrooms: b.bathrooms,
    max_speed_kn: b.top_speed_kn,
    cruising_speed_kn: num(b.cruising_speed),
    engines: engines(b.engines),
    tenders: tenders === null ? null : Math.round(tenders),
    fuel_l: liters(b.fuel_capacity),
    water_l: liters(b.water_capacity),
    watermaker_lpd: watermakerLpd(b.specs_raw['Freshwater maker'] ?? null),
    cabin_types: b.cabin_types.map((c) => cabinType(c, b.name, unknown)),
    amenities: mapLabels(b.boat_features, AMENITY_LABELS, order.amenities, 'amenity', b.name, unknown),
    dive_facilities: order.dive.filter((k) => dive.includes(k) || (k === 'gear_rental' && b.gear_rental)),
    safety: mapLabels(b.navigation_safety, SAFETY_LABELS, order.safety, 'safety', b.name, unknown),
    dining: mapLabels(b.food_drinks, DINING_LABELS, order.dining, 'dining', b.name, unknown),
    languages: languages(b.languages_raw, b.name, unknown),
  }
}
