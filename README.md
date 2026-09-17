# Web Royale

Un prototype **jouable** de jeu de stratégie temps réel 1v1 inspiré de *Clash Royale*,
en **TypeScript + PixiJS**, avec un mode **solo (contre une IA)** et un mode
**en ligne 1v1** (serveur WebSocket autoritatif).

> ⚠️ *Clash Royale*, ses personnages et ses graphismes appartiennent à Supercell.
> Ce dépôt est un projet d'apprentissage : il n'utilise aucun asset de Supercell
> et n'est pas affilié à l'éditeur.

## Aperçu du gameplay

- Arène 18×32 avec une rivière centrale et deux ponts.
- 6 tours : un **roi** + deux **princesses** par camp.
- **Élixir** qui se régénère (max 10) pour poser des cartes.
- 6 cartes : Chevalier, Archères, Gobelins, Mousquetaire, Géant, Boule de feu.
- Les troupes se déplacent, franchissent les ponts, ciblent ennemis et tours,
  attaquent et meurent. Le géant ne vise que les bâtiments.
- Victoire en détruisant le roi adverse, ou à l'avantage des tours à la fin des 3 min.

## Architecture

```
src/
  engine/     Moteur de jeu déterministe, SANS dépendance navigateur/Node.
              Tourne à l'identique côté client (solo) et côté serveur (en ligne).
    types.ts  cards.ts  arena.ts  engine.ts  ai.ts
  client/     Rendu PixiJS + interface (barre de cartes, élixir, chrono).
    renderer.ts  hud.ts  main.ts
  net/        Protocole partagé + client WebSocket.
    protocol.ts  client.ts
server/
  index.ts    Serveur WebSocket autoritatif + matchmaking 1v1.
```

Le principe clé : **la logique de jeu est partagée**. Le même `GameEngine`
simule la partie dans le navigateur en solo, et sur le serveur en multijoueur
(le serveur fait autorité et envoie des instantanés d'état aux deux clients).

## Lancer le projet

Prérequis : Node.js 18+.

```bash
npm install

# Mode solo (contre l'IA) — il suffit du client :
npm run dev
# → ouvrir http://localhost:5173 puis « Jouer contre l'IA »

# Mode en ligne 1v1 — lancer AUSSI le serveur dans un autre terminal :
npm run server        # serveur WebSocket sur ws://localhost:8080
# puis ouvrir deux onglets sur http://localhost:5173 et cliquer « Match en ligne »
```

Comment jouer : sélectionner une carte dans la barre du bas (si assez d'élixir),
puis cliquer/taper sur votre moitié de terrain pour la déployer.

## Pistes d'amélioration

- Cartes supplémentaires (unités volantes, sorts de zone, bâtiments défensifs).
- File d'attente de cartes « en main » (4 + prochaine) comme dans le vrai jeu.
- Meilleure IA (évaluation des menaces par lane, contres).
- Interpolation côté client pour lisser le rendu réseau (actuellement ~10 Hz).
- Assets graphiques (sprites animés) à la place des formes géométriques.
- Comptes, ligues, coffres, progression des cartes.
