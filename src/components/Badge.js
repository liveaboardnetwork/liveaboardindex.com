import { esc } from './html.js'

// tone: blue | green | red | neutral. `raw` keeps the original casing (for IDs).
export function Badge({ label, tone = 'blue', raw = false }) {
  return `<span class="badge badge--${tone}${raw ? ' badge--raw' : ''}">${esc(label)}</span>`
}
