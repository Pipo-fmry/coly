# Ouvrir Coly sur son iPhone (le serveur reste sur le Mac)

Le serveur tourne sur le Mac ; le téléphone y accède par un **réseau privé Tailscale**, en Wi-Fi comme en 4G.
Aucune URL publique : personne d'autre que tes appareils ne peut ouvrir la page ([ADR 0014](../adr/0014-acces-mobile-prive-tailscale.md)).

## Une seule fois (~10 min)

1. **Installer Tailscale** sur le Mac ([tailscale.com/download](https://tailscale.com/download)) et sur l'iPhone
   (App Store). Se connecter **avec le même compte** sur les deux. Offre gratuite (« Personal »).
2. Dans la [console Tailscale](https://login.tailscale.com/admin/dns) : activer **MagicDNS** et
   **HTTPS Certificates**. HTTPS permet d'installer Coly comme une app sur l'écran d'accueil.
3. Garder le Mac éveillé sur secteur : Réglages Système → Batterie → Options → « Empêcher la suspension
   d'activité automatique sur l'adaptateur secteur lorsque l'écran est éteint ».

## À chaque session

```bash
pnpm web                       # sert Coly sur le Mac (127.0.0.1:3000)
tailscale serve --bg 3000      # l'expose sur ton réseau privé, en HTTPS
tailscale serve status         # affiche l'adresse, du type https://ton-mac.xxxx.ts.net
```

Sur l'iPhone (Tailscale connecté) : ouvrir l'adresse dans Safari → **Partager → Sur l'écran d'accueil**.

Pour tout couper : `tailscale serve reset`.

## Voir l'écran sans Gmail

`pnpm web:demo` copie le compte **fictif** `apps/web/demo/` dans `data/demo/` (ignoré par git) et ouvre la session
dessus, sans connexion Google. Pratique pour tester le design.

## Et un ami ?

Chaque personne se connecte avec son compte Google et ne voit que ses colis ([ADR 0016](../adr/0016-comptes-google-donnees-par-utilisateur.md)).
Marche à suivre, y compris l'exposition de l'app : [guide testeurs](testeurs.md).
