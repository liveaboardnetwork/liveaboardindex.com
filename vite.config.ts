import { defineConfig } from 'vite'
import type { Plugin } from 'vite'
import { Footer, Head, Header } from './src/components/index.ts'
import type { Html } from './src/components/index.ts'
import { homePage } from './src/pages.ts'

// Fills the <!--slot--> placeholders in index.html with the shared components.
function components(): Plugin {
  const slots: Record<string, () => Html> = {
    head: () => Head({ canonical: '/' }),
    header: () => Header({ current: '/' }),
    home: homePage,
    footer: Footer,
  }
  return {
    name: 'site-components',
    transformIndexHtml(html) {
      return html.replace(/<!--(\w+)-->/g, (match, name: string) => slots[name]?.() ?? match)
    },
  }
}

export default defineConfig({
  plugins: [components()],
})
