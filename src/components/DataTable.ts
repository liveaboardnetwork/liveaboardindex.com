import { EmptyState } from './EmptyState.ts'
import { esc } from './html.ts'
import type { Html } from './html.ts'

export interface Column<Row> {
  label: string
  cell: (row: Row) => Html
  align?: 'num' | 'mono'
}

export interface DataTableProps<Row> {
  id?: string
  columns: Column<Row>[]
  rows: Row[]
  empty?: string
}

export function DataTable<Row>({ id, columns, rows, empty = 'Nothing here yet.' }: DataTableProps<Row>): Html {
  if (!rows.length) return EmptyState(empty)
  const cls = (c: Column<Row>) => (c.align ? ` class="is-${c.align}"` : '')
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
