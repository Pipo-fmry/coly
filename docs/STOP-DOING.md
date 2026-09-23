# À ne plus faire

> Une ligne par erreur constatée : date, ce qu'il ne faut plus faire, pourquoi, et quoi faire à la place.
> Les agents lisent ce fichier avant de travailler.

| Date | Ne plus… | Parce que | À la place |
|---|---|---|---|
| 2026-09-23 | recopier le statut brut d'un agrégateur | AfterShip est resté sur « disponible au retrait » alors que Chronopost indiquait « livré » | dériver le statut, le transporteur du dernier kilomètre fait foi (ADR 0005) |
| 2026-09-23 | traiter un numéro de tracking comme un colis | un colis peut changer de transporteur et de numéro | un `Shipment` regroupe plusieurs `TrackingIdentity` |
| 2026-09-23 | générer un QR à partir d'un code de retrait | format attendu par le terminal inconnu, risque de colis non remis | afficher l'image ou le code fournis, tels quels |
| 2026-09-23 | écrire du texte en sauge ou citron sur fond clair | contraste 2,6:1 et 1,2:1, illisible | réserver au décor ; texte en forêt, pin ou mousse |
| 2026-09-23 | servir la webapp en mode dev pour l'iPhone | Next bloque ses ressources dev depuis une origine non locale (`*.ts.net`) : bouton Actualiser inerte | `pnpm web` (build + start) pour le téléphone ; `pnpm web:dev` seulement en local |
| 2026-09-23 | jeter un email transporteur parce qu'aucun numéro n'y est reconnu | l'email GLS contenait relais, adresse et QR code, tout a été perdu | gabarit par transporteur (`parseCarrierEmail`) avant de conclure « sans numéro » |
| 2026-09-23 | corriger au cas par cas à partir d'un seul colis ou d'une seule boîte mail | on s'adapte à un utilisateur, pas au marché | faits typés + fusion (ADR 0016), extraction générique (ADR 0017), décision sur le rapport de couverture |
