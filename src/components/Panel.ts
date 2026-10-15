import { esc } from './html.ts'
import type { Html } from './html.ts'

export interface PanelProps {
  title: string
  content: Html
  /** Small text next to the title, e.g. a count. */
  meta?: string
}

export function Panel({ title, content, meta }: PanelProps): Html {
  return `<section class="panel">
  <h2 class="panel__title">${esc(title)}${meta ? ` <span class="panel__meta">${esc(meta)}</span>` : ''}</h2>
  ${content}
</section>`
}

/** Lays panels out in a responsive two-column grid. */
export function PanelGrid(panels: Html[]): Html {
  return `<div class="panel-grid">${panels.join('\n')}</div>`
}
