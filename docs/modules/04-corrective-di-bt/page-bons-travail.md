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

### Statuts et Significations
- **BT Planifié :** Créé et attribué à un technicien, en attente de prise en charge physique.
- **En Cours :** Le technicien est activement sur la machine ou le chronomètre Live a été déclenché.
- **En Attente PDR :** L'intervention est suspendue car une pièce nécessaire n'est pas disponible en stock magasin.
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

## 4. Déclaration des Pièces Consommées & Soumission Terrain

Lors de la fin des travaux :
1. Cliquez sur **« Saisir Rapport & Pièces »** sur le BT.
2. Décrivez le travail réalisé : diagnostic exact, cause première de la défaillance (usure normale, défaut de graissage, surchauffe, corps étranger...), et actions correctives menées.
3. **Ajout des Pièces de Rechange (PDR) :**
   - Sélectionnez l'article dans le catalogue du magasin (référence, désignation).
   - Indiquez la quantité physiquement montée sur la machine.
   - Le système affiche le stock disponible en magasin pour vérification.
4. Cliquez sur **« Soumettre pour Validation Superviseur »**.
   - Le BT passe au statut `PENDING_VALIDATION`.
   - **Règle de sécurité :** Le stock physique magasin **n'est pas encore débité**. Cela empêche toute erreur de saisie sur le terrain de fausser l'inventaire avant contrôle.

---

## 5. Validation Superviseur : Protocole Maker-Checker

Pour les chefs d'équipe et responsables maintenance :

1. Les BT nécessitant un visa apparaissent avec un badge d'avertissement **« À Valider »**.
2. Cliquez sur **« Examiner la Déclaration »** pour ouvrir la modale de réconciliation (`MakerCheckerReviewModal`).
3. Le superviseur examine :
   - Les heures déclarées vs la durée constatée.
   - Les références de pièces et quantités déclarées.
   - Si nécessaire, il peut corriger une quantité erronée ou retirer une pièce non justifiée.
4. Choix de décision :
   - **Approuver :** Les pièces sont définitivement déduites du stock magasin (`Sortie`), le coût global est ventilé, et un enregistrement immutable `VALIDATION_APPROVED` est consigné dans le journal d'audit.
   - **Demander Correction :** Le BT est renvoyé au technicien avec un commentaire explicatif pour réajustement.
