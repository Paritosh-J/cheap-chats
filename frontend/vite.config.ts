import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig(() => ({
    plugins: [react(), tailwindcss()],

    server: {
      port: 5173,
      proxy: {
        "/api": "http://localhost:8080",
        "/ws": {
          target: "http://localhost:8080",
          ws: true,
        },
      },

      host: true,
    },

    build: {
      outDir: "dist",
      sourcemap: false,
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ["react", "react-dom"],
            router: ["react-router-dom"],
            socket: ["socket.io-client", "sockjs-client", "@stomp/stompjs"],
          },
        },
      },
    },

    define: {
      global: "globalThis",
    },

    preview: {
      port: 4173,
      host: true,
    },
  }));
