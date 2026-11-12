import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Wrench,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  Hammer,
  PackageCheck,
  XCircle,
  FileText,
  ArrowRight,
  AlertTriangle,
  Cog,
  SlidersHorizontal,
  RotateCcw,
  FileSpreadsheet,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  X,
  Layers,
  Factory,
  ChevronDown,
  User,
  Radio,
  Lock,
  Play,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import CustomSelect from '../../components/common/CustomSelect';
import GmaoIndustrialDataGrid from '../../components/common/GmaoIndustrialDataGrid';
import { GmaoKpiCard, GmaoKpiGrid } from '../../components/common/GmaoKpiCard';
import PeriodFilterBar from '../../components/common/PeriodFilterBar';
import { type PeriodFilterState, isDateInPeriod } from '../../../utils/datePeriodUtils';
import { useI18n } from '../../../i18n/I18nContext';
import { useGmaoStore } from '../../../store/useGmaoStore';
import { filterActiveMachines } from '../../../utils/activeMachines';
import { useAuth } from '../../../context/AuthContext';
import { AuthorizationService } from '../../../core/security/AuthorizationService';
import {
  getAllowedNextWorkshopStatuses,
  isWorkshopOrderActive,
  WORKSHOP_STATUS_LABELS,
  WORKSHOP_TYPE_LABELS,
  type IWorkshopOrder,
  type WorkshopOrderStatus,
  type WorkshopOrderType,
} from '../../../domain/corrective/workshopOrderService';

interface AtelierFabricationTabProps {
  onNavigateToBt?: (btKey: string) => void;
  showToast?: (message: string, type?: string) => void;
}

const STATUS_BADGE_STYLES: Record<WorkshopOrderStatus, string> = {
  EMIS: 'bg-amber-100 text-amber-900 border-amber-300',
  EN_COURS_FABRICATION: 'bg-blue-100 text-blue-900 border-blue-300',
  PRET_LIVRAISON: 'bg-indigo-100 text-indigo-900 border-indigo-300',
  RECEPTIONNE_MONTAGE: 'bg-emerald-100 text-emerald-900 border-emerald-300',
  ANNULE: 'bg-slate-100 text-slate-600 border-slate-300 line-through',
};

const ACTION_BUTTON_LABELS: Record<WorkshopOrderStatus, { label: string; style: string }> = {
  EMIS: {
    label: 'Émettre',
    style: 'bg-amber-600 hover:bg-amber-700 text-white shadow-2xs',
  },
  EN_COURS_FABRICATION: {
    label: 'Lancer Fabrication',
    style: 'bg-blue-600 hover:bg-blue-700 text-white shadow-2xs',
  },
  PRET_LIVRAISON: {
    label: 'Prêt Livraison',
    style: 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-2xs',
  },
  RECEPTIONNE_MONTAGE: {
    label: 'Réceptionner & Monter',
    style: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs',
  },
  ANNULE: {
    label: 'Annuler',
    style: 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200',
  },
};

export const AtelierFabricationTab: React.FC<AtelierFabricationTabProps> = ({
  onNavigateToBt,
  showToast,
}) => {
  const { t } = useI18n();
  const workshopOrders = useGmaoStore((state) => state.workshopOrders || []);
  const machines = useGmaoStore((state) => state.machines || []);
  const correctiveInterventions = useGmaoStore((state) => state.correctiveInterventions || []);
  const handleCreateWorkshopOrder = useGmaoStore((state) => state.handleCreateWorkshopOrder);
  const handleTransitionWorkshopOrderStatus = useGmaoStore(
    (state) => state.handleTransitionWorkshopOrderStatus
  );

  const { user: currentUser } = useAuth();
  const canCreate =
    Boolean(currentUser) &&
    (AuthorizationService.hasPermission(currentUser, 'workshop.create') ||
      AuthorizationService.hasPermission(currentUser, 'corrective.execute'));
  const canManage =
    Boolean(currentUser) &&
    (AuthorizationService.hasPermission(currentUser, 'workshop.manage') ||
      AuthorizationService.hasPermission(currentUser, 'corrective.execute'));

  const activeMachines = useMemo(() => filterActiveMachines(machines), [machines]);
  const machineLookup = useMemo(() => {
    const map = new Map<string, string>();
    (machines || []).forEach((m: any) => {
      const code = String(m.id_machine_registered || m.id_machine || m.code || m.id || '').trim();
      const nom = String(m.nom || m.designation || m.name || '').trim();
      if (code) map.set(code.toUpperCase(), nom);
    });
    return map;
  }, [machines]);

  const openBts = useMemo(() => {
    return (correctiveInterventions || []).filter((item: any) => {
      const st = String(item.statut || '').trim().toUpperCase();
      const closed = String(item.action_fermee || '').trim().toUpperCase() === 'OUI';
      return !closed && st !== 'CLOTURE' && st !== 'ANNULE';
    });
  }, [correctiveInterventions]);

  // Filters State
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [machineFilter, setMachineFilter] = useState<string>('ALL');
  const [btLinkFilter, setBtLinkFilter] = useState<string>('ALL'); // 'ALL' | 'WITH_BT' | 'AUTONOME'
  const [periodFilter, setPeriodFilter] = useState<PeriodFilterState>({ preset: 'ALL' });
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Sorting & Pagination State
  const [sortField, setSortField] = useState<string>('code_bon');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(20);
  const [showSortMenu, setShowSortMenu] = useState<boolean>(false);
  const sortMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (sortMenuRef.current && !sortMenuRef.current.contains(e.target as Node)) {
        setShowSortMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Modal / creation form state
  const [showCreateForm, setShowCreateForm] = useState<boolean>(false);
  const [formType, setFormType] = useState<WorkshopOrderType>('REALISATION');
  const [formMachine, setFormMachine] = useState<string>('');
  const [formBtId, setFormBtId] = useState<string>('');
  const [formQuantite, setFormQuantite] = useState<number>(1);
  const [formDescription, setFormDescription] = useState<string>('');
  const [formObservation, setFormObservation] = useState<string>('');
  const [formSection] = useState<string>('SM');
  const [formDestinataire] = useState<string>('Atelier Fabrication Mécanique');

  // KPIs
  const kpis = useMemo(() => {
    const total = workshopOrders.length;
    const emis = workshopOrders.filter((o) => o.statut === 'EMIS').length;
    const enCours = workshopOrders.filter((o) => o.statut === 'EN_COURS_FABRICATION').length;
    const pret = workshopOrders.filter((o) => o.statut === 'PRET_LIVRAISON').length;
    const receptionne = workshopOrders.filter((o) => o.statut === 'RECEPTIONNE_MONTAGE').length;
    const annule = workshopOrders.filter((o) => o.statut === 'ANNULE').length;
    const activeCount = workshopOrders.filter((o) => isWorkshopOrderActive(o.statut)).length;
    const withBtCount = workshopOrders.filter((o) => Boolean(o.id_bt)).length;
    const brCount = workshopOrders.filter((o) => o.type_demande === 'REALISATION').length;
    const rectCount = workshopOrders.filter((o) => o.type_demande === 'RECTIFICATION').length;
    return {
      total,
      emis,
      enCours,
      pret,
      receptionne,
      annule,
      activeCount,
      withBtCount,
      brCount,
      rectCount,
    };
  }, [workshopOrders]);

  // Available machines for filter dropdown
  const availableMachines = useMemo(() => {
    const set = new Set<string>();
    activeMachines.forEach((m: any) => {
      const code = String(m.id_machine_registered || m.id_machine || m.code || m.id || '').trim();
      if (code) set.add(code);
    });
    workshopOrders.forEach((o) => {
      if (o.id_machine) set.add(String(o.id_machine).trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [activeMachines, workshopOrders]);

  // Available dates for PeriodFilterBar
  const availableOrderDates = useMemo(() => {
    return workshopOrders.map((o) => o.date_emission || o.date_statut);
  }, [workshopOrders]);

  // Filtered Orders
  const filteredOrders = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return workshopOrders.filter((ord) => {
      if (statusFilter === 'ACTIVE_ONLY' && !isWorkshopOrderActive(ord.statut)) return false;
      if (
        statusFilter !== 'ALL' &&
        statusFilter !== 'ACTIVE_ONLY' &&
        ord.statut !== statusFilter
      ) {
        return false;
      }
      if (typeFilter !== 'ALL' && ord.type_demande !== typeFilter) return false;
      if (
        machineFilter !== 'ALL' &&
        String(ord.id_machine || '').toUpperCase() !== machineFilter.toUpperCase()
      ) {
        return false;
      }
      if (btLinkFilter === 'WITH_BT' && !ord.id_bt) return false;
      if (btLinkFilter === 'AUTONOME' && Boolean(ord.id_bt)) return false;

      // Period filter
      const ordDate = ord.date_emission || ord.date_statut;
      if (!isDateInPeriod(ordDate, periodFilter)) return false;

      if (q) {
        const hay = [
          ord.code_bon,
          ord.id_machine,
          ord.id_bt,
          ord.description_travaux,
          ord.observation,
          ord.emetteur_name,
          ord.emetteur_section,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [
    workshopOrders,
    statusFilter,
    typeFilter,
    machineFilter,
    btLinkFilter,
    periodFilter,
    searchQuery,
  ]);

  // Sorted Orders
  const sortedOrders = useMemo(() => {
    const list = [...filteredOrders];
    list.sort((a: any, b: any) => {
      let valA = a[sortField] ?? '';
      let valB = b[sortField] ?? '';

      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
    return list;
  }, [filteredOrders, sortField, sortOrder]);

  // Pagination
  const totalItems = sortedOrders.length;
  const effectivePageSize = pageSize === 0 ? totalItems : pageSize;
  const startIndex = (currentPage - 1) * effectivePageSize;
  const displayedOrders =
    pageSize === 0 ? sortedOrders : sortedOrders.slice(startIndex, startIndex + effectivePageSize);

  const toggleSort = (field: string) => {
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

  const hasActiveFilters =
    statusFilter !== 'ALL' ||
    typeFilter !== 'ALL' ||
    machineFilter !== 'ALL' ||
    btLinkFilter !== 'ALL' ||
    periodFilter.preset !== 'ALL' ||
    Boolean(searchQuery.trim());

  const clearAllFilters = () => {
    setStatusFilter('ALL');
    setTypeFilter('ALL');
    setMachineFilter('ALL');
    setBtLinkFilter('ALL');
    setPeriodFilter({ preset: 'ALL' });
    setSearchQuery('');
    setCurrentPage(1);
  };

  const handleExportFilteredExcel = () => {
    try {
      const headers = [
        'Code Bon (A)',
        'Nature Demande (B)',
        'Machine (C)',
        'BT Lié (D)',
        'Quantité',
        'Description des Travaux (E)',
        'Observation',
        'Section Émettrice (F)',
        'Destinataire',
        'Date Émission',
        'Statut Atelier (G)',
      ];
      const dataRows = sortedOrders.map((item) => [
        item.code_bon || '',
        WORKSHOP_TYPE_LABELS[item.type_demande] || item.type_demande || '',
        item.id_machine || '',
        item.id_bt || 'Autonome',
        item.quantite ?? 1,
        item.description_travaux || '',
        item.observation || '',
        `${item.emetteur_section || 'SM'}${item.emetteur_name ? ` (${item.emetteur_name})` : ''}`,
        item.destinataire || 'Atelier Fabrication Mécanique',
        item.date_emission ? item.date_emission.slice(0, 10) : '',
        WORKSHOP_STATUS_LABELS[item.statut] || item.statut || '',
      ]);

      const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Bons_Atelier_Mecanique');
      XLSX.writeFile(
        wb,
        `Atelier_Mecanique_BR_RECT_${new Date().toISOString().split('T')[0]}.xlsx`
      );

      showToast?.(
        'Export Excel des Bons d’Atelier Mécanique généré avec succès (.xlsx)',
        'success'
      );
    } catch (err) {
      console.error(err);
      showToast?.("Erreur lors de l'export Excel", 'error');
    }
  };

  const handleSelectBtInForm = (btKey: string) => {
    setFormBtId(btKey);
    if (btKey) {
      const found = openBts.find(
        (b: any) => String(b.num_bt || b.id) === btKey || String(b.id) === btKey
      );
      if (found) {
        const mCode = String(found.code_machine || found.machine || '').trim();
        if (mCode) setFormMachine(mCode);
      }
    }
  };

  const handleSubmitCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanMachine = formMachine.trim();
    const cleanDesc = formDescription.trim();
    if (!cleanMachine) {
      showToast?.('Veuillez sélectionner une machine active.', 'warning');
      return;
    }
    if (!cleanDesc) {
      showToast?.('Veuillez décrire les travaux demandés à l’atelier.', 'warning');
      return;
    }

    const created = handleCreateWorkshopOrder({
      type_demande: formType,
      id_machine: cleanMachine,
      id_bt: formBtId.trim() || null,
      quantite: Math.max(1, Number(formQuantite) || 1),
      description_travaux: cleanDesc,
      observation: formObservation.trim() || undefined,
      emetteur_section: formSection.trim() || 'SM',
      destinataire: formDestinataire.trim() || 'Atelier Fabrication Mécanique',
      emetteur_user_id: currentUser?.id || 'SM',
      emetteur_name: currentUser?.name || 'Section Maintenance',
    });

    if (created) {
      showToast?.(
        created.id_bt
          ? `Bon Atelier ${created.code_bon} émis et rattaché au BT ${created.id_bt} (BT placé en attente atelier).`
          : `Bon Atelier ${created.code_bon} émis pour la machine ${created.id_machine}.`,
        'success'
      );
      setFormDescription('');
      setFormObservation('');
      setFormQuantite(1);
      setFormBtId('');
      setShowCreateForm(false);
    }
  };

  const handleTransition = (order: IWorkshopOrder, targetStatus: WorkshopOrderStatus) => {
    const res = handleTransitionWorkshopOrderStatus(order.id, targetStatus);
    if (!res.valid) {
      showToast?.(res.reason || 'Transition non autorisée.', 'error');
      return;
    }
    showToast?.(
      targetStatus === 'RECEPTIONNE_MONTAGE'
        ? order.id_bt
          ? `${order.code_bon} → Réceptionné & Monté. Le BT ${order.id_bt} peut maintenant être clôturé selon la procédure corrective.`
          : `${order.code_bon} → Pièce réceptionnée et montée sur machine.`
        : `${order.code_bon} → ${WORKSHOP_STATUS_LABELS[targetStatus]}`,
      'success'
    );
  };

  // Columns for Unified GmaoIndustrialDataGrid
  const workshopColumns = useMemo(
    () => [
      {
        key: 'code_bon',
        label: 'Code Bon',
        colLetter: 'Col A',
        icon: Hammer,
        sortable: true,
        render: (ord: IWorkshopOrder) => {
          const isRect = ord.type_demande === 'RECTIFICATION';
          return (
            <div className="flex items-center gap-2 whitespace-nowrap">
              <span
                className={`w-7 h-7 rounded-lg flex items-center justify-center font-black text-[10px] border shadow-2xs font-mono ${
                  isRect
                    ? 'bg-purple-500/10 text-purple-700 border-purple-200/60'
                    : 'bg-amber-500/10 text-amber-700 border-amber-200/60'
                }`}
              >
                {isRect ? 'RECT' : 'BR'}
              </span>
              <span className="font-bold text-slate-900 font-mono">{ord.code_bon}</span>
            </div>
          );
        },
      },
      {
        key: 'type_demande',
        label: 'Nature',
        colLetter: 'Col B',
        icon: Layers,
        sortable: true,
        render: (ord: IWorkshopOrder) => (
          <span
            className={`inline-flex items-center px-2.5 py-1 rounded-md text-[10.5px] font-mono font-bold border shadow-2xs whitespace-nowrap ${
              ord.type_demande === 'RECTIFICATION'
                ? 'bg-purple-50 text-purple-800 border-purple-200'
                : 'bg-cyan-50 text-cyan-800 border-cyan-200'
            }`}
          >
            {WORKSHOP_TYPE_LABELS[ord.type_demande] || ord.type_demande}
          </span>
        ),
      },
      {
        key: 'id_machine',
        label: 'Machine',
        colLetter: 'Col C',
        icon: Factory,
        sortable: true,
        render: (ord: IWorkshopOrder) => {
          const machineName = machineLookup.get(String(ord.id_machine || '').toUpperCase());
          return (
            <div className="flex flex-col gap-0.5">
              <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200 text-xs font-mono font-bold whitespace-nowrap w-fit">
                {ord.id_machine}
              </span>
              {machineName && (
                <span
                  className="text-[10px] text-slate-500 truncate max-w-[160px]"
                  title={machineName}
                >
                  {machineName}
                </span>
              )}
            </div>
          );
        },
      },
      {
        key: 'id_bt',
        label: 'BT Lié',
        colLetter: 'Col D',
        icon: Wrench,
        sortable: true,
        render: (ord: IWorkshopOrder) =>
          ord.id_bt ? (
            <button
              type="button"
              onClick={() => onNavigateToBt && onNavigateToBt(String(ord.id_bt))}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200 font-mono text-xs font-bold transition cursor-pointer shadow-2xs"
              title="Ouvrir le Bon de Travail lié"
            >
              <FileText className="w-3 h-3 text-blue-600 shrink-0" />
              <span>{ord.id_bt}</span>
            </button>
          ) : (
            <span className="px-2 py-0.5 rounded bg-slate-50 text-slate-400 border border-slate-200/70 font-mono text-[10.5px]">
              Autonome
            </span>
          ),
      },
      {
        key: 'description_travaux',
        label: 'Qté & Travaux Demandés',
        colLetter: 'Col E',
        icon: FileText,
        sortable: true,
        render: (ord: IWorkshopOrder) => (
          <div className="max-w-xs">
            <div className="font-semibold text-slate-900 flex items-center gap-1.5 flex-wrap">
              <span className="inline-flex items-center px-1.5 py-0.5 bg-amber-50 text-amber-900 border border-amber-200 rounded font-mono text-[10px] font-black shrink-0">
                Qté: {ord.quantite}
              </span>
              <span className="truncate" title={ord.description_travaux}>
                {ord.description_travaux}
              </span>
            </div>
            {ord.observation && (
              <div
                className="text-[10.5px] text-slate-500 truncate mt-0.5"
                title={ord.observation}
              >
                Obs: {ord.observation}
              </div>
            )}
          </div>
        ),
      },
      {
        key: 'date_emission',
        label: 'Émetteur & Date',
        colLetter: 'Col F',
        icon: User,
        sortable: true,
        render: (ord: IWorkshopOrder) => {
          const dateEmissionShort = ord.date_emission ? ord.date_emission.slice(0, 10) : '—';
          return (
            <div className="whitespace-nowrap">
              <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>
                  {ord.emetteur_section || 'SM'}
                  {ord.emetteur_name ? ` · ${ord.emetteur_name}` : ''}
                </span>
              </div>
              <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                Émis le {dateEmissionShort}
              </div>
            </div>
          );
        },
      },
      {
        key: 'statut',
        label: 'Statut Atelier',
        colLetter: 'Col G',
        icon: Radio,
        align: 'center',
        sortable: true,
        render: (ord: IWorkshopOrder) => (
          <div className="flex flex-col items-center gap-1 whitespace-nowrap">
            <span
              className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10.5px] font-mono font-bold border shadow-2xs ${
                STATUS_BADGE_STYLES[ord.statut] ||
                'bg-slate-100 text-slate-700 border-slate-300'
              }`}
            >
              {WORKSHOP_STATUS_LABELS[ord.statut] || ord.statut}
            </span>
            {ord.id_bt && isWorkshopOrderActive(ord.statut) && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200/80">
                <AlertTriangle className="w-2.5 h-2.5 text-amber-600 shrink-0" />
                Bloque clôture BT
              </span>
            )}
          </div>
        ),
      },
      {
        key: 'actions',
        label: 'Progression Cycle',
        colLetter: 'Col H',
        icon: Play,
        align: 'center',
        headerClassName: 'w-56 text-center whitespace-nowrap',
        render: (ord: IWorkshopOrder) => {
          const nextStatuses = getAllowedNextWorkshopStatuses(ord.statut);
          if (canManage && nextStatuses.length > 0) {
            return (
              <div className="flex items-center justify-center gap-1.5 flex-wrap">
                {nextStatuses.map((targetSt) => {
                  const btnCfg = ACTION_BUTTON_LABELS[targetSt];
                  return (
                    <button
                      key={targetSt}
                      type="button"
                      onClick={() => handleTransition(ord, targetSt)}
                      className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[10.5px] font-bold transition cursor-pointer active:scale-95 ${btnCfg.style}`}
                    >
                      {targetSt !== 'ANNULE' ? (
                        <ArrowRight className="w-3 h-3 shrink-0" />
                      ) : (
                        <XCircle className="w-3 h-3 shrink-0" />
                      )}
                      <span>{btnCfg.label}</span>
                    </button>
                  );
                })}
              </div>
            );
          }

          if (ord.statut === 'RECEPTIONNE_MONTAGE') {
            return (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 font-mono font-bold text-xs shadow-2xs">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                Monté & Clôturé
              </span>
            );
          }

          if (ord.statut === 'ANNULE') {
            return (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 text-slate-500 font-mono font-bold text-[10.5px]">
                Annulé
              </span>
            );
          }

          return (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 text-slate-600 font-mono font-bold text-[10.5px]">
              <Lock className="w-3 h-3 text-slate-400" />
              Lecture seule
            </span>
          );
        },
      },
    ],
    [machineLookup, canManage, onNavigateToBt]
  );

  return (
    <div className="space-y-6">
      {/* 1. Top 5 Primary KPI Metrics Bar (Unified GmaoKpiGrid + GmaoKpiCard) */}
      <GmaoKpiGrid columns={5}>
        <GmaoKpiCard
          title="Total Bons Atelier"
          value={kpis.total}
          unit="bons"
          icon={Hammer}
          color="blue"
          valueColored={false}
          isActive={statusFilter === 'ALL'}
          onClick={() => {
            setStatusFilter('ALL');
            setCurrentPage(1);
          }}
          badgeText="Registre BR & RECT"
          footerLabel="En cours actifs :"
          footerValue={`${kpis.activeCount} actif(s)`}
        />

        <GmaoKpiCard
          title="Émis (Attente Atelier)"
          value={kpis.emis}
          unit="en attente"
          icon={Clock}
          color="amber"
          isActive={statusFilter === 'EMIS'}
          onClick={() => {
            setStatusFilter('EMIS');
            setCurrentPage(1);
          }}
          badgeText="Prise en charge requise"
          pulseBadge={kpis.emis > 0}
          footerLabel="Origine :"
          footerValue="Section Maint. (SM)"
        />

        <GmaoKpiCard
          title="En Cours Fabrication"
          value={kpis.enCours}
          unit="en usinage"
          icon={Cog}
          color="cyan"
          isActive={statusFilter === 'EN_COURS_FABRICATION'}
          onClick={() => {
            setStatusFilter('EN_COURS_FABRICATION');
            setCurrentPage(1);
          }}
          badgeText="Tournage / Rectification"
          pulseBadge={kpis.enCours > 0}
          footerLabel="Répartition :"
          footerValue={`${kpis.brCount} BR · ${kpis.rectCount} RECT`}
        />

        <GmaoKpiCard
          title="Prêts Livraison SM"
          value={kpis.pret}
          unit="disponibles"
          icon={PackageCheck}
          color="indigo"
          isActive={statusFilter === 'PRET_LIVRAISON'}
          onClick={() => {
            setStatusFilter('PRET_LIVRAISON');
            setCurrentPage(1);
          }}
          badgeText="Usinage terminé"
          footerLabel="Action SM :"
          footerValue="Réception & Montage"
        />

        <GmaoKpiCard
          title="Réceptionnés & Montés"
          value={kpis.receptionne}
          unit="montés OK"
          icon={CheckCircle2}
          color="emerald"
          isActive={statusFilter === 'RECEPTIONNE_MONTAGE'}
          onClick={() => {
            setStatusFilter('RECEPTIONNE_MONTAGE');
            setCurrentPage(1);
          }}
          badgeText="Clôture BT débloquée"
          footerLabel="Taux achèvement :"
          footerValue={`${kpis.total ? Math.round((kpis.receptionne / kpis.total) * 100) : 0}%`}
        />
      </GmaoKpiGrid>

      {/* 1.5. Period Filter Bar (P1 Factory Memory) */}
      <PeriodFilterBar
        value={periodFilter}
        onChange={(next) => {
          setPeriodFilter(next);
          setCurrentPage(1);
        }}
        availableDates={availableOrderDates}
        filteredCount={sortedOrders.length}
        totalCount={workshopOrders.length}
      />

      {/* 2. Filter & Search Card (Unified Mature Light UI Design System — Matched with Bons de Travail) */}
      <div className="relative z-30 bg-white border border-slate-200 rounded-2xl p-4 md:p-5 shadow-[0_12px_32px_-6px_rgba(0,0,0,0.12),0_4px_12px_-2px_rgba(0,0,0,0.06)] hover:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.16),0_6px_16px_-3px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-300 ease-out space-y-4">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-200/80 flex items-center justify-center text-amber-700 shadow-2xs">
              <SlidersHorizontal className="w-4 h-4 text-amber-700" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-black uppercase tracking-wider text-slate-900">
                  {t('common.filters.title', 'Filtres & Recherche')}
                </span>
                <span className="bg-amber-50 text-amber-800 px-3 py-1 rounded-lg text-xs font-bold border border-amber-200/70 shadow-2xs">
                  {filteredOrders.length} Bon{filteredOrders.length > 1 ? 's' : ''} affiché
                  {filteredOrders.length > 1 ? 's' : ''} / {workshopOrders.length}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Atelier Fabrication Mécanique • Bons de Réalisation (BR) & Rectification (RECT) • Hors Stock PDR
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap">
            <button
              type="button"
              onClick={handleExportFilteredExcel}
              className="h-8 px-3 rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs active:scale-95"
              title="Exporter les Bons d'Atelier filtrés vers Excel (.xlsx)"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span className="hidden sm:inline">Export Excel</span>
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

            {canCreate && (
              <button
                type="button"
                onClick={() => setShowCreateForm((v) => !v)}
                className="h-8 px-3.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm shadow-amber-600/25 active:scale-95"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>
                  {showCreateForm ? 'Fermer le formulaire' : 'Nouveau Bon Atelier (BR / RECT)'}
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Quick Status Presets */}
        <div className="flex items-center gap-2 flex-wrap text-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1 mr-1">
            <Hammer className="w-3 h-3 text-slate-400" />
            État Atelier :
          </span>
          {[
            {
              key: 'ALL',
              label: 'Tous les Bons',
              count: workshopOrders.length,
              activeBg: 'bg-slate-900 text-white shadow-xs',
              colorDot: null,
            },
            {
              key: 'ACTIVE_ONLY',
              label: 'En Cours (Actifs)',
              count: kpis.activeCount,
              activeBg: 'bg-amber-600 text-white shadow-xs',
              colorDot: 'bg-amber-500',
            },
            {
              key: 'EMIS',
              label: 'Émis (Attente)',
              count: kpis.emis,
              activeBg: 'bg-amber-600 text-white shadow-xs',
              colorDot: 'bg-amber-500',
            },
            {
              key: 'EN_COURS_FABRICATION',
              label: 'En Fabrication',
              count: kpis.enCours,
              activeBg: 'bg-blue-600 text-white shadow-xs',
              colorDot: 'bg-blue-500',
            },
            {
              key: 'PRET_LIVRAISON',
              label: 'Prêts Livraison',
              count: kpis.pret,
              activeBg: 'bg-indigo-600 text-white shadow-xs',
              colorDot: 'bg-indigo-500',
            },
            {
              key: 'RECEPTIONNE_MONTAGE',
              label: 'Réceptionnés & Montés',
              count: kpis.receptionne,
              activeBg: 'bg-emerald-600 text-white shadow-xs',
              colorDot: 'bg-emerald-500',
            },
            {
              key: 'ANNULE',
              label: 'Annulés',
              count: kpis.annule,
              activeBg: 'bg-rose-600 text-white shadow-xs',
              colorDot: 'bg-rose-500',
            },
          ].map((preset) => {
            const isActive = statusFilter === preset.key;
            return (
              <button
                key={preset.key}
                type="button"
                onClick={() => {
                  setStatusFilter(preset.key);
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
                    isActive
                      ? 'bg-white/20 text-white'
                      : 'bg-white text-slate-600 border border-slate-200/60'
                  }`}
                >
                  {preset.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* 5-Column Multi-Criteria Filter Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 items-end pt-2 border-t border-slate-100">
          {/* 1. Omni-Text Search */}
          <div className="w-full sm:col-span-2 lg:col-span-1">
            <div className="flex items-center justify-between mb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-800">
              <span>Recherche</span>
              <span className="px-1.5 py-0.2 rounded text-[9.5px] font-mono font-bold bg-slate-100 text-slate-600 border border-slate-200/80">
                Col. A+E
              </span>
            </div>
            <div className="relative">
              <div className="absolute left-2.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-md bg-amber-100 border border-amber-300/80 flex items-center justify-center text-amber-700 shadow-2xs pointer-events-none">
                <Search className="w-3 h-3" />
              </div>
              <input
                type="text"
                placeholder="Rechercher par N° bon (BR/RECT), machine, BT, description..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full h-9 pl-9 pr-7 rounded-xl border border-slate-200 bg-slate-50/70 text-xs font-semibold focus:bg-white focus:outline-none focus:ring-1 focus:ring-amber-500 transition-colors"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
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

          {/* 2. Nature de la demande (BR / RECT) */}
          <div>
            <div className="flex items-center justify-between mb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-800">
              <span>Nature Demande</span>
              <span className="px-1.5 py-0.2 rounded text-[9.5px] font-mono font-bold bg-cyan-50 text-cyan-700 border border-cyan-200/80">
                Col. B
              </span>
            </div>
            <CustomSelect
              value={typeFilter}
              prefixIcon={
                <span className="w-5 h-5 rounded-md bg-amber-100 border border-amber-300/80 flex items-center justify-center text-amber-700 shadow-2xs">
                  <Layers className="w-3 h-3" />
                </span>
              }
              onChange={(val) => {
                setTypeFilter(val);
                setCurrentPage(1);
              }}
              options={[
                { value: 'ALL', label: `Tous types (${workshopOrders.length})` },
                { value: 'REALISATION', label: `Réalisation BR (${kpis.brCount})` },
                { value: 'RECTIFICATION', label: `Rectification RECT (${kpis.rectCount})` },
              ]}
            />
          </div>

          {/* 3. Machine Filter */}
          <div>
            <div className="flex items-center justify-between mb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-800">
              <span>Machine</span>
              <span className="px-1.5 py-0.2 rounded text-[9.5px] font-mono font-bold bg-amber-50 text-amber-700 border border-amber-200/80">
                Col. C
              </span>
            </div>
            <CustomSelect
              value={machineFilter}
              prefixIcon={
                <span className="w-5 h-5 rounded-md bg-amber-100 border border-amber-300/80 flex items-center justify-center text-amber-700 shadow-2xs">
                  <Factory className="w-3 h-3" />
                </span>
              }
              onChange={(val) => {
                setMachineFilter(val);
                setCurrentPage(1);
              }}
              searchable
              options={[
                { value: 'ALL', label: `Toutes les Machines (${availableMachines.length})` },
                ...availableMachines.map((m) => ({
                  value: m,
                  label: m,
                })),
              ]}
            />
          </div>

          {/* 4. Liaison BT Filter */}
          <div>
            <div className="flex items-center justify-between mb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-800">
              <span>Liaison BT</span>
              <span className="px-1.5 py-0.2 rounded text-[9.5px] font-mono font-bold bg-blue-50 text-blue-700 border border-blue-200/80">
                Col. D
              </span>
            </div>
            <CustomSelect
              value={btLinkFilter}
              prefixIcon={
                <span className="w-5 h-5 rounded-md bg-amber-100 border border-amber-300/80 flex items-center justify-center text-amber-700 shadow-2xs">
                  <Wrench className="w-3 h-3" />
                </span>
              }
              onChange={(val) => {
                setBtLinkFilter(val);
                setCurrentPage(1);
              }}
              options={[
                { value: 'ALL', label: `Tous (${workshopOrders.length})` },
                { value: 'WITH_BT', label: `Rattachés à un BT (${kpis.withBtCount})` },
                {
                  value: 'AUTONOME',
                  label: `Bons Autonomes (${workshopOrders.length - kpis.withBtCount})`,
                },
              ]}
            />
          </div>

          {/* 5. Sort Menu Button & Popover */}
          <div className="relative" ref={sortMenuRef}>
            <div className="flex items-center justify-between mb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-800">
              <span>Tri & Ordre</span>
              <span className="px-1.5 py-0.2 rounded text-[9.5px] font-mono font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/80">
                Col. A→G
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowSortMenu(!showSortMenu)}
              className={`w-full h-9 px-2.5 rounded-xl border text-xs font-semibold transition flex items-center justify-between cursor-pointer ${
                showSortMenu || sortField !== 'code_bon' || sortOrder !== 'desc'
                  ? 'bg-amber-50/80 text-amber-950 border-amber-300 ring-1 ring-amber-200'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <div className="flex items-center gap-2 truncate">
                <span className="w-5 h-5 rounded-md bg-amber-100 border border-amber-300/80 flex items-center justify-center text-amber-700 shrink-0 shadow-2xs">
                  <ArrowUpDown className="w-3 h-3" />
                </span>
                <span className="truncate">
                  Tri :{' '}
                  <b className="font-mono text-slate-900">
                    {sortField.slice(0, 10).toUpperCase()}
                  </b>{' '}
                  ({sortOrder === 'asc' ? 'A→Z' : 'Z→A'})
                </span>
              </div>
              <ChevronDown
                className={`w-3 h-3 text-slate-400 transition-transform shrink-0 ${
                  showSortMenu ? 'rotate-180' : ''
                }`}
              />
            </button>

            {showSortMenu && (
              <div className="absolute right-0 mt-1 w-64 bg-white rounded-2xl border border-slate-200 shadow-xl z-50 p-2.5 space-y-1.5 animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  <span>Sélectionner la Colonne de Tri</span>
                  <span>A→G</span>
                </div>
                <div className="grid grid-cols-1 gap-1 text-xs max-h-60 overflow-y-auto pr-0.5">
                  {[
                    { key: 'code_bon', label: 'Code Bon (Col. A)' },
                    { key: 'type_demande', label: 'Nature BR/RECT (Col. B)' },
                    { key: 'id_machine', label: 'Machine (Col. C)' },
                    { key: 'id_bt', label: 'BT Lié (Col. D)' },
                    { key: 'description_travaux', label: 'Travaux Demandés (Col. E)' },
                    { key: 'date_emission', label: 'Date Émission (Col. F)' },
                    { key: 'statut', label: 'Statut Atelier (Col. G)' },
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
                      {sortField === col.key &&
                        (sortOrder === 'asc' ? (
                          <ArrowUp className="w-3.5 h-3.5 text-amber-700" />
                        ) : (
                          <ArrowDown className="w-3.5 h-3.5 text-amber-700" />
                        ))}
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
              {searchQuery && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-100 text-slate-800 font-bold text-[11px] border border-slate-200">
                  <span>Recherche: &quot;{searchQuery}&quot;</span>
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setCurrentPage(1);
                    }}
                    className="hover:text-rose-600 cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {statusFilter !== 'ALL' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-blue-50 text-blue-800 font-bold text-[11px] border border-blue-200">
                  <span>Statut: {statusFilter}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setStatusFilter('ALL');
                      setCurrentPage(1);
                    }}
                    className="hover:text-blue-950 cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {typeFilter !== 'ALL' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-cyan-50 text-cyan-700 font-bold text-[11px] border border-cyan-200">
                  <span>Nature: {typeFilter}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setTypeFilter('ALL');
                      setCurrentPage(1);
                    }}
                    className="hover:text-cyan-900 cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {machineFilter !== 'ALL' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-50 text-amber-700 font-bold text-[11px] border border-amber-200">
                  <span>Machine: {machineFilter}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setMachineFilter('ALL');
                      setCurrentPage(1);
                    }}
                    className="hover:text-amber-900 cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {btLinkFilter !== 'ALL' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-indigo-50 text-indigo-700 font-bold text-[11px] border border-indigo-200">
                  <span>Liaison: {btLinkFilter}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setBtLinkFilter('ALL');
                      setCurrentPage(1);
                    }}
                    className="hover:text-indigo-900 cursor-pointer"
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

      {/* 2.5. Creation Form Card (Unified Mature Light Card Archetype) */}
      {showCreateForm && (
        <form
          onSubmit={handleSubmitCreate}
          className="bg-white border-2 border-amber-300 rounded-2xl p-5 space-y-4 shadow-[0_12px_32px_-6px_rgba(245,158,11,0.14),0_4px_12px_-2px_rgba(0,0,0,0.06)] animate-in fade-in slide-in-from-top-2 duration-200"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-200 flex items-center justify-center text-amber-700 shadow-2xs">
                <Hammer className="w-4 h-4 text-amber-700" />
              </div>
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">
                  Émission d&apos;un Bon de Réalisation / Rectification (Atelier Mécanique)
                </h3>
                <p className="text-[11px] text-slate-500">
                  Section Maintenance (SM) ➔ Atelier Fabrication Mécanique • Hors stockActuel PDR • Ne clôture pas le BT automatiquement
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowCreateForm(false)}
              className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition cursor-pointer self-end sm:self-auto"
              title="Fermer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3.5">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Nature de la demande *
              </label>
              <select
                value={formType}
                onChange={(e) => setFormType(e.target.value as WorkshopOrderType)}
                className="w-full h-9 px-3 text-xs font-bold bg-slate-50/70 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
              >
                <option value="REALISATION">
                  REALISATION — Confection / Usinage pièce neuve (BR)
                </option>
                <option value="RECTIFICATION">
                  RECTIFICATION — Réparation / Tournage / Ajustage (RECT)
                </option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Machine concernée (Active) *
              </label>
              <select
                value={formMachine}
                onChange={(e) => setFormMachine(e.target.value)}
                required
                className="w-full h-9 px-3 text-xs font-bold bg-slate-50/70 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
              >
                <option value="">-- Sélectionner une machine --</option>
                {activeMachines.map((m: any) => {
                  const code = String(m.id_machine_registered || m.id_machine || m.code || m.id || '');
                  const nom = String(m.nom || m.designation || '');
                  return (
                    <option key={code} value={code}>
                      {code} {nom ? `— ${nom}` : ''}
                    </option>
                  );
                })}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Lier à un BT ouvert (Optionnel)
              </label>
              <select
                value={formBtId}
                onChange={(e) => handleSelectBtInForm(e.target.value)}
                className="w-full h-9 px-3 text-xs font-semibold bg-slate-50/70 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
              >
                <option value="">Bon autonome (Sans BT)</option>
                {openBts.map((bt: any) => {
                  const key = String(bt.num_bt || bt.id || '');
                  const mCode = String(bt.code_machine || bt.machine || '');
                  return (
                    <option key={String(bt.id)} value={key}>
                      {key} — {mCode} ({bt.anomalie || bt.panne || 'Correctif'})
                    </option>
                  );
                })}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Quantité à usiner / rectifier *
              </label>
              <input
                type="number"
                min={1}
                value={formQuantite}
                onChange={(e) => setFormQuantite(Math.max(1, Number(e.target.value) || 1))}
                className="w-full h-9 px-3 text-xs font-bold font-mono bg-slate-50/70 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            <div className="md:col-span-2">
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Description technique des travaux (Cotes, matière, usinage demandé) *
              </label>
              <input
                type="text"
                required
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Ex: Rectification portée d'arbre Ø45mm + confection bague bronze..."
                className="w-full h-9 px-3 text-xs font-semibold bg-slate-50/70 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Observation / Croquis / Tolérance
              </label>
              <input
                type="text"
                value={formObservation}
                onChange={(e) => setFormObservation(e.target.value)}
                placeholder="Ex: Urgence arrêt ligne, tolérance H7/g6..."
                className="w-full h-9 px-3 text-xs font-semibold bg-slate-50/70 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-100">
            <div className="flex items-center gap-3 text-[11px] text-slate-600 flex-wrap">
              <span className="px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 font-semibold">
                <strong>Émetteur:</strong> {formSection} ({currentUser?.name || 'Section Maintenance'})
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 font-semibold">
                <strong>Destinataire:</strong> {formDestinataire}
              </span>
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="h-9 px-3.5 text-xs font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="h-9 px-4 text-xs font-black uppercase text-white bg-amber-600 hover:bg-amber-700 rounded-xl shadow-sm shadow-amber-600/20 cursor-pointer active:scale-95 transition"
              >
                Émettre le Bon Atelier
              </button>
            </div>
          </div>
        </form>
      )}

      {/* 3. Unified Dual-Mode Industrial Data Grid + Built-in TablePaginationCard Footer */}
      <GmaoIndustrialDataGrid
        title="Tableau Atelier_Fabrication_Mecanique • Bons de Réalisation (BR) & Rectification (RECT)"
        icon={<FileSpreadsheet className="w-4 h-4 text-amber-600" />}
        excelMapping="N° | Code Bon (A) | Nature (B) | Machine (C) | BT Lié (D) | Qté & Travaux (E) | Émetteur (F) | Statut Atelier (G) | Action (H)"
        bannerColor="amber"
        columns={workshopColumns}
        data={displayedOrders}
        sortField={sortField}
        sortOrder={sortOrder}
        onSort={toggleSort}
        renderSortIcon={renderSortIcon}
        startIndex={startIndex}
        showRowNumber={true}
        rowKey={(ord: IWorkshopOrder, _idx: number, rowNumber: number) =>
          ord.id || ord.code_bon || rowNumber
        }
        cardGridClassName="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
        renderCard={(ord: IWorkshopOrder, _idx: number, rowNumber: number) => {
          const isRect = ord.type_demande === 'RECTIFICATION';
          const machineName = machineLookup.get(String(ord.id_machine || '').toUpperCase());
          const nextStatuses = getAllowedNextWorkshopStatuses(ord.statut);
          const dateEmissionShort = ord.date_emission ? ord.date_emission.slice(0, 10) : '—';

          return (
            <div
              key={ord.id || ord.code_bon || rowNumber}
              className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between group"
            >
              <div className="space-y-3">
                {/* Card Header: Code Bon + Type Badge + Machine */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-[10px] border shadow-2xs font-mono shrink-0 ${
                        isRect
                          ? 'bg-purple-500/10 text-purple-700 border-purple-200/70'
                          : 'bg-amber-500/10 text-amber-700 border-amber-200/70'
                      }`}
                    >
                      {isRect ? 'RECT' : 'BR'}
                    </span>
                    <div className="min-w-0">
                      <div className="font-black text-slate-900 font-mono text-xs truncate">
                        {ord.code_bon}
                      </div>
                      <div className="text-[10px] font-mono text-slate-400">
                        N° {rowNumber} • Émis le {dateEmissionShort}
                      </div>
                    </div>
                  </div>

                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold border shadow-2xs shrink-0 ${
                      STATUS_BADGE_STYLES[ord.statut] ||
                      'bg-slate-100 text-slate-700 border-slate-300'
                    }`}
                  >
                    {WORKSHOP_STATUS_LABELS[ord.statut] || ord.statut}
                  </span>
                </div>

                {/* Machine & Linked BT Row */}
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200 text-xs font-mono font-bold">
                      {ord.id_machine}
                    </span>
                    {machineName && (
                      <span className="text-[10.5px] text-slate-500 truncate max-w-[140px]">
                        {machineName}
                      </span>
                    )}
                  </div>

                  {ord.id_bt ? (
                    <button
                      type="button"
                      onClick={() => onNavigateToBt && onNavigateToBt(String(ord.id_bt))}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200 font-mono text-[11px] font-bold transition cursor-pointer"
                    >
                      <FileText className="w-3 h-3 text-blue-600 shrink-0" />
                      <span>{ord.id_bt}</span>
                    </button>
                  ) : (
                    <span className="px-2 py-0.5 rounded bg-slate-50 text-slate-400 border border-slate-200/70 font-mono text-[10px]">
                      Autonome
                    </span>
                  )}
                </div>

                {/* Work Description & Qty */}
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/70 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center px-1.5 py-0.5 bg-amber-50 text-amber-900 border border-amber-200 rounded font-mono text-[10px] font-black">
                      Qté: {ord.quantite}
                    </span>
                    <span className="text-[10px] font-semibold text-slate-500 truncate">
                      {ord.emetteur_section || 'SM'}
                      {ord.emetteur_name ? ` · ${ord.emetteur_name}` : ''}
                    </span>
                  </div>
                  <div className="font-bold text-slate-900 text-xs leading-snug line-clamp-2" title={ord.description_travaux}>
                    {ord.description_travaux}
                  </div>
                  {ord.observation && (
                    <div className="text-[10.5px] text-slate-500 line-clamp-1">
                      Obs: {ord.observation}
                    </div>
                  )}
                </div>
              </div>

              {/* Card Footer: Cycle Progression Actions */}
              <div className="mt-3.5 pt-3 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap">
                {ord.id_bt && isWorkshopOrderActive(ord.statut) ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200/80">
                    <AlertTriangle className="w-2.5 h-2.5 text-amber-600 shrink-0" />
                    Bloque clôture BT
                  </span>
                ) : (
                  <span className="text-[10px] font-mono text-slate-400">
                    {WORKSHOP_TYPE_LABELS[ord.type_demande] || ord.type_demande}
                  </span>
                )}

                <div className="flex items-center gap-1.5 ml-auto">
                  {canManage && nextStatuses.length > 0 ? (
                    nextStatuses.map((targetSt) => {
                      const btnCfg = ACTION_BUTTON_LABELS[targetSt];
                      return (
                        <button
                          key={targetSt}
                          type="button"
                          onClick={() => handleTransition(ord, targetSt)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10.5px] font-bold transition cursor-pointer active:scale-95 ${btnCfg.style}`}
                        >
                          {targetSt !== 'ANNULE' ? (
                            <ArrowRight className="w-3 h-3 shrink-0" />
                          ) : (
                            <XCircle className="w-3 h-3 shrink-0" />
                          )}
                          <span>{btnCfg.label}</span>
                        </button>
                      );
                    })
                  ) : ord.statut === 'RECEPTIONNE_MONTAGE' ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 font-mono font-bold text-[11px]">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      Monté & Clôturé
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
          );
        }}
        emptyIcon={<Hammer className="w-8 h-8 text-slate-300" />}
        emptyMessage="Aucun Bon de Réalisation / Rectification trouvé pour les filtres sélectionnés."
        pagination={{
          currentPage,
          setCurrentPage,
          pageSize,
          setPageSize,
          totalItems,
          pageSizeOptions: [20, 25, 50, 100, 200, 0],
          color: 'amber',
          itemLabel: 'bons atelier',
        }}
      />
    </div>
  );
};

export default AtelierFabricationTab;
