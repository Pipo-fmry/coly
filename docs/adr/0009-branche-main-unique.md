# 0009 — Branche main unique, PR courtes

- **Statut** : Accepté
- **Date** : 2026-09-23

## Contexte
Projet solo sans environnement de staging. Elber utilise `develop` + `master`, justifié là-bas par un staging.

## Décision
`main` protégée (CI verte obligatoire), branches courtes `feat/`, `fix/`, `docs/`…, PR avec template, merge squash.

## Conséquences
Moins de cérémonie. Ajouter une branche d'intégration quand un staging existera.
