---
id: page-user-settings-json-editor
groupId: 07-settings-systeme
groupTitle: Paramètres Système, Sauvegardes & Registre d’Audit
docType: page
audience: user
tabId: settings_json_editor
title: Éditeur de Base JSON (Mode Expert)
subtitle: Visualisation directe des données brutes, export d'échantillons et maintenance avancée
summary: Guide d'utilisation destiné aux administrateurs experts et informaticiens. Explique la consultation de l'arborescence brute des données, la recherche textuelle d'enregistrements et les précautions de modification directe.
relatedTabs:
  - settings
  - settings_backup_audit
---

# 💻 Guide Utilisateur : Éditeur de Base JSON (`#settings_json_editor`)

> **Module :** Paramètres Système & Audit  
> **Onglet :** *Base JSON* dans Paramètres  
> **Public cible :** Administrateurs Système, Responsables Informatiques, Experts GMAO.  
> ⚠️ **Avertissement de Sécurité :** Cet écran est un outil de maintenance avancée. Les modifications directes impactent l'ensemble de la base de données.

---

## 1. Pourquoi un Éditeur de Données Brutes ?

Dans les systèmes informatiques d'usine, il est parfois indispensable de visualiser l'état exact des données enregistrées sans passer par les formulaires classiques :
- Vérifier la structure exacte d'une fiche machine ou d'un mouvement.
- Rechercher rapidement une valeur technique particulière à l'aide de la recherche textuelle intégrée (`Ctrl+F`).
- Copier une portion de texte pour la transmettre au support technique en cas de diagnostic particulier.

---

## 2. Navigation et Recherche dans la Base JSON

L'écran présente l'ensemble de la base sous forme de code structuré et coloré :
- Les grandes tables apparaissent comme des blocs dépliables :
  - `"machines": [ ... ]` : L'ensemble de vos machines enregistrées.
  - `"stockItems": [ ... ]` : L'intégralité du magasin de pièces de rechange.
  - `"mouvements": [ ... ]` : L'historique complet des entrées et sorties.
  - `"zones": [ ... ]` : Les ateliers et secteurs d'usine.
- **Barre d'Outils Supérieure :**
  - **Bouton Copier (Presse-papier) :** Copie l'intégralité du texte en un clic.
  - **Bouton Télécharger JSON :** Exporte immédiatement le fichier brut sur votre ordinateur.
  - **Bouton Formater / Indenter :** Réaligne automatiquement le texte pour une lisibilité parfaite.

---

## 3. Précautions et Règles de Modification

Si vous devez effectuer une modification d'urgence :
1. **Faites toujours une sauvegarde préalable** via l'onglet *Sauvegardes* avant de toucher au texte brut.
2. Modifiez uniquement la valeur souhaitée (ex. corriger une faute d'orthographe dans une désignation).
3. Ne supprimez pas les guillemets `"`, les virgules `,` ou les crochets `[` entourant les données.
4. Cliquez sur **« Enregistrer les Modifications »** : le système vérifie immédiatement la validité du format avant d'appliquer le changement. Si une erreur de syntaxe est présente, le système refuse l'enregistrement et pointe la ligne fautive.
