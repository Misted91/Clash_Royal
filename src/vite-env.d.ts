/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** URL du serveur WebSocket pour le mode en ligne (ex: wss://xxx.onrender.com). */
  readonly VITE_WS_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
