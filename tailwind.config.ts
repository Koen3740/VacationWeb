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
      },
    },
  },
  plugins: [],
} satisfies Config;
