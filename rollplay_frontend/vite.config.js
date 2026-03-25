import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: [
        "branding/favicon.png",
        "branding/apple-touch-icon.png",
        "branding/RollPay_Logo.png",
      ],
      manifest: {
        name: "RollPlay",
        short_name: "RollPlay",
        description: "Multiplayer pub-style bill splitting made social.",
        theme_color: "#f4c431",
        background_color: "#0d1118",
        display: "standalone",
        start_url: "/",
        scope: "/",
        icons: [
          {
            src: "/branding/pwa-192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/branding/pwa-512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "/branding/pwa-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
    }),
  ],
});