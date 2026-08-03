import type { Config } from 'tailwindcss';

/**
 * Every color below is a CSS variable, not a fixed hex — defined in
 * src/theme/tokens.css for both light and dark, following the exact
 * palette approved in docs/phase-4-ui-wireframes/wireframes.html.
 * Tailwind's `dark:` variant isn't used anywhere; theming happens
 * entirely at the variable layer (`prefers-color-scheme` +
 * `[data-theme]` override), so every component gets both themes for
 * free without a `dark:` class on every element.
 */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: 'var(--ink)',
        paper: 'var(--paper)',
        surface: 'var(--surface)',
        'surface-2': 'var(--surface-2)',
        line: 'var(--line)',
        'line-strong': 'var(--line-strong)',
        muted: 'var(--muted)',
        'muted-2': 'var(--muted-2)',
        accent: 'var(--accent)',
        'accent-ink': 'var(--accent-ink)',
        'accent-soft': 'var(--accent-soft)',
        'accent-soft-line': 'var(--accent-soft-line)',
        success: 'var(--success)',
        'success-soft': 'var(--success-soft)',
        warning: 'var(--warning)',
        'warning-soft': 'var(--warning-soft)',
        critical: 'var(--critical)',
        'critical-soft': 'var(--critical-soft)',
      },
      borderRadius: {
        DEFAULT: 'var(--radius)',
      },
      boxShadow: {
        card: 'var(--shadow)',
      },
      width: {
        sidebar: 'var(--sidebar-w)',
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          '"Helvetica Neue"',
          'Arial',
          'sans-serif',
        ],
      },
    },
  },
  plugins: [],
} satisfies Config;
