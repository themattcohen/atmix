import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve, dirname } from 'path';
import { copyFileSync, mkdirSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Plugin to copy index.html to SPA routes for GitHub Pages
function spaRoutes(routes: string[]) {
  return {
    name: 'spa-routes',
    closeBundle() {
      const distDir = resolve(__dirname, 'dist');
      const indexPath = resolve(distDir, 'index.html');

      routes.forEach(route => {
        const routeDir = resolve(distDir, route);
        if (!existsSync(routeDir)) {
          mkdirSync(routeDir, { recursive: true });
        }
        copyFileSync(indexPath, resolve(routeDir, 'index.html'));
      });
    }
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    spaRoutes(['working-together', 'walkies', 'projects', 'IV', 'usml'])
  ],
  base: '/',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
  },
});
