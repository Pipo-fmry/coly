# 0004 — Tracking hybride : La Poste en direct, agrégateur, emails transporteurs

- **Statut** : Accepté (choix de l'agrégateur en attente du benchmark)
- **Date** : 2026-09-23

## Contexte
Colissimo et Chronopost (gros du volume B2C) sont suivis gratuitement via l'API La Poste Suivi v2. DPD, Mondial Relay,
Relais Colis, Colis Privé, GLS n'ont pas d'API accessible à un tiers. Aucun transporteur n'expose les codes de retrait.
Voir [investigation §4 et §11](../research/investigation.md).

## Décision
1. API La Poste (et Chronopost) en direct.
2. Un agrégateur pour le reste, choisi après benchmark sur de vrais colis (Ship24, 17TRACK, AfterShip).
3. Les emails des transporteurs (disponible, code, retiré) sont des **événements** au même titre qu'une API.
4. En cas d'incohérence entre sources : re-interrogation ciblée de la source primaire.

## Conséquences
Moins de dépendance et de coût qu'un agrégateur unique. Plus de logique à écrire, mais c'est le cœur de la valeur.
Réévaluer après le benchmark (ADR dédié au choix du fournisseur).
