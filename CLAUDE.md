@AGENTS.md

## Spécifique à Claude Code

- Un hook formate avec Biome chaque fichier écrit ou modifié (`.claude/settings.json`).
- Le plugin **Ponytail** est activé pour ce projet : il pousse à réutiliser l'existant avant d'écrire du code.
- Lecture de `.env` et `.env.local` refusée par configuration : ne pas contourner.
- Avant de proposer une PR : `/code-review`, `/simplify`, et `/security-review` si données sensibles touchées.
- Graphify n'est pas installé volontairement ([ADR 0011](docs/adr/0011-graphify-reporte.md)).
