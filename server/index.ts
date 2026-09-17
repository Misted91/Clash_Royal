import { createServer } from "node:http";
import { WebSocket, WebSocketServer } from "ws";
import { GameEngine } from "../src/engine/engine.js";
import type { Team } from "../src/engine/types.js";
import type { ClientMessage, ServerMessage } from "../src/net/protocol.js";
import { WS_PORT } from "../src/net/protocol.js";

const TICK_HZ = 20;
const BROADCAST_EVERY = 2; // diffuse l'état 1 tick sur 2 (~10 Hz)

function send(ws: WebSocket, msg: ServerMessage): void {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
}

/** Une partie 1v1 : moteur autoritatif + boucle de simulation. */
class Match {
  private readonly engine = new GameEngine();
  private readonly sockets: Record<Team, WebSocket>;
  private tickCount = 0;
  private interval: ReturnType<typeof setInterval>;
  private ended = false;

  constructor(blue: WebSocket, red: WebSocket) {
    this.sockets = { blue, red };
    send(blue, { type: "start", team: "blue" });
    send(red, { type: "start", team: "red" });

    for (const team of ["blue", "red"] as Team[]) {
      this.sockets[team].on("message", (data) => this.onMessage(team, data.toString()));
      this.sockets[team].on("close", () => this.onDisconnect(team));
    }

    const dt = 1 / TICK_HZ;
    this.interval = setInterval(() => this.loop(dt), 1000 / TICK_HZ);
    console.log("Nouvelle partie démarrée.");
  }

  private onMessage(team: Team, raw: string): void {
    let msg: ClientMessage;
    try {
      msg = JSON.parse(raw) as ClientMessage;
    } catch {
      return;
    }
    if (msg.type === "deploy") {
      // Le serveur impose le camp : un joueur ne peut poser que pour le sien.
      this.engine.deploy({ team, cardId: msg.cardId, x: msg.x, y: msg.y });
    }
  }

  private loop(dt: number): void {
    if (this.ended) return;
    this.engine.step(dt);
    this.tickCount++;

    if (this.tickCount % BROADCAST_EVERY === 0) {
      const state = this.engine.getState();
      const stateMsg: ServerMessage = { type: "state", state };
      send(this.sockets.blue, stateMsg);
      send(this.sockets.red, stateMsg);
    }

    if (this.engine.phase === "finished") {
      this.finish(this.engine.winner ?? "draw");
    }
  }

  private finish(winner: Team | "draw"): void {
    if (this.ended) return;
    this.ended = true;
    clearInterval(this.interval);
    const endMsg: ServerMessage = { type: "end", winner };
    send(this.sockets.blue, endMsg);
    send(this.sockets.red, endMsg);
    console.log(`Partie terminée. Vainqueur : ${winner}`);
  }

  private onDisconnect(team: Team): void {
    if (this.ended) return;
    // L'adversaire gagne par forfait.
    this.finish(team === "blue" ? "red" : "blue");
  }
}

// --- Matchmaking : on apparie les joueurs deux par deux. ---
// Serveur HTTP (pour le health check des hébergeurs type Render) + WebSocket.
const PORT = Number(process.env.PORT) || WS_PORT;
const httpServer = createServer((req, res) => {
  if (req.url === "/health" || req.url === "/") {
    res.writeHead(200, { "content-type": "text/plain" });
    res.end("Web Royale server OK");
    return;
  }
  res.writeHead(404);
  res.end();
});

const wss = new WebSocketServer({ server: httpServer });
let waiting: WebSocket | null = null;

wss.on("connection", (ws) => {
  if (waiting && waiting.readyState === WebSocket.OPEN) {
    const opponent = waiting;
    waiting = null;
    new Match(opponent, ws);
  } else {
    waiting = ws;
    send(ws, { type: "waiting" });
    ws.on("close", () => {
      if (waiting === ws) waiting = null;
    });
  }
});

httpServer.listen(PORT, () => {
  console.log(`Serveur Web Royale à l'écoute sur le port ${PORT}`);
});
