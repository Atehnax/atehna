import type { Config } from 'tailwindcss';

export default {
  content: ["./src/**/*.{ts,tsx}", "./content/**/*.{md,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif']
      },
      colors: {
        brand: {
          50: '#eef7ff',
          100: '#d9edff',
          200: '#b8dcff',
          300: '#8cc5ff',
          400: '#59a6ff',
          500: '#2c7ef5',
          600: '#1d61d1',
          700: '#194da9',
          800: '#1a4488',
          900: '#1a3b70'
        }
      }
    }
  },
  plugins: []
} satisfies Config;
