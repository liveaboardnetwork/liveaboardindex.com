import { EmptyState } from './EmptyState.js'
import { esc } from './html.js'

// items: [{ label, href, meta }]
export function IndexList({ items, empty = 'Nothing here yet.' }) {
  if (!items.length) return EmptyState(empty)
  return `<ul class="index-list">
${items.map((i) => `  <li><a href="${esc(i.href)}"><span>${esc(i.label)}</span><span class="index-list__meta">${esc(i.meta ?? '')}</span></a></li>`).join('\n')}
</ul>`
}
