---
id: page-arborescence-nexus
groupId: 02-parc-machines
groupTitle: Parc Machines, Blueprints & Architecture 3-Tiers
docType: page
audience: user
tabId: nexus
title: Arborescence & Nomenclature Réelle (Nexus BOM)
subtitle: Registre « As-Built » des organes, pièces et PDR réellement montés sur chaque machine de production
summary: Guide opérationnel de l'écran Nexus : piloter la nomenclature réelle montée sur machine, comparer l'écart avec le Blueprint théorique (Gap Analysis), dupliquer un BOM entre machines jumelles et lancer des actions (Sortie PDR, DI, Préventif) en 1 clic.
relatedTabs:
  - machines
  - blueprints
  - sortie
  - corrective_di
  - preventive
---

# Arborescence & Nomenclature Réelle (`Nexus BOM As-Built`)

## 1. Rôle de cet Écran

Alors que le **Blueprint** décrit la machine *telle qu'elle a été conçue sur le papier*, l'écran **Arborescence Nexus** représente la machine **telle qu'elle est réellement montée aujourd'hui dans l'atelier (`As-Built`)**.

Pour la machine de production sélectionnée dans la colonne de gauche, **Nexus** unifie automatiquement deux sources :
1. **Le Registre des Éléments Montés (`BOM Ledger`)** : Les composants (`COMPONENT`), pièces (`PART`) et pièces de rechange (`PDR`) déclarés sur cette machine avec leur durée de vie estimée en heures et leur date d'installation.
2. **Les Organes de l'Entrepôt Montés (`MONTE`)** : Tout moteur, réducteur ou pompe sorti de l'**Entrepôt Organes** et affecté à cette machine apparaît automatiquement dans son arbre Nexus.

---

## 2. Les 4 Opérations Clés dans `Nexus`

### A. Visualiser l'Arbre Parent $\rightarrow$ Enfant & la Santé de Stock PDR
- Sélectionnez une machine de production active dans la liste de gauche.
- Les éléments s'affichent par niveau : **Organes / Sous-ensembles parents** (`COMPONENT` / `PART`) puis les **Pièces d'usure (`PDR`)** qui y sont rattachées.
- Pour chaque référence `PDR`, Nexus vérifie en direct le **Stock Articles** et affiche un badge :
  - **Vert (`En Stock`)** : La pièce de rechange est disponible en magasin en cas de panne.
  - **Orange / Rouge (`Sous Seuil` / `Rupture 0`)** : Attention, si cet élément casse sur la machine, le magasin n'a plus la pièce en stock !

### B. Comparer le Réel avec le Blueprint Théorique (`Analyse d'Écart / Gap Analysis`)
Si la machine possède un **Blueprint** associé :
1. Cliquez sur le bouton **« Comparer avec Blueprint (Gap Analysis) »**.
2. Une fenêtre compare ligne par ligne les éléments théoriques du Blueprint avec les éléments réellement présents sur la machine.
3. Cliquez sur **« Importer les Éléments Manquants du Blueprint »** pour initialiser ou compléter instantanément la nomenclature réelle de votre machine sans tout ressaisir à la main.

### C. Dupliquer la Nomenclature vers les Machines Jumelles (`Dupliquer BOM`)
Lorsque vous avez terminé de structurer parfaitement la nomenclature d'une première machine (ex. `RCF100-01`) :
- Cliquez sur **« Dupliquer vers Jumelles »** pour copier automatiquement toute cette nomenclature vers les autres machines actives partageant le même **Template** (`RCF100-02`, `RCF100-03`...).

### D. Actions Opérationnelles en 1 Clic depuis un Élément de la Machine
Sur chaque élément ou organe affiché dans Nexus, vous disposez de 3 boutons d'intervention directe :
1. **Remplacer / Sortie Rapide (`Sortie PDR`)** : Ouvre le guichet **Sortie & Entrée Rapide** avec la machine et la référence PDR déjà pré-remplies.
2. **Signaler une Panne (`Créer DI Corrective`)** : Génère immédiatement une **Demande d'Intervention Corrective** ciblée sur cette machine et cet organe précis.
3. **Programmer un Entretien (`Créer Gamme PM`)** : Ajoute une tâche de maintenance préventive dédiée à cet organe dans le planning de la machine.
