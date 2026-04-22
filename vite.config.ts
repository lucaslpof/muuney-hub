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
            // xlsx (SheetJS) — isolated so dynamic import() in xlsxExport.ts
            // produces a true lazy chunk fetched only when user clicks
            // "Exportar Excel". Without this isolation, xlsx would be bundled
            // into vendor-misc (~420kB) and eagerly loaded on first page hit.
            if (id.includes('/xlsx/') || id.endsWith('/xlsx')) return 'vendor-xlsx';
            // Router: isolated so @remix-run/router does NOT leak into vendor-misc
            // and then close a cycle back to vendor-react.
            if (
              id.includes('/react-router') ||
              id.includes('@remix-run/router')
            ) return 'vendor-router';
            // vendor-react = pure React core only. NO router, NO consumer libs.
            // NOTE: react-is is intentionally NOT here — it must co-locate with its
            // consumers (hoist-non-react-statics via @sentry/react, recharts, etc.)
            // to avoid cross-chunk CJS-interop read-before-init, which surfaces as:
            //   Cannot read properties of undefined (reading 'ForwardRef')
            // We let react-is fall through to vendor-misc where Sentry + hoist
            // already live.
            if (
              id.includes('/react/') ||
              id.includes('/react-dom/') ||
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
