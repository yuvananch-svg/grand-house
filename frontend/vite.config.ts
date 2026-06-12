import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import { VitePWA } from "vite-plugin-pwa";

const base = process.env.VITE_BASE ?? "/";

export default defineConfig({
  base,
  test: {
    include: ["src/**/*.test.{ts,tsx}"]
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom", "zustand"],
          charts: ["recharts"],
          pdf: ["pdfmake"]
        }
      }
    }
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["products/*.webp", "icons/*.svg"],
      manifest: {
        name: "Grand's House Local",
        short_name: "Grand's House",
        description: "Local-first operations app for Grand's House",
        theme_color: "#002F49",
        background_color: "#f8fafc",
        display: "standalone",
        start_url: base,
        scope: base,
        icons: [
          { src: `${base}icons/icon.svg`, sizes: "512x512", type: "image/svg+xml", purpose: "any" },
          { src: `${base}icons/maskable.svg`, sizes: "512x512", type: "image/svg+xml", purpose: "maskable" }
        ]
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,webp,woff2}"],
        globIgnores: ["**/pdf-*.js", "**/sarabun-*.js"],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        navigateFallback: `${base}index.html`
      }
    })
  ]
});
