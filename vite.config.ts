import { defineConfig } from "vite";

// Le serveur de dev sert le client. Le serveur WebSocket tourne séparément
// (npm run server) sur le port 8080 ; le client s'y connecte pour le mode en ligne.
export default defineConfig({
  root: ".",
  server: {
    port: 5173,
    open: false,
  },
  build: {
    target: "es2022",
    outDir: "dist",
  },
});
