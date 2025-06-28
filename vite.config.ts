import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { visualizer } from 'rollup-plugin-visualizer'
import viteCompression from 'vite-plugin-compression'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env variables
  const env = loadEnv(mode, process.cwd(), '')
  
  return {
    plugins: [
      react(),
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
    server: {
      proxy: {
        '/api': {
          target: 'https://dd7v2jtghk.execute-api.us-west-2.amazonaws.com/prod',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
          configure: (proxy, _options) => {
            proxy.on('error', (err, _req, _res) => {
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
            'tensorflow': [
              '@tensorflow/tfjs', 
              '@tensorflow/tfjs-backend-webgl',
              '@tensorflow-models/pose-detection',
              '@tensorflow-models/coco-ssd'
            ],
          }
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
    optimizeDeps: {
      include: [
        'react', 
        'react-dom', 
        'react-router-dom',
        '@supabase/supabase-js',
        'zustand',
        '@tanstack/react-query'
      ],
      exclude: [
        '@tensorflow/tfjs', 
        '@tensorflow/tfjs-backend-webgl',
        '@tensorflow-models/pose-detection',
        '@tensorflow-models/coco-ssd'
      ]
    }
  }
})