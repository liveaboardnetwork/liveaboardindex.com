import { esc, isExternal } from './html.ts'
import type { Html } from './html.ts'

export type ButtonVariant = 'primary' | 'secondary' | 'inverse' | 'ghost-inverse'

export interface ButtonProps {
  label: string
  href: string
  variant?: ButtonVariant
}

export function Button({ label, href, variant = 'primary' }: ButtonProps): Html {
  const rel = isExternal(href) ? ' rel="noopener"' : ''
  return `<a class="btn btn--${variant}" href="${esc(href)}"${rel}>${esc(label)}</a>`
}
