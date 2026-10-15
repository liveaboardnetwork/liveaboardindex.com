export const site = {
  name: 'Liveaboard Index',
  url: 'https://liveaboardindex.com',
  repo: 'https://github.com/liveaboardnetwork/liveaboardindex.com',
  tagline: {
    lead: 'The open index of liveaboard boats.',
    rest: 'One permanent ID per hull, open data and a static JSON API.',
  },
  nav: [
    { label: 'Boats', href: '/boats/' },
    { label: 'Regions', href: '/regions/' },
    { label: 'Operators', href: '/operators/' },
    { label: 'API', href: '/api/v1/boats.json' },
  ],
}

site.actions = [
  { label: 'GitHub', href: site.repo, variant: 'secondary' },
  { label: 'Add a boat', href: `${site.repo}/tree/main/data/vessels`, variant: 'primary' },
]

site.footer = [
  {
    title: 'Index',
    links: [
      { label: 'Boats', href: '/boats/' },
      { label: 'Regions', href: '/regions/' },
      { label: 'Operators', href: '/operators/' },
    ],
  },
  {
    title: 'Data',
    links: [
      { label: 'boats.json', href: '/api/v1/boats.json' },
      { label: 'Data files', href: `${site.repo}/tree/main/data` },
      { label: 'Changelog', href: `${site.repo}/commits/main/data` },
    ],
  },
]

site.legal = [
  { label: 'GitHub', href: site.repo },
  { label: 'API', href: '/api/v1/boats.json' },
]
