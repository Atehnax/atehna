import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{ts,tsx}', './src/commercial/content/data/**/*.{md,mdx}'],
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
        blue: {
          50: 'var(--blue-50)',
          100: 'var(--blue-100)',
          500: 'var(--blue-500)',
          600: 'var(--blue-600)',
          700: 'var(--blue-700)'
        },
        semantic: {
          info: 'var(--semantic-info)',
          'info-soft': 'var(--semantic-info-soft)',
          'info-border': 'var(--semantic-info-border)',
          success: 'var(--semantic-success)',
          'success-soft': 'var(--semantic-success-soft)',
          'success-border': 'var(--semantic-success-border)',
          warning: 'var(--semantic-warning)',
          'warning-soft': 'var(--semantic-warning-soft)',
          'warning-border': 'var(--semantic-warning-border)'
        },
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
