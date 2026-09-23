# 0007 — Prototype local, rafraîchissement manuel

- **Statut** : Accepté
- **Date** : 2026-09-23

## Contexte
Premier objectif : tester le produit sur les colis d'un seul utilisateur pendant quelques semaines, sans coût ni
audit Google (usage personnel exempté de l'évaluation CASA).

## Décision
Tout tourne en local (ou sur une offre gratuite). Pas de planificateur : l'utilisateur clique « Actualiser »
(ou lance une commande). Stockage SQLite dans `data/`. Le worker est quand même découpé en jobs idempotents
(`syncMail`, `refreshShipment`, `recompute`) appelés à la main.

## Conséquences
Zéro infrastructure. Passer au planifié = appeler les mêmes jobs depuis un cron, puis depuis une file (pg-boss) :
voir la trajectoire dans [architecture](../architecture/overview.md). Limite : pas de notification push tant que rien ne tourne en fond.
