var _a;
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import { VitePWA } from "vite-plugin-pwa";
var base = (_a = process.env.VITE_BASE) !== null && _a !== void 0 ? _a : "/";
export default defineConfig({
    base: base,
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
                    { src: "".concat(base, "icons/icon.svg"), sizes: "512x512", type: "image/svg+xml", purpose: "any" },
                    { src: "".concat(base, "icons/maskable.svg"), sizes: "512x512", type: "image/svg+xml", purpose: "maskable" }
                ]
            },
            workbox: {
                globPatterns: ["**/*.{js,css,html,ico,png,svg,webp,woff2}"],
                globIgnores: ["**/pdf-*.js", "**/sarabun-*.js"],
                maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
                navigateFallback: "".concat(base, "index.html")
            }
        })
    ]
});
