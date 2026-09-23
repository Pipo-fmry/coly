# 0014 — Accès mobile privé via Tailscale, pas d'URL publique

- **Statut** : Accepté
- **Date** : 2026-09-23

## Contexte

Le prototype tourne sur le Mac (ADR 0007) mais doit se consulter sur le téléphone, y compris hors du Wi-Fi.
La page affiche des données personnelles (colis, lieux de retrait, bientôt codes de retrait) : une URL publique,
même « secrète », les exposerait à quiconque obtient le lien.

## Décision

- Le serveur écoute uniquement sur `127.0.0.1`. L'accès distant passe par **Tailscale Serve** (réseau privé
  chiffré, HTTPS sur `*.ts.net`), gratuit pour un usage personnel.
- Aucun tunnel public sans authentification.
- Pas d'authentification applicative tant qu'il n'y a qu'un utilisateur : le réseau privé fait office de contrôle d'accès.

## Alternatives écartées

- Tunnel public « rapide » : n'importe qui avec le lien voit les colis.
- Cloudflare Tunnel + Access : valable, mais plus de configuration pour le même résultat à un utilisateur.
- Hébergement en ligne : prévu à l'étape 1 de l'architecture, pas nécessaire pour tester.

## Conséquences et suite : plusieurs utilisateurs

Faire tester un ami impose, **avant** tout partage :
1. **Des comptes** : chaque personne ne voit que ses colis. Piste la plus simple : l'identité Tailscale
   (en-tête `Tailscale-User-Login` ajouté par Tailscale Serve) ; sinon connexion par lien email ou passkey.
   Pas de mot de passe maison : c'est ce qui se pirate le plus.
2. **Un Gmail par utilisateur** : chaque ami autorise sa propre boîte ; il doit être ajouté comme
   « utilisateur de test » du projet Google (100 maximum en mode test).
3. **Des données séparées** par utilisateur, et un accord explicite de l'ami : ses emails passent par ton Mac,
   tu deviens responsable de ses données (RGPD), même pour un test.

Ces points feront l'objet d'un ADR dédié au moment du passage multi-utilisateur.
