import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // We already ship hand-authored icons in public/icons; just make sure
      // they (and the SVG mark) end up precached alongside the JS/CSS bundle.
      includeAssets: ['favicon.png', 'icons/*.svg', 'icons/*.png'],
      manifest: {
        name: 'Nudge',
        short_name: 'Nudge',
        description: 'A to-do app that gently pushes you forward.',
        start_url: '/',
        display: 'standalone',
        background_color: '#FEFBF8',
        theme_color: '#A45400',
        orientation: 'portrait-primary',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/icons/maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // App-shell (JS/CSS/HTML/icons/fonts) precached for instant loads and
        // offline availability. API calls are handled separately below —
        // never precached, since task data changes constantly.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        navigateFallback: '/index.html',
        // Don't hijack the OAuth redirect chain (/api/auth/google -> Google ->
        // /api/auth/google/callback -> /auth/callback) with the SPA fallback.
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            // Data must be fresh when online; NetworkFirst still lets the
            // last-seen list of tasks show up if the request fails offline,
            // which is more useful than a blank screen.
            urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'nudge-api-cache',
              networkTimeoutSeconds: 8,
              cacheableResponse: { statuses: [0, 200] },
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 },
            },
          },
          {
            urlPattern: ({ url }) => url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com',
            handler: 'CacheFirst',
            options: {
              cacheName: 'nudge-fonts-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
      },
      devOptions: {
        // Lets `npm run dev` register a SW too, so PWA behaviour can be
        // tested locally instead of only after a production deploy.
        enabled: true,
        type: 'module',
      },
    }),
  ],
  server: {
    port: 3000,
    proxy: {
      // Dev-only: lets the frontend call /api/* without CORS.
      '/api': { target: 'http://localhost:5000', changeOrigin: true },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          motion: ['framer-motion'],
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.js',
  },
});
