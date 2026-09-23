# 0006 — Aucun corps d'email stocké

- **Statut** : Accepté
- **Date** : 2026-09-23

## Contexte
Lire Gmail donne accès à toute la boîte. Minimiser ce qu'on garde réduit le risque, simplifie le RGPD et la future vérification Google.

## Décision
Les emails sont traités en mémoire. On conserve uniquement : champs structurés extraits, id de message Gmail, extraits
de preuve courts (< 200 caractères), images de QR chiffrées. Re-parser = re-télécharger par id. Les requêtes Gmail
sont filtrées côté serveur (expéditeurs et mots-clés) pour ne pas télécharger le reste.

## Conséquences
Pas de copie de la boîte à protéger. Un changement de parseur demande un re-téléchargement (acceptable).
Les fixtures de test sont des emails **anonymisés** ; les exports bruts vont dans `fixtures/raw/`, ignoré par git.
