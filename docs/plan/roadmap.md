# Plan : un moteur qui passe à l'échelle

> Validé le 2026-09-23. Objet : sortir du cas par cas et décider sur des chiffres.
> Architecture : [ADR 0016](../adr/0016-faits-et-moteur-de-fusion.md), [ADR 0017](../adr/0017-extraction-generique-des-emails.md).

## Ce qu'on mesure (rapport de couverture)

Sur les **colis actifs** (non présumés terminés), par transporteur et au global :

| Indicateur | Définition |
|---|---|
| Marchand | % de colis avec un marchand (certain ou probable), toutes sources fusionnées |
| Statut connu | % de colis avec un statut dérivé |
| **Statut juste** | % de statuts égaux à la vérité de référence (colis vérifiés par l'utilisateur) |
| Fraîcheur | âge médian de la dernière information transporteur |
| Lieu résolu | % des colis « à retirer » avec un lieu exploitable |
| Adresse | % des colis « à retirer » avec une adresse |
| Date limite | % des colis « à retirer » avec une date limite (donnée ou estimée, marquée) |
| Code / QR | % des colis « à retirer » avec un code ou un QR accessible |
| Emails transporteurs non compris | emails d'expéditeurs transporteurs lus sans aucune information extraite |

## Étapes

| # | Étape | Sortie | Statut |
|---|---|---|---|
| 1 | Rapport de couverture + vérité de référence | `pnpm coverage`, boutons « statut juste / faux » dans l'app | fait |
| 2 | Faits typés + moteur de fusion ; sources actuelles migrées | ADR 0016 appliqué | fait : marchand, lieu, statut |
| 3 | Comparatif agrégateurs (Ship24, 17TRACK) + API officielle GLS | tableau par transporteur, choix argumenté | à faire |
| 4 | Extraction générique des emails (standards puis IA) + corpus de test en CI | ADR 0017 appliqué, non-régression en CI | à faire |
| 5 | Multi-utilisateur pour 5 à 10 proches | comptes, données séparées, consentement | à faire |
| 6 | Point d'arrêt | décision go / pivot / stop | à faire |

## Point d'arrêt (fixé à l'avance)

Après l'étape 5, sur au moins 5 boîtes mail réelles et 30 jours :

| Indicateur | Seuil « go » |
|---|---|
| Statut juste | ≥ 90 % |
| Lieu résolu (colis à retirer) | ≥ 70 % |
| Fraîcheur médiane | ≤ 6 h |
| Coût variable | ≤ 0,30 € par utilisateur actif et par mois |

Sous les seuils : on analyse les causes (source manquante, extraction, fusion) ; si elles tiennent à l'accès aux
données plutôt qu'à notre code, on réévalue le projet.

## Garde-fous (voir aussi AGENTS.md)

1. Aucun nom de transporteur ou de marchand dans le moteur ni dans l'app : uniquement dans des fournisseurs déclarés.
2. Pas de correctif sans cas de test qui échoue d'abord ; la couverture ne doit jamais baisser.
3. Nouvelle source ou nouveau type de fait : ADR.
4. On décide sur les indicateurs, jamais sur un colis isolé.
