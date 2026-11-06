import { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import {
  ShieldCheck,
  Wrench,
  Calendar,
  Package,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Search,
  FileText,
  Clock,
  User,
  Factory,
  X,
  Trash2,
  Layers,
  ArrowLeft,
  ShieldAlert,
  FileSpreadsheet,
  Lock,
} from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { useGmaoStore } from '../../../store/useGmaoStore';
import { AuthorizationService } from '../../../core/security/AuthorizationService';
import { isTechnicianRole } from '../../../core/security/technicianScope';
import {
  reconcileFieldClaim,
  selectValidationCenterQueues,
} from '../../../core/security/validationReconciliation';
import { hasPreventiveExecutionAnomaly } from '../../../application/services/MachineHealthPassportService';
import { getMachineAssetClass, isArchivedMachine } from '../../../utils/activeMachines';
import ValidationStatusBadge, {
  getInterventionNatureMeta,
  INTERVENTION_NATURE_OPTIONS,
} from '../../components/common/ValidationStatusBadge';

interface ValidationCenterViewProps {
  stockItems?: any[];
  machines?: any[];
  mouvements?: any[];
  correctiveInterventions?: any[];
  preventiveExecutions?: any[];
  sortieDemands?: any[];
  onReviewCorrectiveValidation?: (id: string, decisionData: any, onAddMouvement?: any) => any;
  onReviewPreventiveValidation?: (id: string, decisionData: any, onAddMouvement?: any) => any;
  onReviewSortieDemandValidation?: (id: string, decisionData: any, onAddMouvement?: any) => any;
  onAddMouvement?: (mvt: any) => any;
  onNavigateToTab?: (tab: string) => void;
  showToast?: (msg: string, type?: string) => void;
}

export default function ValidationCenterView({
  stockItems: propStockItems,
  machines: propMachines,
  mouvements: propMouvements,
  correctiveInterventions: propCorrective,
  preventiveExecutions: propPreventive,
  sortieDemands: propSortieDemands,
  onReviewCorrectiveValidation,
  onReviewPreventiveValidation,
  onReviewSortieDemandValidation,
  onAddMouvement,
  onNavigateToTab,
  showToast,
}: ValidationCenterViewProps) {
  const { user } = useAuth();
  const isTechUser = isTechnicianRole(user);
  const canAccess =
    Boolean(user) && !isTechUser && AuthorizationService.canAccessTab(user, 'validation_center');
  const canValidateCorrective =
    Boolean(user) && !isTechUser && AuthorizationService.hasPermission(user, 'corrective.manage');
  const canValidatePreventive =
    Boolean(user) && !isTechUser && AuthorizationService.hasPermission(user, 'preventive.manage');
  const canValidateSortie =
    Boolean(user) && !isTechUser && AuthorizationService.hasPermission(user, 'movement.create');
  const canExportQueue =
    Boolean(user) && AuthorizationService.hasPermission(user, 'report.export');

  // Fallbacks to Zustand SSOT store so the center is always live-synchronized
  const storeCorrective = useGmaoStore((s) => s.correctiveInterventions || []);
  const storePreventive = useGmaoStore((s) => s.preventiveExecutions || []);
  const storeSortieDemands = useGmaoStore((s) => s.sortieDemands || []);
  const storeMouvements = useGmaoStore((s) => s.mouvements || []);
  const storeRawStock = useGmaoStore((s) => s.rawStock || []);
  const storeMachines = useGmaoStore((s) => s.machines || []);

  const storeReviewCorrective = useGmaoStore((s) => s.handleReviewInterventionValidation);
  const storeReviewPreventive = useGmaoStore((s) => s.handleReviewPreventiveExecutionValidation);
  const storeReviewSortieDemand = useGmaoStore((s) => s.handleReviewSortieDemandValidation);

  const correctiveInterventions = propCorrective ?? storeCorrective;
  const preventiveExecutions = propPreventive ?? storePreventive;
  const sortieDemands = propSortieDemands ?? storeSortieDemands;
  const mouvements = propMouvements ?? storeMouvements;
  const stockItems = propStockItems ?? storeRawStock;
  const machines = propMachines && propMachines.length > 0 ? propMachines : storeMachines;

  // Relational Machine Lookup Map from SSOT
  const machineMetaMap = useMemo(() => {
    const map = new Map<
      string,
      {
        code: string;
        name: string;
        zone: string;
        isSystemGeneral: boolean;
        isArchived: boolean;
      }
    >();
    (machines || []).forEach((m: any) => {
      if (!m) return;
      const codes = [
        m.id_machine_registered,
        m.id,
        m.code,
        m.id_machine,
        m.code_machine,
      ]
        .map((c) => String(c || '').trim().toUpperCase())
        .filter(Boolean);
      if (codes.length === 0) return;
      const name = String(m.nom || m.designation || m.name || codes[0]).trim();
      const zone = String(m.zone || m.id_zone || '').trim();
      const isSystemGeneral = getMachineAssetClass(m) === 'SYSTEM_GENERAL';
      const isArchived = isArchivedMachine(m);
      codes.forEach((c) => {
        map.set(c, {
          code: codes[0],
          name,
          zone,
          isSystemGeneral,
          isArchived,
        });
      });
    });
    return map;
  }, [machines]);

  const resolveMachineMeta = (rawCode: unknown, fallbackName?: unknown) => {
    const clean = String(rawCode || '').trim().toUpperCase();
    const found = clean ? machineMetaMap.get(clean) : undefined;
    return {
      code: found?.code || clean || 'GLOBAL',
      name: found?.name || String(fallbackName || '').trim() || '',
      zone: found?.zone || '',
      isSystemGeneral: Boolean(found?.isSystemGeneral),
      isArchived: Boolean(found?.isArchived),
    };
  };

  // UI Filters (VAL-5: Default shows Pending first + Clarification second in each section)
  const [sectionFilter, setSectionFilter] = useState<'ALL' | 'CORRECTIVE' | 'PREVENTIVE' | 'SORTIE'>('ALL');
  const [statusFocus, setStatusFocus] = useState<'ACTIVE_QUEUES' | 'PENDING_ONLY' | 'CLARIFY_ONLY' | 'REJECTED_ONLY'>('ACTIVE_QUEUES');
  const [includeClarifications, setIncludeClarifications] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showReservedDetails, setShowReservedDetails] = useState(false);

  // 1. Corrective Review Modal State
  const [reviewBt, setReviewBt] = useState<any | null>(null);
  const [btActionRealisee, setBtActionRealisee] = useState('');
  const [btNature, setBtNature] = useState('');
  const [btPieces, setBtPieces] = useState<any[]>([]);
  const [btSkipStockDeduction, setBtSkipStockDeduction] = useState(false);
  const [btNote, setBtNote] = useState('');

  // 2. Preventive Review Modal State
  const [reviewExec, setReviewExec] = useState<any | null>(null);
  const [execSpares, setReviewExecSpares] = useState<any[]>([]);
  const [execSkipStockDeduction, setExecSkipStockDeduction] = useState(false);
  const [execCreateFollowUpDi, setExecCreateFollowUpDi] = useState(false);
  const [execFollowUpDiAnomalie, setExecFollowUpDiAnomalie] = useState('');
  const [execNote, setExecNote] = useState('');

  // 3. SortieDemand Review Modal State
  const [reviewDemand, setReviewDemand] = useState<any | null>(null);
  const [demandCodeBonMagasin, setDemandCodeBonMagasin] = useState('');
  const [demandMergeMovementId, setDemandMergeMovementId] = useState('');
  const [demandItems, setDemandItems] = useState<any[]>([]);
  const [demandNote, setDemandNote] = useState('');

  // Aggregate Queues via pure selector
  const queues = useMemo(
    () =>
      selectValidationCenterQueues({
        correctiveInterventions,
        preventiveExecutions,
        sortieDemands,
      }),
    [correctiveInterventions, preventiveExecutions, sortieDemands]
  );

  const visibleCorrective = useMemo(() => {
    const base =
      statusFocus === 'CLARIFY_ONLY'
        ? queues.clarificationCorrective
        : statusFocus === 'REJECTED_ONLY'
        ? queues.rejectedCorrective
        : statusFocus === 'PENDING_ONLY' || !includeClarifications
        ? queues.pendingCorrective
        : [...queues.pendingCorrective, ...queues.clarificationCorrective];
    const q = searchQuery.trim().toLowerCase();
    if (!q) return base;
    return base.filter((bt: any) => {
      const mMeta = resolveMachineMeta(bt.code_machine || bt.id_machine_registered, bt.nom_machine);
      const code = String(bt.num_bt || bt.id || '').toLowerCase();
      const machine = `${mMeta.code} ${mMeta.name} ${mMeta.zone}`.toLowerCase();
      const tech = String(bt.submitted_by_name || bt.intervenant || '').toLowerCase();
      const anom = String(bt.action_realisee || bt.anomalie || bt.travail_a_faire || '').toLowerCase();
      const bon = String(bt.num_bon_saisi_par_tech || '').toLowerCase();
      return code.includes(q) || machine.includes(q) || tech.includes(q) || anom.includes(q) || bon.includes(q);
    });
  }, [queues, statusFocus, includeClarifications, searchQuery, machineMetaMap]);

  const visiblePreventive = useMemo(() => {
    const base =
      statusFocus === 'CLARIFY_ONLY'
        ? queues.clarificationPreventive
        : statusFocus === 'REJECTED_ONLY'
        ? queues.rejectedPreventive
        : statusFocus === 'PENDING_ONLY' || !includeClarifications
        ? queues.pendingPreventive
        : [...queues.pendingPreventive, ...queues.clarificationPreventive];
    const q = searchQuery.trim().toLowerCase();
    if (!q) return base;
    return base.filter((ex: any) => {
      const mMeta = resolveMachineMeta(ex.machineCode, ex.machineName);
      const code = String(ex.taskCode || ex.actionCode || ex.id || '').toLowerCase();
      const machine = `${mMeta.code} ${mMeta.name} ${mMeta.zone}`.toLowerCase();
      const tech = String(ex.submitted_by_name || ex.executorName || '').toLowerCase();
      const organe = String(ex.organe || ex.taskDescription || ex.notes || '').toLowerCase();
      const bon = String(ex.num_bon_saisi_par_tech || '').toLowerCase();
      return code.includes(q) || machine.includes(q) || tech.includes(q) || organe.includes(q) || bon.includes(q);
    });
  }, [queues, statusFocus, includeClarifications, searchQuery, machineMetaMap]);

  const visibleSortieDemands = useMemo(() => {
    const base =
      statusFocus === 'CLARIFY_ONLY'
        ? queues.clarificationSortieDemands
        : statusFocus === 'REJECTED_ONLY'
        ? queues.rejectedSortieDemands
        : statusFocus === 'PENDING_ONLY' || !includeClarifications
        ? queues.pendingSortieDemands
        : [...queues.pendingSortieDemands, ...queues.clarificationSortieDemands];
    const q = searchQuery.trim().toLowerCase();
    if (!q) return base;
    return base.filter((dem: any) => {
      const mMeta = resolveMachineMeta(dem.id_machine_registered || dem.id_zone);
      const code = String(dem.code_bon_tech || dem.code_bon_magasin || dem.id || '').toLowerCase();
      const machine = `${mMeta.code} ${mMeta.name} ${mMeta.zone} ${dem.id_zone || ''}`.toLowerCase();
      const tech = String(dem.submitted_by_name || dem.technicien || '').toLowerCase();
      const comm = String(dem.commentaire || dem.motif || '').toLowerCase();
      return code.includes(q) || machine.includes(q) || tech.includes(q) || comm.includes(q);
    });
  }, [queues, statusFocus, includeClarifications, searchQuery, machineMetaMap]);

  // Active Modal Reconciliations
  const activeBtReconciliation = useMemo(() => {
    if (!reviewBt) return null;
    return reconcileFieldClaim({
      claimType: 'CORRECTIVE',
      claimId: String(reviewBt.id),
      numBonSaisi: reviewBt.num_bon_saisi_par_tech,
      machineCode: reviewBt.code_machine,
      proposedSpares: btPieces,
      stockItems,
      mouvements,
      correctiveInterventions,
      preventiveExecutions,
      sortieDemands,
    });
  }, [
    reviewBt,
    btPieces,
    stockItems,
    mouvements,
    correctiveInterventions,
    preventiveExecutions,
    sortieDemands,
  ]);

  const activeExecReconciliation = useMemo(() => {
    if (!reviewExec) return null;
    return reconcileFieldClaim({
      claimType: 'PREVENTIVE',
      claimId: String(reviewExec.id),
      numBonSaisi: reviewExec.num_bon_saisi_par_tech,
      machineCode: reviewExec.machineCode,
      proposedSpares: execSpares,
      stockItems,
      mouvements,
      correctiveInterventions,
      preventiveExecutions,
      sortieDemands,
    });
  }, [
    reviewExec,
    execSpares,
    stockItems,
    mouvements,
    correctiveInterventions,
    preventiveExecutions,
    sortieDemands,
  ]);

  const activeDemandReconciliation = useMemo(() => {
    if (!reviewDemand) return null;
    return reconcileFieldClaim({
      claimType: 'SORTIE',
      claimId: String(reviewDemand.id),
      numBonSaisi: reviewDemand.code_bon_tech,
      machineCode: reviewDemand.id_machine_registered,
      proposedSpares: demandItems,
      stockItems,
      mouvements,
      correctiveInterventions,
      preventiveExecutions,
      sortieDemands,
    });
  }, [
    reviewDemand,
    demandItems,
    stockItems,
    mouvements,
    correctiveInterventions,
    preventiveExecutions,
    sortieDemands,
  ]);

  // Open & Submit Handlers for Section 1 (Corrective BT)
  const handleOpenBtModal = (bt: any) => {
    if (!canValidateCorrective) {
      showToast?.('Droits insuffisants : la validation des Bons de Travail est réservée au Responsable Maintenance ou Administrateur.', 'warning');
      return;
    }
    const initialPieces =
      Array.isArray(bt?.pieces_proposees) && bt.pieces_proposees.length > 0
        ? bt.pieces_proposees.map((p: any) => ({ ...p }))
        : Array.isArray(bt?.pieces_utilisees) && bt.pieces_utilisees.length > 0
        ? bt.pieces_utilisees.map((p: any) => ({ ...p }))
        : [];
    const rec = reconcileFieldClaim({
      claimType: 'CORRECTIVE',
      claimId: String(bt?.id || ''),
      numBonSaisi: bt?.num_bon_saisi_par_tech,
      machineCode: bt?.code_machine,
      proposedSpares: initialPieces,
      stockItems,
      mouvements,
      correctiveInterventions,
      preventiveExecutions,
      sortieDemands,
    });
    setReviewBt(bt);
    setBtActionRealisee(bt?.action_realisee || bt?.travail_a_faire || '');
    setBtNature(bt?.intervention_nature || '');
    setBtPieces(initialPieces);
    setBtSkipStockDeduction(Boolean(rec?.exactMovementMatch));
    setBtNote(bt?.validation_note || '');
  };

  const handleConfirmBtDecision = (decision: 'APPROVED' | 'NEEDS_CLARIFICATION' | 'REJECTED') => {
    if (!reviewBt || !canValidateCorrective) return;
    if (
      (decision === 'NEEDS_CLARIFICATION' || decision === 'REJECTED') &&
      !String(btNote || '').trim()
    ) {
      showToast?.(
        'Veuillez saisir une note pour expliquer au technicien la clarification ou le motif du rejet.',
        'warning'
      );
      return;
    }

    if (
      decision === 'APPROVED' &&
      String(btNature || '').trim().toUpperCase() === 'REPLACE' &&
      btPieces.length === 0
    ) {
      showToast?.(
        'Un remplacement (REPLACE) nécessite au moins une pièce de rechange ou changez la nature (ex: Réparation / Nettoyage).',
        'warning'
      );
      return;
    }

    const reviewFn = onReviewCorrectiveValidation || storeReviewCorrective;
    const result = reviewFn(
      reviewBt.id,
      {
        decision,
        action_realisee: btActionRealisee,
        travail_a_faire: btActionRealisee,
        intervention_nature: btNature || reviewBt.intervention_nature || '',
        pieces_utilisees: btPieces,
        pieces_proposees: btPieces,
        skipStockDeduction: btSkipStockDeduction,
        validation_note: btNote.trim(),
        validated_by_id: user?.id || user?.code || 'admin',
        validated_by_name: user?.name || user?.nom || 'Administrateur',
      },
      onAddMouvement
    );

    if (result === null) {
      showToast?.('Action impossible : vérifiez le statut du Bon de Travail.', 'warning');
      return;
    }

    if (decision === 'APPROVED') {
      showToast?.(
        btSkipStockDeduction
          ? `BT ${reviewBt.num_bt || reviewBt.id} validé et clôturé (coût imputé sur machine sans 2e déstockage).`
          : `BT ${reviewBt.num_bt || reviewBt.id} validé et clôturé (${btPieces.length} réf. déduite(s) du stock).`,
        'success'
      );
    } else if (decision === 'NEEDS_CLARIFICATION') {
      showToast?.(
        `Demande de clarification envoyée au technicien pour ${reviewBt.num_bt || reviewBt.id}.`,
        'warning'
      );
    } else {
      showToast?.(`Déclaration ${reviewBt.num_bt || reviewBt.id} rejetée (aucun déstockage).`, 'info');
    }

    setReviewBt(null);
  };

  // Open & Submit Handlers for Section 2 (Preventive Execution)
  const handleOpenExecModal = (exec: any) => {
    if (!canValidatePreventive) {
      showToast?.('Droits insuffisants : la validation des exécutions préventives est réservée au Responsable Maintenance ou Administrateur.', 'warning');
      return;
    }
    setReviewExec(exec);
    const initialSpares =
      Array.isArray(exec.sparesProposed) && exec.sparesProposed.length > 0
        ? exec.sparesProposed
        : Array.isArray(exec.sparesUsed)
        ? exec.sparesUsed
        : [];
    const mappedSpares = initialSpares.map((s: any) => ({
      ref: s.ref || s.reference || '',
      designation: s.designation || s.ref || 'Pièce PDR',
      qty: Math.max(1, Number(s.qty ?? s.quantite ?? 1)),
      unit: s.unit || s.unite || 'pcs',
      unitPrice: Number(s.unitPrice ?? s.prix_unitaire ?? 0),
    }));
    const rec = reconcileFieldClaim({
      claimType: 'PREVENTIVE',
      claimId: String(exec?.id || ''),
      numBonSaisi: exec?.num_bon_saisi_par_tech,
      machineCode: exec?.machineCode,
      proposedSpares: mappedSpares,
      stockItems,
      mouvements,
      correctiveInterventions,
      preventiveExecutions,
      sortieDemands,
    });
    setReviewExecSpares(mappedSpares);
    setExecSkipStockDeduction(Boolean(rec?.exactMovementMatch));
    const hasAnom = hasPreventiveExecutionAnomaly(exec);
    setExecCreateFollowUpDi(hasAnom && !exec?.generated_di_id);
    setExecFollowUpDiAnomalie(
      exec?.followUpDiAnomalie ||
        exec?.notes ||
        `Anomalie constatée lors du contrôle préventif sur ${exec?.organe || exec?.machineCode || 'équipement'}`
    );
    setExecNote(exec.validation_note || '');
  };

  const handleConfirmExecDecision = (decision: 'APPROVED' | 'NEEDS_CLARIFICATION' | 'REJECTED') => {
    if (!reviewExec || !canValidatePreventive) return;
    if ((decision === 'NEEDS_CLARIFICATION' || decision === 'REJECTED') && !execNote.trim()) {
      showToast?.('Veuillez saisir un motif de clarification ou de rejet.', 'warning');
      return;
    }

    const reviewFn = onReviewPreventiveValidation || storeReviewPreventive;
    const updated = reviewFn(
      reviewExec.id,
      {
        decision,
        validation_note: execNote.trim(),
        validated_by_id: user?.id || user?.code || 'admin',
        validated_by_name: user?.name || user?.nom || 'Administrateur',
        approvedSpares: execSpares,
        skipStockDeduction: execSkipStockDeduction,
        createFollowUpDi: decision === 'APPROVED' && execCreateFollowUpDi,
        followUpDiAnomalie: execFollowUpDiAnomalie.trim(),
      },
      onAddMouvement
    );

    if (decision === 'APPROVED') {
      const diSuffix =
        execCreateFollowUpDi || updated?.generated_di_id
          ? ' + DI corrective de suivi générée automatiquement !'
          : '.';
      showToast?.(
        execSkipStockDeduction
          ? `Exécution préventive ${reviewExec.machineCode} approuvée (coût imputé sur machine sans 2e déstockage)${diSuffix}`
          : `Exécution préventive ${reviewExec.machineCode} approuvée (${execSpares.length} réf. déduite(s) du stock)${diSuffix}`,
        'success'
      );
    } else if (decision === 'NEEDS_CLARIFICATION') {
      showToast?.(
        `Demande de clarification envoyée au technicien (${reviewExec.executorName}).`,
        'warning'
      );
    } else {
      showToast?.(`Exécution ${reviewExec.machineCode} rejetée (sans déstockage).`, 'info');
    }

    setReviewExec(null);
  };

  // Open & Submit Handlers for Section 3 (SortieDemand)
  const handleOpenDemandModal = (dem: any) => {
    if (!canValidateSortie) {
      showToast?.('Droits insuffisants pour valider les demandes de sortie magasin.', 'warning');
      return;
    }
    setReviewDemand(dem);
    setDemandCodeBonMagasin(dem.code_bon_magasin || dem.code_bon_tech || '');
    setDemandMergeMovementId('');
    setDemandItems(Array.isArray(dem.items) ? dem.items.map((it: any) => ({ ...it })) : []);
    setDemandNote(dem.validation_note || '');
  };

  const handleConfirmDemandDecision = (decision: 'APPROVED' | 'NEEDS_CLARIFICATION' | 'REJECTED') => {
    if (!reviewDemand || !canValidateSortie) return;
    if (
      (decision === 'NEEDS_CLARIFICATION' || decision === 'REJECTED') &&
      !String(demandNote || '').trim()
    ) {
      showToast?.('Veuillez saisir un motif de clarification ou de rejet.', 'warning');
      return;
    }

    const reviewFn = onReviewSortieDemandValidation || storeReviewSortieDemand;
    reviewFn(
      reviewDemand.id,
      {
        decision,
        code_bon_magasin: demandCodeBonMagasin || reviewDemand.code_bon_tech,
        mergeWithMovementId: demandMergeMovementId || null,
        approvedItems: demandItems,
        validation_note: demandNote.trim(),
        validated_by_id: user?.id || user?.code || 'admin',
        validated_by_name: user?.name || user?.nom || 'Magasinier / Admin',
      },
      onAddMouvement
    );

    if (decision === 'APPROVED') {
      showToast?.(
        `Demande de sortie ${reviewDemand.code_bon_tech || reviewDemand.id} approuvée avec succès.`,
        'success'
      );
    } else if (decision === 'NEEDS_CLARIFICATION') {
      showToast?.(
        `Demande de clarification envoyée pour ${reviewDemand.code_bon_tech || reviewDemand.id}.`,
        'warning'
      );
    } else {
      showToast?.(
        `Demande de sortie ${reviewDemand.code_bon_tech || reviewDemand.id} rejetée (aucun déstockage).`,
        'info'
      );
    }

    setReviewDemand(null);
  };

  // Export Multi-Sheet Validation Queue Excel (.xlsx)
  const handleExportValidationQueueExcel = () => {
    if (!canExportQueue) return;
    try {
      const wb = XLSX.utils.book_new();
      const autoFit = (ws: XLSX.WorkSheet, rows: any[][]) => {
        if (!rows.length) return;
        const maxCols = rows.reduce((m, r) => Math.max(m, r.length), 0);
        ws['!cols'] = Array.from({ length: maxCols }, (_, c) => {
          let maxLen = 12;
          rows.forEach((r) => {
            const len = r[c] !== undefined && r[c] !== null ? String(r[c]).length : 0;
            if (len > maxLen) maxLen = len;
          });
          return { wch: Math.min(48, maxLen + 4) };
        });
      };

      // Sheet 1: BT Correctifs
      const btHeader = [
        'N° BT',
        'Statut Validation',
        'Code Machine',
        'Désignation Machine',
        'Zone',
        'Technicien',
        'Date Soumission',
        'N° Bon Tech',
        'Action / Anomalie',
        'Pièces Proposées',
      ];
      const btRows = visibleCorrective.map((bt: any) => {
        const mMeta = resolveMachineMeta(bt.code_machine || bt.id_machine_registered, bt.nom_machine);
        const pcs = (Array.isArray(bt.pieces_proposees) ? bt.pieces_proposees : [])
          .map((p: any) => `${p.ref} x${p.quantite ?? p.qty ?? 1}`)
          .join(', ');
        return [
          bt.num_bt || bt.id || '',
          bt.validation_status || 'PENDING_VALIDATION',
          mMeta.code,
          mMeta.name,
          mMeta.zone,
          bt.submitted_by_name || bt.intervenant || '',
          bt.submitted_at || bt.date_demande || '',
          bt.num_bon_saisi_par_tech || '',
          bt.action_realisee || bt.anomalie || bt.travail_a_faire || '',
          pcs || 'Aucune PDR',
        ];
      });
      const btAll = [btHeader, ...btRows];
      const wsBt = XLSX.utils.aoa_to_sheet(btAll);
      autoFit(wsBt, btAll);
      XLSX.utils.book_append_sheet(wb, wsBt, 'BT_Correctifs_A_Valider');

      // Sheet 2: Exécutions Préventives
      const pmHeader = [
        'Code Tâche',
        'Statut Validation',
        'Code Machine',
        'Désignation Machine',
        'Zone',
        'Exécutant',
        'Date Exécution',
        'N° Bon Tech',
        'Organe',
        'Observations',
        'Pièces Proposées',
      ];
      const pmRows = visiblePreventive.map((ex: any) => {
        const mMeta = resolveMachineMeta(ex.machineCode, ex.machineName);
        const pcs = (Array.isArray(ex.sparesProposed) ? ex.sparesProposed : [])
          .map((p: any) => `${p.ref} x${p.qty ?? p.quantite ?? 1}`)
          .join(', ');
        return [
          ex.taskCode || ex.actionCode || ex.id || '',
          ex.validation_status || 'PENDING_VALIDATION',
          mMeta.code,
          mMeta.name,
          mMeta.zone,
          ex.submitted_by_name || ex.executorName || '',
          ex.executedAt || '',
          ex.num_bon_saisi_par_tech || '',
          ex.organe || '',
          ex.taskDescription || ex.notes || '',
          pcs || 'Aucune PDR',
        ];
      });
      const pmAll = [pmHeader, ...pmRows];
      const wsPm = XLSX.utils.aoa_to_sheet(pmAll);
      autoFit(wsPm, pmAll);
      XLSX.utils.book_append_sheet(wb, wsPm, 'Executions_PM_A_Valider');

      // Sheet 3: Demandes Sortie Magasin
      const sdHeader = [
        'N° Bon Tech',
        'Statut Validation',
        'Code Machine / Zone',
        'Désignation Machine',
        'Technicien',
        'Date',
        'Motif / Commentaire',
        'Articles Demandés',
      ];
      const sdRows = visibleSortieDemands.map((dem: any) => {
        const mMeta = resolveMachineMeta(dem.id_machine_registered || dem.id_zone);
        const pcs = (Array.isArray(dem.items) ? dem.items : [])
          .map((it: any) => `${it.ref} x${it.quantite ?? it.qty ?? 1}`)
          .join(', ');
        return [
          dem.code_bon_tech || dem.id || '',
          dem.validation_status || 'PENDING_VALIDATION',
          mMeta.code,
          mMeta.name,
          dem.submitted_by_name || dem.technicien || '',
          dem.date || '',
          dem.commentaire || dem.motif || '',
          pcs,
        ];
      });
      const sdAll = [sdHeader, ...sdRows];
      const wsSd = XLSX.utils.aoa_to_sheet(sdAll);
      autoFit(wsSd, sdAll);
      XLSX.utils.book_append_sheet(wb, wsSd, 'Demandes_Sortie_Magasin');

      // Sheet 4: Réservations Virtuelles PDR
      const resHeader = ['Référence PDR', 'Quantité Réservée (En Attente)', 'Sources Réservation'];
      const resRows = Array.from(queues.reservedStockMap.values()).map((entry) => [
        entry.ref,
        entry.reservedQty,
        entry.sources.map((s) => s.code).join(', '),
      ]);
      const resAll = [resHeader, ...resRows];
      const wsRes = XLSX.utils.aoa_to_sheet(resAll);
      autoFit(wsRes, resAll);
      XLSX.utils.book_append_sheet(wb, wsRes, 'Reservations_PDR_Virtuelles');

      const today = new Date().toISOString().slice(0, 10);
      const filename = `GMAO_Centre_Validation_File_${today}.xlsx`;
      XLSX.writeFile(wb, filename);
      showToast?.(`File de validation exportée (${filename})`, 'success');
    } catch {
      showToast?.("Erreur lors de l'export Excel de la file de validation.", 'error');
    }
  };

  if (!canAccess) {
    return (
      <div className="max-w-xl mx-auto my-12 p-8 rounded-3xl bg-white border border-amber-200 shadow-lg text-center space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto">
          <ShieldAlert className="w-7 h-7" />
        </div>
        <h2 className="text-lg font-black text-slate-900">
          Accès réservé aux Responsables & Administrateurs
        </h2>
        <p className="text-xs text-slate-600">
          Le Centre de Validation (Maker-Checker) est destiné à la revue des interventions et bons de sortie.
        </p>
        <button
          type="button"
          onClick={() => onNavigateToTab?.('dashboard')}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-bold cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Retour au Tableau de Bord</span>
        </button>
      </div>
    );
  }

  const totalDisplayed =
    (sectionFilter === 'ALL' || sectionFilter === 'CORRECTIVE' ? visibleCorrective.length : 0) +
    (sectionFilter === 'ALL' || sectionFilter === 'PREVENTIVE' ? visiblePreventive.length : 0) +
    (sectionFilter === 'ALL' || sectionFilter === 'SORTIE' ? visibleSortieDemands.length : 0);

  return (
    <div data-testid="validation-center-view" className="space-y-6 pb-10">
      {/* TOP HEADER BANNER */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/90 shadow-xs space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center shrink-0 shadow-2xs">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-black uppercase tracking-wider bg-rose-100 text-rose-800 border border-rose-200">
                  Maker-Checker Centralisé
                </span>
                <span className="text-xs font-mono text-slate-500">
                  Zéro déduction stock avant approbation
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mt-1">
                Centre de Validation — À valider
              </h1>
              <p className="text-xs text-slate-600 mt-0.5">
                Point unique de revue et d'approbation des rapports correctifs (BT), exécutions préventives et demandes de sortie PDR.
              </p>
            </div>
          </div>

          {/* Search, Clarification Toggle & Excel Export */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative min-w-[220px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher N° BT, machine, zone, tech, bon..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 py-2 text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>

            <button
              type="button"
              onClick={() => {
                setIncludeClarifications((prev) => !prev);
                setStatusFocus('ACTIVE_QUEUES');
              }}
              className={`px-3 py-2 rounded-xl text-xs font-bold border transition cursor-pointer flex items-center gap-1.5 ${
                includeClarifications
                  ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-2xs'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Inclure À clarifier ({queues.totalClarification})</span>
            </button>

            <button
              type="button"
              onClick={() => setShowReservedDetails((prev) => !prev)}
              className="px-3 py-2 rounded-xl border border-purple-200 bg-purple-50 hover:bg-purple-100 text-purple-900 text-xs font-bold transition cursor-pointer inline-flex items-center gap-1.5"
            >
              <Layers className="w-3.5 h-3.5 text-purple-600" />
              <span>
                Réservé: {queues.reservedRefsCount} réf. ({queues.totalReservedUnits} u.)
              </span>
            </button>

            {canExportQueue && (
              <button
                type="button"
                data-testid="vc-export-excel-btn"
                onClick={handleExportValidationQueueExcel}
                className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black transition cursor-pointer inline-flex items-center gap-1.5 shadow-2xs"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Exporter File (.xlsx)</span>
              </button>
            )}
          </div>
        </div>

        {/* V5-1: RBAC Partial Permission Banner (e.g., Responsable Magasin) */}
        {(!canValidateCorrective || !canValidatePreventive || !canValidateSortie) && (
          <div
            data-testid="vc-rbac-scope-banner"
            className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3 flex-wrap text-xs text-slate-700"
          >
            <div className="flex items-center gap-2 font-semibold">
              <Lock className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                Périmètre de décision actif pour votre profil :{' '}
                <strong className="font-black text-slate-900">
                  {[
                    canValidateCorrective ? 'Bons de travail (BT)' : null,
                    canValidatePreventive ? 'Exécutions préventives' : null,
                    canValidateSortie ? 'Demandes de sortie terrain' : null,
                  ]
                    .filter(Boolean)
                    .join(' • ') || 'Consultation uniquement'}
                </strong>
                . Les autres files sont affichées en lecture seule.
              </span>
            </div>
          </div>
        )}

        {/* V5-1: 4 LIVE COCKPIT KPI CARDS (À valider, À clarifier, Rejetés, Validés aujourd'hui) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* KPI 1: À valider (PENDING_VALIDATION) */}
          <button
            type="button"
            onClick={() => {
              setStatusFocus((prev) => (prev === 'PENDING_ONLY' ? 'ACTIVE_QUEUES' : 'PENDING_ONLY'));
            }}
            className={`p-4 rounded-2xl border text-left transition cursor-pointer ${
              statusFocus === 'PENDING_ONLY'
                ? 'bg-slate-900 text-white border-slate-900 shadow-md'
                : 'bg-rose-50/70 hover:bg-rose-50 text-slate-900 border-rose-200'
            }`}
          >
            <div className="flex items-center justify-between">
              <span
                className={`text-[10px] font-mono font-extrabold uppercase tracking-wider ${
                  statusFocus === 'PENDING_ONLY' ? 'text-rose-300' : 'text-rose-900'
                }`}
              >
                À valider (En attente)
              </span>
              <ShieldCheck
                className={`w-4 h-4 ${
                  statusFocus === 'PENDING_ONLY' ? 'text-rose-400' : 'text-rose-600'
                }`}
              />
            </div>
            <div className="text-2xl font-black font-mono mt-1" data-testid="vc-total-pending">
              {queues.totalPending}
            </div>
            <div
              className={`text-[11px] font-mono font-bold mt-1 flex items-center gap-1.5 flex-wrap ${
                statusFocus === 'PENDING_ONLY' ? 'text-slate-300' : 'text-rose-900/90'
              }`}
            >
              <span>
                BT: <strong data-testid="vc-corrective-count">{queues.pendingCorrective.length}</strong>
              </span>
              <span>|</span>
              <span>
                Préventif: <strong data-testid="vc-preventive-count">{queues.pendingPreventive.length}</strong>
              </span>
              <span>|</span>
              <span>
                Sorties: <strong data-testid="vc-sortie-count">{queues.pendingSortieDemands.length}</strong>
              </span>
            </div>
          </button>

          {/* KPI 2: À clarifier (NEEDS_CLARIFICATION) */}
          <button
            type="button"
            onClick={() => {
              setIncludeClarifications(true);
              setStatusFocus((prev) => (prev === 'CLARIFY_ONLY' ? 'ACTIVE_QUEUES' : 'CLARIFY_ONLY'));
            }}
            className={`p-4 rounded-2xl border text-left transition cursor-pointer ${
              statusFocus === 'CLARIFY_ONLY'
                ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-md'
                : 'bg-amber-50/70 hover:bg-amber-50 text-slate-900 border-amber-200'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-extrabold uppercase tracking-wider text-amber-900">
                À clarifier (Terrain)
              </span>
              <AlertTriangle className="w-4 h-4 text-amber-700" />
            </div>
            <div className="text-2xl font-black font-mono mt-1" data-testid="vc-total-clarification">
              {queues.totalClarification}
            </div>
            <div className="text-[11px] font-mono font-bold text-amber-900/90 mt-1 flex items-center gap-1.5 flex-wrap">
              <span>BT: {queues.clarificationCorrective.length}</span>
              <span>|</span>
              <span>Préventif: {queues.clarificationPreventive.length}</span>
              <span>|</span>
              <span>Sorties: {queues.clarificationSortieDemands.length}</span>
            </div>
          </button>

          {/* KPI 3: Rejetés (Non clôturés) */}
          <button
            type="button"
            onClick={() => {
              setStatusFocus((prev) => (prev === 'REJECTED_ONLY' ? 'ACTIVE_QUEUES' : 'REJECTED_ONLY'));
            }}
            className={`p-4 rounded-2xl border text-left transition cursor-pointer ${
              statusFocus === 'REJECTED_ONLY'
                ? 'bg-rose-700 text-white border-rose-700 shadow-md'
                : 'bg-slate-50 hover:bg-slate-100 text-slate-900 border-slate-200'
            }`}
          >
            <div className="flex items-center justify-between">
              <span
                className={`text-[10px] font-mono font-extrabold uppercase tracking-wider ${
                  statusFocus === 'REJECTED_ONLY' ? 'text-rose-100' : 'text-slate-600'
                }`}
              >
                Rejetés (Actifs)
              </span>
              <ShieldAlert
                className={`w-4 h-4 ${
                  statusFocus === 'REJECTED_ONLY' ? 'text-rose-200' : 'text-rose-600'
                }`}
              />
            </div>
            <div className="text-2xl font-black font-mono mt-1" data-testid="vc-total-rejected">
              {queues.totalRejected}
            </div>
            <div
              className={`text-[11px] font-mono font-bold mt-1 flex items-center gap-1.5 flex-wrap ${
                statusFocus === 'REJECTED_ONLY' ? 'text-rose-100' : 'text-slate-600'
              }`}
            >
              <span>BT: {queues.rejectedCorrective.length}</span>
              <span>|</span>
              <span>Préventif: {queues.rejectedPreventive.length}</span>
              <span>|</span>
              <span>Sorties: {queues.rejectedSortieDemands.length}</span>
            </div>
          </button>

          {/* KPI 4: Validés aujourd'hui */}
          <div className="p-4 rounded-2xl border border-emerald-200 bg-emerald-50/60 text-left">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-extrabold uppercase tracking-wider text-emerald-900">
                Validés aujourd'hui
              </span>
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
            <div
              className="text-2xl font-black font-mono text-emerald-950 mt-1"
              data-testid="vc-approved-today"
            >
              {queues.hasAnyApprovedTimestamp || queues.totalApprovedToday > 0
                ? queues.totalApprovedToday
                : '—'}
            </div>
            <div className="text-[11px] font-mono font-bold text-emerald-900/90 mt-1 flex items-center gap-1.5 flex-wrap">
              <span>BT: {queues.approvedTodayCorrective}</span>
              <span>|</span>
              <span>Préventif: {queues.approvedTodayPreventive}</span>
              <span>|</span>
              <span>Sorties: {queues.approvedTodaySortieDemands}</span>
            </div>
          </div>
        </div>

        {/* V5-2: QUEUE SECTION SELECTOR TABS (3 Queues + All) */}
        <div className="flex items-center justify-between gap-2 pt-1 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => {
                setSectionFilter('ALL');
                setStatusFocus('ACTIVE_QUEUES');
              }}
              className={`px-3.5 py-2 rounded-xl text-xs font-black transition cursor-pointer ${
                sectionFilter === 'ALL'
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              Toutes les files ({queues.totalPending + queues.totalClarification})
            </button>
            <button
              type="button"
              onClick={() =>
                setSectionFilter((prev) => (prev === 'CORRECTIVE' ? 'ALL' : 'CORRECTIVE'))
              }
              className={`px-3.5 py-2 rounded-xl text-xs font-black transition cursor-pointer inline-flex items-center gap-1.5 ${
                sectionFilter === 'CORRECTIVE'
                  ? 'bg-amber-500 text-slate-950 shadow-2xs'
                  : 'bg-amber-50 hover:bg-amber-100 text-amber-950 border border-amber-200'
              }`}
            >
              <Wrench className="w-3.5 h-3.5" />
              <span>
                1. Bons de travail / Correctif ({queues.pendingCorrective.length} +{' '}
                {queues.clarificationCorrective.length})
              </span>
            </button>
            <button
              type="button"
              onClick={() =>
                setSectionFilter((prev) => (prev === 'PREVENTIVE' ? 'ALL' : 'PREVENTIVE'))
              }
              className={`px-3.5 py-2 rounded-xl text-xs font-black transition cursor-pointer inline-flex items-center gap-1.5 ${
                sectionFilter === 'PREVENTIVE'
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-950 border border-indigo-200'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>
                2. Exécutions préventives ({queues.pendingPreventive.length} +{' '}
                {queues.clarificationPreventive.length})
              </span>
            </button>
            <button
              type="button"
              onClick={() => setSectionFilter((prev) => (prev === 'SORTIE' ? 'ALL' : 'SORTIE'))}
              className={`px-3.5 py-2 rounded-xl text-xs font-black transition cursor-pointer inline-flex items-center gap-1.5 ${
                sectionFilter === 'SORTIE'
                  ? 'bg-teal-600 text-white shadow-2xs'
                  : 'bg-teal-50 hover:bg-teal-100 text-teal-950 border border-teal-200'
              }`}
            >
              <Package className="w-3.5 h-3.5" />
              <span>
                3. Demandes de sortie terrain ({queues.pendingSortieDemands.length} +{' '}
                {queues.clarificationSortieDemands.length})
              </span>
            </button>
          </div>
          {statusFocus !== 'ACTIVE_QUEUES' && (
            <button
              type="button"
              onClick={() => setStatusFocus('ACTIVE_QUEUES')}
              className="text-xs font-bold text-rose-700 hover:underline cursor-pointer"
            >
              Réinitialiser le filtre de statut
            </button>
          )}
        </div>

        {/* Optional Expandable Virtual Stock Reservation Breakdown */}
        {showReservedDetails && queues.reservedRefsCount > 0 && (
          <div className="p-4 rounded-2xl bg-purple-50/80 border border-purple-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-purple-950">
                Détail des réservations virtuelles (lecture seule — sans impact sur Stock Actuel avant validation)
              </span>
              <button
                type="button"
                onClick={() => setShowReservedDetails(false)}
                className="text-xs font-bold text-purple-700 hover:underline cursor-pointer"
              >
                Masquer
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {Array.from(queues.reservedStockMap.values()).map((entry) => (
                <div
                  key={entry.ref}
                  className="px-3 py-1.5 rounded-xl bg-white border border-purple-200 text-xs font-mono flex items-center gap-2 shadow-2xs"
                >
                  <span className="font-black text-slate-900">{entry.ref}</span>
                  <span className="px-1.5 py-0.5 rounded bg-purple-100 text-purple-900 font-bold text-[10px]">
                    Réservé: {entry.reservedQty}
                  </span>
                  <span className="text-[10px] text-slate-500">
                    ({entry.sources.map((s) => s.code).join(', ')})
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* V5-3: GLOBAL EMPTY STATE */}
      {totalDisplayed === 0 && (
        <div
          data-testid="validation-center-empty"
          className="bg-white rounded-3xl p-10 border border-slate-200/90 text-center space-y-3 shadow-2xs"
        >
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h2 className="text-lg font-black text-slate-900">
            Aucune déclaration en attente
          </h2>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Rien à valider — tout est à jour. Les déclarations terrain des techniciens (BT correctifs, exécutions préventives et demandes de sortie) apparaissent automatiquement ici.
          </p>
          <div className="flex items-center justify-center gap-2 pt-2 flex-wrap">
            <button
              type="button"
              onClick={() => onNavigateToTab?.('corrective')}
              className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Wrench className="w-3.5 h-3.5 text-amber-600" />
              <span>Correctif Hub</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigateToTab?.('preventive')}
              className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Calendar className="w-3.5 h-3.5 text-indigo-600" />
              <span>Planning Préventif</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigateToTab?.('sortie')}
              className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Package className="w-3.5 h-3.5 text-teal-600" />
              <span>Sortie & Entrée</span>
            </button>
          </div>
        </div>
      )}

      {/* ==========================================================================
          SECTION 1: INTERVENTIONS CORRECTIVES À VALIDER (BT)
         ========================================================================== */}
      {(sectionFilter === 'ALL' || sectionFilter === 'CORRECTIVE') && (
        <section
          data-testid="vc-section-corrective"
          className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-2xs space-y-4"
        >
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3 flex-wrap">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center">
                <Wrench className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-black text-slate-900 flex items-center gap-2 flex-wrap">
                  <span>1. Bons de travail / Correctif</span>
                  <span className="px-2 py-0.5 rounded-full text-xs font-mono bg-amber-100 text-amber-900">
                    {visibleCorrective.length}
                  </span>
                  {!canValidateCorrective && (
                    <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200 inline-flex items-center gap-1">
                      <Lock className="w-3 h-3" />
                      <span>Lecture seule — Responsable Maintenance / Admin</span>
                    </span>
                  )}
                </h2>
                <p className="text-[11px] text-slate-500">
                  En attente d'abord ({queues.pendingCorrective.length}), puis À clarifier ({queues.clarificationCorrective.length}) • Approbation = Clôture + Sortie PDR officielle
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onNavigateToTab?.('corrective')}
              className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <span>Ouvrir Correctif BT</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>

          {visibleCorrective.length === 0 ? (
            <div className="p-6 rounded-2xl bg-slate-50 text-center text-xs text-slate-500">
              Aucune déclaration en attente (Bons de travail / Correctif).
            </div>
          ) : (
            <div className="space-y-3">
              {visibleCorrective.map((bt: any) => {
                const proposed = Array.isArray(bt?.pieces_proposees) ? bt.pieces_proposees : [];
                const reconciliation = reconcileFieldClaim({
                  claimType: 'CORRECTIVE',
                  claimId: String(bt.id),
                  numBonSaisi: bt.num_bon_saisi_par_tech,
                  machineCode: bt.code_machine,
                  proposedSpares: proposed,
                  stockItems,
                  mouvements,
                  correctiveInterventions,
                  preventiveExecutions,
                  sortieDemands,
                });
                const isClarify = bt.validation_status === 'NEEDS_CLARIFICATION';
                const mMeta = resolveMachineMeta(bt.code_machine || bt.id_machine_registered, bt.nom_machine);

                return (
                  <div
                    key={bt.id}
                    data-testid={`vc-corrective-row-${bt.id}`}
                    className={`p-4 rounded-2xl border transition flex flex-col lg:flex-row lg:items-center justify-between gap-4 ${
                      isClarify
                        ? 'bg-amber-50/40 border-amber-300'
                        : 'bg-slate-50/60 hover:bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div className="space-y-1.5 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-950 font-mono text-xs font-black">
                          {bt.num_bt || bt.id}
                        </span>
                        <span className="font-mono text-xs font-black text-slate-900 flex items-center gap-1">
                          <Factory className="w-3.5 h-3.5 text-slate-500" />
                          {mMeta.code}
                          {mMeta.name && mMeta.name !== mMeta.code && (
                            <span className="font-sans font-bold text-slate-600 ml-1">
                              ({mMeta.name})
                            </span>
                          )}
                        </span>
                        {mMeta.zone && (
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-bold">
                            {mMeta.zone}
                          </span>
                        )}
                        {mMeta.isSystemGeneral && (
                          <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 font-mono text-[10px] font-bold">
                            SYS. GÉNÉRAL
                          </span>
                        )}
                        {mMeta.isArchived && (
                          <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-900 border border-rose-300 font-mono text-[10px] font-black">
                            MACHINE ARCHIVÉE
                          </span>
                        )}
                        <span className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          {bt.submitted_by_name || bt.intervenant || 'Technicien'}
                        </span>
                        {bt.submitted_at && (
                          <span className="text-[11px] font-mono text-slate-500 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {String(bt.submitted_at).slice(0, 16).replace('T', ' ')}
                          </span>
                        )}
                        {bt.num_bon_saisi_par_tech && (
                          <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-800 border border-indigo-200 font-mono text-[10px] font-bold flex items-center gap-1">
                            <FileText className="w-3 h-3" />
                            Bon Tech: {bt.num_bon_saisi_par_tech}
                          </span>
                        )}
                        <ValidationStatusBadge record={bt} showStockEffect />
                        {(() => {
                          const natureMeta = getInterventionNatureMeta(bt.intervention_nature);
                          if (!natureMeta) return null;
                          return (
                            <span
                              data-testid={`vc-bt-nature-badge-${bt.id}`}
                              className={`px-2 py-0.5 rounded border font-mono text-[10px] font-black ${natureMeta.bgClass} ${natureMeta.textClass} ${natureMeta.borderClass}`}
                              title={`Nature d'intervention déclarée : ${natureMeta.label}`}
                            >
                              {natureMeta.shortLabel}
                            </span>
                          );
                        })()}
                        {(bt.source === 'AUTO_DI_PREVENTIF' || bt.source_preventive_execution_id) && (
                          <span
                            data-testid={`vc-bt-auto-di-badge-${bt.id}`}
                            className="px-2 py-0.5 rounded bg-indigo-100 text-indigo-900 border border-indigo-300 font-mono text-[10px] font-black inline-flex items-center gap-1"
                            title={`Origine préventive : ${bt.source_preventive_execution_id || 'Auto-DI'}`}
                          >
                            <Calendar className="w-3 h-3 text-indigo-700" />
                            <span>AUTO-DI PRÉVENTIF</span>
                          </span>
                        )}
                      </div>

                      <div className="text-xs font-bold text-slate-900">
                        {bt.action_realisee || bt.anomalie || bt.travail_a_faire || 'Intervention corrective'}
                      </div>

                      {/* Proposed Spares Pills */}
                      {proposed.length > 0 ? (
                        <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                          <span className="text-[11px] font-bold text-slate-500">PDR proposées :</span>
                          {proposed.map((p: any, idx: number) => (
                            <span
                              key={`${p.ref}-${idx}`}
                              className="px-2 py-0.5 rounded-lg bg-white border border-slate-200 font-mono text-[11px] font-bold text-slate-800"
                            >
                              {p.ref} ×{p.quantite ?? p.qty ?? 1}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <div className="text-[11px] text-slate-500 italic">
                          Aucune pièce détachée déclarée (0 déstockage)
                        </div>
                      )}

                      {/* Reconciliation Alerts */}
                      {reconciliation.alerts.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {reconciliation.alerts.map((alert, i) => (
                            <span
                              key={`${alert.code}-${i}`}
                              className={`px-2 py-0.5 rounded-lg text-[10px] font-bold inline-flex items-center gap-1 ${
                                alert.severity === 'critical'
                                  ? 'bg-rose-100 text-rose-900 border border-rose-300'
                                  : 'bg-amber-100 text-amber-900 border border-amber-300'
                              }`}
                              title={alert.detail}
                            >
                              <AlertTriangle className="w-3 h-3 shrink-0" />
                              <span>{alert.title}</span>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {canValidateCorrective ? (
                        <button
                          type="button"
                          data-testid={`vc-open-bt-review-${bt.id}`}
                          onClick={() => handleOpenBtModal(bt)}
                          className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-black inline-flex items-center gap-1.5 shadow-2xs cursor-pointer"
                        >
                          <ShieldCheck className="w-4 h-4 text-emerald-400" />
                          <span>Ouvrir</span>
                        </button>
                      ) : (
                        <span className="px-3 py-2 rounded-xl bg-slate-100 text-slate-500 border border-slate-200 text-xs font-bold inline-flex items-center gap-1.5">
                          <Lock className="w-3.5 h-3.5" />
                          <span>Lecture seule</span>
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* ==========================================================================
          SECTION 2: EXÉCUTIONS PRÉVENTIVES À VALIDER
         ========================================================================== */}
      {(sectionFilter === 'ALL' || sectionFilter === 'PREVENTIVE') && (
        <section
          data-testid="vc-section-preventive"
          className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-2xs space-y-4"
        >
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3 flex-wrap">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-black text-slate-900 flex items-center gap-2 flex-wrap">
                  <span>2. Exécutions préventives</span>
                  <span className="px-2 py-0.5 rounded-full text-xs font-mono bg-indigo-100 text-indigo-900">
                    {visiblePreventive.length}
                  </span>
                  {!canValidatePreventive && (
                    <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200 inline-flex items-center gap-1">
                      <Lock className="w-3 h-3" />
                      <span>Lecture seule — Responsable Maintenance / Admin</span>
                    </span>
                  )}
                </h2>
                <p className="text-[11px] text-slate-500">
                  En attente d'abord ({queues.pendingPreventive.length}), puis À clarifier ({queues.clarificationPreventive.length}) • Approbation = Fait + Sortie PDR officielle
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onNavigateToTab?.('preventive')}
              className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <span>Ouvrir Préventif</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>

          {visiblePreventive.length === 0 ? (
            <div className="p-6 rounded-2xl bg-slate-50 text-center text-xs text-slate-500">
              Aucune déclaration en attente (Exécutions préventives).
            </div>
          ) : (
            <div className="space-y-3">
              {visiblePreventive.map((ex: any) => {
                const proposed = Array.isArray(ex?.sparesProposed) ? ex.sparesProposed : [];
                const reconciliation = reconcileFieldClaim({
                  claimType: 'PREVENTIVE',
                  claimId: String(ex.id),
                  numBonSaisi: ex.num_bon_saisi_par_tech,
                  machineCode: ex.machineCode,
                  proposedSpares: proposed,
                  stockItems,
                  mouvements,
                  correctiveInterventions,
                  preventiveExecutions,
                  sortieDemands,
                });
                const isClarify = ex.validation_status === 'NEEDS_CLARIFICATION';
                const mMeta = resolveMachineMeta(ex.machineCode, ex.machineName);

                return (
                  <div
                    key={ex.id}
                    data-testid={`vc-preventive-row-${ex.id}`}
                    className={`p-4 rounded-2xl border transition flex flex-col lg:flex-row lg:items-center justify-between gap-4 ${
                      isClarify
                        ? 'bg-amber-50/40 border-amber-300'
                        : 'bg-slate-50/60 hover:bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div className="space-y-1.5 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-950 font-mono text-xs font-black">
                          {ex.taskCode || ex.actionCode || 'PRÉV'}
                        </span>
                        <span className="font-mono text-xs font-black text-slate-900 flex items-center gap-1">
                          <Factory className="w-3.5 h-3.5 text-slate-500" />
                          {mMeta.code}
                          {mMeta.name && mMeta.name !== mMeta.code && (
                            <span className="font-sans font-bold text-slate-600 ml-1">
                              ({mMeta.name})
                            </span>
                          )}
                        </span>
                        {mMeta.zone && (
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-bold">
                            {mMeta.zone}
                          </span>
                        )}
                        {mMeta.isSystemGeneral && (
                          <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 font-mono text-[10px] font-bold">
                            SYS. GÉNÉRAL
                          </span>
                        )}
                        {mMeta.isArchived && (
                          <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-900 border border-rose-300 font-mono text-[10px] font-black">
                            MACHINE ARCHIVÉE
                          </span>
                        )}
                        <span className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          {ex.submitted_by_name || ex.executorName || 'Technicien'}
                        </span>
                        {ex.executedAt && (
                          <span className="text-[11px] font-mono text-slate-500 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {ex.executedAt} ({ex.periodWeek || ex.periodMonth || ''})
                          </span>
                        )}
                        {ex.num_bon_saisi_par_tech && (
                          <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-800 border border-indigo-200 font-mono text-[10px] font-bold flex items-center gap-1">
                            <FileText className="w-3 h-3" />
                            Bon Tech: {ex.num_bon_saisi_par_tech}
                          </span>
                        )}
                        <ValidationStatusBadge record={ex} showStockEffect />
                        {hasPreventiveExecutionAnomaly(ex) && (
                          <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 font-mono text-[10px] font-black inline-flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3 text-amber-600" />
                            <span>ANOMALIE SIGNALÉE (AUTO-DI PROPOSÉE)</span>
                          </span>
                        )}
                      </div>

                      <div className="text-xs font-bold text-slate-900">
                        {ex.organe || 'Machine entière'} —{' '}
                        <span className="font-medium text-slate-700">
                          {ex.taskDescription || ex.notes || 'Exécution préventive'}
                        </span>
                      </div>

                      {/* Proposed Spares */}
                      {proposed.length > 0 ? (
                        <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                          <span className="text-[11px] font-bold text-slate-500">PDR proposées :</span>
                          {proposed.map((p: any, idx: number) => (
                            <span
                              key={`${p.ref}-${idx}`}
                              className="px-2 py-0.5 rounded-lg bg-white border border-slate-200 font-mono text-[11px] font-bold text-slate-800"
                            >
                              {p.ref} ×{p.qty ?? p.quantite ?? 1}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <div className="text-[11px] text-slate-500 italic">
                          Aucune pièce détachée déclarée (0 déstockage)
                        </div>
                      )}

                      {/* Reconciliation Alerts */}
                      {reconciliation.alerts.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {reconciliation.alerts.map((alert, i) => (
                            <span
                              key={`${alert.code}-${i}`}
                              className={`px-2 py-0.5 rounded-lg text-[10px] font-bold inline-flex items-center gap-1 ${
                                alert.severity === 'critical'
                                  ? 'bg-rose-100 text-rose-900 border border-rose-300'
                                  : 'bg-amber-100 text-amber-900 border border-amber-300'
                              }`}
                              title={alert.detail}
                            >
                              <AlertTriangle className="w-3 h-3 shrink-0" />
                              <span>{alert.title}</span>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {canValidatePreventive ? (
                        <button
                          type="button"
                          data-testid={`vc-open-prev-review-${ex.id}`}
                          onClick={() => handleOpenExecModal(ex)}
                          className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black inline-flex items-center gap-1.5 shadow-2xs cursor-pointer"
                        >
                          <ShieldCheck className="w-4 h-4" />
                          <span>Ouvrir</span>
                        </button>
                      ) : (
                        <span className="px-3 py-2 rounded-xl bg-slate-100 text-slate-500 border border-slate-200 text-xs font-bold inline-flex items-center gap-1.5">
                          <Lock className="w-3.5 h-3.5" />
                          <span>Lecture seule</span>
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* ==========================================================================
          SECTION 3: DEMANDES DE SORTIE TERRAIN (SORTIE DEMANDS)
         ========================================================================== */}
      {(sectionFilter === 'ALL' || sectionFilter === 'SORTIE') && (
        <section
          data-testid="vc-section-sortie"
          className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-2xs space-y-4"
        >
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3 flex-wrap">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-teal-50 border border-teal-200 text-teal-600 flex items-center justify-center">
                <Package className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-black text-slate-900 flex items-center gap-2 flex-wrap">
                  <span>3. Demandes de sortie terrain</span>
                  <span className="px-2 py-0.5 rounded-full text-xs font-mono bg-teal-100 text-teal-900">
                    {visibleSortieDemands.length}
                  </span>
                  {!canValidateSortie && (
                    <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200 inline-flex items-center gap-1">
                      <Lock className="w-3 h-3" />
                      <span>Lecture seule — Magasin / Responsable / Admin</span>
                    </span>
                  )}
                </h2>
                <p className="text-[11px] text-slate-500">
                  En attente d'abord ({queues.pendingSortieDemands.length}), puis À clarifier ({queues.clarificationSortieDemands.length}) • Rapprochement BS-Tech × BS-Magasin sans double déstockage
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onNavigateToTab?.('sortie')}
              className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <span>Ouvrir Sortie & Entrée</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>

          {visibleSortieDemands.length === 0 ? (
            <div className="p-6 rounded-2xl bg-slate-50 text-center text-xs text-slate-500">
              Aucune déclaration en attente (Demandes de sortie terrain).
            </div>
          ) : (
            <div className="space-y-3">
              {visibleSortieDemands.map((dem: any) => {
                const items = Array.isArray(dem?.items) ? dem.items : [];
                const reconciliation = reconcileFieldClaim({
                  claimType: 'SORTIE',
                  claimId: String(dem.id),
                  numBonSaisi: dem.code_bon_tech,
                  machineCode: dem.id_machine_registered,
                  proposedSpares: items,
                  stockItems,
                  mouvements,
                  correctiveInterventions,
                  preventiveExecutions,
                  sortieDemands,
                });
                const isClarify = dem.validation_status === 'NEEDS_CLARIFICATION';
                const mMeta = resolveMachineMeta(dem.id_machine_registered || dem.id_zone);

                return (
                  <div
                    key={dem.id}
                    data-testid={`vc-sortie-row-${dem.id}`}
                    className={`p-4 rounded-2xl border transition flex flex-col lg:flex-row lg:items-center justify-between gap-4 ${
                      isClarify
                        ? 'bg-amber-50/40 border-amber-300'
                        : 'bg-slate-50/60 hover:bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div className="space-y-1.5 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2 py-0.5 rounded-md bg-teal-100 text-teal-950 font-mono text-xs font-black">
                          {dem.code_bon_tech || dem.id}
                        </span>
                        <span className="font-mono text-xs font-black text-slate-900 flex items-center gap-1">
                          <Factory className="w-3.5 h-3.5 text-slate-500" />
                          {mMeta.code}
                          {mMeta.name && mMeta.name !== mMeta.code && (
                            <span className="font-sans font-bold text-slate-600 ml-1">
                              ({mMeta.name})
                            </span>
                          )}
                        </span>
                        {mMeta.zone && (
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-bold">
                            {mMeta.zone}
                          </span>
                        )}
                        {mMeta.isArchived && (
                          <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-900 border border-rose-300 font-mono text-[10px] font-black">
                            MACHINE ARCHIVÉE
                          </span>
                        )}
                        <span className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          {dem.submitted_by_name || dem.technicien || 'Technicien'}
                        </span>
                        {dem.date && (
                          <span className="text-[11px] font-mono text-slate-500 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {dem.date} {dem.heure || ''}
                          </span>
                        )}
                        <ValidationStatusBadge record={dem} showStockEffect />
                      </div>

                      {dem.commentaire && (
                        <div className="text-xs font-medium text-slate-700">
                          Motif : {dem.commentaire}
                        </div>
                      )}

                      {/* Requested Items */}
                      {items.length > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                          <span className="text-[11px] font-bold text-slate-500">Articles demandés :</span>
                          {items.map((it: any, idx: number) => (
                            <span
                              key={`${it.ref}-${idx}`}
                              className="px-2 py-0.5 rounded-lg bg-white border border-slate-200 font-mono text-[11px] font-bold text-slate-800"
                            >
                              {it.ref} — {it.designation || it.ref} ×{it.quantite ?? it.qty ?? 1}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Reconciliation Alerts (including CANDIDATE_STORE_BON_MATCH) */}
                      {reconciliation.alerts.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {reconciliation.alerts.map((alert, i) => (
                            <span
                              key={`${alert.code}-${i}`}
                              className={`px-2 py-0.5 rounded-lg text-[10px] font-bold inline-flex items-center gap-1 ${
                                alert.severity === 'critical'
                                  ? 'bg-rose-100 text-rose-900 border border-rose-300'
                                  : 'bg-amber-100 text-amber-900 border border-amber-300'
                              }`}
                              title={alert.detail}
                            >
                              <AlertTriangle className="w-3 h-3 shrink-0" />
                              <span>{alert.title}</span>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {canValidateSortie ? (
                        <button
                          type="button"
                          data-testid={`vc-open-sortie-review-${dem.id}`}
                          onClick={() => handleOpenDemandModal(dem)}
                          className="px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-black inline-flex items-center gap-1.5 shadow-2xs cursor-pointer"
                        >
                          <ShieldCheck className="w-4 h-4" />
                          <span>Ouvrir</span>
                        </button>
                      ) : (
                        <span className="px-3 py-2 rounded-xl bg-slate-100 text-slate-500 border border-slate-200 text-xs font-bold inline-flex items-center gap-1.5">
                          <Lock className="w-3.5 h-3.5" />
                          <span>Lecture seule</span>
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* ==========================================================================
          MODAL 1: CORRECTIVE BT MAKER-CHECKER REVIEW MODAL
         ========================================================================== */}
      {reviewBt && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div
            data-testid="vc-bt-review-modal"
            className="w-full max-w-lg bg-white rounded-3xl p-6 shadow-2xl border border-slate-200 space-y-4 my-auto"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-mono text-xs font-black">
                    {reviewBt.num_bt || reviewBt.id}
                  </span>
                  <span className="font-mono text-xs font-bold text-slate-700">
                    Machine : {reviewBt.code_machine}
                  </span>
                </div>
                <h3 className="text-base font-black text-slate-900 mt-1">
                  Revue & Validation Bon de Travail (BT)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setReviewBt(null)}
                className="p-2 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Reconciliation Alerts inside Modal */}
            {activeBtReconciliation && activeBtReconciliation.alerts.length > 0 && (
              <div className="space-y-1.5">
                {activeBtReconciliation.alerts.map((alert, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-xl border text-xs flex items-start gap-2 ${
                      alert.severity === 'critical'
                        ? 'bg-rose-50 border-rose-200 text-rose-900'
                        : 'bg-amber-50 border-amber-200 text-amber-900'
                    }`}
                  >
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-black">{alert.title}</div>
                      <div className="text-[11px]">{alert.detail}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nature de l'intervention (modifiable avant validation)
                </label>
                <select
                  data-testid="vc-bt-nature-select"
                  value={btNature}
                  onChange={(e) => setBtNature(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold bg-white"
                >
                  <option value="">-- Non spécifiée (Autre) --</option>
                  {INTERVENTION_NATURE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label} ({opt.shortLabel})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Action réalisée (modifiable avant clôture)
                </label>
                <textarea
                  rows={3}
                  value={btActionRealisee}
                  onChange={(e) => setBtActionRealisee(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
                />
              </div>

              {/* Proposed Spares List */}
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="text-xs font-black text-slate-800">
                  Pièces à déduire du stock à l'approbation ({btPieces.length})
                </div>
                {btPieces.length === 0 ? (
                  <div className="text-xs text-slate-500 italic">Aucune pièce détachée</div>
                ) : (
                  <div className="space-y-1.5">
                    {btPieces.map((p, idx) => (
                      <div
                        key={`${p.ref}-${idx}`}
                        className="flex items-center justify-between gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200 text-xs"
                      >
                        <div className="min-w-0">
                          <span className="font-mono font-black text-slate-900">{p.ref}</span>
                          <span className="text-slate-500 ml-1.5 truncate">{p.designation}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <input
                            type="number"
                            min="1"
                            value={p.quantite ?? p.qty ?? 1}
                            onChange={(e) => {
                              const val = Math.max(1, Number(e.target.value) || 1);
                              setBtPieces((prev) =>
                                prev.map((item, i) =>
                                  i === idx ? { ...item, quantite: val, qty: val } : item
                                )
                              );
                            }}
                            className="w-16 rounded-lg border border-slate-300 px-2 py-1 text-xs font-mono text-center"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setBtPieces((prev) => prev.filter((_, i) => i !== idx))
                            }
                            className="p-1 text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {btPieces.length > 0 && (
                  <label className="flex items-start gap-2 pt-2 border-t border-slate-200/80 text-[11px] text-slate-700 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={btSkipStockDeduction}
                      onChange={(e) => setBtSkipStockDeduction(e.target.checked)}
                      className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>
                      <strong className="font-bold text-slate-900">
                        ✅ Bon de sortie déjà déstocké au magasin
                      </strong>{' '}
                      — Imputer le coût PDR sur la machine sans créer de 2e mouvement de stock.
                    </span>
                  </label>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Note de validation / Motif de clarification ou rejet
                </label>
                <textarea
                  rows={2}
                  value={btNote}
                  onChange={(e) => setBtNote(e.target.value)}
                  placeholder="Obligatoire en cas de demande de clarification ou de rejet..."
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => handleConfirmBtDecision('REJECTED')}
                className="px-3.5 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 text-xs font-bold cursor-pointer"
              >
                Rejeter
              </button>
              <button
                type="button"
                data-testid="vc-bt-clarify-btn"
                onClick={() => handleConfirmBtDecision('NEEDS_CLARIFICATION')}
                className="px-3.5 py-2.5 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-950 text-xs font-bold cursor-pointer"
              >
                Demander Clarification
              </button>
              <button
                type="button"
                data-testid="vc-bt-approve-btn"
                onClick={() => handleConfirmBtDecision('APPROVED')}
                className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black cursor-pointer shadow-sm"
              >
                Approuver & Clôturer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==========================================================================
          MODAL 2: PREVENTIVE EXECUTION MAKER-CHECKER REVIEW MODAL
         ========================================================================== */}
      {reviewExec && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div
            data-testid="vc-prev-review-modal"
            className="w-full max-w-lg bg-white rounded-3xl p-6 shadow-2xl border border-slate-200 space-y-4 my-auto"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-indigo-100 text-indigo-900 font-mono text-xs font-black">
                    {reviewExec.taskCode || reviewExec.actionCode || 'PRÉV'}
                  </span>
                  <span className="font-mono text-xs font-bold text-slate-700">
                    Machine : {reviewExec.machineCode}
                  </span>
                </div>
                <h3 className="text-base font-black text-slate-900 mt-1">
                  Revue & Validation Exécution Préventive
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setReviewExec(null)}
                className="p-2 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {activeExecReconciliation && activeExecReconciliation.alerts.length > 0 && (
              <div className="space-y-1.5">
                {activeExecReconciliation.alerts.map((alert, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-xl border text-xs flex items-start gap-2 ${
                      alert.severity === 'critical'
                        ? 'bg-rose-50 border-rose-200 text-rose-900'
                        : 'bg-amber-50 border-amber-200 text-amber-900'
                    }`}
                  >
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-black">{alert.title}</div>
                      <div className="text-[11px]">{alert.detail}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
                <div>
                  <span className="font-bold text-slate-600">Organe : </span>
                  <span className="font-bold text-slate-900">{reviewExec.organe}</span>
                </div>
                <div>
                  <span className="font-bold text-slate-600">Observations Tech : </span>
                  <span className="text-slate-800">{reviewExec.notes || 'RAS'}</span>
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="text-xs font-black text-slate-800">
                  Pièces à déduire du stock à l'approbation ({execSpares.length})
                </div>
                {execSpares.length === 0 ? (
                  <div className="text-xs text-slate-500 italic">Aucune pièce détachée</div>
                ) : (
                  <div className="space-y-1.5">
                    {execSpares.map((s, idx) => (
                      <div
                        key={`${s.ref}-${idx}`}
                        className="flex items-center justify-between gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200 text-xs"
                      >
                        <div className="min-w-0">
                          <span className="font-mono font-black text-slate-900">{s.ref}</span>
                          <span className="text-slate-500 ml-1.5 truncate">{s.designation}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <input
                            type="number"
                            min="1"
                            value={s.qty}
                            onChange={(e) => {
                              const val = Math.max(1, Number(e.target.value) || 1);
                              setReviewExecSpares((prev) =>
                                prev.map((item, i) => (i === idx ? { ...item, qty: val } : item))
                              );
                            }}
                            className="w-16 rounded-lg border border-slate-300 px-2 py-1 text-xs font-mono text-center"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setReviewExecSpares((prev) => prev.filter((_, i) => i !== idx))
                            }
                            className="p-1 text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {execSpares.length > 0 && (
                  <label className="flex items-start gap-2 pt-2 border-t border-slate-200/80 text-[11px] text-slate-700 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={execSkipStockDeduction}
                      onChange={(e) => setExecSkipStockDeduction(e.target.checked)}
                      className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>
                      <strong className="font-bold text-slate-900">
                        ✅ Bon de sortie déjà déstocké au magasin
                      </strong>{' '}
                      — Imputer le coût PDR sur la machine sans créer de 2e mouvement de stock.
                    </span>
                  </label>
                )}
              </div>

              {/* Idea 1: Boucle fermée Préventif -> Correctif (Auto-DI sur Anomalie) */}
              <div className="p-3 rounded-2xl bg-amber-50/70 border border-amber-200 space-y-2">
                <label className="flex items-start gap-2 text-xs text-amber-950 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    data-testid="vc-prev-auto-di-checkbox"
                    checked={execCreateFollowUpDi}
                    onChange={(e) => setExecCreateFollowUpDi(e.target.checked)}
                    className="mt-0.5 rounded border-amber-400 text-amber-600 focus:ring-amber-500"
                  />
                  <span>
                    <strong className="font-black">
                      Créer une DI corrective de suivi (Auto-DI sur anomalie préventive)
                    </strong>{' '}
                    — Génère automatiquement une Demande d&apos;Intervention liée à{' '}
                    <code className="font-mono font-bold">{reviewExec.machineCode}</code> dès l&apos;approbation.
                  </span>
                </label>

                {execCreateFollowUpDi && (
                  <div className="pt-1">
                    <label className="block text-[10px] font-bold text-amber-900 uppercase mb-1">
                      Description de l&apos;anomalie pour la DI corrective :
                    </label>
                    <input
                      type="text"
                      data-testid="vc-prev-auto-di-anomalie-input"
                      value={execFollowUpDiAnomalie}
                      onChange={(e) => setExecFollowUpDiAnomalie(e.target.value)}
                      className="w-full rounded-xl border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-900"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Note de validation / Motif de clarification ou rejet
                </label>
                <textarea
                  rows={2}
                  value={execNote}
                  onChange={(e) => setExecNote(e.target.value)}
                  placeholder="Obligatoire en cas de demande de clarification ou de rejet..."
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => handleConfirmExecDecision('REJECTED')}
                className="px-3.5 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 text-xs font-bold cursor-pointer"
              >
                Rejeter
              </button>
              <button
                type="button"
                data-testid="vc-prev-clarify-btn"
                onClick={() => handleConfirmExecDecision('NEEDS_CLARIFICATION')}
                className="px-3.5 py-2.5 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-950 text-xs font-bold cursor-pointer"
              >
                Demander Clarification
              </button>
              <button
                type="button"
                data-testid="vc-prev-approve-btn"
                onClick={() => handleConfirmExecDecision('APPROVED')}
                className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black cursor-pointer shadow-sm"
              >
                Approuver l'Exécution
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==========================================================================
          MODAL 3: SORTIE DEMAND MAKER-CHECKER & RECONCILIATION MODAL
         ========================================================================== */}
      {reviewDemand && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div
            data-testid="vc-sortie-review-modal"
            className="w-full max-w-lg bg-white rounded-3xl p-6 shadow-2xl border border-slate-200 space-y-4 my-auto"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-teal-100 text-teal-900 font-mono text-xs font-black">
                    {reviewDemand.code_bon_tech || reviewDemand.id}
                  </span>
                  <span className="font-mono text-xs font-bold text-slate-700">
                    Machine : {reviewDemand.id_machine_registered || reviewDemand.id_zone}
                  </span>
                </div>
                <h3 className="text-base font-black text-slate-900 mt-1">
                  Validation & Rapprochement Demande de Sortie PDR
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setReviewDemand(null)}
                className="p-2 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {activeDemandReconciliation && activeDemandReconciliation.alerts.length > 0 && (
              <div className="space-y-1.5">
                {activeDemandReconciliation.alerts.map((alert, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-xl border text-xs flex items-start gap-2 ${
                      alert.severity === 'critical'
                        ? 'bg-rose-50 border-rose-200 text-rose-900'
                        : 'bg-amber-50 border-amber-200 text-amber-900'
                    }`}
                  >
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-black">{alert.title}</div>
                      <div className="text-[11px]">{alert.detail}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  N° Bon Magasin Officiel
                </label>
                <input
                  type="text"
                  value={demandCodeBonMagasin}
                  onChange={(e) => setDemandCodeBonMagasin(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-mono"
                />
              </div>

              {/* Candidate Storekeeper Movement Merge (Prevent Double Deduction) */}
              {activeDemandReconciliation &&
                activeDemandReconciliation.candidateStoreMovements.length > 0 && (
                  <div className="p-3 rounded-2xl bg-amber-50/80 border border-amber-200 space-y-1.5">
                    <label className="block text-xs font-black text-amber-950">
                      Fusionner avec un mouvement magasin existant (évite le double déstockage)
                    </label>
                    <select
                      value={demandMergeMovementId}
                      onChange={(e) => setDemandMergeMovementId(e.target.value)}
                      className="w-full rounded-xl border border-amber-300 px-3 py-2 text-xs font-mono bg-white"
                    >
                      <option value="">— Créer un nouveau mouvement de sortie —</option>
                      {activeDemandReconciliation.candidateStoreMovements.map((cand) => (
                        <option key={cand.movementId} value={cand.movementId}>
                          Fusionner avec {cand.code_bon} ({cand.ref} ×{cand.quantite} le {cand.date})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="text-xs font-black text-slate-800">
                  Articles demandés ({demandItems.length})
                </div>
                {demandItems.map((it, idx) => (
                  <div
                    key={`${it.ref}-${idx}`}
                    className="flex items-center justify-between gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200 text-xs"
                  >
                    <div className="min-w-0">
                      <span className="font-mono font-black text-slate-900">{it.ref}</span>
                      <span className="text-slate-500 ml-1.5 truncate">{it.designation}</span>
                    </div>
                    <input
                      type="number"
                      min="1"
                      value={it.quantite ?? it.qty ?? 1}
                      onChange={(e) => {
                        const val = Math.max(1, Number(e.target.value) || 1);
                        setDemandItems((prev) =>
                          prev.map((row, i) =>
                            i === idx ? { ...row, quantite: val, qty: val } : row
                          )
                        );
                      }}
                      className="w-16 rounded-lg border border-slate-300 px-2 py-1 text-xs font-mono text-center"
                    />
                  </div>
                ))}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Note de validation / Motif de clarification ou rejet
                </label>
                <textarea
                  rows={2}
                  value={demandNote}
                  onChange={(e) => setDemandNote(e.target.value)}
                  placeholder="Obligatoire en cas de demande de clarification ou de rejet..."
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => handleConfirmDemandDecision('REJECTED')}
                className="px-3.5 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 text-xs font-bold cursor-pointer"
              >
                Rejeter
              </button>
              <button
                type="button"
                data-testid="vc-sortie-clarify-btn"
                onClick={() => handleConfirmDemandDecision('NEEDS_CLARIFICATION')}
                className="px-3.5 py-2.5 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-950 text-xs font-bold cursor-pointer"
              >
                Demander Clarification
              </button>
              <button
                type="button"
                data-testid="vc-sortie-approve-btn"
                onClick={() => handleConfirmDemandDecision('APPROVED')}
                className="px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-black cursor-pointer shadow-sm"
              >
                Approuver la Sortie
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
