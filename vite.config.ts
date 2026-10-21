import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// Test configuration lives in vitest.config.ts so the production build never
// loads it; vitest prefers that file when both exist.
export default defineConfig({
  plugins: [react()],
})
