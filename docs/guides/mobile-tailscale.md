# Ouvrir Coly sur son iPhone (le serveur reste sur le Mac)

Le serveur tourne sur le Mac ; le téléphone y accède par un **réseau privé Tailscale**, en Wi-Fi comme en 4G.
Aucune URL publique : personne d'autre que tes appareils ne peut ouvrir la page ([ADR 0014](../adr/0014-acces-mobile-prive-tailscale.md)).

## Une seule fois (~10 min)

1. **Installer Tailscale** sur le Mac ([tailscale.com/download](https://tailscale.com/download)) et sur l'iPhone
   (App Store). Se connecter **avec le même compte** sur les deux. Offre gratuite (« Personal »).
2. Dans la [console Tailscale](https://login.tailscale.com/admin/dns) : activer **MagicDNS** et
   **HTTPS Certificates**. HTTPS permet d'installer Coly comme une app sur l'écran d'accueil.
3. Dans `.env.local`, mettre `APP_URL` à l'adresse Tailscale exacte (`https://ton-mac.xxxx.ts.net`, affichée
   par `tailscale serve status`) et ajouter `<APP_URL>/api/auth/callback` aux URI de redirection du client OAuth
   Google ([guide testeurs](testeurs.md)). Sinon la connexion Google renvoie le téléphone vers `127.0.0.1`.
4. Garder le Mac éveillé sur secteur : Réglages Système → Batterie → Options → « Empêcher la suspension
   d'activité automatique sur l'adaptateur secteur lorsque l'écran est éteint ».

## À chaque session

Depuis le dossier du repo, dans un terminal laissé ouvert : `pnpm web` sert Coly sur le Mac (127.0.0.1:3000).
`tailscale serve --bg 3000` l'expose sur ton réseau privé en HTTPS ; cette configuration est gardée, inutile de la
refaire. `tailscale serve status` affiche l'adresse, du type `https://ton-mac.xxxx.ts.net`.

```bash
pnpm web
tailscale serve --bg 3000
tailscale serve status
```

Sur l'iPhone (Tailscale connecté) : ouvrir l'adresse dans Safari → **Partager → Sur l'écran d'accueil**.

Pour tout couper : `tailscale serve reset`.

## Page blanche sur l'iPhone ?

L'icône de l'écran d'accueil n'affiche aucune erreur : une page blanche veut presque toujours dire que le Mac ne
répond pas. Ouvrir l'adresse dans **Safari** pour voir la vraie erreur, puis vérifier sur le Mac, dans l'ordre :

```bash
curl -sI http://127.0.0.1:3000/connexion | head -1
tailscale serve status
tailscale status
grep '^APP_URL=' .env.local
```

1. **`curl` n'affiche rien** : le serveur ne tourne pas (cas le plus fréquent, par exemple après un redémarrage).
   Lancer `pnpm web` depuis le dossier du repo et laisser le terminal ouvert. Attendu : `HTTP/1.1 200 OK`.
2. **`serve status` ne montre pas le proxy vers `127.0.0.1:3000`** : relancer `tailscale serve --bg 3000`.
3. **L'iPhone est absent ou « offline » dans `tailscale status`** : ouvrir l'app Tailscale sur l'iPhone, même compte.
4. **`APP_URL` vaut `http://127.0.0.1:3000`** : la page s'affiche mais la connexion Google échoue. Voir l'étape 3
   de « Une seule fois », puis relancer `pnpm web`.
5. **Google affiche `redirect_uri_mismatch`** : l'URI `<APP_URL>/api/auth/callback` manque dans le client OAuth.

Ne pas lancer `pnpm web:dev` pour le téléphone ([STOP-DOING](../STOP-DOING.md)). Coller les commandes sans
commentaire `# …` : le zsh de macOS les passe comme arguments.

## Voir l'écran sans Gmail

`pnpm web:demo` copie le compte **fictif** `apps/web/demo/` dans `data/demo/` (ignoré par git) et ouvre la session
dessus, sans connexion Google. Pratique pour tester le design.

## Et un ami ?

Chaque personne se connecte avec son compte Google et ne voit que ses colis ([ADR 0016](../adr/0016-comptes-google-donnees-par-utilisateur.md)).
Marche à suivre, y compris l'exposition de l'app : [guide testeurs](testeurs.md).
