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
        admin: {
          bg: 'var(--admin-bg)',
          accent: 'var(--admin-accent)',
          hover: 'var(--admin-hover)'
        },
        brand: {
          50: '#edf9f9',
          100: '#d6f0f1',
          200: '#b8e6e8',
          300: '#96dbde',
          400: '#7dced2',
          500: '#65c8cc',
          600: '#65c8cc',
          700: '#56adb0',
          800: '#4a9497',
          900: '#3c7779'
        }
      }
    }
  },
  plugins: []
} satisfies Config;
