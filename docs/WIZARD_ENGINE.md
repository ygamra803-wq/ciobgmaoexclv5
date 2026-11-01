# 🧭 CIOB GMAO v4 — Profile-Driven Wizard Engine (`Mature Light Excel`)

> **Emplacement du package :** `src/presentation/components/common/wizard/`  
> **Clé de persistance Feature Flag :** `STORAGE_KEYS.WIZARD_FEATURE_FLAGS` (`gmao_wizard_feature_flags_v1`)  
> **Statut actuel :** Composant partagé autonome (découplé des pages opérationnelles existantes, activable à la demande via Feature Flag).

---

## 1. Philosophie & Architecture

Le moteur **Wizard Engine** de CIOB GMAO v4 est conçu selon le paradigme **Profile-Driven UI** (Interface pilotée par profil déclaratif) et adapté à l'identité visuelle **Mature Light Excel** :

1. **Séparation stricte Conteneur / Contenu :**
   - `WizardShell` et `WizardModal` gèrent la navigation, la barre latérale chronologique (`WizardSidebar`), les transitions fluides (`motion/react`), l'isolation des erreurs (`StepErrorBoundary`) et la barre d'actions inférieure (`WizardFooter`).
   - La logique métier reste dans un objet déclaratif `WizardProfile` contenant la liste ordonnée des étapes (`WizardStep[]`).
2. **Identité Mature Light Excel :**
   - Palette claire structurée (`bg-white`, `bg-slate-50/90`, `border-slate-200/90`), badges monospace (`ÉTAPE 01 / 03`, codes de référence GMAO), anneau lumineux subtil sur l'étape active, et barre de progression analytique en bas du panneau latéral.
   - Support natif des **6 couleurs thématiques** des modules GMAO (`emerald`, `indigo`, `blue`, `amber`, `purple`, `teal`).
3. **Feature Flag intégré (`useWizardFeature`) :**
   - Permet d'activer ou de désactiver le mode Assistant (Wizard) globalement ou module par module sans modifier la structure des pages existantes.
   - Par défaut, tous les drapeaux sont à `false` afin de garantir zéro régression sur les formulaires classiques.

---

## 2. Structure des Fichiers

```text
src/presentation/components/common/wizard/
├── index.ts                 # Point d'entrée unique (Barrel export)
├── wizard.types.ts          # Contrats TypeScript (WizardProfile, WizardStep, ValidationResult, WizardModuleKey)
├── wizardThemeTokens.ts     # Tokens visuels Mature Light Excel (emerald, indigo, blue, amber, purple, teal)
├── WizardContext.tsx        # État centralisé (WizardProvider, hook useWizard)
├── WizardSidebar.tsx        # Chronologie verticale Desktop + jauge d'avancement Excel
├── StepHeader.tsx           # En-tête standardisé pour chaque étape (icône, code monospace, titre)
├── WizardContent.tsx        # Zone d'affichage animée (motion/react) + StepErrorBoundary + Suspense
├── WizardFooter.tsx         # Barre inférieure (alertes de validation, Précédent / Suivant / Enregistrer)
├── WizardShell.tsx          # Conteneur inline (WizardShell) + Fenêtre modale (WizardModal) + Header Mobile
└── useWizardFeature.ts      # Hook & contrôleur Feature Flag (persistance localStorage via STORAGE_KEYS)
```

---

## 3. Contrats TypeScript Principaux

### `ValidationResult`
Chaque étape peut définir une fonction `validate()` synchrone ou asynchrone :
- `valid: boolean` — bloque le passage à l'étape suivante si `false`.
- `message?: string` — message affiché dans la bannière d'alerte du `WizardFooter`.
- `level?: 'warning' | 'critical'` — affiche une bannière ambre (`warning`) ou rose (`critical`, par défaut).

### `WizardStep`
| Propriété | Type | Description |
| :--- | :--- | :--- |
| `id` | `string` | Identifiant unique de l'étape |
| `code?` | `string` | Code monospace affiché au-dessus du titre (ex: `"STEP-01"`, `"BOM-LINK"`) |
| `title` | `string` | Titre de l'étape dans la barre latérale |
| `description?` | `string` | Description courte sous le titre dans la barre latérale |
| `badge?` | `string` | Badge contextuel (ex: `"Obligatoire"`, `"Auto"`) |
| `optional?` | `boolean` | Indique si l'étape est facultative |
| `icon?` | `LucideIcon` | Icône Lucide affichée dans le cercle de l'étape et dans `StepHeader` |
| `component` | `ReactNode` | Composant React rendu lorsque l'étape est active |
| `validate?` | `() => ValidationResult \| Promise<ValidationResult>` | Garde de validation exécutée avant `Suivant` ou `Valider` |

### `WizardProfile`
| Propriété | Type | Description |
| :--- | :--- | :--- |
| `id` | `string` | Identifiant unique du profil |
| `code?` | `string` | Référence affichée dans le badge d'en-tête (ex: `"WIZ-MAC-01"`) |
| `title` | `string` | Titre principal de l'assistant |
| `description?` | `string` | Sous-titre explicatif du flux |
| `themeColor?` | `'emerald' \| 'indigo' \| 'blue' \| 'amber' \| 'purple' \| 'teal'` | Couleur d'accentuation du module (défaut : `'emerald'`) |
| `finishLabel?` | `string` | Libellé du bouton final (défaut : `"Valider & Enregistrer"`) |
| `cancelLabel?` | `string` | Libellé du bouton d'annulation (défaut : `"Annuler"`) |
| `steps` | `WizardStep[]` | Liste ordonnée des étapes |
| `onFinish` | `() => Promise<void> \| void` | Action finale déclenchée à la dernière étape |
| `onCancel?` | `() => void` | Action déclenchée lors de l'annulation |

---

## 4. Contrôle du Feature Flag (`useWizardFeature`)

Le hook `useWizardFeature` permet de basculer dynamiquement entre un formulaire classique et le `WizardModal` / `WizardShell` :

```tsx
import { useWizardFeature } from '@/presentation/components/common/wizard';

export function ExampleActionToolbar() {
  const { isEnabled, toggleModule } = useWizardFeature('machines_onboarding');

  return (
    <div className="flex items-center gap-3">
      {/* Bouton pour activer/désactiver le mode Wizard à la demande */}
      <button
        type="button"
        onClick={() => toggleModule()}
        className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-mono"
      >
        Mode Assistant : {isEnabled ? 'ACTIF' : 'INACTIF'}
      </button>
    </div>
  );
}
```

### Clés de modules supportées (`WizardModuleKey`)
- `'global'` : Active le mode Wizard sur l'ensemble des modules compatibles.
- `'machines_onboarding'` : Immatriculation guidée d'une machine + topologie.
- `'preventive_plan'` : Création guidée d'un plan de maintenance préventive.
- `'corrective_di'` : Déclaration guidée d'une Demande d'Intervention (DI).
- `'corrective_bt'` : Clôture guidée d'un Bon de Travail (BT) + PDR.
- `'stock_article'` : Création guidée d'un article de rechange + seuils.
- `'stock_rapid_movement'` : Sortie / Entrée guidée multi-lignes.
- `'entrepot_component'` : Enregistrement guidé d'un composant d'entrepôt.

---

## 5. Exemple Complet d'Utilisation

```tsx
import React, { useState } from 'react';
import { Cpu, Layers, ShieldCheck } from 'lucide-react';
import {
  WizardShell,
  StepHeader,
  type WizardProfile,
} from '@/presentation/components/common/wizard';

export const MachineOnboardingWizardDemo: React.FC<{ onClose: () => void }> = ({
  onClose,
}) => {
  const [formData, setFormData] = useState({
    code: '',
    designation: '',
    zoneId: '',
  });

  const profile: WizardProfile = {
    id: 'machine-onboarding-wizard',
    code: 'WIZ-MAC-01',
    title: 'Immatriculation Machine',
    description: 'Configuration guidée en 3 étapes selon le référentiel CIOB.',
    themeColor: 'indigo',
    finishLabel: 'Immatriculer la Machine',
    steps: [
      {
        id: 'identity',
        code: 'ÉTAPE 01',
        title: 'Identité & Code Parc',
        description: 'Code matricule unique et désignation officielle',
        badge: 'Obligatoire',
        icon: Cpu,
        component: (
          <div className="space-y-4">
            <StepHeader
              title="Identité de l'équipement"
              description="Renseignez le code matricule unique et la désignation technique."
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Code Machine *
                </label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  placeholder="Ex: COMP-ATLAS-01"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Désignation *
                </label>
                <input
                  type="text"
                  value={formData.designation}
                  onChange={(e) =>
                    setFormData({ ...formData, designation: e.target.value })
                  }
                  placeholder="Ex: Compresseur Atlas Copco GA75"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs"
                />
              </div>
            </div>
          </div>
        ),
        validate: () => {
          if (!formData.code.trim() || !formData.designation.trim()) {
            return {
              valid: false,
              message: 'Le code machine et la désignation sont obligatoires.',
              level: 'critical',
            };
          }
          return { valid: true };
        },
      },
      {
        id: 'location',
        code: 'ÉTAPE 02',
        title: 'Affectation Topologique',
        description: 'Rattachement à une zone de production active',
        icon: Layers,
        component: (
          <div className="space-y-4">
            <StepHeader
              title="Zone & Emplacement"
              description="Sélectionnez la zone fonctionnelle de rattachement."
            />
            <input
              type="text"
              value={formData.zoneId}
              onChange={(e) => setFormData({ ...formData, zoneId: e.target.value })}
              placeholder="Ex: ZONE-PROD-A"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-mono"
            />
          </div>
        ),
        validate: () => {
          if (!formData.zoneId.trim()) {
            return {
              valid: false,
              message: 'Veuillez renseigner une zone de rattachement.',
              level: 'warning',
            };
          }
          return { valid: true };
        },
      },
      {
        id: 'review',
        code: 'ÉTAPE 03',
        title: 'Revue & Validation',
        description: 'Vérification de la fiche avant écriture SSOT',
        icon: ShieldCheck,
        component: (
          <div className="space-y-4">
            <StepHeader
              title="Récapitulatif d'immatriculation"
              description="Vérifiez l'exactitude des informations avant l'enregistrement définitif."
            />
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/90 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Code :</span>
                <span className="font-mono font-bold text-slate-900">{formData.code}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Désignation :</span>
                <span className="font-bold text-slate-900">{formData.designation}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Zone :</span>
                <span className="font-mono font-bold text-indigo-700">{formData.zoneId}</span>
              </div>
            </div>
          </div>
        ),
      },
    ],
    onFinish: async () => {
      onClose();
    },
    onCancel: onClose,
  };

  return <WizardShell profile={profile} />;
};
```
