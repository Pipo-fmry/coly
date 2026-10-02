# 0016 — Comptes « Se connecter avec Google », données séparées par utilisateur

- **Statut** : Accepté
- **Date** : 2026-10-02
- **Remplace** : la partie « pas d'authentification applicative » de [0014](0014-acces-mobile-prive-tailscale.md)

## Contexte

Le prototype tournait pour un seul utilisateur : un refresh token Gmail dans un fichier, un `state.json` global,
aucune authentification (le réseau privé faisait office de contrôle d'accès, ADR 0014). On veut le faire
tester par quelques personnes, chacune avec sa propre boîte Gmail, sans qu'aucune ne voie les colis d'une autre.
L'ADR 0014 annonçait déjà les trois prérequis : des comptes, un Gmail par utilisateur, des données séparées.

## Décision

1. **Un seul flux : « Se connecter avec Google ».** Le consentement Google demande à la fois l'identité
   (`openid email`) et `gmail.readonly`. L'identifiant utilisateur de Coly est le `sub` Google, stable et opaque.
   Pas de mot de passe, pas de lien magique : un testeur a forcément un compte Google puisqu'il doit autoriser Gmail.
2. **Liste fermée.** Seules les adresses de `ALLOWED_EMAILS` peuvent créer un compte. Une adresse non invitée
   est refusée **avant** tout enregistrement, et le token reçu est révoqué chez Google dans la foulée.
3. **Session = cookie signé** (HMAC-SHA256, `SESSION_SECRET`), HttpOnly, SameSite=Lax, Secure en HTTPS, 30 jours.
   Aucun état de session côté serveur. Les requêtes mutantes vérifient l'en-tête Origin.
4. **Un dossier par utilisateur** : `data/users/<sub>/` contient `profile.json` (id, email, date de création),
   `gmail-refresh-token.enc` (chiffré AES-256-GCM, clé `FIELD_ENCRYPTION_KEY`) et `state.json`.
   **Il n'existe plus de chemin de données global** : `readState`, `runSync` et le stockage du token exigent
   un identifiant utilisateur, validé contre un motif strict (pas de traversée de chemin).
5. **Chaque page et chaque route** part de la session : l'accueil, le détail d'un colis (un colis d'un autre
   compte est introuvable), le bouton Actualiser (un verrou par utilisateur, plus un verrou global).
6. **Sortie en un geste** : « Déconnecter Gmail et effacer mes données » révoque le token chez Google et
   supprime tout le dossier de l'utilisateur. « Se déconnecter » ferme seulement la session.
7. **La CLI reste un outil local** (`pnpm spike [--user=email]`), sur la même redirection loopback à port fixe
   (`http://127.0.0.1:8765`), déclarée dans le même client OAuth.

## Alternatives écartées

- **Identité Tailscale** (en-tête `Tailscale-User-Login`) : impose d'inviter chaque testeur dans le tailnet et
  ne répond pas au besoin de consentement Gmail, qui exige de toute façon un flux Google.
- **Lien magique par email** : un service d'envoi en plus, une étape en plus pour l'utilisateur, puis Google quand même.
- **Email + mot de passe** : la surface d'attaque la plus connue, pour rien (ADR 0014 l'écartait déjà).
- **Auth.js** : couvre la session et le fournisseur Google, mais pas le stockage par utilisateur du refresh token
  ni la liste fermée ; le flux PKCE existait déjà dans le worker, l'adapter coûtait moins qu'une dépendance.
- **SQLite tout de suite** (ADR 0007) : un dossier par utilisateur isole aussi bien avec un diff plus petit.
  La migration vers une base reste la prochaine étape de la trajectoire d'architecture.

## Conséquences

- **Google** : le client OAuth devient de type « Application Web » avec des URI de redirection déclarées, et
  l'app a besoin d'une URL HTTPS stable (Google n'accepte en HTTP que `localhost`). Tant que le projet reste en
  mode « test », chaque testeur doit être ajouté dans « Utilisateurs de test » et l'autorisation expire tous les
  7 jours : Coly renvoie alors vers « Se connecter avec Google ».
- **Responsabilité** : les emails des testeurs transitent par le serveur de François, qui devient responsable
  de traitement. La page de connexion dit ce qui est lu et conservé, et la suppression est à portée de clic.
- **Données conservées en plus** (liste blanche de l'ADR 0013) : identifiant Google et adresse email du compte.
- **Quotas partagés** : une seule clé Ship24 pour tous ; la limite par synchro borne la dépense, pas le total.
- **À surveiller** : passer le projet Google « en production » (sans vérification) pour supprimer l'expiration
  hebdomadaire ; migrer vers SQLite ou Postgres quand les utilisateurs se compteront en dizaines.
