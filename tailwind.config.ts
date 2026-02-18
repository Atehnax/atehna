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
          50: '#eef3f3',
          100: '#dbe5e5',
          200: '#c2d3d4',
          300: '#a3bbbc',
          400: '#7f9d9e',
          500: '#5b7c7d',
          600: '#5b7c7d',
          700: '#4f6f70',
          800: '#446263',
          900: '#364f50'
        }
      }
    }
  },
  plugins: []
} satisfies Config;
