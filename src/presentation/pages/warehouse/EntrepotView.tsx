import { useState, useRef, useMemo, useEffect } from 'react';
import AnimatedPage from '../../components/common/AnimatedPage';
import CustomSelect from '../../components/common/CustomSelect';
import QuickMovementModal from './QuickMovementModal';
import { storageService } from '../../../utils/storageService';
import { useSmartTableLoader } from '../../hooks/useSmartTableLoader';
import { Logger } from '../../../core/logger/LoggerService';
import {
  Plus,
  MapPin,
  Layers,
  CheckCircle2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronDown,
  Warehouse,
  Factory,
  Tag,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { CubeIcon } from '../../components/common/icons/CubeIcon';
import { LayersIcon } from '../../components/common/icons/LayersIcon';
import { usePermission } from '../../components/common/PermissionGate';
import FormulasModalButton from '../../components/common/FormulasModalButton';
import Action3DButton from '../../components/common/Action3DButton';
import PageHeaderIcon from '../../components/common/PageHeaderIcon';
import TablePaginationCard from '../../components/common/TablePaginationCard';
import IndustrialFilterCard, { FilterField, FilterSearchInput } from '../../components/common/IndustrialFilterCard';
import { GmaoKpiCard, GmaoKpiGrid } from '../../components/common/GmaoKpiCard';
import ComponentsTable from './components/ComponentsTable';
import PartsTable from './components/PartsTable';
import { useTranslation } from '../../../i18n/I18nContext';
import {
  isComponentNature,
  isPartNature,
  isWarehouseComponent,
  isWarehousePart,
} from '../../../core/domain/EntrepotItem';
import { filterProductionMachines, filterActiveMachines } from '../../../utils/activeMachines';
import { useGmaoStore } from '../../../store/useGmaoStore';
import { MaterialPolicyTag } from '../../../types/domain';
import { getEffectivePolicyTags } from '../../../domain/corrective/needRequestService';
import { EntrepotDeleteModal, EntrepotFormulasModal } from './components/EntrepotModals';
import { EntrepotDetailsModal } from './components/EntrepotDetailsModal';
import { EntrepotFormModals } from './components/EntrepotFormModals';

export default function EntrepotView({
  warehouseItems = [],
  _entrepotComponents = [],
  families: propFamilies = [],
  templates: propTemplates = [],
  types: propTypes = [],
  diagnostics: propDiagnostics = [],
  compFamilies = [],
  compTemplates = [],
  partGroups: propPartGroups = [],
  partTypes = [],
  partDesignations = [],
  zones = [],
  machines = [],
  technicians = [],
  mouvements = [],
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
  onAddMouvement,
  onUpdateFamily,
  onNavigateToFamily,
  onNavigateToTemplate,
  onNavigateToPartGroups,
  onNavigateToType,
  onNavigateToPartTypes,
  onNavigateToDiag,
  onNavigateToZone,
  onNavigateToMachine,
  showToast,
}: any) {
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
  const families = compFamilies && compFamilies.length > 0 ? compFamilies : propFamilies;
  const templates = compTemplates && compTemplates.length > 0 ? compTemplates : propTemplates;
  const types = partTypes && partTypes.length > 0 ? partTypes : propTypes;
  const diagnostics = partDesignations && partDesignations.length > 0 ? partDesignations : propDiagnostics;
  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [toEdit, setToEdit] = useState<any>(null);
  const [toDelete, setToDelete] = useState<any>(null);
  const [selectedDetails, setSelectedDetails] = useState<any>(null);
  const [showFormulasModal, setShowFormulasModal] = useState(false);

  // Quick Action / Movement Modal State
  const [activeActionMenuId, setActiveActionMenuId] = useState<any>(null);
  const [quickModalState, setQuickModalState] = useState<any>({
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
  const [activeKpiFilter, setActiveKpiFilter] = useState('ALL'); // ALL | 'COMPONENT' | 'PART' | 'SERVICE' | 'RESERVE'

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

  // Active Warehouse View Tab: 'COMPONENTS' | 'PARTS'
  const [activeWarehouseTab, setActiveWarehouseTab] = useState(() => {
    if (whNatureFilter && isPartNature(whNatureFilter)) return 'PARTS';
    return 'COMPONENTS';
  });

  const handleTabSwitch = (tabKey) => {
    setActiveWarehouseTab(tabKey);
    setCurrentPage(1);
    if (tabKey === 'COMPONENTS') {
      changeNatureFilter('COMPONENT');
    } else {
      changeNatureFilter('PART');
    }
    setActiveKpiFilter('ALL');
  };

  useEffect(() => {
    if (currentNatureFilter !== 'ALL') {
      if (isPartNature(currentNatureFilter) && activeWarehouseTab !== 'PARTS') {
        setActiveWarehouseTab('PARTS');
      } else if (isComponentNature(currentNatureFilter) && activeWarehouseTab !== 'COMPONENTS') {
        setActiveWarehouseTab('COMPONENTS');
      }
    }
  }, [currentNatureFilter]);

  // Debounce search
  const [localSearch, setLocalSearch] = useState(whSearch);

  useEffect(() => {
    setLocalSearch(whSearch);
  }, [whSearch]);

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

  useEffect(() => {
    const handler = setTimeout(() => {
      if (setWhSearch) setWhSearch(localSearch);
    }, 200);
    return () => clearTimeout(handler);
  }, [localSearch, setWhSearch]);

  // Form state for add modal (Dual Twin)
  const [familyComponentCodes, setFamilyComponentCodes] = useState<Record<string, string>>(() => {
    const initialMap: Record<string, string> = {};
    // 1. From families table (primary source of truth)
    (families || []).forEach((f) => {
      if (f.id_family && f.componentCode) {
        initialMap[f.id_family] = String(f.componentCode).toUpperCase().trim();
      }
    });

    // 2. From saved storage (handles plain object, JSON string, or storageService cache)
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

    // 3. From existing items in warehouseItems
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

  // Persist familyComponentCodes via storageService
  useEffect(() => {
    try {
      storageService.setItem('gmao_family_component_codes_v1', familyComponentCodes);
    } catch {
      // Ignore storage errors gracefully
    }
  }, [familyComponentCodes]);

  // Helper to calculate next sequential component code based on Family Prefix
  const getNextFamilyComponentCode = (familyId, customPrefix = '', items = warehouseItems) => {
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
  };

  // Helper to calculate next auto Reference for PARTS based on Type (e.g. VIS-01, ROUL-01, RACC-01)
  const getNextPartRef = (typeId, items = warehouseItems) => {
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
  };

  // Cascade Update: When a family prefix is changed, update state, families table, and rename existing components
  const handleCascadeFamilyPrefixUpdate = (familyId, newPrefix) => {
    if (!canEditStock && !canCreateStock) return;
    const cleanPrefix = (newPrefix || '').toUpperCase().replace(/[^A-Z0-9]/g, '').trim();
    if (!familyId || !cleanPrefix) return;

    // 1. Update dictionary state
    setFamilyComponentCodes((prev) => ({
      ...prev,
      [familyId]: cleanPrefix,
    }));

    // 2. Update Family in families table if onUpdateFamily exists
    if (onUpdateFamily) {
      const fam = families.find((f) => f.id_family === familyId);
      if (fam) {
        onUpdateFamily(familyId, {
          ...fam,
          componentCode: cleanPrefix,
        });
      }
    }

    // 3. Cascade rename all existing components under this family
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
          onUpdateWarehouseItem(oldCode, {
            ...item,
            id_warehouse_item: newCode,
          });
        }
      });
    }
  };

  const [addForm, setAddForm] = useState<any>({
    id_warehouse_item: '',
    designation: '',
    nature: 'COMPONENT', // 'COMPONENT' (Machine Twin) | 'PART' (Stock Twin)
    id_family: '',
    family_prefix: '', // Prefix stored/entered for this family (e.g. EXT)
    id_templates: '',
    id_type: '',
    id_diag: '',
    matiere_nuance: '',
    ref_plan: '',
    dimensions_brut: '',
    rattachement_type: 'ENTREPOT', // 'MACHINE' | 'ZONE' | 'ENTREPOT'
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

  // Form state for edit modal
  const [editForm, setEditForm] = useState<any>({
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

  // Open Add Modal initialized with smart auto-code
  const handleOpenAddModal = () => {
    if (!canCreateStock) return;
    if (activeWarehouseTab === 'PARTS') {
      const defaultType = types[0]?.id_type || 'TYPE-MEC';
      const relDiags = diagnostics.filter((d) => d.id_type === defaultType);
      const getDiagId = (d: any) => d ? (d.id_part || d.ref || d.id_diag || d.id || '') : '';
      const getDiagLabel = (d: any) => d ? (d.designation || d.libelle || '') : '';
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
      const relTemplates = templates.filter((t) => t.id_family === defaultFam);
      const defaultTpl = relTemplates[0]?.id_templates || templates[0]?.id_templates || '';
      const prefix = familyComponentCodes[defaultFam] || '';
      const autoCode = getNextFamilyComponentCode(defaultFam, prefix);
      const defaultTplObj = templates.find((t) => t.id_templates === defaultTpl);

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
        tension_nominale: defaultTplObj?.tension_nominale || defaultTplObj?.specs?.V || '',
        courant_nominal_a: defaultTplObj?.courant_nominal_a || defaultTplObj?.specs?.A || '',
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
  };

  // Switch Nature in Add Modal
  const handleAddNatureSwitch = (newNature) => {
    if (isComponentNature(newNature)) {
      const defaultFam = addForm.id_family || families[0]?.id_family || 'FAM-MOT';
      const relTemplates = templates.filter((t) => t.id_family === defaultFam);
      const defaultTpl = relTemplates[0]?.id_templates || '';
      const prefix = addForm.family_prefix || familyComponentCodes[defaultFam] || '';
      const autoCode = getNextFamilyComponentCode(defaultFam, prefix);
      const defaultTplObj = templates.find((t) => t.id_templates === defaultTpl);

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
      // PART
      const defaultType = addForm.id_type || types[0]?.id_type || 'TYPE-MEC';
      const relDiags = diagnostics.filter((d) => d.id_type === defaultType);
      const getDiagId = (d: any) => d ? (d.id_part || d.ref || d.id_diag || d.id || '') : '';
      const getDiagLabel = (d: any) => d ? (d.designation || d.libelle || '') : '';
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
  };

  // Open Edit Modal
  const handleOpenEditModal = (item) => {
    if (!canEditStock) return;
    const linkedDiag = diagnostics.find(
      (d: any) => (d.id_part || d.ref || d.id_diag || d.id) === item.id_diag
    );
    const linkedTpl = templates.find((t: any) => t.id_templates === item.id_templates);
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
      tension_nominale: item.tension_nominale || linkedTpl?.tension_nominale || linkedTpl?.specs?.V || '',
      courant_nominal_a: item.courant_nominal_a != null ? item.courant_nominal_a : (linkedTpl?.courant_nominal_a || linkedTpl?.specs?.A || ''),
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
  };

  const handleOpenQuickModal = (item, flow, action) => {
    if (!canCreateMovement) return;
    // Adapt warehouse item into article format for QuickMovementModal
    const adaptedArticle = {
      id: item.id_warehouse_item,
      ref: item.id_warehouse_item,
      designation: item.designation,
      stockInitial: item.stockInitial || 1,
      entrees: item.entrees || 0,
      sorties: item.sorties || 0,
      stockActuel: item.stockActuel != null ? item.stockActuel : (item.stockInitial || 1),
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
  };

  // Cascading templates according to family in add form
  const availableAddTemplates = addForm.id_family
    ? templates.filter((t) => t.id_family === addForm.id_family)
    : templates;

  // Cascading diagnostics/designations according to type in add form
  const availableAddDiags = addForm.id_type
    ? diagnostics.filter((d) => d.id_type === addForm.id_type)
    : diagnostics;

  const handleAddFamilyChange = (newFam) => {
    const relTpl = templates.filter((t) => t.id_family === newFam);
    const newTpl = relTpl[0]?.id_templates || '';
    const prefix = familyComponentCodes[newFam] || '';
    const autoCode = getNextFamilyComponentCode(newFam, prefix);
    const tplObj = templates.find((t) => t.id_templates === newTpl);

    setAddForm((prev) => ({
      ...prev,
      id_family: newFam,
      family_prefix: prefix,
      id_templates: newTpl,
      id_warehouse_item: autoCode,
      designation: tplObj ? tplObj.libelle : prev.designation,
    }));
  };

  const handleAddFamilyPrefixChange = (newPrefix) => {
    const cleanPrefix = newPrefix.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const autoCode = getNextFamilyComponentCode(addForm.id_family, cleanPrefix);

    setAddForm((prev) => ({
      ...prev,
      family_prefix: cleanPrefix,
      id_warehouse_item: autoCode || prev.id_warehouse_item,
    }));
  };

  const handleAddTemplateChange = (newTpl) => {
    const tplObj = templates.find((t) => t.id_templates === newTpl);
    setAddForm((prev) => ({
      ...prev,
      id_templates: newTpl,
      designation: tplObj ? tplObj.libelle : prev.designation,
      mode_reparation_defaut: tplObj?.mode_reparation_defaut || prev.mode_reparation_defaut || 'NON_DEFINI',
      tension_nominale: tplObj?.tension_nominale || tplObj?.specs?.V || prev.tension_nominale || '',
      courant_nominal_a: tplObj?.courant_nominal_a || tplObj?.specs?.A || prev.courant_nominal_a || '',
      indice_protection: tplObj?.indice_protection || prev.indice_protection || '',
      type_fixation: tplObj?.type_fixation || prev.type_fixation || '',
    }));
  };

  const handleAddTypeChange = (newType) => {
    const relDiags = diagnostics.filter((d) => d.id_type === newType);
    const getDiagId = (d: any) => d ? (d.id_part || d.ref || d.id_diag || d.id || '') : '';
    const getDiagLabel = (d: any) => d ? (d.designation || d.libelle || '') : '';
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
  };

  const handleAddDiagChange = (newDiag) => {
    const diagObj = diagnostics.find(
      (d) => (d.id_part || d.ref || d.id_diag || d.id) === newDiag
    );
    const diagLabel = diagObj ? (diagObj.designation || diagObj.libelle || '') : '';
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
  };

  // Submit Add
  const handleSubmitAdd = (e) => {
    e.preventDefault();
    if (!canCreateStock) return;
    if (!addForm.id_warehouse_item || !addForm.designation) {
      showToast?.('Veuillez renseigner le code et la désignation.', 'warning');
      return;
    }

    const isComp = isComponentNature(addForm.nature);

    // If adding a Component, save the family prefix and sync with familyComponentCodes / families
    if (isComp && addForm.id_family) {
      const match = String(addForm.id_warehouse_item).match(/^([A-Z0-9]+)-/i);
      const prefixToSave = (addForm.family_prefix || (match ? match[1] : '')).toUpperCase().trim();
      if (prefixToSave) {
        handleCascadeFamilyPrefixUpdate(addForm.id_family, prefixToSave);
      }
    }

    if (onAddWarehouseItem) {
      const matchedPartType = !isComp
        ? types.find((tObj: any) => tObj.id_type === addForm.id_type)
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
        // TODO(ALIAS-ID-GROUP): Remove legacy id_groupe write once all consumers use getGroupId()
        id_groupe: inheritedPartGroup,
        id_type: !isComp ? addForm.id_type : '',
        id_diag: !isComp ? addForm.id_diag : '',
        matiere_nuance: !isComp ? String(addForm.matiere_nuance || '').trim() : undefined,
        ref_plan: !isComp ? String(addForm.ref_plan || '').trim() : undefined,
        dimensions_brut: !isComp ? String(addForm.dimensions_brut || '').trim() : undefined,
        traitement_thermique: !isComp ? String(addForm.traitement_thermique || '').trim() || undefined : undefined,
        mode_reparation_defaut: isComp ? (addForm.mode_reparation_defaut || 'NON_DEFINI') : undefined,
        tension_nominale: isComp ? String(addForm.tension_nominale || '').trim() || undefined : undefined,
        courant_nominal_a: isComp ? String(addForm.courant_nominal_a || '').trim() || undefined : undefined,
        indice_protection: isComp ? String(addForm.indice_protection || '').trim() || undefined : undefined,
        type_fixation: isComp ? String(addForm.type_fixation || '').trim() || undefined : undefined,
        rattachement_type: addForm.rattachement_type,
        id_machine_registered:
          addForm.rattachement_type === 'MACHINE' ? addForm.id_machine_registered : '',
        id_zone: addForm.rattachement_type === 'ZONE' ? addForm.id_zone : '',
        technician: addForm.technician,
        status: addForm.status,
        emplacement: addForm.emplacement,
        stockInitial: Number(addForm.stockInitial) || 1,
        seuil: Number(addForm.seuil) || 0,
        remarques: addForm.remarques,
        policy_tags: addForm.policy_tags && addForm.policy_tags.length > 0
          ? addForm.policy_tags
          : (isComp ? ['REPAIRABLE', 'REPLACING'] : ['REPAIRABLE', 'REPLACING']),
      });
    }
    setShowAddModal(false);
  };

  // Submit Edit
  const handleSubmitEdit = (e) => {
    e.preventDefault();
    if (!canEditStock) return;
    if (!editForm.designation) {
      showToast?.('La désignation est obligatoire.', 'warning');
      return;
    }

    if (onUpdateWarehouseItem) {
      const isComp = isComponentNature(editForm.nature);
      const matchedPartType = !isComp
        ? types.find((tObj: any) => tObj.id_type === editForm.id_type)
        : null;
      const inheritedPartGroup = !isComp
        ? String(matchedPartType?.id_group || matchedPartType?.id_groupe || toEdit.id_group || toEdit.id_groupe || '').trim() || undefined
        : undefined;
      onUpdateWarehouseItem(toEdit.id_warehouse_item, {
        ...toEdit,
        designation: editForm.designation.trim(),
        nature: editForm.nature,
        id_family: isComp ? editForm.id_family : '',
        id_templates: isComp ? editForm.id_templates : '',
        id_group: inheritedPartGroup,
        // TODO(ALIAS-ID-GROUP): Remove legacy id_groupe write once all consumers use getGroupId()
        id_groupe: inheritedPartGroup,
        id_type: !isComp ? editForm.id_type : '',
        id_diag: !isComp ? editForm.id_diag : '',
        matiere_nuance: !isComp ? String(editForm.matiere_nuance || '').trim() : undefined,
        ref_plan: !isComp ? String(editForm.ref_plan || '').trim() : undefined,
        dimensions_brut: !isComp ? String(editForm.dimensions_brut || '').trim() : undefined,
        traitement_thermique: !isComp ? String(editForm.traitement_thermique || '').trim() || undefined : undefined,
        mode_reparation_defaut: isComp ? (editForm.mode_reparation_defaut || 'NON_DEFINI') : undefined,
        tension_nominale: isComp ? String(editForm.tension_nominale || '').trim() || undefined : undefined,
        courant_nominal_a: isComp ? String(editForm.courant_nominal_a || '').trim() || undefined : undefined,
        indice_protection: isComp ? String(editForm.indice_protection || '').trim() || undefined : undefined,
        type_fixation: isComp ? String(editForm.type_fixation || '').trim() || undefined : undefined,
        rattachement_type: editForm.rattachement_type,
        id_machine_registered:
          editForm.rattachement_type === 'MACHINE' ? editForm.id_machine_registered : '',
        id_zone: editForm.rattachement_type === 'ZONE' ? editForm.id_zone : '',
        technician: editForm.technician,
        status: editForm.status,
        emplacement: editForm.emplacement,
        stockInitial: Number(editForm.stockInitial) || 1,
        seuil: Number(editForm.seuil) || 0,
        remarques: editForm.remarques,
        policy_tags: editForm.policy_tags && editForm.policy_tags.length > 0
          ? editForm.policy_tags
          : (toEdit.policy_tags || (isComp ? ['REPAIRABLE', 'REPLACING'] : ['REPAIRABLE', 'REPLACING'])),
      });
    }
    setToEdit(null);
  };

  // Confirm Delete
  const handleConfirmDelete = () => {
    if (!canDeleteStock) return;
    if (toDelete && onDeleteWarehouseItem) {
      onDeleteWarehouseItem(toDelete.id_warehouse_item);
    }
    setToDelete(null);
  };

  // Table pagination and sorting
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sortField, setSortField] = useState('id_warehouse_item');
  const [sortOrder, setSortOrder] = useState('asc');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const sortMenuRef = useRef(null);

  // Close menus on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (sortMenuRef.current && !sortMenuRef.current.contains(event.target)) {
        setShowSortMenu(false);
      }
      if (!event.target.closest('.action-menu-container')) {
        setActiveActionMenuId(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Machine-to-motors mapping supporting 1:N relationship (machines with multiple motors)
  const machineMotorCounts = useMemo(() => {
    const map = {};
    (warehouseItems || []).forEach((item) => {
      const mId = item.id_machine_registered || item.id_machine;
      if (mId && isWarehouseComponent(item)) {
        if (!map[mId]) {
          map[mId] = [];
        }
        map[mId].push(item.code || item.id_warehouse_item);
      }
    });
    return map;
  }, [warehouseItems]);

  // Filter items
  const filteredItems = useMemo(() => {
    return warehouseItems.filter((item) => {
      const itemIsComp = isWarehouseComponent(item);
      const itemIsPart = !itemIsComp;

      // Tab filter (Strict isolation between Components and Parts)
      if (activeWarehouseTab === 'COMPONENTS' && !itemIsComp) return false;
      if (activeWarehouseTab === 'PARTS' && !itemIsPart) return false;

      // Nature filter
      if (currentNatureFilter !== 'ALL') {
        if (isComponentNature(currentNatureFilter) && !itemIsComp) return false;
        if (isPartNature(currentNatureFilter) && !itemIsPart) return false;
      }

      // KPI filter
      if (isComponentNature(activeKpiFilter) && !itemIsComp) return false;
      if (isPartNature(activeKpiFilter) && !itemIsPart) return false;
      if (activeKpiFilter === 'SERVICE' && !String(item.status || '').toLowerCase().includes('service')) return false;
      if (activeKpiFilter === 'RESERVE' && !String(item.status || '').toLowerCase().includes('stock') && !String(item.status || '').toLowerCase().includes('dispo')) return false;

      // Family filter (for components)
      if (
        itemIsComp &&
        currentFamilyFilter !== 'ALL' &&
        item.id_family !== currentFamilyFilter
      ) {
        return false;
      }

      // Template filter (for components)
      if (
        itemIsComp &&
        currentTemplateFilter !== 'ALL' &&
        item.id_templates !== currentTemplateFilter
      ) {
        return false;
      }

      // Groupe de Parts filter (Niveau 1 — for parts)
      if (itemIsPart && currentPartGroupFilter !== 'ALL') {
        const typeObj = types.find((tObj: any) => tObj.id_type === item.id_type);
        const itemGrp = String(
          item.id_group ||
            item.id_groupe ||
            typeObj?.id_group ||
            typeObj?.id_groupe ||
            ''
        )
          .trim()
          .toUpperCase();
        if (currentPartGroupFilter === 'UNASSIGNED') {
          if (itemGrp) return false;
        } else {
          const targetGrp = String(currentPartGroupFilter).trim().toUpperCase();
          if (itemGrp !== targetGrp) return false;
        }
      }

      // Type filter (Niveau 2 — for parts)
      if (
        itemIsPart &&
        currentTypeFilter !== 'ALL' &&
        item.id_type !== currentTypeFilter
      ) {
        return false;
      }

      // Rattachement filter
      if (
        currentRattachementFilter !== 'ALL' &&
        item.rattachement_type !== currentRattachementFilter
      ) {
        return false;
      }

      // Status filter
      if (currentStatusFilter !== 'ALL') {
        const itemStatus = String(item.status || '').toLowerCase();
        const filterStatus = String(currentStatusFilter).toLowerCase();
        if (!itemStatus.includes(filterStatus)) {
          return false;
        }
      }

      // Text search: supports Code, Ref, Passport ID, Designation, Machine, Zone, Tech, and Bobinage
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
      let valA = a[sortField];
      let valB = b[sortField];

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
  const rawDisplayedData =
    pageSize === 0 ? sortedData : sortedData.slice(startIndex, startIndex + effectivePageSize);
  const displayedData = rawDisplayedData;

  const { isDataReady: isTableReady } = useSmartTableLoader(displayedData);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const renderSortIcon = (field) => {
    if (sortField !== field) {
      return (
        <ArrowUpDown className="w-3 h-3 text-slate-300 group-hover:text-slate-500 transition shrink-0" />
      );
    }
    return sortOrder === 'asc' ? (
      <ArrowUp className="w-3 h-3 text-cyan-700 shrink-0 font-bold" />
    ) : (
      <ArrowDown className="w-3 h-3 text-cyan-700 shrink-0 font-bold" />
    );
  };

  // Quick Analytics Counts
  const kpis = useMemo(() => {
    let components = 0;
    let parts = 0;
    let enService = 0;
    let enStock = 0;
    let enRevision = 0;

    warehouseItems.forEach((item) => {
      if (isWarehouseComponent(item)) components++;
      else parts++;

      const st = String(item.status || '').toLowerCase();
      if (st.includes('service')) enService++;
      else if (st.includes('stock') || st.includes('dispo')) enStock++;
      else if (st.includes('rev') || st.includes('ext')) enRevision++;
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

  const hasActiveFilters =
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
    sortOrder !== 'asc';

  const clearAllFilters = () => {
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
  };

  const entrepotFilterPresets = useMemo(() => [
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
  ], [warehouseItems, kpis, currentStatusFilter, changeStatusFilter, t]);

  const activeEntrepotFilterChips = useMemo(() => {
    const chips = [];
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
        (g: any) =>
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

  const handleExportExcel = () => {
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
  };

  return (
    <AnimatedPage className="space-y-4">
      {/* 1. Top Banner (BDR Light GMAO Header Card with 3D Tactile Elevation) */}
      <div className="bg-white px-4 py-3.5 md:px-5 md:py-4 rounded-2xl border border-slate-200/90 shadow-[0_12px_32px_-6px_rgba(0,0,0,0.12),0_4px_12px_-2px_rgba(0,0,0,0.06)] hover:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.16),0_6px_16px_-3px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-300 ease-out flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3.5 relative overflow-hidden group/header">
        {/* Subtle Ambient Gradient Background Highlight */}
        <div className="absolute -top-12 -right-12 w-48 h-48 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none group-hover/header:bg-indigo-500/10 transition-colors duration-500" />

        <div className="min-w-0 flex-1 flex items-start sm:items-center gap-3 relative">
          <PageHeaderIcon icon={Warehouse} colorClass="text-indigo-700" />
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg md:text-xl font-black text-slate-900 tracking-tight">
                {t('entrepot.title')}
              </h2>
              <span className="px-2.5 py-0.5 text-[10px] font-mono font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full">
                {t('entrepot.registered_count', { count: warehouseItems.length })}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5 max-w-3xl leading-snug line-clamp-1">
              {t('entrepot.subtitle')}
            </p>
          </div>
        </div>

        {/* Right Column: Unified Single-Row Tab Switcher + Action Buttons */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2.5 shrink-0 relative">
          {/* Tab Switcher (Components vs Parts) — Equal Width & Structured */}
          <div className="inline-grid grid-cols-2 p-1 bg-slate-100/90 rounded-2xl border border-slate-200/90 shadow-2xs w-full sm:w-[320px] select-none">
            <button
              type="button"
              onClick={() => handleTabSwitch('COMPONENTS')}
              className={`w-full py-1.5 px-3 rounded-xl text-xs font-bold transition-all duration-200 flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
                activeWarehouseTab === 'COMPONENTS'
                  ? 'bg-white text-blue-950 shadow-[0_2px_8px_rgba(0,0,0,0.08)] border border-slate-200/60'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50 border border-transparent'
              }`}
            >
              <CubeIcon className={`w-4 h-4 shrink-0 ${activeWarehouseTab === 'COMPONENTS' ? 'text-blue-600' : 'text-slate-500'}`} />
              <span className="truncate">{t('entrepot.tabs.components')} ({kpis.components})</span>
            </button>

            <button
              type="button"
              onClick={() => handleTabSwitch('PARTS')}
              className={`w-full py-1.5 px-3 rounded-xl text-xs font-bold transition-all duration-200 flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
                activeWarehouseTab === 'PARTS'
                  ? 'bg-white text-indigo-950 shadow-[0_2px_8px_rgba(0,0,0,0.08)] border border-slate-200/60'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50 border border-transparent'
              }`}
            >
              <LayersIcon className={`w-4 h-4 shrink-0 ${activeWarehouseTab === 'PARTS' ? 'text-indigo-600' : 'text-slate-500'}`} />
              <span className="truncate">{t('entrepot.tabs.parts')} ({kpis.parts})</span>
            </button>
          </div>

          {/* Circular Action Buttons */}
          <div className="flex items-center justify-end gap-2">
            <FormulasModalButton
              onClick={() => setShowFormulasModal(true)}
              title={t('entrepot.buttons.view_formulas')}
            />

            {canCreateStock && (
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={`action-btn-${activeWarehouseTab}`}
                  initial={{ scale: 0.82, rotate: -12, opacity: 0 }}
                  animate={{ scale: 1, rotate: 0, opacity: 1 }}
                  exit={{ scale: 0.82, rotate: 12, opacity: 0 }}
                  transition={{ duration: 0.18, ease: 'easeOut' }}
                >
                  <Action3DButton
                    variant="circle"
                    color={activeWarehouseTab === 'COMPONENTS' ? 'blue' : 'indigo'}
                    icon={activeWarehouseTab === 'COMPONENTS' ? CubeIcon : LayersIcon}
                    showAddBadge={true}
                    onClick={handleOpenAddModal}
                    title={activeWarehouseTab === 'COMPONENTS' ? t('entrepot.buttons.add_component') : t('entrepot.buttons.add_part')}
                  />
                </motion.div>
              </AnimatePresence>
            )}
          </div>
        </div>
      </div>

      {/* 2. Top Metric Cards (Unified 4-Tier Light Excel KPI Filter Bar) */}
      <GmaoKpiGrid columns={4}>
        {/* Card 1: Total Global */}
        <GmaoKpiCard
          title={t('entrepot.stats.global_inventory')}
          value={kpis.total}
          unit="éléments"
          icon={Warehouse}
          color="teal"
          valueColored={false}
          isActive={activeKpiFilter === 'ALL' && currentNatureFilter === 'ALL'}
          onClick={() => {
            setActiveKpiFilter('ALL');
            changeNatureFilter('ALL');
          }}
          badgeText={t('entrepot.stats.global_sub')}
          footerLabel="Feuille Entrepôt :"
          footerValue="Vue complète"
        />

        {/* Card 2: Components (Ensembles / Sub-systems) */}
        <GmaoKpiCard
          title={t('entrepot.stats.components_title')}
          value={kpis.components}
          unit="ensembles"
          icon={CubeIcon}
          color="blue"
          isActive={isComponentNature(currentNatureFilter) || isComponentNature(activeKpiFilter)}
          onClick={() => {
            setActiveKpiFilter('COMPONENT');
            changeNatureFilter('COMPONENT');
          }}
          badgeText={t('entrepot.stats.components_sub')}
          footerLabel="Architecture :"
          footerValue="Sous-systèmes"
        />

        {/* Card 3: Parts (Pièces détachées) */}
        <GmaoKpiCard
          title={t('entrepot.stats.parts_title')}
          value={kpis.parts}
          unit="pièces"
          icon={LayersIcon}
          color="indigo"
          isActive={isPartNature(currentNatureFilter) || isPartNature(activeKpiFilter)}
          onClick={() => {
            setActiveKpiFilter('PART');
            changeNatureFilter('PART');
          }}
          badgeText={t('entrepot.stats.parts_sub')}
          footerLabel="Nomenclature :"
          footerValue="Pièces élémentaires"
        />

        {/* Card 4: En Service Actif */}
        <GmaoKpiCard
          title={t('entrepot.stats.active_service')}
          value={kpis.enService}
          unit="actifs"
          icon={CheckCircle2}
          color="emerald"
          isActive={activeKpiFilter === 'SERVICE'}
          onClick={() => {
            setActiveKpiFilter('SERVICE');
          }}
          badgeText={t('entrepot.stats.active_service_sub')}
          footerLabel="Taux affectation :"
          footerValue={`${kpis.total ? Math.round((kpis.enService / kpis.total) * 100) : 0}%`}
        />
      </GmaoKpiGrid>

      {/* 4. Central Unified Industrial Filter & Search Card */}
      <IndustrialFilterCard
        title={t('common.filters.title')}
        subtitle={t('entrepot.filters.subtitle')}
        color="amber"
        filteredCount={filteredItems.length}
        totalCount={warehouseItems.length}
        hasActiveFilters={hasActiveFilters}
        onReset={clearAllFilters}
        onExportExcel={handleExportExcel}
        exportLabel={t('entrepot.filters.export_excel')}
        presets={entrepotFilterPresets}
        presetsLabel={t('entrepot.filters.status_label')}
        activeFilters={activeEntrepotFilterChips}
        onClearAll={clearAllFilters}
      >
        {/* Multi-Criteria Filter Grid */}
        <div
          className={`grid grid-cols-1 sm:grid-cols-2 ${
            activeWarehouseTab === 'PARTS' || isPartNature(currentNatureFilter)
              ? 'lg:grid-cols-6'
              : 'lg:grid-cols-5'
          } gap-3.5 items-end`}
        >
          {/* 1. Omni-Text Search */}
          <FilterSearchInput
            value={localSearch}
            onChange={setLocalSearch}
            onClear={() => {
              setLocalSearch('');
              if (setWhSearch) setWhSearch('');
            }}
            placeholder={t('entrepot.filters.search_placeholder')}
            colBadge="Omni"
            colBadgeColor="slate"
            focusRingColor="focus:ring-amber-500"
            className="w-full sm:col-span-2 lg:col-span-1"
          />

          {/* 2. Nature Twin Filter (Col. B) */}
          <FilterField label={t('entrepot.modal.nature')} colBadge="Col. B" colBadgeColor="amber">
            <CustomSelect
              value={currentNatureFilter}
              prefixIcon={
                <span className="w-5 h-5 rounded-md bg-amber-100 border border-amber-300/80 flex items-center justify-center text-amber-700 shadow-2xs">
                  <Layers className="w-3 h-3" />
                </span>
              }
              onChange={(val) => {
                changeNatureFilter(val);
                setActiveKpiFilter('ALL');
              }}
              options={[
                { value: 'ALL', label: t('entrepot.filters.all_statuses'), badge: '[B]', badgeColor: 'bg-teal-50 text-teal-800' },
                { value: 'COMPONENT', label: t('entrepot.modal.nature_component'), badge: '[B]', badgeColor: 'bg-blue-50 text-blue-800' },
                { value: 'PART', label: t('entrepot.modal.nature_part'), badge: '[B]', badgeColor: 'bg-indigo-50 text-indigo-800' },
              ]}
            />
          </FilterField>

          {/* 2b. Groupe de Parts (Niv 1) when in PARTS tab */}
          {(activeWarehouseTab === 'PARTS' || isPartNature(currentNatureFilter)) && (
            <FilterField
              label={t('part_types.filter_group_label', 'Groupe Part (Niv 1)')}
              colBadge="Niv 1"
              colBadgeColor="teal"
            >
              <CustomSelect
                value={currentPartGroupFilter}
                prefixIcon={
                  <span className="w-5 h-5 rounded-md bg-teal-100 border border-teal-300/80 flex items-center justify-center text-teal-700 shadow-2xs">
                    <Layers className="w-3 h-3" />
                  </span>
                }
                onChange={(val) => {
                  changePartGroupFilter(val);
                  changeTypeFilter('ALL');
                }}
                options={[
                  {
                    value: 'ALL',
                    label: `${t('part_types.all_groups', 'Tous les Groupes')} (${effectivePartGroups.length})`,
                  },
                  ...effectivePartGroups.map((g: any) => ({
                    value: String(g.id_group || g.id_groupe || g.code || ''),
                    label: `${g.code || g.id_group} — ${g.libelle}`,
                  })),
                  {
                    value: 'UNASSIGNED',
                    label: t('part_types.unassigned_group', 'Non classés'),
                  },
                ]}
              />
            </FilterField>
          )}

          {/* 3. Classification (Famille or Type) (Col. D / Col. B) */}
          <FilterField
            label={
              activeWarehouseTab === 'PARTS' || isPartNature(currentNatureFilter)
                ? t('entrepot.modal.type')
                : t('entrepot.filters.family_label')
            }
            colBadge={activeWarehouseTab === 'PARTS' || isPartNature(currentNatureFilter) ? 'Col. B' : 'Col. D'}
            colBadgeColor="amber"
          >
            {activeWarehouseTab === 'PARTS' || isPartNature(currentNatureFilter) ? (
              <CustomSelect
                value={currentTypeFilter}
                prefixIcon={
                  <span className="w-5 h-5 rounded-md bg-amber-100 border border-amber-300/80 flex items-center justify-center text-amber-700 shadow-2xs">
                    <Tag className="w-3 h-3" />
                  </span>
                }
                onChange={(val) => changeTypeFilter(val)}
                options={[
                  { value: 'ALL', label: `${t('entrepot.filters.all_types')} (${types.length})` },
                  ...types
                    .filter((tObj: any) => {
                      if (currentPartGroupFilter === 'ALL') return true;
                      const gId = String(tObj.id_group || tObj.id_groupe || '').trim().toUpperCase();
                      if (currentPartGroupFilter === 'UNASSIGNED') return !gId;
                      return gId === String(currentPartGroupFilter).trim().toUpperCase();
                    })
                    .map((tObj: any) => ({
                      value: tObj.id_type,
                      label: `${tObj.libelle} (${tObj.id_type})`,
                    })),
                ]}
              />
            ) : (
              <CustomSelect
                value={currentFamilyFilter}
                prefixIcon={
                  <span className="w-5 h-5 rounded-md bg-amber-100 border border-amber-300/80 flex items-center justify-center text-amber-700 shadow-2xs">
                    <Factory className="w-3 h-3" />
                  </span>
                }
                onChange={(val) => {
                  changeFamilyFilter(val);
                  if (changeTemplateFilter) changeTemplateFilter('ALL');
                }}
                options={[
                  { value: 'ALL', label: `${t('entrepot.filters.all_families')} (${families.length})` },
                  ...families.map((f) => ({
                    value: f.id_family,
                    label: `${f.libelle} (${f.id_family})`,
                  })),
                ]}
              />
            )}
          </FilterField>

          {/* 4. Rattachement & Emplacement (Col. E) */}
          <FilterField label={t('entrepot.filters.rattachement_label')} colBadge="Col. E" colBadgeColor="amber">
            <CustomSelect
              value={currentRattachementFilter}
              prefixIcon={
                <span className="w-5 h-5 rounded-md bg-amber-100 border border-amber-300/80 flex items-center justify-center text-amber-700 shadow-2xs">
                  <MapPin className="w-3 h-3" />
                </span>
              }
              onChange={(val) => changeRattachementFilter(val)}
              options={[
                { value: 'ALL', label: t('entrepot.filters.all_rattachements') },
                { value: 'MACHINE', label: '🏭 Machine', badge: '[E]', badgeColor: 'bg-teal-50 text-teal-800' },
                { value: 'ZONE', label: '📍 Zone / Atelier', badge: '[F]', badgeColor: 'bg-purple-50 text-purple-800' },
                { value: 'ENTREPOT', label: '🏢 Entrepôt Central', badge: '[E]', badgeColor: 'bg-slate-100 text-slate-800' },
              ]}
            />
          </FilterField>

          {/* 5. Sort Menu Button & Popover */}
          <div className="relative" ref={sortMenuRef}>
            <div className="flex items-center justify-between mb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-800">
              <span>{t('entrepot.filters.sort_label')}</span>
              <span className="px-1.5 py-0.2 rounded text-[9.5px] font-mono font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/80">
                Ordre
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowSortMenu(!showSortMenu)}
              className={`w-full h-9 px-2.5 rounded-xl border text-xs font-semibold transition flex items-center justify-between cursor-pointer ${
                showSortMenu || sortField !== 'id_warehouse_item' || sortOrder !== 'asc'
                  ? 'bg-amber-50/80 text-amber-950 border-amber-300 ring-1 ring-amber-200'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <div className="flex items-center gap-2 truncate">
                <span className="w-5 h-5 rounded-md bg-amber-100 border border-amber-300/80 flex items-center justify-center text-amber-700 shrink-0 shadow-2xs">
                  <ArrowUpDown className="w-3 h-3" />
                </span>
                <span className="truncate">
                  {t('entrepot.filters.sort_by')} <b className="font-mono text-slate-900">{sortField.slice(0, 10).toUpperCase()}</b> (
                  {sortOrder === 'asc' ? t('entrepot.filters.order_asc') : t('entrepot.filters.order_desc')})
                </span>
              </div>
              <ChevronDown
                className={`w-3 h-3 text-slate-400 transition-transform shrink-0 ${showSortMenu ? 'rotate-180' : ''}`}
              />
            </button>

            {/* Sort Popover Menu */}
            {showSortMenu && (
              <div className="absolute right-0 mt-1 w-64 bg-white rounded-2xl border border-slate-200 shadow-xl z-50 p-2.5 space-y-1.5 animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  <span>{t('entrepot.filters.sort_label')}</span>
                  <span>A→H</span>
                </div>
                <div className="grid grid-cols-1 gap-1 text-xs max-h-60 overflow-y-auto pr-0.5">
                  {[
                    { key: 'id_warehouse_item', label: t('entrepot.filters.code_col') },
                    { key: 'nature', label: t('entrepot.modal.nature') },
                    { key: 'designation', label: t('entrepot.filters.designation_col') },
                    { key: 'id_family', label: t('entrepot.filters.family_col') },
                    { key: 'rattachement_type', label: t('entrepot.filters.rattachement_col') },
                    { key: 'emplacement', label: t('entrepot.filters.location_col') },
                    { key: 'status', label: t('entrepot.filters.status_col') },
                    { key: 'stockActuel', label: t('entrepot.filters.stock_col') },
                  ].map((col) => (
                    <button
                      key={col.key}
                      type="button"
                      onClick={() => {
                        handleSort(col.key);
                        setShowSortMenu(false);
                      }}
                      className={`px-2.5 py-1.5 rounded-lg border text-left font-medium text-[11px] flex items-center justify-between transition cursor-pointer ${
                        sortField === col.key
                          ? 'bg-amber-50 text-amber-950 border-amber-300 font-bold'
                          : 'bg-slate-50 text-slate-700 border-slate-200/80 hover:bg-slate-100'
                      }`}
                    >
                      <span>{col.label}</span>
                      {sortField === col.key && (
                        sortOrder === 'asc' ? (
                          <ArrowUp className="w-3.5 h-3.5 text-amber-700" />
                        ) : (
                          <ArrowDown className="w-3.5 h-3.5 text-amber-700" />
                        )
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </IndustrialFilterCard>

      {/* 5. Main Table (Dedicated Components Table or Parts Table with Smooth Transition) */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`warehouse-table-${activeWarehouseTab}`}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
        >
          {activeWarehouseTab === 'COMPONENTS' ? (
            <ComponentsTable
              displayedData={displayedData}
              rawLength={rawDisplayedData.length}
              isTableReady={isTableReady}
              startIndex={startIndex}
              sortField={sortField}
              sortOrder={sortOrder}
              handleSort={handleSort}
              renderSortIcon={renderSortIcon}
              families={families}
              templates={templates}
              zones={zones}
              machines={machines}
              machineMotorCounts={machineMotorCounts}
              activeActionMenuId={activeActionMenuId}
              setActiveActionMenuId={setActiveActionMenuId}
              handleOpenQuickModal={handleOpenQuickModal}
              setSelectedDetails={setSelectedDetails}
              handleOpenEditModal={handleOpenEditModal}
              setToDelete={setToDelete}
              canCreateMovement={canCreateMovement}
              canEditStock={canEditStock}
              canDeleteStock={canDeleteStock}
              onNavigateToFamily={onNavigateToFamily}
              onNavigateToTemplate={onNavigateToTemplate}
              onNavigateToMachine={onNavigateToMachine}
              onNavigateToZone={onNavigateToZone}
              handleOpenAddModal={canCreateStock ? handleOpenAddModal : undefined}
            />
          ) : (
            <PartsTable
              displayedData={displayedData}
              rawLength={rawDisplayedData.length}
              isTableReady={isTableReady}
              startIndex={startIndex}
              sortField={sortField}
              sortOrder={sortOrder}
              handleSort={handleSort}
              renderSortIcon={renderSortIcon}
              partGroups={effectivePartGroups}
              types={types}
              diagnostics={diagnostics}
              zones={zones}
              machines={machines}
              activeActionMenuId={activeActionMenuId}
              setActiveActionMenuId={setActiveActionMenuId}
              handleOpenQuickModal={handleOpenQuickModal}
              setSelectedDetails={setSelectedDetails}
              handleOpenEditModal={handleOpenEditModal}
              setToDelete={setToDelete}
              canCreateMovement={canCreateMovement}
              canEditStock={canEditStock}
              canDeleteStock={canDeleteStock}
              onNavigateToPartGroups={onNavigateToPartGroups}
              onNavigateToType={onNavigateToType}
              onNavigateToPartTypes={onNavigateToPartTypes}
              onNavigateToDiag={onNavigateToDiag}
              onNavigateToMachine={onNavigateToMachine}
              onNavigateToZone={onNavigateToZone}
              handleOpenAddModal={canCreateStock ? handleOpenAddModal : undefined}
            />
          )}
        </motion.div>
      </AnimatePresence>

      {/* Pagination Footer */}
      <TablePaginationCard
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
        pageSize={pageSize}
        setPageSize={setPageSize}
        totalItems={totalItems}
        pageSizeOptions={[25, 50, 100, 200, 0]}
        color={activeWarehouseTab === 'COMPONENTS' ? 'blue' : 'indigo'}
        itemLabel={
          activeWarehouseTab === 'COMPONENTS'
            ? t('entrepot.table.item_label_components')
            : t('entrepot.table.item_label_parts')
        }
      />

      {/* 6 & 7. ADD & EDIT MODALS (Extracted Component) */}
      <EntrepotFormModals
        showAddModal={showAddModal}
        onCloseAddModal={() => setShowAddModal(false)}
        addForm={addForm}
        setAddForm={setAddForm}
        onSubmitAdd={handleSubmitAdd}
        onAddNatureSwitch={handleAddNatureSwitch}
        onAddFamilyChange={handleAddFamilyChange}
        onAddFamilyPrefixChange={handleAddFamilyPrefixChange}
        onAddTemplateChange={handleAddTemplateChange}
        onAddTypeChange={handleAddTypeChange}
        onAddDiagChange={handleAddDiagChange}
        onCascadeFamilyPrefixUpdate={handleCascadeFamilyPrefixUpdate}
        toEdit={toEdit}
        onCloseEditModal={() => setToEdit(null)}
        editForm={editForm}
        setEditForm={setEditForm}
        onSubmitEdit={handleSubmitEdit}
        families={families}
        templates={templates}
        availableAddTemplates={availableAddTemplates}
        types={types}
        diagnostics={diagnostics}
        availableAddDiags={availableAddDiags}
        familyComponentCodes={familyComponentCodes}
        zones={zones}
        machines={machines}
        activeTechnicians={activeTechnicians}
        t={t}
      />

      {/* 8. DELETE CONFIRMATION MODAL */}
      <EntrepotDeleteModal
        open={Boolean(toDelete)}
        onCancel={() => setToDelete(null)}
        onConfirm={handleConfirmDelete}
        t={t}
      />

      {/* 9. DETAILS MODAL */}
      <EntrepotDetailsModal
        selectedDetails={selectedDetails}
        onClose={() => setSelectedDetails(null)}
        t={t}
      />

      {/* 10. Quick Movement Modal for Row-Level Operations */}
      <QuickMovementModal
        isOpen={quickModalState.isOpen}
        onClose={() => setQuickModalState((prev) => ({ ...prev, isOpen: false }))}
        article={quickModalState.article}
        initialFlow={quickModalState.initialFlow}
        initialAction={quickModalState.initialAction}
        zones={zones}
        machines={machines}
        technicians={activeTechnicians}
        mouvements={mouvements}
        onAddMouvement={onAddMouvement}
      />

      {/* Excel Formulas Preview Modal */}
      <EntrepotFormulasModal
        open={showFormulasModal}
        onClose={() => setShowFormulasModal(false)}
        t={t}
      />
    </AnimatedPage>
  );
}
