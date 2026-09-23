# Tester Coly sur sa propre boîte Gmail (spike)

Une commande lit tes emails de commande et d'expédition, détecte les numéros de suivi, interroge La Poste et Ship24,
et affiche un rapport. Tout reste en local ; aucun corps d'email n'est écrit sur disque (ADR 0006).

Durée de mise en place : ~15 min, une seule fois.

## 1. Accès Gmail (projet Google Cloud personnel)

1. [console.cloud.google.com](https://console.cloud.google.com) → **Nouveau projet** « coly-perso ».
2. **API et services → Bibliothèque** → activer **Gmail API**.
3. **Écran de consentement OAuth** → type **Externe** → nom « Coly (perso) », ton email → ajouter le scope
   `.../auth/gmail.readonly` → **Utilisateurs de test** : ajouter l'adresse Gmail à lire.
4. **Identifiants → Créer → ID client OAuth → Application de bureau**. Copier l'ID et le secret.

Mode « test » : Google invalide l'autorisation au bout de 7 jours ; la commande redemande alors le consentement,
c'est normal. Usage personnel : pas d'audit CASA (investigation §2.1).

## 2. Clés de tracking

- **La Poste** (Colissimo, Chronopost) : [developer.laposte.fr](https://developer.laposte.fr) → créer un compte →
  créer une application → s'abonner à l'API **Suivi** → copier la clé `X-Okapi-Key`. Gratuit.
- **Ship24** (tous les autres transporteurs) : [ship24.com](https://www.ship24.com) → compte gratuit → clé API.
  Gratuit : 10 colis/mois + 100 le premier mois. La commande en consomme au plus 15 par défaut (`--aggregator-limit`).

Les deux clés sont facultatives : sans elles, le spike montre seulement ce qu'il détecte dans les emails.

## 3. Fichier `.env.local`

À la racine du repo (jamais commité) :

```bash
cp .env.example .env.local
openssl rand -base64 32   # à coller dans FIELD_ENCRYPTION_KEY
```

Renseigner `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `LAPOSTE_OKAPI_KEY`, `AGGREGATOR_API_KEY` (clé Ship24),
`FIELD_ENCRYPTION_KEY`.

## 4. Lancer

```bash
pnpm spike                                   # 60 derniers jours
pnpm spike --days=180 --aggregator-limit=30
```

Au premier lancement, le navigateur s'ouvre pour autoriser la lecture seule de Gmail.

## Lire le rapport

Pour chaque numéro : date et expéditeur du premier email, transporteur détecté, puis une ligne par source
(statut de la source, dernier événement, transporteur vu, partenaire / point de retrait, numéros liés).
En fin de rapport : les emails filtrés **sans** numéro détecté, à regarder pour améliorer la détection.

Le détail est écrit dans `apps/worker/data/spike-*.json` (local, ignoré par git).

**Ce qu'on cherche** (à reporter dans `docs/LEARNINGS.md`) :
- colis ratés par la détection, et pourquoi (numéro dans une image, lien marque blanche…) ;
- désaccords entre La Poste et Ship24, et qui avait raison ;
- changements de transporteur visibles (numéros liés, partenaire) ;
- présence du point de retrait et des codes dans les emails transporteurs.

## Révoquer l'accès

[myaccount.google.com/permissions](https://myaccount.google.com/permissions) → « Coly (perso) » → Supprimer l'accès,
puis supprimer `apps/worker/data/gmail-refresh-token.enc`.
