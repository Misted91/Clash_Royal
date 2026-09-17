import { defineConfig } from "vite";

// Le serveur de dev sert le client. Le serveur WebSocket tourne séparément
// (npm run server) sur le port 8080 ; le client s'y connecte pour le mode en ligne.
export default defineConfig({
  // GitHub Pages sert le site sous /<repo>/. Le workflow définit BASE_PATH ;
  // en local, la racine "/" est utilisée.
  base: process.env.BASE_PATH ?? "/",
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
