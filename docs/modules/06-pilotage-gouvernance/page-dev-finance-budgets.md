---
id: page-dev-finance-budgets
groupId: 06-pilotage-gouvernance
groupTitle: Pilotage, Finance, Validation Maker-Checker & Système
docType: architecture
audience: developer
tabId: finance
title: Spécification Technique — Pilotage des Coûts & Budgets (FIN-P0/P1/P2)
summary: Architecture financière de la maintenance. Principe Field Claim ≠ Coût Validé ≠ Écriture ERP, entité FiscalBudgetConfig, ventilation tripartite des coûts, algorithmes de calcul du TCO par équipement et traçabilité budgetChangeLog.
relatedTabs:
  - finance
  - dashboard
  - settings
---

# 💻 Spécification Développeur : Coûts, Budgets & TCO (`#finance`)

> **Public :** Développeurs Core, Architectes Systèmes & Auditeurs Comptables.  
> **Composant source :** `src/presentation/pages/finance/FinanceView.tsx`  
> **Service de calcul :** `src/application/services/FinancialCalculationService.ts`  
> **Modèle de données :** `src/domain/finance/entities/FinancialBudget.ts`  
> **Clés SSOT :** `STORAGE_KEYS.BUDGET_ANNUAL`, `STORAGE_KEYS.AUDIT_EVENTS`.

---

## 1. Principe Directeur : Découplage Terrain vs Comptabilité

Dans une GMAO industrielle rigoureuse, les déclarations d'atelier ne constituent pas directement des écritures comptables. Le système formalise une étanchéité en trois couches :

```text
1. DÉCLARATION TERRAIN (Field Claim)
   └── Saisie par le technicien lors du dépannage (pièces + heures).
       Statut: PENDING_VALIDATION.

2. COÛT VALIDÉ GMAO (Operational Validated Cost)
   └── Approuvé par le superviseur dans ValidationCenterView.
       Valorisé au Coût Moyen PUMP pour les pièces et au Taux Horaire MO.
       Forme la base de calcul du TCO machine et de la consommation budgétaire.

3. ÉCRITURE COMPTABLE GÉNÉRALE (ERP Integration)
   └── Flux exporté vers l'ERP / Finance d'entreprise (SAP, Odoo, Sage)
       via les rapports Excel formatés (FinancialExportService.ts).
```

---

## 2. Modèle de Données : `FiscalBudgetConfig`

La configuration budgétaire annuelle réside sous `STORAGE_KEYS.BUDGET_ANNUAL` :

```typescript
export interface FiscalBudgetConfig {
  year: number;                    // Année fiscale (ex. 2026)
  annualBudget: number;            // Dotation annuelle globale (DA)
  monthlyAllocations: number[];    // Tableau de 12 montants mensuels [M1..M12]
  burnWarningPercent: number;      // Seuil d'alerte de surconsommation (ex. 80%)
  hourlyRateMO: number;            // Taux horaire moyen standard de la main-d'œuvre
  currency: string;                // Devise d'affichage (ex. 'DA', 'EUR', 'USD')
  budgetChangeLog: BudgetLog[];    // Registre d'audit des 5 dernières modifications
}
```

---

## 3. Formules Mathématiques du Coût & TCO Machine

### 3.1 Décomposition Tripartite du Coût Curatif ($C_{\text{curatif}}$)
$$C_{\text{curatif}} = C_{\text{MO}} + C_{\text{PDR}} + C_{\text{ext}}$$

Où :
- $C_{\text{MO}} = \sum \text{Heures Travaillées Validées} \times \text{Taux Horaire MO}$
- $C_{\text{PDR}} = \sum_{j \in \text{Pièces Validées}} \left( \text{Quantité}_j \times \text{PUMP}_j \right)$
- $C_{\text{ext}} = \sum \text{Factures Réparations Externes / Rebobinage}$

### 3.2 Coût Total de Possession Machine (TCO Machine)
$$\text{TCO}_{\text{machine}} = \text{Prix d'Acquisition Initial} + \sum C_{\text{curatif}} + \sum C_{\text{préventif}} + \sum C_{\text{amélioratif}}$$

### 3.3 Indicateur BER (Beyond Economical Repair / Seuil d'Obsolescence)
$$\text{Ratio BER} = \frac{\sum_{\text{Année N}} \text{Coûts de Maintenance Machine}}{\text{Valeur à Neuf de Remplacement}} \times 100\%$$
- **Alerte :** Si le Ratio BER dépasse 60%, le passeport santé de la machine bascule au statut d'avertissement économique pour recommander un investissement de remplacement (CAPEX).

---

## 4. Algorithmes de Période & Zéro Dérive dans le Mode Usine Vide

1. **Agrégation par Mois (`YYYY-MM`) :** Les mouvements et bons de travail sont regroupés selon leur date d'exécution réelle, indépendamment de la date de création de la fiche.
2. **Invariant Usine Vide :** Si aucun mouvement ou bon de travail n'est présent (`mouvements.length === 0`), `FinancialCalculationService.synthesize()` renvoie des totaux rigoureusement à zéro sans générer d'erreurs d'incohérence budgétaire (`0.00 DA dépensés / 0% consommé`).
3. **Immuabilité des Périodes Antérieures :** Les données des mois clôturés ne peuvent pas être rétroactivement altérées par un changement de prix unitaire futur.
