import { esc } from './html.ts'
import type { Html } from './html.ts'

export function EmptyState(text: string): Html {
  return `<div class="empty">${esc(text)}</div>`
}
