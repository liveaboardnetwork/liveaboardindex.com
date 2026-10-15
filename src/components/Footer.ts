import { site } from '../site.ts'
import type { NavLink } from '../site.ts'
import { esc, isExternal } from './html.ts'
import type { Html } from './html.ts'
import { Logo } from './Logo.ts'

function link({ label, href }: NavLink, className: string): Html {
  const rel = isExternal(href) ? ' rel="noopener"' : ''
  return `<a class="${className}" href="${esc(href)}"${rel}>${esc(label)}</a>`
}

export function Footer(): Html {
  const columns = site.footer
    .map(
      (col) => `<div>
        <p class="footer__title">${esc(col.title)}</p>
        <ul class="footer__links">${col.links.map((l) => `<li>${link(l, 'footer__link')}</li>`).join('')}</ul>
      </div>`,
    )
    .join('')
  const legal = site.legal.length
    ? `<nav class="footer__legal" aria-label="Footer">${site.legal.map((l) => link(l, 'footer__legal-link')).join('')}</nav>`
    : ''
  return `<footer class="footer">
  <div class="container">
    <div class="footer__top">
      <div class="footer__brand">
        ${Logo()}
        <p class="footer__tagline"><strong>${esc(site.tagline.lead)}</strong> ${esc(site.tagline.rest)}</p>
      </div>
      ${columns}
    </div>
    <div class="footer__bottom">
      <p>©${new Date().getFullYear()} ${esc(site.name)}</p>
      ${legal}
    </div>
  </div>
</footer>`
}
