import { esc } from './html.ts'
import type { Html } from './html.ts'

export function TagList(labels: string[], empty = 'Not recorded yet.'): Html {
  if (!labels.length) return `<p class="muted">${esc(empty)}</p>`
  return `<ul class="tags">${labels.map((l) => `<li class="tag">${esc(l)}</li>`).join('')}</ul>`
}
