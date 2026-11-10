---
id: page-bons-travail
groupId: 04-corrective-di-bt
groupTitle: Maintenance Corrective (DI / BT & Clôture)
docType: page
audience: user
tabId: corrective_bt
title: Bons de Travail (BT) & Intervention Live
subtitle: Planification des ordres de travail, chronomètre d'atelier, gestion des shifts et protocole Maker-Checker
summary: Guide d'exécution terrain pour les techniciens et superviseurs de maintenance. Décrit le chronométrage Live avec neutralisation automatique de la pause déjeuner, la saisie des PDR et la réconciliation Maker-Checker.
relatedTabs:
  - corrective_di
  - corrective_atelier
  - corrective_cloture
  - validation_center
  - stock
---

# 🛠️ Guide Utilisateur : Bons de Travail (BT) & Intervention Live

> **Module :** Maintenance Corrective  
> **Identifiants d'accès :** `#corrective_bt` et `#corrective_live`  
> **Onglets :** *Bons de Travail* & *Intervention en Direct (Live)*  
> **Public cible :** Techniciens d'atelier, Chefs d'équipe, Responsables Méthodes & Maintenance.

---

## 1. Rôle et Objectif

Le **Bon de Travail (BT)** formalise l'ordre d'exécution d'une tâche de maintenance corrective sur un équipement. Il trace :
- La machine ciblée et son historique d'intervention.
- Le diagnostic et les travaux prescrits.
- Les intervenants assignés.
- Le chronométrage précis du temps de dépannage (début, fin, pauses shifts).
- Les pièces de rechange (PDR) consommées et leur valorisation financière.

L'onglet **Intervention Live** (`#corrective_live`) fournit un tableau de bord en temps réel pour suivre les interventions en cours à l'atelier avec chronomètre actif.

---

## 2. Cycle Opérationnel d'un Bon de Travail

Tout BT traverse les phases suivantes conformément à la machine à états :

```text
[ Planifié ] ➔ [ En Cours ] ➔ [ En Attente PDR (si blocage) ] ➔ [ Réconciliation ] ➔ [ Clôturé ]
```

### Statuts et Significations (Distinction Sémantique `ATTENTE ATELIER` vs `ATTENTE PDR`)
- **BT Planifié :** Créé et attribué à un technicien, en attente de prise en charge physique.
- **En Cours :** Le technicien est activement sur la machine ou le chronomètre Live a été déclenché.
- **Attente Atelier (`ATTENTE ATELIER`) :** Le `BT` est mis en attente car un **Bon de Réalisation (`BR-YYYY-NNN`)**, un **Bon de Rectification (`RECT-YYYY-NNN`)** ou une **Sortie Externe** est en cours d'exécution à l'Atelier Fabrication Mécanique ou chez un sous-traitant.
- **Attente PDR (`ATTENTE PDR`) :** L'intervention est suspendue car une pièce de rechange magasin est en rupture de stock.
- **En Attente de Validation (Maker-Checker) :** L'intervention est physiquement terminée par le technicien ; les pièces et heures déclarées doivent être visées par le superviseur.
- **Clôturé :** Intervention finalisée, pièces déduites, coût calculé, machine remise à disposition de la production.

---

## 3. Prise en Main de l'Intervention Live (`#corrective_live`)

L'onglet Live permet un suivi dynamique des équipes sur le terrain :

1. **Démarrer une Intervention :**
   - Sélectionnez le BT concerné et cliquez sur **« Démarrer le Chrono »** (icône ▶️).
   - L'heure de début exacte est enregistrée.
2. **Gestion Automatique des Équipes & Horaires (Shifts Industriels) :**
   - **Équipe du Matin (08:00 – 13:15) :** Le chronomètre incrémente les minutes travaillées.
   - **Pause Déjeuner (13:15 – 14:00) :** Si l'intervention chevauche cette période, **45 minutes sont automatiquement neutralisées** du calcul du temps machine afin de ne pas pénaliser le MTTR de l'usine.
   - **Équipe de l'Après-Midi (14:00 – 17:00) :** Reprise normale du calcul.
   - **Hors Shift (Après 17:00, Nuits et Dimanches) :** Le calcul d'arrêt effectif est gelé jusqu'à la reprise de la prochaine période ouvrée.
3. **Mise en Pause / Attente PDR :**
   - Si un problème de pièce survient, cliquez sur **« Mettre en Attente PDR »**. Le compteur d'intervention active s'interrompt et la mention apparaît en orange clignotant.
4. **Finaliser le Travail Terrain :**
   - Cliquez sur **« Terminer l'Intervention »**. La durée totale réelle s'affiche et vous êtes redirigé vers la saisie du compte-rendu.

---

## 4. Déclaration Terrain : Pièces Consommées, Bon Atelier Mécanique (`BR / RECT`) & Sortie Externe

Lors de la saisie du rapport d'intervention dans `#corrective_live` :
1. **Nature de l'Intervention (Contrôle de cohérence `VAL-4`) :**
   - Choisissez la nature réelle du dépannage : *Remplacement PDR (`+PDR`)*, *Réparation*, *Réglage*, *Nettoyage*, *Diagnostic* ou **`Atelier / Rectif.`** (*Bon d’Atelier / Rectification / Externe*).
2. **Émission d'un Bon Atelier Mécanique Interne (`BR / RECT`) depuis l'Intervention Live :**
   - Cliquez sur le bouton ambre **« Bon atelier mécanique (BR / RECT) »**.
   - Sélectionnez la nature de la demande :
     - **`REALISATION`** : Confection / usinage d'une pièce mécanique neuve (`BR-YYYY-NNN`).
     - **`RECTIFICATION`** : Tournage, fraisage, alésage ou rectification d'une pièce existante (`RECT-YYYY-NNN`).
   - Saisissez la **quantité**, la **description technique des travaux** (obligatoire) et l'observation éventuelle, puis cliquez sur **« Émettre Bon Atelier & Mettre BT en Attente »**.
   - Le bon est immédiatement créé vers `Atelier Fabrication Mécanique` (sans aucun impact sur le stock PDR magasin), un Toast confirme son numéro, et le `BT` passe en **`ATTENTE ATELIER`** sans être clôturé.
   - Dès que l'atelier marque le bon **`PRET_LIVRAISON`**, un bouton **« Réceptionner Montage »** apparaît directement dans la carte du `BT` Live pour passer le bon à **`RECEPTIONNE_MONTAGE`** et débloquer la clôture du `BT`.
3. **Cas d'une Sous-Traitance Externe (`+ Sortie Externe / Bobinage`) :**
   - Pour un envoi externe (ex. bobinage moteur chez un prestataire), cliquez sur **« + Sortie Externe / Bobinage »** (`SORT-EXT-xxx`).
4. **Règle d'Or Anti-Clôture Prématurée :**
   - Tant qu'un Bon Atelier Mécanique (`EMIS`, `EN_COURS_FABRICATION`, `PRET_LIVRAISON`) ou un Bon Externe lié est actif, le système **verrouille la clôture définitive du BT**.
5. **Ajout des Pièces de Rechange (PDR) & Soumission :**
   - Sélectionnez les articles PDR consommés (avec mise en avant `★ BOM`).
   - **Technicien :** Cliquez sur **« Soumettre pour Validation Responsable »** (`PENDING_VALIDATION` sans déstockage immédiat).
   - **Administrateur / Responsable :** Clôture directe uniquement si aucun bon d'atelier n'est encore ouvert.

---

## 5. Validation Superviseur : Protocole Maker-Checker & Contrôle Atelier

Pour les chefs d'équipe et responsables maintenance dans l'onglet **Bons de Travail (`#corrective_bt`)** :

1. **Colonne `PDR & Atelier (Col L)` :** Affiche les pièces PDR ainsi que le badge **`Atelier: BR-2026-001 (EMIS)`** ou **`Atelier: RECT-2026-001 (EN_COURS_FABRICATION)`** en ambre tant que le bon est actif, et en indigo lorsqu'il est **`RECEPTIONNE_MONTAGE`**.
2. **Colonne `Statut & Validation` :** Distingue visuellement **`ATTENTE ATELIER`** (badge indigo avec icône clé) de **`ATTENTE PDR`** (badge ambre).
3. **Modale de Réconciliation (`Valider`) :**
   - Si un Bon d'Atelier Mécanique (`BR / RECT`) ou Externe lié au `BT` est encore actif, l'approbation (`APPROVED`) est bloquée avec un message explicite indiquant le code du bon en cours.
   - Une fois le bon réceptionné et monté (`RECEPTIONNE_MONTAGE`), l'approbation déduit les éventuelles PDR consommées et archive l'événement dans `AUDIT_EVENTS`.
