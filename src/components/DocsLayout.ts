import { esc } from './html.ts'
import type { Html } from './html.ts'

export interface DocSection {
  id: string
  title: string
  content: Html
  /** Smaller, indented entry in the sidebar. */
  sub?: boolean
}

/** Two-column docs body: sticky table of contents and the sections. */
export function DocsLayout({ sections }: { sections: DocSection[] }): Html {
  const toc = sections
    .map((s) => `<a class="docs__link${s.sub ? ' docs__link--sub' : ''}" href="#${esc(s.id)}">${esc(s.title)}</a>`)
    .join('')
  const body = sections
    .map((s) => `<section class="docs__section" id="${esc(s.id)}">
  <h${s.sub ? 3 : 2} class="docs__title"><a href="#${esc(s.id)}">${esc(s.title)}</a></h${s.sub ? 3 : 2}>
  ${s.content}
</section>`)
    .join('\n')
  return `<div class="section">
  <div class="container docs">
    <nav class="docs__nav" aria-label="On this page">${toc}</nav>
    <article class="docs__body prose">
${body}
    </article>
  </div>
</div>`
}
