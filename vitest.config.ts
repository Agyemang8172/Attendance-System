import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// Kept separate from vite.config.ts so the production build never loads test
// configuration. When this file exists, vitest uses it and ignores vite.config.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    // The suites import describe/it/expect from 'vitest' explicitly; keep the
    // global surface off so an accidental bare `expect` fails loudly.
    globals: false,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{js,jsx,ts,tsx}', 'src/**/*.spec.{ts,tsx}'],
    // Playwright owns the e2e specs; vitest must not try to run them.
    exclude: ['**/node_modules/**', '**/dist/**', '**/src/__tests__/e2e/**'],
    // These suites mount the whole router and drive userEvent timers. Running
    // files in parallel starves the 5s default and produces order-dependent
    // timeouts; serial and a wider budget keep the run deterministic without
    // weakening a test.
    fileParallelism: false,
    testTimeout: 20000,
    coverage: {
      provider: 'v8',
      // Scope the report to shipped source. Without `include`, v8 walks every
      // file the process touched, including backend/generated/prisma, whose
      // runtime map file is absent and makes the report crash.
      include: ['src/**/*.{js,jsx,ts,tsx}'],
      exclude: [
        'src/**/*.test.{js,jsx,ts,tsx}',
        'src/**/*.spec.{ts,tsx}',
        'src/__tests__/**',
        'src/test/**',
        'src/**/*.d.ts',
      ],
      reporter: ['text', 'json', 'html'],
      // Owner decision, 2026-10-20 (option B): the 90/85 gate is enforced on
      // the backend, where the plan states it. The frontend starts at its
      // measured baseline and ratchets up: every later milestone raises the
      // statement/line floor by at least 10 points and the branch floor by at
      // least 3, until it reaches 90/85. M9 baseline: 29.95% statements,
      // 49.79% functions, 71.38% branches.
      thresholds: {
        statements: 29,
        branches: 71,
        functions: 49,
        lines: 29,
      },
    },
  },
})
