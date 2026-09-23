# 0015 — L'information la plus juste, d'où qu'elle vienne

- **Statut** : Accepté
- **Date** : 2026-09-23

## Contexte

Premier test réel (colis Caats, GLS) : Ship24 connaissait toute la frise du colis, mais Coly n'en gardait que le
dernier événement ; aucun email n'étant arrivé depuis, l'app montrait moins que ce que le transporteur savait.
Par ailleurs Ship24 renvoie « FR » comme lieu et ne transmet pas le détail du ParcelShop GLS.

## Décision

1. **Le transporteur fait foi, l'email complète.** Peu importe le canal : on affiche la donnée la plus juste et la
   plus récente disponible, avec sa source.
2. **On ne jette pas l'information logistique** : tous les événements de chaque source sont conservés
   (libellé, date, lieu, transporteur), fusionnés dans une frise unique sans doublon.
3. **On n'invente rien** : un lieu inexploitable (« FR ») est ignoré ; faute de nom de relais, on affiche
   « Point relais <réseau> » et on le dit.
4. **À défaut, on renvoie à la source officielle** : chaque colis a un lien vers la page de suivi du transporteur.
5. **Le quota sert les colis utiles** : à la première installation, un colis dont le dernier email a plus de
   30 jours et sans statut est présumé terminé et n'est pas suivi ; ensuite la synchro est incrémentale
   (nouveaux emails seulement) et ne re-suit que les colis non terminés.

## Conséquences

- Écran de détail : frise complète, point relais, date d'arrivée, lien transporteur.
- Le détail des relais GLS (nom, adresse, horaires) reste à obtenir : email transporteur, autre agrégateur ou API
  officielle (à comparer dans le benchmark de l'investigation §11).
- Libellés Ship24 en anglais : à traduire via les codes de statut.
