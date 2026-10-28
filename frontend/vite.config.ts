import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Les appels /api sont redirigés vers le back-end FastAPI pendant le développement.
// Si le port 8000 est déjà pris : NEXORA_API=http://127.0.0.1:8010 npm run dev
const apiTarget = process.env.NEXORA_API ?? "http://127.0.0.1:8000";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { "/api": apiTarget },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom"],
          charts: ["recharts"],
          icons: ["lucide-react"],
        },
      },
    },
  },
});
