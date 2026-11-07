---
id: page-preventive-planning-meters
groupId: 03-preventive-meters
groupTitle: Maintenance Préventive & Compteurs (Meter PM)
docType: page
audience: user
tabId: preventive
title: Planning Annuel & Suivi par Compteurs (Horomètres)
subtitle: Matrice 52 semaines, exécution terrain des visites, rondes Système Général et maintenance conditionnelle par compteurs
summary: Guide opérationnel complet pour piloter le planning préventif annuel, valider les visites d'entretien avec pièces PDR, enregistrer les tournées d'horomètres et déclencher une DI corrective en cas d'anomalie.
relatedTabs:
  - preventive_referentiel
  - machines
  - validation_center
  - corrective_di
---

# Planning Préventif Annuel & Suivi par Compteurs (`Matrice & Horomètres`)

## 1. Rôle de cet Écran

L'écran **Planning & Compteurs Préventifs** est le centre de commandement de toute la maintenance préventive de l'usine. Il vous permet de :
1. **Planifier et suivre sur 52 semaines (`S1` à `S52`)** toutes les opérations d'entretien des machines de production et des équipements de Système Général.
2. **Suivre l'usure réelle par Compteurs (`Horomètres Heures / Cycles / Km`)** et être alerté dès qu'une machine approche ou dépasse son seuil d'entretien (ex. vidange toutes les `500 Heures`).
3. **Valider les exécutions terrain** en enregistrant le temps passé, les pièces de rechange (`PDR`) consommées et les éventuelles anomalies découvertes.

---

## 2. Les 6 Modes de Vue Disponibles (Barre de Commutation)

Vous pouvez changer d'angle de lecture à tout moment grâce aux 6 boutons situés en haut du planning :

1. **Matrice Annuelle (`Matrice 52 Semaines`)** : Vue panoramique croisant les machines/organes et les semaines de l'année avec codes couleurs par statut (`À faire`, `Fait`, `En retard`, `En attente validation`).
2. **Vue Groupée par Machine (`Par Machine`)** : Regroupe toutes les gammes préventives machine par machine avec leur taux de conformité individuel.
3. **Calendrier Mensuel (`Calendrier`)** : Affiche les interventions prévues jour par jour sur le mois sélectionné.
4. **Liste Détaillée (`Liste`)** : Tableau filtrable multi-critères avec impression d'ordres de travail préventifs et export Excel.
5. **Analytique & Journal d'Exécutions (`Analytique`)** : Graphiques de conformité, répartition par technicien/action AFNOR, et historique financier complet des visites réalisées.
6. **Horomètres & Compteurs (`Compteurs`)** : Cockpit dédié à la maintenance conditionnelle par heures de marche, cycles ou kilomètres (avec badge rouge indiquant le nombre de tâches échues au compteur).

---

## 3. Opérations Courantes Pas-à-Pas

### A. Valider l'Exécution d'une Tâche Préventive
1. Cliquez sur une tâche planifiée dans la matrice ou la liste, puis sur **« Exécuter / Marquer Fait »**.
2. Renseignez :
   - **La Date de réalisation** et le **Technicien exécutant**.
   - **La Durée réelle (en minutes)** pour le calcul automatique du coût de main-d'œuvre.
   - **Les Pièces de Rechange (`PDR`) utilisées** *(si remplacement ou appoint d'huile/graisse)* :
     - Si vous êtes **Responsable / Admin**, la validation déduit automatiquement les pièces du **Stock Magasin** et enregistre l'exécution au statut **`Fait`**.
     - Si vous êtes **Technicien**, l'exécution passe au statut **`En attente de validation`** (circuit *Maker-Checker*) : les pièces sont réservées sans débiter le stock physique jusqu'à l'accord du superviseur dans le **Centre de Validation**.
3. **Découverte d'une Anomalie pendant la Visite** :
   - Si lors d'un contrôle préventif vous constatez une pièce fissurée ou un bruit anormal nécessitant un dépannage, cochez **« Anomalie détectée — Créer une DI Corrective de suivi »**. Le système créera automatiquement la Demande d'Intervention dans le module Correctif.

### B. Enregistrer un Relevé d'Horomètre ou une « Tournée d'Atelier » (`Onglet Compteurs`)
Dans l'onglet **Compteurs** :
1. **Relevé Individuel (`Mettre à jour`)** : Cliquez sur une carte machine, saisissez le nouvel index du compteur (ex. `4 520 Heures`) et validez. Le système calcule automatiquement l'écart (`+Delta`) et met à jour les barres de progression (%) de toutes les gammes liées à cette machine.
2. **Tournée d'Atelier Groupée (`Bouton Tournée d'Atelier`)** :
   - Ouvre une feuille de saisie rapide listant toutes les machines actives de l'usine sur un seul écran.
   - Saisissez les nouveaux relevés à la volée en parcourant l'atelier, puis cliquez sur **« Valider et Enregistrer la Tournée »** : toutes les machines modifiées et leurs alertes de seuil sont recalculées en une seule opération.
3. **Validation Directe d'une Tâche Échue au Compteur** :
   - Lorsqu'une barre de progression passe en **Orange (`Approche seuil`)** ou **Rouge (`Échue au compteur`)**, cliquez sur **« Valider l'intervention maintenant »** directement sur la carte : la tâche est enregistrée et le prochain seuil est automatiquement décalé (ex. `4 500 h + 500 h = 5 000 h`).

### C. Rondes Groupées « Système Général »
Pour les équipements de sécurité et utilités (extincteurs, compresseurs, pompes incendie), utilisez le bouton **« Ronde Système Général »** afin de valider en lot les contrôles périodiques d'une même famille d'infrastructure.
