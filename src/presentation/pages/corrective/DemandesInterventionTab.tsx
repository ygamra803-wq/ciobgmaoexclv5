import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  Flame,
  AlertTriangle,
  Plus,
  ArrowRight,
  Search,
  Clock,
  SlidersHorizontal,
  RotateCcw,
  FileSpreadsheet,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  X,
  Layers,
  Wrench,
  Check,
  BookOpen,
  Factory,
  ChevronDown,
  User,
  Radio,
  Power,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { Logger } from '../../../core/logger/LoggerService';
import CustomSelect from '../../components/common/CustomSelect';
import GmaoIndustrialDataGrid from '../../components/common/GmaoIndustrialDataGrid';
import { GmaoKpiCard, GmaoKpiGrid } from '../../components/common/GmaoKpiCard';
import { useI18n } from '../../../i18n/I18nContext';
import { dataIntegrityService } from '../../../services/dataIntegrityService';
import { filterActiveMachines } from '../../../utils/activeMachines';
import { getBlueprintCommonFailuresForMachine, rankStockItemsByMachineBom } from '../../../core/domain';
import { isWarehouseComponent, isWarehousePart } from '../../../core/domain/EntrepotItem';
import { useGmaoStore } from '../../../store/useGmaoStore';
import { useAuth } from '../../../context/AuthContext';
import { AuthorizationService } from '../../../core/security/AuthorizationService';
import {
  isTechnicianRole,
  getTechnicianDisplayName,
} from '../../../core/security/technicianScope';
import ValidationStatusBadge from '../../components/common/ValidationStatusBadge';
import { evaluateBatchSpareAllocation } from '../../../domain/stock/stockReservationService';
import { evaluateTechniciansForIntervention } from '../../../domain/workforce/workforceCapacityService';
import DemandesInterventionModals from './components/DemandesInterventionModals';

export default function DemandesInterventionTab({
  interventions = [],
  onAddDemande,
  onConvertToBt,
  machines = [],
  blueprints = [],
  technicians = [],
  stockItems = [],
  warehouseItems = [],
  actionsByPanne = {},
  panneCategories = {},
  travauxAFaire = [],
  intervenants = [],
  getActionsForPanne: getActionsForPanneProp,
  onAddActionForPanne: _onAddActionForPanne,
  showToast,
  onNavigateToTab,
  autoOpenCreate = false,
  onResetAutoOpen,
  presetData = null,
  onClearPreset,
}: any) {
  const { t } = useI18n();
  const { user } = useAuth();
  const isTechUser = isTechnicianRole(user);
  const canCreateDi = Boolean(user) && AuthorizationService.hasPermission(user, 'corrective.execute');
  const canConvertBt = Boolean(user) && AuthorizationService.hasPermission(user, 'corrective.manage');
  const techDisplayName = useMemo(
    () => getTechnicianDisplayName(user, technicians),
    [user, technicians]
  );
  const machineElementsLedger = useGmaoStore((s) => s.machineElementsLedger);
  const storePreventiveExecutions = useGmaoStore((s) => s.preventiveExecutions);
  const storeSortieDemands = useGmaoStore((s) => s.sortieDemands);
  const storePreventiveTasks = useGmaoStore((s) => s.preventiveTasks);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showConvertModal, setShowConvertModal] = useState<any>(null); // holds selected DI
  const [showTravauxSelector, setShowTravauxSelector] = useState(false);
  const [travauxSearchTerm, setTravauxSearchTerm] = useState('');

  useEffect(() => {
    if (autoOpenCreate) {
      setShowCreateModal(true);
      onResetAutoOpen?.();
    }
  }, [autoOpenCreate, onResetAutoOpen]);

  // Filters State
  const [filterStatus, setFilterStatus] = useState('ALL'); // ALL, DEMANDE, EN_COURS, CLOTURE
  const [filterUrgence, setFilterUrgence] = useState('ALL');
  const [filterTypePanne, setFilterTypePanne] = useState('ALL');
  const [filterMachine, setFilterMachine] = useState('ALL');
  const [orphanFilter, setOrphanFilter] = useState('ALL'); // 'ALL' | 'ORPHAN_ONLY' | 'LINKED_ONLY'
  const [searchTerm, setSearchTerm] = useState('');

  // Annotate interventions with orphan status
  const itemsWithOrphan = useMemo(
    () => dataIntegrityService.annotateCorrectiveOrphans(interventions, machines),
    [interventions, machines]
  );

  const orphanCount = useMemo(
    () => itemsWithOrphan.filter((i) => i._isOrphan).length,
    [itemsWithOrphan]
  );

  // Sorting & Pagination State
  const [sortField, setSortField] = useState('date_demande');
  const [sortOrder, setSortOrder] = useState('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [showSortMenu, setShowSortMenu] = useState(false);
  const sortMenuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (sortMenuRef.current && !sortMenuRef.current.contains(e.target)) {
        setShowSortMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Robust search for suggested actions for a panne anomalie
  const getActionsForPanne = useCallback((anomalie) => {
    if (typeof getActionsForPanneProp === 'function') {
      return getActionsForPanneProp(anomalie);
    }
    if (!anomalie || !actionsByPanne) return [];
    const anom = String(anomalie).trim();
    if (!anom) return [];
    if (actionsByPanne[anom]) return actionsByPanne[anom];
    const withUnder = anom.replace(/\s+/g, '_');
    if (actionsByPanne[withUnder]) return actionsByPanne[withUnder];
    const withSpace = anom.replace(/_/g, ' ');
    if (actionsByPanne[withSpace]) return actionsByPanne[withSpace];
    const lower = anom.toLowerCase().replace(/_/g, ' ').trim();
    for (const [key, acts] of Object.entries(actionsByPanne)) {
      if (key.toLowerCase().replace(/_/g, ' ').trim() === lower) {
        return acts;
      }
    }
    for (const [key, acts] of Object.entries(actionsByPanne)) {
      const normKey = key.toLowerCase().replace(/_/g, ' ').trim();
      if (normKey.includes(lower) || lower.includes(normKey)) {
        return acts;
      }
    }
    return [];
  }, [actionsByPanne, getActionsForPanneProp]);

  // Combined machine list from registered state (SSOT)
  const allMachineOptions = useMemo(() => {
    const active = filterActiveMachines(machines);
    return active.map((m: any) => ({
      id: m.id || m.id_machine_registered || m.code,
      id_machine_registered: m.id_machine_registered || m.code || m.id,
      code: m.code || m.id_machine_registered || m.id,
      id_blueprint: m.id_blueprint || '',
      zone: m.id_zone_default || m.id_zone || m.zone || 'Atelier',
      designation: m.designation || m.nom || m.id_machine_registered || m.id,
      totalInterventions: m.totalInterventions || 0,
    }));
  }, [machines]);

  // Combined technician list from registered state or seeded intervenants (SSOT — active only)
  const allTechnicianOptions = useMemo(() => {
    const list = [];
    const seen = new Set();

    const isArchivedTech = (t) =>
      t?.is_active === false ||
      t?.actif === false ||
      String(t?.statut || t?.status || '').toUpperCase().startsWith('ARCHIV');

    // 1. Add real registered active technicians from userSub (SSOT)
    if (Array.isArray(technicians) && technicians.length > 0) {
      technicians.forEach((t) => {
        if (typeof t === 'object' && t !== null && isArchivedTech(t)) return;
        const nom = t.nom || t.name || String(t);
        if (nom && !seen.has(nom.toLowerCase())) {
          seen.add(nom.toLowerCase());
          list.push({
            id_technician: t.id_technician || t.id || '',
            nom,
            name: nom,
            role: t.specialite || t.role || 'Technicien Maintenance',
          });
        }
      });
    }

    // 2. Add fallback intervenants if present (excluding archived entries)
    if (Array.isArray(intervenants)) {
      intervenants.forEach((i) => {
        if (typeof i === 'object' && i !== null && isArchivedTech(i)) return;
        const nom = i.nom || i.name || String(i);
        if (nom && !seen.has(nom.toLowerCase())) {
          seen.add(nom.toLowerCase());
          list.push({
            id_technician: i.id_technician || i.id || '',
            nom,
            name: nom,
            role: i.total ? `${i.total} interventions` : 'Intervenant Usine',
            isCorrective: true,
          });
        }
      });
    }

    return list;
  }, [technicians, intervenants]);

  // Form State for new DI
  const [newForm, setNewForm] = useState({
    code_machine: allMachineOptions[0]?.code || allMachineOptions[0]?.id_machine_registered || '',
    id_composant: '',
    nom_composant: '',
    id_part: '',
    nom_part: '',
    pdr_ref: '',
    pdr_quantite: 1,
    demandeur: 'Production',
    priorite: 'HAUTE',
    type_panne: 'E',
    anomalie: panneCategories?.E?.[0] || '',
    travail_a_faire: '',
    arret_machine: true,
  });

  useEffect(() => {
    const validCodes = new Set(
      allMachineOptions.map((m) => String(m.code || m.id_machine_registered || '').trim())
    );
    if (allMachineOptions.length === 0) {
      if (newForm.code_machine !== '') {
        setNewForm((prev) => ({
          ...prev,
          code_machine: '',
          id_composant: '',
          nom_composant: '',
          id_part: '',
          nom_part: '',
        }));
      }
    } else if (!newForm.code_machine || !validCodes.has(String(newForm.code_machine).trim())) {
      const firstCode = allMachineOptions[0]?.code || allMachineOptions[0]?.id_machine_registered || '';
      setNewForm((prev) => ({
        ...prev,
        code_machine: firstCode,
        id_composant: '',
        nom_composant: '',
        id_part: '',
        nom_part: '',
      }));
    }
  }, [allMachineOptions, newForm.code_machine]);

  // Available components for the selected machine from Entrepôt
  const machineComponents = useMemo(() => {
    if (!newForm.code_machine || !Array.isArray(warehouseItems)) return [];
    const code = String(newForm.code_machine).trim().toUpperCase();
    return warehouseItems.filter((w) => {
      const wMach = String(w.id_machine_registered || w.id_machine || '').trim().toUpperCase();
      return (wMach === code || wMach.includes(code)) && isWarehouseComponent(w);
    });
  }, [newForm.code_machine, warehouseItems]);

  // Available structural localization parts for the selected machine from Entrepôt
  const machineParts = useMemo(() => {
    if (!newForm.code_machine || !Array.isArray(warehouseItems)) return [];
    const code = String(newForm.code_machine).trim().toUpperCase();
    return warehouseItems.filter((w) => {
      const wMach = String(w.id_machine_registered || w.id_machine || '').trim().toUpperCase();
      return (wMach === code || wMach.includes(code)) && isWarehousePart(w);
    });
  }, [newForm.code_machine, warehouseItems]);

  // Smart BOM-ranked consumable PDR list (P2 & N1: BOM + Nexus recommended on top, rest of warehouse below)
  const rankedStockItems = useMemo(() => {
    return rankStockItemsByMachineBom(
      newForm.code_machine,
      stockItems,
      machines,
      blueprints,
      newForm.id_composant || newForm.nom_composant || newForm.id_part || newForm.nom_part,
      undefined,
      machineElementsLedger
    );
  }, [
    newForm.code_machine,
    stockItems,
    machines,
    blueprints,
    newForm.id_composant,
    newForm.nom_composant,
    newForm.id_part,
    newForm.nom_part,
    machineElementsLedger,
  ]);

  // Blueprint common failures for the currently selected active machine (BP-5)
  const selectedMachineBlueprintId = useMemo(() => {
    if (!newForm.code_machine) return '';
    const code = String(newForm.code_machine).trim().toUpperCase();
    const matched = allMachineOptions.find(
      (m) => String(m.code || m.id_machine_registered || '').trim().toUpperCase() === code
    );
    return matched?.id_blueprint || '';
  }, [newForm.code_machine, allMachineOptions]);

  const blueprintCommonFailures = useMemo(() => {
    return getBlueprintCommonFailuresForMachine(newForm.code_machine, machines, blueprints);
  }, [newForm.code_machine, machines, blueprints]);

  const handleApplyBlueprintCommonFailure = useCallback(
    (failure) => {
      if (!failure) return;
      setNewForm((prev) => {
        const nextTypePanne = failure.type_panne || prev.type_panne || 'M';
        const nextAnomalie = failure.title || prev.anomalie;
        const nextUrgence = failure.urgence || prev.priorite || 'HAUTE';
        const nextPdrRef =
          failure.pdr_ref !== undefined && failure.pdr_ref !== ''
            ? failure.pdr_ref
            : Array.isArray(failure.pdr_refs) && failure.pdr_refs.length > 0
            ? failure.pdr_refs[0]
            : prev.pdr_ref;
        const parts = [failure.recommended_action, failure.description].filter(
          (x) => x && String(x).trim()
        );
        const nextTravail =
          parts.length > 0 ? parts.join(' — ') : failure.title || prev.travail_a_faire;

        // Resolve linked Component or Part on the active machine if specified in the Blueprint failure
        const targetRef = String(
          failure.id_composant || failure.component_ref || failure.id_part || ''
        )
          .trim()
          .toUpperCase();
        let nextIdComp = prev.id_composant;
        let nextNomComp = prev.nom_composant;
        let nextIdPart = prev.id_part;
        let nextNomPart = prev.nom_part;

        if (targetRef) {
          const matchedComp = machineComponents.find((c) => {
            const cId = String(c.id_warehouse_item || c.id || '').trim().toUpperCase();
            const cName = String(c.designation || c.nom_composant || c.nom || '').trim().toUpperCase();
            return cId === targetRef || cName === targetRef || cName.includes(targetRef);
          });
          if (matchedComp) {
            nextIdComp = String(matchedComp.id_warehouse_item || matchedComp.id || '');
            nextNomComp = String(
              matchedComp.designation || matchedComp.nom_composant || matchedComp.nom || nextIdComp
            );
          } else {
            const matchedPart = machineParts.find((p) => {
              const pId = String(p.id_warehouse_item || p.id || '').trim().toUpperCase();
              const pName = String(p.designation_part || p.designation || p.nom || '').trim().toUpperCase();
              return pId === targetRef || pName === targetRef || pName.includes(targetRef);
            });
            if (matchedPart) {
              nextIdPart = String(matchedPart.id_warehouse_item || matchedPart.id || '');
              nextNomPart = String(
                matchedPart.designation_part || matchedPart.designation || matchedPart.nom || nextIdPart
              );
            }
          }
        }

        return {
          ...prev,
          type_panne: nextTypePanne,
          anomalie: nextAnomalie,
          priorite: nextUrgence,
          pdr_ref: nextPdrRef,
          travail_a_faire: nextTravail,
          id_composant: nextIdComp,
          nom_composant: nextNomComp,
          id_part: nextIdPart,
          nom_part: nextNomPart,
        };
      });
    },
    [machineComponents, machineParts]
  );

  useEffect(() => {
    if (presetData) {
      setNewForm((prev) => ({
        ...prev,
        type_panne: presetData.type_panne || prev.type_panne,
        anomalie: presetData.anomalie || prev.anomalie,
        travail_a_faire: presetData.travail_a_faire || prev.travail_a_faire,
      }));
      setShowCreateModal(true);
      onClearPreset?.();
    }
  }, [presetData, onClearPreset]);

  // Convert Modal State
  const [convertForm, setConvertForm] = useState({
    num_bt: '',
    intervenant: allTechnicianOptions[0]?.nom || '',
    priorite: 'HAUTE',
    travail_a_faire: '',
    duree_prevue_mins: 90,
    pdr_ref: '',
    pdr_quantite: 1,
    allowWaitPdrOnConflict: false,
  });

  const convertTechEvaluations = useMemo(() => {
    if (!showConvertModal) return [];
    return evaluateTechniciansForIntervention({
      intervention: showConvertModal,
      technicians: technicians?.length > 0 ? technicians : allTechnicianOptions,
      activeInterventions: interventions,
      preventiveTasks: storePreventiveTasks,
      estimatedTaskMinutes: Number(convertForm.duree_prevue_mins) || 90,
    });
  }, [
    showConvertModal,
    technicians,
    allTechnicianOptions,
    interventions,
    storePreventiveTasks,
    convertForm.duree_prevue_mins,
  ]);

  const selectedConvertTechEval = useMemo(() => {
    const target = String(convertForm.intervenant || '').trim().toLowerCase();
    if (!target) return null;
    return (
      convertTechEvaluations.find(
        (ev) => ev.technicianName.trim().toLowerCase() === target
      ) || null
    );
  }, [convertTechEvaluations, convertForm.intervenant]);

  const convertReservationEval = useMemo(() => {
    if (!showConvertModal || !convertForm.pdr_ref) return null;
    return evaluateBatchSpareAllocation(
      [{ ref: convertForm.pdr_ref, quantite: Math.max(1, Number(convertForm.pdr_quantite) || 1) }],
      {
        machineCode: showConvertModal.code_machine,
        excludeClaimId: String(showConvertModal.id || ''),
        stockItems,
        correctiveInterventions: interventions,
        preventiveExecutions: storePreventiveExecutions,
        sortieDemands: storeSortieDemands,
        preventiveTasks: storePreventiveTasks,
      }
    );
  }, [
    showConvertModal,
    convertForm.pdr_ref,
    convertForm.pdr_quantite,
    stockItems,
    interventions,
    storePreventiveExecutions,
    storeSortieDemands,
    storePreventiveTasks,
  ]);

  // Category Panne Options
  const availableCategories = useMemo(() => {
    return Object.keys(panneCategories || { E: [], H: [], P: [], M: [] });
  }, [panneCategories]);

  // Filtered standard travaux options
  const filteredStandardTravaux = useMemo(() => {
    if (!Array.isArray(travauxAFaire)) return [];
    if (!travauxSearchTerm.trim()) return travauxAFaire.slice(0, 30);
    const q = travauxSearchTerm.toLowerCase();
    return travauxAFaire.filter((t) => String(t).toLowerCase().includes(q)).slice(0, 30);
  }, [travauxAFaire, travauxSearchTerm]);

  const anomaliesForSelectedCategory = useMemo(() => {
    return panneCategories[newForm.type_panne] || [];
  }, [newForm.type_panne]);

  // KPI Metrics Calculation
  const kpiStats = useMemo(() => {
    const total = interventions.length;
    const pending = interventions.filter(
      (i) => i.statut === 'DEMANDE' || i.statut === 'DEMANDE_CREEE' || i.statut === 'EN_ATTENTE_VALIDATION'
    ).length;
    const converted = interventions.filter((i) => i.statut === 'EN_COURS' || Boolean(i.num_bt)).length;
    const arret = interventions.filter((i) => i.arret_machine === true || i.arret_machine === 'OUI').length;
    const fromPreventive = interventions.filter(
      (i) => i.source === 'AUTO_DI_PREVENTIF' || Boolean(i.source_preventive_execution_id)
    ).length;

    return { total, pending, converted, arret, fromPreventive };
  }, [interventions]);

  // Filtered DIs
  const filteredDis = useMemo(() => {
    return itemsWithOrphan.filter((item) => {
      // Status filter
      if (
        filterStatus === 'DEMANDE' &&
        item.statut !== 'DEMANDE' &&
        item.statut !== 'DEMANDE_CREEE' &&
        item.statut !== 'EN_ATTENTE_VALIDATION'
      )
        return false;
      if (filterStatus === 'EN_COURS' && item.statut !== 'EN_COURS' && item.statut !== 'BT_PLANIFIE') return false;
      if (filterStatus === 'CLOTURE' && item.statut !== 'CLOTURE') return false;
      if (filterStatus === 'ARRET' && !item.arret_machine) return false;
      if (
        filterStatus === 'AUTO_DI_PREVENTIF' &&
        item.source !== 'AUTO_DI_PREVENTIF' &&
        !item.source_preventive_execution_id
      )
        return false;

      // Urgence filter
      if (filterUrgence !== 'ALL' && item.priorite !== filterUrgence) return false;

      // Type Panne filter
      if (filterTypePanne !== 'ALL' && item.type_panne !== filterTypePanne) return false;

      // Machine filter
      if (filterMachine !== 'ALL' && item.code_machine !== filterMachine) return false;

      // Orphan filter
      if (orphanFilter === 'ORPHAN_ONLY' && !item._isOrphan) return false;
      if (orphanFilter === 'LINKED_ONLY' && item._isOrphan) return false;

      // Search term
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const mCode = String(item.code_machine || '').toLowerCase();
        const anom = String(item.anomalie || '').toLowerCase();
        const desc = String(item.travail_a_faire || item.action_realisee || '').toLowerCase();
        const bt = String(item.num_bt || '').toLowerCase();
        const tech = String(item.intervenant || '').toLowerCase();
        if (
          !mCode.includes(term) &&
          !anom.includes(term) &&
          !desc.includes(term) &&
          !bt.includes(term) &&
          !tech.includes(term)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [itemsWithOrphan, filterStatus, filterUrgence, filterTypePanne, filterMachine, orphanFilter, searchTerm]);

  // Sorting
  const sortedDis = useMemo(() => {
    const list = [...filteredDis];
    list.sort((a, b) => {
      let valA = a[sortField] || '';
      let valB = b[sortField] || '';

      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
    return list;
  }, [filteredDis, sortField, sortOrder]);

  // Pagination
  const totalItems = sortedDis.length;
  const effectivePageSize = pageSize === 0 ? totalItems : pageSize;
  const startIndex = (currentPage - 1) * effectivePageSize;
  const rawDisplayedDis =
    pageSize === 0 ? sortedDis : sortedDis.slice(startIndex, startIndex + effectivePageSize);

  const displayedDis = rawDisplayedDis;

  const toggleSort = (field) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const renderSortIcon = (field) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3 h-3 text-slate-300 group-hover:text-slate-500 transition shrink-0" />;
    }
    return sortOrder === 'asc' ? (
      <ArrowUp className="w-3 h-3 text-amber-700 shrink-0 font-bold" />
    ) : (
      <ArrowDown className="w-3 h-3 text-amber-700 shrink-0 font-bold" />
    );
  };

  const hasActiveFilters =
    filterStatus !== 'ALL' ||
    filterUrgence !== 'ALL' ||
    filterTypePanne !== 'ALL' ||
    filterMachine !== 'ALL' ||
    Boolean(searchTerm);

  const clearAllFilters = () => {
    setFilterStatus('ALL');
    setFilterUrgence('ALL');
    setFilterTypePanne('ALL');
    setFilterMachine('ALL');
    setSearchTerm('');
    setCurrentPage(1);
  };

  const handleExportFilteredExcel = () => {
    try {
      const headers = [
        'ID',
        'Machine',
        'Type Panne',
        'Anomalie',
        'Demandeur',
        'Date Demande',
        'Heure Demande',
        'Priorité',
        'Arrêt Machine',
        'Statut',
        'N° BT',
        'Intervenant',
      ];
      const dataRows = filteredDis.map((item) => [
        item.id || '',
        item.code_machine || '',
        item.type_panne || '',
        item.anomalie || '',
        item.demandeur || 'Production',
        item.date_demande || '',
        item.heure_demande || '',
        item.priorite || 'NORMALE',
        item.arret_machine ? 'OUI' : 'NON',
        item.statut || '',
        item.num_bt || '',
        item.intervenant || '',
      ]);

      const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Demandes_Intervention');
      XLSX.writeFile(wb, `Demandes_Intervention_Export_${new Date().toISOString().split('T')[0]}.xlsx`);

      showToast?.('Export Excel des demandes d\'intervention généré avec succès (.xlsx)', 'success');
    } catch (err) {
      Logger.error(err);
      showToast?.('Erreur lors de l\'export Excel', 'error');
    }
  };

  // Submit new DI
  const handleCreateSubmit = (e) => {
    e.preventDefault();
    if (!newForm.code_machine || allMachineOptions.length === 0) {
      showToast?.('Veuillez sélectionner une machine active du Parc', 'warning');
      return;
    }

    const created = onAddDemande({
      ...newForm,
      statut: 'DEMANDE',
      date_demande: new Date().toISOString().split('T')[0],
      heure_demande: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
    });

    showToast?.(`Demande d'intervention enregistrée pour ${created?.code_machine || newForm.code_machine}`, 'success');
    setShowCreateModal(false);
  };

  // Open convert modal
  const handleOpenConvert = (di) => {
    setShowConvertModal(di);
    const suffix = di.id ? String(di.id).replace(/\D/g, '').slice(-4) || '1001' : '1001';
    setConvertForm({
      num_bt: di.num_bt || `BT-${suffix}`,
      intervenant:
        di.intervenant ||
        (isTechUser && techDisplayName ? techDisplayName : allTechnicianOptions[0]?.nom || ''),
      priorite: di.priorite || 'HAUTE',
      travail_a_faire: di.travail_a_faire || '',
      duree_prevue_mins: Number(di.duree_prevue_mins) || 90,
      pdr_ref: di.pdr_ref || '',
      pdr_quantite: Number(di.pdr_quantite) || 1,
      allowWaitPdrOnConflict: false,
    });
  };

  // Submit conversion to BT
  const handleConvertSubmit = (e) => {
    e.preventDefault();
    if (!showConvertModal) return;

    if (
      convertReservationEval &&
      !convertReservationEval.canAllocateAll &&
      !convertForm.allowWaitPdrOnConflict
    ) {
      const firstConflict = convertReservationEval.conflicts[0];
      showToast?.(
        firstConflict?.conflictMessageFr ||
          'Conflit de réservation PDR : stock disponible insuffisant.',
        'error'
      );
      return;
    }

    const selectedNameLower = String(convertForm.intervenant || '').trim().toLowerCase();
    const matchedTech =
      allTechnicianOptions.find(
        (t) => String(t.nom || t.name || '').trim().toLowerCase() === selectedNameLower
      ) ||
      (Array.isArray(technicians)
        ? technicians.find(
            (t) => String(t.nom || t.name || '').trim().toLowerCase() === selectedNameLower
          )
        : null);
    const resolvedMatricule =
      matchedTech?.id_technician ||
      matchedTech?.id ||
      (isTechUser && user?.personnelId ? user.personnelId : undefined);

    const reservedSpares =
      convertForm.pdr_ref &&
      (!convertReservationEval || convertReservationEval.canAllocateAll)
        ? [
            {
              ref: convertForm.pdr_ref,
              designation:
                stockItems.find((s) => s.ref === convertForm.pdr_ref)?.designation ||
                convertForm.pdr_ref,
              quantite: Math.max(1, Number(convertForm.pdr_quantite) || 1),
            },
          ]
        : [];

    const nextStatut =
      convertReservationEval &&
      !convertReservationEval.canAllocateAll &&
      convertForm.allowWaitPdrOnConflict
        ? 'EN_ATTENTE_PDR'
        : 'EN_COURS';

    onConvertToBt(showConvertModal.id, {
      ...convertForm,
      statut: nextStatut,
      ...(resolvedMatricule ? { technicien_matricule: resolvedMatricule } : {}),
      ...(reservedSpares.length > 0 ? { pieces_reservees: reservedSpares } : {}),
    });

    showToast?.(
      reservedSpares.length > 0
        ? `BT ${convertForm.num_bt} créé avec réservation ferme de ${reservedSpares[0].quantite}x ${reservedSpares[0].ref} !`
        : `DI convertie en Bon de Travail ${convertForm.num_bt}`,
      'success'
    );
    setShowConvertModal(null);
    if (onNavigateToTab) {
      onNavigateToTab('corrective_bt');
    }
  };

  const diColumns = useMemo(
    () => [
      {
        key: 'code_machine',
        label: 'Machine',
        colLetter: 'Col A',
        icon: Factory,
        sortable: true,
        render: (di) => (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-700 flex items-center justify-center font-black text-[10px] border border-amber-200/60 shadow-2xs font-mono shrink-0">
              {String(di.code_machine || 'MCH').slice(0, 3)}
            </span>
            <span className="font-bold text-slate-900 font-mono">{di.code_machine}</span>
            {di._isOrphan && (
              <span className="px-1.5 py-0.2 rounded text-[9.5px] font-bold bg-amber-100 text-amber-800 border border-amber-200 inline-flex items-center gap-0.5 shrink-0">
                <AlertTriangle className="w-2.5 h-2.5" /> Orphelin
              </span>
            )}
          </div>
        ),
      },
      {
        key: 'date_demande',
        label: t('corrective.di.col_datetime', 'Date & Heure'),
        colLetter: 'Col C',
        icon: Clock,
        sortable: true,
        render: (di) => (
          <div className="font-mono whitespace-nowrap">
            <div className="font-semibold text-slate-800">{di.date_demande || di.date || '—'}</div>
            <div className="text-[10.5px] text-slate-400">{di.heure_demande || di.heure || '—'}</div>
          </div>
        ),
      },
      {
        key: 'type_panne',
        label: t('corrective.di.col_type', 'Type'),
        colLetter: 'Col I',
        icon: Layers,
        sortable: true,
        render: (di) => (
          <span className="px-2.5 py-1 rounded-md font-mono font-bold text-xs bg-slate-100 text-slate-800 border border-slate-200 shadow-2xs">
            {di.type_panne || 'M'}
          </span>
        ),
      },
      {
        key: 'anomalie',
        label: t('corrective.di.col_anomalie', 'Anomalie Constatée'),
        colLetter: 'Col J',
        icon: AlertTriangle,
        sortable: true,
        render: (di) => (
          <div className="space-y-1 max-w-xs">
            <span className="font-bold text-slate-900 truncate block" title={di.anomalie}>
              {di.anomalie || t('corrective.common.unspecified', 'Non spécifiée')}
            </span>
            {(di.source === 'AUTO_DI_PREVENTIF' || di.source_preventive_execution_id) && (
              <span
                data-testid={`di-auto-prev-badge-${di.id}`}
                className="px-1.5 py-0.5 rounded text-[9.5px] font-black bg-indigo-100 text-indigo-800 border border-indigo-200 inline-flex items-center gap-1 font-mono"
                title={`Origine préventive : ${di.source_preventive_execution_id || 'Auto-DI'}`}
              >
                Auto-DI Préventif
              </span>
            )}
          </div>
        ),
      },
      {
        key: 'demandeur',
        label: t('corrective.di.col_requester', 'Demandeur / Travail Demandé'),
        icon: User,
        render: (di) => (
          <div className="max-w-xs truncate" title={di.travail_a_faire}>
            <span className="font-semibold text-slate-800 mr-1.5 px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-[10.5px]">
              {di.demandeur || 'Production'}
            </span>
            <span className="text-slate-600">{di.travail_a_faire || 'Diagnostic en attente'}</span>
          </div>
        ),
      },
      {
        key: 'arret_machine',
        label: t('corrective.di.col_downtime', 'Arrêt Machine'),
        icon: Power,
        align: 'center',
        sortable: true,
        render: (di) => {
          const isArret = di.arret_machine === true || di.arret_machine === 'OUI';
          return isArret ? (
            <span className="px-2.5 py-1 rounded-full font-bold text-[10.5px] bg-rose-100 text-rose-800 border border-rose-200 font-mono shadow-2xs">
              ARRÊT
            </span>
          ) : (
            <span className="px-2.5 py-1 rounded-full font-bold text-[10.5px] bg-slate-100 text-slate-500 font-mono">
              NON
            </span>
          );
        },
      },
      {
        key: 'priorite',
        label: t('corrective.di.col_priority', 'Priorité'),
        icon: Flame,
        align: 'center',
        sortable: true,
        render: (di) => (
          <span
            className={`px-2.5 py-1 rounded-full font-bold text-[10.5px] font-mono shadow-2xs ${
              di.priorite === 'HAUTE'
                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                : di.priorite === 'BASSE'
                ? 'bg-slate-100 text-slate-600 border border-slate-200/60'
                : 'bg-amber-50 text-amber-700 border border-amber-200'
            }`}
          >
            {di.priorite || 'MOYENNE'}
          </span>
        ),
      },
      {
        key: 'statut',
        label: t('corrective.di.status', 'Statut'),
        icon: Radio,
        align: 'center',
        sortable: true,
        render: (di) => {
          const isPending =
            di.statut === 'DEMANDE' ||
            di.statut === 'DEMANDE_CREEE' ||
            di.statut === 'EN_ATTENTE_VALIDATION';
          const valStatus = String(di.validation_status || '').toUpperCase();
          if (
            di.statut === 'CLOTURE' ||
            valStatus === 'PENDING_VALIDATION' ||
            valStatus === 'NEEDS_CLARIFICATION' ||
            valStatus === 'REJECTED'
          ) {
            return <ValidationStatusBadge record={di} compact showNote />;
          }
          if (isPending) {
            return (
              <span className="px-2.5 py-1 rounded-full font-bold text-[10.5px] bg-amber-100 text-amber-900 border border-amber-300 font-mono animate-pulse shadow-2xs">
                EN ATTENTE
              </span>
            );
          }
          if (di.statut === 'EN_COURS') {
            return (
              <span className="px-2.5 py-1 rounded-full font-bold text-[10.5px] bg-blue-100 text-blue-900 border border-blue-300 font-mono shadow-2xs">
                BT ACTIF
              </span>
            );
          }
          return (
            <span className="px-2.5 py-1 rounded-full font-bold text-[10.5px] bg-emerald-100 text-emerald-900 border border-emerald-300 font-mono shadow-2xs">
              CLÔTURÉ
            </span>
          );
        },
      },
      {
        key: 'actions',
        label: t('corrective.di.col_quick_action', 'Action Rapide'),
        icon: Wrench,
        align: 'center',
        headerClassName: 'w-36 text-center whitespace-nowrap',
        render: (di) => {
          const isPending =
            di.statut === 'DEMANDE' ||
            di.statut === 'DEMANDE_CREEE' ||
            di.statut === 'EN_ATTENTE_VALIDATION';
          return isPending ? (
            canConvertBt ? (
              <button
                onClick={() => handleOpenConvert(di)}
                className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition flex items-center justify-center gap-1.5 mx-auto cursor-pointer shadow-2xs active:scale-95"
                title="Convertir en Bon de Travail (BT) et affecter un technicien"
              >
                <Wrench className="w-3.5 h-3.5" />
                <span>{t('corrective.di.generate_bt', 'Générer BT')}</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 font-mono font-bold text-[10.5px]">
                <Clock className="w-3 h-3 text-amber-600" />
                Attente BT
              </span>
            )
          ) : (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-900 font-mono font-bold text-xs shadow-2xs">
              <Check className="w-3 h-3 text-indigo-600" />
              {di.num_bt || 'BT-OK'}
            </span>
          );
        },
      },
    ],
    [t, canConvertBt]
  );

  return (
    <div className="space-y-6">
      {/* 1. Top 4 Primary KPI Metrics Bar */}
      <GmaoKpiGrid columns={4}>
        {/* Total Demandes */}
        <GmaoKpiCard
          title={t('corrective.di.title')}
          value={kpiStats.total}
          unit={t('corrective.di.unit_requests', 'demandes')}
          icon={Flame}
          color="amber"
          valueColored={false}
          isActive={filterStatus === 'ALL'}
          onClick={() => setFilterStatus('ALL')}
          badgePrefix={t('corrective.di.all_origins', 'Toutes origines')}
          badgeText={t('corrective.di.traced', '100% tracé')}
          footerLabel={t('corrective.di.overview_label', 'Vue générale :')}
          footerValue={t('corrective.di.overview_value', "Flux d'entrée usine")}
        />

        {/* En Attente de Traitement */}
        <GmaoKpiCard
          title={`${t('corrective.di.status')} (${t('corrective.di.pending', 'En Attente')})`}
          value={kpiStats.pending}
          unit={t('corrective.di.unit_to_convert', 'à convertir')}
          icon={Clock}
          color="rose"
          isActive={filterStatus === 'DEMANDE'}
          onClick={() => setFilterStatus('DEMANDE')}
          badgeText={t('corrective.di.manager_action', 'Action Chef requise')}
          footerLabel={t('corrective.di.priority_label', 'Priorité :')}
          footerValue={t('corrective.di.generate_bt', 'Génération BT')}
        />

        {/* Converties en BT */}
        <GmaoKpiCard
          title={t('corrective.bt.title')}
          value={kpiStats.converted}
          unit={t('corrective.di.unit_bt_orders', 'ordres BT')}
          icon={Wrench}
          color="blue"
          isActive={filterStatus === 'EN_COURS'}
          onClick={() => setFilterStatus('EN_COURS')}
          badgeText={t('corrective.di.assigned_techs', 'Techniciens affectés')}
          footerLabel={t('corrective.di.coverage_rate', 'Taux prise en charge :')}
          footerValue={`${kpiStats.total ? Math.round((kpiStats.converted / kpiStats.total) * 100) : 0}%`}
        />

        {/* Pannes avec Arrêt Machine */}
        <GmaoKpiCard
          title={t('corrective.di.blocking_downtime', 'Arrêt Machine Bloquant')}
          value={kpiStats.arret}
          unit={t('corrective.di.unit_stopped_lines', 'lignes stoppées')}
          icon={AlertTriangle}
          color="purple"
          isActive={filterStatus === 'ARRET'}
          onClick={() => setFilterStatus('ARRET')}
          badgeText={t('corrective.di.direct_impact', 'Impact direct production')}
          footerLabel={t('corrective.di.severity_label', 'Gravité :')}
          footerValue={t('corrective.di.plant_stop', 'Arrêt Usine')}
        />
      </GmaoKpiGrid>

      {/* 2. Filter & Search Card (Unified Mature Light UI Design System) */}
      <div className="relative z-30 bg-white border border-slate-200 rounded-2xl p-4 md:p-5 shadow-[0_12px_32px_-6px_rgba(0,0,0,0.12),0_4px_12px_-2px_rgba(0,0,0,0.06)] hover:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.16),0_6px_16px_-3px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-300 ease-out space-y-4">
        {/* Filter Card Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-200/80 flex items-center justify-center text-amber-700 shadow-2xs">
              <SlidersHorizontal className="w-4 h-4 text-amber-700" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-black uppercase tracking-wider text-slate-900">
                  {t('common.filters.title')}
                </span>
                <span className="bg-amber-50 text-amber-800 px-3 py-1 rounded-lg text-xs font-bold border border-amber-200/70 shadow-2xs">
                  {filteredDis.length} / {interventions.length}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Liaisons Excel Colonnes A → J • Tri multicritères et conversion instantanée en BT
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              type="button"
              onClick={handleExportFilteredExcel}
              className="h-8 px-3 rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs active:scale-95"
              title="Exporter les demandes filtrées vers Excel (.xlsx)"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span className="hidden sm:inline">{t('corrective.filters.export_excel')}</span>
            </button>

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

            {canCreateDi && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="h-8 px-3.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm shadow-amber-600/25 active:scale-95"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{t('corrective.filters.create_di')}</span>
              </button>
            )}
          </div>
        </div>

        {/* Quick Status Presets Chips */}
        <div className="flex items-center gap-2 flex-wrap text-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1 mr-1">
            <Flame className="w-3 h-3 text-slate-400" />
            {t('corrective.di.status')} :
          </span>
          {[
            {
              key: 'ALL',
              label: t('corrective.filters.all_demandes'),
              count: interventions.length,
              activeBg: 'bg-slate-900 text-white shadow-xs',
              colorDot: null,
            },
            {
              key: 'DEMANDE',
              label: t('corrective.filters.en_attente'),
              count: kpiStats.pending,
              activeBg: 'bg-rose-600 text-white shadow-xs',
              colorDot: 'bg-rose-500',
            },
            {
              key: 'EN_COURS',
              label: t('corrective.filters.converties_bt'),
              count: kpiStats.converted,
              activeBg: 'bg-blue-600 text-white shadow-xs',
              colorDot: 'bg-blue-500',
            },
            {
              key: 'ARRET',
              label: t('corrective.filters.arret_machine'),
              count: kpiStats.arret,
              activeBg: 'bg-purple-600 text-white shadow-xs',
              colorDot: 'bg-purple-500',
            },
            {
              key: 'AUTO_DI_PREVENTIF',
              label: 'Auto-DI Préventif',
              count: kpiStats.fromPreventive,
              activeBg: 'bg-indigo-600 text-white shadow-xs',
              colorDot: 'bg-indigo-500',
            },
          ].map((preset) => {
            const isActive = filterStatus === preset.key;
            return (
              <button
                key={preset.key}
                type="button"
                onClick={() => {
                  setFilterStatus(preset.key);
                  setCurrentPage(1);
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                  isActive
                    ? preset.activeBg
                    : 'bg-slate-100/80 hover:bg-slate-200/80 text-slate-700 border border-slate-200/60'
                }`}
              >
                {preset.colorDot && (
                  <span
                    className={`w-2 h-2 rounded-full ${preset.colorDot} ${
                      isActive ? 'ring-2 ring-white/50' : ''
                    }`}
                  />
                )}
                <span>{preset.label}</span>
                <span
                  className={`px-1.5 py-0.2 rounded text-[10px] font-mono font-bold ${
                    isActive ? 'bg-white/20 text-white' : 'bg-white text-slate-600 border border-slate-200/60'
                  }`}
                >
                  {preset.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* QUICK ORPHAN FILTER BAR */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 text-xs no-scrollbar">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1 mr-1 shrink-0">
            <AlertTriangle className="w-3 h-3 text-amber-500" />
            Intégrité Machine :
          </span>
          {[
            { key: 'ALL', label: 'Toutes', count: itemsWithOrphan.length },
            { key: 'LINKED_ONLY', label: 'Liées (Actives)', count: itemsWithOrphan.length - orphanCount },
            { key: 'ORPHAN_ONLY', label: `Orphelines (${orphanCount})`, count: orphanCount, highlight: orphanCount > 0 },
          ].map((preset) => {
            const isSelected = orphanFilter === preset.key;
            return (
              <button
                key={preset.key}
                type="button"
                onClick={() => {
                  setOrphanFilter(preset.key);
                  setCurrentPage(1);
                }}
                className={`h-7 px-2.5 rounded-lg text-xs transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
                  isSelected
                    ? 'bg-amber-600 text-white shadow-xs font-bold'
                    : preset.highlight
                    ? 'bg-amber-100 text-amber-900 border border-amber-300 font-bold animate-pulse'
                    : 'bg-slate-100/80 hover:bg-slate-200/80 text-slate-700 font-medium'
                }`}
              >
                <span>{preset.label}</span>
              </button>
            );
          })}
        </div>

        {/* 5-Column Multi-Criteria Filter Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 items-end">
          {/* 1. Omni-Text Search */}
          <div className="w-full sm:col-span-2 lg:col-span-1">
            <div className="flex items-center justify-between mb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-800">
              <span>{t('corrective.filters.search')}</span>
              <span className="px-1.5 py-0.2 rounded text-[9.5px] font-mono font-bold bg-slate-100 text-slate-600 border border-slate-200/80">
                Col. A+J
              </span>
            </div>
            <div className="relative">
              <div className="absolute left-2.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-md bg-amber-100 border border-amber-300/80 flex items-center justify-center text-amber-700 shadow-2xs pointer-events-none">
                <Search className="w-3 h-3" />
              </div>
              <input
                type="text"
                placeholder="Machine, anomalie, BT..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full h-9 pl-9 pr-7 rounded-xl border border-slate-200 bg-slate-50/70 text-xs font-semibold focus:bg-white focus:outline-none focus:ring-1 focus:ring-amber-500 transition-colors"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchTerm('');
                    setCurrentPage(1);
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-rose-600 cursor-pointer"
                  title="Effacer la recherche"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* 2. Machine Filter (Col. A) */}
          <div>
            <div className="flex items-center justify-between mb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-800">
              <span>{t('corrective.filters.machine')}</span>
              <span className="px-1.5 py-0.2 rounded text-[9.5px] font-mono font-bold bg-amber-50 text-amber-700 border border-amber-200/80">
                Col. A
              </span>
            </div>
            <CustomSelect
              value={filterMachine}
              prefixIcon={
                <span className="w-5 h-5 rounded-md bg-amber-100 border border-amber-300/80 flex items-center justify-center text-amber-700 shadow-2xs">
                  <Factory className="w-3 h-3" />
                </span>
              }
              onChange={(val) => {
                setFilterMachine(val);
                setCurrentPage(1);
              }}
              searchable
              options={[
                { value: 'ALL', label: `${t('corrective.filters.all_machines')} (${allMachineOptions.length})` },
                ...allMachineOptions.map((m) => {
                  const code = m.code || m.id_machine_registered || m.id;
                  return {
                    value: code,
                    label: `${code} ${m.zone ? `(${m.zone})` : ''}`,
                    sublabel: m.designation,
                  };
                }),
              ]}
            />
          </div>

          {/* 3. Type Panne Filter (Col. I) */}
          <div>
            <div className="flex items-center justify-between mb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-800">
              <span>{t('corrective.filters.type_panne')}</span>
              <span className="px-1.5 py-0.2 rounded text-[9.5px] font-mono font-bold bg-cyan-50 text-cyan-700 border border-cyan-200/80">
                Col. I
              </span>
            </div>
            <CustomSelect
              value={filterTypePanne}
              prefixIcon={
                <span className="w-5 h-5 rounded-md bg-amber-100 border border-amber-300/80 flex items-center justify-center text-amber-700 shadow-2xs">
                  <Layers className="w-3 h-3" />
                </span>
              }
              onChange={(val) => {
                setFilterTypePanne(val);
                setCurrentPage(1);
              }}
              options={[
                { value: 'ALL', label: `${t('corrective.filters.all_types')} (${availableCategories.length})` },
                ...availableCategories.map((cat) => ({
                  value: cat,
                  label: `Type ${cat} (${panneCategories[cat]?.length || 0} anomalies)`,
                })),
              ]}
            />
          </div>

          {/* 4. Urgence / Priorité */}
          <div>
            <div className="flex items-center justify-between mb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-800">
              <span>{t('corrective.filters.urgence')}</span>
              <span className="px-1.5 py-0.2 rounded text-[9.5px] font-mono font-bold bg-rose-50 text-rose-700 border border-rose-200/80">
                Priorité
              </span>
            </div>
            <CustomSelect
              value={filterUrgence}
              prefixIcon={
                <span className="w-5 h-5 rounded-md bg-amber-100 border border-amber-300/80 flex items-center justify-center text-amber-700 shadow-2xs">
                  <Flame className="w-3 h-3" />
                </span>
              }
              onChange={(val) => {
                setFilterUrgence(val);
                setCurrentPage(1);
              }}
              options={[
                { value: 'ALL', label: t('corrective.filters.all_urgences') },
                { value: 'HAUTE', label: t('corrective.filters.haute') },
                { value: 'MOYENNE', label: t('corrective.filters.moyenne') },
                { value: 'BASSE', label: t('corrective.filters.basse') },
              ]}
            />
          </div>

          {/* 5. Sort Menu Button & Popover */}
          <div className="relative" ref={sortMenuRef}>
            <div className="flex items-center justify-between mb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-800">
              <span>Tri & Ordre</span>
              <span className="px-1.5 py-0.2 rounded text-[9.5px] font-mono font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/80">
                Col. A→J
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowSortMenu(!showSortMenu)}
              className={`w-full h-9 px-2.5 rounded-xl border text-xs font-semibold transition flex items-center justify-between cursor-pointer ${
                showSortMenu || sortField !== 'date_demande' || sortOrder !== 'desc'
                  ? 'bg-amber-50/80 text-amber-950 border-amber-300 ring-1 ring-amber-200'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <div className="flex items-center gap-2 truncate">
                <span className="w-5 h-5 rounded-md bg-amber-100 border border-amber-300/80 flex items-center justify-center text-amber-700 shrink-0 shadow-2xs">
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
                  <span>A→J</span>
                </div>
                <div className="grid grid-cols-1 gap-1 text-xs max-h-60 overflow-y-auto pr-0.5">
                  {[
                    { key: 'code_machine', label: 'Machine (Col. A)' },
                    { key: 'date_demande', label: 'Date & Heure (Col. C)' },
                    { key: 'type_panne', label: 'Type Panne (Col. I)' },
                    { key: 'anomalie', label: 'Anomalie Constatée (Col. J)' },
                    { key: 'demandeur', label: 'Demandeur / Émetteur' },
                    { key: 'arret_machine', label: 'Arrêt Machine' },
                    { key: 'priorite', label: 'Priorité & Urgence' },
                    { key: 'statut', label: 'Statut de la Demande' },
                    { key: 'num_bt', label: 'N° Bon de Travail (BT)' },
                  ].map((col) => (
                    <button
                      key={col.key}
                      type="button"
                      onClick={() => {
                        toggleSort(col.key);
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

        {/* Active Filter Chips Bar */}
        {hasActiveFilters && (
          <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 flex-wrap gap-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-bold text-slate-400 text-[11px] uppercase tracking-wider">
                Filtres actifs :
              </span>
              {searchTerm && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-100 text-slate-800 font-bold text-[11px] border border-slate-200">
                  <span>Recherche: &quot;{searchTerm}&quot;</span>
                  <button
                    type="button"
                    onClick={() => {
                      setSearchTerm('');
                      setCurrentPage(1);
                    }}
                    className="hover:text-rose-600 cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {filterStatus !== 'ALL' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-50 text-amber-800 font-bold text-[11px] border border-amber-200">
                  <span>Statut: {filterStatus}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setFilterStatus('ALL');
                      setCurrentPage(1);
                    }}
                    className="hover:text-amber-950 cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {filterMachine !== 'ALL' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-50 text-amber-700 font-bold text-[11px] border border-amber-200">
                  <span>Machine: {filterMachine}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setFilterMachine('ALL');
                      setCurrentPage(1);
                    }}
                    className="hover:text-amber-900 cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {filterTypePanne !== 'ALL' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-cyan-50 text-cyan-700 font-bold text-[11px] border border-cyan-200">
                  <span>Type: {filterTypePanne}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setFilterTypePanne('ALL');
                      setCurrentPage(1);
                    }}
                    className="hover:text-cyan-900 cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {filterUrgence !== 'ALL' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-rose-50 text-rose-700 font-bold text-[11px] border border-rose-200">
                  <span>Urgence: {filterUrgence}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setFilterUrgence('ALL');
                      setCurrentPage(1);
                    }}
                    className="hover:text-rose-900 cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={clearAllFilters}
              className="text-slate-400 hover:text-rose-600 font-semibold text-[11px] transition cursor-pointer flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Tout effacer</span>
            </button>
          </div>
        )}
      </div>

      {/* 3. Unified Dual-Mode Industrial Data Grid (Excel Table ⇄ Operational Cards) */}
      <GmaoIndustrialDataGrid
        title="Tableau Demandes_Intervention • Ordre Excel Row 3 : A → J"
        icon={<Flame className="w-4 h-4 text-amber-600" />}
        excelMapping="Machine (A) | Date & Heure (C) | Type (I) | Anomalie Constatée (J) | Demandeur / Travail | Arrêt | Priorité | Statut | Action BT"
        bannerColor="amber"
        columns={diColumns}
        data={displayedDis}
        sortField={sortField}
        sortOrder={sortOrder}
        onSort={toggleSort}
        renderSortIcon={renderSortIcon}
        startIndex={startIndex}
        showRowNumber={true}
        cardGridClassName="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
        renderCard={(di, _idx, rowNumber) => {
          const isPending =
            di.statut === 'DEMANDE' ||
            di.statut === 'DEMANDE_CREEE' ||
            di.statut === 'EN_ATTENTE_VALIDATION';
          const isArret = di.arret_machine === true || di.arret_machine === 'OUI';
          const valStatus = String(di.validation_status || '').toUpperCase();

          return (
            <div
              key={di.id || rowNumber}
              className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between group"
            >
              <div className="space-y-3">
                {/* Card Top Header: Machine + Priority & Downtime */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-700 flex items-center justify-center font-black text-[10.5px] border border-amber-200/80 shadow-2xs font-mono shrink-0">
                      {String(di.code_machine || 'MCH').slice(0, 3)}
                    </span>
                    <div className="min-w-0">
                      <div className="font-black text-slate-900 font-mono text-xs truncate">
                        {di.code_machine}
                      </div>
                      <div className="text-[10px] font-mono text-slate-400">
                        N° {rowNumber} • {di.date_demande || di.date || '—'} {di.heure_demande || ''}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0 flex-wrap justify-end">
                    {isArret && (
                      <span className="px-2 py-0.5 rounded-full font-bold text-[9.5px] bg-rose-100 text-rose-800 border border-rose-200 font-mono">
                        ARRÊT
                      </span>
                    )}
                    <span
                      className={`px-2 py-0.5 rounded-full font-bold text-[9.5px] font-mono ${
                        di.priorite === 'HAUTE'
                          ? 'bg-rose-50 text-rose-700 border border-rose-200'
                          : di.priorite === 'BASSE'
                          ? 'bg-slate-100 text-slate-600 border border-slate-200/60'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}
                    >
                      {di.priorite || 'MOYENNE'}
                    </span>
                  </div>
                </div>

                {/* Anomaly & Type */}
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/70 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="px-2 py-0.5 rounded font-mono font-bold text-[10px] bg-white text-slate-800 border border-slate-200">
                      Type {di.type_panne || 'M'}
                    </span>
                    <span className="text-[10.5px] font-semibold text-slate-500 truncate">
                      Par {di.demandeur || 'Production'}
                    </span>
                  </div>
                  <div className="font-bold text-slate-900 text-xs leading-snug line-clamp-2" title={di.anomalie}>
                    {di.anomalie || t('corrective.common.unspecified', 'Anomalie non spécifiée')}
                  </div>
                  {di.travail_a_faire && (
                    <div className="text-[11px] text-slate-600 line-clamp-2">
                      {di.travail_a_faire}
                    </div>
                  )}
                </div>
              </div>

              {/* Card Footer: Status + Action */}
              <div className="mt-3.5 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                <div>
                  {di.statut === 'CLOTURE' ||
                  valStatus === 'PENDING_VALIDATION' ||
                  valStatus === 'NEEDS_CLARIFICATION' ||
                  valStatus === 'REJECTED' ? (
                    <ValidationStatusBadge record={di} compact showNote />
                  ) : isPending ? (
                    <span className="px-2.5 py-1 rounded-full font-bold text-[10px] bg-amber-100 text-amber-900 border border-amber-300 font-mono">
                      EN ATTENTE
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 rounded-full font-bold text-[10px] bg-blue-100 text-blue-900 border border-blue-300 font-mono">
                      BT ACTIF ({di.num_bt || 'BT'})
                    </span>
                  )}
                </div>

                {isPending && canConvertBt && (
                  <button
                    type="button"
                    onClick={() => handleOpenConvert(di)}
                    className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition flex items-center gap-1.5 cursor-pointer shadow-2xs active:scale-95"
                  >
                    <Wrench className="w-3.5 h-3.5" />
                    <span>{t('corrective.di.generate_bt', 'Générer BT')}</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          );
        }}
        emptyIcon={<Flame className="w-8 h-8 text-slate-300" />}
        emptyMessage="Aucune demande d'intervention trouvée pour les filtres sélectionnés."
        pagination={{
          currentPage,
          setCurrentPage,
          pageSize,
          setPageSize,
          totalItems,
          pageSizeOptions: [20, 25, 50, 100, 200, 0],
          color: 'amber',
          itemLabel: 'demandes',
        }}
      />

      <DemandesInterventionModals
        showCreateModal={showCreateModal}
        setShowCreateModal={setShowCreateModal}
        handleCreateSubmit={handleCreateSubmit}
        newForm={newForm}
        setNewForm={setNewForm}
        allMachineOptions={allMachineOptions}
        blueprintCommonFailures={blueprintCommonFailures}
        selectedMachineBlueprintId={selectedMachineBlueprintId}
        handleApplyBlueprintCommonFailure={handleApplyBlueprintCommonFailure}
        machineComponents={machineComponents}
        machineParts={machineParts}
        rankedStockItems={rankedStockItems}
        panneCategories={panneCategories}
        availableCategories={availableCategories}
        anomaliesForSelectedCategory={anomaliesForSelectedCategory}
        getActionsForPanne={getActionsForPanne}
        showTravauxSelector={showTravauxSelector}
        setShowTravauxSelector={setShowTravauxSelector}
        travauxSearchTerm={travauxSearchTerm}
        setTravauxSearchTerm={setTravauxSearchTerm}
        filteredStandardTravaux={filteredStandardTravaux}
        showToast={showToast}
        showConvertModal={showConvertModal}
        setShowConvertModal={setShowConvertModal}
        handleConvertSubmit={handleConvertSubmit}
        convertForm={convertForm}
        setConvertForm={setConvertForm}
        allTechnicianOptions={allTechnicianOptions}
        selectedConvertTechEval={selectedConvertTechEval}
        convertTechEvaluations={convertTechEvaluations}
        stockItems={stockItems}
        convertReservationEval={convertReservationEval}
      />
    </div>
  );
}
