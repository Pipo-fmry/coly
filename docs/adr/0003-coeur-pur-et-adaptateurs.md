# 0003 — Cœur métier pur, fournisseurs derrière des ports

- **Statut** : Accepté
- **Date** : 2026-09-23

## Contexte
La valeur de Coly est la réconciliation (liens entre numéros, statut, lieux, urgence). Les fournisseurs (Gmail,
La Poste, agrégateur, LLM, base) vont changer. L'investigation recommande de ne pas choisir l'agrégateur avant benchmark.

## Décision
`packages/core` ne fait aucune I/O : il reçoit des données et l'heure courante, renvoie des résultats. Il définit des
interfaces (`MailSource`, `TrackingProvider`, `LlmExtractor`, `ShipmentStore`, `Clock`) ; les implémentations vivent
dans les apps (ou un futur `packages/adapters`).

## Conséquences
Le cœur se teste sans réseau ni base. Changer d'agrégateur ou passer de SQLite à Postgres ne touche pas au cœur.
Il faut résister à la tentation d'appeler un SDK « juste une fois » depuis `core`.
