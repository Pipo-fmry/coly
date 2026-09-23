# Coly : investigation produit, technique, juridique et économique

> Version 1 du 23/09/2026. Document de travail : c'est une investigation, pas une spécification.
> Chaque affirmation porte un niveau de confiance :
>
> | Tag | Sens |
> |---|---|
> | ✅ | **Confirmé** par une source officielle ou primaire (lien en fin de section) |
> | 🟡 | **Probable**, mais source secondaire ou partielle. **À vérifier** avant d'en dépendre |
> | ❓ | **Hypothèse** de travail, non vérifiée |
> | ❌ | **Infirmé** : impossible, interdit ou non disponible |

---

## 0. Synthèse

### Verdict

**Oui, Coly peut faire mieux que les trackers existants sur le marché français, à une condition : ne pas se positionner comme un « meilleur agrégateur de tracking ».** La valeur est dans trois couches que personne ne combine aujourd'hui :

1. **La réconciliation** : un seul *shipment* qui porte plusieurs numéros et plusieurs transporteurs, et dont le statut est arbitré entre les sources au lieu d'être recopié depuis un agrégateur.
2. **Le point de retrait comme objet de premier rang** : l'utilisateur voit « 4 colis chez Shop N Food », avec la date limite et le code de chaque colis.
3. **L'exploitation des emails transporteurs** (« votre colis vous attend », code de retrait, « colis retiré »). Ce sont les sources les plus riches pour le retrait, et les agrégateurs ne les voient pas.

### Ce qui est confirmé

- ✅ **Colissimo et Chronopost** (la majorité du volume B2C français) sont trackables gratuitement via l'API officielle La Poste **Suivi v2** (Okapi), et Chronopost aussi via son webservice `trackSkybillV2`, sans compte client.
- ✅ Les agrégateurs **exposent la notion de dernier kilomètre** (`last_mile` chez AfterShip, `final_carrier` chez 17TRACK). Mais le bug que tu as observé (AfterShip bloqué sur « disponible au retrait ») montre qu'on ne peut pas s'y fier seul.
- ✅ **Gmail en lecture = scope restreint** : vérification Google, **audit de sécurité CASA annuel** et politique Limited Use. C'est faisable (Shop, Klarna et Route le font), mais c'est un coût fixe et un délai d'environ 6 semaines ou plus.
- ✅ **Apple ne donne aucun accès en lecture** aux commandes de Wallet ni aux SMS ou notifications sur iOS. L'extraction des commandes par Apple Intelligence dans Wallet (iOS 26) est un **concurrent**, pas une source : elle ne fonctionne qu'en anglais et qu'avec Apple Mail.
- ✅ Le **code de retrait** Mondial Relay (6 chiffres ou QR) est envoyé par email, par SMS et dans l'app Mondial Relay. L'email est donc la voie réaliste pour le récupérer.

### Ce qui reste incertain et conditionne l'architecture

- 🟡 La **qualité réelle** des agrégateurs sur DPD, Mondial Relay, Relais Colis, Colis Privé et GLS en France : il faut un **benchmark sur de vrais colis** avant de choisir.
- 🟡 Les **CGU** de l'API La Poste et des agrégateurs pour un usage B2C à grande échelle.
- ❌ **Amazon Logistics, Vinted Go et Colis Privé** n'ont pas d'API publique connue. Amazon représente un gros volume en France : son statut viendra surtout des emails Amazon.
- 🟡 La **déduplication inter-réseaux des points relais** (le même commerce peut être à la fois Pickup, Mondial Relay et Relais Colis) : faisable par adresse géocodée, à valider.

### Économie en bref

Le coût variable (tracking, IA, infrastructure et support) se situe entre **0,08 et 0,45 $ par utilisateur actif et par mois** selon l'échelle (§ 9). L'IA est **négligeable** si elle ne sert qu'en fallback (environ 0,01 à 0,03 $ par utilisateur et par mois). Les postes qui pèsent sont les agrégateurs (hors La Poste), le **support** et le **coût fixe CASA**.

Un abonnement seul est **fragile**. Les pistes les plus crédibles sont un freemium avec des fonctions « power user », des **partenariats avec les réseaux de relais et de retours**, et les **retours produits**. L'affiliation classique marche mal, car Coly intervient *après* l'achat.

### Recommandation d'architecture (provisoire, à confirmer par le benchmark du § 11)

Une architecture **hybride** :

1. APIs directes gratuites pour le groupe La Poste (Colissimo et Chronopost).
2. Un agrégateur pour la longue traîne.
3. Les emails des transporteurs traités comme des **événements** à part entière.
4. Un **moteur de réconciliation** à états monotones, avec **ré-interrogation ciblée** en cas d'incohérence.
5. Une IA uniquement en fallback d'extraction, avec contrôle anti-hallucination.

---

## 1. Modèle de données cible (3 couches plus la provenance)

Le besoin exprimé (séparer le commercial, le logistique et l'interprétation) est juste. Il manque une quatrième dimension, transverse : **la provenance**. Chaque valeur doit savoir d'où elle vient, à quelle date, et avec quel niveau de confiance.

```
Order (commercial)
 ├─ merchant, order_ref, order_date, amount, currency, items[]
 └─ 1..n Shipment
Shipment (unité logistique perçue par l'utilisateur)
 ├─ 1..n TrackingIdentity (carrier, tracking_number, role: first_mile|linehaul|last_mile|return, discovered_via)
 ├─ n Event (normalisé) ← chaque event garde source, raw_code, raw_label, timestamp, fetched_at
 ├─ 0..1 PickupLocation (lieu canonique, cf. §6)
 ├─ 0..n PickupCredential (code/QR, source, expires_at) (chiffré, §7)
 └─ UserStatus (dérivé, jamais stocké comme vérité : recalculé)
Provenance (sur chaque champ)
 └─ source_type (email|carrier_api|aggregator|user), source_ref (message_id, api call id), observed_at, confidence
```

Principes :

- **Un `Shipment` n'est pas un numéro de tracking.** Un shipment regroupe N identités (DPD puis Chronopost, par exemple). Le numéro de tracking n'est qu'un **identifiant de requête** vers une source.
- **Une commande peut avoir plusieurs shipments** (envoi fractionné), et **un shipment peut couvrir plusieurs commandes** (plus rare, comme les regroupements Amazon). La relation est donc N:M, avec une confiance attachée au lien.
- **`UserStatus` est une fonction** des événements et des règles. Il n'est jamais écrasé par la dernière réponse brute d'une API. Changer les règles recalcule tous les statuts, sans migration de données.
- **Les événements sont append-only.** On garde l'historique brut normalisé, ce qui sert à la fois d'audit et de « preuve de l'information » affichable (« Chronopost, 22/09 14:03 : colis remis au destinataire »).

Statuts utilisateur proposés (machine à états, § 5.3) : `commandé → préparé → expédié → en transit → en livraison aujourd'hui → disponible au retrait → livré / retiré`, plus les états d'exception `problème`, `retour à l'expéditeur`, `retourné` et `perdu / incertain`.

---

## 2. Sources de données : email

### 2.1 Gmail

| Point | Constat | Tag |
|---|---|---|
| Lire le corps d'un email exige un scope **restreint** | `gmail.readonly` est restreint, et il n'existe pas de scope plus étroit qui donne accès au contenu. `gmail.metadata` est lui aussi restreint et ne donne pas le corps. | ✅ |
| Conséquence | Vérification OAuth, **évaluation de sécurité par un tiers (CASA)** à renouveler **tous les 12 mois**, et politique de confidentialité conforme à la **Limited Use policy** | ✅ |
| Délai | Google annonce environ 6 semaines pour la vérification restreinte | ✅ (FAQ Google, via sources secondaires) |
| Coût CASA | De quelques centaines à quelques milliers de dollars par an selon le tier et le laboratoire. Des startups rapportent avoir passé le Tier 2 rapidement. Certaines sources évoquent un Tier 3 (pentest) pour `gmail.readonly`, à confirmer avec Google | 🟡 |
| Traitement 100 % sur l'appareil | La règle dit : *« every app … that has the ability to access data from or through a third-party server must go through a security assessment »*. Une exemption pour un traitement purement local **n'est pas écrite** | 🟡 (question ouverte sur le forum Google) |
| Mode test | Une app non vérifiée est limitée en nombre d'utilisateurs (user cap). Elle peut servir pour une **bêta privée** avant CASA | ✅ (plafond exact 🟡, historiquement 100) |
| Temps réel | `users.watch` + Pub/Sub : push sans coût de quota à la livraison (100 unités par appel `watch`), watch à renouveler au moins tous les 7 jours, puis `history.list` pour le delta. Au plus 1 notification par seconde et par utilisateur | ✅ |
| Quotas | 1 M d'unités par jour et par projet par défaut, 250 unités par seconde et par utilisateur. Suffisant jusqu'à ~10⁵ utilisateurs avec un filtrage côté serveur, extensible sur demande | ✅ / 🟡 |

**Minimisation, possible dès maintenant.** On peut appeler `messages.list` avec une requête Gmail `q=` : expéditeurs connus (transporteurs et marchands), mots-clés (`commande`, `expédié`, `colis`, `retrait`, `livraison`, `tracking`) et `newer_than:`. Ainsi le serveur **ne télécharge jamais** les emails non pertinents.

C'est ce que dit faire Shop : *« searches only for emails with keywords such as tracking number »*. Ça ne change pas la classification du scope, mais c'est un argument fort pour la revue Google, pour l'analyse d'impact RGPD et pour la confiance des utilisateurs.

**Alternative sans scope restreint : l'adresse de transfert** (`toi@in.coly.app`), à la manière de TripIt ou de l'ancien Parcel Email.

- ✅ Techniquement simple, ne nécessite **aucune vérification Google**, et fonctionne pour **toutes les messageries** (Outlook, iCloud, Orange, Free).
- Limites : ne récupère pas l'historique ; demande une configuration de filtre de transfert automatique, avec la vérification de l'adresse de transfert par Gmail (Coly peut intercepter le lien de confirmation, 🟡 à tester) ; l'expérience est nettement moins fluide.
- Parcel a mis sa fonction email en maintenance, ce qui laisse penser que l'adoption était faible ou le coût de support élevé. Mais Parcel est surtout présent aux États-Unis.
- **Recommandation** : à proposer en **option de repli**, pas en voie principale.

### 2.2 Outlook / Microsoft 365

- ✅ Microsoft Graph `Mail.Read` en délégué, compatible avec les comptes personnels Outlook.com.
- 🟡 Pas d'équivalent CASA obligatoire identifié. La *publisher verification* suffit généralement. Plus simple que Google, mais la part d'Outlook chez les particuliers français est inférieure à celle de Gmail. À placer en phase 2.

### 2.3 Standards exploitables dans les emails

- 🟡 **Balises schema.org** (`Order`, `ParcelDelivery`) en JSON-LD ou microdata dans les emails transactionnels. Gmail les consomme depuis 2013 pour ses cartes de commande. Quand elles sont présentes, **l'extraction est déterministe et gratuite** (numéro de commande, marchand, numéro de tracking, transporteur, date prévue). Leur couverture chez les marchands français est **inconnue** : il faut la mesurer sur un corpus.
- ✅ **Liens de suivi** : le domaine identifie le transporteur (`laposte.fr/outils/suivre-vos-envois`, `chronopost.fr`, `trace.dpd.fr`, `mondialrelay.fr`, `relaiscolis.com`, `colisprive.fr`, `gls-group.com`) ou une **plateforme de tracking marque blanche** (parcelLab, Narvar, AfterShip, page de statut Shopify). Dans ce second cas, il faut suivre le lien ou lire les paramètres pour obtenir le vrai transporteur. 🟡 Suivre un lien tokenisé revient à agir pour l'utilisateur : c'est acceptable techniquement, mais fragile.

### 2.4 Le rôle de l'email

Tu l'as bien posé : l'email n'est **pas** la vérité du statut logistique. J'ajoute une nuance importante : **les emails des transporteurs sont des événements logistiques de première qualité** pour trois moments :

- la **mise à disposition** en relais, avec l'adresse, les horaires, la date limite et le code ;
- le **retrait effectif** (« votre colis a été retiré ») ;
- les **reprogrammations**.

Ce sont souvent les seules sources qui portent le code de retrait. Il faut donc les traiter comme des `Event` avec `source=email_carrier`, et pas seulement comme des « découvertes ».

---

## 3. Autres sources

| Source | Faisable ? | Détail | Tag |
|---|---|---|---|
| **Apple Wallet : commandes** (Order Tracking, iOS 16+) | ❌ en lecture | Les commandes sont **poussées par les marchands** vers Wallet. **FinanceKit** permet de vérifier l'existence d'une commande et d'**ajouter ou mettre à jour ses propres** commandes, pas de lire celles des autres. Il faut en plus un entitlement géré, une app dans la catégorie Finance et une distribution **US ou UK uniquement** | ✅ |
| **Wallet + Apple Intelligence** (iOS 26) | ❌ comme source, ⚠️ comme concurrent | Extraction sur l'appareil des commandes présentes dans **Apple Mail uniquement** (pas Gmail app), appareil en **anglais US ou UK uniquement**. Pas d'API. Si Apple l'étend au français, cela devient un concurrent gratuit et natif | ✅ |
| **Apple Pay / FinanceKit : transactions** | ❌ en France | FinanceKit est limité aux US et au UK. Même disponible, il donne des transactions, pas des colis | ✅ |
| **SMS sur iOS** | ❌ | Aucune API de lecture. L'extension `ILMessageFilterExtension` sert uniquement au filtrage de spam des expéditeurs inconnus, et l'usage détourné est interdit | ✅ (connaissance de la plateforme) |
| **SMS sur Android** | ❌ en pratique | `READ_SMS` est réservé à l'app SMS par défaut. Les exceptions temporaires sont limitées à une liste de cas d'usage, et le suivi de colis n'y figure pas | ✅ (politique Play) / 🟡 (liste des exceptions à relire) |
| **Notifications d'autres apps sur iOS** | ❌ | Impossible | ✅ |
| **Notifications sur Android** (`NotificationListenerService`) | ⚠️ techniquement oui | L'utilisateur doit accorder un accès spécial. Politique Play : permission sensible, justification forte exigée. Donnerait accès aux notifications des apps La Poste, Mondial Relay ou Vinted. Risques élevés de revue et de réputation. **Non recommandé pour le MVP** | 🟡 |
| **Partage manuel** (share sheet, copier-coller) | ✅ | Extension de partage iOS et intent Android : l'utilisateur partage un SMS, une capture ou un lien vers Coly. Lecture du presse-papier avec la permission explicite d'iOS 16+. **Utile pour les colis sans email** (Vinted, particuliers) | ✅ |
| **OCR ou QR sur capture d'écran** | ✅ | Vision (iOS) et ML Kit (Android) sur l'appareil. Permet d'importer un QR de retrait que l'utilisateur a déjà. Voir le § 7 pour les limites | ✅ |
| **Numéro de téléphone comme identifiant** | ❌ | Les apps La Poste, myDPD, myChronopost et Mondial Relay retrouvent les colis d'un utilisateur par téléphone ou email dans **leur** compte client. **Aucune API publique ne l'expose.** Scraper ces apps enfreindrait leurs CGU | 🟡 (absence d'API = constat de recherche) |
| **Comptes marchands** (Amazon, Vinted, Zalando…) | ❌ | Pas d'API consommateur. Le scraping avec les identifiants de l'utilisateur est prohibé côté Coly (identifiants tiers et CGU) | ✅ |
| **Open banking DSP2** (via un agrégateur agréé AISP) | ⚠️ signal faible | Détecte qu'un achat a eu lieu (marchand, montant, date) **sans** donnée de livraison. Utile pour dire « tu as payé chez Zara il y a 3 jours et aucun colis n'est détecté ». Coût et consentement lourds pour une valeur faible. **Hors MVP** | 🟡 |
| **Gmail : onglet « Achats »** | ⚠️ concurrent | Google déploie en 2025 un onglet Achats et un suivi de colis. Le suivi reste très centré sur les **transporteurs américains** | ✅ / 🟡 (disponibilité en France) |

**Conclusion.** Pour un colis sans email exploitable (Vinted entre particuliers, cadeau, SMS seulement), les seules voies réalistes sont **la saisie ou le partage manuel** : coller un numéro, partager un SMS, scanner une capture. C'est un point d'UX à soigner, pas un problème à résoudre techniquement.

---

## 4. Transporteurs et agrégateurs

### 4.1 APIs directes des transporteurs (vues depuis une app consommateur)

| Transporteur | Accès tracking pour un tiers | Webhook | Info point relais | Code retrait via API | Tag |
|---|---|---|---|---|---|
| **Colissimo et courrier suivi (La Poste)** | **API Suivi v2 (Okapi)** : clé gratuite, statuts harmonisés, ~100 req/min par défaut | Non identifié (polling) | 🟡 des éléments de contexte et de point de retrait semblent exposés, **à vérifier dans le swagger** | ❌ non identifié | ✅ API et gratuité / 🟡 champs |
| **Chronopost** | 1) La même **API Suivi v2** ; 2) **`trackSkybillV2`** (SOAP), **sans numéro de compte** | Non | 🟡 événements « disponible en relais Pickup » avec nom | ❌ | ✅ |
| **DPD France** | Pas d'API publique de tracking identifiée. Les webservices sont réservés aux chargeurs clients. Page publique `trace.dpd.fr` | Non | Relais Pickup (réseau Geopost, commun avec Chronopost et Colissimo) | ❌ | 🟡 |
| **Mondial Relay** (groupe InPost) | SOAP `WSI2_TracingColisDetaille` avec **identifiants enseigne et clé privée** ; 🟡 probablement limité aux expéditions de l'enseigne. Tracking public avec numéro **et code postal** | Non | ✅ **`WSI4_PointRelais_Recherche`** : adresse et horaires des points relais (identifiants marchand) | ❌ (code par email, SMS ou app) | ✅ méthodes / 🟡 périmètre |
| **Relais Colis** | Pas d'API publique documentée, passer par un agrégateur | — | — | ❌ | 🟡 |
| **Colis Privé** | Pas d'API publique documentée, passer par un agrégateur | — | — | ❌ | 🟡 |
| **GLS** | Portail développeur du groupe. Webhook track & trace **pour les chargeurs clients** (documenté pour GLS NL) | Chargeurs seulement | 🟡 ParcelShops | ❌ | 🟡 |
| **UPS** | Track API (OAuth, compte développeur). 🟡 les CGU visent historiquement le suivi de ses propres envois | Track Alert (abonnement) | Access Points | ❌ | 🟡 |
| **FedEx** | Track API (compte développeur) | Webhooks (Advanced Integrated Visibility, payant 🟡) | — | ❌ | 🟡 |
| **DHL** | Shipment Tracking Unified API, clé gratuite avec quota journalier (🟡 ~250/jour par défaut, extensible) | Non | Packstation et points (DE surtout) | ❌ | 🟡 |
| **Amazon Logistics** | ❌ Aucune API | — | Lockers et points Amazon | ❌ | 🟡 |
| **Vinted Go** | ❌ Aucune API publique | — | Lockers et points Vinted Go | ❌ | 🟡 |

**Enseignements**

- **Le groupe La Poste (Colissimo, Chronopost, DPD France et le réseau Pickup)** traite l'essentiel du B2C français. Au T4 2025, le groupe prévoyait ~180 M de colis en deux mois : Colissimo >100 M, Chronopost 60 M, DPD France 20 M ✅.
  - Une API **gratuite et officielle** couvre donc une grosse part du volume : Colissimo et Chronopost.
  - **DPD France, Chronopost et Colissimo livrent tous dans les relais Pickup** ✅. C'est très probablement la clé de ton cas DPD → Chronopost → relais : un transfert **au sein de Geopost** vers le réseau Pickup. ❓ Hypothèse à confirmer sur ton colis Undiz : le colis DPD (souvent international ou B2B) est remis à Chronopost pour la livraison B2C en relais, avec un **nouveau numéro Chronopost**.
- **Aucun transporteur n'expose le code de retrait par API à un tiers.** Le code passe par email, SMS ou l'app propriétaire. D'où l'importance du parsing des emails transporteurs.
- **Les webhooks sont réservés aux chargeurs**, c'est-à-dire aux marchands. Un tiers consommateur doit **poller**, directement ou via un agrégateur qui polle lui-même.

### 4.2 Agrégateurs

| | **AfterShip** | **17TRACK** | **Ship24** | TrackingMore / Track123 / Parcelsapp |
|---|---|---|---|---|
| Positionnement | SaaS post-achat **pour marchands** | Grand public et API | API développeur | API développeur |
| API et webhooks | À partir du plan Premium (~70 à 118 $/mois pour 1 000 shipments) | Oui (webhook après enregistrement du numéro) | **Oui, dès le plan gratuit** | Oui |
| Prix indicatif | ~0,04 à 0,12 $ par shipment en dépassement. Au-delà de 5 000/mois, sur devis | Quotas **prépayés sur 12 mois** (dès ~119 $ selon Ship24, **à revérifier sur la page officielle**) ; mode `Instant` = **10 quotas** par requête. Depuis le 07/01/2026, fin des 100 numéros gratuits mensuels (200 offerts une seule fois) | 39 $/1 000 → 99 $/5 000 → 349 $/25 000 → 1 499 $/150 000 → 5 999 $/1 M (soit ~0,006 $ par shipment à 1 M) | Du même ordre |
| Dernier kilomètre et changement de transporteur | ✅ `last_mile.tracking_number`, `last_mile.slug`, événements `handed_over_to_last_mile_carrier` | ✅ `final_carrier`, affichage des deux numéros | 🟡 multi-transporteurs par shipment, à tester | 🟡 |
| Détection du transporteur | ✅ (par le format du numéro) | ✅ | ✅ | ✅ |
| Rafraîchissement | Polling interne, cadence non garantie | `Standard` = cache jusqu'à 3 h, `Instant` = temps réel (×10) | 🟡 | 🟡 |
| Confiance | ⚠️ **Statut resté sur « disponible au retrait » alors que le transporteur final indiquait « livré »** (ton observation) | ⚠️ des utilisateurs français rapportent le même symptôme (relais affiché après livraison) | ❓ | ❓ |
| Risque contractuel | Les agrégateurs **scrapent** une partie des transporteurs. Le risque de coupure (blocage, CGU) leur incombe, mais la **disponibilité** de Coly en dépend | idem | idem | idem |

**Pourquoi les agrégateurs se trompent sur les changements de transporteur** (analyse, en partie ❓) :

1. Ils suivent le **numéro enregistré** (DPD). Quand le colis passe à Chronopost, soit ils ne découvrent pas le nouveau numéro, soit ils le découvrent mais **continuent d'afficher le statut agrégé du premier**. Le dernier événement DPD (« remis au partenaire / disponible en relais ») reste alors figé.
2. Leurs statuts normalisés (`AvailableForPickup`, `Delivered`…) sont **calculés sur le flux du premier transporteur**, sans arbitrage entre les sources.
3. Le **polling ralentit** sur les colis « presque livrés » : économie de quotas côté agrégateur.

**Conclusion.** Un agrégateur est un **fournisseur d'événements**, pas un fournisseur de **statut**. Coly doit recalculer le statut lui-même (§ 5).

---

## 5. Réconciliation : le cœur du produit

### 5.1 Pistes pour relier plusieurs identités à un seul shipment, par ordre de fiabilité

| # | Signal | Fiabilité | Coût | Commentaire |
|---|---|---|---|---|
| 1 | **Lien explicite de l'API** (`last_mile.tracking_number` d'AfterShip, `final_carrier` de 17TRACK, événement « transmis à X sous le n° Y ») | Très haute | Inclus | Déterministe quand disponible |
| 2 | **Texte des événements** contenant un numéro (« Votre colis a été confié à Chronopost : XW…FR ») | Haute | Regex | Construire un catalogue de phrases par transporteur |
| 3 | **Email avec le même `order_ref`** et un nouveau numéro | Haute | Parsing | Marchand ou transporteur qui cite la référence de commande |
| 4 | **Email transporteur** citant l'expéditeur (Undiz) avec un numéro inconnu, dans une fenêtre temporelle cohérente | Moyenne | Parsing et scoring | |
| 5 | **Continuité géographique et temporelle** : fin du flux A (« remis au partenaire », hub X, jour J) et début du flux B (prise en charge au hub X, jour J ou J+1) | Moyenne | Heuristique | Utile en tie-breaker |
| 6 | **Même destination** (point relais ou ville) et même poids s'il est exposé | Moyenne | | |
| 7 | **Format du numéro** : S10 UPU `XX123456789FR` (La Poste et Chronopost), 14 chiffres (DPD), 1Z… (UPS), etc. | Faible pour lier, **forte pour identifier le transporteur** | Regex et checksum | Ne relie jamais deux numéros à lui seul |
| 8 | **LLM** sur les cas ambigus restants | Variable | $ | Uniquement pour **proposer** un lien, qui doit ensuite être confirmé par une règle (§ 8) |

Le modèle est un **score de liaison** : `link(A, B) = règles déterministes (1 à 3) → lien sûr`. Sinon, une somme pondérée (4 à 6) au-dessus d'un seuil donne un **lien probable**, affiché dans l'UI avec un indicateur « regroupé automatiquement, séparer ? ». La correction manuelle de l'utilisateur est **une donnée d'entraînement pour les poids**, pas pour un LLM.

### 5.2 Détection d'un changement de transporteur en cours de route

Déclencheurs à surveiller sur chaque flux :

- un code ou libellé d'événement de type **handover** : catalogue par transporteur (« remis à un partenaire », « transféré au réseau de livraison », `handed_over_to_last_mile_carrier`) ;
- un **flux qui se fige** après un événement de type « en cours d'acheminement vers le relais », alors qu'un **nouveau numéro** apparaît dans un email ;
- une **incohérence entre sources** (voir la machine à états plus bas).

Actions à la détection :

1. Chercher un numéro dans le texte de l'événement (regex par transporteur).
2. Chercher un email récent avec le même `order_ref` ou le même marchand.
3. Demander `last_mile` à l'agrégateur.
4. Si le transporteur final est du groupe La Poste, **interroger directement Suivi v2 ou `trackSkybillV2`**.

### 5.3 Arbitrage du statut

C'est une **machine à états monotone**, avec une précédence des sources :

```
rang d'état : commandé < expédié < en_transit < en_livraison < disponible_retrait < livré/retiré
états terminaux : livré, retiré, retourné (retour expéditeur), perdu(déclaré)
exceptions : problème (n'avance pas le rang, se superpose)
```

Règles :

1. **Un état terminal n'est émis que par la source du dernier kilomètre**, c'est-à-dire l'API directe du transporteur final, l'agrégateur pour son `last_mile`, ou l'**email « colis retiré / livré » du transporteur final**.
2. **Pas de régression de rang** sans événement explicite (retour, réexpédition). Un « disponible au retrait » arrivant **après** un « livré » de meilleure source est ignoré, mais conservé dans l'historique.
3. **Une incohérence déclenche une vérification.** Exemples : état de l'agrégateur ≠ email transporteur ; « disponible au retrait » depuis plus que le délai de garde ; nouveau numéro détecté. On ré-interroge alors la **source primaire** : API directe, ou mode `Instant` de 17TRACK à ×10 quotas, **seulement dans ce cas**.
4. **La fraîcheur est visible** : « Mis à jour il y a 12 min via Chronopost ». La confiance aussi, par exemple : « Statut non confirmé par le transporteur final ».

C'est la réponse directe à ton cas AfterShip : le « livré » de Chronopost (dernier kilomètre, API directe) **l'emporte** sur le « disponible au retrait » de DPD ou de l'agrégateur.

### 5.4 Relier une commande à ses shipments

Par ordre de priorité :

1. le **`order_ref` présent dans l'email d'expédition** (le cas le plus fréquent) ;
2. le **même thread** Gmail (`threadId`) ;
3. le même marchand, une fenêtre de dates cohérente et des produits cités ;
4. les métadonnées des pages de tracking marque blanche (parcelLab, Narvar) qui contiennent la commande.

Amazon : plusieurs colis par commande et plusieurs commandes par colis. Il faut traiter Amazon comme un **parseur dédié** : c'est l'expéditeur le plus fréquent.

---

## 6. Regroupement par point relais

### 6.1 Faisabilité

| Question | Réponse | Tag |
|---|---|---|
| Le tracking donne-t-il l'identité du relais ? | **Partiellement** : souvent le nom et la ville, rarement l'adresse complète ou un identifiant stable | 🟡 |
| Les emails de mise à disposition donnent-ils l'adresse complète ? | **Oui en général** : nom, adresse, horaires, date limite, code (Mondial Relay, Chronopost / Pickup, Colissimo, Relais Colis) | 🟡 (à mesurer sur un corpus) |
| Existe-t-il des annuaires de relais ? | Mondial Relay `WSI4_PointRelais_Recherche` ✅ (identifiants marchand) ; **Open data La Poste** (points de contact) ✅ ; Pickup 🟡 (pas d'API publique identifiée) ; OpenStreetMap 🟡 | ✅ / 🟡 |
| Un même commerce est-il présent dans plusieurs réseaux ? | **Oui, couramment** (un commerce à la fois Pickup et Mondial Relay, par exemple), avec **des identifiants différents** | 🟡 |

### 6.2 Méthode proposée

1. **Extraire** nom, adresse, code postal et ville de l'email ou de l'événement.
2. **Géocoder et normaliser** via l'**API Adresse de l'État (BAN / Géoplateforme)**, gratuite, qui fournit un identifiant d'adresse BAN et des coordonnées.
3. **Clé canonique** : `ban_id` ou géohash à environ 20 m, plus une similarité de nom (normalisation « SHOP N FOOD » = « Shop'n Food »).
4. Un `PickupLocation` canonique **agrège N identifiants réseau** (`pickup:12345`, `mondialrelay:FR-067890`).
5. **Horaires** : depuis l'email, sinon l'annuaire du réseau, sinon rien (ne pas inventer).
6. **Date limite de retrait** : celle de l'email si présente ; sinon « estimée » = date de mise à disposition + délai de garde du réseau (table par réseau, 🟡 à constituer) avec la mention « estimée ».

Écran cible, conforme à ta maquette :

```
📍 Shop N Food · 30 bd Baille, 13006 Marseille · ouvert jusqu'à 20h
   4 colis à retirer
   • Undiz   — Chronopost/Pickup — jusqu'au 29/09 — [code]
   • Vinted  — Mondial Relay     — jusqu'au 02/10 — [QR]
   • Zara    — Colissimo         — jusqu'au 30/09 — [code non disponible → ouvrir email]
   • Amazon  — ⚠️ statut Amazon uniquement
   [Afficher tous les codes]  (plein écran, luminosité max, un code par carte)
```

**Déclencheur utile** : notification géolocalisée ou « Tu passes près de Shop N Food : 4 colis t'y attendent ». Sur iOS, c'est faisable via le region monitoring (maximum 20 régions surveillées). Il faut l'autorisation de localisation « Toujours », une friction élevée. **À réserver à une version ultérieure.**

---

## 7. QR et codes de retrait

### 7.1 D'où viennent-ils ?

- ✅ Mondial Relay : code à 6 chiffres **et** QR, envoyés par email, par SMS et dans l'app. Le code peut être partagé à un tiers pour qu'il retire le colis à ta place. Les lockers acceptent la saisie du code ou le scan du QR.
- 🟡 Pickup / Chronopost, Colissimo (lockers et relais), Relais Colis, Vinted Go, Amazon Lockers : codes ou QR envoyés par email ou SMS, selon des modalités à cataloguer.
- ❌ **Aucune API tierce** ne les fournit (§ 4.1).

→ **Le seul canal licite et réaliste est l'email de l'utilisateur**, plus l'import manuel (capture ou partage).

### 7.2 Peut-on les stocker et les afficher ?

- **Juridiquement (RGPD)** : c'est une donnée de l'utilisateur, traitée pour lui et à sa demande (exécution du service). OK sous réserve de minimisation, de sécurité et d'information. 🟡 **Les CGU des transporteurs** n'interdisent pas explicitement la reproduction, à notre connaissance, mais ce n'est pas vérifié exhaustivement. Il faut relire les CGU de Mondial Relay, de Pickup et de Colissimo.
- **Risque produit** : **un code de locker est un titre au porteur.** Une fuite permet de voler le colis. Il faut donc :
  - chiffrer **au niveau du champ** (envelope encryption, clé par utilisateur via KMS) ;
  - afficher derrière **Face ID / biométrie** en option ;
  - interdire les captures dans les logs et les analytics ;
  - **purger** au retrait ou à la livraison, avec un TTL au plus égal à la date limite + 7 jours.
- **Afficher ce qui a été fourni, ne pas le générer.** Conformément à ton principe :
  - si l'email contient une **image de QR**, stocker **l'image d'origine** (pièce jointe ou image inline) et l'afficher telle quelle ;
  - si l'email ne contient qu'un **code alphanumérique**, afficher le code en gros caractères, **sans le transformer en QR**, car le format attendu par le terminal est inconnu ;
  - 🟡 les images de QR **hébergées à distance** (URL tokenisée) peuvent expirer. Il faut les télécharger au moment du parsing, ce qui revient à agir pour l'utilisateur : à mentionner dans la politique de confidentialité ;
  - générer un pass Wallet contenant le code de Coly = **génération**, à ne pas faire sans accord du réseau.
- **Pièce d'identité** : certains réseaux exigent une pièce d'identité en plus du code (🟡). L'UI doit l'indiquer quand c'est connu.

---

## 8. IA : où elle apporte vraiment de la valeur

### 8.1 Pipeline d'extraction (du moins cher au plus cher)

```
1. Filtre Gmail côté serveur (q=expéditeurs ∪ mots-clés)          → 0 €, élimine ~99 % de la boîte
2. Classification déterministe (domaine expéditeur, sujet)        → marchand / transporteur / bruit
3. schema.org JSON-LD si présent                                  → extraction exacte
4. Parseurs par gabarit (HTML → sélecteurs/regex) top-N expéditeurs → exact, versionné, testé
5. Extraction regex générique (numéros de tracking + validation checksum/format, montants, n° commande)
6. LLM en fallback (structured outputs) seulement si 3–5 incomplets → avec garde-fous
```

Le **top N** des expéditeurs (Amazon, Vinted, Zalando, Shein, Temu, Zara, la Fnac, Cdiscount, Decathlon, les transporteurs…) couvre probablement une grande majorité du volume. ❓ Hypothèse : 30 à 50 gabarits pour environ 80 % du volume, **à mesurer**.

### 8.2 Garde-fous anti-hallucination (obligatoires)

- Toute valeur extraite par le LLM doit **apparaître littéralement dans le texte source** (vérification par sous-chaîne). Sinon, elle est rejetée.
- Un numéro de tracking doit passer la **validation de format et de checksum** du transporteur supposé, **puis** une **requête de tracking réussie**, qui fait office de vérité terrain.
- Les liens commande ↔ shipment proposés par le LLM restent en « probable » tant qu'aucune règle ne les confirme.

### 8.3 Là où l'IA sert vraiment

| Usage | Valeur | Runtime ou dev-time |
|---|---|---|
| Parsing des emails non couverts par un gabarit | **Haute** (longue traîne des marchands) | Runtime, en fallback |
| **Écrire de nouveaux gabarits** à partir d'exemples, revus par un humain | **Haute** | **Dev-time**, ce qui réduit le coût runtime avec le temps |
| Mapper les libellés d'événements inconnus vers des statuts canoniques | Moyenne | **Dev-time** (proposition, puis table validée) |
| Arbitrer les liens ambigus commande ↔ shipment ou A ↔ B | Moyenne | Runtime, rare |
| Résumer la situation en langage naturel (« 2 colis à retirer avant samedi ») | Faible à moyenne | Gabarit de texte suffisant |
| Calculer le statut | **Aucune** : règles déterministes | — |

### 8.4 Coût (tarifs Anthropic au 24/06/2026, ✅ via la documentation SDK)

- Claude **Haiku 4.5** : 1 $/M tokens en entrée, 5 $/M en sortie. **Sonnet 5** : 2 $/10 $. Batch : −50 %.
- Un email nettoyé (HTML → texte) fait environ 1 500 à 3 000 tokens en entrée et 300 en sortie JSON, soit **~0,003 à 0,0045 $ par email avec Haiku**, ou ~0,0015 à 0,002 $ en batch (latence acceptable si ce n'est pas le premier email d'un colis).
- ❓ Hypothèse d'usage : 20 emails pertinents par utilisateur et par mois, dont 20 à 30 % tombent dans le fallback LLM, soit **~0,01 à 0,03 $ par utilisateur et par mois**. Environ **0,005 $ par colis**.
- Avec Sonnet 5 partout et sans filtre : ~10× plus. **Le filtrage et les gabarits sont le vrai levier.**

⚠️ **Confidentialité** : envoyer le contenu d'un email à un fournisseur LLM est un **transfert à un sous-traitant**. Il faut une rétention nulle ou minimale, un DPA, et la mention dans la politique de confidentialité. Il faut aussi le **déclarer lors de la vérification Google**, sous la Limited Use policy (🟡 : à valider explicitement avec Google, qui interdit par ailleurs l'usage des données pour **entraîner des modèles généralistes**). Pour les données en UE, voir la résidence des données du fournisseur ou un hébergement via un cloud avec une région UE (🟡).

---

## 9. Coûts par utilisateur : scénarios

### Hypothèses (❓ à affiner)

- 4 colis par utilisateur actif et par mois, 20 emails pertinents.
- ~50 % du volume est Colissimo ou Chronopost, donc gratuit via l'API La Poste. Le reste passe par un agrégateur au tarif public de Ship24 (le moins cher publié). 17TRACK est comparable.
- IA : 25 % des emails en fallback Haiku, ~0,004 $ chacun.
- CASA : ~3 000 $ par an (fourchette de 500 $ à plusieurs milliers). Comptes stores : 99 $ par an (Apple) + 25 $ (Google).
- Support : 1 ticket pour 50 utilisateurs par mois, ~3 $ le ticket (assisté par IA et FAQ). ❓
- **Hors salaires, marketing et commission des stores sur le revenu.**

| Utilisateurs actifs / mois | 1 000 | 10 000 | 100 000 | 1 000 000 |
|---|---|---|---|---|
| Colis par mois | 4 000 | 40 000 | 400 000 | 4 000 000 |
| Colis via agrégateur | 2 000 | 20 000 | 200 000 | 2 000 000 |
| Agrégateur | ~99 $ (plan 5k) | ~349 $ (plan 25k) | ~3 149 $ (plan 400k) | ~8 000 à 12 000 $ (négocié, ~0,005 $) ❓ |
| IA (fallback) | ~20 $ | ~200 $ | ~2 000 $ | ~15 000 $ (les gabarits réduisent la part LLM) |
| Infra (API, BDD, workers, Pub/Sub, push, stockage chiffré) | ~100 $ | ~400 $ | ~2 500 $ | ~15 000 $ |
| CASA et stores, amortis | ~260 $ | ~260 $ | ~300 $ | ~500 $ (tier et pentest plus lourds) |
| Support | ~60 $ | ~600 $ | ~6 000 $ | ~40 000 $ (à industrialiser) |
| **Total mensuel** | **~540 $** | **~1 800 $** | **~14 000 $** | **~80 000 à 85 000 $** |
| **Par utilisateur et par mois** | **~0,54 $** | **~0,18 $** | **~0,14 $** | **~0,08 $** |

Lecture :

- **Aux petites échelles, les coûts fixes dominent** (CASA, plans minimum). Aux grandes, c'est le **support**, puis le tracking.
- Les **notifications push** (APNs, FCM) sont gratuites. Pub/Sub est négligeable.
- Levier majeur : **plus la part La Poste en direct est grande et plus le polling est intelligent** (fréquence adaptée à l'état : 6 h en transit, 30 min le jour de livraison, stop après le terminal), moins l'agrégateur coûte.

---

## 10. Concurrence

| Acteur | Source de données | Où il échoue (constats et ❓) | Business model |
|---|---|---|---|
| **AfterShip (app)** | Saisie ou import, tracking agrégé | Statut recopié d'un seul flux : **ton bug DPD → Chronopost**. Pas de vue par point relais | SaaS pour marchands : l'app grand public sert de vitrine |
| **17TRACK** | Saisie, agrégation par scraping | Même symptôme rapporté en France (relais affiché après livraison). UX dense. Pas de vue commande | Pub, premium, API |
| **Parcel (iOS)** | Saisie, synchro Amazon (connexion), **email de transfert en maintenance** (les emails transférés sont conservés indéfiniment) | Pas d'import Gmail natif. Centré sur les US | Premium annuel |
| **Shop (Shopify)** | **Données natives des marchands Shopify** + scan Gmail et Outlook (30 jours, par mots-clés) | Hors Shopify : *« Shop can't read some tracking emails »*. Transporteurs FR et relais peu soignés ❓ | Acquisition pour les marchands Shopify, Shop Pay |
| **Route** | Connexion email, carte | Centré sur les US | **Assurance d'expédition** (~2,5 % du panier) vendue via les marchands |
| **Klarna** | Connexion email (Gmail et Outlook), import des commandes, **codes de retrait** | Nécessite l'écosystème Klarna. Couverture FR des relais ❓ | Paiement fractionné, commerce |
| **Gmail (onglet Achats)** | Emails, schema.org, partenaires transporteurs | Transporteurs **US** surtout. Pas de relais français | Rétention Google |
| **Apple Wallet (iOS 26)** | Apple Mail + IA sur l'appareil, marchands Wallet | **Anglais seulement**, Apple Mail seulement | Écosystème |
| **Apps transporteurs** (La Poste, myChronopost, myDPD, Mondial Relay) | **Données propriétaires** (téléphone, email, compte) | **Silos** : un réseau chacun. Mais ils ont les **codes**, le **déverrouillage à distance des lockers** (Mondial Relay) et la **reprogrammation** | Service client, sans monétisation directe |
| **Parcelsapp, Parcel Monitor, trackers génériques FR** | Agrégation | Pas de vue commande, pas de regroupement par relais | Pub |

**Espace libre (❓, à confirmer par des tests utilisateurs) :**

1. La **vue par point relais multi-réseaux**, avec les codes et les dates limites : **personne ne la propose**.
2. **L'arbitrage multi-sources** du statut, avec provenance visible.
3. Le **français d'abord** : parseurs des marchands français, réseaux Pickup, Mondial Relay, Relais Colis et Vinted Go.
4. **Vinted** : un énorme flux de colis entre particuliers, des retraits en relais, et une douleur réelle de gestion.

**Menaces :**

- Apple qui étend Wallet au français.
- Google qui étend l'onglet Achats à l'Europe.
- La Poste qui pousse une app unifiée Colissimo, Chronopost et DPD. Ce serait techniquement facile pour eux : Geopost possède Pickup.

---

## 11. Architectures comparées

| Option | Pour | Contre | Verdict |
|---|---|---|---|
| **A. Agrégateur unique** | Rapide, une seule intégration | **Reproduit le bug d'AfterShip**, dépendance totale, coût sur 100 % du volume | ❌ seule |
| **B. Plusieurs agrégateurs** | Redondance, comparaison | Coût ×2, deux modèles de statut à réconcilier | 🟡 seulement en vérification secondaire |
| **C. APIs directes seulement** | Qualité maximale, gratuit pour La Poste | **Trous** : DPD, Mondial Relay, Relais Colis, Colis Privé, GLS sans API accessible ; maintenance lourde | ❌ seule |
| **D. Hybride** : La Poste en direct + 1 agrégateur + emails transporteurs comme événements + réconciliation | Qualité sur ~50 % du volume, couverture de la longue traîne, coût réduit de moitié | Plus de logique à écrire, mais c'est **le cœur de la valeur** | ✅ **recommandé** |
| **E. D + interrogation secondaire en cas d'incohérence** (mode `Instant` de 17TRACK ou second agrégateur à la demande) | Corrige les blocages sans payer en permanence | Complexité modérée | ✅ **à ajouter en v1.1** |
| **F. Traitement sur l'appareil** (parsing local des emails) | Argument de confidentialité fort | Gmail n'est pas accessible sans token côté appareil ; CASA probablement toujours requis ; synchro en arrière-plan limitée sur iOS ; pas de push serveur | 🟡 à explorer pour le positionnement, pas pour le MVP |

**Flux retenu (hypothèse de travail) :**

```
Gmail (watch/PubSub) ─┐                         ┌─ La Poste Suivi v2 / Chronopost WS (direct, gratuit)
Transfert email ──────┼─> Ingestion ─> Extraction ─> Résolution transporteur ─> Tracking ─┤
Partage/saisie ───────┘   (filtre q=)  (règles→LLM)  (format+domaine+API)               └─ Agrégateur (reste)
                                                                                          │
      Events append-only  <── emails transporteurs (dispo, code, retiré) ─────────────────┘
               │
         Réconciliation (liaison identités, machine à états, détection incohérence → re-query)
               │
         Statut utilisateur + PickupLocation canonique (BAN) + Credentials chiffrés
               │
         API app ── push (APNs/FCM) ── App iOS/Android
```

**Choix du fournisseur agrégateur : ne pas décider maintenant.** Faire un **benchmark de 2 à 3 semaines** :

- corpus de 100 à 200 vrais colis français (tes emails plus quelques testeurs), répartis entre DPD, Mondial Relay, Relais Colis, Colis Privé, GLS, UPS, Amazon et Vinted Go, avec au moins 10 changements de transporteur ;
- enregistrer chaque numéro chez **Ship24, 17TRACK et AfterShip** (essais et plans d'entrée) ;
- vérité terrain : le site du transporteur final, vérifié à la main à J+0, J+1 et à la livraison ;
- mesures :
  - % de statut terminal correct ;
  - **latence** entre l'événement réel et sa visibilité ;
  - % de `last_mile` découverts ;
  - présence du nom et de l'adresse du relais ;
  - coût réel.

---

## 12. Sécurité, confidentialité, conformité

### 12.1 Google (scope restreint)

- Vérification de la marque et du domaine, vidéo de démonstration du flux OAuth, politique de confidentialité alignée sur la **Limited Use policy**, **CASA annuel**.
- La Limited Use policy (✅ le principe, 🟡 le détail à relire) interdit :
  - tout usage autre que la fonctionnalité visible par l'utilisateur ;
  - le transfert de données, sauf pour fournir le service, pour la sécurité ou pour une obligation légale ;
  - la **publicité** ;
  - la **lecture par des humains** sans consentement explicite (hors sécurité et obligation légale) ;
  - la vente de données.

→ **Revente de données et publicité ciblée fondée sur les emails : impossibles.** Cela ferme certaines pistes de business model (§ 13).

### 12.2 Architecture « pas d'email brut conservé »

- Récupération → extraction **en mémoire** (worker éphémère) → persistance **uniquement** des champs structurés, de `gmail_message_id` et d'**extraits de preuve courts** (par exemple la ligne contenant le numéro de tracking, en moins de 200 caractères, 🟡 à justifier).
- Les images de QR sont la seule exception : stockées chiffrées, avec un TTL.
- Si un re-parsing est nécessaire après une mise à jour d'un gabarit, on **re-télécharge** par `message_id` via l'API. On ne garde pas de copie.
- Logs : jamais de corps d'email, jamais de code. Scrubbing automatique.
- **Tokens OAuth** : refresh tokens chiffrés via KMS, dans un service isolé avec un accès minimal. Révocation (`oauth2/revoke`) à la déconnexion ou à la suppression du compte.

### 12.3 RGPD

- **Bases légales** : exécution du contrat (art. 6.1.b) pour le service cœur ; consentement pour les options (localisation, analytics).
- **Analyse d'impact (AIPD) recommandée, probablement obligatoire** : traitement du contenu des communications électroniques, à grande échelle, avec des données de localisation. 🟡 à confirmer avec un DPO.
- **Données de tiers** : les emails contiennent des données d'expéditeurs (vendeurs Vinted, par exemple). Il faut les minimiser et ne pas les extraire au-delà du nécessaire.
- **Hébergement en UE**. Sous-traitants (cloud, LLM, agrégateurs, souvent hors UE : AfterShip et 17TRACK ont des liens avec la Chine et Hong Kong, 🟡) : DPA, clauses contractuelles types, et **analyse du transfert** pour les numéros de tracking. Un numéro de tracking plus une adresse de relais restent des données personnelles indirectes.
- **Rétention** : shipments supprimés au bout de 6 à 12 mois après la livraison (réglable) ; codes purgés au retrait ; export et suppression depuis l'app.
- Rappel de ton principe, validé : **« visible par l'utilisateur » ≠ « droit de collecter et de stocker »**. Chaque donnée doit avoir une **finalité** écrite.

### 12.4 Apple et Google Play

- Apple : App Privacy « nutrition labels » ; **suppression du compte dans l'app** obligatoire ✅ ; si la connexion se fait via Google, il faut **Sign in with Apple** ou une option équivalente (guideline 4.8, 🟡 : vérifier les exemptions actuelles). La connexion à Gmail (autorisation d'accès) n'est pas un login et relève d'un flux distinct.
- Localisation « Toujours » : justification requise, forte friction à la revue. À reporter.
- Play : pas de `READ_SMS`. Un `NotificationListener` serait fortement scruté.

### 12.5 Transporteurs et agrégateurs

- **CGU Okapi (La Poste)** : vérifier qu'une app B2C tierce peut suivre les colis de ses utilisateurs à grande échelle, et négocier un quota au-delà de 100 req/min. 🟡 **À lire avant tout développement.**
- **Scraping direct** des sites transporteurs par Coly : **déconseillé** (CGU, blocages, fragilité). Laisser ce risque à l'agrégateur, contractuellement.

---

## 13. Business model

| Modèle | Potentiel | Contraintes | Avis |
|---|---|---|---|
| **Freemium + premium** (~2,99 €/mois ou ~19,99 €/an) | Premium : historique illimité, notifications avancées, mode famille ou multi-boîtes, vue relais avancée, widgets et Live Activities | Conversion typique de 2 à 5 % ❓. Commission des stores de 15 % (Small Business Program). À 100 000 utilisateurs et 3 % de conversion, ~7 000 €/mois nets, **à peine au niveau du coût variable** | ✅ base, **insuffisant seul** |
| **Affiliation e-commerce** | Commissions de 2 à 8 % ❓ | **Coly arrive après l'achat** : attribution faible. Limited Use : **interdit d'utiliser les emails pour cibler** | ⚠️ faible |
| **Cashback** | Fort pour l'acquisition | Même problème de timing. Concurrence installée (iGraal, Poulpeo). Réglementation | ⚠️ |
| **Retours** (rappel de la fin du délai de rétractation, étiquette, dépôt en relais) | Coly connaît la date de livraison, donc la **fenêtre de rétractation de 14 jours** ✅ légale. Partenariats possibles avec les plateformes de retour et les réseaux relais (dépôt) | Intégrations B2B nécessaires | ✅ **différenciant** |
| **Partenariats réseaux** (Pickup, Mondial Relay / InPost, Relais Colis, Vinted Go) | Ils cherchent à réduire les **colis non retirés** (retours coûteux). Coly = rappels multi-réseaux et vue groupée : valeur mesurable pour eux | Cycle de vente long. Données partagées = consentement | ✅ **piste B2B sérieuse** |
| **Assurance ou garantie de livraison** (modèle Route) | Revenu par commande | Distribution via les marchands, pas via le consommateur. Réglementation assurance | 🟡 plus tard |
| **Marque blanche ou API de réconciliation** vendue à des marchands ou des banques (à la Klarna) | Le moteur de réconciliation français est un **actif** revendable | Change le focus produit | 🟡 option stratégique |
| **Données agrégées** | — | Limited Use et RGPD : **exclu** si c'est dérivé des emails | ❌ |

**Recommandation** : freemium dès le lancement, pour mesurer la propension à payer. En parallèle, préparer un **pilote avec un réseau de relais** autour des colis non retirés, et la fonction **retours** en v2.

---

## 14. MVP réaliste pour la France

### Phase 0 : spike et benchmark (3 à 4 semaines, sans app publique)

1. **Corpus** : exporter 6 à 12 mois de tes emails de commande et d'expédition (Takeout ou script local), puis anonymiser. Étiqueter 200 emails et 100 colis (vérité terrain).
2. **Tests des APIs** : clé Okapi Suivi v2 (lire le swagger, confirmer les champs relais et les codes d'événements) ; `trackSkybillV2` ; essais Ship24, 17TRACK et AfterShip. Rejouer ton cas **Undiz #211258160**.
3. **Benchmark** (§ 11) → **choix de l'agrégateur**.
4. **Juridique** : lire les CGU d'Okapi et des agrégateurs, et celles des réseaux sur les codes. Demander un devis CASA à 2 laboratoires. Poser la question « traitement sur l'appareil » à Google.
5. **Livrable** : tableau de couverture réel par transporteur, précision de l'extraction (règles seules, puis avec LLM), taux de détection des changements de transporteur.

### Phase 1 : bêta privée (6 à 8 semaines, ≤ 100 testeurs, app Gmail non vérifiée en mode test)

Couvre les 11 points demandés :

| # | Fonction | Implémentation MVP |
|---|---|---|
| 1 | Connexion Gmail | OAuth `gmail.readonly`, watch + Pub/Sub, backfill de 90 jours filtré par `q=` |
| 2 | Détection des commandes | schema.org, puis ~20 gabarits (top des marchands français du corpus), puis Haiku en fallback avec garde-fous |
| 3 | Détection des shipments | Regex et validation de format, domaines des liens, emails transporteurs |
| 4 | Commande ↔ shipment | `order_ref`, thread, fenêtre de dates + marchand ; lien « probable » séparable par l'utilisateur |
| 5 | Tracking multi-transporteurs | La Poste en direct + l'agrégateur retenu ; polling adaptatif |
| 6 | Changement de transporteur | Champs `last_mile` + catalogue de phrases de handover + nouveau numéro par email → shipment unique |
| 7 | Statut fiable | Machine à états monotone, précédence du dernier kilomètre, fraîcheur et source affichées |
| 8 | Regroupement par relais | Extraction depuis les emails de mise à disposition + géocodage BAN + clé canonique |
| 9 | Infos de retrait | Adresse, horaires si connus, date limite (email ou « estimée ») |
| 10 | QR et code | Extraits des emails transporteurs, stockés chiffrés, affichés tels quels, purgés au retrait |
| 11 | Notifications | Push : « disponible au retrait », « livraison aujourd'hui », « J-2 avant retour à l'expéditeur », « problème ». **Pas plus.** |

**Hors MVP** : Outlook, open banking, Android `NotificationListener`, géofencing, retours, Live Activities (v1.1, peu coûteux et très visible).

**Stack** (suggestion, sans en faire un enjeu) : app **Expo / React Native** (iOS et Android avec une base unique ; Live Activities et widgets via des modules natifs) ou SwiftUI si iOS d'abord. Backend TypeScript ou Python, Postgres, file de jobs (polling et parsing), KMS, hébergement en UE.

### Phase 2 : lancement public

CASA et vérification Google (à anticiper dès la fin de la phase 0, car le délai est d'environ 6 semaines), AIPD, publication sur les stores, freemium.

### KPI de validation

- **Précision du statut final** ≥ 98 % par rapport à la vérité terrain. C'est la promesse n°1 : ne jamais afficher « à retirer » pour un colis déjà livré.
- % de changements de transporteur fusionnés correctement ≥ 90 %.
- % de colis en relais avec un `PickupLocation` résolu ≥ 85 %, avec un code ≥ 60 % (❓ dépend des réseaux).
- Précision et rappel de l'extraction des commandes ≥ 95 % et ≥ 85 %.
- Latence médiane entre l'événement transporteur et la notification < 30 min pour La Poste en direct.
- Part LLM < 30 % des emails, en baisse mois après mois.

---

## 15. Risques principaux

| Risque | Probabilité | Impact | Mitigation |
|---|---|---|---|
| CASA ou vérification Google refusée ou retardée | Moyenne | **Bloquant** | Anticiper, minimiser les scopes et le filtrage, adresse de transfert en repli, Outlook |
| Agrégateur bloqué par un transporteur (scraping) | Moyenne | Élevé | Hybride, deux agrégateurs possibles, API directe quand elle existe |
| CGU La Poste restrictives pour un usage B2C | Faible à moyenne | Élevé | Lire les CGU en phase 0, contacter La Poste (partenariat plausible) |
| Apple ou Google étendent le suivi natif au français | Moyenne (2 à 3 ans) | Élevé | Se différencier sur les relais multi-réseaux, la réconciliation et les codes |
| Fuite de codes de retrait | Faible | **Très élevé** (vols, réputation) | Chiffrement au niveau du champ, biométrie, TTL, pentest |
| Revenus < coûts | **Élevée** | Élevé | B2B réseaux et retours, maîtrise des coûts (§ 9) |
| Fragilité des gabarits d'emails (les marchands changent leurs templates) | Élevée | Moyen | Fallback LLM, monitoring du taux d'échec par expéditeur, régénération des gabarits assistée par LLM |
| Amazon (gros volume) mal couvert | Élevée | Moyen | Parseur Amazon dédié ; statut « selon Amazon » affiché honnêtement |

---

## 16. Questions ouvertes et prochaines actions

1. [ ] Créer une clé Okapi, **lire le swagger de Suivi v2** (champs relais, codes d'événements, multi-identifiants, quotas) et les **CGU**.
2. [ ] Rejouer **Undiz #211258160** : récupérer les deux numéros (DPD, Chronopost), les événements bruts de chaque source et ceux d'AfterShip. Documenter le point exact de divergence.
3. [ ] Benchmark de 3 agrégateurs sur 100 à 200 colis français (§ 11).
4. [ ] Constituer le corpus et mesurer : % d'emails avec schema.org, top 30 des expéditeurs, % d'emails transporteurs contenant un code ou un QR.
5. [ ] Table des délais de garde par réseau (Pickup, Mondial Relay, Colissimo, Relais Colis, Vinted Go, Amazon).
6. [ ] Devis CASA (2 laboratoires) et question à Google sur le traitement sur l'appareil.
7. [ ] Lire les CGU de Mondial Relay, Pickup et Colissimo sur la reproduction des codes de retrait.
8. [ ] Interviews : 10 utilisateurs intensifs de relais (dont des vendeurs et acheteurs Vinted), pour valider la vue relais et la propension à payer.
9. [ ] Premier contact exploratoire avec un réseau de relais (Pickup ou Mondial Relay) sur les colis non retirés.

---

## Sources

- Gmail et OAuth : [Restricted scope verification (Google)](https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification) · [Push Gmail / Pub/Sub](https://developers.google.com/workspace/gmail/api/guides/push) · [Quotas Gmail API](https://developers.google.com/workspace/gmail/api/reference/quota) · [users.watch](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users/watch) · [CASA 2026 (DeepStrike)](https://deepstrike.io/blog/google-casa-security-assessment-2025) · [Forum Google : traitement sur l'appareil et CASA](https://discuss.google.dev/t/gmail-restricted-scope-is-the-casa-assessment-required-when-mail-is-processed-on-device-and-only-a-derived-subscription-list-reaches-our-server/398372) · [Guide Gmail API / CASA (Explosion)](https://www.explosion.com/210203/gmail-api-integration-guide-oauth-scopes-and-casa/) · [Retour d'expérience CASA Tier 2](https://meetorbis.com/blog/how-we-passed-google-casa-tier-2-with-claude)
- Microsoft : [Graph permissions overview](https://learn.microsoft.com/en-us/graph/permissions-overview) · [Mail API](https://learn.microsoft.com/en-us/graph/api/resources/mail-api-overview?view=graph-rest-1.0)
- Apple : [Suivi des commandes dans Wallet (Apple Support)](https://support.apple.com/en-us/105065) · [iOS 26 : Wallet et emails (MacRumors)](https://www.macrumors.com/how-to/ios-track-orders-apple-wallet/) · [9to5Mac, iOS 26 Wallet](https://9to5mac.com/2026/05/19/ios-26s-wallet-app-has-long-awaited-order-tracking-fix-heres-how-to-use-it/) · [FinanceKit](https://developer.apple.com/financekit/) · [Documentation FinanceKit](https://developer.apple.com/documentation/financekit)
- Android : [Politique SMS et journal d'appels (Play)](https://support.google.com/googleplay/android-developer/answer/10208820?hl=en) · [Permissions des handlers par défaut](https://developer.android.com/guide/topics/permissions/default-handlers)
- La Poste, Chronopost : [lapostesuivi (Suivi v2)](https://github.com/debuss/lapostesuivi) · [Profil API La Poste / Okapi](https://github.com/api-evangelist/la-poste) · [Okapi CLI](https://github.com/DeveloperLaPoste/okapi-cli) · [Chronopost trackSkybillV2](https://github.com/MonsieurGourmand/chronopost/blob/master/_src/Tracking/trackSkybillV2.php) · [Volumes T4 2025 (Voxlog)](https://www.voxlog.fr/actualite/10426/sur-les-deux-derniers-mois-de-2025-le-groupe-la-poste-sattend-a-gerer-180-millions-de-colis) · [Pickup (La Poste Groupe)](https://www.lapostegroupe.com/fr/focus/la-poste-face-au-defi-de-le-commerce/filiale-du-groupe-la-poste-via-sa-filiale-geopostdpdgroup) · [FAQ Pickup](https://www.pickup.fr/faq-particulier/) · [Geopost (Wikipedia)](https://en.wikipedia.org/wiki/Geopost)
- Mondial Relay : [Web Service v5.11 (PDF)](https://www.mondialrelay.fr/media/124122/solution-web-service-v511.pdf) · [WSI2_TracingColisDetaille](https://api.mondialrelay.com/web_services.asmx?op=WSI2_TracingColisDetaille) · [Code de retrait](https://www.mondialrelay.fr/faq/recevoir-un-colis/je-nai-pas-recu-mon-code-de-retrait/) · [Lockers](https://www.mondialrelay.fr/consignes-lockers/)
- GLS : [Webhook Track & Trace (GLS NL)](https://gls-apim-api-gps.developer.azure-api.net/track-trace-webhook) · [GLS Developer Portal](https://dev-portal.gls-group.net/)
- Agrégateurs : [Modèle Tracking AfterShip (last_mile)](https://www.aftership.com/docs/tracking/model/tracking) · [Tarifs AfterShip](https://www.aftership.com/pricing/tracking) · [API 17TRACK](https://api.17track.net/en/doc) · [Tarifs 17TRACK](https://www.17track.com/en/pricing) · [Détail des plans 17TRACK](https://help.17track.net/hc/en-us/articles/37575217580825-Plan-Details) · [Tarifs Ship24](https://www.ship24.com/pricing) · [Comparatif APIs (Ship24)](https://www.ship24.com/blog/best-shipment-tracking-api)
- Concurrents : [Shop : suivi des livraisons](https://help.shopify.com/en/manual/online-sales-channels/shop/delivery-tracking) · [Shop Help : suivi des commandes](https://help.shop.app/en/shop/delivery-tracking/track-orders) · [Parcel Email](https://parcelapp.net/help/parcel-email.html) · [Route](https://www.route.com/) · [Klarna : suivi des achats](https://www.klarna.com/international/press/klarna-extends-all-in-one-shopping-app-with-automatic-purchase-history-and-delivery-tracking-for-all-online-orders/) · [Suivi de colis dans Gmail (TechCrunch)](https://techcrunch.com/2025/09/11/gmail-makes-it-easier-to-track-upcoming-package-deliveries) · [Aide Gmail : suivi des colis](https://support.google.com/mail/answer/13073650?hl=en&co=GENIE.Platform%3DDesktop) · [17TRACK : avis (CNAM Lorraine)](https://cnam-lorraine.fr/17track-un-service-sur-pour-vos-colis/)
- LLM : tarifs Anthropic (documentation SDK `claude-api`, tableau en cache du 24/06/2026).
