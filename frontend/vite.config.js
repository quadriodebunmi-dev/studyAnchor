import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  preview: { port: 4173 },
  build: {
    // The service worker caches /assets/* forever, so make sure every build
    // produces content-hashed filenames there.
    assetsDir: "assets",
    
    // Explicitly enable copying the public directory (Vite does this by default,
    // but being explicit ensures it happens on all platforms/deployment services)
    copyPublicDir: true,
    
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom"],
          charts: ["recharts"],
        },
      },
    },
  },
  
  // Ensure manifest and other static files are treated as assets
  assetsInclude: ['**/*.webmanifest', '**/*.svg'],
});