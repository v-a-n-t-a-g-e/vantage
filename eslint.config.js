import js from '@eslint/js'
import globals from 'globals'
import sveltePlugin from 'eslint-plugin-svelte'
import svelteParser from 'svelte-eslint-parser'

export default [
  js.configs.recommended,
  ...sveltePlugin.configs['flat/recommended'],
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
  },
  {
    files: ['**/*.svelte'],
    languageOptions: {
      parser: svelteParser,
    },
  },
  {
    ignores: ['dist/', 'node_modules/'],
  },
]
