import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      react: path.resolve(__dirname, './node_modules/react'),
      'react-dom': path.resolve(__dirname, './node_modules/react-dom'),
    },
    dedupe: ['react', 'react-dom'],
  },
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-dom/client',
      'react/jsx-runtime',
      'react/jsx-dev-runtime',
      'react-router-dom',
      'zustand',
      'motion/react',
      'react-window',
      'lucide-react',
      'recharts',
      'exceljs',
      'xlsx',
      'hyperformula',
      'zod',
      'axios',
      'crypto-js',
      'date-fns',
      'dompurify',
      'lz-string',
      '@tanstack/react-virtual',
    ],
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'apple-touch-icon.png',
        'icon.svg',
        'pwa-192x192.png',
        'pwa-512x512.png',
        'pwa-maskable-512x512.png',
        'offline.html',
        'manifest.json',
      ],
      manifest: {
        id: '/',
        name: 'CIOB GMAO Light UI Excel',
        short_name: 'CIOB GMAO',
        description: 'Application CIOB GMAO Light UI Excel avec Twin Tables et calculs 100% Offline',
        theme_color: '#047857',
        background_color: '#f8fafc',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/pwa-maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 20 * 1024 * 1024,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2,json,webp}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/cdn\.tailwindcss\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'tailwind-cdn-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /^https:\/\/cdn\.jsdelivr\.net\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'jsdelivr-cdn-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gstatic-fonts-cache',
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /\/api\/gmao\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'gmao-api-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
      devOptions: {
        enabled: true,
        type: 'module',
      },
    }),
  ],
  esbuild: {
    jsx: 'automatic',
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('src/data/corrective')) {
            return 'data-corrective';
          }
          if (id.includes('src/data/preventive')) {
            return 'data-preventive';
          }
          if (id.includes('src/data/machines')) {
            return 'data-machines';
          }
          if (id.includes('src/data/stock')) {
            return 'data-stock';
          }
          if (id.includes('src/data/warehouse')) {
            return 'data-warehouse';
          }
          if (id.includes('src/data/zones')) {
            return 'data-zones';
          }
          if (id.includes('src/data/users')) {
            return 'data-users';
          }
          if (id.includes('src/data/movements')) {
            return 'data-movements';
          }
          if (id.includes('node_modules')) {
            if (id.includes('xlsx')) {
              return 'vendor-xlsx';
            }
            if (id.includes('lucide-react')) {
              return 'vendor-lucide';
            }
            if (id.includes('motion')) {
              return 'vendor-motion';
            }
            if (id.includes('zod')) {
              return 'vendor-zod';
            }
            return 'vendor-core';
          }
        }
      },
      onwarn(warning, defaultHandler) {
        if (
          warning.code === 'MODULE_LEVEL_DIRECTIVE' ||
          (warning.message && warning.message.includes('Module level directives cause errors when bundled'))
        ) {
          return;
        }
        defaultHandler(warning);
      },
    },
  },
  server: {
    port: 3000,
    hmr: false,
    headers: {
      'Content-Security-Policy': "default-src 'self' blob: data:; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.tailwindcss.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https://api.dicebear.com; connect-src 'self' blob: data:; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self';",
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'SAMEORIGIN',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    },
  },
  preview: {
    port: 3000,
    headers: {
      'Content-Security-Policy': "default-src 'self' blob: data:; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.tailwindcss.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https://api.dicebear.com; connect-src 'self' blob: data:; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self';",
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'SAMEORIGIN',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/tests/setup.js'],
    exclude: ['node_modules/**', 'dist/**', 'e2e/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: './coverage',
      exclude: ['node_modules/', 'src/tests/', 'e2e/', '**/*.d.ts'],
    },
  },
});
