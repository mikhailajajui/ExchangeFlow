import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [react()],
  // Keep fonts as files so the CSP can stay font-src 'self' (no data: URIs).
  build: { assetsInlineLimit: 0 },
  server: { port: 5173, proxy: { '/api': { target: 'http://localhost:3001', changeOrigin: false } } },
});
