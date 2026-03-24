import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [tailwindcss()],
  resolve: {
    dedupe: ['three'],
    conditions: ['source'],
  },
  server: {
    port: 3001,
  },
})
