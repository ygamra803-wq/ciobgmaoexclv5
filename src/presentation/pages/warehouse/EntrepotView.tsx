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
  Trash2,
  Edit2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronDown,
  Warehouse,
  Factory,
  Tag,
  Check,
  X,
  Zap,
  Copy,
  Calculator,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { CubeIcon } from '../../components/common/icons/CubeIcon';
import { LayersIcon } from '../../components/common/icons/LayersIcon';
import { usePermission } from '../../components/common/PermissionGate';
import FormulasModalButton from '../../components/common/FormulasModalButton';
import Action3DButton from '../../components/common/Action3DButton';
import TablePaginationCard from '../../components/common/TablePaginationCard';
import IndustrialFilterCard, { FilterField, FilterSearchInput } from '../../components/common/IndustrialFilterCard';
import ComponentsTable from './components/ComponentsTable';
import PartsTable from './components/PartsTable';
import { useTranslation } from '../../../i18n/I18nContext';

export default function EntrepotView({
  warehouseItems = [],
  _entrepotComponents = [],
  families: propFamilies = [],
  templates: propTemplates = [],
  types: propTypes = [],
  diagnostics: propDiagnostics = [],
  compFamilies = [],
  compTemplates = [],
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
  onNavigateToType,
  onNavigateToPartTypes,
  onNavigateToDiag,
  onNavigateToZone,
  onNavigateToMachine,
}) {
  const { t } = useTranslation();
  const families = compFamilies && compFamilies.length > 0 ? compFamilies : propFamilies;
  const templates = compTemplates && compTemplates.length > 0 ? compTemplates : propTemplates;
  const types = partTypes && partTypes.length > 0 ? partTypes : propTypes;
  const diagnostics = partDesignations && partDesignations.length > 0 ? partDesignations : propDiagnostics;
  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [toEdit, setToEdit] = useState(null);
  const [toDelete, setToDelete] = useState(null);
  const [selectedDetails, setSelectedDetails] = useState(null);
  const [showFormulasModal, setShowFormulasModal] = useState(false);

  // Quick Action / Movement Modal State
  const [activeActionMenuId, setActiveActionMenuId] = useState(null);
  const [quickModalState, setQuickModalState] = useState({
    isOpen: false,
    article: null,
    initialFlow: 'Sortie Interne',
    initialAction: 'CORRECTIVE',
  });

  // Local filter states if not provided via props
  const [internalFamilyFilter, setInternalFamilyFilter] = useState('ALL');
  const [internalTemplateFilter, setInternalTemplateFilter] = useState('ALL');
  const [internalTypeFilter, setInternalTypeFilter] = useState('ALL');
  const [internalNatureFilter, setInternalNatureFilter] = useState('ALL');
  const [internalRattachementFilter, setInternalRattachementFilter] = useState('ALL');
  const [internalStatusFilter, setInternalStatusFilter] = useState('ALL');
  const [activeKpiFilter, setActiveKpiFilter] = useState('ALL'); // ALL | 'COMPONENT' | 'PART' | 'SERVICE' | 'RESERVE'

  // Backward compatibility nature matchers
  const isComponentNature = (n) => n === 'COMPONENT' || n === 'PARTIE';
  const isPartNature = (n) => n === 'PART' || n === 'COMPOSANT';

  const currentFamilyFilter = whFamilyFilter !== undefined ? whFamilyFilter : internalFamilyFilter;
  const changeFamilyFilter = setWhFamilyFilter || setInternalFamilyFilter;

  const currentTemplateFilter =
    whTemplateFilter !== undefined ? whTemplateFilter : internalTemplateFilter;
  const changeTemplateFilter = setWhTemplateFilter || setInternalTemplateFilter;

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

  useEffect(() => {
    const handler = setTimeout(() => {
      if (setWhSearch) setWhSearch(localSearch);
    }, 200);
    return () => clearTimeout(handler);
  }, [localSearch, setWhSearch]);

  // Form state for add modal (Dual Twin)
  const [familyComponentCodes, setFamilyComponentCodes] = useState(() => {
    const initialMap = {};
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
      if (isComponentNature(item.nature) && item.id_family && item.id_warehouse_item) {
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
      if (isComponentNature(it.nature)) {
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
      if (isPartNature(it.nature)) {
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
        (it) => isComponentNature(it.nature) && it.id_family === familyId
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

  const [addForm, setAddForm] = useState({
    id_warehouse_item: '',
    designation: '',
    nature: 'COMPONENT', // 'COMPONENT' (Machine Twin) | 'PART' (Stock Twin)
    id_family: '',
    family_prefix: '', // Prefix stored/entered for this family (e.g. EXT)
    id_templates: '',
    id_type: '',
    id_diag: '',
    rattachement_type: 'ENTREPOT', // 'MACHINE' | 'ZONE' | 'ENTREPOT'
    id_machine_registered: '',
    id_zone: '',
    technician: '',
    status: 'En stock (Disponible)',
    emplacement: 'E-MAG-01',
    stockInitial: 1,
    seuil: 0,
    remarques: '',
  });

  // Form state for edit modal
  const [editForm, setEditForm] = useState({
    id_warehouse_item: '',
    designation: '',
    nature: 'COMPONENT',
    id_family: '',
    id_templates: '',
    id_type: '',
    id_diag: '',
    rattachement_type: 'ENTREPOT',
    id_machine_registered: '',
    id_zone: '',
    technician: '',
    status: 'En stock (Disponible)',
    emplacement: '',
    stockInitial: 1,
    seuil: 0,
    remarques: '',
  });

  // Open Add Modal initialized with smart auto-code
  const handleOpenAddModal = () => {
    if (activeWarehouseTab === 'PARTS') {
      const defaultType = types[0]?.id_type || 'TYPE-MEC';
      const relDiags = diagnostics.filter((d) => d.id_type === defaultType);
      const defaultDiag = relDiags[0]?.id_diag || '';
      const autoCode = getNextPartRef(defaultType);
      const defaultDiagObj = diagnostics.find((d) => d.id_diag === defaultDiag);

      setAddForm({
        id_warehouse_item: autoCode,
        designation: defaultDiagObj ? defaultDiagObj.libelle : '',
        nature: 'PART',
        id_family: '',
        family_prefix: '',
        id_templates: '',
        id_type: defaultType,
        id_diag: defaultDiag,
        rattachement_type: 'ENTREPOT',
        id_machine_registered: '',
        id_zone: zones[0]?.id_zone || '',
        technician: technicians[0]?.nom || '',
        status: 'En stock (Disponible)',
        emplacement: 'E-MAG-PDR-01',
        stockInitial: 1,
        seuil: 0,
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
        rattachement_type: 'ENTREPOT',
        id_machine_registered: '',
        id_zone: zones[0]?.id_zone || '',
        technician: technicians[0]?.nom || '',
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
      const defaultDiag = relDiags[0]?.id_diag || '';
      const autoCode = getNextPartRef(defaultType);
      const defaultDiagObj = diagnostics.find((d) => d.id_diag === defaultDiag);

      setAddForm((prev) => ({
        ...prev,
        nature: 'PART',
        id_type: defaultType,
        id_diag: defaultDiag,
        id_warehouse_item: autoCode,
        designation: defaultDiagObj ? defaultDiagObj.libelle : prev.designation,
      }));
    }
  };

  // Open Edit Modal
  const handleOpenEditModal = (item) => {
    setToEdit(item);
    setEditForm({
      id_warehouse_item: item.id_warehouse_item || '',
      designation: item.designation || '',
      nature: item.nature || 'COMPONENT',
      id_family: item.id_family || '',
      id_templates: item.id_templates || '',
      id_type: item.id_type || '',
      id_diag: item.id_diag || '',
      rattachement_type: item.rattachement_type || 'ENTREPOT',
      id_machine_registered: item.id_machine_registered || '',
      id_zone: item.id_zone || '',
      technician: item.technician || '',
      status: item.status || 'En service',
      emplacement: item.emplacement || '',
      stockInitial: item.stockInitial != null ? item.stockInitial : 1,
      seuil: item.seuil != null ? item.seuil : 0,
      remarques: item.remarques || '',
    });
    setActiveActionMenuId(null);
  };

  const handleOpenQuickModal = (item, flow, action) => {
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
    }));
  };

  const handleAddTypeChange = (newType) => {
    const relDiags = diagnostics.filter((d) => d.id_type === newType);
    const newDiag = relDiags[0]?.id_diag || '';
    const autoCode = getNextPartRef(newType);
    const diagObj = diagnostics.find((d) => d.id_diag === newDiag);

    setAddForm((prev) => ({
      ...prev,
      id_type: newType,
      id_diag: newDiag,
      id_warehouse_item: autoCode,
      designation: diagObj ? diagObj.libelle : prev.designation,
    }));
  };

  const handleAddDiagChange = (newDiag) => {
    const diagObj = diagnostics.find((d) => d.id_diag === newDiag);
    setAddForm((prev) => ({
      ...prev,
      id_diag: newDiag,
      designation: diagObj ? diagObj.libelle : prev.designation,
    }));
  };

  // Submit Add
  const handleSubmitAdd = (e) => {
    e.preventDefault();
    if (!addForm.id_warehouse_item || !addForm.designation) {
      alert('Veuillez renseigner le code et la désignation.');
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
      onAddWarehouseItem({
        id_warehouse_item: addForm.id_warehouse_item.trim().toUpperCase(),
        designation: addForm.designation.trim(),
        nature: addForm.nature,
        id_family: isComp ? addForm.id_family : '',
        id_templates: isComp ? addForm.id_templates : '',
        id_type: !isComp ? addForm.id_type : '',
        id_diag: !isComp ? addForm.id_diag : '',
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
      });
    }
    setShowAddModal(false);
  };

  // Submit Edit
  const handleSubmitEdit = (e) => {
    e.preventDefault();
    if (!editForm.designation) {
      alert('La désignation est obligatoire.');
      return;
    }

    if (onUpdateWarehouseItem) {
      const isComp = isComponentNature(editForm.nature);
      onUpdateWarehouseItem(toEdit.id_warehouse_item, {
        ...toEdit,
        designation: editForm.designation.trim(),
        nature: editForm.nature,
        id_family: isComp ? editForm.id_family : '',
        id_templates: isComp ? editForm.id_templates : '',
        id_type: !isComp ? editForm.id_type : '',
        id_diag: !isComp ? editForm.id_diag : '',
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
      });
    }
    setToEdit(null);
  };

  // Confirm Delete
  const handleConfirmDelete = () => {
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
      if (mId && isComponentNature(item.nature)) {
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
      // Tab filter (Strict isolation between Components and Parts)
      if (activeWarehouseTab === 'COMPONENTS' && !isComponentNature(item.nature)) return false;
      if (activeWarehouseTab === 'PARTS' && !isPartNature(item.nature)) return false;

      // Nature filter
      if (currentNatureFilter !== 'ALL') {
        if (isComponentNature(currentNatureFilter) && !isComponentNature(item.nature)) return false;
        if (isPartNature(currentNatureFilter) && !isPartNature(item.nature)) return false;
      }

      // KPI filter
      if (isComponentNature(activeKpiFilter) && !isComponentNature(item.nature)) return false;
      if (isPartNature(activeKpiFilter) && !isPartNature(item.nature)) return false;
      if (activeKpiFilter === 'SERVICE' && !String(item.status || '').toLowerCase().includes('service')) return false;
      if (activeKpiFilter === 'RESERVE' && !String(item.status || '').toLowerCase().includes('stock') && !String(item.status || '').toLowerCase().includes('dispo')) return false;

      // Family filter (for components)
      if (
        isComponentNature(item.nature) &&
        currentFamilyFilter !== 'ALL' &&
        item.id_family !== currentFamilyFilter
      ) {
        return false;
      }

      // Template filter (for components)
      if (
        isComponentNature(item.nature) &&
        currentTemplateFilter !== 'ALL' &&
        item.id_templates !== currentTemplateFilter
      ) {
        return false;
      }

      // Type filter (for parts)
      if (
        isPartNature(item.nature) &&
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
    currentNatureFilter,
    activeKpiFilter,
    currentFamilyFilter,
    currentTemplateFilter,
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
  const displayedData = useMemo(() => {
    const minRows = 19;
    if (rawDisplayedData.length >= minRows) return rawDisplayedData;
    const padded = [...rawDisplayedData];
    for (let i = 0; i < minRows - rawDisplayedData.length; i++) {
      padded.push({ __isEmptyPlaceholder: true, id_warehouse_item: `empty-${i}` });
    }
    return padded;
  }, [rawDisplayedData]);

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
      if (isComponentNature(item.nature)) components++;
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
    currentTypeFilter,
    currentRattachementFilter,
    currentStatusFilter,
    setWhSearch,
    changeNatureFilter,
    changeFamilyFilter,
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
        'Rattachement (E)',
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
        item.rattachement_type || '',
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
    <AnimatedPage className="space-y-5">
      {/* 1. Top Banner (BDR Light GMAO Header Card with 3D Tactile Elevation) */}
      <div className="bg-white p-5 md:p-6 rounded-2xl border border-slate-200/90 shadow-[0_12px_32px_-6px_rgba(0,0,0,0.12),0_4px_12px_-2px_rgba(0,0,0,0.06)] hover:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.16),0_6px_16px_-3px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-300 ease-out flex flex-col xl:flex-row xl:items-center xl:justify-between gap-5 relative overflow-hidden group/header">
        {/* Subtle Ambient Gradient Background Highlight */}
        <div className="absolute -top-12 -right-12 w-48 h-48 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none group-hover/header:bg-indigo-500/10 transition-colors duration-500" />

        <div className="min-w-0 flex-1 flex items-start sm:items-center gap-3.5 relative">
          {/* 3D Elevated Page Badge Icon */}
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500/10 via-indigo-500/5 to-transparent border border-indigo-200/90 shadow-[0_4px_12px_rgba(99,102,241,0.12)] flex items-center justify-center text-indigo-700 group-hover/header:scale-105 group-hover/header:border-indigo-400/80 transition-all duration-300 shrink-0">
            <Warehouse className="w-6 h-6 text-indigo-700 transition-transform duration-300 group-hover/header:scale-110" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-black text-slate-900 tracking-tight">
                {t('entrepot.title')}
              </h2>
              <span className="px-2.5 py-0.5 text-[10px] font-mono font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full">
                {t('entrepot.registered_count', { count: warehouseItems.length })}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1 max-w-3xl leading-relaxed">
              {t('entrepot.subtitle')}
            </p>
          </div>
        </div>

        {/* Right Column: Action Buttons at Top, Tabs Below */}
        <div className="flex flex-col items-stretch sm:items-end gap-2.5 shrink-0 relative">
          {/* Top Row: Circular Action Buttons (Formulas Modal & Action3D with smooth switch animation) */}
          <div className="flex items-center justify-end gap-2.5">
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

          {/* Bottom Row: Tab Switcher (Components vs Parts) — Equal Width & Structured */}
          <div className="inline-grid grid-cols-2 p-1 bg-slate-100/90 rounded-2xl border border-slate-200/90 shadow-2xs w-full sm:w-[340px] select-none">
            <button
              type="button"
              onClick={() => handleTabSwitch('COMPONENTS')}
              className={`w-full py-2 px-3 rounded-xl text-xs font-bold transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap ${
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
              className={`w-full py-2 px-3 rounded-xl text-xs font-bold transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap ${
                activeWarehouseTab === 'PARTS'
                  ? 'bg-white text-indigo-950 shadow-[0_2px_8px_rgba(0,0,0,0.08)] border border-slate-200/60'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50 border border-transparent'
              }`}
            >
              <LayersIcon className={`w-4 h-4 shrink-0 ${activeWarehouseTab === 'PARTS' ? 'text-indigo-600' : 'text-slate-500'}`} />
              <span className="truncate">{t('entrepot.tabs.parts')} ({kpis.parts})</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Top Metric Cards (Interactive KPI Filter Bar) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Card 1: Total Global */}
        <div
          onClick={() => {
            setActiveKpiFilter('ALL');
            changeNatureFilter('ALL');
          }}
          className={`bg-white p-4 rounded-2xl border transition-all cursor-pointer shadow-[0_12px_32px_-6px_rgba(0,0,0,0.12),0_4px_12px_-2px_rgba(0,0,0,0.06)] hover:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.16),0_6px_16px_-3px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-300 ease-out flex items-center justify-between ${
            activeKpiFilter === 'ALL' && currentNatureFilter === 'ALL'
              ? 'border-teal-500 ring-2 ring-teal-100 bg-teal-50/20'
              : 'border-slate-200 hover:border-slate-300'
          }`}
        >
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              {t('entrepot.stats.global_inventory')}
            </span>
            <span className="text-2xl font-black text-slate-900 mt-0.5 block font-mono">
              {kpis.total}
            </span>
            <span className="text-[11px] text-slate-500 mt-0.5 block">
              {t('entrepot.stats.global_sub')}
            </span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center shrink-0 border border-teal-200/60">
            <Warehouse className="w-5 h-5 text-teal-700" />
          </div>
        </div>

        {/* Card 2: Components (Ensembles / Sub-systems) */}
        <div
          onClick={() => {
            setActiveKpiFilter('COMPONENT');
            changeNatureFilter('COMPONENT');
          }}
          className={`bg-white p-4 rounded-2xl border transition-all cursor-pointer shadow-[0_12px_32px_-6px_rgba(0,0,0,0.12),0_4px_12px_-2px_rgba(0,0,0,0.06)] hover:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.16),0_6px_16px_-3px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-300 ease-out flex items-center justify-between ${
            isComponentNature(currentNatureFilter) || isComponentNature(activeKpiFilter)
              ? 'border-blue-500 ring-2 ring-blue-100 bg-blue-50/20'
              : 'border-slate-200 hover:border-slate-300'
          }`}
        >
          <div>
            <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider block">
              {t('entrepot.stats.components_title')}
            </span>
            <span className="text-2xl font-black text-blue-700 mt-0.5 block font-mono">
              {kpis.components}
            </span>
            <span className="text-[11px] text-slate-500 mt-0.5 block">
              {t('entrepot.stats.components_sub')}
            </span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center shrink-0 border border-blue-200/60">
            <CubeIcon className="w-5 h-5 text-blue-700" />
          </div>
        </div>

        {/* Card 3: Parts (Pièces détachées) */}
        <div
          onClick={() => {
            setActiveKpiFilter('PART');
            changeNatureFilter('PART');
          }}
          className={`bg-white p-4 rounded-2xl border transition-all cursor-pointer shadow-[0_12px_32px_-6px_rgba(0,0,0,0.12),0_4px_12px_-2px_rgba(0,0,0,0.06)] hover:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.16),0_6px_16px_-3px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-300 ease-out flex items-center justify-between ${
            isPartNature(currentNatureFilter) || isPartNature(activeKpiFilter)
              ? 'border-indigo-500 ring-2 ring-indigo-100 bg-indigo-50/20'
              : 'border-slate-200 hover:border-slate-300'
          }`}
        >
          <div>
            <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider block">
              {t('entrepot.stats.parts_title')}
            </span>
            <span className="text-2xl font-black text-indigo-700 mt-0.5 block font-mono">
              {kpis.parts}
            </span>
            <span className="text-[11px] text-slate-500 mt-0.5 block">
              {t('entrepot.stats.parts_sub')}
            </span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center shrink-0 border border-indigo-200/60">
            <LayersIcon className="w-5 h-5 text-indigo-700" />
          </div>
        </div>

        {/* Card 4: En Service Actif */}
        <div
          onClick={() => {
            setActiveKpiFilter('SERVICE');
          }}
          className={`bg-white p-4 rounded-2xl border transition-all cursor-pointer shadow-[0_12px_32px_-6px_rgba(0,0,0,0.12),0_4px_12px_-2px_rgba(0,0,0,0.06)] hover:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.16),0_6px_16px_-3px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-300 ease-out flex items-center justify-between ${
            activeKpiFilter === 'SERVICE'
              ? 'border-emerald-500 ring-2 ring-emerald-100 bg-emerald-50/20'
              : 'border-slate-200 hover:border-slate-300'
          }`}
        >
          <div>
            <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">
              {t('entrepot.stats.active_service')}
            </span>
            <span className="text-2xl font-black text-emerald-700 mt-0.5 block font-mono">
              {kpis.enService}
            </span>
            <span className="text-[11px] text-slate-500 mt-0.5 block">
              {t('entrepot.stats.active_service_sub')}
            </span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0 border border-emerald-200/60">
            <CheckCircle2 className="w-5 h-5 text-emerald-700" />
          </div>
        </div>
      </div>

      {/* 4. Central Unified Industrial Filter & Search Card */}
      <IndustrialFilterCard
        title={t('common.filters.title')}
        subtitle={t('entrepot.filters.subtitle')}
        color="teal"
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
        {/* 5-Column Multi-Criteria Filter Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 items-end">
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
            focusRingColor="focus:ring-teal-500"
            className="w-full sm:col-span-2 lg:col-span-1"
          />

          {/* 2. Nature Twin Filter (Col. B) */}
          <FilterField label={t('entrepot.modal.nature')} colBadge="Col. B" colBadgeColor="teal">
            <CustomSelect
              value={currentNatureFilter}
              prefixIcon={
                <span className="w-5 h-5 rounded-md bg-teal-100 border border-teal-300/80 flex items-center justify-center text-teal-700 shadow-2xs">
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

          {/* 3. Classification (Famille or Type) (Col. D / Col. B) */}
          <FilterField
            label={isPartNature(currentNatureFilter) ? t('entrepot.modal.type') : t('entrepot.filters.family_label')}
            colBadge={isPartNature(currentNatureFilter) ? 'Col. B' : 'Col. D'}
            colBadgeColor="cyan"
          >
            {isPartNature(currentNatureFilter) ? (
              <CustomSelect
                value={currentTypeFilter}
                prefixIcon={
                  <span className="w-5 h-5 rounded-md bg-cyan-100 border border-cyan-300/80 flex items-center justify-center text-cyan-700 shadow-2xs">
                    <Tag className="w-3 h-3" />
                  </span>
                }
                onChange={(val) => changeTypeFilter(val)}
                options={[
                  { value: 'ALL', label: `${t('entrepot.filters.all_types')} (${types.length})` },
                  ...types.map((t) => ({
                    value: t.id_type,
                    label: `${t.libelle} (${t.id_type})`,
                  })),
                ]}
              />
            ) : (
              <CustomSelect
                value={currentFamilyFilter}
                prefixIcon={
                  <span className="w-5 h-5 rounded-md bg-cyan-100 border border-cyan-300/80 flex items-center justify-center text-cyan-700 shadow-2xs">
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
          <FilterField label={t('entrepot.filters.rattachement_label')} colBadge="Col. E" colBadgeColor="purple">
            <CustomSelect
              value={currentRattachementFilter}
              prefixIcon={
                <span className="w-5 h-5 rounded-md bg-purple-100 border border-purple-300/80 flex items-center justify-center text-purple-700 shadow-2xs">
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
                  ? 'bg-indigo-50/80 text-indigo-950 border-indigo-300 ring-1 ring-indigo-200'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <div className="flex items-center gap-2 truncate">
                <span className="w-5 h-5 rounded-md bg-indigo-100 border border-indigo-300/80 flex items-center justify-center text-indigo-700 shrink-0 shadow-2xs">
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
                          ? 'bg-indigo-50 text-indigo-950 border-indigo-300 font-bold'
                          : 'bg-slate-50 text-slate-700 border-slate-200/80 hover:bg-slate-100'
                      }`}
                    >
                      <span>{col.label}</span>
                      {sortField === col.key && (
                        sortOrder === 'asc' ? (
                          <ArrowUp className="w-3.5 h-3.5 text-indigo-700" />
                        ) : (
                          <ArrowDown className="w-3.5 h-3.5 text-indigo-700" />
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
              canEditStock={canEditStock}
              canDeleteStock={canDeleteStock}
              onNavigateToFamily={onNavigateToFamily}
              onNavigateToTemplate={onNavigateToTemplate}
              onNavigateToMachine={onNavigateToMachine}
              onNavigateToZone={onNavigateToZone}
              handleOpenAddModal={handleOpenAddModal}
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
              canEditStock={canEditStock}
              canDeleteStock={canDeleteStock}
              onNavigateToType={onNavigateToType}
              onNavigateToPartTypes={onNavigateToPartTypes}
              onNavigateToDiag={onNavigateToDiag}
              onNavigateToMachine={onNavigateToMachine}
              onNavigateToZone={onNavigateToZone}
              handleOpenAddModal={handleOpenAddModal}
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

      {/* 6. ADD MODAL (Dual Twin Architecture) */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/45 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg border border-slate-200 overflow-hidden flex flex-col">
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between bg-white">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-700 font-bold">
                  <Plus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">
                    {t('entrepot.modal.add_component_title')}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {t('entrepot.modal.nature')}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <form onSubmit={handleSubmitAdd} className="p-4 sm:p-5 space-y-4 text-xs">
              {/* Nature Selector (Dual Twin Toggle) */}
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1.5">
                  {t('entrepot.modal.nature')} *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleAddNatureSwitch('COMPONENT')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                      isComponentNature(addForm.nature)
                        ? 'bg-blue-50 text-blue-700 border-blue-300 ring-2 ring-blue-500/20'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <CubeIcon className="w-3.5 h-3.5" />
                    <span>{t('entrepot.modal.nature_component')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddNatureSwitch('PART')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                      isPartNature(addForm.nature)
                        ? 'bg-indigo-50 text-indigo-700 border-indigo-300 ring-2 ring-indigo-500/20'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <LayersIcon className="w-3.5 h-3.5" />
                    <span>{t('entrepot.modal.nature_part')}</span>
                  </button>
                </div>
              </div>

              {/* Code & Designation */}
              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    {t('entrepot.modal.code_element')} *
                  </label>
                  <input
                    type="text"
                    value={addForm.id_warehouse_item}
                    onChange={(e) =>
                      setAddForm({ ...addForm, id_warehouse_item: e.target.value.toUpperCase() })
                    }
                    className="w-full h-9 px-3 rounded-xl border border-slate-200 bg-slate-50 text-xs font-mono font-bold text-slate-900 focus:bg-white focus:border-teal-500 outline-none"
                    required
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    {t('entrepot.modal.designation')} *
                  </label>
                  <input
                    type="text"
                    value={addForm.designation}
                    onChange={(e) => setAddForm({ ...addForm, designation: e.target.value })}
                    placeholder="Ex: Moteur Triphasé 5.5kW"
                    className="w-full h-9 px-3 rounded-xl border border-slate-200 bg-white text-xs font-semibold focus:border-teal-500 outline-none"
                    required
                  />
                </div>
              </div>

              {/* Dynamic Classification according to Nature */}
              {isComponentNature(addForm.nature) ? (
                <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-100 space-y-2.5">
                  <div className="text-[10px] font-bold text-blue-700 uppercase tracking-wider flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5" />
                      <span>{t('entrepot.modal.family')}</span>
                    </div>
                    {addForm.id_family && familyComponentCodes[addForm.id_family] ? (
                      <span className="px-2 py-0.5 rounded-md text-[9.5px] font-mono font-bold bg-blue-100 text-blue-800 border border-blue-200">
                        {familyComponentCodes[addForm.id_family]}
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-md text-[9.5px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                        Nouveau
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div>
                      <label className="text-[10.5px] font-semibold text-slate-700 block mb-1">
                        {t('entrepot.modal.family')} *
                      </label>
                      <select
                        value={addForm.id_family}
                        onChange={(e) => handleAddFamilyChange(e.target.value)}
                        className="w-full h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-xs font-medium focus:border-blue-500 outline-none"
                      >
                        {families.map((f) => (
                          <option key={f.id_family} value={f.id_family}>
                            {f.libelle} ({f.id_family})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-[10.5px] font-semibold text-slate-700 block mb-1">
                        {t('entrepot.modal.code_element')} *
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          value={addForm.family_prefix || ''}
                          onChange={(e) => handleAddFamilyPrefixChange(e.target.value)}
                          placeholder="Ex: EXT, MOT, POM..."
                          className="w-full h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-xs font-mono font-bold text-blue-900 focus:border-blue-500 outline-none uppercase"
                        />
                        {familyComponentCodes[addForm.id_family] && (
                          <span
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1 py-0.5 rounded border border-emerald-200"
                            title="OK"
                          >
                            ✓
                          </span>
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="text-[10.5px] font-semibold text-slate-700 block mb-1">
                        {t('entrepot.modal.template')}
                      </label>
                      <select
                        value={addForm.id_templates}
                        onChange={(e) => handleAddTemplateChange(e.target.value)}
                        className="w-full h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-xs focus:border-blue-500 outline-none"
                      >
                        <option value="">-- {t('entrepot.filters.all_templates')} --</option>
                        {availableAddTemplates.map((tObj) => (
                          <option key={tObj.id_templates} value={tObj.id_templates}>
                            {tObj.libelle}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="text-[10.5px] text-slate-500 bg-white/70 p-2 rounded-lg border border-blue-100/70 flex items-center justify-between gap-2 flex-wrap">
                    <span className="leading-tight">
                      Code auto-généré : <b className="text-blue-700 font-bold font-mono">{addForm.id_warehouse_item || '...'}</b>
                    </span>
                    {addForm.id_family && addForm.family_prefix && (
                      <button
                        type="button"
                        onClick={() => {
                          handleCascadeFamilyPrefixUpdate(addForm.id_family, addForm.family_prefix);
                        }}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold text-blue-800 bg-blue-100 hover:bg-blue-200 border border-blue-300 transition cursor-pointer"
                      >
                        <Zap className="w-3 h-3 text-blue-600" />
                        <span>Mettre à jour</span>
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-indigo-50/50 rounded-xl border border-indigo-100 space-y-2.5">
                  <div className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <CubeIcon className="w-3.5 h-3.5" />
                      <span>{t('entrepot.modal.type')}</span>
                    </div>
                    <span className="px-2 py-0.5 rounded-md text-[9.5px] font-mono font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
                      Réf: {addForm.id_warehouse_item || 'PART-01'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10.5px] font-semibold text-slate-700 block mb-1">
                        {t('entrepot.modal.type')} *
                      </label>
                      <select
                        value={addForm.id_type}
                        onChange={(e) => handleAddTypeChange(e.target.value)}
                        className="w-full h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-xs focus:border-indigo-500 outline-none font-semibold"
                      >
                        {types.map((tObj) => (
                          <option key={tObj.id_type} value={tObj.id_type}>
                            {tObj.libelle} ({tObj.id_type})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10.5px] font-semibold text-slate-700 block mb-1">
                        {t('entrepot.modal.diag')}
                      </label>
                      <select
                        value={addForm.id_diag}
                        onChange={(e) => handleAddDiagChange(e.target.value)}
                        className="w-full h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-xs focus:border-indigo-500 outline-none"
                      >
                        <option value="">-- {t('entrepot.modal.diag')} --</option>
                        {availableAddDiags.map((d) => (
                          <option key={d.id_diag} value={d.id_diag}>
                            {d.libelle}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Location & Rattachement */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    {t('entrepot.modal.rattachement')}
                  </label>
                  <select
                    value={addForm.rattachement_type}
                    onChange={(e) => setAddForm({ ...addForm, rattachement_type: e.target.value })}
                    className="w-full h-9 px-3 rounded-xl border border-slate-200 bg-white text-xs font-semibold focus:border-teal-500 outline-none"
                  >
                    <option value="MACHINE">{t('entrepot.modal.machine')}</option>
                    <option value="ZONE">{t('entrepot.modal.zone')}</option>
                    <option value="ENTREPOT">{t('entrepot.modal.location')}</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">{t('entrepot.modal.status')}</label>
                  <select
                    value={addForm.status}
                    onChange={(e) => setAddForm({ ...addForm, status: e.target.value })}
                    className="w-full h-9 px-3 rounded-xl border border-slate-200 bg-white text-xs font-semibold focus:border-teal-500 outline-none"
                  >
                    <option value="En stock (Disponible)">{t('entrepot.filters.in_stock')}</option>
                    <option value="En service">{t('entrepot.filters.in_service')}</option>
                    <option value="En révision / Externe">{t('entrepot.filters.under_revision')}</option>
                    <option value="Hors service">Hors Service</option>
                  </select>
                </div>
              </div>

              {addForm.rattachement_type === 'MACHINE' ? (
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    {t('entrepot.modal.machine')}
                  </label>
                  <select
                    value={addForm.id_machine_registered}
                    onChange={(e) =>
                      setAddForm({ ...addForm, id_machine_registered: e.target.value })
                    }
                    className="w-full h-9 px-3 rounded-xl border border-slate-200 bg-white text-xs font-mono font-bold text-purple-800 focus:border-teal-500 outline-none"
                  >
                    <option value="">-- {t('entrepot.modal.machine')} --</option>
                    {machines.map((m) => (
                      <option key={m.id_machine_registered} value={m.id_machine_registered}>
                        {m.id_machine_registered} - {m.designation}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                      {t('entrepot.modal.location')}
                    </label>
                    <input
                      type="text"
                      value={addForm.emplacement}
                      onChange={(e) => setAddForm({ ...addForm, emplacement: e.target.value })}
                      placeholder="Ex: E-MAG-A01"
                      className="w-full h-9 px-3 rounded-xl border border-slate-200 bg-white text-xs font-mono focus:border-teal-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                      {t('entrepot.modal.initial_stock')}
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={addForm.stockInitial}
                      onChange={(e) => setAddForm({ ...addForm, stockInitial: e.target.value })}
                      className="w-full h-9 px-3 rounded-xl border border-slate-200 bg-white text-xs font-mono font-bold focus:border-teal-500 outline-none"
                    />
                  </div>
                </div>
              )}

              {/* Responsable & Remarques */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    {t('entrepot.modal.responsible')}
                  </label>
                  <select
                    value={addForm.technician}
                    onChange={(e) => setAddForm({ ...addForm, technician: e.target.value })}
                    className="w-full h-9 px-3 rounded-xl border border-slate-200 bg-white text-xs focus:border-teal-500 outline-none"
                  >
                    <option value="">-- {t('entrepot.modal.responsible')} --</option>
                    {technicians.map((tech) => (
                      <option key={tech.id_technician || tech.nom} value={tech.nom}>
                        {tech.nom} ({tech.id_technician})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    {t('entrepot.modal.threshold')}
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={addForm.seuil}
                    onChange={(e) => setAddForm({ ...addForm, seuil: e.target.value })}
                    className="w-full h-9 px-3 rounded-xl border border-slate-200 bg-white text-xs font-mono focus:border-teal-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  {t('entrepot.modal.notes')}
                </label>
                <textarea
                  rows="2"
                  value={addForm.remarques}
                  onChange={(e) => setAddForm({ ...addForm, remarques: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs focus:border-teal-500 outline-none"
                />
              </div>

              {/* Actions */}
              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold cursor-pointer"
                >
                  {t('entrepot.buttons.cancel')}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-black text-white font-bold transition shadow-[0_12px_32px_-6px_rgba(0,0,0,0.12),0_4px_12px_-2px_rgba(0,0,0,0.06)] hover:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.16),0_6px_16px_-3px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-300 ease-out cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>{t('entrepot.buttons.save')}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. EDIT MODAL */}
      {toEdit && (
        <div className="fixed inset-0 z-50 bg-slate-900/45 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg border border-slate-200 overflow-hidden flex flex-col">
            <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between bg-white">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700 font-bold">
                  <Edit2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">
                    {t('entrepot.modal.edit_title')} : {toEdit.id_warehouse_item}
                  </h3>
                  <p className="text-xs text-slate-500">{t('entrepot.modal.designation')}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setToEdit(null)}
                className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitEdit} className="p-4 sm:p-5 space-y-4 text-xs">
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  {t('entrepot.modal.designation')} *
                </label>
                <input
                  type="text"
                  value={editForm.designation}
                  onChange={(e) => setEditForm({ ...editForm, designation: e.target.value })}
                  className="w-full h-9 px-3 rounded-xl border border-slate-200 bg-white text-xs font-semibold focus:border-blue-500 outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    {t('entrepot.modal.rattachement')}
                  </label>
                  <select
                    value={editForm.rattachement_type}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        rattachement_type: e.target.value,
                      })
                    }
                    className="w-full h-9 px-3 rounded-xl border border-slate-200 bg-white text-xs font-semibold focus:border-blue-500 outline-none"
                  >
                    <option value="MACHINE">{t('entrepot.modal.machine')}</option>
                    <option value="ZONE">{t('entrepot.modal.zone')}</option>
                    <option value="ENTREPOT">{t('entrepot.modal.location')}</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">{t('entrepot.modal.status')}</label>
                  <select
                    value={editForm.status}
                    onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                    className="w-full h-9 px-3 rounded-xl border border-slate-200 bg-white text-xs font-semibold focus:border-blue-500 outline-none"
                  >
                    <option value="En service">{t('entrepot.filters.in_service')}</option>
                    <option value="En stock (Disponible)">{t('entrepot.filters.in_stock')}</option>
                    <option value="En révision / Externe">{t('entrepot.filters.under_revision')}</option>
                    <option value="Hors service">Hors Service</option>
                  </select>
                </div>
              </div>

              {editForm.rattachement_type === 'MACHINE' ? (
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    {t('entrepot.modal.machine')}
                  </label>
                  <select
                    value={editForm.id_machine_registered}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        id_machine_registered: e.target.value,
                      })
                    }
                    className="w-full h-9 px-3 rounded-xl border border-slate-200 bg-white text-xs font-mono font-bold text-purple-800 focus:border-blue-500 outline-none"
                  >
                    <option value="">-- {t('entrepot.modal.machine')} --</option>
                    {machines.map((m) => (
                      <option key={m.id_machine_registered} value={m.id_machine_registered}>
                        {m.id_machine_registered} - {m.designation}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                      {t('entrepot.modal.location')}
                    </label>
                    <input
                      type="text"
                      value={editForm.emplacement}
                      onChange={(e) => setEditForm({ ...editForm, emplacement: e.target.value })}
                      className="w-full h-9 px-3 rounded-xl border border-slate-200 bg-white text-xs font-mono focus:border-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                      {t('entrepot.modal.initial_stock')}
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={editForm.stockInitial}
                      onChange={(e) => setEditForm({ ...editForm, stockInitial: e.target.value })}
                      className="w-full h-9 px-3 rounded-xl border border-slate-200 bg-white text-xs font-mono font-bold focus:border-blue-500 outline-none"
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    {t('entrepot.modal.responsible')}
                  </label>
                  <select
                    value={editForm.technician}
                    onChange={(e) => setEditForm({ ...editForm, technician: e.target.value })}
                    className="w-full h-9 px-3 rounded-xl border border-slate-200 bg-white text-xs focus:border-blue-500 outline-none"
                  >
                    <option value="">-- {t('entrepot.modal.responsible')} --</option>
                    {technicians.map((tech) => (
                      <option key={tech.id_technician || tech.nom} value={tech.nom}>
                        {tech.nom} ({tech.id_technician})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    {t('entrepot.modal.threshold')}
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={editForm.seuil}
                    onChange={(e) => setEditForm({ ...editForm, seuil: e.target.value })}
                    className="w-full h-9 px-3 rounded-xl border border-slate-200 bg-white text-xs font-mono focus:border-blue-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  {t('entrepot.modal.notes')}
                </label>
                <textarea
                  rows="2"
                  value={editForm.remarques}
                  onChange={(e) => setEditForm({ ...editForm, remarques: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs focus:border-blue-500 outline-none"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setToEdit(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold cursor-pointer"
                >
                  {t('entrepot.buttons.cancel')}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-black text-white font-bold transition shadow-[0_12px_32px_-6px_rgba(0,0,0,0.12),0_4px_12px_-2px_rgba(0,0,0,0.06)] hover:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.16),0_6px_16px_-3px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-300 ease-out cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>{t('entrepot.buttons.save')}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 8. DELETE CONFIRMATION MODAL */}
      {toDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/45 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm border border-slate-200 p-5 space-y-4 text-center">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-slate-900">{t('entrepot.modal.delete_title')}</h3>
              <p className="text-xs text-slate-500 mt-1">
                {t('entrepot.modal.delete_confirm')}
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setToDelete(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-semibold hover:bg-slate-50 transition cursor-pointer text-xs"
              >
                {t('entrepot.buttons.cancel')}
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold transition cursor-pointer text-xs shadow-[0_12px_32px_-6px_rgba(0,0,0,0.12),0_4px_12px_-2px_rgba(0,0,0,0.06)] hover:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.16),0_6px_16px_-3px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-300 ease-out"
              >
                {t('entrepot.buttons.delete')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 9. DETAILS MODAL */}
      {selectedDetails && (
        <div className="fixed inset-0 z-50 bg-slate-900/45 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg border border-slate-200 p-5 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-teal-50 border border-teal-200 text-teal-700 flex items-center justify-center font-bold">
                  <Warehouse className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                    <span>{selectedDetails.code || selectedDetails.id_warehouse_item}</span>
                    {selectedDetails.ref && (
                      <span className="text-xs font-mono font-normal text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                        Réf: {selectedDetails.ref}
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-slate-500">{t('entrepot.subtitle')}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedDetails(null)}
                className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              {/* Identifiers Card (Map Philosophy) */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  {t('entrepot.modal.code_element')}
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-white p-2 rounded-lg border border-slate-200">
                    <span className="text-[10px] text-slate-400 block font-semibold">{t('entrepot.modal.code_element')}</span>
                    <span className="font-mono font-bold text-teal-800 text-sm">{selectedDetails.code || selectedDetails.id_warehouse_item}</span>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-slate-200">
                    <span className="text-[10px] text-slate-400 block font-semibold">{t('entrepot.columns.code_ref')}</span>
                    <span className="font-mono font-bold text-slate-800 text-sm">{selectedDetails.ref || 'N/A'}</span>
                  </div>
                </div>
                {selectedDetails.id && (
                  <div className="bg-white p-2 rounded-lg border border-slate-200 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-slate-400 block font-semibold">ID</span>
                      <span className="font-mono text-[11px] font-bold text-slate-700 select-all">{selectedDetails.id}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigator.clipboard?.writeText(selectedDetails.id)}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold cursor-pointer border border-slate-300"
                    >
                      <Copy className="w-3 h-3" />
                      <span>Copier</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Designation */}
              <div className="p-3 bg-slate-50 rounded-xl space-y-1">
                <div className="text-[10px] font-bold text-slate-400 uppercase">{t('entrepot.modal.designation')}</div>
                <div className="font-semibold text-slate-900">{selectedDetails.designation}</div>
              </div>

              {/* Nature and Status */}
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2.5 bg-slate-50 rounded-xl">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">{t('entrepot.modal.nature')}</div>
                  <div className="font-bold text-slate-800 flex items-center gap-1.5 mt-0.5">
                    {isComponentNature(selectedDetails.nature) ? (
                      <span className="inline-flex items-center gap-1 text-blue-700">
                        <Layers className="w-3.5 h-3.5 text-blue-600" />
                        {t('entrepot.modal.nature_component')}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-indigo-700">
                        <CubeIcon className="w-3.5 h-3.5 text-indigo-600" />
                        {t('entrepot.modal.nature_part')}
                      </span>
                    )}
                  </div>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-xl">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">{t('entrepot.modal.status')}</div>
                  <div className="font-bold text-slate-800">{selectedDetails.status}</div>
                </div>
              </div>

              {isComponentNature(selectedDetails.nature) ? (
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2.5 bg-blue-50/50 rounded-xl border border-blue-100">
                    <div className="text-[10px] font-bold text-blue-700 uppercase">{t('entrepot.modal.family')}</div>
                    <div className="font-bold text-slate-800">{selectedDetails.id_family || '--'}</div>
                  </div>
                  <div className="p-2.5 bg-blue-50/50 rounded-xl border border-blue-100">
                    <div className="text-[10px] font-bold text-blue-700 uppercase">{t('entrepot.modal.template')}</div>
                    <div className="font-bold text-slate-800">{selectedDetails.id_templates || '--'}</div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2.5 bg-indigo-50/50 rounded-xl border border-indigo-100">
                    <div className="text-[10px] font-bold text-indigo-700 uppercase">{t('entrepot.modal.type')}</div>
                    <div className="font-bold text-slate-800">{selectedDetails.id_type || '--'}</div>
                  </div>
                  <div className="p-2.5 bg-indigo-50/50 rounded-xl border border-indigo-100">
                    <div className="text-[10px] font-bold text-indigo-700 uppercase">{t('entrepot.modal.diag')}</div>
                    <div className="font-bold text-slate-800">{selectedDetails.id_diag || '--'}</div>
                  </div>
                </div>
              )}

              {/* Machine Rattachement */}
              <div className="p-3 bg-slate-50 rounded-xl space-y-2">
                <div className="text-[10px] font-bold text-slate-400 uppercase">{t('entrepot.modal.rattachement')}</div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[10px] text-slate-400 block font-medium">{t('entrepot.modal.rattachement')}</span>
                    <span className="font-bold text-slate-800">
                      {selectedDetails.rattachement_type === 'MACHINE'
                        ? `${t('entrepot.modal.machine')} : ${selectedDetails.id_machine_registered || selectedDetails.id_machine}`
                        : selectedDetails.rattachement_type === 'ZONE'
                          ? `${t('entrepot.modal.zone')} : ${selectedDetails.id_zone}`
                          : t('entrepot.modal.location')}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block font-medium">{t('entrepot.modal.location')}</span>
                    <span className="font-mono font-bold text-slate-800">
                      {selectedDetails.emplacement || '--'}
                    </span>
                  </div>
                </div>
              </div>

              {selectedDetails.remarques && (
                <div className="p-3 bg-slate-50 rounded-xl space-y-1">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">
                    {t('entrepot.modal.notes')}
                  </div>
                  <div className="text-slate-700">{selectedDetails.remarques}</div>
                </div>
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedDetails(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer"
              >
                {t('entrepot.buttons.close')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 10. Quick Movement Modal for Row-Level Operations */}
      <QuickMovementModal
        isOpen={quickModalState.isOpen}
        onClose={() => setQuickModalState((prev) => ({ ...prev, isOpen: false }))}
        article={quickModalState.article}
        initialFlow={quickModalState.initialFlow}
        initialAction={quickModalState.initialAction}
        zones={zones}
        machines={machines}
        technicians={technicians}
        mouvements={mouvements}
        onAddMouvement={onAddMouvement}
      />

      {/* Excel Formulas Preview Modal */}
      {showFormulasModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full p-5 space-y-4 animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-cyan-50 border border-cyan-200 flex items-center justify-center text-cyan-700 shrink-0">
                  <Calculator className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
                    <span>{t('entrepot.formulas.title')}</span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    {t('entrepot.formulas.subtitle')}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowFormulasModal(false)}
                className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition cursor-pointer shrink-0"
                title={t('entrepot.buttons.close')}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Content: 4 Formula Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              {/* Formule Twin Component */}
              <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/90 flex flex-col justify-between gap-2 hover:border-blue-300 transition">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 truncate">
                    <CubeIcon className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span className="truncate">{t('entrepot.formulas.f1_title')}</span>
                  </div>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-blue-100/80 text-blue-800 border border-blue-200 shrink-0">
                    Col. [H]
                  </span>
                </div>
                <div className="font-mono text-xs text-blue-800 font-bold bg-white p-2 rounded-lg border border-blue-100">
                  Code = Auto(Famille, Template)
                </div>
                <p className="text-[10.5px] text-slate-500 leading-tight">
                  {t('entrepot.formulas.f1_desc')}
                </p>
              </div>

              {/* Formule Twin Part */}
              <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/90 flex flex-col justify-between gap-2 hover:border-indigo-300 transition">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 truncate">
                    <LayersIcon className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                    <span className="truncate">{t('entrepot.formulas.f2_title')}</span>
                  </div>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-indigo-100/80 text-indigo-800 border border-indigo-200 shrink-0">
                    Col. [G]
                  </span>
                </div>
                <div className="font-mono text-xs text-indigo-800 font-bold bg-white p-2 rounded-lg border border-indigo-100">
                  Code = Auto(Type, Désignation)
                </div>
                <p className="text-[10.5px] text-slate-500 leading-tight">
                  {t('entrepot.formulas.f2_desc')}
                </p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <span className="text-[11px] text-slate-400 font-medium">
                {t('entrepot.formulas.footer_note')}
              </span>
              <button
                onClick={() => setShowFormulasModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-bold transition shadow-[0_12px_32px_-6px_rgba(0,0,0,0.12),0_4px_12px_-2px_rgba(0,0,0,0.06)] hover:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.16),0_6px_16px_-3px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-300 ease-out cursor-pointer"
              >
                {t('entrepot.buttons.close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </AnimatedPage>
  );
}
