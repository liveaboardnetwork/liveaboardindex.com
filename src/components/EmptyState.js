import { esc } from './html.js'

export function EmptyState(text) {
  return `<div class="empty">${esc(text)}</div>`
}
