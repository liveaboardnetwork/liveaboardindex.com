export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
}

export function isExternal(href) {
  return /^https?:\/\//.test(href)
}

export function join(parts) {
  return parts.filter(Boolean).join('\n')
}
