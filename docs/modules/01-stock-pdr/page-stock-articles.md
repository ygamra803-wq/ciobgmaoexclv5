---
id: page-stock-articles
groupId: 01-stock-pdr
groupTitle: Stock PDR, Mouvements & Commandes (PO)
docType: page
audience: user
tabId: stock
title: Stock Articles & Centre de Commandes (PO)
subtitle: Pilotage du magasin PDR, seuils d'alerte, réservations Maker-Checker et bons de commande fournisseurs
summary: Guide opérationnel complet pour gérer le catalogue des articles en stock, surveiller les ruptures et piloter le cycle de réapprovisionnement (Commandes PO).
relatedTabs:
  - sortie
  - types
  - designations
---

# Stock Articles & Centre de Commandes (`Stock PDR`)

## 1. Rôle de cet Écran

L'écran **Stock Articles** est le tableau de bord central du magasin de pièces de rechange (**PDR**) et des consommables. Il vous permet à tout instant de :
- Connaître la quantité exacte présente sur les étagères (**Stock Actuel**) ainsi que la quantité déjà engagée sur des interventions en attente de validation (**Stock Réservé**).
- Identifier immédiatement les pièces en **Rupture (`0`)** ou sous le **Seuil Minimum**.
- Valoriser les achats et lancer des **Commandes de Réapprovisionnement (`PO`)** auprès des fournisseurs jusqu'à leur réception physique en magasin.

---

## 2. Comprendre les Cartes KPI & Filtres Intelligents (En haut de page)

En cliquant sur l'une des cartes situées en haut de l'écran, le tableau se filtre instantanément :

1. **Total Articles** : Affiche l'intégralité du catalogue magasin actif.
2. **Stock Disponible (`OK`)** : Filtre uniquement les articles dont le stock est supérieur au seuil de sécurité.
3. **Sous Seuil (`Alerte`)** : Isoler les articles dont la quantité atteint ou passe sous le **Seuil Minimum** défini sur la fiche article (badge orange).
4. **Rupture de Stock (`0`)** : Affiche en priorité absolue les articles totalement épuisés (`Stock = 0`, badge rouge) nécessitant une commande urgente.
5. **Réservé (Maker-Checker)** : Filtre les articles ayant des quantités réservées par des techniciens sur le terrain (via une demande de sortie ou un bon de travail en attente de validation).
6. **Commandes PO Actives** : Indique le nombre de bons de commande fournisseurs en cours (`DEMANDE`, `COMMANDE` ou `RECU_PARTIEL`). Cliquez sur le bouton **« Réapprovisionnement / PO »** pour ouvrir le centre d'achats.

---

## 3. Opérations Courantes Pas-à-Pas

### A. Filtrer par Hiérarchie `Groupe ➔ Type` & Gérer les Groupes PDR (`Groupes PDR`)
1. Dans la barre de filtres supérieure, sélectionnez un **Groupe PDR** (ex. `GRP-PDR-01 — Roulements & Paliers`, `GRP-PDR-02 — Transmission`, etc.) ou l'option **`Non classé`** pour isoler les articles sans groupe.
2. La liste déroulante **Type PDR** se filtre automatiquement pour n'afficher que les types appartenant au groupe sélectionné.
3. Cliquez sur le bouton **« Groupes PDR »** pour ouvrir la fenêtre `PdrGroupsModal` : vous pouvez créer ou modifier un groupe, définir ses **Tags de Politique par défaut** (`PDR_MAGASIN`, `FABRICABLE_ATELIER`, `REPARABLE_ATELIER`, `SOUS_TRAITABLE`, `CONSOMMABLE_CRITIQUE`) ou désactiver en toute sécurité un groupe existant sans créer d'orphelins.
4. Utilisez les boutons **Export / Import Catalogue Excel 3 Feuilles** (`PDR_GROUPS`, `PDR_TYPES`, `PDR_ITEMS`) pour exporter ou importer la hiérarchie complète en mode **Fusion (`MERGE`)** ou **Remplacement (`REPLACE_CATALOG`)**.

### B. Créer un Nouvel Article de Stock (`+ Nouvel Article`)
1. Cliquez sur le bouton vert **« + Nouvel Article »** en haut à droite.
2. Sélectionnez le **Groupe PDR** puis le **Type PDR** (ex. `Roulements`) et la **Désignation PDR** (ex. `Roulement Rigide à Billes`).
   - *Astuce :* Si le Type ou la Désignation n'existe pas encore, utilisez le bouton rapide **`+`** directement à côté de la liste déroulante sans quitter votre fenêtre.
3. Le **Code / Référence SKU (`ref`)** est vérifié contre les doublons, et l'article hérite automatiquement des **Policy Tags** de son groupe (sauf personnalisation explicite).
4. Renseignez :
   - **Stock Initial** : Quantité comptée lors de l'inventaire de départ.
   - **Seuil Minimum** : Niveau d'alerte déclenchant une recommandation d'achat.
   - **Prix Unitaire (MAD)** : Coût unitaire servant au calcul automatique du budget d'achat (`PO`) et du coût de maintenance des machines (`TCO`).
   - **Emplacement Magasin** : Allée / Rayon / Casier (ex. `RAYON-A-12`) pour retrouver la pièce en quelques secondes.
5. *(Optionnel)* Dans l'encadré **Affectation Technique**, liez l'article à une **Machine**, un **Organe** ou une **Pièce** spécifique afin qu'il apparaisse automatiquement dans le passeport technique de la machine.

### C. Enregistrer une Entrée ou une Sortie Rapide depuis une Ligne Article
Sur chaque ligne du tableau :
- Cliquez sur **`+ Entrée`** (bouton vert) pour ouvrir directement une réception de stock pré-remplie sur cet article.
- Cliquez sur **`- Sortie`** (bouton orange/rouge) pour enregistrer immédiatement un prélèvement de pièce vers une machine.
- Cliquez sur l'icône **Historique (Horloge)** pour consulter la fiche complète des mouvements (`Entrées`, `Sorties`, `Retours`, technicien, machine et date) de cet article uniquement.

### C. Lancer et Réceptionner une Commande Fournisseur (`Centre de Réapprovisionnement PO`)
1. Cliquez sur le bouton **« Réapprovisionnement / PO »** dans la barre d'outils supérieure.
2. **Onglet 1 — Alertes & Création PO** :
   - Le système liste automatiquement tous les articles en rupture ou sous seuil en tenant compte du **Stock Réservé**.
   - Cochez les articles à commander, ajustez si besoin la **Quantité à commander** (pré-calculée à $2 \times \text{Seuil Min} - \text{Disponible}$), indiquez le **Fournisseur** et cliquez sur **« Créer la Commande (PO) »**.
3. **Onglet 2 — Suivi & Réception des Commandes** :
   - Passez une demande du statut **`DEMANDE`** à **`COMMANDE`** une fois envoyée au fournisseur.
   - Lorsque le camion livre les pièces au magasin, cliquez sur **« Réceptionner »** : saisissez les quantités réellement livrées.
   - Si la livraison est incomplète, la commande passe automatiquement en **`RECU_PARTIEL`** ; si tout est livré, elle passe en **`RECU_CONFORME`**.
   - **Automatisme clé :** La validation de réception crée **automatiquement** les mouvements d'**`Entrée`** correspondants et met à jour votre stock physique sans aucune double saisie.

---

## 4. Points de Vigilance & Bonnes Pratiques

- **Modification du Stock Initial vs Mouvement d'Entrée** : Ne modifiez jamais le **Stock Initial** d'un article pour enregistrer un achat courant (toute modification du stock initial ou du prix unitaire est tracée dans le **Journal d'Audit Institutionnel** de la direction). Utilisez toujours un mouvement **`Entrée`** ou une **Réception de Commande `PO`**.
- **Suppression Protégée** : Un article ayant déjà un historique de mouvements est protégé afin de préserver l'exactitude des coûts historiques du parc machines.
