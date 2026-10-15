import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

const publicDir = new URL('../public/', import.meta.url)

/** URL of a file in public/ with a content hash, so browsers refetch it whenever it changes. */
export function asset(href: `/${string}`): string {
  const hash = createHash('sha256').update(readFileSync(new URL(`.${href}`, publicDir))).digest('hex').slice(0, 10)
  return `${href}?v=${hash}`
}
