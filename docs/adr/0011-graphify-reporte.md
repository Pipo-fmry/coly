# 0011 — Graphify reporté

- **Statut** : Accepté
- **Date** : 2026-09-23

## Contexte
Graphify transforme un code source en graphe de connaissances interrogeable par les agents et ajoute des hooks.

## Décision
Ne pas l'installer tant que le code est petit : il n'aurait presque rien à analyser.

## Conséquences
Réévaluer vers 10 000 à 20 000 lignes de code, ou si les agents perdent régulièrement le fil entre modules.
