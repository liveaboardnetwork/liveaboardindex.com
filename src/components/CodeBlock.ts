import { asset } from '../assets.ts'
import { esc } from './html.ts'
import type { Html } from './html.ts'

export type CodeLanguage = 'json' | 'shell' | 'js' | 'text'

export interface CodeBlockProps {
  code: string
  language?: CodeLanguage
  /** Label shown in the block's top bar, e.g. a file path or "Response". */
  title?: string
}

const TOKEN: Record<Exclude<CodeLanguage, 'text'>, RegExp> = {
  json: /("(?:\\.|[^"\\])*")(\s*:)?|(-?\b\d+(?:\.\d+)?\b)|\b(true|false|null)\b|(…)/g,
  shell: /(#.*$)|("(?:\\.|[^"\\])*"|'[^']*')|(^|\s)(curl|jq)\b/gm,
  js: /(\/\/.*$)|(`(?:\\.|[^`\\])*`|'(?:\\.|[^'\\])*')|\b(const|await|async|if|return|for|of|new)\b|(-?\b\d+\b)/gm,
}

function highlight(code: string, language: CodeLanguage): Html {
  if (language === 'text') return esc(code)
  let out = ''
  let last = 0
  for (const m of code.matchAll(TOKEN[language])) {
    out += esc(code.slice(last, m.index))
    out += token(m, language)
    last = m.index + m[0].length
  }
  return out + esc(code.slice(last))
}

const span = (cls: string, text: string) => `<span class="code__${cls}">${esc(text)}</span>`

function token(m: RegExpMatchArray, language: CodeLanguage): Html {
  const [all, a, b, c, d, e] = m
  if (language === 'json') {
    if (a !== undefined) return b !== undefined ? span('key', a) + esc(b) : span('str', a)
    if (c !== undefined) return span('num', c)
    if (d !== undefined) return span('lit', d)
    if (e !== undefined) return span('com', e)
  }
  if (language === 'shell') {
    if (a !== undefined) return span('com', a)
    if (b !== undefined) return span('str', b)
    if (d !== undefined) return esc(c ?? '') + span('kw', d)
  }
  if (language === 'js') {
    if (a !== undefined) return span('com', a)
    if (b !== undefined) return span('str', b)
    if (c !== undefined) return span('kw', c)
    if (d !== undefined) return span('num', d)
  }
  return esc(all)
}

export function CodeBlock({ code, language = 'text', title }: CodeBlockProps): Html {
  return `<figure class="code">
  <figcaption class="code__bar"><span>${esc(title ?? language)}</span><button class="code__copy" type="button" data-copy>Copy</button></figcaption>
  <pre><code>${highlight(code.trimEnd(), language)}</code></pre>
</figure>`
}

/** Enables the Copy buttons; include once per page that has code blocks. */
export function CodeBlockScript(): Html {
  return `<script src="${asset('/js/copy.js')}" defer></script>`
}
