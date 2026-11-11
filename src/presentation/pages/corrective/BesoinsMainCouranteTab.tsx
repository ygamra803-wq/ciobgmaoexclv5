import React, { useMemo, useState } from 'react';
import {
  Package,
  Wrench,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Plus,
  Search,
  RotateCcw,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  FileSpreadsheet,
  Factory,
  ShieldCheck,
  Truck,
  Hammer,
  UserCheck,
  Play,
  XCircle,
  ExternalLink,
  Layers,
} from 'lucide-react';
import { useGmaoStore } from '../../../store/useGmaoStore';
import { useAuth } from '../../../context/AuthContext';
import { AuthorizationService } from '../../../core/security/AuthorizationService';
import { isTechnicianRole } from '../../../core/security/technicianScope';
import { filterActiveMachines } from '../../../utils/activeMachines';
import {
  getSuggestedChannelsForMaterialClass,
  isNeedRequestActive,
  NEED_APPRO_CHANNEL_LABELS,
  NEED_MATERIAL_CLASS_LABELS,
  NEED_STATUS_LABELS,
  type INeedRequest,
  type NeedApproChannel,
  type NeedMaterialClass,
  type NeedRequestStatus,
} from '../../../domain/corrective/needRequestService';
import {
  isWorkshopOrderActive,
  WORKSHOP_STATUS_LABELS,
  type WorkshopOrderType,
} from '../../../domain/corrective/workshopOrderService';
import { GmaoKpiCard, GmaoKpiGrid } from '../../components/common/GmaoKpiCard';
import GmaoIndustrialDataGrid, {
  type IndustrialGridColumn,
} from '../../components/common/GmaoIndustrialDataGrid';
import CustomSelect from '../../components/common/CustomSelect';
import PeriodFilterBar from '../../components/common/PeriodFilterBar';
import { type PeriodFilterState, isDateInPeriod } from '../../../utils/datePeriodUtils';

interface BesoinsMainCouranteTabProps {
  onNavigateToTab?: (tabId: string) => void;
  showToast?: (msg: string, type?: string) => void;
}

const ALL_CHANNELS: NeedApproChannel[] = ['STOCK', 'ACHAT', 'ATELIER', 'EXTERNE'];

export default function BesoinsMainCouranteTab({
  onNavigateToTab,
  showToast,
}: BesoinsMainCouranteTabProps) {
  const { user } = useAuth();
  const isTechUser = isTechnicianRole(user);
  const canCreateNeed =
    Boolean(user) &&
    (AuthorizationService.hasPermission(user, 'need.create') ||
      AuthorizationService.hasPermission(user, 'corrective.execute'));
  const canReviewNeed =
    Boolean(user) &&
    !isTechUser &&
    (AuthorizationService.hasPermission(user, 'need.review') ||
      AuthorizationService.hasPermission(user, 'corrective.manage'));
  const canHandoffNeed =
    Boolean(user) &&
    !isTechUser &&
    (AuthorizationService.hasPermission(user, 'need.handoff') ||
      AuthorizationService.hasPermission(user, 'need.review') ||
      AuthorizationService.hasPermission(user, 'stock.edit'));

  const needRequests = useGmaoStore((s) => s.needRequests || []);
  const workshopOrders = useGmaoStore((s) => s.workshopOrders || []);
  const machines = useGmaoStore((s) => s.machines || []);
  const correctiveInterventions = useGmaoStore((s) => s.correctiveInterventions || []);
  const rawStock = useGmaoStore((s) => s.rawStock || []);
  const handleCreateNeedRequest = useGmaoStore((s) => s.handleCreateNeedRequest);
  const handleReviewNeedRequest = useGmaoStore((s) => s.handleReviewNeedRequest);
  const handleTransitionNeedRequestStatus = useGmaoStore(
    (s) => s.handleTransitionNeedRequestStatus
  );

  const activeMachines = useMemo(() => filterActiveMachines(machines), [machines]);

  const openBts = useMemo(() => {
    return (correctiveInterventions || []).filter(
      (i) =>
        i.num_bt &&
        String(i.statut || '').toUpperCase() !== 'CLOTURE' &&
        String(i.action_fermee || '').toUpperCase() !== 'OUI'
    );
  }, [correctiveInterventions]);

  const workshopMap = useMemo(() => {
    const map = new Map<string, (typeof workshopOrders)[number]>();
    for (const ord of workshopOrders) {
      if (ord.id) map.set(ord.id, ord);
      if (ord.code_bon) map.set(ord.code_bon, ord);
    }
    return map;
  }, [workshopOrders]);

  // Filters & Pagination
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterClass, setFilterClass] = useState<string>('ALL');
  const [filterChannel, setFilterChannel] = useState<string>('ALL');
  const [filterMachine, setFilterMachine] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [periodFilter, setPeriodFilter] = useState<PeriodFilterState>({ preset: 'ALL' });
  const [sortField, setSortField] = useState<string>('date_creation');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(20);

  // Create Need Request Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState<{
    id_machine: string;
    id_bt: string;
    material_class: NeedMaterialClass;
    id_ref_pdr: string;
    quantite: number;
    description_besoin: string;
  }>({
    id_machine: '',
    id_bt: '',
    material_class: 'PDR',
    id_ref_pdr: '',
    quantite: 1,
    description_besoin: '',
  });

  // Supervisor Review Modal
  const [reviewModalItem, setReviewModalItem] = useState<INeedRequest | null>(null);
  const [reviewDecision, setReviewDecision] = useState<
    'APPROVISIONNEMENT' | 'CLARIFICATION' | 'REJETE'
  >('APPROVISIONNEMENT');
  const [reviewCanal, setReviewCanal] = useState<NeedApproChannel>('STOCK');
  const [reviewWorkshopType, setReviewWorkshopType] =
    useState<WorkshopOrderType>('REALISATION');
  const [reviewNotes, setReviewNotes] = useState<string>('');
  const [reviewMotifRejet, setReviewMotifRejet] = useState<string>('');

  const openSupervisorReview = (req: INeedRequest) => {
    const suggested = getSuggestedChannelsForMaterialClass(req.material_class);
    setReviewModalItem(req);
    setReviewDecision('APPROVISIONNEMENT');
    setReviewCanal((req.canal_appro as NeedApproChannel) || suggested[0] || 'STOCK');
    setReviewWorkshopType('REALISATION');
    setReviewNotes(req.notes_superviseur || '');
    setReviewMotifRejet(req.motif_rejet || '');
  };

  // KPIs
  const kpis = useMemo(() => {
    const total = needRequests.length;
    const toReview = needRequests.filter(
      (r) =>
        r.statut === 'DEMANDE_TECH' ||
        r.statut === 'REVUE_SUPERVISEUR' ||
        r.statut === 'CLARIFICATION'
    ).length;
    const inAppro = needRequests.filter((r) => r.statut === 'APPROVISIONNEMENT').length;
    const readyHandoff = needRequests.filter(
      (r) => r.statut === 'RECU_STRUCTURE' || r.statut === 'REMIS_TECHNICIEN'
    ).length;
    const inPoseEssai = needRequests.filter((r) => r.statut === 'POSE_ESSAI').length;
    const closedField = needRequests.filter((r) => r.statut === 'CLOTURE_FIELD').length;
    const activeCount = needRequests.filter((r) => isNeedRequestActive(r.statut)).length;

    return {
      total,
      toReview,
      inAppro,
      readyHandoff,
      inPoseEssai,
      closedField,
      activeCount,
    };
  }, [needRequests]);

  const allDatesForPeriod = useMemo(
    () => needRequests.map((r) => r.date_creation || r.date_statut),
    [needRequests]
  );

  const filteredRequests = useMemo(() => {
    return needRequests.filter((req) => {
      if (filterStatus !== 'ALL') {
        if (filterStatus === 'ACTIVE_ONLY') {
          if (!isNeedRequestActive(req.statut)) return false;
        } else if (filterStatus === 'TO_REVIEW') {
          if (
            req.statut !== 'DEMANDE_TECH' &&
            req.statut !== 'REVUE_SUPERVISEUR' &&
            req.statut !== 'CLARIFICATION'
          ) {
            return false;
          }
        } else if (req.statut !== filterStatus) {
          return false;
        }
      }
      if (filterClass !== 'ALL' && req.material_class !== filterClass) return false;
      if (filterChannel !== 'ALL') {
        if (filterChannel === 'UNASSIGNED') {
          if (req.canal_appro) return false;
        } else if (req.canal_appro !== filterChannel) {
          return false;
        }
      }
      if (filterMachine !== 'ALL' && req.id_machine !== filterMachine) return false;

      const dateVal = String(req.date_creation || req.date_statut || '').slice(0, 10);
      if (!isDateInPeriod(dateVal, periodFilter)) return false;

      if (searchTerm.trim()) {
        const q = searchTerm.trim().toLowerCase();
        const hay = [
          req.code_demande,
          req.id_machine,
          req.id_bt,
          req.nom_technicien_demandeur,
          req.description_besoin,
          req.id_ref_pdr,
          req.code_workshop_order,
          req.notes_superviseur,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [
    needRequests,
    filterStatus,
    filterClass,
    filterChannel,
    filterMachine,
    periodFilter,
    searchTerm,
  ]);

  const sortedRequests = useMemo(() => {
    const copy = [...filteredRequests];
    copy.sort((a: any, b: any) => {
      const va = String(a?.[sortField] ?? '');
      const vb = String(b?.[sortField] ?? '');
      const cmp = va.localeCompare(vb, undefined, { numeric: true, sensitivity: 'base' });
      return sortOrder === 'asc' ? cmp : -cmp;
    });
    return copy;
  }, [filteredRequests, sortField, sortOrder]);

  const totalPages = Math.max(1, Math.ceil(sortedRequests.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const displayedRequests = sortedRequests.slice(startIndex, startIndex + pageSize);

  const toggleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder((p) => (p === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const renderSortIcon = (field: string) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60" />;
    }
    return sortOrder === 'asc' ? (
      <ArrowUp className="w-3 h-3 text-amber-600" />
    ) : (
      <ArrowDown className="w-3 h-3 text-amber-600" />
    );
  };

  const handleSubmitCreateNeed = (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.id_machine.trim()) {
      showToast?.('Veuillez sélectionner une machine active.', 'warning');
      return;
    }
    if (!createForm.description_besoin.trim()) {
      showToast?.('Veuillez décrire le besoin technique.', 'warning');
      return;
    }

    const stockItem = createForm.id_ref_pdr
      ? rawStock.find(
          (s: any) =>
            String(s.ref || s.code_article || '').toUpperCase() ===
            createForm.id_ref_pdr.trim().toUpperCase()
        )
      : null;

    const created = handleCreateNeedRequest({
      id_machine: createForm.id_machine.trim(),
      id_bt: createForm.id_bt.trim() || null,
      material_class: createForm.material_class,
      id_ref_pdr: createForm.id_ref_pdr.trim() || null,
      designation_pdr: stockItem ? String(stockItem.designation || stockItem.nom || '') : null,
      quantite: Math.max(1, Number(createForm.quantite) || 1),
      description_besoin: createForm.description_besoin.trim(),
      id_technicien_demandeur: user?.personnelId || user?.code || user?.id || 'TECH',
      nom_technicien_demandeur: user?.name || 'Technicien',
    });

    if (created) {
      showToast?.(
        `Demande de besoin ${created.code_demande} enregistrée (Statut: DEMANDE_TECH · En attente arbitrage superviseur).`,
        'success'
      );
      setShowCreateModal(false);
      setCreateForm({
        id_machine: '',
        id_bt: '',
        material_class: 'PDR',
        id_ref_pdr: '',
        quantite: 1,
        description_besoin: '',
      });
    }
  };

  const handleConfirmSupervisorReview = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewModalItem) return;

    if (reviewDecision === 'REJETE' && !reviewMotifRejet.trim()) {
      showToast?.('Veuillez indiquer le motif du rejet.', 'warning');
      return;
    }
    if (reviewDecision === 'CLARIFICATION' && !reviewNotes.trim()) {
      showToast?.('Veuillez préciser la clarification demandée au technicien.', 'warning');
      return;
    }

    const res = handleReviewNeedRequest(reviewModalItem.id, {
      decision: reviewDecision,
      canal_appro: reviewDecision === 'APPROVISIONNEMENT' ? reviewCanal : null,
      workshopOrderType: reviewWorkshopType,
      notes_superviseur: reviewNotes,
      motif_rejet: reviewMotifRejet,
      actorRole: user?.role || 'ADMIN',
      actorId: user?.id || user?.code || 'admin',
      actorName: user?.name || 'Responsable',
    });

    if (!res.valid) {
      showToast?.(res.reason || 'Arbitrage refusé.', 'error');
      return;
    }

    if (reviewDecision === 'APPROVISIONNEMENT') {
      const workshopMsg = res.workshopOrder
        ? ` et Bon Atelier ${res.workshopOrder.code_bon} généré automatiquement`
        : '';
      showToast?.(
        `Besoin ${reviewModalItem.code_demande} orienté vers ${reviewCanal}${workshopMsg}.`,
        'success'
      );
    } else if (reviewDecision === 'CLARIFICATION') {
      showToast?.(
        `Clarification demandée au technicien pour ${reviewModalItem.code_demande}.`,
        'warning'
      );
    } else {
      showToast?.(`Demande de besoin ${reviewModalItem.code_demande} rejetée.`, 'info');
    }

    setReviewModalItem(null);
  };

  const handleQuickTransition = (req: INeedRequest, nextStatus: NeedRequestStatus) => {
    const res = handleTransitionNeedRequestStatus(req.id, nextStatus, {
      actorRole: user?.role || (isTechUser ? 'TECHNICIEN' : 'ADMIN'),
      isTechnician: isTechUser,
      actorId: user?.id || user?.code || 'user',
      actorName: user?.name || 'Utilisateur',
    });
    if (!res.valid) {
      showToast?.(res.reason || 'Transition refusée.', 'warning');
      return;
    }
    showToast?.(
      `Demande ${req.code_demande} passée à « ${NEED_STATUS_LABELS[nextStatus] || nextStatus} ».`,
      'success'
    );
  };

  const renderStatusBadge = (status: NeedRequestStatus) => {
    const styles: Record<NeedRequestStatus, string> = {
      DEMANDE_TECH: 'bg-amber-100 text-amber-900 border-amber-300',
      REVUE_SUPERVISEUR: 'bg-purple-100 text-purple-900 border-purple-300',
      APPROVISIONNEMENT: 'bg-blue-100 text-blue-900 border-blue-300',
      RECU_STRUCTURE: 'bg-cyan-100 text-cyan-900 border-cyan-300',
      REMIS_TECHNICIEN: 'bg-indigo-100 text-indigo-900 border-indigo-300',
      POSE_ESSAI: 'bg-orange-100 text-orange-950 border-orange-300 animate-pulse',
      CLOTURE_FIELD: 'bg-emerald-100 text-emerald-900 border-emerald-300',
      CLARIFICATION: 'bg-rose-100 text-rose-900 border-rose-300',
      REJETE: 'bg-slate-200 text-slate-700 border-slate-300',
      ANNULE: 'bg-slate-200 text-slate-600 border-slate-300',
    };
    return (
      <span
        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-mono font-bold border shadow-2xs ${
          styles[status] || 'bg-slate-100 text-slate-700 border-slate-200'
        }`}
      >
        {NEED_STATUS_LABELS[status] || status}
      </span>
    );
  };

  const renderChannelBadge = (req: INeedRequest) => {
    if (!req.canal_appro) {
      const suggested = getSuggestedChannelsForMaterialClass(req.material_class);
      return (
        <div className="flex flex-col items-start gap-0.5">
          <span className="text-[10px] font-mono font-bold text-slate-400">
            Non arbitré (Tech)
          </span>
          <span className="text-[9.5px] font-mono text-amber-800 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
            Suggéré: {suggested.join(' / ')}
          </span>
        </div>
      );
    }

    const colorMap: Record<NeedApproChannel, string> = {
      STOCK: 'bg-cyan-50 text-cyan-900 border-cyan-300',
      ACHAT: 'bg-purple-50 text-purple-900 border-purple-300',
      ATELIER: 'bg-amber-50 text-amber-950 border-amber-300',
      EXTERNE: 'bg-indigo-50 text-indigo-900 border-indigo-300',
    };

    const linkedWorkshop = req.id_workshop_order
      ? workshopMap.get(req.id_workshop_order) ||
        (req.code_workshop_order ? workshopMap.get(req.code_workshop_order) : undefined)
      : undefined;

    return (
      <div className="flex flex-col items-start gap-1">
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10.5px] font-mono font-bold border ${
            colorMap[req.canal_appro] || 'bg-slate-100 text-slate-800 border-slate-200'
          }`}
        >
          {req.canal_appro === 'ATELIER' ? (
            <Hammer className="w-3 h-3 shrink-0" />
          ) : req.canal_appro === 'STOCK' ? (
            <Package className="w-3 h-3 shrink-0" />
          ) : (
            <Truck className="w-3 h-3 shrink-0" />
          )}
          <span>{req.canal_appro}</span>
        </span>
        {(linkedWorkshop || req.code_workshop_order) && (
          <button
            type="button"
            onClick={() => onNavigateToTab?.('corrective_atelier')}
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-white border border-amber-300 text-amber-900 text-[10px] font-mono font-bold hover:bg-amber-50 cursor-pointer"
            title="Voir dans Atelier Fabrication Mécanique"
          >
            <span>{linkedWorkshop?.code_bon || req.code_workshop_order}</span>
            {linkedWorkshop && (
              <span className="opacity-80">
                ({WORKSHOP_STATUS_LABELS[linkedWorkshop.statut] || linkedWorkshop.statut})
              </span>
            )}
            <ExternalLink className="w-2.5 h-2.5" />
          </button>
        )}
      </div>
    );
  };

  const renderHandoffActions = (req: INeedRequest) => {
    const linkedWorkshop = req.id_workshop_order
      ? workshopMap.get(req.id_workshop_order) ||
        (req.code_workshop_order ? workshopMap.get(req.code_workshop_order) : undefined)
      : undefined;
    const isWorkshopBlockingRecu =
      req.canal_appro === 'ATELIER' &&
      linkedWorkshop != null &&
      isWorkshopOrderActive(linkedWorkshop.statut);

    return (
      <div className="flex items-center justify-center gap-1.5 flex-wrap">
        {/* 1. Supervisor Arbitration (DEMANDE_TECH / REVUE_SUPERVISEUR / CLARIFICATION) */}
        {canReviewNeed &&
          (req.statut === 'DEMANDE_TECH' ||
            req.statut === 'REVUE_SUPERVISEUR' ||
            req.statut === 'CLARIFICATION') && (
            <button
              type="button"
              data-testid={`review-need-${req.code_demande}`}
              onClick={() => openSupervisorReview(req)}
              className="px-2.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs transition inline-flex items-center gap-1 cursor-pointer shadow-2xs"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Arbitrer Canal</span>
            </button>
          )}

        {/* Technician Resubmit after Clarification */}
        {req.statut === 'CLARIFICATION' && canCreateNeed && (
          <button
            type="button"
            onClick={() => handleQuickTransition(req, 'DEMANDE_TECH')}
            className="px-2.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition inline-flex items-center gap-1 cursor-pointer shadow-2xs"
          >
            <Play className="w-3.5 h-3.5" />
            <span>Renvoyer Tech</span>
          </button>
        )}

        {/* 2. APPROVISIONNEMENT -> RECU_STRUCTURE */}
        {canHandoffNeed && req.statut === 'APPROVISIONNEMENT' && (
          <button
            type="button"
            disabled={isWorkshopBlockingRecu}
            onClick={() => handleQuickTransition(req, 'RECU_STRUCTURE')}
            title={
              isWorkshopBlockingRecu
                ? `En attente de réception du Bon Atelier ${linkedWorkshop?.code_bon} (${linkedWorkshop?.statut})`
                : 'Confirmer que la pièce est reçue / prête pour remise au technicien'
            }
            className={`px-2.5 py-1.5 rounded-xl font-bold text-xs transition inline-flex items-center gap-1 shadow-2xs ${
              isWorkshopBlockingRecu
                ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                : 'bg-cyan-600 hover:bg-cyan-700 text-white cursor-pointer'
            }`}
          >
            <Truck className="w-3.5 h-3.5" />
            <span>
              {isWorkshopBlockingRecu ? 'Att. Atelier' : 'Réceptionner Structure'}
            </span>
          </button>
        )}

        {/* 3. RECU_STRUCTURE -> REMIS_TECHNICIEN */}
        {canHandoffNeed && req.statut === 'RECU_STRUCTURE' && (
          <button
            type="button"
            onClick={() => handleQuickTransition(req, 'REMIS_TECHNICIEN')}
            className="px-2.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition inline-flex items-center gap-1 cursor-pointer shadow-2xs"
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>Remettre au Tech</span>
          </button>
        )}

        {/* 4. REMIS_TECHNICIEN -> POSE_ESSAI */}
        {canCreateNeed && req.statut === 'REMIS_TECHNICIEN' && (
          <button
            type="button"
            onClick={() => handleQuickTransition(req, 'POSE_ESSAI')}
            className="px-2.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition inline-flex items-center gap-1 cursor-pointer shadow-2xs"
          >
            <Wrench className="w-3.5 h-3.5" />
            <span>Pose & Essai</span>
          </button>
        )}

        {/* 5. POSE_ESSAI -> CLOTURE_FIELD */}
        {canCreateNeed && req.statut === 'POSE_ESSAI' && (
          <>
            <button
              type="button"
              onClick={() => handleQuickTransition(req, 'CLOTURE_FIELD')}
              className="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition inline-flex items-center gap-1 cursor-pointer shadow-2xs"
              title="Confirmer le montage et l'essai concluant sur machine (débloque la clôture du BT)"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Essai OK (Clôturer)</span>
            </button>
            <button
              type="button"
              onClick={() => handleQuickTransition(req, 'DEMANDE_TECH')}
              className="px-2 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 font-bold text-[11px] transition inline-flex items-center gap-1 cursor-pointer"
              title="Essai non concluant : relancer l'analyse du besoin"
            >
              <XCircle className="w-3.5 h-3.5" />
              <span>Échec Essai</span>
            </button>
          </>
        )}

        {req.statut === 'CLOTURE_FIELD' && (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 font-mono font-bold text-[11px]">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Monté & Testé OK</span>
          </span>
        )}
      </div>
    );
  };

  const columns = useMemo<IndustrialGridColumn<INeedRequest>[]>(
    () => [
      {
        key: 'code_demande',
        label: 'N° Besoin',
        colLetter: 'Col A',
        icon: Package,
        sortable: true,
        render: (req) => (
          <div className="flex flex-col gap-0.5">
            <span className="font-mono font-black text-xs text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 inline-block w-fit">
              {req.code_demande}
            </span>
            <span className="text-[10px] font-mono text-slate-400">
              {String(req.date_creation || '').slice(0, 10)}
            </span>
          </div>
        ),
      },
      {
        key: 'id_machine',
        label: 'Machine & BT',
        colLetter: 'Col B',
        icon: Factory,
        sortable: true,
        render: (req) => (
          <div className="flex flex-col gap-1 items-start">
            <span className="px-2 py-0.5 rounded bg-slate-900 text-white font-mono font-bold text-xs">
              {req.id_machine}
            </span>
            {req.id_bt ? (
              <button
                type="button"
                onClick={() => onNavigateToTab?.('corrective_bt')}
                className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200 font-mono font-bold text-[10px] hover:bg-blue-100 cursor-pointer"
              >
                BT: {req.id_bt}
              </button>
            ) : (
              <span className="text-[10px] font-mono text-slate-400">Sans BT direct</span>
            )}
          </div>
        ),
      },
      {
        key: 'material_class',
        label: 'Classe Matière',
        colLetter: 'Col C',
        icon: Layers,
        sortable: true,
        render: (req) => (
          <div className="flex flex-col gap-0.5 items-start">
            <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-900 border border-amber-200 font-mono font-bold text-[11px]">
              {req.material_class} (×{req.quantite})
            </span>
            {req.id_ref_pdr && (
              <span className="text-[10px] font-mono font-bold text-cyan-800">
                Réf: {req.id_ref_pdr}
              </span>
            )}
          </div>
        ),
      },
      {
        key: 'description_besoin',
        label: 'Description du Besoin & Demandeur',
        colLetter: 'Col D',
        icon: Wrench,
        sortable: true,
        render: (req) => (
          <div className="max-w-md space-y-1">
            <div className="font-bold text-slate-900 text-xs leading-snug">
              {req.description_besoin}
            </div>
            <div className="text-[10.5px] text-slate-500 flex items-center gap-2 flex-wrap">
              <span>
                Demandeur : <b className="text-slate-700">{req.nom_technicien_demandeur}</b>
              </span>
              {req.notes_superviseur && (
                <span className="text-purple-800 bg-purple-50 px-1.5 py-0.2 rounded border border-purple-200">
                  Note Resp: {req.notes_superviseur}
                </span>
              )}
            </div>
          </div>
        ),
      },
      {
        key: 'canal_appro',
        label: 'Canal Appro / Atelier',
        colLetter: 'Col E',
        icon: Truck,
        sortable: true,
        render: (req) => renderChannelBadge(req),
      },
      {
        key: 'statut',
        label: 'Statut Handoff',
        colLetter: 'Col F',
        icon: Clock,
        align: 'center',
        sortable: true,
        render: (req) => renderStatusBadge(req.statut),
      },
      {
        key: 'actions',
        label: 'Séquence de Remise (Handoff)',
        colLetter: 'Col G',
        icon: ShieldCheck,
        align: 'center',
        render: (req) => renderHandoffActions(req),
      },
    ],
    [canReviewNeed, canHandoffNeed, canCreateNeed, workshopMap]
  );

  return (
    <div className="space-y-6">
      {/* 1. KPI Summary Strip */}
      <GmaoKpiGrid>
        <GmaoKpiCard
          title="Total Besoins (Main Courante)"
          value={kpis.total}
          unit="Demandes"
          icon={Package}
          color="amber"
          active={filterStatus === 'ALL'}
          onClick={() => setFilterStatus('ALL')}
          footerText={`${kpis.activeCount} en cours de traitement`}
        />
        <GmaoKpiCard
          title="À Arbitrer (Superviseur)"
          value={kpis.toReview}
          unit="Att. Canal"
          icon={ShieldCheck}
          color="purple"
          active={filterStatus === 'TO_REVIEW'}
          onClick={() => setFilterStatus(filterStatus === 'TO_REVIEW' ? 'ALL' : 'TO_REVIEW')}
          footerText="DEMANDE_TECH / CLARIFICATION"
        />
        <GmaoKpiCard
          title="En Appro / Atelier"
          value={kpis.inAppro}
          unit="En cours"
          icon={Truck}
          color="blue"
          active={filterStatus === 'APPROVISIONNEMENT'}
          onClick={() =>
            setFilterStatus(
              filterStatus === 'APPROVISIONNEMENT' ? 'ALL' : 'APPROVISIONNEMENT'
            )
          }
          footerText="STOCK · ACHAT · ATELIER · EXTERNE"
        />
        <GmaoKpiCard
          title="Reçu / Remis Technicien"
          value={kpis.readyHandoff}
          unit="À monter"
          icon={UserCheck}
          color="cyan"
          active={filterStatus === 'RECU_STRUCTURE'}
          onClick={() =>
            setFilterStatus(filterStatus === 'RECU_STRUCTURE' ? 'ALL' : 'RECU_STRUCTURE')
          }
          footerText="Prêt pour remise & pose machine"
        />
        <GmaoKpiCard
          title="Pose & Essai Machine"
          value={kpis.inPoseEssai}
          unit="En test"
          icon={Wrench}
          color="orange"
          active={filterStatus === 'POSE_ESSAI'}
          onClick={() =>
            setFilterStatus(filterStatus === 'POSE_ESSAI' ? 'ALL' : 'POSE_ESSAI')
          }
          footerText="Validation terrain avant clôture BT"
        />
        <GmaoKpiCard
          title="Clôturés Terrain (Essai OK)"
          value={kpis.closedField}
          unit="Validés"
          icon={CheckCircle2}
          color="emerald"
          active={filterStatus === 'CLOTURE_FIELD'}
          onClick={() =>
            setFilterStatus(filterStatus === 'CLOTURE_FIELD' ? 'ALL' : 'CLOTURE_FIELD')
          }
          footerText="Débloque la clôture administrative BT"
        />
      </GmaoKpiGrid>

      {/* 2. Filter & Action Bar */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <Package className="w-4 h-4 text-amber-600" />
              <span>
                Main Courante des Besoins & Chaîne de Remise (`COR-HANDOFF-P0`)
              </span>
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Séparation stricte : le technicien déclare le besoin (`DEMANDE_TECH`), le superviseur arbitre le canal (`STOCK`, `ACHAT`, `ATELIER`, `EXTERNE`), puis la pièce suit `RECU_STRUCTURE` ➔ `REMIS_TECHNICIEN` ➔ `POSE_ESSAI` ➔ `CLOTURE_FIELD`.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {canCreateNeed && (
              <button
                type="button"
                data-testid="open-create-need-modal-btn"
                onClick={() => setShowCreateModal(true)}
                className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Plus className="w-4 h-4" />
                <span>Nouvelle Demande de Besoin</span>
              </button>
            )}
          </div>
        </div>

        <PeriodFilterBar
          value={periodFilter}
          onChange={(next) => {
            setPeriodFilter(next);
            setCurrentPage(1);
          }}
          availableDates={allDatesForPeriod}
          filteredCount={sortedRequests.length}
          totalCount={needRequests.length}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <CustomSelect
            label="Statut Handoff"
            value={filterStatus}
            onChange={(val) => {
              setFilterStatus(val);
              setCurrentPage(1);
            }}
            options={[
              { value: 'ALL', label: `Tous les statuts (${needRequests.length})` },
              { value: 'ACTIVE_ONLY', label: `Actifs / Non clôturés (${kpis.activeCount})` },
              { value: 'TO_REVIEW', label: `À arbitrer (${kpis.toReview})` },
              { value: 'DEMANDE_TECH', label: 'Demande Technicien' },
              { value: 'APPROVISIONNEMENT', label: 'En Approvisionnement / Atelier' },
              { value: 'RECU_STRUCTURE', label: 'Reçu Structure' },
              { value: 'REMIS_TECHNICIEN', label: 'Remis au Technicien' },
              { value: 'POSE_ESSAI', label: 'Pose & Essai Machine' },
              { value: 'CLOTURE_FIELD', label: 'Clôturé Terrain (Essai OK)' },
              { value: 'CLARIFICATION', label: 'Clarification' },
              { value: 'REJETE', label: 'Rejeté' },
            ]}
          />

          <CustomSelect
            label="Classe Matière"
            value={filterClass}
            onChange={(val) => {
              setFilterClass(val);
              setCurrentPage(1);
            }}
            options={[
              { value: 'ALL', label: 'Toutes classes (PDR / Part / Comp)' },
              { value: 'PDR', label: 'PDR (Catalogue Magasin)' },
              { value: 'PART', label: 'PART (Pièce Mécanique / Usinable)' },
              { value: 'COMPONENT', label: 'COMPONENT (Organe Complet)' },
              { value: 'OTHER', label: 'OTHER (Autre Besoin)' },
            ]}
          />

          <CustomSelect
            label="Canal Approvisionnement"
            value={filterChannel}
            onChange={(val) => {
              setFilterChannel(val);
              setCurrentPage(1);
            }}
            options={[
              { value: 'ALL', label: 'Tous canaux' },
              { value: 'UNASSIGNED', label: 'Non arbitré (Attente Resp.)' },
              { value: 'STOCK', label: 'STOCK (Magasin PDR)' },
              { value: 'ACHAT', label: 'ACHAT (Commande Fournisseur)' },
              { value: 'ATELIER', label: 'ATELIER (Fabrication / Rectification)' },
              { value: 'EXTERNE', label: 'EXTERNE (Sous-traitance)' },
            ]}
          />

          <CustomSelect
            label="Machine"
            value={filterMachine}
            onChange={(val) => {
              setFilterMachine(val);
              setCurrentPage(1);
            }}
            options={[
              { value: 'ALL', label: 'Toutes les machines' },
              ...activeMachines.map((m: any) => {
                const code = m.id_machine_registered || m.id || m.code;
                return {
                  value: String(code),
                  label: `${code} — ${m.designation || m.nom || ''}`,
                };
              }),
            ]}
          />

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              Recherche Rapide
            </label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="ND-2026, BT, machine, réf..."
                className="w-full pl-8 pr-8 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50/70 focus:bg-white focus:border-amber-400 focus:outline-hidden"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 3. Unified Dual-Mode Grid (Excel Table ⇄ Operational Cards) */}
      <GmaoIndustrialDataGrid
        title="Registre des Demandes de Besoin & Chaîne de Remise (NeedRequest)"
        icon={<FileSpreadsheet className="w-4 h-4 text-amber-600" />}
        excelMapping="N° | Code (A) | Machine & BT (B) | Classe (C) | Besoin (D) | Canal (E) | Statut (F) | Action (G)"
        bannerColor="amber"
        columns={columns}
        data={displayedRequests}
        sortField={sortField}
        sortOrder={sortOrder}
        onSort={toggleSort}
        renderSortIcon={renderSortIcon}
        startIndex={startIndex}
        showRowNumber={true}
        emptyMessage="Aucune demande de besoin enregistrée pour ces critères."
        cardGridClassName="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
        renderCard={(req, _idx, rowNumber) => (
          <div
            key={req.id || rowNumber}
            className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between gap-3"
          >
            <div className="space-y-2.5">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <span className="font-mono font-black text-xs px-2.5 py-0.5 rounded-lg bg-amber-50 text-amber-900 border border-amber-200">
                    {req.code_demande}
                  </span>
                  <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-slate-900 text-white">
                    {req.id_machine}
                  </span>
                  {req.id_bt && (
                    <span className="font-mono font-bold text-[10.5px] px-2 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200">
                      {req.id_bt}
                    </span>
                  )}
                </div>
                {renderStatusBadge(req.statut)}
              </div>

              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/70 space-y-1">
                <div className="flex items-center justify-between text-[10.5px] font-mono text-slate-600">
                  <span>
                    Classe: <b>{req.material_class}</b> (Qté: <b>{req.quantite}</b>)
                  </span>
                  <span>Demandeur: {req.nom_technicien_demandeur}</span>
                </div>
                <p className="text-xs font-bold text-slate-900">{req.description_besoin}</p>
              </div>

              <div className="flex items-center justify-between gap-2 pt-1">
                {renderChannelBadge(req)}
              </div>
            </div>

            <div className="pt-2.5 border-t border-slate-100 flex items-center justify-end">
              {renderHandoffActions(req)}
            </div>
          </div>
        )}
        pagination={{
          currentPage: safePage,
          setCurrentPage,
          pageSize,
          setPageSize,
          totalItems: sortedRequests.length,
          pageSizeOptions: [20, 25, 50, 100, 200, 0],
          color: 'amber',
          itemLabel: 'demandes de besoin',
        }}
      />

      {/* 4. Modal: Create Need Request (Technician / Field Declaration) */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-black text-slate-900">
                  Déclarer un Besoin Matière / Pièce (`DEMANDE_TECH`)
                </h3>
                <p className="text-[11px] text-slate-500">
                  Le technicien exprime le besoin technique. Le canal d’approvisionnement (`STOCK`, `ACHAT`, `ATELIER`, `EXTERNE`) sera arbitré par le responsable.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer"
              >
                Fermer
              </button>
            </div>

            <form onSubmit={handleSubmitCreateNeed} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Machine Active *
                  </label>
                  <select
                    required
                    value={createForm.id_machine}
                    onChange={(e) =>
                      setCreateForm((p) => ({ ...p, id_machine: e.target.value }))
                    }
                    className="w-full py-2 px-3 text-xs font-bold rounded-xl border border-slate-200 bg-slate-50"
                  >
                    <option value="">— Sélectionner machine —</option>
                    {activeMachines.map((m: any) => {
                      const code = m.id_machine_registered || m.id || m.code;
                      return (
                        <option key={code} value={code}>
                          {code} — {m.designation || m.nom || ''}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Bon de Travail (BT Lié · Optionnel)
                  </label>
                  <select
                    value={createForm.id_bt}
                    onChange={(e) => {
                      const btVal = e.target.value;
                      const foundBt = openBts.find(
                        (b: any) => (b.num_bt || b.id) === btVal
                      );
                      setCreateForm((p) => ({
                        ...p,
                        id_bt: btVal,
                        id_machine:
                          foundBt && !p.id_machine
                            ? String(foundBt.code_machine || '')
                            : p.id_machine,
                      }));
                    }}
                    className="w-full py-2 px-3 text-xs font-mono font-bold rounded-xl border border-slate-200 bg-slate-50"
                  >
                    <option value="">— Aucun BT / Main courante directe —</option>
                    {openBts.map((b: any) => (
                      <option key={b.id} value={b.num_bt || b.id}>
                        {b.num_bt || b.id} ({b.code_machine})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Classe du Besoin (`material_class`) *
                  </label>
                  <select
                    value={createForm.material_class}
                    onChange={(e) =>
                      setCreateForm((p) => ({
                        ...p,
                        material_class: e.target.value as NeedMaterialClass,
                      }))
                    }
                    className="w-full py-2 px-3 text-xs font-bold rounded-xl border border-slate-200 bg-slate-50"
                  >
                    {(Object.keys(NEED_MATERIAL_CLASS_LABELS) as NeedMaterialClass[]).map(
                      (cls) => (
                        <option key={cls} value={cls}>
                          {cls} — {NEED_MATERIAL_CLASS_LABELS[cls]}
                        </option>
                      )
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Quantité *
                  </label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={createForm.quantite}
                    onChange={(e) =>
                      setCreateForm((p) => ({
                        ...p,
                        quantite: Math.max(1, Number(e.target.value) || 1),
                      }))
                    }
                    className="w-full py-2 px-3 text-xs font-mono font-bold rounded-xl border border-slate-200 bg-white"
                  />
                </div>
              </div>

              {createForm.material_class === 'PDR' && (
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Référence PDR Catalogue (Optionnel)
                  </label>
                  <input
                    type="text"
                    value={createForm.id_ref_pdr}
                    onChange={(e) =>
                      setCreateForm((p) => ({ ...p, id_ref_pdr: e.target.value }))
                    }
                    placeholder="Ex: RLM-6205-2RS, CR-SPA-1400..."
                    className="w-full py-2 px-3 text-xs font-mono rounded-xl border border-slate-200 bg-white"
                  />
                </div>
              )}

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Description Précise du Besoin *
                </label>
                <textarea
                  rows={3}
                  required
                  value={createForm.description_besoin}
                  onChange={(e) =>
                    setCreateForm((p) => ({ ...p, description_besoin: e.target.value }))
                  }
                  placeholder="Décrivez la pièce, dimensions, symptôme ou besoin d'intervention..."
                  className="w-full py-2 px-3 text-xs rounded-xl border border-slate-200 bg-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  data-testid="confirm-create-need-btn"
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-black uppercase cursor-pointer shadow-xs"
                >
                  Enregistrer Demande (`DEMANDE_TECH`)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. Modal: Supervisor Review & Channel Arbitration (`REVUE_SUPERVISEUR` -> `APPROVISIONNEMENT`) */}
      {reviewModalItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-xl w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-purple-100 text-purple-900">
                  Arbitrage Responsable Maintenance ({reviewModalItem.code_demande})
                </span>
                <h3 className="text-base font-black text-slate-900 mt-1">
                  Orientation du Canal d’Approvisionnement / Atelier
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setReviewModalItem(null)}
                className="text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer"
              >
                Fermer
              </button>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 text-xs space-y-1.5">
              <div className="flex items-center justify-between">
                <span>
                  Machine : <b className="font-mono">{reviewModalItem.id_machine}</b>
                  {reviewModalItem.id_bt ? ` • BT : ${reviewModalItem.id_bt}` : ''}
                </span>
                <span className="font-mono font-bold text-amber-900 bg-amber-100 px-2 py-0.5 rounded">
                  Classe : {reviewModalItem.material_class} (×{reviewModalItem.quantite})
                </span>
              </div>
              <p className="font-bold text-slate-900">{reviewModalItem.description_besoin}</p>
              <p className="text-[11px] text-slate-500">
                Demandé par : {reviewModalItem.nom_technicien_demandeur}
              </p>
            </div>

            <form onSubmit={handleConfirmSupervisorReview} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1.5">
                  Décision du Responsable *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    {
                      id: 'APPROVISIONNEMENT',
                      label: 'Valider & Orienter Canal',
                      color: 'bg-emerald-600 text-white border-emerald-600',
                    },
                    {
                      id: 'CLARIFICATION',
                      label: 'Demander Clarification',
                      color: 'bg-amber-600 text-white border-amber-600',
                    },
                    {
                      id: 'REJETE',
                      label: 'Rejeter le Besoin',
                      color: 'bg-rose-600 text-white border-rose-600',
                    },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setReviewDecision(opt.id as any)}
                      className={`py-2 px-3 rounded-xl border text-xs font-bold transition cursor-pointer ${
                        reviewDecision === opt.id
                          ? opt.color
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {reviewDecision === 'APPROVISIONNEMENT' && (
                <div className="space-y-3 p-3.5 rounded-2xl bg-purple-50/60 border border-purple-200">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-black text-purple-950 uppercase">
                      Canal d’Approvisionnement (`canal_appro`) *
                    </label>
                    <span className="text-[10px] font-mono font-bold text-purple-800 bg-white px-2 py-0.5 rounded border border-purple-200">
                      Recommandé ({reviewModalItem.material_class}) :{' '}
                      {getSuggestedChannelsForMaterialClass(
                        reviewModalItem.material_class
                      ).join(', ')}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {ALL_CHANNELS.map((ch) => {
                      const suggested = getSuggestedChannelsForMaterialClass(
                        reviewModalItem.material_class
                      ).includes(ch);
                      const isSelected = reviewCanal === ch;
                      return (
                        <button
                          key={ch}
                          type="button"
                          data-testid={`select-canal-${ch}`}
                          onClick={() => setReviewCanal(ch)}
                          className={`p-2.5 rounded-xl border text-left transition cursor-pointer flex items-center justify-between gap-2 ${
                            isSelected
                              ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                              : 'bg-white text-slate-800 border-slate-200 hover:border-purple-300'
                          }`}
                        >
                          <div>
                            <div className="text-xs font-black font-mono">{ch}</div>
                            <div
                              className={`text-[10px] ${
                                isSelected ? 'text-slate-300' : 'text-slate-500'
                              }`}
                            >
                              {NEED_APPRO_CHANNEL_LABELS[ch]}
                            </div>
                          </div>
                          {suggested && (
                            <span
                              className={`text-[9.5px] font-mono font-bold px-1.5 py-0.5 rounded ${
                                isSelected
                                  ? 'bg-amber-400 text-slate-950'
                                  : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              }`}
                            >
                              ★ Suggéré
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {reviewModalItem.material_class === 'PDR' && reviewCanal === 'ATELIER' && (
                    <div className="p-2.5 rounded-xl bg-amber-100 border border-amber-300 text-amber-950 text-[11px] flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0 text-amber-700" />
                      <span>
                        Attention : une PDR standard est habituellement achetée ou sortie du stock (`STOCK` / `ACHAT`). L’orientation vers `ATELIER` reste autorisée uniquement sur dérogation superviseur.
                      </span>
                    </div>
                  )}

                  {reviewCanal === 'ATELIER' && (
                    <div>
                      <label className="block text-[10.5px] font-bold text-slate-700 uppercase mb-1">
                        Type de Bon d’Atelier Mécanique à générer automatiquement
                      </label>
                      <select
                        value={reviewWorkshopType}
                        onChange={(e) =>
                          setReviewWorkshopType(e.target.value as WorkshopOrderType)
                        }
                        className="w-full py-2 px-3 text-xs font-bold rounded-xl border border-amber-300 bg-white"
                      >
                        <option value="REALISATION">
                          REALISATION (Confection / Usinage neuf — BR)
                        </option>
                        <option value="RECTIFICATION">
                          RECTIFICATION (Réparation / Tournage / Ajustage — RECT)
                        </option>
                      </select>
                    </div>
                  )}
                </div>
              )}

              {reviewDecision === 'REJETE' ? (
                <div>
                  <label className="block text-[11px] font-bold text-rose-800 uppercase mb-1">
                    Motif du Rejet *
                  </label>
                  <input
                    type="text"
                    required
                    value={reviewMotifRejet}
                    onChange={(e) => setReviewMotifRejet(e.target.value)}
                    placeholder="Expliquez pourquoi ce besoin est rejeté..."
                    className="w-full py-2 px-3 text-xs rounded-xl border border-rose-300 bg-white"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Instructions / Notes du Superviseur
                  </label>
                  <input
                    type="text"
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    placeholder="Consignes magasin, référence fournisseur, tolérance atelier..."
                    className="w-full py-2 px-3 text-xs rounded-xl border border-slate-200 bg-white"
                  />
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setReviewModalItem(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  data-testid="confirm-supervisor-need-review-btn"
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-black uppercase cursor-pointer shadow-xs"
                >
                  Confirmer Décision
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
