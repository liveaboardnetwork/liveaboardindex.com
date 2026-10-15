import { esc } from './html.js'

// items: [[label, html]]
export function FactList(items) {
  return `<dl class="facts">
${items.map(([label, value]) => `  <div class="facts__row"><dt>${esc(label)}</dt><dd>${value}</dd></div>`).join('\n')}
</dl>`
}
