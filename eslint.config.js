import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'playwright-report', 'test-results']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
  },
  {
    files: ['src/features/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: ['**/app/**', '**/pages/**'] },
      ],
    },
  },
  {
    files: [
      'src/components/**/*.{ts,tsx}',
      'src/hooks/**/*.ts',
      'src/lib/**/*.ts',
      'src/data/**/*.ts',
      'src/types.ts',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: ['**/app/**', '**/pages/**', '**/features/**'] },
      ],
    },
  },
  {
    files: ['src/lib/**/*.ts', 'src/data/**/*.ts', 'src/types.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: ['react', 'react-dom'],
          patterns: [
            'react/*',
            'react-dom/*',
            '**/app/**',
            '**/pages/**',
            '**/features/**',
            '**/components/**',
            '**/hooks/**',
          ],
        },
      ],
    },
  },
  {
    files: ['tests/**/*.{ts,tsx}', 'playwright.config.ts'],
    languageOptions: { globals: globals.node },
    rules: { 'react-refresh/only-export-components': 'off' },
  },
])
