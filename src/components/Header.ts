import { site } from '../site.ts'
import { Button } from './Button.ts'
import { esc } from './html.ts'
import type { Html } from './html.ts'
import { Logo } from './Logo.ts'

export interface HeaderProps {
  /** Nav href to highlight. */
  current?: string | undefined
}

export function Header({ current }: HeaderProps = {}): Html {
  const links = site.nav
    .map((l) => `<a class="header__link${l.href === current ? ' is-active' : ''}" href="${esc(l.href)}">${esc(l.label)}</a>`)
    .join('')
  return `<header class="header">
  <div class="container header__inner">
    ${Logo()}
    <nav class="header__nav" aria-label="Main">${links}</nav>
    <div class="header__actions">${site.actions.map(Button).join('')}</div>
  </div>
</header>`
}
