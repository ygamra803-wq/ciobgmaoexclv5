import { useState, useRef, useMemo, useEffect, useCallback, type FormEvent } from 'react';
import { storageService } from '../../../../utils/storageService';
import { useSmartTableLoader } from '../../../hooks/useSmartTableLoader';
import { Logger } from '../../../../core/logger/LoggerService';
import { usePermission } from '../../../components/common/PermissionGate';
import { useTranslation } from '../../../../i18n/I18nContext';
import {
  isComponentNature,
  isPartNature,
  isWarehouseComponent,
  isWarehousePart,
} from '../../../../core/domain/EntrepotItem';
import { useGmaoStore } from '../../../../store/useGmaoStore';
import {
  MaterialPolicyTag,
  type ICompFamily,
  type ICompTemplate,
  type IDiagnostic,
  type IMachine,
  type IMachineFamily,
  type IMachineTemplate,
  type IMouvement,
  type IPartDesignation,
  type IPartGroup,
  type IPartType,
  type ITechnician,
  type IType,
  type IWarehouseItem,
  type IZone,
} from '../../../../types/domain';
import { getEffectivePolicyTags } from '../../../../domain/corrective/needRequestService';

export type EntrepotCatalogDiag = IPartDesignation & Partial<IDiagnostic>;
export type EntrepotCatalogType = IPartType & Partial<IType>;
export type EntrepotCatalogFamily = ICompFamily & Partial<IMachineFamily>;
export type EntrepotCatalogTemplate = ICompTemplate & Partial<IMachineTemplate>;

export interface EntrepotFormState {
  id_warehouse_item: string;
  designation: string;
  nature: string;
  id_family: string;
  family_prefix?: string;
  id_templates: string;
  id_type: string;
  id_diag: string;
  matiere_nuance: string;
  ref_plan: string;
  dimensions_brut: string;
  rattachement_type: string;
  id_machine_registered: string;
  id_zone: string;
  technician: string;
  status: string;
  emplacement: string;
  stockInitial: number;
  seuil: number;
  remarques: string;
  traitement_thermique: string;
  mode_reparation_defaut: string;
  tension_nominale: string | number;
  courant_nominal_a: string | number;
  indice_protection: string;
  type_fixation: string;
  policy_tags?: MaterialPolicyTag[];
}

export interface QuickModalState {
  isOpen: boolean;
  article: Record<string, unknown> | null;
  initialFlow: string;
  initialAction: string;
}

export interface EntrepotViewProps {
  warehouseItems?: IWarehouseItem[];
  _entrepotComponents?: IWarehouseItem[];
  families?: EntrepotCatalogFamily[];
  templates?: EntrepotCatalogTemplate[];
  types?: EntrepotCatalogType[];
  diagnostics?: EntrepotCatalogDiag[];
  compFamilies?: EntrepotCatalogFamily[];
  compTemplates?: EntrepotCatalogTemplate[];
  partGroups?: IPartGroup[];
  partTypes?: EntrepotCatalogType[];
  partDesignations?: EntrepotCatalogDiag[];
  zones?: IZone[];
  machines?: IMachine[];
  technicians?: ITechnician[];
  mouvements?: IMouvement[];
  whFamilyFilter?: string;
  setWhFamilyFilter?: (val: string) => void;
  whTemplateFilter?: string;
  setWhTemplateFilter?: (val: string) => void;
  whPartGroupFilter?: string;
  setWhPartGroupFilter?: (val: string) => void;
  whTypeFilter?: string;
  setWhTypeFilter?: (val: string) => void;
  whNatureFilter?: string;
  setWhNatureFilter?: (val: string) => void;
  whRattachementFilter?: string;
  setWhRattachementFilter?: (val: string) => void;
  whStatusFilter?: string;
  setWhStatusFilter?: (val: string) => void;
  whSearch?: string;
  setWhSearch?: (val: string) => void;
  onAddWarehouseItem?: (item: Partial<IWarehouseItem>) => void;
  onUpdateWarehouseItem?: (id: string, item: Partial<IWarehouseItem>) => void;
  onDeleteWarehouseItem?: (id: string) => void;
  onAddMouvement?: (mvt: Partial<IMouvement>) => void;
  onUpdateFamily?: (id: string, fam: Partial<EntrepotCatalogFamily>) => void;
  onNavigateToFamily?: (id?: string) => void;
  onNavigateToTemplate?: (id?: string) => void;
  onNavigateToPartGroups?: (id?: string) => void;
  onNavigateToType?: (id?: string) => void;
  onNavigateToPartTypes?: (id?: string) => void;
  onNavigateToDiag?: (id?: string) => void;
  onNavigateToZone?: (id?: string) => void;
  onNavigateToMachine?: (id?: string) => void;
  showToast?: (msg: string, type?: string) => void;
}

const getDiagId = (d: EntrepotCatalogDiag | null | undefined) =>
  d ? String(d.id_part || d.ref || d.id_diag || d.id || '') : '';

const getDiagLabel = (d: EntrepotCatalogDiag | null | undefined) =>
  d ? String(d.designation || d.libelle || '') : '';

const EMPTY_WAREHOUSE: IWarehouseItem[] = [];
const EMPTY_FAMILIES: EntrepotCatalogFamily[] = [];
const EMPTY_TEMPLATES: EntrepotCatalogTemplate[] = [];
const EMPTY_TYPES: EntrepotCatalogType[] = [];
const EMPTY_DIAGS: EntrepotCatalogDiag[] = [];
const EMPTY_PART_GROUPS: IPartGroup[] = [];
const EMPTY_ZONES: IZone[] = [];
const EMPTY_MACHINES: IMachine[] = [];
const EMPTY_TECHS: ITechnician[] = [];
const EMPTY_MVTS: IMouvement[] = [];

export function useEntrepotController({
  warehouseItems = EMPTY_WAREHOUSE,
  families: propFamilies = EMPTY_FAMILIES,
  templates: propTemplates = EMPTY_TEMPLATES,
  types: propTypes = EMPTY_TYPES,
  diagnostics: propDiagnostics = EMPTY_DIAGS,
  compFamilies = EMPTY_FAMILIES,
  compTemplates = EMPTY_TEMPLATES,
  partGroups: propPartGroups = EMPTY_PART_GROUPS,
  partTypes = EMPTY_TYPES,
  partDesignations = EMPTY_DIAGS,
  zones = EMPTY_ZONES,
  machines = EMPTY_MACHINES,
  technicians = EMPTY_TECHS,
  mouvements = EMPTY_MVTS,
  whFamilyFilter = 'ALL',
  setWhFamilyFilter,
  whTemplateFilter = 'ALL',
  setWhTemplateFilter,
  whPartGroupFilter,
  setWhPartGroupFilter,
  whTypeFilter = 'ALL',
  setWhTypeFilter,
  whNatureFilter = 'ALL',
  setWhNatureFilter,
  whRattachementFilter = 'ALL',
  setWhRattachementFilter,
  whStatusFilter = 'ALL',
  setWhStatusFilter,
  whSearch = '',
  setWhSearch,
  onAddWarehouseItem,
  onUpdateWarehouseItem,
  onDeleteWarehouseItem,
  onUpdateFamily,
  showToast,
}: EntrepotViewProps) {
  const { t } = useTranslation();
  const storePartGroups = useGmaoStore((s) => s.partGroups);
  const effectivePartGroups = useMemo(
    () =>
      propPartGroups && propPartGroups.length > 0
        ? propPartGroups
        : Array.isArray(storePartGroups)
          ? storePartGroups
          : [],
    [propPartGroups, storePartGroups]
  );
  const families = useMemo(
    () => (compFamilies && compFamilies.length > 0 ? compFamilies : propFamilies),
    [compFamilies, propFamilies]
  );
  const templates = useMemo(
    () => (compTemplates && compTemplates.length > 0 ? compTemplates : propTemplates),
    [compTemplates, propTemplates]
  );
  const types = useMemo(
    () => (partTypes && partTypes.length > 0 ? partTypes : propTypes),
    [partTypes, propTypes]
  );
  const diagnostics = useMemo(
    () => (partDesignations && partDesignations.length > 0 ? partDesignations : propDiagnostics),
    [partDesignations, propDiagnostics]
  );

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [toEdit, setToEdit] = useState<IWarehouseItem | null>(null);
  const [toDelete, setToDelete] = useState<IWarehouseItem | null>(null);
  const [selectedDetails, setSelectedDetails] = useState<IWarehouseItem | null>(null);
  const [showFormulasModal, setShowFormulasModal] = useState(false);

  // Quick Action / Movement Modal State
  const [activeActionMenuId, setActiveActionMenuId] = useState<string | number | null>(null);
  const [quickModalState, setQuickModalState] = useState<QuickModalState>({
    isOpen: false,
    article: null,
    initialFlow: 'Sortie Interne',
    initialAction: 'CORRECTIVE',
  });

  // Local filter states if not provided via props
  const [internalFamilyFilter, setInternalFamilyFilter] = useState('ALL');
  const [internalTemplateFilter, setInternalTemplateFilter] = useState('ALL');
  const [internalPartGroupFilter, setInternalPartGroupFilter] = useState('ALL');
  const [internalTypeFilter, setInternalTypeFilter] = useState('ALL');
  const [internalNatureFilter, setInternalNatureFilter] = useState('ALL');
  const [internalRattachementFilter, setInternalRattachementFilter] = useState('ALL');
  const [internalStatusFilter, setInternalStatusFilter] = useState('ALL');
  const [activeKpiFilter, setActiveKpiFilter] = useState('ALL');

  const currentFamilyFilter = whFamilyFilter !== undefined ? whFamilyFilter : internalFamilyFilter;
  const changeFamilyFilter = setWhFamilyFilter || setInternalFamilyFilter;

  const currentTemplateFilter =
    whTemplateFilter !== undefined ? whTemplateFilter : internalTemplateFilter;
  const changeTemplateFilter = setWhTemplateFilter || setInternalTemplateFilter;

  const currentPartGroupFilter =
    whPartGroupFilter !== undefined && whPartGroupFilter !== ''
      ? whPartGroupFilter
      : internalPartGroupFilter;
  const changePartGroupFilter = setWhPartGroupFilter || setInternalPartGroupFilter;

  const currentTypeFilter = whTypeFilter !== undefined ? whTypeFilter : internalTypeFilter;
  const changeTypeFilter = setWhTypeFilter || setInternalTypeFilter;

  const currentNatureFilter = whNatureFilter !== undefined ? whNatureFilter : internalNatureFilter;
  const changeNatureFilter = setWhNatureFilter || setInternalNatureFilter;

  const currentRattachementFilter =
    whRattachementFilter !== undefined ? whRattachementFilter : internalRattachementFilter;
  const changeRattachementFilter = setWhRattachementFilter || setInternalRattachementFilter;

  const currentStatusFilter = whStatusFilter !== undefined ? whStatusFilter : internalStatusFilter;
  const changeStatusFilter = setWhStatusFilter || setInternalStatusFilter;

  // Pagination & Sorting
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sortField, setSortField] = useState('id_warehouse_item');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const sortMenuRef = useRef<HTMLDivElement | null>(null);

  // Active Warehouse View Tab: 'COMPONENTS' | 'PARTS'
  const [activeWarehouseTab, setActiveWarehouseTab] = useState<'COMPONENTS' | 'PARTS'>(() =>
    whNatureFilter && isPartNature(whNatureFilter) ? 'PARTS' : 'COMPONENTS'
  );

  const handleTabSwitch = useCallback(
    (tabKey: 'COMPONENTS' | 'PARTS') => {
      setActiveWarehouseTab(tabKey);
      setCurrentPage(1);
      changeNatureFilter(tabKey === 'COMPONENTS' ? 'COMPONENT' : 'PART');
      setActiveKpiFilter('ALL');
    },
    [changeNatureFilter]
  );

  useEffect(() => {
    if (currentNatureFilter !== 'ALL') {
      if (isPartNature(currentNatureFilter) && activeWarehouseTab !== 'PARTS') {
        setActiveWarehouseTab('PARTS');
      } else if (isComponentNature(currentNatureFilter) && activeWarehouseTab !== 'COMPONENTS') {
        setActiveWarehouseTab('COMPONENTS');
      }
    }
  }, [currentNatureFilter, activeWarehouseTab]);

  // Debounce search
  const [localSearch, setLocalSearch] = useState(whSearch);

  useEffect(() => {
    setLocalSearch(whSearch);
  }, [whSearch]);

  useEffect(() => {
    const handler = setTimeout(() => {
      if (setWhSearch) setWhSearch(localSearch);
    }, 200);
    return () => clearTimeout(handler);
  }, [localSearch, setWhSearch]);

  const canDeleteStock = usePermission('stock.delete');
  const canEditStock = usePermission('stock.edit');
  const canCreateStock = usePermission('stock.create');
  const canCreateMovement = usePermission('movement.create');

  const activeTechnicians = useMemo(
    () =>
      (technicians || []).filter(
        (tech) =>
          tech &&
          tech.is_active !== false &&
          tech.actif !== false &&
          String(tech.statut || '').toUpperCase() !== 'ARCHIVE' &&
          String(tech.status || '').toUpperCase() !== 'ARCHIVEE'
      ),
    [technicians]
  );

  // Family component prefix map
  const [familyComponentCodes, setFamilyComponentCodes] = useState<Record<string, string>>(() => {
    const initialMap: Record<string, string> = {};
    (families || []).forEach((f) => {
      if (f.id_family && f.componentCode) {
        initialMap[f.id_family] = String(f.componentCode).toUpperCase().trim();
      }
    });

    try {
      const saved = storageService.getItem('gmao_family_component_codes_v1');
      if (saved) {
        if (typeof saved === 'object' && saved !== null) {
          Object.assign(initialMap, saved);
        } else if (typeof saved === 'string' && !saved.startsWith('WC:')) {
          try {
            const parsed = JSON.parse(saved);
            if (parsed && typeof parsed === 'object') {
              Object.assign(initialMap, parsed);
            }
          } catch {
            // Ignore non-JSON strings
          }
        }
      }
    } catch {
      // Ignore storage errors gracefully
    }

    (warehouseItems || []).forEach((item) => {
      if (isWarehouseComponent(item) && item.id_family && item.id_warehouse_item) {
        if (!initialMap[item.id_family]) {
          const match = String(item.id_warehouse_item).match(/^([A-Z0-9]+)-/i);
          if (match) {
            initialMap[item.id_family] = match[1].toUpperCase();
          }
        }
      }
    });

    if (!initialMap['FAM-EXT']) initialMap['FAM-EXT'] = 'EXT';
    if (!initialMap['FAM-MOT']) initialMap['FAM-MOT'] = 'MOT';
    if (!initialMap['FAM-POM']) initialMap['FAM-POM'] = 'POM';
    if (!initialMap['FAM-RED']) initialMap['FAM-RED'] = 'RED';
    if (!initialMap['FAM-EMB']) initialMap['FAM-EMB'] = 'EMB';
    if (!initialMap['FAM-USI']) initialMap['FAM-USI'] = 'USI';
    if (!initialMap['FAM-DEC']) initialMap['FAM-DEC'] = 'DEC';
    if (!initialMap['FAM-ASSEM']) initialMap['FAM-ASSEM'] = 'ASS';
    if (!initialMap['FAM-COUR']) initialMap['FAM-COUR'] = 'COUR';
    return initialMap;
  });

  useEffect(() => {
    try {
      storageService.setItem('gmao_family_component_codes_v1', familyComponentCodes);
    } catch {
      // Ignore storage errors gracefully
    }
  }, [familyComponentCodes]);

  const getNextFamilyComponentCode = useCallback(
    (familyId: string, customPrefix = '', items = warehouseItems) => {
      let prefix = customPrefix || familyComponentCodes[familyId] || '';
      if (!prefix && familyId) {
        const famObj = families.find((f) => f.id_family === familyId);
        if (famObj && famObj.componentCode) {
          prefix = famObj.componentCode;
        } else {
          const raw = (famObj ? famObj.libelle : familyId)
            .replace(/^FAM-?/i, '')
            .replace(/[^A-Z0-9]/gi, '')
            .toUpperCase()
            .slice(0, 4);
          prefix = raw || 'CMP';
        }
      }
      prefix = prefix.toUpperCase().trim();
      if (!prefix) return '';

      let maxIdx = 0;
      items.forEach((it) => {
        if (isWarehouseComponent(it)) {
          const code = String(it.id_warehouse_item || '').toUpperCase();
          if (code.startsWith(prefix + '-')) {
            const match = code.match(new RegExp(`^${prefix}-(\\d+)`, 'i'));
            if (match) {
              const n = parseInt(match[1], 10);
              if (!isNaN(n) && n > maxIdx) maxIdx = n;
            }
          }
        }
      });
      return `${prefix}-${String(maxIdx + 1).padStart(2, '0')}`;
    },
    [warehouseItems, familyComponentCodes, families]
  );

  const getNextPartRef = useCallback(
    (typeId: string, items = warehouseItems) => {
      if (!typeId) return 'PART-01';
      let prefix = '';
      const clean = String(typeId).toUpperCase();
      if (clean.includes('VIS') || clean.includes('FIX')) prefix = 'VIS';
      else if (clean.includes('ROUL') || clean.includes('MEC')) prefix = 'ROUL';
      else if (clean.includes('RACC') || clean.includes('PNE')) prefix = 'RACC';
      else if (clean.includes('ELE') || clean.includes('CAPT')) prefix = 'ELEC';
      else if (clean.includes('COU') || clean.includes('LAME')) prefix = 'COU';
      else if (clean.includes('CON') || clean.includes('POLY')) prefix = 'CONS';
      else if (clean.includes('OUT')) prefix = 'OUT';
      else {
        prefix = clean.replace(/^TYPE-?/i, '').replace(/[^A-Z0-9]/g, '').slice(0, 4) || 'PART';
      }

      let maxIdx = 0;
      items.forEach((it) => {
        if (isWarehousePart(it)) {
          const code = String(it.id_warehouse_item || it.ref || '').toUpperCase();
          if (code.startsWith(prefix + '-') || code.startsWith(prefix)) {
            const match = code.match(new RegExp(`^${prefix}[-_]?(\\d+)`, 'i'));
            if (match) {
              const n = parseInt(match[1], 10);
              if (!isNaN(n) && n > maxIdx) maxIdx = n;
            }
          }
        }
      });
      return `${prefix}-${String(maxIdx + 1).padStart(2, '0')}`;
    },
    [warehouseItems]
  );

  const handleCascadeFamilyPrefixUpdate = useCallback(
    (familyId: string, newPrefix: string) => {
      if (!canEditStock && !canCreateStock) return;
      const cleanPrefix = (newPrefix || '').toUpperCase().replace(/[^A-Z0-9]/g, '').trim();
      if (!familyId || !cleanPrefix) return;

      setFamilyComponentCodes((prev) => ({ ...prev, [familyId]: cleanPrefix }));

      if (onUpdateFamily) {
        const fam = families.find((f) => f.id_family === familyId);
        if (fam) {
          onUpdateFamily(familyId, { ...fam, componentCode: cleanPrefix });
        }
      }

      if (onUpdateWarehouseItem) {
        const matchingComponents = warehouseItems.filter(
          (it) => isWarehouseComponent(it) && it.id_family === familyId
        );

        matchingComponents.forEach((item, index) => {
          const oldCode = item.id_warehouse_item;
          const numMatch = String(oldCode).match(/-(\d+)$/);
          const seqNum = numMatch ? numMatch[1] : String(index + 1).padStart(2, '0');
          const newCode = `${cleanPrefix}-${seqNum}`;

          if (oldCode !== newCode) {
            onUpdateWarehouseItem(oldCode, { ...item, id_warehouse_item: newCode });
          }
        });
      }
    },
    [canEditStock, canCreateStock, onUpdateFamily, families, onUpdateWarehouseItem, warehouseItems]
  );

  const [addForm, setAddForm] = useState<EntrepotFormState>({
    id_warehouse_item: '',
    designation: '',
    nature: 'COMPONENT',
    id_family: '',
    family_prefix: '',
    id_templates: '',
    id_type: '',
    id_diag: '',
    matiere_nuance: '',
    ref_plan: '',
    dimensions_brut: '',
    rattachement_type: 'ENTREPOT',
    id_machine_registered: '',
    id_zone: '',
    technician: '',
    status: 'En stock (Disponible)',
    emplacement: 'E-MAG-01',
    stockInitial: 1,
    seuil: 0,
    remarques: '',
    traitement_thermique: '',
    mode_reparation_defaut: 'NON_DEFINI',
    tension_nominale: '',
    courant_nominal_a: '',
    indice_protection: '',
    type_fixation: '',
    policy_tags: ['REPAIRABLE', 'REPLACING'] as MaterialPolicyTag[],
  });

  const [editForm, setEditForm] = useState<EntrepotFormState>({
    id_warehouse_item: '',
    designation: '',
    nature: 'COMPONENT',
    id_family: '',
    id_templates: '',
    id_type: '',
    id_diag: '',
    matiere_nuance: '',
    ref_plan: '',
    dimensions_brut: '',
    traitement_thermique: '',
    mode_reparation_defaut: 'NON_DEFINI',
    tension_nominale: '',
    courant_nominal_a: '',
    indice_protection: '',
    type_fixation: '',
    rattachement_type: 'ENTREPOT',
    id_machine_registered: '',
    id_zone: '',
    technician: '',
    status: 'En stock (Disponible)',
    emplacement: '',
    stockInitial: 1,
    seuil: 0,
    remarques: '',
    policy_tags: ['REPAIRABLE', 'REPLACING'] as MaterialPolicyTag[],
  });

  const handleOpenAddModal = useCallback(() => {
    if (!canCreateStock) return;
    if (activeWarehouseTab === 'PARTS') {
      const defaultType = types[0]?.id_type || 'TYPE-MEC';
      const relDiags = diagnostics.filter((d) => d.id_type === defaultType);
      const defaultDiagObj = relDiags[0] || null;
      const defaultDiag = getDiagId(defaultDiagObj);
      const autoCode = getNextPartRef(defaultType);

      setAddForm({
        id_warehouse_item: autoCode,
        designation: getDiagLabel(defaultDiagObj),
        nature: 'PART',
        id_family: '',
        family_prefix: '',
        id_templates: '',
        id_type: defaultType,
        id_diag: defaultDiag,
        matiere_nuance: defaultDiagObj?.matiere_nuance || '',
        ref_plan: defaultDiagObj?.ref_plan || '',
        dimensions_brut: defaultDiagObj?.dimensions_brut || '',
        traitement_thermique: defaultDiagObj?.traitement_thermique || '',
        mode_reparation_defaut: 'NON_DEFINI',
        tension_nominale: '',
        courant_nominal_a: '',
        indice_protection: '',
        type_fixation: '',
        rattachement_type: 'ENTREPOT',
        id_machine_registered: '',
        id_zone: zones[0]?.id_zone || '',
        technician: activeTechnicians[0]?.nom || '',
        status: 'En stock (Disponible)',
        emplacement: defaultDiagObj?.emplacement || 'E-MAG-PDR-01',
        stockInitial: 1,
        seuil: defaultDiagObj?.seuil != null ? defaultDiagObj.seuil : 0,
        remarques: '',
      });
    } else {
      const defaultFam = families[0]?.id_family || 'FAM-MOT';
      const relTemplates = templates.filter((tpl) => tpl.id_family === defaultFam);
      const defaultTpl = relTemplates[0]?.id_templates || templates[0]?.id_templates || '';
      const prefix = familyComponentCodes[defaultFam] || '';
      const autoCode = getNextFamilyComponentCode(defaultFam, prefix);
      const defaultTplObj = templates.find((tpl) => tpl.id_templates === defaultTpl);

      setAddForm({
        id_warehouse_item: autoCode,
        designation: defaultTplObj ? defaultTplObj.libelle : '',
        nature: 'COMPONENT',
        id_family: defaultFam,
        family_prefix: prefix,
        id_templates: defaultTpl,
        id_type: types[0]?.id_type || 'TYPE-MEC',
        id_diag: '',
        matiere_nuance: '',
        ref_plan: '',
        dimensions_brut: '',
        traitement_thermique: '',
        mode_reparation_defaut: defaultTplObj?.mode_reparation_defaut || 'NON_DEFINI',
        tension_nominale: String(defaultTplObj?.tension_nominale || defaultTplObj?.specs?.V || ''),
        courant_nominal_a: String(defaultTplObj?.courant_nominal_a || defaultTplObj?.specs?.A || ''),
        indice_protection: defaultTplObj?.indice_protection || '',
        type_fixation: defaultTplObj?.type_fixation || '',
        rattachement_type: 'ENTREPOT',
        id_machine_registered: '',
        id_zone: zones[0]?.id_zone || '',
        technician: activeTechnicians[0]?.nom || '',
        status: 'En stock (Disponible)',
        emplacement: 'E-MAG-A01',
        stockInitial: 1,
        seuil: 0,
        remarques: '',
      });
    }
    setShowAddModal(true);
  }, [
    canCreateStock,
    activeWarehouseTab,
    types,
    diagnostics,
    getNextPartRef,
    zones,
    activeTechnicians,
    families,
    templates,
    familyComponentCodes,
    getNextFamilyComponentCode,
  ]);

  const handleAddNatureSwitch = useCallback(
    (newNature: string) => {
      if (isComponentNature(newNature)) {
        const defaultFam = addForm.id_family || families[0]?.id_family || 'FAM-MOT';
        const relTemplates = templates.filter((tpl) => tpl.id_family === defaultFam);
        const defaultTpl = relTemplates[0]?.id_templates || '';
        const prefix = addForm.family_prefix || familyComponentCodes[defaultFam] || '';
        const autoCode = getNextFamilyComponentCode(defaultFam, prefix);
        const defaultTplObj = templates.find((tpl) => tpl.id_templates === defaultTpl);

        setAddForm((prev) => ({
          ...prev,
          nature: 'COMPONENT',
          id_family: defaultFam,
          family_prefix: prefix,
          id_templates: defaultTpl,
          id_warehouse_item: autoCode,
          designation: defaultTplObj ? defaultTplObj.libelle : prev.designation,
        }));
      } else {
        const defaultType = addForm.id_type || types[0]?.id_type || 'TYPE-MEC';
        const relDiags = diagnostics.filter((d) => d.id_type === defaultType);
        const defaultDiagObj = relDiags[0] || null;
        const defaultDiag = getDiagId(defaultDiagObj);
        const autoCode = getNextPartRef(defaultType);

        setAddForm((prev) => ({
          ...prev,
          nature: 'PART',
          id_type: defaultType,
          id_diag: defaultDiag,
          id_warehouse_item: autoCode,
          designation: defaultDiagObj ? getDiagLabel(defaultDiagObj) : prev.designation,
          emplacement: defaultDiagObj?.emplacement || prev.emplacement,
          seuil: defaultDiagObj?.seuil != null ? defaultDiagObj.seuil : prev.seuil,
        }));
      }
    },
    [
      addForm.id_family,
      addForm.family_prefix,
      addForm.id_type,
      families,
      templates,
      familyComponentCodes,
      getNextFamilyComponentCode,
      types,
      diagnostics,
      getNextPartRef,
    ]
  );

  const handleOpenEditModal = useCallback(
    (item: IWarehouseItem) => {
      if (!canEditStock) return;
      const linkedDiag = diagnostics.find(
        (d: EntrepotCatalogDiag) => (d.id_part || d.ref || d.id_diag || d.id) === item.id_diag
      );
      const linkedTpl = templates.find(
        (tItem: EntrepotCatalogTemplate) => tItem.id_templates === item.id_templates
      );
      setToEdit(item);
      setEditForm({
        id_warehouse_item: item.id_warehouse_item || '',
        designation: item.designation || '',
        nature: item.nature || 'COMPONENT',
        id_family: item.id_family || '',
        id_templates: item.id_templates || '',
        id_type: item.id_type || '',
        id_diag: item.id_diag || '',
        matiere_nuance: item.matiere_nuance || linkedDiag?.matiere_nuance || '',
        ref_plan: item.ref_plan || linkedDiag?.ref_plan || '',
        dimensions_brut: item.dimensions_brut || linkedDiag?.dimensions_brut || '',
        traitement_thermique: item.traitement_thermique || linkedDiag?.traitement_thermique || '',
        mode_reparation_defaut: item.mode_reparation_defaut || linkedTpl?.mode_reparation_defaut || 'NON_DEFINI',
        tension_nominale: String(item.tension_nominale || linkedTpl?.tension_nominale || linkedTpl?.specs?.V || ''),
        courant_nominal_a: String(
          item.courant_nominal_a != null
            ? item.courant_nominal_a
            : linkedTpl?.courant_nominal_a || linkedTpl?.specs?.A || ''
        ),
        indice_protection: item.indice_protection || linkedTpl?.indice_protection || '',
        type_fixation: item.type_fixation || linkedTpl?.type_fixation || '',
        rattachement_type: item.rattachement_type || 'ENTREPOT',
        id_machine_registered: item.id_machine_registered || '',
        id_zone: item.id_zone || '',
        technician: item.technician || '',
        status: item.status || 'En service',
        emplacement: item.emplacement || '',
        stockInitial: item.stockInitial != null ? item.stockInitial : 1,
        seuil: item.seuil != null ? item.seuil : 0,
        remarques: item.remarques || '',
        policy_tags: getEffectivePolicyTags(item, isComponentNature(item.nature) ? 'COMPONENT' : 'PART'),
      });
      setActiveActionMenuId(null);
    },
    [canEditStock, diagnostics, templates]
  );

  const handleOpenQuickModal = useCallback(
    (item: IWarehouseItem, flow: string, action: string) => {
      if (!canCreateMovement) return;
      const adaptedArticle = {
        id: item.id_warehouse_item,
        ref: item.id_warehouse_item,
        designation: item.designation,
        stockInitial: item.stockInitial || 1,
        entrees: item.entrees || 0,
        sorties: item.sorties || 0,
        stockActuel: item.stockActuel != null ? item.stockActuel : item.stockInitial || 1,
        seuil: item.seuil || 0,
        alerte: item.alerte || 'OK',
        emplacement: item.emplacement || '',
      };
      setQuickModalState({
        isOpen: true,
        article: adaptedArticle,
        initialFlow: flow,
        initialAction: action,
      });
      setActiveActionMenuId(null);
    },
    [canCreateMovement]
  );

  const availableAddTemplates = useMemo(
    () => (addForm.id_family ? templates.filter((tpl) => tpl.id_family === addForm.id_family) : templates),
    [addForm.id_family, templates]
  );

  const availableAddDiags = useMemo(
    () => (addForm.id_type ? diagnostics.filter((d) => d.id_type === addForm.id_type) : diagnostics),
    [addForm.id_type, diagnostics]
  );

  const handleAddFamilyChange = useCallback(
    (newFam: string) => {
      const relTpl = templates.filter((tpl) => tpl.id_family === newFam);
      const newTpl = relTpl[0]?.id_templates || '';
      const prefix = familyComponentCodes[newFam] || '';
      const autoCode = getNextFamilyComponentCode(newFam, prefix);
      const tplObj = templates.find((tpl) => tpl.id_templates === newTpl);

      setAddForm((prev) => ({
        ...prev,
        id_family: newFam,
        family_prefix: prefix,
        id_templates: newTpl,
        id_warehouse_item: autoCode,
        designation: tplObj ? tplObj.libelle : prev.designation,
      }));
    },
    [templates, familyComponentCodes, getNextFamilyComponentCode]
  );

  const handleAddFamilyPrefixChange = useCallback(
    (newPrefix: string) => {
      const cleanPrefix = newPrefix.toUpperCase().replace(/[^A-Z0-9]/g, '');
      const autoCode = getNextFamilyComponentCode(addForm.id_family, cleanPrefix);

      setAddForm((prev) => ({
        ...prev,
        family_prefix: cleanPrefix,
        id_warehouse_item: autoCode || prev.id_warehouse_item,
      }));
    },
    [addForm.id_family, getNextFamilyComponentCode]
  );

  const handleAddTemplateChange = useCallback(
    (newTpl: string) => {
      const tplObj = templates.find((tpl) => tpl.id_templates === newTpl);
      setAddForm((prev) => ({
        ...prev,
        id_templates: newTpl,
        designation: tplObj ? String(tplObj.libelle || prev.designation) : prev.designation,
        mode_reparation_defaut: String(tplObj?.mode_reparation_defaut || prev.mode_reparation_defaut || 'NON_DEFINI'),
        tension_nominale: String(tplObj?.tension_nominale || tplObj?.specs?.V || prev.tension_nominale || ''),
        courant_nominal_a: String(tplObj?.courant_nominal_a || tplObj?.specs?.A || prev.courant_nominal_a || ''),
        indice_protection: String(tplObj?.indice_protection || prev.indice_protection || ''),
        type_fixation: String(tplObj?.type_fixation || prev.type_fixation || ''),
      }));
    },
    [templates]
  );

  const handleAddTypeChange = useCallback(
    (newType: string) => {
      const relDiags = diagnostics.filter((d) => d.id_type === newType);
      const diagObj = relDiags[0] || null;
      const newDiag = getDiagId(diagObj);
      const autoCode = getNextPartRef(newType);

      setAddForm((prev) => ({
        ...prev,
        id_type: newType,
        id_diag: newDiag,
        id_warehouse_item: autoCode,
        designation: diagObj ? getDiagLabel(diagObj) : prev.designation,
        matiere_nuance: diagObj?.matiere_nuance || '',
        ref_plan: diagObj?.ref_plan || '',
        dimensions_brut: diagObj?.dimensions_brut || '',
        traitement_thermique: diagObj?.traitement_thermique || '',
        emplacement: diagObj?.emplacement || prev.emplacement,
        seuil: diagObj?.seuil != null ? diagObj.seuil : prev.seuil,
      }));
    },
    [diagnostics, getNextPartRef]
  );

  const handleAddDiagChange = useCallback(
    (newDiag: string) => {
      const diagObj = diagnostics.find(
        (d) => (d.id_part || d.ref || d.id_diag || d.id) === newDiag
      );
      const diagLabel = diagObj ? diagObj.designation || diagObj.libelle || '' : '';
      setAddForm((prev) => ({
        ...prev,
        id_diag: newDiag,
        designation: diagLabel || prev.designation,
        matiere_nuance: diagObj?.matiere_nuance || prev.matiere_nuance || '',
        ref_plan: diagObj?.ref_plan || prev.ref_plan || '',
        dimensions_brut: diagObj?.dimensions_brut || prev.dimensions_brut || '',
        traitement_thermique: diagObj?.traitement_thermique || prev.traitement_thermique || '',
        emplacement: diagObj?.emplacement || prev.emplacement,
        seuil: diagObj?.seuil != null ? diagObj.seuil : prev.seuil,
      }));
    },
    [diagnostics]
  );

  const handleSubmitAdd = useCallback(
    (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!canCreateStock) return;
      if (!addForm.id_warehouse_item || !addForm.designation) {
        showToast?.('Veuillez renseigner le code et la désignation.', 'warning');
        return;
      }

      const isComp = isComponentNature(addForm.nature);
      if (isComp && addForm.id_family) {
        const match = String(addForm.id_warehouse_item).match(/^([A-Z0-9]+)-/i);
        const prefixToSave = (addForm.family_prefix || (match ? match[1] : '')).toUpperCase().trim();
        if (prefixToSave) {
          handleCascadeFamilyPrefixUpdate(addForm.id_family, prefixToSave);
        }
      }

      if (onAddWarehouseItem) {
        const matchedPartType = !isComp
          ? types.find((tObj: EntrepotCatalogType) => tObj.id_type === addForm.id_type)
          : null;
        const inheritedPartGroup = !isComp
          ? String(matchedPartType?.id_group || matchedPartType?.id_groupe || '').trim() || undefined
          : undefined;
        onAddWarehouseItem({
          id_warehouse_item: addForm.id_warehouse_item.trim().toUpperCase(),
          designation: addForm.designation.trim(),
          nature: isComp ? 'COMPONENT' : 'PART',
          id_family: isComp ? addForm.id_family : '',
          id_templates: isComp ? addForm.id_templates : '',
          id_group: inheritedPartGroup,
          id_type: !isComp ? addForm.id_type : '',
          id_diag: !isComp ? addForm.id_diag : '',
          matiere_nuance: !isComp ? String(addForm.matiere_nuance || '').trim() : undefined,
          ref_plan: !isComp ? String(addForm.ref_plan || '').trim() : undefined,
          dimensions_brut: !isComp ? String(addForm.dimensions_brut || '').trim() : undefined,
          traitement_thermique: !isComp ? String(addForm.traitement_thermique || '').trim() || undefined : undefined,
          mode_reparation_defaut: isComp ? addForm.mode_reparation_defaut || 'NON_DEFINI' : undefined,
          tension_nominale: isComp ? String(addForm.tension_nominale || '').trim() || undefined : undefined,
          courant_nominal_a: isComp ? String(addForm.courant_nominal_a || '').trim() || undefined : undefined,
          indice_protection: isComp ? String(addForm.indice_protection || '').trim() || undefined : undefined,
          type_fixation: isComp ? String(addForm.type_fixation || '').trim() || undefined : undefined,
          rattachement_type: addForm.rattachement_type,
          id_machine_registered: addForm.rattachement_type === 'MACHINE' ? addForm.id_machine_registered : '',
          id_zone: addForm.rattachement_type === 'ZONE' ? addForm.id_zone : '',
          technician: addForm.technician,
          status: addForm.status,
          emplacement: addForm.emplacement,
          stockInitial: Number(addForm.stockInitial) || 1,
          seuil: Number(addForm.seuil) || 0,
          remarques: addForm.remarques,
          policy_tags:
            addForm.policy_tags && addForm.policy_tags.length > 0
              ? addForm.policy_tags
              : ['REPAIRABLE', 'REPLACING'],
        });
      }
      setShowAddModal(false);
    },
    [canCreateStock, addForm, showToast, handleCascadeFamilyPrefixUpdate, onAddWarehouseItem, types]
  );

  const handleSubmitEdit = useCallback(
    (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!canEditStock || !toEdit) return;
      if (!editForm.designation) {
        showToast?.('La désignation est obligatoire.', 'warning');
        return;
      }

      if (onUpdateWarehouseItem) {
        const isComp = isComponentNature(editForm.nature);
        const matchedPartType = !isComp
          ? types.find((tObj: EntrepotCatalogType) => tObj.id_type === editForm.id_type)
          : null;
        const inheritedPartGroup = !isComp
          ? String(
              matchedPartType?.id_group ||
                matchedPartType?.id_groupe ||
                toEdit.id_group ||
                toEdit.id_groupe ||
                ''
            ).trim() || undefined
          : undefined;
        onUpdateWarehouseItem(String(toEdit.id_warehouse_item || ''), {
          ...toEdit,
          designation: editForm.designation.trim(),
          nature: editForm.nature,
          id_family: isComp ? editForm.id_family : '',
          id_templates: isComp ? editForm.id_templates : '',
          id_group: inheritedPartGroup,
          id_type: !isComp ? editForm.id_type : '',
          id_diag: !isComp ? editForm.id_diag : '',
          matiere_nuance: !isComp ? String(editForm.matiere_nuance || '').trim() : undefined,
          ref_plan: !isComp ? String(editForm.ref_plan || '').trim() : undefined,
          dimensions_brut: !isComp ? String(editForm.dimensions_brut || '').trim() : undefined,
          traitement_thermique: !isComp ? String(editForm.traitement_thermique || '').trim() || undefined : undefined,
          mode_reparation_defaut: isComp ? editForm.mode_reparation_defaut || 'NON_DEFINI' : undefined,
          tension_nominale: isComp ? String(editForm.tension_nominale || '').trim() || undefined : undefined,
          courant_nominal_a: isComp ? String(editForm.courant_nominal_a || '').trim() || undefined : undefined,
          indice_protection: isComp ? String(editForm.indice_protection || '').trim() || undefined : undefined,
          type_fixation: isComp ? String(editForm.type_fixation || '').trim() || undefined : undefined,
          rattachement_type: editForm.rattachement_type,
          id_machine_registered: editForm.rattachement_type === 'MACHINE' ? editForm.id_machine_registered : '',
          id_zone: editForm.rattachement_type === 'ZONE' ? editForm.id_zone : '',
          technician: editForm.technician,
          status: editForm.status,
          emplacement: editForm.emplacement,
          stockInitial: Number(editForm.stockInitial) || 1,
          seuil: Number(editForm.seuil) || 0,
          remarques: editForm.remarques,
          policy_tags:
            editForm.policy_tags && editForm.policy_tags.length > 0
              ? editForm.policy_tags
              : toEdit.policy_tags || ['REPAIRABLE', 'REPLACING'],
        });
      }
      setToEdit(null);
    },
    [canEditStock, toEdit, editForm, showToast, onUpdateWarehouseItem, types]
  );

  const handleConfirmDelete = useCallback(() => {
    if (!canDeleteStock) return;
    if (toDelete && onDeleteWarehouseItem) {
      onDeleteWarehouseItem(toDelete.id_warehouse_item);
    }
    setToDelete(null);
  }, [canDeleteStock, toDelete, onDeleteWarehouseItem]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      if (sortMenuRef.current && target && !sortMenuRef.current.contains(target)) {
        setShowSortMenu(false);
      }
      if (target && !target.closest('.action-menu-container')) {
        setActiveActionMenuId(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const machineMotorCounts = useMemo(() => {
    const map: Record<string, string[]> = {};
    (warehouseItems || []).forEach((item) => {
      const mId = item.id_machine_registered || item.id_machine;
      if (mId && isWarehouseComponent(item)) {
        if (!map[mId]) map[mId] = [];
        map[mId].push(item.code || item.id_warehouse_item);
      }
    });
    return map;
  }, [warehouseItems]);

  const filteredItems = useMemo(() => {
    return warehouseItems.filter((item) => {
      const rec = item as Record<string, unknown>;
      const statusUpper = String(rec.statut || rec.status || rec.etat || '')
        .trim()
        .toUpperCase();
      const isArchived =
        rec.is_active === false ||
        rec.actif === false ||
        rec.archived === true ||
        statusUpper === 'ARCHIVE' ||
        statusUpper === 'ARCHIVEE' ||
        statusUpper === 'ARCHIVED';
      if (isArchived && String(currentStatusFilter).trim().toUpperCase() !== 'ARCHIVE') {
        return false;
      }

      const itemIsComp = isWarehouseComponent(item);
      const itemIsPart = !itemIsComp;

      if (activeWarehouseTab === 'COMPONENTS' && !itemIsComp) return false;
      if (activeWarehouseTab === 'PARTS' && !itemIsPart) return false;

      if (currentNatureFilter !== 'ALL') {
        if (isComponentNature(currentNatureFilter) && !itemIsComp) return false;
        if (isPartNature(currentNatureFilter) && !itemIsPart) return false;
      }

      const stLower = String(item.status || (item as Record<string, unknown>).statut || item.etat || '').toLowerCase();
      const isInServiceStatus =
        stLower.includes('service') || stLower === 'actif' || stLower.includes('monté') || stLower.includes('monte');
      const isInStockStatus =
        stLower.includes('stock') ||
        stLower.includes('dispo') ||
        stLower.includes('retourné') ||
        stLower.includes('retourne') ||
        stLower.includes('terminé atelier') ||
        stLower.includes('termine atelier');
      const isUnderRevisionStatus =
        !isInStockStatus &&
        (stLower.includes('rev') ||
          stLower.includes('rév') ||
          stLower.includes('ext') ||
          stLower.includes('réparation') ||
          stLower.includes('reparation') ||
          stLower.includes('atelier'));

      if (isComponentNature(activeKpiFilter) && !itemIsComp) return false;
      if (isPartNature(activeKpiFilter) && !itemIsPart) return false;
      if (activeKpiFilter === 'SERVICE' && !isInServiceStatus) return false;
      if (activeKpiFilter === 'RESERVE' && !isInStockStatus) {
        return false;
      }

      if (itemIsComp && currentFamilyFilter !== 'ALL' && item.id_family !== currentFamilyFilter) return false;
      if (itemIsComp && currentTemplateFilter !== 'ALL' && item.id_templates !== currentTemplateFilter) return false;

      if (itemIsPart && currentPartGroupFilter !== 'ALL') {
        const typeObj = types.find((tObj: EntrepotCatalogType) => tObj.id_type === item.id_type);
        const itemGrp = String(
          item.id_group || item.id_groupe || typeObj?.id_group || typeObj?.id_groupe || ''
        )
          .trim()
          .toUpperCase();
        if (currentPartGroupFilter === 'UNASSIGNED') {
          if (itemGrp) return false;
        } else if (itemGrp !== String(currentPartGroupFilter).trim().toUpperCase()) {
          return false;
        }
      }

      if (itemIsPart && currentTypeFilter !== 'ALL' && item.id_type !== currentTypeFilter) return false;
      if (currentRattachementFilter !== 'ALL' && item.rattachement_type !== currentRattachementFilter) return false;

      if (currentStatusFilter !== 'ALL') {
        const filterStatus = String(currentStatusFilter).toLowerCase();
        if (filterStatus.includes('service')) {
          if (!isInServiceStatus) return false;
        } else if (filterStatus.includes('stock') || filterStatus.includes('dispo')) {
          if (!isInStockStatus) return false;
        } else if (filterStatus.includes('rev') || filterStatus.includes('rév') || filterStatus.includes('ext')) {
          if (!isUnderRevisionStatus) return false;
        } else if (!stLower.includes(filterStatus)) {
          return false;
        }
      }

      if (localSearch) {
        const q = localSearch.trim().toLowerCase();
        const code = String(item.code || item.id_warehouse_item || '').toLowerCase();
        const ref = String(item.ref || '').toLowerCase();
        const passport = String(item.id || '').toLowerCase();
        const desig = String(item.designation || '').toLowerCase();
        const fam = String(item.id_family || '').toLowerCase();
        const tpl = String(item.id_templates || '').toLowerCase();
        const grp = String(item.id_group || item.id_groupe || '').toLowerCase();
        const typ = String(item.id_type || '').toLowerCase();
        const diag = String(item.id_diag || '').toLowerCase();
        const tech = String(item.technician || '').toLowerCase();
        const mch = String(item.id_machine_registered || item.id_machine || '').toLowerCase();
        const zn = String(item.id_zone || item.zone || '').toLowerCase();
        const empl = String(item.emplacement || '').toLowerCase();
        const bobinageStr = (item.historique_bobinage || [])
          .map((b) => `${b.cause || ''} ${b.technicien_demontage || ''} ${b.societe_bobinage || ''} ${b.statut_bobinage || ''}`)
          .join(' ')
          .toLowerCase();

        return (
          code.includes(q) ||
          ref.includes(q) ||
          passport.includes(q) ||
          desig.includes(q) ||
          fam.includes(q) ||
          tpl.includes(q) ||
          grp.includes(q) ||
          typ.includes(q) ||
          diag.includes(q) ||
          tech.includes(q) ||
          mch.includes(q) ||
          zn.includes(q) ||
          empl.includes(q) ||
          bobinageStr.includes(q)
        );
      }

      return true;
    });
  }, [
    warehouseItems,
    types,
    activeWarehouseTab,
    currentNatureFilter,
    activeKpiFilter,
    currentFamilyFilter,
    currentTemplateFilter,
    currentPartGroupFilter,
    currentTypeFilter,
    currentRattachementFilter,
    currentStatusFilter,
    localSearch,
  ]);

  useEffect(() => {
    setCurrentPage(1);
  }, [
    currentNatureFilter,
    activeKpiFilter,
    currentFamilyFilter,
    currentTemplateFilter,
    currentPartGroupFilter,
    currentTypeFilter,
    currentRattachementFilter,
    currentStatusFilter,
    localSearch,
    sortField,
    sortOrder,
  ]);

  const sortedData = useMemo(() => {
    if (!sortField) return filteredItems;
    return [...filteredItems].sort((a, b) => {
      let valA: string | number = (a as Record<string, unknown>)[sortField] as string | number;
      let valB: string | number = (b as Record<string, unknown>)[sortField] as string | number;

      if (['stockInitial', 'entrees', 'sorties', 'stockActuel', 'seuil'].includes(sortField)) {
        valA = Number(valA || 0);
        valB = Number(valB || 0);
      } else {
        valA = String(valA || '').toLowerCase();
        valB = String(valB || '').toLowerCase();
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredItems, sortField, sortOrder]);

  const totalItems = sortedData.length;
  const effectivePageSize = pageSize === 0 ? totalItems : pageSize;
  const startIndex = (currentPage - 1) * effectivePageSize;
  const rawDisplayedData = useMemo(
    () => (pageSize === 0 ? sortedData : sortedData.slice(startIndex, startIndex + effectivePageSize)),
    [pageSize, sortedData, startIndex, effectivePageSize]
  );

  const { isDataReady: isTableReady } = useSmartTableLoader(rawDisplayedData);

  const handleSort = useCallback(
    (field: string) => {
      if (sortField === field) {
        setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortField(field);
        setSortOrder('asc');
      }
    },
    [sortField]
  );

  const kpis = useMemo(() => {
    let components = 0;
    let parts = 0;
    let enService = 0;
    let enStock = 0;
    let enRevision = 0;

    warehouseItems.forEach((item) => {
      if (isWarehouseComponent(item)) components++;
      else parts++;

      const st = String(item.status || (item as Record<string, unknown>).statut || item.etat || '').toLowerCase();
      const inStock =
        st.includes('stock') ||
        st.includes('dispo') ||
        st.includes('retourné') ||
        st.includes('retourne') ||
        st.includes('terminé atelier') ||
        st.includes('termine atelier');
      if (st.includes('service') || st === 'actif' || st.includes('monté') || st.includes('monte')) enService++;
      else if (inStock) enStock++;
      else if (
        st.includes('rev') ||
        st.includes('rév') ||
        st.includes('ext') ||
        st.includes('réparation') ||
        st.includes('reparation') ||
        st.includes('atelier')
      )
        enRevision++;
    });

    return {
      total: warehouseItems.length,
      components,
      parts,
      enService,
      enStock,
      enRevision,
    };
  }, [warehouseItems]);

  const hasActiveFilters = Boolean(
    currentNatureFilter !== 'ALL' ||
      activeKpiFilter !== 'ALL' ||
      currentFamilyFilter !== 'ALL' ||
      currentTemplateFilter !== 'ALL' ||
      currentPartGroupFilter !== 'ALL' ||
      currentTypeFilter !== 'ALL' ||
      currentRattachementFilter !== 'ALL' ||
      currentStatusFilter !== 'ALL' ||
      localSearch ||
      sortField !== 'id_warehouse_item' ||
      sortOrder !== 'asc'
  );

  const clearAllFilters = useCallback(() => {
    changeNatureFilter('ALL');
    setActiveKpiFilter('ALL');
    changeFamilyFilter('ALL');
    if (changeTemplateFilter) changeTemplateFilter('ALL');
    changePartGroupFilter('ALL');
    changeTypeFilter('ALL');
    changeRattachementFilter('ALL');
    changeStatusFilter('ALL');
    setLocalSearch('');
    if (setWhSearch) setWhSearch('');
    setSortField('id_warehouse_item');
    setSortOrder('asc');
  }, [
    changeNatureFilter,
    changeFamilyFilter,
    changeTemplateFilter,
    changePartGroupFilter,
    changeTypeFilter,
    changeRattachementFilter,
    changeStatusFilter,
    setWhSearch,
  ]);

  const entrepotFilterPresets = useMemo(
    () => [
      {
        key: 'ALL',
        label: t('entrepot.filters.all_statuses'),
        count: warehouseItems.length,
        colorDot: null,
        isActive: currentStatusFilter === 'ALL',
        onClick: () => changeStatusFilter('ALL'),
      },
      {
        key: 'En service',
        label: t('entrepot.filters.in_service'),
        count: kpis.enService,
        colorDot: 'bg-emerald-500',
        isActive: currentStatusFilter === 'En service',
        onClick: () => changeStatusFilter('En service'),
      },
      {
        key: 'En stock (Disponible)',
        label: t('entrepot.filters.in_stock'),
        count: kpis.enStock,
        colorDot: 'bg-blue-500',
        isActive: currentStatusFilter === 'En stock (Disponible)',
        onClick: () => changeStatusFilter('En stock (Disponible)'),
      },
      {
        key: 'En révision / Externe',
        label: t('entrepot.filters.under_revision'),
        count: kpis.enRevision,
        colorDot: 'bg-amber-500',
        isActive: currentStatusFilter === 'En révision / Externe',
        onClick: () => changeStatusFilter('En révision / Externe'),
      },
      {
        key: 'Hors service',
        label: 'Hors Service',
        count: warehouseItems.filter(
          (i) =>
            String(i.status || '').toLowerCase().includes('hors') ||
            String(i.status || '').toLowerCase().includes('hs')
        ).length,
        colorDot: 'bg-rose-500',
        isActive: currentStatusFilter === 'Hors service',
        onClick: () => changeStatusFilter('Hors service'),
      },
    ],
    [warehouseItems, kpis, currentStatusFilter, changeStatusFilter, t]
  );

  const activeEntrepotFilterChips = useMemo(() => {
    const chips: Array<{ key: string; label: string; onRemove: () => void }> = [];
    if (localSearch) {
      chips.push({
        key: 'search',
        label: `${t('entrepot.filters.filter_search')}: "${localSearch}"`,
        onRemove: () => {
          setLocalSearch('');
          if (setWhSearch) setWhSearch('');
        },
      });
    }
    if (currentNatureFilter !== 'ALL') {
      chips.push({
        key: 'nature',
        label: isComponentNature(currentNatureFilter)
          ? t('entrepot.tabs.components')
          : t('entrepot.tabs.parts'),
        onRemove: () => changeNatureFilter('ALL'),
      });
    }
    if (currentFamilyFilter !== 'ALL') {
      chips.push({
        key: 'family',
        label: `${t('entrepot.filters.filter_family')}: ${currentFamilyFilter}`,
        onRemove: () => changeFamilyFilter('ALL'),
      });
    }
    if (currentPartGroupFilter !== 'ALL') {
      const grpObj = effectivePartGroups.find(
        (g: IPartGroup) =>
          String(g.id_group || g.id_groupe || g.code || '').trim().toUpperCase() ===
          String(currentPartGroupFilter).trim().toUpperCase()
      );
      chips.push({
        key: 'part_group',
        label: `Groupe Part: ${grpObj ? `${grpObj.code || grpObj.id_group} (${grpObj.libelle})` : currentPartGroupFilter}`,
        onRemove: () => changePartGroupFilter('ALL'),
      });
    }
    if (currentTypeFilter !== 'ALL') {
      chips.push({
        key: 'type',
        label: `${t('entrepot.filters.filter_type')}: ${currentTypeFilter}`,
        onRemove: () => changeTypeFilter('ALL'),
      });
    }
    if (currentRattachementFilter !== 'ALL') {
      chips.push({
        key: 'rattachement',
        label: `${t('entrepot.filters.filter_rattachement')}: ${currentRattachementFilter}`,
        onRemove: () => changeRattachementFilter('ALL'),
      });
    }
    if (currentStatusFilter !== 'ALL') {
      chips.push({
        key: 'status',
        label: `${t('entrepot.filters.filter_status')}: ${currentStatusFilter}`,
        onRemove: () => changeStatusFilter('ALL'),
      });
    }
    return chips;
  }, [
    localSearch,
    currentNatureFilter,
    currentFamilyFilter,
    currentPartGroupFilter,
    effectivePartGroups,
    currentTypeFilter,
    currentRattachementFilter,
    currentStatusFilter,
    setWhSearch,
    changeNatureFilter,
    changeFamilyFilter,
    changePartGroupFilter,
    changeTypeFilter,
    changeRattachementFilter,
    changeStatusFilter,
    t,
  ]);

  const handleExportExcel = useCallback(() => {
    try {
      const headers = [
        'Code Element (A)',
        'Nature Twin (B)',
        'Designation (C)',
        'Famille / Type (D/B)',
        'Template / Ref Catalogue (D/C)',
        'Rattachement (E)',
        'Code Machine / Zone',
        'Emplacement (E)',
        'Statut (G)',
        'Stock Initial',
        'Entrees',
        'Sorties',
        'Stock Actuel (H)',
        'Seuil',
      ];
      const rows = filteredItems.map((item) => [
        item.id_warehouse_item || '',
        item.nature || '',
        item.designation || '',
        item.id_family || item.id_type || '',
        item.id_templates || item.id_diag || item.ref || '',
        item.rattachement_type || '',
        item.id_machine_registered || item.id_zone || '',
        item.emplacement || '',
        item.status || '',
        item.stockInitial || 0,
        item.entrees || 0,
        item.sorties || 0,
        item.stockActuel || 0,
        item.seuil || 0,
      ]);
      const csvContent =
        'data:text/csv;charset=utf-8,\uFEFF' +
        [
          headers.join(';'),
          ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')),
        ].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `GMAO_Entrepot_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      Logger.error('Export error in EntrepotView:', e);
    }
  }, [filteredItems]);

  return {
    t,
    warehouseItems,
    zones,
    machines,
    mouvements,
    effectivePartGroups,
    families,
    templates,
    types,
    diagnostics,
    activeTechnicians,
    canDeleteStock,
    canEditStock,
    canCreateStock,
    canCreateMovement,
    showAddModal,
    setShowAddModal,
    toEdit,
    setToEdit,
    toDelete,
    setToDelete,
    selectedDetails,
    setSelectedDetails,
    showFormulasModal,
    setShowFormulasModal,
    activeActionMenuId,
    setActiveActionMenuId,
    quickModalState,
    setQuickModalState,
    activeWarehouseTab,
    handleTabSwitch,
    activeKpiFilter,
    setActiveKpiFilter,
    currentFamilyFilter,
    changeFamilyFilter,
    changeTemplateFilter,
    currentPartGroupFilter,
    changePartGroupFilter,
    currentTypeFilter,
    changeTypeFilter,
    currentNatureFilter,
    changeNatureFilter,
    currentRattachementFilter,
    changeRattachementFilter,
    localSearch,
    setLocalSearch,
    familyComponentCodes,
    addForm,
    setAddForm,
    editForm,
    setEditForm,
    availableAddTemplates,
    availableAddDiags,
    handleOpenAddModal,
    handleAddNatureSwitch,
    handleOpenEditModal,
    handleOpenQuickModal,
    handleAddFamilyChange,
    handleAddFamilyPrefixChange,
    handleAddTemplateChange,
    handleAddTypeChange,
    handleAddDiagChange,
    handleCascadeFamilyPrefixUpdate,
    handleSubmitAdd,
    handleSubmitEdit,
    handleConfirmDelete,
    currentPage,
    setCurrentPage,
    pageSize,
    setPageSize,
    sortField,
    sortOrder,
    showSortMenu,
    setShowSortMenu,
    sortMenuRef,
    machineMotorCounts,
    filteredItems,
    totalItems,
    startIndex,
    rawDisplayedData,
    isTableReady,
    handleSort,
    kpis,
    hasActiveFilters,
    clearAllFilters,
    entrepotFilterPresets,
    activeEntrepotFilterChips,
    handleExportExcel,
  };
}
