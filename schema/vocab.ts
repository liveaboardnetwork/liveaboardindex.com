// Closed vocabularies for vessel facilities and cabins. Keys are the stored values (stable, snake_case);
// values are display labels. Add a key here before using it in data/; never rename or remove one.

export const AMENITIES = {
  ensuite_bathrooms: 'En-suite bathrooms',
  aircon_cabins: 'Air-conditioned cabins',
  seaview_cabins: 'Sea-view cabins',
  family_cabins: 'Family cabins',
  non_smoking_cabins: 'Non-smoking cabins',
  tv_in_cabins: 'TV in cabins',
  balcony_cabins: 'Cabins with balcony',
  cabin_safe: 'Safe box in cabins',
  hair_dryer: 'Hair dryer in cabins',
  hot_showers: 'Hot showers',
  outside_showers: 'Outside showers',
  indoor_saloon: 'Indoor saloon',
  aircon_saloon: 'Air-conditioned saloon',
  outdoor_dining: 'Outdoor dining',
  bar: 'Bar',
  bbq: 'BBQ area',
  sun_deck: 'Sun deck',
  observation_deck: 'Observation deck',
  leisure_deck: 'Leisure deck',
  jacuzzi: 'Jacuzzi / hot tub',
  pool: 'Pool',
  sauna: 'Sauna',
  spa: 'Spa',
  massage: 'Massage',
  gym: 'Fitness room',
  shop: 'Boutique / souvenir shop',
  library: 'Library',
  entertainment: 'Audio & video entertainment',
  internet: 'Internet',
  charging_stations: 'Charging stations',
  camera_station: 'Camera station',
  camera_rinse: 'Separate camera rinse',
  laundry: 'Laundry service',
  housekeeping: 'Daily housekeeping',
  kayaks: 'Kayaks',
  paddleboards: 'Stand-up paddleboards',
  fishing: 'Fishing',
  water_ski: 'Water skiing',
  wakeboarding: 'Wakeboarding',
  jet_ski: 'Jet ski',
  glass_bottom_boat: 'Glass-bottom boat',
  snorkeling_gear: 'Snorkeling gear',
  naturalist_guide: 'Naturalist guide',
  non_diver_friendly: 'Non-diver friendly',
  purpose_built_dive: 'Purpose-built for diving',
  private_charter: 'Available for private charter',
} as const

export const DIVE_FACILITIES = {
  dive_deck: 'Dive deck',
  shaded_dive_area: 'Shaded dive area',
  dive_tenders: 'Dive tenders',
  rinse_hoses: 'Rinse hoses',
  nitrox: 'Nitrox',
  din_adaptors: 'DIN adaptors',
  sidemount: 'Sidemount',
  tech_diving: 'Technical diving',
  rebreathers: 'Rebreather support',
  gear_rental: 'Gear rental',
} as const

export const SAFETY_EQUIPMENT = {
  radar: 'Radar',
  gps: 'GPS',
  vhf_dsc_ssb: 'VHF / DSC / SSB radio',
  satellite_phone: 'Satellite & mobile phones',
  depth_sounder: 'Depth sounder',
  fishfinder: 'Fishfinder',
  searchlight: 'Searchlight',
  epirb: 'EPIRB distress beacon',
  flares: 'Emergency flares',
  life_rafts: 'Life rafts',
  life_vests: 'Life vests',
  fire_suppression: 'Fire alarm & extinguishers',
  bilge_alarm: 'Bilge pump alarm',
  engine_room_cctv: 'Engine room CCTV',
  oxygen: 'Emergency oxygen',
  first_aid_kit: 'First aid kits',
  crew_first_aid: 'Crew trained in first aid',
} as const

export const DINING = {
  local_food: 'Local food',
  western_food: 'Western food',
  vegetarian: 'Vegetarian options',
  vegan: 'Vegan options',
  buffet: 'Buffet style',
  set_menu: 'Set menu dinner',
  snacks: 'Snacks all day',
  beach_bbq: 'Beach BBQ',
  beer: 'Beer',
  wine: 'Wine',
} as const

export const CABIN_DECKS = {
  lower: 'Lower deck',
  main: 'Main deck',
  middle: 'Middle deck',
  upper: 'Upper deck',
  top: 'Top / bridge deck',
  sun: 'Sun deck',
  across: 'Across decks',
} as const

export const CABIN_WINDOWS = {
  none: 'No window',
  porthole: 'Porthole',
  standard: 'Window',
  picture: 'Picture window',
  panoramic: 'Panoramic window',
} as const

export const CABIN_BATHROOMS = {
  ensuite: 'En-suite',
  shared: 'Shared',
} as const

export const ENGINE_MAKES = {
  caterpillar: 'Caterpillar',
  cummins: 'Cummins',
  detroit_diesel: 'Detroit Diesel',
  deutz: 'Deutz',
  john_deere: 'John Deere',
  man: 'MAN',
  mitsubishi: 'Mitsubishi',
  mtu: 'MTU',
  mwm: 'MWM',
  perkins: 'Perkins',
  scania: 'Scania',
  volvo_penta: 'Volvo Penta',
  yanmar: 'Yanmar',
} as const

// ISO 639-1.
export const LANGUAGE_CODES = [
  'aa', 'ab', 'ae', 'af', 'ak', 'am', 'an', 'ar', 'as', 'av', 'ay', 'az', 'ba', 'be', 'bg', 'bi', 'bm', 'bn', 'bo', 'br', 'bs',
  'ca', 'ce', 'ch', 'co', 'cr', 'cs', 'cu', 'cv', 'cy', 'da', 'de', 'dv', 'dz', 'ee', 'el', 'en', 'eo', 'es', 'et', 'eu', 'fa',
  'ff', 'fi', 'fj', 'fo', 'fr', 'fy', 'ga', 'gd', 'gl', 'gn', 'gu', 'gv', 'ha', 'he', 'hi', 'ho', 'hr', 'ht', 'hu', 'hy', 'hz',
  'ia', 'id', 'ie', 'ig', 'ii', 'ik', 'io', 'is', 'it', 'iu', 'ja', 'jv', 'ka', 'kg', 'ki', 'kj', 'kk', 'kl', 'km', 'kn', 'ko',
  'kr', 'ks', 'ku', 'kv', 'kw', 'ky', 'la', 'lb', 'lg', 'li', 'ln', 'lo', 'lt', 'lu', 'lv', 'mg', 'mh', 'mi', 'mk', 'ml', 'mn',
  'mr', 'ms', 'mt', 'my', 'na', 'nb', 'nd', 'ne', 'ng', 'nl', 'nn', 'no', 'nr', 'nv', 'ny', 'oc', 'oj', 'om', 'or', 'os', 'pa',
  'pi', 'pl', 'ps', 'pt', 'qu', 'rm', 'rn', 'ro', 'ru', 'rw', 'sa', 'sc', 'sd', 'se', 'sg', 'si', 'sk', 'sl', 'sm', 'sn', 'so',
  'sq', 'sr', 'ss', 'st', 'su', 'sv', 'sw', 'ta', 'te', 'tg', 'th', 'ti', 'tk', 'tl', 'tn', 'to', 'tr', 'ts', 'tt', 'tw', 'ty',
  'ug', 'uk', 'ur', 'uz', 've', 'vi', 'vo', 'wa', 'wo', 'xh', 'yi', 'yo', 'za', 'zh', 'zu',
] as const

export type Amenity = keyof typeof AMENITIES
export type DiveFacility = keyof typeof DIVE_FACILITIES
export type SafetyItem = keyof typeof SAFETY_EQUIPMENT
export type DiningOption = keyof typeof DINING
export type CabinDeck = keyof typeof CABIN_DECKS
export type CabinWindow = keyof typeof CABIN_WINDOWS
export type CabinBathroom = keyof typeof CABIN_BATHROOMS
export type EngineMake = keyof typeof ENGINE_MAKES
export type LanguageCode = (typeof LANGUAGE_CODES)[number]

/** The keys of a vocabulary as a non-empty tuple, for z.enum(). */
export function vocabKeys<T extends Record<string, string>>(vocab: T): [keyof T & string, ...Array<keyof T & string>] {
  return Object.keys(vocab) as [keyof T & string, ...Array<keyof T & string>]
}
