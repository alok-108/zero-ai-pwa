import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'Zero AI — Private Offline Chat',
        short_name: 'Zero AI',
        description: 'A 100% private, offline AI chat app powered by WebLLM. No servers, no API keys, no bills.',
        theme_color: '#020617',
        background_color: '#020617',
        display: 'standalone',
        orientation: 'portrait-primary',
        start_url: '/',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        // Only cache app shell — model files are too large for SW cache
        globPatterns: ['**/*.{js,css,html,png,svg,ico}'],
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024, // 10 MB
        runtimeCaching: [],
      },
    }),
  ],
  optimizeDeps: {
    // Exclude WASM-based packages and WebLLM from pre-bundling
    exclude: ['@mlc-ai/web-llm', 'voy-search', '@xenova/transformers'],
  },
  build: {
    target: 'esnext',
    rollupOptions: {
      output: {},
    },
    // Allow large chunks (WebLLM JS is ~6 MB)
    chunkSizeWarningLimit: 8000,
  },
  assetsInclude: ['**/*.wasm'],
  server: {
    headers: {
      // Required for SharedArrayBuffer (WebGPU/WASM)
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
})
