import { site } from '../site.js'
import { esc, isExternal } from './html.js'
import { Logo } from './Logo.js'

function link({ label, href }, className) {
  const rel = isExternal(href) ? ' rel="noopener"' : ''
  return `<a class="${className}" href="${esc(href)}"${rel}>${esc(label)}</a>`
}

export function Footer() {
  const columns = site.footer
    .map(
      (col) => `<div>
        <p class="footer__title">${esc(col.title)}</p>
        <ul class="footer__links">${col.links.map((l) => `<li>${link(l, 'footer__link')}</li>`).join('')}</ul>
      </div>`,
    )
    .join('')
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
      <p>©${new Date().getFullYear()} ${esc(site.name)}. Open data.</p>
      <nav class="footer__legal" aria-label="Footer">${site.legal.map((l) => link(l, 'footer__legal-link')).join('')}</nav>
    </div>
  </div>
</footer>`
}
