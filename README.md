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

## Mettre le jeu en ligne (lien partageable)

Le jeu a deux parties à héberger différemment :

| Partie | Hébergeur | Ce que ça donne |
|---|---|---|
| Client (le jeu) | **GitHub Pages** (automatisé) | Un lien public ; le **mode solo marche tout de suite** |
| Serveur 1v1 | **Render** (offre gratuite) | Active le **mode en ligne** |

### 1. Client sur GitHub Pages (automatique)

Le workflow `.github/workflows/deploy.yml` build et publie le client à chaque
push sur `main`. Une seule fois, dans le dépôt GitHub :

1. **Settings → Pages → Source : GitHub Actions**.
2. Merge cette branche dans `main` (ou lance le workflow via *Actions → Run workflow*).

Le jeu est alors accessible à `https://<ton-user>.github.io/Clash_Royal/`.

### 2. Serveur sur Render (pour le multijoueur)

GitHub Pages ne peut pas faire tourner de serveur WebSocket. Déploie le serveur
à part avec le blueprint fourni (`render.yaml`) :

1. Compte sur [render.com](https://render.com) → **New → Blueprint** → connecte ce dépôt.
2. Render lit `render.yaml`, installe et lance `npm start`. Tu obtiens une URL
   du type `https://web-royale-server.onrender.com`.
3. Dans GitHub : **Settings → Secrets and variables → Actions → Variables →
   New variable** : nom `VITE_WS_URL`, valeur `wss://web-royale-server.onrender.com`
   (le même domaine, en `wss://`).
4. Relance le workflow Pages pour que le client pointe vers ton serveur.

> Astuce : sans reconstruire, tu peux tester un serveur en ajoutant
> `?server=wss://...` à l'URL du jeu.

> ⚠️ Sur l'offre gratuite de Render, le serveur s'endort après inactivité :
> la première connexion peut prendre ~30 s à réveiller le service.

### Autres hébergeurs

- **Client** : Vercel, Netlify, Cloudflare Pages fonctionnent aussi (build `npm run build`,
  dossier `dist`). Pense à définir `VITE_WS_URL` dans leurs variables d'environnement.
- **Serveur** : Railway, Fly.io, ou un petit VPS conviennent (tout hôte Node qui
  garde une connexion WebSocket ouverte). Vercel/Netlify ne conviennent **pas**
  au serveur (fonctions serverless sans WebSocket persistant).

## Pistes d'amélioration

- Cartes supplémentaires (unités volantes, sorts de zone, bâtiments défensifs).
- File d'attente de cartes « en main » (4 + prochaine) comme dans le vrai jeu.
- Meilleure IA (évaluation des menaces par lane, contres).
- Interpolation côté client pour lisser le rendu réseau (actuellement ~10 Hz).
- Assets graphiques (sprites animés) à la place des formes géométriques.
- Comptes, ligues, coffres, progression des cartes.
