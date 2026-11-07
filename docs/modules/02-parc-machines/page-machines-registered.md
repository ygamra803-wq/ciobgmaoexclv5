---
id: page-machines-registered
groupId: 02-parc-machines
groupTitle: Parc Machines, Blueprints & Architecture 3-Tiers
docType: page
audience: user
tabId: machines
title: Machines Enregistrées & Passeport 360°
subtitle: Registre physique de l'atelier, classes Production / Système Général, regroupement par Ligne et Dossier 360°
summary: Guide opérationnel complet pour enregistrer les équipements de l'usine, gérer leur statut, consulter leur Passeport Santé 360°, imprimer leurs étiquettes QR et appliquer l'archivage sécurisé.
relatedTabs:
  - families
  - templates
  - blueprints
  - nexus
---

# Machines Enregistrées & Passeport Technique 360° (`Parc Machines`)

## 1. Rôle de cet Écran

L'écran **Machines Enregistrées** est le registre officiel de tous les équipements physiques présents dans votre usine. Contrairement aux catalogues théoriques (**Familles**, **Templates** et **Blueprints**), chaque ligne représente ici **une machine réelle sur le terrain**, caractérisée par :
- Son **Code Machine unique** (ex. `RCF100-01`, `AIR-01`) et son **Numéro de Série**.
- Sa **Zone géographique réelle** (atelier/secteur) et son **Technicien Responsable**.
- Son **Horomètre / Compteur principal** (Heures, Cycles ou Km).
- Son **Statut opérationnel** (`En Service`, `En Maintenance`, `En Panne`, `Arrêt`, `Archivée`).

---

## 2. Les Deux Classes d'Équipements : `Production` vs `Système Général`

Lors de l'ajout d'un équipement (**« + Nouvelle Machine »**) ou dans la barre de filtres rapides, vous pouvez choisir entre deux grandes classes :

1. **Machine de Production (`PRODUCTION`)** :
   - Équipement participant directement à la fabrication (ex. *Rectifieuse*, *Tour CNC*, *Presse Hydraulique*, *Ligne d'assemblage*).
   - Elle est rattachée à une **Famille (`FAM-XX`)** et à un **Modèle / Template (`TPL-XXX`)** qui génère automatiquement son code séquentiel.
2. **Système Général — Utilités & Sécurité (`SYSTEM_GENERAL`)** :
   - Équipements transverses d'infrastructure (ex. *Compresseur d'air*, *Groupe électrogène*, *Pompe incendie*, *Poste de transformation*).
   - Vous pouvez gérer et créer vos propres **Types de Système Général** (bouton **« Types Système »**) sans être obligé de créer une Famille ou un Template de production.

---

## 3. Regroupement Opérationnel : `Ligne de Production` et `Machine Fille`

Si votre atelier comporte des lignes composées de plusieurs machines :
- Définissez l'équipement principal avec le **Rôle Opérationnel = `Ligne / Équipement Parent (LINE)`**.
- Sur les machines appartenant à cette ligne, choisissez **Rattachement Ligne / Machine Mère** et sélectionnez la ligne correspondante.
- **Avantage :** Le système consolide automatiquement les pannes et temps d'arrêt de toute la ligne tout en permettant à chaque machine fille de garder sa propre zone, son propre compteur et son propre plan de maintenance.

---

## 4. Outils Terrain Intégrés sur Chaque Machine

Depuis le menu d'actions (`•••`) ou les icônes de chaque ligne machine, vous accédez à 4 outils majeurs :

### A. Dossier Technique & Passeport Santé 360° (`Passeport 360°`)
Ouvre une vue consolidée en 5 onglets sur les 12 derniers mois :
1. **Vue Générale & Spécifications** : Score de santé sur 100, **Coût Total TCO (12M)**, heures d'arrêt cumulées, et **Alertes BER** (*Beyond Economical Repair* si un organe est tombé en panne 3 fois ou plus dans l'année).
2. **Compteurs & Horomètres** : Valeur actuelle du compteur et historique chronologique des relevés.
3. **Organes & BOM** : Liste unifiée des composants et PDR montés sur la machine (Registre Nexus + Entrepôt).
4. **Historique Pannes** : Tous les Bons de Travail correctifs (`DI/BT`) de la machine.
5. **Préventif & Exécutions** : Journal des visites préventives réalisées.

### B. Carnet de Santé Préventif (`Bouclier Vert`)
Affiche immédiatement le **Taux de Conformité Préventive (%)**, la prochaine échéance hebdomadaire, le nombre de tâches en retard et le coût préventif cumulé de la machine.

### C. Étiquette QR Code & Fiche Terrain Imprimable (`Icône QR`)
Génère en 1 clic :
- **Mode Étiquette Collante** : Étiquette compacte avec QR Code à coller sur le châssis de la machine.
- **Mode Fiche Terrain A4** : Fiche plastifiable résumant l'identité technique et les consignes de premier niveau pour l'opérateur.

---

## 5. Règle d'Or : Archivage Sécurisé (`Safe Archive`)

Lorsque vous cliquez sur **Supprimer** sur une machine :
- **Si la machine n'a aucun historique** (0 mouvement de stock, 0 intervention, 0 tâche PM, 0 organe monté), elle peut être supprimée définitivement.
- **Dès que la machine possède un historique financier ou technique**, le système bloque la destruction et vous propose l'**Archivage Sécurisé (`ARCHIVEE`)** :
  - Ses gammes préventives sont automatiquement suspendues.
  - Elle n'apparaît plus dans les listes de saisie de nouveaux bons ou sorties magasin.
  - Tout son historique de coûts et de pannes reste 100% intact pour vos rapports de direction et le journal d'audit.
