/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['General Sans', 'sans-serif'],
        serif: ['Fraunces', 'serif'],
        mono: ['IBM Plex Mono', 'monospace'],
      },
      // DESIGN.md section 2 colour tokens. Every value is a CSS custom property
      // declared in src/index.css, so a token has exactly one source: DESIGN.md
      // for the value, :root for the declaration, and this map for the utility.
      colors: {
        canvas: 'var(--canvas)',
        surface: 'var(--surface)',
        chrome: 'var(--chrome)',
        'chrome-raised': 'var(--chrome-raised)',
        ink: 'var(--ink)',
        'ink-muted': 'var(--ink-muted)',
        'ink-invert': 'var(--ink-invert)',
        border: 'var(--border)',
        'border-invert': 'var(--border-invert)',
        'auth-canvas': 'var(--auth-canvas)',
        'auth-input': 'var(--auth-input)',
        accent: 'var(--accent)',
        'accent-strong': 'var(--accent-strong)',
      },
    },
  },
  plugins: [],
}
