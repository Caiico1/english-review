import { defineConfig } from 'vite';

// base relativa: la carpeta dist/ funciona en cualquier ruta de un hosting estático
export default defineConfig({
  base: './',
  server: { port: 5173, strictPort: true },
});
