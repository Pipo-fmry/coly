# 0008 — PWA avant app native

- **Statut** : Accepté
- **Date** : 2026-09-23

## Contexte
Il faut tester vite sur iPhone sans TestFlight. Une PWA installée reçoit les notifications Web Push depuis iOS 16.4.

## Décision
Première interface = PWA Next.js (`apps/web`). Le design system et le domaine restent dans des packages partagés
pour qu'une app Expo puisse les réutiliser.

## Conséquences
Perdu pour l'instant : partage d'un SMS vers l'app (Web Share Target non supporté sur Safari iOS), widgets, Live Activities, tâches de fond.
Réévaluer quand ces fonctions deviennent le frein principal.
