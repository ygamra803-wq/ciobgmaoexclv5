import { useState, useRef, useMemo, useEffect } from 'react';
import AnimatedPage from '../../components/common/AnimatedPage';
import Action3DButton from '../../components/common/Action3DButton';
import FormulasModalButton from '../../components/common/FormulasModalButton';
import SequentialCodePicker from '../../components/common/SequentialCodePicker';
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
  Sparkles,
  Factory,
  Wrench,
  Zap,
  Info,
  X,
  Calculator,
  GitBranch,
  MoreVertical,
  Sliders,
  FileText,
  Radio,
  FileSpreadsheet,
  Calendar,
  Plus,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { CubeIcon } from '../../components/common/icons/CubeIcon';
import { Blueprint, applyBlueprintPlanToActiveMachines } from '../../../core/domain';
import { LayersIcon } from '../../components/common/icons/LayersIcon';
import { HubIcon } from '../../components/common/icons/HubIcon';
import { CategoryIcon } from '../../components/common/icons/CategoryIcon';
import { SpokeIcon } from '../../components/common/icons/SpokeIcon';
import GmaoIndustrialDataGrid from '../../components/common/GmaoIndustrialDataGrid';
import { useI18n } from '../../../i18n/I18nContext';
import { filterActiveMachines } from '../../../utils/activeMachines';
import { useGmaoStore } from '../../../store/useGmaoStore';

const STATUS_OPTIONS = [
  { value: 'Approuvé', label: 'Approuvé' },
  { value: 'En Révision', label: 'En Révision' },
  { value: 'Archivé', label: 'Archivé' },
];

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
  warehouseItems: _warehouseItems = [],
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
}) {
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
  const [selectedInspectBlueprint, setSelectedInspectBlueprint] = useState(null);
  const [inspectActiveTab, setInspectActiveTab] = useState('specs');

  // Form State for Add/Edit Blueprint with BOM + Preventive Plan architecture
  const initialFormState = {
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

  const [form, setForm] = useState(initialFormState);
  const [toEdit, setToEdit] = useState(null);
  const [toDelete, setToDelete] = useState(null);

  // Helper inputs for adding items into Tab 2, 3, 4, 5, 6
  const [newCompItem, setNewCompItem] = useState({ id_component: '', libelle: '', qte: 1 });
  const [newPartItem, setNewPartItem] = useState({ id_part: '', libelle: '', qte: 1 });
  const [newPdrItem, setNewPdrItem] = useState({ id_pdr: '', libelle: '', qte: 1, criticite: 'Haute' });
  const [newPreventiveItem, setNewPreventiveItem] = useState({
    composant: '',
    action_code: 'C',
    frequence: 'Mensuel',
    duree_min: 15,
    description: '',
  });
  const [newCommonFailureItem, setNewCommonFailureItem] = useState({
    title: '',
    type_panne: 'M',
    urgence: 'HAUTE',
    recommended_action: '',
    description: '',
    pdr_ref: '',
  });
  const [applyFeedback, setApplyFeedback] = useState(null);

  // Taken blueprint numbers for SequentialCodePicker
  const takenBlueprintNumbers = useMemo(() => {
    const set = new Set();
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
  const [activeActionMenuId, setActiveActionMenuId] = useState(null);
  const [showSortMenu, setShowSortMenu] = useState(false);
  const sortMenuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.action-menu-container')) {
        setActiveActionMenuId(null);
      }
      if (sortMenuRef.current && !sortMenuRef.current.contains(event.target)) {
        setShowSortMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Sorting
  const [sortField, setSortField] = useState('id_blueprint');
  const [sortOrder, setSortOrder] = useState('asc');

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
    const counts = {};
    blueprints.forEach((b) => {
      const bp = new Blueprint(b);
      counts[b.id_blueprint] = bp.getMachinesLieesCount(machines);
    });
    return counts;
  }, [blueprints, machines]);

  // Map of ACTIVE linked machine counts per blueprint
  const blueprintActiveMachineCountMap = useMemo(() => {
    const counts = {};
    const activeMachines = filterActiveMachines(machines);
    blueprints.forEach((b) => {
      counts[b.id_blueprint] = activeMachines.filter((m) => m.id_blueprint === b.id_blueprint).length;
    });
    return counts;
  }, [blueprints, machines]);

  // Fast O(M + T) map of derived preventive tasks count per blueprint
  const blueprintDerivedTasksCountMap = useMemo(() => {
    const counts = {};
    const norm = (s) => String(s || '').trim().toUpperCase().replace(/[-_\s]/g, '');
    const machToBp = new Map();
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
  const handleOpenEditModal = (bp) => {
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
  const handleAddSubmit = (e) => {
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
  const handleEditSubmit = (e) => {
    e.preventDefault();
    if (!toEdit.id_blueprint || !toEdit.libelle) return;
    onUpdateBlueprint(toEdit.id_blueprint, {
      ...toEdit,
      preventivePlanItems: Array.isArray(toEdit.preventivePlanItems) ? toEdit.preventivePlanItems : [],
      commonFailures: Array.isArray(toEdit.commonFailures) ? toEdit.commonFailures : [],
    });
    setToEdit(null);
  };

  // Apply Blueprint Preventive Plan to Active Linked Machines Only
  const handleTriggerApplyPreventivePlan = (targetBlueprint) => {
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
    const { addedTasks, updatedTasks, targetMachinesCount } = applyBlueprintPlanToActiveMachines(
      normalizedBp,
      machines,
      storeState.preventiveTasks || []
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
  const handleExtractFromMachineHistory = (machineCode, target = 'add') => {
    if (!machineCode) return;
    const relatedMvts = mouvements.filter(
      (m) =>
        (m.id_machine_registered === machineCode || m.machine === machineCode) &&
        (m.type === 'Sortie' || m.quantite > 0)
    );

    const map = new Map();
    relatedMvts.forEach((m) => {
      const ref = m.ref || m.id_article;
      if (!ref) return;
      const existing = map.get(ref) || { id_pdr: ref, libelle: ref, qte: 0, criticite: 'Moyenne' };
      existing.qte += Math.abs(Number(m.quantite) || 1);
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
        pdr_theoriques: [...prev.pdr_theoriques, ...extractedPdr.filter((x) => !prev.pdr_theoriques.some((p) => p.id_pdr === x.id_pdr))],
      }));
    } else {
      setToEdit((prev) => ({
        ...prev,
        pdr_theoriques: [...prev.pdr_theoriques, ...extractedPdr.filter((x) => !prev.pdr_theoriques.some((p) => p.id_pdr === x.id_pdr))],
      }));
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
        <div className="absolute -top-12 -right-12 w-48 h-48 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none group-hover/header:bg-indigo-500/10 transition-colors duration-500" />

        <div className="min-w-0 flex-1 flex items-start sm:items-center gap-3.5 relative">
          {/* 3D Elevated Page Badge Icon */}
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500/10 via-indigo-500/5 to-transparent border border-indigo-200/90 shadow-[0_4px_12px_rgba(99,102,241,0.12)] flex items-center justify-center text-indigo-700 group-hover/header:scale-105 group-hover/header:border-indigo-400/80 transition-all duration-300 shrink-0">
            <FingerprintPattern className="w-6 h-6 text-indigo-700 transition-transform duration-300 group-hover/header:scale-110" />
          </div>
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
            <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-200/80 flex items-center justify-center text-indigo-700 shadow-2xs shrink-0">
              <SlidersHorizontal className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="text-xs font-black uppercase tracking-wider text-slate-800">
                  {t('common.filters.title')}
                </span>
                <span className="bg-indigo-50 text-indigo-800 px-2.5 py-0.5 rounded-lg text-[11px] font-bold border border-indigo-200/70 shadow-2xs font-mono">
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
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-md bg-indigo-100 border border-indigo-300/80 flex items-center justify-center text-indigo-700 shadow-2xs pointer-events-none z-10">
                <Search className="w-3 h-3" />
              </span>
              <input
                type="text"
                placeholder={t('machines.blueprint.search_placeholder')}
                value={localSearch}
                onChange={(e) => setLocalSearch(e.target.value)}
                className="w-full h-10 pl-9 pr-8 rounded-xl border border-slate-200 bg-slate-50 text-xs font-medium text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
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
                <span className="w-5 h-5 rounded-md bg-indigo-100 border border-indigo-300/80 flex items-center justify-center text-indigo-700 shadow-2xs shrink-0">
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
                    badgeColor: 'bg-indigo-50 text-indigo-800 font-bold',
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
                <span className="w-5 h-5 rounded-md bg-indigo-100 border border-indigo-300/80 flex items-center justify-center text-indigo-700 shadow-2xs shrink-0">
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
                    badgeColor: 'bg-indigo-50 text-indigo-800 font-bold',
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
                  ? 'bg-indigo-50 text-indigo-800 border-indigo-300 ring-1 ring-indigo-200 shadow-2xs'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-md bg-indigo-100 border border-indigo-300/80 flex items-center justify-center text-indigo-700 shadow-2xs shrink-0">
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
                    <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-600" />
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
                        ? 'bg-indigo-50 text-indigo-800 font-bold'
                        : 'hover:bg-slate-50 text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <span>Code Blueprint (A)</span>
                    {sortField === 'id_blueprint' &&
                      (sortOrder === 'asc' ? (
                        <ArrowUp className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                      ) : (
                        <ArrowDown className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
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
                        ? 'bg-indigo-50 text-indigo-800 font-bold'
                        : 'hover:bg-slate-50 text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <span>Libellé du Plan BOM (B)</span>
                    {sortField === 'libelle' &&
                      (sortOrder === 'asc' ? (
                        <ArrowUp className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                      ) : (
                        <ArrowDown className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
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
                        ? 'bg-indigo-50 text-indigo-800 font-bold'
                        : 'hover:bg-slate-50 text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <span>Famille Machine (C)</span>
                    {sortField === 'id_family' &&
                      (sortOrder === 'asc' ? (
                        <ArrowUp className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                      ) : (
                        <ArrowDown className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
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
                        ? 'bg-indigo-50 text-indigo-800 font-bold'
                        : 'hover:bg-slate-50 text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <span>Modèle / Template (D)</span>
                    {sortField === 'id_templates' &&
                      (sortOrder === 'asc' ? (
                        <ArrowUp className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                      ) : (
                        <ArrowDown className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
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

      {/* 4-Tab Inspect Drawer / Modal */}
      {selectedInspectBlueprint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Drawer Header */}
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center font-bold">
                  <FingerprintPattern className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-indigo-700 text-sm">
                      {selectedInspectBlueprint.id_blueprint}
                    </span>
                    <span className="text-xs text-slate-400">•</span>
                    <span className="text-xs font-mono text-slate-600 font-semibold">
                      {selectedInspectBlueprint.ref_plan || 'SANS-REF'}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                      {selectedInspectBlueprint.statut}
                    </span>
                  </div>
                  <h3 className="font-bold text-slate-900 text-base">{selectedInspectBlueprint.libelle}</h3>
                </div>
              </div>
              <button
                onClick={() => setSelectedInspectBlueprint(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 4 Tabs Bar */}
            <div className="flex items-center gap-2 px-5 pt-3 border-b border-slate-200 bg-white overflow-x-auto">
              <button
                onClick={() => setInspectActiveTab('specs')}
                className={`pb-2.5 px-3 text-xs font-bold flex items-center gap-2 border-b-2 transition ${
                  inspectActiveTab === 'specs'
                    ? 'border-indigo-600 text-indigo-700'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Info className="w-3.5 h-3.5" />
                <span>1. Spécifications & Loi</span>
              </button>
              <button
                onClick={() => setInspectActiveTab('components')}
                className={`pb-2.5 px-3 text-xs font-bold flex items-center gap-2 border-b-2 transition ${
                  inspectActiveTab === 'components'
                    ? 'border-emerald-600 text-emerald-700'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <CubeIcon className="w-3.5 h-3.5 text-emerald-600" />
                <span>2. Composants ({selectedInspectBlueprint.components_theoriques?.length || 0})</span>
              </button>
              <button
                onClick={() => setInspectActiveTab('parts')}
                className={`pb-2.5 px-3 text-xs font-bold flex items-center gap-2 border-b-2 transition ${
                  inspectActiveTab === 'parts'
                    ? 'border-purple-600 text-purple-700'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <LayersIcon className="w-3.5 h-3.5 text-purple-600" />
                <span>3. Pièces & Visserie ({selectedInspectBlueprint.parts_theoriques?.length || 0})</span>
              </button>
              <button
                onClick={() => setInspectActiveTab('pdr')}
                className={`pb-2.5 px-3 text-xs font-bold flex items-center gap-2 border-b-2 transition whitespace-nowrap ${
                  inspectActiveTab === 'pdr'
                    ? 'border-blue-600 text-blue-700'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Wrench className="w-3.5 h-3.5 text-blue-600" />
                <span>4. PDR Consommables ({selectedInspectBlueprint.pdr_theoriques?.length || 0})</span>
              </button>
              <button
                onClick={() => {
                  setApplyFeedback(null);
                  setInspectActiveTab('preventive');
                }}
                className={`pb-2.5 px-3 text-xs font-bold flex items-center gap-2 border-b-2 transition whitespace-nowrap ${
                  inspectActiveTab === 'preventive'
                    ? 'border-teal-600 text-teal-700'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Calendar className="w-3.5 h-3.5 text-teal-600" />
                <span>5. Plan préventif du blueprint ({(selectedInspectBlueprint.preventivePlanItems || []).length})</span>
              </button>
              <button
                onClick={() => {
                  setInspectActiveTab('failures');
                }}
                className={`pb-2.5 px-3 text-xs font-bold flex items-center gap-2 border-b-2 transition whitespace-nowrap ${
                  inspectActiveTab === 'failures'
                    ? 'border-amber-600 text-amber-700'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                <span>6. Pannes fréquentes (DI) ({(selectedInspectBlueprint.commonFailures || []).length})</span>
              </button>
            </div>

            {/* Tab Body */}
            <div className="p-5 overflow-y-auto flex-1 space-y-4 text-xs">
              {inspectActiveTab === 'specs' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                      <div className="text-[10px] uppercase font-bold text-slate-400">Famille</div>
                      <div className="text-xs font-bold text-cyan-700 mt-0.5">
                        {selectedInspectBlueprint.id_family}
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                      <div className="text-[10px] uppercase font-bold text-slate-400">Modèle Template</div>
                      <div className="text-xs font-bold text-amber-700 mt-0.5">
                        {selectedInspectBlueprint.id_templates}
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                      <div className="text-[10px] uppercase font-bold text-slate-400">Type Schéma</div>
                      <div className="text-xs font-bold text-slate-800 mt-0.5">
                        {selectedInspectBlueprint.type_schema}
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                      <div className="text-[10px] uppercase font-bold text-slate-400">Révision</div>
                      <div className="text-xs font-bold font-mono text-slate-800 mt-0.5">
                        {selectedInspectBlueprint.revision || 'Rev-A'}
                      </div>
                    </div>
                  </div>

                  {/* Technical Specs Details */}
                  <div className="p-4 rounded-xl bg-indigo-50/50 border border-indigo-100 space-y-2">
                    <h4 className="font-bold text-indigo-900 text-xs">Spécifications & Paramètres Constructeur</h4>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-slate-500">Puissance / Force :</span>{' '}
                        <b className="text-slate-800">{selectedInspectBlueprint.specs?.puissance || 'Non spécifié'}</b>
                      </div>
                      <div>
                        <span className="text-slate-500">Course / Capacité :</span>{' '}
                        <b className="text-slate-800">{selectedInspectBlueprint.specs?.course || 'Standard'}</b>
                      </div>
                      <div>
                        <span className="text-slate-500">Motorisation :</span>{' '}
                        <b className="text-slate-800">{selectedInspectBlueprint.specs?.moteur || 'Standard'}</b>
                      </div>
                      <div>
                        <span className="text-slate-500">Encombrement (LxPxH) :</span>{' '}
                        <b className="text-slate-800">{selectedInspectBlueprint.specs?.dimensions || 'Non mesuré'}</b>
                      </div>
                    </div>
                  </div>

                  {/* Description */}
                  {selectedInspectBlueprint.description && (
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 leading-relaxed">
                      <div className="text-[10px] uppercase font-bold text-slate-400 mb-1">Notes & Description</div>
                      {selectedInspectBlueprint.description}
                    </div>
                  )}
                </div>
              )}
              {inspectActiveTab === 'components' && (
                <div className="space-y-3">
                  <div className="text-xs text-slate-500">
                    Sous-ensembles majeurs et composants d'entrepôt rattachés au schéma :
                  </div>
                  {selectedInspectBlueprint.components_theoriques?.length > 0 ? (
                    <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white">
                      {selectedInspectBlueprint.components_theoriques.map((c, idx) => (
                        <div key={`inspect-comp-${c.id_component || idx}-${idx}`} className="p-3 flex items-center justify-between hover:bg-slate-50 text-xs">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 text-[11px]">
                              {c.id_component}
                            </span>
                            <span className="font-semibold text-slate-800">{c.libelle || c.id_component}</span>
                          </div>
                          <span className="font-mono font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                            Qté : {c.qte || 1}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-8 text-center text-slate-400 border border-dashed border-slate-200 rounded-xl">
                      Aucun composant majeur spécifié pour ce Blueprint.
                    </div>
                  )}
                </div>
              )}

              {inspectActiveTab === 'parts' && (
                <div className="space-y-3">
                  <div className="text-xs text-slate-500">
                    Visserie, fixations et pièces d'assemblage magasin requises :
                  </div>
                  {selectedInspectBlueprint.parts_theoriques?.length > 0 ? (
                    <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white">
                      {selectedInspectBlueprint.parts_theoriques.map((p, idx) => (
                        <div key={`inspect-part-${p.id_part || idx}-${idx}`} className="p-3 flex items-center justify-between hover:bg-slate-50 text-xs">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200 text-[11px]">
                              {p.id_part}
                            </span>
                            <span className="font-semibold text-slate-800">{p.libelle || p.id_part}</span>
                          </div>
                          <span className="font-mono font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                            Qté : {p.qte || 1}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-8 text-center text-slate-400 border border-dashed border-slate-200 rounded-xl">
                      Aucune pièce d'entrepôt spécifiée.
                    </div>
                  )}
                </div>
              )}

              {inspectActiveTab === 'pdr' && (
                <div className="space-y-3">
                  <div className="text-xs text-slate-500">
                    Pièces de Rechange (PDR) consommables et organes d'usure préventifs :
                  </div>
                  {selectedInspectBlueprint.pdr_theoriques?.length > 0 ? (
                    <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white">
                      {selectedInspectBlueprint.pdr_theoriques.map((p, idx) => (
                        <div key={`inspect-pdr-${p.id_pdr || idx}-${idx}`} className="p-3 flex items-center justify-between hover:bg-slate-50 text-xs">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 text-[11px]">
                              {p.id_pdr}
                            </span>
                            <span className="font-semibold text-slate-800">{p.libelle || p.id_pdr}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                p.criticite === 'Haute'
                                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                  : 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              Critique : {p.criticite || 'Moyenne'}
                            </span>
                            <span className="font-mono font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                              Qté : {p.qte || 1}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-8 text-center text-slate-400 border border-dashed border-slate-200 rounded-xl">
                      Aucune PDR théorique renseignée.
                    </div>
                  )}
                </div>
              )}

              {inspectActiveTab === 'preventive' && (() => {
                const currentItems = Array.isArray(selectedInspectBlueprint.preventivePlanItems)
                  ? selectedInspectBlueprint.preventivePlanItems
                  : [];
                const activeLinkedMachines = filterActiveMachines(machines).filter(
                  (m) => m.id_blueprint === selectedInspectBlueprint.id_blueprint
                );
                const totalLinkedMachines = (machines || []).filter(
                  (m) => m.id_blueprint === selectedInspectBlueprint.id_blueprint
                );
                const derivedTasksCount =
                  blueprintDerivedTasksCountMap[selectedInspectBlueprint.id_blueprint] || 0;
                return (
                  <div className="space-y-4">
                    <div className="p-3.5 rounded-xl bg-teal-50/80 border border-teal-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <h4 className="font-bold text-teal-950 text-xs flex items-center gap-1.5">
                          <Calendar className="w-4 h-4 text-teal-600" />
                          <span>Plan préventif du blueprint</span>
                        </h4>
                        <p className="text-[11px] text-teal-800 mt-0.5">
                          Gamme préventive standard associée au modèle ({activeLinkedMachines.length} machine(s) active(s) sur {totalLinkedMachines.length} liée(s)).
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={currentItems.length === 0 || activeLinkedMachines.length === 0}
                        onClick={() => handleTriggerApplyPreventivePlan(selectedInspectBlueprint)}
                        className="h-8 px-3.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs transition flex items-center gap-1.5 shadow-2xs disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Appliquer aux machines actives liées ({activeLinkedMachines.length})</span>
                      </button>
                    </div>

                    {/* 3-KPI Summary Strip for Blueprint Preventive Status */}
                    <div className="grid grid-cols-3 gap-2.5">
                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-slate-600">Machines actives liées</span>
                        <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-900">
                          {activeLinkedMachines.length}
                        </span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-teal-50/60 border border-teal-200/80 flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-teal-900">Items du plan (BOM)</span>
                        <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-white border border-teal-200 text-teal-800">
                          {currentItems.length}
                        </span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-indigo-50/60 border border-indigo-200/80 flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-indigo-900">Tâches PM dérivées</span>
                        <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-white border border-indigo-200 text-indigo-800">
                          {derivedTasksCount}
                        </span>
                      </div>
                    </div>

                    {applyFeedback && (
                      <div
                        className={`p-3 rounded-xl text-xs font-semibold border ${
                          applyFeedback.type === 'success'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : applyFeedback.type === 'warning'
                            ? 'bg-amber-50 text-amber-800 border-amber-200'
                            : 'bg-sky-50 text-sky-800 border-sky-200'
                        }`}
                      >
                        {applyFeedback.message}
                      </div>
                    )}

                    {/* Add Preventive Plan Item Row */}
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                        <input
                          type="text"
                          list="bp-inspect-comps-datalist"
                          value={newPreventiveItem.composant}
                          onChange={(e) => setNewPreventiveItem({ ...newPreventiveItem, composant: e.target.value })}
                          placeholder="Composant (ex: Broche, Courroie...)"
                          className="h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-xs sm:col-span-2"
                        />
                        <datalist id="bp-inspect-comps-datalist">
                          {(selectedInspectBlueprint.components_theoriques || []).map((c, idx) => (
                            <option key={`insp-dl-${idx}`} value={c.libelle || c.id_component} />
                          ))}
                        </datalist>

                        <select
                          value={newPreventiveItem.action_code}
                          onChange={(e) => setNewPreventiveItem({ ...newPreventiveItem, action_code: e.target.value })}
                          className="h-8 px-2 rounded-lg border border-slate-200 bg-white text-xs font-semibold"
                        >
                          {(preventiveActions && preventiveActions.length > 0
                            ? preventiveActions
                            : [
                                { code: 'C', libelle: 'Contrôle' },
                                { code: 'N', libelle: 'Nettoyage' },
                                { code: 'G', libelle: 'Graissage' },
                                { code: 'V', libelle: 'Vérification' },
                                { code: 'R', libelle: 'Révision' },
                                { code: 'S', libelle: 'Serrage' },
                                { code: 'L', libelle: 'Lubrification' },
                              ]
                          ).map((act, idx) => (
                            <option key={`insp-act-${act.code || idx}-${idx}`} value={act.code}>
                              {act.code} • {act.libelle}
                            </option>
                          ))}
                        </select>

                        <select
                          value={newPreventiveItem.frequence}
                          onChange={(e) => setNewPreventiveItem({ ...newPreventiveItem, frequence: e.target.value })}
                          className="h-8 px-2 rounded-lg border border-slate-200 bg-white text-xs font-semibold"
                        >
                          <option value="Hebdo">Hebdo</option>
                          <option value="Bi-hebdo">Bi-hebdo</option>
                          <option value="Mensuel">Mensuel</option>
                          <option value="Trimestriel">Trimestriel</option>
                          <option value="Semestriel">Semestriel</option>
                          <option value="Annuel">Annuel</option>
                        </select>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          type="text"
                          value={newPreventiveItem.description}
                          onChange={(e) => setNewPreventiveItem({ ...newPreventiveItem, description: e.target.value })}
                          placeholder="Consigne / Description de l'opération..."
                          className="h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-xs flex-1 min-w-[180px]"
                        />
                        <div className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <input
                            type="number"
                            min="1"
                            value={newPreventiveItem.duree_min}
                            onChange={(e) =>
                              setNewPreventiveItem({
                                ...newPreventiveItem,
                                duree_min: Number(e.target.value) || 15,
                              })
                            }
                            placeholder="Min"
                            className="h-8 w-16 px-2 text-center rounded-lg border border-slate-200 bg-white text-xs font-mono font-bold"
                          />
                          <span className="text-[11px] text-slate-500">min</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            if (!newPreventiveItem.frequence) return;
                            const item = {
                              id: `BPP-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                              composant: newPreventiveItem.composant.trim() || 'Machine entière',
                              action_code: newPreventiveItem.action_code || 'C',
                              frequence: newPreventiveItem.frequence || 'Mensuel',
                              duree_min: Number(newPreventiveItem.duree_min) || 15,
                              description: newPreventiveItem.description.trim(),
                            };
                            const nextItems = [...currentItems, item];
                            const updatedBp = {
                              ...selectedInspectBlueprint,
                              preventivePlanItems: nextItems,
                            };
                            setSelectedInspectBlueprint(updatedBp);
                            onUpdateBlueprint(updatedBp.id_blueprint, updatedBp);
                            setNewPreventiveItem({
                              composant: '',
                              action_code: 'C',
                              frequence: 'Mensuel',
                              duree_min: 15,
                              description: '',
                            });
                          }}
                          className="h-8 px-3 rounded-lg bg-teal-600 text-white font-semibold text-xs hover:bg-teal-700 transition flex items-center gap-1"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Ajouter</span>
                        </button>
                      </div>
                    </div>

                    {/* Items List */}
                    {currentItems.length > 0 ? (
                      <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white">
                        {currentItems.map((item, idx) => (
                          <div
                            key={`inspect-pm-${item.id || idx}-${idx}`}
                            className="p-3 flex items-center justify-between hover:bg-slate-50 text-xs gap-2"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-mono font-bold text-teal-800 bg-teal-50 px-2 py-0.5 rounded border border-teal-200 text-[11px]">
                                  {item.action_code || 'C'}
                                </span>
                                <span className="font-bold text-slate-800">
                                  {item.composant || 'Machine entière'}
                                </span>
                                <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-bold">
                                  {item.frequence}
                                </span>
                                {item.duree_min && (
                                  <span className="font-mono text-[11px] text-slate-500">
                                    {item.duree_min} min
                                  </span>
                                )}
                              </div>
                              {item.description && (
                                <p className="text-[11px] text-slate-500 mt-1 truncate">{item.description}</p>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                const nextItems = currentItems.filter((_, i) => i !== idx);
                                const updatedBp = {
                                  ...selectedInspectBlueprint,
                                  preventivePlanItems: nextItems,
                                };
                                setSelectedInspectBlueprint(updatedBp);
                                onUpdateBlueprint(updatedBp.id_blueprint, updatedBp);
                              }}
                              className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 transition shrink-0"
                              title="Supprimer cet élément du plan"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-8 text-center text-slate-400 border border-dashed border-slate-200 rounded-xl">
                        Aucun élément dans le plan préventif de ce Blueprint.
                      </div>
                    )}
                  </div>
                );
              })()}

              {inspectActiveTab === 'failures' && (() => {
                const currentFailures = Array.isArray(selectedInspectBlueprint.commonFailures)
                  ? selectedInspectBlueprint.commonFailures
                  : [];
                return (
                  <div className="space-y-4">
                    <div className="p-3.5 rounded-xl bg-amber-50/80 border border-amber-200 flex items-center justify-between gap-3">
                      <div>
                        <h4 className="font-bold text-amber-950 text-xs flex items-center gap-1.5">
                          <AlertTriangle className="w-4 h-4 text-amber-600" />
                          <span>Pannes fréquentes du blueprint (Suggestions DI Correctif)</span>
                        </h4>
                        <p className="text-[11px] text-amber-800 mt-0.5">
                          Pannes et travaux types proposés automatiquement lors de la création d&apos;une DI sur toute machine active rattachée à ce Blueprint.
                        </p>
                      </div>
                    </div>

                    {/* Add Common Failure Row */}
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                        <input
                          type="text"
                          value={newCommonFailureItem.title}
                          onChange={(e) =>
                            setNewCommonFailureItem({ ...newCommonFailureItem, title: e.target.value })
                          }
                          placeholder="Titre / Symptôme (ex: Échauffement palier broche)"
                          className="h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-xs sm:col-span-2"
                        />
                        <select
                          value={newCommonFailureItem.type_panne}
                          onChange={(e) =>
                            setNewCommonFailureItem({ ...newCommonFailureItem, type_panne: e.target.value })
                          }
                          className="h-8 px-2 rounded-lg border border-slate-200 bg-white text-xs font-semibold"
                        >
                          <option value="M">M • Mécanique</option>
                          <option value="E">E • Électrique</option>
                          <option value="H">H • Hydraulique</option>
                          <option value="P">P • Pneumatique</option>
                        </select>
                        <select
                          value={newCommonFailureItem.urgence}
                          onChange={(e) =>
                            setNewCommonFailureItem({ ...newCommonFailureItem, urgency: e.target.value, urgence: e.target.value })
                          }
                          className="h-8 px-2 rounded-lg border border-slate-200 bg-white text-xs font-semibold"
                        >
                          <option value="HAUTE">Urgence : HAUTE</option>
                          <option value="MOYENNE">Urgence : MOYENNE</option>
                          <option value="BASSE">Urgence : BASSE</option>
                        </select>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <input
                          type="text"
                          value={newCommonFailureItem.recommended_action}
                          onChange={(e) =>
                            setNewCommonFailureItem({
                              ...newCommonFailureItem,
                              recommended_action: e.target.value,
                            })
                          }
                          placeholder="Travail suggéré (ex: Contrôler jeu et remplacer roulement)"
                          className="h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-xs sm:col-span-2"
                        />
                        <select
                          value={newCommonFailureItem.pdr_ref}
                          onChange={(e) =>
                            setNewCommonFailureItem({ ...newCommonFailureItem, pdr_ref: e.target.value })
                          }
                          className="h-8 px-2 rounded-lg border border-slate-200 bg-white text-xs"
                        >
                          <option value="">PDR associée (optionnel)</option>
                          {stockItems.map((s, idx) => (
                            <option key={`insp-cf-pdr-${s.ref || idx}-${idx}`} value={s.ref}>
                              {s.ref} • {s.designation}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={newCommonFailureItem.description}
                          onChange={(e) =>
                            setNewCommonFailureItem({
                              ...newCommonFailureItem,
                              description: e.target.value,
                            })
                          }
                          placeholder="Description complémentaire / cause..."
                          className="h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-xs flex-1"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (!newCommonFailureItem.title.trim()) return;
                            const item = {
                              id: `BPF-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                              title: newCommonFailureItem.title.trim(),
                              type_panne: newCommonFailureItem.type_panne || 'M',
                              urgence: newCommonFailureItem.urgence || 'HAUTE',
                              recommended_action: newCommonFailureItem.recommended_action.trim(),
                              description: newCommonFailureItem.description.trim(),
                              pdr_ref: newCommonFailureItem.pdr_ref || undefined,
                            };
                            const nextFailures = [...currentFailures, item];
                            const updatedBp = {
                              ...selectedInspectBlueprint,
                              commonFailures: nextFailures,
                            };
                            setSelectedInspectBlueprint(updatedBp);
                            onUpdateBlueprint(updatedBp.id_blueprint, updatedBp);
                            setNewCommonFailureItem({
                              title: '',
                              type_panne: 'M',
                              urgence: 'HAUTE',
                              recommended_action: '',
                              description: '',
                              pdr_ref: '',
                            });
                          }}
                          className="h-8 px-3 rounded-lg bg-amber-600 text-white font-semibold text-xs hover:bg-amber-700 transition flex items-center gap-1 shrink-0"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Ajouter</span>
                        </button>
                      </div>
                    </div>

                    {/* Failures List */}
                    {currentFailures.length > 0 ? (
                      <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white">
                        {currentFailures.map((cf, idx) => (
                          <div
                            key={`inspect-cf-${cf.id || idx}-${idx}`}
                            className="p-3 flex items-center justify-between hover:bg-slate-50 text-xs gap-2"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-mono font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 text-[11px]">
                                  {cf.type_panne || 'M'}
                                </span>
                                <span className="font-bold text-slate-900">{cf.title}</span>
                                {cf.urgence && (
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                                      cf.urgence === 'HAUTE'
                                        ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                        : cf.urgence === 'BASSE'
                                        ? 'bg-slate-100 text-slate-600'
                                        : 'bg-amber-50 text-amber-700 border border-amber-200'
                                    }`}
                                  >
                                    {cf.urgence}
                                  </span>
                                )}
                                {cf.pdr_ref && (
                                  <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 font-mono text-[10px] font-bold">
                                    PDR: {cf.pdr_ref}
                                  </span>
                                )}
                              </div>
                              {(cf.recommended_action || cf.description) && (
                                <p className="text-[11px] text-slate-600 mt-1 truncate">
                                  {[cf.recommended_action, cf.description].filter(Boolean).join(' • ')}
                                </p>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                const nextFailures = currentFailures.filter((_, i) => i !== idx);
                                const updatedBp = {
                                  ...selectedInspectBlueprint,
                                  commonFailures: nextFailures,
                                };
                                setSelectedInspectBlueprint(updatedBp);
                                onUpdateBlueprint(updatedBp.id_blueprint, updatedBp);
                              }}
                              className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 transition shrink-0"
                              title="Supprimer cette panne fréquente"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-8 text-center text-slate-400 border border-dashed border-slate-200 rounded-xl">
                        Aucune panne fréquente enregistrée sur ce Blueprint.
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Drawer Footer */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end">
              <button
                onClick={() => setSelectedInspectBlueprint(null)}
                className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Blueprint Modal (4-Tabs BOM Master) */}
      {(showAddModal || toEdit) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center font-bold">
                  <FingerprintPattern className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">
                    {toEdit ? `Modifier Blueprint : ${toEdit.id_blueprint}` : 'Nouveau Blueprint (BOM 4-Tabs)'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Nomenclature technique complète liant modèle d'usine et composants réels.
                  </p>
                </div>
              </div>
              <button
                onClick={handleCloseModal}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 4 Tabs Bar */}
            <div className="flex items-center gap-2 px-5 pt-3 border-b border-slate-200 bg-white overflow-x-auto">
              <button
                type="button"
                onClick={() => setActiveModalTab('specs')}
                className={`pb-2.5 px-3 text-xs font-bold flex items-center gap-2 border-b-2 transition ${
                  activeModalTab === 'specs'
                    ? 'border-indigo-600 text-indigo-700'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Info className="w-3.5 h-3.5" />
                <span>1. Infos & Spécifications (Loi)</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveModalTab('components')}
                className={`pb-2.5 px-3 text-xs font-bold flex items-center gap-2 border-b-2 transition ${
                  activeModalTab === 'components'
                    ? 'border-emerald-600 text-emerald-700'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <CubeIcon className="w-3.5 h-3.5 text-emerald-600" />
                <span>
                  2. Composants ({toEdit ? toEdit.components_theoriques?.length || 0 : form.components_theoriques?.length || 0})
                </span>
              </button>
              <button
                type="button"
                onClick={() => setActiveModalTab('parts')}
                className={`pb-2.5 px-3 text-xs font-bold flex items-center gap-2 border-b-2 transition ${
                  activeModalTab === 'parts'
                    ? 'border-purple-600 text-purple-700'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <LayersIcon className="w-3.5 h-3.5 text-purple-600" />
                <span>
                  3. Pièces & Visserie ({toEdit ? toEdit.parts_theoriques?.length || 0 : form.parts_theoriques?.length || 0})
                </span>
              </button>
              <button
                type="button"
                onClick={() => setActiveModalTab('pdr')}
                className={`pb-2.5 px-3 text-xs font-bold flex items-center gap-2 border-b-2 transition whitespace-nowrap ${
                  activeModalTab === 'pdr'
                    ? 'border-blue-600 text-blue-700'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Wrench className="w-3.5 h-3.5 text-blue-600" />
                <span>
                  4. PDR Consommables ({toEdit ? toEdit.pdr_theoriques?.length || 0 : form.pdr_theoriques?.length || 0})
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setApplyFeedback(null);
                  setActiveModalTab('preventive');
                }}
                className={`pb-2.5 px-3 text-xs font-bold flex items-center gap-2 border-b-2 transition whitespace-nowrap ${
                  activeModalTab === 'preventive'
                    ? 'border-teal-600 text-teal-700'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Calendar className="w-3.5 h-3.5 text-teal-600" />
                <span>
                  5. Plan préventif du blueprint ({toEdit ? toEdit.preventivePlanItems?.length || 0 : form.preventivePlanItems?.length || 0})
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveModalTab('failures');
                }}
                className={`pb-2.5 px-3 text-xs font-bold flex items-center gap-2 border-b-2 transition whitespace-nowrap ${
                  activeModalTab === 'failures'
                    ? 'border-amber-600 text-amber-700'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                <span>
                  6. Pannes fréquentes (DI) ({toEdit ? toEdit.commonFailures?.length || 0 : form.commonFailures?.length || 0})
                </span>
              </button>
            </div>

            <form onSubmit={toEdit ? handleEditSubmit : handleAddSubmit} className="flex-1 flex flex-col overflow-hidden">
              <div className="p-5 overflow-y-auto flex-1 space-y-4 text-xs">
                {/* TAB 1: Specs */}
                {activeModalTab === 'specs' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Code Blueprint with SequentialCodePicker */}
                      <div>
                        <label className="block text-slate-700 font-bold mb-1">Code Blueprint (Auto / Unique)</label>
                        <SequentialCodePicker
                          prefix="BPT-"
                          currentCode={toEdit ? toEdit.id_blueprint : form.id_blueprint}
                          onChangeCode={(code) => {
                            if (toEdit) setToEdit({ ...toEdit, id_blueprint: code });
                            else setForm({ ...form, id_blueprint: code });
                          }}
                          autoGeneratedCode={autoNextBlueprintId}
                          takenNumbers={takenBlueprintNumbers}
                          disabled={!!toEdit}
                        />
                      </div>

                      {/* Libellé */}
                      <div>
                        <label className="block text-slate-700 font-bold mb-1">Libellé du Schéma / Plan *</label>
                        <input
                          type="text"
                          required
                          value={toEdit ? toEdit.libelle : form.libelle}
                          onChange={(e) => {
                            if (toEdit) setToEdit({ ...toEdit, libelle: e.target.value });
                            else setForm({ ...form, libelle: e.target.value });
                          }}
                          placeholder="Ex: Plan Poupée Fixe & Broche"
                          className="w-full h-9 px-3 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-slate-900"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Family Selection */}
                      <div>
                        <label className="block text-slate-700 font-bold mb-1">Famille Technologique *</label>
                        <select
                          value={toEdit ? toEdit.id_family : form.id_family}
                          onChange={(e) => {
                            const newFam = e.target.value;
                            const tpls = templates.filter((t) => t.id_family === newFam);
                            const firstTpl = tpls[0]?.id_templates || '';
                            if (toEdit) {
                              setToEdit({ ...toEdit, id_family: newFam, id_templates: firstTpl });
                            } else {
                              setForm({ ...form, id_family: newFam, id_templates: firstTpl });
                            }
                          }}
                          className="w-full h-9 px-3 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900"
                        >
                          {families.length === 0 ? (
                            <option value="" disabled>
                              Aucune famille enregistrée
                            </option>
                          ) : (
                            families.map((f, idx) => (
                              <option key={`modal-fam-${f.id_family || idx}-${idx}`} value={f.id_family}>
                                {f.id_family} • {f.label_family || f.libelle}
                              </option>
                            ))
                          )}
                        </select>
                      </div>

                      {/* Template Selection */}
                      <div>
                        <label className="block text-slate-700 font-bold mb-1">Modèle Template de Base *</label>
                        <select
                          value={toEdit ? toEdit.id_templates : form.id_templates}
                          onChange={(e) => {
                            if (toEdit) setToEdit({ ...toEdit, id_templates: e.target.value });
                            else setForm({ ...form, id_templates: e.target.value });
                          }}
                          className="w-full h-9 px-3 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900"
                        >
                          {(toEdit ? editModalTemplates : modalTemplates).length === 0 ? (
                            <option value="" disabled>
                              Aucun modèle enregistré pour cette famille
                            </option>
                          ) : (
                            (toEdit ? editModalTemplates : modalTemplates).map((t, idx) => (
                              <option key={`modal-tpl-${t.id_templates || idx}-${idx}`} value={t.id_templates}>
                                {t.id_templates} • {t.label_templates || t.libelle}
                              </option>
                            ))
                          )}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {/* Ref Plan */}
                      <div>
                        <label className="block text-slate-700 font-bold mb-1">Réf Plan Dessin / DWG</label>
                        <input
                          type="text"
                          value={toEdit ? toEdit.ref_plan : form.ref_plan}
                          onChange={(e) => {
                            if (toEdit) setToEdit({ ...toEdit, ref_plan: e.target.value });
                            else setForm({ ...form, ref_plan: e.target.value });
                          }}
                          placeholder="DWG-TR-001"
                          className="w-full h-9 px-3 rounded-xl border border-slate-200 bg-slate-50 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-slate-900"
                        />
                      </div>

                      {/* Revision */}
                      <div>
                        <label className="block text-slate-700 font-bold mb-1">Révision</label>
                        <input
                          type="text"
                          value={toEdit ? toEdit.revision : form.revision}
                          onChange={(e) => {
                            if (toEdit) setToEdit({ ...toEdit, revision: e.target.value });
                            else setForm({ ...form, revision: e.target.value });
                          }}
                          placeholder="Rev-A"
                          className="w-full h-9 px-3 rounded-xl border border-slate-200 bg-slate-50 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-slate-900"
                        />
                      </div>

                      {/* Statut */}
                      <div>
                        <label className="block text-slate-700 font-bold mb-1">Statut</label>
                        <select
                          value={toEdit ? toEdit.statut : form.statut}
                          onChange={(e) => {
                            if (toEdit) setToEdit({ ...toEdit, statut: e.target.value });
                            else setForm({ ...form, statut: e.target.value });
                          }}
                          className="w-full h-9 px-3 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-slate-900"
                        >
                          {STATUS_OPTIONS.map((st, idx) => (
                            <option key={`status-opt-${st.value}-${idx}`} value={st.value}>
                              {st.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Technical Specs box */}
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                      <div className="font-bold text-slate-800 flex items-center gap-1.5">
                        <Zap className="w-4 h-4 text-indigo-600" />
                        <span>Paramètres & Spécifications Physiques (Puissance, Course, Moteur)</span>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-slate-500 font-medium mb-1">Puissance / Tonnage</label>
                          <input
                            type="text"
                            value={toEdit ? toEdit.specs?.puissance || '' : form.specs?.puissance || ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (toEdit) setToEdit({ ...toEdit, specs: { ...toEdit.specs, puissance: val } });
                              else setForm({ ...form, specs: { ...form.specs, puissance: val } });
                            }}
                            placeholder="Ex: 200 Tonnes / 7.5 kW"
                            className="w-full h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-500 font-medium mb-1">Course / Déplacement</label>
                          <input
                            type="text"
                            value={toEdit ? toEdit.specs?.course || '' : form.specs?.course || ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (toEdit) setToEdit({ ...toEdit, specs: { ...toEdit.specs, course: val } });
                              else setForm({ ...form, specs: { ...form.specs, course: val } });
                            }}
                            placeholder="Ex: 850 mm"
                            className="w-full h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-xs"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 2: Components (Warehouse) */}
                {activeModalTab === 'components' && (
                  <div className="space-y-4">
                    <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="text-emerald-900 font-semibold text-xs">
                        Ajoutez les sous-ensembles constructeur issus des modèles de composants d'entrepôt :
                      </div>
                    </div>

                    {/* Quick Add Row */}
                    <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <select
                        value={newCompItem.id_component}
                        onChange={(e) => {
                          const id = e.target.value;
                          const found = compTemplates.find((ct) => ct.id_comp_template === id);
                          setNewCompItem({
                            id_component: id,
                            libelle: found?.label_comp_template || id,
                            qte: 1,
                          });
                        }}
                        className="h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-xs flex-1"
                      >
                        <option value="">Sélectionner un composant...</option>
                        {compTemplates.map((ct, idx) => (
                          <option key={`comp-tpl-${ct.id_comp_template || idx}-${idx}`} value={ct.id_comp_template}>
                            {ct.id_comp_template} • {ct.label_comp_template || ct.libelle}
                          </option>
                        ))}
                      </select>

                      <input
                        type="number"
                        min="1"
                        value={newCompItem.qte}
                        onChange={(e) => setNewCompItem({ ...newCompItem, qte: Number(e.target.value) || 1 })}
                        placeholder="Qté"
                        className="h-8 w-16 px-2 text-center rounded-lg border border-slate-200 bg-white text-xs font-mono font-bold"
                      />

                      <button
                        type="button"
                        onClick={() => {
                          if (!newCompItem.id_component) return;
                          const item = { ...newCompItem };
                          if (toEdit) {
                            setToEdit({
                              ...toEdit,
                              components_theoriques: [...(toEdit.components_theoriques || []), item],
                            });
                          } else {
                            setForm({
                              ...form,
                              components_theoriques: [...form.components_theoriques, item],
                            });
                          }
                          setNewCompItem({ id_component: '', libelle: '', qte: 1 });
                        }}
                        className="h-8 px-3 rounded-lg bg-emerald-600 text-white font-semibold text-xs hover:bg-emerald-700 transition"
                      >
                        Ajouter
                      </button>
                    </div>

                    {/* List */}
                    <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                      {(toEdit ? toEdit.components_theoriques : form.components_theoriques)?.map((c, idx) => (
                        <div key={`form-comp-${c.id_component || idx}-${idx}`} className="p-2.5 flex items-center justify-between hover:bg-slate-50">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded text-[11px]">
                              {c.id_component}
                            </span>
                            <span className="font-semibold text-slate-800">{c.libelle}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-slate-700">Qté: {c.qte}</span>
                            <button
                              type="button"
                              onClick={() => {
                                if (toEdit) {
                                  setToEdit({
                                    ...toEdit,
                                    components_theoriques: toEdit.components_theoriques.filter((_, i) => i !== idx),
                                  });
                                } else {
                                  setForm({
                                    ...form,
                                    components_theoriques: form.components_theoriques.filter((_, i) => i !== idx),
                                  });
                                }
                              }}
                              className="p-1 rounded text-rose-500 hover:bg-rose-50"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* TAB 3: Parts (Warehouse) */}
                {activeModalTab === 'parts' && (
                  <div className="space-y-4">
                    <div className="p-3 rounded-xl bg-purple-50 border border-purple-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="text-purple-900 font-semibold text-xs">
                        Ajoutez la visserie et les pièces de structure d'entrepôt :
                      </div>
                    </div>

                    {/* Quick Add Row */}
                    <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <select
                        value={newPartItem.id_part}
                        onChange={(e) => {
                          const id = e.target.value;
                          const found = partDesignations.find((pd) => pd.id_part_designation === id) || partTypes.find((pt) => pt.id_part_type === id);
                          setNewPartItem({
                            id_part: id,
                            libelle: found?.label_part_designation || found?.label_part_type || id,
                            qte: 1,
                          });
                        }}
                        className="h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-xs flex-1"
                      >
                        <option value="">Sélectionner une pièce...</option>
                        {partTypes.map((pt, idx) => (
                          <option key={`part-type-${pt.id_part_type || idx}-${idx}`} value={pt.id_part_type}>
                            {pt.id_part_type} • {pt.label_part_type || pt.libelle}
                          </option>
                        ))}
                      </select>

                      <input
                        type="number"
                        min="1"
                        value={newPartItem.qte}
                        onChange={(e) => setNewPartItem({ ...newPartItem, qte: Number(e.target.value) || 1 })}
                        placeholder="Qté"
                        className="h-8 w-16 px-2 text-center rounded-lg border border-slate-200 bg-white text-xs font-mono font-bold"
                      />

                      <button
                        type="button"
                        onClick={() => {
                          if (!newPartItem.id_part) return;
                          const item = { ...newPartItem };
                          if (toEdit) {
                            setToEdit({
                              ...toEdit,
                              parts_theoriques: [...(toEdit.parts_theoriques || []), item],
                            });
                          } else {
                            setForm({
                              ...form,
                              parts_theoriques: [...form.parts_theoriques, item],
                            });
                          }
                          setNewPartItem({ id_part: '', libelle: '', qte: 1 });
                        }}
                        className="h-8 px-3 rounded-lg bg-purple-600 text-white font-semibold text-xs hover:bg-purple-700 transition"
                      >
                        Ajouter
                      </button>
                    </div>

                    {/* List */}
                    <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                      {(toEdit ? toEdit.parts_theoriques : form.parts_theoriques)?.map((p, idx) => (
                        <div key={`form-part-${p.id_part || idx}-${idx}`} className="p-2.5 flex items-center justify-between hover:bg-slate-50">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded text-[11px]">
                              {p.id_part}
                            </span>
                            <span className="font-semibold text-slate-800">{p.libelle}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-slate-700">Qté: {p.qte}</span>
                            <button
                              type="button"
                              onClick={() => {
                                if (toEdit) {
                                  setToEdit({
                                    ...toEdit,
                                    parts_theoriques: toEdit.parts_theoriques.filter((_, i) => i !== idx),
                                  });
                                } else {
                                  setForm({
                                    ...form,
                                    parts_theoriques: form.parts_theoriques.filter((_, i) => i !== idx),
                                  });
                                }
                              }}
                              className="p-1 rounded text-rose-500 hover:bg-rose-50"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* TAB 4: PDR Consommables & Nexus Extraction */}
                {activeModalTab === 'pdr' && (
                  <div className="space-y-4">
                    {/* Nexus Extraction Tool Box */}
                    <div className="p-3.5 rounded-xl bg-indigo-50/70 border border-indigo-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="font-bold text-indigo-950 flex items-center gap-1.5">
                          <Sparkles className="w-4 h-4 text-indigo-600" />
                          <span>Extraction Nexus (depuis l'historique d'une Machine)</span>
                        </div>
                        <div className="text-[11px] text-indigo-800 mt-0.5">
                          Remplissez automatiquement la liste des PDR à partir des mouvements réels d'une machine.
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <select
                          id="nexus-mch-select"
                          disabled={filterActiveMachines(machines).length === 0}
                          className="h-8 px-2 rounded-lg border border-indigo-200 bg-white text-xs font-mono text-slate-800 disabled:opacity-50"
                        >
                          {filterActiveMachines(machines).length === 0 ? (
                            <option value="" disabled>
                              Aucune machine active enregistrée
                            </option>
                          ) : (
                            filterActiveMachines(machines).map((m, idx) => (
                              <option key={`nexus-mch-${m.id_machine_registered || idx}-${idx}`} value={m.id_machine_registered}>
                                {m.id_machine_registered}
                              </option>
                            ))
                          )}
                        </select>
                        <button
                          type="button"
                          disabled={filterActiveMachines(machines).length === 0}
                          onClick={() => {
                            const sel = (document.getElementById('nexus-mch-select') as HTMLSelectElement | null)?.value;
                            handleExtractFromMachineHistory(sel, toEdit ? 'edit' : 'add');
                          }}
                          className="h-8 px-3 rounded-lg bg-indigo-600 text-white font-semibold text-xs hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Extraire
                        </button>
                      </div>
                    </div>

                    {/* Manual PDR Add Row */}
                    <div className="flex flex-wrap items-center gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <select
                        value={newPdrItem.id_pdr}
                        onChange={(e) => {
                          const ref = e.target.value;
                          const found = stockItems.find((s) => s.ref === ref);
                          setNewPdrItem({
                            ...newPdrItem,
                            id_pdr: ref,
                            libelle: found?.designation || ref,
                          });
                        }}
                        className="h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-xs flex-1 min-w-[160px]"
                      >
                        <option value="">Sélectionner un article PDR...</option>
                        {stockItems.map((s, idx) => (
                          <option key={`pdr-stock-opt-${s.ref || s.id || idx}-${idx}`} value={s.ref}>
                            {s.ref} • {s.designation}
                          </option>
                        ))}
                      </select>

                      <input
                        type="number"
                        min="1"
                        value={newPdrItem.qte}
                        onChange={(e) => setNewPdrItem({ ...newPdrItem, qte: Number(e.target.value) || 1 })}
                        placeholder="Qté"
                        className="h-8 w-16 px-2 text-center rounded-lg border border-slate-200 bg-white text-xs font-mono font-bold"
                      />

                      <select
                        value={newPdrItem.criticite}
                        onChange={(e) => setNewPdrItem({ ...newPdrItem, criticite: e.target.value })}
                        className="h-8 px-2 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-800"
                      >
                        <option value="Haute">Critique : Haute</option>
                        <option value="Moyenne">Critique : Moyenne</option>
                        <option value="Faible">Critique : Faible</option>
                      </select>

                      <button
                        type="button"
                        onClick={() => {
                          if (!newPdrItem.id_pdr) return;
                          const item = { ...newPdrItem };
                          if (toEdit) {
                            setToEdit({
                              ...toEdit,
                              pdr_theoriques: [...(toEdit.pdr_theoriques || []), item],
                            });
                          } else {
                            setForm({
                              ...form,
                              pdr_theoriques: [...form.pdr_theoriques, item],
                            });
                          }
                          setNewPdrItem({ id_pdr: '', libelle: '', qte: 1, criticite: 'Haute' });
                        }}
                        className="h-8 px-3 rounded-lg bg-blue-600 text-white font-semibold text-xs hover:bg-blue-700 transition"
                      >
                        Ajouter
                      </button>
                    </div>

                    {/* List */}
                    <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                      {(toEdit ? toEdit.pdr_theoriques : form.pdr_theoriques)?.map((p, idx) => (
                        <div key={`form-pdr-${p.id_pdr || idx}-${idx}`} className="p-2.5 flex items-center justify-between hover:bg-slate-50">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded text-[11px]">
                              {p.id_pdr}
                            </span>
                            <span className="font-semibold text-slate-800">{p.libelle}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                p.criticite === 'Haute'
                                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                  : 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              {p.criticite || 'Moyenne'}
                            </span>
                            <span className="font-mono font-bold text-slate-700">Qté: {p.qte}</span>
                            <button
                              type="button"
                              onClick={() => {
                                if (toEdit) {
                                  setToEdit({
                                    ...toEdit,
                                    pdr_theoriques: toEdit.pdr_theoriques.filter((_, i) => i !== idx),
                                  });
                                } else {
                                  setForm({
                                    ...form,
                                    pdr_theoriques: form.pdr_theoriques.filter((_, i) => i !== idx),
                                  });
                                }
                              }}
                              className="p-1 rounded text-rose-500 hover:bg-rose-50"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* TAB 5: Plan préventif du blueprint */}
                {activeModalTab === 'preventive' && (() => {
                  const targetObj = toEdit || form;
                  const currentItems = Array.isArray(targetObj.preventivePlanItems)
                    ? targetObj.preventivePlanItems
                    : [];
                  const activeLinkedMachines = filterActiveMachines(machines).filter(
                    (m) => m.id_blueprint === targetObj.id_blueprint
                  );
                  return (
                    <div className="space-y-4">
                      <div className="p-3.5 rounded-xl bg-teal-50/80 border border-teal-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <div className="font-bold text-teal-950 flex items-center gap-1.5">
                            <Calendar className="w-4 h-4 text-teal-600" />
                            <span>Plan préventif du blueprint</span>
                          </div>
                          <div className="text-[11px] text-teal-800 mt-0.5">
                            Définissez les opérations préventives standards du modèle ({activeLinkedMachines.length} machine(s) active(s) liée(s)).
                          </div>
                        </div>

                        {toEdit && (
                          <button
                            type="button"
                            disabled={currentItems.length === 0 || activeLinkedMachines.length === 0}
                            onClick={() => handleTriggerApplyPreventivePlan(toEdit)}
                            className="h-8 px-3.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs transition flex items-center gap-1.5 shadow-2xs disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Appliquer aux machines actives liées ({activeLinkedMachines.length})</span>
                          </button>
                        )}
                      </div>

                      {applyFeedback && (
                        <div
                          className={`p-3 rounded-xl text-xs font-semibold border ${
                            applyFeedback.type === 'success'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : applyFeedback.type === 'warning'
                              ? 'bg-amber-50 text-amber-800 border-amber-200'
                              : 'bg-sky-50 text-sky-800 border-sky-200'
                          }`}
                        >
                          {applyFeedback.message}
                        </div>
                      )}

                      {/* Add Item Form */}
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                          <input
                            type="text"
                            list="bp-modal-comps-datalist"
                            value={newPreventiveItem.composant}
                            onChange={(e) => setNewPreventiveItem({ ...newPreventiveItem, composant: e.target.value })}
                            placeholder="Composant (ex: Broche, Courroie...)"
                            className="h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-xs sm:col-span-2"
                          />
                          <datalist id="bp-modal-comps-datalist">
                            {(targetObj.components_theoriques || []).map((c, idx) => (
                              <option key={`mod-dl-${idx}`} value={c.libelle || c.id_component} />
                            ))}
                          </datalist>

                          <select
                            value={newPreventiveItem.action_code}
                            onChange={(e) => setNewPreventiveItem({ ...newPreventiveItem, action_code: e.target.value })}
                            className="h-8 px-2 rounded-lg border border-slate-200 bg-white text-xs font-semibold"
                          >
                            {(preventiveActions && preventiveActions.length > 0
                              ? preventiveActions
                              : [
                                  { code: 'C', libelle: 'Contrôle' },
                                  { code: 'N', libelle: 'Nettoyage' },
                                  { code: 'G', libelle: 'Graissage' },
                                  { code: 'V', libelle: 'Vérification' },
                                  { code: 'R', libelle: 'Révision' },
                                  { code: 'S', libelle: 'Serrage' },
                                  { code: 'L', libelle: 'Lubrification' },
                                ]
                            ).map((act, idx) => (
                              <option key={`mod-act-${act.code || idx}-${idx}`} value={act.code}>
                                {act.code} • {act.libelle}
                              </option>
                            ))}
                          </select>

                          <select
                            value={newPreventiveItem.frequence}
                            onChange={(e) => setNewPreventiveItem({ ...newPreventiveItem, frequence: e.target.value })}
                            className="h-8 px-2 rounded-lg border border-slate-200 bg-white text-xs font-semibold"
                          >
                            <option value="Hebdo">Hebdo</option>
                            <option value="Bi-hebdo">Bi-hebdo</option>
                            <option value="Mensuel">Mensuel</option>
                            <option value="Trimestriel">Trimestriel</option>
                            <option value="Semestriel">Semestriel</option>
                            <option value="Annuel">Annuel</option>
                          </select>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <input
                            type="text"
                            value={newPreventiveItem.description}
                            onChange={(e) => setNewPreventiveItem({ ...newPreventiveItem, description: e.target.value })}
                            placeholder="Consigne / Description de l'opération..."
                            className="h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-xs flex-1 min-w-[180px]"
                          />
                          <div className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            <input
                              type="number"
                              min="1"
                              value={newPreventiveItem.duree_min}
                              onChange={(e) =>
                                setNewPreventiveItem({
                                  ...newPreventiveItem,
                                  duree_min: Number(e.target.value) || 15,
                                })
                              }
                              placeholder="Min"
                              className="h-8 w-16 px-2 text-center rounded-lg border border-slate-200 bg-white text-xs font-mono font-bold"
                            />
                            <span className="text-[11px] text-slate-500">min</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              if (!newPreventiveItem.frequence) return;
                              const item = {
                                id: `BPP-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                                composant: newPreventiveItem.composant.trim() || 'Machine entière',
                                action_code: newPreventiveItem.action_code || 'C',
                                frequence: newPreventiveItem.frequence || 'Mensuel',
                                duree_min: Number(newPreventiveItem.duree_min) || 15,
                                description: newPreventiveItem.description.trim(),
                              };
                              if (toEdit) {
                                setToEdit({
                                  ...toEdit,
                                  preventivePlanItems: [...currentItems, item],
                                });
                              } else {
                                setForm({
                                  ...form,
                                  preventivePlanItems: [...currentItems, item],
                                });
                              }
                              setNewPreventiveItem({
                                composant: '',
                                action_code: 'C',
                                frequence: 'Mensuel',
                                duree_min: 15,
                                description: '',
                              });
                            }}
                            className="h-8 px-3 rounded-lg bg-teal-600 text-white font-semibold text-xs hover:bg-teal-700 transition flex items-center gap-1"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Ajouter</span>
                          </button>
                        </div>
                      </div>

                      {/* List */}
                      <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                        {currentItems.length > 0 ? (
                          currentItems.map((item, idx) => (
                            <div
                              key={`form-pm-${item.id || idx}-${idx}`}
                              className="p-2.5 flex items-center justify-between hover:bg-slate-50 gap-2"
                            >
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-mono font-bold text-teal-800 bg-teal-50 px-1.5 py-0.5 rounded border border-teal-200 text-[11px]">
                                    {item.action_code || 'C'}
                                  </span>
                                  <span className="font-semibold text-slate-800">
                                    {item.composant || 'Machine entière'}
                                  </span>
                                  <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-bold">
                                    {item.frequence}
                                  </span>
                                  {item.duree_min && (
                                    <span className="font-mono text-[11px] text-slate-500">
                                      {item.duree_min} min
                                    </span>
                                  )}
                                </div>
                                {item.description && (
                                  <p className="text-[11px] text-slate-500 mt-0.5 truncate">{item.description}</p>
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  const nextItems = currentItems.filter((_, i) => i !== idx);
                                  if (toEdit) {
                                    setToEdit({
                                      ...toEdit,
                                      preventivePlanItems: nextItems,
                                    });
                                  } else {
                                    setForm({
                                      ...form,
                                      preventivePlanItems: nextItems,
                                    });
                                  }
                                }}
                                className="p-1 rounded text-rose-500 hover:bg-rose-50 shrink-0"
                                title="Supprimer"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))
                        ) : (
                          <div className="p-6 text-center text-slate-400">
                            Aucun élément préventif ajouté à ce Blueprint.
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* TAB 6: Pannes fréquentes du blueprint (DI Correctif) */}
                {activeModalTab === 'failures' && (() => {
                  const targetObj = toEdit || form;
                  const currentFailures = Array.isArray(targetObj.commonFailures)
                    ? targetObj.commonFailures
                    : [];
                  return (
                    <div className="space-y-4">
                      <div className="p-3.5 rounded-xl bg-amber-50/80 border border-amber-200 flex items-center justify-between gap-3">
                        <div>
                          <div className="font-bold text-amber-950 flex items-center gap-1.5">
                            <AlertTriangle className="w-4 h-4 text-amber-600" />
                            <span>Pannes fréquentes du blueprint (Suggestions DI Correctif)</span>
                          </div>
                          <div className="text-[11px] text-amber-800 mt-0.5">
                            Définissez les pannes récurrentes et travaux recommandés pour pré-remplir les demandes d&apos;intervention (DI).
                          </div>
                        </div>
                      </div>

                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                          <input
                            type="text"
                            value={newCommonFailureItem.title}
                            onChange={(e) =>
                              setNewCommonFailureItem({ ...newCommonFailureItem, title: e.target.value })
                            }
                            placeholder="Titre / Symptôme (ex: Échauffement palier broche)"
                            className="h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-xs sm:col-span-2"
                          />
                          <select
                            value={newCommonFailureItem.type_panne}
                            onChange={(e) =>
                              setNewCommonFailureItem({ ...newCommonFailureItem, type_panne: e.target.value })
                            }
                            className="h-8 px-2 rounded-lg border border-slate-200 bg-white text-xs font-semibold"
                          >
                            <option value="M">M • Mécanique</option>
                            <option value="E">E • Électrique</option>
                            <option value="H">H • Hydraulique</option>
                            <option value="P">P • Pneumatique</option>
                          </select>
                          <select
                            value={newCommonFailureItem.urgence}
                            onChange={(e) =>
                              setNewCommonFailureItem({ ...newCommonFailureItem, urgence: e.target.value })
                            }
                            className="h-8 px-2 rounded-lg border border-slate-200 bg-white text-xs font-semibold"
                          >
                            <option value="HAUTE">Urgence : HAUTE</option>
                            <option value="MOYENNE">Urgence : MOYENNE</option>
                            <option value="BASSE">Urgence : BASSE</option>
                          </select>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <input
                            type="text"
                            value={newCommonFailureItem.recommended_action}
                            onChange={(e) =>
                              setNewCommonFailureItem({
                                ...newCommonFailureItem,
                                recommended_action: e.target.value,
                              })
                            }
                            placeholder="Travail suggéré (ex: Contrôler jeu et remplacer roulement)"
                            className="h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-xs sm:col-span-2"
                          />
                          <select
                            value={newCommonFailureItem.pdr_ref}
                            onChange={(e) =>
                              setNewCommonFailureItem({ ...newCommonFailureItem, pdr_ref: e.target.value })
                            }
                            className="h-8 px-2 rounded-lg border border-slate-200 bg-white text-xs"
                          >
                            <option value="">PDR associée (optionnel)</option>
                            {stockItems.map((s, idx) => (
                              <option key={`mod-cf-pdr-${s.ref || idx}-${idx}`} value={s.ref}>
                                {s.ref} • {s.designation}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={newCommonFailureItem.description}
                            onChange={(e) =>
                              setNewCommonFailureItem({
                                ...newCommonFailureItem,
                                description: e.target.value,
                              })
                            }
                            placeholder="Description complémentaire / cause..."
                            className="h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-xs flex-1"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              if (!newCommonFailureItem.title.trim()) return;
                              const item = {
                                id: `BPF-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                                title: newCommonFailureItem.title.trim(),
                                type_panne: newCommonFailureItem.type_panne || 'M',
                                urgence: newCommonFailureItem.urgence || 'HAUTE',
                                recommended_action: newCommonFailureItem.recommended_action.trim(),
                                description: newCommonFailureItem.description.trim(),
                                pdr_ref: newCommonFailureItem.pdr_ref || undefined,
                              };
                              const nextFailures = [...currentFailures, item];
                              if (toEdit) {
                                setToEdit({
                                  ...toEdit,
                                  commonFailures: nextFailures,
                                });
                              } else {
                                setForm({
                                  ...form,
                                  commonFailures: nextFailures,
                                });
                              }
                              setNewCommonFailureItem({
                                title: '',
                                type_panne: 'M',
                                urgence: 'HAUTE',
                                recommended_action: '',
                                description: '',
                                pdr_ref: '',
                              });
                            }}
                            className="h-8 px-3 rounded-lg bg-amber-600 text-white font-semibold text-xs hover:bg-amber-700 transition flex items-center gap-1 shrink-0"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Ajouter</span>
                          </button>
                        </div>
                      </div>

                      <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                        {currentFailures.length > 0 ? (
                          currentFailures.map((cf, idx) => (
                            <div
                              key={`form-cf-${cf.id || idx}-${idx}`}
                              className="p-2.5 flex items-center justify-between hover:bg-slate-50 gap-2"
                            >
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-mono font-bold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 text-[11px]">
                                    {cf.type_panne || 'M'}
                                  </span>
                                  <span className="font-semibold text-slate-800">{cf.title}</span>
                                  {cf.urgence && (
                                    <span
                                      className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                                        cf.urgence === 'HAUTE'
                                          ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                          : cf.urgence === 'BASSE'
                                          ? 'bg-slate-100 text-slate-600'
                                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                                      }`}
                                    >
                                      {cf.urgence}
                                    </span>
                                  )}
                                  {cf.pdr_ref && (
                                    <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 font-mono text-[10px] font-bold">
                                      PDR: {cf.pdr_ref}
                                    </span>
                                  )}
                                </div>
                                {(cf.recommended_action || cf.description) && (
                                  <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                                    {[cf.recommended_action, cf.description].filter(Boolean).join(' • ')}
                                  </p>
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  const nextFailures = currentFailures.filter((_, i) => i !== idx);
                                  if (toEdit) {
                                    setToEdit({
                                      ...toEdit,
                                      commonFailures: nextFailures,
                                    });
                                  } else {
                                    setForm({
                                      ...form,
                                      commonFailures: nextFailures,
                                    });
                                  }
                                }}
                                className="p-1 rounded text-rose-500 hover:bg-rose-50 shrink-0"
                                title="Supprimer"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))
                        ) : (
                          <div className="p-6 text-center text-slate-400">
                            Aucune panne fréquente ajoutée à ce Blueprint.
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Form Actions Footer */}
              <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
                <div className="text-[11px] text-slate-500">
                  {activeModalTab !== 'preventive' ? 'Onglet suivant pour renseigner les pièces et le plan préventif' : 'Prêt à enregistrer'}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-semibold hover:bg-slate-50 transition"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={
                      !(toEdit ? toEdit.id_family : form.id_family) ||
                      !(toEdit ? toEdit.id_templates : form.id_templates) ||
                      !(toEdit ? toEdit.libelle : form.libelle)?.trim()
                    }
                    className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-[0_12px_32px_-6px_rgba(0,0,0,0.12),0_4px_12px_-2px_rgba(0,0,0,0.06)] hover:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.16),0_6px_16px_-3px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-300 ease-out transition disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                  >
                    {toEdit ? 'Enregistrer Modifications' : 'Créer Blueprint BOM'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {toDelete && (() => {
        const linkedCount = blueprintMachineCountMap[toDelete.id_blueprint] || 0;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xl p-5 max-w-sm w-full space-y-4">
              <div className="flex items-center gap-3 text-rose-600">
                <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">
                    {linkedCount > 0 ? 'Suppression bloquée (Intégrité Référentielle)' : 'Supprimer ce Blueprint ?'}
                  </h3>
                  <div className="font-mono text-xs text-rose-600 font-bold">{toDelete.id_blueprint}</div>
                </div>
              </div>

              {linkedCount > 0 ? (
                <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-3">
                  Ce Blueprint est rattaché à <b>{linkedCount} machine(s)</b> du parc. Dissociez-le des machines concernées avant de pouvoir le supprimer afin d&apos;éviter des références orphelines.
                </p>
              ) : (
                <p className="text-xs text-slate-500">
                  Cette action supprimera définitivement le schéma et la nomenclature (BOM) associée.
                </p>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={() => setToDelete(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50"
                >
                  {linkedCount > 0 ? 'Fermer' : 'Annuler'}
                </button>
                {linkedCount === 0 && (
                  <button
                    onClick={() => {
                      onDeleteBlueprint(toDelete.id_blueprint);
                      setToDelete(null);
                    }}
                    className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-[0_12px_32px_-6px_rgba(0,0,0,0.12),0_4px_12px_-2px_rgba(0,0,0,0.06)] hover:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.16),0_6px_16px_-3px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-300 ease-out"
                  >
                    Confirmer Suppression
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Excel Formulas Modal */}
      {showFormulasModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-2xl overflow-hidden p-5 md:p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center">
                  <Calculator className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-base">Formules Excel — Blueprints Machines (BOM)</h3>
                  <p className="text-xs text-slate-500">Formules miroir de l'onglet Blueprint (Excel GMAO)</p>
                </div>
              </div>
              <button
                onClick={() => setShowFormulasModal(false)}
                className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3.5 max-h-[60vh] overflow-y-auto pr-1">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/90 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Formule C — Liaisons Clés (Famille & Template)</span>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-indigo-100 text-indigo-800">LIAISON</span>
                </div>
                <div className="font-mono text-xs text-indigo-800 font-bold bg-white p-2 rounded-lg border border-indigo-100">
                  =[@id_family] & [@id_templates]
                </div>
                <p className="text-[11px] text-slate-500">Rattachement hiérarchique direct du Blueprint aux tables parentes Familles et Templates.</p>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/90 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Formule D — Comptage Volets Nomenclature (BOM)</span>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-teal-100 text-teal-800">COUNTA</span>
                </div>
                <div className="font-mono text-xs text-teal-800 font-bold bg-white p-2 rounded-lg border border-teal-100">
                  =COUNTA(Specs) + COUNTA(Comps) + COUNTA(Parts) + COUNTA(PDR)
                </div>
                <p className="text-[11px] text-slate-500">Somme totale des éléments et spécifications documentés dans les 4 volets de la nomenclature.</p>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/90 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Formule E — Liaison Parc Machines Registered</span>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">COUNTIF</span>
                </div>
                <div className="font-mono text-xs text-emerald-800 font-bold bg-white p-2 rounded-lg border border-emerald-100">
                  =COUNTIF(Machines!G:G, [@id_blueprint])
                </div>
                <p className="text-[11px] text-slate-500">Nombre d'équipements physiques dans le parc configurés avec ce Blueprint de référence.</p>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-400 font-medium">Modèle GMAO_Light_Template_V2</span>
              <button
                onClick={() => setShowFormulasModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-bold transition shadow-[0_12px_32px_-6px_rgba(0,0,0,0.12),0_4px_12px_-2px_rgba(0,0,0,0.06)] hover:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.16),0_6px_16px_-3px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-300 ease-out cursor-pointer"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </AnimatedPage>
  );
}
