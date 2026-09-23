# Décisions d'architecture (ADR)

Une décision structurante = un fichier, numéroté, jamais réécrit une fois accepté : on le **remplace** par un nouvel ADR
(statut « Remplacé par 00XX »). Modèle : [0000-modele.md](0000-modele.md).

| # | Décision | Statut |
|---|---|---|
| [0001](0001-consigner-les-decisions.md) | Consigner les décisions dans des ADR | Accepté |
| [0002](0002-monorepo-typescript.md) | Monorepo TypeScript avec pnpm, Turborepo reporté | Accepté |
| [0003](0003-coeur-pur-et-adaptateurs.md) | Cœur métier pur, fournisseurs derrière des ports | Accepté |
| [0004](0004-tracking-hybride.md) | Tracking hybride : La Poste en direct, agrégateur, emails transporteurs | Accepté (agrégateur à choisir) |
| [0005](0005-statut-derive-evenements-append-only.md) | Statut dérivé d'événements append-only | Accepté |
| [0006](0006-aucun-corps-email-stocke.md) | Aucun corps d'email stocké | Accepté |
| [0007](0007-prototype-local-rafraichissement-manuel.md) | Prototype local, rafraîchissement manuel | Accepté |
| [0008](0008-pwa-avant-app-native.md) | PWA avant app native | Accepté |
| [0009](0009-branche-main-unique.md) | Branche `main` unique, PR courtes | Accepté |
| [0010](0010-ia-en-fallback-derriere-interface.md) | IA en fallback derrière une interface, OmniRoute hors prod | Accepté |
| [0011](0011-graphify-reporte.md) | Graphify reporté | Accepté |
| [0012](0012-outillage-qualite.md) | Outillage qualité : Biome, Vitest, Lefthook, Ponytail, CI sécurité | Accepté |
