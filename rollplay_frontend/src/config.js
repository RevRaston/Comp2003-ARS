// src/config.js
export const BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL || "http://localhost:3000";

export const BACKEND_WS_URL =
  import.meta.env.VITE_BACKEND_WS_URL || "ws://localhost:3000/ws";

// Optional: quick debug in dev
export function logRuntimeConfig() {
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.log("[config] BACKEND_URL:", BACKEND_URL);
    // eslint-disable-next-line no-console
    console.log("[config] BACKEND_WS_URL:", BACKEND_WS_URL);
  }
}