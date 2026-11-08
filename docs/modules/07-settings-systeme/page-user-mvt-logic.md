---
id: page-user-mvt-logic
groupId: 07-settings-systeme
groupTitle: Paramètres Système, Sauvegardes & Registre d’Audit
docType: page
audience: user
tabId: settings_mvt_logic
title: Logique & Flux des Mouvements de Magasin
subtitle: Règle mathématique du stock, distinction entre les 5 flux et valorisation financière au PUMP
summary: Guide pédagogique et opérationnel sur la gestion des flux de pièces de rechange. Explique la règle de calcul automatique du stock actuel, la traçabilité des sorties machine et la valorisation PUMP.
relatedTabs:
  - stock
  - sortie
  - settings
---

# 📦 Guide Utilisateur : Logique & Flux des Mouvements (`#settings_mvt_logic`)

> **Module :** Paramètres Système & Audit  
> **Onglet :** *Logique & Flux Mouvements* dans Paramètres  
> **Public cible :** Magasiniers Industriels, Chefs d'Atelier, Contrôleurs d'Inventaire.

---

## 1. Comment est Calculé Votre Stock ?

Dans cette GMAO industrielle, vous ne modifiez jamais directement le chiffre du stock affiché sur l'écran. 

Le stock que vous voyez est calculé en permanence selon une formule mathématique rigoureuse :

$$\text{Stock Actuel} = \text{Stock Initial (Inventaire)} + \text{Toutes les Entrées} - \text{Toutes les Sorties}$$

### Pourquoi cette méthode ?
- **Zéro triche, Zéro perte inexpliquée :** Si un stock passe de 10 à 7 pièces, il existe obligatoirement 3 lignes de sortie tracées avec la date, l'heure, le nom du demandeur et la machine sur laquelle les pièces ont été montées.
- **Auditabilité totale :** Les commissaires aux comptes et auditeurs ISO peuvent remonter l'historique complet d'une pièce sur plusieurs années.

---

## 2. Les 5 Types de Mouvements du Quotidien

Dans l'atelier, chaque opération physique correspond à un type de mouvement précis :

1. 🟢 **Entrée Réception Fournisseur (PO) :** Arrivée d'un colis de pièces neuves commandées chez un fournisseur. Le stock augmente immédiatement et le prix moyen (PUMP) est actualisé.
2. 🔵 **Sortie Dépannage (Bon de Travail) :** Pièces prélevées par un technicien pour réparer une machine en panne. Le coût est rattaché à l'historique financier de la machine.
3. ⚡ **Sortie Rapide au Guichet :** Consommable courant remis immédiatement par le magasinier sans attendre l'ouverture d'un BT formel.
4. 🔄 **Retour au Magasin (Réintégration) :** Pièce sortie en surplus par précaution mais finalement non montée, remise en rayon en parfait état.
5. 🚚 **Sortie Externe (Bobinage / Sous-traitance) :** Moteur ou réducteur confié à un réparateur extérieur spécialisé.

---

## 3. Comprendre le Prix Moyen Pondéré (PUMP)

Le système valorise votre magasin au **Coût Moyen Unitaire Pondéré (PUMP)** :
- Si vous avez en rayon 2 roulements achetés à **1 000 DA**.
- Vous en recevez 2 nouveaux achetés à **1 200 DA** en raison d'une hausse tarifaire.
- Votre nouveau PUMP devient :
  $$\text{Nouveau PUMP} = \frac{(2 \times 1000) + (2 \times 1200)}{4} = \frac{2000 + 2400}{4} = 1 100 \text{ DA}$$
- Toutes les prochaines sorties seront facturées à ce prix moyen exact de **1 100 DA**, reflétant la juste valeur de vos actifs.
