# 0013 — Ne lire et ne garder que l'indispensable : une promesse produit

- **Statut** : Accepté
- **Date** : 2026-09-23
- **Complète** : [0006](0006-aucun-corps-email-stocke.md)

## Contexte

Donner accès à sa boîte mail est un acte de confiance fort. Le scope Gmail `gmail.readonly` donne techniquement
accès à tout ; il n'existe pas de scope plus étroit qui donne le contenu. La confiance ne peut donc pas venir de la
permission technique : elle doit venir de **ce que Coly fait réellement**, de façon vérifiable, en local comme en production.

## Décision

La minimisation est une exigence produit au même rang que la fiabilité du statut. Elle s'applique à chaque étape :

1. **Filtrer avant de télécharger.** La requête Gmail côté serveur ne renvoie que des emails probablement liés à
   une commande ou un colis.
2. **Décider sur les en-têtes avant de lire.** On récupère d'abord expéditeur et sujet seuls (`format=metadata`).
   Le contenu n'est lu que si l'expéditeur est un transporteur ou si le sujet est transactionnel. Le marketing
   (« livraison offerte », remises, soldes…) n'est jamais lu. **Dans le doute, on ne lit pas.**
3. **Traiter en mémoire, puis oublier.** Le contenu sert à extraire des champs, puis n'est plus référencé ni écrit.
4. **Ne garder qu'une liste blanche de champs.**

   | Gardé | Pourquoi |
   |---|---|
   | marchand (domaine), n° de commande, date de commande | relier commande et colis |
   | articles (nom court), montant | « ce que j'ai acheté » — désactivable par l'utilisateur |
   | numéros de suivi, transporteurs, événements | suivre le colis |
   | point de retrait (nom, adresse, horaires), date limite | UC1 et UC2 |
   | code / QR de retrait, chiffré | retirer le colis ; purgé après retrait |
   | id du message Gmail, date, domaine expéditeur | preuve et re-traitement |

   | Jamais gardé | |
   |---|---|
   | corps de l'email, sujet, pièces jointes (sauf QR de retrait) | |
   | destinataires, noms, adresse personnelle, téléphone | |
   | emails écartés (même leur existence n'est pas conservée) | |

5. **Rendre visible.** L'app montrera un **journal de lecture** : quels emails ont été lus et pourquoi, ce qui en a
   été extrait, avec exclusion d'un expéditeur, export et suppression en un geste.
6. **Faire respecter par le code.** Toute nouvelle donnée persistée passe par une mise à jour de cet ADR et du
   [modèle de menaces](../security/threat-model.md). Quand le stockage existera, un test vérifiera que le schéma
   persisté ne contient que les champs de la liste blanche.

## Alternatives écartées

- Lire tous les emails filtrés par la requête Gmail : plus simple, mais lit des newsletters « livraison offerte ».
- Transfert d'emails vers une adresse Coly : aucun accès à la boîte, mais friction forte et pas d'historique
  (gardé en option de repli, investigation §2.1).

## Conséquences

- Quelques colis peuvent être ratés quand un sujet est atypique : on mesure ce taux dans le spike et on élargit la
  liste des expéditeurs connus plutôt que d'assouplir la règle.
- Argument de confiance fort, réutilisable tel quel dans la politique de confidentialité et la vérification Google.
