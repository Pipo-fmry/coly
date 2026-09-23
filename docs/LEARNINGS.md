# Ce qu'on a appris

> Une ligne par apprentissage issu d'un test réel (colis, email, API). Daté, sourcé, avec l'impact sur le produit.
> Les hypothèses non vérifiées restent dans l'investigation, pas ici.

| Date | Constat | Source | Impact |
|---|---|---|---|
| 2026-09-23 | Un agrégateur peut rester bloqué sur l'état du premier transporteur après un passage DPD → Chronopost | observation utilisateur (commande Undiz #211258160) | réconciliation multi-sources = cœur du produit |
| 2026-09-23 | Gmail renvoie un 403 « quota exceeded » (unités par minute et par utilisateur) dès la première synchro de 300 emails | premier spike réel | attente exponentielle sur 429/403 quota dans le client Gmail |
| 2026-09-23 | Le tri sur en-têtes laisse passer 296 emails sur 300 (0 écarté comme marketing) et 197 lus n'ont aucun numéro | premier spike réel, 180 jours | ADR 0013 pas encore tenue : resserrer le tri (expéditeurs connus, sujets plus stricts) avant d'ouvrir à d'autres |
| 2026-09-23 | 48 numéros détectés : La Poste (S10) 16, Chronopost 12, UPS 8, Colissimo 5, DPD 4, GLS 2, Mondial Relay 1 | premier spike réel | le groupe La Poste pèse ~70 % : l'API La Poste gratuite couvre l'essentiel |
| 2026-09-23 | Le filtre serveur plafonne à 300 emails sur 180 jours | premier spike réel | pagination complète ou fenêtre plus courte ; à régler avec la synchro incrémentale |
| 2026-09-23 | Ship24 connaît toute la frise GLS mais renvoie « FR » comme lieu et pas le détail du ParcelShop ; libellés en anglais | colis Caats | ADR 0015 : frise complète, lieu « FR » ignoré, lien vers la page GLS |
| 2026-09-23 | Exclure promotions / réseaux sociaux / forums côté Gmail fait passer de 300 à 195 emails sur 90 jours | spike réel | tri côté serveur efficace ; le tri sur en-têtes reste trop permissif (192 lus sur 195) |
| 2026-09-23 | Première synchro : 37 colis sur 90 jours, dont 30 anciens présumés terminés ; 7 appels Ship24 au lieu de 15+ | spike réel | la logique « première installation » économise le quota |
| 2026-09-23 | La clé La Poste répond 403 « pas les droits » tant que l'abonnement à l'API Suivi n'est pas validé | spike réel | repli automatique sur Ship24 quand La Poste ne trouve rien |
