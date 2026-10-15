import { site } from '../site.js'
import { Button } from './Button.js'
import { esc } from './html.js'
import { Logo } from './Logo.js'

export function Header({ current } = {}) {
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
