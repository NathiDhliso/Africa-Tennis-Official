// vite.config.ts
import { defineConfig, loadEnv } from "file:///home/project/node_modules/vite/dist/node/index.js";
import react from "file:///home/project/node_modules/@vitejs/plugin-react/dist/index.mjs";
import { visualizer } from "file:///home/project/node_modules/rollup-plugin-visualizer/dist/plugin/index.js";
import viteCompression from "file:///home/project/node_modules/vite-plugin-compression/dist/index.mjs";
var vite_config_default = defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
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
        "@tanstack/react-query"
      ],
      exclude: [
        "@tensorflow/tfjs",
        "@tensorflow/tfjs-backend-webgl",
        "@tensorflow-models/pose-detection",
        "@tensorflow-models/coco-ssd"
      ]
    }
  };
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvaG9tZS9wcm9qZWN0XCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCIvaG9tZS9wcm9qZWN0L3ZpdGUuY29uZmlnLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9ob21lL3Byb2plY3Qvdml0ZS5jb25maWcudHNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcsIGxvYWRFbnYgfSBmcm9tICd2aXRlJ1xuaW1wb3J0IHJlYWN0IGZyb20gJ0B2aXRlanMvcGx1Z2luLXJlYWN0J1xuaW1wb3J0IHsgdmlzdWFsaXplciB9IGZyb20gJ3JvbGx1cC1wbHVnaW4tdmlzdWFsaXplcidcbmltcG9ydCB2aXRlQ29tcHJlc3Npb24gZnJvbSAndml0ZS1wbHVnaW4tY29tcHJlc3Npb24nXG5cbi8vIGh0dHBzOi8vdml0ZWpzLmRldi9jb25maWcvXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoKHsgbW9kZSB9KSA9PiB7XG4gIC8vIExvYWQgZW52IHZhcmlhYmxlc1xuICBjb25zdCBlbnYgPSBsb2FkRW52KG1vZGUsIHByb2Nlc3MuY3dkKCksICcnKVxuICBcbiAgcmV0dXJuIHtcbiAgICBwbHVnaW5zOiBbXG4gICAgICByZWFjdCgpLFxuICAgICAgdml0ZUNvbXByZXNzaW9uKHtcbiAgICAgICAgYWxnb3JpdGhtOiAnZ3ppcCcsXG4gICAgICAgIGV4dDogJy5neicsXG4gICAgICB9KSxcbiAgICAgIHZpdGVDb21wcmVzc2lvbih7XG4gICAgICAgIGFsZ29yaXRobTogJ2Jyb3RsaUNvbXByZXNzJyxcbiAgICAgICAgZXh0OiAnLmJyJyxcbiAgICAgIH0pLFxuICAgICAgbW9kZSA9PT0gJ2FuYWx5emUnICYmIHZpc3VhbGl6ZXIoe1xuICAgICAgICBvcGVuOiB0cnVlLFxuICAgICAgICBmaWxlbmFtZTogJ2Rpc3Qvc3RhdHMuaHRtbCcsXG4gICAgICAgIGd6aXBTaXplOiB0cnVlLFxuICAgICAgICBicm90bGlTaXplOiB0cnVlLFxuICAgICAgfSksXG4gICAgXSxcbiAgICBzZXJ2ZXI6IHtcbiAgICAgIHByb3h5OiB7XG4gICAgICAgICcvYXBpJzoge1xuICAgICAgICAgIHRhcmdldDogJ2h0dHBzOi8vZGQ3djJqdGdoay5leGVjdXRlLWFwaS51cy13ZXN0LTIuYW1hem9uYXdzLmNvbS9wcm9kJyxcbiAgICAgICAgICBjaGFuZ2VPcmlnaW46IHRydWUsXG4gICAgICAgICAgcmV3cml0ZTogKHBhdGgpID0+IHBhdGgucmVwbGFjZSgvXlxcL2FwaS8sICcnKSxcbiAgICAgICAgICBjb25maWd1cmU6IChwcm94eSwgX29wdGlvbnMpID0+IHtcbiAgICAgICAgICAgIHByb3h5Lm9uKCdlcnJvcicsIChlcnIsIF9yZXEsIF9yZXMpID0+IHtcbiAgICAgICAgICAgICAgY29uc29sZS5sb2coJ3Byb3h5IGVycm9yJywgZXJyKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH0sXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9LFxuICAgIGJ1aWxkOiB7XG4gICAgICBzb3VyY2VtYXA6IG1vZGUgIT09ICdwcm9kdWN0aW9uJyxcbiAgICAgIHJvbGx1cE9wdGlvbnM6IHtcbiAgICAgICAgb3V0cHV0OiB7XG4gICAgICAgICAgbWFudWFsQ2h1bmtzOiB7XG4gICAgICAgICAgICAncmVhY3QtdmVuZG9yJzogWydyZWFjdCcsICdyZWFjdC1kb20nLCAncmVhY3Qtcm91dGVyLWRvbSddLFxuICAgICAgICAgICAgJ2Zvcm0tdmVuZG9yJzogWydyZWFjdC1ob29rLWZvcm0nLCAnQGhvb2tmb3JtL3Jlc29sdmVycycsICd6b2QnXSxcbiAgICAgICAgICAgICdkYXRhLXZlbmRvcic6IFsnQHRhbnN0YWNrL3JlYWN0LXF1ZXJ5JywgJ3p1c3RhbmQnXSxcbiAgICAgICAgICAgICd1aS12ZW5kb3InOiBbJ2x1Y2lkZS1yZWFjdCddLFxuICAgICAgICAgICAgJ3RlbnNvcmZsb3cnOiBbXG4gICAgICAgICAgICAgICdAdGVuc29yZmxvdy90ZmpzJywgXG4gICAgICAgICAgICAgICdAdGVuc29yZmxvdy90ZmpzLWJhY2tlbmQtd2ViZ2wnLFxuICAgICAgICAgICAgICAnQHRlbnNvcmZsb3ctbW9kZWxzL3Bvc2UtZGV0ZWN0aW9uJyxcbiAgICAgICAgICAgICAgJ0B0ZW5zb3JmbG93LW1vZGVscy9jb2NvLXNzZCdcbiAgICAgICAgICAgIF0sXG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9LFxuICAgICAgdGFyZ2V0OiAnZXMyMDIwJyxcbiAgICAgIG1pbmlmeTogJ3RlcnNlcicsXG4gICAgICB0ZXJzZXJPcHRpb25zOiB7XG4gICAgICAgIGNvbXByZXNzOiB7XG4gICAgICAgICAgZHJvcF9jb25zb2xlOiBtb2RlID09PSAncHJvZHVjdGlvbicsXG4gICAgICAgICAgZHJvcF9kZWJ1Z2dlcjogbW9kZSA9PT0gJ3Byb2R1Y3Rpb24nLFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICB9LFxuICAgIG9wdGltaXplRGVwczoge1xuICAgICAgaW5jbHVkZTogW1xuICAgICAgICAncmVhY3QnLCBcbiAgICAgICAgJ3JlYWN0LWRvbScsIFxuICAgICAgICAncmVhY3Qtcm91dGVyLWRvbScsXG4gICAgICAgICdAc3VwYWJhc2Uvc3VwYWJhc2UtanMnLFxuICAgICAgICAnenVzdGFuZCcsXG4gICAgICAgICdAdGFuc3RhY2svcmVhY3QtcXVlcnknXG4gICAgICBdLFxuICAgICAgZXhjbHVkZTogW1xuICAgICAgICAnQHRlbnNvcmZsb3cvdGZqcycsIFxuICAgICAgICAnQHRlbnNvcmZsb3cvdGZqcy1iYWNrZW5kLXdlYmdsJyxcbiAgICAgICAgJ0B0ZW5zb3JmbG93LW1vZGVscy9wb3NlLWRldGVjdGlvbicsXG4gICAgICAgICdAdGVuc29yZmxvdy1tb2RlbHMvY29jby1zc2QnXG4gICAgICBdXG4gICAgfVxuICB9XG59KSJdLAogICJtYXBwaW5ncyI6ICI7QUFBeU4sU0FBUyxjQUFjLGVBQWU7QUFDL1AsT0FBTyxXQUFXO0FBQ2xCLFNBQVMsa0JBQWtCO0FBQzNCLE9BQU8scUJBQXFCO0FBRzVCLElBQU8sc0JBQVEsYUFBYSxDQUFDLEVBQUUsS0FBSyxNQUFNO0FBRXhDLFFBQU0sTUFBTSxRQUFRLE1BQU0sUUFBUSxJQUFJLEdBQUcsRUFBRTtBQUUzQyxTQUFPO0FBQUEsSUFDTCxTQUFTO0FBQUEsTUFDUCxNQUFNO0FBQUEsTUFDTixnQkFBZ0I7QUFBQSxRQUNkLFdBQVc7QUFBQSxRQUNYLEtBQUs7QUFBQSxNQUNQLENBQUM7QUFBQSxNQUNELGdCQUFnQjtBQUFBLFFBQ2QsV0FBVztBQUFBLFFBQ1gsS0FBSztBQUFBLE1BQ1AsQ0FBQztBQUFBLE1BQ0QsU0FBUyxhQUFhLFdBQVc7QUFBQSxRQUMvQixNQUFNO0FBQUEsUUFDTixVQUFVO0FBQUEsUUFDVixVQUFVO0FBQUEsUUFDVixZQUFZO0FBQUEsTUFDZCxDQUFDO0FBQUEsSUFDSDtBQUFBLElBQ0EsUUFBUTtBQUFBLE1BQ04sT0FBTztBQUFBLFFBQ0wsUUFBUTtBQUFBLFVBQ04sUUFBUTtBQUFBLFVBQ1IsY0FBYztBQUFBLFVBQ2QsU0FBUyxDQUFDLFNBQVMsS0FBSyxRQUFRLFVBQVUsRUFBRTtBQUFBLFVBQzVDLFdBQVcsQ0FBQyxPQUFPLGFBQWE7QUFDOUIsa0JBQU0sR0FBRyxTQUFTLENBQUMsS0FBSyxNQUFNLFNBQVM7QUFDckMsc0JBQVEsSUFBSSxlQUFlLEdBQUc7QUFBQSxZQUNoQyxDQUFDO0FBQUEsVUFDSDtBQUFBLFFBQ0Y7QUFBQSxNQUNGO0FBQUEsSUFDRjtBQUFBLElBQ0EsT0FBTztBQUFBLE1BQ0wsV0FBVyxTQUFTO0FBQUEsTUFDcEIsZUFBZTtBQUFBLFFBQ2IsUUFBUTtBQUFBLFVBQ04sY0FBYztBQUFBLFlBQ1osZ0JBQWdCLENBQUMsU0FBUyxhQUFhLGtCQUFrQjtBQUFBLFlBQ3pELGVBQWUsQ0FBQyxtQkFBbUIsdUJBQXVCLEtBQUs7QUFBQSxZQUMvRCxlQUFlLENBQUMseUJBQXlCLFNBQVM7QUFBQSxZQUNsRCxhQUFhLENBQUMsY0FBYztBQUFBLFlBQzVCLGNBQWM7QUFBQSxjQUNaO0FBQUEsY0FDQTtBQUFBLGNBQ0E7QUFBQSxjQUNBO0FBQUEsWUFDRjtBQUFBLFVBQ0Y7QUFBQSxRQUNGO0FBQUEsTUFDRjtBQUFBLE1BQ0EsUUFBUTtBQUFBLE1BQ1IsUUFBUTtBQUFBLE1BQ1IsZUFBZTtBQUFBLFFBQ2IsVUFBVTtBQUFBLFVBQ1IsY0FBYyxTQUFTO0FBQUEsVUFDdkIsZUFBZSxTQUFTO0FBQUEsUUFDMUI7QUFBQSxNQUNGO0FBQUEsSUFDRjtBQUFBLElBQ0EsY0FBYztBQUFBLE1BQ1osU0FBUztBQUFBLFFBQ1A7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLE1BQ0Y7QUFBQSxNQUNBLFNBQVM7QUFBQSxRQUNQO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsTUFDRjtBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBQ0YsQ0FBQzsiLAogICJuYW1lcyI6IFtdCn0K
