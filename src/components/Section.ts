import { esc } from './html.ts'
import type { Html } from './html.ts'

export interface SectionProps {
  content: Html
  title?: string
  tone?: 'white' | 'cream'
}

export function Section({ content, title, tone = 'white' }: SectionProps): Html {
  const head = title ? `<div class="section__head"><h2 class="section__title">${esc(title)}</h2></div>` : ''
  return `<section class="section section--${tone}">
  <div class="container">
    ${head}
    ${content}
  </div>
</section>`
}
