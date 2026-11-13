import {  useState, useMemo, useEffect, useCallback  } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import SequentialCodePicker from '../../components/common/SequentialCodePicker';
import FormulasModalButton from '../../components/common/FormulasModalButton';
import Action3DButton from '../../components/common/Action3DButton';
import {
  FileSpreadsheet,
  Search,
  Check,
  AlertTriangle,
  RotateCcw,
  Plus,
  Trash2,
  Package,
  Wrench,
  Clock,
  TrendingDown,
  TrendingUp,
  Puzzle,
  MapPin,
  Users,
  Boxes,
  HelpCircle,
  X,
  ChevronDown,
  Crown,
  UserCheck,
  ShoppingCart,
  Activity,
  Sparkles,
  Tag,
  AlertCircle,
  CheckCircle2,
  ClipboardList,
  ShieldAlert,
  Inbox,
  CornerDownRight,
  RefreshCw,
  Scale,
  ShieldCheck,
  Hammer,
  Truck,
  Gauge,
  Layers,
  Calculator,
  Receipt,
  Columns2,
  Maximize2,
} from 'lucide-react';

import MouvementsJournalTable from '../warehouse/MouvementsJournalTable';
import SortieEntreeIcon from '../../components/common/SortieEntreeIcon';
import AnimatedPage from '../../components/common/AnimatedPage';
import SortieExterneBobinageTab from './components/SortieExterneBobinageTab';
import { filterActiveMachines } from '../../../utils/activeMachines';
import { applyReplacementMovementToLedger } from '../../../core/domain';
import { useAuth } from '../../../context/AuthContext';
import { usePermission } from '../../components/common/PermissionGate';
import { useGmaoStore } from '../../../store/useGmaoStore';
import {
  isTechnicianRole,
  matchesTechnicianRecord,
  getTechnicianBadgeLabel,
  getTechnicianDisplayName,
} from '../../../core/security/technicianScope';
import { reconcileFieldClaim } from '../../../core/security/validationReconciliation';
import {
  WizardShell,
  useWizardFeature,
  type WizardProfile,
} from '../../components/common/wizard';

import { CustomSelect, FormContainerWrapper } from './components/MovementSelect';
import {
  SortieSuccessAlertModal,
  SortieValidationAlertModal,
  SortieDemandReviewModal,
  UnifiedArticleSearchModal,
  MovementFormulasPreviewModal,
} from './components/SortieModals';
import {
  PendingOrdersSubTab,
  ValidationTerrainQueueSubTab,
  TechSortieDemandsPanel,
} from './components/SortieSubTabs';
import { SortieInterneContextSection } from './components/SortieInterneContextSection';
import { EntreeInterneContextSection } from './components/EntreeInterneContextSection';

export default function SortieRapideView({
  mouvements = [],
  stockItems = [],
  warehouseItems = [],
  machineElementsLedger = [],
  updateMachineElement = null,
  quickSortiePreset = null,
  setQuickSortiePreset,
  _families = [],
  _templates = [],
  _types = [],
  _diagnostics = [],
  zones = [],
  machines = [],
  technicians = [],
  operations = [],
  sortiesExterne = [],
  onAddSortieExterne = null,
  onUpdateSortieExterne = null,
  onDeleteSortieExterne = null,
  onMarkSortieReturned = null,
  onMarkSortieMounted = null,
  onClearSortiesForRealFactory = null,
  onResetSortiesToBaseline = null,
  onAddMouvement,
  onUpdateMouvement,
  onDeleteMouvement,
  onAddWarehouseItem,
  onUpdateWarehouseItem,
  onOpenAddArticle,
  onOpenAddMachine,
  onOpenAddZone,
  onOpenAddTech,
  onOpenAddChef,
  onOpenAddOperator,
  _onNavigateToWarehouse,
  showToast = null,
}: any) {
  const { user } = useAuth();
  const canCreateMovement = usePermission('movement.create');
  const canEditMovement = usePermission('movement.edit');
  const isTechUser = isTechnicianRole(user);
  const techBadgeLabel = useMemo(
    () => getTechnicianBadgeLabel(user, technicians),
    [user, technicians]
  );
  const techDisplayName = useMemo(
    () => getTechnicianDisplayName(user, technicians),
    [user, technicians]
  );

  // Toggleable Feature Flag: Classic Form vs 3-Step Guided Wizard Mode
  const {
    isEnabled: isWizardMode,
    setModuleEnabled: setWizardModuleEnabled,
  } = useWizardFeature('stock_rapid_movement');

  // V3 + V4 Store SortieDemands & Reconciliation Context
  const storeSortieDemands = useGmaoStore((s) => s.sortieDemands || []);
  const handleSubmitSortieDemand = useGmaoStore((s) => s.handleSubmitSortieDemand);
  const handleReviewSortieDemandValidation = useGmaoStore(
    (s) => s.handleReviewSortieDemandValidation
  );
  const storeCorrectiveInterventions = useGmaoStore((s) => s.correctiveInterventions || []);
  const storePreventiveExecutions = useGmaoStore((s) => s.preventiveExecutions || []);

  // Technician editing an existing demand returned for clarification
  const [editingDemandId, setEditingDemandId] = useState<string | null>(null);

  // Admin / Magasinier Review & Reconciliation Modal State
  const [reviewDemand, setReviewDemand] = useState<any | null>(null);
  const [reviewCodeBonMagasin, setReviewCodeBonMagasin] = useState('');
  const [reviewMergeMovementId, setReviewMergeMovementId] = useState<string>('');
  const [reviewDemandItems, setReviewDemandItems] = useState<any[]>([]);
  const [reviewDemandNote, setReviewDemandNote] = useState('');

  // Scope movements & sortie demands to logged-in technician when TECHNICIEN
  const scopedMouvements = useMemo(() => {
    if (!isTechUser) return mouvements;
    return (mouvements || []).filter((m) => matchesTechnicianRecord(m, user, technicians));
  }, [mouvements, isTechUser, user, technicians]);

  const mySortieDemands = useMemo(() => {
    if (!isTechUser) return storeSortieDemands;
    return (storeSortieDemands || []).filter((d) => matchesTechnicianRecord(d, user, technicians));
  }, [storeSortieDemands, isTechUser, user, technicians]);

  const pendingSortieDemands = useMemo(
    () =>
      (storeSortieDemands || []).filter(
        (d) =>
          d.validation_status === 'PENDING_VALIDATION' ||
          d.validation_status === 'NEEDS_CLARIFICATION'
      ),
    [storeSortieDemands]
  );

  const reviewDemandReconciliation = useMemo(() => {
    if (!reviewDemand) return null;
    return reconcileFieldClaim({
      claimType: 'SORTIE',
      claimId: String(reviewDemand.id),
      numBonSaisi: reviewDemand.code_bon_tech,
      machineCode: reviewDemand.id_machine_registered,
      proposedSpares: reviewDemandItems,
      stockItems,
      mouvements,
      correctiveInterventions: storeCorrectiveInterventions,
      preventiveExecutions: storePreventiveExecutions,
      sortieDemands: storeSortieDemands,
    });
  }, [
    reviewDemand,
    reviewDemandItems,
    stockItems,
    mouvements,
    storeCorrectiveInterventions,
    storePreventiveExecutions,
    storeSortieDemands,
  ]);

  const handleOpenReviewDemandModal = (dem: any) => {
    if (!canEditMovement) return;
    setReviewDemand(dem);
    setReviewCodeBonMagasin(dem.code_bon_tech || dem.code_bon_magasin || '');
    setReviewMergeMovementId('');
    setReviewDemandItems(
      Array.isArray(dem.items) ? dem.items.map((it: any) => ({ ...it })) : []
    );
    setReviewDemandNote(dem.validation_note || '');
  };

  const handleReviewDemandDecision = (
    decision: 'APPROVED' | 'NEEDS_CLARIFICATION' | 'REJECTED'
  ) => {
    if (!canEditMovement || !reviewDemand) return;
    if (
      (decision === 'NEEDS_CLARIFICATION' || decision === 'REJECTED') &&
      !String(reviewDemandNote || '').trim()
    ) {
      return;
    }
    handleReviewSortieDemandValidation(
      reviewDemand.id,
      {
        decision,
        code_bon_magasin: reviewCodeBonMagasin || reviewDemand.code_bon_tech,
        mergeWithMovementId: reviewMergeMovementId || null,
        approvedItems: reviewDemandItems,
        validation_note: reviewDemandNote,
        validated_by_id: user?.id || user?.code || 'admin',
        validated_by_name: user?.name || 'Magasinier / Admin',
      },
      onAddMouvement
    );
    setReviewDemand(null);
  };

  const handleReloadClarificationDemand = (dem: any) => {
    if (!dem) return;
    setEditingDemandId(dem.id);
    setForm((prev: any) => ({
      ...prev,
      code_bon: dem.code_bon_tech || prev.code_bon,
      num_commande: dem.num_commande || '',
      date: dem.date || prev.date,
      heure: dem.heure || prev.heure,
      action_id: dem.action_id || 'CORRECTIVE',
      id_zone: dem.id_zone || prev.id_zone,
      id_machine_registered: dem.id_machine_registered || prev.id_machine_registered,
      commentaire: dem.commentaire || '',
    }));
    if (Array.isArray(dem.items) && dem.items.length > 0) {
      setMouvementItems(dem.items.map((it: any) => ({ ...it })));
    }
    if (viewMode === 'JOURNAL') {
      setIsFloatingFormOpen(true);
    }
  };

  // Navigation Sub-Tabs: 'JOURNAL' | 'VALIDATION_TERRAIN' | 'COMMANDES' | 'REPARATION_EXTERNE'
  const [activeSubTab, setActiveSubTab] = useState('JOURNAL');
  // Display Mode for Journal: 'SPLIT' (Vue Scindée) | 'JOURNAL' (Plein Écran Table)
  const [rawViewMode, setViewMode] = useState('SPLIT');
  const viewMode = rawViewMode;
  const effectiveSubTab = isTechUser ? 'JOURNAL' : activeSubTab;
  const [isFloatingFormOpen, setIsFloatingFormOpen] = useState(false);
  const [showFormulasModal, setShowFormulasModal] = useState(false);

  // Toggle between Split view (Vue Scindée) and Full-Screen Table view (Vue Dédiée)
  const handleToggleSplitSolo = () => {
    if (viewMode === 'SPLIT') {
      setViewMode('JOURNAL');
    } else {
      setViewMode('SPLIT');
      setIsFloatingFormOpen(false);
    }
  };

  // Close floating modal on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isFloatingFormOpen) {
        setIsFloatingFormOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFloatingFormOpen]);

  // Auto-calculation of next sequential Bon code (e.g. Bon-001, Bon-002, ...)
  const getNextBonCode = (mvtList = []) => {
    const nums = (mvtList || [])
      .map((m) => {
        const raw = String(m.code_bon || '');
        const match = raw.match(/(\d+)/);
        return match ? parseInt(match[1], 10) : 0;
      })
      .filter((n) => !isNaN(n) && n > 0);
    const max = nums.length > 0 ? Math.max(...nums) : 0;
    return `Bon-${String(max + 1).padStart(3, '0')}`;
  };

  const autoBonCode = useMemo(() => {
    return getNextBonCode(mouvements);
  }, [mouvements]);

  const takenBonNumbers = useMemo(() => {
    const set = new Set();
    (mouvements || []).forEach((m) => {
      const match = String(m.code_bon || '').match(/(\d+)/);
      if (match) set.add(parseInt(match[1], 10));
    });
    return set;
  }, [mouvements]);

  const getCurrentTimeStr = () => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  const activeMachinesList = useMemo(() => filterActiveMachines(machines), [machines]);

  // Form State
  const [form, setForm] = useState<any>({
    date: new Date().toISOString().split('T')[0],
    heure: getCurrentTimeStr(),
    // 5 Operational Flow Types:
    // 1. 'Sortie Interne' (PDR / PARTIE / COMPOSANT -> Machine/Zone)
    // 2. 'Entrée Interne' (Machine/Atelier -> Stock PDR / Entrepôt)
    // 3. 'Bon de Sortie'  (Entrepôt PARTIE/COMPOSANT -> Réparation Externe / Bobinage)
    // 4. 'Entrée Externe' (Fournisseur/Retour Réparation -> Stock/Entrepôt)
    // 5. 'COMMANDE'       (Demande d'Achat ou Demande de Sortie)
    type: 'Sortie Interne',
    item_source: 'STOCK_PDR', // 'STOCK_PDR' | 'WAREHOUSE_PARTIE' | 'WAREHOUSE_COMPOSANT'
    destination_type: 'STOCK_PDR', // For Entrée: 'STOCK_PDR' | 'WAREHOUSE_PARTIE' | 'WAREHOUSE_COMPOSANT'
    code_bon: getNextBonCode(mouvements),
    is_inconnu: false,
    num_commande: '',
    action_id: 'CORRECTIVE', // CORRECTIVE, PREVENTIVE, AMELIORATIVE, USAGE, REAPPRO, RETOUR, REPARATION_EXTERNE, SOUS_TRAITANCE, COMMANDE_STOCK
    usage_type: 'technician',
    demande_mode: 'ACHAT', // 'ACHAT' (Demande d'Achat) | 'SORTIE_EXT' (Demande de Sortie pour réparation)
    id_zone: zones[0]?.id_zone || '',
    id_machine_registered: activeMachinesList[0]?.id_machine_registered || '',
    technicien: technicians[0]?.nom || '',
    id_technician: technicians[0]?.id_technician || '',
    operation: '',
    id_operation: '',
    fournisseur: 'Fournisseur Central Industriel',
    prestataire_externe: 'Atelier Bobinage & Rectification Externe',
    emplacement_reception: stockItems[0]?.emplacement || 'Magasin Central - R1',
    entrepot_unit: 'pcs', // 'pcs' | 'ensemble' | 'lot' | 'kg' | 'm'
    entrepot_etat: 'Fonctionnel', // 'Fonctionnel' | 'En révision' | 'Neuf' | 'En attente'
    date_retour_prevue: '',
    commentaire: '',
    pendingCmdId: null,
  });

  // Multi-articles list for the current Bon (up to 5 items)
  const [mouvementItems, setMouvementItems] = useState<any[]>([
    {
      source: 'STOCK_PDR', // 'STOCK_PDR' | 'WAREHOUSE_PARTIE' | 'WAREHOUSE_COMPOSANT'
      ref: '',
      designation: '',
      quantite: 1,
      unit: 'pcs',
      emplacement: '',
    },
  ]);

  const [showValidationAlert, setShowValidationAlert] = useState(false);
  const [showSuccessAlert, setShowSuccessAlert] = useState(false);
  const [validationErrors, setValidationErrors] = useState<any[]>([]);

  // Keep code_bon up to date when movements collection updates
  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      code_bon: prev.is_inconnu
        ? `${getNextBonCode(mouvements)}-INCONNU`
        : getNextBonCode(mouvements),
    }));
  }, [mouvements]);

  // Apply incoming quick sortie preset (from Designation, PartDesignation, or Machine)
  useEffect(() => {
    if (quickSortiePreset) {
      const src = quickSortiePreset.source || 'STOCK_PDR';
      const mObj = quickSortiePreset.id_machine_registered
        ? machines.find((m) => m.id_machine_registered === quickSortiePreset.id_machine_registered)
        : null;
      const targetZone = quickSortiePreset.id_zone || mObj?.id_zone_default || '';
      const resolvedZone = zones.find((z) => z.id_zone === targetZone || z.code_zone === targetZone || z.code === targetZone);
      const finalZoneId = resolvedZone?.id_zone || targetZone;
      const finalTech = quickSortiePreset.technicien || mObj?.technician || '';

      setForm((prev) => ({
        ...prev,
        type: 'Sortie Interne',
        action_id: 'CORRECTIVE',
        item_source: src,
        ...(finalZoneId ? { id_zone: finalZoneId } : {}),
        ...(quickSortiePreset.id_machine_registered ? { id_machine_registered: quickSortiePreset.id_machine_registered } : {}),
        ...(finalTech ? { technicien: finalTech } : {}),
      }));

      if (viewMode === 'JOURNAL') {
        setIsFloatingFormOpen(true);
      }

      if (quickSortiePreset.ref || quickSortiePreset.designation) {
        const presetQty = Math.max(1, Number(quickSortiePreset.quantite) || 1);
        setMouvementItems([
          {
            source: src,
            ref: quickSortiePreset.ref || '',
            designation: quickSortiePreset.designation || '',
            type: quickSortiePreset.type || '',
            quantite: presetQty,
            unit: quickSortiePreset.unit || 'pcs',
            emplacement: quickSortiePreset.emplacement || '',
          },
        ]);
      } else {
        // Preset from Machine: initialize clean blank row ready for spare part selection
        setMouvementItems([
          {
            source: src,
            ref: '',
            designation: '',
            type: '',
            quantite: 1,
            unit: 'pcs',
            emplacement: '',
          },
        ]);
      }
    }
  }, [quickSortiePreset, machines, zones, viewMode]);

  // Handle flow type change
  const handleTypeChange = (newType) => {
    let newAction = 'CORRECTIVE';
    let newItemSource = 'STOCK_PDR';
    let newDestType = 'STOCK_PDR';

    if (newType === 'Sortie Interne') {
      newAction = 'CORRECTIVE';
      newItemSource = 'STOCK_PDR';
    } else if (newType === 'Entrée Interne') {
      newAction = 'RETOUR';
      newItemSource = 'STOCK_PDR';
      newDestType = 'STOCK_PDR';
    } else if (newType === 'Bon de Sortie' || newType === 'Sortie Externe') {
      newAction = 'REPARATION_EXTERNE';
      newItemSource = 'WAREHOUSE_PARTIE'; // Dedicated to Warehouse Parts & Components strictly by default
      newDestType = 'PRESTATAIRE_EXTERNE';
    } else if (newType === 'Entrée Externe') {
      newAction = 'REAPPRO';
      newItemSource = 'STOCK_PDR';
    } else if (newType === 'COMMANDE') {
      newAction = 'COMMANDE_ACHAT';
      newItemSource = 'STOCK_PDR';
    }

    setForm((prev) => ({
      ...prev,
      type: newType,
      action_id: newAction,
      item_source: newItemSource,
      destination_type: newDestType,
    }));

    // Reset items source
    setMouvementItems((prev) =>
      prev.map((item) => ({
        ...item,
        source: newItemSource,
      }))
    );
  };

  // Helper to smartly normalize action/intervention type
  const getSmartActionType = (m) => {
    if (!m) return 'CORRECTIVE';
    const raw = String(m.action_id || '').trim().toUpperCase();
    if (!raw || raw === 'MACHINE' || raw === 'CORRECTIVE') {
      return 'CORRECTIVE';
    }
    if (raw === 'PREVENTIVE' || raw === 'PREV') return 'PREVENTIVE';
    if (raw === 'AMELIORATIVE' || raw === 'AMEL') return 'AMELIORATIVE';
    if (raw === 'USAGE' || raw === 'PERSONNEL') return 'USAGE';
    if (raw === 'REAPPRO' || raw === 'REAPPROVISIONNEMENT') return 'REAPPRO';
    if (raw === 'RETOUR' || raw === 'RETOUR_ATELIER') return 'RETOUR';
    if (raw === 'REPARATION_EXTERNE' || raw === 'REPARATION') return 'REPARATION_EXTERNE';
    if (raw === 'ETALONNAGE_CONTROLE' || raw === 'ETALONNAGE' || raw === 'CONTROLE') return 'ETALONNAGE_CONTROLE';
    if (raw === 'GARANTIE_ECHANGE' || raw === 'GARANTIE' || raw === 'ECHANGE') return 'GARANTIE_ECHANGE';
    if (raw === 'INVENTAIRE') return 'INVENTAIRE';
    if (raw === 'ACHAT_DIRECT') return 'ACHAT_DIRECT';
    return raw;
  };

  // Helper to render action/intervention type badge matching form cards styling
  // eslint-disable-next-line no-unused-vars
  const renderActionBadge = (m) => {
    const act = getSmartActionType(m);

    if (act === 'CORRECTIVE') {
      return (
        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-950 shadow-2xs">
          <div className="w-4 h-4 rounded-md bg-rose-100 flex items-center justify-center text-rose-600 shrink-0">
            <Wrench className="w-2.5 h-2.5 stroke-[2.5]" />
          </div>
          <span className="text-[10.5px] font-bold whitespace-nowrap text-rose-950">Corrective</span>
          <span className="text-[8.5px] font-mono px-1 py-0.2 rounded bg-rose-100 text-rose-700 font-bold">
            CURATIF
          </span>
        </div>
      );
    }

    if (act === 'PREVENTIVE') {
      return (
        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-950 shadow-2xs">
          <div className="w-4 h-4 rounded-md bg-blue-100 flex items-center justify-center text-blue-600 shrink-0">
            <Clock className="w-2.5 h-2.5 stroke-[2.5]" />
          </div>
          <span className="text-[10.5px] font-bold whitespace-nowrap text-blue-950">Préventive</span>
          <span className="text-[8.5px] font-mono px-1 py-0.2 rounded bg-blue-100 text-blue-700 font-bold">
            PLANIFIÉ
          </span>
        </div>
      );
    }

    if (act === 'AMELIORATIVE') {
      return (
        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950 shadow-2xs">
          <div className="w-4 h-4 rounded-md bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
            <Sparkles className="w-2.5 h-2.5 stroke-[2.5]" />
          </div>
          <span className="text-[10.5px] font-bold whitespace-nowrap text-emerald-950">Amélioration</span>
          <span className="text-[8.5px] font-mono px-1 py-0.2 rounded bg-emerald-100 text-emerald-700 font-bold">
            PROJET
          </span>
        </div>
      );
    }

    if (act === 'USAGE') {
      return (
        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-xl bg-purple-50 border border-purple-200 text-purple-950 shadow-2xs">
          <div className="w-4 h-4 rounded-md bg-purple-100 flex items-center justify-center text-purple-600 shrink-0">
            <Users className="w-2.5 h-2.5 stroke-[2.5]" />
          </div>
          <span className="text-[10.5px] font-bold whitespace-nowrap text-purple-950">Usage Perso</span>
          <span className="text-[8.5px] font-mono px-1 py-0.2 rounded bg-purple-100 text-purple-700 font-bold">
            INTERVENANT
          </span>
        </div>
      );
    }

    if (act === 'REAPPRO') {
      return (
        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-xl bg-teal-50 border border-teal-200 text-teal-950 shadow-2xs">
          <div className="w-4 h-4 rounded-md bg-teal-100 flex items-center justify-center text-teal-600 shrink-0">
            <Inbox className="w-2.5 h-2.5 stroke-[2.5]" />
          </div>
          <span className="text-[10.5px] font-bold whitespace-nowrap text-teal-950">Réappro</span>
          <span className="text-[8.5px] font-mono px-1 py-0.2 rounded bg-teal-100 text-teal-700 font-bold">
            ENTRÉE
          </span>
        </div>
      );
    }

    if (act === 'RETOUR') {
      return (
        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-xl bg-cyan-50 border border-cyan-200 text-cyan-950 shadow-2xs">
          <div className="w-4 h-4 rounded-md bg-cyan-100 flex items-center justify-center text-cyan-600 shrink-0">
            <RotateCcw className="w-2.5 h-2.5 stroke-[2.5]" />
          </div>
          <span className="text-[10.5px] font-bold whitespace-nowrap text-cyan-950">Retour Atelier</span>
          <span className="text-[8.5px] font-mono px-1 py-0.2 rounded bg-cyan-100 text-cyan-700 font-bold">
            STOCK
          </span>
        </div>
      );
    }

    if (act === 'REPARATION_EXTERNE') {
      return (
        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-xl bg-purple-50 border border-purple-200 text-purple-950 shadow-2xs">
          <div className="w-4 h-4 rounded-md bg-purple-100 flex items-center justify-center text-purple-600 shrink-0">
            <Truck className="w-2.5 h-2.5 stroke-[2.5]" />
          </div>
          <span className="text-[10.5px] font-bold whitespace-nowrap text-purple-950">Rép. Externe</span>
          <span className="text-[8.5px] font-mono px-1 py-0.2 rounded bg-purple-100 text-purple-700 font-bold">
            SOUS-TRAITANCE
          </span>
        </div>
      );
    }

    if (act === 'ETALONNAGE_CONTROLE') {
      return (
        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-950 shadow-2xs">
          <div className="w-4 h-4 rounded-md bg-blue-100 flex items-center justify-center text-blue-600 shrink-0">
            <Gauge className="w-2.5 h-2.5 stroke-[2.5]" />
          </div>
          <span className="text-[10.5px] font-bold whitespace-nowrap text-blue-950">Étalonnage</span>
          <span className="text-[8.5px] font-mono px-1 py-0.2 rounded bg-blue-100 text-blue-700 font-bold">
            MÉTROLOGIE
          </span>
        </div>
      );
    }

    if (act === 'GARANTIE_ECHANGE') {
      return (
        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950 shadow-2xs">
          <div className="w-4 h-4 rounded-md bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
            <ShieldCheck className="w-2.5 h-2.5 stroke-[2.5]" />
          </div>
          <span className="text-[10.5px] font-bold whitespace-nowrap text-emerald-950">Garantie</span>
          <span className="text-[8.5px] font-mono px-1 py-0.2 rounded bg-emerald-100 text-emerald-700 font-bold">
            ÉCHANGE
          </span>
        </div>
      );
    }

    return (
      <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-700">
        <span className="text-[10.5px] font-bold">{act}</span>
      </div>
    );
  };

  // Helper flags
  const isSortieInterne = form.type === 'Sortie Interne';
  const isEntreeInterne = form.type === 'Entrée Interne';
  const isBonSortie = form.type === 'Bon de Sortie' || form.type === 'Sortie Externe';
  const isEntreeExterne = form.type === 'Entrée Externe';
  const isCommandeFlow = form.type === 'COMMANDE';
  const isWarehouseDest = form.destination_type?.startsWith('WAREHOUSE_');

  // Dynamic Supplier Options
  const supplierOptions = useMemo(() => {
    const list = ['Fournisseur Central Industriel', 'SKF Maroc / France', 'Schneider Electric', 'ZONE-ATELC Pneumatics', 'Festo Automation', 'Atelier Bobinage & Usinage'];
    mouvements.forEach((m) => {
      if (m.fournisseur && !list.includes(m.fournisseur)) {
        list.push(m.fournisseur);
      }
    });
    return list;
  }, [mouvements]);

  // Dynamic available machines based on selected zone
  const availableMachines = useMemo(() => {
    let list = filterActiveMachines(machines);
    if (form.id_zone) {
      const targetZ = zones.find(
        (z) => z.id_zone === form.id_zone || z.code_zone === form.id_zone || z.code === form.id_zone
      );
      list = list.filter((m) => {
        if (m.id_zone_default === form.id_zone) return true;
        if (targetZ) {
          return (
            m.id_zone_default === targetZ.id_zone ||
            m.id_zone_default === targetZ.code_zone ||
            m.id_zone_default === targetZ.code
          );
        }
        return false;
      });
    }
    return list;
  }, [machines, form.id_zone, zones]);

  // Available technicians:
  // For Corrective: ALL technicians across the factory can intervene
  // For Preventive / other: ALL technicians with zone technicians prioritized
  const availableTechs = useMemo(() => {
    const activeList = (technicians || []).filter(
      (t) => t && t.is_active !== false && t.actif !== false && t.statut !== 'ARCHIVE'
    );
    if (form.action_id === 'CORRECTIVE') {
      return activeList;
    }
    if (!form.id_zone) return activeList;
    const zoneTechs = activeList.filter((t) => t.id_zone === form.id_zone);
    const otherTechs = activeList.filter((t) => t.id_zone !== form.id_zone);
    return [...zoneTechs, ...otherTechs];
  }, [technicians, form.id_zone, form.action_id]);

  // Filtered lists for Responsables (all RESP / CHEF profiles)
  const responsablesList = useMemo(() => {
    return operations.filter(
      (op) =>
        op.type_profil === 'RESPONSABLE' ||
        op.type_profil === 'CHEF' ||
        String(op.id_operation).startsWith('RESP') ||
        String(op.id_operation).startsWith('CHEF') ||
        String(op.nom).toUpperCase().includes('RESP') ||
        String(op.nom).toUpperCase().includes('CHEF')
    );
  }, [operations]);

  // Helper to extract allowed zones for a given responsable
  const getResponsableAllowedZones = useCallback((resp) => {
    if (!resp) return zones;
    let zoneIds = [];
    if (Array.isArray(resp.zones) && resp.zones.length > 0) {
      zoneIds = resp.zones;
    } else if (resp.id_zone) {
      zoneIds = String(resp.id_zone).split(',').map((s) => s.trim()).filter(Boolean);
    }
    if (zoneIds.length === 0 || zoneIds.includes('ALL')) {
      return zones;
    }
    const matched = zones.filter((z) => zoneIds.includes(z.id_zone));
    return matched.length > 0 ? matched : zones;
  }, [zones]);

  // Current Responsable for USAGE mode
  const currentUsageResponsable = useMemo(() => {
    return (
      responsablesList.find(
        (r) => r.nom === form.operation || r.id_operation === form.id_operation
      ) ||
      responsablesList[0] ||
      null
    );
  }, [responsablesList, form.operation, form.id_operation]);

  // Maintenance Workshop default zone (e.g. ZONE-ATEL)
  const maintenanceZone = useMemo(() => {
    return (
      zones.find(
        (z) =>
          z.id_zone === 'ZONE-ATEL' ||
          z.id_zone?.toUpperCase().includes('ATEL') ||
          z.libelle?.toUpperCase().includes('ATELIER') ||
          z.libelle?.toUpperCase().includes('MAINT')
      ) ||
      zones[0] || { id_zone: 'ZONE-ATEL', libelle: 'Atelier Central Maintenance' }
    );
  }, [zones]);

  // Smart filter to find only Responsables related to a given zone (e.g. for Operator usage)
  const getResponsablesForZone = useCallback(
    (zoneId) => {
      if (!zoneId) return responsablesList;
      const filtered = responsablesList.filter((r) => {
        if (r.id_zone === 'ALL' || (Array.isArray(r.zones) && r.zones.includes('ALL'))) return true;
        if (r.id_zone === zoneId) return true;
        if (Array.isArray(r.zones) && r.zones.includes(zoneId)) return true;
        if (
          typeof r.id_zone === 'string' &&
          r.id_zone.split(',').map((s) => s.trim()).includes(zoneId)
        ) {
          return true;
        }
        return false;
      });
      return filtered.length > 0 ? filtered : responsablesList;
    },
    [responsablesList]
  );

  // Responsables list filtered for the current Operator's zone
  const operatorFilteredResponsables = useMemo(() => {
    return getResponsablesForZone(form.id_zone);
  }, [getResponsablesForZone, form.id_zone]);

  // Allowed zones for the currently selected USAGE Responsable
  const usageAllowedZones = useMemo(() => {
    return getResponsableAllowedZones(currentUsageResponsable);
  }, [currentUsageResponsable, getResponsableAllowedZones]);

  // Available machines for USAGE mode, filtered exclusively by selected zone and active status
  const usageAvailableMachines = useMemo(() => {
    if (!form.id_zone) return [];
    return filterActiveMachines(machines).filter((m) => m.id_zone_default === form.id_zone);
  }, [machines, form.id_zone]);

  const operatorsList = useMemo(() => {
    return operations.filter(
      (op) =>
        op.type_profil === 'OPERATEUR' ||
        (!String(op.id_operation).startsWith('CHEF') &&
          !String(op.id_operation).startsWith('RESP') &&
          op.type_profil !== 'RESPONSABLE' &&
          op.type_profil !== 'CHEF')
    );
  }, [operations]);

  // Helper to smartly find responsable assigned to a specific zone
  const findSupervisorForZone = (zoneId) => {
    if (!zoneId) return responsablesList[0] || null;

    const hasTpl = (s, tplId) => {
      if (Array.isArray(s.templates) && s.templates.some((t) => (typeof t === 'string' ? t : t?.id) === tplId)) return true;
      if (Array.isArray(s.template_ids) && s.template_ids.includes(tplId)) return true;
      if (typeof s.template_id === 'string' && s.template_id.includes(tplId)) return true;
      return false;
    };

    const zoneMatches = (s) =>
      (s.zones && (s.zones.includes(zoneId) || s.zones.includes('ALL'))) ||
      s.id_zone === zoneId ||
      s.id_zone === 'ALL' ||
      (typeof s.id_zone === 'string' && s.id_zone.split(',').map((x) => x.trim()).includes(zoneId));

    // 1. Check Responsable Zone (RZN) matching this zone
    const rzn = responsablesList.find((s) => hasTpl(s, 'RZN') && zoneMatches(s));
    if (rzn) return rzn;

    // 2. Check Responsable Maintenance (RMT)
    const rmt = responsablesList.find((s) => hasTpl(s, 'RMT') && zoneMatches(s));
    if (rmt) return rmt;

    // 3. Direct match on zones or id_zone
    const directMatch = responsablesList.find((s) => zoneMatches(s));
    if (directMatch) return directMatch;

    return responsablesList[0] || null;
  };

  // Auto-populate responsable when Zone changes for Corrective, Preventive and Améliorative
  useEffect(() => {
    if (
      form.type === 'Sortie Interne' &&
      (form.action_id === 'CORRECTIVE' || form.action_id === 'PREVENTIVE' || form.action_id === 'AMELIORATIVE')
    ) {
      const sup = findSupervisorForZone(form.id_zone);
      if (sup) {
        setForm((prev) => {
          if (prev.operation === sup.nom && prev.id_operation === sup.id_operation) return prev;
          return {
            ...prev,
            operation: sup.nom,
            id_operation: sup.id_operation,
          };
        });
      }
    }
  }, [form.id_zone, form.action_id, form.type, responsablesList]);

  // Search Modal State
  const [isArticleSearchOpen, setIsArticleSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchActiveTab, setSearchActiveTab] = useState('ALL'); // 'ALL' | 'STOCK_PDR' | 'WAREHOUSE_PARTIE' | 'WAREHOUSE_COMPOSANT'
  const [targetItemIndex, setTargetItemIndex] = useState(0);

  // Unified items list for search modal (Merging PDR Stock + Warehouse Digital Twin Items)
  const unifiedSearchCatalog = useMemo(() => {
    const catalog = [];

    // 1. Stock PDR Items (Active only)
    stockItems.forEach((s) => {
      if (!s || s.is_active === false || s.actif === false || s.statut === 'ARCHIVE') return;
      catalog.push({
        id: `PDR-${s.id || s.ref}`,
        source: 'STOCK_PDR',
        ref: s.ref,
        code: s.ref,
        designation: s.designation,
        category: 'PDR Consommable',
        badge: 'Stock PDR',
        badgeColor: 'bg-emerald-50 text-emerald-800 border-emerald-200',
        stockActuel: s.stockActuel ?? s.stockInitial ?? 0,
        emplacement: s.emplacement || 'Magasin Central',
        type: s.id_type || 'PDR',
        unit: 'pcs',
        raw: s,
      });
    });

    // 2. Warehouse Digital Twin Items (Parties & Composants, Active only)
    warehouseItems.forEach((w) => {
      if (!w || w.is_active === false || w.actif === false || w.statut === 'ARCHIVE' || w.etat === 'ARCHIVE') return;
      const isPartie = w.category === 'PARTIE' || w.nature === 'PARTIE';
      const codeStr = w.id_warehouse_item || w.code || w.ref || `EXT-${w.id}`;
      catalog.push({
        id: `WH-${w.id || w.id_warehouse_item || w.code}`,
        source: isPartie ? 'WAREHOUSE_PARTIE' : 'WAREHOUSE_COMPOSANT',
        ref: codeStr,
        code: codeStr,
        designation: w.designation || w.nom || '',
        category: isPartie ? 'PARTIE (Machine Twin)' : 'COMPOSANT (Stock Twin)',
        badge: isPartie ? 'Entrepôt: PARTIE' : 'Entrepôt: COMPOSANT',
        badgeColor: isPartie
          ? 'bg-purple-50 text-purple-800 border-purple-200'
          : 'bg-blue-50 text-blue-800 border-blue-200',
        stockActuel: w.quantite ?? w.stockActuel ?? 1,
        emplacement: w.emplacement || w.rattachement_val || 'Entrepôt',
        type: isPartie ? w.id_family || 'Machine' : w.id_type || 'Composant',
        unit: w.unite || 'pcs',
        etat: w.etat || 'Fonctionnel',
        raw: w,
      });
    });

    return catalog;
  }, [stockItems, warehouseItems]);

  // Filtered Search Results
  const filteredCatalogResults = useMemo(() => {
    return unifiedSearchCatalog.filter((item) => {
      // Tab filter
      if (searchActiveTab !== 'ALL' && item.source !== searchActiveTab) {
        return false;
      }

      // Query filter
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase().trim();
      return (
        String(item.ref || '').toLowerCase().includes(q) ||
        String(item.designation || '').toLowerCase().includes(q) ||
        String(item.category || '').toLowerCase().includes(q) ||
        String(item.emplacement || '').toLowerCase().includes(q) ||
        String(item.type || '').toLowerCase().includes(q)
      );
    });
  }, [unifiedSearchCatalog, searchActiveTab, searchQuery]);

  // Active Pending Orders (Commandes en attente de livraison)
  const pendingOrders = useMemo(() => {
    return mouvements.filter((m) => m.type === 'COMMANDE' || m.action_id === 'COMMANDE_STOCK');
  }, [mouvements]);

  // Active Items Out for External Repair (Bons de sortie en cours)
  const activeExternalRepairs = useMemo(() => {
    return mouvements.filter(
      (m) =>
        m.type === 'Bon de Sortie' ||
        m.type === 'Sortie Externe' ||
        m.action_id === 'REPARATION_EXTERNE' ||
        m.action_id === 'ETALONNAGE_CONTROLE' ||
        m.action_id === 'GARANTIE_ECHANGE' ||
        m.action_id === 'SOUS_TRAITANCE'
    );
  }, [mouvements]);

  // Function to Highlight Search Matches
  const highlightMatch = (text, query) => {
    if (!text || !query) return text;
    const parts = String(text).split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
    return parts.map((part, index) =>
      part.toLowerCase() === query.toLowerCase() ? (
        <mark key={index} className="bg-amber-200 text-amber-950 font-bold px-0.5 rounded">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  // Add Item to Current Movement
  const handleAddItem = () => {
    if (mouvementItems.length >= 5) {
      if (showToast) {
        showToast('Vous pouvez ajouter jusqu’à 5 articles maximum par bon.', 'warning');
      } else {
        setValidationErrors(['Vous pouvez ajouter jusqu’à 5 articles maximum par bon.']);
        setShowValidationAlert(true);
      }
      return;
    }
    const defaultItem = unifiedSearchCatalog.find((c) => c.source === form.item_source) || unifiedSearchCatalog[0];
    setMouvementItems([
      ...mouvementItems,
      {
        source: form.item_source,
        ref: defaultItem?.ref || '',
        designation: defaultItem?.designation || '',
        quantite: 1,
        unit: defaultItem?.unit || 'pcs',
        emplacement: defaultItem?.emplacement || '',
      },
    ]);
  };

  // Remove Item from Current Movement
  const handleRemoveItem = (index) => {
    if (mouvementItems.length <= 1) return;
    setMouvementItems(mouvementItems.filter((_, i) => i !== index));
  };

  // Update Item in Current Movement
  const handleUpdateItem = (index, field, value) => {
    const updated = [...mouvementItems];
    updated[index][field] = value;

    if (field === 'ref') {
      const match = unifiedSearchCatalog.find((c) => c.ref === value);
      if (match) {
        updated[index].designation = match.designation;
        updated[index].emplacement = match.emplacement;
        updated[index].unit = match.unit;
        updated[index].source = match.source;
      }
    }
    setMouvementItems(updated);
  };

  // Select Item from Search Modal
  const handleSelectCatalogItem = (catalogItem) => {
    const updated = [...mouvementItems];
    if (updated[targetItemIndex]) {
      updated[targetItemIndex] = {
        ...updated[targetItemIndex],
        source: catalogItem.source,
        ref: catalogItem.ref,
        designation: catalogItem.designation,
        emplacement: catalogItem.emplacement,
        unit: catalogItem.unit,
      };
    }
    setMouvementItems(updated);
    setIsArticleSearchOpen(false);
    setSearchQuery('');
  };

  const getFormValidationState = () => {
    const errors = [];
    let isPristine = true;

    // Check if form is pristine
    if (
      (mouvementItems.length > 1) ||
      (mouvementItems[0] && mouvementItems[0].ref !== '') ||
      form.commentaire.trim() !== '' ||
      form.id_technician !== '' ||
      form.id_machine_registered !== '' ||
      form.id_zone !== '' ||
      form.num_commande !== '' ||
      form.fournisseur !== '' ||
      form.prestataire_externe !== ''
    ) {
      isPristine = false;
    }

    // Validation
    mouvementItems.forEach((item, idx) => {
      if (!item.ref || String(item.ref).trim() === '') {
        errors.push(`Ligne ${idx + 1} : Veuillez sélectionner un article dans le catalogue.`);
      }
      if (!item.quantite || Number(item.quantite) <= 0) {
        errors.push(`Ligne ${idx + 1} : La quantité doit être supérieure à 0.`);
      }
    });

    const isSortie = form.type === 'Sortie Interne';
    const isEntreeEx = form.type === 'Bon de Réception' || form.type === 'Entrée Externe';
    const isSortieEx = form.type === 'Bon de Sortie' || form.type === 'Sortie Externe';

    // Technicien validation
    if (form.action_id !== 'INVENTAIRE' && form.action_id !== 'REAPPRO' && !isSortieEx && form.action_id !== 'USAGE') {
      if (!form.id_technician && !form.technicien) {
        errors.push('Veuillez sélectionner ou saisir un Technicien intervenant.');
      }
    }

    // Sortie Validation
    if (isSortie && form.action_id !== 'USAGE') {
      if (form.destination_type === 'MACHINE' && !form.id_machine_registered) {
        errors.push('Veuillez sélectionner la Machine de destination.');
      }
      if (form.destination_type === 'ZONE' && !form.id_zone) {
        errors.push('Veuillez sélectionner la Zone de destination.');
      }
    }

    // Specific USAGE Validation for 3 Profile Modes (Responsable, Technicien, Opérateur)
    if (isSortie && form.action_id === 'USAGE') {
      const uType = form.usage_type || 'responsable';
      if (uType === 'technician') {
        if (!form.technicien || String(form.technicien).trim() === '') {
          errors.push('Veuillez sélectionner le Technicien demandeur.');
        }
      } else if (uType === 'operation' || uType === 'operator') {
        if (!form.operation || String(form.operation).trim() === '') {
          errors.push('Veuillez sélectionner l’Opérateur demandeur (Obligatoire).');
        }
        if (!form.id_zone || String(form.id_zone).trim() === '') {
          errors.push('Zone d’affectation de l’Opérateur non définie.');
        }
      } else {
        // 'responsable' / 'chef'
        if (!form.operation || String(form.operation).trim() === '') {
          errors.push('Veuillez sélectionner le Responsable demandeur (Obligatoire).');
        }
        if (!form.id_zone || String(form.id_zone).trim() === '') {
          errors.push('Veuillez sélectionner la Zone rattachée au Responsable (Obligatoire).');
        }
      }
    }

    if (isSortieEx) {
      if (!form.prestataire_externe || String(form.prestataire_externe).trim() === '') {
        errors.push('Veuillez préciser le Prestataire Externe (Obligatoire).');
      }
      if (!form.date_retour_prevue || String(form.date_retour_prevue).trim() === '') {
        errors.push('Veuillez définir la Date de Retour Prévue (Obligatoire).');
      }
      if (!form.technicien || String(form.technicien).trim() === '') {
        errors.push('Veuillez sélectionner le Technicien Émetteur de la sortie.');
      }
    }

    if (isEntreeEx) {
      if (!form.fournisseur) {
        errors.push('Veuillez sélectionner ou saisir un Fournisseur.');
      }
    }

    // Collective stock deficit check (aggregated by ref across all lines in the bon)
    if (isSortie || isSortieEx) {
      const requestedByRef = new Map<string, { ref: string; totalQte: number }>();
      for (const item of mouvementItems) {
        const rawRef = String(item.ref || '').trim();
        if (!rawRef) continue;
        const normKey = rawRef.toUpperCase();
        const prev = requestedByRef.get(normKey);
        const qte = Number(item.quantite) || 0;
        requestedByRef.set(normKey, {
          ref: prev ? prev.ref : rawRef,
          totalQte: (prev ? prev.totalQte : 0) + qte,
        });
      }

      for (const { ref, totalQte } of requestedByRef.values()) {
        const match =
          unifiedSearchCatalog.find(
            (c) => String(c.ref || '').trim().toUpperCase() === ref.toUpperCase()
          ) ||
          stockItems.find(
            (s) => String(s.ref || '').trim().toUpperCase() === ref.toUpperCase()
          );
        const currentStock = match
          ? (match.stockActuel ?? match.raw?.stockActuel ?? match.raw?.stockInitial ?? 0)
          : 0;
        if (totalQte > currentStock) {
          errors.push(
            `Stock insuffisant pour [${ref}] (Demandé cumulé: ${totalQte}, Dispo: ${currentStock}).`
          );
        }
      }
    }

    return {
      isPristine,
      isValid: errors.length === 0,
      errors
    };
  };

  const resetForm = () => {
    if (setQuickSortiePreset) setQuickSortiePreset(null);
    setMouvementItems([{ source: form.item_source, ref: '', designation: '', quantite: 1, unit: 'pcs', emplacement: '' }]);
    setForm((prev) => ({
      ...prev,
      num_commande: '',
      is_inconnu: false,
      date: new Date().toISOString().split('T')[0],
      heure: getCurrentTimeStr(),
      id_zone: '',
      id_machine_registered: '',
      id_operation: '',
      id_technician: '',
      technicien: '',
      operation: '',
      fournisseur: '',
      prestataire_externe: '',
      date_retour_prevue: '',
      commentaire: '',
    }));
  };

  // Form Submit Handler (Supports both Classic <form> submit and Wizard onFinish)
  const handleSubmit = (e?: any): boolean => {
    if (e && typeof e.preventDefault === 'function') {
      e.preventDefault();
    }

    if (!user || (!isTechUser && !canCreateMovement)) {
      setValidationErrors([
        "Accès restreint : votre profil ne dispose pas des privilèges requis pour émettre un mouvement de stock.",
      ]);
      setShowValidationAlert(true);
      return false;
    }

    const { isValid, errors } = getFormValidationState();

    if (!isValid) {
      setValidationErrors(errors);
      setShowValidationAlert(true);
      return false;
    }

    // Process valid submission
    const currentTime = form.heure && String(form.heure).trim() !== '' ? form.heure : getCurrentTimeStr();

    // V3 Maker-Checker: When TECHNICIEN submits on SortieRapide, record a SortieDemand (PENDING_VALIDATION) WITHOUT touching mouvements or deducting stock
    if (isTechUser) {
      handleSubmitSortieDemand({
        ...(editingDemandId ? { id: editingDemandId } : {}),
        code_bon_tech: form.code_bon,
        num_commande: form.num_commande ? form.num_commande.trim() : 'SORTIE_TERRAIN',
        date: form.date,
        heure: currentTime,
        type: 'Sortie Interne',
        action_id: form.action_id || 'CORRECTIVE',
        usage_type: 'technician',
        id_zone: form.id_zone,
        id_machine_registered: form.id_machine_registered,
        technicien: techDisplayName || form.technicien || user?.name || 'Technicien',
        id_technician: user?.personnelId || form.id_technician || user?.id || '',
        operation: form.operation,
        id_operation: form.id_operation,
        commentaire: form.commentaire,
        items: mouvementItems,
        submitted_by_id: user?.personnelId || user?.id || form.id_technician || 'tech',
        submitted_by_name: techDisplayName || user?.name || form.technicien || 'Technicien',
      });

      setEditingDemandId(null);
      const nextCode = getNextBonCode(mouvements);
      resetForm();
      setForm((prev) => ({
        ...prev,
        code_bon: nextCode,
      }));
      if (isFloatingFormOpen) {
        setIsFloatingFormOpen(false);
      }
      setShowSuccessAlert(true);
      setTimeout(() => {
        setShowSuccessAlert(false);
      }, 3000);
      return true;
    }

    // Submit movement records for each item in the bon (Admin / Magasinier / Responsable)
    mouvementItems.forEach((item) => {
      const rawOt = form.num_commande ? form.num_commande.trim() : '';
      const finalNumCommande = rawOt !== '' ? rawOt : 'INCONNU';

      const match = unifiedSearchCatalog.find((c) => c.ref === item.ref) || stockItems.find((s) => s.ref === item.ref);
      const stockAvant = match ? (match.stockActuel ?? match.raw?.stockActuel ?? match.raw?.stockInitial ?? 0) : 0;
      const seuilMin = match?.raw?.seuil ?? match?.seuil ?? 5;
      const qteNum = Number(item.quantite) || 1;
      const isSortie = form.type.includes('Sortie') || form.type === 'Bon de Sortie';
      const stockApres = isSortie ? stockAvant - qteNum : stockAvant + qteNum;

      let mvtTech = form.technicien;
      let mvtIdTech = form.id_technician;
      let mvtOp = form.operation;
      let mvtIdOp = form.id_operation;
      let mvtDemandeur = form.demandeur || form.operation || form.technicien || '';
      let mvtZone = form.type.includes('Entrée') ? '' : form.id_zone;
      let mvtUsageType = form.usage_type || 'responsable';

      if (form.action_id === 'USAGE') {
        if (form.usage_type === 'technician') {
          mvtTech = form.technicien;
          mvtIdTech = form.id_technician;
          mvtOp = '';
          mvtIdOp = form.id_technician;
          mvtDemandeur = form.technicien;
          mvtZone = form.id_zone || maintenanceZone.id_zone;
          mvtUsageType = 'technician';
        } else if (form.usage_type === 'operation' || form.usage_type === 'operator') {
          mvtTech = form.operation; // Nom de l'opérateur
          mvtIdTech = form.id_operation;
          mvtOp = form.responsable_validation || form.operation;
          mvtIdOp = form.id_responsable_validation || form.id_operation;
          mvtDemandeur = form.operation;
          mvtZone = form.id_zone;
          mvtUsageType = 'operation';
        } else {
          // Responsable
          mvtTech = form.operation;
          mvtIdTech = form.id_operation;
          mvtOp = form.operation;
          mvtIdOp = form.id_operation;
          mvtDemandeur = form.operation;
          mvtZone = form.id_zone;
          mvtUsageType = 'responsable';
        }
      }

      const mvtRecord = {
        code_bon: form.code_bon,
        num_commande: finalNumCommande,
        date: form.date,
        heure: currentTime,
        timestamp: new Date().toISOString(),
        ref: item.ref,
        designation: item.designation,
        quantite: qteNum,
        stock_avant: stockAvant,
        stock_apres: stockApres,
        seuil_min: seuilMin,
        unit: item.unit || 'pcs',
        source_category: item.source, // 'STOCK_PDR' | 'WAREHOUSE_PARTIE' | 'WAREHOUSE_COMPOSANT'
        destination_category: isBonSortie ? 'PRESTATAIRE_EXTERNE' : form.destination_type,
        type: form.type,
        action_id: form.action_id,
        usage_type: mvtUsageType,
        id_zone: form.type.includes('Entrée') ? '' : mvtZone,
        id_machine_registered: form.type.includes('Entrée') ? '' : form.id_machine_registered,
        technicien: mvtTech,
        id_technician: mvtIdTech,
        operation: form.type.includes('Entrée') ? '' : mvtOp,
        id_operation: mvtIdOp,
        demandeur: mvtDemandeur,
        fournisseur: isBonSortie ? form.prestataire_externe : form.fournisseur,
        prestataire_externe: isBonSortie ? form.prestataire_externe : (form.prestataire_externe || ''),
        emplacement_reception: form.emplacement_reception,
        commentaire: form.commentaire,
        date_retour_prevue: form.date_retour_prevue,
        entrepot_etat: form.entrepot_etat,
      };

      if (onAddMouvement) {
        onAddMouvement(mvtRecord);
      }

      // N4: If this is a Sortie destined for a Machine, auto-update the Machine BOM Ledger (reset hours, installation date, status)
      if (isSortie && form.id_machine_registered && machineElementsLedger && updateMachineElement) {
        const { updatedElement } = applyReplacementMovementToLedger(machineElementsLedger, {
          id_machine_registered: form.id_machine_registered,
          ref: item.ref,
          date: form.date || new Date().toISOString().slice(0, 10),
          technicien: mvtTech,
          ledgerElementId:
            quickSortiePreset && String(quickSortiePreset.ref || '').trim().toUpperCase() === String(item.ref || '').trim().toUpperCase()
              ? quickSortiePreset.ledgerElementId
              : undefined,
        });
        if (updatedElement) {
          updateMachineElement(updatedElement.id, updatedElement);
        }
      }

      // If this is an Entrée Interne directly to Entrepôt, synchronize or track with warehouse
      if (isEntreeInterne && isWarehouseDest && onAddWarehouseItem) {
        // Find if item already exists in warehouse
        const existingWh = warehouseItems.find((w) => w.id_warehouse_item === item.ref || w.code === item.ref);
        if (existingWh && onUpdateWarehouseItem) {
          onUpdateWarehouseItem(existingWh.id, {
            ...existingWh,
            quantite: (Number(existingWh.quantite) || 0) + Number(item.quantite),
            emplacement: form.emplacement_reception || existingWh.emplacement,
            etat: form.entrepot_etat || existingWh.etat,
          });
        }
      }
    });

    // Reset Form to Next Bon
    const nextCode = getNextBonCode(mouvements);
    resetForm();
    setForm((prev) => ({
      ...prev,
      code_bon: nextCode,
    }));
    
    if (isFloatingFormOpen) {
      setIsFloatingFormOpen(false);
    }

    setShowSuccessAlert(true);
    setTimeout(() => {
      setShowSuccessAlert(false);
    }, 3000);
    return true;
  };

  // Convert Pending Commande / Demande to Entrée Externe in 1 click
  const handleFulfillOrder = (order) => {
    if (!canCreateMovement) return;
    setForm((prev) => ({
      ...prev,
      type: 'Entrée Externe',
      action_id: 'REAPPRO',
      num_commande: order.num_commande || order.code_bon,
      fournisseur: order.fournisseur || 'Fournisseur Central',
      commentaire: `Réception de la commande ${order.num_commande || order.code_bon}`,
    }));
    setMouvementItems([
      {
        source: order.source_category || 'STOCK_PDR',
        ref: order.ref,
        designation: order.designation || '',
        quantite: order.quantite || 1,
        unit: order.unit || 'pcs',
        emplacement: form.emplacement_reception,
      },
    ]);
    setActiveSubTab('JOURNAL');
    if (viewMode === 'JOURNAL') {
      setIsFloatingFormOpen(true);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Convert External Repair Return to Entrée Externe in 1 click
  const handleReceiveRepairReturn = (repairMvt) => {
    if (!canCreateMovement) return;
    setForm((prev) => ({
      ...prev,
      type: 'Entrée Externe',
      action_id: 'RETOUR',
      num_commande: repairMvt.code_bon,
      fournisseur: repairMvt.fournisseur || 'Prestataire Externe',
      commentaire: `Retour après réparation/bobinage de ${repairMvt.ref} (${repairMvt.code_bon})`,
    }));
    setMouvementItems([
      {
        source: repairMvt.source_category || 'WAREHOUSE_PARTIE',
        ref: repairMvt.ref,
        designation: repairMvt.designation || '',
        quantite: repairMvt.quantite || 1,
        unit: repairMvt.unit || 'pcs',
        emplacement: 'Entrepôt - Atelier Révisé',
      },
    ]);
    setActiveSubTab('JOURNAL');
    if (viewMode === 'JOURNAL') {
      setIsFloatingFormOpen(true);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <AnimatedPage>
      {/* Alert Modals */}
      <SortieSuccessAlertModal open={showSuccessAlert} />
      <SortieValidationAlertModal
        open={showValidationAlert}
        errors={validationErrors}
        onClose={() => setShowValidationAlert(false)}
      />

      {/* Top Banner (BDR Light GMAO Header Card with 3D Tactile Elevation) */}
      <div className="bg-white p-5 md:p-6 rounded-2xl border border-slate-200/90 shadow-[0_12px_32px_-6px_rgba(0,0,0,0.12),0_4px_12px_-2px_rgba(0,0,0,0.06)] hover:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.16),0_6px_16px_-3px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-300 ease-out flex flex-col xl:flex-row xl:items-center xl:justify-between gap-5 relative overflow-hidden group/header">
        {/* Subtle Ambient Gradient Background Highlight */}
        <div className="absolute -top-12 -right-12 w-48 h-48 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none group-hover/header:bg-indigo-500/10 transition-colors duration-500" />

        <div className="min-w-0 flex-1 flex items-start sm:items-center gap-3.5 relative">
          {/* Pure Header Icon */}
          <SortieEntreeIcon className="w-7 h-7 text-indigo-600 shrink-0 group-hover/header:scale-110 transition-transform duration-300" />
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-xl font-black text-slate-900 tracking-tight">
                {isTechUser
                  ? 'Mes Mouvements & Sorties PDR Validées'
                  : 'Gestion des Mouvements & Bons Industriels (3 Catégories & 5 Flux)'}
              </h2>
              {isTechUser && (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-2xs">
                  Registre Personnel · {techBadgeLabel}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1 max-w-3xl leading-relaxed">
              {isTechUser ? (
                <span>
                  Consultation des bons de sortie validés à votre nom ({scopedMouvements.length} bon(s)). Les déclarations de pièces PDR s&apos;effectuent directement dans vos <b>Bons de Travail (Correctif)</b> ou <b>Exécutions Préventives</b>.
                </span>
              ) : (
                <>
                  <b>Interne</b> (PDR + Parties + Composants) • <b>Bon de Sortie</b> (Réparation Externe) • <b>Externe</b> (Achats & Réappro)
                </>
              )}
            </p>
          </div>
        </div>

        {/* Right Column: Action Buttons at Top, Segmented Navigation SubTabs Below */}
        {!isTechUser && (
        <div className="flex flex-col items-stretch sm:items-end gap-2.5 shrink-0 relative">
          {/* Top Row: Formulas Modal Button & Smart Circular 3D Switch Action Buttons */}
          <div className="flex items-center justify-end gap-2">
            <FormulasModalButton
              onClick={() => setShowFormulasModal(true)}
              title="Formules Excel (Journal Mouvements)"
            />

            {/* Smart Circular 3D Action Switch Buttons */}
            {effectiveSubTab === 'JOURNAL' && (
              <div className="flex items-center gap-2">
                {/* 1. Toggle Split View <-> Full Table Dedicated View */}
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={`split-toggle-${viewMode === 'SPLIT' ? 'split' : 'solo'}`}
                    initial={{ scale: 0.82, rotate: -12, opacity: 0 }}
                    animate={{ scale: 1, rotate: 0, opacity: 1 }}
                    exit={{ scale: 0.82, rotate: 12, opacity: 0 }}
                    transition={{ duration: 0.18, ease: 'easeOut' }}
                  >
                    <Action3DButton
                      variant="circle"
                      color={viewMode === 'SPLIT' ? 'indigo' : 'blue'}
                      icon={viewMode === 'SPLIT' ? Maximize2 : Columns2}
                      onClick={handleToggleSplitSolo}
                      title={
                        viewMode === 'SPLIT'
                          ? 'Agrandir le Journal en Plein Écran (Vue Dédiée)'
                          : 'Revenir à la Vue Scindée (Formulaire & Journal)'
                      }
                    />
                  </motion.div>
                </AnimatePresence>

                {/* 2. Quick Action: Floating Form Card Trigger (Active in Full Table Mode) */}
                {viewMode === 'JOURNAL' && (
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.div
                      key={`floating-form-action-${isFloatingFormOpen ? 'open' : 'closed'}`}
                      initial={{ scale: 0.82, rotate: -12, opacity: 0 }}
                      animate={{ scale: 1, rotate: 0, opacity: 1 }}
                      exit={{ scale: 0.82, rotate: 12, opacity: 0 }}
                      transition={{ duration: 0.18, ease: 'easeOut' }}
                    >
                      <Action3DButton
                        variant="circle"
                        color={isFloatingFormOpen ? 'emerald' : 'indigo'}
                        icon={Receipt}
                        showAddBadge={!isFloatingFormOpen}
                        onClick={() => setIsFloatingFormOpen((prev) => !prev)}
                        title={
                          isFloatingFormOpen
                            ? 'Fermer le formulaire flottant'
                            : 'Nouveau Bon de Mouvement (Ouvrir Formulaire Flottant)'
                        }
                      />
                    </motion.div>
                  </AnimatePresence>
                )}
              </div>
            )}
          </div>

          {/* Bottom Row: Main Navigation SubTabs (Mouvements | Commandes | Réparation) */}
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
            <div className="inline-flex items-center p-1 bg-slate-100/90 rounded-2xl border border-slate-200/90 shadow-2xs select-none">
              <button
                type="button"
                onClick={() => setActiveSubTab('JOURNAL')}
                className={`py-1.5 px-3.5 rounded-xl text-xs font-bold transition-all duration-200 flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
                  activeSubTab === 'JOURNAL'
                    ? 'bg-white text-indigo-950 shadow-[0_2px_8px_rgba(0,0,0,0.08)] border border-slate-200/60'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50 border border-transparent'
                }`}
              >
                <FileSpreadsheet className={`w-3.5 h-3.5 shrink-0 ${activeSubTab === 'JOURNAL' ? 'text-indigo-600' : 'text-slate-500'}`} />
                <span>Mouvements</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveSubTab('VALIDATION_TERRAIN')}
                className={`py-1.5 px-3.5 rounded-xl text-xs font-bold transition-all duration-200 flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
                  activeSubTab === 'VALIDATION_TERRAIN'
                    ? 'bg-purple-700 text-white shadow-sm border border-purple-900'
                    : 'text-purple-800 hover:bg-purple-100/70 border border-transparent'
                }`}
              >
                <ShieldCheck
                  className={`w-3.5 h-3.5 shrink-0 ${
                    activeSubTab === 'VALIDATION_TERRAIN' ? 'text-purple-100' : 'text-purple-600'
                  }`}
                />
                <span>À Valider Terrain ({pendingSortieDemands.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveSubTab('COMMANDES')}
                className={`py-1.5 px-3.5 rounded-xl text-xs font-bold transition-all duration-200 flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
                  activeSubTab === 'COMMANDES'
                    ? 'bg-white text-amber-950 shadow-[0_2px_8px_rgba(0,0,0,0.08)] border border-slate-200/60'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50 border border-transparent'
                }`}
              >
                <ShoppingCart className={`w-3.5 h-3.5 shrink-0 ${activeSubTab === 'COMMANDES' ? 'text-amber-600' : 'text-slate-500'}`} />
                <span>Commandes ({pendingOrders.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveSubTab('REPARATION_EXTERNE')}
                className={`py-1.5 px-3.5 rounded-xl text-xs font-bold transition-all duration-200 flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
                  activeSubTab === 'REPARATION_EXTERNE'
                    ? 'bg-purple-900 text-white shadow-sm border border-purple-950'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50 border border-transparent'
                }`}
              >
                <Truck className={`w-3.5 h-3.5 shrink-0 ${activeSubTab === 'REPARATION_EXTERNE' ? 'text-purple-200' : 'text-purple-600'}`} />
                <span>Sortie Externe Bobinage</span>
              </button>
            </div>
          </div>
        </div>
        )}
      </div>

      {/* V3+V4 Admin Alert Banner when Technician Sortie Demands are waiting for approval */}
      {!isTechUser && pendingSortieDemands.length > 0 && effectiveSubTab !== 'VALIDATION_TERRAIN' && (
        <div
          data-testid="admin-sortie-demands-banner"
          className="mt-4 bg-purple-50/90 border border-purple-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-purple-950 shadow-2xs"
        >
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-5 h-5 text-purple-600 shrink-0" />
            <div>
              <span className="font-black uppercase tracking-wider">
                {pendingSortieDemands.length} Demande(s) de Sortie Terrain en attente de validation Magasin :
              </span>{' '}
              <span>
                Contrôlez la concordance N° Bon Technicien × N° Bon Magasin avant d&apos;engager la déduction du stock.
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setActiveSubTab('VALIDATION_TERRAIN')}
            className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shrink-0 cursor-pointer transition"
          >
            Ouvrir la file d&apos;attente ({pendingSortieDemands.length})
          </button>
        </div>
      )}

      {isTechUser && (
        <div
          data-testid="tech-movements-read-only-banner"
          className="mt-4 bg-indigo-50/90 border border-indigo-200 rounded-2xl p-4 flex items-center gap-3 text-xs text-indigo-950 shadow-2xs"
        >
          <ShieldCheck className="w-5 h-5 text-indigo-600 shrink-0" />
          <div>
            <span className="font-black uppercase tracking-wider">
              Canal de Demande de Sortie PDR (Maker-Checker V3) :
            </span>{' '}
            <span>
              En tant que technicien ({techBadgeLabel}), toute sortie saisie ici est enregistrée comme <b>Demande de Sortie Terrain (PENDING_VALIDATION)</b> sans déduction immédiate du stock. Le Magasinier / Responsable valide ou réconcilie votre N° de bon pour générer le mouvement officiel.
            </span>
          </div>
        </div>
      )}

      {/* SUB-VIEWS & MAIN CONTENT WITH FLUID MOTION ANIMATIONS */}
      <AnimatePresence mode="wait">
        {/* SUB-VIEW 1: PENDING ORDERS / COMMANDES BACKLOG */}
        {effectiveSubTab === 'COMMANDES' && (
          <PendingOrdersSubTab
            pendingOrders={pendingOrders}
            onFulfillOrder={handleFulfillOrder}
          />
        )}

        {/* SUB-VIEW 2: SORTIE EXTERNE BOBINAGE & RÉPARATION FLUX COMPLET */}
        {effectiveSubTab === 'REPARATION_EXTERNE' && (
          <motion.div
            key="subtab-reparation"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
          >
            <SortieExterneBobinageTab
              sorties={sortiesExterne}
              onAddSortie={onAddSortieExterne}
              onUpdateSortie={onUpdateSortieExterne}
              onDeleteSortie={onDeleteSortieExterne}
              onMarkSortieReturned={onMarkSortieReturned}
              onMarkSortieMounted={onMarkSortieMounted}
              onClearSortiesForRealFactory={onClearSortiesForRealFactory}
              onResetSortiesToBaseline={onResetSortiesToBaseline}
              machines={machines}
              warehouseItems={warehouseItems}
              technicians={technicians}
              onAddMouvement={onAddMouvement}
              showToast={showToast}
            />
          </motion.div>
        )}

        {/* SUB-VIEW 0: VALIDATION TERRAIN (V3 + V4 SortieDemands Queue for Admin / Magasinier) */}
        {effectiveSubTab === 'VALIDATION_TERRAIN' && (
          <ValidationTerrainQueueSubTab
            storeSortieDemands={storeSortieDemands}
            stockItems={stockItems}
            mouvements={mouvements}
            correctiveInterventions={storeCorrectiveInterventions}
            preventiveExecutions={storePreventiveExecutions}
            onOpenReviewModal={handleOpenReviewDemandModal}
          />
        )}

        {/* MAIN VIEW: FORM & JOURNAL TABLE ACCORDING TO VIEW MODE */}
        {effectiveSubTab === 'JOURNAL' && (
          <motion.div
            key={`journal-view-mode-${viewMode}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
          >
            <div className={viewMode === 'SPLIT' ? 'grid grid-cols-1 lg:grid-cols-12 gap-4 items-start' : 'w-full'}>
              {/* Form Container: Left Sticky Column in SPLIT mode, or Floating Card in JOURNAL mode */}
              {(viewMode === 'SPLIT' || isFloatingFormOpen) && (
                <FormContainerWrapper
                  isFloating={viewMode === 'JOURNAL'}
                  isWizardMode={isWizardMode}
                  onClose={() => setIsFloatingFormOpen(false)}
                >
                  <div className="flex flex-col gap-3 border-b border-slate-100 pb-3.5">
                    <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <Receipt className="w-5 h-5 text-indigo-600 shrink-0" />
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-extrabold text-sm text-slate-900 tracking-tight">
                              {isTechUser
                                ? editingDemandId
                                  ? 'Correction de Demande de Sortie PDR'
                                  : 'Demande de Sortie PDR Terrain (Sans Déstockage Immédiat)'
                                : 'Émission de Bon de Mouvement'}
                            </h3>
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold border ${
                                isWizardMode
                                  ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                  : 'bg-slate-100 text-slate-600 border-slate-200'
                              }`}
                            >
                              {isWizardMode ? 'MODE WIZARD (3 ÉTAPES)' : 'MODE CLASSIQUE'}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500">
                            {isTechUser
                              ? 'Saisissez votre N° de bon terrain et les pièces demandées pour validation Magasin'
                              : isWizardMode
                                ? 'Saisie guidée étape par étape avec contrôle de stock intégré'
                                : 'Sélectionnez le type de flux et les articles concernés'}
                          </p>
                        </div>
                      </div>
                      <div className="w-full xl:w-56 shrink-0">
                        <SequentialCodePicker
                          prefix="Bon-"
                          currentCode={form.code_bon}
                          onChangeCode={(newCode) => setForm((prev) => ({ ...prev, code_bon: newCode }))}
                          autoGeneratedCode={autoBonCode}
                          takenNumbers={takenBonNumbers}
                          padLength={3}
                          label="N° Bon de Mouvement (A)"
                          helperText="Code séquentiel ou libre"
                        />
                      </div>
                    </div>

                    {/* Feature Flag Toggle Bar: Formulaire Classique <-> Assistant Wizard */}
                    <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-slate-50/90 border border-slate-200/80">
                      <div className="flex items-center gap-2 min-w-0">
                        <Layers className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                        <span className="text-[11px] font-bold text-slate-700 truncate">
                          Mode de Saisie du Bon :
                        </span>
                      </div>
                      <div
                        role="group"
                        aria-label="Sélecteur de mode de saisie"
                        className="inline-flex items-center p-0.5 rounded-lg bg-white border border-slate-200/90 shadow-2xs shrink-0"
                      >
                        <button
                          type="button"
                          onClick={() => setWizardModuleEnabled('stock_rapid_movement', false)}
                          className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                            !isWizardMode
                              ? 'bg-slate-900 text-white shadow-2xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          Formulaire Classique
                        </button>
                        <button
                          type="button"
                          onClick={() => setWizardModuleEnabled('stock_rapid_movement', true)}
                          className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer ${
                            isWizardMode
                              ? 'bg-indigo-600 text-white shadow-2xs'
                              : 'text-slate-600 hover:text-indigo-700'
                          }`}
                        >
                          <Sparkles className="w-3 h-3" />
                          <span>Assistant Wizard</span>
                        </button>
                      </div>
                    </div>
                  </div>

          {(() => {
            const step1FluxSection = (
              <div className="space-y-4">
            {/* 1. FLOW TYPE SELECTOR (5 Operational Flows categorized under 3 Philosophies) */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Type de Flux Industriel (5 Types)
              </label>

              <div className="grid grid-cols-2 gap-1.5">
                {/* 1. Sortie Interne */}
                <button
                  type="button"
                  onClick={() => handleTypeChange('Sortie Interne')}
                  className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                    isSortieInterne
                      ? 'bg-rose-50 border-rose-400 text-rose-950 font-bold ring-2 ring-rose-500/20 shadow-2xs'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold flex items-center gap-1.5">
                      <TrendingDown className="w-3.5 h-3.5 text-rose-600" />
                      <span>Sortie Interne</span>
                    </span>
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-rose-200 text-rose-800 font-bold">INTERNE</span>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Stock/Entrepôt → Machine/Zone</div>
                </button>

                {/* 2. Entrée Interne */}
                <button
                  type="button"
                  onClick={() => handleTypeChange('Entrée Interne')}
                  className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                    isEntreeInterne
                      ? 'bg-cyan-50 border-cyan-400 text-cyan-950 font-bold ring-2 ring-cyan-500/20 shadow-2xs'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold flex items-center gap-1.5">
                      <TrendingUp className="w-3.5 h-3.5 text-cyan-600" />
                      <span>Entrée Interne</span>
                    </span>
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-cyan-200 text-cyan-800 font-bold">INTERNE</span>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Machine/Atelier → Stock/Entrepôt</div>
                </button>

                {/* 3. Bon de Sortie (Réparation Externe) */}
                <button
                  type="button"
                  onClick={() => handleTypeChange('Bon de Sortie')}
                  className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                    isBonSortie
                      ? 'bg-purple-50 border-purple-400 text-purple-950 font-bold ring-2 ring-purple-500/20 shadow-2xs'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold flex items-center gap-1.5">
                      <Truck className="w-3.5 h-3.5 text-purple-600" />
                      <span>Bon de Sortie</span>
                    </span>
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-purple-200 text-purple-800 font-bold">EXTERNE</span>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Entrepôt → Réparation Externe (Truck)</div>
                </button>

                {/* 4. Entrée Externe */}
                <button
                  type="button"
                  onClick={() => handleTypeChange('Entrée Externe')}
                  className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                    isEntreeExterne
                      ? 'bg-emerald-50 border-emerald-400 text-emerald-950 font-bold ring-2 ring-emerald-500/20 shadow-2xs'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold flex items-center gap-1.5">
                      <Inbox className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Entrée Externe</span>
                    </span>
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-200 text-emerald-800 font-bold">EXTERNE</span>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Fournisseur/Retour Réparation → Stock</div>
                </button>

                {/* 5. COMMANDE / Demandes d'Achat */}
                <button
                  type="button"
                  onClick={() => handleTypeChange('COMMANDE')}
                  className={`p-2.5 rounded-xl border text-left transition cursor-pointer col-span-2 ${
                    isCommandeFlow
                      ? 'bg-amber-50 border-amber-400 text-amber-950 font-bold ring-2 ring-amber-500/20 shadow-2xs'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold flex items-center gap-1.5">
                      <ShoppingCart className="w-3.5 h-3.5 text-amber-600" />
                      <span>Demande d'Achat & Approvisionnement (COMMANDE)</span>
                    </span>
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-amber-200 text-amber-800 font-bold">ACHAT</span>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Demande d'achat de PDR, Composants ou Parties en attente</div>
                </button>
              </div>
            </div>

            {/* 2. DYNAMIC ITEM SOURCE SELECTOR FOR SORTIE INTERNE */}
            {isSortieInterne && (
              <div className="p-3 bg-slate-50/90 rounded-xl border border-slate-200 space-y-2">
                <label className="text-[10.5px] font-bold text-slate-700 uppercase tracking-wider block flex items-center gap-1.5">
                  <Boxes className="w-3.5 h-3.5 text-slate-600" />
                  <span>Source de l'Article à Sortir :</span>
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setForm({ ...form, item_source: 'STOCK_PDR' });
                      setMouvementItems(mouvementItems.map((i) => ({ ...i, source: 'STOCK_PDR' })));
                    }}
                    className={`py-2 px-2 rounded-xl text-xs font-bold transition border cursor-pointer flex items-center justify-center gap-1.5 ${
                      form.item_source === 'STOCK_PDR'
                        ? 'bg-emerald-50 border-emerald-400 text-emerald-950 font-bold ring-2 ring-emerald-500/20 shadow-2xs'
                        : 'bg-white/90 text-slate-700 border-slate-200 hover:bg-emerald-50/40 hover:border-emerald-200 hover:text-emerald-900'
                    }`}
                  >
                    <Package className={`w-3.5 h-3.5 ${form.item_source === 'STOCK_PDR' ? 'text-emerald-600' : 'text-emerald-600/80'}`} />
                    <span>PDR (Stock)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setForm({ ...form, item_source: 'WAREHOUSE_PARTIE' });
                      setMouvementItems(mouvementItems.map((i) => ({ ...i, source: 'WAREHOUSE_PARTIE' })));
                    }}
                    className={`py-2 px-2 rounded-xl text-xs font-bold transition border cursor-pointer flex items-center justify-center gap-1.5 ${
                      form.item_source === 'WAREHOUSE_PARTIE'
                        ? 'bg-purple-50 border-purple-400 text-purple-950 font-bold ring-2 ring-purple-500/20 shadow-2xs'
                        : 'bg-white/90 text-slate-700 border-slate-200 hover:bg-purple-50/40 hover:border-purple-200 hover:text-purple-900'
                    }`}
                  >
                    <Layers className={`w-3.5 h-3.5 ${form.item_source === 'WAREHOUSE_PARTIE' ? 'text-purple-600' : 'text-purple-600/80'}`} />
                    <span>PARTIE (Entrepôt)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setForm({ ...form, item_source: 'WAREHOUSE_COMPOSANT' });
                      setMouvementItems(mouvementItems.map((i) => ({ ...i, source: 'WAREHOUSE_COMPOSANT' })));
                    }}
                    className={`py-2 px-2 rounded-xl text-xs font-bold transition border cursor-pointer flex items-center justify-center gap-1.5 ${
                      form.item_source === 'WAREHOUSE_COMPOSANT'
                        ? 'bg-indigo-50 border-indigo-400 text-indigo-950 font-bold ring-2 ring-indigo-500/20 shadow-2xs'
                        : 'bg-white/90 text-slate-700 border-slate-200 hover:bg-indigo-50/40 hover:border-indigo-200 hover:text-indigo-900'
                    }`}
                  >
                    <Puzzle className={`w-3.5 h-3.5 ${form.item_source === 'WAREHOUSE_COMPOSANT' ? 'text-indigo-600' : 'text-indigo-600/80'}`} />
                    <span>COMPOSANT</span>
                  </button>
                </div>
              </div>
            )}

            {/* 3. DYNAMIC DESTINATION SELECTOR FOR ENTRÉE INTERNE */}
            {isEntreeInterne && (
              <div className="p-3 bg-cyan-50/50 rounded-xl border border-cyan-200 space-y-2">
                <label className="text-[10.5px] font-bold text-cyan-950 uppercase tracking-wider block flex items-center gap-1.5">
                  <RotateCcw className="w-3.5 h-3.5 text-cyan-700" />
                  <span>Destination de l'Entrée / Remise :</span>
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setForm({ ...form, destination_type: 'STOCK_PDR', item_source: 'STOCK_PDR' });
                      setMouvementItems(mouvementItems.map((i) => ({ ...i, source: 'STOCK_PDR' })));
                    }}
                    className={`py-2 px-2 rounded-xl text-xs font-bold transition border cursor-pointer flex items-center justify-center gap-1.5 ${
                      form.destination_type === 'STOCK_PDR'
                        ? 'bg-cyan-50 border-cyan-400 text-cyan-950 font-bold ring-2 ring-cyan-500/20 shadow-2xs'
                        : 'bg-white/90 text-slate-700 border-slate-200 hover:bg-cyan-50/40 hover:border-cyan-200 hover:text-cyan-900'
                    }`}
                  >
                    <Package className={`w-3.5 h-3.5 ${form.destination_type === 'STOCK_PDR' ? 'text-cyan-600' : 'text-cyan-600/80'}`} />
                    <span>Magasin PDR</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setForm({ ...form, destination_type: 'WAREHOUSE_PARTIE', item_source: 'WAREHOUSE_PARTIE' });
                      setMouvementItems(mouvementItems.map((i) => ({ ...i, source: 'WAREHOUSE_PARTIE' })));
                    }}
                    className={`py-2 px-2 rounded-xl text-xs font-bold transition border cursor-pointer flex items-center justify-center gap-1.5 ${
                      form.destination_type === 'WAREHOUSE_PARTIE'
                        ? 'bg-purple-50 border-purple-400 text-purple-950 font-bold ring-2 ring-purple-500/20 shadow-2xs'
                        : 'bg-white/90 text-slate-700 border-slate-200 hover:bg-purple-50/40 hover:border-purple-200 hover:text-purple-900'
                    }`}
                  >
                    <Layers className={`w-3.5 h-3.5 ${form.destination_type === 'WAREHOUSE_PARTIE' ? 'text-purple-600' : 'text-purple-600/80'}`} />
                    <span>Entrepôt: PARTIE</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setForm({ ...form, destination_type: 'WAREHOUSE_COMPOSANT', item_source: 'WAREHOUSE_COMPOSANT' });
                      setMouvementItems(mouvementItems.map((i) => ({ ...i, source: 'WAREHOUSE_COMPOSANT' })));
                    }}
                    className={`py-2 px-2 rounded-xl text-xs font-bold transition border cursor-pointer flex items-center justify-center gap-1.5 ${
                      form.destination_type === 'WAREHOUSE_COMPOSANT'
                        ? 'bg-indigo-50 border-indigo-400 text-indigo-950 font-bold ring-2 ring-indigo-500/20 shadow-2xs'
                        : 'bg-white/90 text-slate-700 border-slate-200 hover:bg-indigo-50/40 hover:border-indigo-200 hover:text-indigo-900'
                    }`}
                  >
                    <Puzzle className={`w-3.5 h-3.5 ${form.destination_type === 'WAREHOUSE_COMPOSANT' ? 'text-indigo-600' : 'text-indigo-600/80'}`} />
                    <span>Entrepôt: COMPOSANT</span>
                  </button>
                </div>
              </div>
            )}

            {/* 4. DYNAMIC SOURCE SELECTOR FOR BON DE SORTIE (Parts & Components strictly, with exception PDR Haute Valeur) */}
            {isBonSortie && (
              <div className="p-3 bg-purple-50/50 rounded-xl border border-purple-200 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[10.5px] font-bold text-purple-950 uppercase tracking-wider block flex items-center gap-1.5">
                    <Truck className="w-3.5 h-3.5 text-purple-700" />
                    <span>Source Matériel (Entrepôt Sortant) :</span>
                  </label>
                  <span className="text-[10px] text-purple-700 font-semibold italic">
                    Priorité : PARTIE & COMPOSANT
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setForm({ ...form, item_source: 'WAREHOUSE_PARTIE' });
                      setMouvementItems(mouvementItems.map((i) => ({ ...i, source: 'WAREHOUSE_PARTIE' })));
                    }}
                    className={`py-2 px-2 rounded-xl text-xs font-bold transition border cursor-pointer flex items-center justify-center gap-1.5 ${
                      form.item_source === 'WAREHOUSE_PARTIE'
                        ? 'bg-purple-50 border-purple-400 text-purple-950 font-bold ring-2 ring-purple-500/20 shadow-2xs'
                        : 'bg-white/90 text-slate-700 border-slate-200 hover:bg-purple-50/40 hover:border-purple-200 hover:text-purple-900'
                    }`}
                  >
                    <Layers className={`w-3.5 h-3.5 ${form.item_source === 'WAREHOUSE_PARTIE' ? 'text-purple-600' : 'text-purple-600/80'}`} />
                    <span className="truncate">PARTIE (Organe)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setForm({ ...form, item_source: 'WAREHOUSE_COMPOSANT' });
                      setMouvementItems(mouvementItems.map((i) => ({ ...i, source: 'WAREHOUSE_COMPOSANT' })));
                    }}
                    className={`py-2 px-2 rounded-xl text-xs font-bold transition border cursor-pointer flex items-center justify-center gap-1.5 ${
                      form.item_source === 'WAREHOUSE_COMPOSANT'
                        ? 'bg-indigo-50 border-indigo-400 text-indigo-950 font-bold ring-2 ring-indigo-500/20 shadow-2xs'
                        : 'bg-white/90 text-slate-700 border-slate-200 hover:bg-indigo-50/40 hover:border-indigo-200 hover:text-indigo-900'
                    }`}
                  >
                    <Puzzle className={`w-3.5 h-3.5 ${form.item_source === 'WAREHOUSE_COMPOSANT' ? 'text-indigo-600' : 'text-indigo-600/80'}`} />
                    <span className="truncate">COMPOSANT (Moteur...)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setForm({ ...form, item_source: 'STOCK_PDR' });
                      setMouvementItems(mouvementItems.map((i) => ({ ...i, source: 'STOCK_PDR' })));
                    }}
                    className={`py-2 px-2 rounded-xl text-xs font-bold transition border cursor-pointer flex items-center justify-center gap-1.5 ${
                      form.item_source === 'STOCK_PDR'
                        ? 'bg-amber-50 border-amber-400 text-amber-950 font-bold ring-2 ring-amber-500/20 shadow-2xs'
                        : 'bg-white/90 text-slate-700 border-slate-200 hover:bg-amber-50/40 hover:border-amber-200 hover:text-amber-900'
                    }`}
                    title="Exception PDR de haute valeur (Carte électronique, automate)"
                  >
                    <Package className={`w-3.5 h-3.5 ${form.item_source === 'STOCK_PDR' ? 'text-amber-600' : 'text-amber-600/80'}`} />
                    <span className="truncate">PDR (Exception)</span>
                  </button>
                </div>
              </div>
            )}

            {/* 5. DYNAMIC TARGET SELECTOR FOR DEMANDE D'ACHAT (PDR, Components, Parts) */}
            {isCommandeFlow && (
              <div className="p-3 bg-amber-50/50 rounded-xl border border-amber-200 space-y-2">
                <label className="text-[10.5px] font-bold text-amber-950 uppercase tracking-wider block flex items-center gap-1.5">
                  <ShoppingCart className="w-3.5 h-3.5 text-amber-700" />
                  <span>Catégorie de la Demande d'Achat :</span>
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setForm({ ...form, item_source: 'STOCK_PDR' });
                      setMouvementItems(mouvementItems.map((i) => ({ ...i, source: 'STOCK_PDR' })));
                    }}
                    className={`py-2 px-2 rounded-xl text-xs font-bold transition border cursor-pointer flex items-center justify-center gap-1.5 ${
                      form.item_source === 'STOCK_PDR'
                        ? 'bg-amber-50 border-amber-400 text-amber-950 font-bold ring-2 ring-amber-500/20 shadow-2xs'
                        : 'bg-white/90 text-slate-700 border-slate-200 hover:bg-amber-50/40 hover:border-amber-200 hover:text-amber-900'
                    }`}
                  >
                    <Package className={`w-3.5 h-3.5 ${form.item_source === 'STOCK_PDR' ? 'text-amber-600' : 'text-amber-600/80'}`} />
                    <span>PDR (Stock)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setForm({ ...form, item_source: 'WAREHOUSE_PARTIE' });
                      setMouvementItems(mouvementItems.map((i) => ({ ...i, source: 'WAREHOUSE_PARTIE' })));
                    }}
                    className={`py-2 px-2 rounded-xl text-xs font-bold transition border cursor-pointer flex items-center justify-center gap-1.5 ${
                      form.item_source === 'WAREHOUSE_PARTIE'
                        ? 'bg-purple-50 border-purple-400 text-purple-950 font-bold ring-2 ring-purple-500/20 shadow-2xs'
                        : 'bg-white/90 text-slate-700 border-slate-200 hover:bg-purple-50/40 hover:border-purple-200 hover:text-purple-900'
                    }`}
                  >
                    <Layers className={`w-3.5 h-3.5 ${form.item_source === 'WAREHOUSE_PARTIE' ? 'text-purple-600' : 'text-purple-600/80'}`} />
                    <span>PARTIE (Entrepôt)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setForm({ ...form, item_source: 'WAREHOUSE_COMPOSANT' });
                      setMouvementItems(mouvementItems.map((i) => ({ ...i, source: 'WAREHOUSE_COMPOSANT' })));
                    }}
                    className={`py-2 px-2 rounded-xl text-xs font-bold transition border cursor-pointer flex items-center justify-center gap-1.5 ${
                      form.item_source === 'WAREHOUSE_COMPOSANT'
                        ? 'bg-indigo-50 border-indigo-400 text-indigo-950 font-bold ring-2 ring-indigo-500/20 shadow-2xs'
                        : 'bg-white/90 text-slate-700 border-slate-200 hover:bg-indigo-50/40 hover:border-indigo-200 hover:text-indigo-900'
                    }`}
                  >
                    <Puzzle className={`w-3.5 h-3.5 ${form.item_source === 'WAREHOUSE_COMPOSANT' ? 'text-indigo-600' : 'text-indigo-600/80'}`} />
                    <span>COMPOSANT</span>
                  </button>
                </div>
              </div>
            )}

            {/* 6. DYNAMIC CATEGORY & RETURN TRACKER SELECTOR FOR ENTRÉE EXTERNE (PDR, Components, Parts) */}
            {isEntreeExterne && (
              <div className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-200 space-y-2.5">
                <label className="text-[10.5px] font-bold text-emerald-950 uppercase tracking-wider block flex items-center gap-1.5">
                  <Inbox className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Catégorie de Réception / Destination :</span>
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setForm({ ...form, destination_type: 'STOCK_PDR', item_source: 'STOCK_PDR' });
                      setMouvementItems(mouvementItems.map((i) => ({ ...i, source: 'STOCK_PDR' })));
                    }}
                    className={`py-2 px-2 rounded-xl text-xs font-bold transition border cursor-pointer flex items-center justify-center gap-1.5 ${
                      form.destination_type === 'STOCK_PDR'
                        ? 'bg-emerald-50 border-emerald-400 text-emerald-950 font-bold ring-2 ring-emerald-500/20 shadow-2xs'
                        : 'bg-white/90 text-slate-700 border-slate-200 hover:bg-emerald-50/40 hover:border-emerald-200 hover:text-emerald-900'
                    }`}
                  >
                    <Package className={`w-3.5 h-3.5 ${form.destination_type === 'STOCK_PDR' ? 'text-emerald-600' : 'text-emerald-600/80'}`} />
                    <span>PDR (Stock)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setForm({ ...form, destination_type: 'WAREHOUSE_PARTIE', item_source: 'WAREHOUSE_PARTIE' });
                      setMouvementItems(mouvementItems.map((i) => ({ ...i, source: 'WAREHOUSE_PARTIE' })));
                    }}
                    className={`py-2 px-2 rounded-xl text-xs font-bold transition border cursor-pointer flex items-center justify-center gap-1.5 ${
                      form.destination_type === 'WAREHOUSE_PARTIE'
                        ? 'bg-purple-50 border-purple-400 text-purple-950 font-bold ring-2 ring-purple-500/20 shadow-2xs'
                        : 'bg-white/90 text-slate-700 border-slate-200 hover:bg-purple-50/40 hover:border-purple-200 hover:text-purple-900'
                    }`}
                  >
                    <Layers className={`w-3.5 h-3.5 ${form.destination_type === 'WAREHOUSE_PARTIE' ? 'text-purple-600' : 'text-purple-600/80'}`} />
                    <span>PARTIE (Entrepôt)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setForm({ ...form, destination_type: 'WAREHOUSE_COMPOSANT', item_source: 'WAREHOUSE_COMPOSANT' });
                      setMouvementItems(mouvementItems.map((i) => ({ ...i, source: 'WAREHOUSE_COMPOSANT' })));
                    }}
                    className={`py-2 px-2 rounded-xl text-xs font-bold transition border cursor-pointer flex items-center justify-center gap-1.5 ${
                      form.destination_type === 'WAREHOUSE_COMPOSANT'
                        ? 'bg-indigo-50 border-indigo-400 text-indigo-950 font-bold ring-2 ring-indigo-500/20 shadow-2xs'
                        : 'bg-white/90 text-slate-700 border-slate-200 hover:bg-indigo-50/40 hover:border-indigo-200 hover:text-indigo-900'
                    }`}
                  >
                    <Puzzle className={`w-3.5 h-3.5 ${form.destination_type === 'WAREHOUSE_COMPOSANT' ? 'text-indigo-600' : 'text-indigo-600/80'}`} />
                    <span>COMPOSANT</span>
                  </button>
                </div>

                {/* Return Tracker Bar from Bon de Sortie (Repairs) and Demandes d'Achat (Orders) */}
                {(activeExternalRepairs.length > 0 || pendingOrders.length > 0) && (
                  <div className="pt-2 border-t border-emerald-200/70 space-y-1.5">
                    <div className="text-[10px] font-bold text-emerald-900 flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <RotateCcw className="w-3 h-3 text-emerald-700" />
                        <span>Traçabilité des Retours & Commandes en Attente :</span>
                      </span>
                      <span className="font-mono text-[9px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded">
                        {activeExternalRepairs.length + pendingOrders.length} en attente
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                      {/* Active Repairs in Bon de Sortie */}
                      {activeExternalRepairs.map((rep, idx) => (
                        <button
                          key={`track-rep-${rep.id ?? ''}-${rep.code_bon ?? ''}-${idx}`}
                          type="button"
                          onClick={() => handleReceiveRepairReturn(rep)}
                          className="px-2 py-1 rounded-lg bg-white hover:bg-purple-50 border border-purple-200 text-purple-950 text-[10.5px] font-semibold flex items-center gap-1 transition cursor-pointer shadow-2xs"
                          title="Réceptionner le retour de cet équipement réparé"
                        >
                          <Truck className="w-3 h-3 text-purple-600 shrink-0" />
                          <span className="font-mono font-bold text-[10px] text-purple-800">{rep.code_bon}</span>
                          <span className="truncate max-w-[100px]">{rep.ref}</span>
                          <span className="text-[9px] text-purple-500 font-mono">({rep.quantite} pcs)</span>
                        </button>
                      ))}

                      {/* Pending Orders from Demandes d'Achat */}
                      {pendingOrders.map((ord, idx) => (
                        <button
                          key={`track-ord-${ord.id ?? ''}-${ord.code_bon ?? ''}-${idx}`}
                          type="button"
                          onClick={() => handleFulfillOrder(ord)}
                          className="px-2 py-1 rounded-lg bg-white hover:bg-amber-50 border border-amber-200 text-amber-950 text-[10.5px] font-semibold flex items-center gap-1 transition cursor-pointer shadow-2xs"
                          title="Réceptionner cette commande livrée par le fournisseur"
                        >
                          <ShoppingCart className="w-3 h-3 text-amber-600 shrink-0" />
                          <span className="font-mono font-bold text-[10px] text-amber-800">{ord.num_commande || ord.code_bon}</span>
                          <span className="truncate max-w-[100px]">{ord.ref}</span>
                          <span className="text-[9px] text-amber-500 font-mono">({ord.quantite} pcs)</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 4. DATE, HEURE & OT/CMD REFERENCE */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div>
                <label className="text-[10.5px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  Date
                </label>
                <input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  className="w-full h-8 px-2.5 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-800"
                  required
                />
              </div>

              <div>
                <label className="text-[10.5px] font-bold text-slate-500 uppercase tracking-wider block mb-1 flex items-center justify-between">
                  <span>Heure</span>
                  <span className="text-[9.5px] text-indigo-600 font-mono font-medium flex items-center gap-0.5">
                    <Clock className="w-2.5 h-2.5" /> Auto
                  </span>
                </label>
                <input
                  type="time"
                  value={form.heure || ''}
                  onChange={(e) => setForm({ ...form, heure: e.target.value })}
                  className="w-full h-8 px-2.5 rounded-xl border border-slate-200 bg-white text-xs font-mono text-slate-800"
                  required
                />
              </div>

              <div>
                <label className="text-[10.5px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  N° OT / Commande / Réf
                </label>
                <input
                  type="text"
                  placeholder="Ex: OT-2026-042"
                  value={form.num_commande}
                  onChange={(e) => setForm({ ...form, num_commande: e.target.value })}
                  className="w-full h-8 px-2.5 rounded-xl border border-slate-200 bg-white text-xs font-mono text-slate-800"
                />
              </div>
            </div>
              </div>
            );

            const step2ArticlesSection = (
              <div className="space-y-3">
            {/* 5. MULTI-ARTICLES SECTION - EXCEL LIGHT UI PDR */}
            <div className="space-y-3 pt-3 border-t border-slate-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700">
                    <Boxes className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                      <span>Articles & Pièces de Rechange (PDR)</span>
                      <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200">
                        {mouvementItems.length}/5
                      </span>
                    </label>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono font-bold bg-slate-50 text-slate-700 px-2 py-1 rounded-lg border border-slate-200">
                    Total: {mouvementItems.reduce((sum, it) => sum + (parseFloat(it.quantite) || 0), 0)} {mouvementItems[0]?.unit || 'pcs'}
                  </span>
                  <button
                    type="button"
                    onClick={handleAddItem}
                    disabled={mouvementItems.length >= 5}
                    className="text-xs font-bold text-emerald-700 hover:text-emerald-800 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 cursor-pointer bg-emerald-50 hover:bg-emerald-100/80 px-2.5 py-1 rounded-lg border border-emerald-200 transition shadow-2xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Ajouter une pièce</span>
                  </button>
                </div>
              </div>

              <div className="space-y-2.5">
                {mouvementItems.map((item, idx) => {
                  const match = unifiedSearchCatalog.find((c) => c.ref === item.ref);
                  const stockDispo = match ? (match.stockActuel ?? match.raw?.stockActuel ?? match.raw?.stockInitial ?? 0) : 0;
                  const seuilMin = match?.raw?.seuil ?? 5;
                  const qteVal = parseFloat(item.quantite) || 0;

                  const isSortie = form.type.includes('Sortie') || form.type === 'Bon de Sortie';
                  const isEntree = form.type.includes('Entrée');
                  const isCmd = form.type === 'COMMANDE';

                  // Dynamic Math Formulas (Excel Twin Simulation)
                  const nouveauSolde = isSortie
                    ? stockDispo - qteVal
                    : isEntree || isCmd
                      ? stockDispo + qteVal
                      : stockDispo;

                  const isDeficit = isSortie && qteVal > stockDispo;
                  const deficitAmount = isDeficit ? qteVal - stockDispo : 0;
                  const isSeuilAlert = isSortie && !isDeficit && nouveauSolde <= seuilMin && nouveauSolde >= 0;
                  const isStockOk = isSortie && !isDeficit && nouveauSolde > seuilMin;
                  const isZeroQte = qteVal <= 0;

                  return (
                    <div
                      key={`item-line-${idx}`}
                      className={`p-3 rounded-xl border bg-white transition shadow-2xs space-y-2.5 ${
                        isDeficit
                          ? 'border-rose-300 ring-1 ring-rose-200'
                          : isSeuilAlert
                            ? 'border-amber-300'
                            : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {/* Top Bar: Ligne ID + Catalog Picker + Delete */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 font-mono text-[11px] font-bold text-slate-700">
                            Ligne {idx + 1}
                          </span>
                        </div>

                        {/* Search / Select in catalog button */}
                        <button
                          type="button"
                          onClick={() => {
                            setTargetItemIndex(idx);
                            setSearchActiveTab(item.source || 'ALL');
                            setIsArticleSearchOpen(true);
                          }}
                          className="flex-1 py-1.5 px-3 rounded-lg bg-slate-50/90 hover:bg-slate-100 border border-slate-200 hover:border-emerald-500 text-left font-mono text-slate-800 flex items-center justify-between transition cursor-pointer shadow-2xs group"
                          title="Cliquer pour rechercher ou changer la pièce"
                        >
                          <span className="truncate text-xs font-bold text-slate-800 flex items-center gap-1.5">
                            <Tag className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span>{item.ref || 'Sélectionner une pièce dans le catalogue...'}</span>
                          </span>
                          <span className="text-[11px] text-indigo-700 group-hover:text-indigo-800 font-sans font-bold flex items-center gap-1 shrink-0 ml-1.5 bg-white px-2 py-0.5 rounded border border-slate-200">
                            <Search className="w-3 h-3 text-indigo-600" />
                            <span>
                              {item.source === 'STOCK_PDR' ? 'Catalogue PDR' :
                               item.source === 'WAREHOUSE_PARTIE' ? 'Catalogue Parties' :
                               item.source === 'WAREHOUSE_COMPOSANT' ? 'Catalogue Composants' : 'Catalogue'}
                            </span>
                          </span>
                        </button>

                        {mouvementItems.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(idx)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition cursor-pointer shrink-0"
                            title="Supprimer cette ligne"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {/* Fields Row: Designation & Quantity */}
                      <div className="grid grid-cols-12 gap-2.5 items-start">
                        <div className="col-span-7">
                          <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wide block mb-1">
                            Désignation de la pièce
                          </label>
                          <input
                            type="text"
                            placeholder="Sélectionnez un article..."
                            value={item.designation}
                            readOnly
                            className="w-full h-8 px-2.5 rounded-lg border border-slate-200 bg-slate-50 text-xs font-medium text-slate-600 focus:outline-none cursor-not-allowed select-none"
                          />
                        </div>

                        <div className="col-span-5">
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wide">
                              Quantité ({item.unit || 'pcs'})
                            </label>
                            {isSortie && stockDispo > 0 && (
                              <span className="text-[9.5px] text-slate-500 font-mono">Dispo: <b className="text-slate-800">{stockDispo}</b></span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              min="0.1"
                              step="any"
                              value={item.quantite}
                              onChange={(e) => handleUpdateItem(idx, 'quantite', e.target.value)}
                              className={`w-full h-8 px-2.5 rounded-lg border font-mono font-bold text-xs text-right focus:outline-none ${
                                isDeficit
                                  ? 'border-rose-400 bg-rose-50/50 text-rose-800'
                                  : isZeroQte
                                    ? 'border-amber-400 bg-amber-50/50 text-amber-900'
                                    : 'border-slate-200 bg-white text-slate-900 focus:border-emerald-500'
                              }`}
                              required
                            />
                            <span className="text-xs text-slate-500 font-mono font-medium shrink-0 px-1.5 py-1 bg-slate-50 rounded border border-slate-200">
                              {item.unit || 'pcs'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Quick Adjust Buttons (+1, +5, Max, Reset) */}
                      <div className="flex items-center justify-between gap-1 pt-1.5 border-t border-slate-100 text-[10.5px]">
                        <div className="flex items-center gap-1">
                          <span className="text-slate-400 text-[10px] font-medium mr-0.5">Ajuster:</span>
                          <button
                            type="button"
                            onClick={() => handleUpdateItem(idx, 'quantite', Math.max(1, qteVal - 1))}
                            className="px-2 py-0.5 rounded-md bg-slate-50 hover:bg-slate-100 text-slate-700 font-mono font-bold border border-slate-200 cursor-pointer shadow-2xs"
                          >
                            -1
                          </button>
                          <button
                            type="button"
                            onClick={() => handleUpdateItem(idx, 'quantite', qteVal + 1)}
                            className="px-2 py-0.5 rounded-md bg-slate-50 hover:bg-slate-100 text-slate-700 font-mono font-bold border border-slate-200 cursor-pointer shadow-2xs"
                          >
                            +1
                          </button>
                          <button
                            type="button"
                            onClick={() => handleUpdateItem(idx, 'quantite', qteVal + 5)}
                            className="px-2 py-0.5 rounded-md bg-slate-50 hover:bg-slate-100 text-slate-700 font-mono font-bold border border-slate-200 cursor-pointer shadow-2xs"
                          >
                            +5
                          </button>
                          {isSortie && stockDispo > 0 && (
                            <button
                              type="button"
                              onClick={() => handleUpdateItem(idx, 'quantite', stockDispo)}
                              className="px-2 py-0.5 rounded-md bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-mono font-bold border border-emerald-200 cursor-pointer shadow-2xs"
                              title="Prendre tout le stock disponible"
                            >
                              Max ({stockDispo})
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleUpdateItem(idx, 'quantite', 1)}
                            className="px-2 py-0.5 rounded-md bg-slate-50 hover:bg-slate-100 text-slate-500 font-mono border border-slate-200 cursor-pointer shadow-2xs"
                            title="Réinitialiser à 1"
                          >
                            1
                          </button>
                        </div>

                        {match && (
                          <div className="text-[11px] text-slate-500 font-mono">
                            Emplacement : <b className="text-slate-800 font-semibold bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200">{match.emplacement || '-'}</b>
                          </div>
                        )}
                      </div>

                      {/* Real-time Excel Formula & Stock Simulation Bar */}
                      {match && (
                        <div className="pt-1.5 border-t border-slate-100">
                          <div className="flex flex-wrap items-center justify-between gap-2 p-2 rounded-lg bg-slate-50/80 border border-slate-200 text-xs">
                            {isSortie ? (
                              <div className="flex items-center gap-1.5 font-mono text-[11px] flex-wrap">
                                <span className="text-slate-500 text-[10px] uppercase font-sans font-bold">Stock Actuel:</span>
                                <span className="font-bold text-slate-800 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                                  {stockDispo}
                                </span>
                                <span className="font-bold text-rose-600">−</span>
                                <span className="text-slate-500 text-[10px] uppercase font-sans font-bold">Sortie:</span>
                                <span className="font-bold text-rose-700 bg-white px-1.5 py-0.5 rounded border border-rose-200">
                                  {qteVal}
                                </span>
                                <span className="font-bold text-slate-400">=</span>
                                <span className="text-slate-500 text-[10px] uppercase font-sans font-bold">Solde Prévu:</span>
                                <span
                                  className={`font-bold px-2 py-0.5 rounded border ${
                                    isDeficit
                                      ? 'bg-rose-50 text-rose-800 border-rose-200'
                                      : isSeuilAlert
                                        ? 'bg-amber-50 text-amber-900 border-amber-200'
                                        : 'bg-emerald-50 text-emerald-900 border-emerald-200'
                                  }`}
                                >
                                  {nouveauSolde} {item.unit || 'pcs'}
                                </span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5 font-mono text-[11px] flex-wrap">
                                <span className="text-slate-500 text-[10px] uppercase font-sans font-bold">Stock Actuel:</span>
                                <span className="font-bold text-slate-800 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                                  {stockDispo}
                                </span>
                                <span className="font-bold text-emerald-600">+</span>
                                <span className="text-slate-500 text-[10px] uppercase font-sans font-bold">Entrée:</span>
                                <span className="font-bold text-emerald-700 bg-white px-1.5 py-0.5 rounded border border-emerald-200">
                                  {qteVal}
                                </span>
                                <span className="font-bold text-slate-400">=</span>
                                <span className="text-slate-500 text-[10px] uppercase font-sans font-bold">Nouveau Stock:</span>
                                <span className="font-bold px-2 py-0.5 rounded border border-emerald-200 bg-emerald-50 text-emerald-900">
                                  {nouveauSolde} {item.unit || 'pcs'}
                                </span>
                              </div>
                            )}

                            {/* Status Badge */}
                            <div>
                              {isDeficit && (
                                <span className="inline-flex items-center gap-1 text-[10.5px] font-bold px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 border border-rose-200">
                                  <AlertCircle className="w-3 h-3 shrink-0 text-rose-600" />
                                  <span>Déficit: -{deficitAmount} {item.unit || 'pcs'}</span>
                                </span>
                              )}
                              {isSeuilAlert && (
                                <span className="inline-flex items-center gap-1 text-[10.5px] font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-200">
                                  <AlertTriangle className="w-3 h-3 shrink-0 text-amber-600" />
                                  <span>Alerte Seuil (≤ {seuilMin})</span>
                                </span>
                              )}
                              {isStockOk && (
                                <span className="inline-flex items-center gap-1 text-[10.5px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-900 border border-emerald-200">
                                  <CheckCircle2 className="w-3 h-3 shrink-0 text-emerald-600" />
                                  <span>Stock Conforme</span>
                                </span>
                              )}
                              {isEntree && (
                                <span className="inline-flex items-center gap-1 text-[10.5px] font-bold px-2 py-0.5 rounded-md bg-blue-100 text-blue-900 border border-blue-200">
                                  <TrendingUp className="w-3 h-3 shrink-0 text-blue-600" />
                                  <span>Réappro (+{qteVal})</span>
                                </span>
                              )}
                              {isCmd && (
                                <span className="inline-flex items-center gap-1 text-[10.5px] font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-200">
                                  <ShoppingCart className="w-3 h-3 shrink-0 text-amber-600" />
                                  <span>Commande ({qteVal} pcs)</span>
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* GLOBAL MULTI-ITEMS SUMMARY & VERIFICATION - EXCEL LIGHT STYLE */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 shadow-2xs space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <Scale className="w-4 h-4 text-emerald-600" />
                    <span className="font-bold uppercase tracking-wider text-[11px] text-slate-800">
                      Bilan & Contrôle du Bon
                    </span>
                  </div>
                  <div className="flex items-center gap-2 font-mono">
                    <span className="text-[11px] text-slate-600">Lignes : <b className="text-slate-900">{mouvementItems.length}</b></span>
                    <span className="text-[11px] text-slate-300">•</span>
                    <span className="text-[11px] text-slate-600">Quantité Totale : <b className="text-emerald-700 font-bold">{mouvementItems.reduce((acc, i) => acc + (parseFloat(i.quantite) || 0), 0)} pcs</b></span>
                  </div>
                </div>

                {/* Validation Status Indicator */}
                {(() => {
                  const isSortie = form.type.includes('Sortie') || form.type === 'Bon de Sortie';
                  const invalidQte = mouvementItems.some((i) => !i.quantite || parseFloat(i.quantite) <= 0);
                  const emptyRef = mouvementItems.some((i) => !i.ref || String(i.ref).trim() === '');
                  const deficitItems = isSortie
                    ? mouvementItems.filter((i) => {
                        const m = unifiedSearchCatalog.find((c) => c.ref === i.ref);
                        const st = m ? (m.stockActuel ?? m.raw?.stockActuel ?? m.raw?.stockInitial ?? 0) : 0;
                        return (parseFloat(i.quantite) || 0) > st;
                      })
                    : [];

                  if (emptyRef) {
                    return (
                      <div className="flex items-center gap-2 text-xs text-amber-900 bg-amber-50 p-2 rounded-lg border border-amber-200">
                        <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
                        <span>Veuillez sélectionner une référence pour toutes les lignes d'articles.</span>
                      </div>
                    );
                  }

                  if (invalidQte) {
                    return (
                      <div className="flex items-center gap-2 text-xs text-rose-900 bg-rose-50 p-2 rounded-lg border border-rose-200">
                        <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                        <span>Quantité invalide détectée : chaque article doit avoir une quantité supérieure à 0.</span>
                      </div>
                    );
                  }

                  if (deficitItems.length > 0) {
                    return (
                      <div className="flex items-center justify-between text-xs text-rose-900 bg-rose-50 p-2 rounded-lg border border-rose-200">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                          <span>
                            <b>{deficitItems.length} article(s) en déficit</b> par rapport au stock physique.
                          </span>
                        </div>
                        <span className="text-[10px] font-mono font-bold bg-rose-100 text-rose-800 px-2 py-0.5 rounded border border-rose-300">
                          Avertissement
                        </span>
                      </div>
                    );
                  }

                  return (
                    <div className="flex items-center justify-between text-xs text-emerald-900 bg-emerald-50 p-2 rounded-lg border border-emerald-200">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                        <span>Tous les articles sont conformes et prêts pour l'enregistrement.</span>
                      </div>
                      <span className="text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded border border-emerald-300">
                        Prêt à Valider
                      </span>
                    </div>
                  );
                })()}
              </div>
            </div>
              </div>
            );

            const step3ContextSection = (
              <div className="space-y-4">
            {/* 6. CONTEXTUAL FIELDS BASED ON FLOW TYPE */}
            {/* CASE A: SORTIE INTERNE */}
            {isSortieInterne && (
              <SortieInterneContextSection
                form={form}
                setForm={setForm}
                zones={zones}
                machines={machines}
                activeMachinesList={activeMachinesList}
                availableMachines={availableMachines}
                technicians={technicians}
                availableTechs={availableTechs}
                responsablesList={responsablesList}
                operatorsList={operatorsList}
                currentUsageResponsable={currentUsageResponsable}
                maintenanceZone={maintenanceZone}
                usageAllowedZones={usageAllowedZones}
                usageAvailableMachines={usageAvailableMachines}
                operatorFilteredResponsables={operatorFilteredResponsables}
                getResponsableAllowedZones={getResponsableAllowedZones}
                getResponsablesForZone={getResponsablesForZone}
                findSupervisorForZone={findSupervisorForZone}
                onOpenAddZone={onOpenAddZone}
                onOpenAddMachine={onOpenAddMachine}
                onOpenAddTech={onOpenAddTech}
                onOpenAddChef={onOpenAddChef}
                onOpenAddOperator={onOpenAddOperator}
              />
            )}

            {/* CASE B: ENTRÉE INTERNE */}
            {isEntreeInterne && (
              <EntreeInterneContextSection
                form={form}
                setForm={setForm}
                zones={zones}
                machines={machines}
                activeMachinesList={activeMachinesList}
                technicians={technicians}
                availableTechs={availableTechs}
                onOpenAddTech={onOpenAddTech}
              />
            )}

            {/* CASE C: BON DE SORTIE (RÉPARATION EXTERNE / ÉTALONNAGE / GARANTIE) */}
            {isBonSortie && (
              <div className="space-y-3 pt-2 border-t border-slate-100 bg-purple-50/40 p-3 rounded-xl border border-purple-200">
                {/* 3 Action Cards for Bon de Sortie */}
                <div>
                  <label className="text-[10.5px] font-bold text-purple-950 uppercase tracking-wider block mb-1.5 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Truck className="w-3.5 h-3.5 text-purple-700" />
                      <span>Motif & Nature de la Sortie Externe (Action) :</span>
                    </span>
                    <span className="text-[10px] text-purple-700 font-semibold italic">
                      3 Actions Disponibles
                    </span>
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      {
                        id: 'REPARATION_EXTERNE',
                        label: 'Réparation Externe',
                        desc: 'Moteur, bobinage, usinage...',
                        icon: Truck,
                        color: 'bg-purple-50 border-purple-400 text-purple-950 ring-2 ring-purple-500/20 shadow-2xs font-bold',
                      },
                      {
                        id: 'ETALONNAGE_CONTROLE',
                        label: 'Étalonnage / Contrôle',
                        desc: 'Mesure, métrologie, capteurs...',
                        icon: Gauge,
                        color: 'bg-blue-50 border-blue-400 text-blue-950 ring-2 ring-blue-500/20 shadow-2xs font-bold',
                      },
                      {
                        id: 'GARANTIE_ECHANGE',
                        label: 'Garantie / Échange',
                        desc: 'Retour constructeur, garantie...',
                        icon: ShieldCheck,
                        color: 'bg-emerald-50 border-emerald-400 text-emerald-950 ring-2 ring-emerald-500/20 shadow-2xs font-bold',
                      },
                    ].map((act) => {
                      const IconComp = act.icon;
                      const isActive = form.action_id === act.id;
                      return (
                        <button
                          key={act.id}
                          type="button"
                          onClick={() => setForm({ ...form, action_id: act.id })}
                          className={`p-2 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                            isActive
                              ? act.color
                              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 mb-1">
                            <IconComp className="w-3.5 h-3.5 text-purple-700 shrink-0" />
                            <span className="text-xs font-bold truncate">{act.label}</span>
                          </div>
                          <div className="text-[9.5px] text-slate-500 leading-tight truncate">{act.desc}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Prestataire Externe (Obligatoire) */}
                <div>
                  <label className="text-[10.5px] font-bold text-purple-950 uppercase tracking-wider block mb-1">
                    Atelier / Prestataire Extérieur (Bobineur / Usineur / Labo) <span className="text-rose-600 font-bold">*</span>
                  </label>
                  <CustomSelect
                    value={form.prestataire_externe}
                    onChange={(val) => setForm({ ...form, prestataire_externe: val })}
                    options={supplierOptions.map((s) => ({ value: s, label: s }))}
                    placeholder="-- Sélectionner Prestataire Externe --"
                    onAddNew={(val) => {
                      if (val) {
                        setForm({ ...form, prestataire_externe: val });
                      }
                    }}
                  />
                </div>

                {/* Machine d'Origine (Équipement Source) & Date de Retour Prévue */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-[10.5px] font-bold text-purple-950 uppercase tracking-wider block mb-1">
                      Machine d'Origine (Équipement Source)
                    </label>
                    <CustomSelect
                      value={form.id_machine_registered}
                      onChange={(val) => {
                        const m = machines.find((mach) => mach.id_machine_registered === val);
                        setForm({
                          ...form,
                          id_machine_registered: val,
                          id_zone: m?.id_zone_default || form.id_zone,
                        });
                      }}
                      options={[
                        { value: '', label: '-- Stock Équipement / Non affecté --' },
                        ...activeMachinesList.map((m) => ({
                          value: m.id_machine_registered,
                          label: `[${m.id_machine_registered}] ${m.designation}`,
                        })),
                      ]}
                      placeholder="-- Machine d'origine --"
                    />
                  </div>

                  <div>
                    <label className="text-[10.5px] font-bold text-purple-950 uppercase tracking-wider block mb-1">
                      Date de Retour Estimée <span className="text-rose-600 font-bold">*</span>
                    </label>
                    <input
                      type="date"
                      value={form.date_retour_prevue}
                      onChange={(e) => setForm({ ...form, date_retour_prevue: e.target.value })}
                      className="w-full h-8 px-2.5 rounded-xl border border-purple-200 bg-white text-xs font-mono text-slate-800"
                      required
                    />
                  </div>
                </div>

                {/* Technicien Émetteur (Responsable de la Sortie) */}
                <div>
                  <label className="text-[10.5px] font-bold text-purple-950 uppercase tracking-wider block mb-1">
                    Technicien Émetteur (Demandeur de l'Envoi) <span className="text-rose-600 font-bold">*</span>
                  </label>
                  <CustomSelect
                    value={form.technicien}
                    onChange={(val) => {
                      const t = technicians.find((tech) => tech.nom === val);
                      setForm({
                        ...form,
                        technicien: val,
                        id_technician: t?.id_technician || '',
                      });
                    }}
                    options={technicians.map((t) => ({
                      value: t.nom,
                      label: t.nom,
                      badge: t.id_technician,
                    }))}
                    placeholder="-- Technicien émetteur --"
                  />
                </div>
              </div>
            )}

            {/* CASE D: ENTRÉE EXTERNE */}
            {isEntreeExterne && (
              <div className="space-y-3 pt-2 border-t border-slate-100 bg-emerald-50/40 p-3 rounded-xl border border-emerald-200">
                {/* 3 Action Cards for Entrée Externe */}
                <div>
                  <label className="text-[10.5px] font-bold text-emerald-950 uppercase tracking-wider block mb-1.5 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Inbox className="w-3.5 h-3.5 text-emerald-700" />
                      <span>Nature de la Réception Externe (Action) :</span>
                    </span>
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      {
                        id: 'REAPPRO',
                        label: 'Réapprovisionnement',
                        desc: 'Commande fournisseur / stock',
                        icon: Truck,
                      },
                      {
                        id: 'RETOUR_REPARATION',
                        label: 'Retour Réparation',
                        desc: 'Retour bobinage / usinage',
                        icon: RefreshCw,
                      },
                      {
                        id: 'INVENTAIRE',
                        label: 'Régularisation +',
                        desc: 'Ajustement inventaire',
                        icon: ClipboardList,
                      },
                    ].map((act) => {
                      const IconComp = act.icon;
                      const isActive = form.action_id === act.id;
                      return (
                        <button
                          key={act.id}
                          type="button"
                          onClick={() => setForm({ ...form, action_id: act.id })}
                          className={`p-2 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                            isActive
                              ? 'bg-emerald-50 border-emerald-400 text-emerald-950 ring-2 ring-emerald-500/20 shadow-2xs font-bold'
                              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 mb-1">
                            <IconComp className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span className="text-xs font-bold truncate">{act.label}</span>
                          </div>
                          <div className="text-[9.5px] text-slate-500 leading-tight truncate">{act.desc}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Smart One-Click Autofill for RETOUR_REPARATION if active external repairs exist */}
                {activeExternalRepairs.length > 0 && (
                  <div className="p-2.5 bg-purple-50 rounded-xl border border-purple-200 text-xs">
                    <div className="font-bold text-purple-950 flex items-center gap-1 mb-1.5">
                      <Truck className="w-3.5 h-3.5 text-purple-600" />
                      <span>{activeExternalRepairs.length} Bon(s) de Sortie en Réparation Externe en attente :</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {activeExternalRepairs.slice(0, 3).map((rep, idx) => (
                        <button
                          key={`rep-btn-${idx}`}
                          type="button"
                          onClick={() => handleReceiveRepairReturn(rep)}
                          className="px-2 py-1 bg-white hover:bg-purple-100 border border-purple-300 text-purple-900 rounded-lg text-[10.5px] font-bold transition flex items-center gap-1 cursor-pointer shadow-2xs"
                        >
                          <span>{rep.code_bon}</span>
                          <span className="text-slate-500 font-normal">({rep.ref})</span>
                          <span className="text-emerald-600">↳ Réceptionner</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <label className="text-[10.5px] font-bold text-emerald-950 uppercase tracking-wider block mb-1">
                    Fournisseur / Prestataire Expéditeur
                  </label>
                  <CustomSelect
                    value={form.fournisseur}
                    onChange={(val) => setForm({ ...form, fournisseur: val })}
                    options={supplierOptions.map((s) => ({ value: s, label: s }))}
                    placeholder="-- Sélectionner Fournisseur --"
                  />
                </div>

                <div>
                  <label className="text-[10.5px] font-bold text-emerald-950 uppercase tracking-wider block mb-1">
                    Emplacement de Réception Magasin
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Magasin Central - R1"
                    value={form.emplacement_reception}
                    onChange={(e) => setForm({ ...form, emplacement_reception: e.target.value })}
                    className="w-full h-8 px-2.5 rounded-xl border border-emerald-200 bg-white text-xs font-mono text-slate-800"
                  />
                </div>
              </div>
            )}

            {/* CASE E: COMMANDE (Demande d'Achat & Approvisionnement) */}
            {isCommandeFlow && (
              <div className="space-y-3 pt-2 border-t border-slate-100 bg-amber-50/40 p-3 rounded-xl border border-amber-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-950">
                    <ShoppingCart className="w-4 h-4 text-amber-600" />
                    <span>Informations de la Demande d'Achat</span>
                  </div>
                  <span className="text-[10px] font-mono font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded border border-amber-300">
                    APPROVISIONNEMENT
                  </span>
                </div>

                {/* Priority Selector */}
                <div>
                  <label className="text-[10.5px] font-bold text-amber-950 uppercase tracking-wider block mb-1">
                    Niveau de Priorité :
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { id: 'NORMALE', label: '🟢 Normale', color: 'border-emerald-300 text-emerald-900 bg-emerald-50' },
                      { id: 'URGENTE', label: '🟡 Urgente', color: 'border-amber-300 text-amber-900 bg-amber-50' },
                      { id: 'CRITIQUE', label: '🔴 Critique (Rupture)', color: 'border-rose-300 text-rose-900 bg-rose-50' },
                    ].map((p) => {
                      const isSel = (form.priorite || 'NORMALE') === p.id;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setForm({ ...form, priorite: p.id })}
                          className={`py-1.5 px-2 rounded-xl border text-xs font-bold transition cursor-pointer text-center ${
                            isSel
                              ? `${p.color} ring-2 ring-amber-500/20 shadow-2xs`
                              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          {p.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-[10.5px] font-bold text-amber-950 uppercase tracking-wider block mb-1">
                      Demandeur / Responsable
                    </label>
                    <CustomSelect
                      value={form.technicien}
                      onChange={(val) => setForm({ ...form, technicien: val })}
                      options={technicians.map((t) => ({ value: t.nom, label: t.nom }))}
                      placeholder="-- Demandeur --"
                    />
                  </div>

                  <div>
                    <label className="text-[10.5px] font-bold text-amber-950 uppercase tracking-wider block mb-1">
                      Fournisseur Suggéré
                    </label>
                    <input
                      type="text"
                      placeholder="Nom du fournisseur ou prestataire"
                      value={form.fournisseur}
                      onChange={(e) => setForm({ ...form, fournisseur: e.target.value })}
                      className="w-full h-8 px-2.5 rounded-xl border border-amber-200 bg-white text-xs text-slate-800 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Commentaire / Observation */}
            <div>
              <label className="text-[10.5px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                Commentaire / Motif du Bon
              </label>
              <input
                type="text"
                placeholder="Observation, raison du mouvement..."
                value={form.commentaire}
                onChange={(e) => setForm({ ...form, commentaire: e.target.value })}
                className="w-full h-8 px-2.5 rounded-xl border border-slate-200 bg-white text-xs text-slate-800"
              />
            </div>
              </div>
            );

            if (isWizardMode) {
              const totalQte = mouvementItems.reduce(
                (acc, i) => acc + (parseFloat(String(i.quantite)) || 0),
                0
              );

              const sortieWizardProfile: WizardProfile = {
                id: 'sortie-entree-rapide-wizard',
                moduleKey: 'stock_rapid_movement',
                code: form.code_bon || 'BON-MVT',
                title: isTechUser ? 'Assistant Demande PDR' : 'Assistant Bon de Mouvement',
                description: `${form.type} • ${form.action_id}`,
                themeColor: 'teal',
                finishLabel: isTechUser
                  ? 'Soumettre la Demande'
                  : `Valider ${form.code_bon} (${totalQte} pcs)`,
                cancelLabel: 'Réinitialiser',
                steps: [
                  {
                    id: 'step-1-flux',
                    code: 'ÉTAPE 01',
                    title: 'Flux & Référence',
                    description:
                      'Choisissez la nature du flux (Sortie, Entrée, Commande), la catégorie de stock et les références temporelles.',
                    badge: form.type,
                    icon: Receipt,
                    content: step1FluxSection,
                    validate: () => {
                      if (!form.date || !String(form.date).trim()) {
                        return {
                          valid: false,
                          message: 'Veuillez renseigner la date du mouvement.',
                          level: 'critical',
                        };
                      }
                      if (!form.code_bon || !String(form.code_bon).trim()) {
                        return {
                          valid: false,
                          message: 'Le code du Bon de Mouvement est obligatoire.',
                          level: 'critical',
                        };
                      }
                      return { valid: true };
                    },
                  },
                  {
                    id: 'step-2-articles',
                    code: 'ÉTAPE 02',
                    title: 'Articles & Stock',
                    description:
                      "Sélectionnez jusqu'à 5 références et contrôlez l'impact sur le stock avant de passer à l'imputation.",
                    badge: `${mouvementItems.length}/5 lignes`,
                    icon: Boxes,
                    validateOn: 'always',
                    content: step2ArticlesSection,
                    validate: (ctx) => {
                      const isLive = ctx?.mode === 'live';

                      for (let idx = 0; idx < mouvementItems.length; idx++) {
                        const item = mouvementItems[idx];
                        const hasRef = Boolean(item.ref && String(item.ref).trim() !== '');
                        if (!hasRef) {
                          if (!isLive) {
                            return {
                              valid: false,
                              message: `Ligne ${idx + 1} : Veuillez sélectionner un article dans le catalogue.`,
                              level: 'critical',
                            };
                          }
                          continue;
                        }
                        if (!item.quantite || Number(item.quantite) <= 0) {
                          return {
                            valid: false,
                            message: `Ligne ${idx + 1} : La quantité doit être supérieure à 0.`,
                            level: 'critical',
                          };
                        }
                      }

                      const isSortie =
                        form.type === 'Sortie Interne' ||
                        form.type === 'Bon de Sortie' ||
                        form.type === 'Sortie Externe';
                      if (isSortie) {
                        const requestedByRef = new Map<string, { ref: string; totalQte: number }>();
                        for (const item of mouvementItems) {
                          const rawRef = String(item.ref || '').trim();
                          if (!rawRef) continue;
                          const normKey = rawRef.toUpperCase();
                          const prev = requestedByRef.get(normKey);
                          const qte = Number(item.quantite) || 0;
                          requestedByRef.set(normKey, {
                            ref: prev ? prev.ref : rawRef,
                            totalQte: (prev ? prev.totalQte : 0) + qte,
                          });
                        }

                        let exhaustionWarning: string | null = null;
                        for (const { ref, totalQte } of requestedByRef.values()) {
                          const match =
                            unifiedSearchCatalog.find(
                              (c) => String(c.ref || '').trim().toUpperCase() === ref.toUpperCase()
                            ) ||
                            stockItems.find(
                              (s) => String(s.ref || '').trim().toUpperCase() === ref.toUpperCase()
                            );
                          const currentStock = match
                            ? (match.stockActuel ??
                                match.raw?.stockActuel ??
                                match.raw?.stockInitial ??
                                0)
                            : 0;
                          if (totalQte > currentStock) {
                            return {
                              valid: false,
                              message: `Stock insuffisant pour [${ref}] (Demandé: ${totalQte}, Disponible: ${currentStock}).`,
                              level: 'critical',
                            };
                          }
                          if (totalQte === currentStock && currentStock > 0 && !exhaustionWarning) {
                            exhaustionWarning = `Attention : cette sortie épuisera le stock disponible de [${ref}] (Stock restant = 0).`;
                          }
                        }

                        if (exhaustionWarning) {
                          return {
                            valid: true,
                            message: exhaustionWarning,
                            level: 'warning',
                          };
                        }
                      }
                      return { valid: true };
                    },
                  },
                  {
                    id: 'step-3-imputation',
                    code: 'ÉTAPE 03',
                    title: 'Imputation & Validation',
                    description:
                      "Renseignez le motif d'intervention, l'équipement concerné et l'intervenant avant d'enregistrer le bon.",
                    badge: form.action_id,
                    icon: ShieldCheck,
                    content: (
                      <div className="space-y-4">
                        {step3ContextSection}

                        {/* Light Excel Final Summary Ledger Card */}
                        <div className="p-3.5 rounded-xl bg-teal-50/50 border border-teal-200/80 space-y-2 text-xs">
                          <div className="flex items-center justify-between border-b border-teal-200/60 pb-2">
                            <span className="font-mono font-bold text-[10px] uppercase tracking-wider text-teal-900">
                              Récapitulatif Excel du Bon ({form.code_bon})
                            </span>
                            <span className="font-mono font-bold text-[11px] text-teal-800 bg-white px-2 py-0.5 rounded border border-teal-200">
                              {form.type} • {form.action_id}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1 text-[11px]">
                            <div>
                              <span className="text-slate-500 block">Articles :</span>
                              <span className="font-mono font-bold text-slate-900">
                                {mouvementItems.length} réf(s) • {totalQte} pcs
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-500 block">Équipement / Zone :</span>
                              <span className="font-mono font-bold text-slate-900 truncate block">
                                {form.id_machine_registered || form.id_zone || form.emplacement_reception || '—'}
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-500 block">Intervenant / Tiers :</span>
                              <span className="font-bold text-slate-900 truncate block">
                                {form.technicien || form.operation || form.fournisseur || form.prestataire_externe || '—'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ),
                    validate: () => {
                      const { isValid, errors } = getFormValidationState();
                      if (!isValid) {
                        return {
                          valid: false,
                          message:
                            errors[0] ||
                            'Veuillez compléter les champs obligatoires avant de valider.',
                          level: 'critical',
                        };
                      }
                      return { valid: true };
                    },
                  },
                ],
                onFinish: () => handleSubmit(),
                onCancel: () => {
                  resetForm();
                },
              };

              return (
                <WizardShell
                  profile={sortieWizardProfile}
                  layout={viewMode === 'JOURNAL' ? 'split' : 'compact'}
                  className={
                    viewMode === 'JOURNAL'
                      ? 'min-h-[560px] max-h-[75vh]'
                      : 'min-h-[520px] max-h-[calc(100vh-230px)]'
                  }
                />
              );
            }

            return (
              <form onSubmit={handleSubmit} className="space-y-4">
                {step1FluxSection}
                {step2ArticlesSection}
                {step3ContextSection}

                {/* Submit & Reset Buttons */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      resetForm();
                    }}
                    className="h-10 w-10 rounded-xl bg-slate-100 text-slate-500 hover:text-slate-800 hover:bg-slate-200 border border-slate-200 flex items-center justify-center transition cursor-pointer shrink-0"
                    title="Réinitialiser le formulaire"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                  <button
                    type="submit"
                    className={`flex-1 h-10 rounded-xl font-bold text-xs transition shadow-sm flex items-center justify-center gap-2 cursor-pointer ${
                      getFormValidationState().isPristine
                        ? 'bg-slate-50 text-slate-500 border border-slate-200 hover:bg-slate-100 hover:text-slate-700'
                        : getFormValidationState().isValid
                          ? 'btn-primary-accent shadow-xs'
                          : 'bg-rose-500 hover:bg-rose-600 text-white shadow-rose-500/20'
                    }`}
                  >
                    {getFormValidationState().isPristine ? (
                      <>
                        <HelpCircle className="w-4 h-4" />
                        <span>Formulaire prêt à être rempli</span>
                      </>
                    ) : getFormValidationState().isValid ? (
                      <>
                        <Check className="w-4 h-4" />
                        <span>
                          {isTechUser
                            ? 'Soumettre Demande de Sortie (Validation Magasin)'
                            : 'Valider et Enregistrer (Prêt)'}
                        </span>
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="w-4 h-4" />
                        <span>
                          {isTechUser ? 'Soumettre Demande' : `Valider ${form.type}`} (
                          {mouvementItems.reduce((acc, i) => acc + (Number(i.quantite) || 0), 0)} pcs) •{' '}
                          {form.code_bon}
                        </span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            );
          })()}
                </FormContainerWrapper>
              )}

              {/* Right Table: Movements History & Excel Twin */}
              <div className={viewMode === 'SPLIT' ? 'lg:col-span-7 space-y-4' : 'w-full space-y-4'}>
                {/* V3/V4 Technician Sortie Demands Status Panel */}
                {isTechUser && (
                  <TechSortieDemandsPanel
                    mySortieDemands={mySortieDemands}
                    onReloadClarificationDemand={handleReloadClarificationDemand}
                  />
                )}

                <MouvementsJournalTable
                  mouvements={scopedMouvements}
                  stockItems={stockItems}
                  warehouseItems={warehouseItems}
                  machines={machines}
                  zones={zones}
                  technicians={technicians}
                  operations={operations}
                  onUpdateMouvement={isTechUser ? null : onUpdateMouvement}
                  onDeleteMouvement={isTechUser ? null : onDeleteMouvement}
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* V3+V4 MODAL: MAGASINIER / ADMIN SORTIE DEMAND REVIEW & BON RECONCILIATION */}
      <SortieDemandReviewModal
        reviewDemand={reviewDemand}
        reconciliation={reviewDemandReconciliation}
        reviewCodeBonMagasin={reviewCodeBonMagasin}
        setReviewCodeBonMagasin={setReviewCodeBonMagasin}
        reviewMergeMovementId={reviewMergeMovementId}
        setReviewMergeMovementId={setReviewMergeMovementId}
        reviewDemandItems={reviewDemandItems}
        setReviewDemandItems={setReviewDemandItems}
        reviewDemandNote={reviewDemandNote}
        setReviewDemandNote={setReviewDemandNote}
        onClose={() => setReviewDemand(null)}
        onDecision={handleReviewDemandDecision}
      />

      {/* UNIFIED ARTICLE & WAREHOUSE ITEM SEARCH MODAL */}
      <UnifiedArticleSearchModal
        open={isArticleSearchOpen}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        searchActiveTab={searchActiveTab}
        stockCount={stockItems.length}
        warehouseItems={warehouseItems}
        filteredCatalogResults={filteredCatalogResults}
        highlightMatch={highlightMatch}
        onSelectCatalogItem={handleSelectCatalogItem}
        onClose={() => setIsArticleSearchOpen(false)}
        onOpenAddArticle={onOpenAddArticle}
        onOpenAddMachine={onOpenAddMachine}
      />

      {/* Excel Formulas Preview Modal */}
      <MovementFormulasPreviewModal
        open={showFormulasModal}
        onClose={() => setShowFormulasModal(false)}
      />
    </AnimatedPage>
  );
}
