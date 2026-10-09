/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        /* AttendPro v2 — paper and chrome. Values live in src/index.css.
         * Every key below is unchanged; only the value behind it moved, so no
         * component had to be edited to change the application's appearance. */
        canvas: 'var(--canvas)',
        'surface-1': 'var(--surface-1)',
        'surface-2': 'var(--surface-2)',
        'surface-3': 'var(--surface-3)',
        'surface-4': 'var(--surface-4)',
        ink: 'var(--ink)',
        'ink-muted': 'var(--ink-muted)',
        'ink-subtle': 'var(--ink-subtle)',
        'ink-tertiary': 'var(--ink-tertiary)',
        hairline: 'var(--hairline)',
        'hairline-strong': 'var(--hairline-strong)',
        'hairline-tertiary': 'var(--hairline-tertiary)',
        accent: 'var(--accent)',
        'accent-hover': 'var(--accent-hover)',
        'accent-focus': 'var(--accent-focus)',
        'brass-chrome': 'var(--brass-chrome)',
        success: 'var(--success)',
        error: 'var(--error)',
        warning: 'var(--warning)',

        /* Chrome — the dark polarity. First surface is the Login brand
         * panel; the sidebar and modal shells join from the layout-shell
         * milestone onwards. */
        chrome: 'var(--chrome)',
        'chrome-elevated': 'var(--chrome-elevated)',
        'chrome-line': 'var(--chrome-line)',
        'chrome-ink': 'var(--chrome-ink)',
        'chrome-ink-muted': 'var(--chrome-ink-muted)',
        'chrome-ink-subtle': 'var(--chrome-ink-subtle)',
        'chrome-error': 'var(--chrome-error)',
      },
      fontFamily: {
        /* §6 — three tiers. Display is the deviation from v1's single-family
         * rule that makes the system recognisable; both other tiers were
         * already in use before this was written down. */
        serif: ['Georgia', 'Times New Roman', 'ui-serif', 'serif'],
        sans: ['system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'Liberation Mono', 'Courier New', 'monospace'],
      },
      fontSize: {
        'display-xl': ['48px', { lineHeight: '1.05', letterSpacing: '-1.5px', fontWeight: '600' }],
        'display-lg': ['36px', { lineHeight: '1.1', letterSpacing: '-1px', fontWeight: '600' }],
        'display-md': ['28px', { lineHeight: '1.15', letterSpacing: '-0.5px', fontWeight: '600' }],
        'display-sm': ['22px', { lineHeight: '1.25', letterSpacing: '-0.3px', fontWeight: '500' }],
        'body-lg': ['18px', { lineHeight: '1.5', letterSpacing: '-0.05px', fontWeight: '400' }],
        'body': ['16px', { lineHeight: '1.5', letterSpacing: '0', fontWeight: '400' }],
        'body-sm': ['14px', { lineHeight: '1.5', letterSpacing: '0', fontWeight: '400' }],
        'caption': ['12px', { lineHeight: '1.4', letterSpacing: '0', fontWeight: '400' }],
        'button': ['14px', { lineHeight: '1.2', letterSpacing: '0', fontWeight: '500' }],
        'eyebrow': ['13px', { lineHeight: '1.3', letterSpacing: '0.4px', fontWeight: '500' }],
        'mono': ['13px', { lineHeight: '1.5', letterSpacing: '0', fontWeight: '400' }],
      },
      borderRadius: {
        'xs': '4px',
        'sm': '6px',
        'md': '8px',
        'lg': '12px',
        'xl': '16px',
        'xxl': '24px',
        'pill': '9999px',
      },
      spacing: {
        'xxs': '4px',
        'xs': '8px',
        'sm': '12px',
        'md': '16px',
        'lg': '24px',
        'xl': '32px',
        'xxl': '48px',
        'section': '96px',
      },
      boxShadow: {
        /* §7 — three tiers, no glassmorphism, no coloured shadows.
         * Base paper carries no shadow at all: a hairline does the work.
         * These are the two steps above it. */
        'card': '0 1px 2px 0 rgba(15, 23, 42, 0.06)',
        'card-hover': '0 2px 4px -1px rgba(15, 23, 42, 0.10)',
        'elevated': '0 24px 48px -12px rgba(15, 23, 42, 0.28)',
      },
    },
  },
  plugins: [],
}