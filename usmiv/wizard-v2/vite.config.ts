import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

// ── Dev-only plugin: writes generated catalog files to disk ───────────────────
// This plugin adds a POST /api/wizard-editor/save endpoint that accepts
// { category, content } and writes the content to the corresponding catalog
// file. It only runs during `vite dev` -- configureServer is never called
// during `vite build`.

function wizardEditorPlugin() {
  return {
    name: 'wizard-editor-save',
    configureServer(server: import('vite').ViteDevServer) {
      server.middlewares.use('/api/wizard-editor/save', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end('Method not allowed');
          return;
        }

        // Collect POST body
        let body = '';
        for await (const chunk of req as AsyncIterable<Buffer>) {
          body += chunk;
        }

        let parsed: { category: string; content: string };
        try {
          parsed = JSON.parse(body);
        } catch {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Invalid JSON body' }));
          return;
        }

        const { category, content } = parsed;

        const fileMap: Record<string, string> = {
          iv:         'src/data/catalog/iv.ts',
          nad:        'src/data/catalog/nad.ts',
          weightLoss: 'src/data/catalog/weightLoss.ts',
          injection:  'src/data/catalog/injections.ts',
          lab:        'src/data/catalog/labs.ts',
        };

        const filePath = fileMap[category];
        if (!filePath) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: `Unknown category: ${category}` }));
          return;
        }

        try {
          const fs = await import('fs/promises');
          const path = await import('path');
          const fullPath = path.resolve(__dirname, filePath);
          await fs.writeFile(fullPath, content, 'utf-8');

          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok: true, path: filePath }));
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: `Write failed: ${message}` }));
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), wizardEditorPlugin()],
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
    // In production build: silence React warnings
    // Dashboard is included in prod (accessible via ?wizard-dev=true)
    ...(process.env.NODE_ENV === 'production' || process.argv.includes('build')
      ? {
          'process.env.NODE_ENV': '"production"',
        }
      : {}),
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
});
