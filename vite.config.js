import { defineConfig } from 'vite'
import { Footer, Head, Header } from './src/components/index.js'
import { homePage } from './src/pages.js'

// Fills the <!--slot--> placeholders in index.html with the shared components.
function components() {
  const slots = {
    head: () => Head({ canonical: '/' }),
    header: () => Header({ current: '/' }),
    home: homePage,
    footer: Footer,
  }
  return {
    name: 'site-components',
    transformIndexHtml(html) {
      return html.replace(/<!--(\w+)-->/g, (match, name) => (slots[name] ? slots[name]() : match))
    },
  }
}

export default defineConfig({
  plugins: [components()],
})
