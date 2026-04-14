import { vitePreprocess } from '@sveltejs/vite-plugin-svelte'

const config = {
  preprocess: vitePreprocess(),
  extensions: ['.svelte', '.svg'],
}

export default config
