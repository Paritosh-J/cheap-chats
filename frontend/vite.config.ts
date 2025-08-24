import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig(({mode}) => {
  const env = loadEnv(mode, ".", "");

  return {
    plugins: [react(), tailwindcss()],

    server: {
      port: 5173,
      proxy: {
        // only useful in local dev
        "/api": {
          target: env.VITE_BACKEND_URL || "http://localhost:8080",
          changeOrigin: true,
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
  }
});
