import { defineConfig } from 'vite';
import { copyFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { selectPages } from './vite.pages.js';

const root = fileURLToPath(new URL('.', import.meta.url));

// Die 404-Seite liegt wie alle Seiten unter pages/, statische Hosts
// (GitHub Pages, nginx error_page) erwarten sie aber als /404.html.
function notFoundAtRoot() {
  return {
    name: 'rethink-404-root',
    closeBundle() {
      const src = resolve(root, 'dist/pages/404/index.html');
      if (existsSync(src)) copyFileSync(src, resolve(root, 'dist/404.html'));
    },
  };
}

export default defineConfig({
  root,
  publicDir: 'public',
  // Absolute Pfade wie im FORGE-Portal: die Site läuft im Domain-Root.
  base: '/',
  plugins: [notFoundAtRoot()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      // Multi-Page: jede Seite ist ein eigener Entry-Point (vite.pages.js)
      input: selectPages(root),
    },
  },
  server: { port: 3100, open: '/pages/landing/' },
});
