import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages serves the app from /<repo-name>/. Override via VITE_BASE_PATH
// (a GitHub Actions variable) when the repo name differs, or set it to '/' once
// a custom domain such as portaal.koremanmaastricht.nl is attached.
const base = process.env.VITE_BASE_PATH ?? '/koreman-agentenportaal/';

export default defineConfig({
  base,
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: { port: 5173 },
  build: { outDir: 'dist', sourcemap: true },
});
