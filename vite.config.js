import { defineConfig } from 'vite';

// relative base: the dist/ folder works under any path on a static host
export default defineConfig({
  base: './',
  server: { port: 5173, strictPort: true },
});
