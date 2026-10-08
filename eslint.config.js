import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

// These trees are not authored source. Linting them buries real findings: the
// Prisma client under backend/generated alone accounts for ~1500 no-undef and
// no-unused-vars errors, which hid the 9 genuine ones in src/.
const NON_SOURCE = [
  'dist',
  'backend/dist',
  'backend/generated',
  'node_modules',
  '.agents',
]

export default defineConfig([
  globalIgnores(NON_SOURCE),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      // Underscore-prefixed names are a deliberate "intentionally unused" marker
      // across this codebase. varsIgnorePattern already honoured it; the other
      // two positions did not, so `catch (_err)` still failed the gate.
      'no-unused-vars': [
        'error',
        {
          varsIgnorePattern: '^[A-Z_]',
          argsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
    },
  },
])
