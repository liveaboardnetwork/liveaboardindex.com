import { esc } from './html.ts'
import type { Html } from './html.ts'

export type Fact = readonly [label: string, value: Html]

export function FactList(items: Fact[]): Html {
  return `<dl class="facts">
${items.map(([label, value]) => `  <div class="facts__row"><dt>${esc(label)}</dt><dd>${value}</dd></div>`).join('\n')}
</dl>`
}
