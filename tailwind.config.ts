import type { Config } from 'tailwindcss';

export default {
  content: ['./app/**/*.{js,ts,jsx,tsx,mdx}', './components/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f1f7ff',
          100: '#dfeeff',
          500: '#1d4ed8',
          600: '#1747b2',
          700: '#133a8f',
        },
        /**
         * Shared VacationWeb base palette (Phase 1). Hex values live in
         * `app/globals.css` as `--vw-*` so later pages can reuse them.
         * Existing `brand` colors are unchanged.
         */
        vw: {
          navy: 'var(--vw-navy)',
          'navy-hover': 'var(--vw-navy-hover)',
          bg: 'var(--vw-bg)',
          card: 'var(--vw-card)',
          panel: 'var(--vw-panel)',
          line: 'var(--vw-line)',
          muted: 'var(--vw-muted)',
          gold: 'var(--vw-gold)',
          green: 'var(--vw-green)',
          cta: 'var(--vw-cta)',
          'cta-soft': 'var(--vw-cta-soft)',
          'last-minute': 'var(--vw-last-minute)',
          ink: 'var(--vw-ink)',
          usp: 'var(--vw-usp)',
        },
      },
      fontFamily: {
        'vw-serif': ['var(--vw-font-serif)'],
        'vw-sans': ['var(--vw-font-sans)'],
      },
      borderRadius: {
        'vw-card': 'var(--vw-radius-card)',
        'vw-panel': 'var(--vw-radius-panel)',
        'vw-control': 'var(--vw-radius-control)',
      },
      boxShadow: {
        'vw-card': 'var(--vw-shadow-card)',
        'vw-panel': 'var(--vw-shadow-panel)',
        'vw-search': 'var(--vw-shadow-search)',
        'vw-fab': 'var(--vw-shadow-fab)',
      },
      maxWidth: {
        'vw-page': 'var(--vw-content-max)',
      },
    },
  },
  plugins: [],
} satisfies Config;
