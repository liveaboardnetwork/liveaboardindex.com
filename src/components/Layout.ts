import { asset } from '../assets.ts'
import { BRAND_COLORS } from '../brand.ts'
import { site } from '../site.ts'
import { Footer } from './Footer.ts'
import { Header } from './Header.ts'
import { esc } from './html.ts'
import type { Html } from './html.ts'

const STYLESHEETS = ['/css/tokens.css', '/css/base.css', '/css/components.css'] as const

const FONTS = 'https://fonts.googleapis.com/css2?family=Geist+Mono:wght@400;500&family=Inter:wght@400;500;600&family=Newsreader:opsz,wght@6..72,300;6..72,400&display=swap'

export interface HeadProps {
  title?: string | undefined
  canonical?: string | undefined
  description?: string | undefined
}

export function Head({ title, canonical, description = site.description }: HeadProps = {}): Html {
  const fullTitle = title ? `${title} · ${site.name}` : `${site.name} · ${site.tagline.lead.replace(/\.$/, '')}`
  const url = canonical ? `${site.url}${esc(canonical)}` : null
  return `<meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${esc(fullTitle)}</title>
    <meta name="description" content="${esc(description)}" />
    ${url ? `<link rel="canonical" href="${url}" />` : ''}
    <meta name="theme-color" content="${BRAND_COLORS.cream}" />
    <meta property="og:site_name" content="${esc(site.name)}" />
    <meta property="og:type" content="website" />
    <meta property="og:title" content="${esc(title ?? site.name)}" />
    <meta property="og:description" content="${esc(description)}" />
    ${url ? `<meta property="og:url" content="${url}" />` : ''}
    <meta property="og:image" content="${site.url}/og.png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta name="twitter:card" content="summary_large_image" />
    <link rel="icon" href="/favicon.ico" sizes="32x32" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
    <link rel="manifest" href="/site.webmanifest" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link rel="stylesheet" href="${FONTS}" />
    ${STYLESHEETS.map((href) => `<link rel="stylesheet" href="${asset(href)}" />`).join('\n    ')}`
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
