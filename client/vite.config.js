import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The home page's biggest picture is the hero background, which CSS only
// asks for once the app has started. On the home page, start downloading it
// straight away instead — it's what Google measures as "largest paint".
function preloadHero() {
  return {
    name: 'preload-hero',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        const file = Object.keys(ctx.bundle || {}).find((f) => /assets\/hero-bg-[\w-]+\.(webp|jpg)$/.test(f));
        if (!file) return html;
        const tag = `<script>if(location.pathname==='/'){var l=document.createElement('link');l.rel='preload';l.as='image';l.href='/${file}';l.fetchPriority='high';document.head.appendChild(l)}</script>`;
        return html.replace('</title>', `</title>\n    ${tag}`);
      },
    },
  };
}

// Shop (customer site). `npm start` → http://localhost:3001
export default defineConfig({
  plugins: [react(), preloadHero()],
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
        manualChunks: { vendor: ['react', 'react-dom', 'react-dom/client', 'react-router-dom', 'axios'] },
      },
    },
  },
});
