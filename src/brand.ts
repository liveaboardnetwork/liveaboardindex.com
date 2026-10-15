import type { Html } from './components/html.ts'

export const BRAND_COLORS = {
  ink: '#171a18',
  cream: '#faf9f7',
  muted: '#73706c',
} as const

// Liveaboard silhouette on a 32×32 grid: hull, main deck, sun deck.
const MARK_PATH = 'M5 19h22l-3 6H8z M8 14h13l3 4H8z M11 9.5h7l2.5 3.5H11z'

export interface MarkOptions {
  /** Tile and boat colors. Omit to style through `.mark__tile` / `.mark__boat` in CSS. */
  colors?: { tile: string; boat: string }
  /** Corner radius of the tile in grid units; 0 gives a full-bleed square for maskable icons. */
  radius?: number
  /** Scales the boat inside the tile, e.g. 0.8 to keep it in a maskable icon's safe zone. */
  scale?: number
}

export function markSvg({ colors, radius = 7, scale = 1 }: MarkOptions = {}): Html {
  const fill = (part: 'tile' | 'boat') => (colors ? `fill="${colors[part]}"` : `class="mark__${part}"`)
  const transform = scale === 1 ? '' : ` transform="translate(16 17) scale(${scale}) translate(-16 -17)"`
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="${radius}" ${fill('tile')}/><path d="${MARK_PATH}" ${fill('boat')}${transform}/></svg>`
}
