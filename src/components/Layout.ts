import { site } from '../site.ts'
import { Footer } from './Footer.ts'
import { Header } from './Header.ts'
import { esc } from './html.ts'
import type { Html } from './html.ts'

const FONTS = 'https://fonts.googleapis.com/css2?family=Geist+Mono:wght@400;500&family=Inter:wght@400;500;600&family=Newsreader:opsz,wght@6..72,300;6..72,400&display=swap'

export interface HeadProps {
  title?: string | undefined
  canonical?: string | undefined
  description?: string | undefined
}

export function Head({ title, canonical, description }: HeadProps = {}): Html {
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

export interface LayoutProps extends HeadProps {
  /** Nav href to highlight. */
  current?: string | undefined
  content: Html
}

export function Layout({ title, canonical, description, current, content }: LayoutProps): Html {
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
