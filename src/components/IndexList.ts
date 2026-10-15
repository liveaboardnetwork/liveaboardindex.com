import { EmptyState } from './EmptyState.ts'
import { esc } from './html.ts'
import type { Html } from './html.ts'

export interface IndexItem {
  label: string
  href: string
  meta?: string
}

export function IndexList({ items, empty = 'Nothing here yet.' }: { items: IndexItem[]; empty?: string }): Html {
  if (!items.length) return EmptyState(empty)
  return `<ul class="index-list">
${items.map((i) => `  <li><a href="${esc(i.href)}"><span>${esc(i.label)}</span><span class="index-list__meta">${esc(i.meta)}</span></a></li>`).join('\n')}
</ul>`
}
