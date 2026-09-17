import { Application, Container, Graphics, Text } from "pixi.js";
import {
  ARENA_H,
  ARENA_W,
  BRIDGE_LEFT_X,
  BRIDGE_RIGHT_X,
  RIVER_Y_MAX,
  RIVER_Y_MIN,
} from "../engine/arena.js";
import { CARDS } from "../engine/cards.js";
import type { GameState, Team } from "../engine/types.js";

/** Rend l'état du jeu avec PixiJS. Le camp local est toujours affiché en bas. */
export class Renderer {
  readonly app = new Application();
  private readonly world = new Container();
  private readonly dyn = new Graphics();
  private readonly labels = new Container();
  ts = 16; // taille d'une tuile en pixels

  constructor(private readonly viewTeam: Team) {}

  async init(width: number, height: number): Promise<void> {
    this.ts = Math.min(width / ARENA_W, height / ARENA_H);
    await this.app.init({
      width: ARENA_W * this.ts,
      height: ARENA_H * this.ts,
      background: 0x1b5e20,
      antialias: true,
    });
    this.app.stage.addChild(this.world);
    this.drawBackground();
    this.world.addChild(this.dyn);
    this.world.addChild(this.labels);
  }

  get canvas(): HTMLCanvasElement {
    return this.app.canvas;
  }

  private wx(x: number): number {
    return (this.viewTeam === "blue" ? x : ARENA_W - x) * this.ts;
  }
  private wy(y: number): number {
    return (this.viewTeam === "blue" ? y : ARENA_H - y) * this.ts;
  }

  /** Convertit un point écran (px) en coordonnées monde (tuiles). */
  screenToWorld(px: number, py: number): { x: number; y: number } {
    const tx = px / this.ts;
    const ty = py / this.ts;
    return this.viewTeam === "blue"
      ? { x: tx, y: ty }
      : { x: ARENA_W - tx, y: ARENA_H - ty };
  }

  private drawBackground(): void {
    const g = new Graphics();
    // Pelouse (deux nuances par moitié)
    g.rect(0, 0, ARENA_W * this.ts, ARENA_H * this.ts).fill(0x2e7d32);
    // Rivière
    g.rect(0, RIVER_Y_MIN * this.ts, ARENA_W * this.ts, (RIVER_Y_MAX - RIVER_Y_MIN) * this.ts).fill(
      0x1565c0
    );
    // Ponts
    const bridgeW = 2 * this.ts;
    for (const bx of [BRIDGE_LEFT_X, BRIDGE_RIGHT_X]) {
      g.rect(
        (bx - 1) * this.ts,
        RIVER_Y_MIN * this.ts,
        bridgeW,
        (RIVER_Y_MAX - RIVER_Y_MIN) * this.ts
      ).fill(0x8d6e63);
    }
    this.world.addChild(g);
  }

  render(state: GameState): void {
    const g = this.dyn;
    g.clear();
    this.labels.removeChildren();

    // Tours
    for (const t of state.towers) {
      if (t.hp <= 0) continue;
      const cx = this.wx(t.x);
      const cy = this.wy(t.y);
      const size = (t.kind === "king" ? 2.4 : 1.9) * this.ts;
      const col = t.team === "blue" ? 0x2196f3 : 0xe53935;
      g.rect(cx - size / 2, cy - size / 2, size, size).fill(col).stroke({ width: 2, color: 0x000000 });
      this.hpBar(g, cx, cy - size / 2 - 6, size, t.hp / t.maxHp);
    }

    // Unités
    for (const u of state.units) {
      const card = CARDS[u.cardId];
      const cx = this.wx(u.x);
      const cy = this.wy(u.y);
      const r = card.radius * this.ts;
      g.circle(cx, cy, r).fill(card.color).stroke({
        width: 2,
        color: u.team === "blue" ? 0x0d47a1 : 0xb71c1c,
      });
      this.hpBar(g, cx, cy - r - 5, Math.max(r * 2, 14), u.hp / u.maxHp);
    }
  }

  private hpBar(g: Graphics, cx: number, top: number, width: number, frac: number): void {
    const w = width;
    const h = 4;
    const x = cx - w / 2;
    g.rect(x, top, w, h).fill(0x000000);
    g.rect(x, top, w * Math.max(0, Math.min(1, frac)), h).fill(
      frac > 0.5 ? 0x4caf50 : frac > 0.25 ? 0xffb300 : 0xe53935
    );
  }

  /** Affiche un message central (fin de partie…). */
  banner(text: string): void {
    const label = new Text({
      text,
      style: { fill: 0xffffff, fontSize: 34, fontWeight: "bold", align: "center" },
    });
    label.anchor.set(0.5);
    label.x = (ARENA_W * this.ts) / 2;
    label.y = (ARENA_H * this.ts) / 2;
    this.labels.addChild(label);
  }
}
