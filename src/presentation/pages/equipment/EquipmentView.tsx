import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  ShieldAlert,
  Settings2,
  Plus,
  Edit2,
  Trash2,
  Archive,
  RotateCcw,
  Wrench,
  Calendar,
  MapPin,
  UserCheck,
  CheckCircle2,
  AlertTriangle,
  PowerOff,
  FileSpreadsheet,
  Layers,
  Tag,
  Hash,
  X,
  Check,
  Search,
  ToggleLeft,
  ToggleRight,
  SlidersHorizontal,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronDown,
  Calculator,
  Sparkles,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import {
  getMachineAssetClass,
  isArchivedMachine,
  transitionMachineLifecycle,
} from '../../../utils/activeMachines';
import { generateSystemGeneralCode } from '../machines/AddMachineModal';
import { dataIntegrityService } from '../../../services/dataIntegrityService';
import { usePermission } from '../../components/common/PermissionGate';
import AnimatedPage from '../../components/common/AnimatedPage';
import PageHeaderIcon from '../../components/common/PageHeaderIcon';
import Action3DButton from '../../components/common/Action3DButton';
import FormulasModalButton from '../../components/common/FormulasModalButton';
import GmaoKpiCard, { GmaoKpiGrid } from '../../components/common/GmaoKpiCard';
import GmaoIndustrialDataGrid, {
  GmaoColumn,
} from '../../components/common/GmaoIndustrialDataGrid';
import CustomSelect from '../../components/common/CustomSelect';
import SequentialCodePicker from '../../components/common/SequentialCodePicker';
import type {
  IGeneralSystemType,
  IMachine,
  IMouvement,
  ITechnician,
  IZone,
} from '../../../types/domain';
import type {
  CorrectiveInterventionItem,
  PreventiveTaskItem,
  StateUpdater,
} from '../../../types/store';
import EquipmentModals from './components/EquipmentModals';

export interface EquipmentViewProps {
  machines: IMachine[];
  generalSystemTypes: IGeneralSystemType[];
  setGeneralSystemTypes?: (updater: StateUpdater<IGeneralSystemType[]>) => void;
  handleAddGeneralSystemType: (payload: { code: string; name: string }) => IGeneralSystemType | null | void;
  handleToggleGeneralSystemType: (id: string) => void;
  zones: IZone[];
  technicians: ITechnician[];
  mouvements: IMouvement[];
  preventiveTasks: PreventiveTaskItem[];
  correctiveInterventions: CorrectiveInterventionItem[];
  handleAddMachine: (machine: Partial<IMachine>) => boolean | void;
  handleUpdateMachine: (id: string, machine: Partial<IMachine>) => boolean | void;
  handleDeleteMachine: (id: string) => void;
  onNavigateToZone?: (zoneId: string) => void;
  onNavigateToQuickSortie?: (machineId: string) => void;
  onNavigateToPreventive?: (machineId: string) => void;
  showToast?: (message: string, type?: string) => void;
}

const EquipmentView: React.FC<EquipmentViewProps> = ({
  machines = [],
  generalSystemTypes = [],
  setGeneralSystemTypes,
  handleAddGeneralSystemType,
  handleToggleGeneralSystemType,
  zones = [],
  technicians = [],
  mouvements = [],
  preventiveTasks = [],
  correctiveInterventions = [],
  handleAddMachine,
  handleUpdateMachine,
  handleDeleteMachine,
  onNavigateToZone,
  onNavigateToQuickSortie,
  onNavigateToPreventive,
  showToast,
}) => {
  const canCreate = usePermission('equipment.create') || usePermission('machine.create');
  const canEdit = usePermission('equipment.edit') || usePermission('machine.edit');
  const canDelete = usePermission('equipment.delete') || usePermission('machine.delete');

  // Active section tab: 'equipments' | 'types'
  const [activeSection, setActiveSection] = useState<'equipments' | 'types'>('equipments');

  // Filters for equipments
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [systemTypeFilter, setSystemTypeFilter] = useState<string>('ALL');
  const [zoneFilter, setZoneFilter] = useState<string>('ALL');
  const [focusedEquipmentId, setFocusedEquipmentId] = useState<string | null>(null);

  // Sorting & Pagination for equipments
  const [sortField, setSortField] = useState<string>('id_machine_registered');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const sortMenuRef = useRef<HTMLDivElement | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Filters, Sorting & Pagination for system types
  const [typeSearchTerm, setTypeSearchTerm] = useState('');
  const [typeStatusFilter, setTypeStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [typeSortField, setTypeSortField] = useState<string>('code');
  const [typeSortOrder, setTypeSortOrder] = useState<'asc' | 'desc'>('asc');
  const [typeCurrentPage, setTypeCurrentPage] = useState(1);
  const [typePageSize, setTypePageSize] = useState(20);

  // Modals state
  const [showFormulasModal, setShowFormulasModal] = useState(false);
  const [showEquipmentModal, setShowEquipmentModal] = useState(false);
  const [editingEquipment, setEditingEquipment] = useState<IMachine | null>(null);
  const [equipForm, setEquipForm] = useState({
    id_machine_registered: '',
    designation: '',
    id_general_system_type: '',
    id_zone_default: '',
    technician: '',
    serial_number: '',
    date_mise_en_service: new Date().toISOString().split('T')[0],
    compteur_heures: 0,
    compteur_unite_defaut: 'HEURES' as 'HEURES' | 'CYCLES' | 'TONNES' | 'KM',
    status: 'En Service',
  });
  const [equipFormError, setEquipFormError] = useState('');

  // System Type Create / Edit Modal state
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [editingType, setEditingType] = useState<IGeneralSystemType | null>(null);
  const [typeForm, setTypeForm] = useState({
    code: '',
    name: '',
  });
  const [typeFormError, setTypeFormError] = useState('');

  // Archive / Delete Confirmation Modal state
  const [archiveTarget, setArchiveTarget] = useState<IMachine | null>(null);

  // Close sort dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (sortMenuRef.current && !sortMenuRef.current.contains(e.target as Node)) {
        setShowSortMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter only SYSTEM_GENERAL equipments from canonical machines SSOT
  const systemGeneralEquipments = useMemo(() => {
    return (machines || []).filter((m) => getMachineAssetClass(m) === 'SYSTEM_GENERAL');
  }, [machines]);

  // Handle cross-page navigation focus from MachinesRegisteredView
  useEffect(() => {
    try {
      const targetId = localStorage.getItem('gmao_equipment_focus_id');
      if (targetId) {
        localStorage.removeItem('gmao_equipment_focus_id');
        setActiveSection('equipments');
        setSearchTerm(targetId);
        setFocusedEquipmentId(targetId);
        const found = (machines || []).find(
          (m) =>
            String(m.id_machine_registered || '').toUpperCase() ===
            String(targetId).toUpperCase()
        );
        if (found && isArchivedMachine(found)) {
          setStatusFilter('ARCHIVEE');
        } else {
          setStatusFilter('ALL');
        }
      }
    } catch {
      // Ignore storage access errors
    }
  }, [machines]);

  // Normalized Lookup Maps (supporting both id/name and id_zone/libelle or id_technician/nom)
  const systemTypeMap = useMemo(() => {
    const map = new Map<string, IGeneralSystemType>();
    (generalSystemTypes || []).forEach((t) => {
      if (t && t.id) map.set(String(t.id), t);
    });
    return map;
  }, [generalSystemTypes]);

  const normalizedZones = useMemo(() => {
    return (zones || []).map((z) => ({
      id: String(z.id_zone || z.id || ''),
      name: String(z.libelle || z.name || z.id_zone || z.id || ''),
      raw: z,
    }));
  }, [zones]);

  const zoneMap = useMemo(() => {
    const map = new Map<string, { id: string; name: string; raw: IZone }>();
    normalizedZones.forEach((z) => {
      if (z.id) map.set(z.id, z);
    });
    return map;
  }, [normalizedZones]);

  const normalizedTechnicians = useMemo(() => {
    return (technicians || []).map((t) => ({
      id: String(t.id_technician || t.id || ''),
      name: String(t.nom || t.name || t.id_technician || t.id || ''),
      specialty: String(t.specialite || t.specialty || t.role || 'Maintenance'),
      is_active: t.is_active !== false && t.actif !== false && t.statut !== 'ARCHIVE',
      raw: t,
    }));
  }, [technicians]);

  const techMap = useMemo(() => {
    const map = new Map<string, { id: string; name: string; specialty: string; is_active: boolean }>();
    normalizedTechnicians.forEach((t) => {
      if (t.id) map.set(t.id, t);
    });
    return map;
  }, [normalizedTechnicians]);

  const activeTechnicians = useMemo(() => {
    return normalizedTechnicians.filter((t) => t.is_active);
  }, [normalizedTechnicians]);

  const activeSystemTypes = useMemo(() => {
    return (generalSystemTypes || []).filter((t) => t.is_active !== false);
  }, [generalSystemTypes]);

  // KPI calculations
  const kpiStats = useMemo(() => {
    const activeEquips = systemGeneralEquipments.filter((m) => !isArchivedMachine(m));
    const archivedEquips = systemGeneralEquipments.filter((m) => isArchivedMachine(m));
    const enService = activeEquips.filter((m) => m.status === 'En Service').length;
    const enMaintenance = activeEquips.filter((m) => m.status === 'En Maintenance').length;
    const enArret = activeEquips.filter(
      (m) => m.status === "À l'Arrêt" || m.status === 'Hors Service'
    ).length;

    return {
      totalActive: activeEquips.length,
      archivedCount: archivedEquips.length,
      enService,
      enMaintenance,
      enArret,
      attentionCount: enMaintenance + enArret,
      activeTypesCount: activeSystemTypes.length,
      totalTypesCount: (generalSystemTypes || []).length,
    };
  }, [systemGeneralEquipments, activeSystemTypes, generalSystemTypes]);

  // Equipment count per System Type
  const equipCountByType = useMemo(() => {
    const counts: Record<string, number> = {};
    systemGeneralEquipments.forEach((m) => {
      const tId = String(m.id_general_system_type || '');
      if (tId) {
        counts[tId] = (counts[tId] || 0) + 1;
      }
    });
    return counts;
  }, [systemGeneralEquipments]);

  // Filtered Equipments
  const filteredEquipments = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return systemGeneralEquipments.filter((m) => {
      const archived = isArchivedMachine(m);
      if (statusFilter === 'ARCHIVEE') {
        if (!archived) return false;
      } else if (statusFilter === 'ALERTE') {
        if (archived) return false;
        if (
          m.status !== 'En Maintenance' &&
          m.status !== "À l'Arrêt" &&
          m.status !== 'Hors Service'
        ) {
          return false;
        }
      } else {
        if (archived) return false;
        if (statusFilter !== 'ALL' && m.status !== statusFilter) return false;
      }

      if (systemTypeFilter !== 'ALL' && m.id_general_system_type !== systemTypeFilter) {
        return false;
      }

      if (zoneFilter !== 'ALL' && m.id_zone_default !== zoneFilter) {
        return false;
      }

      if (q) {
        const code = String(m.id_machine_registered || '').toLowerCase();
        const desig = String(m.designation || '').toLowerCase();
        const serial = String(m.serial_number || '').toLowerCase();
        const sysType = systemTypeMap.get(String(m.id_general_system_type || ''));
        const sysLabel = `${sysType?.code || ''} ${sysType?.name || ''}`.toLowerCase();
        const zoneObj = zoneMap.get(String(m.id_zone_default || ''));
        const zoneLabel = `${zoneObj?.id || ''} ${zoneObj?.name || ''}`.toLowerCase();
        const techObj = techMap.get(String(m.technician || ''));
        const techLabel = `${techObj?.id || ''} ${techObj?.name || ''}`.toLowerCase();
        if (
          !code.includes(q) &&
          !desig.includes(q) &&
          !serial.includes(q) &&
          !sysLabel.includes(q) &&
          !zoneLabel.includes(q) &&
          !techLabel.includes(q)
        ) {
          return false;
        }
      }

      return true;
    });
  }, [
    systemGeneralEquipments,
    searchTerm,
    statusFilter,
    systemTypeFilter,
    zoneFilter,
    systemTypeMap,
    zoneMap,
    techMap,
  ]);

  // Sorted & Paginated Equipments
  const sortedEquipments = useMemo(() => {
    if (!sortField) return filteredEquipments;
    return [...filteredEquipments].sort((a, b) => {
      let valA = String(a[sortField] || '').toLowerCase();
      let valB = String(b[sortField] || '').toLowerCase();
      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredEquipments, sortField, sortOrder]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, systemTypeFilter, zoneFilter, pageSize]);

  const totalEquipItems = sortedEquipments.length;
  const effectiveEquipPageSize = pageSize === 0 ? totalEquipItems : pageSize;
  const equipStartIndex = (currentPage - 1) * effectiveEquipPageSize;
  const paginatedEquipments = useMemo(() => {
    if (pageSize === 0) return sortedEquipments;
    return sortedEquipments.slice(equipStartIndex, equipStartIndex + effectiveEquipPageSize);
  }, [sortedEquipments, pageSize, equipStartIndex, effectiveEquipPageSize]);

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
      <ArrowUp className="w-3 h-3 text-amber-700 shrink-0 font-bold" />
    ) : (
      <ArrowDown className="w-3 h-3 text-amber-700 shrink-0 font-bold" />
    );
  };

  // Filtered, Sorted & Paginated System Types
  const filteredSystemTypes = useMemo(() => {
    const q = typeSearchTerm.trim().toLowerCase();
    return (generalSystemTypes || []).filter((t) => {
      const isAct = t.is_active !== false;
      if (typeStatusFilter === 'ACTIVE' && !isAct) return false;
      if (typeStatusFilter === 'INACTIVE' && isAct) return false;
      if (q) {
        const code = String(t.code || '').toLowerCase();
        const name = String(t.name || '').toLowerCase();
        const id = String(t.id || '').toLowerCase();
        if (!code.includes(q) && !name.includes(q) && !id.includes(q)) return false;
      }
      return true;
    });
  }, [generalSystemTypes, typeSearchTerm, typeStatusFilter]);

  const sortedSystemTypes = useMemo(() => {
    if (!typeSortField) return filteredSystemTypes;
    return [...filteredSystemTypes].sort((a, b) => {
      if (typeSortField === 'count') {
        const cA = equipCountByType[a.id] || 0;
        const cB = equipCountByType[b.id] || 0;
        return typeSortOrder === 'asc' ? cA - cB : cB - cA;
      }
      const valA = String(a[typeSortField] || '').toLowerCase();
      const valB = String(b[typeSortField] || '').toLowerCase();
      if (valA < valB) return typeSortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return typeSortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredSystemTypes, typeSortField, typeSortOrder, equipCountByType]);

  const totalTypeItems = sortedSystemTypes.length;
  const effectiveTypePageSize = typePageSize === 0 ? totalTypeItems : typePageSize;
  const typeStartIndex = (typeCurrentPage - 1) * effectiveTypePageSize;
  const paginatedSystemTypes = useMemo(() => {
    if (typePageSize === 0) return sortedSystemTypes;
    return sortedSystemTypes.slice(typeStartIndex, typeStartIndex + effectiveTypePageSize);
  }, [sortedSystemTypes, typePageSize, typeStartIndex, effectiveTypePageSize]);

  const handleTypeSort = (field: string) => {
    if (typeSortField === field) {
      setTypeSortOrder(typeSortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setTypeSortField(field);
      setTypeSortOrder('asc');
    }
  };

  const renderTypeSortIcon = (field: string) => {
    if (typeSortField !== field) {
      return (
        <ArrowUpDown className="w-3 h-3 text-slate-300 group-hover:text-slate-500 transition shrink-0" />
      );
    }
    return typeSortOrder === 'asc' ? (
      <ArrowUp className="w-3 h-3 text-indigo-700 shrink-0 font-bold" />
    ) : (
      <ArrowDown className="w-3 h-3 text-indigo-700 shrink-0 font-bold" />
    );
  };

  // Auto-derive sequential code when creating a new equipment and selecting a system type
  const selectedFormSystemType = useMemo(() => {
    return (generalSystemTypes || []).find((t) => t.id === equipForm.id_general_system_type);
  }, [generalSystemTypes, equipForm.id_general_system_type]);

  const handleSelectFormSystemType = (typeId: string) => {
    const sysTypeObj = (generalSystemTypes || []).find((t) => t.id === typeId);
    const nextCode =
      !editingEquipment && sysTypeObj
        ? generateSystemGeneralCode(sysTypeObj, machines)
        : equipForm.id_machine_registered;
    setEquipForm((prev) => ({
      ...prev,
      id_general_system_type: typeId,
      id_machine_registered: nextCode,
    }));
    setEquipFormError('');
  };

  // Open Create Equipment Modal
  const openCreateEquipmentModal = (preselectedTypeId?: string) => {
    const defaultType =
      (preselectedTypeId && activeSystemTypes.find((t) => t.id === preselectedTypeId)) ||
      activeSystemTypes[0] ||
      null;
    const autoCode = defaultType ? generateSystemGeneralCode(defaultType, machines) : '';
    const defaultZoneId = normalizedZones[0]?.id || '';

    setEditingEquipment(null);
    setEquipForm({
      id_machine_registered: autoCode,
      designation: '',
      id_general_system_type: defaultType ? defaultType.id : '',
      id_zone_default: defaultZoneId,
      technician: '',
      serial_number: '',
      date_mise_en_service: new Date().toISOString().split('T')[0],
      compteur_heures: 0,
      compteur_unite_defaut: 'HEURES',
      status: 'En Service',
    });
    setEquipFormError('');
    setShowEquipmentModal(true);
  };

  // Open Edit Equipment Modal
  const openEditEquipmentModal = (equip: IMachine) => {
    setEditingEquipment(equip);
    setEquipForm({
      id_machine_registered: equip.id_machine_registered || '',
      designation: equip.designation || '',
      id_general_system_type: equip.id_general_system_type || '',
      id_zone_default: equip.id_zone_default || '',
      technician: equip.technician || '',
      serial_number: equip.serial_number || '',
      date_mise_en_service:
        equip.date_mise_en_service || new Date().toISOString().split('T')[0],
      compteur_heures: Number(equip.compteur_heures ?? equip.compteur_actuel ?? 0) || 0,
      compteur_unite_defaut:
        (equip.compteur_unite_defaut as 'HEURES' | 'CYCLES' | 'TONNES' | 'KM') || 'HEURES',
      status: equip.status || 'En Service',
    });
    setEquipFormError('');
    setShowEquipmentModal(true);
  };

  // Submit Equipment Create / Edit
  const handleSaveEquipment = (e: React.FormEvent) => {
    e.preventDefault();
    setEquipFormError('');

    const code = String(equipForm.id_machine_registered || '').trim().toUpperCase();
    const designation = String(equipForm.designation || '').trim();
    const sysTypeId = String(equipForm.id_general_system_type || '').trim();
    const zoneId = String(equipForm.id_zone_default || '').trim();

    if (!sysTypeId) {
      setEquipFormError('Veuillez sélectionner un type de système général (ex: AIR, SEC, EAU).');
      return;
    }
    if (!code) {
      setEquipFormError("Le code de l'équipement est obligatoire (ex: AIR-01).");
      return;
    }
    if (!designation) {
      setEquipFormError("La désignation de l'équipement est obligatoire.");
      return;
    }
    if (!zoneId) {
      setEquipFormError('Veuillez affecter une zone géographique réelle.');
      return;
    }

    if (!editingEquipment) {
      const duplicate = (machines || []).some(
        (m) => String(m.id_machine_registered || '').toUpperCase() === code
      );
      if (duplicate) {
        setEquipFormError(`Le code "${code}" est déjà utilisé par un actif enregistré.`);
        return;
      }

      const newEquipmentPayload = {
        id_machine_registered: code,
        designation,
        asset_class: 'SYSTEM_GENERAL' as const,
        id_general_system_type: sysTypeId,
        id_family: '',
        id_templates: '',
        id_blueprint: '',
        id_zone_default: zoneId,
        technician: equipForm.technician || '',
        serial_number: String(equipForm.serial_number || '').trim(),
        date_mise_en_service: equipForm.date_mise_en_service || '',
        compteur_heures: Math.max(0, Number(equipForm.compteur_heures) || 0),
        compteur_actuel: Math.max(0, Number(equipForm.compteur_heures) || 0),
        compteur_unite_defaut: equipForm.compteur_unite_defaut || 'HEURES',
        status: equipForm.status || 'En Service',
        asset_level: 'MACHINE' as const,
        parent_id: null,
        is_active: true,
        archived: false,
      };

      const res = handleAddMachine(newEquipmentPayload);
      if (res !== false) {
        setShowEquipmentModal(false);
        showToast?.(`Équipement ${code} créé avec succès`, 'success');
      }
    } else {
      const updatedPayload = {
        ...editingEquipment,
        designation,
        asset_class: 'SYSTEM_GENERAL' as const,
        id_general_system_type: sysTypeId,
        id_zone_default: zoneId,
        technician: equipForm.technician || '',
        serial_number: String(equipForm.serial_number || '').trim(),
        date_mise_en_service: equipForm.date_mise_en_service || '',
        compteur_heures: Math.max(0, Number(equipForm.compteur_heures) || 0),
        compteur_actuel: Math.max(0, Number(equipForm.compteur_heures) || 0),
        compteur_unite_defaut: equipForm.compteur_unite_defaut || 'HEURES',
        status: equipForm.status || 'En Service',
      };

      const res = handleUpdateMachine(editingEquipment.id_machine_registered, updatedPayload);
      if (res !== false) {
        setShowEquipmentModal(false);
        setEditingEquipment(null);
        showToast?.(`Équipement ${editingEquipment.id_machine_registered} mis à jour`, 'success');
      }
    }
  };

  // Reactivate archived equipment
  const handleReactivateEquipment = (equip: IMachine) => {
    const { updatedMachine } = transitionMachineLifecycle({
      machine: equip,
      targetStatus: 'En Service',
      preventiveTasks,
    });
    handleUpdateMachine(equip.id_machine_registered, {
      ...updatedMachine,
      status: 'En Service',
    });
    showToast?.(`Équipement ${equip.id_machine_registered} réactivé en service`, 'success');
  };

  // Open Create / Edit System Type Modal
  const openCreateTypeModal = () => {
    setEditingType(null);
    setTypeForm({ code: '', name: '' });
    setTypeFormError('');
    setShowTypeModal(true);
  };

  const openEditTypeModal = (sysType: IGeneralSystemType) => {
    setEditingType(sysType);
    setTypeForm({
      code: sysType.code || '',
      name: sysType.name || '',
    });
    setTypeFormError('');
    setShowTypeModal(true);
  };

  const handleSaveSystemType = (e: React.FormEvent) => {
    e.preventDefault();
    setTypeFormError('');

    const cleanCode = String(typeForm.code || '')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9_-]/g, '');
    const cleanName = String(typeForm.name || '').trim();

    if (!cleanCode || cleanCode.length < 2) {
      setTypeFormError('Le code préfixe doit contenir au moins 2 caractères (ex: AIR, SEC, EAU).');
      return;
    }
    if (!cleanName) {
      setTypeFormError('Le libellé du système général est obligatoire.');
      return;
    }

    if (!editingType) {
      const duplicate = (generalSystemTypes || []).some(
        (t) => String(t.code || '').toUpperCase() === cleanCode
      );
      if (duplicate) {
        setTypeFormError(`Le code préfixe "${cleanCode}" existe déjà.`);
        return;
      }
      const created = handleAddGeneralSystemType({ code: cleanCode, name: cleanName });
      if (created) {
        setShowTypeModal(false);
        showToast?.(`Type de système ${cleanCode} ajouté`, 'success');
      }
    } else {
      const duplicate = (generalSystemTypes || []).some(
        (t) => t.id !== editingType.id && String(t.code || '').toUpperCase() === cleanCode
      );
      if (duplicate) {
        setTypeFormError(`Le code préfixe "${cleanCode}" est déjà utilisé par un autre type.`);
        return;
      }
      if (setGeneralSystemTypes) {
        setGeneralSystemTypes((prev: IGeneralSystemType[]) =>
          (prev || []).map((t) =>
            t.id === editingType.id ? { ...t, code: cleanCode, name: cleanName } : t
          )
        );
        setShowTypeModal(false);
        setEditingType(null);
        showToast?.(`Type de système ${cleanCode} mis à jour`, 'success');
      }
    }
  };

  // Excel export for SYSTEM_GENERAL equipments
  const handleExportExcel = () => {
    const rows = sortedEquipments.map((m) => {
      const sysType = systemTypeMap.get(String(m.id_general_system_type || ''));
      const zoneObj = zoneMap.get(String(m.id_zone_default || ''));
      const techObj = techMap.get(String(m.technician || ''));
      return {
        'Code Équipement (B)': m.id_machine_registered,
        'Désignation (C)': m.designation,
        'Type Système (D)': sysType
          ? `[${sysType.code}] ${sysType.name}`
          : m.id_general_system_type || '',
        'Zone Réelle (E)': zoneObj
          ? `${zoneObj.name} (${zoneObj.id})`
          : m.id_zone_default || '',
        'Technicien (F)': techObj ? `${techObj.name} (${techObj.id})` : m.technician || 'Non assigné',
        'N° Série': m.serial_number || '',
        'Mise en Service': m.date_mise_en_service || '',
        'Statut (H)': isArchivedMachine(m) ? 'ARCHIVEE' : m.status || 'En Service',
      };
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Equipements_SysGeneral');
    XLSX.writeFile(
      wb,
      `GMAO_Equipements_Systeme_General_${new Date().toISOString().slice(0, 10)}.xlsx`
    );
  };

  // Canonical DataGrid Columns for Equipments (matching UtilisateursView 100%)
  const equipmentColumns = useMemo<GmaoColumn<IMachine>[]>(() => {
    return [
      {
        key: 'id_machine_registered',
        label: 'Code Équip.',
        colLetter: 'B',
        icon: Hash,
        sortable: true,
        width: '140px',
        render: (m) => {
          const isFocused =
            focusedEquipmentId &&
            String(m.id_machine_registered).toUpperCase() ===
              String(focusedEquipmentId).toUpperCase();
          return (
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-mono font-bold text-xs border shadow-2xs ${
                isFocused
                  ? 'bg-amber-50 text-amber-900 border-amber-400 ring-2 ring-amber-400/30'
                  : 'bg-slate-100 text-slate-900 border-slate-200/90'
              }`}
            >
              <ShieldAlert className="w-3 h-3 text-amber-600 shrink-0" />
              <span>{m.id_machine_registered}</span>
            </span>
          );
        },
      },
      {
        key: 'designation',
        label: 'Désignation & Série',
        colLetter: 'C',
        icon: Wrench,
        sortable: true,
        render: (m) => {
          const archived = isArchivedMachine(m);
          const compteur = Number(m.compteur_actuel ?? m.compteur_heures ?? 0);
          const unite = m.compteur_unite_defaut || 'HEURES';
          return (
            <div className="flex items-center gap-2.5 min-w-[200px]">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 border shadow-2xs bg-amber-50 text-amber-700 border-amber-200">
                <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
              </div>
              <div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span
                    className={`font-bold text-xs sm:text-[12.5px] leading-tight ${
                      archived ? 'text-slate-400 line-through' : 'text-slate-900'
                    }`}
                  >
                    {m.designation}
                  </span>
                  {archived && (
                    <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 text-[9.5px] font-mono font-bold uppercase">
                      Archivé
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-slate-400 font-mono flex items-center gap-2 mt-0.5">
                  <span>S/N: {m.serial_number || '—'}</span>
                  {m.date_mise_en_service && <span>• Svc: {m.date_mise_en_service}</span>}
                  {compteur > 0 && (
                    <span className="text-slate-600 font-bold">
                      • {compteur.toLocaleString()} {unite}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        },
      },
      {
        key: 'id_general_system_type',
        label: 'Type Système',
        colLetter: 'D',
        icon: Layers,
        sortable: true,
        render: (m) => {
          const sysType = systemTypeMap.get(String(m.id_general_system_type || ''));
          return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-2xs">
              <Layers className="w-3 h-3 text-indigo-600 shrink-0" />
              <span>
                {sysType
                  ? `[${sysType.code}] ${sysType.name}`
                  : m.id_general_system_type || 'SYSTÈME GÉNÉRAL'}
              </span>
            </span>
          );
        },
      },
      {
        key: 'id_zone_default',
        label: 'Zone Réelle',
        colLetter: 'E',
        icon: MapPin,
        sortable: true,
        render: (m) => {
          const zoneObj = zoneMap.get(String(m.id_zone_default || ''));
          const zId = m.id_zone_default || '—';
          return (
            <button
              type="button"
              onClick={() => m.id_zone_default && onNavigateToZone?.(m.id_zone_default)}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-700 bg-slate-100 hover:bg-emerald-50 hover:border-emerald-200 px-2 py-0.5 rounded-md border border-slate-200 shadow-2xs transition cursor-pointer"
              title="Voir la zone géographique réelle"
            >
              <MapPin className="w-2.5 h-2.5 text-emerald-600 shrink-0" />
              <span className="font-semibold text-slate-800">
                {zoneObj ? zoneObj.name : zId}
              </span>
              {zoneObj && <span className="text-[10px] font-mono text-slate-400">({zId})</span>}
            </button>
          );
        },
      },
      {
        key: 'technician',
        label: 'Technicien Référent',
        colLetter: 'F',
        icon: UserCheck,
        sortable: true,
        render: (m) => {
          const techObj = techMap.get(String(m.technician || ''));
          if (!m.technician) {
            return (
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <Sparkles className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                <span>— Équipe Générale —</span>
              </div>
            );
          }
          return (
            <div className="flex items-center gap-1.5 text-xs">
              <UserCheck className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span className="font-semibold text-slate-800">
                {techObj ? techObj.name : m.technician}
              </span>
              {techObj && (
                <span className="text-[10px] font-mono text-slate-400">({techObj.id})</span>
              )}
            </div>
          );
        },
      },
      {
        key: 'flux',
        label: 'Flux PM / BT / PDR',
        colLetter: 'G',
        icon: Calendar,
        align: 'center',
        render: (m) => {
          const code = m.id_machine_registered;
          const pmCount = (preventiveTasks || []).filter((t) => t.machine === code).length;
          const woCount = (correctiveInterventions || []).filter(
            (i) => (i.machine_code || i.machine) === code
          ).length;
          const movCount = (mouvements || []).filter(
            (mv) => mv.machine === code && mv.type === 'Sortie'
          ).length;
          return (
            <div className="flex items-center justify-center gap-1">
              <span
                className="px-2 py-0.5 rounded-md text-[10.5px] font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/80 shadow-2xs"
                title="Plans préventifs rattachés"
              >
                {pmCount} PM
              </span>
              <span
                className="px-2 py-0.5 rounded-md text-[10.5px] font-mono font-bold bg-rose-50 text-rose-700 border border-rose-200/80 shadow-2xs"
                title="Bons de travail / interventions correctives"
              >
                {woCount} BT
              </span>
              <span
                className="px-2 py-0.5 rounded-md text-[10.5px] font-mono font-bold bg-amber-50 text-amber-800 border border-amber-200/80 shadow-2xs"
                title="Sorties PDR rattachées"
              >
                {movCount} PDR
              </span>
            </div>
          );
        },
      },
      {
        key: 'status',
        label: 'Statut',
        colLetter: 'H',
        icon: CheckCircle2,
        sortable: true,
        align: 'center',
        render: (m) => {
          const archived = isArchivedMachine(m);
          if (archived) {
            return (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600 border border-slate-200 shadow-2xs">
                <Archive className="w-3 h-3 text-slate-500 shrink-0" />
                <span>Archivé</span>
              </span>
            );
          }
          if (m.status === 'En Service') {
            return (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-2xs">
                <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                <span>En Service</span>
              </span>
            );
          }
          if (m.status === 'En Maintenance') {
            return (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200 shadow-2xs">
                <Wrench className="w-3 h-3 text-amber-600 shrink-0" />
                <span>Maintenance</span>
              </span>
            );
          }
          return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-50 text-rose-800 border border-rose-200 shadow-2xs">
              <PowerOff className="w-3 h-3 text-rose-600 shrink-0" />
              <span>{m.status || "À l'Arrêt"}</span>
            </span>
          );
        },
      },
      {
        key: 'actions',
        label: 'Actions',
        align: 'center',
        headerClassName: 'w-32 text-center font-bold text-slate-400 tracking-widest select-none',
        render: (m) => {
          const archived = isArchivedMachine(m);
          return (
            <div className="flex items-center justify-center gap-1.5">
              {!archived && onNavigateToPreventive && (
                <button
                  type="button"
                  onClick={() => onNavigateToPreventive(m.id_machine_registered)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-200 transition cursor-pointer shadow-2xs"
                  title="Planifier / Voir Préventif"
                >
                  <Calendar className="w-3.5 h-3.5" />
                </button>
              )}
              {!archived && onNavigateToQuickSortie && (
                <button
                  type="button"
                  onClick={() => onNavigateToQuickSortie(m.id_machine_registered)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-amber-700 hover:bg-amber-50 border border-slate-200 hover:border-amber-200 transition cursor-pointer shadow-2xs"
                  title="Sortie PDR pour cet équipement"
                >
                  <Wrench className="w-3.5 h-3.5" />
                </button>
              )}
              {canEdit && archived && (
                <button
                  type="button"
                  onClick={() => handleReactivateEquipment(m)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-emerald-600 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition cursor-pointer shadow-2xs"
                  title="Réactiver cet équipement archivé"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              )}
              {canEdit && !archived && (
                <button
                  type="button"
                  onClick={() => openEditEquipmentModal(m)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 transition cursor-pointer shadow-2xs"
                  title="Modifier l'équipement"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
              )}
              {(canDelete || canEdit) && !archived && (
                <button
                  type="button"
                  onClick={() => setArchiveTarget(m)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 transition cursor-pointer shadow-2xs"
                  title="Supprimer / Archiver l'équipement"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          );
        },
      },
    ];
  }, [
    focusedEquipmentId,
    systemTypeMap,
    zoneMap,
    techMap,
    preventiveTasks,
    correctiveInterventions,
    mouvements,
    canEdit,
    canDelete,
    onNavigateToZone,
    onNavigateToPreventive,
    onNavigateToQuickSortie,
  ]);

  // Canonical DataGrid Columns for System Types
  const systemTypeColumns = useMemo<GmaoColumn<IGeneralSystemType>[]>(() => {
    return [
      {
        key: 'code',
        label: 'Préfixe Code',
        colLetter: 'B',
        icon: Hash,
        sortable: true,
        width: '150px',
        render: (t) => (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-mono font-bold text-xs bg-slate-100 text-slate-900 border border-slate-200/90 shadow-2xs">
            <Hash className="w-3 h-3 text-indigo-600 shrink-0" />
            <span>{t.code}</span>
          </span>
        ),
      },
      {
        key: 'name',
        label: 'Libellé du Système Général',
        colLetter: 'C',
        icon: Layers,
        sortable: true,
        render: (t) => (
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 border shadow-2xs bg-indigo-50 text-indigo-700 border-indigo-200">
              <Settings2 className="w-3.5 h-3.5 text-indigo-600" />
            </div>
            <div>
              <span className="font-bold text-slate-900 text-xs sm:text-[12.5px] block leading-tight">
                {t.name}
              </span>
              <span className="text-[10px] font-mono text-slate-400">ID: {t.id}</span>
            </div>
          </div>
        ),
      },
      {
        key: 'example',
        label: 'Format Séquentiel',
        colLetter: 'D',
        icon: Tag,
        align: 'center',
        render: (t) => (
          <span className="px-2.5 py-1 rounded-md bg-slate-100 border border-slate-200 font-mono text-xs font-bold text-slate-700 shadow-2xs">
            {t.code}-01, {t.code}-02…
          </span>
        ),
      },
      {
        key: 'count',
        label: 'Équipements Rattachés',
        colLetter: 'E',
        icon: ShieldAlert,
        sortable: true,
        align: 'center',
        render: (t) => {
          const count = equipCountByType[t.id] || 0;
          return (
            <button
              type="button"
              onClick={() => {
                setSystemTypeFilter(t.id);
                setActiveSection('equipments');
              }}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 transition cursor-pointer shadow-2xs font-mono"
              title="Filtrer les équipements de ce type"
            >
              <span>
                {count} équipement{count > 1 ? 's' : ''}
              </span>
            </button>
          );
        },
      },
      {
        key: 'status',
        label: 'Statut',
        colLetter: 'F',
        icon: CheckCircle2,
        align: 'center',
        render: (t) => {
          const isAct = t.is_active !== false;
          return isAct ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-2xs">
              <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
              <span>Actif</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-500 border border-slate-200 shadow-2xs">
              <span>Inactif</span>
            </span>
          );
        },
      },
      {
        key: 'actions',
        label: 'Actions',
        align: 'center',
        headerClassName: 'w-32 text-center font-bold text-slate-400 tracking-widest select-none',
        render: (t) => {
          const isAct = t.is_active !== false;
          return (
            <div className="flex items-center justify-center gap-1.5">
              {canCreate && isAct && (
                <button
                  type="button"
                  onClick={() => openCreateEquipmentModal(t.id)}
                  className="h-7 px-2 rounded-lg flex items-center justify-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 transition cursor-pointer shadow-2xs font-mono"
                  title="Créer un équipement de ce type"
                >
                  <Plus className="w-3 h-3" />
                  <span>{t.code}</span>
                </button>
              )}
              {canEdit && (
                <button
                  type="button"
                  onClick={() => openEditTypeModal(t)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 transition cursor-pointer shadow-2xs"
                  title="Modifier le code ou libellé"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
              )}
              {canEdit && (
                <button
                  type="button"
                  onClick={() => handleToggleGeneralSystemType(t.id)}
                  className={`w-7 h-7 rounded-lg flex items-center justify-center border transition cursor-pointer shadow-2xs ${
                    isAct
                      ? 'text-emerald-600 bg-emerald-50/60 border-emerald-200 hover:bg-emerald-100'
                      : 'text-slate-400 bg-slate-50 border-slate-200 hover:text-emerald-600 hover:border-emerald-200'
                  }`}
                  title={isAct ? 'Désactiver ce type' : 'Activer ce type'}
                >
                  {isAct ? (
                    <ToggleRight className="w-4 h-4" />
                  ) : (
                    <ToggleLeft className="w-4 h-4" />
                  )}
                </button>
              )}
            </div>
          );
        },
      },
    ];
  }, [equipCountByType, canCreate, canEdit, handleToggleGeneralSystemType]);

  // Dependencies for archive modal
  const archiveDependencies = useMemo(() => {
    if (!archiveTarget) return null;
    return dataIntegrityService.getMachineDependencies(archiveTarget.id_machine_registered, {
      mouvements,
      preventiveTasks,
      correctiveInterventions,
    });
  }, [archiveTarget, mouvements, preventiveTasks, correctiveInterventions]);

  const confirmArchiveOrDelete = () => {
    if (!archiveTarget) return;
    const code = archiveTarget.id_machine_registered;
    const hasHistory = archiveDependencies?.hasHistory;

    if (hasHistory) {
      const { updatedMachine } = transitionMachineLifecycle({
        machine: archiveTarget,
        targetStatus: 'ARCHIVEE',
        preventiveTasks,
      });
      handleUpdateMachine(code, updatedMachine);
      showToast?.(
        `Équipement ${code} archivé en toute sécurité (historique préservé)`,
        'info'
      );
    } else {
      handleDeleteMachine(code);
      showToast?.(`Équipement ${code} supprimé`, 'success');
    }
    setArchiveTarget(null);
  };

  const hasActiveEquipFilters =
    Boolean(searchTerm) ||
    statusFilter !== 'ALL' ||
    systemTypeFilter !== 'ALL' ||
    zoneFilter !== 'ALL' ||
    sortField !== 'id_machine_registered' ||
    sortOrder !== 'asc';

  return (
    <AnimatedPage className="space-y-5">
      {/* 1. FLOATING HEADER CARD (matching UtilisateursView) */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 md:p-6 shadow-[0_12px_32px_-6px_rgba(0,0,0,0.12),0_4px_12px_-2px_rgba(0,0,0,0.06)] hover:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.16),0_6px_16px_-3px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-300 ease-out flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-4 w-full relative overflow-hidden group/header">
        {/* Subtle Ambient Gradient Background Highlight */}
        <div className="absolute -top-12 -right-12 w-48 h-48 bg-amber-500/5 rounded-full blur-2xl pointer-events-none group-hover/header:bg-amber-500/10 transition-colors duration-500" />

        <div className="flex items-center gap-3 min-w-0 relative">
          <PageHeaderIcon icon={ShieldAlert} colorClass="text-amber-600" />
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                Équipements & Système Général
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-50 text-amber-800 border border-amber-200">
                SYS-GEN
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Référentiel des utilités d&apos;usine (air comprimé, sécurité incendie, traitement d&apos;eau, groupes électrogènes) rattachées aux zones réelles.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          {/* Integrated Section Switcher */}
          <div className="p-1 bg-slate-100 rounded-xl border border-slate-200/80 inline-flex items-center gap-1">
            <button
              type="button"
              onClick={() => setActiveSection('equipments')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition cursor-pointer ${
                activeSection === 'equipments'
                  ? 'bg-white text-slate-900 font-bold shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800 font-semibold'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
              <span>Équipements</span>
              <span className="px-1.5 py-0.2 rounded bg-amber-50 text-amber-800 border border-amber-200/70 text-[10px] font-mono font-bold">
                {kpiStats.totalActive}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setActiveSection('types')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition cursor-pointer ${
                activeSection === 'types'
                  ? 'bg-white text-slate-900 font-bold shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800 font-semibold'
              }`}
            >
              <Settings2 className="w-3.5 h-3.5 text-indigo-600" />
              <span>Types Système</span>
              <span className="px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-800 border border-indigo-200/70 text-[10px] font-mono font-bold">
                {kpiStats.totalTypesCount}
              </span>
            </button>
          </div>

          <FormulasModalButton
            onClick={() => setShowFormulasModal(true)}
            title="Voir les formules Excel & règles d'architecture Système Général"
          />

          {canCreate && (
            <>
              <Action3DButton
                variant="circle"
                color="indigo"
                icon={Tag}
                showAddBadge={true}
                onClick={openCreateTypeModal}
                title="Ajouter un Type de Système Général (AIR, SEC, EAU...)"
              />
              <Action3DButton
                variant="circle"
                color="amber"
                icon={ShieldAlert}
                showAddBadge={true}
                onClick={() => openCreateEquipmentModal()}
                title="Ajouter un Nouvel Équipement Système Général"
              />
            </>
          )}
        </div>
      </div>

      {/* 2. UNIFIED 4-TIER INTERACTIVE KPI BAR */}
      <GmaoKpiGrid columns={4}>
        {/* Card 1: Total Equipments */}
        <GmaoKpiCard
          title="Équipements Installés"
          value={kpiStats.totalActive}
          unit="équip."
          icon={ShieldAlert}
          color="slate"
          valueColored={false}
          isActive={activeSection === 'equipments' && statusFilter === 'ALL'}
          onClick={() => {
            setActiveSection('equipments');
            setStatusFilter('ALL');
          }}
          badgeText="Registre Actif (SSOT)"
          footerLabel="Feuille Machines :"
          footerValue="Classe SYSTEM_GENERAL"
        />

        {/* Card 2: En Service */}
        <GmaoKpiCard
          title="En Service Opérationnel"
          value={kpiStats.enService}
          unit="actifs"
          icon={CheckCircle2}
          color="emerald"
          isActive={activeSection === 'equipments' && statusFilter === 'En Service'}
          onClick={() => {
            setActiveSection('equipments');
            setStatusFilter(statusFilter === 'En Service' ? 'ALL' : 'En Service');
          }}
          badgeText={
            kpiStats.totalActive > 0
              ? `${Math.round((kpiStats.enService / kpiStats.totalActive) * 100)}% Disponibilité`
              : 'Utilités Usine'
          }
          footerLabel="Interventions :"
          footerValue="Éligibles PM & BT"
        />

        {/* Card 3: Maintenance / Alerte */}
        <GmaoKpiCard
          title="Maintenance / À l'Arrêt"
          value={kpiStats.attentionCount}
          unit="alerte"
          icon={AlertTriangle}
          color={kpiStats.attentionCount > 0 ? 'rose' : 'amber'}
          isActive={
            activeSection === 'equipments' &&
            (statusFilter === 'ALERTE' ||
              statusFilter === 'En Maintenance' ||
              statusFilter === "À l'Arrêt")
          }
          onClick={() => {
            setActiveSection('equipments');
            setStatusFilter(statusFilter === 'ALERTE' ? 'ALL' : 'ALERTE');
          }}
          badgeText={`${kpiStats.enMaintenance} Maint. • ${kpiStats.enArret} Arrêt`}
          footerLabel="Cycle de vie :"
          footerValue={`${kpiStats.archivedCount} archivé(s)`}
        />

        {/* Card 4: System Types */}
        <GmaoKpiCard
          title="Types de Système"
          value={kpiStats.activeTypesCount}
          unit={`/ ${kpiStats.totalTypesCount} types`}
          icon={Layers}
          color="indigo"
          isActive={activeSection === 'types'}
          onClick={() => setActiveSection(activeSection === 'types' ? 'equipments' : 'types')}
          badgeText="Préfixes Auto-Code"
          footerLabel="Codification :"
          footerValue="AIR • SEC • EAU • ECL"
        />
      </GmaoKpiGrid>

      {/* 3A. SECTION 1: EQUIPMENTS INSTALLED */}
      {activeSection === 'equipments' && (
        <>
          {/* Elevated Filter & Search Card (matching UtilisateursView) */}
          <div className="relative z-30 bg-white border border-slate-200 rounded-2xl p-4 md:p-5 shadow-[0_12px_32px_-6px_rgba(0,0,0,0.12),0_4px_12px_-2px_rgba(0,0,0,0.06)] hover:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.16),0_6px_16px_-3px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-300 ease-out space-y-4">
            {/* Header Toolbar: Icon + Title + Count Badge + Status Presets + Excel Export + Circular Reset */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-200/80 flex items-center justify-center text-amber-700 shadow-2xs shrink-0">
                  <SlidersHorizontal className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="text-xs font-black uppercase tracking-wider text-slate-800">
                      Filtres & Recherche Équipements
                    </span>
                    <span className="bg-amber-50 text-amber-800 px-2.5 py-0.5 rounded-lg text-[11px] font-bold border border-amber-200/70 shadow-2xs font-mono">
                      {filteredEquipments.length} / {systemGeneralEquipments.length}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 font-medium">
                    Filtrage multicritères par code, utilité, zone réelle, statut opérationnel et tri Excel
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {/* Status Preset Pills */}
                <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-slate-100 border border-slate-200/70">
                  {[
                    { id: 'ALL', label: 'Actifs', count: kpiStats.totalActive },
                    { id: 'En Service', label: 'En Service', count: kpiStats.enService },
                    { id: 'En Maintenance', label: 'Maintenance', count: kpiStats.enMaintenance },
                    { id: "À l'Arrêt", label: "À l'Arrêt", count: kpiStats.enArret },
                    { id: 'ARCHIVEE', label: 'Archivés', count: kpiStats.archivedCount },
                  ].map((pill) => {
                    const isSelected = statusFilter === pill.id;
                    return (
                      <button
                        key={pill.id}
                        type="button"
                        onClick={() => setStatusFilter(pill.id)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                          isSelected
                            ? 'bg-white text-slate-900 shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <span>{pill.label}</span>
                        <span className="text-[10px] font-mono px-1 rounded bg-slate-200/70 text-slate-700">
                          {pill.count}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Export Excel Button */}
                <button
                  type="button"
                  onClick={handleExportExcel}
                  disabled={filteredEquipments.length === 0}
                  className="h-8 px-3 rounded-xl border border-emerald-200/80 bg-emerald-50 hover:bg-emerald-100 disabled:opacity-40 text-emerald-800 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs active:scale-95"
                  title="Exporter la liste filtrée vers Excel (.xlsx)"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Export Excel</span>
                </button>

                {/* Circular Reset Button */}
                {hasActiveEquipFilters && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchTerm('');
                      setStatusFilter('ALL');
                      setSystemTypeFilter('ALL');
                      setZoneFilter('ALL');
                      setFocusedEquipmentId(null);
                      setSortField('id_machine_registered');
                      setSortOrder('asc');
                    }}
                    title="Réinitialiser tous les filtres et le tri"
                    className="w-8 h-8 rounded-full border border-rose-200/80 bg-rose-50 hover:bg-rose-100 text-rose-700 transition flex items-center justify-center cursor-pointer shadow-2xs active:scale-95 animate-in fade-in shrink-0"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* 4-Column Filter Grid with Col. X badges & Amber Prefix Icons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
              {/* 1. Search Input */}
              <div className="relative w-full">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-800">
                    Recherche Globale
                  </label>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wide bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs font-mono">
                    Col. B+C+F
                  </span>
                </div>
                <div className="relative flex items-center">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-md bg-amber-100 border border-amber-300/80 flex items-center justify-center text-amber-700 shadow-2xs pointer-events-none z-10">
                    <Search className="w-3 h-3" />
                  </span>
                  <input
                    type="text"
                    placeholder="AIR-01, Compresseur, S/N, Technicien..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full h-10 pl-9 pr-8 text-xs font-medium text-slate-800 placeholder-slate-400 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-amber-500 focus:bg-white focus:ring-2 focus:ring-amber-500/20 transition"
                  />
                  {searchTerm && (
                    <button
                      type="button"
                      onClick={() => setSearchTerm('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer z-10"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* 2. System Type Select */}
              <div className="w-full">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-800">
                    Type de Système
                  </label>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wide bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs font-mono">
                    Col. D
                  </span>
                </div>
                <CustomSelect
                  prefixIcon={
                    <span className="w-5 h-5 rounded-md bg-amber-100 border border-amber-300/80 flex items-center justify-center text-amber-700 shadow-2xs shrink-0">
                      <Layers className="w-3 h-3" />
                    </span>
                  }
                  options={[
                    { value: 'ALL', label: 'Tous les systèmes généraux' },
                    ...(generalSystemTypes || []).map((t) => ({
                      value: t.id,
                      label: `[D] ${t.code} — ${t.name} (${equipCountByType[t.id] || 0})`,
                    })),
                  ]}
                  value={systemTypeFilter}
                  onChange={setSystemTypeFilter}
                />
              </div>

              {/* 3. Zone Select */}
              <div className="w-full">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-800">
                    Zone Géographique
                  </label>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wide bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs font-mono">
                    Col. E
                  </span>
                </div>
                <CustomSelect
                  prefixIcon={
                    <span className="w-5 h-5 rounded-md bg-amber-100 border border-amber-300/80 flex items-center justify-center text-amber-700 shadow-2xs shrink-0">
                      <MapPin className="w-3 h-3" />
                    </span>
                  }
                  options={[
                    { value: 'ALL', label: 'Toutes les zones réelles' },
                    ...normalizedZones.map((z, idx) => ({
                      value: z.id || `zone-${idx}`,
                      label: `[E] ${z.name} (${z.id})`,
                    })),
                  ]}
                  value={zoneFilter}
                  onChange={setZoneFilter}
                />
              </div>

              {/* 4. Sort Dropdown (Tri) */}
              <div className="w-full relative" ref={sortMenuRef}>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-800">
                    Tri Dynamique
                  </label>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wide bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs font-mono">
                    {sortOrder === 'asc' ? 'A → Z' : 'Z → A'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowSortMenu(!showSortMenu)}
                  className={`w-full h-10 px-3 rounded-xl border text-xs font-semibold transition flex items-center justify-between cursor-pointer ${
                    showSortMenu ||
                    sortField !== 'id_machine_registered' ||
                    sortOrder !== 'asc'
                      ? 'bg-amber-50 text-amber-800 border-amber-300 ring-1 ring-amber-200 shadow-2xs'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className="w-5 h-5 rounded-md bg-amber-100 border border-amber-300/80 flex items-center justify-center text-amber-700 shadow-2xs shrink-0">
                      <ArrowUpDown className="w-3 h-3" />
                    </span>
                    <span className="truncate">
                      Tri :{' '}
                      <b className="font-mono text-slate-900">
                        {sortField === 'id_machine_registered'
                          ? 'CODE (B)'
                          : sortField === 'designation'
                            ? 'DÉSIGNATION (C)'
                            : sortField === 'id_general_system_type'
                              ? 'SYSTÈME (D)'
                              : sortField === 'id_zone_default'
                                ? 'ZONE (E)'
                                : 'STATUT (H)'}
                      </b>
                    </span>
                  </div>
                  <ChevronDown
                    className={`w-3.5 h-3.5 text-slate-400 transition-transform shrink-0 ${
                      showSortMenu ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {showSortMenu && (
                  <div className="absolute left-0 right-0 mt-2 bg-white rounded-2xl border border-slate-200 shadow-xl z-50 p-3 space-y-2 animate-in fade-in slide-in-from-top-2 duration-150">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      <span className="flex items-center gap-1.5 text-slate-700 font-semibold">
                        <SlidersHorizontal className="w-3.5 h-3.5 text-amber-700" />
                        Trier par colonne Excel
                      </span>
                    </div>
                    <div className="grid grid-cols-1 gap-1 text-xs">
                      {[
                        { field: 'id_machine_registered', label: 'Code Équipement (Col. B)' },
                        { field: 'designation', label: 'Désignation (Col. C)' },
                        { field: 'id_general_system_type', label: 'Type de Système (Col. D)' },
                        { field: 'id_zone_default', label: 'Zone Géographique (Col. E)' },
                        { field: 'status', label: 'Statut Opérationnel (Col. H)' },
                      ].map((opt) => (
                        <button
                          key={opt.field}
                          type="button"
                          onClick={() => handleSort(opt.field)}
                          className={`flex items-center justify-between px-3 py-2 rounded-lg font-medium transition cursor-pointer ${
                            sortField === opt.field
                              ? 'bg-amber-50 text-amber-950 border border-amber-300 font-bold'
                              : 'hover:bg-slate-50 text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          <span>{opt.label}</span>
                          {sortField === opt.field &&
                            (sortOrder === 'asc' ? (
                              <ArrowUp className="w-3 h-3 text-amber-700 shrink-0" />
                            ) : (
                              <ArrowDown className="w-3 h-3 text-amber-700 shrink-0" />
                            ))}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Active Filter Chips */}
            {(searchTerm ||
              statusFilter !== 'ALL' ||
              systemTypeFilter !== 'ALL' ||
              zoneFilter !== 'ALL') && (
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 text-xs">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Filtres actifs :
                </span>
                {searchTerm && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-800 text-xs font-semibold">
                    <Search className="w-3 h-3 text-indigo-600" />
                    Recherche: &quot;{searchTerm}&quot;
                    <button
                      type="button"
                      onClick={() => setSearchTerm('')}
                      className="hover:bg-indigo-200/60 p-0.5 rounded-full transition cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}
                {statusFilter !== 'ALL' && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-800 text-xs font-semibold">
                    <CheckCircle2 className="w-3 h-3 text-indigo-600" />
                    Statut: {statusFilter}
                    <button
                      type="button"
                      onClick={() => setStatusFilter('ALL')}
                      className="hover:bg-indigo-200/60 p-0.5 rounded-full transition cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}
                {systemTypeFilter !== 'ALL' && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-800 text-xs font-semibold">
                    <Layers className="w-3 h-3 text-indigo-600" />
                    Système: {systemTypeMap.get(systemTypeFilter)?.code || systemTypeFilter}
                    <button
                      type="button"
                      onClick={() => setSystemTypeFilter('ALL')}
                      className="hover:bg-indigo-200/60 p-0.5 rounded-full transition cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}
                {zoneFilter !== 'ALL' && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-800 text-xs font-semibold">
                    <MapPin className="w-3 h-3 text-indigo-600" />
                    Zone: {zoneMap.get(zoneFilter)?.name || zoneFilter}
                    <button
                      type="button"
                      onClick={() => setZoneFilter('ALL')}
                      className="hover:bg-indigo-200/60 p-0.5 rounded-full transition cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Unified Industrial DataGrid with TablePaginationCard */}
          <GmaoIndustrialDataGrid
            title="Registre des Équipements — Système Général"
            icon={<ShieldAlert className="w-4 h-4 text-amber-600" />}
            excelMapping="id_machine (B) | designation (C) | id_general_system_type (D) | id_zone_default (E) | technician (F) | status (H)"
            bannerColor="amber"
            columns={equipmentColumns}
            data={paginatedEquipments}
            rowKey={(m) => m.id_machine_registered}
            sortField={sortField}
            sortOrder={sortOrder}
            onSort={handleSort}
            renderSortIcon={renderSortIcon}
            startIndex={equipStartIndex}
            showRowNumber={true}
            emptyIcon={<ShieldAlert className="w-8 h-8 text-slate-300" />}
            emptyMessage={
              (generalSystemTypes || []).length === 0
                ? 'Commencez par créer un type de système (ex: AIR, SEC, EAU) puis ajoutez vos équipements.'
                : "Aucun équipement du système général ne correspond aux filtres ou n'est encore enregistré."
            }
            pagination={{
              currentPage,
              setCurrentPage,
              pageSize,
              setPageSize,
              totalItems: totalEquipItems,
              pageSizeOptions: [20, 50, 100, 200, 0],
              color: 'amber',
              itemLabel: 'équipements',
            }}
          />
        </>
      )}

      {/* 3B. SECTION 2: GENERAL SYSTEM TYPES */}
      {activeSection === 'types' && (
        <>
          <div className="relative z-30 bg-white border border-slate-200 rounded-2xl p-4 md:p-5 shadow-[0_12px_32px_-6px_rgba(0,0,0,0.12),0_4px_12px_-2px_rgba(0,0,0,0.06)] hover:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.16),0_6px_16px_-3px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-300 ease-out space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-200/80 flex items-center justify-center text-indigo-700 shadow-2xs shrink-0">
                  <SlidersHorizontal className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="text-xs font-black uppercase tracking-wider text-slate-800">
                      Catalogue des Types de Système Général
                    </span>
                    <span className="bg-indigo-50 text-indigo-800 px-2.5 py-0.5 rounded-lg text-[11px] font-bold border border-indigo-200/70 shadow-2xs font-mono">
                      {filteredSystemTypes.length} / {(generalSystemTypes || []).length}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 font-medium">
                    Préfixes de numérotation automatique (AIR-01, SEC-01, EAU-01, ECL-01…)
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200/80">
                  {(['ALL', 'ACTIVE', 'INACTIVE'] as const).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setTypeStatusFilter(st)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                        typeStatusFilter === st
                          ? 'bg-white text-slate-900 shadow-2xs'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      {st === 'ALL' ? 'Tous' : st === 'ACTIVE' ? 'Actifs' : 'Inactifs'}
                    </button>
                  ))}
                </div>

                {(typeSearchTerm || typeStatusFilter !== 'ALL') && (
                  <button
                    type="button"
                    onClick={() => {
                      setTypeSearchTerm('');
                      setTypeStatusFilter('ALL');
                    }}
                    className="w-8 h-8 rounded-full border border-rose-200/80 bg-rose-50 hover:bg-rose-100 text-rose-700 transition flex items-center justify-center cursor-pointer shadow-2xs"
                    title="Réinitialiser les filtres"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
              <div className="relative w-full">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-800">
                    Rechercher un Préfixe ou Libellé
                  </label>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wide bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs font-mono">
                    Col. B+C
                  </span>
                </div>
                <div className="relative flex items-center">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-md bg-amber-100 border border-amber-300/80 flex items-center justify-center text-amber-700 shadow-2xs pointer-events-none z-10">
                    <Search className="w-3 h-3" />
                  </span>
                  <input
                    type="text"
                    value={typeSearchTerm}
                    onChange={(e) => setTypeSearchTerm(e.target.value)}
                    placeholder="Ex: AIR, SEC, EAU, Air comprimé..."
                    className="w-full h-10 pl-9 pr-8 text-xs font-medium text-slate-800 placeholder-slate-400 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 transition"
                  />
                  {typeSearchTerm && (
                    <button
                      type="button"
                      onClick={() => setTypeSearchTerm('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer z-10"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {canCreate && (
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={openCreateTypeModal}
                    className="h-10 px-4 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition flex items-center gap-2 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Nouveau Type de Système (AIR, SEC, EAU…)</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          <GmaoIndustrialDataGrid
            title="Catalogue des Types de Système Général"
            icon={<Settings2 className="w-4 h-4 text-indigo-600" />}
            excelMapping="code (B) | name (C) | format (D) | nb_equipements (E) | is_active (F)"
            bannerColor="indigo"
            columns={systemTypeColumns}
            data={paginatedSystemTypes}
            rowKey={(t) => t.id}
            sortField={typeSortField}
            sortOrder={typeSortOrder}
            onSort={handleTypeSort}
            renderSortIcon={renderTypeSortIcon}
            startIndex={typeStartIndex}
            showRowNumber={true}
            emptyIcon={<Settings2 className="w-8 h-8 text-slate-300" />}
            emptyMessage="Créez des catégories comme AIR (Air comprimé), SEC (Sécurité incendie), EAU (Traitement d'eau) pour numéroter automatiquement vos équipements."
            pagination={{
              currentPage: typeCurrentPage,
              setCurrentPage: setTypeCurrentPage,
              pageSize: typePageSize,
              setPageSize: setTypePageSize,
              totalItems: totalTypeItems,
              pageSizeOptions: [20, 50, 100, 0],
              color: 'indigo',
              itemLabel: 'types de système',
            }}
          />
        </>
      )}

      <EquipmentModals
        showFormulasModal={showFormulasModal}
        setShowFormulasModal={setShowFormulasModal}
        showEquipmentModal={showEquipmentModal}
        setShowEquipmentModal={setShowEquipmentModal}
        editingEquipment={editingEquipment}
        handleSaveEquipment={handleSaveEquipment}
        equipFormError={equipFormError}
        canCreate={canCreate}
        openCreateTypeModal={openCreateTypeModal}
        equipForm={equipForm}
        setEquipForm={setEquipForm}
        handleSelectFormSystemType={handleSelectFormSystemType}
        generalSystemTypes={generalSystemTypes}
        selectedFormSystemType={selectedFormSystemType}
        machines={machines}
        normalizedZones={normalizedZones}
        activeTechnicians={activeTechnicians}
        showTypeModal={showTypeModal}
        setShowTypeModal={setShowTypeModal}
        editingType={editingType}
        handleSaveSystemType={handleSaveSystemType}
        typeFormError={typeFormError}
        typeForm={typeForm}
        setTypeForm={setTypeForm}
        archiveTarget={archiveTarget}
        setArchiveTarget={setArchiveTarget}
        archiveDependencies={archiveDependencies}
        preventiveTasks={preventiveTasks}
        handleUpdateMachine={handleUpdateMachine}
        showToast={showToast}
        confirmArchiveOrDelete={confirmArchiveOrDelete}
      />
    </AnimatedPage>
  );
};

export default EquipmentView;
