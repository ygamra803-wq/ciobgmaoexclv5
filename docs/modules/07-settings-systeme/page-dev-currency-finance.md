---
id: page-dev-settings-currency-finance
groupId: 07-settings-systeme
groupTitle: Paramètres Système, Sauvegardes & Registre d’Audit
docType: architecture
audience: developer
tabId: settings_currency
title: Spécification Technique — Moteur Multi-Devises ISO 4217 & Taux de Change
summary: Architecture du convertisseur monétaire multi-devises conforme ISO 4217. Gestion des devises de référence (DA, MAD, EUR, USD), tables de taux de change historiques et précision arithmétique sans perte d'arrondi.
relatedTabs:
  - settings_currency
  - finance
  - stock
---

# 💻 Spécification Développeur : Moteur Multi-Devises ISO 4217 (`#settings_currency`)

> **Public :** Développeurs Finance, Architectes Comptables & Modèles IA.  
> **Composant source :** `src/presentation/pages/settings/components/SettingsCurrencyTab.tsx`  
> **Service monétaire :** `src/utils/currencyService.ts` (`useCurrency`).  
> **Modèle d'entité :** `src/domain/finance/entities/FinancialBudget.ts` (`HistoricalExchangeRate`).  
> **Clé SSOT :** `STORAGE_KEYS.EXCHANGE_RATES`.

---

## 1. Standardisation Monétaire Internationale (ISO 4217)

Pour accompagner les usines internationales ou les sites industriels important des pièces de rechange d'Europe ou d'Asie, **CIOB GMAO Nexus v5.0.2** intègre un moteur de conversion conforme à la norme **ISO 4217** :

```typescript
export type SupportedCurrency = 'DA' | 'DZD' | 'MAD' | 'EUR' | 'USD';

export interface HistoricalExchangeRate {
  id: string;             // Identifiant unique de parité (ex. 'RATE-EUR-DZD-2026')
  baseCurrency: string;   // Devise de référence usine (ex. 'DA')
  targetCurrency: string; // Devise étrangère de facturation (ex. 'EUR')
  rate: number;           // Taux de conversion multiplicateur
  effectiveDate: string;  // Date de prise d'effet (ISO 8601)
}
```

---

## 2. Invariants de Précision Arithmétique

1. **Monnaie de Référence Unique en Base (Base Currency SSOT) :**
   - Toutes les valeurs stockées dans la base de données (`rawStock.prix_unitaire`, `mouvements.cout_total`, `budgetAnnuel`) sont rigoureusement enregistrées dans la **devise de référence de l'usine** (généralement le Dinar Algérien `DA` ou le Dirham Marocain `MAD`).
2. **Conversion à la Volée lors du Rendu :**
   - L'affichage dans une devise alternative (ex. convertir les dépenses en Euros `EUR` pour un rapport à la maison-mère) s'exécute dynamiquement sans altérer les valeurs numériques sources stockées.
3. **Précision Décimale et Arrondis Comptables :**
   - Utilisation de l'arrondi bancaire à 2 décimales pour les totaux d'affichage :
     $$\text{Montant Converti} = \text{round}\left( \text{Montant Base} \times \text{Taux}, 2 \right)$$

---

## 3. Historisation des Taux de Change

- Les factures et bons de commande anciens conservent le taux de change qui était en vigueur **à la date de la transaction**.
- La modification d'un taux de change aujourd'hui n'affecte jamais rétroactivement les valorisations des exercices fiscaux passés.
