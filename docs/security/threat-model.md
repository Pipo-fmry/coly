# Modèle de menaces

> v0 — prototype mono-utilisateur local. À revoir à chaque changement d'étape (voir architecture).

## Actifs à protéger

| Actif | Pourquoi c'est critique |
|---|---|
| Refresh token Gmail | accès en lecture à **toute** la boîte mail |
| Codes et QR de retrait | titres au porteur : permettent de retirer le colis |
| Données de commande et d'adresse | données personnelles (RGPD) |
| Clés API (La Poste, agrégateur, LLM) | abus de quota, coûts |

## Menaces et parades

| Menace | Parade | Statut |
|---|---|---|
| Secret commité dans ce dépôt **public** | `.env.local` ignoré, gitleaks (hook + CI), `.env.example` sans valeur | ✅ en place |
| Fuite de données via logs | interdiction de logger corps d'email, tokens, codes ; `noConsole` en lint, logger dédié à venir | 🟡 partiel |
| Vol du fichier de base locale | chiffrement au niveau du champ (clé `FIELD_ENCRYPTION_KEY`) pour tokens et codes | ⏳ à implémenter avec le stockage |
| Dépendance compromise ou vulnérable | lockfile, Dependabot, pnpm audit, peu de dépendances (Ponytail) | ✅ en place |
| Injection via contenu d'email dans le LLM | le LLM extrait vers un schéma strict ; toute valeur doit exister littéralement dans la source ; aucune action déclenchée par le texte d'un email | ⏳ à implémenter |
| Lien de suivi malveillant dans un email | aucune URL d'email suivie automatiquement sans liste de domaines autorisés | ⏳ |
| Scope OAuth trop large | `gmail.readonly` uniquement, requête filtrée côté serveur, révocation à la déconnexion | ⏳ |
| Action GitHub compromise | versions majeures suivies par Dependabot ; épinglage par SHA à faire avant toute bêta | 🟡 |

## Données : ce qui est gardé, combien de temps

| Donnée | Gardée ? | Durée |
|---|---|---|
| Corps d'email | **non** (traité en mémoire) | — |
| Id de message Gmail, extraits de preuve courts | oui | durée de vie du colis |
| Code / QR de retrait | oui, chiffré | purgé au retrait ou à la date limite + 7 j |
| Colis livrés | oui | 12 mois (réglable) |
