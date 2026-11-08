---
id: page-dev-settings-json-editor
groupId: 07-settings-systeme
groupTitle: Paramètres Système, Sauvegardes & Registre d’Audit
docType: architecture
audience: developer
tabId: settings_json_editor
title: Spécification Technique — Éditeur de Base JSON & Patching d'Urgence
summary: Architecture de l'éditeur direct de la base JSON du store. Validation syntaxique stricte, contrôle de structure de schéma, injection contrôlée et traçabilité des modifications bas niveau.
relatedTabs:
  - settings_json_editor
  - settings
  - settings_backup_audit
---

# 💻 Spécification Développeur : Éditeur de Base JSON (`#settings_json_editor`)

> **Public :** Développeurs Core, Ingénieurs Support Niveau 3 & Modèles IA.  
> **Composant source :** `src/presentation/pages/settings/components/SettingsJsonEditorTab.tsx`  
> **Cible de mutation :** `src/store/useGmaoStore.ts` (State tree complet).  
> **Protection d'accès :** Restriction stricte aux comptes disposant du rôle `ADMIN`.

---

## 1. Rôle & Utilité dans le Cycle de Vie Système

L'onglet **Éditeur de Base JSON** fournit un accès direct en lecture/écriture à l'arbre d'état complet de l'application sous sa forme sérialisée brute (`JSON`).

### Cas d'Usage Légitimes :
1. **Inspection d'État lors du Débogage :** Vérification de l'état exact d'un objet en mémoire sans passer par les composants d'interface.
2. **Patching d'Urgence en Atelier (Hotfix) :** Correction chirurgicale d'un champ corrompu ou mal typé suite à un import externe défectueux, sans nécessiter de redéploiement applicatif.
3. **Extraction Rapide d'Échantillon :** Copie instantanée d'une portion de l'état pour analyse hors-ligne ou tests unitaires.

---

## 2. Gardes-Fous & Pipeline de Validation de Sauvegarde

Pour éviter qu'une faute de frappe (accolade manquante, virgule superflue) ne rende l'application inopérante, la sauvegarde traverse un protocole de vérification en 3 niveaux :

```text
[ Texte JSON Modifié par l'Administrateur ]
                   │
                   ▼
[ 1. Validation Syntaxique (JSON.parse) ]
  • Détection immédiate des erreurs de syntaxe.
  • Mise en surbrillance de la ligne et de la colonne en défaut.
                   │
                   ▼
[ 2. Contrôle de Structure de Premier Niveau ]
  • Vérification de la présence des collections racines indispensables :
    'machines', 'stockItems', 'mouvements', 'zones', 'technicians'.
  • Si un tableau racine a été supprimé par erreur ➔ Rejet bloquant.
                   │
                   ▼
[ 3. Écriture Atomique & Journalisation d'Audit ]
  • Remplacement de l'état Zustand via DataGateway.
  • Enregistrement d'un événement critique 'RAW_JSON_PATCH' dans AUDIT_EVENTS
    avec capture du diff avant/après.
```

---

## 3. Matrice de Sécurité & Droits d'Accès

- **Lecture :** Autorisée uniquement pour le rôle `ADMIN`.
- **Écriture / Sauvegarde :** Réservée exclusivement à l'`ADMIN` avec saisie obligatoire d'un commentaire d'audit justifiant la manipulation.
- Les rôles opérationnels (`TECHNICIEN`, `OPERATEUR`, `SUPERVISEUR`, `MAGASINIER`) ne disposent d'aucun accès à cet onglet (`PermissionDenied`).
