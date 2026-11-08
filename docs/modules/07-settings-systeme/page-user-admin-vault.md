---
id: page-user-settings-admin-vault
groupId: 07-settings-systeme
groupTitle: Paramètres Système, Sauvegardes & Registre d’Audit
docType: page
audience: user
tabId: settings_admin
title: Compte Administrateur & Coffre-Fort Sécurisé
subtitle: Gestion du profil Administrateur Maître, configuration du Master PIN et déverrouillage du coffre
summary: Guide d'utilisation pour le responsable informatique et l'administrateur principal de l'usine. Explique la création du Master PIN, le déverrouillage du coffre-fort numérique et la protection contre le piratage.
relatedTabs:
  - settings
  - utilisateurs
---

# 🔐 Guide Utilisateur : Compte Admin & Coffre-Fort (`#settings_admin`)

> **Module :** Paramètres Système & Audit  
> **Onglet :** *Compte Admin* dans Paramètres  
> **Public cible :** Administrateurs Principaux, Directeurs Techniques, Responsables Sécurité Informatique.

---

## 1. Rôle du Compte Administrateur Maître

Dans toute usine de production, certaines décisions relèvent exclusivement du niveau de direction :
- Réinitialiser l'ensemble des données d'un atelier.
- Modifier directement le budget annuel de maintenance.
- Restaurer une ancienne sauvegarde suite à un sinistre.

Pour autoriser ces actions critiques sans risquer qu'un opérateur ou une personne non habilitée n'y accède, l'application est protégée par un **Compte Administrateur Maître** doté d'un **Coffre-Fort Numérique**.

---

## 2. Le Master PIN : Clé de Votre Coffre-Fort

Le **Master PIN** est un code secret numérique (minimum 4 chiffres) connu uniquement du responsable principal de l'usine :
- **À quoi sert-il ?** Il permet de déverrouiller l'accès aux fonctions avancées de gestion de l'usine.
- **Protection Militaire :** Le système utilise un algorithme de chiffrement bancaire (AES 256 bits). Même si quelqu'un copiait les fichiers de votre ordinateur, il lui serait impossible de lire les informations protégées sans votre code PIN.

---

## 3. Procédure Pas-à-Pas pour Configurer le Master PIN

Lors du premier démarrage de l'application :
1. Rendez-vous sur l'onglet **Compte Admin**.
2. Le système indique que le coffre-fort n'est pas encore initialisé.
3. Saisissez votre nouveau **Master PIN** (ex. `8421`) puis confirmez-le dans la deuxième case.
4. Cliquez sur **« Initialiser le Coffre-Fort »**.
5. Votre code est immédiatement activé et sécurisé.
6. **Mémorisez-le précieusement :** En cas d'oubli total de ce code, la seule manière de réinitialiser le système consistera à purger l'usine pour des raisons strictes de sécurité industrielle.

---

## 4. Déverrouillage et Verrouillage Automatique

- **Déverrouiller le Coffre :** Lorsque vous accédez aux paramètres avancés, une fenêtre vous invite à saisir votre PIN. Une fois validé, l'icône de cadenas passe au vert et vous pouvez travailler.
- **Verrouillage Automatique :** Dès que vous quittez l'écran des paramètres ou que vous fermez votre navigateur, le coffre-fort se reverrouille instantanément pour empêcher toute manipulation par un tiers.
- **Protection Anti-Intrusion :** Si quelqu'un saisit 5 mauvais codes PIN d'affilée, le compte est automatiquement verrouillé pendant 15 minutes.
