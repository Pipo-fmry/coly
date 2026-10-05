# Modèle de menaces

> v1 — prototype partagé avec quelques testeurs (ADR 0016). À revoir à chaque changement d'étape (voir architecture).

## Actifs à protéger

| Actif | Pourquoi c'est critique |
|---|---|
| Refresh token Gmail (un par utilisateur) | accès en lecture à **toute** la boîte mail |
| Cookie de session, `SESSION_SECRET` | usurper un utilisateur = voir ses colis, lancer ses synchros |
| Codes et QR de retrait | titres au porteur : permettent de retirer le colis |
| Données de commande et d'adresse | données personnelles (RGPD) |
| Clés API (La Poste, agrégateur, LLM) | abus de quota, coûts |

## Menaces et parades

| Menace | Parade | Statut |
|---|---|---|
| Secret commité dans ce dépôt **public** | `.env.local` ignoré, gitleaks (hook + CI), `.env.example` sans valeur | ✅ en place |
| Fuite de données via logs | interdiction de logger corps d'email, tokens, codes ; `noConsole` en lint, logger dédié à venir | 🟡 partiel |
| Vol du dossier `data/` | tokens chiffrés AES-256-GCM (clé `FIELD_ENCRYPTION_KEY`, hors du dossier) ; codes de retrait à chiffrer quand ils seront stockés | 🟡 tokens faits |
| Un utilisateur voit les données d'un autre | tout accès part de la session ; un dossier par identifiant Google, validé contre un motif strict (pas de traversée de chemin) ; verrou de synchro par utilisateur | ✅ en place (ADR 0016) |
| Vol ou falsification de session | cookie HMAC-SHA256 signé, HttpOnly, SameSite=Lax, Secure en HTTPS, 30 jours ; comparaison à temps constant ; Origin vérifié sur les requêtes mutantes | ✅ en place |
| Inscription non désirée (quota, données) | liste fermée `ALLOWED_EMAILS` : refus avant tout enregistrement, token révoqué chez Google | ✅ en place |
| Vol du code OAuth au retour de Google | PKCE S256 + `state` lié à un cookie court (10 min), limité au chemin `/api/auth` | ✅ en place |
| Dépendance compromise ou vulnérable | lockfile, Dependabot, pnpm audit, peu de dépendances (Ponytail) | ✅ en place |
| Injection via contenu d'email dans le LLM | le LLM extrait vers un schéma strict ; toute valeur doit exister littéralement dans la source ; aucune action déclenchée par le texte d'un email | ⏳ à implémenter |
| Lien de suivi malveillant dans un email | aucune URL d'email suivie automatiquement sans liste de domaines autorisés | ⏳ |
| Scope OAuth trop large | `gmail.readonly` + identité (`openid email`) uniquement, requête filtrée côté serveur, révocation à la déconnexion | ✅ en place |
| Action GitHub compromise | versions majeures suivies par Dependabot ; épinglage par SHA à faire avant toute bêta | 🟡 |

## Données : ce qui est gardé, combien de temps

| Donnée | Gardée ? | Durée |
|---|---|---|
| Email écarté sur ses en-têtes | **non**, contenu jamais téléchargé | — |
| Corps et sujet d'email lu | **non** (traité en mémoire) | — |
| Id de message Gmail, extraits de preuve courts | oui | durée de vie du colis |
| Identifiant Google et email du compte | oui | jusqu'à la suppression du compte par l'utilisateur |
| Code / QR de retrait | oui, chiffré | purgé au retrait ou à la date limite + 7 j |
| Colis livrés | oui | 12 mois (réglable) |
