---
id: page-user-nexus
groupId: 06-pilotage-gouvernance
groupTitle: Pilotage, Finance & Gouvernance
docType: page
audience: user
tabId: nexus
title: Nexus — Nomenclature Réelle (As-Built) & Jumeaux Numériques
subtitle: Anatomie physique des machines, comparaison théorique/réel, duplication sur machines sœurs et actions directes
summary: Guide d'utilisation stratégique de Nexus. Explique l'exploration de la nomenclature réelle des machines de production, l'analyse des écarts avec le Blueprint d'ingénierie, la duplication en 1 clic vers les lignes jumelles et le déclenchement immédiat de dépannages ou remplacements de pièces.
relatedTabs:
  - dashboard
  - machines
  - validation_center
  - corrective_bt
---

# 🧬 Guide Utilisateur : Nexus — Nomenclature Réelle & Jumeaux Numériques (`#nexus`)

> **Module :** Pilotage & Gouvernance  
> **Identifiant d'accès :** `#nexus`  
> **Public cible :** Responsables Méthodes, Ingénieurs Fiabilité, Chefs d'Atelier, Chefs de Projets Travaux Neufs.

---

## 1. Qu'est-ce que l'Écran Nexus ?

Sur le terrain, une machine ne reste jamais figée dans son état de sortie d'usine. Au fil des années :
- Un moteur 4 kW d'origine Siemens est remplacé par un moteur équivalent ABB lors d'un dépannage urgent de nuit.
- Une pompe centrifuge subit une modification de turbine pour augmenter le débit.
- Des capteurs photoélectriques supplémentaires sont ajoutés pour fiabiliser la détection produit.

L'écran **Nexus** est la **carte d'identité anatomique vivante (As-Built)** de chaque équipement de votre usine. Il montre exactement ce qui est **réellement monté** sur la machine aujourd'hui, avec les numéros de série, les dates d'installation et l'usure de chaque organe.

---

## 2. Décryptage de l'Interface Nexus

L'écran s'articule autour de 3 zones ergonomiques :

1. **Sélecteur de Machine Active (Volet Gauche) :**
   - Liste ordonnée de toutes vos machines de production actives.
   - Recherche rapide par nom, code machine ou atelier.
2. **Fiche d'Identité & Passeport Machine (En-tête) :**
   - Implantation géographique (Zone), famille d'appartenance, modèle constructeur, et technicien référent.
   - Lien direct vers le Blueprint théorique d'ingénierie.
3. **Arborescence Réelle des Composants (Corps Central) :**
   - Liste hiérarchique détaillée de tous les organes (moteurs, réducteurs, vérins) et pièces mécaniques montés.
   - Colonnes : Référence, Désignation, Type, Quantité montée, Criticité, Durée de vie estimée (heures), Heures cumulées réelles, et Statut opérationnel.

---

## 3. Analyse des Écarts : Réel vs Théorie (Bouton « Écarts Blueprint »)

En haut à droite de l'arborescence, le bouton **« Analyser Écarts Blueprint »** compare ce qui est installé sur la machine avec le modèle théorique préconisé par le bureau des méthodes :
- 🟢 **Composants Conformes :** Pièces montées 100% conformes au plan d'origine.
- 🟡 **Pièces Manquantes :** Éléments prévus sur le plan mais non encore déclarés à l'atelier.
- 🟠 **Substitutions Détectées :** Avertissement signalant qu'une référence alternative a été installée lors d'un dépannage d'urgence (permet de décider si la substitution doit être pérennisée dans le plan de maintenance).

---

## 4. Dupliquer la Nomenclature vers les Lignes Jumelles en 1 Clic

Si votre usine possède plusieurs machines identiques (par exemple 3 lignes d'extrusion ou 2 presses à injecter sœurs) :
1. Configurez soigneusement la liste complète des composants sur la première machine.
2. Cliquez sur le bouton d'action **« Dupliquer vers Machines Jumelles »**.
3. Le système détecte automatiquement toutes les autres machines de la même famille.
4. En validant, la structure complète est clonée sur les autres machines, vous évitant de ressaisir 50 composants à la main !

---

## 5. Passerelles d'Action Immédiate depuis un Composant

En cliquant sur la ligne d'un composant de la nomenclature, vous disposez d'actions instantanées :
- ⚡ **Remplacer la Pièce au Magasin :** Ouvre directement le bon de sortie rapide avec la référence de la pièce et le code de la machine pré-remplis.
- 🔧 **Créer un Bon de Travail Curatif :** Déclenche un ordre de réparation ciblant précisément ce composant défaillant.
- 📅 **Créer une Tâche Préventive :** Programme une visite systématique (graissage, contrôle vibration) rattachée à cet élément.
- 📊 **Exporter la Nomenclature Excel :** Télécharge l'arbre As-Built complet pour vos dossiers techniques ou audits clients.
