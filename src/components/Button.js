import { esc, isExternal } from './html.js'

// variant: primary | secondary | inverse | ghost-inverse
export function Button({ label, href, variant = 'primary' }) {
  const rel = isExternal(href) ? ' rel="noopener"' : ''
  return `<a class="btn btn--${variant}" href="${esc(href)}"${rel}>${esc(label)}</a>`
}
