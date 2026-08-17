import { defineConfig, globalIgnores } from 'eslint/config';
import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';

export default defineConfig([
  ...nextCoreWebVitals,
  {
    // These React compiler-oriented rules need targeted component refactors before enabling.
    rules: {
      'react-hooks/immutability': 'off',
      'react-hooks/refs': 'off',
      'react-hooks/set-state-in-effect': 'off'
    }
  },
  globalIgnores([
    '.next/**',
    '.playwright/**',
    'blob-report/**',
    'out/**',
    'build/**',
    'playwright-report/**',
    'test-results/**',
    'next-env.d.ts'
  ])
]);
