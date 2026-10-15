import { esc } from './html.js'

// tone: white | cream. `aside` is HTML shown opposite the title.
export function Section({ content, title, aside, tone = 'white' }) {
  const head = title || aside
    ? `<div class="section__head">${title ? `<h2 class="section__title">${esc(title)}</h2>` : '<span></span>'}${aside ?? ''}</div>`
    : ''
  return `<section class="section section--${tone}">
  <div class="container">
    ${head}
    ${content}
  </div>
</section>`
}
