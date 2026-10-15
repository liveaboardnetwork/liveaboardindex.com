import type { NavLink } from '../site.ts'
import { Button } from './Button.ts'
import type { ButtonProps } from './Button.ts'
import { esc } from './html.ts'
import type { Html } from './html.ts'

export interface PageHeroProps {
  title: string
  eyebrow?: Html | undefined
  lead?: Html | null | undefined
  actions?: ButtonProps[]
  breadcrumbs?: NavLink[]
  align?: 'center' | 'left'
}

export function PageHero({ title, eyebrow, lead, actions = [], breadcrumbs = [], align = 'center' }: PageHeroProps): Html {
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
