import {
  ARENA_H,
  ARENA_W,
  ELIXIR_MAX,
  ELIXIR_REGEN_S,
  ELIXIR_START,
  MATCH_DURATION_S,
  RIVER_Y_MID,
  canDeployAt,
  createTowers,
  nearestBridgeX,
  onBridge,
  sameRiverSide,
} from "./arena.js";
import { CARDS } from "./cards.js";
import type {
  DeployCommand,
  Effect,
  GameState,
  Phase,
  Team,
  Tower,
  Unit,
} from "./types.js";

const TOWER_RADIUS = 1.3;
/** Durée de vie d'un effet visuel, en ticks (20 Hz → ~0,7 s). */
const EFFECT_LIFETIME_TICKS = 14;

function dist(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}

function other(team: Team): Team {
  return team === "blue" ? "red" : "blue";
}

/**
 * Moteur de jeu autoritatif et déterministe. Ne dépend ni du DOM ni de Node :
 * il tourne à l'identique dans le navigateur (solo) et sur le serveur (en ligne).
 */
export class GameEngine {
  tick = 0;
  timeLeftS = MATCH_DURATION_S;
  phase: Phase = "playing";
  winner: Team | "draw" | null = null;
  units: Unit[] = [];
  towers: Tower[] = createTowers();
  effects: Effect[] = [];
  elixir: Record<Team, number> = { blue: ELIXIR_START, red: ELIXIR_START };

  private nextId = 1000;

  /** Tente de déployer une carte. Retourne false si refusé (élixir/zone). */
  deploy(cmd: DeployCommand): boolean {
    if (this.phase !== "playing") return false;
    const card = CARDS[cmd.cardId];
    if (!card) return false;
    if (this.elixir[cmd.team] < card.cost) return false;
    if (!canDeployAt(cmd.team, cmd.x, cmd.y, this.towers)) return false;

    this.elixir[cmd.team] -= card.cost;

    if (card.kind === "spell") {
      this.castSpell(cmd.team, cmd.x, cmd.y);
      return true;
    }

    // Répartit les unités multiples (gobelins…) en petit cercle.
    for (let i = 0; i < card.count; i++) {
      const angle = (i / Math.max(1, card.count)) * Math.PI * 2;
      const spread = card.count > 1 ? 0.6 : 0;
      this.units.push({
        id: this.nextId++,
        cardId: card.id,
        team: cmd.team,
        x: cmd.x + Math.cos(angle) * spread,
        y: cmd.y + Math.sin(angle) * spread,
        hp: card.hp,
        maxHp: card.hp,
        attackCooldown: 0,
        targetId: null,
        targetTower: null,
      });
    }
    return true;
  }

  private castSpell(team: Team, x: number, y: number): void {
    const card = CARDS.fireball;
    const r = card.spellRadius ?? 0;
    const dmg = card.spellDamage ?? 0;
    const foe = other(team);
    // Effet visuel d'explosion (rendu côté client).
    this.effects.push({
      id: this.nextId++,
      kind: "fireball",
      x,
      y,
      radius: r,
      bornTick: this.tick,
    });
    for (const u of this.units) {
      if (u.team === foe && dist(u.x, u.y, x, y) <= r) u.hp -= dmg;
    }
    for (const t of this.towers) {
      if (t.team === foe && dist(t.x, t.y, x, y) <= r) {
        t.hp -= dmg * 0.5; // les sorts font moins mal aux tours
        if (t.kind === "king") t.active = true;
      }
    }
  }

  /** Avance la simulation de `dt` secondes (typiquement 1/20). */
  step(dt: number): void {
    if (this.phase !== "playing") return;

    this.tick++;
    this.timeLeftS = Math.max(0, this.timeLeftS - dt);
    for (const team of ["blue", "red"] as Team[]) {
      this.elixir[team] = Math.min(
        ELIXIR_MAX,
        this.elixir[team] + dt / ELIXIR_REGEN_S
      );
    }

    for (const u of this.units) this.updateUnit(u, dt);
    for (const t of this.towers) this.updateTower(t, dt);

    // Purge des effets visuels périmés.
    this.effects = this.effects.filter(
      (e) => this.tick - e.bornTick < EFFECT_LIFETIME_TICKS
    );

    this.cull();
    this.checkEnd();
  }

  private updateUnit(u: Unit, dt: number): void {
    if (u.hp <= 0) return;
    const card = CARDS[u.cardId];
    u.attackCooldown = Math.max(0, u.attackCooldown - dt);

    const foe = other(u.team);

    // 1. Cible : unité ennemie proche (si autorisé), sinon tour ennemie.
    let target: { x: number; y: number; isTower: boolean; apply: (d: number) => void } | null =
      null;

    if (card.targets === "any") {
      let best: Unit | null = null;
      let bestD = card.aggroRange;
      for (const e of this.units) {
        if (e.team !== foe || e.hp <= 0) continue;
        const d = dist(u.x, u.y, e.x, e.y);
        if (d < bestD) {
          bestD = d;
          best = e;
        }
      }
      if (best) {
        const t = best;
        target = { x: t.x, y: t.y, isTower: false, apply: (d) => (t.hp -= d) };
      }
    }

    if (!target) {
      const tower = this.nearestTower(foe, u.x, u.y);
      if (tower) {
        target = {
          x: tower.x,
          y: tower.y,
          isTower: true,
          apply: (d) => {
            tower.hp -= d;
            if (tower.kind === "king") tower.active = true;
          },
        };
      }
    }

    if (!target) return; // plus rien à attaquer

    // 2. À portée ? (distance centre à centre moins les rayons)
    const targetRadius = target.isTower ? TOWER_RADIUS : 0.45;
    const reach = card.attackRange + card.radius + targetRadius;
    const d = dist(u.x, u.y, target.x, target.y);

    if (d <= reach) {
      if (u.attackCooldown <= 0) {
        target.apply(card.damage);
        // Dégâts de zone éventuels
        if (card.splashRadius > 0) {
          for (const e of this.units) {
            if (e.team === foe && e.hp > 0 && dist(e.x, e.y, target.x, target.y) <= card.splashRadius) {
              e.hp -= card.damage;
            }
          }
        }
        u.attackCooldown = card.attackCooldownS;
      }
      return;
    }

    // 3. Déplacement (avec passage par le pont si la rivière sépare).
    this.moveToward(u, card.moveSpeed * dt, target.x, target.y);
  }

  private moveToward(u: Unit, stepLen: number, gx: number, gy: number): void {
    let tx = gx;
    let ty = gy;

    // Si la cible est de l'autre côté de la rivière et qu'on n'est pas
    // déjà sur un pont, on vise d'abord le pont le plus proche.
    if (!sameRiverSide(u.y, gy) && !onBridge(u.x)) {
      tx = nearestBridgeX(u.x);
      ty = RIVER_Y_MID;
    }

    const dx = tx - u.x;
    const dy = ty - u.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    u.x += (dx / len) * stepLen;
    u.y += (dy / len) * stepLen;

    // Garde-fou : rester dans l'arène.
    u.x = Math.max(0.3, Math.min(ARENA_W - 0.3, u.x));
    u.y = Math.max(0.3, Math.min(ARENA_H - 0.3, u.y));
  }

  private updateTower(t: Tower, dt: number): void {
    if (t.hp <= 0) return;
    // Le roi s'active si une princesse alliée est tombée.
    if (t.kind === "king" && !t.active) {
      const princessesAlive = this.towers.some(
        (o) => o.team === t.team && o.kind === "princess" && o.hp > 0
      );
      if (!princessesAlive) t.active = true;
    }
    if (!t.active) return;

    t.attackCooldown = Math.max(0, t.attackCooldown - dt);
    const foe = other(t.team);

    let best: Unit | null = null;
    let bestD = t.range;
    for (const u of this.units) {
      if (u.team !== foe || u.hp <= 0) continue;
      const d = dist(t.x, t.y, u.x, u.y);
      if (d < bestD) {
        bestD = d;
        best = u;
      }
    }
    if (best && t.attackCooldown <= 0) {
      best.hp -= t.damage;
      t.attackCooldown = t.attackCooldownS;
    }
  }

  private nearestTower(team: Team, x: number, y: number): Tower | null {
    // Priorité aux princesses tant qu'elles protègent le roi.
    let best: Tower | null = null;
    let bestD = Infinity;
    for (const t of this.towers) {
      if (t.team !== team || t.hp <= 0) continue;
      // Le roi n'est ciblable qu'une fois ses princesses proches tombées,
      // ou s'il est déjà exposé (règle simplifiée : toujours ciblable en dernier).
      const d = dist(x, y, t.x, t.y);
      const priority = t.kind === "princess" ? 0 : 100; // princesses d'abord
      const score = d + priority;
      if (score < bestD) {
        bestD = score;
        best = t;
      }
    }
    return best;
  }

  private cull(): void {
    this.units = this.units.filter((u) => u.hp > 0);
    for (const t of this.towers) if (t.hp < 0) t.hp = 0;
  }

  private checkEnd(): void {
    const blueKing = this.towers.find((t) => t.team === "blue" && t.kind === "king");
    const redKing = this.towers.find((t) => t.team === "red" && t.kind === "king");
    if (!blueKing || blueKing.hp <= 0) return this.finish("red");
    if (!redKing || redKing.hp <= 0) return this.finish("blue");

    if (this.timeLeftS <= 0) {
      const blueTowers = this.towers.filter((t) => t.team === "blue" && t.hp > 0).length;
      const redTowers = this.towers.filter((t) => t.team === "red" && t.hp > 0).length;
      if (blueTowers > redTowers) return this.finish("blue");
      if (redTowers > blueTowers) return this.finish("red");
      // Égalité de tours → on départage aux PV totaux.
      const blueHp = this.teamTowerHp("blue");
      const redHp = this.teamTowerHp("red");
      if (blueHp > redHp) return this.finish("blue");
      if (redHp > blueHp) return this.finish("red");
      return this.finish("draw");
    }
  }

  private teamTowerHp(team: Team): number {
    return this.towers
      .filter((t) => t.team === team)
      .reduce((sum, t) => sum + Math.max(0, t.hp), 0);
  }

  private finish(winner: Team | "draw"): void {
    this.phase = "finished";
    this.winner = winner;
  }

  /** Instantané sérialisable de l'état courant. */
  getState(): GameState {
    return {
      tick: this.tick,
      timeLeftS: this.timeLeftS,
      phase: this.phase,
      winner: this.winner,
      units: this.units,
      towers: this.towers,
      effects: this.effects,
      elixir: this.elixir,
    };
  }
}
