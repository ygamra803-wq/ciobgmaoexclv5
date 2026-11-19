import { useState, useMemo, useEffect, useCallback, type FormEvent } from 'react';
import { useSmartTableLoader } from '../../../hooks/useSmartTableLoader';
import { dataIntegrityService } from '../../../../services/dataIntegrityService';
import { useAuth } from '../../../../context/AuthContext';
import { AuthorizationService } from '../../../../core/security/AuthorizationService';
import { buildTechnicianDashboardScope } from '../../../../core/security/technicianScope';
import {
  buildAdminValidationRadar,
  selectValidationCenterQueues,
} from '../../../../core/security/validationReconciliation';
import { useGmaoStore } from '../../../../store/useGmaoStore';
import { serverSyncService } from '../../../../services/serverSyncService';
import { isArchivedMachine, getMachineLifecycleState } from '../../../../utils/activeMachines';
import { useTranslation } from '../../../../i18n/I18nContext';
import { ROLES, normalizeRole } from '../../../../core/security/Roles';
import type {
  DashboardOrderFormState,
  OrderStockArticleOption,
} from '../components/DashboardModals';

type AnyRecord = Record<string, any>;

export interface DashboardStockKPIs {
  totalArticles: number;
  totalStockActuel: number;
  totalEntrees: number;
  totalSorties: number;
  ruptures: number;
  alertes: number;
  ok: number;
}

export interface DashboardViewProps {
  stockItems?: AnyRecord[];
  machines?: AnyRecord[];
  warehouseItems?: AnyRecord[];
  mouvements?: AnyRecord[];
  types?: AnyRecord[];
  diagnostics?: AnyRecord[];
  zones?: AnyRecord[];
  technicians?: AnyRecord[];
  operations?: AnyRecord[];
  stockKPIs?: DashboardStockKPIs;
  preventiveTasks?: AnyRecord[];
  preventiveExecutions?: AnyRecord[];
  onNavigateToStock?: () => void;
  onNavigateToMachines?: () => void;
  onNavigateToWarehouse?: () => void;
  onNavigateToSortie?: () => void;
  onNavigateToPreventive?: () => void;
  onNavigateToCorrective?: (tab?: string) => void;
  onNavigateToZones?: () => void;
  onNavigateToUsers?: () => void;
  onNavigateToSettings?: (section?: string) => void;
  onNavigateToGuide?: () => void;
  onNavigateToValidationCenter?: () => void;
  correctiveInterventions?: AnyRecord[];
  correctiveKpis?: { mttrMinutes?: number } | null;
  onQuickSortie?: (item: AnyRecord) => void;
  onAddMouvement?: (mvt: AnyRecord) => void;
  onUpdateMouvement?: (id: string, patch: AnyRecord) => void;
  onDeleteMouvement?: (id: string) => void;
  onExportExcel?: () => void;
  showToast?: (message: string, type?: string) => void;
  currentUser?: AnyRecord | null;
}

const DEFAULT_STOCK_KPIS: DashboardStockKPIs = {
  totalArticles: 0,
  totalStockActuel: 0,
  totalEntrees: 0,
  totalSorties: 0,
  ruptures: 0,
  alertes: 0,
  ok: 0,
};

const EMPTY_LIST: AnyRecord[] = [];

export function useDashboardController({
  stockItems = EMPTY_LIST,
  machines = EMPTY_LIST,
  warehouseItems = EMPTY_LIST,
  mouvements = EMPTY_LIST,
  types = EMPTY_LIST,
  zones = EMPTY_LIST,
  technicians = EMPTY_LIST,
  operations = EMPTY_LIST,
  stockKPIs = DEFAULT_STOCK_KPIS,
  preventiveTasks = EMPTY_LIST,
  preventiveExecutions = EMPTY_LIST,
  correctiveInterventions = EMPTY_LIST,
  correctiveKpis = null,
  onAddMouvement,
  onUpdateMouvement,
  showToast,
  currentUser: currentUserProp = null,
}: DashboardViewProps) {
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

  // A2 — Lightweight Operational Sync Status & Conflict Alert
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

  const handleQuickLanMerge = useCallback(async () => {
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
  }, [canSyncLan, refreshSyncTrust, showToast]);

  const handleForcePushConflict = useCallback(async () => {
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
  }, [canSyncLan, refreshSyncTrust, showToast]);

  const handleForcePullConflict = useCallback(async () => {
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
  }, [canSyncLan, refreshSyncTrust, showToast]);

  // Modals State
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

  const [orderForm, setOrderForm] = useState<DashboardOrderFormState>({
    ref: '',
    designation: '',
    quantite: 5,
    order_nature: 'STOCK_PERMANENT',
    fournisseur: '',
    technicien: '',
    id_zone: '',
    id_machine_registered: '',
    commentaire: 'Demande de réapprovisionnement',
    code_bon: '',
  });

  const [orderFilterTab, setOrderFilterTab] = useState('ALL');
  const [selectedArticleForOrder, setSelectedArticleForOrder] = useState<OrderStockArticleOption | null>(null);

  const alertAndRuptureItems = useMemo(
    () => stockItems.filter((s) => s.alerte === 'RUPTURE' || s.alerte === 'ALERTE'),
    [stockItems]
  );

  const allOrders = useMemo(
    () =>
      mouvements.filter(
        (m) =>
          m.type === 'COMMANDE' ||
          m.action_id === 'COMMANDE' ||
          (Array.isArray(m.tags) && m.tags.includes('#COMMANDE_EN_ATTENTE')) ||
          (Array.isArray(m.tags) && m.tags.includes('#RECEPTION_VALIDE'))
      ),
    [mouvements]
  );

  const pendingOrders = useMemo(
    () =>
      allOrders.filter(
        (m) => !Array.isArray(m.tags) || !m.tags.includes('#RECEPTION_VALIDE')
      ),
    [allOrders]
  );

  const completedOrders = useMemo(
    () =>
      allOrders.filter(
        (m) => Array.isArray(m.tags) && m.tags.includes('#RECEPTION_VALIDE')
      ),
    [allOrders]
  );

  const displayedOrders = useMemo(() => {
    if (orderFilterTab === 'PENDING') return pendingOrders;
    if (orderFilterTab === 'RECEIVED') return completedOrders;
    return allOrders;
  }, [orderFilterTab, pendingOrders, completedOrders, allOrders]);

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  const externalRepairs = useMemo(
    () =>
      mouvements.filter(
        (m) =>
          m.type === 'Sortie Externe' ||
          m.is_bon_sortie === true ||
          (Array.isArray(m.tags) && m.tags.includes('#BON_SORTIE')) ||
          (Array.isArray(m.tags) && m.tags.includes('#SORTIE_EXTERNE')) ||
          m.action_id === 'REPARATION_EXTERNE' ||
          m.prestataire_externe
      ),
    [mouvements]
  );

  const pendingExternalRepairs = useMemo(
    () =>
      externalRepairs.filter(
        (m) =>
          !Array.isArray(m.tags) ||
          (!m.tags.includes('#RETOUR_RECU') && !m.tags.includes('#RECEPTION_VALIDE'))
      ),
    [externalRepairs]
  );

  const overdueRepairs = useMemo(
    () =>
      pendingExternalRepairs.filter(
        (m) => m.date_retour_prevue && m.date_retour_prevue < todayStr
      ),
    [pendingExternalRepairs, todayStr]
  );

  // Analytics for GMAO actions (DB-7: exclude pending purchase orders & temporary external repair loans)
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
      if (isPendingOrder) return;

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
    return { counts, totalActions, totalSortieQty, totalEntreeQty };
  }, [mouvements]);

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

  const referentialAudit = useMemo(
    () =>
      dataIntegrityService.scanReferentialIntegrity({
        machines,
        zones,
        technicians,
        operations,
        rawStock: stockItems,
        warehouseItems,
        preventiveTasks,
        correctiveInterventions,
        mouvements,
      }),
    [
      machines,
      zones,
      technicians,
      operations,
      stockItems,
      warehouseItems,
      preventiveTasks,
      correctiveInterventions,
      mouvements,
    ]
  );

  const { isDataReady: isWatchlistReady } = useSmartTableLoader(alertAndRuptureItems);

  const activeTechnicians = useMemo(
    () =>
      (technicians || []).filter(
        (tech) =>
          tech &&
          tech.is_active !== false &&
          tech.actif !== false &&
          String(tech.statut || tech.status || '').toUpperCase() !== 'ARCHIVE' &&
          String(tech.statut || tech.status || '').toUpperCase() !== 'ARCHIVEE'
      ),
    [technicians]
  );

  const activeOperationsChefs = useMemo(
    () =>
      (operations || []).filter(
        (op) =>
          op &&
          op.type_profil === 'CHEF' &&
          op.is_active !== false &&
          op.actif !== false &&
          String(op.statut || op.status || '').toUpperCase() !== 'ARCHIVE' &&
          String(op.statut || op.status || '').toUpperCase() !== 'ARCHIVEE'
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
        if (!Number.isNaN(tail) && tail > maxSeq) maxSeq = tail;
      } else {
        const match = code.match(/(\d+)$/);
        if (match) {
          const num = parseInt(match[1], 10);
          if (!Number.isNaN(num) && num > maxSeq && num < 100000) maxSeq = num;
        }
      }
    });
    return `${prefix}${String(maxSeq + 1).padStart(3, '0')}`;
  }, [allOrders]);

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
    if (correctiveKpis && typeof correctiveKpis.mttrMinutes === 'number' && correctiveKpis.mttrMinutes > 0) {
      mttrMinutes = Math.round(correctiveKpis.mttrMinutes);
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
  }, [preventiveTasks, correctiveInterventions, correctiveKpis]);

  const handleOpenOrderForArticle = useCallback(
    (article: AnyRecord) => {
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
        ref: String(article.ref || ''),
        designation: String(article.designation || ''),
        quantite: needed,
        order_nature: 'STOCK_PERMANENT',
        fournisseur: String(article.fournisseur || ''),
        technicien: String(defaultRequester),
        id_zone: '',
        id_machine_registered: '',
        commentaire: `Réapprovisionnement pour alerte stock (${article.stockActuel}/${article.seuil})`,
        code_bon: nextCmdNum,
      });
      setSelectedArticleForOrder(article as OrderStockArticleOption);
      setShowOrderModal(true);
    },
    [canCreateMovement, generateNextCmdCode, currentUser, activeTechnicians, activeOperationsChefs]
  );

  const handleOpenNewOrder = useCallback(() => {
    if (!canCreateMovement) return;
    const nextCmdNum = generateNextCmdCode();
    const defaultRequester =
      currentUser?.personnelName ||
      currentUser?.name ||
      activeTechnicians[0]?.nom ||
      activeOperationsChefs[0]?.nom ||
      '';
    setOrderForm({
      ref: String(stockItems[0]?.ref || ''),
      designation: String(stockItems[0]?.designation || ''),
      quantite: 5,
      order_nature: 'STOCK_PERMANENT',
      fournisseur: '',
      technicien: String(defaultRequester),
      id_zone: '',
      id_machine_registered: '',
      commentaire: "Demande d'achat magasin",
      code_bon: nextCmdNum,
    });
    setSelectedArticleForOrder(null);
    setShowOrderModal(true);
  }, [canCreateMovement, generateNextCmdCode, currentUser, activeTechnicians, activeOperationsChefs, stockItems]);

  const handleSubmitOrder = useCallback(
    (e: FormEvent) => {
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
        tags,
        is_achat_unique: isAchatUnique,
      };

      onAddMouvement?.(newOrderMouvement);
      setShowOrderModal(false);
    },
    [canCreateMovement, orderForm, onAddMouvement]
  );

  const handleValidateReception = useCallback(
    (order: AnyRecord) => {
      if (!canEditMovement || !onUpdateMouvement) return;
      const today = new Date().toISOString().split('T')[0];
      const isAchatUnique =
        order.is_achat_unique ||
        (Array.isArray(order.tags) && order.tags.includes('#Achat_Unique'));

      const tags = ['#RECEPTION_VALIDE', '#ENTREE_EXTERNE'];
      if (isAchatUnique) {
        tags.push('#Achat_Unique', '#Non_Stockable');
      }

      onUpdateMouvement(String(order.id || ''), {
        type: 'Entrée Externe',
        action_id: isAchatUnique ? 'ACHAT_DIRECT' : 'REAPPRO',
        date: today,
        heure: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        timestamp: new Date().toISOString(),
        tags,
        commentaire: `${order.commentaire ? order.commentaire + ' | ' : ''}Réceptionné le ${today}`,
        is_achat_unique: isAchatUnique,
      });
    },
    [canEditMovement, onUpdateMouvement]
  );

  return {
    t,
    stockKPIs,
    types,
    stockItems,
    mouvements,
    correctiveInterventions,
    isTechUser,
    isStoreManager,
    isOperatorRole,
    isViewerRole,
    techScope,
    isReadOnlyUser,
    canCreateMovement,
    canEditMovement,
    canDeleteMovement,
    canExportData,
    canManageSettings,
    canSyncLan,
    canAccessStockTab,
    canAccessSortieTab,
    canAccessMachinesTab,
    canAccessEntrepotTab,
    canAccessZonesTab,
    canAccessUsersTab,
    canAccessGuideTab,
    canAccessPreventiveTab,
    canAccessCorrectiveTab,
    canAccessCorrectiveDiTab,
    canAccessCorrectiveBtTab,
    canAccessCorrectiveLiveTab,
    canAccessCorrectiveClotureTab,
    canAccessCorrectiveAnalyticsTab,
    canAccessValidationCenterTab,
    canAccessSettingsTab,
    validationQueues,
    validationRadar,
    syncTrust,
    isSyncBusy,
    showConflictModal,
    setShowConflictModal,
    handleQuickLanMerge,
    handleForcePushConflict,
    handleForcePullConflict,
    showFormulasModal,
    setShowFormulasModal,
    formulaTab,
    setFormulaTab,
    showOrderModal,
    setShowOrderModal,
    forceShowOnboarding,
    setForceShowOnboarding,
    isRadarExpanded,
    setIsRadarExpanded,
    orderForm,
    setOrderForm,
    orderFilterTab,
    setOrderFilterTab,
    selectedArticleForOrder,
    alertAndRuptureItems,
    allOrders,
    pendingOrders,
    completedOrders,
    displayedOrders,
    todayStr,
    pendingExternalRepairs,
    overdueRepairs,
    actionStats,
    topConsumedArticles,
    machineHealth,
    referentialAudit,
    isWatchlistReady,
    activeTechnicians,
    activeOperationsChefs,
    executiveMaintenanceSummary,
    handleOpenOrderForArticle,
    handleOpenNewOrder,
    handleSubmitOrder,
    handleValidateReception,
  };
}
