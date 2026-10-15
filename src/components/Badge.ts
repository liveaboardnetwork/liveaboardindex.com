import { esc } from './html.ts'
import type { Html } from './html.ts'

export type BadgeTone = 'blue' | 'green' | 'red' | 'neutral'

export interface BadgeProps {
  label: string
  tone?: BadgeTone
  /** Keep the original casing (for IDs). */
  raw?: boolean
}

export function Badge({ label, tone = 'blue', raw = false }: BadgeProps): Html {
  return `<span class="badge badge--${tone}${raw ? ' badge--raw' : ''}">${esc(label)}</span>`
}
