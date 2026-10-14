import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Shop (customer site). `npm start` → http://localhost:3001
export default defineConfig({
  plugins: [react()],
  // Keep the old Create React App variable name working (REACT_APP_API_URL on Vercel).
  envPrefix: ['VITE_', 'REACT_APP_'],
  server: { port: 3001, strictPort: true },
  preview: { port: 3001 },
  build: {
    outDir: 'build',
    sourcemap: false,
    rollupOptions: {
      output: {
        // React + router change rarely: a separate file browsers keep cached.
        manualChunks: { vendor: ['react', 'react-dom', 'react-router-dom', 'axios'] },
      },
    },
  },
});
