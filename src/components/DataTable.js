import { EmptyState } from './EmptyState.js'
import { esc } from './html.js'

// columns: [{ label, cell: (row) => html, align?: 'num' | 'mono' }]
export function DataTable({ id, columns, rows, empty = 'Nothing here yet.' }) {
  if (!rows.length) return EmptyState(empty)
  const cls = (c) => (c.align ? ` class="is-${c.align}"` : '')
  const head = columns.map((c) => `<th${cls(c)}>${esc(c.label)}</th>`).join('')
  const body = rows.map((row) => `<tr>${columns.map((c) => `<td${cls(c)}>${c.cell(row)}</td>`).join('')}</tr>`).join('\n')
  return `<div class="table-card">
  <table class="table"${id ? ` id="${esc(id)}"` : ''}>
    <thead><tr>${head}</tr></thead>
    <tbody>
${body}
    </tbody>
  </table>
</div>`
}
