import type { Html } from './html.ts'

export function LogoMark(): Html {
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 14h19l-2.75 5.5H5.25z" fill="currentColor"/><path d="M8 11.5V3.5l8.5 8z" fill="currentColor"/></svg>`
}

export function Logo({ href = '/' }: { href?: string } = {}): Html {
  return `<a class="logo" href="${href}" aria-label="Liveaboard Index home">${LogoMark()}<span class="logo__word">liveaboard<span> index</span></span></a>`
}
