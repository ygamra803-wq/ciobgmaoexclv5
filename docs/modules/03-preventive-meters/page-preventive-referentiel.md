---
id: page-preventive-referentiel
groupId: 03-preventive-meters
groupTitle: Maintenance Préventive & Compteurs (Meter PM)
docType: page
audience: user
tabId: preventive_referentiel
title: Ingénierie & Référentiel Préventif
subtitle: Concepteur de plans (Calendrier / Compteur / Hybride), Fiches Guides Organes-PDR et Catalogue d'Actions AFNOR
summary: Guide opérationnel de la page secondaire d'ingénierie préventive : créer des plans récurrents sur mesure, définir les fiches guides par organe et administrer les codes d'actions normalisés (N, G, C, R, E).
relatedTabs:
  - preventive
  - blueprints
  - machines
  - stock
---

# Ingénierie & Référentiel Préventif (`Concepteur, Guides & Actions AFNOR`)

## 1. Rôle de cet Écran

Accessible depuis le menu latéral ou depuis le bouton **« Ingénierie & Référentiel »** du planning préventif, cet écran réunit les **3 ateliers de conception** réservés aux responsables maintenance et méthodes :

1. **Onglet 1 — `Concepteur de Plans` (`Plan Builder`)** : Générateur intelligent de plans préventifs complets pour une machine (en mode formulaire classique ou **Assistant Pas-à-Pas Wizard**).
2. **Onglet 2 — `Guide & PDR` (`Fiches Guides Organes`)** : Bibliothèque de modes opératoires par type d'organe avec liaison préalable aux pièces de rechange du magasin.
3. **Onglet 3 — `Catalogue Actions` (`Actions AFNOR`)** : Référentiel des codes d'intervention normalisés (`N`, `G`, `C`, `R`, `E`...).

---

## 2. Onglet 1 : Utiliser le `Concepteur de Plans` (`Plan Builder`)

Lorsque vous sélectionnez une **Machine Active** dans le Concepteur de Plans :
1. **Découverte Automatique Intelligente** :
   - Le système récupère automatiquement la **Zone réelle** de la machine (`id_zone_default`), son **Technicien titulaire**, son **Horomètre actuel** (`compteur_heures`) et la liste de ses **Organes montés** (depuis l'Entrepôt et le Blueprint).
   - Il pré-remplit une liste de tâches recommandées en croisant les organes de la machine avec vos **Fiches Guides**.
2. **Choix du Mode de Déclenchement (`Calendrier`, `Compteur` ou `Hybride`)** :
   - **`CALENDRIER`** : Déclenchement périodique classique (Hebdomadaire, Mensuel, Trimestriel...) à partir d'une semaine cible (`S1`..`S52`).
   - **`COMPTEUR`** : Déclenchement selon l'intervalle d'usage (ex. toutes les `500 Heures` ou `10 000 Cycles`) à partir de l'index actuel de la machine.
   - **`HYBRIDE`** : Déclenche l'alerte au premier des deux termes atteint (échéance calendaire **ou** seuil d'heures).
3. **Mode de Calcul de Récurrence (`FIXE` vs `GLISSANT`)** :
   - **`FIXE`** : Les échéances restent calées sur le calendrier initial même si une visite est réalisée avec quelques jours de décalage.
   - **`GLISSANT`** : La prochaine échéance est recalculée à partir de la date réelle de la dernière exécution.
4. Cliquez sur **« Générer le Plan & Injecter au Planning »** pour créer toutes les tâches en une seule opération.

---

## 3. Onglet 2 : Structurer les `Fiches Guides & PDR`

Une **Fiche Guide** standardise la manière d'entretenir un organe type (ex. *Broche Haute Fréquence*, *Groupe Hydraulique*, *Armoire Électrique*) :
- Associez à l'organe les **Actions AFNOR** pertinentes (ex. `N` Nettoyage + `G` Graissage + `C` Contrôle).
- Pour chaque action, précisez la **Consigne technique détaillée** et la **Durée standard estimée** (ex. `20 min`).
- Rattachez les **Pièces de Rechange (`PDR`)** du stock magasin habituellement consommées sur cet organe : elles seront proposées en priorité aux techniciens lors des interventions.

---

## 4. Onglet 3 : Administrer le `Catalogue des Actions AFNOR`

Ce catalogue définit les codes courts affichés dans toute la matrice annuelle :
- **`N` — Nettoyage** (soufflage, dégraissage, propreté filtre)
- **`G` — Graissage & Lubrification** (appoint d'huile, graissage roulements)
- **`C` — Contrôle & Inspection** (vérification jeu, tension, température, vibration)
- **`R` — Remplacement Systématique** (changement préventif courroie, filtre, joint)
- **`E` — Étalonnage & Réglage** (calibration capteur, alignement géométrique)

Vous pouvez enrichir ce catalogue avec vos propres codes métiers, couleurs et durées standards.
