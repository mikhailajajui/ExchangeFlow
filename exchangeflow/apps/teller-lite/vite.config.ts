import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/** `vite build --mode prototype` builds the standalone GitHub Pages prototype: no server, the check runs in the browser. */
const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  // Keep fonts as files so the CSP can stay font-src 'self' (no data: URIs).
  build: { assetsInlineLimit: 0, outDir: mode === 'prototype' ? 'dist-prototype' : 'dist' },
  ...(mode === 'prototype'
    ? { base: './', resolve: { alias: { 'node:crypto': here('./src/prototype/crypto-shim.ts'), '@desk-local': here('./src/prototype/local.ts') } } }
    : { resolve: { alias: { '@desk-local': here('./src/web/no-local.ts') } } }),
  server: { port: 5174, proxy: { '/api': { target: 'http://127.0.0.1:3101', changeOrigin: false } } },
}));
