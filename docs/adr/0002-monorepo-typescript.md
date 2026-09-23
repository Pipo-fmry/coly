# 0002 — Monorepo TypeScript avec pnpm, Turborepo reporté

- **Statut** : Accepté
- **Date** : 2026-09-23

## Contexte
Il faut partager le domaine et le design system entre une PWA, un worker et plus tard une app native.

## Décision
Un seul dépôt, workspaces pnpm (`apps/*`, `packages/*`), TypeScript strict partout. Les packages internes exposent
directement leurs sources `.ts` (pas d'étape de build). Pas de Turborepo tant que `pnpm -r` suffit.

## Alternatives écartées
- Plusieurs dépôts : synchronisation des types pénible pour un projet solo.
- Turborepo / Nx dès maintenant : outillage inutile avec deux packages sans build.

## Conséquences
Ajouter Turborepo quand les builds ou la CI deviennent lents (> 3 min) ou quand une app native arrive.
