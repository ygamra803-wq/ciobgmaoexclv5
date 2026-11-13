import React, { useState, useRef, useMemo, useEffect } from 'react';
import AnimatedPage from '../../components/common/AnimatedPage';
import Action3DButton from '../../components/common/Action3DButton';
import FormulasModalButton from '../../components/common/FormulasModalButton';
import PageHeaderIcon from '../../components/common/PageHeaderIcon';
import CustomSelect from '../../components/common/CustomSelect';
import {
  FingerprintPattern,
  Layers,
  Search,
  Trash2,
  Edit2,
  AlertTriangle,
  SlidersHorizontal,
  ArrowUpDown,
  ChevronDown,
  RotateCcw,
  ArrowUp,
  ArrowDown,
  Factory,
  Wrench,
  Info,
  X,
  GitBranch,
  MoreVertical,
  Sliders,
  FileText,
  Radio,
  FileSpreadsheet,
  Calendar,
} from 'lucide-react';
import { CubeIcon } from '../../components/common/icons/CubeIcon';
import { Blueprint, BlueprintPdrItem, applyBlueprintPlanToActiveMachines } from '../../../core/domain';
import { LayersIcon } from '../../components/common/icons/LayersIcon';
import { HubIcon } from '../../components/common/icons/HubIcon';
import { CategoryIcon } from '../../components/common/icons/CategoryIcon';
import { SpokeIcon } from '../../components/common/icons/SpokeIcon';
import GmaoIndustrialDataGrid from '../../components/common/GmaoIndustrialDataGrid';
import { useI18n } from '../../../i18n/I18nContext';
import { filterActiveMachines } from '../../../utils/activeMachines';
import { useGmaoStore } from '../../../store/useGmaoStore';
import {
  BlueprintInspectModal,
  BlueprintRecord,
  BlueprintComponentItem,
  BlueprintPartItem,
  BlueprintPreventiveDraft,
  BlueprintCommonFailureDraft,
  BlueprintApplyFeedback,
  BlueprintMachineRow,
  BlueprintPreventiveActionOption,
  BlueprintStockItemOption,
} from './components/BlueprintInspectModal';
import {
  BlueprintFormModal,
  BlueprintDeleteModal,
  BlueprintFormulasModal,
  BlueprintFamilyOption,
  BlueprintTemplateOption,
  BlueprintCompTemplateOption,
  BlueprintPartTypeOption,
  BlueprintPartDesignationOption,
} from './components/BlueprintModals';

export interface BlueprintQuickCreatePreset {
  id_family?: string;
  id_templates?: string;
}

export interface BlueprintMouvementRow {
  id_machine_registered?: string;
  machine?: string;
  type?: string;
  quantite?: number;
  ref?: string;
  id_article?: string;
}

export interface BlueprintPreventiveTaskRow {
  id_blueprint?: string;
  id_machine?: string;
  code_machine?: string;
}

export interface BlueprintApplyPlanResult {
  addedCount: number;
  targetMachinesCount: number;
}

export interface BlueprintMachineViewProps {
  blueprints?: BlueprintRecord[];
  templates?: BlueprintTemplateOption[];
  families?: BlueprintFamilyOption[];
  machines?: BlueprintMachineRow[];
  compFamilies?: unknown[];
  compTemplates?: BlueprintCompTemplateOption[];
  partTypes?: BlueprintPartTypeOption[];
  partDesignations?: BlueprintPartDesignationOption[];
  stockItems?: BlueprintStockItemOption[];
  warehouseItems?: unknown[];
  mouvements?: BlueprintMouvementRow[];
  blueprintFamilyFilter?: string;
  setBlueprintFamilyFilter?: (filter: string) => void;
  blueprintTemplateFilter?: string;
  setBlueprintTemplateFilter?: (filter: string) => void;
  quickCreateBlueprintPreset?: BlueprintQuickCreatePreset | null;
  setQuickCreateBlueprintPreset?: (preset: BlueprintQuickCreatePreset | null) => void;
  onAddBlueprint?: (bp: BlueprintRecord) => void;
  onUpdateBlueprint?: (id: string, bp: BlueprintRecord) => void;
  onDeleteBlueprint?: (id: string) => void;
  onApplyBlueprintPreventivePlan?: ((bp: BlueprintRecord) => BlueprintApplyPlanResult | void) | null;
  preventiveActions?: BlueprintPreventiveActionOption[];
  preventiveTasks?: BlueprintPreventiveTaskRow[];
  onOpenAddFamilyModal?: () => void;
  onOpenAddTemplateModal?: () => void;
  onNavigateToMachinesByTemplate?: (templateId: string) => void;
  onNavigateToFamily?: (familyId: string) => void;
  onNavigateToTemplate?: (templateId: string) => void;
  onNavigateToTab?: (tabId: string, params?: Record<string, unknown>) => void;
}

export default function BlueprintMachineView({
  blueprints = [],
  templates = [],
  families = [],
  machines = [],
  compFamilies: _compFamilies = [],
  compTemplates = [],
  partTypes = [],
  partDesignations = [],
  stockItems = [],
  warehouseItems = [],
  mouvements = [],
  blueprintFamilyFilter = 'ALL',
  setBlueprintFamilyFilter = () => {},
  blueprintTemplateFilter = 'ALL',
  setBlueprintTemplateFilter = () => {},
  quickCreateBlueprintPreset = null,
  setQuickCreateBlueprintPreset = () => {},
  onAddBlueprint = () => {},
  onUpdateBlueprint = () => {},
  onDeleteBlueprint = () => {},
  onApplyBlueprintPreventivePlan = null,
  preventiveActions = [],
  preventiveTasks = [],
  onOpenAddFamilyModal: _onOpenAddFamilyModal = () => {},
  onOpenAddTemplateModal: _onOpenAddTemplateModal = () => {},
  onNavigateToMachinesByTemplate: _onNavigateToMachinesByTemplate = () => {},
  onNavigateToFamily: _onNavigateToFamily = () => {},
  onNavigateToTemplate: _onNavigateToTemplate = () => {},
  onNavigateToTab = () => {},
}: BlueprintMachineViewProps) {
  const { t } = useI18n();
  const [localSearch, setLocalSearch] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    const handler = setTimeout(() => {
      setSearch(localSearch);
    }, 200);
    return () => clearTimeout(handler);
  }, [localSearch]);

  const [showAddModal, setShowAddModal] = useState(false);
  const [showFormulasModal, setShowFormulasModal] = useState(false);
  const [activeModalTab, setActiveModalTab] = useState('specs'); // 'specs' | 'components' | 'parts' | 'pdr' | 'preventive'
  const [selectedInspectBlueprint, setSelectedInspectBlueprint] = useState<BlueprintRecord | null>(null);
  const [inspectActiveTab, setInspectActiveTab] = useState('specs');

  // Form State for Add/Edit Blueprint with BOM + Preventive Plan architecture
  const initialFormState: BlueprintRecord = {
    id_blueprint: '',
    libelle: '',
    id_family: families[0]?.id_family || '',
    id_templates: templates[0]?.id_templates || '',
    ref_plan: '',
    revision: 'Rev-A',
    statut: 'Approuvé',
    type_schema: 'Mécanique',
    description: '',
    specs: {
      puissance: '',
      course: '',
      moteur: '',
      dimensions: '',
    },
    components_theoriques: [],
    parts_theoriques: [],
    pdr_theoriques: [],
    preventivePlanItems: [],
    commonFailures: [],
  };

  const [form, setForm] = useState<BlueprintRecord>(initialFormState);
  const [toEdit, setToEdit] = useState<BlueprintRecord | null>(null);
  const [toDelete, setToDelete] = useState<BlueprintRecord | null>(null);

  // Helper inputs for adding items into Tab 2, 3, 4, 5, 6
  const [newCompItem, setNewCompItem] = useState<BlueprintComponentItem>({ id_component: '', libelle: '', qte: 1 });
  const [newPartItem, setNewPartItem] = useState<BlueprintPartItem>({ id_part: '', libelle: '', qte: 1 });
  const [newPdrItem, setNewPdrItem] = useState<BlueprintPdrItem>({
    id_pdr: '',
    libelle: '',
    qte: 1,
    criticite: 'Haute',
    parent_component_key: '',
  });
  const [newPreventiveItem, setNewPreventiveItem] = useState<BlueprintPreventiveDraft>({
    composant: '',
    action_code: 'C',
    frequence: 'Mensuel',
    duree_min: 15,
    description: '',
    pdr_ref: '',
  });
  const [newCommonFailureItem, setNewCommonFailureItem] = useState<BlueprintCommonFailureDraft>({
    title: '',
    type_panne: 'M',
    urgence: 'HAUTE',
    recommended_action: '',
    description: '',
    pdr_ref: '',
  });
  const [applyFeedback, setApplyFeedback] = useState<BlueprintApplyFeedback | null>(null);

  // Taken blueprint numbers for SequentialCodePicker
  const takenBlueprintNumbers = useMemo(() => {
    const set = new Set<number>();
    blueprints.forEach((b) => {
      const match = String(b.id_blueprint || '').match(/BPT-(\d+)/i) || String(b.id_blueprint || '').match(/-(\d+)$/);
      if (match) {
        set.add(parseInt(match[1], 10));
      }
    });
    return set;
  }, [blueprints]);

  // Next auto-generated ID for Add Modal
  const autoNextBlueprintId = useMemo(() => {
    let nextNum = 1;
    while (takenBlueprintNumbers.has(nextNum) && nextNum < 999) {
      nextNum++;
    }
    return `BPT-${String(nextNum).padStart(2, '0')}`;
  }, [takenBlueprintNumbers]);

  // Available templates based on selected family in modal
  const modalTemplates = useMemo(() => {
    if (!form.id_family) return templates;
    const filtered = templates.filter((t) => t.id_family === form.id_family);
    return filtered.length > 0 ? filtered : templates;
  }, [templates, form.id_family]);

  const editModalTemplates = useMemo(() => {
    if (!toEdit?.id_family) return templates;
    const filtered = templates.filter((t) => t.id_family === toEdit.id_family);
    return filtered.length > 0 ? filtered : templates;
  }, [templates, toEdit?.id_family]);

  // Active Action Menu Popover
  const [activeActionMenuId, setActiveActionMenuId] = useState<string | null>(null);
  const [showSortMenu, setShowSortMenu] = useState(false);
  const sortMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && !target.closest('.action-menu-container')) {
        setActiveActionMenuId(null);
      }
      if (sortMenuRef.current && target && !sortMenuRef.current.contains(target)) {
        setShowSortMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Sorting
  const [sortField, setSortField] = useState('id_blueprint');
  const [sortOrder, setSortOrder] = useState('asc');

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const renderSortIcon = (field: string) => {
    if (sortField !== field) {
      return (
        <ArrowUpDown className="w-3 h-3 text-slate-300 group-hover:text-slate-500 transition shrink-0" />
      );
    }
    return sortOrder === 'asc' ? (
      <ArrowUp className="w-3 h-3 text-indigo-700 shrink-0 font-bold" />
    ) : (
      <ArrowDown className="w-3 h-3 text-indigo-700 shrink-0 font-bold" />
    );
  };

  // Filtered templates for filter bar
  const availableFilterTemplates = useMemo(() => {
    if (blueprintFamilyFilter === 'ALL') return templates;
    return templates.filter((t) => t.id_family === blueprintFamilyFilter);
  }, [templates, blueprintFamilyFilter]);

  // Filtered blueprints list
  const filteredBlueprints = useMemo(() => {
    return blueprints.filter((b) => {
      if (blueprintFamilyFilter !== 'ALL' && b.id_family !== blueprintFamilyFilter) return false;
      if (blueprintTemplateFilter !== 'ALL' && b.id_templates !== blueprintTemplateFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const bId = String(b.id_blueprint || '').toLowerCase();
        const bLib = String(b.libelle || '').toLowerCase();
        const bPlan = String(b.ref_plan || '').toLowerCase();
        const bFam = String(b.id_family || '').toLowerCase();
        const bTpl = String(b.id_templates || '').toLowerCase();
        const bType = String(b.type_schema || '').toLowerCase();
        if (
          !bId.includes(q) &&
          !bLib.includes(q) &&
          !bPlan.includes(q) &&
          !bFam.includes(q) &&
          !bTpl.includes(q) &&
          !bType.includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [blueprints, blueprintFamilyFilter, blueprintTemplateFilter, search]);

  // Sorted blueprints
  const sortedBlueprints = useMemo(() => {
    return [...filteredBlueprints].sort((a, b) => {
      let valA = a[sortField] || '';
      let valB = b[sortField] || '';
      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredBlueprints, sortField, sortOrder]);

  // Standardized Pagination
  const [pageSize, setPageSize] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);

  const totalItems = sortedBlueprints.length;
  const effectivePageSize = pageSize === 0 ? totalItems : pageSize;
  const startIndex = (currentPage - 1) * effectivePageSize;
  
  const paginatedBlueprints = useMemo(() => {
    return pageSize === 0 ? sortedBlueprints : sortedBlueprints.slice(startIndex, startIndex + effectivePageSize);
  }, [sortedBlueprints, startIndex, effectivePageSize, pageSize]);

  // Map of machine counts per blueprint (using Domain model)
  const blueprintMachineCountMap = useMemo(() => {
    const counts: Record<string, number> = {};
    blueprints.forEach((b) => {
      const bp = new Blueprint(b);
      counts[b.id_blueprint] = bp.getMachinesLieesCount(machines);
    });
    return counts;
  }, [blueprints, machines]);

  // Map of ACTIVE linked machine counts per blueprint
  const blueprintActiveMachineCountMap = useMemo(() => {
    const counts: Record<string, number> = {};
    const activeMachines = filterActiveMachines(machines);
    blueprints.forEach((b) => {
      counts[b.id_blueprint] = activeMachines.filter((m) => m.id_blueprint === b.id_blueprint).length;
    });
    return counts;
  }, [blueprints, machines]);

  // Fast O(M + T) map of derived preventive tasks count per blueprint
  const blueprintDerivedTasksCountMap = useMemo(() => {
    const counts: Record<string, number> = {};
    const norm = (s: unknown) => String(s || '').trim().toUpperCase().replace(/[-_\s]/g, '');
    const machToBp = new Map<string, string>();
    (machines || []).forEach((m) => {
      if (!m?.id_blueprint) return;
      const mId = m.id_machine_registered || m.code_machine || m.id || m.id_machine || m.code;
      if (mId) {
        machToBp.set(String(mId).trim().toUpperCase(), m.id_blueprint);
        machToBp.set(norm(mId), m.id_blueprint);
      }
    });
    (preventiveTasks || []).forEach((t) => {
      if (!t) return;
      const bpId =
        t.id_blueprint ||
        machToBp.get(String(t.id_machine || t.code_machine || '').trim().toUpperCase()) ||
        machToBp.get(norm(t.id_machine || t.code_machine));
      if (bpId) {
        counts[bpId] = (counts[bpId] || 0) + 1;
      }
    });
    return counts;
  }, [machines, preventiveTasks]);

  // Listen to quickCreateBlueprintPreset
  useEffect(() => {
    if (quickCreateBlueprintPreset && (quickCreateBlueprintPreset.id_family || quickCreateBlueprintPreset.id_templates)) {
      setForm({
        ...initialFormState,
        id_blueprint: autoNextBlueprintId,
        id_family: quickCreateBlueprintPreset.id_family || families[0]?.id_family || '',
        id_templates: quickCreateBlueprintPreset.id_templates || templates[0]?.id_templates || '',
        libelle: `Architecture Blueprint - ${quickCreateBlueprintPreset.id_templates || ''}`,
      });
      setActiveModalTab('specs');
      setShowAddModal(true);
    }
  }, [quickCreateBlueprintPreset, autoNextBlueprintId]);

  const handleCloseModal = () => {
    setShowAddModal(false);
    setToEdit(null);
    if (quickCreateBlueprintPreset && setQuickCreateBlueprintPreset) {
      setQuickCreateBlueprintPreset(null);
    }
  };

  // Open Add Modal
  const handleOpenAddModal = () => {
    setForm({
      ...initialFormState,
      id_blueprint: autoNextBlueprintId,
      id_family: families[0]?.id_family || '',
      id_templates: templates[0]?.id_templates || '',
    });
    setActiveModalTab('specs');
    setShowAddModal(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (bp: BlueprintRecord) => {
    setApplyFeedback(null);
    setToEdit({
      ...bp,
      specs: {
        puissance: bp.specs?.puissance || '',
        course: bp.specs?.course || '',
        moteur: bp.specs?.moteur || '',
        dimensions: bp.specs?.dimensions || '',
        ...bp.specs,
      },
      components_theoriques: bp.components_theoriques || [],
      parts_theoriques: bp.parts_theoriques || [],
      pdr_theoriques: bp.pdr_theoriques || [],
      preventivePlanItems: Array.isArray(bp.preventivePlanItems) ? bp.preventivePlanItems : [],
      commonFailures: Array.isArray(bp.commonFailures) ? bp.commonFailures : [],
    });
    setActiveModalTab('specs');
  };

  // Submit Add
  const handleAddSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!form.id_blueprint || !form.libelle) return;
    onAddBlueprint({
      ...form,
      preventivePlanItems: Array.isArray(form.preventivePlanItems) ? form.preventivePlanItems : [],
      commonFailures: Array.isArray(form.commonFailures) ? form.commonFailures : [],
    });
    setShowAddModal(false);
    setForm(initialFormState);
    if (quickCreateBlueprintPreset && setQuickCreateBlueprintPreset) {
      setQuickCreateBlueprintPreset(null);
    }
  };

  // Submit Edit
  const handleEditSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!toEdit || !toEdit.id_blueprint || !toEdit.libelle) return;
    onUpdateBlueprint(toEdit.id_blueprint, {
      ...toEdit,
      preventivePlanItems: Array.isArray(toEdit.preventivePlanItems) ? toEdit.preventivePlanItems : [],
      commonFailures: Array.isArray(toEdit.commonFailures) ? toEdit.commonFailures : [],
    });
    setToEdit(null);
  };

  // Apply Blueprint Preventive Plan to Active Linked Machines Only
  const handleTriggerApplyPreventivePlan = (targetBlueprint: BlueprintRecord) => {
    if (!targetBlueprint) return;
    const normalizedBp = {
      ...targetBlueprint,
      preventivePlanItems: Array.isArray(targetBlueprint.preventivePlanItems)
        ? targetBlueprint.preventivePlanItems
        : [],
    };
    onUpdateBlueprint(normalizedBp.id_blueprint, normalizedBp);

    if (typeof onApplyBlueprintPreventivePlan === 'function') {
      const res = onApplyBlueprintPreventivePlan(normalizedBp);
      if (res) {
        setApplyFeedback(
          res.targetMachinesCount === 0
            ? { type: 'warning', message: 'Aucune machine active liée à ce Blueprint.' }
            : res.addedCount > 0
            ? {
                type: 'success',
                message: `${res.addedCount} tâche(s) générée(s) sur ${res.targetMachinesCount} machine(s) active(s) liée(s).`,
              }
            : {
                type: 'info',
                message: `Les tâches sont déjà présentes sur les ${res.targetMachinesCount} machine(s) active(s) liée(s).`,
              }
        );
      }
      return;
    }

    // Fallback store execution if prop not injected
    const storeState = useGmaoStore.getState();
    const effectiveWarehouse =
      Array.isArray(warehouseItems) && warehouseItems.length > 0
        ? warehouseItems
        : storeState.warehouseItems || [];
    const { addedTasks, updatedTasks, targetMachinesCount } = applyBlueprintPlanToActiveMachines(
      normalizedBp,
      machines,
      storeState.preventiveTasks || [],
      effectiveWarehouse
    );
    if (targetMachinesCount > 0 && addedTasks.length > 0) {
      storeState.setPreventiveTasks(updatedTasks);
    }
    setApplyFeedback(
      targetMachinesCount === 0
        ? { type: 'warning', message: 'Aucune machine active liée à ce Blueprint.' }
        : addedTasks.length > 0
        ? {
            type: 'success',
            message: `${addedTasks.length} tâche(s) générée(s) sur ${targetMachinesCount} machine(s) active(s) liée(s).`,
          }
        : {
            type: 'info',
            message: `Les tâches sont déjà présentes sur les ${targetMachinesCount} machine(s) active(s) liée(s).`,
          }
    );
  };

  // Extract real PDR from machine history into form
  const handleExtractFromMachineHistory = (machineCode?: string, target: 'add' | 'edit' = 'add') => {
    if (!machineCode) return;
    const relatedMvts = mouvements.filter(
      (m) =>
        (m.id_machine_registered === machineCode || m.machine === machineCode) &&
        (m.type === 'Sortie' || Number(m.quantite) > 0)
    );

    const map = new Map<string, BlueprintPdrItem>();
    relatedMvts.forEach((m) => {
      const ref = m.ref || m.id_article;
      if (!ref) return;
      const existing = map.get(ref) || { id_pdr: ref, libelle: ref, qte: 0, criticite: 'Moyenne' };
      existing.qte = (existing.qte || 0) + Math.abs(Number(m.quantite) || 1);
      map.set(ref, existing);
    });

    const extractedPdr = Array.from(map.values());
    if (extractedPdr.length === 0) {
      alert(`Aucune consommation PDR enregistrée pour la machine ${machineCode}.`);
      return;
    }

    if (target === 'add') {
      setForm((prev) => ({
        ...prev,
        pdr_theoriques: [
          ...(prev.pdr_theoriques || []),
          ...extractedPdr.filter((x) => !(prev.pdr_theoriques || []).some((p) => p.id_pdr === x.id_pdr)),
        ],
      }));
    } else {
      setToEdit((prev) =>
        prev
          ? {
              ...prev,
              pdr_theoriques: [
                ...(prev.pdr_theoriques || []),
                ...extractedPdr.filter((x) => !(prev.pdr_theoriques || []).some((p) => p.id_pdr === x.id_pdr)),
              ],
            }
          : prev
      );
    }
  };

  const handleExportExcel = () => {
    const headers = [
      'ID Blueprint',
      'Désignation',
      'Famille Machine',
      'Template / Modèle',
      'Réf Plan',
      'Type Schéma',
      'Puissance',
      'Course',
    ];
    const rows = filteredBlueprints.map((b) => [
      b.id_blueprint || '',
      b.libelle || '',
      b.id_family || '',
      b.id_templates || '',
      b.ref_plan || '',
      b.type_schema || '',
      b.specs?.puissance || '',
      b.specs?.course || '',
    ]);
    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(';'), ...rows.map((e) => e.join(';'))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `blueprints_bom_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const blueprintColumns = useMemo(
    () => [
      {
        key: 'id_blueprint',
        label: t('machines.blueprint.col_code', 'CODE BLUEPRINT (A)'),
        colLetter: 'A',
        icon: FingerprintPattern,
        sortable: true,
      },
      {
        key: 'libelle',
        label: t('machines.blueprint.col_libelle', 'LIBELLÉ DU PLAN (BOM) (B)'),
        colLetter: 'B',
        icon: FileText,
        sortable: true,
        headerClassName: 'min-w-[220px]',
      },
      {
        key: 'id_family',
        label: t('machines.blueprint.col_family_model', 'FAMILLE & MODÈLE (C+D)'),
        colLetter: 'C+D',
        icon: HubIcon,
        sortable: true,
        headerClassName: 'min-w-[170px]',
      },
      {
        key: 'specs',
        label: t('machines.blueprint.col_specs', 'SPÉCIFICATIONS'),
        colLetter: 'Specs',
        icon: Sliders,
        headerClassName: 'min-w-[150px]',
      },
      {
        key: 'composants',
        label: t('machines.blueprint.col_components', 'COMPOSANTS (E)'),
        colLetter: 'E',
        icon: SpokeIcon,
        align: 'center',
      },
      {
        key: 'parts',
        label: t('machines.blueprint.col_parts', 'PARTS (F)'),
        colLetter: 'F',
        icon: LayersIcon,
        align: 'center',
      },
      {
        key: 'pdr',
        label: t('machines.blueprint.col_pdr', 'PDR (G)'),
        colLetter: 'G',
        icon: CubeIcon,
        align: 'center',
      },
      {
        key: 'machines',
        label: t('machines.blueprint.col_machines', 'MACHINES'),
        colLetter: 'Flux',
        icon: Factory,
        align: 'center',
      },
      {
        key: 'statut',
        label: t('machines.blueprint.col_status', 'STATUT (H)'),
        colLetter: 'H',
        icon: Radio,
        sortable: true,
        align: 'center',
      },
      {
        key: 'actions',
        label: '•••',
        align: 'center',
        headerClassName: 'w-24 tracking-widest text-slate-400 font-bold',
      },
    ],
    [t]
  );

  return (
    <AnimatedPage className="space-y-5">
      {/* Top Banner (BDR Light GMAO Header Card with 3D Tactile Elevation) */}
      <div className="bg-white p-5 md:p-6 rounded-2xl border border-slate-200/90 shadow-[0_12px_32px_-6px_rgba(0,0,0,0.12),0_4px_12px_-2px_rgba(0,0,0,0.06)] hover:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.16),0_6px_16px_-3px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-300 ease-out flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative overflow-hidden group/header">
        {/* Subtle Ambient Gradient Background Highlight */}
        <div className="absolute -top-12 -right-12 w-48 h-48 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none group-hover/header:bg-emerald-500/10 transition-colors duration-500" />

        <div className="min-w-0 flex-1 flex items-start sm:items-center gap-3.5 relative">
          <PageHeaderIcon icon={FingerprintPattern} colorClass="text-emerald-700" />
          <div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight">
              {t('machines.blueprint.title')}
            </h2>
            <p className="text-xs text-slate-500 mt-1 max-w-3xl leading-relaxed">
              {t('machines.blueprint.subtitle')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 relative">
          <FormulasModalButton
            onClick={() => setShowFormulasModal(true)}
            title={t('machines.blueprint.formulas_button', 'Formules Excel (Blueprints BOM)')}
          />

          <Action3DButton
            variant="circle"
            color="emerald"
            icon={GitBranch}
            onClick={() => onNavigateToTab('nexus')}
            title="Matrice Nexus (Correspondance Clés)"
            ariaLabel="Nexus Matrix"
          />

          <Action3DButton
            variant="circle"
            color="indigo"
            icon={FingerprintPattern}
            showAddBadge={true}
            onClick={handleOpenAddModal}
            title={t('machines.blueprint.new_blueprint_button', 'Nouveau Blueprint (BOM)')}
          />
        </div>
      </div>

      {/* Filter Bar */}
      <div className="relative z-30 bg-white border border-slate-200 rounded-2xl p-4 md:p-5 shadow-[0_12px_32px_-6px_rgba(0,0,0,0.12),0_4px_12px_-2px_rgba(0,0,0,0.06)] hover:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.16),0_6px_16px_-3px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-300 ease-out space-y-4">
        {/* Header Toolbar: Icon + Title + Count Badge + Excel Export + Circular Reset */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-200/80 flex items-center justify-center text-amber-700 shadow-2xs shrink-0">
              <SlidersHorizontal className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="text-xs font-black uppercase tracking-wider text-slate-800">
                  {t('common.filters.title')}
                </span>
                <span className="bg-amber-50 text-amber-800 px-2.5 py-0.5 rounded-lg text-[11px] font-bold border border-amber-200/70 shadow-2xs font-mono">
                  {filteredBlueprints.length} / {blueprints.length}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium">
                {t('machines.blueprint.filters_subtitle', 'Nomenclature Maîtresse BOM des Machines • Colonnes A → H')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Export Excel Button */}
            <button
              onClick={handleExportExcel}
              className="h-8 px-3 rounded-xl border border-emerald-200/80 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs active:scale-95"
              title={t('common.filters.export_excel')}
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>{t('common.filters.export_excel')}</span>
            </button>

            {/* Circular Reset Button */}
            {(localSearch || search || blueprintFamilyFilter !== 'ALL' || blueprintTemplateFilter !== 'ALL' || sortField !== 'id_blueprint' || sortOrder !== 'asc') && (
              <button
                onClick={() => {
                  setLocalSearch('');
                  setSearch('');
                  setBlueprintFamilyFilter('ALL');
                  setBlueprintTemplateFilter('ALL');
                  setSortField('id_blueprint');
                  setSortOrder('asc');
                }}
                title={t('common.filters.reset_tooltip')}
                className="w-8 h-8 rounded-full border border-rose-200/80 bg-rose-50 hover:bg-rose-100 text-rose-700 transition flex items-center justify-center cursor-pointer shadow-2xs active:scale-95 animate-in fade-in shrink-0"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
          {/* Search */}
          <div className="w-full">
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-800">
                {t('common.filters.search')}
              </label>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wide bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs">
                Col. A + B
              </span>
            </div>
            <div className="relative flex items-center">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-md bg-amber-100 border border-amber-300/80 flex items-center justify-center text-amber-700 shadow-2xs pointer-events-none z-10">
                <Search className="w-3 h-3" />
              </span>
              <input
                type="text"
                placeholder={t('machines.blueprint.search_placeholder')}
                value={localSearch}
                onChange={(e) => setLocalSearch(e.target.value)}
                className="w-full h-10 pl-9 pr-8 rounded-xl border border-slate-200 bg-slate-50 text-xs font-medium text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition"
              />
              {localSearch && (
                <button
                  onClick={() => {
                    setLocalSearch('');
                    setSearch('');
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer z-10"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Family Filter */}
          <div className="w-full">
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-800">
                {t('machines.blueprint.family_filter_label')}
              </label>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wide bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs">
                Col. C
              </span>
            </div>
            <CustomSelect
              value={blueprintFamilyFilter}
              onChange={(val) => {
                setBlueprintFamilyFilter(val);
                setBlueprintTemplateFilter('ALL');
              }}
              prefixIcon={
                <span className="w-5 h-5 rounded-md bg-amber-100 border border-amber-300/80 flex items-center justify-center text-amber-700 shadow-2xs shrink-0">
                  <HubIcon className="w-3 h-3" />
                </span>
              }
              options={[
                {
                  value: 'ALL',
                  label: `${t('machines.blueprint.all_families')} (${families.length})`,
                  badge: `${blueprints.length}`,
                  badgeColor: 'bg-slate-100 text-slate-700 font-bold',
                },
                ...families.map((f) => {
                  const count = blueprints.filter((b) => b.id_family === f.id_family).length;
                  return {
                    value: f.id_family,
                    label: `${f.libelle || f.label_family} (${f.id_family})`,
                    badge: `${count}`,
                    badgeColor: 'bg-amber-50 text-amber-800 font-bold',
                  };
                }),
              ]}
            />
          </div>

          {/* Template Filter */}
          <div className="w-full">
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-800">
                {t('machines.blueprint.template_filter_label')}
              </label>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wide bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs">
                Col. D
              </span>
            </div>
            <CustomSelect
              value={blueprintTemplateFilter}
              onChange={(val) => setBlueprintTemplateFilter(val)}
              prefixIcon={
                <span className="w-5 h-5 rounded-md bg-amber-100 border border-amber-300/80 flex items-center justify-center text-amber-700 shadow-2xs shrink-0">
                  <CategoryIcon className="w-3 h-3" />
                </span>
              }
              options={[
                {
                  value: 'ALL',
                  label: `${t('machines.blueprint.all_templates')} (${availableFilterTemplates.length})`,
                  badge: `${filteredBlueprints.length}`,
                  badgeColor: 'bg-slate-100 text-slate-700 font-bold',
                },
                ...availableFilterTemplates.map((t) => {
                  const count = blueprints.filter((b) => b.id_templates === t.id_templates).length;
                  return {
                    value: t.id_templates,
                    label: `${t.libelle || t.label_templates} (${t.id_templates})`,
                    badge: `${count}`,
                    badgeColor: 'bg-amber-50 text-amber-800 font-bold',
                  };
                }),
              ]}
            />
          </div>

          {/* Sort Dropdown */}
          <div className="w-full relative" ref={sortMenuRef}>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-800">
                {t('common.filters.sort')}
              </label>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wide bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs">
                {sortOrder === 'asc' ? 'A→Z' : 'Z→A'}
              </span>
            </div>
            <button
              onClick={() => setShowSortMenu(!showSortMenu)}
              className={`w-full h-10 px-3 rounded-xl border text-xs font-semibold transition flex items-center justify-between cursor-pointer ${
                showSortMenu || sortField !== 'id_blueprint' || sortOrder !== 'asc'
                  ? 'bg-amber-50 text-amber-800 border-amber-300 ring-1 ring-amber-200 shadow-2xs'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-md bg-amber-100 border border-amber-300/80 flex items-center justify-center text-amber-700 shadow-2xs shrink-0">
                  <ArrowUpDown className="w-3 h-3" />
                </span>
                <span>
                  {t('common.filters.sort_prefix')} <b className="font-mono text-slate-900">{sortField.toUpperCase()}</b> (
                  {sortOrder === 'asc' ? 'A→Z' : 'Z→A'})
                </span>
              </div>
              <ChevronDown
                className={`w-3.5 h-3.5 text-slate-400 transition-transform ${showSortMenu ? 'rotate-180' : ''}`}
              />
            </button>

            {showSortMenu && (
              <div className="absolute left-0 right-0 mt-2 bg-white rounded-2xl border border-slate-200 shadow-xl z-50 p-3 space-y-2 animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <span className="flex items-center gap-1.5 text-slate-700 font-semibold">
                    <SlidersHorizontal className="w-3.5 h-3.5 text-amber-600" />
                    Trier par
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-1 text-xs">
                  <button
                    onClick={() => {
                      if (sortField === 'id_blueprint') {
                        setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                      } else {
                        setSortField('id_blueprint');
                        setSortOrder('asc');
                      }
                    }}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg font-medium transition cursor-pointer ${
                      sortField === 'id_blueprint'
                        ? 'bg-amber-50 text-amber-800 font-bold'
                        : 'hover:bg-slate-50 text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <span>Code Blueprint (A)</span>
                    {sortField === 'id_blueprint' &&
                      (sortOrder === 'asc' ? (
                        <ArrowUp className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      ) : (
                        <ArrowDown className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      ))}
                  </button>

                  <button
                    onClick={() => {
                      if (sortField === 'libelle') {
                        setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                      } else {
                        setSortField('libelle');
                        setSortOrder('asc');
                      }
                    }}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg font-medium transition cursor-pointer ${
                      sortField === 'libelle'
                        ? 'bg-amber-50 text-amber-800 font-bold'
                        : 'hover:bg-slate-50 text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <span>Libellé du Plan BOM (B)</span>
                    {sortField === 'libelle' &&
                      (sortOrder === 'asc' ? (
                        <ArrowUp className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      ) : (
                        <ArrowDown className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      ))}
                  </button>

                  <button
                    onClick={() => {
                      if (sortField === 'id_family') {
                        setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                      } else {
                        setSortField('id_family');
                        setSortOrder('asc');
                      }
                    }}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg font-medium transition cursor-pointer ${
                      sortField === 'id_family'
                        ? 'bg-amber-50 text-amber-800 font-bold'
                        : 'hover:bg-slate-50 text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <span>Famille Machine (C)</span>
                    {sortField === 'id_family' &&
                      (sortOrder === 'asc' ? (
                        <ArrowUp className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      ) : (
                        <ArrowDown className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      ))}
                  </button>

                  <button
                    onClick={() => {
                      if (sortField === 'id_templates') {
                        setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                      } else {
                        setSortField('id_templates');
                        setSortOrder('asc');
                      }
                    }}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg font-medium transition cursor-pointer ${
                      sortField === 'id_templates'
                        ? 'bg-amber-50 text-amber-800 font-bold'
                        : 'hover:bg-slate-50 text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <span>Modèle / Template (D)</span>
                    {sortField === 'id_templates' &&
                      (sortOrder === 'asc' ? (
                        <ArrowUp className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      ) : (
                        <ArrowDown className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      ))}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Active Filter Chips */}
        {(search || blueprintFamilyFilter !== 'ALL' || blueprintTemplateFilter !== 'ALL') && (
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 text-xs">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Filtres actifs :</span>
            {search && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-800 text-xs font-semibold">
                <Search className="w-3 h-3 text-indigo-600" />
                Recherche: &quot;{search}&quot;
                <button
                  onClick={() => {
                    setLocalSearch('');
                    setSearch('');
                  }}
                  className="hover:bg-indigo-200/60 p-0.5 rounded-full transition cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {blueprintFamilyFilter !== 'ALL' && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-800 text-xs font-semibold">
                <HubIcon className="w-3 h-3 text-indigo-600" />
                Famille: {blueprintFamilyFilter}
                <button
                  onClick={() => {
                    setBlueprintFamilyFilter('ALL');
                    setBlueprintTemplateFilter('ALL');
                  }}
                  className="hover:bg-indigo-200/60 p-0.5 rounded-full transition cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {blueprintTemplateFilter !== 'ALL' && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-800 text-xs font-semibold">
                <CategoryIcon className="w-3 h-3 text-indigo-600" />
                Modèle: {blueprintTemplateFilter}
                <button
                  onClick={() => setBlueprintTemplateFilter('ALL')}
                  className="hover:bg-indigo-200/60 p-0.5 rounded-full transition cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Unified Industrial Data Grid */}
      <GmaoIndustrialDataGrid
        title="Catalogue des Blueprints (Nomenclature BOM)"
        icon={<FingerprintPattern className="w-4 h-4 text-indigo-600" />}
        excelMapping="N° | Code Blueprint (A) | Libellé (B) | Famille & Modèle (C+D) | Specs | Composants (E) | Parts (F) | PDR (G) | Machines (Flux) | Statut (H) | •••"
        bannerColor="slate"
        columns={blueprintColumns}
        data={paginatedBlueprints}
        sortField={sortField}
        sortOrder={sortOrder}
        onSort={handleSort}
        renderSortIcon={renderSortIcon}
        startIndex={startIndex}
        showRowNumber={true}
        emptyIcon={<FingerprintPattern className="w-8 h-8 text-slate-300" />}
        emptyMessage="Aucun plan blueprint trouvé"
        pagination={{
          currentPage,
          setCurrentPage,
          pageSize,
          setPageSize,
          totalItems,
          pageSizeOptions: [25, 50, 100, 200, 0],
          color: 'indigo',
          itemLabel: 'plans',
        }}
        renderRow={(bp, idx) => {
          const rowNum = startIndex + idx + 1;
          const mchCount = blueprintMachineCountMap[bp.id_blueprint] || 0;
                const activeMchCount = blueprintActiveMachineCountMap[bp.id_blueprint] || 0;
                const pmItemsCount = Array.isArray(bp.preventivePlanItems) ? bp.preventivePlanItems.length : 0;
                const derivedTasksCount = blueprintDerivedTasksCountMap[bp.id_blueprint] || 0;
                const compCount = bp.components_theoriques?.length || 0;
                const partsCount = bp.parts_theoriques?.length || 0;
                const pdrCount = bp.pdr_theoriques?.length || 0;

                return (
                  <tr
                    key={`bp-row-${bp.id_blueprint || idx}-${idx}`}
                    className="hover:bg-slate-50/80 transition group"
                  >
                    {/* Row N° */}
                    <td className="py-3 px-3 text-center font-mono text-[11px] font-bold text-slate-400 bg-slate-100/60 border-r border-slate-200/80 shrink-0 select-none">
                      {rowNum}
                    </td>

                    {/* Col 1: Code Blueprint (A) */}
                    <td className="py-3 px-3.5 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-indigo-700 bg-indigo-50 border border-indigo-200/60 px-2 py-0.5 rounded-md text-[11px] shadow-2xs">
                          {bp.id_blueprint}
                        </span>
                        {bp.ref_plan && (
                          <span className="text-[10px] text-slate-400 font-mono">
                            [{bp.ref_plan}]
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Col 2: Libellé du Plan (B) */}
                    <td className="py-3 px-3.5 min-w-[220px]">
                      <div className="font-semibold text-slate-900">{bp.libelle}</div>
                      {bp.description && (
                        <div className="text-[11px] text-slate-400 truncate max-w-xs">{bp.description}</div>
                      )}
                    </td>

                    {/* Col 3: Famille & Modèle (C+D) */}
                    <td className="py-3 px-3.5 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 text-[11px]">
                        <span className="font-bold text-cyan-700 bg-cyan-50/70 border border-cyan-200/60 px-1.5 py-0.5 rounded">
                          {bp.id_family}
                        </span>
                        <span className="text-slate-300">➔</span>
                        <span className="font-bold text-amber-700 bg-amber-50/70 border border-amber-200/60 px-1.5 py-0.5 rounded">
                          {bp.id_templates}
                        </span>
                      </div>
                    </td>

                    {/* Col 4: Spécifications (Specs) */}
                    <td className="py-3 px-3.5 whitespace-nowrap">
                      <div className="text-[11px] text-slate-600">
                        {bp.specs?.puissance ? (
                          <span className="font-semibold text-slate-800">{bp.specs.puissance}</span>
                        ) : (
                          <span className="text-slate-400 italic">Standard</span>
                        )}
                        {bp.specs?.course && <span className="text-slate-400"> • {bp.specs.course}</span>}
                      </div>
                    </td>

                    {/* Col 5: Composants (E) */}
                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded-md text-[11px] font-mono font-bold ${compCount > 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs' : 'text-slate-400'}`}>
                        {compCount}
                      </span>
                    </td>

                    {/* Col 6: Parts (F) */}
                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded-md text-[11px] font-mono font-bold ${partsCount > 0 ? 'bg-purple-50 text-purple-700 border border-purple-200 shadow-2xs' : 'text-slate-400'}`}>
                        {partsCount}
                      </span>
                    </td>

                    {/* Col 7: PDR (G) */}
                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded-md text-[11px] font-mono font-bold ${pdrCount > 0 ? 'bg-blue-50 text-blue-700 border border-blue-200 shadow-2xs' : 'text-slate-400'}`}>
                        {pdrCount}
                      </span>
                    </td>

                    {/* Col 8: Machines Liées & Plan Préventif (Flux) */}
                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      <div className="inline-flex flex-col items-center gap-1">
                        <div className="inline-flex items-center gap-1">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${
                              activeMchCount > 0
                                ? 'bg-slate-100 text-slate-800 border border-slate-200 shadow-2xs'
                                : 'text-slate-400'
                            }`}
                            title={`${activeMchCount} machine(s) active(s) / ${mchCount} liée(s)`}
                          >
                            <Factory className="w-3 h-3 text-slate-500" />
                            <span>
                              {activeMchCount}
                              {mchCount !== activeMchCount ? `/${mchCount}` : ''}
                            </span>
                          </span>
                          <span
                            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold ${
                              pmItemsCount > 0
                                ? 'bg-teal-50 text-teal-800 border border-teal-200 shadow-2xs'
                                : 'bg-slate-50 text-slate-400 border border-slate-100'
                            }`}
                            title={`Plan préventif du blueprint : ${pmItemsCount} opération(s)`}
                          >
                            <Calendar className="w-2.5 h-2.5 text-teal-600" />
                            <span>{pmItemsCount}</span>
                          </span>
                        </div>
                        {derivedTasksCount > 0 && (
                          <span
                            className="px-1.5 py-0.2 rounded text-[9.5px] font-mono font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/80"
                            title={`${derivedTasksCount} tâche(s) préventive(s) active(s) dérivée(s) de ce Blueprint`}
                          >
                            {derivedTasksCount} tâche(s) PM
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Col 9: Statut (H) */}
                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10.5px] font-bold shadow-2xs border ${
                          bp.statut === 'Approuvé'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : bp.statut === 'En Révision'
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : 'bg-slate-100 text-slate-600 border-slate-200'
                        }`}
                      >
                        {bp.statut || 'Approuvé'}
                      </span>
                    </td>

                    {/* Col 10: Actions (•••) */}
                    <td className="py-3 px-3.5 text-center whitespace-nowrap">
                      <div className="relative inline-flex items-center justify-center action-menu-container">
                        <div className="inline-flex rounded-xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
                          {/* Quick Action Button: Inspecter le BOM 4-Tabs */}
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedInspectBlueprint(bp);
                              setInspectActiveTab('specs');
                              setActiveActionMenuId(null);
                            }}
                            className="p-1.5 bg-white hover:bg-slate-100/80 text-slate-800 hover:text-black transition flex items-center justify-center cursor-pointer border-r border-slate-200"
                            title="Inspecter le BOM (4-Tabs)"
                          >
                            <Layers className="w-3.5 h-3.5 text-slate-900" />
                          </button>

                          {/* 3-dots Toggle Button */}
                          <button
                            type="button"
                            onClick={() => {
                              setActiveActionMenuId(activeActionMenuId === bp.id_blueprint ? null : bp.id_blueprint);
                            }}
                            className={`p-1.5 hover:bg-slate-100 transition cursor-pointer ${
                              activeActionMenuId === bp.id_blueprint
                                ? 'bg-slate-100 text-indigo-700 font-bold'
                                : 'text-slate-500 hover:text-slate-800'
                            }`}
                            title="Actions et options du Blueprint"
                          >
                            <MoreVertical className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Popover Action Menu Card */}
                        {activeActionMenuId === bp.id_blueprint && (
                          <div className="absolute right-0 top-full mt-1.5 w-64 bg-white rounded-2xl shadow-xl border border-slate-200 z-50 p-1.5 text-left animate-in fade-in slide-in-from-top-2 duration-150 space-y-0.5">
                            <div className="px-3 py-2 border-b border-slate-100 mb-1 bg-slate-50/80 rounded-xl">
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                                Actions Blueprint Machine
                              </span>
                              <span className="font-mono text-xs font-bold text-indigo-700 block truncate">
                                {bp.id_blueprint} • {bp.libelle}
                              </span>
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                setActiveActionMenuId(null);
                                setSelectedInspectBlueprint(bp);
                                setInspectActiveTab('specs');
                              }}
                              className="w-full px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-indigo-50 hover:text-indigo-800 rounded-xl transition flex items-center gap-2.5 cursor-pointer group"
                            >
                              <Layers className="w-3.5 h-3.5 text-indigo-600 group-hover:scale-110 transition-transform" />
                              <span>Inspecter le BOM (4-Tabs)</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setActiveActionMenuId(null);
                                setApplyFeedback(null);
                                setSelectedInspectBlueprint(bp);
                                setInspectActiveTab('preventive');
                              }}
                              className="w-full px-3 py-2 text-xs font-semibold text-teal-700 hover:bg-teal-50 hover:text-teal-900 rounded-xl transition flex items-center gap-2.5 cursor-pointer group"
                            >
                              <Calendar className="w-3.5 h-3.5 text-teal-600 group-hover:scale-110 transition-transform" />
                              <span>Plan préventif du blueprint ({(bp.preventivePlanItems || []).length})</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setActiveActionMenuId(null);
                                setSelectedInspectBlueprint(bp);
                                setInspectActiveTab('failures');
                              }}
                              className="w-full px-3 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-50 hover:text-amber-900 rounded-xl transition flex items-center gap-2.5 cursor-pointer group"
                            >
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 group-hover:scale-110 transition-transform" />
                              <span>Pannes fréquentes du blueprint ({(bp.commonFailures || []).length})</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setActiveActionMenuId(null);
                                handleOpenEditModal(bp);
                              }}
                              className="w-full px-3 py-2 text-xs font-medium text-slate-700 hover:bg-indigo-50 hover:text-indigo-800 rounded-xl transition flex items-center gap-2.5 cursor-pointer"
                            >
                              <Edit2 className="w-3.5 h-3.5 text-indigo-600" />
                              <span>Modifier ce Blueprint</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setActiveActionMenuId(null);
                                setToDelete(bp);
                              }}
                              className="w-full px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 rounded-xl transition flex items-center gap-2.5 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                              <span>Supprimer ce Blueprint</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              }}
      />

      <BlueprintInspectModal
        selectedInspectBlueprint={selectedInspectBlueprint}
        setSelectedInspectBlueprint={setSelectedInspectBlueprint}
        inspectActiveTab={inspectActiveTab}
        setInspectActiveTab={setInspectActiveTab}
        setApplyFeedback={setApplyFeedback}
        applyFeedback={applyFeedback}
        machines={machines}
        blueprintDerivedTasksCountMap={blueprintDerivedTasksCountMap}
        handleTriggerApplyPreventivePlan={handleTriggerApplyPreventivePlan}
        newPreventiveItem={newPreventiveItem}
        setNewPreventiveItem={setNewPreventiveItem}
        preventiveActions={preventiveActions}
        stockItems={stockItems}
        onUpdateBlueprint={onUpdateBlueprint}
        newCommonFailureItem={newCommonFailureItem}
        setNewCommonFailureItem={setNewCommonFailureItem}
      />

      <BlueprintFormModal
        showAddModal={showAddModal}
        toEdit={toEdit}
        setToEdit={setToEdit}
        form={form}
        setForm={setForm}
        handleCloseModal={handleCloseModal}
        activeModalTab={activeModalTab}
        setActiveModalTab={setActiveModalTab}
        setApplyFeedback={setApplyFeedback}
        applyFeedback={applyFeedback}
        handleAddSubmit={handleAddSubmit}
        handleEditSubmit={handleEditSubmit}
        autoNextBlueprintId={autoNextBlueprintId}
        takenBlueprintNumbers={takenBlueprintNumbers}
        families={families}
        templates={templates}
        modalTemplates={modalTemplates}
        editModalTemplates={editModalTemplates}
        compTemplates={compTemplates}
        partTypes={partTypes}
        partDesignations={partDesignations}
        machines={machines}
        stockItems={stockItems}
        preventiveActions={preventiveActions}
        newCompItem={newCompItem}
        setNewCompItem={setNewCompItem}
        newPartItem={newPartItem}
        setNewPartItem={setNewPartItem}
        newPdrItem={newPdrItem}
        setNewPdrItem={setNewPdrItem}
        newPreventiveItem={newPreventiveItem}
        setNewPreventiveItem={setNewPreventiveItem}
        newCommonFailureItem={newCommonFailureItem}
        setNewCommonFailureItem={setNewCommonFailureItem}
        handleExtractFromMachineHistory={handleExtractFromMachineHistory}
        handleTriggerApplyPreventivePlan={handleTriggerApplyPreventivePlan}
      />

      <BlueprintDeleteModal
        toDelete={toDelete}
        setToDelete={setToDelete}
        blueprintMachineCountMap={blueprintMachineCountMap}
        onDeleteBlueprint={onDeleteBlueprint}
      />

      <BlueprintFormulasModal
        showFormulasModal={showFormulasModal}
        setShowFormulasModal={setShowFormulasModal}
      />
    </AnimatedPage>
  );
}
