import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{ts,tsx}', './content/**/*.{md,mdx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif']
      },
      colors: {
        background: 'var(--bg)',
        foreground: 'var(--text)',
        surface: {
          1: 'var(--surface-1)',
          2: 'var(--surface-2)'
        },
        border: 'var(--border)',
        muted: 'var(--text-muted)',
        primary: {
          DEFAULT: 'var(--primary)',
          hover: 'var(--primary-hover)',
          active: 'var(--primary-active)',
          soft: 'var(--primary-soft)',
          foreground: 'var(--primary-foreground)'
        },
        accent: 'var(--accent)',
        success: 'var(--success)',
        warning: 'var(--warning)',
        danger: 'var(--danger)',
        info: 'var(--info)',
        brand: {
          50: '#edf7f7',
          100: '#d7ecec',
          200: '#badedf',
          300: '#9bcfd0',
          400: '#7db7b8',
          500: '#64a5a7',
          600: '#64a5a7',
          700: '#558f91',
          800: '#4a7b7d',
          900: '#3d6668'
        }
      }
    }
  },
  plugins: []
} satisfies Config;
