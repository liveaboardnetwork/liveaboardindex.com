// Components return HTML strings. `Html` marks strings that are already safe markup;
// anything else must go through esc().
export type Html = string

const ENTITIES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }

export function esc(value: string | number | null | undefined): Html {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ENTITIES[c] ?? c)
}

export function isExternal(href: string): boolean {
  return /^https?:\/\//.test(href)
}
