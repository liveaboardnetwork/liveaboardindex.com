import { markSvg } from '../brand.ts'
import { site } from '../site.ts'
import type { Html } from './html.ts'

export function LogoMark(): Html {
  return markSvg()
}

export function Logo({ href = '/' }: { href?: string } = {}): Html {
  return `<a class="logo" href="${href}" aria-label="${site.name} home">${LogoMark()}<span class="logo__word">liveaboard<span> index</span></span></a>`
}
