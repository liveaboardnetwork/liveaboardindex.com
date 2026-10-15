import { site } from '../site.js'
import { Footer } from './Footer.js'
import { Header } from './Header.js'
import { esc } from './html.js'

const FONTS = 'https://fonts.googleapis.com/css2?family=Geist+Mono:wght@400;500&family=Inter:wght@400;500;600&family=Newsreader:opsz,wght@6..72,300;6..72,400&display=swap'

export function Head({ title, canonical, description } = {}) {
  const fullTitle = title ? `${title} · ${site.name}` : site.name
  return `<meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${esc(fullTitle)}</title>
    ${description ? `<meta name="description" content="${esc(description)}" />` : ''}
    ${canonical ? `<link rel="canonical" href="${site.url}${esc(canonical)}" />` : ''}
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link rel="stylesheet" href="${FONTS}" />
    <link rel="stylesheet" href="/css/site.css" />`
}

// `current` is the nav href to highlight; `content` is the HTML inside <main>.
export function Layout({ title, canonical, description, current, content }) {
  return `<!doctype html>
<html lang="en">
  <head>
    ${Head({ title, canonical, description })}
  </head>
  <body>
${Header({ current })}
<main>
${content}
</main>
${Footer()}
  </body>
</html>
`
}
