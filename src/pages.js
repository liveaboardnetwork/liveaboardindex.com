import { Badge, DataTable, FactList, FilterInput, IndexList, Layout, PageHero, Section, esc } from './components/index.js'
import { site } from './site.js'

const STATUS_TONE = { active: 'green', retired: 'neutral', defunct: 'neutral', lost: 'red', merged: 'neutral' }

const dash = '<span class="muted">—</span>'

function val(value, suffix = '') {
  return value == null || value === '' ? dash : `${esc(value)}${suffix}`
}

function humanize(value) {
  if (value == null) return null
  const text = value.replace(/_/g, ' ')
  return text[0].toUpperCase() + text.slice(1)
}

export function regionName(region) {
  return region
    .split('-')
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ')
}

function regionLink(region) {
  return region ? `<a class="link" href="/regions/${esc(region)}">${esc(regionName(region))}</a>` : dash
}

function operatorLink(id, operatorById) {
  const o = id && operatorById.get(id)
  return o ? `<a class="link" href="${esc(o.url)}">${esc(o.name)}</a>` : dash
}

function statusBadge(status) {
  return Badge({ label: status, tone: STATUS_TONE[status] ?? 'neutral' })
}

function namesList(names) {
  const range = (n) => `${n.from ?? '?'} – ${n.to ?? 'present'}`
  return `<ul>${names.map((n) => `<li>${esc(n.name)} <span class="muted">${esc(range(n))}</span></li>`).join('')}</ul>`
}

function sourcesList(sources) {
  if (!sources.length) return dash
  return `<ul>${sources.map((s) => `<li><a class="link link--accent" href="${esc(s)}" rel="nofollow noopener">${esc(s)}</a></li>`).join('')}</ul>`
}

function boatTable(boats, operatorById) {
  return DataTable({
    id: 'boats',
    rows: boats,
    empty: 'No boats yet.',
    columns: [
      { label: 'Name', cell: (v) => `<a class="link strong" href="${esc(v.url)}">${esc(v.name)}</a>` },
      { label: 'ID', align: 'mono', cell: (v) => esc(v.id) },
      { label: 'Flag', cell: (v) => val(v.flag) },
      { label: 'Region', cell: (v) => regionLink(v.region) },
      { label: 'Operator', cell: (v) => operatorLink(v.operator, operatorById) },
      { label: 'LOA', align: 'num', cell: (v) => val(v.loa_m, ' m') },
      { label: 'IMO', align: 'num', cell: (v) => val(v.imo) },
      { label: 'MMSI', align: 'num', cell: (v) => val(v.mmsi) },
      { label: 'Status', cell: (v) => statusBadge(v.status) },
    ],
  })
}

function count(n, word) {
  return `${n} ${word}${n === 1 ? '' : 's'}`
}

export function boatListPage({ title, eyebrow, lead, canonical, current, json, boats, operatorById }) {
  return Layout({
    title,
    canonical,
    current,
    content: [
      PageHero({ eyebrow: Badge({ label: eyebrow }), title, lead: lead ?? esc(count(boats.length, 'boat')) }),
      Section({
        content: `<div class="section__head">
  ${FilterInput({ target: '#boats', placeholder: 'Filter by name, ID, IMO, MMSI, flag…' })}
  <a class="link mono" href="${esc(json)}">${esc(json.split('/').pop())}</a>
</div>
${boatTable(boats, operatorById)}`,
      }),
    ].join('\n'),
  })
}

export function vesselPage(v, { operatorById }) {
  const summary = [humanize(v.hull), v.region && regionName(v.region), v.flag].filter(Boolean).join(' · ')
  return Layout({
    title: v.name,
    canonical: v.url,
    current: '/boats/',
    content: [
      PageHero({
        breadcrumbs: [{ label: 'Boats', href: '/boats/' }],
        eyebrow: Badge({ label: v.id, raw: true }),
        title: v.name,
        lead: summary ? esc(summary) : null,
        actions: [
          { label: 'Edit on GitHub', href: `${site.repo}/blob/main/${v._file}`, variant: 'primary' },
          { label: 'History', href: `${site.repo}/commits/main/${v._file}`, variant: 'secondary' },
          { label: 'JSON', href: `/api/v1/boats/${v.id}.json`, variant: 'secondary' },
        ],
      }),
      Section({
        content: FactList([
          ['Status', statusBadge(v.status)],
          ['Names', namesList(v.names)],
          ['Region', regionLink(v.region)],
          ['Operator', operatorLink(v.operator, operatorById)],
          ['Hull', val(humanize(v.hull))],
          ['Built', v.built.year || v.built.yard ? `${val(v.built.year)} · ${val(v.built.yard)}` : dash],
          ['IMO', val(v.imo)],
          ['MMSI', val(v.mmsi)],
          ['Call sign', val(v.call_sign)],
          ['Flag', val(v.flag)],
          ['Length (LOA)', val(v.loa_m, ' m')],
          ['Beam', val(v.beam_m, ' m')],
          ['Gross tonnage', val(v.gt)],
          ['Sources', sourcesList(v.sources)],
          ...(v.notes ? [['Notes', esc(v.notes)]] : []),
        ]),
      }),
    ].join('\n'),
  })
}

export function regionIndexPage(regions) {
  const items = [...regions]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([region, boats]) => ({ label: regionName(region), href: `/regions/${region}`, meta: count(boats.length, 'boat') }))
  return Layout({
    title: 'Regions',
    canonical: '/regions/',
    current: '/regions/',
    content: [
      PageHero({ eyebrow: Badge({ label: 'Index' }), title: 'Regions', lead: 'Where the fleet operates.' }),
      Section({ content: IndexList({ items, empty: 'No regions yet.' }) }),
    ].join('\n'),
  })
}

export function operatorIndexPage(operators, vessels) {
  const items = operators.map((o) => ({
    label: o.name,
    href: o.url,
    meta: count(vessels.filter((v) => v.operator === o.id).length, 'boat'),
  }))
  return Layout({
    title: 'Operators',
    canonical: '/operators/',
    current: '/operators/',
    content: [
      PageHero({ eyebrow: Badge({ label: 'Index' }), title: 'Operators', lead: 'The companies running the boats.' }),
      Section({ content: IndexList({ items, empty: 'No operators yet.' }) }),
    ].join('\n'),
  })
}

export function operatorPage(o, { fleet, operatorById }) {
  return Layout({
    title: o.name,
    canonical: o.url,
    current: '/operators/',
    content: [
      PageHero({
        breadcrumbs: [{ label: 'Operators', href: '/operators/' }],
        eyebrow: Badge({ label: o.id, raw: true }),
        title: o.name,
        lead: esc(count(fleet.length, 'boat')),
        actions: [
          { label: 'Edit on GitHub', href: `${site.repo}/blob/main/${o._file}`, variant: 'primary' },
          { label: 'JSON', href: `/api/v1/operators/${o.id}.json`, variant: 'secondary' },
        ],
      }),
      Section({
        content: FactList([
          ['Status', statusBadge(o.status)],
          ['Names', namesList(o.names)],
          ['Country', val(o.country)],
          ['Website', o.website ? `<a class="link link--accent" href="${esc(o.website)}" rel="nofollow noopener">${esc(o.website)}</a>` : dash],
          ['Sources', sourcesList(o.sources)],
          ...(o.notes ? [['Notes', esc(o.notes)]] : []),
        ]),
      }),
      Section({ title: 'Fleet', content: boatTable(fleet, operatorById) }),
    ].join('\n'),
  })
}

export function notFoundPage() {
  return Layout({
    title: 'Not found',
    content: PageHero({
      eyebrow: Badge({ label: '404', tone: 'neutral' }),
      title: 'Not found',
      lead: '<span data-resolve-status>This page does not exist.</span>',
      actions: [{ label: 'Browse boats', href: '/boats/', variant: 'primary' }],
    }) + '\n<script src="/js/resolve-id.js" defer></script>',
  })
}

export function homePage() {
  return PageHero({
    eyebrow: Badge({ label: 'Open data' }),
    title: site.name,
    lead: esc(`${site.tagline.lead} ${site.tagline.rest}`),
    actions: [
      { label: 'Browse boats', href: '/boats/', variant: 'primary' },
      { label: 'API', href: '/api/v1/boats.json', variant: 'secondary' },
    ],
  })
}

export function redirectPage(target) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Redirecting…</title>
    <meta name="robots" content="noindex" />
    <link rel="canonical" href="${site.url}${esc(target)}" />
    <meta http-equiv="refresh" content="0; url=${esc(target)}" />
    <script>location.replace(${JSON.stringify(target)} + location.search + location.hash)</script>
  </head>
  <body><a href="${esc(target)}">${esc(target)}</a></body>
</html>
`
}
