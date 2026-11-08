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

## 4. Déclaration Terrain : Pièces Consommées & Bons d'Atelier / Rectification

Lors de la saisie du rapport d'intervention (en mode **Formulaire Classique** ou **Assistant Wizard 3 Étapes**) :
1. **Nature de l'Intervention (Contrôle de cohérence `VAL-4`) :**
   - Choisissez la nature réelle du dépannage : *Remplacement PDR (`+PDR`)*, *Réparation*, *Réglage*, *Nettoyage*, *Diagnostic* ou **`Atelier / Rectif.`** (*Bon d’Atelier / Rectification / Externe*).
2. **Cas d'un Usinage / Rectification Atelier ou Bobinage Externe (`Atelier / Rectif.`) :**
   - Lorsque la pièce ou l'organe défaillant doit être rectifié à l'atelier mécanique interne (**`BON-ATEL-xxx`** : *Usinage, Tournage d'arbre, Soudure/Rechargement, Confection sur mesure*) ou envoyé en sous-traitance externe (**`SORT-EXT-xxx`** : *Bobinage moteur, Réparation variateur*), un panneau dédié **« Bon d’Atelier / Rectification & Sous-Traitance lié au BT »** s'ouvre directement dans l'écran Live.
   - Vous pouvez créer et lier le bon en 1 clic sans quitter l'intervention, et cocher **« Suspendre automatiquement le BT en EN_ATTENTE_PDR après création du bon »**.
   - **Règle d'Or Anti-Clôture Prématurée :** Tant que le Bon d'Atelier ou Externe lié n'est pas terminé et réceptionné (**`Retourné OK`** ou **`Monté`**), le système **empêche la clôture définitive du BT** afin que les délais d'atelier et les coûts d'usinage/bobinage ne soient jamais oubliés.
3. **Ajout des Pièces de Rechange (PDR) :**
   - Sélectionnez l'article dans le catalogue du magasin (avec mise en avant automatique `★ BOM` des pièces recommandées pour cette machine).
   - Indiquez la quantité physiquement montée et ajoutez une ou plusieurs références.
4. **Soumission ou Clôture :**
   - **Technicien :** Cliquez sur **« Soumettre pour Validation Responsable »**. Le BT passe au statut `PENDING_VALIDATION` sans débiter le stock physique immédiatement.
   - **Administrateur / Responsable :** Si aucun Bon d'Atelier n'est encore ouvert, l'intervention est validée et clôturée directement avec calcul automatique du coût global ($\text{Coût Total} = \text{Coût PDR} + \text{Coût Atelier}$).

---

## 5. Validation Superviseur : Protocole Maker-Checker & Réception Atelier

Pour les chefs d'équipe et responsables maintenance dans l'onglet **Bons de Travail (`#corrective_bt`)** :

1. La colonne **`PDR & Atelier (Col L)`** affiche à la fois les pièces PDR et le badge du **Bon d'Atelier / Externe** lié (ex. `BON-ATEL-001 • 450 DH`), en orange s'il est encore en cours ou en indigo s'il est réceptionné.
2. Cliquez sur **« Contrôler & Valider »** sur un BT en attente pour ouvrir la modale de réconciliation (`MakerCheckerReviewModal`).
3. Le superviseur examine :
   - Les alertes automatiques de concordance **V4** (stock disponible, doublon de bon magasin).
   - Les pièces de rechange proposées et leurs quantités.
   - Les **Bons d'Atelier / Externe associés** : si un bon d'atelier vient d'être terminé, le superviseur peut cliquer directement sur **« Réceptionner OK »** dans la modale pour valider son retour et débloquer l'approbation du BT.
4. Choix de décision :
   - **Approuver & Clôturer :** Les pièces sont définitivement déduites du stock magasin (`Sortie`), le coût d'atelier (`cout_atelier`) est consolidé avec le coût PDR (`cout_pdr`) dans `cout_total`, et un enregistrement immuable est consigné dans le journal d'audit.
   - **Demander Clarification / Rejeter :** Le BT est renvoyé au technicien avec une note explicative sans aucun impact sur le stock.
