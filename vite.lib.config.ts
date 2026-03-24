import { defineConfig } from 'vite'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    lib: {
      entry: {
        index: 'src/lib/index.ts',
      },
      formats: ['es'],
    },
    outDir: 'dist/lib',
    rolldownOptions: {
      external: ['three', /^three\//],
    },
  },
})
