import * as XLSX from 'xlsx';
import {
  parseExcelBoolean,
  parsePdrExcelPolicyTags,
} from '../pdr/pdrExcelParsers';
import refParcOfficialTemplate from '../../../templates/import/REF_PARC.template.json';
import refPersonnelOfficialTemplate from '../../../templates/import/REF_PERSONNEL.template.json';
import assetsMachinesOfficialTemplate from '../../../templates/import/ASSETS_MACHINES.template.json';
import refPdrOfficialTemplate from '../../../templates/import/REF_PDR.template.json';
import pmCatalogOfficialTemplate from '../../../templates/import/PM_CATALOG.template.json';
import entrepotBomOfficialTemplate from '../../../templates/import/ENTREPOT_BOM.template.json';
import cmCatalogOfficialTemplate from '../../../templates/import/CM_CATALOG.template.json';
import type {
  AssetsMachineRow,
  AssetsMachinesBundleInput,
  CmCatalogBundleInput,
  CmCatalogCategoryRow,
  CmCatalogFaultRow,
  EntrepotBomBundleInput,
  EntrepotBomCompFamilyRow,
  EntrepotBomCompGroupRow,
  EntrepotBomCompTemplateRow,
  EntrepotBomPartDesignationRow,
  EntrepotBomPartGroupRow,
  EntrepotBomPartTypeRow,
  PmCatalogActionRow,
  PmCatalogBundleInput,
  PmCatalogGuidePieceRow,
  PmCatalogGuideRow,
  RefParcBundleInput,
  RefParcFamilyRow,
  RefParcGeneralSystemTypeRow,
  RefParcTemplateRow,
  RefParcZoneRow,
  RefPdrBundleInput,
  RefPdrGroupRow,
  RefPdrItemRow,
  RefPdrTypeRow,
  RefPersonnelBundleInput,
  RefPersonnelOperationRow,
  RefPersonnelTechnicianRow,
} from './types/unifiedImportTypes';

export type TypeAExcelBundleKind =
  | 'REF_PARC'
  | 'REF_PERSONNEL'
  | 'ASSETS_MACHINES'
  | 'REF_PDR'
  | 'PM_CATALOG'
  | 'ENTREPOT_BOM'
  | 'CM_CATALOG';

export type TypeAExcelBundlePayload =
  | (RefParcBundleInput & { bundleType: 'REF_PARC' })
  | (RefPersonnelBundleInput & { bundleType: 'REF_PERSONNEL' })
  | (AssetsMachinesBundleInput & { bundleType: 'ASSETS_MACHINES' })
  | (RefPdrBundleInput & { bundleType: 'REF_PDR' })
  | (PmCatalogBundleInput & { bundleType: 'PM_CATALOG' })
  | (EntrepotBomBundleInput & { bundleType: 'ENTREPOT_BOM' })
  | (CmCatalogBundleInput & { bundleType: 'CM_CATALOG' });

export const TYPE_A_README_SHEET = 'README_TYPE_A';
export const TYPE_A_CONTRACT_SIGNATURE = 'TYPE_A_BUNDLE_ROUND_TRIP';
export const TYPE_A_SCHEMA_VERSION = '5.0.2';

export interface TypeAWorkbookSheetSpec {
  sheetName: string;
  columns: readonly string[];
}

export const TYPE_A_WORKBOOK_SPECS: Record<
  TypeAExcelBundleKind,
  {
    enumsNote: string;
    sheets: readonly TypeAWorkbookSheetSpec[];
  }
> = {
  REF_PARC: {
    enumsNote: 'is_active: true | false',
    sheets: [
      {
        sheetName: 'ZONES',
        columns: ['code_zone', 'libelle', 'description', 'is_active'],
      },
      {
        sheetName: 'FAMILIES',
        columns: ['code_family', 'libelle', 'description'],
      },
      {
        sheetName: 'TEMPLATES',
        columns: [
          'code_template',
          'code_family',
          'libelle',
          'constructeur',
          'puissance',
          'vitesse',
          'description',
        ],
      },
      {
        sheetName: 'GENERAL_SYSTEM_TYPES',
        columns: ['code_system_type', 'id_system_type', 'libelle', 'is_active'],
      },
    ],
  },
  REF_PERSONNEL: {
    enumsNote:
      'type_profil (OPERATIONS): RESPONSABLE | OPERATEUR | CHEF ; code_zone: code_zone actif ou ALL ; interdit: password/pin/token',
    sheets: [
      {
        sheetName: 'TECHNICIANS',
        columns: ['code_technician', 'nom', 'prenom', 'code_zone', 'specialite', 'is_active'],
      },
      {
        sheetName: 'OPERATIONS',
        columns: [
          'code_operation',
          'nom',
          'prenom',
          'code_zone',
          'type_profil',
          'specialite',
          'is_active',
        ],
      },
    ],
  },
  ASSETS_MACHINES: {
    enumsNote:
      'asset_class: PRODUCTION | SYSTEM_GENERAL ; asset_level: MACHINE | LINE ; status: En service | En panne | En maintenance | Hors service | Archivee',
    sheets: [
      {
        sheetName: 'MACHINES',
        columns: [
          'code_machine',
          'designation',
          'code_zone',
          'asset_class',
          'code_family',
          'code_template',
          'code_system_type',
          'code_technician',
          'parent_code_machine',
          'asset_level',
          'id_blueprint',
          'status',
          'is_active',
          'serial_number',
          'commissioning_date',
          'compteur_actuel',
          'unite_compteur',
          'cout_arret_horaire',
          'valeur_acquisition',
          'regime_travail',
        ],
      },
    ],
  },
  REF_PDR: {
    enumsNote:
      'policy_tags / default_policy_tags: REPLACING | REPAIRABLE | MODIFYING (séparés par virgule) ; zéro mouvement Sortie/Entrée ici',
    sheets: [
      {
        sheetName: 'PDR_GROUPS',
        columns: [
          'code_group',
          'libelle',
          'description',
          'domaine_technique',
          'default_policy_tags',
          'sort_order',
          'is_active',
        ],
      },
      {
        sheetName: 'PDR_TYPES',
        columns: ['code_type', 'code_group', 'libelle', 'domaine_technique', 'is_active'],
      },
      {
        sheetName: 'PDR_ITEMS',
        columns: [
          'ref',
          'designation',
          'code_type',
          'code_group',
          'seuil',
          'emplacement',
          'stockInitial',
          'prix_unitaire',
          'unite_mesure',
          'criticite',
          'ref_constructeur',
          'code_equivalents',
          'delai_appro_jours',
          'domaine_technique',
          'policy_tags',
        ],
      },
    ],
  },
  PM_CATALOG: {
    enumsNote:
      'actions_liees: codes séparés par virgule (ex: C,G) ; pieces_rechange_json: JSON array ou REF:QTY ; niveau 2 sans machines',
    sheets: [
      {
        sheetName: 'PM_ACTIONS',
        columns: [
          'code_action',
          'libelle',
          'ref',
          'description',
          'type_maintenance',
          'frequence_defaut',
          'duree_standard',
          'outils',
          'couleur',
          'icone',
          'is_active',
        ],
      },
      {
        sheetName: 'PM_GUIDES',
        columns: [
          'code_guide',
          'composant_nom',
          'famille',
          'ref',
          'actions_liees',
          'pieces_rechange_json',
          'fiches_actions_json',
          'consignes_securite',
          'criticite',
          'is_active',
        ],
      },
    ],
  },
  ENTREPOT_BOM: {
    enumsNote:
      'policy_tags / default_policy_tags: REPLACING | REPAIRABLE | MODIFYING (séparés par virgule) ; specs_json: objet JSON ; niveau 2 sans instances entrepôt ni BOM machine',
    sheets: [
      {
        sheetName: 'COMP_GROUPS',
        columns: [
          'code_comp_group',
          'code',
          'libelle',
          'ref',
          'description',
          'domaine_technique',
        ],
      },
      {
        sheetName: 'COMP_FAMILIES',
        columns: [
          'code_comp_family',
          'code_comp_group',
          'code',
          'libelle',
          'type',
          'ref',
          'description',
        ],
      },
      {
        sheetName: 'COMP_TEMPLATES',
        columns: [
          'code_comp_template',
          'code_comp_family',
          'code_comp_group',
          'code',
          'ref',
          'libelle',
          'type',
          'mode_reparation_defaut',
          'tension_nominale',
          'courant_nominal_a',
          'indice_protection',
          'type_fixation',
          'specs_json',
          'description',
        ],
      },
      {
        sheetName: 'PART_GROUPS',
        columns: [
          'code_part_group',
          'code',
          'libelle',
          'description',
          'domaine_technique',
          'default_policy_tags',
          'sort_order',
          'is_active',
        ],
      },
      {
        sheetName: 'PART_TYPES',
        columns: [
          'code_part_type',
          'code_part_group',
          'libelle',
          'description',
          'domaine_technique',
        ],
      },
      {
        sheetName: 'PART_DESIGNATIONS',
        columns: [
          'ref',
          'code_part_type',
          'code_part_group',
          'designation',
          'id_diag',
          'seuil',
          'emplacement',
          'matiere_nuance',
          'ref_plan',
          'dimensions_brut',
          'traitement_thermique',
          'policy_tags',
        ],
      },
    ],
  },
  CM_CATALOG: {
    enumsNote:
      'actions_list: actions séparées par point-virgule (;) ou tableau JSON ; niveau 2 sans bons de travail ni demandes',
    sheets: [
      {
        sheetName: 'CM_CATEGORIES',
        columns: ['code_category', 'libelle'],
      },
      {
        sheetName: 'CM_FAULTS',
        columns: ['code_fault', 'code_category', 'panne', 'actions_list'],
      },
    ],
  },
};

export interface ParseTypeAExcelResult {
  ok: boolean;
  bundleType?: TypeAExcelBundleKind;
  payload?: TypeAExcelBundlePayload;
  code?: 'TYPE_B_OR_UNRECOGNIZED_EXCEL' | 'SCHEMA_MISMATCH';
  message?: string;
  sheetNames: string[];
}

function cleanCellStr(value: unknown): string {
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

function nullableCellStr(value: unknown): string | null {
  const s = cleanCellStr(value);
  return s ? s : null;
}

function optionalNumberCell(value: unknown): number | undefined {
  if (value === undefined || value === null || String(value).trim() === '') {
    return undefined;
  }
  const num = Number(value);
  return Number.isFinite(num) ? num : undefined;
}

function serializeScalarOrJson(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function getDefaultTemplateForKind(kind: TypeAExcelBundleKind): TypeAExcelBundlePayload {
  switch (kind) {
    case 'REF_PARC':
      return JSON.parse(JSON.stringify(refParcOfficialTemplate)) as TypeAExcelBundlePayload;
    case 'REF_PERSONNEL':
      return JSON.parse(JSON.stringify(refPersonnelOfficialTemplate)) as TypeAExcelBundlePayload;
    case 'ASSETS_MACHINES':
      return JSON.parse(JSON.stringify(assetsMachinesOfficialTemplate)) as TypeAExcelBundlePayload;
    case 'REF_PDR':
      return JSON.parse(JSON.stringify(refPdrOfficialTemplate)) as TypeAExcelBundlePayload;
    case 'PM_CATALOG':
      return JSON.parse(JSON.stringify(pmCatalogOfficialTemplate)) as TypeAExcelBundlePayload;
    case 'ENTREPOT_BOM':
      return JSON.parse(JSON.stringify(entrepotBomOfficialTemplate)) as TypeAExcelBundlePayload;
    case 'CM_CATALOG':
      return JSON.parse(JSON.stringify(cmCatalogOfficialTemplate)) as TypeAExcelBundlePayload;
  }
}

function appendSheetWithColumns(
  wb: XLSX.WorkBook,
  sheetName: string,
  rows: Array<Record<string, unknown>>,
  columns: readonly string[]
): void {
  const normalizedRows = rows.map((row) => {
    const out: Record<string, unknown> = {};
    for (const col of columns) {
      out[col] = row[col] !== undefined && row[col] !== null ? row[col] : '';
    }
    return out;
  });
  const ws = XLSX.utils.json_to_sheet(normalizedRows, { header: [...columns] });
  ws['!cols'] = columns.map((col) => {
    const maxDataLen = normalizedRows.reduce((max, r) => {
      const len = String(r[col] ?? '').length;
      return Math.max(max, Math.min(len, 48));
    }, col.length);
    return { wch: Math.max(14, maxDataLen + 3) };
  });
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
}

/**
 * Builds an official Type A `.xlsx` workbook from either an explicit bundle payload
 * (Round-Trip live export) or the canonical official template.
 */
export function buildTypeAExcelWorkbookBuffer(
  bundleType: TypeAExcelBundleKind,
  payload?: Partial<TypeAExcelBundlePayload>
): Uint8Array {
  const resolved = (payload
    ? { ...payload, bundleType }
    : getDefaultTemplateForKind(bundleType)) as TypeAExcelBundlePayload;

  const spec = TYPE_A_WORKBOOK_SPECS[bundleType];
  const wb = XLSX.utils.book_new();

  // Sheet 1: Locked README_TYPE_A contract metadata
  const readmeRows: Array<Record<string, unknown>> = [
    { key: 'contract', value: TYPE_A_CONTRACT_SIGNATURE },
    { key: 'bundleType', value: bundleType },
    { key: 'schemaVersion', value: TYPE_A_SCHEMA_VERSION },
    { key: 'enums', value: spec.enumsNote },
    {
      key: 'warning',
      value:
        'Contrat officiel Type A réimportable via UnifiedImportPipeline. Conservez cette feuille README_TYPE_A et les en-têtes canoniques.',
    },
  ];
  appendSheetWithColumns(wb, TYPE_A_README_SHEET, readmeRows, ['key', 'value']);

  if (resolved.bundleType === 'REF_PARC') {
    const zones = (resolved.zones || []).map((z) => ({
      code_zone: cleanCellStr(z.code_zone),
      libelle: cleanCellStr(z.libelle ?? z.nom),
      description: cleanCellStr(z.description),
      is_active: z.is_active !== false,
    }));
    const families = (resolved.families || []).map((f) => ({
      code_family: cleanCellStr(f.code_family),
      libelle: cleanCellStr(f.libelle ?? f.nom),
      description: cleanCellStr(f.description),
    }));
    const templates = (resolved.templates || []).map((t) => ({
      code_template: cleanCellStr(t.code_template),
      code_family: cleanCellStr(t.code_family),
      libelle: cleanCellStr(t.libelle ?? t.nom),
      constructeur: cleanCellStr(t.constructeur),
      puissance: cleanCellStr(t.puissance),
      vitesse: cleanCellStr(t.vitesse),
      description: cleanCellStr(t.description),
    }));
    const sysTypes = (resolved.generalSystemTypes || []).map((st) => ({
      code_system_type: cleanCellStr(st.code_system_type ?? st.code ?? st.id_system_type),
      id_system_type: cleanCellStr(st.id_system_type ?? st.code_system_type ?? st.code),
      libelle: cleanCellStr(st.libelle ?? st.name),
      is_active: st.is_active !== false,
    }));

    appendSheetWithColumns(wb, 'ZONES', zones, spec.sheets[0].columns);
    appendSheetWithColumns(wb, 'FAMILIES', families, spec.sheets[1].columns);
    appendSheetWithColumns(wb, 'TEMPLATES', templates, spec.sheets[2].columns);
    appendSheetWithColumns(wb, 'GENERAL_SYSTEM_TYPES', sysTypes, spec.sheets[3].columns);
  } else if (resolved.bundleType === 'REF_PERSONNEL') {
    const technicians = (resolved.technicians || []).map((t) => ({
      code_technician: cleanCellStr(t.code_technician),
      nom: cleanCellStr(t.nom),
      prenom: cleanCellStr(t.prenom),
      code_zone: cleanCellStr(t.code_zone),
      specialite: cleanCellStr(t.specialite),
      is_active: t.is_active !== false,
    }));
    const operations = (resolved.operations || []).map((op) => ({
      code_operation: cleanCellStr(op.code_operation),
      nom: cleanCellStr(op.nom),
      prenom: cleanCellStr(op.prenom),
      code_zone: cleanCellStr(op.code_zone || 'ALL'),
      type_profil: cleanCellStr(op.type_profil || 'RESPONSABLE'),
      specialite: cleanCellStr(op.specialite),
      is_active: op.is_active !== false,
    }));

    appendSheetWithColumns(wb, 'TECHNICIANS', technicians, spec.sheets[0].columns);
    appendSheetWithColumns(wb, 'OPERATIONS', operations, spec.sheets[1].columns);
  } else if (resolved.bundleType === 'ASSETS_MACHINES') {
    const machines = (resolved.machines || []).map((m) => ({
      code_machine: cleanCellStr(m.code_machine),
      designation: cleanCellStr(m.designation ?? m.nom),
      code_zone: cleanCellStr(m.code_zone),
      asset_class: cleanCellStr(m.asset_class || 'PRODUCTION'),
      code_family: cleanCellStr(m.code_family),
      code_template: cleanCellStr(m.code_template),
      code_system_type: cleanCellStr(m.code_system_type),
      code_technician: cleanCellStr(m.code_technician),
      parent_code_machine: cleanCellStr(m.parent_code_machine),
      asset_level: cleanCellStr(m.asset_level || 'MACHINE'),
      id_blueprint: cleanCellStr(m.id_blueprint),
      status: cleanCellStr(m.status || 'En service'),
      is_active: m.is_active !== false,
      serial_number: cleanCellStr(m.serial_number),
      commissioning_date: cleanCellStr(m.commissioning_date),
      compteur_actuel:
        m.compteur_actuel !== undefined && Number.isFinite(Number(m.compteur_actuel))
          ? Number(m.compteur_actuel)
          : '',
      unite_compteur: cleanCellStr(m.unite_compteur),
      cout_arret_horaire:
        m.cout_arret_horaire !== undefined && Number.isFinite(Number(m.cout_arret_horaire))
          ? Number(m.cout_arret_horaire)
          : '',
      valeur_acquisition:
        m.valeur_acquisition !== undefined && Number.isFinite(Number(m.valeur_acquisition))
          ? Number(m.valeur_acquisition)
          : '',
      regime_travail: cleanCellStr(m.regime_travail),
    }));

    appendSheetWithColumns(wb, 'MACHINES', machines, spec.sheets[0].columns);
  } else if (resolved.bundleType === 'REF_PDR') {
    const groups = (resolved.groups || []).map((g) => ({
      code_group: cleanCellStr(g.code_group ?? g.code),
      libelle: cleanCellStr(g.libelle),
      description: cleanCellStr(g.description),
      domaine_technique: cleanCellStr(g.domaine_technique),
      default_policy_tags: Array.isArray(g.default_policy_tags)
        ? g.default_policy_tags.join(', ')
        : cleanCellStr(g.default_policy_tags || 'REPLACING'),
      sort_order: g.sort_order ?? 10,
      is_active: g.is_active !== false,
    }));
    const types = (resolved.types || []).map((t) => ({
      code_type: cleanCellStr(t.code_type),
      code_group: cleanCellStr(t.code_group ?? t.group_code),
      libelle: cleanCellStr(t.libelle),
      domaine_technique: cleanCellStr(t.domaine_technique),
      is_active: t.is_active !== false,
    }));
    const items = (resolved.items || []).map((it) => ({
      ref: cleanCellStr(it.ref ?? it.code_article),
      designation: cleanCellStr(it.designation),
      code_type: cleanCellStr(it.code_type),
      code_group: cleanCellStr(it.code_group),
      seuil: it.seuil ?? 0,
      emplacement: cleanCellStr(it.emplacement) || 'Magasin PDR',
      stockInitial: it.stockInitial ?? '',
      prix_unitaire: it.prix_unitaire ?? 0,
      unite_mesure: cleanCellStr(it.unite_mesure) || 'PCS',
      criticite: cleanCellStr(it.criticite) || 'B',
      ref_constructeur: cleanCellStr(it.ref_constructeur),
      code_equivalents: cleanCellStr(it.code_equivalents),
      delai_appro_jours: it.delai_appro_jours ?? '',
      domaine_technique: cleanCellStr(it.domaine_technique),
      policy_tags: Array.isArray(it.policy_tags)
        ? it.policy_tags.join(', ')
        : cleanCellStr(it.policy_tags || 'REPLACING'),
    }));

    appendSheetWithColumns(wb, 'PDR_GROUPS', groups, spec.sheets[0].columns);
    appendSheetWithColumns(wb, 'PDR_TYPES', types, spec.sheets[1].columns);
    appendSheetWithColumns(wb, 'PDR_ITEMS', items, spec.sheets[2].columns);
  } else if (resolved.bundleType === 'PM_CATALOG') {
    const actions = (resolved.actions || []).map((a) => ({
      code_action: cleanCellStr(a.code_action ?? a.code),
      libelle: cleanCellStr(a.libelle),
      ref: cleanCellStr(a.ref),
      description: cleanCellStr(a.description),
      type_maintenance: cleanCellStr(a.type_maintenance || 'Préventif'),
      frequence_defaut: cleanCellStr(a.frequence_defaut || '1M'),
      duree_standard: serializeScalarOrJson(a.duree_standard ?? '15 min'),
      outils: serializeScalarOrJson(a.outils ?? ''),
      couleur: cleanCellStr(a.couleur || 'blue'),
      icone: cleanCellStr(a.icone || 'Wrench'),
      is_active: a.is_active !== false,
    }));
    const guides = (resolved.guides || []).map((g) => ({
      code_guide: cleanCellStr(g.code_guide ?? g.code),
      composant_nom: cleanCellStr(g.composant_nom),
      famille: cleanCellStr(g.famille),
      ref: cleanCellStr(g.ref),
      actions_liees: Array.isArray(g.actions_liees) ? g.actions_liees.join(', ') : '',
      pieces_rechange_json:
        Array.isArray(g.pieces_rechange) && g.pieces_rechange.length > 0
          ? JSON.stringify(g.pieces_rechange)
          : '',
      fiches_actions_json:
        g.fiches_actions && typeof g.fiches_actions === 'object'
          ? JSON.stringify(g.fiches_actions)
          : '',
      consignes_securite: serializeScalarOrJson(g.consignes_securite ?? ''),
      criticite: cleanCellStr(g.criticite || 'Moyenne'),
      is_active: g.is_active !== false,
    }));

    appendSheetWithColumns(wb, 'PM_ACTIONS', actions, spec.sheets[0].columns);
    appendSheetWithColumns(wb, 'PM_GUIDES', guides, spec.sheets[1].columns);
  } else if (resolved.bundleType === 'ENTREPOT_BOM') {
    const compGroups = (resolved.compGroups || []).map((g) => ({
      code_comp_group: cleanCellStr(g.code_comp_group ?? g.code),
      code: cleanCellStr(g.code ?? g.code_comp_group),
      libelle: cleanCellStr(g.libelle),
      ref: cleanCellStr(g.ref),
      description: cleanCellStr(g.description),
      domaine_technique: cleanCellStr(g.domaine_technique),
    }));
    const compFamilies = (resolved.compFamilies || []).map((f) => ({
      code_comp_family: cleanCellStr(f.code_comp_family ?? f.code),
      code_comp_group: cleanCellStr(f.code_comp_group),
      code: cleanCellStr(f.code ?? f.code_comp_family),
      libelle: cleanCellStr(f.libelle),
      type: cleanCellStr(f.type),
      ref: cleanCellStr(f.ref),
      description: cleanCellStr(f.description),
    }));
    const compTemplates = (resolved.compTemplates || []).map((t) => ({
      code_comp_template: cleanCellStr(t.code_comp_template ?? t.code),
      code_comp_family: cleanCellStr(t.code_comp_family),
      code_comp_group: cleanCellStr(t.code_comp_group),
      code: cleanCellStr(t.code ?? t.code_comp_template),
      ref: cleanCellStr(t.ref),
      libelle: cleanCellStr(t.libelle),
      type: cleanCellStr(t.type),
      mode_reparation_defaut: cleanCellStr(t.mode_reparation_defaut),
      tension_nominale: cleanCellStr(t.tension_nominale),
      courant_nominal_a: t.courant_nominal_a ?? '',
      indice_protection: cleanCellStr(t.indice_protection),
      type_fixation: cleanCellStr(t.type_fixation),
      specs_json:
        t.specs && typeof t.specs === 'object' && !Array.isArray(t.specs)
          ? JSON.stringify(t.specs)
          : '',
      description: cleanCellStr(t.description),
    }));
    const partGroups = (resolved.partGroups || []).map((g) => ({
      code_part_group: cleanCellStr(g.code_part_group ?? g.code),
      code: cleanCellStr(g.code ?? g.code_part_group),
      libelle: cleanCellStr(g.libelle),
      description: cleanCellStr(g.description),
      domaine_technique: cleanCellStr(g.domaine_technique),
      default_policy_tags: Array.isArray(g.default_policy_tags)
        ? g.default_policy_tags.join(', ')
        : cleanCellStr(g.default_policy_tags || 'REPLACING'),
      sort_order: g.sort_order ?? 10,
      is_active: g.is_active !== false,
    }));
    const partTypes = (resolved.partTypes || []).map((pt) => ({
      code_part_type: cleanCellStr(pt.code_part_type),
      code_part_group: cleanCellStr(pt.code_part_group),
      libelle: cleanCellStr(pt.libelle),
      description: cleanCellStr(pt.description),
      domaine_technique: cleanCellStr(pt.domaine_technique),
    }));
    const partDesignations = (resolved.partDesignations || []).map((pd) => ({
      ref: cleanCellStr(pd.ref),
      code_part_type: cleanCellStr(pd.code_part_type),
      code_part_group: cleanCellStr(pd.code_part_group),
      designation: cleanCellStr(pd.designation ?? pd.libelle),
      id_diag: cleanCellStr(pd.id_diag),
      seuil: pd.seuil ?? '',
      emplacement: cleanCellStr(pd.emplacement),
      matiere_nuance: cleanCellStr(pd.matiere_nuance),
      ref_plan: cleanCellStr(pd.ref_plan),
      dimensions_brut: cleanCellStr(pd.dimensions_brut),
      traitement_thermique: cleanCellStr(pd.traitement_thermique),
      policy_tags: Array.isArray(pd.policy_tags)
        ? pd.policy_tags.join(', ')
        : cleanCellStr(pd.policy_tags || 'REPLACING'),
    }));

    appendSheetWithColumns(wb, 'COMP_GROUPS', compGroups, spec.sheets[0].columns);
    appendSheetWithColumns(wb, 'COMP_FAMILIES', compFamilies, spec.sheets[1].columns);
    appendSheetWithColumns(wb, 'COMP_TEMPLATES', compTemplates, spec.sheets[2].columns);
    appendSheetWithColumns(wb, 'PART_GROUPS', partGroups, spec.sheets[3].columns);
    appendSheetWithColumns(wb, 'PART_TYPES', partTypes, spec.sheets[4].columns);
    appendSheetWithColumns(wb, 'PART_DESIGNATIONS', partDesignations, spec.sheets[5].columns);
  } else if (resolved.bundleType === 'CM_CATALOG') {
    const categories = (resolved.categories || []).map((c) => ({
      code_category: cleanCellStr(c.code_category),
      libelle: cleanCellStr(c.libelle),
    }));
    const faults = (resolved.faults || []).map((f) => ({
      code_fault: cleanCellStr(f.code_fault),
      code_category: cleanCellStr(f.code_category),
      panne: cleanCellStr(f.panne),
      actions_list: Array.isArray(f.actions) ? f.actions.join('; ') : '',
    }));

    appendSheetWithColumns(wb, 'CM_CATEGORIES', categories, spec.sheets[0].columns);
    appendSheetWithColumns(wb, 'CM_FAULTS', faults, spec.sheets[1].columns);
  }

  const output = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer | Uint8Array;
  return output instanceof Uint8Array ? output : new Uint8Array(output);
}

/**
 * Triggers browser download of an official Type A `.xlsx` workbook.
 */
export function downloadTypeAExcelWorkbook(
  filename: string,
  bundleType: TypeAExcelBundleKind,
  payload?: Partial<TypeAExcelBundlePayload>
): void {
  const bytes = buildTypeAExcelWorkbookBuffer(bundleType, payload);
  const blob = new Blob([bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function findSheetCaseInsensitive(wb: XLSX.WorkBook, targetName: string): XLSX.WorkSheet | undefined {
  const normTarget = targetName.trim().toUpperCase();
  for (const name of wb.SheetNames || []) {
    if (name.trim().toUpperCase() === normTarget) {
      return wb.Sheets[name];
    }
  }
  return undefined;
}

function readSheetRows(wb: XLSX.WorkBook, sheetName: string): Array<Record<string, unknown>> {
  const ws = findSheetCaseInsensitive(wb, sheetName);
  if (!ws) return [];
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });
}

function extractExtraNonEmptyFields(
  rawRow: Record<string, unknown>,
  knownColumns: readonly string[]
): Record<string, unknown> {
  const knownSet = new Set(knownColumns);
  const extra: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(rawRow)) {
    if (knownSet.has(k)) continue;
    if (v !== '' && v !== undefined && v !== null) {
      extra[k] = v;
    }
  }
  return extra;
}

function isCompletelyBlankRow(row: Record<string, unknown>): boolean {
  return Object.values(row).every((v) => v === '' || v === null || v === undefined);
}

function parsePiecesRechangeCell(raw: unknown): {
  ok: boolean;
  pieces?: PmCatalogGuidePieceRow[];
  message?: string;
} {
  if (Array.isArray(raw)) {
    return { ok: true, pieces: raw as PmCatalogGuidePieceRow[] };
  }
  const str = cleanCellStr(raw);
  if (!str) return { ok: true, pieces: [] };

  if (str.startsWith('[') || str.startsWith('{')) {
    try {
      const parsed = JSON.parse(str);
      if (Array.isArray(parsed)) {
        return { ok: true, pieces: parsed as PmCatalogGuidePieceRow[] };
      }
      return {
        ok: false,
        message: "La colonne 'pieces_rechange_json' doit contenir un tableau JSON valide.",
      };
    } catch (err) {
      return {
        ok: false,
        message: `JSON invalide dans 'pieces_rechange_json' : ${(err as Error).message}`,
      };
    }
  }

  // Shorthand support: "SKF-6205-2RS:1, SKF-6206-2RS:2" or "SKF-6205-2RS*2"
  const pieces: PmCatalogGuidePieceRow[] = [];
  for (const token of str.split(/[,;|]/)) {
    const cleanToken = token.trim();
    if (!cleanToken) continue;
    const match = cleanToken.match(/^(.+?)\s*[:*x]\s*([0-9]+(?:\.[0-9]+)?)$/i);
    if (match) {
      pieces.push({
        ref: match[1].trim(),
        quantite: Number(match[2]),
      });
    } else {
      pieces.push({
        ref: cleanToken,
        quantite: 1,
      });
    }
  }
  return { ok: true, pieces };
}

function parseFichesActionsCell(raw: unknown): {
  ok: boolean;
  fiches?: Record<string, Record<string, unknown>>;
  message?: string;
} {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return { ok: true, fiches: raw as Record<string, Record<string, unknown>> };
  }
  const str = cleanCellStr(raw);
  if (!str) return { ok: true, fiches: undefined };

  try {
    const parsed = JSON.parse(str);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return { ok: true, fiches: parsed as Record<string, Record<string, unknown>> };
    }
    return {
      ok: false,
      message: "La colonne 'fiches_actions_json' doit contenir un objet JSON valide.",
    };
  } catch (err) {
    return {
      ok: false,
      message: `JSON invalide dans 'fiches_actions_json' : ${(err as Error).message}`,
    };
  }
}

function parseMaybeJsonStringOrArray(raw: unknown): string | string[] | undefined {
  if (Array.isArray(raw)) return raw.map((v) => String(v ?? ''));
  const str = cleanCellStr(raw);
  if (!str) return undefined;
  if (str.startsWith('[')) {
    try {
      const parsed = JSON.parse(str);
      if (Array.isArray(parsed)) return parsed.map((v) => String(v ?? ''));
    } catch {
      return str;
    }
  }
  return str;
}

function parseSpecsJsonCell(raw: unknown): {
  ok: boolean;
  specs?: Record<string, unknown>;
  message?: string;
} {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return { ok: true, specs: raw as Record<string, unknown> };
  }
  const str = cleanCellStr(raw);
  if (!str) return { ok: true, specs: undefined };
  try {
    const parsed = JSON.parse(str);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return { ok: true, specs: parsed as Record<string, unknown> };
    }
    return {
      ok: false,
      message: "La colonne 'specs_json' doit contenir un objet JSON valide.",
    };
  } catch (err) {
    return {
      ok: false,
      message: `JSON invalide dans 'specs_json' : ${(err as Error).message}`,
    };
  }
}

function parseActionsListCell(raw: unknown): {
  ok: boolean;
  actions: string[];
  message?: string;
} {
  if (Array.isArray(raw)) {
    return {
      ok: true,
      actions: raw.map((v) => cleanCellStr(v)).filter(Boolean),
    };
  }
  const str = cleanCellStr(raw);
  if (!str) return { ok: true, actions: [] };

  if (str.startsWith('[')) {
    try {
      const parsed = JSON.parse(str);
      if (Array.isArray(parsed)) {
        return {
          ok: true,
          actions: parsed.map((v) => cleanCellStr(v)).filter(Boolean),
        };
      }
      return {
        ok: false,
        actions: [],
        message: "La colonne 'actions_list' doit contenir un tableau JSON valide.",
      };
    } catch (err) {
      return {
        ok: false,
        actions: [],
        message: `JSON invalide dans 'actions_list' : ${(err as Error).message}`,
      };
    }
  }

  return {
    ok: true,
    actions: str
      .split(/[;|\r\n]+/)
      .map((s) => s.trim())
      .filter(Boolean),
  };
}

const VALID_BUNDLE_KINDS = new Set<TypeAExcelBundleKind>([
  'REF_PARC',
  'REF_PERSONNEL',
  'ASSETS_MACHINES',
  'REF_PDR',
  'PM_CATALOG',
  'ENTREPOT_BOM',
  'CM_CATALOG',
]);

/**
 * Strictly parses an `.xlsx` workbook buffer ONLY when it carries the official `README_TYPE_A`
 * contract sheet (`contract = TYPE_A_BUNDLE_ROUND_TRIP`).
 * Never guesses schemas for arbitrary / Type B operational Excel workbooks.
 */
export function parseTypeAExcelWorkbook(buffer: ArrayBuffer | Uint8Array): ParseTypeAExcelResult {
  let wb: XLSX.WorkBook;
  try {
    const data = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    wb = XLSX.read(data, { type: 'array' });
  } catch (err) {
    return {
      ok: false,
      code: 'SCHEMA_MISMATCH',
      sheetNames: [],
      message: `Impossible de lire le fichier Excel (.xlsx) : ${(err as Error)?.message || 'format corrompu'}`,
    };
  }

  const sheetNames = wb.SheetNames || [];
  const readmeSheet = findSheetCaseInsensitive(wb, TYPE_A_README_SHEET);
  if (!readmeSheet) {
    return {
      ok: false,
      code: 'TYPE_B_OR_UNRECOGNIZED_EXCEL',
      sheetNames,
      message:
        "Classeur Excel refusé : onglet de contrat 'README_TYPE_A' absent. Les exports opérationnels (Type B) ne sont pas réimportables ; téléchargez un modèle officiel Type A (.xlsx).",
    };
  }

  const readmeRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(readmeSheet, { defval: '' });
  const metaMap = new Map<string, string>();
  for (const row of readmeRows) {
    const k = cleanCellStr(row.key ?? row.Key ?? row.Clé ?? row.cle).toLowerCase();
    const v = cleanCellStr(row.value ?? row.Value ?? row.Valeur ?? row.valeur);
    if (k) metaMap.set(k, v);
  }

  const contract = metaMap.get('contract');
  const bundleTypeRaw = (metaMap.get('bundletype') || '').toUpperCase() as TypeAExcelBundleKind;

  if (contract !== TYPE_A_CONTRACT_SIGNATURE || !VALID_BUNDLE_KINDS.has(bundleTypeRaw)) {
    return {
      ok: false,
      code: 'TYPE_B_OR_UNRECOGNIZED_EXCEL',
      sheetNames,
      message:
        "Signature Type A invalide dans 'README_TYPE_A' (contrat TYPE_A_BUNDLE_ROUND_TRIP ou bundleType non reconnu).",
    };
  }

  if (bundleTypeRaw === 'REF_PARC') {
    const specs = TYPE_A_WORKBOOK_SPECS.REF_PARC.sheets;
    const zones: RefParcZoneRow[] = readSheetRows(wb, 'ZONES')
      .filter((r) => !isCompletelyBlankRow(r))
      .map((r) => ({
        ...extractExtraNonEmptyFields(r, specs[0].columns),
        code_zone: cleanCellStr(r.code_zone),
        libelle: cleanCellStr(r.libelle),
        description: cleanCellStr(r.description),
        is_active: parseExcelBoolean(r.is_active, true),
      }));

    const families: RefParcFamilyRow[] = readSheetRows(wb, 'FAMILIES')
      .filter((r) => !isCompletelyBlankRow(r))
      .map((r) => ({
        ...extractExtraNonEmptyFields(r, specs[1].columns),
        code_family: cleanCellStr(r.code_family),
        libelle: cleanCellStr(r.libelle),
        description: cleanCellStr(r.description),
      }));

    const templates: RefParcTemplateRow[] = readSheetRows(wb, 'TEMPLATES')
      .filter((r) => !isCompletelyBlankRow(r))
      .map((r) => ({
        ...extractExtraNonEmptyFields(r, specs[2].columns),
        code_template: cleanCellStr(r.code_template),
        code_family: cleanCellStr(r.code_family),
        libelle: cleanCellStr(r.libelle),
        constructeur: cleanCellStr(r.constructeur),
        puissance: cleanCellStr(r.puissance),
        vitesse: cleanCellStr(r.vitesse),
        description: cleanCellStr(r.description),
      }));

    const generalSystemTypes: RefParcGeneralSystemTypeRow[] = readSheetRows(
      wb,
      'GENERAL_SYSTEM_TYPES'
    )
      .filter((r) => !isCompletelyBlankRow(r))
      .map((r) => ({
        ...extractExtraNonEmptyFields(r, specs[3].columns),
        code_system_type: cleanCellStr(r.code_system_type),
        id_system_type: cleanCellStr(r.id_system_type || r.code_system_type),
        libelle: cleanCellStr(r.libelle),
        is_active: parseExcelBoolean(r.is_active, true),
      }));

    return {
      ok: true,
      bundleType: 'REF_PARC',
      sheetNames,
      payload: {
        bundleType: 'REF_PARC',
        zones,
        families,
        templates,
        generalSystemTypes,
      },
    };
  }

  if (bundleTypeRaw === 'REF_PERSONNEL') {
    const specs = TYPE_A_WORKBOOK_SPECS.REF_PERSONNEL.sheets;
    const technicians: RefPersonnelTechnicianRow[] = readSheetRows(wb, 'TECHNICIANS')
      .filter((r) => !isCompletelyBlankRow(r))
      .map((r) => ({
        ...extractExtraNonEmptyFields(r, specs[0].columns),
        code_technician: cleanCellStr(r.code_technician),
        nom: cleanCellStr(r.nom),
        ...(cleanCellStr(r.prenom) ? { prenom: cleanCellStr(r.prenom) } : {}),
        code_zone: nullableCellStr(r.code_zone),
        specialite: cleanCellStr(r.specialite),
        is_active: parseExcelBoolean(r.is_active, true),
      }));

    const operations: RefPersonnelOperationRow[] = readSheetRows(wb, 'OPERATIONS')
      .filter((r) => !isCompletelyBlankRow(r))
      .map((r) => ({
        ...extractExtraNonEmptyFields(r, specs[1].columns),
        code_operation: cleanCellStr(r.code_operation),
        nom: cleanCellStr(r.nom),
        ...(cleanCellStr(r.prenom) ? { prenom: cleanCellStr(r.prenom) } : {}),
        code_zone: cleanCellStr(r.code_zone) || 'ALL',
        type_profil: cleanCellStr(r.type_profil) || 'RESPONSABLE',
        specialite: cleanCellStr(r.specialite),
        is_active: parseExcelBoolean(r.is_active, true),
      }));

    return {
      ok: true,
      bundleType: 'REF_PERSONNEL',
      sheetNames,
      payload: {
        bundleType: 'REF_PERSONNEL',
        technicians,
        operations,
      },
    };
  }

  if (bundleTypeRaw === 'ASSETS_MACHINES') {
    const specs = TYPE_A_WORKBOOK_SPECS.ASSETS_MACHINES.sheets;
    if (!findSheetCaseInsensitive(wb, 'MACHINES')) {
      return {
        ok: false,
        code: 'SCHEMA_MISMATCH',
        sheetNames,
        message: "Feuille obligatoire 'MACHINES' introuvable dans le classeur Type A ASSETS_MACHINES.",
      };
    }
    const machines: AssetsMachineRow[] = readSheetRows(wb, 'MACHINES')
      .filter((r) => !isCompletelyBlankRow(r))
      .map((r) => ({
        ...extractExtraNonEmptyFields(r, specs[0].columns),
        code_machine: cleanCellStr(r.code_machine),
        designation: cleanCellStr(r.designation),
        code_zone: cleanCellStr(r.code_zone),
        asset_class: cleanCellStr(r.asset_class) || 'PRODUCTION',
        code_family: nullableCellStr(r.code_family),
        code_template: nullableCellStr(r.code_template),
        code_system_type: nullableCellStr(r.code_system_type),
        code_technician: nullableCellStr(r.code_technician),
        parent_code_machine: nullableCellStr(r.parent_code_machine),
        asset_level: cleanCellStr(r.asset_level) || 'MACHINE',
        id_blueprint: nullableCellStr(r.id_blueprint),
        status: cleanCellStr(r.status) || 'En service',
        is_active: parseExcelBoolean(r.is_active, true),
        serial_number: cleanCellStr(r.serial_number),
        commissioning_date: cleanCellStr(r.commissioning_date),
        ...(optionalNumberCell(r.compteur_actuel) !== undefined
          ? { compteur_actuel: optionalNumberCell(r.compteur_actuel) }
          : {}),
        ...(cleanCellStr(r.unite_compteur) ? { unite_compteur: cleanCellStr(r.unite_compteur) } : {}),
        ...(optionalNumberCell(r.cout_arret_horaire) !== undefined
          ? { cout_arret_horaire: optionalNumberCell(r.cout_arret_horaire) }
          : {}),
        ...(optionalNumberCell(r.valeur_acquisition) !== undefined
          ? { valeur_acquisition: optionalNumberCell(r.valeur_acquisition) }
          : {}),
        ...(cleanCellStr(r.regime_travail) ? { regime_travail: cleanCellStr(r.regime_travail) } : {}),
      }));

    return {
      ok: true,
      bundleType: 'ASSETS_MACHINES',
      sheetNames,
      payload: {
        bundleType: 'ASSETS_MACHINES',
        machines,
      },
    };
  }

  if (bundleTypeRaw === 'REF_PDR') {
    const specs = TYPE_A_WORKBOOK_SPECS.REF_PDR.sheets;
    const groups: RefPdrGroupRow[] = readSheetRows(wb, 'PDR_GROUPS')
      .filter((r) => !isCompletelyBlankRow(r))
      .map((r) => ({
        ...extractExtraNonEmptyFields(r, specs[0].columns),
        code_group: cleanCellStr(r.code_group),
        libelle: cleanCellStr(r.libelle),
        description: cleanCellStr(r.description),
        ...(cleanCellStr(r.domaine_technique)
          ? { domaine_technique: cleanCellStr(r.domaine_technique) }
          : {}),
        default_policy_tags: parsePdrExcelPolicyTags(r.default_policy_tags),
        ...(optionalNumberCell(r.sort_order) !== undefined
          ? { sort_order: optionalNumberCell(r.sort_order) }
          : {}),
        is_active: parseExcelBoolean(r.is_active, true),
      }));

    const types: RefPdrTypeRow[] = readSheetRows(wb, 'PDR_TYPES')
      .filter((r) => !isCompletelyBlankRow(r))
      .map((r) => ({
        ...extractExtraNonEmptyFields(r, specs[1].columns),
        code_type: cleanCellStr(r.code_type),
        code_group: cleanCellStr(r.code_group),
        libelle: cleanCellStr(r.libelle),
        ...(cleanCellStr(r.domaine_technique)
          ? { domaine_technique: cleanCellStr(r.domaine_technique) }
          : {}),
        is_active: parseExcelBoolean(r.is_active, true),
      }));

    const items: RefPdrItemRow[] = readSheetRows(wb, 'PDR_ITEMS')
      .filter((r) => !isCompletelyBlankRow(r))
      .map((r) => {
        const stockInit = optionalNumberCell(r.stockInitial);
        const delai = optionalNumberCell(r.delai_appro_jours);
        return {
          ...extractExtraNonEmptyFields(r, specs[2].columns),
          ref: cleanCellStr(r.ref),
          designation: cleanCellStr(r.designation),
          code_type: cleanCellStr(r.code_type),
          code_group: cleanCellStr(r.code_group),
          seuil: optionalNumberCell(r.seuil) ?? 0,
          emplacement: cleanCellStr(r.emplacement) || 'Magasin PDR',
          ...(stockInit !== undefined ? { stockInitial: stockInit } : {}),
          prix_unitaire: optionalNumberCell(r.prix_unitaire) ?? 0,
          unite_mesure: cleanCellStr(r.unite_mesure) || 'PCS',
          criticite: cleanCellStr(r.criticite) || 'B',
          ...(cleanCellStr(r.ref_constructeur)
            ? { ref_constructeur: cleanCellStr(r.ref_constructeur) }
            : {}),
          ...(cleanCellStr(r.code_equivalents)
            ? { code_equivalents: cleanCellStr(r.code_equivalents) }
            : {}),
          ...(delai !== undefined ? { delai_appro_jours: delai } : {}),
          ...(cleanCellStr(r.domaine_technique)
            ? { domaine_technique: cleanCellStr(r.domaine_technique) }
            : {}),
          policy_tags: parsePdrExcelPolicyTags(r.policy_tags),
        };
      });

    return {
      ok: true,
      bundleType: 'REF_PDR',
      sheetNames,
      payload: {
        bundleType: 'REF_PDR',
        groups,
        types,
        items,
      },
    };
  }

  if (bundleTypeRaw === 'PM_CATALOG') {
    // PM_CATALOG
    const specs = TYPE_A_WORKBOOK_SPECS.PM_CATALOG.sheets;
    const actions: PmCatalogActionRow[] = readSheetRows(wb, 'PM_ACTIONS')
      .filter((r) => !isCompletelyBlankRow(r))
      .map((r) => ({
        ...extractExtraNonEmptyFields(r, specs[0].columns),
        code_action: cleanCellStr(r.code_action),
        libelle: cleanCellStr(r.libelle),
        ...(cleanCellStr(r.ref) ? { ref: cleanCellStr(r.ref) } : {}),
        ...(cleanCellStr(r.description) ? { description: cleanCellStr(r.description) } : {}),
        ...(cleanCellStr(r.type_maintenance)
          ? { type_maintenance: cleanCellStr(r.type_maintenance) }
          : {}),
        ...(cleanCellStr(r.frequence_defaut)
          ? { frequence_defaut: cleanCellStr(r.frequence_defaut) }
          : {}),
        ...(cleanCellStr(r.duree_standard)
          ? { duree_standard: cleanCellStr(r.duree_standard) }
          : {}),
        ...(parseMaybeJsonStringOrArray(r.outils) !== undefined
          ? { outils: parseMaybeJsonStringOrArray(r.outils) }
          : {}),
        ...(cleanCellStr(r.couleur) ? { couleur: cleanCellStr(r.couleur) } : {}),
        ...(cleanCellStr(r.icone) ? { icone: cleanCellStr(r.icone) } : {}),
        is_active: parseExcelBoolean(r.is_active, true),
      }));

    const rawGuideRows = readSheetRows(wb, 'PM_GUIDES').filter((r) => !isCompletelyBlankRow(r));
    const guides: PmCatalogGuideRow[] = [];

    for (let i = 0; i < rawGuideRows.length; i++) {
      const r = rawGuideRows[i];
      const piecesParsed = parsePiecesRechangeCell(r.pieces_rechange_json ?? r.pieces_rechange);
      if (!piecesParsed.ok) {
        return {
          ok: false,
          code: 'SCHEMA_MISMATCH',
          sheetNames,
          message: `Ligne ${i + 1} (PM_GUIDES) : ${piecesParsed.message}`,
        };
      }

      const fichesParsed = parseFichesActionsCell(r.fiches_actions_json ?? r.fiches_actions);
      if (!fichesParsed.ok) {
        return {
          ok: false,
          code: 'SCHEMA_MISMATCH',
          sheetNames,
          message: `Ligne ${i + 1} (PM_GUIDES) : ${fichesParsed.message}`,
        };
      }

      const rawActionsLiees = cleanCellStr(r.actions_liees);
      const actionsLiees = rawActionsLiees
        ? rawActionsLiees
            .split(/[,;|]/)
            .map((s) => s.trim().toUpperCase())
            .filter(Boolean)
        : [];

      const extra = extractExtraNonEmptyFields(r, [
        ...specs[1].columns,
        'pieces_rechange',
        'fiches_actions',
      ]);

      guides.push({
        ...extra,
        code_guide: cleanCellStr(r.code_guide),
        composant_nom: cleanCellStr(r.composant_nom),
        ...(cleanCellStr(r.famille) ? { famille: cleanCellStr(r.famille) } : {}),
        ...(cleanCellStr(r.ref) ? { ref: cleanCellStr(r.ref) } : {}),
        actions_liees: actionsLiees,
        pieces_rechange: piecesParsed.pieces,
        ...(fichesParsed.fiches ? { fiches_actions: fichesParsed.fiches } : {}),
        ...(parseMaybeJsonStringOrArray(r.consignes_securite) !== undefined
          ? { consignes_securite: parseMaybeJsonStringOrArray(r.consignes_securite) }
          : {}),
        ...(cleanCellStr(r.criticite) ? { criticite: cleanCellStr(r.criticite) } : {}),
        is_active: parseExcelBoolean(r.is_active, true),
      });
    }

    return {
      ok: true,
      bundleType: 'PM_CATALOG',
      sheetNames,
      payload: {
        bundleType: 'PM_CATALOG',
        actions,
        guides,
      },
    };
  }

  if (bundleTypeRaw === 'ENTREPOT_BOM') {
    const specs = TYPE_A_WORKBOOK_SPECS.ENTREPOT_BOM.sheets;

    const compGroups: EntrepotBomCompGroupRow[] = readSheetRows(wb, 'COMP_GROUPS')
      .filter((r) => !isCompletelyBlankRow(r))
      .map((r) => ({
        ...extractExtraNonEmptyFields(r, specs[0].columns),
        code_comp_group: cleanCellStr(r.code_comp_group),
        ...(cleanCellStr(r.code) ? { code: cleanCellStr(r.code) } : {}),
        libelle: cleanCellStr(r.libelle),
        ...(cleanCellStr(r.ref) ? { ref: cleanCellStr(r.ref) } : {}),
        ...(cleanCellStr(r.description) ? { description: cleanCellStr(r.description) } : {}),
        ...(cleanCellStr(r.domaine_technique)
          ? { domaine_technique: cleanCellStr(r.domaine_technique) }
          : {}),
      }));

    const compFamilies: EntrepotBomCompFamilyRow[] = readSheetRows(wb, 'COMP_FAMILIES')
      .filter((r) => !isCompletelyBlankRow(r))
      .map((r) => ({
        ...extractExtraNonEmptyFields(r, specs[1].columns),
        code_comp_family: cleanCellStr(r.code_comp_family),
        code_comp_group: cleanCellStr(r.code_comp_group),
        ...(cleanCellStr(r.code) ? { code: cleanCellStr(r.code) } : {}),
        libelle: cleanCellStr(r.libelle),
        ...(cleanCellStr(r.type) ? { type: cleanCellStr(r.type) } : {}),
        ...(cleanCellStr(r.ref) ? { ref: cleanCellStr(r.ref) } : {}),
        ...(cleanCellStr(r.description) ? { description: cleanCellStr(r.description) } : {}),
      }));

    const rawTemplateRows = readSheetRows(wb, 'COMP_TEMPLATES').filter(
      (r) => !isCompletelyBlankRow(r)
    );
    const compTemplates: EntrepotBomCompTemplateRow[] = [];

    for (let i = 0; i < rawTemplateRows.length; i++) {
      const r = rawTemplateRows[i];
      const specsParsed = parseSpecsJsonCell(r.specs_json ?? r.specs);
      if (!specsParsed.ok) {
        return {
          ok: false,
          code: 'SCHEMA_MISMATCH',
          sheetNames,
          message: `Ligne ${i + 1} (COMP_TEMPLATES) : ${specsParsed.message}`,
        };
      }
      const extra = extractExtraNonEmptyFields(r, [...specs[2].columns, 'specs']);
      const courant = optionalNumberCell(r.courant_nominal_a);

      compTemplates.push({
        ...extra,
        code_comp_template: cleanCellStr(r.code_comp_template),
        code_comp_family: cleanCellStr(r.code_comp_family),
        ...(cleanCellStr(r.code_comp_group)
          ? { code_comp_group: cleanCellStr(r.code_comp_group) }
          : {}),
        ...(cleanCellStr(r.code) ? { code: cleanCellStr(r.code) } : {}),
        ...(cleanCellStr(r.ref) ? { ref: cleanCellStr(r.ref) } : {}),
        libelle: cleanCellStr(r.libelle),
        ...(cleanCellStr(r.type) ? { type: cleanCellStr(r.type) } : {}),
        ...(cleanCellStr(r.mode_reparation_defaut)
          ? { mode_reparation_defaut: cleanCellStr(r.mode_reparation_defaut) }
          : {}),
        ...(cleanCellStr(r.tension_nominale)
          ? { tension_nominale: cleanCellStr(r.tension_nominale) }
          : {}),
        ...(courant !== undefined ? { courant_nominal_a: courant } : {}),
        ...(cleanCellStr(r.indice_protection)
          ? { indice_protection: cleanCellStr(r.indice_protection) }
          : {}),
        ...(cleanCellStr(r.type_fixation)
          ? { type_fixation: cleanCellStr(r.type_fixation) }
          : {}),
        ...(specsParsed.specs ? { specs: specsParsed.specs } : {}),
        ...(cleanCellStr(r.description) ? { description: cleanCellStr(r.description) } : {}),
      });
    }

    const partGroups: EntrepotBomPartGroupRow[] = readSheetRows(wb, 'PART_GROUPS')
      .filter((r) => !isCompletelyBlankRow(r))
      .map((r) => ({
        ...extractExtraNonEmptyFields(r, specs[3].columns),
        code_part_group: cleanCellStr(r.code_part_group),
        ...(cleanCellStr(r.code) ? { code: cleanCellStr(r.code) } : {}),
        libelle: cleanCellStr(r.libelle),
        ...(cleanCellStr(r.description) ? { description: cleanCellStr(r.description) } : {}),
        ...(cleanCellStr(r.domaine_technique)
          ? { domaine_technique: cleanCellStr(r.domaine_technique) }
          : {}),
        default_policy_tags: parsePdrExcelPolicyTags(r.default_policy_tags),
        ...(optionalNumberCell(r.sort_order) !== undefined
          ? { sort_order: optionalNumberCell(r.sort_order) }
          : {}),
        is_active: parseExcelBoolean(r.is_active, true),
      }));

    const partTypes: EntrepotBomPartTypeRow[] = readSheetRows(wb, 'PART_TYPES')
      .filter((r) => !isCompletelyBlankRow(r))
      .map((r) => ({
        ...extractExtraNonEmptyFields(r, specs[4].columns),
        code_part_type: cleanCellStr(r.code_part_type),
        code_part_group: cleanCellStr(r.code_part_group),
        libelle: cleanCellStr(r.libelle),
        ...(cleanCellStr(r.description) ? { description: cleanCellStr(r.description) } : {}),
        ...(cleanCellStr(r.domaine_technique)
          ? { domaine_technique: cleanCellStr(r.domaine_technique) }
          : {}),
      }));

    const partDesignations: EntrepotBomPartDesignationRow[] = readSheetRows(
      wb,
      'PART_DESIGNATIONS'
    )
      .filter((r) => !isCompletelyBlankRow(r))
      .map((r) => {
        const seuil = optionalNumberCell(r.seuil);
        return {
          ...extractExtraNonEmptyFields(r, specs[5].columns),
          ref: cleanCellStr(r.ref),
          code_part_type: cleanCellStr(r.code_part_type),
          ...(cleanCellStr(r.code_part_group)
            ? { code_part_group: cleanCellStr(r.code_part_group) }
            : {}),
          designation: cleanCellStr(r.designation),
          ...(cleanCellStr(r.id_diag) ? { id_diag: cleanCellStr(r.id_diag) } : {}),
          ...(seuil !== undefined ? { seuil } : {}),
          ...(cleanCellStr(r.emplacement) ? { emplacement: cleanCellStr(r.emplacement) } : {}),
          ...(cleanCellStr(r.matiere_nuance)
            ? { matiere_nuance: cleanCellStr(r.matiere_nuance) }
            : {}),
          ...(cleanCellStr(r.ref_plan) ? { ref_plan: cleanCellStr(r.ref_plan) } : {}),
          ...(cleanCellStr(r.dimensions_brut)
            ? { dimensions_brut: cleanCellStr(r.dimensions_brut) }
            : {}),
          ...(cleanCellStr(r.traitement_thermique)
            ? { traitement_thermique: cleanCellStr(r.traitement_thermique) }
            : {}),
          policy_tags: parsePdrExcelPolicyTags(r.policy_tags),
        };
      });

    return {
      ok: true,
      bundleType: 'ENTREPOT_BOM',
      sheetNames,
      payload: {
        bundleType: 'ENTREPOT_BOM',
        compGroups,
        compFamilies,
        compTemplates,
        partGroups,
        partTypes,
        partDesignations,
      },
    };
  }

  // CM_CATALOG
  const specs = TYPE_A_WORKBOOK_SPECS.CM_CATALOG.sheets;
  const categories: CmCatalogCategoryRow[] = readSheetRows(wb, 'CM_CATEGORIES')
    .filter((r) => !isCompletelyBlankRow(r))
    .map((r) => ({
      ...extractExtraNonEmptyFields(r, specs[0].columns),
      code_category: cleanCellStr(r.code_category),
      ...(cleanCellStr(r.libelle) ? { libelle: cleanCellStr(r.libelle) } : {}),
    }));

  const rawFaultRows = readSheetRows(wb, 'CM_FAULTS').filter((r) => !isCompletelyBlankRow(r));
  const faults: CmCatalogFaultRow[] = [];

  for (let i = 0; i < rawFaultRows.length; i++) {
    const r = rawFaultRows[i];
    const actionsParsed = parseActionsListCell(r.actions_list ?? r.actions);
    if (!actionsParsed.ok) {
      return {
        ok: false,
        code: 'SCHEMA_MISMATCH',
        sheetNames,
        message: `Ligne ${i + 1} (CM_FAULTS) : ${actionsParsed.message}`,
      };
    }

    const extra = extractExtraNonEmptyFields(r, [...specs[1].columns, 'actions']);
    faults.push({
      ...extra,
      code_fault: cleanCellStr(r.code_fault),
      code_category: cleanCellStr(r.code_category),
      panne: cleanCellStr(r.panne),
      actions: actionsParsed.actions,
    });
  }

  return {
    ok: true,
    bundleType: 'CM_CATALOG',
    sheetNames,
    payload: {
      bundleType: 'CM_CATALOG',
      categories,
      faults,
    },
  };
}
