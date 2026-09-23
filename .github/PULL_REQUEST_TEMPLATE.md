## Quoi et pourquoi

<!-- Ce que change la PR et pourquoi, en 2-3 phrases. Lien vers l'issue ou l'ADR. -->

## Type

- [ ] Fonctionnalité
- [ ] Correction
- [ ] Refacto (aucun changement de comportement)
- [ ] Docs / outillage

## Vérifications

- [ ] `pnpm check` passe en local
- [ ] Tests ajoutés ou mis à jour (fixture anonymisée pour tout parsing)
- [ ] `/code-review` et `/simplify` passés ; `/security-review` si données sensibles touchées
- [ ] Doc à jour (README, AGENTS.md, ADR si décision structurante, STOP-DOING / LEARNINGS si pertinent)

## Sécurité et données

- [ ] Aucun secret, aucune donnée perso réelle (code, fixtures, captures)
- [ ] Rien de sensible dans les logs (corps d'email, tokens, codes de retrait)
- [ ] Nouvelles dépendances justifiées (l'existant ou la plateforme ne suffisaient pas)
- [ ] Le cœur (`packages/core`) reste sans I/O

## Captures (si UI)

<!-- Avant / après. Données fictives uniquement. -->

## Comment tester

1.
