import type { Team, Tower } from "./types.js";

// Dimensions de l'arène en tuiles (repère : Clash Royale ≈ 18 x 32).
export const ARENA_W = 18;
export const ARENA_H = 32;

// La rivière occupe la bande centrale. Les unités au sol ne peuvent la
// traverser que par les ponts.
export const RIVER_Y_MIN = 15;
export const RIVER_Y_MAX = 17;
export const RIVER_Y_MID = 16;

// Position en X des deux ponts (lane gauche / lane droite).
export const BRIDGE_LEFT_X = 3.5;
export const BRIDGE_RIGHT_X = 14.5;
export const BRIDGE_HALF_WIDTH = 1.0;

export const MATCH_DURATION_S = 180;
export const ELIXIR_MAX = 10;
export const ELIXIR_START = 5;
/** Secondes pour régénérer 1 point d'élixir (mode simple). */
export const ELIXIR_REGEN_S = 2.8;

/** true si le point (x,y) est sur un pont (donc franchissable). */
export function onBridge(x: number): boolean {
  return (
    Math.abs(x - BRIDGE_LEFT_X) <= BRIDGE_HALF_WIDTH ||
    Math.abs(x - BRIDGE_RIGHT_X) <= BRIDGE_HALF_WIDTH
  );
}

/** Pont le plus proche d'une position X donnée. */
export function nearestBridgeX(x: number): number {
  return Math.abs(x - BRIDGE_LEFT_X) < Math.abs(x - BRIDGE_RIGHT_X)
    ? BRIDGE_LEFT_X
    : BRIDGE_RIGHT_X;
}

export function sameRiverSide(y1: number, y2: number): boolean {
  const top1 = y1 < RIVER_Y_MID;
  const top2 = y2 < RIVER_Y_MID;
  return top1 === top2;
}

/** Crée les 6 tours de départ (roi + 2 princesses par camp). */
export function createTowers(): Tower[] {
  const mk = (
    id: number,
    team: Team,
    kind: "king" | "princess",
    x: number,
    y: number
  ): Tower => {
    const isKing = kind === "king";
    return {
      id,
      team,
      kind,
      x,
      y,
      hp: isKing ? 2400 : 1400,
      maxHp: isKing ? 2400 : 1400,
      range: isKing ? 7 : 7.5,
      damage: isKing ? 60 : 55,
      attackCooldownS: isKing ? 1.0 : 0.8,
      attackCooldown: 0,
      // Le roi ne tire qu'après avoir été touché ou une princesse détruite.
      active: !isKing,
    };
  };

  return [
    // Rouge (haut)
    mk(1, "red", "king", 9, 2.5),
    mk(2, "red", "princess", 3.5, 6.5),
    mk(3, "red", "princess", 14.5, 6.5),
    // Bleu (bas)
    mk(4, "blue", "king", 9, ARENA_H - 2.5),
    mk(5, "blue", "princess", 3.5, ARENA_H - 6.5),
    mk(6, "blue", "princess", 14.5, ARENA_H - 6.5),
  ];
}

/** Le camp "red" attaque vers le bas (y croissant), "blue" vers le haut. */
export function forwardDir(team: Team): number {
  return team === "red" ? 1 : -1;
}

/** Zone de déploiement autorisée pour un camp (moitié de terrain + ponts). */
export function canDeploy(team: Team, x: number, y: number): boolean {
  if (x < 0.5 || x > ARENA_W - 0.5 || y < 0.5 || y > ARENA_H - 0.5) return false;
  if (team === "blue") return y > RIVER_Y_MAX; // moitié basse
  return y < RIVER_Y_MIN; // moitié haute
}
