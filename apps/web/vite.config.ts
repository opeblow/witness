import { copyFileSync } from 'node:fs';
import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { type Plugin, defineConfig } from 'vite';

/** GitHub Pages serves 404.html for unknown paths; making it the app enables client routing. */
function spaFallback(): Plugin {
  return {
    name: 'witness-spa-fallback',
    apply: 'build',
    closeBundle() {
      const dist = resolve(__dirname, 'dist');
      copyFileSync(resolve(dist, 'index.html'), resolve(dist, '404.html'));
    },
  };
}

export default defineConfig({
  base: process.env.WITNESS_BASE_PATH ?? '/',
  plugins: [react(), spaFallback()],
  server: { port: 5173 },
  build: {
    target: 'es2022',
    sourcemap: true,
    // polkadot.js is ~1 MB and only loads on app pages that talk to the chain.
    chunkSizeWarningLimit: 1200,
  },
});
