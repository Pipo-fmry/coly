# 0010 — IA en fallback derrière une interface, OmniRoute hors prod

- **Statut** : Accepté
- **Date** : 2026-09-23

## Contexte
L'IA sert à extraire les emails que règles et gabarits ne couvrent pas. Coût estimé : ~0,01 à 0,03 $ par utilisateur
et par mois ([investigation §8](../research/investigation.md)). OmniRoute (routeur LLM open source) a été évalué.

## Décision
- Ordre d'extraction : schema.org → gabarits → regex → LLM en dernier recours, avec sortie structurée et vérification
  que chaque valeur existe littéralement dans l'email.
- Le LLM est derrière l'interface `LlmExtractor` ; fournisseur par défaut : Anthropic (Claude Haiku 4.5).
- OmniRoute **n'est pas** dans le chemin des données utilisateurs : emails soumis à Google Limited Use et au RGPD
  (sous-traitants déclarés), et certaines routes OmniRoute passent par des cookies de sessions web.

## Conséquences
Un routeur pourra être branché plus tard sans toucher au cœur si le volume le justifie.
