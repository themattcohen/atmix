import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'WizardOfIV',
      fileName: 'wizard',
      formats: ['iife'],
    },
    rollupOptions: {
      // React and ReactDOM are bundled in. The host page has NO React requirement.
      // This keeps the bundle self-contained at the cost of ~45KB gzip.
      external: [],
      output: {
        entryFileNames: 'wizard.js',
        assetFileNames: (assetInfo) => {
          if (assetInfo.name?.endsWith('.css')) return 'wizard.css';
          return assetInfo.name ?? '[name][extname]';
        },
      },
    },
    cssCodeSplit: false,  // single wizard.css output
    minify: 'esbuild',
    target: 'es2017',
    outDir: 'dist',
  },
  define: {
    // In production build: silence React warnings and tree-shake dev dashboard
    // In dev mode: Vite handles these automatically, so only override for build
    ...(process.env.NODE_ENV === 'production' || process.argv.includes('build')
      ? {
          'process.env.NODE_ENV': '"production"',
          'import.meta.env.DEV': 'false',
        }
      : {}),
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
});
