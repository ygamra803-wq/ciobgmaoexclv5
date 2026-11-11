---
id: page-atelier-mecanique
groupId: 04-corrective-di-bt
groupTitle: Maintenance Corrective (DI / BT & Clôture)
docType: page
audience: user
tabId: corrective_atelier
title: Atelier Fabrication Mécanique — Bons de Réalisation (BR) & Rectification (RECT)
subtitle: Suivi des demandes d'usinage, confection de pièces sur mesure et rectification mécanique interne liés aux BT ou autonomes
summary: Guide opérationnel et technique de l'onglet Atelier Mécanique (BR/RECT) permettant à la Section Maintenance (SM) d'émettre et suivre les travaux d'usinage et de rectification sans fausser le stock PDR ni clôturer prématurément les Bons de Travail.
relatedTabs:
  - corrective_bt
  - corrective_live
  - corrective_cloture
  - machines
---

# 🔨 Guide Utilisateur : Atelier Fabrication Mécanique — Bons de Réalisation (`BR`) & Rectification (`RECT`)

> **Module :** Maintenance Corrective (`COR-ATELIER-P0`)  
> **Identifiant d'accès :** `#corrective_atelier`  
> **Onglet :** *Atelier Mécanique (BR/RECT)* (`AtelierFabricationTab.tsx`)  
> **Public cible :** Section Maintenance (`SM`), Techniciens d'atelier, Usineurs / Tourneurs-Fraiseurs, Responsables Méthodes & Maintenance.

---

## 1. Philosophie Industrielle : Les 4 Issues d'une Défaillance Corrective

Dans une usine industrielle, une intervention corrective ne se résume pas toujours à « sortir une pièce de rechange (PDR) du magasin et clôturer le BT ». **CIOB GMAO v4** distingue strictement **4 issues opérationnelles** :

1. **Issue A — Dépannage direct / Remplacement PDR magasin :** Sortie d'une pièce standard du magasin (`IncrementalStockIndex`) et clôture du `BT` après validation `Maker-Checker`.
2. **Issue B — Réparation externe d'un organe (`Sortie Externe`) :** Envoi d'un moteur en bobinage ou d'un variateur chez un sous-traitant externe (`SORT-EXT-xxx` dans `SortieExterneService`).
3. **Issue C — Confection ou Rectification à l'Atelier Fabrication Mécanique interne (`Bon Atelier BR / RECT`) :** Une pièce mécanique doit être usinée à neuf (`REALISATION`) ou reprise au tour/fraiseuse/rectifieuse (`RECTIFICATION`) par l'atelier mécanique interne avant de pouvoir être remontée sur la machine.
4. **Issue D — Attente pièce magasin / Réapprovisionnement (`EN_ATTENTE_PDR`) :** Rupture de stock en magasin nécessitant une commande d'achat (`PO`).

### Règles d'Or Non-Négociables du Bon Atelier (`BR / RECT`)
- **Émetteur :** `Section Maintenance (SM)` / Technicien ou Responsable connecté.
- **Destinataire :** `Atelier Fabrication Mécanique`.
- **Zéro Pollution du Stock PDR :** Un Bon d'Atelier (`BR` ou `RECT`) **n'est pas un mouvement de magasin**. Il ne déduit aucun `stockActuel` et ne traverse jamais `IncrementalStockIndex`.
- **Interdiction de Clôture Fictive du BT :** Créer un Bon d'Atelier depuis un `BT` ouvert **ne clôture jamais le BT** (`statut !== 'CLOTURE'`, `action_fermee = 'NON'`). Le `BT` passe en attente d'atelier (**`ATTENTE ATELIER`**, stocké sous l'état FSM `EN_ATTENTE_PDR`) et sa clôture reste bloquée tant que la pièce n'est pas réceptionnée et montée (`RECEPTIONNE_MONTAGE`).

---

## 2. Cycle de Vie et Machine à États du Bon Atelier (`WorkshopOrder`)

Chaque bon enregistré dans `STORAGE_KEYS.WORKSHOP_ORDERS` (`gmao_workshop_orders_v1`) suit un automate à états finis strictement gardé par `validateWorkshopOrderTransition` :

```text
[ EMIS ] (Demande émise par SM : BR-YYYY-NNN ou RECT-YYYY-NNN)
   │
   ├──────────────► [ ANNULE ] (Annulation avant ou pendant usinage)
   ▼
[ EN_COURS_FABRICATION ] (Prise en charge par l'Atelier Fabrication Mécanique : tournage, fraisage, rectification)
   │
   ├──────────────► [ ANNULE ]
   ▼
[ PRET_LIVRAISON ] (Usinage terminé et contrôlé à l'atelier, pièce prête pour la Section Maintenance)
   │
   ├──────────────► [ ANNULE ]
   ▼
[ RECEPTIONNE_MONTAGE ] (État Terminal : Pièce réceptionnée et montée par SM — Débloque la clôture du BT lié)
```

| Statut | Signification Terrain | Impact sur le `BT` Lié |
| :--- | :--- | :--- |
| **`EMIS`** | Bon créé par la Section Maintenance, en attente de lancement d'usinage. | `BT` maintenu en **`ATTENTE ATELIER`** — Clôture `BT` bloquée. |
| **`EN_COURS_FABRICATION`** | Usinage, tournage, soudure ou rectification en cours à l'atelier mécanique. | `BT` maintenu en **`ATTENTE ATELIER`** — Clôture `BT` bloquée. |
| **`PRET_LIVRAISON`** | Pièce terminée à l'atelier, disponible au comptoir atelier pour montage. | `BT` maintenu en **`ATTENTE ATELIER`** — Clôture `BT` bloquée jusqu'à réception montage. |
| **`RECEPTIONNE_MONTAGE`** | Pièce récupérée et montée sur la machine par l'équipe maintenance (`SM`). | **Déverrouille la clôture du `BT`** (le `BT` peut maintenant être clôturé et validé). |
| **`ANNULE`** | Demande annulée (ex. solution alternative trouvée). | Ne bloque plus la clôture du `BT`. |

---

## 3. Les 3 Points d'Entrée pour Émettre un Bon Atelier (`BR / RECT`)

### A. Depuis une Intervention en Direct (`#corrective_live` — `InterventionLiveTab`)
1. Pendant le dépannage d'un `BT`, cliquez sur le bouton ambre **« Bon atelier mécanique (BR / RECT) »**.
2. Choisissez le type :
   - **`REALISATION`** : Confection / usinage d'une pièce neuve (génère un code `BR-YYYY-NNN`).
   - **`RECTIFICATION`** : Réparation, tournage d'arbre, alésage ou ajustage d'une pièce existante (génère un code `RECT-YYYY-NNN`).
3. Renseignez la **quantité**, la **description technique des travaux** (cotes, tolérances, matière) et une **observation** éventuelle.
4. Cliquez sur **« Émettre Bon Atelier & Mettre BT en Attente »** :
   - Une notification Toast affiche le numéro généré (ex. `BR-2026-001`).
   - Le `BT` est automatiquement placé en attente d'atelier (**`ATTENTE ATELIER`**) sans être clôturé.

### B. Depuis la Fiche d'un Rapport d'Intervention (`#corrective_cloture` — `ClotureRapportsTab`)
1. Ouvrez la prévisualisation d'une fiche d'intervention (icône 👁️).
2. Dans la section **« Atelier Fabrication Mécanique (Bon de Réalisation / Rectification) »**, cliquez sur **« + Demande Réalisation / Rectification »** pour émettre un bon rattaché à la machine (et au `BT` s'il est encore ouvert), ou cliquez sur **« Ouvrir Suivi Atelier »** pour basculer vers le tableau complet.

### C. Depuis l'Onglet Dédié `Atelier Mécanique (BR/RECT)` (`#corrective_atelier` — Avec ou Sans BT)
1. Ouvrez l'onglet **Atelier Mécanique (BR/RECT)** dans la barre de navigation de la Maintenance Corrective.
2. Cliquez sur **« + Nouveau Bon Atelier (BR / RECT) »**.
3. Sélectionnez :
   - **Nature de la demande :** `REALISATION (BR)` ou `RECTIFICATION (RECT)`.
   - **Machine concernée (Active) :** Sélection obligatoire parmi les machines actives du parc (`filterActiveMachines`).
   - **Lier à un BT ouvert (Optionnel) :** Permet soit de rattacher le bon à un `BT` existant, soit de créer un **Bon autonome (Sans BT)** pour préparer une pièce mécanique sur une machine active.
   - **Quantité, Description technique des travaux et Observation.**

---

## 4. Suivi et Pilotage dans l'Onglet `Atelier Mécanique (BR/RECT)`

L'écran `#corrective_atelier` offre une vue industrielle complète :
1. **Bandeau de 5 KPIs Temps Réel :**
   - *Total Bons Atelier* (et nombre d'ordres actifs).
   - *Émis (Attente Atelier)*.
   - *En Cours Fabrication*.
   - *Prêts Livraison*.
   - *Réceptionnés & Montés*.
2. **Filtres Multi-Critères :**
   - Recherche instantanée par numéro de bon (`BR-2026-001`, `RECT-2026-001`), code machine, numéro de `BT`, description ou émetteur.
   - Filtre par statut (*Tous*, *Actifs uniquement*, *Émis*, *En cours fabrication*, *Prêt livraison*, *Réceptionné & Monté*, *Annulé*).
   - Filtre par type (*Réalisation BR* / *Rectification RECT*) et par machine active.
3. **Actions Directes de Progression & Impression Officielle :**
   - Sur chaque ligne, les boutons d'action proposent uniquement les transitions autorisées par la machine à états :
     - **`Lancer Fabrication`** (`EMIS ➔ EN_COURS_FABRICATION`)
     - **`Prêt Livraison`** (`EN_COURS_FABRICATION ➔ PRET_LIVRAISON`)
     - **`Réceptionner & Monter`** (`PRET_LIVRAISON ➔ RECEPTIONNE_MONTAGE`)
     - **`Annuler`** (`➔ ANNULE`)
   - **Filtrage par Tags de Politique Matérielle (`POLICY-TAGS-P1`) :** Lors de la sélection d'une cible dans le catalogue, le sélecteur met en évidence les éléments porteurs des tags `FABRICABLE_ATELIER` (pour `REALISATION`) et `REPARABLE_ATELIER` (pour `RECTIFICATION`) via `policyTagsService.ts`.
   - **Impression de la Fiche Officielle (`AtelierFabOrderPrintModal.tsx`) :** Cliquez sur l'icône **Imprimer (🖨️)** d'un bon pour générer l'ordre officiel d'usinage / rectification avec cartouche normalisé, spécifications techniques et cadres de visa (Émetteur Maintenance, Chef d'Atelier Mécanique, Contrôle Réception).
   - Un clic sur le badge du **`BT Lié`** bascule directement vers l'onglet **Bons de Travail (`#corrective_bt`)**.
