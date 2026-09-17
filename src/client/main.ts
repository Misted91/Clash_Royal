import { SimpleAI } from "../engine/ai.js";
import { GameEngine } from "../engine/engine.js";
import type { GameState, Team } from "../engine/types.js";
import { NetClient } from "../net/client.js";
import { WS_PORT } from "../net/protocol.js";
import { Hud } from "./hud.js";
import { Renderer } from "./renderer.js";

const wrap = document.getElementById("stage-wrap") as HTMLDivElement;
const menu = document.getElementById("menu") as HTMLDivElement;
const status = document.getElementById("status") as HTMLDivElement;

function viewportSize(): { w: number; h: number } {
  return { w: wrap.clientWidth || window.innerWidth, h: wrap.clientHeight || window.innerHeight };
}

/** Attache la gestion du clic/tap pour déployer une carte. */
function attachDeploy(
  renderer: Renderer,
  hud: Hud,
  canDeployNow: (cardId: string, x: number, y: number) => void
): void {
  renderer.canvas.style.cursor = "pointer";
  renderer.canvas.addEventListener("pointerdown", (e) => {
    const card = hud.getSelected();
    if (!card) return;
    const rect = renderer.canvas.getBoundingClientRect();
    const scaleX = renderer.canvas.width / rect.width;
    const scaleY = renderer.canvas.height / rect.height;
    const px = (e.clientX - rect.left) * scaleX;
    const py = (e.clientY - rect.top) * scaleY;
    const { x, y } = renderer.screenToWorld(px, py);
    canDeployNow(card, x, y);
  });
}

function showBanner(renderer: Renderer, state: GameState, localTeam: Team): void {
  if (state.phase !== "finished" || state.winner === null) return;
  const msg =
    state.winner === "draw"
      ? "Égalité !"
      : state.winner === localTeam
      ? "Victoire ! 🏆"
      : "Défaite…";
  renderer.banner(msg);
}

// ---------------------------------------------------------------------------
// Mode solo : moteur + IA tournent dans le navigateur.
// ---------------------------------------------------------------------------
async function startSolo(): Promise<void> {
  menu.classList.add("hidden");
  const { w, h } = viewportSize();
  const localTeam: Team = "blue";
  const renderer = new Renderer(localTeam);
  await renderer.init(w, h);
  wrap.appendChild(renderer.canvas);

  const engine = new GameEngine();
  const ai = new SimpleAI("red");
  const hud = new Hud(() => {});
  wrap.appendChild(hud.root);

  attachDeploy(renderer, hud, (cardId, x, y) => {
    if (engine.deploy({ team: localTeam, cardId, x, y })) hud.clearSelection();
  });

  const TICK = 1 / 20;
  let acc = 0;
  let last = performance.now();
  let over = false;

  function frame(now: number): void {
    const dt = Math.min(0.25, (now - last) / 1000);
    last = now;
    acc += dt;
    while (acc >= TICK) {
      engine.step(TICK);
      ai.update(engine, TICK);
      acc -= TICK;
    }
    const state = engine.getState();
    renderer.render(state);
    hud.update(state.elixir[localTeam], state.timeLeftS);
    if (state.phase === "finished" && !over) {
      over = true;
      showBanner(renderer, state, localTeam);
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

// ---------------------------------------------------------------------------
// Mode en ligne : le serveur fait autorité, le client rend les instantanés.
// ---------------------------------------------------------------------------
async function startOnline(): Promise<void> {
  status.textContent = "Connexion au serveur…";
  const host = location.hostname || "localhost";
  const url = `ws://${host}:${WS_PORT}`;

  let renderer: Renderer | null = null;
  let hud: Hud | null = null;
  let localTeam: Team = "blue";
  let over = false;

  const net = new NetClient(url, {
    onOpen: () => (status.textContent = "En attente d'un adversaire…"),
    onError: () =>
      (status.textContent = `Impossible de joindre le serveur (${url}). Lance « npm run server ».`),
    onClose: () => {
      if (!renderer) status.textContent = "Connexion fermée.";
    },
    onMessage: async (msg) => {
      switch (msg.type) {
        case "waiting":
          status.textContent = "En attente d'un adversaire…";
          break;
        case "start": {
          localTeam = msg.team;
          menu.classList.add("hidden");
          const { w, h } = viewportSize();
          renderer = new Renderer(localTeam);
          await renderer.init(w, h);
          wrap.appendChild(renderer.canvas);
          hud = new Hud(() => {});
          wrap.appendChild(hud.root);
          attachDeploy(renderer, hud, (cardId, x, y) => {
            net.send({ type: "deploy", cardId, x, y });
            hud!.clearSelection();
          });
          break;
        }
        case "state": {
          if (!renderer || !hud) return;
          renderer.render(msg.state);
          hud.update(msg.state.elixir[localTeam], msg.state.timeLeftS);
          break;
        }
        case "end": {
          if (!renderer || over) return;
          over = true;
          renderer.banner(
            msg.winner === "draw"
              ? "Égalité !"
              : msg.winner === localTeam
              ? "Victoire ! 🏆"
              : "Défaite…"
          );
          break;
        }
      }
    },
  });
  net.connect();
}

document.getElementById("btn-solo")?.addEventListener("click", () => {
  void startSolo();
});
document.getElementById("btn-online")?.addEventListener("click", () => {
  void startOnline();
});
