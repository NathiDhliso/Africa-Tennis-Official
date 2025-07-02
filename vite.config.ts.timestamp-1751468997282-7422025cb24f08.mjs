// vite.config.ts
import { defineConfig } from "file:///C:/Users/nathi/OneDrive/Documents/HackathonProjects/Africa%20Tennis%20Official/node_modules/vite/dist/node/index.js";
import react from "file:///C:/Users/nathi/OneDrive/Documents/HackathonProjects/Africa%20Tennis%20Official/node_modules/@vitejs/plugin-react/dist/index.mjs";
import { visualizer } from "file:///C:/Users/nathi/OneDrive/Documents/HackathonProjects/Africa%20Tennis%20Official/node_modules/rollup-plugin-visualizer/dist/plugin/index.js";
import viteCompression from "file:///C:/Users/nathi/OneDrive/Documents/HackathonProjects/Africa%20Tennis%20Official/node_modules/vite-plugin-compression/dist/index.mjs";
var vite_config_default = defineConfig(({ mode }) => {
  return {
    plugins: [
      react(),
      viteCompression({
        algorithm: "gzip",
        ext: ".gz"
      }),
      viteCompression({
        algorithm: "brotliCompress",
        ext: ".br"
      }),
      mode === "analyze" && visualizer({
        open: true,
        filename: "dist/stats.html",
        gzipSize: true,
        brotliSize: true
      })
    ],
    server: {
      proxy: {
        "/api": {
          target: "https://dd7v2jtghk.execute-api.us-west-2.amazonaws.com/prod",
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ""),
          configure: (proxy, _options) => {
            proxy.on("error", (err, _req, _res) => {
              console.log("proxy error", err);
            });
          }
        }
      }
    },
    build: {
      sourcemap: mode !== "production",
      rollupOptions: {
        output: {
          manualChunks: {
            "react-vendor": ["react", "react-dom", "react-router-dom"],
            "form-vendor": ["react-hook-form", "@hookform/resolvers", "zod"],
            "data-vendor": ["@tanstack/react-query", "zustand"],
            "ui-vendor": ["lucide-react"],
            "tensorflow": [
              "@tensorflow/tfjs",
              "@tensorflow/tfjs-backend-webgl",
              "@tensorflow-models/pose-detection",
              "@tensorflow-models/coco-ssd"
            ]
          }
        }
      },
      target: "es2020",
      minify: "terser",
      terserOptions: {
        compress: {
          drop_console: mode === "production",
          drop_debugger: mode === "production"
        }
      }
    },
    optimizeDeps: {
      include: [
        "react",
        "react-dom",
        "react-router-dom",
        "@supabase/supabase-js",
        "zustand",
        "@tanstack/react-query",
        // CORRECTED: Move TensorFlow packages here
        "@tensorflow/tfjs",
        "@tensorflow/tfjs-backend-webgl",
        "@tensorflow-models/pose-detection",
        "@tensorflow-models/coco-ssd"
      ],
      // CORRECTED: Remove the exclude array or leave it empty
      exclude: []
    }
  };
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxuYXRoaVxcXFxPbmVEcml2ZVxcXFxEb2N1bWVudHNcXFxcSGFja2F0aG9uUHJvamVjdHNcXFxcQWZyaWNhIFRlbm5pcyBPZmZpY2lhbFwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiQzpcXFxcVXNlcnNcXFxcbmF0aGlcXFxcT25lRHJpdmVcXFxcRG9jdW1lbnRzXFxcXEhhY2thdGhvblByb2plY3RzXFxcXEFmcmljYSBUZW5uaXMgT2ZmaWNpYWxcXFxcdml0ZS5jb25maWcudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL0M6L1VzZXJzL25hdGhpL09uZURyaXZlL0RvY3VtZW50cy9IYWNrYXRob25Qcm9qZWN0cy9BZnJpY2ElMjBUZW5uaXMlMjBPZmZpY2lhbC92aXRlLmNvbmZpZy50c1wiO2ltcG9ydCB7IGRlZmluZUNvbmZpZyB9IGZyb20gJ3ZpdGUnXG5pbXBvcnQgcmVhY3QgZnJvbSAnQHZpdGVqcy9wbHVnaW4tcmVhY3QnXG5pbXBvcnQgeyB2aXN1YWxpemVyIH0gZnJvbSAncm9sbHVwLXBsdWdpbi12aXN1YWxpemVyJ1xuaW1wb3J0IHZpdGVDb21wcmVzc2lvbiBmcm9tICd2aXRlLXBsdWdpbi1jb21wcmVzc2lvbidcblxuLy8gaHR0cHM6Ly92aXRlanMuZGV2L2NvbmZpZy9cbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZygoeyBtb2RlIH0pID0+IHtcbiAgcmV0dXJuIHtcbiAgICBwbHVnaW5zOiBbXG4gICAgICByZWFjdCgpLFxuICAgICAgdml0ZUNvbXByZXNzaW9uKHtcbiAgICAgICAgYWxnb3JpdGhtOiAnZ3ppcCcsXG4gICAgICAgIGV4dDogJy5neicsXG4gICAgICB9KSxcbiAgICAgIHZpdGVDb21wcmVzc2lvbih7XG4gICAgICAgIGFsZ29yaXRobTogJ2Jyb3RsaUNvbXByZXNzJyxcbiAgICAgICAgZXh0OiAnLmJyJyxcbiAgICAgIH0pLFxuICAgICAgbW9kZSA9PT0gJ2FuYWx5emUnICYmIHZpc3VhbGl6ZXIoe1xuICAgICAgICBvcGVuOiB0cnVlLFxuICAgICAgICBmaWxlbmFtZTogJ2Rpc3Qvc3RhdHMuaHRtbCcsXG4gICAgICAgIGd6aXBTaXplOiB0cnVlLFxuICAgICAgICBicm90bGlTaXplOiB0cnVlLFxuICAgICAgfSksXG4gICAgXSxcbiAgICBzZXJ2ZXI6IHtcbiAgICAgIHByb3h5OiB7XG4gICAgICAgICcvYXBpJzoge1xuICAgICAgICAgIHRhcmdldDogJ2h0dHBzOi8vZGQ3djJqdGdoay5leGVjdXRlLWFwaS51cy13ZXN0LTIuYW1hem9uYXdzLmNvbS9wcm9kJyxcbiAgICAgICAgICBjaGFuZ2VPcmlnaW46IHRydWUsXG4gICAgICAgICAgcmV3cml0ZTogKHBhdGgpID0+IHBhdGgucmVwbGFjZSgvXlxcL2FwaS8sICcnKSxcbiAgICAgICAgICBjb25maWd1cmU6IChwcm94eSwgX29wdGlvbnMpID0+IHtcbiAgICAgICAgICAgIHByb3h5Lm9uKCdlcnJvcicsIChlcnIsIF9yZXEsIF9yZXMpID0+IHtcbiAgICAgICAgICAgICAgY29uc29sZS5sb2coJ3Byb3h5IGVycm9yJywgZXJyKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH0sXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9LFxuICAgIGJ1aWxkOiB7XG4gICAgICBzb3VyY2VtYXA6IG1vZGUgIT09ICdwcm9kdWN0aW9uJyxcbiAgICAgIHJvbGx1cE9wdGlvbnM6IHtcbiAgICAgICAgb3V0cHV0OiB7XG4gICAgICAgICAgbWFudWFsQ2h1bmtzOiB7XG4gICAgICAgICAgICAncmVhY3QtdmVuZG9yJzogWydyZWFjdCcsICdyZWFjdC1kb20nLCAncmVhY3Qtcm91dGVyLWRvbSddLFxuICAgICAgICAgICAgJ2Zvcm0tdmVuZG9yJzogWydyZWFjdC1ob29rLWZvcm0nLCAnQGhvb2tmb3JtL3Jlc29sdmVycycsICd6b2QnXSxcbiAgICAgICAgICAgICdkYXRhLXZlbmRvcic6IFsnQHRhbnN0YWNrL3JlYWN0LXF1ZXJ5JywgJ3p1c3RhbmQnXSxcbiAgICAgICAgICAgICd1aS12ZW5kb3InOiBbJ2x1Y2lkZS1yZWFjdCddLFxuICAgICAgICAgICAgJ3RlbnNvcmZsb3cnOiBbXG4gICAgICAgICAgICAgICdAdGVuc29yZmxvdy90ZmpzJywgXG4gICAgICAgICAgICAgICdAdGVuc29yZmxvdy90ZmpzLWJhY2tlbmQtd2ViZ2wnLFxuICAgICAgICAgICAgICAnQHRlbnNvcmZsb3ctbW9kZWxzL3Bvc2UtZGV0ZWN0aW9uJyxcbiAgICAgICAgICAgICAgJ0B0ZW5zb3JmbG93LW1vZGVscy9jb2NvLXNzZCdcbiAgICAgICAgICAgIF0sXG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9LFxuICAgICAgdGFyZ2V0OiAnZXMyMDIwJyxcbiAgICAgIG1pbmlmeTogJ3RlcnNlcicsXG4gICAgICB0ZXJzZXJPcHRpb25zOiB7XG4gICAgICAgIGNvbXByZXNzOiB7XG4gICAgICAgICAgZHJvcF9jb25zb2xlOiBtb2RlID09PSAncHJvZHVjdGlvbicsXG4gICAgICAgICAgZHJvcF9kZWJ1Z2dlcjogbW9kZSA9PT0gJ3Byb2R1Y3Rpb24nLFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICB9LFxuICAgIG9wdGltaXplRGVwczoge1xuICAgICAgaW5jbHVkZTogW1xuICAgICAgICAncmVhY3QnLCBcbiAgICAgICAgJ3JlYWN0LWRvbScsIFxuICAgICAgICAncmVhY3Qtcm91dGVyLWRvbScsXG4gICAgICAgICdAc3VwYWJhc2Uvc3VwYWJhc2UtanMnLFxuICAgICAgICAnenVzdGFuZCcsXG4gICAgICAgICdAdGFuc3RhY2svcmVhY3QtcXVlcnknLFxuICAgICAgICAvLyBDT1JSRUNURUQ6IE1vdmUgVGVuc29yRmxvdyBwYWNrYWdlcyBoZXJlXG4gICAgICAgICdAdGVuc29yZmxvdy90ZmpzJywgXG4gICAgICAgICdAdGVuc29yZmxvdy90ZmpzLWJhY2tlbmQtd2ViZ2wnLFxuICAgICAgICAnQHRlbnNvcmZsb3ctbW9kZWxzL3Bvc2UtZGV0ZWN0aW9uJyxcbiAgICAgICAgJ0B0ZW5zb3JmbG93LW1vZGVscy9jb2NvLXNzZCdcbiAgICAgIF0sXG4gICAgICAvLyBDT1JSRUNURUQ6IFJlbW92ZSB0aGUgZXhjbHVkZSBhcnJheSBvciBsZWF2ZSBpdCBlbXB0eVxuICAgICAgZXhjbHVkZTogW10gXG4gICAgfVxuICB9XG59KSJdLAogICJtYXBwaW5ncyI6ICI7QUFBa2EsU0FBUyxvQkFBb0I7QUFDL2IsT0FBTyxXQUFXO0FBQ2xCLFNBQVMsa0JBQWtCO0FBQzNCLE9BQU8scUJBQXFCO0FBRzVCLElBQU8sc0JBQVEsYUFBYSxDQUFDLEVBQUUsS0FBSyxNQUFNO0FBQ3hDLFNBQU87QUFBQSxJQUNMLFNBQVM7QUFBQSxNQUNQLE1BQU07QUFBQSxNQUNOLGdCQUFnQjtBQUFBLFFBQ2QsV0FBVztBQUFBLFFBQ1gsS0FBSztBQUFBLE1BQ1AsQ0FBQztBQUFBLE1BQ0QsZ0JBQWdCO0FBQUEsUUFDZCxXQUFXO0FBQUEsUUFDWCxLQUFLO0FBQUEsTUFDUCxDQUFDO0FBQUEsTUFDRCxTQUFTLGFBQWEsV0FBVztBQUFBLFFBQy9CLE1BQU07QUFBQSxRQUNOLFVBQVU7QUFBQSxRQUNWLFVBQVU7QUFBQSxRQUNWLFlBQVk7QUFBQSxNQUNkLENBQUM7QUFBQSxJQUNIO0FBQUEsSUFDQSxRQUFRO0FBQUEsTUFDTixPQUFPO0FBQUEsUUFDTCxRQUFRO0FBQUEsVUFDTixRQUFRO0FBQUEsVUFDUixjQUFjO0FBQUEsVUFDZCxTQUFTLENBQUMsU0FBUyxLQUFLLFFBQVEsVUFBVSxFQUFFO0FBQUEsVUFDNUMsV0FBVyxDQUFDLE9BQU8sYUFBYTtBQUM5QixrQkFBTSxHQUFHLFNBQVMsQ0FBQyxLQUFLLE1BQU0sU0FBUztBQUNyQyxzQkFBUSxJQUFJLGVBQWUsR0FBRztBQUFBLFlBQ2hDLENBQUM7QUFBQSxVQUNIO0FBQUEsUUFDRjtBQUFBLE1BQ0Y7QUFBQSxJQUNGO0FBQUEsSUFDQSxPQUFPO0FBQUEsTUFDTCxXQUFXLFNBQVM7QUFBQSxNQUNwQixlQUFlO0FBQUEsUUFDYixRQUFRO0FBQUEsVUFDTixjQUFjO0FBQUEsWUFDWixnQkFBZ0IsQ0FBQyxTQUFTLGFBQWEsa0JBQWtCO0FBQUEsWUFDekQsZUFBZSxDQUFDLG1CQUFtQix1QkFBdUIsS0FBSztBQUFBLFlBQy9ELGVBQWUsQ0FBQyx5QkFBeUIsU0FBUztBQUFBLFlBQ2xELGFBQWEsQ0FBQyxjQUFjO0FBQUEsWUFDNUIsY0FBYztBQUFBLGNBQ1o7QUFBQSxjQUNBO0FBQUEsY0FDQTtBQUFBLGNBQ0E7QUFBQSxZQUNGO0FBQUEsVUFDRjtBQUFBLFFBQ0Y7QUFBQSxNQUNGO0FBQUEsTUFDQSxRQUFRO0FBQUEsTUFDUixRQUFRO0FBQUEsTUFDUixlQUFlO0FBQUEsUUFDYixVQUFVO0FBQUEsVUFDUixjQUFjLFNBQVM7QUFBQSxVQUN2QixlQUFlLFNBQVM7QUFBQSxRQUMxQjtBQUFBLE1BQ0Y7QUFBQSxJQUNGO0FBQUEsSUFDQSxjQUFjO0FBQUEsTUFDWixTQUFTO0FBQUEsUUFDUDtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUE7QUFBQSxRQUVBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsTUFDRjtBQUFBO0FBQUEsTUFFQSxTQUFTLENBQUM7QUFBQSxJQUNaO0FBQUEsRUFDRjtBQUNGLENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==
