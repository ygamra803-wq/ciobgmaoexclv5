---
id: page-dev-mvt-logic
groupId: 07-settings-systeme
groupTitle: Paramètres Système, Sauvegardes & Registre d’Audit
docType: architecture
audience: developer
tabId: settings_mvt_logic
title: Spécification Technique — Moteur Mathématique des Mouvements de Stock
summary: Spécification formelle de l'invariant de stock, des 3 catégories canoniques, des 5 flux transactionnels et du moteur d'indexation incrémentale IncrementalStockIndex O(1).
relatedTabs:
  - settings_mvt_logic
  - stock
  - sortie
---

# 💻 Spécification Développeur : Moteur Mathématique des Mouvements (`#settings_mvt_logic`)

> **Public :** Développeurs Algorithmiques, Auditeurs Stock & Modèles IA.  
> **Composant source :** `src/presentation/pages/settings/components/SettingsMvtLogicTab.tsx`  
> **Moteurs mathématiques intouchables :** `src/application/IncrementalStockIndex.ts`, `src/domain/pdr/services/StockCalculationService.ts`.  
> **Invariant constitutionnel :** Section 1.3 de `AGENTS.md`.

---

## 1. L'Invariant Mathématique Absolu du Stock

Dans **CIOB GMAO Nexus v5.0.2**, le stock actuel n'est jamais un nombre saisi manuellement par un utilisateur. C'est le résultat d'une **équation déterministe non négociable** :

$$\text{stockActuel} = \text{stockInitial} + \sum \text{Entrées} - \sum \text{Sorties}$$

### Conséquences Architecturales Fondamentales :
1. **Interdiction de Mutation Directe :** Il est formellement interdit de modifier directement `stockActuel` lors d'un mouvement.
2. **Prévention de la Double Déduction :** Ne jamais combiner une modification manuelle de quantité avec l'émission simultanée d'une ligne de `Sortie`.
3. **Complexité $O(1)$ (`IncrementalStockIndex`) :**
   - Plutôt que de recalculer la somme de tous les mouvements à chaque lecture d'article ($O(M)$), l'index incrémental maintient un cache mémoire synchronisé $O(1)$ mis à jour uniquement par `onAddMouvement` ou `bulkReplace`.

---

## 2. Les 3 Catégories Canoniques & 5 Flux Transactionnels

Chaque mouvement enregistré dans `STORAGE_KEYS.MOUVEMENTS` appartient à l'une des 3 catégories physiques :

```text
┌────────────────────────────────────────────────────────┐
│             REGISTRE DES MOUVEMENTS (SSOT)             │
└────────────┬──────────────────┬──────────────────┬─────┘
             │                  │                  │
             ▼                  ▼                  ▼
    [ 1. ENTRÉE (+) ]    [ 2. SORTIE (-) ]   [ 3. INVENTAIRE (=) ]
      • Réception PO       • Sortie BT         • Régularisation
      • Retour machine     • Sortie Rapide       d'écart constatée
      • Avoir fournisseur  • Sortie Externe      en magasin
```

### Table des 5 Flux Métier Spécifiques

| Flux Métier | Catégorie | Signe | Destination / Machine | Règle Maker-Checker |
| :--- | :---: | :---: | :--- | :--- |
| **Sortie Interne Dépannage (BT)** | `Sortie` | `-` | Machine obligatoire (`id_machine`) | Soumis à validation superviseur si déclaré sur le terrain (`VAL-2`). |
| **Sortie Rapide au Guichet** | `Sortie` | `-` | Machine ou Service général | Déduction immédiate par le magasinier. |
| **Sortie Externe (Bobinage/Usinage)** | `Sortie` | `-` | Prestataire externe | Statut de suivi temporaire avec traçabilité d'envoi. |
| **Entrée Réception Commande (PO)** | `Entrée` | `+` | Magasin PDR (Rayon/Étagère) | Déclenche le recalcul du PUMP de l'article. |
| **Retour au Magasin (Réintégration)** | `Entrée` | `+` | Magasin PDR | Pièce propre démontée non utilisée remise en stock. |

---

## 3. Valorisation au Coût Moyen Unitaire Pondéré (PUMP)

Lors de chaque entrée fournisseur valorisée :
$$\text{PUMP}_{\text{nouveau}} = \frac{(\text{Stock Existant} \times \text{Ancien PUMP}) + (\text{Quantité Reçue} \times \text{Prix Achat})}{\text{Stock Existant} + \text{Quantité Reçue}}$$

Les sorties sont toujours valorisées au PUMP en vigueur au moment du mouvement, garantissant la cohérence comptable avec l'ERP d'entreprise.
