# 0018 — Stocker la preuve de retrait et le nom d'expéditeur (prototype local)

- **Statut** : Accepté (validé par l'utilisateur le 2026-09-25)
- **Date** : 2026-09-25
- **Complète** : [0013](0013-minimisation-promesse-produit.md)

## Contexte
Au relais, l'information n°1 est le code ou le QR de retrait ; un lien vers l'email oblige à fouiller Gmail.
Sur l'accueil, le domaine d'expéditeur donne souvent le transporteur ou la plateforme (« Chronopost », « Shopifyemail ») :
le nom de la boutique est dans le nom affiché de l'expéditeur.

## Décision
- Pendant la synchro, pour tout email qui ne cite **qu'un** colis, on garde :
  - le **code de retrait** écrit en clair (tournures génériques : « code de retrait », « code PIN »…) ;
  - l'**image** du QR / code-barres, telle qu'envoyée (jamais régénérée), choisie par son nom, identifiant,
    texte alternatif ou adresse, en PNG/JPEG/GIF/WebP de 200 o à 1 Mo, dans `data/pickup/`.
- On garde le **nom affiché de l'expéditeur** de chaque email lu ; le marchand est celui du premier expéditeur
  qui n'est pas un transporteur.
- Aucune règle propre à un transporteur : tout est générique (ADR 0017).

## Alternatives écartées
- Lire l'image dans Gmail à l'affichage — demande du réseau au relais, et un appel Gmail par ouverture.
- Gabarit par transporteur pour trouver le QR — ne passe pas à l'échelle (ADR 0017).

## Conséquences
- L'image n'est pas encore chiffrée ni purgée après retrait, contrairement à l'ADR 0013 : acceptable en local
  mono-utilisateur, **à faire avant tout autre utilisateur** (étape 5 du plan).
- Un QR sans indice dans son nom ou son adresse n'est pas trouvé : l'app propose alors d'ouvrir l'email.
  L'indicateur « Code / QR » compte désormais ce qui est **affichable** dans l'app.
