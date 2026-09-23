# Design system

> Source de vérité du code : `packages/ui/src/tokens.ts`.
> Maquettes et planche : [canvas « Coly design system »](https://claude.ai/artifact/FAKqKg6aYgvWPS8AMAmUCy) (privé, partage à activer si besoin).

## Intention

Sobre, lisible, rassurant — dans l'esprit Apple et Airbnb : beaucoup d'air, grands titres, cartes douces,
une seule action principale par écran. **Le vert est un accent, pas un décor** : 80 % de l'interface vit sur des neutres chauds.

## Couleurs

| Token | Hex | Usage | Interdit |
|---|---|---|---|
| `brand.foret` | `#132a13` | texte principal, fond de l'écran des codes | — |
| `brand.pin` | `#31572c` | action principale (texte blanc, 8,3:1) | — |
| `brand.mousse` | `#4f772d` | liens, états actifs (5,2:1 sur blanc) | — |
| `brand.sauge` | `#90a955` | icônes, frises, pastilles | texte sur fond clair (2,6:1) |
| `brand.citron` | `#ecf39e` | signal « à retirer », texte sur forêt (13:1) | texte sur fond clair (1,2:1) |

Neutres (`neutral.*`), couleurs de statut (`status.*`) : voir le fichier de tokens.
**Toute paire texte/fond utilisée doit figurer dans `textPairs`** : un test vérifie le contraste WCAG AA (≥ 4,5:1).

## Statuts

| Ton | Quand |
|---|---|
| `pickup` (citron) | colis disponible au retrait : action attendue |
| `transit` | en route, rien à faire |
| `done` | livré ou retiré, s'efface |
| `deadline` (ambre) | date limite proche |
| `problem` (rouge) | incident |

## Logo

Piste **B, « le c qui attrape »** (choisie le 23/09/2026) : un « c » citron qui referme un colis sauge, sur fond forêt.
Source : `apps/web/app/icon.svg` (favicon) et `apps/web/app/apple-icon.tsx` (écran d'accueil iOS).

## Typographie, espacements, formes

- **Figtree** pour l'interface, **IBM Plex Mono** pour les codes de retrait. Dans l'app native : SF Pro sur Apple.
- Espacements en multiples de 4 ; rayons 10 (vignette), 14 (bouton), 16 (liste), 20 (carte), pilule.
- Cible tactile ≥ 44 px. Marchands représentés par une initiale, jamais par leur logo.

## À faire

- Mode sombre (tokens dédiés, mêmes tests de contraste).
- Composants React dans `packages/ui` quand `apps/web` démarre.
