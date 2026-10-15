import { esc } from './html.js'

// Filters the rows of the table matched by `target` (a CSS selector) as you type.
export function FilterInput({ target, placeholder = 'Filter…' }) {
  return `<input class="input" type="search" data-filter="${esc(target)}" placeholder="${esc(placeholder)}" autocomplete="off" />
<script src="/js/filter.js" defer></script>`
}
