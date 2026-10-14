import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Admin panel. `npm start` → http://localhost:3000
// The admin's components are .js files that contain JSX, so Vite is told
// to read .js as JSX (instead of renaming every file).
export default defineConfig({
  plugins: [react({ include: /\.(js|jsx)$/ })],
  esbuild: { loader: 'jsx', include: /src\/.*\.jsx?$/, exclude: [] },
  optimizeDeps: { esbuildOptions: { loader: { '.js': 'jsx' } } },
  envPrefix: ['VITE_', 'REACT_APP_'],
  server: { port: 3000, strictPort: true },
  preview: { port: 3000 },
  build: { outDir: 'build', sourcemap: false },
});
