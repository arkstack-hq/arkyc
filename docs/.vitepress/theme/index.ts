import DefaultTheme from 'vitepress/theme'
import type { Theme } from 'vitepress'
import Landing from './components/Landing.vue'
import './style.css'

// Brand theme: the stock VitePress docs UX (sidebar/search/TOC) restyled to the
// Arkyc palette, plus a bespoke <Landing /> used by the home page.
export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('Landing', Landing)
  },
} satisfies Theme
