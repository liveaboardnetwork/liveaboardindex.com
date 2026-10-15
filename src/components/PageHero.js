import { Button } from './Button.js'
import { esc } from './html.js'

// `eyebrow` and `lead` are HTML; `title` is plain text.
export function PageHero({ title, eyebrow, lead, actions = [], breadcrumbs = [], align = 'center' }) {
  const crumbs = breadcrumbs.length
    ? `<nav class="breadcrumbs" aria-label="Breadcrumb">${breadcrumbs.map((c) => `<a href="${esc(c.href)}">${esc(c.label)}</a>`).join('<span>/</span>')}</nav>`
    : ''
  return `<section class="hero hero--${align}">
  <div class="container hero__inner">
    ${crumbs}
    ${eyebrow ?? ''}
    <h1 class="hero__title">${esc(title)}</h1>
    ${lead ? `<p class="hero__lead">${lead}</p>` : ''}
    ${actions.length ? `<div class="hero__actions">${actions.map(Button).join('')}</div>` : ''}
  </div>
</section>`
}
