import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  server: {
    host: "::",
    port: 3001,
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Vendor chunk splitting — keeps initial bundle lean.
          // IMPORTANT: avoid circular chunk imports. If `vendor-react` imports
          // from `vendor-misc`, React's CJS-interop shim (`var k = hs.exports`)
          // can be read before it's populated, and libraries that extend
          // `React.PureComponent` at module-evaluation time (react-smooth,
          // react-transition-group) crash with:
          //   Cannot read properties of undefined (reading 'PureComponent')
          // Keep vendor-react = pure React core only, isolate router + charts
          // React-class consumers (react-smooth).
          if (id.includes('node_modules')) {
            if (id.includes('d3-') || id.includes('victory-vendor')) return 'vendor-d3';
            // recharts + react-smooth MUST share the chunk (react-smooth extends React.PureComponent)
            if (
              id.includes('recharts') ||
              id.includes('react-smooth') ||
              id.includes('react-transition-group')
            ) return 'vendor-charts';
            if (id.includes('framer-motion')) return 'vendor-motion';
            if (id.includes('@supabase/')) return 'vendor-supabase';
            if (id.includes('@tanstack/react-query')) return 'vendor-query';
            if (id.includes('react-helmet')) return 'vendor-helmet';
            if (id.includes('lucide-react')) return 'vendor-icons';
            // Router: isolated so @remix-run/router does NOT leak into vendor-misc
            // and then close a cycle back to vendor-react.
            if (
              id.includes('/react-router') ||
              id.includes('@remix-run/router')
            ) return 'vendor-router';
            // vendor-react = pure React core only. NO router, NO consumer libs.
            if (
              id.includes('/react/') ||
              id.includes('/react-dom/') ||
              id.includes('/react-is/') ||
              id.includes('/scheduler/')
            ) {
              return 'vendor-react';
            }
            // Catch-all for remaining small node_modules deps.
            return 'vendor-misc';
          }
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
});
