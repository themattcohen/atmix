/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Relative base ('./') lets the same artifact serve from any URL root:
//   atmix.org/valuation/  (GH Pages, subpath, legacy redirect stub)
//   valuation.somedayconsultants.com/  (Cloudflare Pages, canonical brand URL)
// All asset references and lazy-import chunks resolve relative to index.html's path.
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          charts: ['recharts'],
          pdf: ['@react-pdf/renderer'],
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
