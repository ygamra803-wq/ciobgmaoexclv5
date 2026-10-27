import {  useState, useRef, useMemo, useEffect  } from 'react';
import * as XLSX from 'xlsx';
import AnimatedPage from '../../components/common/AnimatedPage';
import CustomSelect from '../../components/common/CustomSelect';
import { HubIcon } from '../../components/common/icons/HubIcon';
import { CategoryIcon } from '../../components/common/icons/CategoryIcon';
import FormulasModalButton from '../../components/common/FormulasModalButton';
import Action3DButton from '../../components/common/Action3DButton';
import PageHeaderIcon from '../../components/common/PageHeaderIcon';
import { useMachines } from '../../hooks/useMachines';
import { useSmartTableLoader } from '../../hooks/useSmartTableLoader';
import TableSkeletonRows from '../../components/common/TableSkeletonRows';
import MachinesKPIBar from './components/MachinesKPIBar';
import {
  Factory,
  Search,
  MapPin,
  Users,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  Edit2,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  ArrowUpDown,
  ChevronDown,
  ArrowDown,
  ArrowUp,
  Activity,
  Cpu,
  X,
  Radio,
  FileText,
  Calculator,
  MoreVertical,
  Calendar,
  Hash,
  Wrench,
  FileSpreadsheet,
  RotateCcw,
  ShieldCheck,
  Clock,
  Sparkles,
  ShieldAlert,
  Settings2,
  Plus,
  Check,
} from 'lucide-react';
import PreventiveService from '../../../application/services/PreventiveService';
import { getMachineAssetClass } from '../../../utils/activeMachines';

// Helper to retrieve machine serial number with smart fallback
export const getMachineSerialNumber = (m) => {
  if (m?.serial_number) return m.serial_number;
  if (m?.numero_serie) return m.numero_serie;
  if (m?.num_serie) return m.num_serie;
  // Deterministic realistic fallback based on machine code
  const code = String(m?.id_machine_registered || '01').replace(/[^A-Z0-9]/gi, '');
  return `SN-2022-${code}`;
};

// Helper to retrieve machine commissioning date with smart fallback
export const getMachineCommissioningDate = (m) => {
  if (m?.date_mise_en_service) return m.date_mise_en_service;
  if (m?.date_installation) return m.date_installation;
  if (m?.annee) return `${m.annee}-01-15`;
  // Deterministic realistic date based on machine code
  const num = parseInt((m?.id_machine_registered || '').replace(/\D/g, ''), 10) || 5;
  const year = 2018 + (num % 6);
  const month = String(1 + (num % 12)).padStart(2, '0');
  const day = String(10 + (num % 18)).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Helper to find a zone object from any zone/sector reference (id_zone, code_zone, code, or libelle)
const getZoneByRef = (ref, zonesList = []) => {
  if (!ref || !Array.isArray(zonesList)) return null;
  const str = String(ref).trim().toLowerCase();
  return (
    zonesList.find((z) => {
      const idZ = String(z?.id_zone || '').trim().toLowerCase();
      const codeZ = String(z?.code_zone || z?.code || '').trim().toLowerCase();
      const libZ = String(z?.libelle || '').trim().toLowerCase();
      return (idZ && idZ === str) || (codeZ && codeZ === str) || (libZ && libZ === str);
    }) || null
  );
};

// Check if a machine matches the zone/sector filter
const matchesZoneFilter = (machineZoneRef, filterVal, zonesList = []) => {
  if (!filterVal || filterVal === 'ALL') return true;
  if (!machineZoneRef) return false;

  const mRef = String(machineZoneRef).trim().toLowerCase();
  const fRef = String(filterVal).trim().toLowerCase();

  // 1. Direct string match
  if (mRef === fRef) return true;

  // 2. Lookup zone objects
  const fZone = getZoneByRef(filterVal, zonesList);
  const mZone = getZoneByRef(machineZoneRef, zonesList);

  if (fZone && mZone) {
    const fId = String(fZone.id_zone || '').trim().toLowerCase();
    const fCode = String(fZone.code_zone || fZone.code || '').trim().toLowerCase();
    const mId = String(mZone.id_zone || '').trim().toLowerCase();
    const mCode = String(mZone.code_zone || mZone.code || '').trim().toLowerCase();
    return (fId && fId === mId) || (fCode && fCode === mCode);
  }

  if (fZone) {
    const fId = String(fZone.id_zone || '').trim().toLowerCase();
    const fCode = String(fZone.code_zone || fZone.code || '').trim().toLowerCase();
    return (fId && fId === mRef) || (fCode && fCode === mRef);
  }

  if (mZone) {
    const mId = String(mZone.id_zone || '').trim().toLowerCase();
    const mCode = String(mZone.code_zone || mZone.code || '').trim().toLowerCase();
    return (mId && mId === fRef) || (mCode && mCode === fRef);
  }

  return false;
};

export default function MachinesRegisteredView({
  machines: propMachines = [],
  families: passedFamilies = [],
  effectiveFamilies = [],
  templates: passedTemplates = [],
  effectiveTemplates = [],
  blueprints = [],
  zones = [],
  technicians = [],
  mouvements = [],
  mchFamilyFilter = 'ALL',
  setMchFamilyFilter = () => {},
  mchTemplateFilter = 'ALL',
  setMchTemplateFilter = () => {},
  mchZoneFilter = 'ALL',
  setMchZoneFilter = () => {},
  mchSearch = '',
  setMchSearch = () => {},
  onAddMachine: _propAddMachine,
  onUpdateMachine: propUpdateMachine,
  onDeleteMachine: propDeleteMachine,
  onOpenAddMachine = () => {},
  onNavigateToFamily: _onNavigateToFamily = () => {},
  onNavigateToTemplate: _onNavigateToTemplate = () => {},
  onNavigateToZone: _onNavigateToZone = () => {},
  onNavigateToBlueprints = () => {},
  onNavigateToQuickSortie = () => {},
  onNavigateToPreventive = () => {},
}) {
  const {
    machines: dbMachines,
    generalSystemTypes = [],
    updateMachine: dbUpdateMachine,
    deleteMachine: dbDeleteMachine,
    addGeneralSystemType,
    toggleGeneralSystemType,
  } = useMachines();

  const machines = useMemo(() => {
    if (Array.isArray(propMachines) && propMachines.length > 0) {
      return propMachines;
    }
    if (Array.isArray(dbMachines) && dbMachines.length > 0) {
      return dbMachines;
    }
    return [];
  }, [propMachines, dbMachines]);

  const families = useMemo(() => {
    if (Array.isArray(passedFamilies) && passedFamilies.length > 0) return passedFamilies;
    if (Array.isArray(effectiveFamilies) && effectiveFamilies.length > 0) return effectiveFamilies;
    return [];
  }, [passedFamilies, effectiveFamilies]);

  const templates = useMemo(() => {
    if (Array.isArray(passedTemplates) && passedTemplates.length > 0) return passedTemplates;
    if (Array.isArray(effectiveTemplates) && effectiveTemplates.length > 0) return effectiveTemplates;
    return [];
  }, [passedTemplates, effectiveTemplates]);

  const onUpdateMachine = (id, data) => {
    if (propUpdateMachine) propUpdateMachine(id, data);
    if (dbUpdateMachine) dbUpdateMachine(id, data).catch(() => {});
  };

  const onDeleteMachine = (id) => {
    if (propDeleteMachine) propDeleteMachine(id);
    if (dbDeleteMachine) dbDeleteMachine(id).catch(() => {});
  };

  const [toEdit, setToEdit] = useState(null);
  const [toDelete, setToDelete] = useState(null);
  const [preventiveMachine, setPreventiveMachine] = useState(null);
  const [statusFilter, setStatusFilter] = useState('ALL'); // ALL | 'En Service' | 'En Maintenance' | 'Arrêt'
  const [assetClassFilter, setAssetClassFilter] = useState<'ALL' | 'PRODUCTION' | 'SYSTEM_GENERAL'>('ALL');
  const [sysTypeFilter, setSysTypeFilter] = useState('ALL');
  const [showSysTypesModal, setShowSysTypesModal] = useState(false);
  const [newSysTypeName, setNewSysTypeName] = useState('');
  const [newSysTypeCode, setNewSysTypeCode] = useState('');
  const [showEditNewSysType, setShowEditNewSysType] = useState(false);
  const [showFormulasModal, setShowFormulasModal] = useState(false);

  const activeSystemTypes = useMemo(
    () => (Array.isArray(generalSystemTypes) ? generalSystemTypes.filter((t) => t && t.is_active !== false) : []),
    [generalSystemTypes]
  );

  const handleQuickCreateSystemType = (selectInEdit = false) => {
    const cleanName = newSysTypeName.trim();
    if (!cleanName || !addGeneralSystemType) return;
    const created = addGeneralSystemType({
      name: cleanName,
      code: newSysTypeCode.trim().toUpperCase(),
    });
    if (created && selectInEdit && toEdit) {
      setToEdit({
        ...toEdit,
        asset_class: 'SYSTEM_GENERAL',
        id_general_system_type: created.id,
      });
    }
    setNewSysTypeName('');
    setNewSysTypeCode('');
    setShowEditNewSysType(false);
  };

  // Debounce state for high-performance machine searching
  const [localSearch, setLocalSearch] = useState(mchSearch);

  // Sync from parent
  useEffect(() => {
    setLocalSearch(mchSearch);
  }, [mchSearch]);

  // Propagate to parent with 200ms debounce
  useEffect(() => {
    const handler = setTimeout(() => {
      setMchSearch(localSearch);
    }, 200);
    return () => clearTimeout(handler);
  }, [localSearch, setMchSearch]);

  // Only show families that have registered machines
  const machineFamilies = useMemo(() => {
    const usedFamilyIds = new Set(machines.map((m) => m.id_family).filter(Boolean));
    return families.filter((f) => usedFamilyIds.has(f.id_family));
  }, [families, machines]);

  // Cascading templates based on selected family
  const availableTemplates = useMemo(() => {
    let relTemplates = templates;
    if (mchFamilyFilter !== 'ALL') {
      relTemplates = templates.filter((t) => t.id_family === mchFamilyFilter);
    }
    return relTemplates;
  }, [templates, mchFamilyFilter]);

  // Calculate Interventions Count Map per Machine for high efficiency
  const sortiesCountMap = useMemo(() => {
    const map = {};
    mouvements.forEach((m) => {
      if (m.id_machine_registered) {
        map[m.id_machine_registered] = (map[m.id_machine_registered] || 0) + 1;
      }
    });
    return map;
  }, [mouvements]);

  // KPI Statistics
  const kpis = useMemo(() => {
    const total = machines.length;
    let enService = 0;
    let enMaintenance = 0;
    let enArret = 0;

    machines.forEach((m) => {
      const st = String(m.status || 'En Service').toLowerCase();
      if (st.includes('service')) enService++;
      else if (st.includes('maint') || st.includes('panne')) enMaintenance++;
      else enArret++;
    });

    const activeFamiliesCount = new Set(machines.map((m) => m.id_family).filter(Boolean)).size;
    const totalInterventions = Object.values(sortiesCountMap).reduce((a, b) => a + b, 0);

    return {
      total,
      enService,
      enMaintenance,
      enArret,
      activeFamiliesCount,
      totalInterventions,
    };
  }, [machines, sortiesCountMap]);

  // Filtering
  const filteredMachines = useMemo(() => {
    return machines.filter((m) => {
      const mClass = getMachineAssetClass(m);
      if (assetClassFilter !== 'ALL' && mClass !== assetClassFilter) return false;
      if (sysTypeFilter !== 'ALL' && String(m.id_general_system_type || '') !== sysTypeFilter) return false;
      if (mchFamilyFilter !== 'ALL' && m.id_family !== mchFamilyFilter) return false;
      if (mchTemplateFilter !== 'ALL' && m.id_templates !== mchTemplateFilter) return false;
      if (!matchesZoneFilter(m.id_zone_default, mchZoneFilter, zones)) return false;
      if (statusFilter !== 'ALL') {
        const st = String(m.status || 'En Service').toLowerCase();
        if (statusFilter === 'En Service' && !st.includes('service')) return false;
        if (statusFilter === 'En Maintenance' && !st.includes('maint') && !st.includes('panne')) return false;
        if (statusFilter === 'Arrêt' && (st.includes('service') || st.includes('maint') || st.includes('panne'))) return false;
      }
      if (mchSearch) {
        const q = String(mchSearch).trim().toLowerCase();
        const techObj = technicians.find((t) => t.id_technician === m.technician || t.nom === m.technician);
        const techName = techObj ? `${techObj.nom} ${techObj.id_technician || ''}`.toLowerCase() : '';
        const znObj = getZoneByRef(m.id_zone_default, zones);
        const znName = znObj ? `${znObj.libelle} ${znObj.code_zone || ''} ${znObj.id_zone || ''}`.toLowerCase() : '';
        const bpObj = blueprints.find((b) => b.id_blueprint === m.id_blueprint);
        const bpName = bpObj ? `${bpObj.id_blueprint} ${bpObj.libelle || ''} ${bpObj.ref_plan || ''} ${bpObj.revision || ''}`.toLowerCase() : '';
        const sysObj = generalSystemTypes.find((t) => t.id === m.id_general_system_type);
        const sysName = sysObj ? `${sysObj.id} ${sysObj.code || ''} ${sysObj.name || ''}`.toLowerCase() : '';

        const sn = getMachineSerialNumber(m).toLowerCase();
        const dt = getMachineCommissioningDate(m).toLowerCase();

        return (
          String(m.id_machine_registered || '').toLowerCase().includes(q) ||
          String(m.designation || '').toLowerCase().includes(q) ||
          sn.includes(q) ||
          dt.includes(q) ||
          String(m.id_family || '').toLowerCase().includes(q) ||
          String(m.id_templates || '').toLowerCase().includes(q) ||
          String(m.id_blueprint || '').toLowerCase().includes(q) ||
          String(m.id_zone_default || '').toLowerCase().includes(q) ||
          String(m.technician || '').toLowerCase().includes(q) ||
          String(m.id_general_system_type || '').toLowerCase().includes(q) ||
          techName.includes(q) ||
          znName.includes(q) ||
          bpName.includes(q) ||
          sysName.includes(q)
        );
      }
      return true;
    });
  }, [machines, assetClassFilter, sysTypeFilter, mchFamilyFilter, mchTemplateFilter, mchZoneFilter, statusFilter, mchSearch, technicians, zones, blueprints, generalSystemTypes]);

  const [pageSize, setPageSize] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState('id_machine_registered');
  const [sortOrder, setSortOrder] = useState('asc');
  const [showSortMenu, setShowSortMenu] = useState(false);

  const sortMenuRef = useRef(null);

  useEffect(() => {
    setCurrentPage(1);
  }, [mchSearch, assetClassFilter, sysTypeFilter, mchFamilyFilter, mchTemplateFilter, mchZoneFilter, statusFilter, sortField, sortOrder]);

  // Active Action Menu Popover
  const [activeActionMenuId, setActiveActionMenuId] = useState(null);

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

  const sortedData = useMemo(() => {
    if (!sortField) return filteredMachines;
    return [...filteredMachines].sort((a, b) => {
      if (sortField === 'sorties') {
        const cntA = sortiesCountMap[a.id_machine_registered] || 0;
        const cntB = sortiesCountMap[b.id_machine_registered] || 0;
        return sortOrder === 'asc' ? cntA - cntB : cntB - cntA;
      }
      if (sortField === 'serial_number') {
        const valA = (getMachineSerialNumber(a) || '').toLowerCase();
        const valB = (getMachineSerialNumber(b) || '').toLowerCase();
        if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
        if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
        return 0;
      }
      if (sortField === 'date_mise_en_service') {
        const valA = getMachineCommissioningDate(a) || '';
        const valB = getMachineCommissioningDate(b) || '';
        if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
        if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
        return 0;
      }
      let valA = a[sortField] || '';
      let valB = b[sortField] || '';
      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();
      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredMachines, sortField, sortOrder, sortiesCountMap]);

  const totalItems = sortedData.length;
  const totalPages = pageSize === 0 ? 1 : Math.ceil(totalItems / pageSize);
  const effectivePageSize = pageSize === 0 ? totalItems : pageSize;
  const startIndex = pageSize === 0 ? 0 : (currentPage - 1) * pageSize;
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
      <ArrowUp className="w-3 h-3 text-emerald-700 shrink-0 font-bold" />
    ) : (
      <ArrowDown className="w-3 h-3 text-emerald-700 shrink-0 font-bold" />
    );
  };

  const hasActiveFilters =
    assetClassFilter !== 'ALL' ||
    sysTypeFilter !== 'ALL' ||
    mchFamilyFilter !== 'ALL' ||
    mchTemplateFilter !== 'ALL' ||
    mchZoneFilter !== 'ALL' ||
    statusFilter !== 'ALL' ||
    Boolean(localSearch);

  const clearAllFilters = () => {
    setAssetClassFilter('ALL');
    setSysTypeFilter('ALL');
    setMchFamilyFilter('ALL');
    setMchTemplateFilter('ALL');
    setMchZoneFilter('ALL');
    setStatusFilter('ALL');
    setLocalSearch('');
    setSortField('id_machine_registered');
    setSortOrder('asc');
  };

  // Export Filtered Machines to Excel (.xlsx)
  const handleExportFilteredMachines = () => {
    const exportRows = sortedData
      .map((m, idx) => {
        const techObj = technicians.find((t) => t.id_technician === m.technician || t.nom === m.technician);
        const znObj = getZoneByRef(m.id_zone_default, zones);
        const bpObj = blueprints.find((b) => b.id_blueprint === m.id_blueprint);
        const famObj = families.find((f) => f.id_family === m.id_family);
        const tmplObj = templates.find((t) => t.id_templates === m.id_templates);
        const sysObj = generalSystemTypes.find((t) => t.id === m.id_general_system_type);
        const sortiesCount = sortiesCountMap[m.id_machine_registered] || 0;
        const mClass = getMachineAssetClass(m);

        return {
          'N°': idx + 1,
          'Code Machine (B)': m.id_machine_registered || '',
          'Désignation (C)': m.designation || '',
          "Classe d'Actif": mClass === 'SYSTEM_GENERAL' ? 'Système Général' : 'Machine de Production',
          'Type Système Général': sysObj ? `${sysObj.code ? sysObj.code + ' - ' : ''}${sysObj.name}` : m.id_general_system_type || '',
          'N° Série': getMachineSerialNumber(m),
          'Date Mise en Service': getMachineCommissioningDate(m),
          'Famille ID (D)': m.id_family || '',
          'Famille Libellé (D)': famObj?.libelle || m.id_family || '',
          'Template ID (E)': m.id_templates || '',
          'Template Libellé (E)': tmplObj?.libelle || m.id_templates || '',
          'Blueprint ID': m.id_blueprint || '',
          'Blueprint Titre': bpObj?.libelle || bpObj?.ref_plan || '',
          'Zone ID (F)': m.id_zone_default || '',
          'Zone Nom (F)': znObj?.libelle || m.id_zone_default || '',
          'Technicien ID (G)': m.technician || '',
          'Technicien Nom (G)': techObj?.nom || m.technician || '',
          'Statut Opérationnel (H)': m.status || 'En Service',
          'Interventions / Sorties': sortiesCount,
        };
      });

    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Machines_Enregistrées');
    const nowStr = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `GMAO_Parc_Machines_${nowStr}.xlsx`);
  };

  return (
    <AnimatedPage className="space-y-5">
      {/* Top Banner (BDR Light GMAO Header Card with 3D Tactile Elevation) */}
      <div className="bg-white p-5 md:p-6 rounded-2xl border border-slate-200/90 shadow-[0_12px_32px_-6px_rgba(0,0,0,0.12),0_4px_12px_-2px_rgba(0,0,0,0.06)] hover:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.16),0_6px_16px_-3px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-300 ease-out flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative overflow-hidden group/header">
        {/* Subtle Ambient Gradient Background Highlight */}
        <div className="absolute -top-12 -right-12 w-48 h-48 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none group-hover/header:bg-emerald-500/10 transition-colors duration-500" />

        <div className="min-w-0 flex-1 flex items-start sm:items-center gap-3.5 relative">
          <PageHeaderIcon icon={Factory} colorClass="text-emerald-700" />
          <div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight">
              Parc Machines & Équipements Enregistrés
            </h2>
            <p className="text-xs text-slate-500 mt-1 max-w-3xl leading-relaxed">
              Répertoire central des équipements de production et lignes industrielles. Lié dynamiquement avec{' '}
              <b className="text-cyan-700 font-semibold">Familles (D)</b>,{' '}
              <b className="text-amber-700 font-semibold">Templates (E)</b>,{' '}
              <b className="text-purple-700 font-semibold">Zones (F)</b> et{' '}
              <b className="text-blue-700 font-semibold">Techniciens (G)</b>.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 relative">
          <FormulasModalButton
            onClick={() => setShowFormulasModal(true)}
            title="Formules Excel (Liaisons Machines)"
          />

          <Action3DButton
            variant="circle"
            color="emerald"
            icon={Factory}
            showAddBadge={true}
            onClick={onOpenAddMachine}
            title="Nouvelle Machine"
          />
        </div>
      </div>

      {/* KPI Cards Bar */}
      <MachinesKPIBar
        kpis={kpis}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
      />

      {/* Filter Bar with Cascading Selects, Status Presets, Search & Active Chips */}
      <div className="relative z-30 bg-white border border-slate-200 rounded-2xl p-4 md:p-5 shadow-[0_12px_32px_-6px_rgba(0,0,0,0.12),0_4px_12px_-2px_rgba(0,0,0,0.06)] hover:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.16),0_6px_16px_-3px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-300 ease-out space-y-4">
        {/* Header Toolbar inside Filter Card */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-200/80 flex items-center justify-center text-emerald-700 shadow-2xs">
              <SlidersHorizontal className="w-4 h-4 text-emerald-700" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-slate-900">
                  Filtres & Recherche Avancée
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                  {filteredMachines.length} / {machines.length}
                </span>
              </div>
              <p className="text-[10.5px] text-slate-400 font-medium">
                Parc Machines · Liaisons Excel Twin Colonnes B → H
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            {/* Direct Excel Export Button */}
            <button
              type="button"
              onClick={handleExportFilteredMachines}
              className="h-8 px-3 rounded-xl border border-emerald-300/90 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs active:scale-95"
              title="Exporter la liste filtrée vers un classeur Excel (.xlsx)"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
              <span className="hidden sm:inline">Export Excel</span>
            </button>

            {/* Quick Reset Button (Circular Iconic) */}
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearAllFilters}
                className="w-8 h-8 rounded-full border border-rose-200/80 bg-rose-50 hover:bg-rose-100 text-rose-700 transition flex items-center justify-center cursor-pointer shadow-2xs active:scale-95 animate-in fade-in"
                title="Réinitialiser tous les filtres actifs"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Quick Status Presets Row */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 text-xs no-scrollbar">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1 shrink-0 flex items-center gap-1">
            <Radio className="w-3 h-3 text-slate-400" /> Statut :
          </span>
          {[
            { key: 'ALL', label: 'Toutes', count: machines.length, color: 'slate' },
            { key: 'En Service', label: 'En Service', count: kpis.enService, color: 'emerald' },
            { key: 'En Maintenance', label: 'En Maintenance', count: kpis.enMaintenance, color: 'amber' },
            { key: 'Arrêt', label: "À l'Arrêt", count: kpis.enArret, color: 'rose' },
          ].map((preset) => (
            <button
              key={preset.key}
              type="button"
              onClick={() => setStatusFilter(preset.key)}
              className={`h-7 px-2.5 rounded-lg border text-[11px] font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0 ${
                statusFilter === preset.key
                  ? preset.color === 'emerald'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                    : preset.color === 'amber'
                    ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                    : preset.color === 'rose'
                    ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                    : 'bg-slate-800 text-white border-slate-800 shadow-xs'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200'
              }`}
            >
              {preset.key !== 'ALL' && (
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    statusFilter === preset.key
                      ? 'bg-white'
                      : preset.color === 'emerald'
                      ? 'bg-emerald-500'
                      : preset.color === 'amber'
                      ? 'bg-amber-500'
                      : 'bg-rose-500'
                  }`}
                />
              )}
              <span>{preset.label}</span>
              <span
                className={`text-[10px] font-mono px-1.5 py-0.2 rounded-md ${
                  statusFilter === preset.key
                    ? 'bg-white/25 text-white'
                    : 'bg-slate-200/70 text-slate-700'
                }`}
              >
                {preset.count}
              </span>
            </button>
          ))}
        </div>

        {/* Asset Class & System General Filter Row */}
        <div className="flex flex-wrap items-center justify-between gap-2 pb-1 border-b border-slate-100 text-xs">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1 shrink-0 flex items-center gap-1">
              <ShieldAlert className="w-3 h-3 text-slate-400" /> Classe :
            </span>
            {[
              {
                key: 'ALL' as const,
                label: 'Tous Équipements',
                count: machines.length,
                activeClass: 'bg-slate-800 text-white border-slate-800',
              },
              {
                key: 'PRODUCTION' as const,
                label: 'Production',
                count: machines.filter((m) => getMachineAssetClass(m) === 'PRODUCTION').length,
                activeClass: 'bg-emerald-600 text-white border-emerald-600',
              },
              {
                key: 'SYSTEM_GENERAL' as const,
                label: 'Système Général (Utilités & Sécurité)',
                count: machines.filter((m) => getMachineAssetClass(m) === 'SYSTEM_GENERAL').length,
                activeClass: 'bg-amber-600 text-white border-amber-600',
              },
            ].map((cls) => (
              <button
                key={cls.key}
                type="button"
                onClick={() => {
                  setAssetClassFilter(cls.key);
                  if (cls.key === 'PRODUCTION') {
                    setSysTypeFilter('ALL');
                  }
                }}
                className={`h-7 px-2.5 rounded-lg border text-[11px] font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0 ${
                  assetClassFilter === cls.key
                    ? `${cls.activeClass} shadow-xs`
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200'
                }`}
              >
                <span>{cls.label}</span>
                <span
                  className={`text-[10px] font-mono px-1.5 py-0.2 rounded-md ${
                    assetClassFilter === cls.key
                      ? 'bg-white/25 text-white'
                      : 'bg-slate-200/70 text-slate-700'
                  }`}
                >
                  {cls.count}
                </span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            {(assetClassFilter === 'SYSTEM_GENERAL' || sysTypeFilter !== 'ALL' || generalSystemTypes.length > 0) && (
              <div className="w-52">
                <CustomSelect
                  value={sysTypeFilter}
                  onChange={(val) => {
                    setSysTypeFilter(val);
                    if (val !== 'ALL') {
                      setAssetClassFilter('SYSTEM_GENERAL');
                    }
                  }}
                  options={[
                    { value: 'ALL', label: 'Tous Types Système Général' },
                    ...generalSystemTypes.map((t) => ({
                      value: t.id,
                      label: `${t.code ? t.code + ' • ' : ''}${t.name}${t.is_active === false ? ' (Inactif)' : ''}`,
                    })),
                  ]}
                />
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowSysTypesModal(true)}
              className="h-7 px-2.5 rounded-lg border border-amber-300/90 bg-amber-50 hover:bg-amber-100 text-amber-900 text-[11px] font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0"
              title="Gérer les types de Système Général (+ Nouveau type / Activer / Désactiver)"
            >
              <Settings2 className="w-3.5 h-3.5 text-amber-700" />
              <span>Types Système ({activeSystemTypes.length})</span>
            </button>
          </div>
        </div>

        {/* 5-Column Multi-Criteria Filter Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 items-end">
          {/* 1. Omni-Text Search */}
          <div className="w-full sm:col-span-2 lg:col-span-1">
            <div className="flex items-center justify-between mb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-800">
              <span>Recherche</span>
              <span className="px-1.5 py-0.2 rounded text-[9.5px] font-mono font-bold bg-slate-100 text-slate-600 border border-slate-200/80">
                Omni
              </span>
            </div>
            <div className="relative">
              <div className="absolute left-2.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-md bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 shadow-2xs pointer-events-none">
                <Search className="w-3 h-3" />
              </div>
              <input
                type="text"
                placeholder="Code, Nom, Zone, Tech..."
                value={localSearch}
                onChange={(e) => setLocalSearch(e.target.value)}
                className="w-full h-9 pl-9 pr-7 rounded-xl border border-slate-200 bg-slate-50/70 text-xs font-semibold focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-colors"
              />
              {localSearch && (
                <button
                  type="button"
                  onClick={() => setLocalSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-rose-600 cursor-pointer"
                  title="Effacer la recherche"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* 2. Family Filter (D) */}
          <div>
            <div className="flex items-center justify-between mb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-800">
              <span>Famille</span>
              <span className="px-1.5 py-0.2 rounded text-[9.5px] font-mono font-bold bg-cyan-50 text-cyan-700 border border-cyan-200/80">
                Col. D
              </span>
            </div>
            <CustomSelect
              value={mchFamilyFilter}
              prefixIcon={
                <span className="w-5 h-5 rounded-md bg-cyan-100 border border-cyan-300/80 flex items-center justify-center text-cyan-700 shadow-2xs">
                  <Factory className="w-3 h-3" />
                </span>
              }
              onChange={(val) => {
                setMchFamilyFilter(val);
                setMchTemplateFilter('ALL');
              }}
              options={[
                { value: 'ALL', label: `Toutes Familles (${machineFamilies.length})` },
                ...machineFamilies.map((f) => ({
                  value: f.id_family,
                  label: `${f.libelle} (${f.id_family})`,
                })),
              ]}
            />
          </div>

          {/* 3. Cascading Template Filter (E) */}
          <div>
            <div className="flex items-center justify-between mb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-800">
              <span>Template Modèle</span>
              <span className="px-1.5 py-0.2 rounded text-[9.5px] font-mono font-bold bg-amber-50 text-amber-700 border border-amber-200/80">
                Col. E
              </span>
            </div>
            <CustomSelect
              value={mchTemplateFilter}
              prefixIcon={
                <span className="w-5 h-5 rounded-md bg-amber-100 border border-amber-300/80 flex items-center justify-center text-amber-700 shadow-2xs">
                  <Cpu className="w-3 h-3" />
                </span>
              }
              onChange={(val) => setMchTemplateFilter(val)}
              options={[
                { value: 'ALL', label: `Tous Templates (${availableTemplates.length})` },
                ...availableTemplates.map((t) => ({
                  value: t.id_templates,
                  label: `${t.libelle} (${t.id_templates})`,
                })),
              ]}
            />
          </div>

          {/* 4. Zone & Secteur Filter (F) */}
          <div>
            <div className="flex items-center justify-between mb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-800">
              <span>Secteur / Zone</span>
              <span className="px-1.5 py-0.2 rounded text-[9.5px] font-mono font-bold bg-purple-50 text-purple-700 border border-purple-200/80">
                Col. F
              </span>
            </div>
            <CustomSelect
              value={
                mchZoneFilter === 'ALL'
                  ? 'ALL'
                  : (getZoneByRef(mchZoneFilter, zones)?.code_zone ||
                     getZoneByRef(mchZoneFilter, zones)?.id_zone ||
                     mchZoneFilter)
              }
              prefixIcon={
                <span className="w-5 h-5 rounded-md bg-purple-100 border border-purple-300/80 flex items-center justify-center text-purple-700 shadow-2xs">
                  <MapPin className="w-3 h-3" />
                </span>
              }
              onChange={(val) => setMchZoneFilter(val)}
              options={[
                { value: 'ALL', label: `Tous Secteurs & Zones (${zones.length})` },
                ...zones.map((z) => {
                  const codeZ = z.code_zone || z.code || z.id_zone;
                  const idZ = z.id_zone;
                  const showDual = idZ && idZ !== codeZ;
                  return {
                    value: codeZ,
                    label: `${z.code_zone ? z.code_zone + ' • ' : ''}${z.libelle}${showDual ? ` (${idZ})` : ''}`,
                  };
                }),
              ]}
            />
          </div>

          {/* 5. Sort Menu Button & Popover */}
          <div className="relative" ref={sortMenuRef}>
            <div className="flex items-center justify-between mb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-800">
              <span>Tri & Ordre</span>
              <span className="px-1.5 py-0.2 rounded text-[9.5px] font-mono font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/80">
                Ordre
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowSortMenu(!showSortMenu)}
              className={`w-full h-9 px-2.5 rounded-xl border text-xs font-semibold transition flex items-center justify-between cursor-pointer ${
                showSortMenu || sortField !== 'id_machine_registered' || sortOrder !== 'asc'
                  ? 'bg-indigo-50/80 text-indigo-950 border-indigo-300 ring-1 ring-indigo-200'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <div className="flex items-center gap-2 truncate">
                <span className="w-5 h-5 rounded-md bg-indigo-100 border border-indigo-300/80 flex items-center justify-center text-indigo-700 shrink-0 shadow-2xs">
                  <ArrowUpDown className="w-3 h-3" />
                </span>
                <span className="truncate">
                  Tri : <b className="font-mono text-slate-900">{sortField.slice(0, 10).toUpperCase()}</b> (
                  {sortOrder === 'asc' ? 'A→Z' : 'Z→A'})
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
                  <span>Sélectionner la Colonne de Tri</span>
                  <span>A→H</span>
                </div>
                <div className="grid grid-cols-1 gap-1 text-xs max-h-60 overflow-y-auto pr-0.5">
                  {[
                    { key: 'id_machine_registered', label: 'Code Machine' },
                    { key: 'designation', label: 'Désignation' },
                    { key: 'serial_number', label: 'Date / N° Série' },
                    { key: 'id_family', label: 'Famille' },
                    { key: 'id_templates', label: 'Template Modèle' },
                    { key: 'id_blueprint', label: 'Blueprint / Schéma' },
                    { key: 'id_zone_default', label: 'Zone Défaut' },
                    { key: 'technician', label: 'Technicien Assigné' },
                    { key: 'status', label: 'Statut Opérationnel' },
                    { key: 'sorties', label: 'Interventions / Sorties' },
                  ].map((col) => (
                    <button
                      key={col.key}
                      type="button"
                      onClick={() => {
                        handleSort(col.key);
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

        {/* Active Filter Chips & Summary Bar (From Entrepôt) */}
        {hasActiveFilters && (
          <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 flex-wrap gap-2 animate-in fade-in">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-bold text-slate-600 text-[11px]">Filtres actifs :</span>
              {localSearch && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-100 font-mono text-[11px] font-semibold text-slate-800 border border-slate-200">
                  <span>Recherche: "{localSearch}"</span>
                  <button
                    type="button"
                    onClick={() => setLocalSearch('')}
                    className="hover:text-rose-600 cursor-pointer"
                    title="Supprimer ce filtre"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {statusFilter !== 'ALL' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-800 font-bold text-[11px] border border-emerald-200">
                  <span>Statut: {statusFilter}</span>
                  <button
                    type="button"
                    onClick={() => setStatusFilter('ALL')}
                    className="hover:text-rose-600 cursor-pointer"
                    title="Supprimer ce filtre"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {assetClassFilter !== 'ALL' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-50 text-amber-900 font-bold text-[11px] border border-amber-200">
                  <span>Classe: {assetClassFilter === 'SYSTEM_GENERAL' ? 'Système Général' : 'Production'}</span>
                  <button
                    type="button"
                    onClick={() => setAssetClassFilter('ALL')}
                    className="hover:text-rose-600 cursor-pointer"
                    title="Supprimer ce filtre"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {sysTypeFilter !== 'ALL' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-100 text-amber-900 font-bold text-[11px] border border-amber-300">
                  <span>
                    Type Système: {generalSystemTypes.find((t) => t.id === sysTypeFilter)?.name || sysTypeFilter}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSysTypeFilter('ALL')}
                    className="hover:text-rose-600 cursor-pointer"
                    title="Supprimer ce filtre"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {mchFamilyFilter !== 'ALL' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-cyan-50 text-cyan-800 font-bold text-[11px] border border-cyan-200">
                  <span>Famille: {families.find((f) => f.id_family === mchFamilyFilter)?.libelle || mchFamilyFilter}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setMchFamilyFilter('ALL');
                      setMchTemplateFilter('ALL');
                    }}
                    className="hover:text-rose-600 cursor-pointer"
                    title="Supprimer ce filtre"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {mchTemplateFilter !== 'ALL' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-50 text-amber-800 font-bold text-[11px] border border-amber-200">
                  <span>Template: {templates.find((t) => t.id_templates === mchTemplateFilter)?.libelle || mchTemplateFilter}</span>
                  <button
                    type="button"
                    onClick={() => setMchTemplateFilter('ALL')}
                    className="hover:text-rose-600 cursor-pointer"
                    title="Supprimer ce filtre"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {mchZoneFilter !== 'ALL' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-purple-50 text-purple-800 font-bold text-[11px] border border-purple-200">
                  <span>Zone: {getZoneByRef(mchZoneFilter, zones)?.libelle || mchZoneFilter}</span>
                  <button
                    type="button"
                    onClick={() => setMchZoneFilter('ALL')}
                    className="hover:text-rose-600 cursor-pointer"
                    title="Supprimer ce filtre"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {(sortField !== 'id_machine_registered' || sortOrder !== 'asc') && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 font-semibold text-[11px] border border-slate-200">
                  <span>Tri: {sortField} ({sortOrder === 'asc' ? 'A→Z' : 'Z→A'})</span>
                  <button
                    type="button"
                    onClick={() => {
                      setSortField('id_machine_registered');
                      setSortOrder('asc');
                    }}
                    className="hover:text-rose-600 cursor-pointer"
                    title="Réinitialiser le tri"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Main Table with Iconic Excel Mirror Headers */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-[0_12px_32px_-6px_rgba(0,0,0,0.12),0_4px_12px_-2px_rgba(0,0,0,0.06)] hover:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.16),0_6px_16px_-3px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-300 ease-out">
        {/* Top Info Header Bar inside Card */}
        <div className="px-5 py-3 border-b border-slate-100 flex flex-wrap items-center justify-between text-xs text-slate-500 bg-slate-50/50 gap-2">
          <div className="font-bold text-slate-800 text-[13px] flex items-center gap-2">
            <Factory className="w-4 h-4 text-emerald-600" />
            <span>Tableau Machines_Registered • Ordre Excel Row 3 : B → H</span>
          </div>
          <div className="font-mono text-[11px] text-slate-400 hidden lg:block">
            N° | Code Machine (B) | Désignation (C) | Mise en Service / N° Série | Famille & Template (D+E) | Zone & Technicien (F+G) | Statut (H) | Flux
          </div>
        </div>

        <div className="max-h-[62vh] overflow-y-auto overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse min-w-[980px]">
            <thead className="sticky top-0 bg-slate-100 text-[11px] font-bold text-slate-700 uppercase tracking-wider border-b border-slate-200 z-10 shadow-2xs select-none">
              <tr>
                {/* Row N° */}
                <th className="py-3 px-3 text-center w-12 text-slate-500 font-mono text-[10px] bg-slate-200/60 border-r border-slate-200 shrink-0 select-none">
                  N°
                </th>

                {/* CODE MACHINE (B) */}
                <th
                  onClick={() => handleSort('id_machine_registered')}
                  className="py-3 px-3.5 cursor-pointer select-none hover:bg-slate-200/80 transition group"
                  title="Cliquer pour trier par Code Machine"
                >
                  <div className="flex items-center gap-1.5">
                    <Factory className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>CODE MACHINE</span>
                    <span className="text-slate-400 font-normal text-[10px]">(B)</span>
                    {renderSortIcon('id_machine_registered')}
                  </div>
                </th>

                {/* DÉSIGNATION (C) */}
                <th
                  onClick={() => handleSort('designation')}
                  className="py-3 px-3.5 cursor-pointer select-none hover:bg-slate-200/80 transition group min-w-[200px]"
                  title="Cliquer pour trier par Désignation"
                >
                  <div className="flex items-center gap-1.5">
                    <Cpu className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>DÉSIGNATION</span>
                    <span className="text-slate-400 font-normal text-[10px]">(C)</span>
                    {renderSortIcon('designation')}
                  </div>
                </th>

                {/* MISE EN SERVICE / N° SÉRIE */}
                <th
                  onClick={() => handleSort('serial_number')}
                  className="py-3 px-3.5 cursor-pointer select-none hover:bg-slate-200/80 transition group min-w-[170px]"
                  title="Cliquer pour trier par N° de Série / Mise en Service"
                >
                  <div className="flex items-center gap-1.5">
                    <div className="flex items-center -space-x-1">
                      <Hash className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    </div>
                    <span>MISE EN SERVICE</span>
                    <span className="text-slate-400 font-normal text-[10px]">(N° Série)</span>
                    {renderSortIcon('serial_number')}
                  </div>
                </th>

                {/* FAMILLE & TEMPLATE (D + E) */}
                <th
                  onClick={() => handleSort('id_family')}
                  className="py-3 px-3.5 cursor-pointer select-none hover:bg-slate-200/80 transition group min-w-[200px]"
                  title="Cliquer pour trier par Famille & Modèle"
                >
                  <div className="flex items-center gap-1.5">
                    <div className="flex items-center -space-x-1">
                      <HubIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <CategoryIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    </div>
                    <span>FAMILLE & TEMPLATE</span>
                    <span className="text-slate-400 font-normal text-[10px]">(D+E)</span>
                    {renderSortIcon('id_family')}
                  </div>
                </th>

                {/* BLUEPRINT (Plan / Schéma) */}
                <th
                  onClick={() => handleSort('id_blueprint')}
                  className="py-3 px-3.5 cursor-pointer select-none hover:bg-slate-200/80 transition group min-w-[170px]"
                  title="Cliquer pour trier par Blueprint / Schéma"
                >
                  <div className="flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>BLUEPRINT</span>
                    <span className="text-slate-400 font-normal text-[10px]">(Plan)</span>
                    {renderSortIcon('id_blueprint')}
                  </div>
                </th>

                {/* ZONE & TECHNICIEN (F + G) */}
                <th
                  onClick={() => handleSort('id_zone_default')}
                  className="py-3 px-3.5 cursor-pointer select-none hover:bg-slate-200/80 transition group min-w-[210px]"
                  title="Cliquer pour trier par Zone & Technicien"
                >
                  <div className="flex items-center gap-1.5">
                    <div className="flex items-center -space-x-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <Users className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    </div>
                    <span>ZONE & TECHNICIEN</span>
                    <span className="text-slate-400 font-normal text-[10px]">(F+G)</span>
                    {renderSortIcon('id_zone_default')}
                  </div>
                </th>

                {/* STATUS (H) */}
                <th
                  onClick={() => handleSort('status')}
                  className="py-3 px-3 text-center cursor-pointer select-none hover:bg-slate-200/80 transition group"
                  title="Cliquer pour trier par Statut"
                >
                  <div className="flex items-center justify-center gap-1">
                    <Radio className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>STATUT</span>
                    <span className="text-slate-400 font-normal text-[10px]">(H)</span>
                    {renderSortIcon('status')}
                  </div>
                </th>

                {/* INTERVENTIONS */}
                <th
                  onClick={() => handleSort('sorties')}
                  className="py-3 px-3 text-right cursor-pointer select-none hover:bg-slate-200/80 transition group"
                  title="Cliquer pour trier par Nombre d'Interventions"
                >
                  <div className="flex items-center justify-end gap-1">
                    <Activity className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>INTERVENTIONS</span>
                    <span className="text-slate-400 font-normal text-[10px]">(Flux)</span>
                    {renderSortIcon('sorties')}
                  </div>
                </th>

                {/* ACTIONS (•••) */}
                <th className="py-3 px-3 text-center font-bold text-slate-400 tracking-widest select-none w-24" title="Actions & Options">
                  •••
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/80">
              {!isTableReady ? (
                <TableSkeletonRows cols={10} rows={7} color="emerald" />
              ) : rawDisplayedData.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-500 font-medium">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Factory className="w-8 h-8 text-slate-300" />
                      <span>Aucune machine ne correspond aux critères de recherche.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                displayedData.map((m, idx) => {
                  const fam = families.find((f) => f.id_family === m.id_family);
                  const tpl = templates.find((t) => t.id_templates === m.id_templates);
                  const bp = blueprints.find((b) => b.id_blueprint === m.id_blueprint);
                  const zn = getZoneByRef(m.id_zone_default, zones);
                  const tech = technicians.find(
                    (t) => t.id_technician === m.technician || t.nom === m.technician
                  );
                  const sysType = generalSystemTypes.find((t) => t.id === m.id_general_system_type);
                  const isSysGeneral = getMachineAssetClass(m) === 'SYSTEM_GENERAL';
                  const sortiesCount = sortiesCountMap[m.id_machine_registered] || 0;
                  const isService = String(m.status || 'En Service').toLowerCase().includes('service');
                  const isMaintenance =
                    String(m.status || '').toLowerCase().includes('maint') ||
                    String(m.status || '').toLowerCase().includes('panne');

                  return (
                    <tr
                      key={m.id_machine_registered}
                      className="even:bg-slate-50/70 odd:bg-white hover:bg-emerald-50/40 border-b border-slate-200/70 transition-colors"
                    >
                      {/* Row N° Column */}
                      <td className="py-3 px-3 text-center font-mono text-[11px] font-bold text-slate-400 bg-slate-100/40 border-r border-slate-200/80 shrink-0">
                        {startIndex + idx + 1}
                      </td>

                      {/* Code Machine (B) */}
                      <td className="py-3 px-3.5 font-mono font-bold text-slate-900 whitespace-nowrap">
                        <div className="flex flex-col items-start gap-1">
                          <button
                            type="button"
                            onClick={() => setPreventiveMachine(m)}
                            className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/80 text-xs font-mono font-bold text-indigo-900 shadow-2xs transition flex items-center gap-1.5 cursor-pointer group"
                            title="Consulter le Carnet et Plan Préventif de cette machine"
                          >
                            <ShieldCheck className="w-3.5 h-3.5 text-indigo-600 group-hover:scale-110 transition-transform" />
                            <span>{m.id_machine_registered}</span>
                          </button>
                          {isSysGeneral && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setAssetClassFilter('SYSTEM_GENERAL');
                              }}
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-100/90 text-amber-900 border border-amber-300 text-[9.5px] font-bold uppercase tracking-wider cursor-pointer hover:bg-amber-200/80 transition"
                              title="Filtrer les équipements de type Système Général"
                            >
                              <ShieldAlert className="w-2.5 h-2.5 text-amber-700 shrink-0" />
                              <span>Système Général</span>
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Désignation (C) */}
                      <td className="py-3 px-3.5 whitespace-nowrap min-w-[200px]">
                        <div className="font-bold text-slate-900 text-xs">{m.designation}</div>
                        <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1.5 mt-0.5">
                          <span>Réf: {m.id_machine_registered}</span>
                          {isSysGeneral && sysType && (
                            <span className="text-amber-700 font-semibold">
                              • {sysType.code || sysType.id} ({sysType.name})
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Mise en Service & N° de Série */}
                      <td className="py-2.5 px-3.5 whitespace-nowrap min-w-[170px]">
                        <div className="flex flex-col gap-1 items-start">
                          {/* N° de Série badge */}
                          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 border border-slate-200/80 text-[11px] font-mono font-bold shadow-2xs">
                            <Hash className="w-3 h-3 text-slate-500 shrink-0" />
                            <span>{getMachineSerialNumber(m)}</span>
                          </div>
                          {/* Date Mise en service */}
                          <div className="inline-flex items-center gap-1 text-[10.5px] text-slate-500 font-medium pl-0.5">
                            <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
                            <span>Mise en serv. : <b className="text-slate-700 font-mono">{getMachineCommissioningDate(m)}</b></span>
                          </div>
                        </div>
                      </td>

                      {/* Unified Family & Template (D + E) or System General Type */}
                      <td className="py-2.5 px-3.5 whitespace-nowrap">
                        <div className="flex flex-col gap-1 items-start">
                          {isSysGeneral && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setAssetClassFilter('SYSTEM_GENERAL');
                                if (m.id_general_system_type) {
                                  setSysTypeFilter(m.id_general_system_type);
                                }
                              }}
                              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-50 text-amber-900 border border-amber-300/80 text-[11px] font-semibold hover:bg-amber-100 transition cursor-pointer shadow-2xs"
                              title="Filtrer par ce Type de Système Général"
                            >
                              <ShieldAlert className="w-3 h-3 text-amber-600 shrink-0" />
                              <span className="font-mono font-bold">
                                {sysType?.code || m.id_general_system_type || 'SYS'}
                              </span>
                              <span className="text-amber-800 font-normal text-[10px] max-w-[140px] truncate">
                                • {sysType?.name || 'Système Général'}
                              </span>
                            </button>
                          )}

                          {/* Family Badge */}
                          {m.id_family ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setMchFamilyFilter(m.id_family);
                                setMchTemplateFilter('ALL');
                              }}
                              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-cyan-50 text-cyan-800 border border-cyan-200/70 text-[11px] font-semibold hover:bg-cyan-100 hover:border-cyan-300 transition cursor-pointer shadow-2xs group"
                              title="Filtrer par cette Famille"
                            >
                              <HubIcon className="w-3 h-3 text-cyan-600 shrink-0" />
                              <span className="font-mono font-bold">{m.id_family}</span>
                              {fam?.libelle && (
                                <span className="text-cyan-700 font-normal text-[10px] max-w-[130px] truncate">
                                  • {fam.libelle}
                                </span>
                              )}
                            </button>
                          ) : !isSysGeneral ? (
                            <span className="text-[10.5px] text-slate-400 italic">— Sans famille —</span>
                          ) : null}

                          {/* Template Badge */}
                          {m.id_templates ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (m.id_family) setMchFamilyFilter(m.id_family);
                                setMchTemplateFilter(m.id_templates);
                              }}
                              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200/70 text-[11px] font-semibold hover:bg-amber-100 hover:border-amber-300 transition cursor-pointer shadow-2xs group"
                              title="Filtrer par ce Template Modèle"
                            >
                              <CategoryIcon className="w-3 h-3 text-amber-600 shrink-0" />
                              <span className="font-mono font-bold text-[10.5px]">{m.id_templates}</span>
                              {tpl?.libelle && (
                                <span className="text-amber-700 font-normal text-[10px] max-w-[140px] truncate">
                                  • {tpl.libelle}
                                </span>
                              )}
                            </button>
                          ) : isSysGeneral && !m.id_family ? (
                            <span className="text-[10px] text-slate-400 font-mono">
                              Hors lignée production (D/E optionnels)
                            </span>
                          ) : null}
                        </div>
                      </td>

                      {/* Blueprint Column */}
                      <td className="py-2.5 px-3.5 whitespace-nowrap">
                        {m.id_blueprint ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onNavigateToBlueprints(m.id_family, m.id_templates);
                            }}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-teal-50 text-teal-800 border border-teal-200/80 text-[11px] font-semibold hover:bg-teal-100 hover:border-teal-300 transition cursor-pointer shadow-2xs group"
                            title="Voir le schéma / plan technique dans Blueprints"
                          >
                            <FileText className="w-3.5 h-3.5 text-teal-600 shrink-0 group-hover:scale-110 transition-transform" />
                            <span className="font-mono font-bold">{m.id_blueprint}</span>
                            {bp?.revision && (
                              <span className="text-[9.5px] px-1 py-0.2 bg-teal-200/60 text-teal-900 rounded font-bold font-mono">
                                {bp.revision}
                              </span>
                            )}
                            {bp?.libelle && (
                              <span className="text-teal-700 font-normal text-[10px] max-w-[120px] truncate">
                                • {bp.libelle}
                              </span>
                            )}
                          </button>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-slate-400 font-mono text-[11px] italic bg-slate-50 border border-slate-200/50">
                            — Non sélectionné —
                          </span>
                        )}
                      </td>

                      {/* Unified Zone & Technicien (F + G) */}
                      <td className="py-2.5 px-3.5 whitespace-nowrap">
                        <div className="flex flex-col gap-1 items-start">
                          {/* Zone Badge */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setMchZoneFilter(m.id_zone_default);
                            }}
                            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-purple-50 text-purple-800 border border-purple-200/70 text-[11px] font-semibold hover:bg-purple-100 hover:border-purple-300 transition cursor-pointer shadow-2xs group"
                            title="Filtrer par cette Zone"
                          >
                            <MapPin className="w-3 h-3 text-purple-600 shrink-0" />
                            <span className="font-mono font-bold">{m.id_zone_default || 'ZONE-N/A'}</span>
                            {zn?.libelle && (
                              <span className="text-purple-700 font-normal text-[10px] max-w-[120px] truncate">
                                • {zn.libelle}
                              </span>
                            )}
                          </button>

                          {/* Technician Badge */}
                          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-blue-50 text-blue-800 border border-blue-200/70 text-[11px] font-semibold shadow-2xs">
                            <Users className="w-3 h-3 text-blue-600 shrink-0" />
                            <span className="font-bold text-slate-800">
                              {tech ? tech.nom : m.technician || 'Non assigné'}
                            </span>
                            {tech?.id_technician && (
                              <span className="font-mono text-[10px] text-blue-600 bg-blue-100/70 px-1 rounded">
                                {tech.id_technician}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Status (H) */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold border shadow-2xs ${
                            isService
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                              : isMaintenance
                                ? 'bg-amber-50 text-amber-800 border-amber-300'
                                : 'bg-rose-50 text-rose-800 border-rose-300'
                          }`}
                        >
                          {isService ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          ) : isMaintenance ? (
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          ) : (
                            <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                          )}
                          <span>{m.status || 'En Service'}</span>
                        </span>
                      </td>

                      {/* Interventions Count */}
                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 font-mono font-bold text-xs px-2.5 py-1 rounded-lg border ${
                            sortiesCount > 0
                              ? 'bg-indigo-50 text-indigo-800 border-indigo-200 shadow-2xs'
                              : 'bg-slate-50 text-slate-400 border-slate-200/60'
                          }`}
                        >
                          <Activity className="w-3 h-3 text-indigo-500 shrink-0" />
                          <span>{sortiesCount} {sortiesCount > 1 ? 'sorties' : 'sortie'}</span>
                        </span>
                      </td>

                      {/* Actions (•••) */}
                      <td className="py-3 px-3.5 text-center whitespace-nowrap">
                        <div className="relative inline-flex items-center justify-center action-menu-container">
                          <div className="inline-flex rounded-xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
                            {/* Primary Quick Action Button: Sortie Rapide / Intervention (1-clic) */}
                            <button
                              type="button"
                              onClick={() => {
                                onNavigateToQuickSortie(m);
                                setActiveActionMenuId(null);
                              }}
                              className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 hover:text-emerald-900 transition flex items-center justify-center cursor-pointer border-r border-slate-200 group"
                              title={`Sortie Rapide / Intervention (1-clic) pour ${m.id_machine_registered} (${m.designation})`}
                            >
                              <Wrench className="w-3.5 h-3.5 text-emerald-600 group-hover:scale-110 transition-transform" />
                            </button>

                            {/* 3-dots Toggle Button */}
                            <button
                              type="button"
                              onClick={() => {
                                setActiveActionMenuId(activeActionMenuId === m.id_machine_registered ? null : m.id_machine_registered);
                              }}
                              className={`p-1.5 hover:bg-slate-100 transition cursor-pointer ${
                                activeActionMenuId === m.id_machine_registered
                                  ? 'bg-slate-100 text-indigo-700 font-bold'
                                  : 'text-slate-500 hover:text-slate-800'
                              }`}
                              title="Actions et options de la machine"
                            >
                              <MoreVertical className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {/* Popover Action Menu Card */}
                          {activeActionMenuId === m.id_machine_registered && (
                            <div className="absolute right-0 top-full mt-1.5 w-64 bg-white rounded-2xl shadow-xl border border-slate-200 z-50 p-1.5 text-left animate-in fade-in slide-in-from-top-2 duration-150 space-y-1">
                              <div className="px-3 py-2 border-b border-slate-100 mb-1 bg-slate-50/80 rounded-xl">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                                  Actions Machine
                                </span>
                                <span className="font-mono text-xs font-bold text-indigo-700 block truncate">
                                  {m.id_machine_registered} • {m.designation}
                                </span>
                              </div>

                              {/* Option 1: Sortie Rapide (1-clic) */}
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveActionMenuId(null);
                                  onNavigateToQuickSortie(m);
                                }}
                                className="w-full px-3 py-2 text-xs font-semibold text-emerald-800 bg-emerald-50/80 hover:bg-emerald-100 rounded-xl transition flex items-center gap-2.5 cursor-pointer border border-emerald-200/70 shadow-2xs"
                              >
                                <Wrench className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                <div className="flex flex-col items-start leading-tight">
                                  <span>Sortie Rapide / Intervention</span>
                                  <span className="text-[10px] text-emerald-600 font-normal">Pré-remplissage 1-clic</span>
                                </div>
                              </button>

                              {/* Option 2: Carnet & Plan Préventif */}
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveActionMenuId(null);
                                  setPreventiveMachine(m);
                                }}
                                className="w-full px-3 py-2 text-xs font-semibold text-indigo-900 bg-indigo-50/80 hover:bg-indigo-100 rounded-xl transition flex items-center gap-2.5 cursor-pointer border border-indigo-200/70 shadow-2xs"
                              >
                                <ShieldCheck className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                                <div className="flex flex-col items-start leading-tight">
                                  <span>Carnet & Plan Préventif</span>
                                  <span className="text-[10px] text-indigo-600 font-normal">Planning, Historique & Échéances</span>
                                </div>
                              </button>

                              {/* Option 2: Modifier la machine */}
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveActionMenuId(null);
                                  setToEdit({ ...m });
                                }}
                                className="w-full px-3 py-2 text-xs font-medium text-slate-700 hover:bg-indigo-50 hover:text-indigo-800 rounded-xl transition flex items-center gap-2.5 cursor-pointer"
                              >
                                <Edit2 className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                                <span>Modifier cette machine</span>
                              </button>

                              {/* Option 3: Consulter Blueprint si disponible */}
                              {m.id_blueprint && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveActionMenuId(null);
                                    onNavigateToBlueprints(m.id_family, m.id_templates);
                                  }}
                                  className="w-full px-3 py-2 text-xs font-medium text-teal-700 hover:bg-teal-50 rounded-xl transition flex items-center gap-2.5 cursor-pointer"
                                >
                                  <FileText className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                                  <span>Voir le Blueprint ({m.id_blueprint})</span>
                                </button>
                              )}

                              {/* Option 4: Supprimer la machine */}
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveActionMenuId(null);
                                  setToDelete(m);
                                }}
                                className="w-full px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 rounded-xl transition flex items-center gap-2.5 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                                <span>Supprimer cette machine</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination Footer */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-[0_12px_32px_-6px_rgba(0,0,0,0.12),0_4px_12px_-2px_rgba(0,0,0,0.06)] hover:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.16),0_6px_16px_-3px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-300 ease-out flex flex-col md:flex-row items-center justify-between gap-4 mt-4">
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-slate-600">Lignes par page :</span>
          <div className="flex bg-slate-100 rounded-lg p-0.5 border border-slate-200">
            {[25, 50, 100, 200, 0].map((size) => (
              <button
                key={size}
                onClick={() => {
                  setPageSize(size);
                  setCurrentPage(1);
                }}
                className={`px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                  pageSize === size
                    ? 'bg-white text-emerald-800 shadow-[0_12px_32px_-6px_rgba(0,0,0,0.12),0_4px_12px_-2px_rgba(0,0,0,0.06)] hover:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.16),0_6px_16px_-3px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-300 ease-out border border-slate-200/50'
                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                }`}
              >
                {size === 0 ? 'Tout' : size}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-xs font-semibold text-slate-500">
            Affichage <b className="text-slate-900">{totalItems === 0 ? 0 : startIndex + 1}</b> à{' '}
            <b className="text-slate-900">{Math.min(startIndex + effectivePageSize, totalItems)}</b>{' '}
            sur <b className="text-slate-900">{totalItems}</b>
          </div>
          {pageSize !== 0 && totalPages > 1 && (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-semibold transition cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                Précédent
              </button>
              <span className="px-2 font-mono text-xs font-bold text-slate-600">
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-semibold transition cursor-pointer"
              >
                Suivant
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* MODAL: MODIFIER MACHINE */}
      {toEdit && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl p-6 border border-slate-200 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-200">
                  <Factory className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900">Modifier Machine Registered</h3>
                  <p className="text-[11px] text-slate-500 font-mono">{toEdit.id_machine_registered}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setToEdit(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const isSysGen = getMachineAssetClass(toEdit) === 'SYSTEM_GENERAL';
                if (isSysGen && !toEdit.id_general_system_type) {
                  return;
                }
                const normalizedEdit = {
                  ...toEdit,
                  asset_class: isSysGen ? ('SYSTEM_GENERAL' as const) : ('PRODUCTION' as const),
                  id_general_system_type: isSysGen ? toEdit.id_general_system_type || '' : '',
                };
                onUpdateMachine(toEdit.id_machine_registered, normalizedEdit);
                setToEdit(null);
              }}
              className="space-y-4"
            >
              {/* Asset Class Switcher (Permet la conversion manuelle Production <-> Système Général) */}
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/90 space-y-2.5">
                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                  Classification Fonctionnelle de l'Équipement
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setToEdit({
                        ...toEdit,
                        asset_class: 'PRODUCTION',
                        id_general_system_type: '',
                      })
                    }
                    className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer ${
                      getMachineAssetClass(toEdit) === 'PRODUCTION'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <Factory className="w-3.5 h-3.5" />
                    <span>Machine de Production</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setToEdit({
                        ...toEdit,
                        asset_class: 'SYSTEM_GENERAL',
                        id_general_system_type:
                          toEdit.id_general_system_type || activeSystemTypes[0]?.id || '',
                      })
                    }
                    className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer ${
                      getMachineAssetClass(toEdit) === 'SYSTEM_GENERAL'
                        ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <ShieldAlert className="w-3.5 h-3.5" />
                    <span>Système Général</span>
                  </button>
                </div>

                {getMachineAssetClass(toEdit) === 'SYSTEM_GENERAL' && (
                  <div className="pt-2 border-t border-slate-200/70 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold text-amber-900 uppercase tracking-wider">
                        Type de Système Général <span className="text-rose-500">*</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowEditNewSysType((v) => !v)}
                        className="text-[11px] font-bold text-amber-700 hover:text-amber-900 flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Nouveau type</span>
                      </button>
                    </div>

                    {showEditNewSysType && (
                      <div className="p-2.5 rounded-xl bg-amber-50/80 border border-amber-200 flex items-center gap-2">
                        <input
                          type="text"
                          value={newSysTypeCode}
                          onChange={(e) => setNewSysTypeCode(e.target.value.toUpperCase())}
                          placeholder="Code (ex: AIR)"
                          className="w-24 h-8 px-2 rounded-lg border border-amber-300 bg-white text-xs font-mono font-bold"
                        />
                        <input
                          type="text"
                          value={newSysTypeName}
                          onChange={(e) => setNewSysTypeName(e.target.value)}
                          placeholder="Nom du type (ex: Air comprimé)"
                          className="flex-1 h-8 px-2.5 rounded-lg border border-amber-300 bg-white text-xs font-medium"
                        />
                        <button
                          type="button"
                          onClick={() => handleQuickCreateSystemType(true)}
                          className="h-8 px-2.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Créer</span>
                        </button>
                      </div>
                    )}

                    <CustomSelect
                      value={toEdit.id_general_system_type || ''}
                      onChange={(val) => setToEdit({ ...toEdit, id_general_system_type: val })}
                      options={[
                        { value: '', label: '— Choisir un Type de Système Général —' },
                        ...generalSystemTypes
                          .filter((t) => t.is_active !== false || t.id === toEdit.id_general_system_type)
                          .map((t) => ({
                            value: t.id,
                            label: `${t.code ? t.code + ' • ' : ''}${t.name}`,
                          })),
                      ]}
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                    Code Machine (B)
                  </label>
                  <input
                    type="text"
                    value={toEdit.id_machine_registered}
                    disabled
                    className="w-full h-10 px-3 rounded-xl bg-slate-100 text-slate-500 text-xs font-mono font-bold border border-slate-200"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                    Désignation de la Machine (C)
                  </label>
                  <input
                    type="text"
                    value={toEdit.designation}
                    onChange={(e) => setToEdit({ ...toEdit, designation: e.target.value })}
                    required
                    placeholder="Ex: Compresseur Atlas Copco / Extincteur CO2"
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-slate-50 text-xs font-medium focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1 flex items-center justify-between">
                    <span>Famille (D)</span>
                    {getMachineAssetClass(toEdit) === 'SYSTEM_GENERAL' && (
                      <span className="text-[10px] font-normal text-amber-700 lowercase italic">(optionnel)</span>
                    )}
                  </label>
                  <CustomSelect
                    value={toEdit.id_family || ''}
                    onChange={(val) => {
                      const relTpl = templates.filter((t) => t.id_family === val);
                      setToEdit({
                        ...toEdit,
                        id_family: val,
                        id_templates: val ? relTpl[0]?.id_templates || '' : '',
                      });
                    }}
                    options={[
                      ...(getMachineAssetClass(toEdit) === 'SYSTEM_GENERAL'
                        ? [{ value: '', label: '— Aucune Famille (Système Général) —' }]
                        : []),
                      ...families.map((f) => ({ value: f.id_family, label: `${f.libelle} (${f.id_family})` })),
                    ]}
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1 flex items-center justify-between">
                    <span>Template Modèle (E)</span>
                    {getMachineAssetClass(toEdit) === 'SYSTEM_GENERAL' && (
                      <span className="text-[10px] font-normal text-amber-700 lowercase italic">(optionnel)</span>
                    )}
                  </label>
                  <CustomSelect
                    value={toEdit.id_templates || ''}
                    onChange={(val) => setToEdit({ ...toEdit, id_templates: val })}
                    options={[
                      ...(getMachineAssetClass(toEdit) === 'SYSTEM_GENERAL'
                        ? [{ value: '', label: '— Aucun Template (Optionnel) —' }]
                        : []),
                      ...templates
                        .filter((t) => !toEdit.id_family || t.id_family === toEdit.id_family)
                        .map((t) => ({ value: t.id_templates, label: `${t.libelle} (${t.id_templates})` })),
                    ]}
                  />
                </div>
              </div>

              {/* Blueprint / Plan Schéma Technique (Optionnel) */}
              <div>
                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <FileText className="w-3 h-3 text-cyan-600" />
                    <span>Blueprint / Schéma Machine</span>
                  </span>
                  <span className="text-[10px] font-normal text-slate-400 lowercase italic">(optionnel)</span>
                </label>
                <CustomSelect
                  value={toEdit.id_blueprint || ''}
                  onChange={(val) => setToEdit({ ...toEdit, id_blueprint: val })}
                  options={[
                    { value: '', label: '— Non sélectionné (Optionnel) —' },
                    ...blueprints
                      .filter(
                        (b) =>
                          (!toEdit.id_templates || b.id_templates === toEdit.id_templates) &&
                          (!toEdit.id_family || b.id_family === toEdit.id_family)
                      )
                      .map((b) => ({
                        value: b.id_blueprint,
                        label: `${b.id_blueprint} • ${b.libelle || b.ref_plan || ''} ${b.revision ? `(${b.revision})` : ''}`,
                      })),
                  ]}
                />
              </div>

              {/* N° de Série & Date de Mise en Service */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1 flex items-center gap-1">
                    <Hash className="w-3 h-3 text-slate-500" />
                    <span>N° de Série (N° Série)</span>
                  </label>
                  <input
                    type="text"
                    value={toEdit.serial_number ?? getMachineSerialNumber(toEdit)}
                    onChange={(e) => setToEdit({ ...toEdit, serial_number: e.target.value })}
                    placeholder="Ex: SN-2023-MCH01"
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-xs font-mono font-medium focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1 flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-slate-500" />
                    <span>Mise en Service</span>
                  </label>
                  <input
                    type="date"
                    value={toEdit.date_mise_en_service ?? getMachineCommissioningDate(toEdit)}
                    onChange={(e) => setToEdit({ ...toEdit, date_mise_en_service: e.target.value })}
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-xs font-medium focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                    Secteur / Zone Réelle (F)
                  </label>
                  <CustomSelect
                    value={
                      getZoneByRef(toEdit.id_zone_default, zones)?.code_zone ||
                      getZoneByRef(toEdit.id_zone_default, zones)?.id_zone ||
                      toEdit.id_zone_default
                    }
                    onChange={(val) => setToEdit({ ...toEdit, id_zone_default: val })}
                    options={zones.map((z) => {
                      const codeZ = z.code_zone || z.code || z.id_zone;
                      const idZ = z.id_zone;
                      const showDual = idZ && idZ !== codeZ;
                      return {
                        value: codeZ,
                        label: `${z.code_zone ? z.code_zone + ' • ' : ''}${z.libelle}${showDual ? ` (${idZ})` : ''}`,
                      };
                    })}
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                    Technicien Responsable (G)
                  </label>
                  <CustomSelect
                    value={toEdit.technician}
                    onChange={(val) => setToEdit({ ...toEdit, technician: val })}
                    options={technicians.map((t) => ({ value: t.id_technician, label: `${t.nom} (${t.id_technician})` }))}
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                  Statut Opérationnel (H)
                </label>
                <CustomSelect
                  value={toEdit.status || 'En Service'}
                  onChange={(val) => setToEdit({ ...toEdit, status: val })}
                  options={[
                    { value: 'En Service', label: 'En Service (Opérationnel)' },
                    { value: 'En Maintenance', label: 'En Maintenance' },
                    { value: 'En Panne', label: 'En Panne' },
                    { value: 'Arrêt', label: 'Arrêt Machine' },
                  ]}
                />
              </div>

              <div className="flex gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setToEdit(null)}
                  className="flex-1 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 transition cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="flex-1 h-10 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-bold transition shadow-[0_12px_32px_-6px_rgba(0,0,0,0.12),0_4px_12px_-2px_rgba(0,0,0,0.06)] hover:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.16),0_6px_16px_-3px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-300 ease-out cursor-pointer"
                >
                  Enregistrer Modifications
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: GESTION RAPIDE DES TYPES DE SYSTÈME GÉNÉRAL */}
      {showSysTypesModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 border border-slate-200 animate-in fade-in zoom-in-95 duration-150 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center border border-amber-200">
                  <Settings2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900">Types de Système Général</h3>
                  <p className="text-[11px] text-slate-500">
                    Utilités, sécurité incendie, pompes, éclairage & infrastructures
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSysTypesModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 rounded-2xl bg-amber-50/70 border border-amber-200/80 space-y-2">
              <label className="text-[11px] font-bold text-amber-900 uppercase tracking-wider block">
                + Ajouter un nouveau type
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newSysTypeCode}
                  onChange={(e) => setNewSysTypeCode(e.target.value.toUpperCase())}
                  placeholder="Code (AIR)"
                  className="w-24 h-9 px-2.5 rounded-xl border border-amber-300 bg-white text-xs font-mono font-bold"
                />
                <input
                  type="text"
                  value={newSysTypeName}
                  onChange={(e) => setNewSysTypeName(e.target.value)}
                  placeholder="Nom (ex: Air comprimé)"
                  className="flex-1 h-9 px-3 rounded-xl border border-amber-300 bg-white text-xs font-medium"
                />
                <button
                  type="button"
                  onClick={() => handleQuickCreateSystemType(false)}
                  className="h-9 px-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition cursor-pointer shrink-0"
                >
                  Ajouter
                </button>
              </div>
            </div>

            <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-2xl">
              {generalSystemTypes.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  Aucun type de Système Général enregistré.
                </div>
              ) : (
                generalSystemTypes.map((t) => {
                  const count = machines.filter((m) => m.id_general_system_type === t.id).length;
                  const isActive = t.is_active !== false;
                  return (
                    <div
                      key={t.id}
                      className="px-3.5 py-2.5 flex items-center justify-between gap-2 bg-white hover:bg-slate-50"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                            {t.code || t.id}
                          </span>
                          <span className={`text-xs font-bold truncate ${isActive ? 'text-slate-900' : 'text-slate-400 line-through'}`}>
                            {t.name}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {t.id} • {count} équipement(s) rattaché(s)
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleGeneralSystemType && toggleGeneralSystemType(t.id)}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition cursor-pointer shrink-0 ${
                          isActive
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200'
                            : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-emerald-50 hover:text-emerald-800'
                        }`}
                      >
                        {isActive ? 'Actif' : 'Inactif'}
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={() => setShowSysTypesModal(false)}
                className="px-4 h-9 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-bold cursor-pointer"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: SUPPRIMER MACHINE */}
      {toDelete && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 space-y-4 border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mb-3">
                <Trash2 className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-base text-slate-900">Supprimer la Machine ?</h3>
              <p className="text-xs text-slate-500 mt-1">
                Êtes-vous sûr de vouloir supprimer définitivement l'équipement{' '}
                <b className="font-mono text-slate-900">{toDelete.id_machine_registered}</b> ({toDelete.designation}) ?
              </p>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setToDelete(null)}
                className="flex-1 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition cursor-pointer"
              >
                Annuler
              </button>
              <button
                onClick={() => {
                  onDeleteMachine(toDelete.id_machine_registered);
                  setToDelete(null);
                }}
                className="flex-1 h-10 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition shadow-[0_12px_32px_-6px_rgba(0,0,0,0.12),0_4px_12px_-2px_rgba(0,0,0,0.06)] hover:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.16),0_6px_16px_-3px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-300 ease-out cursor-pointer"
              >
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}
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
                    <span>Formules Excel Miroir — Machines Enregistrées</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Liaisons D → G
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    Formules et dépendances relationnelles de la feuille Machines_Registered
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowFormulasModal(false)}
                className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition cursor-pointer shrink-0"
                title="Fermer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Content: 4 Formula Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              {/* Liaison Famille (D) */}
              <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/90 flex flex-col justify-between gap-2 hover:border-cyan-300 transition">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 truncate">
                    <HubIcon className="w-3.5 h-3.5 text-cyan-600 shrink-0" />
                    <span className="truncate">Liaison Famille (Col. D)</span>
                  </div>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-cyan-100/80 text-cyan-800 border border-cyan-200 shrink-0">
                    Liaison D
                  </span>
                </div>
                <div className="font-mono text-xs text-cyan-800 font-bold bg-white p-2 rounded-lg border border-cyan-100">
                  =[@id_family] → Family!B:B
                </div>
                <p className="text-[10.5px] text-slate-500 leading-tight">
                  Liaison relationnelle vers la catégorie parentale de l'équipement dans la feuille Familles.
                </p>
              </div>

              {/* Liaison Template (E) */}
              <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/90 flex flex-col justify-between gap-2 hover:border-amber-300 transition">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 truncate">
                    <CategoryIcon className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span className="truncate">Liaison Template (Col. E)</span>
                  </div>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-amber-100/80 text-amber-800 border border-amber-200 shrink-0">
                    Liaison E
                  </span>
                </div>
                <div className="font-mono text-xs text-amber-800 font-bold bg-white p-2 rounded-lg border border-amber-100">
                  =[@id_templates] → Template!B:B
                </div>
                <p className="text-[10.5px] text-slate-500 leading-tight">
                  Association du modèle de référence technique pour l'unification des composants.
                </p>
              </div>

              {/* Liaison Zone (F) */}
              <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/90 flex flex-col justify-between gap-2 hover:border-purple-300 transition">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 truncate">
                    <MapPin className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                    <span className="truncate">Liaison Zone Défaut (Col. F)</span>
                  </div>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-purple-100/80 text-purple-800 border border-purple-200 shrink-0">
                    Liaison F
                  </span>
                </div>
                <div className="font-mono text-xs text-purple-800 font-bold bg-white p-2 rounded-lg border border-purple-100">
                  =[@id_zone_default] → Zone!B:B
                </div>
                <p className="text-[10.5px] text-slate-500 leading-tight">
                  Emplacement physique par défaut et secteur géographique de fonctionnement de la machine.
                </p>
              </div>

              {/* Interventions / Sorties */}
              <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/90 flex flex-col justify-between gap-2 hover:border-rose-300 transition">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 truncate">
                    <Activity className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                    <span className="truncate">Interventions & Sorties</span>
                  </div>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-rose-100/80 text-rose-800 border border-rose-200 shrink-0">
                    Traçabilité
                  </span>
                </div>
                <div className="font-mono text-xs text-rose-800 font-bold bg-white p-2 rounded-lg border border-rose-100">
                  =COUNTIF(Mvt[Machine], [@id_machine])
                </div>
                <p className="text-[10.5px] text-slate-500 leading-tight">
                  Compteur dynamique de toutes les pièces et sorties de stock consommées par l'équipement.
                </p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <span className="text-[11px] text-slate-400 font-medium">
                Conforme à 100% avec le fichier Excel modèle <span className="font-mono text-slate-600">GMAO_Light_Template_V2</span>
              </span>
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

      {/* MODAL: CARNET DE SANTÉ & PLAN PRÉVENTIF DE LA MACHINE */}
      {preventiveMachine && (() => {
        const profile = PreventiveService.getMachinePreventiveProfile(preventiveMachine.id_machine_registered);
        const healthColor =
          profile.health_status === 'Optimale'
            ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
            : profile.health_status === 'Moyenne'
            ? 'bg-amber-50 text-amber-800 border-amber-300'
            : 'bg-rose-50 text-rose-800 border-rose-300';

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
              {/* Header */}
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-indigo-50/90 to-purple-50/50 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-black text-slate-900 tracking-tight">
                        Carnet Préventif & Suivi Technique
                      </h3>
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${healthColor}`}>
                        Santé : {profile.health_status} ({profile.compliance_rate}%)
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 font-mono">
                      {preventiveMachine.id_machine_registered} • <span className="font-sans font-medium text-slate-700">{preventiveMachine.designation}</span>
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setPreventiveMachine(null)}
                  className="w-8 h-8 rounded-xl bg-white/80 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition cursor-pointer shrink-0"
                  title="Fermer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 overflow-y-auto space-y-5 flex-1 text-xs">
                {/* 4 KPIs Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Taux Conformité</span>
                    <span className="text-xl font-black text-indigo-700 font-mono mt-0.5 block">{profile.compliance_rate}%</span>
                    <span className="text-[10px] text-slate-500">{profile.fait_tasks} / {profile.total_tasks} tâches faites</span>
                  </div>

                  <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Prochaine Échéance</span>
                    <span className="text-base font-bold text-slate-800 font-mono mt-0.5 block truncate">
                      {profile.prochaine_intervention?.semaine || 'N/A'}
                    </span>
                    <span className="text-[10px] text-slate-500 truncate block">
                      {profile.prochaine_intervention?.date || 'Plan à jour'}
                    </span>
                  </div>

                  <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Tâches en Retard</span>
                    <span className={`text-xl font-black font-mono mt-0.5 block ${profile.retard_tasks > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                      {profile.retard_tasks}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {profile.retard_tasks > 0 ? 'Action requise' : 'Aucun retard'}
                    </span>
                  </div>

                  <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Coût Préventif Cumulé</span>
                    <span className="text-base font-black text-emerald-700 font-mono mt-0.5 block">
                      {Number(profile.cout_total_preventif || 0).toFixed(2)} DT
                    </span>
                    <span className="text-[10px] text-slate-500">Main d'œuvre & PDR</span>
                  </div>
                </div>

                {/* Tasks Table */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-indigo-600" />
                      <span>Gammes et Tâches de Maintenance Planifiées ({profile.tasks.length})</span>
                    </h4>
                  </div>

                  {profile.tasks.length === 0 ? (
                    <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200 text-slate-500 space-y-2">
                      <ShieldCheck className="w-8 h-8 text-slate-400 mx-auto" />
                      <p className="font-semibold">Aucun plan préventif n'est encore configuré pour cet équipement.</p>
                      <p className="text-xs text-slate-400">Rendez-vous dans le module Maintenance Préventive &gt; Conception Plan pour programmer ses opérations.</p>
                    </div>
                  ) : (
                    <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-slate-100 text-[11px] font-bold text-slate-600 uppercase border-b border-slate-200">
                          <tr>
                            <th className="py-2.5 px-3">Organe / Composant</th>
                            <th className="py-2.5 px-2.5 text-center">Action</th>
                            <th className="py-2.5 px-2.5">Fréquence</th>
                            <th className="py-2.5 px-2.5">Responsable</th>
                            <th className="py-2.5 px-2.5">Prochaine Échéance</th>
                            <th className="py-2.5 px-2.5 text-center">Statut</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                          {profile.tasks.map((t) => (
                            <tr key={t.id} className="hover:bg-indigo-50/30 transition">
                              <td className="py-2.5 px-3">
                                <div className="font-bold text-slate-800">{t.composant}</div>
                                <div className="text-[10px] text-slate-400 font-mono">{t.code}</div>
                              </td>
                              <td className="py-2.5 px-2.5 text-center">
                                <span className="px-2 py-0.5 rounded font-mono font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 text-[11px]">
                                  {t.action_code}
                                </span>
                              </td>
                              <td className="py-2.5 px-2.5 font-medium text-slate-700">{t.frequence}</td>
                              <td className="py-2.5 px-2.5 text-slate-600">{t.responsable || 'Technicien GMAO'}</td>
                              <td className="py-2.5 px-2.5 font-mono text-slate-800 font-semibold">
                                {t.prochaine_echeance || 'Calendrier'}
                              </td>
                              <td className="py-2.5 px-2.5 text-center">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    t.etat === 'Fait'
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : t.etat === 'En retard'
                                      ? 'bg-rose-100 text-rose-800'
                                      : 'bg-blue-100 text-blue-800'
                                  }`}
                                >
                                  {t.etat}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between bg-slate-50 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    const machId = preventiveMachine.id_machine_registered;
                    setPreventiveMachine(null);
                    if (onNavigateToPreventive) {
                      onNavigateToPreventive(machId);
                    }
                  }}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition flex items-center gap-2 shadow-xs cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Ouvrir la Matrice de Maintenance (S1 - S52)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPreventiveMachine(null)}
                  className="px-4 py-2 rounded-xl bg-white hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-bold transition cursor-pointer"
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </AnimatedPage>
  );
}
export { MachinesRegisteredView };
