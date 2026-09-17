import type { GameState, Team } from "../engine/types.js";

// Messages échangés entre client et serveur (JSON sur WebSocket).

export type ClientMessage = {
  type: "deploy";
  cardId: string;
  x: number;
  y: number;
};

export type ServerMessage =
  | { type: "waiting" }
  | { type: "start"; team: Team }
  | { type: "state"; state: GameState }
  | { type: "end"; winner: Team | "draw" };

export const WS_PORT = 8080;
