# 0016 — Faits typés et moteur de fusion unique

- **Statut** : Accepté
- **Date** : 2026-09-23
- **Précise** : [0005](0005-statut-derive-evenements-append-only.md), [0015](0015-information-la-plus-juste.md)

## Contexte

Les premiers tests réels ont produit des correctifs au cas par cas (format de numéro GLS, gabarit d'email GLS,
découpage d'adresse) et une synchro qui accumule des exceptions (« si email GLS alors… »). Ça ne passe pas à
l'échelle de centaines de marchands et de dizaines de transporteurs.

## Décision

1. **Trois couches d'information**, toutes dérivées, jamais recopiées d'une source :

   | Couche | Question | Champs |
   |---|---|---|
   | Suivi | Où est le colis, à quelle étape ? | statut, événements, date prévue, transporteur courant, numéros liés |
   | Retrait | Où, quand, jusqu'à quand, avec quoi ? | lieu (nom, adresse, horaires), mise à disposition, date limite, code / QR |
   | Commande | Qu'ai-je acheté, chez qui ? | marchand, n° de commande, date, articles |

2. **Des fournisseurs de faits.** Toute source (email marchand, email transporteur, API officielle, agrégateur,
   saisie manuelle) est un *fournisseur* qui émet des **faits typés** : `(colis, champ, valeur, source, observé le,
   confiance)`. Un fournisseur ne décide jamais du statut ni du lieu final.
3. **Un moteur de fusion unique** calcule chaque champ à partir des faits, avec des règles écrites une fois :
   - statut : rang monotone, terminal émis par la source du dernier kilomètre, problème seulement s'il est le plus récent (ADR 0005) ;
   - lieu et adresse : fait le plus précis (email transporteur > API officielle > agrégateur), jamais un lieu inexploitable ;
   - à précision égale, le plus récent ; toujours avec sa source affichable.
4. **Le moteur et l'app ne connaissent aucun transporteur ni marchand par son nom.** Ce savoir vit dans les
   fournisseurs, déclarés dans un registre.

## Conséquences

- Ajouter une source = ajouter un fournisseur ; le moteur et l'UI ne bougent pas.
- La qualité se mesure champ par champ et fournisseur par fournisseur (rapport de couverture, [plan](../plan/roadmap.md)).
- Migration : les sources actuelles (La Poste, Ship24, emails GLS) deviennent des fournisseurs à l'étape 2 du plan.
