/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    // The suites import describe/it/expect from 'vitest' explicitly; keep the
    // global surface off so an accidental bare `expect` fails loudly.
    globals: false,
  },
})
