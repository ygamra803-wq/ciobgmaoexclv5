---
id: page-user-injection-excel
groupId: 07-settings-systeme
groupTitle: Paramètres Système, Sauvegardes & Registre d’Audit
docType: page
audience: user
tabId: settings_injection
title: Injection & Importation de Données Excel
subtitle: Importation rapide de vos listes de pièces, machines et historiques depuis vos anciens classeurs Excel
summary: Guide pas-à-pas pour intégrer vos fichiers Excel existants dans la GMAO. Explique le téléchargement des modèles vierges, la prévisualisation des erreurs avant validation et l'import sécurisé sans doublon.
relatedTabs:
  - stock
  - machines
  - settings
---

# 📊 Guide Utilisateur : Injection & Import Excel (`#settings_injection`)

> **Module :** Paramètres Système & Audit  
> **Onglet :** *Injection Données Excel* dans Paramètres  
> **Public cible :** Responsables Méthodes, Magasiniers, Chefs de Projet Déploiement.

---

## 1. Pourquoi Utiliser l'Import Excel ?

Lors de l'installation de la GMAO, vous possédez probablement déjà des listes d'articles, d'outils et de machines sous forme de classeurs Excel.

L'outil d'**Injection de Données** permet de charger en quelques secondes des milliers d'équipements et de pièces sans aucune saisie manuelle fastidieuse, tout en garantissant la propreté de la base grâce à un sas de contrôle préalable.

---

## 2. Procédure Pas-à-Pas pour Importer un Fichier

### Étape 1 : Télécharger le Modèle Vierge Officiel
1. Cliquez sur le bouton **« Télécharger Modèle Vierge Excel »**.
2. Vous obtenez un classeur structuré comportant les onglets prêts à l'emploi :
   - `STOCK_PDR` : Vos articles avec référence, désignation, stock initial et prix.
   - `PARC_MACHINES` : Vos machines avec code, nom, atelier et puissance.
   - `ZONES` : Vos ateliers et secteurs de production.

### Étape 2 : Remplir ou Copier Vos Données
- Copiez vos données existantes dans les colonnes correspondantes.
- Veillez à ce que chaque article et chaque machine possède un code unique (pas de doublons).

### Étape 3 : Glisser-Déposer & Prévisualisation (Dry-Run)
1. Glissez votre fichier Excel dans la zone de dépôt.
2. Le système analyse le fichier **sans encore rien enregistrer**.
3. Un rapport d'analyse s'affiche immédiatement :
   - 🟢 **Lignes Conformes (en vert) :** Données prêtes à être injectées.
   - 🟡 **Avertissements (en orange) :** Colonne optionnelle vide ou valeur par défaut appliquée.
   - 🔴 **Erreurs Bloquantes (en rouge) :** Code manquant ou format de date incorrect. La ligne exacte est signalée pour que vous puissiez corriger votre fichier.

### Étape 4 : Confirmer l'Importation Finale
- Une fois les erreurs corrigées, cliquez sur **« Valider et Injecter dans la GMAO »**.
- Vos pièces et machines apparaissent instantanément dans tous les modules de l'usine !
