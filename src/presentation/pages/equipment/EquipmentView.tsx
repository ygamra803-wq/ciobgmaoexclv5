import React, { useState, useMemo, useEffect } from 'react';
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
  FileDown,
  Layers,
  Tag,
  Hash,
  X,
  Check,
  Search,
  ToggleLeft,
  ToggleRight,
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
import PageHeaderIcon from '../../components/common/PageHeaderIcon';
import Action3DButton from '../../components/common/Action3DButton';
import GmaoKpiCard, { GmaoKpiGrid } from '../../components/common/GmaoKpiCard';
import IndustrialFilterCard, {
  FilterField,
  FilterSearchInput,
} from '../../components/common/IndustrialFilterCard';
import GmaoIndustrialDataGrid, {
  GmaoColumn,
} from '../../components/common/GmaoIndustrialDataGrid';
import CustomSelect from '../../components/common/CustomSelect';
import SequentialCodePicker from '../../components/common/SequentialCodePicker';

export interface EquipmentViewProps {
  machines: any[];
  generalSystemTypes: any[];
  setGeneralSystemTypes?: (updater: any) => void;
  handleAddGeneralSystemType: (payload: { code: string; name: string }) => any;
  handleToggleGeneralSystemType: (id: string) => void;
  zones: any[];
  technicians: any[];
  mouvements: any[];
  preventiveTasks: any[];
  correctiveInterventions: any[];
  handleAddMachine: (machine: any) => boolean | void;
  handleUpdateMachine: (id: string, machine: any) => boolean | void;
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

  // Filters for system types
  const [typeSearchTerm, setTypeSearchTerm] = useState('');
  const [typeStatusFilter, setTypeStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');

  // Equipment Create / Edit Modal state
  const [showEquipmentModal, setShowEquipmentModal] = useState(false);
  const [editingEquipment, setEditingEquipment] = useState<any | null>(null);
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
  const [editingType, setEditingType] = useState<any | null>(null);
  const [typeForm, setTypeForm] = useState({
    code: '',
    name: '',
  });
  const [typeFormError, setTypeFormError] = useState('');

  // Archive / Delete Confirmation Modal state
  const [archiveTarget, setArchiveTarget] = useState<any | null>(null);

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

  // Lookup maps
  const systemTypeMap = useMemo(() => {
    const map = new Map<string, any>();
    (generalSystemTypes || []).forEach((t) => {
      if (t && t.id) map.set(String(t.id), t);
    });
    return map;
  }, [generalSystemTypes]);

  const zoneMap = useMemo(() => {
    const map = new Map<string, any>();
    (zones || []).forEach((z) => {
      if (z && z.id) map.set(String(z.id), z);
    });
    return map;
  }, [zones]);

  const techMap = useMemo(() => {
    const map = new Map<string, any>();
    (technicians || []).forEach((t) => {
      if (t && t.id) map.set(String(t.id), t);
    });
    return map;
  }, [technicians]);

  const activeTechnicians = useMemo(() => {
    return (technicians || []).filter((t) => t.is_active !== false);
  }, [technicians]);

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
        if (
          !code.includes(q) &&
          !desig.includes(q) &&
          !serial.includes(q) &&
          !sysLabel.includes(q) &&
          !zoneLabel.includes(q)
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
  ]);

  // Filtered System Types
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
      (preselectedTypeId &&
        activeSystemTypes.find((t) => t.id === preselectedTypeId)) ||
      activeSystemTypes[0] ||
      null;
    const autoCode = defaultType ? generateSystemGeneralCode(defaultType, machines) : '';
    const defaultZoneId = zones[0]?.id || '';

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
  const openEditEquipmentModal = (equip: any) => {
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
      compteur_unite_defaut: equip.compteur_unite_defaut || 'HEURES',
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
  const handleReactivateEquipment = (equip: any) => {
    const reactivated = transitionMachineLifecycle(equip, 'REACTIVATE');
    handleUpdateMachine(equip.id_machine_registered, {
      ...reactivated,
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

  const openEditTypeModal = (sysType: any) => {
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
        setGeneralSystemTypes((prev: any[]) =>
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
    const rows = filteredEquipments.map((m) => {
      const sysType = systemTypeMap.get(String(m.id_general_system_type || ''));
      const zoneObj = zoneMap.get(String(m.id_zone_default || ''));
      const techObj = techMap.get(String(m.technician || ''));
      return {
        'Code Équipement': m.id_machine_registered,
        Désignation: m.designation,
        'Type Système': sysType ? `${sysType.code} - ${sysType.name}` : m.id_general_system_type || '',
        Zone: zoneObj ? `${zoneObj.id} - ${zoneObj.name}` : m.id_zone_default || '',
        Technicien: techObj ? techObj.name : m.technician || 'Non assigné',
        'N° Série': m.serial_number || '',
        'Mise en Service': m.date_mise_en_service || '',
        Statut: isArchivedMachine(m) ? 'ARCHIVEE' : m.status || 'En Service',
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

  // DataGrid Columns for Equipments
  const equipmentColumns = useMemo<GmaoColumn<any>[]>(() => {
    return [
      {
        key: 'code',
        title: 'CODE ÉQUIPEMENT (B)',
        align: 'left',
        width: '140px',
        render: (m) => {
          const isFocused =
            focusedEquipmentId &&
            String(m.id_machine_registered).toUpperCase() ===
              String(focusedEquipmentId).toUpperCase();
          return (
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md font-mono font-black text-xs tracking-wider border ${
                  isFocused
                    ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-400 ring-2 ring-amber-400/40'
                    : 'bg-slate-900 dark:bg-slate-800 text-amber-400 border-slate-700'
                }`}
              >
                <ShieldAlert className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                {m.id_machine_registered}
              </span>
            </div>
          );
        },
      },
      {
        key: 'designation',
        title: 'DÉSIGNATION & UTILITÉ (C)',
        align: 'left',
        render: (m) => {
          const sysType = systemTypeMap.get(String(m.id_general_system_type || ''));
          return (
            <div className="flex flex-col min-w-[180px]">
              <span className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                {m.designation}
              </span>
              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800/60 text-[10px] font-black uppercase tracking-wider">
                  {sysType ? `${sysType.code} · ${sysType.name}` : m.id_general_system_type || 'SYSTÈME GÉNÉRAL'}
                </span>
                {m.serial_number && (
                  <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                    S/N: {m.serial_number}
                  </span>
                )}
              </div>
            </div>
          );
        },
      },
      {
        key: 'zone_tech',
        title: 'ZONE & TECHNICIEN (F+G)',
        align: 'left',
        render: (m) => {
          const zoneObj = zoneMap.get(String(m.id_zone_default || ''));
          const techObj = techMap.get(String(m.technician || ''));
          return (
            <div className="flex flex-col gap-1">
              <button
                type="button"
                onClick={() => m.id_zone_default && onNavigateToZone?.(m.id_zone_default)}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-700 dark:text-indigo-300 hover:underline w-fit"
                title="Voir la zone géographique"
              >
                <MapPin className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                <span>{zoneObj ? `${zoneObj.id} — ${zoneObj.name}` : m.id_zone_default || 'Non affectée'}</span>
              </button>
              <div className="inline-flex items-center gap-1.5 text-[11px] text-slate-600 dark:text-slate-400">
                <UserCheck className="w-3 h-3 text-slate-400 shrink-0" />
                <span>{techObj ? techObj.name : m.technician || 'Équipe générale'}</span>
              </div>
            </div>
          );
        },
      },
      {
        key: 'mise_en_service',
        title: 'MISE EN SERVICE / COMPTEUR',
        align: 'center',
        render: (m) => {
          const compteur = Number(m.compteur_actuel ?? m.compteur_heures ?? 0);
          const unite = m.compteur_unite_defaut || 'HEURES';
          return (
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-200">
                {m.date_mise_en_service || '—'}
              </span>
              {compteur > 0 && (
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                  {compteur.toLocaleString()} {unite}
                </span>
              )}
            </div>
          );
        },
      },
      {
        key: 'flux',
        title: 'INTERVENTIONS & FLUX',
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
            <div className="flex items-center justify-center gap-1.5">
              <span
                className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200/70 dark:border-emerald-800/50"
                title="Plans préventifs rattachés"
              >
                {pmCount} PM
              </span>
              <span
                className="px-2 py-0.5 rounded text-[11px] font-bold bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200/70 dark:border-rose-800/50"
                title="Bons de travail / interventions correctives"
              >
                {woCount} BT
              </span>
              <span
                className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200/70 dark:border-amber-800/50"
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
        title: 'STATUT (H)',
        align: 'center',
        render: (m) => {
          const archived = isArchivedMachine(m);
          if (archived) {
            return (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-black uppercase bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700">
                <Archive className="w-3 h-3" /> Archivé
              </span>
            );
          }
          if (m.status === 'En Service') {
            return (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-black uppercase bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/70">
                <CheckCircle2 className="w-3 h-3 text-emerald-500" /> En Service
              </span>
            );
          }
          if (m.status === 'En Maintenance') {
            return (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-black uppercase bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/70">
                <Wrench className="w-3 h-3 text-amber-500" /> Maintenance
              </span>
            );
          }
          return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-black uppercase bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/70">
              <PowerOff className="w-3 h-3 text-rose-500" /> {m.status || "À l'Arrêt"}
            </span>
          );
        },
      },
      {
        key: 'actions',
        title: 'ACTIONS',
        align: 'center',
        width: '190px',
        render: (m) => {
          const archived = isArchivedMachine(m);
          return (
            <div className="flex items-center justify-center gap-1">
              {!archived && onNavigateToPreventive && (
                <button
                  type="button"
                  onClick={() => onNavigateToPreventive(m.id_machine_registered)}
                  className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 hover:text-emerald-600 transition-colors"
                  title="Planifier / Voir Préventif"
                >
                  <Calendar className="w-4 h-4" />
                </button>
              )}
              {!archived && onNavigateToQuickSortie && (
                <button
                  type="button"
                  onClick={() => onNavigateToQuickSortie(m.id_machine_registered)}
                  className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-amber-50 dark:hover:bg-amber-950/50 hover:text-amber-600 transition-colors"
                  title="Sortie PDR pour cet équipement"
                >
                  <Wrench className="w-4 h-4" />
                </button>
              )}
              {canEdit && !archived && (
                <button
                  type="button"
                  onClick={() => openEditEquipmentModal(m)}
                  className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 hover:text-indigo-600 transition-colors"
                  title="Modifier l'équipement"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
              )}
              {canEdit && archived && (
                <button
                  type="button"
                  onClick={() => handleReactivateEquipment(m)}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 transition-colors"
                  title="Réactiver l'équipement"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Réactiver
                </button>
              )}
              {(canDelete || canEdit) && !archived && (
                <button
                  type="button"
                  onClick={() => setArchiveTarget(m)}
                  className="p-1.5 rounded-lg text-slate-500 hover:bg-rose-50 dark:hover:bg-rose-950/50 hover:text-rose-600 transition-colors"
                  title="Archiver / Supprimer l'équipement"
                >
                  <Archive className="w-4 h-4" />
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

  // DataGrid Columns for System Types
  const systemTypeColumns = useMemo<GmaoColumn<any>[]>(() => {
    return [
      {
        key: 'code',
        title: 'PRÉFIXE CODE',
        align: 'left',
        width: '150px',
        render: (t) => (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md font-mono font-black text-xs bg-slate-900 dark:bg-slate-800 text-amber-400 border border-slate-700">
            <Hash className="w-3.5 h-3.5 text-amber-400" />
            {t.code}
          </span>
        ),
      },
      {
        key: 'name',
        title: 'LIBELLÉ DU SYSTÈME GÉNÉRAL',
        align: 'left',
        render: (t) => (
          <div className="flex flex-col">
            <span className="font-bold text-slate-900 dark:text-slate-100 text-sm">{t.name}</span>
            <span className="text-[11px] font-mono text-slate-400">ID: {t.id}</span>
          </div>
        ),
      },
      {
        key: 'example',
        title: 'FORMAT SÉQUENTIEL',
        align: 'center',
        render: (t) => (
          <span className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 font-mono text-xs font-bold text-slate-700 dark:text-slate-300">
            {t.code}-01, {t.code}-02…
          </span>
        ),
      },
      {
        key: 'count',
        title: 'ÉQUIPEMENTS RATTACHÉS',
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
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-black bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/70 dark:border-indigo-800/60 hover:bg-indigo-100 transition-colors"
            >
              {count} équipement{count > 1 ? 's' : ''}
            </button>
          );
        },
      },
      {
        key: 'status',
        title: 'STATUT',
        align: 'center',
        render: (t) => {
          const isAct = t.is_active !== false;
          return isAct ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-black uppercase bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/70">
              <CheckCircle2 className="w-3 h-3 text-emerald-500" /> Actif
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-black uppercase bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700">
              Inactif
            </span>
          );
        },
      },
      {
        key: 'actions',
        title: 'ACTIONS',
        align: 'center',
        width: '200px',
        render: (t) => {
          const isAct = t.is_active !== false;
          return (
            <div className="flex items-center justify-center gap-1.5">
              {canCreate && isAct && (
                <button
                  type="button"
                  onClick={() => openCreateEquipmentModal(t.id)}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200/70 dark:border-amber-800/60 hover:bg-amber-100 transition-colors"
                  title="Créer un équipement de ce type"
                >
                  <Plus className="w-3 h-3" /> Créer {t.code}
                </button>
              )}
              {canEdit && (
                <button
                  type="button"
                  onClick={() => openEditTypeModal(t)}
                  className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 hover:text-indigo-600 transition-colors"
                  title="Modifier le code ou libellé"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
              )}
              {canEdit && (
                <button
                  type="button"
                  onClick={() => handleToggleGeneralSystemType(t.id)}
                  className={`p-1.5 rounded-lg transition-colors ${
                    isAct
                      ? 'text-emerald-600 hover:bg-slate-100 dark:hover:bg-slate-800'
                      : 'text-slate-400 hover:bg-emerald-50 hover:text-emerald-600'
                  }`}
                  title={isAct ? 'Désactiver ce type' : 'Activer ce type'}
                >
                  {isAct ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
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
      const archivedMachine = transitionMachineLifecycle(archiveTarget, 'ARCHIVE');
      handleUpdateMachine(code, archivedMachine);
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

  return (
    <div className="space-y-5 pb-10">
      {/* 1. PAGE HEADER */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 sm:p-5 shadow-sm flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3.5">
          <PageHeaderIcon icon={ShieldAlert} color="amber" />
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight">
                Équipements & Système Général
              </h1>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border border-amber-300/70 dark:border-amber-800">
                Utilités · Sécurité · Bâtiment
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Référentiel dédié aux équipements transverses d'usine (air comprimé, sécurité incendie, traitement d'eau, groupes électrogènes) rattachés aux zones réelles.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {canCreate && (
            <>
              <Action3DButton
                icon={Tag}
                label="Nouveau Type"
                variant="secondary"
                onClick={openCreateTypeModal}
              />
              <Action3DButton
                icon={Plus}
                label="Nouvel Équipement"
                variant="amber"
                onClick={() => openCreateEquipmentModal()}
              />
            </>
          )}
        </div>
      </div>

      {/* 2. KPI SUMMARY BAR */}
      <GmaoKpiGrid columns={4}>
        <GmaoKpiCard
          title="Équipements Installés"
          value={kpiStats.totalActive}
          unit="équip."
          icon={ShieldAlert}
          color="indigo"
          active={activeSection === 'equipments' && statusFilter === 'ALL'}
          onClick={() => {
            setActiveSection('equipments');
            setStatusFilter('ALL');
          }}
        />
        <GmaoKpiCard
          title="En Service Opérationnel"
          value={kpiStats.enService}
          unit="actifs"
          icon={CheckCircle2}
          color="emerald"
          active={activeSection === 'equipments' && statusFilter === 'En Service'}
          onClick={() => {
            setActiveSection('equipments');
            setStatusFilter('En Service');
          }}
        />
        <GmaoKpiCard
          title="Maintenance / À l'Arrêt"
          value={kpiStats.attentionCount}
          unit="alerte"
          icon={AlertTriangle}
          color={kpiStats.attentionCount > 0 ? 'rose' : 'amber'}
          active={
            activeSection === 'equipments' &&
            (statusFilter === 'En Maintenance' || statusFilter === "À l'Arrêt")
          }
          onClick={() => {
            setActiveSection('equipments');
            setStatusFilter(kpiStats.enMaintenance > 0 ? 'En Maintenance' : "À l'Arrêt");
          }}
        />
        <GmaoKpiCard
          title="Types de Système"
          value={kpiStats.activeTypesCount}
          unit={`/ ${kpiStats.totalTypesCount} types`}
          icon={Layers}
          color="violet"
          active={activeSection === 'types'}
          onClick={() => setActiveSection('types')}
        />
      </GmaoKpiGrid>

      {/* 3. SEGMENTED SECTION TABS & QUICK TYPE BAR */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
        <div className="inline-flex bg-slate-100 dark:bg-slate-800/90 p-1 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
          <button
            type="button"
            onClick={() => setActiveSection('equipments')}
            className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-black transition-all ${
              activeSection === 'equipments'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
            <span>Équipements installés</span>
            <span className="px-1.5 py-0.2 rounded bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 text-[10px] font-mono">
              {kpiStats.totalActive}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSection('types')}
            className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-black transition-all ${
              activeSection === 'types'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Settings2 className="w-3.5 h-3.5 text-indigo-500" />
            <span>Types de système (AIR, SEC, EAU…)</span>
            <span className="px-1.5 py-0.2 rounded bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-300 text-[10px] font-mono">
              {kpiStats.totalTypesCount}
            </span>
          </button>
        </div>

        {/* Quick System Type Filter Chips when on Equipments section */}
        {activeSection === 'equipments' && (generalSystemTypes || []).length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            <button
              type="button"
              onClick={() => setSystemTypeFilter('ALL')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors shrink-0 ${
                systemTypeFilter === 'ALL'
                  ? 'bg-slate-900 dark:bg-amber-500 text-white dark:text-slate-950'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              Tous les systèmes
            </button>
            {(generalSystemTypes || []).map((t) => {
              const count = equipCountByType[t.id] || 0;
              const isSelected = systemTypeFilter === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSystemTypeFilter(isSelected ? 'ALL' : t.id)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors shrink-0 border ${
                    isSelected
                      ? 'bg-amber-500 text-slate-950 border-amber-500'
                      : 'bg-white dark:bg-slate-800/70 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-amber-400'
                  }`}
                >
                  <span className="font-mono font-black">{t.code}</span>
                  <span className="hidden md:inline text-[10px] opacity-80">{t.name}</span>
                  <span className="px-1 rounded bg-black/10 dark:bg-white/10 text-[10px] font-mono">
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 4A. SECTION 1: EQUIPMENTS INSTALLED */}
      {activeSection === 'equipments' && (
        <>
          <IndustrialFilterCard
            title="Filtres & Recherche Équipements"
            statusPills={[
              {
                id: 'ALL',
                label: 'Actifs',
                count: kpiStats.totalActive,
                activeClass: 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xs',
              },
              {
                id: 'En Service',
                label: 'En Service',
                count: kpiStats.enService,
                dotColor: 'bg-emerald-500',
                activeClass: 'bg-emerald-600 text-white shadow-xs',
              },
              {
                id: 'En Maintenance',
                label: 'Maintenance',
                count: kpiStats.enMaintenance,
                dotColor: 'bg-amber-500',
                activeClass: 'bg-amber-500 text-slate-950 shadow-xs',
              },
              {
                id: "À l'Arrêt",
                label: "À l'Arrêt",
                count: kpiStats.enArret,
                dotColor: 'bg-rose-500',
                activeClass: 'bg-rose-600 text-white shadow-xs',
              },
              {
                id: 'ARCHIVEE',
                label: 'Archivés',
                count: kpiStats.archivedCount,
                activeClass: 'bg-slate-700 text-white shadow-xs',
              },
            ]}
            activeStatusId={statusFilter}
            onStatusChange={setStatusFilter}
            gridCols={4}
            hasActiveFilters={
              Boolean(searchTerm) ||
              statusFilter !== 'ALL' ||
              systemTypeFilter !== 'ALL' ||
              zoneFilter !== 'ALL'
            }
            onReset={() => {
              setSearchTerm('');
              setStatusFilter('ALL');
              setSystemTypeFilter('ALL');
              setZoneFilter('ALL');
              setFocusedEquipmentId(null);
            }}
            rightActions={
              <button
                type="button"
                onClick={handleExportExcel}
                disabled={filteredEquipments.length === 0}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 hover:bg-emerald-100 disabled:opacity-40 transition-colors"
              >
                <FileDown className="w-3.5 h-3.5" />
                <span>Export XLSX</span>
              </button>
            }
          >
            <FilterField label="Recherche Omni (Code, Désignation, S/N)" colSpan={2}>
              <FilterSearchInput
                value={searchTerm}
                onChange={setSearchTerm}
                placeholder="Ex: AIR-01, Compresseur, Extincteur, S/N..."
              />
            </FilterField>

            <FilterField label="Type de Système">
              <CustomSelect
                value={systemTypeFilter}
                onChange={setSystemTypeFilter}
                options={[
                  { value: 'ALL', label: 'Tous les types de système' },
                  ...(generalSystemTypes || []).map((t) => ({
                    value: t.id,
                    label: `${t.code} — ${t.name}`,
                  })),
                ]}
              />
            </FilterField>

            <FilterField label="Zone Géographique">
              <CustomSelect
                value={zoneFilter}
                onChange={setZoneFilter}
                options={[
                  { value: 'ALL', label: 'Toutes les zones' },
                  ...(zones || []).map((z) => ({
                    value: z.id,
                    label: `${z.id} — ${z.name}`,
                  })),
                ]}
              />
            </FilterField>
          </IndustrialFilterCard>

          <GmaoIndustrialDataGrid
            columns={equipmentColumns}
            data={filteredEquipments}
            rowKey={(m) => m.id_machine_registered}
            emptyTitle="Aucun équipement du système général trouvé"
            emptySubtitle={
              (generalSystemTypes || []).length === 0
                ? "Commencez par créer un type de système (ex: AIR, SEC, EAU) puis ajoutez vos équipements."
                : "Aucun équipement ne correspond aux filtres sélectionnés ou aucun équipement n'a encore été enregistré."
            }
            footerLeft={
              <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
                Total affiché : <strong className="text-slate-900 dark:text-white">{filteredEquipments.length}</strong> équipement(s)
              </span>
            }
          />
        </>
      )}

      {/* 4B. SECTION 2: GENERAL SYSTEM TYPES */}
      {activeSection === 'types' && (
        <>
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-1 max-w-md">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={typeSearchTerm}
                  onChange={(e) => setTypeSearchTerm(e.target.value)}
                  placeholder="Rechercher un préfixe (AIR, SEC, EAU...) ou libellé..."
                  className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="inline-flex rounded-lg bg-slate-100 dark:bg-slate-800 p-0.5 border border-slate-200 dark:border-slate-700">
                {(['ALL', 'ACTIVE', 'INACTIVE'] as const).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setTypeStatusFilter(st)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors ${
                      typeStatusFilter === st
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {st === 'ALL' ? 'Tous' : st === 'ACTIVE' ? 'Actifs' : 'Inactifs'}
                  </button>
                ))}
              </div>
            </div>

            {canCreate && (
              <button
                type="button"
                onClick={openCreateTypeModal}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black bg-indigo-600 hover:bg-indigo-500 text-white shadow-xs transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Ajouter un Type de Système</span>
              </button>
            )}
          </div>

          <GmaoIndustrialDataGrid
            columns={systemTypeColumns}
            data={filteredSystemTypes}
            rowKey={(t) => t.id}
            emptyTitle="Aucun type de système général configuré"
            emptySubtitle="Créez des catégories comme AIR (Air comprimé), SEC (Sécurité incendie), EAU (Traitement d'eau) pour numéroter automatiquement vos équipements."
          />
        </>
      )}

      {/* 5. MODAL: CREATE / EDIT EQUIPMENT */}
      {showEquipmentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-2xl overflow-hidden my-8">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-400">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-black tracking-tight">
                    {editingEquipment
                      ? `Modifier l'Équipement ${editingEquipment.id_machine_registered}`
                      : 'Nouvel Équipement — Système Général'}
                  </h2>
                  <p className="text-[11px] text-slate-400">
                    Enregistré dans le référentiel central avec classe SYSTEM_GENERAL (éligible PM & BT, hors nomenclature BOM production)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowEquipmentModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEquipment} className="p-6 space-y-4">
              {equipFormError && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-xs font-bold text-rose-700 dark:text-rose-300 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{equipFormError}</span>
                </div>
              )}

              {/* Row 1: System Type + Auto Sequential Code */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-black uppercase text-slate-700 dark:text-slate-300">
                      Type de Système Général *
                    </label>
                    {canCreate && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowEquipmentModal(false);
                          openCreateTypeModal();
                        }}
                        className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                      >
                        + Nouveau type
                      </button>
                    )}
                  </div>
                  <select
                    value={equipForm.id_general_system_type}
                    onChange={(e) => handleSelectFormSystemType(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                    required
                  >
                    <option value="">-- Sélectionner un type (AIR, SEC, EAU...) --</option>
                    {(generalSystemTypes || [])
                      .filter(
                        (t) =>
                          t.is_active !== false ||
                          t.id === equipForm.id_general_system_type
                      )
                      .map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.code} — {t.name}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  {!editingEquipment && selectedFormSystemType ? (
                    <SequentialCodePicker
                      prefix={selectedFormSystemType.code}
                      existingCodes={(machines || []).map((m) => m.id_machine_registered)}
                      value={equipForm.id_machine_registered}
                      onChange={(code) =>
                        setEquipForm((prev) => ({ ...prev, id_machine_registered: code }))
                      }
                      label="Code Équipement (Auto-dérivé) *"
                    />
                  ) : (
                    <div>
                      <label className="block text-xs font-black uppercase text-slate-700 dark:text-slate-300 mb-1">
                        Code Équipement *
                      </label>
                      <input
                        type="text"
                        value={equipForm.id_machine_registered}
                        disabled={Boolean(editingEquipment)}
                        onChange={(e) =>
                          setEquipForm((prev) => ({
                            ...prev,
                            id_machine_registered: e.target.value.toUpperCase(),
                          }))
                        }
                        placeholder="Ex: AIR-01"
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 font-mono text-sm font-black text-slate-900 dark:text-white"
                        required
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Row 2: Designation */}
              <div>
                <label className="block text-xs font-black uppercase text-slate-700 dark:text-slate-300 mb-1">
                  Désignation de l'Équipement *
                </label>
                <input
                  type="text"
                  value={equipForm.designation}
                  onChange={(e) =>
                    setEquipForm((prev) => ({ ...prev, designation: e.target.value }))
                  }
                  placeholder="Ex: Compresseur à vis Atlas Copco GA37, Centrale Incendie Zone Nord..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  required
                />
              </div>

              {/* Row 3: Real Zone & Assigned Technician */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black uppercase text-slate-700 dark:text-slate-300 mb-1">
                    Zone Géographique Réelle *
                  </label>
                  <select
                    value={equipForm.id_zone_default}
                    onChange={(e) =>
                      setEquipForm((prev) => ({ ...prev, id_zone_default: e.target.value }))
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                    required
                  >
                    <option value="">-- Sélectionner une zone --</option>
                    {(zones || []).map((z) => (
                      <option key={z.id} value={z.id}>
                        {z.id} — {z.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-black uppercase text-slate-700 dark:text-slate-300 mb-1">
                    Technicien / Responsable Affecté
                  </label>
                  <select
                    value={equipForm.technician}
                    onChange={(e) =>
                      setEquipForm((prev) => ({ ...prev, technician: e.target.value }))
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="">-- Équipe générale / Non assigné --</option>
                    {activeTechnicians.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.specialty || t.role || t.id})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Row 4: Serial Number, Date Mise en Service, Status */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-black uppercase text-slate-700 dark:text-slate-300 mb-1">
                    N° de Série (S/N)
                  </label>
                  <input
                    type="text"
                    value={equipForm.serial_number}
                    onChange={(e) =>
                      setEquipForm((prev) => ({ ...prev, serial_number: e.target.value }))
                    }
                    placeholder="Ex: SN-2025-884"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-sm text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black uppercase text-slate-700 dark:text-slate-300 mb-1">
                    Date Mise en Service
                  </label>
                  <input
                    type="date"
                    value={equipForm.date_mise_en_service}
                    onChange={(e) =>
                      setEquipForm((prev) => ({
                        ...prev,
                        date_mise_en_service: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black uppercase text-slate-700 dark:text-slate-300 mb-1">
                    Statut Opérationnel
                  </label>
                  <select
                    value={equipForm.status}
                    onChange={(e) =>
                      setEquipForm((prev) => ({ ...prev, status: e.target.value }))
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-bold text-slate-900 dark:text-white"
                  >
                    <option value="En Service">En Service</option>
                    <option value="En Maintenance">En Maintenance</option>
                    <option value="À l'Arrêt">À l'Arrêt</option>
                  </select>
                </div>
              </div>

              {/* Row 5: Optional Operating Counter */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                <div>
                  <label className="block text-xs font-black uppercase text-slate-700 dark:text-slate-300 mb-1">
                    Compteur Actuel (Optionnel)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={equipForm.compteur_heures}
                    onChange={(e) =>
                      setEquipForm((prev) => ({
                        ...prev,
                        compteur_heures: Math.max(0, Number(e.target.value) || 0),
                      }))
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-sm text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black uppercase text-slate-700 dark:text-slate-300 mb-1">
                    Unité du Compteur
                  </label>
                  <select
                    value={equipForm.compteur_unite_defaut}
                    onChange={(e) =>
                      setEquipForm((prev) => ({
                        ...prev,
                        compteur_unite_defaut: e.target.value as any,
                      }))
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-bold text-slate-900 dark:text-white"
                  >
                    <option value="HEURES">HEURES</option>
                    <option value="CYCLES">CYCLES</option>
                    <option value="KM">KM</option>
                    <option value="TONNES">TONNES</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowEquipmentModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-sm transition-colors"
                >
                  <Check className="w-4 h-4" />
                  <span>
                    {editingEquipment ? 'Enregistrer les modifications' : "Créer l'Équipement"}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. MODAL: CREATE / EDIT GENERAL SYSTEM TYPE */}
      {showTypeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Settings2 className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-black">
                  {editingType
                    ? `Modifier le Type ${editingType.code}`
                    : 'Nouveau Type de Système Général'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowTypeModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveSystemType} className="p-5 space-y-4">
              {typeFormError && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-xs font-bold text-rose-700 dark:text-rose-300">
                  {typeFormError}
                </div>
              )}

              <div>
                <label className="block text-xs font-black uppercase text-slate-700 dark:text-slate-300 mb-1">
                  Code Préfixe (2 à 6 lettres) *
                </label>
                <input
                  type="text"
                  maxLength={8}
                  value={typeForm.code}
                  onChange={(e) =>
                    setTypeForm((prev) => ({
                      ...prev,
                      code: e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ''),
                    }))
                  }
                  placeholder="Ex: AIR, SEC, EAU, CVC, ELEC"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-sm font-black uppercase text-slate-900 dark:text-white"
                  required
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Servira de préfixe automatique pour les équipements (ex: {typeForm.code || 'AIR'}-01).
                </p>
              </div>

              <div>
                <label className="block text-xs font-black uppercase text-slate-700 dark:text-slate-300 mb-1">
                  Libellé du Système *
                </label>
                <input
                  type="text"
                  value={typeForm.name}
                  onChange={(e) => setTypeForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Ex: Air comprimé, Sécurité incendie, Traitement d'eau..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-semibold text-slate-900 dark:text-white"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowTypeModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black bg-indigo-600 hover:bg-indigo-500 text-white"
                >
                  <Check className="w-4 h-4" />
                  <span>{editingType ? 'Mettre à jour' : 'Créer le Type'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. MODAL: ARCHIVE / DELETE CONFIRMATION */}
      {archiveTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950/80 text-amber-600 flex items-center justify-center shrink-0">
                  <Archive className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    {archiveDependencies?.hasHistory
                      ? `Archiver l'équipement ${archiveTarget.id_machine_registered} ?`
                      : `Supprimer / Archiver ${archiveTarget.id_machine_registered} ?`}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {archiveTarget.designation}
                  </p>
                </div>
              </div>

              {archiveDependencies?.hasHistory ? (
                <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-xs text-amber-900 dark:text-amber-200 space-y-1">
                  <p className="font-bold">
                    Cet équipement possède un historique opérationnel ({archiveDependencies.total} enregistrement(s)) :
                  </p>
                  <ul className="list-disc list-inside text-[11px] opacity-90">
                    <li>{archiveDependencies.mouvementsCount} mouvement(s) PDR</li>
                    <li>{archiveDependencies.preventiveCount} tâche(s) préventive(s)</li>
                    <li>{archiveDependencies.correctiveCount} intervention(s) corrective(s)</li>
                  </ul>
                  <p className="pt-1 font-semibold">
                    Conformément aux règles d'intégrité GMAO, il sera placé en statut ARCHIVEE sans perte d'historique.
                  </p>
                </div>
              ) : (
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  Cet équipement n'a aucun historique d'intervention ou de sortie PDR. Voulez-vous le retirer du référentiel ?
                </p>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setArchiveTarget(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100"
                >
                  Annuler
                </button>
                {!archiveDependencies?.hasHistory && (
                  <button
                    type="button"
                    onClick={() => {
                      const archivedMachine = transitionMachineLifecycle(
                        archiveTarget,
                        'ARCHIVE'
                      );
                      handleUpdateMachine(
                        archiveTarget.id_machine_registered,
                        archivedMachine
                      );
                      showToast?.(
                        `Équipement ${archiveTarget.id_machine_registered} archivé`,
                        'info'
                      );
                      setArchiveTarget(null);
                    }}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-100 text-amber-800 hover:bg-amber-200"
                  >
                    Archiver seulement
                  </button>
                )}
                <button
                  type="button"
                  onClick={confirmArchiveOrDelete}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black bg-rose-600 hover:bg-rose-500 text-white"
                >
                  {archiveDependencies?.hasHistory ? (
                    <>
                      <Archive className="w-3.5 h-3.5" />
                      <span>Confirmer l'Archivage</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Supprimer</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EquipmentView;
