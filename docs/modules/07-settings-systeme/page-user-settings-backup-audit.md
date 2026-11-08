---
id: page-user-settings-backup-audit
groupId: 07-settings-systeme
groupTitle: Paramètres Système, Sauvegardes & Registre d’Audit
docType: page
audience: user
tabId: settings_backup_audit
title: Sauvegardes & Registre d'Audit Institutionnel
subtitle: Sauvegardes complètes, restauration de sécurité et traçabilité inaltérable des opérations sensibles
summary: Guide d'utilisation pour les responsables d'usine et auditeurs de qualité. Explique la création de sauvegardes régulières, la consultation du journal d'audit (qui a fait quoi et quand) et la restauration après sinistre.
relatedTabs:
  - settings
  - validation_center
  - finance
---

# 🛡️ Guide Utilisateur : Sauvegardes & Registre d'Audit (`#settings_backup_audit`)

> **Module :** Paramètres Système & Audit  
> **Onglet :** *Logs d'Accès & Audit* dans Paramètres  
> **Public cible :** Directeurs d'Usine, Responsables Maintenance, Auditeurs Qualité ISO 9001 / ISO 55000.

---

## 1. Pourquoi ce Registre d'Audit est-il Essentiel ?

Dans un environnement industriel, la confiance et la traçabilité sont primordiales :
- Si un prix d'article a été réajusté ou si un stock initial a été modifié, **qui a validé cette opération et pourquoi ?**
- Si une machine critique a été archivée ou arrêtée, **à quelle heure exacte la décision a-t-elle été enregistrée ?**
- Si un sinistre informatique survient sur le serveur local, **comment restaurer l'intégralité de l'usine en moins de 2 minutes ?**

Cet écran centralise à la fois votre politique de **sauvegarde anti-sinistre** et votre **journal de traçabilité légale inaltérable**.

---

## 2. Sauvegarder et Sécuriser Votre Usine

### 2.1 Télécharger une Sauvegarde Instantanée
1. Cliquez sur **« Créer une Sauvegarde Complète »**.
2. Votre navigateur télécharge immédiatement un fichier sécurisé horodaté (ex. `GMAO_USINE_2026-11-07.json`).
3. Ce fichier contient l'intégralité de votre patrimoine : machines, stock, historiques d'interventions, plans préventifs et budgets.
4. **Recommandation d'Atelier :** Téléchargez une sauvegarde chaque vendredi en fin de journée et conservez-la sur un support externe sécurisé.

### 2.2 Restaurer l'Usine en Cas de Panne Matérielle
1. Si vous changez de PC serveur ou en cas de panne de disque dur, réinstallez l'application.
2. Rendez-vous sur cet onglet et cliquez sur **« Restaurer une Sauvegarde »**.
3. Choisissez votre dernier fichier `.json`.
4. En 30 secondes, toutes vos données d'usine sont restaurées à l'identique !

---

## 3. Consulter le Registre d'Audit des Opérations

Le tableau d'audit liste chronologiquement tous les événements sensibles avec une transparence totale :

- **Horodatage Exact (Date et Heure) :** Précis à la seconde près.
- **Auteur de l'Action :** Nom et rôle de l'utilisateur connecté (ex. `Karim Benali - Superviseur`).
- **Nature de l'Opération :**
  - 📦 *Ajustement de stock ou de prix*
  - ⚙️ *Archivage ou remise en service d'une machine*
  - ✅ *Validation d'un bon de travail ou sortie de pièces (Maker-Checker)*
  - 💰 *Modification du budget annuel de maintenance*
- **Comparaison Avant / Après :**
  - En cliquant sur une ligne, une fenêtre vous montre l'ancienne valeur en rouge et la nouvelle valeur en vert, avec le motif renseigné par l'auteur.
  - **Inviolabilité :** Aucun utilisateur, y compris l'administrateur, ne peut modifier ou supprimer une ligne d'audit existante.
