---
id: page-user-settings-currency-finance
groupId: 07-settings-systeme
groupTitle: Paramètres Système, Sauvegardes & Registre d’Audit
docType: page
audience: user
tabId: settings_currency
title: Devises, Taux de Change & Finance
subtitle: Choix de la devise de travail principale (DA, MAD, EUR, USD) et paramétrage des parités d'importation
summary: Guide d'utilisation pour configurer la monnaie officielle de votre usine. Explique la sélection de la devise principale, la saisie des taux de conversion pour les pièces importées et l'affichage des rapports financiers.
relatedTabs:
  - finance
  - stock
  - settings
---

# 💱 Guide Utilisateur : Devises & Taux de Change (`#settings_currency`)

> **Module :** Paramètres Système & Audit  
> **Onglet :** *Devise & Finance* dans Paramètres  
> **Public cible :** Responsables des Achats, Directeurs Financiers, Contrôleurs de Gestion.

---

## 1. Pourquoi Configurer Votre Devise ?

Dans beaucoup d'usines de production :
- Les salaires et les budgets d'atelier sont libellés dans la monnaie locale (ex. Dinar Algérien `DA` ou Dirham Marocain `MAD`).
- Certaines pièces de rechange stratégiques (cartes électroniques Siemens, réducteurs SEW) sont importées d'Europe ou des États-Unis et facturées en **Euros (`EUR`)** ou en **Dollars (`USD`)**.

Le module **Devise & Finance** vous permet de travailler dans votre monnaie habituelle tout en intégrant facilement les pièces achetées à l'étranger au juste coût.

---

## 2. Définir Votre Devise Principale d'Usine

1. Dans la liste déroulante **« Devise Principale de Référence »**, sélectionnez la monnaie officielle de votre usine :
   - 🇩🇿 **DA / DZD :** Dinar Algérien.
   - 🇲🇦 **MAD :** Dirham Marocain.
   - 🇪🇺 **EUR (€) :** Euro.
   - 🇺🇸 **USD ($) :** Dollar Américain.
2. Cliquez sur **« Enregistrer la Devise »**.
3. À partir de cet instant, tous vos tableaux de bord, valeurs de stocks et coûts de bons de travail s'affichent avec le symbole monétaire choisi.

---

## 3. Paramétrer les Taux de Change pour les Pièces Importées

Lorsque vous commandez des pièces en devises étrangères :
1. Dans le tableau des parités, repérez la ligne correspondant à la devise (ex. `1 EUR = X DA`).
2. Saisissez le taux de change douanier ou bancaire en vigueur (ex. `1 EUR = 145.50 DA`).
3. Cliquez sur **« Mettre à Jour le Taux »**.
4. **Calcul Automatique :** Lorsque vous réceptionnerez une commande facturée en Euros, le magasin calculera automatiquement la valeur équivalente dans votre monnaie d'usine, sans aucun risque d'erreur de conversion manuelle !
