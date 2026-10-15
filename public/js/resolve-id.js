// Resolves /boats/<id>/<anything> and /operators/<id>/<anything> to the canonical URL.
// IDs are normalized the Crockford way so dictated or mistyped IDs (O→0, I/L→1, uppercase) still work.
const match = location.pathname.match(/^\/(boats|operators)\/([a-z]+)_([0-9a-z]+)/i)
const status = document.querySelector('[data-resolve-status]')

if (match) {
  const section = match[1].toLowerCase()
  const code = match[3].toLowerCase().replace(/o/g, '0').replace(/[il]/g, '1')
  const id = `${match[2].toLowerCase()}_${code}`
  status.textContent = `Looking up ${id}…`
  fetch(`/api/v1/${section}/${id}.json`)
    .then((res) => (res.ok ? res.json() : Promise.reject()))
    .then((record) => location.replace(record.url + location.search + location.hash))
    .catch(() => {
      status.textContent = `There is no record with ID ${id}.`
    })
}
