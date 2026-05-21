/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Base path mounts the app at atmix.org/valuation (preview)
// Production routing via Cloudflare Worker can serve from / on somedayhq.com
export default defineConfig({
  base: '/valuation/',
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
