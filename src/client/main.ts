import { SimpleAI } from "../engine/ai.js";
import { GameEngine } from "../engine/engine.js";
import type { Team } from "../engine/types.js";
import { NetClient } from "../net/client.js";
import { WS_PORT } from "../net/protocol.js";
import { Hud } from "./hud.js";
import { Renderer } from "./renderer.js";

const wrap = document.getElementById("stage-wrap") as HTMLDivElement;
const menu = document.getElementById("menu") as HTMLDivElement;
const status = document.getElementById("status") as HTMLDivElement;
const btnSolo = document.getElementById("btn-solo") as HTMLButtonElement;
const btnOnline = document.getElementById("btn-online") as HTMLButtonElement;

/** Vrai dès qu'une partie (ou une recherche de partie) est en cours. */
let started = false;

function lockMenu(): void {
  started = true;
  btnSolo.disabled = true;
  btnOnline.disabled = true;
}

function backToMenu(): void {
  started = false;
  btnSolo.disabled = false;
  btnOnline.disabled = false;
  menu.classList.remove("hidden");
  status.textContent = "";
}

function viewportSize(): { w: number; h: number } {
  return { w: wrap.clientWidth || window.innerWidth, h: wrap.clientHeight || window.innerHeight };
}

/** Libère le rendu, l'interface et la connexion réseau d'une partie terminée. */
function teardownGame(renderer: Renderer | null, hud: Hud | null, net: NetClient | null): void {
  try {
    net?.close();
  } catch {
    /* ignore */
  }
  hud?.root.remove();
  if (renderer) {
    const canvas = renderer.canvas;
    try {
      renderer.app.destroy({ removeView: true }, { children: true });
    } catch {
      /* ignore */
    }
    canvas?.remove();
  }
}

/** Attache la gestion du clic/tap pour déployer une carte. */
function attachDeploy(
  renderer: Renderer,
  hud: Hud,
  onDeploy: (cardId: string, x: number, y: number) => void
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
    onDeploy(card, x, y);
  });
}

function endMessage(winner: Team | "draw", localTeam: Team): string {
  if (winner === "draw") return "Égalité !";
  return winner === localTeam ? "Victoire ! 🏆" : "Défaite…";
}

/** Overlay de fin de partie avec les boutons Rejouer / Menu. */
function showEndScreen(text: string, onReplay: () => void, onMenu: () => void): void {
  const overlay = document.createElement("div");
  overlay.style.cssText =
    "position:absolute;inset:0;z-index:20;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;background:rgba(14,17,22,.85);text-align:center;";

  const title = document.createElement("div");
  title.textContent = text;
  title.style.cssText = "font-size:38px;font-weight:bold;color:#fff;";
  overlay.appendChild(title);

  const row = document.createElement("div");
  row.style.cssText = "display:flex;gap:12px;flex-wrap:wrap;justify-content:center;";

  const mk = (label: string, primary: boolean, onClick: () => void): HTMLButtonElement => {
    const b = document.createElement("button");
    b.textContent = label;
    b.style.cssText = `padding:12px 26px;font-size:17px;border-radius:10px;cursor:pointer;border:1px solid ${
      primary ? "#e879f9" : "#2d333b"
    };background:${primary ? "#7e22ce" : "#161b22"};color:#fff;`;
    b.onclick = () => {
      overlay.remove();
      onClick();
    };
    return b;
  };

  row.appendChild(mk("🔁 Rejouer", true, onReplay));
  row.appendChild(mk("← Menu", false, onMenu));
  overlay.appendChild(row);
  wrap.appendChild(overlay);
}

// ---------------------------------------------------------------------------
// Mode solo : moteur + IA tournent dans le navigateur.
// ---------------------------------------------------------------------------
async function startSolo(): Promise<void> {
  lockMenu();
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
  let running = true;
  let over = false;

  const teardown = (): void => {
    running = false;
    teardownGame(renderer, hud, null);
  };

  function frame(now: number): void {
    if (!running) return;
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

    if (state.phase === "finished" && !over && state.winner) {
      over = true;
      showEndScreen(
        endMessage(state.winner, localTeam),
        () => {
          teardown();
          void startSolo();
        },
        () => {
          teardown();
          backToMenu();
        }
      );
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

// ---------------------------------------------------------------------------
// Mode en ligne : le serveur fait autorité, le client rend les instantanés.
// ---------------------------------------------------------------------------
function resolveWsUrl(): string {
  // Priorité : ?server=... dans l'URL, puis variable de build VITE_WS_URL,
  // puis localhost pour le développement.
  const param = new URLSearchParams(location.search).get("server");
  if (param) return param;
  if (import.meta.env.VITE_WS_URL) return import.meta.env.VITE_WS_URL;
  const proto = location.protocol === "https:" ? "wss" : "ws";
  const host = location.hostname || "localhost";
  return `${proto}://${host}:${WS_PORT}`;
}

async function startOnline(): Promise<void> {
  lockMenu();
  status.textContent = "Connexion au serveur…";
  const url = resolveWsUrl();

  let renderer: Renderer | null = null;
  let hud: Hud | null = null;
  let localTeam: Team = "blue";
  let over = false;

  // Déclaré avant l'usage pour que les callbacks puissent fermer la connexion.
  let net: NetClient;
  const teardown = (): void => teardownGame(renderer, hud, net);

  net = new NetClient(url, {
    onOpen: () => (status.textContent = "En attente d'un adversaire…"),
    onError: () => {
      net.close();
      backToMenu();
      status.textContent = `Impossible de joindre le serveur. Réessaie dans un instant (le serveur gratuit peut mettre ~50 s à se réveiller).`;
    },
    onClose: () => {
      // Déconnexion avant le début d'une partie → retour au menu.
      if (!renderer) backToMenu();
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
          if (over) return;
          over = true;
          showEndScreen(
            endMessage(msg.winner, localTeam),
            () => {
              teardown();
              void startOnline();
            },
            () => {
              teardown();
              backToMenu();
            }
          );
          break;
        }
      }
    },
  });
  net.connect();
}

btnSolo.addEventListener("click", () => {
  if (started) return;
  void startSolo();
});
btnOnline.addEventListener("click", () => {
  if (started) return;
  void startOnline();
});
