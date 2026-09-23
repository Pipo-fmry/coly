# 0012 — Outillage qualité : Biome, Vitest, Lefthook, Ponytail, CI sécurité

- **Statut** : Accepté
- **Date** : 2026-09-23

## Contexte
On veut les garde-fous d'Elber (CI, templates, checklist sécurité) avec moins d'outils et des règles bloquantes plutôt que des conseils.

## Décision
- **Biome** : lint + format en un seul outil (remplace ESLint + Prettier).
- **TypeScript strict** (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`…).
- **Vitest** ; les règles du design system sont testées (contraste WCAG des paires de tokens).
- **Lefthook** : Biome et gitleaks au commit, format du message de commit.
- **CI** : `biome ci`, types, tests, job agrégé « CI OK » ; workflow sécurité : gitleaks, pnpm audit, CodeQL (gratuit : dépôt public).
- **Dependabot** hebdo (npm + actions).
- **Ponytail** activé pour les agents ; `/code-review`, `/simplify`, `/security-review` avant PR.

## Conséquences
Les règles importantes échouent en CI au lieu de dépendre d'une relecture. Actions GitHub à épingler par SHA avant la bêta.
