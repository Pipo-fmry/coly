# 0017 — Extraction générique des emails : standards, puis IA avec garde-fous

- **Statut** : Accepté (validé par l'utilisateur le 2026-09-23)
- **Date** : 2026-09-23
- **Remplace** : la partie « LLM en dernier recours » de [0010](0010-ia-en-fallback-derriere-interface.md)

## Contexte

Un gabarit écrit à la main par expéditeur ne couvre qu'une infime partie des emails réels et casse à chaque
changement de mise en page. Le cas GLS (relais, adresse, QR présents dans l'email mais perdus) l'a montré.

## Décision

Ordre d'extraction pour tout email retenu par le tri sur en-têtes (ADR 0013) :

1. **Balises standard** (schema.org `ParcelDelivery`, `Order`) quand l'email en contient : exact et gratuit.
2. **Extraction générique par IA** en sortie structurée, **un seul schéma** pour tous les expéditeurs
   (numéros de suivi, transporteur, marchand, n° de commande, relais, adresse, dates, présence de code / QR).
3. **Gabarits déterministes = cache**, jamais la base : pour les expéditeurs les plus fréquents, un gabarit peut être
   généré (par IA, hors ligne), et n'est activé que s'il passe les tests du corpus.

Garde-fous obligatoires :
- toute valeur extraite doit **figurer littéralement** dans l'email, sinon elle est rejetée ;
- un numéro de suivi n'est retenu qu'après **reconnaissance par une source de suivi** (ou validation de format) ;
- sortie IA = faits avec `confiance: probable` tant qu'aucune autre source ne les confirme (ADR 0016).

Confidentialité :
- seuls les emails **déjà retenus** par le tri sont envoyés, texte nettoyé, sans pièces jointes ;
- fournisseur IA sans conservation des données ni entraînement ; **avant tout utilisateur autre que le mainteneur** :
  accord de non-conservation (ZDR) ou équivalent, DPA, mention dans la politique de confidentialité ;
- l'IA reste derrière l'interface `LlmExtractor` (ADR 0003).

## Conséquences

- Couverture de la longue traîne sans code par expéditeur ; coût estimé ~0,003 € par email lu (investigation §8).
- Le gabarit GLS existant devient le premier « cache » et sert de référence de test.
