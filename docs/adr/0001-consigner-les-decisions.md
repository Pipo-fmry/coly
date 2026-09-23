# 0001 — Consigner les décisions dans des ADR

- **Statut** : Accepté
- **Date** : 2026-09-23

## Contexte
Projet mené en grande partie avec des agents de code, sur plusieurs sessions. Sans trace écrite, les mêmes choix sont rediscutés ou défaits.

## Décision
Toute décision structurante (techno, architecture, fournisseur, sécurité, donnée) fait l'objet d'un ADR court dans `docs/adr/`.
Les erreurs constatées vont dans `docs/STOP-DOING.md`, les apprentissages de test dans `docs/LEARNINGS.md`.

## Conséquences
Un agent ou un humain peut reprendre le projet en lisant `AGENTS.md` puis les ADR. Coût : quelques minutes par décision.
