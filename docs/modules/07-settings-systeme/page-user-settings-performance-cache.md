---
id: page-user-settings-performance-cache
groupId: 07-settings-systeme
groupTitle: Paramètres Système, Sauvegardes & Registre d’Audit
docType: page
audience: user
tabId: settings_performance
title: Performance, Rapidité & Cache Mémoire
subtitle: Contrôle de la fluidité de l'application, temps de réponse et optimisation de la mémoire cache
summary: Guide d'utilisation pour surveiller la vitesse d'affichage de la GMAO. Explique la lecture des indicateurs de réactivité (millisecondes), le rôle de la mémoire cache et la purge d'optimisation en un clic.
relatedTabs:
  - settings
  - dashboard
---

# ⚡ Guide Utilisateur : Performance & Vitesse d'Affichage (`#settings_performance`)

> **Module :** Paramètres Système & Audit  
> **Onglet :** *Performance & Cache* dans Paramètres  
> **Public cible :** Chefs d'Atelier, Administrateurs Système, Utilisateurs Quotidiens.

---

## 1. À Quoi Sert cet Écran ?

Dans une usine où des milliers de pièces et des dizaines de machines sont enregistrées, l'application doit rester **instantanée et ultra-fluide**, même sur de simples tablettes d'atelier ou des ordinateurs de bureau plus anciens.

Pour atteindre cette rapidité, la GMAO utilise un **système de mémoire accélérée (Cache Intelligent)** qui retient les calculs déjà effectués (par exemple, la valeur totale du stock ou les indicateurs MTTR/MTBF) pour ne pas avoir à tout recalculer à chaque changement d'écran.

Cet onglet vous permet de vérifier la vitesse de votre système et d'optimiser la mémoire en un seul clic.

---

## 2. Décryptage des Indicateurs de Vitesse

- 🚀 **Temps de Réponse Moyen (en millisecondes) :**
  - *Moins de 10 ms (Vert) :* Vitesse excellente. L'application répond à la vitesse de l'éclair.
  - *10 à 30 ms (Bleu) :* Vitesse normale et très confortable pour l'atelier.
  - *Plus de 50 ms (Orange) :* Ralentissement possible (souvent lié à une saturation de la mémoire du navigateur).
- 🎯 **Taux d'Efficacité du Cache (Cache Hit %) :**
  - Indique le pourcentage d'écrans qui s'affichent instantanément grâce à la mémoire accélérée (idéalement supérieur à **85%**).
- 📺 **Fluidité d'Affichage (Images par Seconde / FPS) :**
  - Mesure la fluidité des défilements de tableaux et des menus (la cible idéale est de 60 FPS).

---

## 3. Quand et Comment Purger le Cache ?

Dans 99% des cas, la mémoire cache se gère toute seule de manière transparente.

Toutefois, si vous constatez une légère lenteur après avoir importé un fichier Excel géant de plusieurs milliers de lignes :
1. Rendez-vous sur l'onglet **Performance & Cache**.
2. Cliquez sur le bouton vert **« Optimiser & Vider le Cache Mémoire »**.
3. **Rassurez-vous :** Cette opération ne supprime **aucune de vos données réelles** (vos machines, vos stocks et vos historiques restent intacts). Elle nettoie simplement les calculs temporaires.
4. L'application retrouve instantanément sa réactivité maximale !
