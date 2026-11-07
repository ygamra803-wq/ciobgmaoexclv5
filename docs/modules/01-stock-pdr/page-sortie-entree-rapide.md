---
id: page-sortie-entree-rapide
groupId: 01-stock-pdr
groupTitle: Stock PDR, Mouvements & Commandes (PO)
docType: page
audience: user
tabId: sortie
title: Sortie & Entrée Rapide (Guichet Magasin)
subtitle: Saisie des 5 flux magasin, Demandes de Sortie Terrain, Bons de Sortie Externes et Mode Assistant
summary: Guide opérationnel du guichet magasin pour enregistrer les sorties machines, entrées fournisseurs, retours chantier, démontages et traiter les demandes des techniciens.
relatedTabs:
  - stock
  - machines
  - validation_center
---

# Sortie & Entrée Rapide (`Guichet Magasin & Flux PDR`)

## 1. Rôle de cet Écran

L'écran **Sortie & Entrée Rapide** est le guichet quotidien du magasinier et des équipes de maintenance. Il centralise en un seul espace :
1. **La Saisie Directe des 5 Flux de Magasin** (`Sortie`, `Consommation`, `Entrée`, `Retour`, `Démontage`).
2. **Les Demandes de Sortie Terrain (`Demandes PDR`)** émises par les techniciens ou opérateurs avant le retrait physique des pièces.
3. **Les Bons de Sortie Externes (`Réparation / Usinage Externe`)** pour suivre les organes ou pièces envoyés chez un sous-traitant externe avec date de retour prévue.
4. **Le Journal Complet & Filtrable des Mouvements** avec impression de bons et export Excel.

---

## 2. Choisir votre Mode d'Affichage (Barre Supérieure)

Selon votre poste de travail (écran PC du magasin ou tablette en atelier), vous disposez de 3 modes d'affichage commutables en 1 clic :
- **Vue Scindée (`Split View`)** : Affiche le formulaire de saisie à gauche et le journal des mouvements en direct à droite (idéal sur grand écran).
- **Mode Plein Écran (`Formulaire` ou `Journal`)** : Déploie toute la largeur pour consulter confortablement de grands tableaux d'historique.
- **Mode Assistant (`Wizard Pas-à-Pas`)** : Guide l'utilisateur étape par étape (1. Nature du flux $\rightarrow$ 2. Choix de l'article $\rightarrow$ 3. Machine & Technicien $\rightarrow$ 4. Validation) avec contrôle visuel immédiat du stock restant.

---

## 3. Les 5 Flux de Stock Expliqués Simplement

| Flux | Effet sur le Stock | Quand l'utiliser ? | Champs Requis |
| :--- | :---: | :--- | :--- |
| **1. `Sortie` (Pièce Machine)** | **$-$ Diminue** | Remplacement d'une pièce détachée sur une machine identifiée lors d'un dépannage ou entretien. | Article, Quantité, **Machine Active**, Zone, Technicien. |
| **2. `Consommation` (Atelier)** | **$-$ Diminue** | Produits consommables généraux (graisse, chiffons, disques à meuler, visserie standard) non liés à une seule machine. | Article, Quantité, Zone / Atelier, Demandeur. |
| **3. `Entrée` (Réception Neuve)** | **$+$ Augmente** | Arrivage fournisseur hors commande PO ou réajustement positif sur bon de livraison. | Article, Quantité, Motif / N° BL. |
| **4. `Retour` (Pièce Non Utilisée)** | **$+$ Augmente** | Un technicien avait sorti 2 roulements pour une panne mais n'en a monté qu'un seul et rapporte le second neuf au magasin. | Article, Quantité, Machine d'origine, Technicien rapporteur. |
| **5. `Démontage` (Récupération)** | **$+$ Augmente** | Une pièce ou un sous-ensemble récupéré en bon état sur une machine est remis en stock magasin. | Article, Quantité, Machine déposée, Technicien démonteur. |

---

## 4. Circuit « Demandeur Terrain » vs « Magasinier Intervenant »

Pour éviter que les techniciens ne prélèvent des pièces sans trace ou lorsque le magasin est fermé :

### A. Côté Technicien (`Créer une Demande de Sortie Terrain`)
1. Basculez sur l'onglet **« Demandes de Sortie Terrain »** ou sélectionnez le profil **Demandeur**.
2. Choisissez la **Machine**, l'**Urgence** (`Normale`, `Haute`, `Critique`) et ajoutez la liste des articles PDR souhaités.
3. Dès l'enregistrement :
   - La demande reçoit un numéro **`DEM-XXXX`** au statut **`En attente`**.
   - Les quantités demandées sont immédiatement **réservées** dans le stock (visibles sous le badge *Réservé Maker-Checker*), sans débiter le stock physique tant que les pièces n'ont pas été remises.

### B. Côté Magasinier / Responsable (`Servir & Valider la Demande`)
1. Dans la file des **Demandes de Sortie Terrain**, repérez la demande en attente.
2. Cliquez sur **« Servir / Valider »** :
   - Le système vérifie automatiquement que le stock physique est suffisant pour chaque ligne.
   - Il génère en une seule opération tous les mouvements de **`Sortie`** rattachés à la machine et clôture la demande au statut **`Servie / Approuvée`**.

---

## 5. Bons de Sortie Externes (Sous-Traitance & Réparation)

Lorsqu'un moteur, une pompe ou un vérin quitte l'usine pour être rebobiné ou usiné chez un prestataire externe :
1. Ouvrez l'onglet **« Bons de Sortie Externes »**.
2. Renseignez le **Prestataire / Atelier Externe**, la **Machine d'origine**, la **Date de Retour Estimée** et la désignation de l'organe envoyé.
3. Suivez les bons en retard (badge rouge) et validez le **Retour Usine** dès que le sous-traitant restitue l'équipement.

---

## 6. Points de Vigilance & Sécurité Opérationnelle

- **Protection Anti-Stock Négatif** : Le système bloque toute **`Sortie`** ou **`Consommation`** dont la quantité dépasse le **Stock Actuel** en magasin. Si un article affiche `0`, enregistrez d'abord la réception (`Entrée`) avant de saisir la sortie.
- **Machines Archivées Filtrées** : Seules les machines **actives** du parc apparaissent dans les listes de saisie afin d'empêcher toute imputation de coût sur un équipement réformé ou archivé.
