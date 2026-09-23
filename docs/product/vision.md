# Vision produit et cas d'usage

> Vivant. Dernière mise à jour : 23/09/2026. Fondé sur [l'investigation](../research/investigation.md).

## Promesse

Ne jamais afficher « à retirer » pour un colis déjà livré, et toujours dire **où aller, quoi faire en premier, et quand**.

**Et ne lire que les emails de commande et de livraison, n'en garder que l'indispensable, et le montrer.**
L'utilisateur doit pouvoir vérifier à tout moment ce que Coly a lu et gardé ([ADR 0013](../adr/0013-minimisation-promesse-produit.md)).

## Les trois problèmes à résoudre

### UC1 — « J'ai plein de colis, souvent au même endroit »

Quand plusieurs colis attendent dans le même commerce, je veux le savoir d'un coup d'œil : **un lieu, N colis**,
avec l'adresse, les horaires et tous les codes prêts à montrer.

- Un même commerce peut être relais de plusieurs réseaux (Pickup, Mondial Relay, Colissimo…) : c'est **un seul lieu** pour l'utilisateur.

### UC2 — « Il ne me reste qu'un jour pour aller chercher un colis »

Je veux voir **immédiatement** ce qui va expirer, avant que le colis reparte chez l'expéditeur.

| Niveau | Règle (v0, à ajuster en test) | Tag |
|---|---|---|
| Critique | date limite aujourd'hui ou demain | rouge « Dernier jour » / « Plus que 1 j » |
| Bientôt | date limite dans 2 à 3 jours | ambre « Plus que N j » |
| Normal | au-delà | aucun tag d'urgence |
| Problème | incident transporteur, adresse, retour | rouge « Problème » |

Une date limite **estimée** (non fournie par le transporteur) est toujours signalée comme telle.

### UC3 — « Attendre un jour pour tout récupérer d'un coup » (bonus)

Si un colis m'attend dans un lieu et qu'un autre doit y arriver dans un ou deux jours, Coly peut suggérer
d'attendre pour **un seul déplacement**.

Règle v0 : suggérer « Attends jeudi : +1 colis arrive ici » seulement si
1. le colis entrant a **ce lieu comme destination connue** (pas deviné) ;
2. son arrivée estimée tombe **au moins 1 jour avant** la date limite la plus proche des colis déjà présents ;
3. aucun colis du lieu n'est en niveau « critique ».

Sinon, pas de suggestion : l'urgence prime toujours sur l'optimisation.

⚠️ Hypothèse à vérifier : connaître le relais de destination **avant** l'arrivée (email marchand qui cite le point
choisi au checkout, ou événement transporteur « en cours d'acheminement vers le relais X »). Si ce n'est pas
fiable, UC3 reste désactivé.

## Premier écran : principes

L'écran d'accueil combine UC1 et UC2 **sans bascule ni onglet** :

1. **Filtres rapides** en haut : `À faire` (défaut) · `En route` · `Problèmes` · `Tout`, avec compteurs.
2. **Urgent d'abord** : tout colis critique ou en problème remonte en tête, quel que soit son lieu.
3. **Puis les lieux**, triés par date limite la plus proche : une carte par lieu avec le nombre de colis, le tag d'urgence du plus pressé, et la suggestion UC3 le cas échéant.
4. **Puis « En route »**, triés par date d'arrivée estimée.
5. Les colis livrés ou retirés disparaissent de l'accueil (consultables dans `Tout`).

Maquettes : canvas « Coly design system » (lien dans [design-system.md](../design/design-system.md)).

## Hors périmètre du prototype

Outlook, open banking, lecture de SMS ou de notifications, géolocalisation, retours produits, app native.
