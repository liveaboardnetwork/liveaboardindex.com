import type { Dataset, OperatorRecord, VesselRecord } from '../schema/dataset.ts'
import type { CountryCode, Hull, NameEntry, OperatorId, OperatorStatus, Region, RegionId, VesselStatus } from '../schema/index.ts'
import { Badge, DataTable, FactList, FilterInput, IndexList, Layout, PageHero, Section, esc } from './components/index.ts'
import type { BadgeTone, Html } from './components/index.ts'
import { asset } from './assets.ts'
import { site } from './site.ts'

const STATUS_TONE: Record<VesselStatus | OperatorStatus, BadgeTone> = {
  active: 'green',
  retired: 'neutral',
  defunct: 'neutral',
  lost: 'red',
  merged: 'neutral',
}

const countryNames = new Intl.DisplayNames(['en'], { type: 'region' })

const dash: Html = '<span class="muted">—</span>'

function val(value: string | number | null, suffix = ''): Html {
  return value === null || value === '' ? dash : `${esc(value)}${suffix}`
}

function country(code: CountryCode | null): Html {
  return code === null ? dash : `${esc(countryNames.of(code) ?? code)} <span class="muted">${esc(code)}</span>`
}

function hullLabel(hull: Hull | null): string | null {
  if (hull === null) return null
  const text = hull.replace(/_/g, ' ')
  return text.charAt(0).toUpperCase() + text.slice(1)
}

function regionLink(data: Dataset, id: RegionId | null): Html {
  const region = id === null ? undefined : data.regionById.get(id)
  return region ? `<a class="link" href="/regions/${esc(region.id)}">${esc(region.name)}</a>` : dash
}

function operatorLink(data: Dataset, id: OperatorId | null): Html {
  const operator = id === null ? undefined : data.operatorById.get(id)
  return operator ? `<a class="link" href="${esc(operator.url)}">${esc(operator.name)}</a>` : dash
}

function statusBadge(status: VesselStatus | OperatorStatus): Html {
  return Badge({ label: status, tone: STATUS_TONE[status] })
}

function namesList(names: NameEntry[]): Html {
  const range = (n: NameEntry) => `${n.from ?? '?'} – ${n.to ?? 'present'}`
  return `<ul>${names.map((n) => `<li>${esc(n.name)} <span class="muted">${esc(range(n))}</span></li>`).join('')}</ul>`
}

function sourcesList(sources: string[]): Html {
  if (!sources.length) return dash
  return `<ul>${sources.map((s) => `<li><a class="link link--accent" href="${esc(s)}" rel="nofollow noopener">${esc(s)}</a></li>`).join('')}</ul>`
}

function vesselDescription(data: Dataset, v: VesselRecord): string {
  const region = v.region === null ? undefined : data.regionById.get(v.region)
  const operator = v.operator === null ? undefined : data.operatorById.get(v.operator)
  const kind = region ? `${region.name} liveaboard` : 'Liveaboard'
  const specs = [
    v.loa_m !== null && `${v.loa_m} m`,
    v.guests !== null && `${v.guests} guests`,
    v.cabins !== null && `${v.cabins} cabins`,
    v.built.year !== null && `built ${v.built.year}`,
    v.imo !== null && `IMO ${v.imo}`,
  ].filter(Boolean)
  return [`${v.name}: ${kind}${operator ? ` run by ${operator.name}` : ''}.`, specs.length ? `${specs.join(', ')}.` : '', `Permanent ID ${v.id}.`]
    .filter(Boolean)
    .join(' ')
}

function count(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`
}

function boatTable(data: Dataset, boats: VesselRecord[]): Html {
  return DataTable<VesselRecord>({
    id: 'boats',
    rows: boats,
    empty: 'No boats yet.',
    columns: [
      { label: 'Name', cell: (v) => `<a class="link strong" href="${esc(v.url)}">${esc(v.name)}</a>` },
      { label: 'ID', align: 'mono', cell: (v) => esc(v.id) },
      { label: 'Flag', cell: (v) => val(v.flag) },
      { label: 'Region', cell: (v) => regionLink(data, v.region) },
      { label: 'Operator', cell: (v) => operatorLink(data, v.operator) },
      { label: 'LOA', align: 'num', cell: (v) => val(v.loa_m, ' m') },
      { label: 'Guests', align: 'num', cell: (v) => val(v.guests) },
      { label: 'IMO', align: 'num', cell: (v) => val(v.imo) },
      { label: 'MMSI', align: 'num', cell: (v) => val(v.mmsi) },
      { label: 'Status', cell: (v) => statusBadge(v.status) },
    ],
  })
}

export interface BoatListOptions {
  title: string
  eyebrow: string
  canonical: string
  current: string
  json: string
  boats: VesselRecord[]
}

export function boatListPage(data: Dataset, { title, eyebrow, canonical, current, json, boats }: BoatListOptions): Html {
  const where = canonical.startsWith('/regions/') ? `in ${title}` : `in ${site.name}`
  const names = boats.slice(0, 8).map((v) => v.name).join(', ')
  return Layout({
    title,
    description: `${count(boats.length, 'liveaboard boat')} ${where}${names ? `: ${names}${boats.length > 8 ? '…' : ''}` : ''}. Specs, operators and permanent IDs.`,
    canonical,
    current,
    content: [
      PageHero({ eyebrow: Badge({ label: eyebrow }), title, lead: esc(count(boats.length, 'boat')) }),
      Section({
        content: `<div class="section__head">
  ${FilterInput({ target: '#boats', placeholder: 'Filter by name, ID, IMO, MMSI, flag…' })}
  <a class="link mono" href="${esc(json)}">${esc(json.split('/').pop())}</a>
</div>
${boatTable(data, boats)}`,
      }),
    ].join('\n'),
  })
}

export function vesselPage(data: Dataset, v: VesselRecord): Html {
  const region = v.region === null ? undefined : data.regionById.get(v.region)
  const summary = [hullLabel(v.hull), region?.name, v.flag && countryNames.of(v.flag)].filter(Boolean).join(' · ')
  return Layout({
    title: v.name,
    description: vesselDescription(data, v),
    canonical: v.url,
    current: '/boats/',
    content: [
      PageHero({
        breadcrumbs: [{ label: 'Boats', href: '/boats/' }],
        eyebrow: Badge({ label: v.id, raw: true }),
        title: v.name,
        lead: summary ? esc(summary) : null,
        actions: [{ label: 'JSON', href: `/api/v1/boats/${v.id}.json`, variant: 'secondary' }],
      }),
      Section({
        content: FactList([
          ['Status', statusBadge(v.status)],
          ['Names', namesList(v.names)],
          ['Region', regionLink(data, v.region)],
          ['Operator', operatorLink(data, v.operator)],
          ['Hull', val(hullLabel(v.hull))],
          ['Built', v.built.year !== null || v.built.yard !== null ? `${val(v.built.year)} · ${val(v.built.yard)}` : dash],
          ['Last refit', val(v.refit_year)],
          ['Guests', val(v.guests)],
          ['Cabins', val(v.cabins)],
          ['IMO', val(v.imo)],
          ['MMSI', val(v.mmsi)],
          ['Call sign', val(v.call_sign)],
          ['Flag', country(v.flag)],
          ['Length (LOA)', val(v.loa_m, ' m')],
          ['Beam', val(v.beam_m, ' m')],
          ['Gross tonnage', val(v.gt)],
          ['Sources', sourcesList(v.sources)],
          ...(v.notes ? [['Notes', esc(v.notes)] as const] : []),
        ]),
      }),
    ].join('\n'),
  })
}

export function regionIndexPage(regions: Array<{ region: Region; boats: VesselRecord[] }>): Html {
  const items = [...regions]
    .sort((a, b) => a.region.name.localeCompare(b.region.name))
    .map(({ region, boats }) => ({ label: region.name, href: `/regions/${region.id}`, meta: count(boats.length, 'boat') }))
  return Layout({
    title: 'Regions',
    description: `Liveaboard regions in ${site.name}: ${items.map((i) => i.label).join(', ')}.`,
    canonical: '/regions/',
    current: '/regions/',
    content: [
      PageHero({ eyebrow: Badge({ label: 'Index' }), title: 'Regions', lead: 'Where the fleet operates.' }),
      Section({ content: IndexList({ items, empty: 'No regions yet.' }) }),
    ].join('\n'),
  })
}

export function operatorIndexPage(operators: OperatorRecord[], vessels: VesselRecord[]): Html {
  const items = operators.map((o) => ({
    label: o.name,
    href: o.url,
    meta: count(vessels.filter((v) => v.operator === o.id).length, 'boat'),
  }))
  return Layout({
    title: 'Operators',
    description: `The ${count(operators.length, 'liveaboard operator')} in ${site.name} and the boats they run.`,
    canonical: '/operators/',
    current: '/operators/',
    content: [
      PageHero({ eyebrow: Badge({ label: 'Index' }), title: 'Operators', lead: 'The companies running the boats.' }),
      Section({ content: IndexList({ items, empty: 'No operators yet.' }) }),
    ].join('\n'),
  })
}

export function operatorPage(data: Dataset, o: OperatorRecord, fleet: VesselRecord[]): Html {
  return Layout({
    title: o.name,
    description: `${o.name}: liveaboard operator with ${count(fleet.length, 'boat')}${fleet.length ? ` (${fleet.map((v) => v.name).join(', ')})` : ''}. Permanent ID ${o.id}.`,
    canonical: o.url,
    current: '/operators/',
    content: [
      PageHero({
        breadcrumbs: [{ label: 'Operators', href: '/operators/' }],
        eyebrow: Badge({ label: o.id, raw: true }),
        title: o.name,
        lead: esc(count(fleet.length, 'boat')),
        actions: [{ label: 'JSON', href: `/api/v1/operators/${o.id}.json`, variant: 'secondary' }],
      }),
      Section({
        content: FactList([
          ['Status', statusBadge(o.status)],
          ['Names', namesList(o.names)],
          ['Country', country(o.country)],
          ['Website', o.website ? `<a class="link link--accent" href="${esc(o.website)}" rel="nofollow noopener">${esc(o.website)}</a>` : dash],
          ['Sources', sourcesList(o.sources)],
          ...(o.notes ? [['Notes', esc(o.notes)] as const] : []),
        ]),
      }),
      Section({ title: 'Fleet', content: boatTable(data, fleet) }),
    ].join('\n'),
  })
}

export function notFoundPage(): Html {
  return Layout({
    title: 'Not found',
    content:
      PageHero({
        eyebrow: Badge({ label: '404', tone: 'neutral' }),
        title: 'Not found',
        lead: '<span data-resolve-status>This page does not exist.</span>',
        actions: [{ label: 'Browse boats', href: '/boats/', variant: 'primary' }],
      }) + `\n<script src="${asset('/js/resolve-id.js')}" defer></script>`,
  })
}

export function homePage(): Html {
  return PageHero({
    eyebrow: Badge({ label: 'Index' }),
    title: site.name,
    lead: esc(`${site.tagline.lead} ${site.tagline.rest}`),
    actions: [
      { label: 'Browse boats', href: '/boats/', variant: 'primary' },
      { label: 'API docs', href: '/docs/', variant: 'secondary' },
    ],
  })
}

export function redirectPage(target: string): Html {
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
