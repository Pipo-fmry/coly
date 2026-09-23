# Coly

**Tous tes colis au même endroit : réconciliés, fiables, regroupés par lieu de retrait.**

Coly lit tes emails de commande et d'expédition, suit chaque colis même quand il change de transporteur
(DPD → Chronopost → point relais), et te dit simplement :

- **où aller** : « 4 colis t'attendent chez Shop N Food » ;
- **quoi faire en premier** : « plus qu'un jour pour retirer ton colis Zalando » ;
- **quand y aller** : « attends jeudi, un 5ᵉ colis arrive au même endroit ».

> Statut : **prototype mono-utilisateur**, en local. Rien n'est encore publié.

## Démarrer

Prérequis : Node 24 (`.nvmrc`) et Corepack.

```bash
corepack enable
pnpm install
pnpm check
```

## Structure

```
packages/core   domaine pur (modèle, réconciliation, statut, urgence, lieux)
packages/ui     design system (tokens + composants)
apps/web        PWA — à venir
apps/worker     ingestion Gmail et tracking (spike : pnpm spike)
docs/           produit, architecture, décisions (ADR), sécurité, design, recherche
```

## Documentation

| Sujet | Où |
|---|---|
| Vision et cas d'usage | [docs/product/vision.md](docs/product/vision.md) |
| Architecture | [docs/architecture/overview.md](docs/architecture/overview.md) |
| Décisions (ADR) | [docs/adr/](docs/adr/README.md) |
| Design system | [docs/design/design-system.md](docs/design/design-system.md) |
| Sécurité | [SECURITY.md](SECURITY.md) · [modèle de menaces](docs/security/threat-model.md) |
| Investigation initiale | [docs/research/investigation.md](docs/research/investigation.md) |
| Tester sur sa boîte Gmail | [docs/guides/spike-gmail.md](docs/guides/spike-gmail.md) |
| Contribuer | [CONTRIBUTING.md](CONTRIBUTING.md) · [AGENTS.md](AGENTS.md) |
