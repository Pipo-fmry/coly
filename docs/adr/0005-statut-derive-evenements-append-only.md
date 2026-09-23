# 0005 — Statut dérivé d'événements append-only

- **Statut** : Accepté
- **Date** : 2026-09-23

## Contexte
Recopier le statut d'une source produit des erreurs (ex. « disponible au retrait » affiché alors que le colis est livré).

## Décision
Les événements normalisés sont ajoutés, jamais modifiés, chacun avec sa provenance. Le statut utilisateur est une
fonction pure de ces événements : machine à états monotone, états terminaux émis seulement par la source du dernier
kilomètre, pas de régression sans événement explicite (retour, réexpédition).

## Conséquences
Changer une règle recalcule tous les statuts sans migration. L'UI peut montrer « confirmé par X, il y a N min ».
Le volume d'événements croît : purge des colis terminés après la durée de rétention.
