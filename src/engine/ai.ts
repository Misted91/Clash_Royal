import { ARENA_W, RIVER_Y_MAX } from "./arena.js";
import { CARDS } from "./cards.js";
import type { GameEngine } from "./engine.js";
import type { Team } from "./types.js";

/**
 * IA simple pour le mode solo. Elle joue le camp "red" :
 *  - attend d'avoir assez d'élixir,
 *  - réagit aux troupes bleues qui approchent (défense),
 *  - sinon pousse sur une lane au hasard.
 */
export class SimpleAI {
  private cooldown = 0;
  private readonly deck = ["knight", "archers", "goblins", "musketeer", "giant"];

  constructor(private readonly team: Team = "red") {}

  update(engine: GameEngine, dt: number): void {
    this.cooldown -= dt;
    if (this.cooldown > 0) return;
    if (engine.phase !== "playing") return;

    const elixir = engine.elixir[this.team];

    // Menace : une unité bleue a franchi la rivière côté rouge ?
    const threat = engine.units.find((u) => u.team === "blue" && u.y < RIVER_Y_MAX + 4);

    let cardId: string | null = null;
    let x = Math.random() < 0.5 ? 4 : 14;
    let y = RIVER_Y_MAX - 2; // juste avant la rivière, côté rouge

    if (threat) {
      // Défendre : poser une troupe pas chère près de la menace.
      const options = ["goblins", "knight", "archers"].filter((c) => CARDS[c].cost <= elixir);
      if (options.length) {
        cardId = options[Math.floor(Math.random() * options.length)];
        x = Math.max(1, Math.min(ARENA_W - 1, threat.x));
        y = Math.max(1, RIVER_Y_MAX - 3);
      }
    } else if (elixir >= 6) {
      // Attaquer : privilégier une combinaison géant + soutien.
      const affordable = this.deck.filter((c) => CARDS[c].cost <= elixir);
      if (affordable.length) {
        cardId = affordable[Math.floor(Math.random() * affordable.length)];
      }
    }

    if (cardId) {
      const ok = engine.deploy({ team: this.team, cardId, x, y });
      this.cooldown = ok ? 1.2 + Math.random() * 1.5 : 0.4;
    } else {
      this.cooldown = 0.6;
    }
  }
}
