// Types partagés entre le moteur, le client et le serveur.
// Aucune dépendance navigateur ou Node ici : ce fichier doit rester "pur".

export type Team = "blue" | "red";

/** Ce qu'une unité peut prendre pour cible. */
export type TargetKind = "any" | "buildings";

/** Définition statique d'une carte (immuable). */
export interface CardDef {
  id: string;
  name: string;
  cost: number;
  /** Nombre d'unités posées d'un coup (ex: 3 gobelins). */
  count: number;
  kind: "troop" | "spell";
  // Stats de troupe (ignorées pour les sorts)
  hp: number;
  damage: number;
  /** Portée d'attaque, en tuiles. */
  attackRange: number;
  /** Délai entre deux attaques, en secondes. */
  attackCooldownS: number;
  /** Vitesse de déplacement, en tuiles/seconde. */
  moveSpeed: number;
  /** Distance à laquelle l'unité repère un ennemi et le prend en chasse. */
  aggroRange: number;
  targets: TargetKind;
  /** Rayon de dégâts de zone à l'impact (0 = mono-cible). */
  splashRadius: number;
  /** Rayon physique pour l'affichage/collisions légères. */
  radius: number;
  color: number;
  // Champs spécifiques aux sorts
  spellRadius?: number;
  spellDamage?: number;
}

/** Instance d'une unité vivante dans la partie. */
export interface Unit {
  id: number;
  cardId: string;
  team: Team;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  attackCooldown: number;
  targetId: number | null;
  targetTower: number | null;
}

export type TowerKind = "king" | "princess";

export interface Tower {
  id: number;
  team: Team;
  kind: TowerKind;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  range: number;
  damage: number;
  attackCooldownS: number;
  attackCooldown: number;
  active: boolean; // la tour du roi ne tire qu'une fois activée
}

/** Ordre de déploiement envoyé par un joueur. */
export interface DeployCommand {
  team: Team;
  cardId: string;
  x: number;
  y: number;
}

export type Phase = "playing" | "finished";

/** Effet visuel transitoire (ex: explosion de boule de feu). */
export interface Effect {
  id: number;
  kind: "fireball";
  x: number;
  y: number;
  radius: number;
  bornTick: number;
}

/** Instantané complet de l'état du jeu (sérialisable → réseau). */
export interface GameState {
  tick: number;
  timeLeftS: number;
  phase: Phase;
  winner: Team | "draw" | null;
  units: Unit[];
  towers: Tower[];
  effects: Effect[];
  elixir: Record<Team, number>;
}
