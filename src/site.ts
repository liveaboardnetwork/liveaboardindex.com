import type { ButtonProps } from './components/Button.ts'

export interface NavLink {
  label: string
  href: string
}

export interface FooterColumn {
  title: string
  links: NavLink[]
}

export interface SiteConfig {
  name: string
  url: string
  /** Default meta description and social-card text. */
  description: string
  tagline: { lead: string; rest: string }
  nav: NavLink[]
  actions: ButtonProps[]
  footer: FooterColumn[]
  legal: NavLink[]
}

export const site: SiteConfig = {
  name: 'Liveaboard Index',
  url: 'https://liveaboardindex.com',
  description: 'The index of liveaboard dive boats: one permanent ID per hull, with specs, operators, regions and a free static JSON API.',
  tagline: {
    lead: 'The index of liveaboard boats.',
    rest: 'One permanent ID per hull, with a static JSON API.',
  },
  nav: [
    { label: 'Boats', href: '/boats/' },
    { label: 'Regions', href: '/regions/' },
    { label: 'Operators', href: '/operators/' },
  ],
  actions: [{ label: 'API', href: '/api/v1/boats.json', variant: 'secondary' }],
  footer: [
    {
      title: 'Index',
      links: [
        { label: 'Boats', href: '/boats/' },
        { label: 'Regions', href: '/regions/' },
        { label: 'Operators', href: '/operators/' },
      ],
    },
    {
      title: 'API',
      links: [
        { label: 'boats.json', href: '/api/v1/boats.json' },
        { label: 'regions.json', href: '/api/v1/regions.json' },
      ],
    },
  ],
  legal: [],
}
