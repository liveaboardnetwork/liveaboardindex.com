for (const button of document.querySelectorAll('[data-copy]')) {
  button.addEventListener('click', async () => {
    const code = button.closest('.code')?.querySelector('code')
    if (!code) return
    await navigator.clipboard.writeText(code.textContent)
    button.textContent = 'Copied'
    setTimeout(() => (button.textContent = 'Copy'), 1500)
  })
}
