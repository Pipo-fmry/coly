# Faire tester Coly à quelques personnes (multi-utilisateurs)

Chaque testeur se connecte avec son compte Google, autorise la lecture seule de sa boîte Gmail, et ne voit que ses
colis ([ADR 0016](../adr/0016-comptes-google-donnees-par-utilisateur.md)). Tout tourne sur ton serveur : tu es
responsable de leurs données, même pour un test.

## 1. Côté Google Cloud (une fois, ~15 min)

Dans le projet existant (voir [spike-gmail.md](spike-gmail.md) pour le créer) :

1. **Écran de consentement OAuth** → **Utilisateurs de test** : ajouter l'adresse Gmail de chaque testeur.
   Tant que l'app est en mode « test », une adresse absente de cette liste est refusée par Google, et
   l'autorisation expire tous les **7 jours** : Coly renvoie alors vers « Se connecter avec Google ».
2. **Identifiants → Créer → ID client OAuth → Application Web**. URI de redirection autorisées :
   - `<APP_URL>/api/auth/callback` (ex. `https://ton-mac.xxxx.ts.net/api/auth/callback`) ;
   - `http://127.0.0.1:3000/api/auth/callback` pour développer en local ;
   - `http://127.0.0.1:8765` pour la CLI `pnpm spike`.
   Copier l'ID et le secret dans `.env.local`. L'ancien client « Application de bureau » ne sert plus.

Google n'accepte en HTTP que `localhost` et `127.0.0.1` : pour des testeurs, il faut une **URL HTTPS**.

## 2. `.env.local`

```bash
APP_URL=https://ton-mac.xxxx.ts.net        # l'URL exacte que les testeurs ouvriront
SESSION_SECRET=$(openssl rand -base64 32)  # signature du cookie de session
ALLOWED_EMAILS=toi@gmail.com,ami@gmail.com # liste fermée : personne d'autre ne peut créer de compte
```

Les autres variables sont inchangées (`.env.example`). `ALLOWED_EMAILS` est **ta** liste d'invités : elle
double celle de Google, et une adresse non invitée est refusée avant tout enregistrement.

## 3. Exposer l'app

Option la plus rapide : le Mac + [Tailscale](mobile-tailscale.md). Avec **Tailscale Serve**, seuls les
appareils de ton réseau privé entrent : il faut **partager la machine** avec le compte Tailscale de chaque testeur
(console → Machines → Share). Avec **Tailscale Funnel**, l'URL devient publique en HTTPS : acceptable maintenant
que l'app demande une connexion, pratique pour des testeurs sans Tailscale. Dans les deux cas le Mac doit rester
allumé. Au-delà de quelques testeurs : petit serveur en Union européenne (étape 1 de l'[architecture](../architecture/overview.md)).

```bash
pnpm web                        # sert Coly sur 127.0.0.1:3000
tailscale funnel --bg 3000      # ou `tailscale serve --bg 3000` en réseau privé
```

## 4. Ce que vit un testeur

1. Il ouvre l'URL, lit ce que Coly lit et conserve, clique **Se connecter avec Google**.
2. Google affiche « application non vérifiée » (normal en phase de test) : **Paramètres avancés → Accéder à Coly**,
   puis il coche la lecture seule de Gmail.
3. Il appuie sur **Actualiser** : première synchro sur 90 jours, puis seulement les nouveaux emails.
4. En bas de l'accueil : **Se déconnecter** (ferme la session) et **Déconnecter Gmail et effacer mes données**
   (révoque l'accès chez Google et supprime tout son dossier `data/users/<id>/`).

## Où sont les données

`data/users/<identifiant Google>/` : `profile.json` (id, email, date), `gmail-refresh-token.enc` (chiffré) et
`state.json` (colis, sans sujet ni contenu d'email). Sauvegarde ce dossier et **ne perds jamais**
`FIELD_ENCRYPTION_KEY` : sans elle, les tokens sont illisibles et chacun devra se reconnecter.

## Limites connues de cette phase

- Reconnexion hebdomadaire tant que le projet Google est en mode « test ».
- Quota Ship24 partagé entre tous les testeurs (10 colis par mois en gratuit) : beaucoup de colis hors
  groupe La Poste resteront « statut inconnu ».
- Un testeur ne peut pas t'envoyer ses emails pour reproduire un bug : demande-lui l'expéditeur et le sujet,
  puis reconstruis une fixture anonymisée.
