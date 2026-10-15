for (const input of document.querySelectorAll('[data-filter]')) {
  const rows = document.querySelectorAll(`${input.dataset.filter} tbody tr`)
  input.addEventListener('input', () => {
    const query = input.value.trim().toLowerCase()
    for (const row of rows) row.hidden = query !== '' && !row.textContent.toLowerCase().includes(query)
  })
}
