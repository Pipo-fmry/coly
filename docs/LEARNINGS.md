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
