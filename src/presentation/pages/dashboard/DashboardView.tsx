import { useState, useMemo, useEffect, useCallback } from 'react';
import AnimatedPage from '../../components/common/AnimatedPage';
import SortieEntreeIcon from '../../components/common/SortieEntreeIcon';
import DashboardKPIs from './components/DashboardKPIs';
import Action3DButton from '../../components/common/Action3DButton';
import FormulasModalButton from '../../components/common/FormulasModalButton';
import PageHeaderIcon from '../../components/common/PageHeaderIcon';
import { useSmartTableLoader } from '../../hooks/useSmartTableLoader';
import TableSkeletonRows from '../../components/common/TableSkeletonRows';
import {
  Package,
  AlertTriangle,
  XCircle,
  TrendingDown,
  TrendingUp,
  ArrowRight,
  Plus,
  ShoppingCart,
  Clock,
  FileSpreadsheet,
  Layers,
  ChevronRight,
  ChevronDown,
  Trash2,
  ShieldCheck,
  Zap,
  Warehouse,
  Inbox,
  CheckCircle2,
  Check,
  Truck,
  Activity,
  Factory,
  UserCheck,
  LayoutDashboard,
  Calculator,
  Wrench,
  X,
  ShieldAlert,
  Calendar,
  BookOpen,
  User,
  RefreshCw,
} from 'lucide-react';
import { dataIntegrityService } from '../../../services/dataIntegrityService';
import { useAuth } from '../../../context/AuthContext';
import { AuthorizationService } from '../../../core/security/AuthorizationService';
import { buildTechnicianDashboardScope } from '../../../core/security/technicianScope';
import {
  buildAdminValidationRadar,
  selectValidationCenterQueues,
} from '../../../core/security/validationReconciliation';
import { useGmaoStore } from '../../../store/useGmaoStore';
import { serverSyncService } from '../../../services/serverSyncService';
import ServerSyncConflictModal from '../../components/common/ServerSyncConflictModal';
import FactoryOnboardingWizard from '../../components/common/FactoryOnboardingWizard';
import { isArchivedMachine, getMachineLifecycleState } from '../../../utils/activeMachines';
import { useTranslation } from '../../../i18n/I18nContext';
import { ROLES, normalizeRole } from '../../../core/security/Roles';

export default function DashboardView({
  stockItems = [],
  machines = [],
  warehouseItems: _warehouseItems = [],
  mouvements = [],
  types = [],
  diagnostics: _diagnostics = [],
  zones: _zones = [],
  technicians = [],
  operations = [],
  stockKPIs = {
    totalArticles: 0,
    totalStockActuel: 0,
    totalEntrees: 0,
    totalSorties: 0,
    ruptures: 0,
    alertes: 0,
    ok: 0,
  },
  preventiveTasks = [],
  preventiveExecutions = [],
  onNavigateToStock,
  onNavigateToMachines,
  onNavigateToWarehouse,
  onNavigateToSortie,
  onNavigateToPreventive,
  onNavigateToCorrective,
  onNavigateToZones,
  onNavigateToUsers,
  onNavigateToSettings,
  onNavigateToGuide,
  onNavigateToValidationCenter,
  correctiveInterventions = [],
  correctiveKpis: _correctiveKpis = null,
  onQuickSortie,
  onAddMouvement,
  onUpdateMouvement,
  onDeleteMouvement,
  onExportExcel,
  showToast,
  currentUser: currentUserProp = null,
}: any) {
  const { user: authUser } = useAuth();
  const currentUser = currentUserProp || authUser;
  const { t } = useTranslation();

  const normalizedUserRole = useMemo(
    () => normalizeRole(currentUser?.role),
    [currentUser?.role]
  );
  const isStoreManager = normalizedUserRole === ROLES.RESPONSABLE_MAGASIN;
  const isOperatorRole = normalizedUserRole === ROLES.OPERATEUR;
  const isViewerRole = normalizedUserRole === ROLES.VIEWER;

  const techScope = useMemo(
    () =>
      buildTechnicianDashboardScope({
        user: currentUser,
        technicians,
        preventiveTasks,
        preventiveExecutions,
        correctiveInterventions,
        mouvements,
      }),
    [currentUser, technicians, preventiveTasks, preventiveExecutions, correctiveInterventions, mouvements]
  );
  const isTechUser = techScope.isTechUser;

  // RBAC Capabilities & Tab Access Flags (DB-1, DB-2 & ST-AUTH-NULL: fail-closed when currentUser is null)
  const isReadOnlyUser = !currentUser || AuthorizationService.isReadOnly(currentUser);
  const canCreateMovement =
    Boolean(currentUser) &&
    !isReadOnlyUser &&
    AuthorizationService.hasPermission(currentUser, 'movement.create');
  const canEditMovement =
    Boolean(currentUser) &&
    !isReadOnlyUser &&
    AuthorizationService.hasPermission(currentUser, 'movement.edit');
  const canDeleteMovement =
    Boolean(currentUser) &&
    !isReadOnlyUser &&
    AuthorizationService.hasPermission(currentUser, 'movement.delete');
  const canExportData =
    Boolean(currentUser) &&
    !isReadOnlyUser &&
    (AuthorizationService.hasPermission(currentUser, 'stock.export') ||
      AuthorizationService.hasPermission(currentUser, 'report.export'));
  const canManageSettings =
    Boolean(currentUser) &&
    !isReadOnlyUser &&
    AuthorizationService.hasPermission(currentUser, 'settings.manage');
  const canSyncLan =
    Boolean(currentUser) &&
    !isReadOnlyUser &&
    (AuthorizationService.hasPermission(currentUser, 'settings.backup') ||
      AuthorizationService.hasPermission(currentUser, 'stock.edit') ||
      AuthorizationService.hasPermission(currentUser, 'preventive.manage'));

  const canAccessStockTab = Boolean(currentUser) && AuthorizationService.canAccessTab(currentUser, 'stock');
  const canAccessSortieTab = Boolean(currentUser) && AuthorizationService.canAccessTab(currentUser, 'sortie');
  const canAccessMachinesTab = Boolean(currentUser) && AuthorizationService.canAccessTab(currentUser, 'machines');
  const canAccessEntrepotTab = Boolean(currentUser) && AuthorizationService.canAccessTab(currentUser, 'entrepot');
  const canAccessZonesTab = Boolean(currentUser) && AuthorizationService.canAccessTab(currentUser, 'zones');
  const canAccessUsersTab = Boolean(currentUser) && AuthorizationService.canAccessTab(currentUser, 'utilisateurs');
  const canAccessGuideTab = Boolean(currentUser) && AuthorizationService.canAccessTab(currentUser, 'guide');
  const canAccessPreventiveTab = Boolean(currentUser) && AuthorizationService.canAccessTab(currentUser, 'preventive');
  const canAccessCorrectiveTab = Boolean(currentUser) && AuthorizationService.canAccessTab(currentUser, 'corrective');
  const canAccessCorrectiveDiTab = Boolean(currentUser) && AuthorizationService.canAccessTab(currentUser, 'corrective_di');
  const canAccessCorrectiveBtTab = Boolean(currentUser) && AuthorizationService.canAccessTab(currentUser, 'corrective_bt');
  const canAccessCorrectiveLiveTab = Boolean(currentUser) && AuthorizationService.canAccessTab(currentUser, 'corrective_live');
  const canAccessCorrectiveClotureTab = Boolean(currentUser) && AuthorizationService.canAccessTab(currentUser, 'corrective_cloture');
  const canAccessCorrectiveAnalyticsTab = Boolean(currentUser) && AuthorizationService.canAccessTab(currentUser, 'corrective_analytics');
  const canAccessValidationCenterTab =
    Boolean(currentUser) && AuthorizationService.canAccessTab(currentUser, 'validation_center');
  const canAccessSettingsTab = Boolean(currentUser) && AuthorizationService.canAccessTab(currentUser, 'settings');

  const storeSortieDemands = useGmaoStore((state) => state.sortieDemands);

  const validationQueues = useMemo(
    () =>
      selectValidationCenterQueues({
        correctiveInterventions,
        preventiveExecutions,
        sortieDemands: storeSortieDemands,
      }),
    [correctiveInterventions, preventiveExecutions, storeSortieDemands]
  );

  const validationRadar = useMemo(
    () =>
      buildAdminValidationRadar({
        stockItems,
        mouvements,
        correctiveInterventions,
        preventiveExecutions,
        sortieDemands: storeSortieDemands,
      }),
    [stockItems, mouvements, correctiveInterventions, preventiveExecutions, storeSortieDemands]
  );

  // A2 — Lightweight Operational Sync Status & Conflict Alert (reuses serverSyncService)
  const [syncTrust, setSyncTrust] = useState(() => serverSyncService.getOperationalSyncStatus());
  const [isSyncBusy, setIsSyncBusy] = useState(false);
  const [showConflictModal, setShowConflictModal] = useState(false);

  const refreshSyncTrust = useCallback(() => {
    setSyncTrust(serverSyncService.getOperationalSyncStatus());
  }, []);

  useEffect(() => {
    if (isTechUser) return;
    refreshSyncTrust();
    window.addEventListener('gmao:server_synced', refreshSyncTrust);
    window.addEventListener('gmao:server_conflict', refreshSyncTrust);
    window.addEventListener('gmao:server_sync_error', refreshSyncTrust);
    return () => {
      window.removeEventListener('gmao:server_synced', refreshSyncTrust);
      window.removeEventListener('gmao:server_conflict', refreshSyncTrust);
      window.removeEventListener('gmao:server_sync_error', refreshSyncTrust);
    };
  }, [isTechUser, refreshSyncTrust]);

  const handleQuickLanMerge = async () => {
    if (!canSyncLan) return;
    setIsSyncBusy(true);
    try {
      const res = await serverSyncService.mergeWithServer();
      refreshSyncTrust();
      if (res.success) {
        setShowConflictModal(false);
        showToast?.('Synchronisation et fusion LAN réussies.', 'success');
      } else if (res.error) {
        showToast?.(res.error, 'error');
      }
    } finally {
      setIsSyncBusy(false);
    }
  };

  const handleForcePushConflict = async () => {
    if (!canSyncLan) return;
    setIsSyncBusy(true);
    try {
      const res = await serverSyncService.pushToServer({ force: true });
      refreshSyncTrust();
      if (res.success) {
        setShowConflictModal(false);
        showToast?.('État local envoyé au serveur.', 'success');
      }
    } finally {
      setIsSyncBusy(false);
    }
  };

  const handleForcePullConflict = async () => {
    if (!canSyncLan) return;
    setIsSyncBusy(true);
    try {
      const res = await serverSyncService.pullFromServer({ force: true });
      refreshSyncTrust();
      if (res.success) {
        setShowConflictModal(false);
        showToast?.('État serveur restauré localement.', 'success');
      }
    } finally {
      setIsSyncBusy(false);
    }
  };

  // --- Modals State ---
  const [showFormulasModal, setShowFormulasModal] = useState(false);
  const [formulaTab, setFormulaTab] = useState<'stock' | 'kpis' | 'autoid'>('stock');
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [forceShowOnboarding, setForceShowOnboarding] = useState(false);
  const [isRadarExpanded, setIsRadarExpanded] = useState(false);

  // DB-9: Close Dashboard modals on Escape key
  useEffect(() => {
    if (!showOrderModal && !showFormulasModal) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showOrderModal) setShowOrderModal(false);
        if (showFormulasModal) setShowFormulasModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showOrderModal, showFormulasModal]);
  const [orderForm, setOrderForm] = useState({
    ref: '',
    designation: '',
    quantite: 5,
    order_nature: 'STOCK_PERMANENT', // 'STOCK_PERMANENT' | 'ACHAT_UNIQUE'
    fournisseur: '',
    technicien: '',
    id_zone: '',
    id_machine_registered: '',
    commentaire: 'Demande de réapprovisionnement',
    code_bon: '',
  });

  const [orderFilterTab, setOrderFilterTab] = useState('ALL'); // 'ALL' | 'PENDING' | 'RECEIVED'
  const [selectedArticleForOrder, setSelectedArticleForOrder] = useState(null);

  // Filter alert & rupture items
  const alertAndRuptureItems = useMemo(() => {
    return stockItems.filter((s) => s.alerte === 'RUPTURE' || s.alerte === 'ALERTE');
  }, [stockItems]);

  // Filter purchase orders (Commandes & Réapprovisionnements)
  const allOrders = useMemo(() => {
    return mouvements.filter(
      (m) =>
        m.type === 'COMMANDE' ||
        m.action_id === 'COMMANDE' ||
        (Array.isArray(m.tags) && m.tags.includes('#COMMANDE_EN_ATTENTE')) ||
        (Array.isArray(m.tags) && m.tags.includes('#RECEPTION_VALIDE'))
    );
  }, [mouvements]);

  const pendingOrders = useMemo(() => {
    return allOrders.filter(
      (m) =>
        !Array.isArray(m.tags) ||
        !m.tags.includes('#RECEPTION_VALIDE')
    );
  }, [allOrders]);

  const completedOrders = useMemo(() => {
    return allOrders.filter(
      (m) => Array.isArray(m.tags) && m.tags.includes('#RECEPTION_VALIDE')
    );
  }, [allOrders]);

  const displayedOrders = useMemo(() => {
    if (orderFilterTab === 'PENDING') return pendingOrders;
    if (orderFilterTab === 'RECEIVED') return completedOrders;
    return allOrders;
  }, [orderFilterTab, pendingOrders, completedOrders, allOrders]);

  // Track External Repairs (Bons de Sortie / Pièces chez les prestataires)
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  
  const externalRepairs = useMemo(() => {
    return mouvements.filter(
      (m) =>
        m.type === 'Sortie Externe' ||
        m.is_bon_sortie === true ||
        (Array.isArray(m.tags) && m.tags.includes('#BON_SORTIE')) ||
        (Array.isArray(m.tags) && m.tags.includes('#SORTIE_EXTERNE')) ||
        m.action_id === 'REPARATION_EXTERNE' ||
        m.prestataire_externe
    );
  }, [mouvements]);

  const pendingExternalRepairs = useMemo(() => {
    return externalRepairs.filter(
      (m) =>
        !Array.isArray(m.tags) ||
        (!m.tags.includes('#RETOUR_RECU') && !m.tags.includes('#RECEPTION_VALIDE'))
    );
  }, [externalRepairs]);

  const overdueRepairs = useMemo(() => {
    return pendingExternalRepairs.filter(
      (m) => m.date_retour_prevue && m.date_retour_prevue < todayStr
    );
  }, [pendingExternalRepairs, todayStr]);

  // Calculate analytics for GMAO actions (DB-7: exclude pending purchase orders & temporary external repair loans)
  const actionStats = useMemo(() => {
    const counts: Record<string, number> = {
      CORRECTIVE: 0,
      PREVENTIVE: 0,
      AMELIORATIVE: 0,
      USAGE: 0,
      REAPPRO: 0,
      RETOUR: 0,
      AUTRE: 0,
    };

    let totalSortieQty = 0;
    let totalEntreeQty = 0;

    (mouvements || []).forEach((m) => {
      const act = String(m.action_id || m.type_intervention || '').toUpperCase();
      const type = String(m.type || '').toLowerCase();
      const q = Number(m.quantite || 0);

      const isPendingOrder =
        (type === 'commande' || act === 'COMMANDE') &&
        (!Array.isArray(m.tags) || !m.tags.includes('#RECEPTION_VALIDE'));
      if (isPendingOrder) {
        return;
      }

      const isExternalLoan =
        type === 'sortie externe' ||
        m.is_bon_sortie === true ||
        (Array.isArray(m.tags) &&
          (m.tags.includes('#BON_SORTIE') || m.tags.includes('#SORTIE_EXTERNE')));

      if (type.includes('sort') && !isExternalLoan) {
        totalSortieQty += q;
      } else if (type.includes('entr')) {
        totalEntreeQty += q;
      }

      if (counts[act] !== undefined) {
        counts[act] += 1;
      } else if (type.includes('entr')) {
        counts.REAPPRO += 1;
      } else {
        counts.AUTRE += 1;
      }
    });

    const totalActions = Object.values(counts).reduce((a, b) => a + b, 0) || 1;

    return {
      counts,
      totalActions,
      totalSortieQty,
      totalEntreeQty,
    };
  }, [mouvements]);

  // Top 5 consumed spare parts (DB-7: exclude external repair loans from consumed parts)
  const topConsumedArticles = useMemo(() => {
    const usageByRef: Record<string, number> = {};
    (mouvements || []).forEach((m) => {
      const type = String(m.type || '').toLowerCase();
      const isExternalLoan =
        type === 'sortie externe' ||
        m.is_bon_sortie === true ||
        (Array.isArray(m.tags) &&
          (m.tags.includes('#BON_SORTIE') || m.tags.includes('#SORTIE_EXTERNE')));
      if (type.includes('sort') && !isExternalLoan) {
        const ref = String(m.ref || '').trim();
        if (ref) {
          usageByRef[ref] = (usageByRef[ref] || 0) + Number(m.quantite || 0);
        }
      }
    });

    return Object.entries(usageByRef)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([ref, qty]) => {
        const item = stockItems.find((s) => String(s.ref).toLowerCase() === ref.toLowerCase());
        return {
          ref,
          designation: item?.designation || 'Article catalogué',
          qty,
          stockActuel: item?.stockActuel ?? 0,
          alerte: item?.alerte || 'OK',
        };
      });
  }, [mouvements, stockItems]);

  // Machine health & interventions (DB-5 & DB-7: exclude soft-archived machines & include correctiveInterventions)
  const machineHealth = useMemo(() => {
    let enService = 0;
    let enMaintenance = 0;
    let arret = 0;

    const operationalMachines = (machines || []).filter((m) => m && !isArchivedMachine(m));

    operationalMachines.forEach((m) => {
      const status = String(m.status || m.statut || '').toLowerCase();
      const lifecycle = getMachineLifecycleState(m);
      if (status.includes('maint') || status.includes('panne')) {
        enMaintenance += 1;
      } else if (lifecycle === 'STOPPED' || status.includes('arr') || status.includes('hors')) {
        arret += 1;
      } else {
        enService += 1;
      }
    });

    // Count interventions per machine across corrective WOs and non-duplicate stock movements
    const mchInterventions: Record<string, number> = {};
    const countedBtCodes = new Set<string>();

    (correctiveInterventions || []).forEach((ci) => {
      const code = String(ci?.code_machine || ci?.id_machine || ci?.id_machine_registered || '').trim();
      if (code) {
        mchInterventions[code] = (mchInterventions[code] || 0) + 1;
        if (ci?.id) countedBtCodes.add(String(ci.id).trim());
        if (ci?.num_bt) countedBtCodes.add(String(ci.num_bt).trim());
      }
    });

    (mouvements || []).forEach((m) => {
      const type = String(m?.type || '').toLowerCase();
      if (type === 'commande') return;
      if (m?.id_machine_registered) {
        const id = String(m.id_machine_registered).trim();
        const bon = String(m.code_bon || '').trim();
        if (id && (!bon || !countedBtCodes.has(bon))) {
          mchInterventions[id] = (mchInterventions[id] || 0) + 1;
        }
      }
    });

    const topMachines = Object.entries(mchInterventions)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([id, count]) => {
        const mch = (machines || []).find(
          (m) => String(m.id_machine_registered || m.id_machine || m.code || m.id || '').trim() === id
        );
        return {
          id,
          designation: mch?.designation || mch?.nom || id,
          zone: mch?.id_zone_default || mch?.zone || 'Atelier',
          count,
        };
      });

    return {
      enService,
      enMaintenance,
      arret,
      total: operationalMachines.length,
      topMachines,
    };
  }, [machines, mouvements, correctiveInterventions]);

  // Real-time Master Excel Referential Integrity Health Check (DB-4: pass real preventiveTasks)
  const referentialAudit = useMemo(() => {
    return dataIntegrityService.scanReferentialIntegrity({
      machines,
      zones: _zones,
      technicians,
      operations,
      rawStock: stockItems,
      warehouseItems: _warehouseItems,
      preventiveTasks,
      correctiveInterventions,
      mouvements,
    });
  }, [
    machines,
    _zones,
    technicians,
    operations,
    stockItems,
    _warehouseItems,
    preventiveTasks,
    correctiveInterventions,
    mouvements,
  ]);

  const { isDataReady: isWatchlistReady } = useSmartTableLoader(alertAndRuptureItems);

  // DB-6: Active personnel lists & collision-safe CMD code generator
  const activeTechnicians = useMemo(
    () =>
      (technicians || []).filter(
        (t) =>
          t &&
          t.is_active !== false &&
          t.actif !== false &&
          String(t.statut || t.status || '').toUpperCase() !== 'ARCHIVE' &&
          String(t.statut || t.status || '').toUpperCase() !== 'ARCHIVEE'
      ),
    [technicians]
  );

  const activeOperationsChefs = useMemo(
    () =>
      (operations || []).filter(
        (o) =>
          o &&
          o.type_profil === 'CHEF' &&
          o.is_active !== false &&
          o.actif !== false &&
          String(o.statut || o.status || '').toUpperCase() !== 'ARCHIVE' &&
          String(o.statut || o.status || '').toUpperCase() !== 'ARCHIVEE'
      ),
    [operations]
  );

  const generateNextCmdCode = useCallback(() => {
    const year = new Date().getFullYear();
    const prefix = `CMD-${year}-`;
    let maxSeq = 0;
    (allOrders || []).forEach((o) => {
      const code = String(o?.code_bon || '').trim();
      if (code.startsWith(prefix)) {
        const tail = parseInt(code.slice(prefix.length), 10);
        if (!Number.isNaN(tail) && tail > maxSeq) {
          maxSeq = tail;
        }
      } else {
        const match = code.match(/(\d+)$/);
        if (match) {
          const num = parseInt(match[1], 10);
          if (!Number.isNaN(num) && num > maxSeq && num < 100000) {
            maxSeq = num;
          }
        }
      }
    });
    return `${prefix}${String(maxSeq + 1).padStart(3, '0')}`;
  }, [allOrders]);

  // DB-11: Executive Maintenance & Reliability Summary (balances Stock KPIs with Maintenance KPIs)
  const executiveMaintenanceSummary = useMemo(() => {
    const activeTasks = Array.isArray(preventiveTasks) ? preventiveTasks : [];
    const pmTotalCount = activeTasks.length;
    const pmDoneCount = activeTasks.filter(
      (task) => task?.etat === 'Fait' || task?.statut === 'FAIT'
    ).length;
    const pmOverdueCount = activeTasks.filter(
      (task) => task?.etat === 'En retard' || task?.statut === 'EN_RETARD'
    ).length;
    const pmComplianceRate =
      pmTotalCount > 0 ? Math.round((pmDoneCount / pmTotalCount) * 100) : 100;

    const interventions = Array.isArray(correctiveInterventions) ? correctiveInterventions : [];
    const openDiCount = interventions.filter(
      (i) =>
        i?.statut === 'DEMANDE' ||
        i?.statut === 'DEMANDE_CREEE' ||
        i?.statut === 'EN_ATTENTE_VALIDATION'
    ).length;
    const plannedBtCount = interventions.filter(
      (i) => i?.statut === 'BT_PLANIFIE' || i?.statut === 'EN_ATTENTE_PDR'
    ).length;
    const liveBtCount = interventions.filter((i) => i?.statut === 'EN_COURS').length;
    const closedList = interventions.filter((i) => i?.statut === 'CLOTURE');
    const closedBtCount = closedList.length;

    let mttrMinutes: number | null = null;
    if (_correctiveKpis && typeof _correctiveKpis.mttrMinutes === 'number' && _correctiveKpis.mttrMinutes > 0) {
      mttrMinutes = Math.round(_correctiveKpis.mttrMinutes);
    } else if (closedList.length > 0) {
      const durations = closedList
        .map(
          (i) =>
            Number(i?.duree_nette_min) ||
            Number(i?.duree_intervention_min) ||
            Number(i?.temps_arret_min) ||
            (Number(i?.duree_heures) > 0 ? Number(i.duree_heures) * 60 : 0)
        )
        .filter((v) => v > 0);
      if (durations.length > 0) {
        mttrMinutes = Math.round(durations.reduce((acc, v) => acc + v, 0) / durations.length);
      }
    }

    const mttrDisplay =
      mttrMinutes !== null
        ? mttrMinutes >= 60
          ? `${(mttrMinutes / 60).toFixed(1)} h`
          : `${mttrMinutes} min`
        : '—';

    return {
      pmTotalCount,
      pmDoneCount,
      pmOverdueCount,
      pmComplianceRate,
      openDiCount,
      plannedBtCount,
      liveBtCount,
      activeCorrectiveTotal: openDiCount + plannedBtCount + liveBtCount,
      closedBtCount,
      mttrDisplay,
    };
  }, [preventiveTasks, correctiveInterventions, _correctiveKpis]);

  // Open Order modal for specific article
  const handleOpenOrderForArticle = (article) => {
    if (!canCreateMovement) return;
    const needed = Math.max(1, (Number(article.seuil) || 3) * 2 - (Number(article.stockActuel) || 0));
    const nextCmdNum = generateNextCmdCode();
    const defaultRequester =
      currentUser?.personnelName ||
      currentUser?.name ||
      activeTechnicians[0]?.nom ||
      activeOperationsChefs[0]?.nom ||
      '';
    setOrderForm({
      ref: article.ref,
      designation: article.designation,
      quantite: needed,
      order_nature: 'STOCK_PERMANENT',
      fournisseur: article.fournisseur || '',
      technicien: defaultRequester,
      id_zone: '',
      id_machine_registered: '',
      commentaire: `Réapprovisionnement pour alerte stock (${article.stockActuel}/${article.seuil})`,
      code_bon: nextCmdNum,
    });
    setSelectedArticleForOrder(article);
    setShowOrderModal(true);
  };

  // Open Generic Order Modal
  const handleOpenNewOrder = () => {
    if (!canCreateMovement) return;
    const nextCmdNum = generateNextCmdCode();
    const defaultRequester =
      currentUser?.personnelName ||
      currentUser?.name ||
      activeTechnicians[0]?.nom ||
      activeOperationsChefs[0]?.nom ||
      '';
    setOrderForm({
      ref: stockItems[0]?.ref || '',
      designation: stockItems[0]?.designation || '',
      quantite: 5,
      order_nature: 'STOCK_PERMANENT',
      fournisseur: '',
      technicien: defaultRequester,
      id_zone: '',
      id_machine_registered: '',
      commentaire: "Demande d'achat magasin",
      code_bon: nextCmdNum,
    });
    setSelectedArticleForOrder(null);
    setShowOrderModal(true);
  };

  // Submit Order Creation
  const handleSubmitOrder = (e) => {
    e.preventDefault();
    if (!canCreateMovement) return;
    if (!orderForm.ref || !orderForm.quantite) return;

    const isAchatUnique = orderForm.order_nature === 'ACHAT_UNIQUE';
    const tags = ['#COMMANDE_EN_ATTENTE'];
    if (isAchatUnique) {
      tags.push('#Achat_Unique', '#Non_Stockable');
    } else {
      tags.push('#REAPPRO', '#Stock_Permanent');
    }

    const newOrderMouvement = {
      id: crypto.randomUUID(),
      code_bon: orderForm.code_bon || `CMD-${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
      heure: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      timestamp: new Date().toISOString(),
      ref: orderForm.ref,
      designation: orderForm.designation,
      quantite: Number(orderForm.quantite) || 1,
      type: 'COMMANDE',
      action_id: 'COMMANDE',
      technicien: orderForm.technicien,
      fournisseur: orderForm.fournisseur,
      id_zone: orderForm.id_zone,
      id_machine_registered: orderForm.id_machine_registered,
      commentaire: `${isAchatUnique ? '[ACHAT UNIQUE] ' : ''}${orderForm.commentaire}`,
      tags: tags,
      is_achat_unique: isAchatUnique,
    };

    if (onAddMouvement) {
      onAddMouvement(newOrderMouvement);
    }
    setShowOrderModal(false);
  };

  // Quick Validate Reception -> Converts Order to Entrée Externe
  const handleValidateReception = (order) => {
    if (!canEditMovement || !onUpdateMouvement) return;
    const today = new Date().toISOString().split('T')[0];
    const isAchatUnique =
      order.is_achat_unique ||
      (Array.isArray(order.tags) && order.tags.includes('#Achat_Unique'));

    const tags = ['#RECEPTION_VALIDE', '#ENTREE_EXTERNE'];
    if (isAchatUnique) {
      tags.push('#Achat_Unique', '#Non_Stockable');
    }

    onUpdateMouvement(order.id, {
      type: 'Entrée Externe',
      action_id: isAchatUnique ? 'ACHAT_DIRECT' : 'REAPPRO',
      date: today,
      heure: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      timestamp: new Date().toISOString(),
      tags: tags,
      commentaire: `${order.commentaire ? order.commentaire + ' | ' : ''}Réceptionné le ${today}`,
      is_achat_unique: isAchatUnique,
    });
  };

  return (
    <AnimatedPage className="space-y-6 select-none font-sans">
      {/* 1. Top Executive Banner & Quick Action Buttons (BDR Light GMAO Header Card with 3D Tactile Elevation) */}
      <div className="bg-white p-5 md:p-6 rounded-2xl border border-slate-200/90 shadow-[0_12px_32px_-6px_rgba(0,0,0,0.12),0_4px_12px_-2px_rgba(0,0,0,0.06)] hover:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.16),0_6px_16px_-3px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-300 ease-out flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative overflow-hidden group/header">
        {/* Subtle Ambient Gradient Background Highlight */}
        <div className="absolute -top-12 -right-12 w-48 h-48 bg-blue-500/5 rounded-full blur-2xl pointer-events-none group-hover/header:bg-blue-500/10 transition-colors duration-500" />

        <div className="min-w-0 flex-1 flex items-start sm:items-center gap-3.5 relative">
          <PageHeaderIcon icon={LayoutDashboard} colorClass="text-blue-700" />

          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
                {isTechUser
                  ? t('dashboard.header.techTitle')
                  : isStoreManager
                  ? t('dashboard.header.storeTitle')
                  : isOperatorRole
                  ? t('dashboard.header.operatorTitle')
                  : isViewerRole
                  ? t('dashboard.header.viewerTitle')
                  : t('dashboard.header.adminTitle')}
              </h1>
              {isTechUser ? (
                <span
                  data-testid="tech-dashboard-badge"
                  className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-emerald-100/90 text-emerald-900 border border-emerald-300 flex items-center gap-1.5 shadow-2xs font-mono"
                >
                  <User className="w-3.5 h-3.5 text-emerald-700" />
                  <span>{t('dashboard.header.techBadgePrefix')} · {techScope.badgeLabel}</span>
                </span>
              ) : isStoreManager ? (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-teal-100/90 text-teal-900 border border-teal-300 flex items-center gap-1 shadow-2xs font-mono">
                  <Warehouse className="w-3.5 h-3.5 text-teal-700" />
                  <span>{t('dashboard.header.storeBadge')}</span>
                </span>
              ) : isOperatorRole ? (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100/90 text-amber-900 border border-amber-300 flex items-center gap-1 shadow-2xs font-mono">
                  <Factory className="w-3.5 h-3.5 text-amber-700" />
                  <span>{t('dashboard.header.operatorBadge')}</span>
                </span>
              ) : isViewerRole ? (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-slate-100 text-slate-700 border border-slate-300 flex items-center gap-1 shadow-2xs font-mono">
                  <BookOpen className="w-3.5 h-3.5 text-slate-600" />
                  <span>{t('dashboard.header.viewerBadge')}</span>
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100/90 text-emerald-800 border border-emerald-200/80 flex items-center gap-1 shadow-2xs">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{t('dashboard.header.twinBadge')}</span>
                </span>
              )}
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200/60 font-mono">
                {t('dashboard.header.offlineBadge')}
              </span>
              {!isTechUser && canManageSettings && (
                <button
                  type="button"
                  onClick={() => setForceShowOnboarding((prev) => !prev)}
                  data-testid="c4-open-onboarding-btn"
                  className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 font-mono transition cursor-pointer"
                >
                  {t('dashboard.header.factoryWizardBtn')}
                </button>
              )}
            </div>
            <p className="text-xs text-slate-500 max-w-3xl leading-relaxed">
              {isTechUser
                ? t('dashboard.header.techSubtitle')
                : isStoreManager
                ? t('dashboard.header.storeSubtitle')
                : isOperatorRole
                ? t('dashboard.header.operatorSubtitle')
                : isViewerRole
                ? t('dashboard.header.viewerSubtitle')
                : t('dashboard.header.adminSubtitle')}
            </p>
          </div>
        </div>

        {/* Action Buttons — 3D Circular Archetype */}
        <div className="flex items-center gap-2.5 shrink-0 relative self-end md:self-auto">
          {isOperatorRole && canAccessCorrectiveDiTab && onNavigateToCorrective && (
            <button
              type="button"
              onClick={() => onNavigateToCorrective('corrective_di')}
              className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-2xs transition flex items-center gap-1.5 cursor-pointer active:scale-95"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>{t('dashboard.header.reportBreakdownBtn')}</span>
            </button>
          )}

          {!isTechUser && (
            <>
              {/* 3D Formula Circular Trigger Button */}
              <FormulasModalButton
                onClick={() => setShowFormulasModal(true)}
                title={t('dashboard.header.formulasTitle')}
              />

              {/* 3D Circular Nouvelle Commande Button */}
              {canCreateMovement && (
                <Action3DButton
                  variant="circle"
                  color="amber"
                  icon={ShoppingCart}
                  showAddBadge={true}
                  onClick={handleOpenNewOrder}
                  title={t('dashboard.header.newOrderTitle')}
                  ariaLabel={t('dashboard.header.newOrderAria')}
                />
              )}
            </>
          )}

          {isTechUser && canAccessPreventiveTab && onNavigateToPreventive && (
            <Action3DButton
              variant="circle"
              color="indigo"
              icon={Calendar}
              onClick={onNavigateToPreventive}
              title={t('dashboard.header.myPreventiveTasksTitle')}
              ariaLabel={t('dashboard.header.myPreventiveTasksAria')}
            />
          )}

          {/* 3D Circular Correctif Nexus Button */}
          {canAccessCorrectiveTab && onNavigateToCorrective && (
            <Action3DButton
              variant="circle"
              color="amber"
              icon={Wrench}
              onClick={() => onNavigateToCorrective('corrective')}
              title={t('dashboard.header.correctiveNexusTitle')}
              ariaLabel={t('dashboard.header.correctiveNexusAria')}
            />
          )}

          {/* 3D Circular Sortie / Entrée Rapide Button */}
          {canAccessSortieTab && onNavigateToSortie && (
            <Action3DButton
              variant="circle"
              color="teal"
              icon={SortieEntreeIcon}
              onClick={onNavigateToSortie}
              title={t('dashboard.header.quickMovementTitle')}
              ariaLabel={t('dashboard.header.quickMovementAria')}
            />
          )}

          {/* 3D Circular Exporter Excel Button */}
          {!isTechUser && canExportData && onExportExcel && (
            <Action3DButton
              variant="circle"
              color="emerald"
              icon={FileSpreadsheet}
              onClick={onExportExcel}
              title={t('dashboard.header.exportExcelTitle')}
              ariaLabel={t('dashboard.header.exportExcelAria')}
            />
          )}
        </div>
      </div>

      {isTechUser ? (
        <div className="space-y-6">
          {/* Technician Shift KPIs (4 Scoped Cards) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 1. Mes Tâches Préventives */}
            <div
              onClick={onNavigateToPreventive}
              className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-[0_4px_16px_-2px_rgba(0,0,0,0.05)] hover:shadow-[0_12px_28px_-4px_rgba(79,70,229,0.12)] hover:-translate-y-1 hover:border-indigo-300/80 transition-all duration-300 relative overflow-hidden group cursor-pointer flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10.5px] font-extrabold text-slate-500 uppercase tracking-wider">
                    {t('dashboard.tech.myPreventiveTasks')}
                  </span>
                  <Calendar className="w-6 h-6 text-indigo-600 shrink-0 group-hover:scale-110 transition-transform" />
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-black text-slate-900 font-mono tracking-tight group-hover:text-indigo-600 transition-colors">
                    {techScope.overdueTasks.length + techScope.todoTasks.length}
                  </span>
                  <span className="text-xs font-bold text-slate-400 font-mono">{t('dashboard.tech.toProcess')}</span>
                </div>
                <div className="mt-2 text-[11px] text-slate-500 flex items-center gap-1.5 flex-wrap">
                  <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 font-bold text-[10px] font-mono border border-rose-200/80">
                    {techScope.overdueTasks.length} {t('dashboard.tech.overdue')}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-800 font-bold text-[10px] font-mono border border-indigo-200/80">
                    {techScope.thisWeekTasks.length} {t('dashboard.tech.weekShort')} {techScope.currentWeekKey}
                  </span>
                  {techScope.needsClarificationPreventive?.length > 0 && (
                    <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-900 font-bold text-[10px] font-mono border border-rose-200 animate-pulse">
                      {techScope.needsClarificationPreventive.length} {t('dashboard.tech.toClarify')}
                    </span>
                  )}
                  {techScope.pendingValidationPreventive?.length > 0 && (
                    <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-900 font-bold text-[10px] font-mono border border-purple-200">
                      {techScope.pendingValidationPreventive.length} {t('dashboard.tech.pendingValidation')}
                    </span>
                  )}
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px]">
                <span className="text-slate-400 font-medium">{t('dashboard.tech.totalAssigned')}</span>
                <span className="font-mono font-bold text-indigo-700">
                  {techScope.myPreventiveTasks.length} {t('dashboard.tech.tasksCount')} ({techScope.doneTasks.length} {t('dashboard.tech.doneCount')})
                </span>
              </div>
            </div>

            {/* 2. Mes Ordres de Travail Correctifs Ouverts */}
            <div
              onClick={() => onNavigateToCorrective?.('corrective_bt')}
              className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-[0_4px_16px_-2px_rgba(0,0,0,0.05)] hover:shadow-[0_12px_28px_-4px_rgba(245,158,11,0.12)] hover:-translate-y-1 hover:border-amber-300/80 transition-all duration-300 relative overflow-hidden group cursor-pointer flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10.5px] font-extrabold text-slate-500 uppercase tracking-wider">
                    {t('dashboard.tech.myOpenInterventions')}
                  </span>
                  <Wrench className="w-6 h-6 text-amber-600 shrink-0 group-hover:scale-110 transition-transform" />
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-black text-slate-900 font-mono tracking-tight group-hover:text-amber-600 transition-colors">
                    {techScope.openCorrective.length}
                  </span>
                  <span className="text-xs font-bold text-slate-400 font-mono">{t('dashboard.tech.openUnit')}</span>
                </div>
                <div className="mt-2 text-[11px] text-slate-500 flex items-center gap-1.5 flex-wrap">
                  <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[10px] font-mono border border-emerald-200/80">
                    {techScope.liveCorrective.length} {t('dashboard.tech.inProgress')}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-800 font-bold text-[10px] font-mono border border-blue-200/80">
                    {techScope.plannedBtCorrective.length} {t('dashboard.tech.plannedBt')}
                  </span>
                  {techScope.pendingValidationCorrective?.length > 0 && (
                    <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-900 font-bold text-[10px] font-mono border border-purple-200">
                      {techScope.pendingValidationCorrective.length} {t('dashboard.tech.pendingValidation')}
                    </span>
                  )}
                  {techScope.needsClarificationCorrective?.length > 0 && (
                    <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-900 font-bold text-[10px] font-mono border border-rose-200 animate-pulse">
                      {techScope.needsClarificationCorrective.length} {t('dashboard.tech.toClarify')}
                    </span>
                  )}
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px]">
                <span className="text-slate-400 font-medium">{t('dashboard.tech.closedByMe')}</span>
                <span className="font-mono font-bold text-amber-700">
                  {techScope.closedCorrective.length} {t('dashboard.tech.reportsUnit')}
                </span>
              </div>
            </div>

            {/* 3. Mes Exécutions Préventives */}
            <div
              onClick={onNavigateToPreventive}
              className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-[0_4px_16px_-2px_rgba(0,0,0,0.05)] hover:shadow-[0_12px_28px_-4px_rgba(16,185,129,0.12)] hover:-translate-y-1 hover:border-emerald-300/80 transition-all duration-300 relative overflow-hidden group cursor-pointer flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10.5px] font-extrabold text-slate-500 uppercase tracking-wider">
                    {t('dashboard.tech.myValidatedExecutions')}
                  </span>
                  <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0 group-hover:scale-110 transition-transform" />
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-black text-slate-900 font-mono tracking-tight group-hover:text-emerald-600 transition-colors">
                    {techScope.myPreventiveExecutions.length}
                  </span>
                  <span className="text-xs font-bold text-slate-400 font-mono">{t('dashboard.tech.historyUnit')}</span>
                </div>
                <div className="mt-2 text-[11px] text-slate-500 flex items-center gap-1.5 flex-wrap">
                  <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 font-bold text-[10px] font-mono border border-emerald-200/80">
                    {techScope.doneTasks.length} {t('dashboard.tech.tasksMarkedDone')}
                  </span>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px]">
                <span className="text-slate-400 font-medium">{t('dashboard.tech.traceability')}</span>
                <span className="font-mono font-bold text-emerald-700">{t('dashboard.tech.personalRegistry')}</span>
              </div>
            </div>

            {/* 4. Mes Sorties PDR & Mouvements */}
            <div
              onClick={onNavigateToSortie}
              className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-[0_4px_16px_-2px_rgba(0,0,0,0.05)] hover:shadow-[0_12px_28px_-4px_rgba(20,184,166,0.12)] hover:-translate-y-1 hover:border-teal-300/80 transition-all duration-300 relative overflow-hidden group cursor-pointer flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10.5px] font-extrabold text-slate-500 uppercase tracking-wider">
                    {t('dashboard.tech.myMovementsSpares')}
                  </span>
                  <SortieEntreeIcon className="w-6 h-6 text-teal-600 shrink-0 group-hover:scale-110 transition-transform" />
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-black text-slate-900 font-mono tracking-tight group-hover:text-teal-600 transition-colors">
                    {techScope.myMouvements.length}
                  </span>
                  <span className="text-xs font-bold text-slate-400 font-mono">{t('dashboard.tech.validatedVouchers')}</span>
                </div>
                <div className="mt-2 text-[11px] text-slate-500 flex items-center gap-1.5 flex-wrap">
                  <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-800 font-bold text-[10px] font-mono border border-rose-200/80">
                    -{techScope.totalMySortiePieces} {t('dashboard.tech.piecesIssued')}
                  </span>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px]">
                <span className="text-slate-400 font-medium">{t('dashboard.tech.storeRegistry')}</span>
                <span className="font-mono font-bold text-teal-700">{t('dashboard.tech.viewMyVouchers')}</span>
              </div>
            </div>
          </div>

          {/* Scoped Maintenance Corrective Hub for Technician */}
          <div className="bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-white rounded-3xl border border-amber-300/80 shadow-[0_8px_30px_rgba(245,158,11,0.08)] p-5 md:p-6 space-y-4 relative overflow-hidden">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center text-white shadow-md shadow-amber-500/20 shrink-0">
                  <Wrench className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h2 className="text-base font-black text-slate-900 tracking-tight">
                      {t('dashboard.tech.fieldCorrectiveHub')} · {techScope.badgeLabel}
                    </h2>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-amber-500 text-white tracking-wider font-mono">
                      {t('dashboard.tech.myInterventionsBadge')}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1 max-w-2xl leading-relaxed">
                    {t('dashboard.tech.fieldCorrectiveDesc')}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap shrink-0">
                <button
                  onClick={() => onNavigateToCorrective?.('corrective_bt')}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 shadow-md shadow-amber-600/25 hover:shadow-lg transition-all flex items-center gap-2 cursor-pointer active:scale-95"
                >
                  <Wrench className="w-3.5 h-3.5" />
                  <span>{t('dashboard.tech.openMyBt')}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 border-t border-amber-200/60">
              <button
                onClick={() => onNavigateToCorrective?.('corrective_di')}
                className="p-2.5 rounded-xl bg-white/90 hover:bg-white border border-amber-200/80 hover:border-amber-400 text-left transition-all group cursor-pointer shadow-2xs hover:shadow-xs"
              >
                <div className="text-[10px] font-bold text-slate-400 uppercase">{t('dashboard.tech.step1Requests')}</div>
                <div className="text-xs font-black text-slate-800 group-hover:text-amber-600 flex items-center justify-between mt-0.5">
                  <span>{t('dashboard.tech.reportDi')}</span>
                  <span className="text-[11px] font-mono font-bold px-1.5 py-0.2 rounded bg-rose-50 text-rose-700 border border-rose-200">
                    {(correctiveInterventions || []).filter((i) => i.statut === 'DEMANDE' || i.statut === 'DEMANDE_CREEE' || i.statut === 'EN_ATTENTE_VALIDATION').length}
                  </span>
                </div>
              </button>

              <button
                onClick={() => onNavigateToCorrective?.('corrective_bt')}
                className="p-2.5 rounded-xl bg-white/90 hover:bg-white border border-amber-200/80 hover:border-amber-400 text-left transition-all group cursor-pointer shadow-2xs hover:shadow-xs"
              >
                <div className="text-[10px] font-bold text-slate-400 uppercase">{t('dashboard.tech.step2MyBt')}</div>
                <div className="text-xs font-black text-slate-800 group-hover:text-amber-600 flex items-center justify-between mt-0.5">
                  <span>{t('dashboard.tech.assignedBt')}</span>
                  <span className="text-[11px] font-mono font-bold px-1.5 py-0.2 rounded bg-blue-50 text-blue-700 border border-blue-200">
                    {techScope.plannedBtCorrective.length}
                  </span>
                </div>
              </button>

              <button
                onClick={() => onNavigateToCorrective?.('corrective_live')}
                className="p-2.5 rounded-xl bg-white/90 hover:bg-white border border-amber-200/80 hover:border-amber-400 text-left transition-all group cursor-pointer shadow-2xs hover:shadow-xs"
              >
                <div className="text-[10px] font-bold text-slate-400 uppercase">{t('dashboard.tech.step3LiveTimer')}</div>
                <div className="text-xs font-black text-slate-800 group-hover:text-amber-600 flex items-center justify-between mt-0.5">
                  <span>{t('dashboard.tech.myLive')}</span>
                  <span className="text-[11px] font-mono font-bold px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                    {techScope.liveCorrective.length} {t('dashboard.tech.inProgress')}
                  </span>
                </div>
              </button>

              <button
                onClick={() => onNavigateToCorrective?.('corrective_cloture')}
                className="p-2.5 rounded-xl bg-white/90 hover:bg-white border border-amber-200/80 hover:border-amber-400 text-left transition-all group cursor-pointer shadow-2xs hover:shadow-xs"
              >
                <div className="text-[10px] font-bold text-slate-400 uppercase">{t('dashboard.tech.step4MyReports')}</div>
                <div className="text-xs font-black text-slate-800 group-hover:text-amber-600 flex items-center justify-between mt-0.5">
                  <span>{t('dashboard.tech.closedLabel')}</span>
                  <span className="text-[11px] font-mono font-bold px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 border border-slate-200">
                    {techScope.closedCorrective.length}
                  </span>
                </div>
              </button>
            </div>
          </div>

          {/* Two-Column Technician Operational Workboard: Preventive Tasks & Open Corrective WOs */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Left: Mes Tâches Préventives Prioritaires */}
            <div className="bg-white rounded-3xl border border-slate-200/90 p-5 md:p-6 shadow-[0_8px_30px_rgba(0,0,0,0.04)] space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <Calendar className="w-6 h-6 text-indigo-600 shrink-0" />
                  <div>
                    <h3 className="font-extrabold text-sm text-slate-900 tracking-tight">
                      Mes Tâches Préventives (Retard · Sem. {techScope.currentWeekKey} · À faire)
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Filtrées sur votre profil ({techScope.badgeLabel})
                    </p>
                  </div>
                </div>
                {onNavigateToPreventive && (
                  <button
                    onClick={onNavigateToPreventive}
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-800 inline-flex items-center gap-1 cursor-pointer"
                  >
                    <span>Planning</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {techScope.priorityTasks.length > 0 ? (
                <div className="space-y-2.5">
                  {techScope.priorityTasks.slice(0, 8).map((task, idx) => {
                    const isClarify =
                      task.validation_status === 'NEEDS_CLARIFICATION' ||
                      task.etat === 'À clarifier';
                    const isPendingVal =
                      task.validation_status === 'PENDING_VALIDATION' ||
                      task.etat === 'En attente validation';
                    const isLate = task.etat === 'En retard';
                    const isDone = task.etat === 'Fait';
                    const isThisWeek =
                      !isDone &&
                      ((task.planning && Boolean(task.planning[techScope.currentWeekKey])) ||
                        String(task.semaine_cible || '').toUpperCase() === techScope.currentWeekKey);

                    return (
                      <div
                        key={`tech-prv-${task.id ?? idx}`}
                        className={`p-3 rounded-2xl border flex items-center justify-between gap-3 text-xs transition ${
                          isClarify || isLate
                            ? 'bg-rose-50/40 border-rose-200/90'
                            : isPendingVal
                            ? 'bg-purple-50/40 border-purple-200/90'
                            : isThisWeek
                            ? 'bg-indigo-50/40 border-indigo-200/90'
                            : 'bg-slate-50/80 border-slate-200/80'
                        }`}
                      >
                        <div className="min-w-0 space-y-0.5">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200 text-[11px]">
                              {task.id_machine || 'MACHINE'}
                            </span>
                            {isClarify ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-900 border border-rose-300 animate-pulse">
                                À CLARIFIER
                              </span>
                            ) : isPendingVal ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-900 border border-purple-300">
                                À VALIDER
                              </span>
                            ) : isLate ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                                En retard
                              </span>
                            ) : isThisWeek ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
                                Semaine {techScope.currentWeekKey}
                              </span>
                            ) : isDone ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                Fait
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-200">
                                {task.etat || 'À faire'}
                              </span>
                            )}
                            {task.frequence && (
                              <span className="text-[10px] font-mono text-slate-500">
                                • {task.frequence}
                              </span>
                            )}
                          </div>
                          <div className="font-bold text-slate-800 truncate">
                            {task.composant || task.action_libelle || 'Contrôle préventif'}
                          </div>
                          {isClarify && task.validation_note && (
                            <div className="text-[10.5px] text-rose-700 font-semibold truncate">
                              Motif : « {task.validation_note} »
                            </div>
                          )}
                        </div>

                        {onNavigateToPreventive && (
                          <button
                            onClick={onNavigateToPreventive}
                            className="px-2.5 py-1.5 rounded-xl bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold text-[11px] shrink-0 cursor-pointer transition"
                          >
                            {isClarify ? 'Corriger' : 'Traiter'}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-6 rounded-2xl bg-slate-50/80 border border-slate-200/80 text-center space-y-1.5">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                  <div className="text-xs font-bold text-slate-800">
                    Aucune tâche préventive assignée
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Votre liste de maintenance préventive est à jour pour {techScope.badgeLabel}.
                  </p>
                </div>
              )}
            </div>

            {/* Right: Mes Ordres de Travail & Interventions Correctives Ouvertes */}
            <div className="bg-white rounded-3xl border border-slate-200/90 p-5 md:p-6 shadow-[0_8px_30px_rgba(0,0,0,0.04)] space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <Wrench className="w-6 h-6 text-amber-600 shrink-0" />
                  <div>
                    <h3 className="font-extrabold text-sm text-slate-900 tracking-tight">
                      Mes Bons de Travail & Interventions Ouvertes ({techScope.openCorrective.length})
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Ordres de travail en cours ou planifiés à votre nom
                    </p>
                  </div>
                </div>
                {onNavigateToCorrective && (
                  <button
                    onClick={() => onNavigateToCorrective('corrective_bt')}
                    className="text-xs font-bold text-amber-600 hover:text-amber-800 inline-flex items-center gap-1 cursor-pointer"
                  >
                    <span>Voir BT</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {techScope.openCorrective.length > 0 ? (
                <div className="space-y-2.5">
                  {techScope.openCorrective.slice(0, 8).map((bt, idx) => {
                    const isLive = bt.statut === 'EN_COURS';
                    const isPendingVal = bt.validation_status === 'PENDING_VALIDATION';
                    const isClarif =
                      bt.validation_status === 'NEEDS_CLARIFICATION' ||
                      bt.validation_status === 'REJECTED';
                    return (
                      <div
                        key={`tech-bt-${bt.id ?? idx}`}
                        className={`p-3 rounded-2xl border flex items-center justify-between gap-3 text-xs transition ${
                          isClarif
                            ? 'bg-rose-50/50 border-rose-300/90'
                            : isPendingVal
                            ? 'bg-purple-50/40 border-purple-200/90'
                            : isLive
                            ? 'bg-emerald-50/40 border-emerald-200/90'
                            : 'bg-slate-50/80 border-slate-200/80'
                        }`}
                      >
                        <div className="min-w-0 space-y-0.5">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200 text-[11px]">
                              {bt.code_machine || 'MACHINE'}
                            </span>
                            {bt.num_bt && (
                              <span className="font-mono text-[10.5px] font-bold text-amber-900 bg-amber-100/80 px-2 py-0.5 rounded border border-amber-200">
                                {bt.num_bt}
                              </span>
                            )}
                            {isClarif ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold font-mono bg-rose-100 text-rose-900 border border-rose-300">
                                {bt.validation_status === 'REJECTED' ? 'REJETÉ' : 'À CLARIFIER'}
                              </span>
                            ) : isPendingVal ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold font-mono bg-purple-100 text-purple-900 border border-purple-300">
                                À VALIDER
                              </span>
                            ) : (
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono ${
                                  isLive
                                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                    : 'bg-blue-100 text-blue-800 border border-blue-200'
                                }`}
                              >
                                {bt.statut || 'OUVERT'}
                              </span>
                            )}
                          </div>
                          <div className="font-bold text-slate-800 truncate">
                            {bt.anomalie || bt.travail_a_faire || 'Intervention corrective'}
                          </div>
                          {isClarif && bt.validation_note && (
                            <div className="text-[11px] font-semibold text-rose-800 bg-white/80 px-2 py-1 rounded-lg border border-rose-200 mt-1">
                              Note responsable : {bt.validation_note}
                            </div>
                          )}
                        </div>

                        {onNavigateToCorrective && (
                          <button
                            onClick={() =>
                              onNavigateToCorrective(
                                isClarif || isLive ? 'corrective_live' : 'corrective_bt'
                              )
                            }
                            className={`px-2.5 py-1.5 rounded-xl font-bold text-[11px] shrink-0 cursor-pointer transition ${
                              isClarif
                                ? 'bg-rose-600 hover:bg-rose-700 text-white'
                                : 'bg-white hover:bg-amber-50 text-amber-800 border border-amber-200'
                            }`}
                          >
                            {isClarif ? 'Corriger' : isLive ? 'Chrono Live' : 'Ouvrir BT'}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-6 rounded-2xl bg-slate-50/80 border border-slate-200/80 text-center space-y-1.5">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                  <div className="text-xs font-bold text-slate-800">
                    Aucune intervention corrective ouverte
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Aucun bon de travail en attente pour {techScope.badgeLabel}.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Two-Column Technician Recent Activity: Executions & Movements */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Left: Mes Dernières Exécutions Préventives */}
            <div className="bg-white rounded-3xl border border-slate-200/90 p-5 md:p-6 shadow-[0_8px_30px_rgba(0,0,0,0.04)] space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <div>
                    <h3 className="font-extrabold text-sm text-slate-900 tracking-tight">
                      Mes Dernières Exécutions Préventives
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Historique d’exécution enregistré à votre matricule
                    </p>
                  </div>
                </div>
              </div>

              {techScope.myPreventiveExecutions.length > 0 ? (
                <div className="space-y-2">
                  {techScope.myPreventiveExecutions.slice(0, 5).map((ex, idx) => (
                    <div
                      key={`tech-ex-${ex.id ?? idx}`}
                      className="p-3 rounded-2xl bg-slate-50/90 border border-slate-200/80 flex items-center justify-between text-xs"
                    >
                      <div className="space-y-0.5 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200 text-[10.5px]">
                            {ex.id_machine || 'MACHINE'}
                          </span>
                          <span className="font-bold text-slate-800 truncate">
                            {ex.composant || ex.action_libelle || 'Exécution préventive'}
                          </span>
                        </div>
                        <div className="text-[10.5px] text-slate-400 font-mono">
                          {ex.date_execution || ex.date_realisation || ex.periodMonth || 'Date N/A'}
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-mono font-bold text-[10px] border border-emerald-200 shrink-0">
                        Validé
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-slate-400 text-center py-5">
                  Aucune exécution préventive enregistrée pour votre profil.
                </div>
              )}
            </div>

            {/* Right: Mes Derniers Mouvements Magasin */}
            <div className="bg-white rounded-3xl border border-slate-200/90 p-5 md:p-6 shadow-[0_8px_30px_rgba(0,0,0,0.04)] space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <SortieEntreeIcon className="w-5 h-5 text-teal-600 shrink-0" />
                  <div>
                    <h3 className="font-extrabold text-sm text-slate-900 tracking-tight">
                      Mes Derniers Mouvements Magasin
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Vos sorties et mouvements PDR récents
                    </p>
                  </div>
                </div>
                <button
                  onClick={onNavigateToSortie}
                  className="text-xs font-bold text-teal-600 hover:text-teal-800 inline-flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Sortie</span>
                </button>
              </div>

              {techScope.myMouvements.length > 0 ? (
                <div className="space-y-2">
                  {techScope.myMouvements.slice(0, 5).map((m, idx) => {
                    const isSortie = String(m.type || '').toLowerCase().includes('sort');
                    return (
                      <div
                        key={`tech-mvt-${m.id ?? idx}`}
                        className="p-3 rounded-2xl bg-slate-50/90 border border-slate-200/80 flex items-center justify-between text-xs"
                      >
                        <div className="space-y-0.5 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`text-[10px] font-bold px-2 py-0.2 rounded-full font-mono ${
                                isSortie
                                  ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                  : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              }`}
                            >
                              {m.type}
                            </span>
                            <span className="font-mono font-bold text-slate-900">{m.ref}</span>
                          </div>
                          <div className="text-[11px] text-slate-600 truncate">
                            {m.designation || 'Article'}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            {m.code_bon || 'Bon'} • {m.date} {m.id_machine_registered ? `• ${m.id_machine_registered}` : ''}
                          </div>
                        </div>
                        <div className="text-right font-mono font-black text-sm shrink-0">
                          {isSortie ? (
                            <span className="text-rose-600">-{m.quantite}</span>
                          ) : (
                            <span className="text-emerald-600">+{m.quantite}</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-xs text-slate-400 text-center py-5">
                  Aucun mouvement de stock enregistré sous votre nom.
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {/* C4 — Empty Factory Onboarding Wizard (Desktop Admin / Skippable & Dismissible) */}
          {canManageSettings && (
            <FactoryOnboardingWizard
              onNavigateToZones={onNavigateToZones}
              onNavigateToMachines={onNavigateToMachines}
              onNavigateToUsers={onNavigateToUsers}
              onNavigateToPreventive={onNavigateToPreventive}
              showToast={showToast}
              forceOpen={forceShowOnboarding}
              onCloseForceOpen={() => setForceShowOnboarding(false)}
            />
          )}

          {/* 1.5 Compact Governance, Operational Trust & LAN Sync Strip */}
          <div
            data-testid="a2-operational-trust-card"
            className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-3.5 sm:p-4 space-y-3 text-xs"
          >
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
              {/* Left: LAN Sync Status + Queue Counters + Referential Health */}
              <div className="flex items-start sm:items-center gap-3 min-w-0 flex-wrap">
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold shrink-0 shadow-2xs ${
                    syncTrust.hasUnresolvedConflict
                      ? 'bg-amber-500 text-white'
                      : syncTrust.lastSyncStatus === 'ERROR'
                      ? 'bg-rose-600 text-white'
                      : 'bg-emerald-600 text-white'
                  }`}
                >
                  <ShieldCheck className="w-4 h-4" />
                </div>

                <div className="flex items-center gap-2 flex-wrap min-w-0">
                  <span className="font-extrabold text-xs text-slate-900">
                    {t('dashboard.trust.title')}
                  </span>

                  {syncTrust.hasUnresolvedConflict ? (
                    <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 font-mono text-[10.5px] font-extrabold border border-amber-300 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3 text-amber-600" />
                      {t('dashboard.trust.conflictBadge')}
                    </span>
                  ) : syncTrust.lastSyncStatus === 'ERROR' ? (
                    <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-900 font-mono text-[10.5px] font-extrabold border border-rose-300 flex items-center gap-1">
                      <XCircle className="w-3 h-3 text-rose-600" />
                      {t('dashboard.trust.errorBadge')}
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 font-mono text-[10.5px] font-bold border border-emerald-200 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      {syncTrust.lastSyncAt
                        ? `${t('dashboard.trust.syncedOk')} (${new Date(syncTrust.lastSyncAt).toLocaleTimeString('fr-FR', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}${syncTrust.lastServerVersion ? ` · v${syncTrust.lastServerVersion}` : ''})`
                        : t('dashboard.trust.readyLocalLan')}
                    </span>
                  )}

                  {referentialAudit?.summary && !referentialAudit.summary.isFullyAligned && (
                    canAccessSettingsTab && onNavigateToSettings ? (
                      <button
                        type="button"
                        onClick={() => onNavigateToSettings?.('matching')}
                        className="px-2.5 py-0.5 rounded-full bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-mono text-[10.5px] font-bold inline-flex items-center gap-1 transition cursor-pointer"
                        title="Des mouvements ou interventions font référence à des machines ou techniciens non enregistrés."
                      >
                        <ShieldAlert className="w-3 h-3 text-amber-600" />
                        <span>
                          {t('dashboard.trust.referentialGaps')} ({referentialAudit.summary.totalOrphanErrors || 0}) · {t('dashboard.trust.health')} {referentialAudit.healthScore ?? 100}%
                        </span>
                        <span className="underline ml-0.5">{t('dashboard.trust.pairAction')}</span>
                      </button>
                    ) : (
                      <span
                        className="px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-900 border border-amber-300 font-mono text-[10.5px] font-bold inline-flex items-center gap-1"
                        title="Des mouvements ou interventions font référence à des machines ou techniciens non enregistrés."
                      >
                        <ShieldAlert className="w-3 h-3 text-amber-600" />
                        <span>
                          {t('dashboard.trust.referentialGaps')} ({referentialAudit.summary.totalOrphanErrors || 0}) · {t('dashboard.trust.health')} {referentialAudit.healthScore ?? 100}%
                        </span>
                      </span>
                    )
                  )}
                </div>

                <div className="hidden lg:block h-4 w-px bg-slate-200" />

                {/* Live PENDING Queue Counters */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] font-bold text-slate-500">
                    {t('dashboard.trust.pendingQueueLabel')} ({validationQueues.totalPending}) :
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-slate-50 text-slate-800 border border-slate-200 font-mono font-bold text-[10.5px]">
                    {t('dashboard.trust.correctiveBt')} <b className="text-amber-700">{validationQueues.pendingCorrective.length}</b>
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-slate-50 text-slate-800 border border-slate-200 font-mono font-bold text-[10.5px]">
                    {t('dashboard.trust.preventive')} <b className="text-indigo-700">{validationQueues.pendingPreventive.length}</b>
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-slate-50 text-slate-800 border border-slate-200 font-mono font-bold text-[10.5px]">
                    {t('dashboard.trust.spareIssues')} <b className="text-teal-700">{validationQueues.pendingSortieDemands.length}</b>
                  </span>
                  {validationQueues.totalClarification > 0 && (
                    <span className="px-2 py-0.5 rounded-md bg-rose-50 text-rose-900 border border-rose-200 font-mono font-bold text-[10.5px]">
                      {t('dashboard.trust.toClarify')} {validationQueues.totalClarification}
                    </span>
                  )}
                </div>
              </div>

              {/* Right: Conflict / Sync / Validation Center Actions */}
              <div className="flex items-center gap-2 flex-wrap shrink-0">
                {canSyncLan && syncTrust.hasUnresolvedConflict && (
                  <button
                    type="button"
                    onClick={() => setShowConflictModal(true)}
                    className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-2xs transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>{t('dashboard.trust.resolveLanConflict')}</span>
                  </button>
                )}

                {(validationRadar.totalPendingCount > 0 || validationRadar.totalClarificationCount > 0) && (
                  <button
                    type="button"
                    onClick={() => setIsRadarExpanded((prev) => !prev)}
                    className="px-3 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-200 font-bold text-xs transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>{t('dashboard.trust.fieldRadar')} ({validationRadar.totalPendingCount})</span>
                    <ChevronDown
                      className={`w-3.5 h-3.5 transition-transform duration-200 ${
                        isRadarExpanded ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                )}

                {canSyncLan && (
                  <button
                    type="button"
                    onClick={handleQuickLanMerge}
                    disabled={isSyncBusy}
                    className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 font-bold text-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    title="Fusionner intelligemment avec le serveur LAN sans écraser les données"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncBusy ? 'animate-spin text-emerald-600' : 'text-slate-600'}`} />
                    <span>{t('dashboard.trust.syncLanBtn')}</span>
                  </button>
                )}

                {canAccessValidationCenterTab && onNavigateToValidationCenter && (
                  <button
                    type="button"
                    onClick={() => onNavigateToValidationCenter?.()}
                    className="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-black text-white font-bold text-xs shadow-2xs transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{t('dashboard.trust.validationCenterBtn')} ({validationQueues.totalPending})</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {syncTrust.lastSyncError && (
              <div className="text-[11px] font-semibold text-rose-700 truncate pt-1 border-t border-slate-100">
                {t('dashboard.trust.lastError')} {syncTrust.lastSyncError}
              </div>
            )}

            {/* Collapsible V4 Admin Validation Radar (Unified Maker-Checker Queue) */}
            {(validationRadar.totalPendingCount > 0 || validationRadar.totalClarificationCount > 0) && (
              <div
                data-testid="v4-admin-validation-radar"
                className="pt-3 border-t border-slate-100 space-y-2.5"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-xs text-slate-800">
                      Radar de Validation Terrain (Maker-Checker V4) : {validationRadar.totalPendingCount} à valider
                    </span>
                    {validationRadar.criticalAlertCount > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-800 font-mono text-[10px] font-bold border border-rose-200 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3 text-rose-600" />
                        {validationRadar.criticalAlertCount} anomalie(s) stock/bon
                      </span>
                    )}
                    {validationRadar.totalClarificationCount > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-900 font-mono text-[10px] font-bold border border-amber-200">
                        {validationRadar.totalClarificationCount} en clarification tech.
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    {validationRadar.pendingCorrectiveCount > 0 &&
                      (canAccessValidationCenterTab || canAccessCorrectiveBtTab) && (
                        <button
                          type="button"
                          onClick={() =>
                            canAccessValidationCenterTab && onNavigateToValidationCenter
                              ? onNavigateToValidationCenter()
                              : canAccessCorrectiveBtTab
                              ? onNavigateToCorrective?.('corrective_bt')
                              : undefined
                          }
                          className="px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 font-bold text-[11px] transition flex items-center gap-1 cursor-pointer"
                        >
                          <Wrench className="w-3 h-3 text-amber-700" />
                          <span>BT ({validationRadar.pendingCorrectiveCount})</span>
                        </button>
                      )}
                    {validationRadar.pendingPreventiveCount > 0 &&
                      (canAccessValidationCenterTab || canAccessPreventiveTab) && (
                        <button
                          type="button"
                          onClick={() =>
                            canAccessValidationCenterTab && onNavigateToValidationCenter
                              ? onNavigateToValidationCenter()
                              : canAccessPreventiveTab
                              ? onNavigateToPreventive?.()
                              : undefined
                          }
                          className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 font-bold text-[11px] transition flex items-center gap-1 cursor-pointer"
                        >
                          <Calendar className="w-3 h-3 text-indigo-700" />
                          <span>Préventif ({validationRadar.pendingPreventiveCount})</span>
                        </button>
                      )}
                    {validationRadar.pendingSortieCount > 0 &&
                      (canAccessValidationCenterTab || canAccessSortieTab) && (
                        <button
                          type="button"
                          onClick={() =>
                            canAccessValidationCenterTab && onNavigateToValidationCenter
                              ? onNavigateToValidationCenter()
                              : canAccessSortieTab
                              ? onNavigateToSortie?.()
                              : undefined
                          }
                          className="px-2.5 py-1 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-900 border border-teal-200 font-bold text-[11px] transition flex items-center gap-1 cursor-pointer"
                        >
                          <SortieEntreeIcon className="w-3 h-3 text-teal-700" />
                          <span>Sorties ({validationRadar.pendingSortieCount})</span>
                        </button>
                      )}
                  </div>
                </div>

                {isRadarExpanded && validationRadar.items.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1">
                    {validationRadar.items.slice(0, 6).map((item) => {
                      const canInspectRadarItem =
                        item.claimType === 'CORRECTIVE'
                          ? canAccessCorrectiveBtTab || canAccessValidationCenterTab
                          : item.claimType === 'PREVENTIVE'
                          ? canAccessPreventiveTab || canAccessValidationCenterTab
                          : canAccessSortieTab || canAccessValidationCenterTab;

                      return (
                        <div
                          key={`${item.claimType}-${item.id}`}
                          className={`p-3 rounded-xl bg-slate-50/80 border flex items-center justify-between gap-2.5 text-xs ${
                            item.reconciliation.hasCritical
                              ? 'border-rose-300'
                              : item.reconciliation.hasWarning
                              ? 'border-amber-300'
                              : 'border-slate-200/90'
                          }`}
                        >
                          <div className="min-w-0 space-y-0.5">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span
                                className={`px-1.5 py-0.2 rounded text-[9.5px] font-mono font-black ${
                                  item.claimType === 'CORRECTIVE'
                                    ? 'bg-amber-100 text-amber-900 border border-amber-200'
                                    : item.claimType === 'PREVENTIVE'
                                    ? 'bg-indigo-100 text-indigo-900 border border-indigo-200'
                                    : 'bg-teal-100 text-teal-900 border border-teal-200'
                                }`}
                              >
                                {item.claimType === 'CORRECTIVE'
                                  ? 'BT'
                                  : item.claimType === 'PREVENTIVE'
                                  ? 'PRÉV'
                                  : 'SORTIE'}
                              </span>
                              <span className="font-mono font-bold text-slate-900">{item.machineCode}</span>
                              <span className="text-[10.5px] text-slate-500 truncate">• {item.technicianName}</span>
                            </div>
                            <div className="font-bold text-slate-800 truncate">{item.title}</div>
                            {item.reconciliation.alerts.length > 0 ? (
                              <div className="text-[10px] font-bold text-rose-700 flex items-center gap-1 truncate">
                                <AlertTriangle className="w-3 h-3 shrink-0" />
                                <span className="truncate">{item.reconciliation.alerts[0].title}</span>
                              </div>
                            ) : (
                              <div className="text-[10px] font-mono text-emerald-700">
                                {item.sparesCount} PDR • Concordance OK
                              </div>
                            )}
                          </div>

                          {canInspectRadarItem && (
                            <button
                              type="button"
                              onClick={() =>
                                item.claimType === 'CORRECTIVE'
                                  ? canAccessCorrectiveBtTab
                                    ? onNavigateToCorrective?.('corrective_bt')
                                    : onNavigateToValidationCenter?.()
                                  : item.claimType === 'PREVENTIVE'
                                  ? canAccessPreventiveTab
                                    ? onNavigateToPreventive?.()
                                    : onNavigateToValidationCenter?.()
                                  : canAccessSortieTab
                                  ? onNavigateToSortie?.()
                                  : onNavigateToValidationCenter?.()
                              }
                              className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-800 border border-slate-200 font-bold text-[11px] shrink-0 cursor-pointer transition"
                            >
                              Contrôler
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          <ServerSyncConflictModal
            isOpen={canSyncLan && showConflictModal && Boolean(syncTrust.unresolvedConflict)}
            conflict={syncTrust.unresolvedConflict}
            onSmartMerge={handleQuickLanMerge}
            onForcePushLocal={handleForcePushConflict}
            onForcePullServer={handleForcePullConflict}
            onCancel={() => setShowConflictModal(false)}
            isProcessing={isSyncBusy}
          />

          {/* 2. Top Primary KPI Metrics Grid */}
          <DashboardKPIs
            stockKPIs={stockKPIs}
            types={types}
            machineHealth={machineHealth}
            onNavigateToStock={canAccessStockTab ? onNavigateToStock : undefined}
            onNavigateToMachines={canAccessMachinesTab ? onNavigateToMachines : undefined}
          />

          {/* 2.5 Executive Maintenance & Reliability Pulse Strip (DB-11: Balances Stock KPIs with Maintenance KPIs) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {/* Card 1: Conformité Préventive */}
            <div
              onClick={canAccessPreventiveTab ? onNavigateToPreventive : undefined}
              className={`bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs flex items-center justify-between gap-3 transition ${
                canAccessPreventiveTab ? 'hover:border-indigo-300 cursor-pointer' : ''
              }`}
            >
              <div className="space-y-1 min-w-0">
                <div className="text-[10.5px] font-extrabold uppercase tracking-wider text-slate-500">
                  {t('dashboard.execPulse.preventiveCompliance')}
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-xl font-black font-mono text-indigo-700">
                    {executiveMaintenanceSummary.pmComplianceRate}%
                  </span>
                  <span className="text-[11px] font-mono text-slate-500">
                    ({executiveMaintenanceSummary.pmDoneCount}/{executiveMaintenanceSummary.pmTotalCount} {t('dashboard.execPulse.doneShort')})
                  </span>
                </div>
                <div className="text-[10.5px] font-mono text-rose-700 font-bold">
                  {executiveMaintenanceSummary.pmOverdueCount} {t('dashboard.execPulse.overdueShort')}
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200/80 flex items-center justify-center text-indigo-700 shrink-0">
                <Calendar className="w-5 h-5" />
              </div>
            </div>

            {/* Card 2: Charge Corrective Active */}
            <div
              onClick={canAccessCorrectiveTab ? () => onNavigateToCorrective?.('corrective') : undefined}
              className={`bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs flex items-center justify-between gap-3 transition ${
                canAccessCorrectiveTab ? 'hover:border-amber-300 cursor-pointer' : ''
              }`}
            >
              <div className="space-y-1 min-w-0">
                <div className="text-[10.5px] font-extrabold uppercase tracking-wider text-slate-500">
                  {t('dashboard.execPulse.activeCorrectiveLoad')}
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-xl font-black font-mono text-amber-700">
                    {executiveMaintenanceSummary.activeCorrectiveTotal}
                  </span>
                  <span className="text-[11px] font-mono text-slate-500">
                    {t('dashboard.execPulse.openDiShort')} : {executiveMaintenanceSummary.openDiCount}
                  </span>
                </div>
                <div className="text-[10.5px] font-mono text-emerald-700 font-bold">
                  {executiveMaintenanceSummary.liveBtCount} {t('dashboard.execPulse.liveBtShort')}
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200/80 flex items-center justify-center text-amber-700 shrink-0">
                <Wrench className="w-5 h-5" />
              </div>
            </div>

            {/* Card 3: MTTR Moyen & Clôtures */}
            <div
              onClick={canAccessCorrectiveAnalyticsTab ? () => onNavigateToCorrective?.('corrective_analytics') : undefined}
              className={`bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs flex items-center justify-between gap-3 transition ${
                canAccessCorrectiveAnalyticsTab ? 'hover:border-purple-300 cursor-pointer' : ''
              }`}
            >
              <div className="space-y-1 min-w-0">
                <div className="text-[10.5px] font-extrabold uppercase tracking-wider text-slate-500">
                  {t('dashboard.execPulse.meanRepairTime')}
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-xl font-black font-mono text-purple-700">
                    {executiveMaintenanceSummary.mttrDisplay}
                  </span>
                  <span className="text-[11px] font-mono text-slate-500">
                    ({executiveMaintenanceSummary.closedBtCount} {t('dashboard.execPulse.closedInterventions')})
                  </span>
                </div>
                <div className="text-[10.5px] font-mono text-slate-500 font-semibold">
                  {t('dashboard.execPulse.availabilityLabel')} :{' '}
                  {machineHealth.total > 0
                    ? Math.round((machineHealth.enService / machineHealth.total) * 100)
                    : 100}
                  %
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-200/80 flex items-center justify-center text-purple-700 shrink-0">
                <Activity className="w-5 h-5" />
              </div>
            </div>

            {/* Card 4: Flux Logistiques & Réparations Externes */}
            <div
              onClick={canAccessSortieTab ? onNavigateToSortie : undefined}
              className={`bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs flex items-center justify-between gap-3 transition ${
                canAccessSortieTab ? 'hover:border-teal-300 cursor-pointer' : ''
              }`}
            >
              <div className="space-y-1 min-w-0">
                <div className="text-[10.5px] font-extrabold uppercase tracking-wider text-slate-500">
                  {t('dashboard.execPulse.openLogisticsFlows')}
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-xl font-black font-mono text-teal-700">
                    {pendingOrders.length + pendingExternalRepairs.length}
                  </span>
                  <span className="text-[11px] font-mono text-slate-500">
                    {pendingOrders.length} {t('dashboard.execPulse.pendingOrdersShort')}
                  </span>
                </div>
                <div className="text-[10.5px] font-mono text-purple-700 font-bold">
                  {pendingExternalRepairs.length} {t('dashboard.execPulse.externalRepairsShort')}
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-200/80 flex items-center justify-center text-teal-700 shrink-0">
                <Truck className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* 3. Accès Rapide aux Modules GMAO (Placed at the top for immediate engineer navigation) */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-2xs space-y-3.5">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2 tracking-tight">
                <Zap className="w-4 h-4 text-amber-500" />
                <span>{t('dashboard.quickNav.title')}</span>
              </h3>
              <span className="text-[10.5px] font-mono font-bold text-slate-500 bg-slate-50 px-2.5 py-0.5 rounded-full border border-slate-200/80">
                {t('dashboard.quickNav.badge')}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
              {canAccessStockTab && (
                <button
                  onClick={onNavigateToStock}
                  className="p-3.5 rounded-xl bg-slate-50/90 hover:bg-blue-50/80 border border-slate-200/80 hover:border-blue-300 text-left shadow-2xs hover:shadow-xs hover:-translate-y-0.5 transition-all duration-200 space-y-1.5 cursor-pointer group"
                >
                  <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center group-hover:scale-105 transition-transform">
                    <Package className="w-5 h-5" />
                  </div>
                  <div className="font-bold text-xs text-slate-900 group-hover:text-blue-700 transition-colors">{t('dashboard.quickNav.stockTitle')}</div>
                  <div className="text-[10px] text-slate-500">{t('dashboard.quickNav.stockDesc')}</div>
                </button>
              )}

              {canAccessSortieTab && (
                <button
                  onClick={onNavigateToSortie}
                  className="p-3.5 rounded-xl bg-slate-50/90 hover:bg-emerald-50/80 border border-slate-200/80 hover:border-emerald-300 text-left shadow-2xs hover:shadow-xs hover:-translate-y-0.5 transition-all duration-200 space-y-1.5 cursor-pointer group"
                >
                  <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center group-hover:scale-105 transition-transform">
                    <SortieEntreeIcon className="w-5 h-5" />
                  </div>
                  <div className="font-bold text-xs text-slate-900 group-hover:text-emerald-700 transition-colors">{t('dashboard.quickNav.movementsTitle')}</div>
                  <div className="text-[10px] text-slate-500">{t('dashboard.quickNav.movementsDesc')}</div>
                </button>
              )}

              {canAccessMachinesTab && (
                <button
                  onClick={onNavigateToMachines}
                  className="p-3.5 rounded-xl bg-slate-50/90 hover:bg-purple-50/80 border border-slate-200/80 hover:border-purple-300 text-left shadow-2xs hover:shadow-xs hover:-translate-y-0.5 transition-all duration-200 space-y-1.5 cursor-pointer group"
                >
                  <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center group-hover:scale-105 transition-transform">
                    <Factory className="w-5 h-5" />
                  </div>
                  <div className="font-bold text-xs text-slate-900 group-hover:text-purple-700 transition-colors">{t('dashboard.quickNav.machinesTitle')}</div>
                  <div className="text-[10px] text-slate-500">{t('dashboard.quickNav.machinesDesc')}</div>
                </button>
              )}

              {canAccessEntrepotTab && (
                <button
                  onClick={onNavigateToWarehouse}
                  className="p-3.5 rounded-xl bg-slate-50/90 hover:bg-teal-50/80 border border-slate-200/80 hover:border-teal-300 text-left shadow-2xs hover:shadow-xs hover:-translate-y-0.5 transition-all duration-200 space-y-1.5 cursor-pointer group"
                >
                  <div className="w-9 h-9 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center group-hover:scale-105 transition-transform">
                    <Warehouse className="w-5 h-5" />
                  </div>
                  <div className="font-bold text-xs text-slate-900 group-hover:text-teal-700 transition-colors">{t('dashboard.quickNav.warehouseTitle')}</div>
                  <div className="text-[10px] text-slate-500">{t('dashboard.quickNav.warehouseDesc')}</div>
                </button>
              )}

              {canAccessZonesTab && (
                <button
                  onClick={onNavigateToZones}
                  className="p-3.5 rounded-xl bg-slate-50/90 hover:bg-amber-50/80 border border-slate-200/80 hover:border-amber-300 text-left shadow-2xs hover:shadow-xs hover:-translate-y-0.5 transition-all duration-200 space-y-1.5 cursor-pointer group"
                >
                  <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center group-hover:scale-105 transition-transform">
                    <Layers className="w-5 h-5" />
                  </div>
                  <div className="font-bold text-xs text-slate-900 group-hover:text-amber-700 transition-colors">{t('dashboard.quickNav.zonesTitle')}</div>
                  <div className="text-[10px] text-slate-500">{t('dashboard.quickNav.zonesDesc')}</div>
                </button>
              )}

              {canAccessUsersTab && (
                <button
                  onClick={onNavigateToUsers}
                  className="p-3.5 rounded-xl bg-slate-50/90 hover:bg-indigo-50/80 border border-slate-200/80 hover:border-indigo-300 text-left shadow-2xs hover:shadow-xs hover:-translate-y-0.5 transition-all duration-200 space-y-1.5 cursor-pointer group"
                >
                  <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center group-hover:scale-105 transition-transform">
                    <UserCheck className="w-5 h-5" />
                  </div>
                  <div className="font-bold text-xs text-slate-900 group-hover:text-indigo-700 transition-colors">{t('dashboard.quickNav.usersTitle')}</div>
                  <div className="text-[10px] text-slate-500">{t('dashboard.quickNav.usersDesc')}</div>
                </button>
              )}

              {canAccessSettingsTab && (
                <button
                  onClick={onNavigateToSettings}
                  className="p-3.5 rounded-xl bg-slate-50/90 hover:bg-slate-100 border border-slate-200/80 hover:border-slate-300 text-left shadow-2xs hover:shadow-xs hover:-translate-y-0.5 transition-all duration-200 space-y-1.5 cursor-pointer group"
                >
                  <div className="w-9 h-9 rounded-xl bg-slate-200 text-slate-700 flex items-center justify-center group-hover:scale-105 transition-transform">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <div className="font-bold text-xs text-slate-900 group-hover:text-slate-950 transition-colors">{t('dashboard.quickNav.excelTwinTitle')}</div>
                  <div className="text-[10px] text-slate-500">{t('dashboard.quickNav.excelTwinDesc')}</div>
                </button>
              )}
            </div>
          </div>

          {/* 3.5 Hub Maintenance Corrective Industrielle Nexus (Mature Light Excel UI) */}
          {canAccessCorrectiveTab && (
            <div className="bg-white rounded-2xl border border-slate-200/90 border-l-4 border-l-amber-500 shadow-2xs p-4 sm:p-5 space-y-3.5 relative overflow-hidden">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-start sm:items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200/90 flex items-center justify-center text-amber-700 shrink-0 shadow-2xs">
                    <Wrench className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-sm sm:text-base font-extrabold text-slate-900 tracking-tight">
                        {t('dashboard.correctiveHub.title')}
                      </h2>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-amber-100 text-amber-900 border border-amber-200/80 tracking-wider font-mono">
                        {t('dashboard.correctiveHub.dedicatedBadge')}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-50 text-slate-600 border border-slate-200 font-mono">
                        {t('dashboard.correctiveHub.subSectionsBadge')}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 max-w-3xl leading-relaxed">
                      {t('dashboard.correctiveHub.description')}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap shrink-0">
                  <button
                    onClick={() => onNavigateToCorrective?.('corrective')}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 shadow-2xs transition-all flex items-center gap-2 cursor-pointer active:scale-95"
                  >
                    <Wrench className="w-3.5 h-3.5" />
                    <span>{t('dashboard.correctiveHub.openBtn')}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Quick Tabs Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 pt-3 border-t border-slate-100">
                {canAccessCorrectiveDiTab && (
                  <button
                    onClick={() => onNavigateToCorrective?.('corrective_di')}
                    className="p-2.5 rounded-xl bg-slate-50/80 hover:bg-amber-50/50 border border-slate-200/90 hover:border-amber-300 text-left transition-all group cursor-pointer shadow-2xs"
                  >
                    <div className="text-[10px] font-bold text-slate-400 uppercase font-mono">{t('dashboard.correctiveHub.step1Title')}</div>
                    <div className="text-xs font-extrabold text-slate-800 group-hover:text-amber-700 flex items-center justify-between mt-1">
                      <span>{t('dashboard.correctiveHub.step1Sub')}</span>
                      <span className="text-[11px] font-mono font-bold px-1.5 py-0.2 rounded bg-rose-50 text-rose-700 border border-rose-200">
                        {(correctiveInterventions || []).filter((i) => i.statut === 'DEMANDE' || i.statut === 'DEMANDE_CREEE' || i.statut === 'EN_ATTENTE_VALIDATION').length}
                      </span>
                    </div>
                  </button>
                )}

                {canAccessCorrectiveBtTab && (
                  <button
                    onClick={() => onNavigateToCorrective?.('corrective_bt')}
                    className="p-2.5 rounded-xl bg-slate-50/80 hover:bg-amber-50/50 border border-slate-200/90 hover:border-amber-300 text-left transition-all group cursor-pointer shadow-2xs"
                  >
                    <div className="text-[10px] font-bold text-slate-400 uppercase font-mono">{t('dashboard.correctiveHub.step2Title')}</div>
                    <div className="text-xs font-extrabold text-slate-800 group-hover:text-amber-700 flex items-center justify-between mt-1">
                      <span>{t('dashboard.correctiveHub.step2Sub')}</span>
                      <span className="text-[11px] font-mono font-bold px-1.5 py-0.2 rounded bg-blue-50 text-blue-700 border border-blue-200">
                        {(correctiveInterventions || []).filter((i) => i.statut === 'BT_PLANIFIE' || i.statut === 'EN_ATTENTE_PDR').length}
                      </span>
                    </div>
                  </button>
                )}

                {canAccessCorrectiveLiveTab && (
                  <button
                    onClick={() => onNavigateToCorrective?.('corrective_live')}
                    className="p-2.5 rounded-xl bg-slate-50/80 hover:bg-amber-50/50 border border-slate-200/90 hover:border-amber-300 text-left transition-all group cursor-pointer shadow-2xs"
                  >
                    <div className="text-[10px] font-bold text-slate-400 uppercase font-mono">{t('dashboard.correctiveHub.step3Title')}</div>
                    <div className="text-xs font-extrabold text-slate-800 group-hover:text-amber-700 flex items-center justify-between mt-1">
                      <span>{t('dashboard.correctiveHub.step3Sub')}</span>
                      <span className="text-[11px] font-mono font-bold px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {(correctiveInterventions || []).filter((i) => i.statut === 'EN_COURS').length} {t('dashboard.tech.inProgress')}
                      </span>
                    </div>
                  </button>
                )}

                {canAccessCorrectiveClotureTab && (
                  <button
                    onClick={() => onNavigateToCorrective?.('corrective_cloture')}
                    className="p-2.5 rounded-xl bg-slate-50/80 hover:bg-amber-50/50 border border-slate-200/90 hover:border-amber-300 text-left transition-all group cursor-pointer shadow-2xs"
                  >
                    <div className="text-[10px] font-bold text-slate-400 uppercase font-mono">{t('dashboard.correctiveHub.step4Title')}</div>
                    <div className="text-xs font-extrabold text-slate-800 group-hover:text-amber-700 flex items-center justify-between mt-1">
                      <span>{t('dashboard.correctiveHub.step4Sub')}</span>
                      <span className="text-[11px] font-mono font-bold px-1.5 py-0.2 rounded bg-white text-slate-700 border border-slate-200">
                        {(correctiveInterventions || []).filter((i) => i.statut === 'CLOTURE').length}
                      </span>
                    </div>
                  </button>
                )}

                {canAccessCorrectiveAnalyticsTab && (
                  <button
                    onClick={() => onNavigateToCorrective?.('corrective_analytics')}
                    className="p-2.5 rounded-xl bg-slate-50/80 hover:bg-amber-50/50 border border-slate-200/90 hover:border-amber-300 text-left transition-all group cursor-pointer shadow-2xs"
                  >
                    <div className="text-[10px] font-bold text-slate-400 uppercase font-mono">{t('dashboard.correctiveHub.step5Title')}</div>
                    <div className="text-xs font-extrabold text-slate-800 group-hover:text-amber-700 flex items-center justify-between mt-1">
                      <span>{t('dashboard.correctiveHub.step5Sub')}</span>
                      <span className="text-[11px] font-mono font-bold px-1.5 py-0.2 rounded bg-purple-50 text-purple-700 border border-purple-200">
                        MTTR
                      </span>
                    </div>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* 4. Critical Watchlist (2/3) & Recent Flux Live Feed (1/3) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-stretch">
            {/* Watchlist Ruptures & Alertes */}
            <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs flex flex-col justify-between space-y-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-rose-50 border border-rose-200/80 flex items-center justify-center shrink-0">
                      <AlertTriangle className="w-4 h-4 text-rose-600" />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-sm text-slate-900 tracking-tight">
                        {t('dashboard.watchlist.title')} ({alertAndRuptureItems.length})
                      </h3>
                      <p className="text-[11px] text-slate-500">
                        {t('dashboard.watchlist.subtitle')}
                      </p>
                    </div>
                  </div>

                  {canAccessStockTab && onNavigateToStock && (
                    <button
                      onClick={onNavigateToStock}
                      className="text-xs font-bold text-blue-600 hover:text-blue-800 inline-flex items-center gap-1 cursor-pointer"
                    >
                      <span>{t('dashboard.watchlist.viewAllStock')}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="overflow-x-auto border border-slate-200/80 rounded-xl shadow-2xs">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50 text-[10.5px] font-bold text-slate-600 uppercase tracking-wider border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3.5">{t('dashboard.watchlist.colRef')}</th>
                        <th className="py-2.5 px-3.5">{t('dashboard.watchlist.colDesignation')}</th>
                        <th className="py-2.5 px-2 text-right">{t('dashboard.watchlist.colCurrentStock')}</th>
                        <th className="py-2.5 px-2 text-right">{t('dashboard.watchlist.colThreshold')}</th>
                        <th className="py-2.5 px-3 text-center">{t('dashboard.watchlist.colState')}</th>
                        <th className="py-2.5 px-3">{t('dashboard.watchlist.colLocation')}</th>
                        <th className="py-2.5 px-3 text-center">{t('dashboard.watchlist.colQuickActions')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {!isWatchlistReady ? (
                        <TableSkeletonRows cols={7} rows={6} />
                      ) : alertAndRuptureItems.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-slate-400">
                            <div className="flex flex-col items-center justify-center gap-1.5">
                              <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                              <span className="font-semibold text-slate-700">{t('dashboard.watchlist.emptyTitle')}</span>
                              <span className="text-xs text-slate-500">{t('dashboard.watchlist.emptySubtitle')}</span>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        alertAndRuptureItems.slice(0, 8).map((item, idx) => (
                          <tr key={`alert-item-${item.id ?? ''}-${item.ref ?? ''}-${idx}`} className="hover:bg-slate-50/80 transition">
                            <td className="py-2.5 px-3.5 font-mono font-bold text-slate-900">{item.ref}</td>
                            <td className="py-2.5 px-3.5 font-medium text-slate-800">{item.designation}</td>
                            <td className="py-2.5 px-2 text-right font-mono font-black text-rose-600">
                              {item.stockActuel}
                            </td>
                            <td className="py-2.5 px-2 text-right font-mono text-slate-500">{item.seuil}</td>
                            <td className="py-2.5 px-3 text-center">
                              {item.alerte === 'RUPTURE' ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200 shadow-2xs">
                                  <XCircle className="w-3 h-3" />
                                  <span>{t('dashboard.watchlist.ruptureBadge')}</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-200 shadow-2xs">
                                  <AlertTriangle className="w-3 h-3" />
                                  <span>{t('dashboard.watchlist.alertBadge')}</span>
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-slate-600">{item.emplacement}</td>
                            <td className="py-2.5 px-3 text-center">
                              {canCreateMovement || (!isReadOnlyUser && canAccessSortieTab && onQuickSortie) ? (
                                <div className="flex items-center justify-center gap-1.5">
                                  {canCreateMovement && (
                                    <Action3DButton
                                      icon={ShoppingCart}
                                      showAddBadge={true}
                                      variant="circle"
                                      color="amber"
                                      title="Commander réapprovisionnement"
                                      onClick={() => handleOpenOrderForArticle(item)}
                                    />
                                  )}
                                  {!isReadOnlyUser && canAccessSortieTab && onQuickSortie && (
                                    <button
                                      onClick={() => onQuickSortie(item)}
                                      className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-black text-white text-[11px] font-bold shadow-2xs transition cursor-pointer active:scale-95"
                                      title="Faire une sortie"
                                    >
                                      {t('dashboard.watchlist.issueBtn')}
                                    </button>
                                  )}
                                </div>
                              ) : (
                                <span className="text-[10px] font-mono text-slate-400">{t('dashboard.watchlist.readOnlyLabel')}</span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Live Flux Feed */}
            <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs flex flex-col justify-between space-y-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-slate-100 border border-slate-200/80 flex items-center justify-center shrink-0">
                      <SortieEntreeIcon className="w-4 h-4 text-slate-800" strokeWidth={2.25} />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-sm text-slate-900 tracking-tight">{t('dashboard.watchlist.recentMovementsTitle')}</h3>
                      <p className="text-[11px] text-slate-500">{t('dashboard.watchlist.recentMovementsSubtitle')}</p>
                    </div>
                  </div>
                  {!isReadOnlyUser && canAccessSortieTab && onNavigateToSortie && (
                    <button
                      onClick={onNavigateToSortie}
                      className="text-xs font-bold text-blue-600 hover:text-blue-800 inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{t('dashboard.watchlist.issueBtn')}</span>
                    </button>
                  )}
                </div>

                {mouvements.length > 0 ? (
                  <div className="space-y-2">
                    {mouvements.slice(0, 6).map((m, idx) => {
                      const art = stockItems.find(
                        (s) => String(s.ref).toLowerCase() === String(m.ref).toLowerCase()
                      );
                      const isSortie = String(m.type || '').toLowerCase().includes('sort');

                      return (
                        <div
                          key={`feed-mvt-${m.id ?? ''}-${m.code_bon ?? ''}-${idx}`}
                          className="p-2.5 rounded-xl bg-slate-50/90 border border-slate-200/80 flex items-center justify-between text-xs hover:border-slate-300 transition"
                        >
                          <div className="space-y-0.5 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`text-[10px] font-bold px-2 py-0.2 rounded-full font-mono ${
                                  isSortie
                                    ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                    : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                }`}
                              >
                                {m.type}
                              </span>
                              <span className="font-mono font-bold text-slate-900">{m.ref}</span>
                            </div>
                            <div className="text-[11px] text-slate-600 truncate max-w-[180px] font-medium">
                              {art ? art.designation : m.designation || 'Article'}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              {m.code_bon || 'Bon'} • {m.date} • {m.technicien || 'Tech'}
                            </div>
                          </div>
                          <div className="text-right font-mono font-black text-sm shrink-0">
                            {isSortie ? (
                              <span className="text-rose-600">-{m.quantite}</span>
                            ) : (
                              <span className="text-emerald-600">+{m.quantite}</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-xs text-slate-400 text-center py-8 bg-slate-50/60 rounded-xl border border-slate-100">
                    {t('dashboard.watchlist.noRecentMovements')}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 5. Side-by-Side Logistics Hub: Commandes & Réappro (Left) + Réparations Externes (Right) — Hidden for OPERATEUR (DB-11) */}
          {!isOperatorRole && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-stretch">
            {/* Left Column: Suivi des Commandes & Réapprovisionnements */}
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-5 space-y-4 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="border-b border-slate-100 pb-3.5 space-y-3">
                  <div className="flex items-start sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-200/80 flex items-center justify-center shrink-0">
                        <ShoppingCart className="w-4 h-4 text-amber-600" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h2 className="font-extrabold text-sm text-slate-900 tracking-tight">
                            {t('dashboard.logistics.ordersTitle')}
                          </h2>
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-extrabold bg-amber-100/90 text-amber-950 border border-amber-200/80">
                            {pendingOrders.length} {t('dashboard.logistics.pendingBadge')}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {canEditMovement ? (
                            <>
                              Cliquez sur <b className="text-emerald-700">&quot;{t('dashboard.logistics.validateReceiptBtn')}&quot;</b>
                            </>
                          ) : (
                            t('dashboard.logistics.ordersReadOnlyHint')
                          )}
                        </p>
                      </div>
                    </div>

                    {canCreateMovement && (
                      <Action3DButton
                        icon={ShoppingCart}
                        showAddBadge={true}
                        variant="circle"
                        color="amber"
                        title={t('dashboard.logistics.createPurchaseOrderBtn')}
                        onClick={handleOpenNewOrder}
                      />
                    )}
                  </div>

                  {/* Filter Tabs Bar */}
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="inline-flex p-0.5 bg-slate-100/90 rounded-xl border border-slate-200/80 text-[11px] font-medium">
                      <button
                        onClick={() => setOrderFilterTab('ALL')}
                        className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                          orderFilterTab === 'ALL'
                            ? 'bg-white text-slate-900 font-bold shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {t('dashboard.logistics.tabAll')} ({allOrders.length})
                      </button>
                      <button
                        onClick={() => setOrderFilterTab('PENDING')}
                        className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                          orderFilterTab === 'PENDING'
                            ? 'bg-white text-amber-900 font-bold shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {t('dashboard.logistics.tabPending')} ({pendingOrders.length})
                      </button>
                      <button
                        onClick={() => setOrderFilterTab('RECEIVED')}
                        className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                          orderFilterTab === 'RECEIVED'
                            ? 'bg-white text-emerald-900 font-bold shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {t('dashboard.logistics.tabReceived')} ({completedOrders.length})
                      </button>
                    </div>

                    <div className="text-[10.5px] text-slate-400 font-mono">
                      {displayedOrders.length} {t('dashboard.logistics.ordersCountUnit')}
                    </div>
                  </div>
                </div>

                {/* Order Cards Grid */}
                {displayedOrders.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[380px] overflow-y-auto pr-1">
                    {displayedOrders.map((cmd, idx) => {
                      const art = stockItems.find(
                        (s) => String(s.ref).toLowerCase() === String(cmd.ref).toLowerCase()
                      );
                      const isReceived =
                        Array.isArray(cmd.tags) && cmd.tags.includes('#RECEPTION_VALIDE');

                      return (
                        <div
                          key={`dash-cmd-${cmd.id ?? ''}-${cmd.ref ?? ''}-${idx}`}
                          className={`p-3.5 rounded-xl border transition-all relative flex flex-col justify-between space-y-2.5 ${
                            isReceived
                              ? 'bg-emerald-50/30 border-emerald-200/90'
                              : 'bg-slate-50/60 border-slate-200/90 hover:border-amber-300'
                          }`}
                        >
                          <div className="space-y-2">
                            <div className="flex items-center justify-between gap-1.5">
                              <div className="flex items-center gap-1 flex-wrap">
                                <span className="font-mono font-extrabold text-[11px] text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                                  {cmd.ref}
                                </span>
                                <span className="text-[10px] font-bold text-amber-950 bg-amber-100/90 px-2 py-0.5 rounded-full border border-amber-200 font-mono">
                                  {cmd.code_bon || 'CMD'}
                                </span>
                              </div>

                              {isReceived ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-200">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                  <span>{t('dashboard.logistics.receivedBadge')}</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-950 border border-amber-200/80">
                                  <Clock className="w-3 h-3 text-amber-600" />
                                  <span>{t('dashboard.logistics.waitingBadge')}</span>
                                </span>
                              )}
                            </div>

                            <div>
                              <div className="font-bold text-xs text-slate-900 line-clamp-1">
                                {art ? art.designation : cmd.designation || 'Article commandé'}
                              </div>
                              <div className="text-[11px] text-slate-500 font-mono mt-0.5 flex items-center justify-between">
                                <span>
                                  Qté : <b className="text-slate-900 font-black">{cmd.quantite} pcs</b>
                                </span>
                                <span>{cmd.date}</span>
                              </div>
                            </div>

                            {(cmd.technicien || cmd.fournisseur || cmd.id_zone) && (
                              <div className="text-[10px] text-slate-600 bg-white p-2 rounded-lg border border-slate-200/80 font-mono space-y-0.5">
                                {cmd.fournisseur && (
                                  <div className="flex items-center justify-between truncate">
                                    <span className="text-slate-400">Fourn.:</span>
                                    <b className="text-slate-800 truncate ml-1">{cmd.fournisseur}</b>
                                  </div>
                                )}
                                {cmd.technicien && (
                                  <div className="flex items-center justify-between truncate">
                                    <span className="text-slate-400">Dem.:</span>
                                    <b className="text-slate-800 truncate ml-1">{cmd.technicien}</b>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          <div className="pt-2 border-t border-slate-200/60 flex items-center gap-1.5">
                            {!isReceived ? (
                              canEditMovement ? (
                                <button
                                  onClick={() => handleValidateReception(cmd)}
                                  className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] rounded-lg shadow-2xs transition flex items-center justify-center gap-1 cursor-pointer"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                  <span>{t('dashboard.logistics.validateReceiptBtn')}</span>
                                </button>
                              ) : (
                                <div className="flex-1 py-1.5 text-center text-amber-900 font-bold text-[11px] bg-amber-50 border border-amber-200/80 rounded-lg">
                                  {t('dashboard.logistics.awaitingReceipt')}
                                </div>
                              )
                            ) : (
                              <div className="flex-1 py-1.5 text-center text-emerald-900 font-bold text-[11px] bg-emerald-100/70 border border-emerald-200/80 rounded-lg">
                                {t('dashboard.logistics.entryRecorded')}
                              </div>
                            )}

                            {canDeleteMovement && onDeleteMouvement && (
                              <button
                                onClick={() => onDeleteMouvement(cmd.id)}
                                className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-rose-50 hover:text-rose-600 text-slate-400 transition cursor-pointer"
                                title="Supprimer la commande"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="bg-slate-50/70 border border-slate-200/80 rounded-xl p-6 text-center space-y-2 min-h-[190px] flex flex-col items-center justify-center">
                    <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 mx-auto flex items-center justify-center">
                      <ShoppingCart className="w-4 h-4" />
                    </div>
                    <h4 className="text-xs font-bold text-slate-800">{t('dashboard.logistics.noOrdersTitle')}</h4>
                    <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                      {t('dashboard.logistics.noOrdersSubtitle')}
                    </p>
                    {canCreateMovement && (
                      <button
                        onClick={handleOpenNewOrder}
                        className="mt-1 px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-2xs transition inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>{t('dashboard.logistics.createPurchaseOrderBtn')}</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Matériels en Réparation Externe (Bons de Sortie) */}
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-5 space-y-4 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-3.5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-purple-50 border border-purple-200/80 flex items-center justify-center shrink-0">
                      <Truck className="w-4 h-4 text-purple-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="font-extrabold text-sm text-slate-900 tracking-tight">
                          {t('dashboard.logistics.externalRepairsTitle')}
                        </h2>
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-extrabold bg-purple-100/90 text-purple-950 border border-purple-200/80">
                          {pendingExternalRepairs.length} {t('dashboard.tech.inProgress')}
                        </span>
                        {overdueRepairs.length > 0 && (
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-extrabold bg-rose-100 text-rose-900 border border-rose-300 flex items-center gap-1 animate-pulse">
                            <AlertTriangle className="w-3 h-3 text-rose-600" />
                            <span>{overdueRepairs.length} {t('dashboard.tech.overdue')}</span>
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {t('dashboard.logistics.externalRepairsSubtitle')}
                      </p>
                    </div>
                  </div>

                  {!isReadOnlyUser && canAccessSortieTab && onNavigateToSortie && (
                    <Action3DButton
                      icon={Truck}
                      showAddBadge={true}
                      variant="circle"
                      color="purple"
                      title="Nouveau Bon de Sortie"
                      onClick={onNavigateToSortie}
                    />
                  )}
                </div>

                {/* List of External Repairs */}
                {pendingExternalRepairs.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[380px] overflow-y-auto pr-1">
                    {pendingExternalRepairs.map((rep, idx) => {
                      const isLate = rep.date_retour_prevue && rep.date_retour_prevue < todayStr;
                      return (
                        <div
                          key={`dash-rep-${rep.id ?? ''}-${idx}`}
                          className={`p-3.5 rounded-xl border transition-all relative flex flex-col justify-between space-y-2.5 ${
                            isLate
                              ? 'bg-rose-50/40 border-rose-300/90'
                              : 'bg-slate-50/60 border-slate-200/90 hover:border-purple-300'
                          }`}
                        >
                          <div className="space-y-2">
                            <div className="flex items-center justify-between gap-1.5">
                              <div className="flex items-center gap-1">
                                <span className="font-mono font-extrabold text-[11px] text-purple-950 bg-purple-100/90 px-2 py-0.5 rounded border border-purple-200">
                                  {rep.code_bon || 'BS-EXT'}
                                </span>
                                <span className="text-[10px] font-bold text-slate-700 bg-white px-2 py-0.5 rounded-full border border-slate-200 font-mono">
                                  {rep.ref}
                                </span>
                              </div>
                              {isLate ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-900 border border-rose-300">
                                  <AlertTriangle className="w-3 h-3 text-rose-600" />
                                  <span>{t('dashboard.logistics.overdueBadge')}</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-900 border border-purple-200/80">
                                  <Clock className="w-3 h-3 text-purple-600" />
                                  <span>{t('dashboard.logistics.externalBadge')}</span>
                                </span>
                              )}
                            </div>

                            <div>
                              <div className="font-bold text-xs text-slate-900 line-clamp-1">
                                {rep.designation || 'Pièce en réparation'}
                              </div>
                              <div className="text-[11px] text-slate-500 font-mono mt-0.5 flex items-center justify-between">
                                <span>Qté : <b className="text-slate-900 font-black">{rep.quantite} pcs</b></span>
                                <span className={isLate ? 'text-rose-700 font-bold font-mono' : 'text-purple-950 font-semibold'}>
                                  {t('dashboard.logistics.returnLabel')} : {rep.date_retour_prevue || t('dashboard.logistics.notSet')}
                                </span>
                              </div>
                            </div>

                            {(rep.prestataire_externe || rep.id_machine_registered) && (
                              <div className="text-[10px] text-slate-600 bg-white p-2 rounded-lg border border-slate-200/80 font-mono space-y-0.5">
                                {rep.prestataire_externe && (
                                  <div className="flex items-center justify-between truncate">
                                    <span className="text-slate-400">Prest.:</span>
                                    <b className="text-purple-950 truncate ml-1">{rep.prestataire_externe}</b>
                                  </div>
                                )}
                                {rep.id_machine_registered && (
                                  <div className="flex items-center justify-between truncate">
                                    <span className="text-slate-400">Machine:</span>
                                    <b className="text-slate-800 truncate ml-1">{rep.id_machine_registered}</b>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          {!isReadOnlyUser && canAccessSortieTab && onNavigateToSortie && (
                            <div className="pt-2 border-t border-slate-200/60">
                              <button
                                onClick={onNavigateToSortie}
                                className="w-full py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-bold text-[11px] rounded-lg shadow-2xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                              >
                                <Inbox className="w-3.5 h-3.5" />
                                <span>{t('dashboard.logistics.receiveReturnBtn')}</span>
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="bg-slate-50/70 border border-slate-200/80 rounded-xl p-6 text-center space-y-2 min-h-[190px] flex flex-col items-center justify-center">
                    <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-500" />
                    <div className="text-xs font-bold text-slate-800">{t('dashboard.logistics.noExternalRepairsTitle')}</div>
                    <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                      {t('dashboard.logistics.noExternalRepairsSubtitle')}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
          )}

          {/* 6. GMAO Flux Intelligence & Action Distribution (3-Column Grid) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-stretch">
            {/* Actions & Interventions Breakdown */}
            <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-200/80 flex items-center justify-center shrink-0">
                    <Activity className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm text-slate-900 tracking-tight">
                      Répartition des Interventions
                    </h3>
                    <p className="text-[11px] text-slate-500">Par type d&apos;action GMAO</p>
                  </div>
                </div>
                <span className="text-xs font-mono font-bold text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200/60">
                  {mouvements.length} mvts
                </span>
              </div>

              <div className="space-y-3 text-xs">
                {/* Corrective */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between font-medium">
                    <span className="text-rose-700 font-bold flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-rose-500" />
                      Corrective (Dépannage)
                    </span>
                    <span className="font-mono font-bold text-slate-800">
                      {actionStats.counts.CORRECTIVE} (
                      {Math.round((actionStats.counts.CORRECTIVE / actionStats.totalActions) * 100)}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-rose-500 h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.round(
                          (actionStats.counts.CORRECTIVE / actionStats.totalActions) * 100
                        )}%`,
                      }}
                    />
                  </div>
                </div>

                {/* Preventive */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between font-medium">
                    <span className="text-blue-700 font-bold flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-blue-500" />
                      Préventive (Systématique)
                    </span>
                    <span className="font-mono font-bold text-slate-800">
                      {actionStats.counts.PREVENTIVE} (
                      {Math.round((actionStats.counts.PREVENTIVE / actionStats.totalActions) * 100)}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-blue-500 h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.round(
                          (actionStats.counts.PREVENTIVE / actionStats.totalActions) * 100
                        )}%`,
                      }}
                    />
                  </div>
                </div>

                {/* Usage Direct */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between font-medium">
                    <span className="text-purple-700 font-bold flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-purple-500" />
                      Usage Direct / Consommables
                    </span>
                    <span className="font-mono font-bold text-slate-800">
                      {actionStats.counts.USAGE} (
                      {Math.round((actionStats.counts.USAGE / actionStats.totalActions) * 100)}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-purple-500 h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.round(
                          (actionStats.counts.USAGE / actionStats.totalActions) * 100
                        )}%`,
                      }}
                    />
                  </div>
                </div>

                {/* Ameliorative */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between font-medium">
                    <span className="text-amber-700 font-bold flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-500" />
                      Améliorative / Travaux Neufs
                    </span>
                    <span className="font-mono font-bold text-slate-800">
                      {actionStats.counts.AMELIORATIVE} (
                      {Math.round((actionStats.counts.AMELIORATIVE / actionStats.totalActions) * 100)}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-amber-500 h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.round(
                          (actionStats.counts.AMELIORATIVE / actionStats.totalActions) * 100
                        )}%`,
                      }}
                    />
                  </div>
                </div>

                {/* Reapprovisionnements & Entrees */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between font-medium">
                    <span className="text-emerald-700 font-bold flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      Réapprovisionnement Magasin
                    </span>
                    <span className="font-mono font-bold text-slate-800">
                      {actionStats.counts.REAPPRO} (
                      {Math.round((actionStats.counts.REAPPRO / actionStats.totalActions) * 100)}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.round(
                          (actionStats.counts.REAPPRO / actionStats.totalActions) * 100
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Top 5 Most Consumed Articles */}
            <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-200/80 flex items-center justify-center shrink-0">
                    <TrendingDown className="w-4 h-4 text-amber-600" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm text-slate-900 tracking-tight">
                      Top 5 Pièces Consommées
                    </h3>
                    <p className="text-[11px] text-slate-500">Volume total de sorties</p>
                  </div>
                </div>
                {canAccessStockTab && onNavigateToStock && (
                  <button
                    onClick={onNavigateToStock}
                    className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-0.5 cursor-pointer"
                  >
                    <span>Stock</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="space-y-2">
                {topConsumedArticles.length > 0 ? (
                  topConsumedArticles.map((art, idx) => {
                    const rankStyles = [
                      'bg-amber-100 text-amber-900 border border-amber-300 font-extrabold shadow-2xs',
                      'bg-slate-200 text-slate-800 border border-slate-300 font-bold',
                      'bg-orange-100 text-orange-900 border border-orange-200 font-bold',
                      'bg-slate-100 text-slate-600 border border-slate-200 font-medium',
                      'bg-slate-100 text-slate-600 border border-slate-200 font-medium',
                    ];

                    return (
                      <div
                        key={`top-art-${art.ref ?? ''}-${idx}`}
                        className="p-2.5 rounded-xl bg-slate-50/90 border border-slate-200/70 hover:border-slate-300 flex items-center justify-between text-xs transition-colors"
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5">
                            <span className={`w-5 h-5 rounded-full text-[10px] flex items-center justify-center font-mono ${rankStyles[idx] || rankStyles[4]}`}>
                              {idx + 1}
                            </span>
                            <span className="font-mono font-bold text-slate-900">{art.ref}</span>
                          </div>
                          <div className="text-[11px] text-slate-500 truncate max-w-[180px]">
                            {art.designation}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-mono font-black text-rose-600 text-sm">
                            -{art.qty} pcs
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            Reste : {art.stockActuel}
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-xs text-slate-400 text-center py-6">
                    Aucune sortie enregistrée pour le moment.
                  </div>
                )}
              </div>
            </div>

            {/* Top Demanding Machines */}
            <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-purple-50 border border-purple-200/80 flex items-center justify-center shrink-0">
                    <Factory className="w-4 h-4 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm text-slate-900 tracking-tight">
                      Machines les Plus Sollicitées
                    </h3>
                    <p className="text-[11px] text-slate-500">Nombre d&apos;interventions / dépannages</p>
                  </div>
                </div>
                {canAccessMachinesTab && onNavigateToMachines && (
                  <button
                    onClick={onNavigateToMachines}
                    className="text-xs font-bold text-purple-600 hover:text-purple-800 flex items-center gap-0.5 cursor-pointer"
                  >
                    <span>Parc</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="space-y-2">
                {machineHealth.topMachines.length > 0 ? (
                  machineHealth.topMachines.map((mch, idx) => (
                    <div
                      key={`top-mch-${mch.id ?? ''}-${idx}`}
                      className="p-2.5 rounded-xl bg-slate-50/90 border border-slate-200/70 hover:border-slate-300 flex items-center justify-between text-xs transition-colors"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200 text-[11px] shadow-2xs">
                            {mch.id}
                          </span>
                          <span className="text-[11px] font-bold text-slate-700 truncate max-w-[140px]">
                            {mch.designation}
                          </span>
                        </div>
                        <div className="text-[10.5px] text-slate-400 font-mono">
                          Zone : {mch.zone}
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-900 font-mono font-bold text-xs border border-purple-200/80 shadow-2xs">
                          {mch.count} interventions
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-xs text-slate-400 text-center py-6">
                    Aucune machine associée aux sorties.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Technician Accès Rapide Hub (for Technician shift scope) */}
      {isTechUser && (
        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-2xs space-y-3">
          <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2 tracking-tight">
            <Zap className="w-4 h-4 text-amber-500" />
            <span>Accès Rapide aux Modules GMAO</span>
          </h3>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {canAccessPreventiveTab && onNavigateToPreventive && (
              <button
                onClick={onNavigateToPreventive}
                className="p-3.5 rounded-xl bg-slate-50/90 hover:bg-indigo-50/80 border border-slate-200/80 hover:border-indigo-300 text-left shadow-2xs hover:shadow-xs hover:-translate-y-0.5 transition-all duration-200 space-y-1.5 cursor-pointer group"
              >
                <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Calendar className="w-5 h-5" />
                </div>
                <div className="font-bold text-xs text-slate-900 group-hover:text-indigo-700 transition-colors">Maintenance Préventive</div>
                <div className="text-[10px] text-slate-500">Mes tâches & planning</div>
              </button>
            )}

            {canAccessCorrectiveTab && onNavigateToCorrective && (
              <button
                onClick={() => onNavigateToCorrective('corrective')}
                className="p-3.5 rounded-xl bg-slate-50/90 hover:bg-amber-50/80 border border-slate-200/80 hover:border-amber-300 text-left shadow-2xs hover:shadow-xs hover:-translate-y-0.5 transition-all duration-200 space-y-1.5 cursor-pointer group"
              >
                <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Wrench className="w-5 h-5" />
                </div>
                <div className="font-bold text-xs text-slate-900 group-hover:text-amber-700 transition-colors">Maintenance Corrective</div>
                <div className="text-[10px] text-slate-500">DI, BT & Chrono Live</div>
              </button>
            )}

            {canAccessStockTab && (
              <button
                onClick={onNavigateToStock}
                className="p-3.5 rounded-xl bg-slate-50/90 hover:bg-blue-50/80 border border-slate-200/80 hover:border-blue-300 text-left shadow-2xs hover:shadow-xs hover:-translate-y-0.5 transition-all duration-200 space-y-1.5 cursor-pointer group"
              >
                <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Package className="w-5 h-5" />
                </div>
                <div className="font-bold text-xs text-slate-900 group-hover:text-blue-700 transition-colors">Magasin Stock</div>
                <div className="text-[10px] text-slate-500">Consulter les PDR</div>
              </button>
            )}

            {canAccessSortieTab && (
              <button
                onClick={onNavigateToSortie}
                className="p-3.5 rounded-xl bg-slate-50/90 hover:bg-emerald-50/80 border border-slate-200/80 hover:border-emerald-300 text-left shadow-2xs hover:shadow-xs hover:-translate-y-0.5 transition-all duration-200 space-y-1.5 cursor-pointer group"
              >
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <SortieEntreeIcon className="w-5 h-5" />
                </div>
                <div className="font-bold text-xs text-slate-900 group-hover:text-emerald-700 transition-colors">Sorties & Entrées</div>
                <div className="text-[10px] text-slate-500">Enregistrer un bon</div>
              </button>
            )}

            {canAccessMachinesTab && (
              <button
                onClick={onNavigateToMachines}
                className="p-3.5 rounded-xl bg-slate-50/90 hover:bg-purple-50/80 border border-slate-200/80 hover:border-purple-300 text-left shadow-2xs hover:shadow-xs hover:-translate-y-0.5 transition-all duration-200 space-y-1.5 cursor-pointer group"
              >
                <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Factory className="w-5 h-5" />
                </div>
                <div className="font-bold text-xs text-slate-900 group-hover:text-purple-700 transition-colors">Parc Machines</div>
                <div className="text-[10px] text-slate-500">Arborescence actifs</div>
              </button>
            )}

            {canAccessGuideTab && onNavigateToGuide && (
              <button
                onClick={onNavigateToGuide}
                className="p-3.5 rounded-xl bg-slate-50/90 hover:bg-teal-50/80 border border-slate-200/80 hover:border-teal-300 text-left shadow-2xs hover:shadow-xs hover:-translate-y-0.5 transition-all duration-200 space-y-1.5 cursor-pointer group"
              >
                <div className="w-9 h-9 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div className="font-bold text-xs text-slate-900 group-hover:text-teal-700 transition-colors">Guide Terrain</div>
                <div className="text-[10px] text-slate-500">Manuel & Procédures</div>
              </button>
            )}
          </div>
        </div>
      )}

      {/* 8. Purchase Order Modal (BDR Light Excel Unified Modal System) */}
      {showOrderModal && canCreateMovement && (
        <div
          onClick={() => setShowOrderModal(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/45 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col"
          >
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center font-bold">
                  <ShoppingCart className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-slate-900">
                    {selectedArticleForOrder
                      ? `Commander Réappro : ${selectedArticleForOrder.ref}`
                      : "Créer une Commande d'Achat"}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Enregistre une commande en attente dans le flux de traçabilité
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowOrderModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Form Body */}
            <form onSubmit={handleSubmitOrder} className="p-6 space-y-4 text-xs">
              {/* Type / Nature d'achat Toggle */}
              <div className="space-y-1.5 p-3 rounded-2xl bg-slate-50 border border-slate-200">
                <label className="font-bold text-slate-800 block text-xs">
                  Type & Nature de la Commande *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setOrderForm({ ...orderForm, order_nature: 'STOCK_PERMANENT' })
                    }
                    className={`p-2.5 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                      orderForm.order_nature === 'STOCK_PERMANENT'
                        ? 'bg-blue-50/90 border-blue-400 text-blue-900 ring-2 ring-blue-500/20'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs">📦 Pièce Stock Permanente</span>
                      {orderForm.order_nature === 'STOCK_PERMANENT' && (
                        <Check className="w-3.5 h-3.5 text-blue-600" />
                      )}
                    </div>
                    <span className="text-[10px] text-slate-500 mt-1">
                      Consommable suivi avec seuils et alertes RUPTURE
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setOrderForm({ ...orderForm, order_nature: 'ACHAT_UNIQUE' })
                    }
                    className={`p-2.5 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                      orderForm.order_nature === 'ACHAT_UNIQUE'
                        ? 'bg-purple-50/90 border-purple-400 text-purple-900 ring-2 ring-purple-500/20'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs">⚡ Achat Unique / Spécifique</span>
                      {orderForm.order_nature === 'ACHAT_UNIQUE' && (
                        <Check className="w-3.5 h-3.5 text-purple-600" />
                      )}
                    </div>
                    <span className="text-[10px] text-slate-500 mt-1">
                      Non-stockable récurrent (#Achat_Unique, sans fausses alertes)
                    </span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Code / N° de Commande *</label>
                  <input
                    type="text"
                    required
                    value={orderForm.code_bon}
                    onChange={(e) => setOrderForm({ ...orderForm, code_bon: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs focus:bg-white focus:border-amber-500 outline-none"
                    placeholder="CMD-2026-001"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Quantité Demandée *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={orderForm.quantite}
                    onChange={(e) => setOrderForm({ ...orderForm, quantite: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs font-bold text-slate-900 focus:bg-white focus:border-amber-500 outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Référence de l'Article *</label>
                <input
                  type="text"
                  required
                  value={orderForm.ref}
                  onChange={(e) => {
                    const r = e.target.value;
                    const matched = stockItems.find(
                      (s) => String(s.ref).toLowerCase() === r.toLowerCase()
                    );
                    setOrderForm({
                      ...orderForm,
                      ref: r,
                      designation: matched ? matched.designation : orderForm.designation,
                    });
                  }}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs focus:bg-white focus:border-amber-500 outline-none"
                  placeholder="Ex: ROUL-6204-2RS"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Désignation / Spécifications</label>
                <input
                  type="text"
                  value={orderForm.designation}
                  onChange={(e) => setOrderForm({ ...orderForm, designation: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:border-amber-500 outline-none"
                  placeholder="Description détaillée de la pièce"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Fournisseur Prévu</label>
                  <input
                    type="text"
                    value={orderForm.fournisseur}
                    onChange={(e) => setOrderForm({ ...orderForm, fournisseur: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:border-amber-500 outline-none"
                    placeholder="Ex: SKF Maroc, Distributeur"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Demandeur / Responsable</label>
                  <select
                    value={orderForm.technicien}
                    onChange={(e) => setOrderForm({ ...orderForm, technicien: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:border-amber-500 outline-none"
                  >
                    <option value="">Sélectionner un responsable...</option>
                    {activeTechnicians.map((t) => (
                      <option key={t.id_technician || t.nom} value={t.nom}>
                        {t.nom} ({t.specialite || 'Tech'})
                      </option>
                    ))}
                    {activeOperationsChefs.map((c) => (
                      <option key={c.id_operation || c.nom} value={c.nom}>
                        {c.nom} (Chef)
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Notes & Justification</label>
                <textarea
                  rows="2"
                  value={orderForm.commentaire}
                  onChange={(e) => setOrderForm({ ...orderForm, commentaire: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:border-amber-500 outline-none"
                  placeholder="Justification de la commande..."
                />
              </div>

              {/* Modal Actions */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowOrderModal(false)}
                  className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 font-bold hover:bg-slate-50 transition cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold shadow-xs transition flex items-center gap-1.5 cursor-pointer active:scale-98"
                >
                  <Check className="w-4 h-4" />
                  <span>Confirmer la Commande</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EXCEL FORMULAS MODAL (DASHBOARD TWIN) */}
      {showFormulasModal && (
        <div
          onClick={() => setShowFormulasModal(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-3xl w-full p-5 space-y-4 animate-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700 shrink-0 shadow-2xs">
                  <Calculator className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
                    <span>Formules Excel Miroir — CIOB GMAO Twin</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold">
                      Excel Twin
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    Modèle mathématique et formules réelles de calcul issues de <code className="font-mono text-slate-700 font-bold">GMAO_Light_Template_V2_Formules.xlsx</code>
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

            {/* Navigation Tabs */}
            <div className="flex items-center gap-1.5 p-1 bg-slate-100/90 rounded-xl shrink-0 border border-slate-200/70">
              <button
                type="button"
                onClick={() => setFormulaTab('stock')}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  formulaTab === 'stock'
                    ? 'bg-white text-blue-700 shadow-xs border border-slate-200/80'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Package className="w-3.5 h-3.5" />
                <span>1. Stock & Flux (Mouvements)</span>
              </button>

              <button
                type="button"
                onClick={() => setFormulaTab('kpis')}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  formulaTab === 'kpis'
                    ? 'bg-white text-emerald-700 shadow-xs border border-slate-200/80'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Activity className="w-3.5 h-3.5" />
                <span>2. Indicateurs & KPIs (Pilotage)</span>
              </button>

              <button
                type="button"
                onClick={() => setFormulaTab('autoid')}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  formulaTab === 'autoid'
                    ? 'bg-white text-purple-700 shadow-xs border border-slate-200/80'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Zap className="w-3.5 h-3.5" />
                <span>3. Auto-ID & Séquences</span>
              </button>
            </div>

            {/* Modal Content - Scrollable container */}
            <div className="overflow-y-auto space-y-3 pr-1 flex-1">
              {/* TAB 1: STOCK & FLUX */}
              {formulaTab === 'stock' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Formule 1: Entrées Cumulées */}
                  <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/90 flex flex-col justify-between gap-2 hover:border-blue-300 transition">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 truncate">
                        <TrendingUp className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                        <span className="truncate">Total Entrées (Col. F)</span>
                      </div>
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-blue-100/80 text-blue-800 border border-blue-200 shrink-0">
                        Feuille Stock_Actuel!F
                      </span>
                    </div>
                    <div className="space-y-1">
                      <div className="font-mono text-xs text-blue-800 font-bold bg-white p-2 rounded-lg border border-blue-100 break-all select-all">
                        =SUMIFS(Mouvements!D:D, Mouvements!C:C, [@Ref], Mouvements!E:E, "Entrée")
                      </div>
                      <div className="text-[10px] font-mono text-slate-500 italic pl-1">
                        FR: =SOMME.SI.ENS(Mouvements!D:D; Mouvements!C:C; [@Ref]; Mouvements!E:E; "Entrée")
                      </div>
                    </div>
                    <p className="text-[10.5px] text-slate-500 leading-tight">
                      Agrégation conditionnelle multi-critères des réceptions fournisseurs et retours d'atelier pour la référence active.
                    </p>
                  </div>

                  {/* Formule 2: Sorties Cumulées */}
                  <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/90 flex flex-col justify-between gap-2 hover:border-rose-300 transition">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 truncate">
                        <TrendingDown className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                        <span className="truncate">Total Sorties (Col. G)</span>
                      </div>
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-rose-100/80 text-rose-800 border border-rose-200 shrink-0">
                        Feuille Stock_Actuel!G
                      </span>
                    </div>
                    <div className="space-y-1">
                      <div className="font-mono text-xs text-rose-800 font-bold bg-white p-2 rounded-lg border border-rose-100 break-all select-all">
                        =SUMIFS(Mouvements!D:D, Mouvements!C:C, [@Ref], Mouvements!E:E, "Sortie")
                      </div>
                      <div className="text-[10px] font-mono text-slate-500 italic pl-1">
                        FR: =SOMME.SI.ENS(Mouvements!D:D; Mouvements!C:C; [@Ref]; Mouvements!E:E; "Sortie")
                      </div>
                    </div>
                    <p className="text-[10.5px] text-slate-500 leading-tight">
                      Somme automatique de toutes les sorties (interventions curatives, préventives et consommations d'atelier).
                    </p>
                  </div>

                  {/* Formule 3: Équation Stock Actuel */}
                  <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/90 flex flex-col justify-between gap-2 hover:border-emerald-300 transition">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 truncate">
                        <Package className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span className="truncate">Stock Actuel (Col. H)</span>
                      </div>
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-100/80 text-emerald-800 border border-emerald-200 shrink-0">
                        Feuille Stock_Actuel!H
                      </span>
                    </div>
                    <div className="space-y-1">
                      <div className="font-mono text-xs text-emerald-800 font-bold bg-white p-2 rounded-lg border border-emerald-100 break-all select-all">
                        =[@[Stock Initial]] + [@[Entrées]] - [@[Sorties]]
                      </div>
                      <div className="text-[10px] font-mono text-slate-500 italic pl-1">
                        Cellules: =E2 + F2 - G2
                      </div>
                    </div>
                    <p className="text-[10.5px] text-slate-500 leading-tight">
                      Balance en temps réel calculée pour chaque article avec propagation instantanée des flux d'entrées et sorties.
                    </p>
                  </div>

                  {/* Formule 4: Seuil d'Alerte et Rupture */}
                  <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/90 flex flex-col justify-between gap-2 hover:border-amber-300 transition">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 truncate">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        <span className="truncate">Statut d'Alerte (Col. J)</span>
                      </div>
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-amber-100/80 text-amber-800 border border-amber-200 shrink-0">
                        Feuille Stock_Actuel!J
                      </span>
                    </div>
                    <div className="space-y-1">
                      <div className="font-mono text-xs text-amber-800 font-bold bg-white p-2 rounded-lg border border-amber-100 break-all select-all">
                        =IF([@[Stock Actuel]]&lt;=0, "RUPTURE", IF([@[Stock Actuel]]&lt;=[@[Seuil]], "ALERTE", "OK"))
                      </div>
                      <div className="text-[10px] font-mono text-slate-500 italic pl-1">
                        FR: =SI([@[Stock Actuel]]&lt;=0; "RUPTURE"; SI([@[Stock Actuel]]&lt;=[@[Seuil]]; "ALERTE"; "OK"))
                      </div>
                    </div>
                    <p className="text-[10.5px] text-slate-500 leading-tight">
                      Déclenchement automatique des seuils critiques et alimentation dynamique de la liste de réapprovisionnement.
                    </p>
                  </div>
                </div>
              )}

              {/* TAB 2: KPIS & PILOTAGE */}
              {formulaTab === 'kpis' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* KPI 1: Total Articles */}
                  <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/90 flex flex-col justify-between gap-2 hover:border-blue-300 transition">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 truncate">
                        <Package className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                        <span className="truncate">Total Articles au Catalogue</span>
                      </div>
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-blue-100/80 text-blue-800 border border-blue-200 shrink-0">
                        COUNTA
                      </span>
                    </div>
                    <div className="space-y-1">
                      <div className="font-mono text-xs text-blue-800 font-bold bg-white p-2 rounded-lg border border-blue-100 break-all select-all">
                        =COUNTA(Stock_Actuel!A2:A1000)
                      </div>
                      <div className="text-[10px] font-mono text-slate-500 italic pl-1">
                        FR: =NBVAL(Stock_Actuel!A2:A1000)
                      </div>
                    </div>
                    <p className="text-[10.5px] text-slate-500 leading-tight">
                      Nombre total de références de pièces de rechange enregistrées dans la nomenclature.
                    </p>
                  </div>

                  {/* KPI 2: Total Stock Physique */}
                  <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/90 flex flex-col justify-between gap-2 hover:border-emerald-300 transition">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 truncate">
                        <Layers className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span className="truncate">Stock Physique Global (Unités)</span>
                      </div>
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-100/80 text-emerald-800 border border-emerald-200 shrink-0">
                        SUM
                      </span>
                    </div>
                    <div className="space-y-1">
                      <div className="font-mono text-xs text-emerald-800 font-bold bg-white p-2 rounded-lg border border-emerald-100 break-all select-all">
                        =SUM(Stock_Actuel!H2:H1000)
                      </div>
                      <div className="text-[10px] font-mono text-slate-500 italic pl-1">
                        FR: =SOMME(Stock_Actuel!H2:H1000)
                      </div>
                    </div>
                    <p className="text-[10.5px] text-slate-500 leading-tight">
                      Somme cumulative de toutes les unités d'articles présentes physiquement dans le magasin.
                    </p>
                  </div>

                  {/* KPI 3: Articles en Rupture */}
                  <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/90 flex flex-col justify-between gap-2 hover:border-rose-300 transition">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 truncate">
                        <XCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                        <span className="truncate">Articles en Rupture Critique</span>
                      </div>
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-rose-100/80 text-rose-800 border border-rose-200 shrink-0">
                        COUNTIF
                      </span>
                    </div>
                    <div className="space-y-1">
                      <div className="font-mono text-xs text-rose-800 font-bold bg-white p-2 rounded-lg border border-rose-100 break-all select-all">
                        =COUNTIF(Stock_Actuel!J2:J1000, "RUPTURE")
                      </div>
                      <div className="text-[10px] font-mono text-slate-500 italic pl-1">
                        FR: =NB.SI(Stock_Actuel!J2:J1000; "RUPTURE")
                      </div>
                    </div>
                    <p className="text-[10.5px] text-slate-500 leading-tight">
                      Nombre d'articles dont le stock actuel est nul ou inférieur à 0 (rupture immédiate).
                    </p>
                  </div>

                  {/* KPI 4: Articles en Alerte */}
                  <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/90 flex flex-col justify-between gap-2 hover:border-amber-300 transition">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 truncate">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        <span className="truncate">Articles Sous Seuil d'Alerte</span>
                      </div>
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-amber-100/80 text-amber-800 border border-amber-200 shrink-0">
                        COUNTIF
                      </span>
                    </div>
                    <div className="space-y-1">
                      <div className="font-mono text-xs text-amber-800 font-bold bg-white p-2 rounded-lg border border-amber-100 break-all select-all">
                        =COUNTIF(Stock_Actuel!J2:J1000, "ALERTE")
                      </div>
                      <div className="text-[10px] font-mono text-slate-500 italic pl-1">
                        FR: =NB.SI(Stock_Actuel!J2:J1000; "ALERTE")
                      </div>
                    </div>
                    <p className="text-[10.5px] text-slate-500 leading-tight">
                      Nombre d'articles dont le stock disponible est inférieur ou égal au seuil de sécurité.
                    </p>
                  </div>

                  {/* KPI 5: Total Mouvements */}
                  <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/90 flex flex-col justify-between gap-2 hover:border-indigo-300 transition">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 truncate">
                        <Activity className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                        <span className="truncate">Volume Total des Mouvements</span>
                      </div>
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-indigo-100/80 text-indigo-800 border border-indigo-200 shrink-0">
                        COUNTA
                      </span>
                    </div>
                    <div className="space-y-1">
                      <div className="font-mono text-xs text-indigo-800 font-bold bg-white p-2 rounded-lg border border-indigo-100 break-all select-all">
                        =COUNTA(Mouvements!A2:A5000)
                      </div>
                      <div className="text-[10px] font-mono text-slate-500 italic pl-1">
                        FR: =NBVAL(Mouvements!A2:A5000)
                      </div>
                    </div>
                    <p className="text-[10.5px] text-slate-500 leading-tight">
                      Nombre total d'opérations d'entrées et de sorties tracées dans le registre historique.
                    </p>
                  </div>

                  {/* KPI 6: Machines Actives */}
                  <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/90 flex flex-col justify-between gap-2 hover:border-teal-300 transition">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 truncate">
                        <Factory className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                        <span className="truncate">Parc Machines Opérationnel</span>
                      </div>
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-teal-100/80 text-teal-800 border border-teal-200 shrink-0">
                        COUNTIF
                      </span>
                    </div>
                    <div className="space-y-1">
                      <div className="font-mono text-xs text-teal-800 font-bold bg-white p-2 rounded-lg border border-teal-100 break-all select-all">
                        =COUNTIF(Machines_Registered!G:G, "En service")
                      </div>
                      <div className="text-[10px] font-mono text-slate-500 italic pl-1">
                        FR: =NB.SI(Machines_Registered!G:G; "En service")
                      </div>
                    </div>
                    <p className="text-[10.5px] text-slate-500 leading-tight">
                      Nombre d'équipements industriels en état de fonctionnement continu.
                    </p>
                  </div>
                </div>
              )}

              {/* TAB 3: AUTO-ID & SEQUENCES */}
              {formulaTab === 'autoid' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Auto-ID 1: Code Bon */}
                  <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/90 flex flex-col justify-between gap-2 hover:border-purple-300 transition">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 truncate">
                        <Zap className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                        <span className="truncate">Code Bon de Commande / Sortie</span>
                      </div>
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-purple-100/80 text-purple-800 border border-purple-200 shrink-0">
                        Bon-001...
                      </span>
                    </div>
                    <div className="space-y-1">
                      <div className="font-mono text-xs text-purple-800 font-bold bg-white p-2 rounded-lg border border-purple-100 break-all select-all">
                        ="Bon-" &amp; TEXT(COUNTA(Mouvements!B:B)+1, "000")
                      </div>
                      <div className="text-[10px] font-mono text-slate-500 italic pl-1">
                        FR: ="Bon-" &amp; TEXTE(NBVAL(Mouvements!B:B)+1; "000")
                      </div>
                    </div>
                    <p className="text-[10.5px] text-slate-500 leading-tight">
                      Incrémentation automatique du numéro de bon de mouvement avec formatage sur 3 chiffres.
                    </p>
                  </div>

                  {/* Auto-ID 2: Code Technicien */}
                  <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/90 flex flex-col justify-between gap-2 hover:border-cyan-300 transition">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 truncate">
                        <UserCheck className="w-3.5 h-3.5 text-cyan-600 shrink-0" />
                        <span className="truncate">Code Technicien (TECH)</span>
                      </div>
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-cyan-100/80 text-cyan-800 border border-cyan-200 shrink-0">
                        TECH-01...
                      </span>
                    </div>
                    <div className="space-y-1">
                      <div className="font-mono text-xs text-cyan-800 font-bold bg-white p-2 rounded-lg border border-cyan-100 break-all select-all">
                        ="TECH-" &amp; TEXT(COUNTA(Technicians!A:A)+1, "00")
                      </div>
                      <div className="text-[10px] font-mono text-slate-500 italic pl-1">
                        FR: ="TECH-" &amp; TEXTE(NBVAL(Technicians!A:A)+1; "00")
                      </div>
                    </div>
                    <p className="text-[10.5px] text-slate-500 leading-tight">
                      Attribution séquentielle des identifiants des techniciens et agents de maintenance.
                    </p>
                  </div>

                  {/* Auto-ID 3: Code Opérateur */}
                  <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/90 flex flex-col justify-between gap-2 hover:border-blue-300 transition">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 truncate">
                        <Zap className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                        <span className="truncate">Code Opérateur (OP)</span>
                      </div>
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-blue-100/80 text-blue-800 border border-blue-200 shrink-0">
                        OP-01...
                      </span>
                    </div>
                    <div className="space-y-1">
                      <div className="font-mono text-xs text-blue-800 font-bold bg-white p-2 rounded-lg border border-blue-100 break-all select-all">
                        ="OP-" &amp; TEXT(COUNTIF(Operations!D:D, "OPERATEUR")+1, "00")
                      </div>
                      <div className="text-[10px] font-mono text-slate-500 italic pl-1">
                        FR: ="OP-" &amp; TEXTE(NB.SI(Operations!D:D; "OPERATEUR")+1; "00")
                      </div>
                    </div>
                    <p className="text-[10.5px] text-slate-500 leading-tight">
                      Génération automatique des codes d'opérateurs de production sur 2 chiffres.
                    </p>
                  </div>

                  {/* Auto-ID 4: Code Chef */}
                  <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/90 flex flex-col justify-between gap-2 hover:border-amber-300 transition">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 truncate">
                        <Zap className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        <span className="truncate">Code Chef d'Équipe (CHEF)</span>
                      </div>
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-amber-100/80 text-amber-800 border border-amber-200 shrink-0">
                        CHEF-01...
                      </span>
                    </div>
                    <div className="space-y-1">
                      <div className="font-mono text-xs text-amber-800 font-bold bg-white p-2 rounded-lg border border-amber-100 break-all select-all">
                        ="CHEF-" &amp; TEXT(COUNTIF(Operations!D:D, "CHEF")+1, "00")
                      </div>
                      <div className="text-[10px] font-mono text-slate-500 italic pl-1">
                        FR: ="CHEF-" &amp; TEXTE(NB.SI(Operations!D:D; "CHEF")+1; "00")
                      </div>
                    </div>
                    <p className="text-[10.5px] text-slate-500 leading-tight">
                      Génération automatique des codes de responsables et chefs de postes.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 shrink-0">
              <span className="flex items-center gap-1.5 font-mono text-[11px]">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>100% Conforme aux spécifications Excel GMAO Template V2</span>
              </span>
              <button
                type="button"
                onClick={() => setShowFormulasModal(false)}
                className="px-4 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition cursor-pointer shadow-xs"
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
