import { asset } from '../assets.ts'
import { esc } from './html.ts'
import type { Html } from './html.ts'

export interface FilterInputProps {
  /** CSS selector of the table whose rows are filtered as you type. */
  target: string
  placeholder?: string
}

export function FilterInput({ target, placeholder = 'Filter…' }: FilterInputProps): Html {
  return `<input class="input" type="search" data-filter="${esc(target)}" placeholder="${esc(placeholder)}" autocomplete="off" />
<script src="${asset('/js/filter.js')}" defer></script>`
}
