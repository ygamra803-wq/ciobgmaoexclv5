# Industrial Dual-Theme System (Light & Obsidian Dark Mode) - GMAO v4

Plan for integrating an industrial-grade dual-theme system (Light / Dark obsidian) into the GMAO CMMS v4 application, drawing architectural principles from the provided design system philosophy while preserving strict tabular legibility, Excel grid boundaries, and high-density industrial UX.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> The following confirmed choices govern this dual-theme implementation:

- **Confirmed Decision 1 (Visual Palette)**: Deep Charcoal / Obsidian (`#111215` / `#18191e`) base with subtle **Industrial Emerald** and **Honey Gold** accents for Dark Mode, ensuring operational safety badges (Critical Red, Warning Amber, Healthy Green) remain 100% WCAG AA compliant.
- **Confirmed Decision 2 (Switch Location)**: Quick Theme Toggle button embedded in the top **Header bar** (sun/moon icon morph) + full customizable appearance controls inside `AppearanceLayoutSelector.tsx`.
- **Confirmed Decision 3 (Transition Engine)**: Smooth **View Transitions API** morph with CSS color temperature interpolation and fallbacks for `prefers-reduced-motion`.

---

## 1. Overview & Core Concept

- **What It Does**: Upgrades GMAO v4 with a unified Light & Obsidian Dark theme system. Users can switch between a crisp, high-contrast Light mode (engineered like a high-density Excel spreadsheet) and a low-glare Obsidian Dark mode designed for night-shift technicians and control rooms.
- **Target Audience / Persona**: Plant maintenance managers, field technicians, and reliability engineers working across variable lighting environments (bright shopfloors to low-light control panels).
- **Key Value**: Reduces visual fatigue during long monitoring sessions, retains high-density data readability, and ensures zero contrast breakage across work orders, asset trees, and inventory grids.

---

## 2. User Experience & Visual Design

### Dual Visual Identity

```
┌─────────────────────────────────────────┬─────────────────────────────────────────┐
│        LIGHT MODE (Excel Engineered)    │       DARK MODE (Obsidian Control)      │
├─────────────────────────────────────────┼─────────────────────────────────────────┤
│ Canvas: Soft Light Slate (#F8FAFC)      │ Canvas: Deep Obsidian (#111215)         │
│ Surfaces: Pure White (#FFFFFF)          │ Surfaces: Muted Charcoal (#18191E)      │
│ Text Primary: Dark Charcoal (#0F172A)   │ Text Primary: High-Legibility (#F1F5F9) │
│ Accent: Industrial Emerald (#059669)   │ Accent: Glowing Emerald / Gold          │
│ Borders: Hairline Slate (#E2E8F0)       │ Borders: Low-Luminance Charcoal (#2A2C34)│
└─────────────────────────────────────────┴─────────────────────────────────────────┘
```

### Color Tokens & Semantic Surface System

We will establish semantic CSS tokens in `src/index.css` via `:root` and `.dark` blocks, bound to Tailwind v4 via `@custom-variant dark (&:where(.dark, .dark *));`:

- `--gmao-canvas`: App background field (`#F8FAFC` light / `#111215` dark).
- `--gmao-surface`: Card & table background (`#FFFFFF` light / `#18191E` dark).
- `--gmao-surface-header`: Table header row (`#F1F5F9` light / `#1F2128` dark).
- `--gmao-border`: Table grid lines & hairline card borders (`#E2E8F0` light / `#2B2E37` dark).
- `--gmao-text-main`: Primary headings & values (`#0F172A` light / `#F1F5F9` dark).
- `--gmao-text-muted`: Neutral column labels & metadata (`#64748B` light / `#94A3B8` dark).

### Motion & Transition Engine

1. **View Transitions API**: Wraps theme updates in `document.startViewTransition()` when supported by Chrome/Edge/Safari.
2. **Circular Morph Effect**: Animates a expanding radial clip-path originating from the header sun/moon toggle button.
3. **Fallback**: Instant smooth 200ms opacity transition for browsers without View Transitions or when `prefers-reduced-motion` is active.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Tailwind v4 Variant Configuration**
  - *Chosen Approach*: Explicitly declare `@custom-variant dark (&:where(.dark, .dark *));` in `src/index.css`.
  - *Why*: Tailwind v4 defaults `dark:` utilities to system `prefers-color-scheme`. This rule ensures manual class toggling on `document.documentElement` (`.dark`) works deterministically without split-brain contrast bugs.

- **Decision 2: Single Source of Truth Theme State**
  - *Chosen Approach*: Store theme choice in `STORAGE_KEYS.THEME` and sync state via `useGmaoStore` / `window.dispatchEvent(new Event('gmao_appearance_changed'))`.
  - *Why*: Ensures seamless sync across `Header.tsx`, `AppearanceLayoutSelector.tsx`, and sidebar layout without state duplication.

- **Decision 3: Neutral Headers & Grid Preservations**
  - *Chosen Approach*: Keep table header backgrounds strictly neutral (`#F1F5F9` light / `#1F2128` dark) and enforce grid lines across all tables (`divide-x divide-y border-collapse`).
  - *Why*: Fulfills the user's explicit feedback from previous turns to maintain mature, Excel-like table legibility without distracting neon header colors.

---

## 4. Technical Architecture & Component Flow

```
┌────────────────────────────────────────────────────────────────────────┐
│                          State & Storage                               │
│  localStorage (STORAGE_KEYS.THEME) <───> useGmaoStore / Appearance     │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ (gmao_appearance_changed event)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        DOM Theme Dispatcher                            │
│           document.documentElement.classList.toggle('dark')            │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
           ┌────────────────────────┴────────────────────────┐
           ▼                                                 ▼
┌──────────────────────┐                          ┌──────────────────────┐
│     Header.tsx       │                          │  AppearanceLayout    │
│ Quick Sun/Moon Icon  │                          │    Selector.tsx      │
│ (View Transitions)   │                          │ Full Theme Controls  │
└──────────────────────┘                          └──────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                         Styled Viewports & Tables                      │
│ - High-Density Data Tables with Grid Lines                             │
│ - Status Badges (WCAG AA Compliant Red/Amber/Green)                   │
│ - Stat Cards & Filters (Neutral Canvas + Accent Numbers)              │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Implementation Steps

1. **CSS Infrastructure (`src/index.css`)**:
   - Add `@custom-variant dark (&:where(.dark, .dark *));`.
   - Define CSS variables for Light & Dark theme tokens.
   - Configure View Transition pseudo-elements (`::view-transition-old(root)` and `::view-transition-new(root)`).

2. **Header Quick Toggle Component (`src/presentation/components/layout/Header.tsx`)**:
   - Add elegant Sun/Moon icon button with tooltips ("الوضع الداكن" / "الوضع الفاتح").
   - Wire click handler to invoke `document.startViewTransition` with circular ripple effect.

3. **Appearance Settings Sync (`src/presentation/components/settings/AppearanceLayoutSelector.tsx`)**:
   - Ensure theme selector cards cleanly control `'light' | 'dark' | 'system'`.
   - Remove any old code that forced `.dark` removal.

4. **Component Surface & Contrast Audit**:
   - Audit data tables across `MachineRegisteredView`, `WorkOrderView`, `StockView`, and `PreventiveView` to ensure `dark:bg-slate-900/ dark:border-slate-800` styling maintains crisp Excel grid borders.
   - Verify pagination summary cards use neutral backgrounds with accent numbers as requested by user.

---

## Verification Plan

- Test theme toggle from both Header and Settings panel.
- Verify smooth View Transition effect without visual flickering.
- Verify text legibility and contrast ratio in Dark Mode for all table cells, headers, badges, and modals.
- Co-execute `compile_applet` and `lint_applet` to guarantee error-free compilation.
