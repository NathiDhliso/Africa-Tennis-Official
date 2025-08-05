import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { visualizer } from 'rollup-plugin-visualizer'
import viteCompression from 'vite-plugin-compression'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  return {
    plugins: [
      react({
        jsxRuntime: 'automatic',
        jsxImportSource: 'react'
      }),
      viteCompression({
        algorithm: 'gzip',
        ext: '.gz',
      }),
      viteCompression({
        algorithm: 'brotliCompress',
        ext: '.br',
      }),
      mode === 'analyze' && visualizer({
        open: true,
        filename: 'dist/stats.html',
        gzipSize: true,
        brotliSize: true,
      }),
    ],
    define: {
      global: 'globalThis',
      // Do not add module or require shims here - they cause vendor bundle issues
    },
    server: {
      host: true,
      port: 5173,
      strictPort: true,
      proxy: {
        '/api': {
          target: 'https://dd7v2jtghk.execute-api.us-west-2.amazonaws.com/prod',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
          configure: (proxy) => {
            proxy.on('error', (err) => {
              console.log('proxy error', err);
            });
          },
        }
      }
    },
    build: {
      sourcemap: mode !== 'production',
      rollupOptions: {
        output: {
          manualChunks: {
            'react-vendor': ['react', 'react-dom', 'react-router-dom'],
            'form-vendor': ['react-hook-form', '@hookform/resolvers', 'zod'],
            'data-vendor': ['@tanstack/react-query', 'zustand'],
            'ui-vendor': ['lucide-react'],
          }
        },
        external: [],
        treeshake: {
          preset: 'smallest',
          moduleSideEffects: false
        }
      },
      target: 'es2020',
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: mode === 'production',
          drop_debugger: mode === 'production',
        },
      },
    },
    resolve: {
      dedupe: ['react', 'react-dom', '@tanstack/react-query']
    },
    optimizeDeps: {
      include: [
        'react', 
        'react-dom', 
        'react-router-dom',
        '@supabase/supabase-js',
        'zustand',
        '@tanstack/react-query',
      ],
      exclude: [
        // TensorFlow dependencies removed - using backend processing
      ] 
    }
  }
})