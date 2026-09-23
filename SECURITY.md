# Politique de sécurité

Coly manipule des données sensibles : accès à une boîte mail, commandes, adresses, codes de retrait de colis.

## Signaler une vulnérabilité

**Ne pas ouvrir d'issue publique.** Utiliser le
[signalement privé GitHub](https://github.com/Pipo-fmry/coly/security/advisories/new)
ou écrire au mainteneur. Réponse visée sous 72 h.

## Règles appliquées dans le code

- Aucun secret dans le dépôt : `.env.local` uniquement, scan gitleaks en local et en CI.
- Aucun corps d'email stocké ; seuls des champs structurés et des références (id de message) sont conservés.
- Tokens OAuth et codes de retrait chiffrés au niveau du champ ; jamais dans les logs.
- Dépendances surveillées (Dependabot, pnpm audit), analyse statique (CodeQL).
- Scopes OAuth minimaux, révocation à la déconnexion.

Détail et menaces couvertes : [docs/security/threat-model.md](docs/security/threat-model.md).
