# Contribuer à Coly

## Boucle de travail

1. `git switch main && git pull`, puis `git switch -c feat/ma-modif` (ou `fix/`, `docs/`, `refactor/`…).
2. Coder avec tests. Petites PR : une intention par PR.
3. `pnpm check` doit passer (les hooks git le rappellent au commit).
4. Ouvrir la PR vers `main`, remplir le template. Merge **squash** une fois la CI verte.

## Ce que vérifient les hooks et la CI

| Vérification | Local (lefthook) | CI |
|---|---|---|
| Format + lint (Biome) | pre-commit, fichiers indexés | `biome ci` |
| Types (TypeScript strict) | — | `pnpm typecheck` |
| Tests (Vitest), dont contraste WCAG des tokens | — | `pnpm test` |
| Secrets (gitleaks) | pre-commit si installé | à chaque push/PR |
| Dépendances vulnérables (pnpm audit) | — | à chaque PR + hebdo |
| Analyse statique sécurité (CodeQL) | — | à chaque PR + hebdo |
| Format du message de commit | commit-msg | — |

Installer gitleaks en local : `brew install gitleaks`.

## Messages de commit

`type(portée): description` en français, à l'impératif, qui dit **pourquoi** si ce n'est pas évident.

```
feat(core): dériver le statut depuis le transporteur du dernier kilomètre
fix(parsers): lire le code de retrait Mondial Relay dans le nouveau gabarit
docs(adr): ajouter l'ADR 0013 sur le chiffrement des codes
```

## Définition de « terminé »

- Tests écrits ou mis à jour ; fixtures anonymisées pour tout parsing.
- Doc mise à jour si comportement, commande ou décision changent (ADR si structurant).
- Aucune donnée perso réelle dans le code, les fixtures, les logs ou les captures de PR.
