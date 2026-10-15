import type { Html } from './components/html.ts'

export const BRAND_COLORS = {
  ink: '#171a18',
  cream: '#faf9f7',
  muted: '#73706c',
} as const

// Liveaboard silhouette on a 32×32 grid: hull, main deck, sun deck.
const BOAT_PATH = 'M5 19h22l-3 6H8z M8 14h13l3 4H8z M11 9.5h7l2.5 3.5H11z'
const WAVE_PATH = 'M7.5 27.6c1.5-1.2 3-1.2 4.5 0s3 1.2 4.5 0 3-1.2 4.5 0 3 1.2 4.5 0'

export interface MarkOptions {
  /** Static tile and boat colors, for icon files. Omit for the site logo, styled and animated through CSS. */
  colors?: { tile: string; boat: string }
  /** Corner radius of the tile in grid units; 0 gives a full-bleed square for maskable icons. */
  radius?: number
  /** Scales the boat inside the tile, e.g. 0.8 to keep it in a maskable icon's safe zone. */
  scale?: number
}

export function markSvg({ colors, radius = 7, scale = 1 }: MarkOptions = {}): Html {
  const open = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" aria-hidden="true">`
  if (!colors) {
    return `${open}<rect class="mark__tile" width="32" height="32" rx="${radius}"/><path class="mark__wave" d="${WAVE_PATH}" pathLength="1"/><g class="mark__boat"><g class="mark__bob"><path d="${BOAT_PATH}"/></g></g></svg>`
  }
  const transform = scale === 1 ? '' : ` transform="translate(16 17) scale(${scale}) translate(-16 -17)"`
  return `${open}<rect width="32" height="32" rx="${radius}" fill="${colors.tile}"/><path d="${BOAT_PATH}" fill="${colors.boat}"${transform}/></svg>`
}
