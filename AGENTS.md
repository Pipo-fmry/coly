# Guide des agents — Coly

Source unique des consignes pour tout agent de code (Claude Code, Cursor, Codex…). `CLAUDE.md` l'importe.
Garder ce fichier **court** : il renvoie vers `docs/`, il ne la duplique pas.

## Le projet en 3 lignes

Coly centralise les colis d'un utilisateur à partir de ses emails, **réconcilie** les transporteurs successifs
(DPD → Chronopost → relais = un seul colis), dérive un **statut fiable** et **regroupe les colis par lieu de retrait**,
avec l'urgence (date limite) mise en avant. Stade : prototype mono-utilisateur, local. Voir [docs/product/vision.md](docs/product/vision.md).

## Commandes

```bash
corepack enable            # une fois : rend `pnpm` disponible
pnpm install               # installe + active les hooks git (lefthook)
pnpm check                 # lint + types + tests : doit passer avant toute PR
pnpm lint:fix              # formatage et corrections auto (Biome)
pnpm test:watch            # tests en continu
pnpm web                   # webapp (build + serveur) sur 127.0.0.1:3000 — téléphone : docs/guides/mobile-tailscale.md
pnpm web:dev               # webapp en mode développement (rechargement à chaud)
pnpm web:demo              # webapp sur des colis fictifs
pnpm spike                 # lit ta boîte Gmail et compare les sources de tracking (docs/guides/spike-gmail.md)
```

## Carte du repo

| Dossier | Rôle |
|---|---|
| `packages/core` | Domaine **pur** : modèle, réconciliation, statut, urgence, regroupement par lieu. Zéro I/O. |
| `packages/ui` | Design system : tokens (couleurs, typo, espacements) + composants. |
| `apps/web` | PWA Next.js : accueil (urgent, lieux, en route), bouton Actualiser. |
| `apps/worker` | Ingestion Gmail, appels tracking (La Poste, Ship24). Aujourd'hui : la commande `pnpm spike`. |
| `docs/` | Toute la doc : [index](docs/README.md). |

## Règles non négociables

1. **Le cœur ne dépend de rien.** `packages/core` n'importe ni SDK, ni `fetch`, ni base, ni `Date.now()` implicite (on passe l'heure en paramètre). Les fournisseurs vivent derrière des interfaces ([ADR 0003](docs/adr/0003-coeur-pur-et-adaptateurs.md)).
2. **Le statut est dérivé**, jamais recopié d'une source ni stocké comme vérité ([ADR 0005](docs/adr/0005-statut-derive-evenements-append-only.md)).
3. **Ne lire et ne garder que l'indispensable** : tri sur les en-têtes avant de lire un email, aucun corps ni sujet stocké, liste blanche de champs persistés, rien de sensible dans les logs ([ADR 0006](docs/adr/0006-aucun-corps-email-stocke.md), [ADR 0013](docs/adr/0013-minimisation-promesse-produit.md)). Dans le doute, on ne lit pas.
4. **Pas de secret dans le code** : tout passe par `.env.local` (voir `.env.example`), lu dans un seul module de config validé.
5. **Pas de hex en dur dans l'UI** : on lit `@coly/ui` ; toute nouvelle paire texte/fond s'ajoute à `textPairs` (testée WCAG AA).
6. **Pas de QR généré par Coly** : on affiche l'image ou le code fournis par le transporteur, tels quels.
7. **Moins de code** : réutiliser la stdlib, la plateforme et l'existant avant d'écrire ou d'ajouter une dépendance (plugin Ponytail activé).

## Flux de travail

1. Lire la doc concernée (`docs/architecture`, ADR liés) avant de modifier un module.
2. Branche courte depuis `main` : `feat/…`, `fix/…`, `docs/…` ([ADR 0009](docs/adr/0009-branche-main-unique.md)).
3. Implémenter **avec tests**. Chaque bug de parsing devient une fixture anonymisée.
4. `pnpm check` vert, puis `/code-review` et `/simplify` ; `/security-review` si le changement touche Gmail, tokens, codes de retrait ou données perso.
5. PR vers `main` avec le template rempli. Merge seulement si la CI est verte.

## Mémoire du projet

- **Décision structurante** → nouvel ADR dans [`docs/adr/`](docs/adr/README.md) (on ne réécrit pas un ADR accepté : on le remplace).
- **Erreur à ne pas refaire** → une ligne datée dans [`docs/STOP-DOING.md`](docs/STOP-DOING.md).
- **Chose apprise en testant** → une ligne datée dans [`docs/LEARNINGS.md`](docs/LEARNINGS.md).
- Mettre à jour ce fichier si une commande ou une règle change.

## Conventions

- Code (identifiants) en anglais ; commentaires, docs, commits et PR en français.
- Commits : `type(portée): description` — `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `ci`, `perf`, `build`.
- TypeScript strict, pas de `any` ni de `!` non justifié. Fonctions pures et petites dans `core`.
