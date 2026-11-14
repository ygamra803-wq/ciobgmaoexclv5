import {  useState, useMemo, useEffect, useCallback  } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import SequentialCodePicker from '../../components/common/SequentialCodePicker';
import FormulasModalButton from '../../components/common/FormulasModalButton';
import Action3DButton from '../../components/common/Action3DButton';
import {
  FileSpreadsheet, Check, AlertTriangle, RotateCcw, Package, Wrench, Clock, TrendingDown,
  TrendingUp, Puzzle, MapPin, Users, Boxes, HelpCircle, X, ChevronDown, Crown, UserCheck,
  ShoppingCart, Activity, Sparkles, ShieldAlert, Inbox, CornerDownRight, ShieldCheck,
  Hammer, Truck, Gauge, Layers, Calculator, Receipt, Columns2, Maximize2,
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
import { isTechnicianRole, matchesTechnicianRecord, getTechnicianBadgeLabel, getTechnicianDisplayName } from '../../../core/security/technicianScope';
import { reconcileFieldClaim, computeReservedStockMap } from '../../../core/security/validationReconciliation';
import { WizardShell, useWizardFeature, type WizardProfile } from '../../components/common/wizard';
import { CustomSelect, FormContainerWrapper } from './components/MovementSelect';
import { SortieSuccessAlertModal, SortieValidationAlertModal, SortieDemandReviewModal, UnifiedArticleSearchModal, MovementFormulasPreviewModal } from './components/SortieModals';
import { PendingOrdersSubTab, ValidationTerrainQueueSubTab, TechSortieDemandsPanel } from './components/SortieSubTabs';
import { SortieInterneContextSection } from './components/SortieInterneContextSection';
import { EntreeInterneContextSection } from './components/EntreeInterneContextSection';
import { MovementArticlesSection } from './components/MovementArticlesSection';
import { ExternalMovementContextSections } from './components/ExternalMovementContextSections';
import { MovementFlowSelectorSection, buildUnifiedMovementSearchCatalog, filterMovementCatalogResults, findSupervisorForZoneHelper } from './components/MovementFlowSelectorSection';

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

  const reservedStockMap = useMemo(
    () =>
      computeReservedStockMap({
        correctiveInterventions: storeCorrectiveInterventions,
        preventiveExecutions: storePreventiveExecutions,
        sortieDemands: storeSortieDemands,
      }),
    [storeCorrectiveInterventions, storePreventiveExecutions, storeSortieDemands]
  );

  const getExternalReservedQtyForRef = useCallback(
    (rawRef: unknown): number => {
      const refKey = String(rawRef || '').trim().toUpperCase();
      if (!refKey) return 0;
      const entry = reservedStockMap.get(refKey);
      if (!entry) return 0;
      if (!editingDemandId) return Number(entry.reservedQty || 0);
      const selfReserved = (entry.sources || [])
        .filter((src) => src.claimType === 'SORTIE' && String(src.claimId) === String(editingDemandId))
        .reduce((sum, src) => sum + (Number(src.qty) || 0), 0);
      return Math.max(0, Number(entry.reservedQty || 0) - selfReserved);
    },
    [reservedStockMap, editingDemandId]
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
  const findSupervisorForZone = (zoneId: string) =>
    findSupervisorForZoneHelper(zoneId, responsablesList);

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
  const unifiedSearchCatalog = useMemo(
    () => buildUnifiedMovementSearchCatalog(stockItems, warehouseItems),
    [stockItems, warehouseItems]
  );

  // Filtered Search Results
  const filteredCatalogResults = useMemo(
    () => filterMovementCatalogResults(unifiedSearchCatalog, searchActiveTab, searchQuery),
    [unifiedSearchCatalog, searchActiveTab, searchQuery]
  );

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
        const externalReserved = getExternalReservedQtyForRef(ref);
        const netAvailable = currentStock - externalReserved;
        if (totalQte > currentStock) {
          errors.push(
            `Stock insuffisant pour [${ref}] (Demandé cumulé: ${totalQte}, Dispo: ${currentStock}).`
          );
        } else if (externalReserved > 0 && totalQte > netAvailable) {
          errors.push(
            `Stock réservé (soft-lock) pour [${ref}] : Physique ${currentStock}, Réservé ${externalReserved}, Net Dispo ${Math.max(0, netAvailable)}, Demandé ${totalQte}.`
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
              <MovementFlowSelectorSection
                form={form}
                setForm={setForm}
                mouvementItems={mouvementItems}
                setMouvementItems={setMouvementItems}
                isSortieInterne={isSortieInterne}
                isEntreeInterne={isEntreeInterne}
                isBonSortie={isBonSortie}
                isEntreeExterne={isEntreeExterne}
                isCommandeFlow={isCommandeFlow}
                handleTypeChange={handleTypeChange}
                activeExternalRepairs={activeExternalRepairs}
                pendingOrders={pendingOrders}
                handleReceiveRepairReturn={handleReceiveRepairReturn}
                handleFulfillOrder={handleFulfillOrder}
              />
            );

            const step2ArticlesSection = (
              <MovementArticlesSection
                form={form}
                mouvementItems={mouvementItems}
                unifiedSearchCatalog={unifiedSearchCatalog}
                getExternalReservedQtyForRef={getExternalReservedQtyForRef}
                handleAddItem={handleAddItem}
                handleRemoveItem={handleRemoveItem}
                handleUpdateItem={handleUpdateItem}
                onOpenItemCatalog={(idx, source) => {
                  setTargetItemIndex(idx);
                  setSearchActiveTab(source || 'ALL');
                  setIsArticleSearchOpen(true);
                }}
              />
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

            {/* CASES C, D, E: BON DE SORTIE EXTERNE / ENTRÉE EXTERNE / COMMANDE / COMMENTAIRE */}
            <ExternalMovementContextSections
              isBonSortie={isBonSortie}
              isEntreeExterne={isEntreeExterne}
              isCommandeFlow={isCommandeFlow}
              form={form}
              setForm={setForm}
              supplierOptions={supplierOptions}
              machines={machines}
              activeMachinesList={activeMachinesList}
              technicians={technicians}
              activeExternalRepairs={activeExternalRepairs}
              handleReceiveRepairReturn={handleReceiveRepairReturn}
            />
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

      <SortieDemandReviewModal
        reviewDemand={reviewDemand} reconciliation={reviewDemandReconciliation}
        reviewCodeBonMagasin={reviewCodeBonMagasin} setReviewCodeBonMagasin={setReviewCodeBonMagasin}
        reviewMergeMovementId={reviewMergeMovementId} setReviewMergeMovementId={setReviewMergeMovementId}
        reviewDemandItems={reviewDemandItems} setReviewDemandItems={setReviewDemandItems}
        reviewDemandNote={reviewDemandNote} setReviewDemandNote={setReviewDemandNote}
        onClose={() => setReviewDemand(null)} onDecision={handleReviewDemandDecision}
      />
      <UnifiedArticleSearchModal
        open={isArticleSearchOpen} searchQuery={searchQuery} setSearchQuery={setSearchQuery}
        searchActiveTab={searchActiveTab} stockCount={stockItems.length} warehouseItems={warehouseItems}
        filteredCatalogResults={filteredCatalogResults} highlightMatch={highlightMatch}
        onSelectCatalogItem={handleSelectCatalogItem} onClose={() => setIsArticleSearchOpen(false)}
        onOpenAddArticle={onOpenAddArticle} onOpenAddMachine={onOpenAddMachine}
      />
      <MovementFormulasPreviewModal open={showFormulasModal} onClose={() => setShowFormulasModal(false)} />
    </AnimatedPage>
  );
}
