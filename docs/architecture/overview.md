# Architecture

> Cible du prototype, pensée pour grandir sans réécriture. Décisions détaillées : [ADR](../adr/README.md).

## Principe : un cœur pur, des adaptateurs autour

```
                    ┌──────────────────────────── packages/core (pur) ─────────────────────────────┐
  Sources           │                                                                              │
  ───────           │  Extraction ─► Liaison des identités ─► Événements ─► Statut dérivé          │
  Gmail ─┐          │  (commande,     (DPD ↔ Chronopost,       (append-only,   (machine à états,    │
  Saisie ├─► ports ─┤   shipment)      commande ↔ colis)        provenance)     dernier km fait foi)│
         │          │                                                     │                        │
  Tracking          │                               Lieux canoniques ◄────┤──► Urgence / suggestions│
  La Poste ─┐       │                               (dédoublonnage)          (UC2, UC3)            │
  Agrégateur├─► ports                                                                              │
  Emails transp.┘   └──────────────────────────────────────────────────────────────────────────────┘
                                   ▲ interfaces (ports)             │ résultats purs
                                   │                                ▼
                    apps/worker : adaptateurs (Gmail, La Poste, agrégateur, LLM, base)
                    apps/web    : PWA, lit l'état calculé, déclenche « Actualiser »
```

- **`packages/core`** reçoit des données et l'heure courante en paramètre, renvoie des résultats. Aucune I/O. C'est là que vit la valeur du produit, donc là que se concentrent les tests.
- **Ports** : interfaces définies par le cœur (`MailSource`, `TrackingProvider`, `LlmExtractor`, `ShipmentStore`, `Clock`). Chaque fournisseur est un adaptateur interchangeable.
- **`apps/worker`** : orchestre les adaptateurs. Au stade prototype, il tourne **à la demande** (bouton « Actualiser » ou commande CLI).
- **`apps/web`** : PWA Next.js qui lit l'état et affiche. Aucune logique métier.

## Modèle de données

Voir `packages/core/src/index.ts` et [l'investigation §1](../research/investigation.md#1-modèle-de-données-cible-3-couches-plus-la-provenance).
Idées clés : un `Shipment` porte **plusieurs** identités de tracking ; le statut est une **fonction** des événements ;
chaque valeur garde sa **provenance**.

## Trajectoire de montée en charge

| Étape | Déclenchement | Stockage | Tracking | Hébergement |
|---|---|---|---|---|
| **0 — prototype** (maintenant) | bouton « Actualiser » / CLI | SQLite local (`data/`) | appels directs à la demande | Mac local |
| 1 — bêta privée | tâche planifiée (cron) | Postgres | polling adaptatif selon l'état | offre gratuite ou VPS UE |
| 2 — public | Gmail push (Pub/Sub) + file de jobs (pg-boss) | Postgres | polling + re-vérification sur incohérence | Scaleway (UE) |

Ce qui rend ces étapes indolores : les ports (on change d'adaptateur, pas de cœur), un accès base derrière
`ShipmentStore` (SQLite → Postgres), et un worker déjà découpé en jobs idempotents même quand on l'appelle à la main.

## Où mettre quoi

| Besoin | Emplacement |
|---|---|
| Règle métier (statut, lien, urgence, lieu) | `packages/core` + tests |
| Appel à un service externe | adaptateur dans `apps/worker` (ou `packages/adapters` quand il y en aura plusieurs) |
| Gabarit d'email d'un marchand | `packages/parsers` *(à venir)* + fixture anonymisée |
| Couleur, espacement, composant | `packages/ui` |
