import { useState, useEffect, useMemo, useSyncExternalStore } from 'react';
import {
  CheckCircle,
  Wrench,
  Package,
  Timer,
  Play,
  ArrowRight,
  ShieldCheck,
  FileCheck,
  Plus,
  Trash2,
  Cpu,
  AlertTriangle,
  Wand2,
  LayoutList,
} from 'lucide-react';
import { WizardShell, useWizardFeature, type WizardProfile } from '../../components/common/wizard';
import { CorrectiveCalculationService } from '../../../domain/corrective/services/CorrectiveCalculationService';
import { stockIndexStore } from '../../../application/StockIndexStore';
import { isWarehouseComponent, isWarehousePart } from '../../../core/domain/EntrepotItem';
import { rankStockItemsByMachineBom } from '../../../core/domain';
import { useGmaoStore } from '../../../store/useGmaoStore';
import { useI18n } from '../../../i18n/I18nContext';
import { useAuth } from '../../../context/AuthContext';
import {
  isTechnicianRole,
  matchesTechnicianRecord,
  getTechnicianBadgeLabel,
} from '../../../core/security/technicianScope';
import { INTERVENTION_NATURE_OPTIONS } from '../../components/common/ValidationStatusBadge';
import { SortieExterneService } from '../../../application/services/SortieExterneService';
import { AuthorizationService } from '../../../core/security/AuthorizationService';
import { canCloseWorkOrderWithLoto } from '../../../domain/corrective/lotoService';
import LotoPermitPanel from './components/LotoPermitPanel';
import {
  getLinkedWorkshopOrdersForIntervention,
  isWorkshopOrderActive,
  WORKSHOP_STATUS_LABELS,
  type WorkshopOrderType,
} from '../../../domain/corrective/workshopOrderService';
import {
  getLinkedNeedRequestsForIntervention,
  isNeedRequestBlockingBtClosure,
  NEED_MATERIAL_CLASS_LABELS,
  NEED_STATUS_LABELS,
  POLICY_TAG_LABELS,
  type MaintenancePolicyTag,
  type NeedMaterialClass,
  type NeedRequestStatus,
} from '../../../domain/corrective/needRequestService';

export default function InterventionLiveTab({
  interventions = [],
  machines = [],
  technicians: _technicians = [],
  activeLiveId,
  setActiveLiveId,
  onSubmitForValidation,
  onClotureIntervention,
  onUpdateIntervention,
  onNavigateToTab,
  stockItems = [],
  warehouseItems = [],
  onAddMouvement: _onAddMouvement,
  actionsByPanne = {},
  travauxAFaire = [],
  getActionsForPanne: getActionsForPanneProp,
  onAddActionForPanne: _onAddActionForPanne,
  showToast,
}) {
  const { t } = useI18n();
  const { user } = useAuth();
  const isTechUser = isTechnicianRole(user);
  const isReadOnlyUser = AuthorizationService.isReadOnly(user);
  const { isEnabled: isWizardMode, setEnabled: setWizardMode } =
    useWizardFeature('corrective_bt');
  const blueprints = useGmaoStore((s) => s.blueprints);
  const machineElementsLedger = useGmaoStore((s) => s.machineElementsLedger);
  const storeSubmitForValidation = useGmaoStore((s) => s.handleSubmitInterventionForValidation);
  const handleStartLiveIntervention = useGmaoStore((s) => s.handleStartLiveIntervention);
  const sortiesExterne = useGmaoStore((s) => s.sortiesExterne);
  const handleAddSortieExterne = useGmaoStore((s) => s.handleAddSortieExterne);
  const handleMarkSortieReturned = useGmaoStore((s) => s.handleMarkSortieReturned);
  const workshopOrders = useGmaoStore((s) => s.workshopOrders || []);
  const handleCreateWorkshopOrder = useGmaoStore((s) => s.handleCreateWorkshopOrder);
  const handleTransitionWorkshopOrderStatus = useGmaoStore(
    (s) => s.handleTransitionWorkshopOrderStatus
  );
  const needRequests = useGmaoStore((s) => s.needRequests || []);
  const handleCreateNeedRequest = useGmaoStore((s) => s.handleCreateNeedRequest);
  const handleTransitionNeedRequestStatus = useGmaoStore(
    (s) => s.handleTransitionNeedRequestStatus
  );
  // Sync with reactive StockIndexStore for real-time stock balances
  useSyncExternalStore(stockIndexStore.subscribeAll, stockIndexStore.getGlobalVersion);

  const scopedInterventions = useMemo(() => {
    if (!isTechUser) return interventions;
    return (interventions || []).filter((i) => matchesTechnicianRecord(i, user, _technicians));
  }, [interventions, isTechUser, user, _technicians]);

  // Active intervention object
  const activeIntervention = useMemo(() => {
    if (!activeLiveId) {
      // Pick first in_progress BT not already pending validation if none explicitly active
      return (
        scopedInterventions.find(
          (i) =>
            (i.statut === 'EN_COURS' || i.statut === 'BT_PLANIFIE') &&
            i.num_bt &&
            i.validation_status !== 'PENDING_VALIDATION'
        ) ||
        scopedInterventions.find(
          (i) => (i.statut === 'EN_COURS' || i.statut === 'BT_PLANIFIE') && i.num_bt
        ) ||
        null
      );
    }
    return scopedInterventions.find((i) => i.id === activeLiveId) || null;
  }, [scopedInterventions, activeLiveId]);

  // Fast Machine Lookup Map
  const machineMap = useMemo(() => {
    const map = new Map();
    (machines || []).forEach((m) => {
      const id = m.id_machine_registered || m.id;
      if (id) map.set(id, m);
    });
    return map;
  }, [machines]);

  // Real-time ticking chronometer
  const [currentTimestamp, setCurrentTimestamp] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTimestamp(Date.now());
    }, 1000); // 1s tick for smooth live chrono
    return () => clearInterval(timer);
  }, []);

  // Live calculated industrial working time
  const liveWorkingTime = useMemo(() => {
    if (!activeIntervention?.date_debut || !activeIntervention?.heure_debut) {
      const now = new Date(currentTimestamp);
      const todayStr = now.toISOString().split('T')[0];
      const nowTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      return CorrectiveCalculationService.calculateWorkingTime(
        todayStr,
        '08:00',
        todayStr,
        nowTimeStr
      );
    }
    const now = new Date(currentTimestamp);
    const todayStr = now.toISOString().split('T')[0];
    const nowTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    return CorrectiveCalculationService.calculateWorkingTime(
      activeIntervention.date_debut,
      activeIntervention.heure_debut,
      todayStr,
      nowTimeStr
    );
  }, [activeIntervention, currentTimestamp]);

  // Current shift status banner
  const shiftStatus = useMemo(() => {
    const now = new Date(currentTimestamp);
    const h = now.getHours();
    const m = now.getMinutes();
    const currentM = h * 60 + m;

    if (now.getDay() === 0) {
      return {
        label: 'Dimanche (Jour Non Ouvré) · Hors Shift',
        color: 'text-slate-500 bg-slate-100 border-slate-200',
      };
    }
    if (currentM >= 480 && currentM < 795) {
      return {
        label: 'Shift Matin (08:00 - 13:15) · Décompte Actif',
        color: 'text-emerald-800 bg-emerald-50 border-emerald-200 animate-pulse',
      };
    }
    if (currentM >= 795 && currentM < 840) {
      return {
        label: 'Pause Déjeuner (13:15 - 14:00) · 45 min Déduites Automatiquement',
        color: 'text-amber-800 bg-amber-50 border-amber-200',
      };
    }
    if (currentM >= 840 && currentM < 1020) {
      return {
        label: 'Shift Après-Midi (14:00 - 17:00) · Décompte Actif',
        color: 'text-emerald-800 bg-emerald-50 border-emerald-200 animate-pulse',
      };
    }
    return {
      label: 'Hors Shift Usine (Après 17:00) · Chronomètre Figé jusqu’à 08:00',
      color: 'text-slate-600 bg-slate-100 border-slate-200',
    };
  }, [currentTimestamp]);

  // Form State for closing or modifying the live intervention
  const [formState, setFormState] = useState<any>({
    travail_a_faire: '',
    action_realisee: '',
    intervention_nature: '',
    pdr_ref: '',
    pdr_designation: '',
    pdr_quantite: 1,
    marque: '',
    etat_piece: 'Neuve',
    arret_machine: true,
    temps_arret: '',
    pieces_utilisees: [],
    num_bon_saisi_par_tech: '',
    id_composant: '',
    nom_composant: '',
    id_part: '',
    nom_part: '',
    statut_composant_cloture: 'En service',
  });

  // Autocomplete suggestions
  const [travailSearch, setTravailSearch] = useState('');
  const [showTravailSuggestions, setShowTravailSuggestions] = useState(false);

  // Sync initial values when active intervention changes
  useEffect(() => {
    if (activeIntervention) {
      const initialPieces =
        Array.isArray(activeIntervention.pieces_utilisees) &&
        activeIntervention.pieces_utilisees.length > 0
          ? activeIntervention.pieces_utilisees
          : Array.isArray(activeIntervention.pieces_proposees) &&
            activeIntervention.pieces_proposees.length > 0
          ? activeIntervention.pieces_proposees
          : [];
      setFormState({
        travail_a_faire: activeIntervention.travail_a_faire || '',
        action_realisee: activeIntervention.action_realisee || '',
        intervention_nature: activeIntervention.intervention_nature || '',
        pdr_ref: activeIntervention.pdr_ref || activeIntervention.pdr || '',
        pdr_designation: activeIntervention.pdr_designation || '',
        pdr_quantite: activeIntervention.pdr_quantite || 1,
        marque: activeIntervention.marque || '',
        etat_piece: activeIntervention.etat_piece || 'Neuve',
        arret_machine: Boolean(activeIntervention.arret_machine),
        temps_arret: activeIntervention.temps_arret || '',
        pieces_utilisees: initialPieces,
        num_bon_saisi_par_tech: activeIntervention.num_bon_saisi_par_tech || '',
        id_composant: activeIntervention.id_composant || '',
        nom_composant: activeIntervention.nom_composant || '',
        id_part: activeIntervention.id_part || '',
        nom_part: activeIntervention.nom_part || '',
        statut_composant_cloture: activeIntervention.statut_composant_cloture || 'En service',
      });
      setTravailSearch(activeIntervention.travail_a_faire || '');
    }
  }, [activeIntervention]);

  // Linked Workshop / External Orders (Bon d'Atelier / Rectification & Sous-Traitance)
  const linkedWorkshopOrders = useMemo(() => {
    if (!activeIntervention) return [];
    return SortieExterneService.getLinkedOrdersForBt(activeIntervention, sortiesExterne);
  }, [activeIntervention, sortiesExterne]);

  const linkedInternalWorkshopOrders = useMemo(() => {
    if (!activeIntervention) return [];
    return getLinkedWorkshopOrdersForIntervention(activeIntervention, workshopOrders);
  }, [activeIntervention, workshopOrders]);

  const openWorkshopOrders = useMemo(() => {
    const extOpen = linkedWorkshopOrders.filter((o) =>
      SortieExterneService.isWorkshopOrderOpen(o.etat)
    );
    const intOpen = linkedInternalWorkshopOrders.filter((o) => isWorkshopOrderActive(o.statut));
    return [...intOpen, ...extOpen];
  }, [linkedWorkshopOrders, linkedInternalWorkshopOrders]);

  // COR-HANDOFF-P0: Linked Need Requests for the active BT
  const linkedNeedRequests = useMemo(() => {
    if (!activeIntervention) return [];
    return getLinkedNeedRequestsForIntervention(activeIntervention, needRequests);
  }, [activeIntervention, needRequests]);

  const blockingNeedRequests = useMemo(() => {
    return linkedNeedRequests.filter((req) => isNeedRequestBlockingBtClosure(req));
  }, [linkedNeedRequests]);

  const [showNeedRequestForm, setShowNeedRequestForm] = useState(false);
  const [needForm, setNeedForm] = useState<{
    material_class: NeedMaterialClass;
    policy_tag: MaintenancePolicyTag;
    quantite: number;
    description_besoin: string;
    id_ref_pdr: string;
  }>({
    material_class: 'PDR',
    policy_tag: 'REPLACING',
    quantite: 1,
    description_besoin: '',
    id_ref_pdr: '',
  });

  const handleEmitNeedRequest = () => {
    if (!activeIntervention) return;
    const desc = String(needForm.description_besoin || '').trim();
    if (!desc) {
      showToast?.('Veuillez décrire le besoin matière / pièce avant de soumettre.', 'warning');
      return;
    }
    const created = handleCreateNeedRequest({
      id_machine: String(activeIntervention.code_machine || activeIntervention.machine || '').trim(),
      id_bt: String(activeIntervention.num_bt || activeIntervention.id || '').trim(),
      id_di: activeIntervention.id_di ? String(activeIntervention.id_di) : null,
      id_technicien_demandeur:
        user?.personnelId || user?.code || user?.id || activeIntervention.technicien_matricule || 'TECH',
      nom_technicien_demandeur:
        user?.name || activeIntervention.intervenant || 'Technicien',
      material_class: needForm.material_class,
      policy_tags_snapshot: [needForm.policy_tag],
      id_ref_pdr: needForm.id_ref_pdr.trim() || formState.pdr_ref || null,
      designation_pdr: formState.pdr_designation || null,
      id_part: formState.id_part || activeIntervention.id_part || null,
      nom_part: formState.nom_part || activeIntervention.nom_part || null,
      id_composant: formState.id_composant || activeIntervention.id_composant || null,
      nom_composant: formState.nom_composant || activeIntervention.nom_composant || null,
      quantite: Math.max(1, Number(needForm.quantite) || 1),
      description_besoin: desc,
    });

    if (created) {
      setNeedForm({
        material_class: 'PDR',
        policy_tag: 'REPLACING',
        quantite: 1,
        description_besoin: '',
        id_ref_pdr: '',
      });
      setShowNeedRequestForm(false);
      showToast?.(
        `Demande de besoin ${created.code_demande} créée (DEMANDE_TECH · Canal en attente d'arbitrage responsable). Le BT reste en attente.`,
        'success'
      );
    }
  };

  const handleNeedFieldHandoff = (needId: string, nextStatus: NeedRequestStatus) => {
    const res = handleTransitionNeedRequestStatus(needId, nextStatus, {
      actorRole: user?.role || (isTechUser ? 'TECHNICIEN' : 'ADMIN'),
      isTechnician: isTechUser,
      actorId: user?.id || user?.code || 'tech',
      actorName: user?.name || activeIntervention?.intervenant || 'Technicien',
    });
    if (!res.valid) {
      showToast?.(res.reason || 'Transition refusée.', 'warning');
      return;
    }
    showToast?.(
      `Besoin ${res.needRequest?.code_demande || needId} mis à jour : ${
        NEED_STATUS_LABELS[nextStatus] || nextStatus
      }.`,
      'success'
    );
  };

  const [showBonAtelierMecaniqueForm, setShowBonAtelierMecaniqueForm] = useState(false);
  const [bonAtelierForm, setBonAtelierForm] = useState<{
    type_demande: WorkshopOrderType;
    quantite: number;
    description_travaux: string;
    observation: string;
  }>({
    type_demande: 'REALISATION',
    quantite: 1,
    description_travaux: '',
    observation: '',
  });

  const handleEmitBonAtelierMecanique = () => {
    if (!activeIntervention) return;
    const desc = String(bonAtelierForm.description_travaux || '').trim();
    if (!desc) {
      showToast?.(
        'Veuillez saisir la description des travaux pour l’Atelier Fabrication Mécanique.',
        'warning'
      );
      return;
    }
    const created = handleCreateWorkshopOrder({
      type_demande: bonAtelierForm.type_demande,
      id_machine: String(activeIntervention.code_machine || activeIntervention.machine || '').trim(),
      id_bt: String(activeIntervention.num_bt || activeIntervention.id || '').trim(),
      id_di: activeIntervention.id_di ? String(activeIntervention.id_di) : null,
      id_composant: formState.id_composant || activeIntervention.id_composant || null,
      id_part: formState.id_part || activeIntervention.id_part || null,
      quantite: Math.max(1, Number(bonAtelierForm.quantite) || 1),
      description_travaux: desc,
      observation: String(bonAtelierForm.observation || '').trim() || undefined,
      emetteur_section: 'SM',
      emetteur_user_id: user?.id || user?.code || 'SM',
      emetteur_name: user?.name || activeIntervention.intervenant || 'Section Maintenance',
      destinataire: 'Atelier Fabrication Mécanique',
    });

    if (created) {
      setFormState((prev: any) => ({
        ...prev,
        intervention_nature: 'ATELIER',
        action_realisee:
          prev.action_realisee ||
          `Bon Atelier ${created.code_bon} (${created.type_demande}) : ${desc}`,
        travail_a_faire:
          prev.travail_a_faire ||
          `Bon Atelier ${created.code_bon} (${created.type_demande}) : ${desc}`,
      }));
      setBonAtelierForm({
        type_demande: 'REALISATION',
        quantite: 1,
        description_travaux: '',
        observation: '',
      });
      setShowBonAtelierMecaniqueForm(false);
      showToast?.(
        `Bon Atelier Mécanique ${created.code_bon} émis. Le BT ${
          activeIntervention.num_bt || activeIntervention.id
        } est placé en attente atelier (non clôturé).`,
        'success'
      );
    }
  };

  const [showQuickWorkshopForm, setShowQuickWorkshopForm] = useState(false);
  const [workshopQuickForm, setWorkshopQuickForm] = useState({
    categorie_flux: 'ATELIER_MECANIQUE' as 'ATELIER_MECANIQUE' | 'SOUS_TRAITANCE_EXTERNE',
    nature_travail: 'Usinage / Rectification',
    designation_piece: '',
    fournisseur_externe: 'Atelier Mécanique Interne',
    cout_bobinage: 0,
    suspendBtAfterCreate: true,
  });

  const handleQuickCreateWorkshopOrder = () => {
    if (!activeIntervention) return;
    const isAtelier = workshopQuickForm.categorie_flux === 'ATELIER_MECANIQUE';
    const pieceName =
      String(workshopQuickForm.designation_piece || '').trim() ||
      formState.nom_composant ||
      formState.nom_part ||
      `Organe ${activeIntervention.code_machine}`;
    const created = handleAddSortieExterne({
      categorie_flux: workshopQuickForm.categorie_flux,
      code_machine: activeIntervention.code_machine,
      id_corrective: activeIntervention.num_bt || activeIntervention.id,
      designation_moteur: pieceName,
      nature_travail: workshopQuickForm.nature_travail,
      type_probleme: workshopQuickForm.nature_travail,
      fournisseur_externe:
        String(workshopQuickForm.fournisseur_externe || '').trim() ||
        (isAtelier ? 'Atelier Mécanique Interne' : 'Sous-traitant Externe'),
      cout_bobinage: Number(workshopQuickForm.cout_bobinage || 0),
      id_composant: formState.id_composant || '',
      id_part: formState.id_part || '',
      etat: isAtelier ? 'En cours atelier' : 'En réparation externe',
      observations:
        formState.action_realisee ||
        formState.travail_a_faire ||
        activeIntervention.anomalie ||
        '',
    });

    setFormState((prev: any) => ({
      ...prev,
      intervention_nature: 'ATELIER',
      action_realisee:
        prev.action_realisee ||
        `${workshopQuickForm.nature_travail} (${created.code}) — ${pieceName}`,
      travail_a_faire:
        prev.travail_a_faire ||
        `${workshopQuickForm.nature_travail} (${created.code}) — ${pieceName}`,
    }));

    if (workshopQuickForm.suspendBtAfterCreate && typeof onUpdateIntervention === 'function') {
      onUpdateIntervention(activeIntervention.id, {
        ...formState,
        intervention_nature: 'ATELIER',
        id_sortie_atelier: created.id,
        code_sortie_atelier: created.code,
        cout_atelier: Number(workshopQuickForm.cout_bobinage || 0),
        nature_travail_atelier: workshopQuickForm.nature_travail,
        prestataire_atelier: created.fournisseur_externe,
        statut: 'EN_ATTENTE_PDR',
      });
      setActiveLiveId?.(null);
      showToast?.(
        `Bon ${created.code} créé et BT ${activeIntervention.num_bt || activeIntervention.id} suspendu en attente de fin d'atelier (EN_ATTENTE_PDR).`,
        'info'
      );
      onNavigateToTab?.('corrective_bt');
      return;
    }

    setShowQuickWorkshopForm(false);
    showToast?.(
      `Bon ${created.code} lié au BT ${activeIntervention.num_bt || activeIntervention.id}.`,
      'success'
    );
  };

  // Machine components from Entrepôt for optional component lifecycle tracking
  const machineComponents = useMemo(() => {
    if (!activeIntervention?.code_machine || !Array.isArray(warehouseItems)) return [];
    const code = String(activeIntervention.code_machine).trim().toUpperCase();
    return warehouseItems.filter((w) => {
      const wMach = String(w.id_machine_registered || w.id_machine || w.machine_id || '').trim().toUpperCase();
      return (wMach === code || wMach.includes(code)) && isWarehouseComponent(w);
    });
  }, [activeIntervention?.code_machine, warehouseItems]);

  // Machine structural parts (Localization sites — no stock deduction)
  const machineParts = useMemo(() => {
    if (!activeIntervention?.code_machine || !Array.isArray(warehouseItems)) return [];
    const code = String(activeIntervention.code_machine).trim().toUpperCase();
    return warehouseItems.filter((w) => {
      const wMach = String(w.id_machine_registered || w.id_machine || w.machine_id || '').trim().toUpperCase();
      return (wMach === code || wMach.includes(code)) && isWarehousePart(w);
    });
  }, [activeIntervention?.code_machine, warehouseItems]);

  // Filtered standard phrases from travauxAFaire prop
  const filteredSuggestions = useMemo(() => {
    if (!travailSearch) return (travauxAFaire || []).slice(0, 15);
    const term = travailSearch.toLowerCase();
    return (travauxAFaire || [])
      .filter((item) => String(item).toLowerCase().includes(term))
      .slice(0, 20);
  }, [travailSearch, travauxAFaire]);

  // Suggested solutions specifically linked to this failure anomaly (normalized lookup from prop/seed registry)
  const smartAnomalyActions = useMemo(() => {
    if (!activeIntervention?.anomalie) return [];
    if (typeof getActionsForPanneProp === 'function') {
      return getActionsForPanneProp(activeIntervention.anomalie);
    }
    const anom = String(activeIntervention.anomalie);
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
  }, [activeIntervention, actionsByPanne, getActionsForPanneProp]);

  // Filtered & BOM-Ranked Stock Items for PDR lookup (P2)
  const [pdrSearch, setPdrSearch] = useState('');
  const [showPdrList, setShowPdrList] = useState(false);

  const rankedMachineStockItems = useMemo(() => {
    return rankStockItemsByMachineBom(
      activeIntervention?.code_machine,
      stockItems,
      machines,
      blueprints,
      formState.id_composant || formState.nom_composant || formState.id_part || formState.nom_part,
      undefined,
      machineElementsLedger
    );
  }, [
    activeIntervention?.code_machine,
    stockItems,
    machines,
    blueprints,
    formState.id_composant,
    formState.nom_composant,
    formState.id_part,
    formState.nom_part,
    machineElementsLedger,
  ]);

  const matchedStockItems = useMemo(() => {
    if (!pdrSearch.trim()) return rankedMachineStockItems.slice(0, 12);
    const term = pdrSearch.toLowerCase().trim();
    return rankedMachineStockItems
      .filter(
        (s) =>
          String(s.ref || s.code_article || '').toLowerCase().includes(term) ||
          String(s.designation || s.nom || '').toLowerCase().includes(term) ||
          String(s.type || s.famille || '').toLowerCase().includes(term) ||
          String(s.marque || '').toLowerCase().includes(term)
      )
      .slice(0, 15);
  }, [rankedMachineStockItems, pdrSearch]);

  // Handle Select PDR
  const handleSelectPdr = (item) => {
    const stockQty = item.stockActuel ?? item.stock_actuel ?? item.quantite ?? 0;
    setFormState((prev) => ({
      ...prev,
      pdr_ref: item.ref || item.code_article,
      pdr_designation: item.designation || item.nom,
      pdr_prix: item.prix || item.prix_unitaire || 0,
      pdr_unite: item.unite || 'Pièce',
      pdr_stock_actuel: stockQty,
      marque: item.marque || prev.marque || 'Origine',
    }));
    setPdrSearch(`${item.ref || item.code_article} - ${item.designation || item.nom}`);
    setShowPdrList(false);
  };

  // Add currently selected PDR to pieces_utilisees list (Multi-PDR support)
  const handleAddPieceToList = () => {
    const ref = String(formState.pdr_ref || '').trim();
    const qty = Number(formState.pdr_quantite || 0);
    if (!ref || !(qty > 0)) {
      showToast?.('Veuillez sélectionner un article PDR et une quantité valide.', 'warning');
      return;
    }
    setFormState((prev) => {
      const currentList = Array.isArray(prev.pieces_utilisees) ? [...prev.pieces_utilisees] : [];
      const existingIdx = currentList.findIndex(
        (p) => String(p.ref || '').toUpperCase() === ref.toUpperCase()
      );
      if (existingIdx >= 0) {
        currentList[existingIdx] = {
          ...currentList[existingIdx],
          quantite: Number(currentList[existingIdx].quantite || 0) + qty,
        };
      } else {
        currentList.push({
          ref,
          designation: prev.pdr_designation || ref,
          quantite: qty,
          prix_unitaire: Number(prev.pdr_prix || 0),
          unite: prev.pdr_unite || 'Pièce',
          marque: prev.marque || '',
          etat_piece: prev.etat_piece || 'Neuve',
        });
      }
      return {
        ...prev,
        pieces_utilisees: currentList,
        pdr_ref: '',
        pdr_designation: '',
        pdr_quantite: 1,
        pdr_stock_actuel: undefined,
      };
    });
    setPdrSearch('');
  };

  const handleRemovePieceFromList = (refToRemove: string) => {
    setFormState((prev) => ({
      ...prev,
      pieces_utilisees: (prev.pieces_utilisees || []).filter(
        (p: any) => String(p.ref || '').toUpperCase() !== String(refToRemove || '').toUpperCase()
      ),
    }));
  };

  // Merge any pending single-input PDR (`pdr_ref`) with `pieces_utilisees` so a selected part
  // is never silently dropped if the user clicks Suivant/Valider without clicking "+ Ajouter".
  const buildEffectivePiecesList = (state: any) => {
    const baseList = Array.isArray(state.pieces_utilisees)
      ? state.pieces_utilisees.map((item: any) => ({ ...item }))
      : [];
    const pendingRef = String(state.pdr_ref || '').trim();
    const pendingQty = Number(state.pdr_quantite || 0);

    if (pendingRef && pendingQty > 0) {
      const existingIdx = baseList.findIndex(
        (p: any) => String(p.ref || '').trim().toUpperCase() === pendingRef.toUpperCase()
      );
      if (existingIdx >= 0) {
        baseList[existingIdx] = {
          ...baseList[existingIdx],
          quantite: Number(baseList[existingIdx].quantite || 0) + pendingQty,
        };
      } else {
        baseList.push({
          ref: pendingRef,
          designation: state.pdr_designation || pendingRef,
          quantite: pendingQty,
          prix_unitaire: Number(state.pdr_prix || 0),
          unite: state.pdr_unite || 'Pièce',
          marque: state.marque || '',
          etat_piece: state.etat_piece || 'Neuve',
        });
      }
    }

    return baseList;
  };

  // Shared core execution logic for both Classic Form & Wizard
  const executeClotureOrSubmit = (): boolean => {
    if (!activeIntervention) {
      showToast?.('Aucune intervention active sélectionnée', 'warning');
      return false;
    }

    const effectivePieces = buildEffectivePiecesList(formState);
    const selectedNature = String(formState.intervention_nature || '').trim().toUpperCase();

    // VAL-4 Guard: If nature is REPLACE ('Remplacement PDR') but 0 parts are declared, warn before submitting
    if (selectedNature === 'REPLACE' && effectivePieces.length === 0) {
      showToast?.(
        'Nature « Remplacement PDR » sélectionnée sans pièce déclarée : veuillez ajouter la pièce remplacée ou choisir une nature sans PDR (Réparation, Nettoyage, Réglage...).',
        'warning'
      );
      return false;
    }

    const primaryPiece = effectivePieces.length === 1 ? effectivePieces[0] : null;
    const normalizedFormState = {
      ...formState,
      ...(selectedNature ? { intervention_nature: selectedNature } : {}),
      pieces_utilisees: effectivePieces,
      pdr_ref: primaryPiece ? primaryPiece.ref : formState.pdr_ref,
      pdr_designation: primaryPiece ? primaryPiece.designation : formState.pdr_designation,
      pdr_quantite: primaryPiece ? primaryPiece.quantite : formState.pdr_quantite,
      pdr_prix: primaryPiece ? primaryPiece.prix_unitaire : formState.pdr_prix,
    };

    const now = new Date();
    const dateFin = now.toISOString().split('T')[0];
    const heureFin = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const targetMachine = machineMap.get(activeIntervention.code_machine);
    const machineZone =
      targetMachine?.id_zone_default ||
      targetMachine?.id_zone ||
      activeIntervention.zone ||
      'Atelier';
    const machineDesignation =
      targetMachine?.designation || activeIntervention.code_machine;
    const sessionActorRole = String(user?.role || (isTechUser ? 'TECHNICIEN' : 'ADMIN'))
      .trim()
      .toUpperCase();

    // 1. TECHNICIAN PATH: Submit field claim for validation WITHOUT closing or deducting stock
    if (isTechUser) {
      const submitFn = onSubmitForValidation || storeSubmitForValidation;
      if (typeof submitFn === 'function') {
        const submittedResult = submitFn(activeIntervention.id, {
          ...normalizedFormState,
          actorRole: sessionActorRole,
          isTechnician: true,
          pieces_proposees: effectivePieces,
          num_bon_saisi_par_tech: normalizedFormState.num_bon_saisi_par_tech,
          zone: machineZone,
          machine_designation: machineDesignation,
          date_fin_proposee: dateFin,
          heure_fin_proposee: heureFin,
          temps_intervention_propose: liveWorkingTime.formatted,
          temps_intervention_mins_propose: liveWorkingTime.minutes,
          submitted_by_id: user?.personnelId || user?.code || user?.id || '',
          submitted_by_name: getTechnicianBadgeLabel(user, _technicians),
          submitted_at: now.toISOString(),
        });

        if (submittedResult === null) {
          showToast?.(
            'Soumission refusée : vérifiez le travail réalisé ou le statut du Bon de Travail.',
            'warning'
          );
          return false;
        }
      } else if (typeof onUpdateIntervention === 'function') {
        onUpdateIntervention(activeIntervention.id, {
          ...normalizedFormState,
          actorRole: sessionActorRole,
          isTechnician: true,
          pieces_proposees: effectivePieces,
          pieces_claimed: effectivePieces,
          pieces_utilisees: [],
          pdr_ref: '',
          pdr_quantite: 0,
          num_bon_saisi_par_tech: normalizedFormState.num_bon_saisi_par_tech,
          date_fin_proposee: dateFin,
          heure_fin_proposee: heureFin,
          temps_intervention_propose: liveWorkingTime.formatted,
          temps_intervention_mins_propose: liveWorkingTime.minutes,
          validation_status: 'PENDING_VALIDATION',
          validation_note: '',
          stock_deducted: false,
          submitted_by_id: user?.personnelId || user?.code || user?.id || '',
          submitted_by_name: getTechnicianBadgeLabel(user, _technicians),
          submitted_at: now.toISOString(),
          action_fermee: 'NON',
          statut: 'EN_COURS',
        });
      }

      showToast?.(
        `Déclaration BT ${activeIntervention.num_bt || activeIntervention.code_machine} soumise pour validation responsable (aucun déstockage immédiat)`,
        'info'
      );

      setActiveLiveId?.(null);
      if (onNavigateToTab) {
        onNavigateToTab('corrective_bt');
      }
      return true;
    }

    // 2. ADMIN / SUPERVISOR PATH: Direct approved closure & single stock deduction
    if (openWorkshopOrders.length > 0) {
      const openCodes = openWorkshopOrders
        .map((o: any) => o.code_bon || o.code)
        .join(', ');
      showToast?.(
        `Clôture bloquée : le Bon d'Atelier / Externe [${openCodes}] est encore en cours. Réceptionnez le bon (Retourné OK) ou suspendez le BT en attente (EN_ATTENTE_PDR).`,
        'warning'
      );
      return false;
    }

    if (blockingNeedRequests.length > 0) {
      const openNeeds = blockingNeedRequests
        .map((r) => `${r.code_demande} (${r.statut})`)
        .join(', ');
      showToast?.(
        `Clôture bloquée : la Demande de Besoin [${openNeeds}] n'a pas encore atteint la clôture terrain (POSE_ESSAI ➔ CLOTURE_FIELD).`,
        'warning'
      );
      return false;
    }

    const lotoCloseCheck = canCloseWorkOrderWithLoto(activeIntervention);
    if (!lotoCloseCheck.valid) {
      showToast?.(
        lotoCloseCheck.reason ||
          'Clôture bloquée : le permis de consignation LOTO doit être déconsigné (DECONSIGNE) avant clôture.',
        'warning'
      );
      return false;
    }

    const closedResult = onClotureIntervention(activeIntervention.id, {
      ...normalizedFormState,
      actorRole: sessionActorRole,
      isTechnician: isTechUser,
      zone: machineZone,
      machine_designation: machineDesignation,
      date_fin: activeIntervention.date_fin_proposee || dateFin,
      heure_fin: activeIntervention.heure_fin_proposee || heureFin,
      temps_intervention_calc: liveWorkingTime.formatted,
      temps_intervention_mins: liveWorkingTime.minutes,
      temps_minutes: liveWorkingTime.minutes,
      validation_status: 'APPROVED',
      validated_by_id: user?.id || user?.code || 'admin',
      validated_by_name: user?.name || 'Administrateur',
      validated_at: now.toISOString(),
      statut: 'CLOTURE',
      action_fermee: 'OUI',
    });

    if (closedResult === null) {
      showToast?.(
        'Transition refusée : vérifiez le travail réalisé ou le statut du Bon de Travail.',
        'warning'
      );
      return false;
    }

    showToast?.(
      `Intervention ${activeIntervention.num_bt || activeIntervention.code_machine} validée et clôturée (${liveWorkingTime.formatted} ouvré)`,
      'success'
    );

    setActiveLiveId?.(null);
    if (onNavigateToTab) {
      onNavigateToTab('corrective_cloture');
    }
    return true;
  };

  // Handle Clôture / Validation Submit (Maker-Checker V1+V2)
  const handleClotureSubmit = (e) => {
    e.preventDefault();
    executeClotureOrSubmit();
  };

  if (!activeIntervention) {
    return (
      <div className="bg-white rounded-3xl border border-slate-200/90 p-12 text-center shadow-xs space-y-4 max-w-2xl mx-auto">
        <div className="w-16 h-16 rounded-3xl bg-amber-500/10 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto shadow-sm">
          <Play className="w-8 h-8 fill-current text-amber-600" />
        </div>
        <h3 className="text-lg font-black text-slate-900 tracking-tight">
          {t('corrective.live.no_live')}
        </h3>
        <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
          {t('corrective.live.select_bt')}
        </p>
        <button
          onClick={() => onNavigateToTab?.('corrective_bt')}
          className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition cursor-pointer shadow-md shadow-amber-600/25 active:scale-95 inline-flex items-center gap-2"
        >
          <Wrench className="w-4 h-4" />
          <span>{t('corrective.tabs.bt')}</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  // ============================================================================
  // SHARED SECTIONS FOR CLASSIC FORM & 3-STEP WIZARD (ZERO DUPLICATION)
  // ============================================================================
  const step1DiagnosticSection = (
    <div className="space-y-4">
      {/* VAL-3 Banner: Show Supervisor Clarification / Rejection Note when editing & resubmitting */}
      {(activeIntervention.validation_status === 'NEEDS_CLARIFICATION' ||
        activeIntervention.validation_status === 'REJECTED') &&
        activeIntervention.validation_note && (
          <div
            className={`p-3.5 rounded-2xl border flex items-start gap-2.5 text-xs ${
              activeIntervention.validation_status === 'REJECTED'
                ? 'bg-rose-50 border-rose-300 text-rose-900'
                : 'bg-orange-50 border-orange-300 text-orange-950'
            }`}
          >
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <div className="font-black uppercase tracking-wider">
                {activeIntervention.validation_status === 'REJECTED'
                  ? 'Déclaration précédente rejetée (Sans effet stock) — Nouvelle déclaration :'
                  : 'Clarification demandée par le responsable — Corrigez et renvoyez :'}
              </div>
              <p className="font-semibold mt-0.5">{activeIntervention.validation_note}</p>
            </div>
          </div>
        )}

      {/* VAL-4: Nature de l'intervention (Optionnel · Compatible ascendant) */}
      <div className="space-y-1.5">
        <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
          Nature de l'Intervention (Optionnel · Contrôle cohérence PDR)
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {INTERVENTION_NATURE_OPTIONS.map((opt) => {
            const isSelected =
              String(formState.intervention_nature || '').toUpperCase() === opt.code;
            return (
              <button
                key={opt.code}
                type="button"
                data-testid={`live-nature-${opt.code}`}
                onClick={() =>
                  setFormState((p: any) => ({
                    ...p,
                    intervention_nature: isSelected ? '' : opt.code,
                  }))
                }
                className={`px-3 py-2 rounded-xl border text-left text-xs font-bold transition cursor-pointer flex items-center justify-between gap-1.5 ${
                  isSelected
                    ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                }`}
              >
                <span className="truncate">{opt.shortLabel}</span>
                {opt.requiresPartsWarning && (
                  <span
                    className={`text-[9px] font-mono px-1.5 py-0.2 rounded ${
                      isSelected ? 'bg-amber-400 text-slate-950' : 'bg-cyan-100 text-cyan-800'
                    }`}
                  >
                    +PDR
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* COR-HANDOFF-P0: Demande de Besoin & Chaîne de Remise Terrain (NeedRequest) */}
      <div
        data-testid="live-need-handoff-panel"
        className="p-4 rounded-2xl bg-purple-50/60 border border-purple-200/90 space-y-3"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <span className="text-xs font-black uppercase tracking-wider text-purple-950 flex items-center gap-1.5">
              <Package className="w-4 h-4 text-purple-700" />
              Demande de Besoin & Remise Terrain (`COR-HANDOFF`)
            </span>
            <p className="text-[11px] text-purple-800 mt-0.5">
              Déclarez un besoin matière (`PDR`, `Part`, `Composant`). Le responsable choisit le canal (`STOCK`, `ACHAT`, `ATELIER`, `EXTERNE`), puis vous validez la pose et l’essai (`POSE_ESSAI` ➔ `CLOTURE_FIELD`).
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              data-testid="toggle-need-request-form-btn"
              onClick={() => setShowNeedRequestForm((v) => !v)}
              className="px-3 py-1.5 rounded-xl bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs transition cursor-pointer inline-flex items-center gap-1.5 shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>
                {showNeedRequestForm ? 'Fermer Formulaire Besoin' : '+ Demande de Besoin (ND)'}
              </span>
            </button>
          </div>
        </div>

        {showNeedRequestForm && (
          <div
            data-testid="need-request-live-form"
            className="p-3.5 rounded-xl bg-white border-2 border-purple-300 space-y-3"
          >
            <div className="flex items-center justify-between text-xs font-black text-purple-950 uppercase">
              <span>
                Nouvelle Demande de Besoin (Machine: {activeIntervention.code_machine} • BT:{' '}
                {activeIntervention.num_bt || activeIntervention.id})
              </span>
              <span className="text-[10px] font-mono bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                Statut initial: DEMANDE_TECH (Canal arbitré par Responsable)
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div>
                <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">
                  Classe Matière *
                </label>
                <select
                  value={needForm.material_class}
                  onChange={(e) => {
                    const nextCls = e.target.value as NeedMaterialClass;
                    const nextTag: MaintenancePolicyTag =
                      nextCls === 'PDR'
                        ? 'REPLACING'
                        : nextCls === 'OTHER'
                        ? 'MODIFYING'
                        : 'REPAIRABLE';
                    setNeedForm((p) => ({
                      ...p,
                      material_class: nextCls,
                      policy_tag: nextTag,
                    }));
                  }}
                  className="w-full py-2 px-2.5 text-xs font-bold rounded-lg border border-purple-200 bg-slate-50"
                >
                  {(Object.keys(NEED_MATERIAL_CLASS_LABELS) as NeedMaterialClass[]).map((cls) => (
                    <option key={cls} value={cls}>
                      {cls} — {NEED_MATERIAL_CLASS_LABELS[cls]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">
                  Quantité *
                </label>
                <input
                  type="number"
                  min={1}
                  value={needForm.quantite}
                  onChange={(e) =>
                    setNeedForm((p) => ({
                      ...p,
                      quantite: Math.max(1, Number(e.target.value) || 1),
                    }))
                  }
                  className="w-full py-2 px-2.5 text-xs font-mono font-bold rounded-lg border border-purple-200 bg-white"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">
                  Réf. PDR (Optionnel)
                </label>
                <input
                  type="text"
                  value={needForm.id_ref_pdr}
                  onChange={(e) =>
                    setNeedForm((p) => ({ ...p, id_ref_pdr: e.target.value }))
                  }
                  placeholder={formState.pdr_ref || 'Ex: RLM-6205...'}
                  className="w-full py-2 px-2.5 text-xs font-mono rounded-lg border border-purple-200 bg-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">
                Politique & Nature du Besoin (`POLICY-TAGS`)
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {(['REPLACING', 'REPAIRABLE', 'MODIFYING'] as MaintenancePolicyTag[]).map((tag) => {
                  const isSelected = needForm.policy_tag === tag;
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setNeedForm((p) => ({ ...p, policy_tag: tag }))}
                      className={`p-2 rounded-lg border text-left transition cursor-pointer flex flex-col gap-0.5 ${
                        isSelected
                          ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                          : 'bg-white text-slate-800 border-purple-200 hover:border-purple-300'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="font-mono font-bold text-[10px]">{tag}</span>
                        {isSelected && <span className="text-[9px] text-amber-400 font-bold">● Choisi</span>}
                      </div>
                      <span className={`text-[9.5px] font-medium leading-tight ${isSelected ? 'text-slate-300' : 'text-slate-600'}`}>
                        {POLICY_TAG_LABELS[tag]}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">
                Description du Besoin Technique *
              </label>
              <input
                type="text"
                value={needForm.description_besoin}
                onChange={(e) =>
                  setNeedForm((p) => ({ ...p, description_besoin: e.target.value }))
                }
                placeholder="Ex: Roulement palier principal usé, bague d'usure à remplacer ou confectionner..."
                className="w-full py-2 px-2.5 text-xs rounded-lg border border-purple-200 bg-white"
              />
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowNeedRequestForm(false)}
                className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-xs font-bold text-slate-700 cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                data-testid="submit-need-request-live-btn"
                onClick={handleEmitNeedRequest}
                className="px-4 py-1.5 rounded-lg bg-purple-700 hover:bg-purple-800 text-white text-xs font-black uppercase shadow-xs cursor-pointer"
              >
                Émettre Demande de Besoin (`DEMANDE_TECH`)
              </button>
            </div>
          </div>
        )}

        {linkedNeedRequests.length > 0 && (
          <div className="space-y-2">
            {linkedNeedRequests.map((req) => {
              const isBlocking = isNeedRequestBlockingBtClosure(req);
              const firstTag = req.policy_tags_snapshot?.[0];
              return (
                <div
                  key={req.id}
                  className={`p-2.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs ${
                    isBlocking
                      ? 'bg-amber-50/90 border-amber-300 text-amber-950'
                      : 'bg-emerald-50/90 border-emerald-300 text-emerald-950'
                  }`}
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-black px-2 py-0.5 rounded bg-white border border-current/20">
                      {req.code_demande}
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-black uppercase bg-white/80 font-mono">
                      {req.material_class} ×{req.quantite}
                    </span>
                    {firstTag && (
                      <span className="px-1.5 py-0.5 rounded text-[9.5px] font-mono font-bold bg-white text-slate-800 border border-slate-300">
                        Tag: {firstTag}
                      </span>
                    )}
                    {req.canal_appro && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-purple-100 text-purple-900 border border-purple-300">
                        Canal: {req.canal_appro}
                        {req.code_workshop_order ? ` (${req.code_workshop_order})` : ''}
                      </span>
                    )}
                    <span className="font-bold">{req.description_besoin}</span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 flex-wrap">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${
                        isBlocking
                          ? 'bg-amber-100 text-amber-900 border-amber-300'
                          : 'bg-emerald-100 text-emerald-900 border-emerald-300'
                      }`}
                    >
                      {NEED_STATUS_LABELS[req.statut] || req.statut}
                    </span>

                    {req.statut === 'REMIS_TECHNICIEN' && (
                      <button
                        type="button"
                        onClick={() => handleNeedFieldHandoff(req.id, 'POSE_ESSAI')}
                        className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-[11px] cursor-pointer transition shadow-2xs"
                      >
                        Démarrer Pose & Essai
                      </button>
                    )}

                    {req.statut === 'POSE_ESSAI' && (
                      <button
                        type="button"
                        onClick={() => handleNeedFieldHandoff(req.id, 'CLOTURE_FIELD')}
                        className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] cursor-pointer transition shadow-2xs"
                      >
                        Valider Essai OK (Clôturer Besoin)
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* CORRECTIVE-ATELIER-P0: Bon de Réalisation & Rectification (Atelier / Externe) lié au BT */}
      {(String(formState.intervention_nature || '').toUpperCase() === 'ATELIER' ||
        linkedWorkshopOrders.length > 0) && (
        <div
          data-testid="live-atelier-bridge-panel"
          className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-200/90 space-y-3"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <span className="text-xs font-black uppercase tracking-wider text-indigo-950 flex items-center gap-1.5">
                <Wrench className="w-4 h-4 text-indigo-700" />
                Bon d’Atelier / Rectification & Sous-Traitance lié au BT
              </span>
              <p className="text-[11px] text-indigo-800 mt-0.5">
                Tant qu’un bon d’atelier ou externe est en cours, le BT ne peut pas être clôturé définitivement (reste ou passe en <b>EN_ATTENTE_PDR</b>).
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap shrink-0">
              <button
                type="button"
                data-testid="toggle-bon-atelier-mecanique-btn"
                onClick={() => setShowBonAtelierMecaniqueForm((v) => !v)}
                className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition cursor-pointer inline-flex items-center gap-1.5 shadow-2xs"
              >
                <Wrench className="w-3.5 h-3.5" />
                <span>
                  {showBonAtelierMecaniqueForm
                    ? 'Fermer Bon Atelier'
                    : 'Bon atelier mécanique (BR / RECT)'}
                </span>
              </button>
              <button
                type="button"
                data-testid="toggle-quick-workshop-btn"
                onClick={() => setShowQuickWorkshopForm((v) => !v)}
                className="px-3 py-1.5 rounded-xl bg-indigo-700 hover:bg-indigo-800 text-white font-bold text-xs transition cursor-pointer inline-flex items-center gap-1.5 shadow-2xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{showQuickWorkshopForm ? 'Fermer' : '+ Sortie Externe / Bobinage'}</span>
              </button>
            </div>
          </div>

          {/* Dedicated Bon Atelier Mécanique (REALISATION / RECTIFICATION) Form */}
          {showBonAtelierMecaniqueForm && (
            <div
              data-testid="bon-atelier-mecanique-form"
              className="p-3.5 rounded-xl bg-amber-50/90 border-2 border-amber-300 space-y-3"
            >
              <div className="flex items-center justify-between text-xs font-black text-amber-950 uppercase">
                <span>
                  Demande Réalisation / Rectification — Atelier Fabrication Mécanique (Machine:{' '}
                  {activeIntervention.code_machine})
                </span>
                <span className="text-[10px] font-mono bg-white px-2 py-0.5 rounded border border-amber-300">
                  Section SM ➔ Atelier Interne (Sans impact Stock PDR)
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">
                    Type de Demande *
                  </label>
                  <select
                    value={bonAtelierForm.type_demande}
                    onChange={(e) =>
                      setBonAtelierForm((p) => ({
                        ...p,
                        type_demande: e.target.value as WorkshopOrderType,
                      }))
                    }
                    className="w-full py-2 px-2.5 text-xs font-bold rounded-lg border border-amber-300 bg-white"
                  >
                    <option value="REALISATION">REALISATION (Confection / Usinage neuf)</option>
                    <option value="RECTIFICATION">RECTIFICATION (Réparation / Tournage / Ajustage)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">
                    Quantité *
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={bonAtelierForm.quantite}
                    onChange={(e) =>
                      setBonAtelierForm((p) => ({
                        ...p,
                        quantite: Math.max(1, Number(e.target.value) || 1),
                      }))
                    }
                    className="w-full py-2 px-2.5 text-xs font-bold rounded-lg border border-amber-300 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">
                    Observation / Tolérance
                  </label>
                  <input
                    type="text"
                    value={bonAtelierForm.observation}
                    onChange={(e) =>
                      setBonAtelierForm((p) => ({ ...p, observation: e.target.value }))
                    }
                    placeholder="Urgence, plan, matière..."
                    className="w-full py-2 px-2.5 text-xs rounded-lg border border-amber-300 bg-white"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">
                  Description des travaux demandés *
                </label>
                <input
                  type="text"
                  value={bonAtelierForm.description_travaux}
                  onChange={(e) =>
                    setBonAtelierForm((p) => ({ ...p, description_travaux: e.target.value }))
                  }
                  placeholder="Ex: Usinage bague bronze Ø40x60 ou rectification arbre moteur..."
                  className="w-full py-2 px-2.5 text-xs rounded-lg border border-amber-300 bg-white"
                />
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowBonAtelierMecaniqueForm(false)}
                  className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-xs font-bold text-slate-700"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  data-testid="submit-bon-atelier-mecanique-btn"
                  onClick={handleEmitBonAtelierMecanique}
                  className="px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-black uppercase shadow-xs cursor-pointer"
                >
                  Émettre Bon Atelier & Mettre BT en Attente
                </button>
              </div>
            </div>
          )}

          {/* Existing Linked Internal Mechanical Workshop Orders (BR / RECT) */}
          {linkedInternalWorkshopOrders.length > 0 && (
            <div className="space-y-2">
              {linkedInternalWorkshopOrders.map((ord) => {
                const isOpen = isWorkshopOrderActive(ord.statut);
                return (
                  <div
                    key={ord.id}
                    className={`p-2.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs ${
                      isOpen
                        ? 'bg-amber-50/90 border-amber-300 text-amber-950'
                        : 'bg-emerald-50/90 border-emerald-300 text-emerald-950'
                    }`}
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-black px-2 py-0.5 rounded bg-white border border-current/20">
                        {ord.code_bon}
                      </span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-black uppercase bg-white/80">
                        {ord.type_demande} (Qté: {ord.quantite})
                      </span>
                      <span className="font-bold">{ord.description_travaux}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${
                          isOpen
                            ? 'bg-amber-100 text-amber-900 border-amber-300'
                            : 'bg-emerald-100 text-emerald-900 border-emerald-300'
                        }`}
                      >
                        Atelier: {WORKSHOP_STATUS_LABELS[ord.statut] || ord.statut}
                      </span>
                      {ord.statut === 'PRET_LIVRAISON' && (
                        <button
                          type="button"
                          onClick={() => {
                            const res = handleTransitionWorkshopOrderStatus(
                              ord.id,
                              'RECEPTIONNE_MONTAGE'
                            );
                            if (res.valid) {
                              showToast?.(
                                `Bon ${ord.code_bon} réceptionné pour montage. Le BT peut maintenant être clôturé.`,
                                'success'
                              );
                            }
                          }}
                          className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] cursor-pointer transition shadow-2xs"
                        >
                          Réceptionner Montage
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Existing Linked Workshop Orders */}
          {linkedWorkshopOrders.length > 0 && (
            <div className="space-y-2">
              {linkedWorkshopOrders.map((ord: any) => {
                const isOpen = SortieExterneService.isWorkshopOrderOpen(ord.etat);
                return (
                  <div
                    key={ord.id || ord.code}
                    className={`p-2.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs ${
                      isOpen
                        ? 'bg-amber-50/90 border-amber-300 text-amber-950'
                        : 'bg-emerald-50/90 border-emerald-300 text-emerald-950'
                    }`}
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-black px-2 py-0.5 rounded bg-white border border-current/20">
                        {ord.code}
                      </span>
                      <span className="font-bold">
                        {ord.nature_travail || ord.type_probleme}
                      </span>
                      <span className="text-[11px] opacity-80">
                        • {ord.fournisseur_externe}
                      </span>
                      <span className="font-mono font-bold text-[11px] bg-white/80 px-2 py-0.5 rounded">
                        {Number(ord.cout_bobinage || 0).toLocaleString()} DH
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${
                          isOpen
                            ? 'bg-amber-100 text-amber-900 border-amber-300'
                            : 'bg-emerald-100 text-emerald-900 border-emerald-300'
                        }`}
                      >
                        {ord.etat}
                      </span>
                      {isOpen && !isTechUser && (
                        <button
                          type="button"
                          onClick={() => {
                            handleMarkSortieReturned(ord.id, ord.cout_bobinage);
                            showToast?.(
                              `Bon ${ord.code} réceptionné (Retourné OK). Vous pouvez maintenant clôturer le BT.`,
                              'success'
                            );
                          }}
                          className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] cursor-pointer transition shadow-2xs"
                        >
                          Réceptionner OK
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Quick Workshop Creation Form */}
          {(showQuickWorkshopForm || linkedWorkshopOrders.length === 0) && (
            <div className="p-3.5 rounded-xl bg-white border border-indigo-200 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                    Type de Flux
                  </label>
                  <select
                    value={workshopQuickForm.categorie_flux}
                    onChange={(e) => {
                      const cat = e.target.value as 'ATELIER_MECANIQUE' | 'SOUS_TRAITANCE_EXTERNE';
                      setWorkshopQuickForm((p) => ({
                        ...p,
                        categorie_flux: cat,
                        nature_travail:
                          cat === 'ATELIER_MECANIQUE'
                            ? 'Usinage / Rectification'
                            : 'Bobinage complet',
                        fournisseur_externe:
                          cat === 'ATELIER_MECANIQUE'
                            ? 'Atelier Mécanique Interne'
                            : 'Atelier Bobinage Externe',
                      }));
                    }}
                    className="w-full py-2 px-2.5 text-xs font-bold rounded-lg border border-slate-200 bg-slate-50"
                  >
                    <option value="ATELIER_MECANIQUE">
                      Atelier Mécanique / Usinage & Rectification (BON-ATEL)
                    </option>
                    <option value="SOUS_TRAITANCE_EXTERNE">
                      Sous-Traitance Externe / Bobinage (SORT-EXT)
                    </option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                    Nature du Travail
                  </label>
                  <select
                    value={workshopQuickForm.nature_travail}
                    onChange={(e) =>
                      setWorkshopQuickForm((p) => ({ ...p, nature_travail: e.target.value }))
                    }
                    className="w-full py-2 px-2.5 text-xs font-semibold rounded-lg border border-slate-200 bg-slate-50"
                  >
                    {workshopQuickForm.categorie_flux === 'ATELIER_MECANIQUE' ? (
                      <>
                        <option value="Usinage / Rectification">Usinage / Rectification</option>
                        <option value="Tournage arbre / axe">Tournage arbre / axe</option>
                        <option value="Soudure / Rechargement">Soudure / Rechargement</option>
                        <option value="Confection pièce sur mesure">Confection pièce sur mesure</option>
                        <option value="Révision mécanique / Alésage">Révision mécanique / Alésage</option>
                      </>
                    ) : (
                      <>
                        <option value="Bobinage complet">Bobinage complet</option>
                        <option value="Remplacement roulements + étanchéité">
                          Remplacement roulements + étanchéité
                        </option>
                        <option value="Rectification collecteur / induit">
                          Rectification collecteur / induit
                        </option>
                        <option value="Réparation électronique / variateur">
                          Réparation électronique / variateur
                        </option>
                      </>
                    )}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                    Organe / Pièce à usiner ou réparer
                  </label>
                  <input
                    type="text"
                    value={workshopQuickForm.designation_piece}
                    onChange={(e) =>
                      setWorkshopQuickForm((p) => ({ ...p, designation_piece: e.target.value }))
                    }
                    placeholder={`Ex: Arbre principal / Moteur ${activeIntervention.code_machine}`}
                    className="w-full py-2 px-2.5 text-xs rounded-lg border border-slate-200 bg-white"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                      Atelier / Prestataire
                    </label>
                    <input
                      type="text"
                      value={workshopQuickForm.fournisseur_externe}
                      onChange={(e) =>
                        setWorkshopQuickForm((p) => ({
                          ...p,
                          fournisseur_externe: e.target.value,
                        }))
                      }
                      className="w-full py-2 px-2.5 text-xs rounded-lg border border-slate-200 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                      Coût estimé (DH)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={workshopQuickForm.cout_bobinage}
                      onChange={(e) =>
                        setWorkshopQuickForm((p) => ({
                          ...p,
                          cout_bobinage: Math.max(0, Number(e.target.value) || 0),
                        }))
                      }
                      className="w-full py-2 px-2.5 text-xs font-mono font-bold rounded-lg border border-slate-200 bg-white"
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 border-t border-slate-100">
                <label className="flex items-center gap-2 text-xs text-slate-700 font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={workshopQuickForm.suspendBtAfterCreate}
                    onChange={(e) =>
                      setWorkshopQuickForm((p) => ({
                        ...p,
                        suspendBtAfterCreate: e.target.checked,
                      }))
                    }
                    className="rounded border-indigo-300 text-indigo-600"
                  />
                  <span>
                    Suspendre automatiquement le BT en <b>EN_ATTENTE_PDR</b> après création du bon
                  </span>
                </label>
                <button
                  type="button"
                  data-testid="confirm-quick-workshop-btn"
                  onClick={handleQuickCreateWorkshopOrder}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs cursor-pointer transition shadow-xs"
                >
                  Enregistrer le Bon & Lier au BT
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Travail à faire & Suggestions d'Atelier */}
      <div className="space-y-2">
        <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
          Travail à Faire / Action Réalisée (Col K) <span className="text-rose-500">*</span>
        </label>
        <div className="relative">
          <input
            type="text"
            required
            value={formState.action_realisee || formState.travail_a_faire}
            onChange={(e) => {
              const val = e.target.value;
              setFormState((p) => ({ ...p, action_realisee: val, travail_a_faire: val }));
              setTravailSearch(val);
              setShowTravailSuggestions(true);
            }}
            onFocus={() => setShowTravailSuggestions(true)}
            placeholder="Ex: Démonter vis sans fin, vérification circuit de commande, changement huile..."
            className="w-full py-2.5 px-3.5 text-xs font-medium rounded-xl border border-slate-200 bg-slate-50/70 focus:bg-white focus:border-amber-400 focus:outline-hidden transition"
          />

          {/* Dropdown Suggestions */}
          {showTravailSuggestions && filteredSuggestions.length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-1 z-40 bg-white rounded-2xl border border-slate-200 shadow-xl max-h-48 overflow-y-auto p-2 space-y-1">
              <div className="text-[10px] font-extrabold uppercase text-slate-400 px-2 py-1">
                Suggestions Base Usine (143 phrases types) :
              </div>
              {filteredSuggestions.map((item, idx) => (
                <div
                  key={idx}
                  onClick={() => {
                    setFormState((p) => ({ ...p, action_realisee: item, travail_a_faire: item }));
                    setTravailSearch(item);
                    setShowTravailSuggestions(false);
                  }}
                  className="p-2 text-xs rounded-lg hover:bg-amber-50 text-slate-800 cursor-pointer font-medium transition"
                >
                  {item}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Actions fréquentes rapides en mode Wizard */}
      {isWizardMode && smartAnomalyActions.length > 0 && (
        <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200/80 space-y-1.5">
          <span className="text-[10.5px] font-black uppercase tracking-wider text-amber-950 block">
            Solutions rapides associées à « {activeIntervention.anomalie} » :
          </span>
          <div className="flex flex-wrap gap-1.5">
            {smartAnomalyActions.map((act, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() =>
                  setFormState((p) => ({ ...p, action_realisee: act, travail_a_faire: act }))
                }
                className="px-2.5 py-1 rounded-lg bg-white hover:bg-amber-100 text-amber-950 border border-amber-300 font-semibold text-[11px] cursor-pointer transition shadow-2xs"
              >
                + {act}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const step2PdrSection = (
    <div className="p-4 rounded-2xl bg-cyan-50/50 border border-cyan-200/80 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-black uppercase tracking-wider text-cyan-950 flex items-center gap-1.5">
          <Package className="w-4 h-4 text-cyan-700" />
          Pièce de Rechange Utilisée (Col L) & Sortie Magasin
        </span>
        <span className="text-[10px] font-mono text-cyan-800 bg-cyan-100 px-2 py-0.5 rounded-full font-bold">
          Liaison Stock_Actuel
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Search PDR in Stock */}
        <div className="relative sm:col-span-2">
          <label className="block text-[10.5px] font-bold text-slate-600 uppercase mb-1">
            Rechercher Article PDR au Magasin
          </label>
          <input
            type="text"
            value={pdrSearch}
            onChange={(e) => {
              setPdrSearch(e.target.value);
              setShowPdrList(true);
            }}
            onFocus={() => setShowPdrList(true)}
            placeholder="Ex: ROULEMENT, COURROIE, CAPTEUR..."
            className="w-full py-2 px-3 text-xs font-medium rounded-xl border border-cyan-200 bg-white focus:border-cyan-400 focus:outline-hidden transition"
          />

          {showPdrList && matchedStockItems.length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-1 z-40 bg-white rounded-2xl border border-cyan-200 shadow-xl max-h-48 overflow-y-auto p-2 space-y-1">
              {matchedStockItems.map((item) => {
                const dispo = item.stockActuel ?? item.stock_actuel ?? item.quantite ?? 0;
                return (
                  <div
                    key={item.ref || item.code_article}
                    onClick={() => handleSelectPdr(item)}
                    className="p-2 text-xs rounded-lg hover:bg-cyan-50 text-slate-800 cursor-pointer font-medium transition flex items-center justify-between"
                  >
                    <div className="min-w-0 pr-2 flex items-center gap-1.5 flex-wrap">
                      {item.isBomRecommended && (
                        <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 font-mono font-bold text-[10px] shrink-0">
                          ★ {item.bomSourceLabel || 'BOM'}
                        </span>
                      )}
                      <span className="font-mono font-bold text-cyan-900">{item.ref || item.code_article}</span>
                      <span className="text-slate-600 truncate">{item.designation || item.nom}</span>
                    </div>
                    <span
                      className={`font-mono text-[11px] font-bold px-2 py-0.5 rounded border shrink-0 ${
                        dispo > 0
                          ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                          : 'text-rose-700 bg-rose-50 border-rose-200'
                      }`}
                    >
                      Dispo: {dispo}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Real-time Selected PDR Confirmation & Stock Badge */}
          {formState.pdr_ref && (
            <div className="mt-2 p-2.5 rounded-xl bg-cyan-50/70 border border-cyan-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-cyan-950 bg-white px-2 py-0.5 rounded border border-cyan-300">
                  {formState.pdr_ref}
                </span>
                <span className="font-semibold text-slate-800 truncate">
                  {formState.pdr_designation}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span
                  className={`font-mono font-bold text-[11px] px-2 py-0.5 rounded border ${
                    Number(formState.pdr_quantite) > Number(formState.pdr_stock_actuel)
                      ? 'bg-amber-100 text-amber-900 border-amber-300'
                      : 'bg-emerald-100 text-emerald-900 border-emerald-300'
                  }`}
                >
                  Stock: {formState.pdr_stock_actuel ?? 0}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setFormState((prev) => ({
                      ...prev,
                      pdr_ref: '',
                      pdr_designation: '',
                      pdr_stock_actuel: undefined,
                    }));
                    setPdrSearch('');
                  }}
                  className="text-[11px] text-slate-400 hover:text-rose-600 font-bold underline cursor-pointer"
                >
                  Effacer
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Quantité Sortie + Bouton Ajouter Multi-PDR */}
        <div>
          <label className="block text-[10.5px] font-bold text-slate-600 uppercase mb-1">
            Quantité Utilisée
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              value={formState.pdr_quantite}
              onChange={(e) => setFormState({ ...formState, pdr_quantite: Number(e.target.value) })}
              className="w-full py-2 px-3 text-xs font-mono font-bold rounded-xl border border-cyan-200 bg-white focus:border-cyan-400 focus:outline-hidden"
            />
            <button
              type="button"
              onClick={handleAddPieceToList}
              disabled={!formState.pdr_ref}
              title="Ajouter cette pièce à la liste multi-PDR du Bon de Travail"
              className="px-3 py-2 rounded-xl bg-cyan-700 hover:bg-cyan-800 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold text-xs transition cursor-pointer shrink-0 inline-flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Ajouter</span>
            </button>
          </div>
        </div>
      </div>

      {/* Multi-PDR Consumed List (pieces_utilisees) */}
      {Array.isArray(formState.pieces_utilisees) && formState.pieces_utilisees.length > 0 && (
        <div className="p-3 rounded-xl bg-white/90 border border-cyan-200 space-y-2">
          <div className="flex items-center justify-between text-[11px] font-bold text-cyan-950">
            <span>Pièces sélectionnées pour sortie magasin ({formState.pieces_utilisees.length}) :</span>
            <span className="font-mono text-cyan-700">
              Total Qte: {formState.pieces_utilisees.reduce((s: number, p: any) => s + Number(p.quantite || 0), 0)}
            </span>
          </div>
          <div className="space-y-1.5">
            {formState.pieces_utilisees.map((piece: any) => (
              <div
                key={piece.ref}
                className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-cyan-50/70 border border-cyan-200/80 text-xs"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-mono font-bold text-cyan-950 bg-white px-2 py-0.5 rounded border border-cyan-300">
                    {piece.ref}
                  </span>
                  <span className="font-medium text-slate-700 truncate">
                    {piece.designation}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-mono font-black text-cyan-900 bg-cyan-100 px-2 py-0.5 rounded">
                    × {piece.quantite} {piece.unite || 'Pièce'}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemovePieceFromList(piece.ref)}
                    className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer transition"
                    title="Retirer de la liste"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
        {/* Marque */}
        <div>
          <label className="block text-[10.5px] font-bold text-slate-600 uppercase mb-1">
            Marque de la Pièce (Col M)
          </label>
          <input
            type="text"
            value={formState.marque}
            onChange={(e) => setFormState({ ...formState, marque: e.target.value })}
            placeholder="Ex: SKF, Schneider, Festo, Omron..."
            className="w-full py-2 px-3 text-xs font-medium rounded-xl border border-cyan-200 bg-white focus:border-cyan-400 focus:outline-hidden"
          />
        </div>

        {/* État de la Pièce */}
        <div>
          <label className="block text-[10.5px] font-bold text-slate-600 uppercase mb-1">
            État Pièce (Col N)
          </label>
          <select
            value={formState.etat_piece}
            onChange={(e) => setFormState({ ...formState, etat_piece: e.target.value })}
            className="w-full py-2 px-3 text-xs font-medium rounded-xl border border-cyan-200 bg-white focus:border-cyan-400 focus:outline-hidden"
          >
            <option value="Neuve">Neuve (Neuf usine)</option>
            <option value="Occasion">Occasion (Reconditionnée)</option>
            <option value="Réparée">Réparée sur place</option>
          </select>
        </div>

        {/* N° Bon Saisi par le Technicien (Optionnel — V2) */}
        <div>
          <label className="block text-[10.5px] font-bold text-slate-600 uppercase mb-1">
            N° Bon Magasin (Optionnel · Terrain)
          </label>
          <input
            type="text"
            value={formState.num_bon_saisi_par_tech || ''}
            onChange={(e) =>
              setFormState({ ...formState, num_bon_saisi_par_tech: e.target.value })
            }
            placeholder="Ex: BS-2026-0412 (pour contrôle)"
            className="w-full py-2 px-3 text-xs font-mono font-medium rounded-xl border border-cyan-200 bg-white focus:border-cyan-400 focus:outline-hidden"
          />
        </div>
      </div>
    </div>
  );

  const step3LifecycleSection = (
    <div className="space-y-4">
      {/* Organe / Composant (Cycle de vie) & Part (Localisation Structurelle — Sans déstockage) */}
      {(machineComponents.length > 0 ||
        machineParts.length > 0 ||
        formState.id_composant ||
        formState.id_part ||
        isWizardMode) && (
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/90 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-[10.5px] font-bold text-slate-600 uppercase mb-1 flex items-center gap-1">
              <Cpu className="w-3.5 h-3.5 text-cyan-700" />
              <span>Organe / Composant (Cycle de vie)</span>
            </label>
            <select
              value={formState.id_composant || ''}
              onChange={(e) => {
                const val = e.target.value;
                const found = machineComponents.find(
                  (c: any) => String(c.id_warehouse_item || c.id || c.id_item) === val
                );
                setFormState({
                  ...formState,
                  id_composant: val,
                  nom_composant: found
                    ? String(found.designation || found.nom_composant || found.nom || val)
                    : '',
                });
              }}
              className="w-full py-2 px-3 text-xs font-medium rounded-xl border border-slate-200 bg-white focus:border-cyan-400 focus:outline-hidden"
            >
              <option value="">— Aucun composant spécifique —</option>
              {machineComponents.map((comp: any) => {
                const cId = comp.id_warehouse_item || comp.id || comp.id_item;
                return (
                  <option key={cId} value={cId}>
                    {cId} · {comp.designation || comp.nom || 'Composant'} ({comp.status || 'En service'})
                  </option>
                );
              })}
            </select>
          </div>
          {formState.id_composant && (
            <div>
              <label className="block text-[10.5px] font-bold text-slate-600 uppercase mb-1">
                État du Composant après clôture
              </label>
              <select
                value={formState.statut_composant_cloture || 'En service'}
                onChange={(e) =>
                  setFormState({ ...formState, statut_composant_cloture: e.target.value })
                }
                className="w-full py-2 px-3 text-xs font-bold rounded-xl border border-slate-200 bg-white focus:border-cyan-400 focus:outline-hidden"
              >
                <option value="En service">En service (Opérationnel sur machine)</option>
                <option value="En réparation">En réparation (Déposé atelier / révision)</option>
                <option value="Hors service">Hors service (À réformer / remplacer)</option>
              </select>
            </div>
          )}
          <div>
            <label className="block text-[10.5px] font-bold text-slate-600 uppercase mb-1">
              Localisation / Part Structurelle (Sans déstockage)
            </label>
            <select
              value={formState.id_part || ''}
              onChange={(e) => {
                const val = e.target.value;
                const found = machineParts.find(
                  (p: any) => String(p.id_warehouse_item || p.id || p.id_item) === val
                );
                setFormState({
                  ...formState,
                  id_part: val,
                  nom_part: found
                    ? String(found.designation_part || found.designation || found.nom || val)
                    : '',
                });
              }}
              className="w-full py-2 px-3 text-xs font-medium rounded-xl border border-slate-200 bg-white focus:border-cyan-400 focus:outline-hidden"
            >
              <option value="">— Aucun site structurel —</option>
              {machineParts.map((part: any) => {
                const pId = part.id_warehouse_item || part.id || part.id_item;
                return (
                  <option key={pId} value={pId}>
                    {pId} · {part.designation_part || part.designation || part.nom || 'Part'}
                  </option>
                );
              })}
            </select>
          </div>
        </div>
      )}

      {/* Synthèse finale en mode Wizard */}
      {isWizardMode && (
        <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200/80 space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10.5px] font-mono font-bold uppercase tracking-wider text-amber-950">
              Synthèse du Bon de Travail ({activeIntervention.num_bt || 'BT'})
            </span>
            <span className="font-mono font-bold text-amber-900 bg-white px-2.5 py-0.5 rounded border border-amber-200">
              Temps Ouvré : {liveWorkingTime.formatted}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11.5px] text-slate-700">
            <div>
              <span className="text-slate-500">Machine : </span>
              <strong className="font-mono text-slate-900">{activeIntervention.code_machine}</strong>
            </div>
            <div>
              <span className="text-slate-500">PDR déclarées : </span>
              <strong className="font-mono text-slate-900">
                {Array.isArray(formState.pieces_utilisees) && formState.pieces_utilisees.length > 0
                  ? `${formState.pieces_utilisees.length} réf.`
                  : formState.pdr_ref
                  ? `1 réf. (${formState.pdr_ref})`
                  : 'Aucune PDR'}
              </strong>
            </div>
            <div className="sm:col-span-2 truncate">
              <span className="text-slate-500">Action Réalisée (Col K) : </span>
              <strong className="text-slate-900">
                {formState.action_realisee || formState.travail_a_faire || 'Non renseignée'}
              </strong>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const pauseAndSuspendButtons = (
    <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
      <button
        type="button"
        onClick={() => {
          setActiveLiveId(null);
          showToast?.(`Intervention ${activeIntervention.num_bt || ''} mise en pause.`, 'info');
          onNavigateToTab?.('corrective_bt');
        }}
        className="px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-100 font-bold text-xs text-slate-700 cursor-pointer w-full sm:w-auto"
      >
        Mettre en Pause / Quitter
      </button>

      {typeof onUpdateIntervention === 'function' && (
        <button
          type="button"
          onClick={() => {
            onUpdateIntervention(activeIntervention.id, {
              ...formState,
              statut: 'EN_ATTENTE_PDR',
            });
            setActiveLiveId(null);
            showToast?.(
              `BT ${activeIntervention.num_bt || activeIntervention.id} suspendu en attente de pièce (EN_ATTENTE_PDR).`,
              'warning'
            );
            onNavigateToTab?.('corrective_bt');
          }}
          className="px-4 py-2.5 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 font-bold text-xs text-amber-900 cursor-pointer w-full sm:w-auto"
        >
          Suspendre (Attente PDR)
        </button>
      )}
    </div>
  );

  const correctiveBtWizardProfile: WizardProfile = {
    id: 'corrective-bt-cloture-wizard',
    moduleKey: 'corrective_bt',
    code: activeIntervention.num_bt || 'BT-LIVE',
    title: isTechUser
      ? 'Assistant Déclaration Terrain (BT)'
      : 'Assistant Clôture Bon de Travail (BT)',
    subtitle: `Machine ${activeIntervention.code_machine} • ${activeIntervention.num_bt || 'BT'} • Colonnes Excel K → N`,
    themeColor: 'amber',
    finishLabel: isTechUser
      ? 'Soumettre pour Validation Responsable'
      : "Clôturer l'Intervention & Valider le Rapport",
    onFinish: async () => executeClotureOrSubmit(),
    steps: [
      {
        id: 'step-1-diagnostic',
        code: 'ÉTAPE 01',
        title: 'Action Réalisée (Col K)',
        description:
          "Renseignez le diagnostic technique et le travail effectivement réalisé sur l'équipement.",
        badge: 'COL K',
        icon: Wrench,
        content: step1DiagnosticSection,
        validate: () => {
          const actionText = String(
            formState.action_realisee || formState.travail_a_faire || ''
          ).trim();
          if (!actionText) {
            return {
              isValid: false,
              severity: 'critical',
              message:
                "Veuillez décrire le travail réalisé (Col K) avant de passer à l'étape des pièces de rechange.",
            };
          }
          return { isValid: true };
        },
      },
      {
        id: 'step-2-pdr',
        code: 'ÉTAPE 02',
        title: 'Pièces PDR & Magasin',
        description:
          'Sélectionnez les pièces de rechange consommées (Col L), leur marque (Col M), leur état (Col N) et le N° de bon.',
        badge: 'COL L-N',
        optional: true,
        validateOn: 'always',
        icon: Package,
        content: step2PdrSection,
        validate: (ctx) => {
          if (formState.pdr_ref && Number(formState.pdr_quantite) <= 0) {
            return {
              isValid: false,
              severity: 'critical',
              message: `La quantité pour la pièce [${formState.pdr_ref}] doit être supérieure à 0.`,
            };
          }

          const effectivePieces = buildEffectivePiecesList(formState);
          let stockWarningMessage: string | null = null;

          for (const piece of effectivePieces) {
            const ref = String(piece.ref || '').trim();
            if (!ref) continue;
            const qty = Number(piece.quantite || 0);
            if (qty <= 0) {
              return {
                isValid: false,
                severity: 'critical',
                message: `La quantité pour la pièce [${ref}] doit être supérieure à 0.`,
              };
            }

            const stockItem = rankedMachineStockItems.find(
              (s: any) =>
                String(s.ref || s.code_article || '').trim().toUpperCase() === ref.toUpperCase()
            );
            const availableStock =
              stockItem !== undefined
                ? Number(stockItem.stockActuel ?? stockItem.stock_actuel ?? stockItem.quantite ?? 0)
                : String(formState.pdr_ref || '').trim().toUpperCase() === ref.toUpperCase() &&
                    formState.pdr_stock_actuel !== undefined
                  ? Number(formState.pdr_stock_actuel)
                  : Infinity;

            if (qty > availableStock && !stockWarningMessage) {
              stockWarningMessage = `Attention : la quantité totale demandée pour [${ref}] (${qty}) dépasse le stock disponible (${availableStock}).`;
            }
          }

          // When advancing to Step 3 via "Suivant" (`mode === 'submit'`), auto-commit any pending
          // single PDR selection into `pieces_utilisees` so it is visibly listed and never lost.
          if (ctx?.mode === 'submit' && String(formState.pdr_ref || '').trim()) {
            setFormState((prev) => ({
              ...prev,
              pieces_utilisees: buildEffectivePiecesList(prev),
              pdr_ref: '',
              pdr_designation: '',
              pdr_quantite: 1,
              pdr_stock_actuel: undefined,
            }));
            setPdrSearch('');
          }

          if (stockWarningMessage) {
            return {
              isValid: true,
              severity: 'warning',
              message: stockWarningMessage,
            };
          }
          return { isValid: true };
        },
      },
      {
        id: 'step-3-cloture',
        code: 'ÉTAPE 03',
        title: 'Organe & Validation',
        description:
          "Mettez à jour l'état de l'organe ou de la part structurelle et validez la clôture du Bon de Travail.",
        badge: 'CLÔTURE',
        icon: CheckCircle,
        content: step3LifecycleSection,
        validate: () => {
          const actionText = String(
            formState.action_realisee || formState.travail_a_faire || ''
          ).trim();
          if (!actionText) {
            return {
              isValid: false,
              severity: 'critical',
              message: 'Le rapport de travail réalisé (Col K) est requis pour clôturer le BT.',
            };
          }
          if (!isTechUser) {
            const lotoCloseCheck = canCloseWorkOrderWithLoto(activeIntervention);
            if (!lotoCloseCheck.valid) {
              return {
                isValid: false,
                severity: 'critical',
                message:
                  lotoCloseCheck.reason ||
                  'Clôture bloquée : déconsignez le permis LOTO avant de clôturer le BT.',
              };
            }
          }
          return { isValid: true };
        },
      },
    ],
  };

  return (
    <div className="space-y-6">
      {/* 1. Live Chronometer & Shift Status Console */}
      <div className="bg-white rounded-3xl border border-slate-200/90 p-6 shadow-[0_12px_32px_-6px_rgba(0,0,0,0.12),0_4px_12px_-2px_rgba(0,0,0,0.06)] space-y-5 relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-500/10 border border-amber-300/80 flex items-center justify-center text-amber-700 shadow-xs">
              <Timer className="w-6 h-6 text-amber-700 animate-spin-slow" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-base font-black text-slate-900 tracking-tight">
                  {t('corrective.live.title')}
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-100 text-amber-900 border border-amber-300 animate-pulse">
                  EN DIRECT
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Machine : <b className="text-slate-800">{activeIntervention.code_machine}</b> • BT :{' '}
                <b className="text-blue-700">
                  {activeIntervention.num_bt || `BT-${String(activeIntervention.id || '').slice(-4) || 'N/A'}`}
                </b>{' '}
                • Intervenant :{' '}
                <b className="text-slate-800">{activeIntervention.intervenant || 'Non assigné'}</b>
              </p>
            </div>
          </div>

          {/* Shift status badge */}
          <div
            className={`px-3.5 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-2 self-start md:self-auto ${shiftStatus.color}`}
          >
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span>{shiftStatus.label}</span>
          </div>
        </div>

        {/* Big Digital Stopwatch Display */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2 bg-gradient-to-br from-slate-950 to-slate-900 text-white rounded-2xl p-6 shadow-inner flex flex-col sm:flex-row items-center justify-between gap-6 border border-slate-800">
            <div className="space-y-1 text-center sm:text-left">
              <div className="text-[11px] font-mono font-bold uppercase tracking-widest text-emerald-400 flex items-center gap-1.5 justify-center sm:justify-start">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
                <span>Temps Réel Ouvré Payé (Excel)</span>
              </div>
              <div className="text-4xl sm:text-5xl font-mono font-black tracking-tight text-white drop-shadow-md">
                {liveWorkingTime.formatted}
              </div>
              <p className="text-[11px] text-slate-400 font-mono">
                {liveWorkingTime.minutes} minutes effectives (Pauses déduites)
              </p>
            </div>

            <div className="bg-slate-800/80 p-3.5 rounded-xl border border-slate-700 text-xs font-mono space-y-1.5 text-slate-300 w-full sm:w-auto">
              <div className="flex justify-between gap-4">
                <span className="text-slate-400">Début :</span>
                <span className="font-bold text-white">
                  {activeIntervention.date_debut ||
                    activeIntervention.date_demande ||
                    activeIntervention.demande_date ||
                    new Date().toISOString().split('T')[0]}{' '}
                  à{' '}
                  {activeIntervention.heure_debut ||
                    activeIntervention.heure_demande ||
                    activeIntervention.demande_heure ||
                    '08:00'}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-slate-400">Pause Midi :</span>
                <span className="text-amber-400 font-bold">-00h 45m</span>
              </div>
              <div className="flex justify-between gap-4 pt-1 border-t border-slate-700">
                <span className="text-slate-400">Plage usine :</span>
                <span className="text-emerald-400 font-bold">08:00 - 17:00</span>
              </div>
            </div>
          </div>

          <div className="bg-amber-50/80 rounded-2xl p-5 border border-amber-200/80 flex flex-col justify-between space-y-3">
            <div>
              <span className="text-[10.5px] font-extrabold text-amber-950 uppercase tracking-wider block">
                Anomalie Constatée (Col J)
              </span>
              <p className="font-black text-slate-900 text-sm mt-1 font-mono">
                {activeIntervention.anomalie || 'Non spécifiée'}
              </p>
              <div className="mt-1 flex items-center gap-1.5 text-[11px] text-amber-800">
                <span className="font-bold">Type :</span>
                <span className="px-1.5 py-0.2 rounded bg-amber-200/60 font-mono font-bold">
                  {activeIntervention.type_panne || '—'}
                </span>
              </div>
            </div>

            {smartAnomalyActions.length > 0 && (
              <div className="pt-2 border-t border-amber-200 text-[11px]">
                <span className="font-bold text-amber-900 block mb-1">Actions Fréquentes Liées :</span>
                <div className="flex flex-wrap gap-1">
                  {smartAnomalyActions.slice(0, 2).map((act, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setFormState((p) => ({ ...p, action_realisee: act }))}
                      className="px-2 py-0.5 rounded-md bg-white hover:bg-amber-100 text-amber-950 border border-amber-300 font-medium text-[10px] cursor-pointer transition shadow-2xs"
                    >
                      {act}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 1b. Permis de Consignation Énergétique (LOTO) */}
      <LotoPermitPanel
        intervention={activeIntervention}
        onUpdateIntervention={onUpdateIntervention}
        onStartWork={handleStartLiveIntervention}
        showToast={showToast}
        isReadOnly={isReadOnlyUser}
        actorId={user?.personnelId || user?.code || user?.id}
        actorName={getTechnicianBadgeLabel(user, _technicians)}
        actorRole={String(user?.role || (isTechUser ? 'TECHNICIEN' : 'ADMIN')).trim().toUpperCase()}
      />

      {/* Clarification / Pending Validation Alert Banner */}
      {(activeIntervention.validation_status === 'NEEDS_CLARIFICATION' ||
        activeIntervention.validation_status === 'REJECTED') && (
        <div
          data-testid="live-clarification-banner"
          className="bg-rose-50 border border-rose-300 rounded-2xl p-4 flex items-start gap-3 text-xs text-rose-950 shadow-xs"
        >
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-black uppercase tracking-wider text-rose-900">
              {activeIntervention.validation_status === 'REJECTED'
                ? 'Déclaration Rejetée — Correction Requise'
                : 'Clarification Demandée par le Responsable'}
            </div>
            <p className="font-semibold text-rose-800">
              {activeIntervention.validation_note ||
                'Veuillez vérifier les pièces proposées, le numéro de bon ou la description du travail réalisé.'}
            </p>
            {activeIntervention.validated_by_name && (
              <p className="text-[11px] text-rose-700 font-mono">
                Contrôlé par : {activeIntervention.validated_by_name}
              </p>
            )}
          </div>
        </div>
      )}

      {activeIntervention.validation_status === 'PENDING_VALIDATION' && (
        <div
          data-testid="live-pending-validation-banner"
          className="bg-purple-50 border border-purple-300 rounded-2xl p-4 flex items-start gap-3 text-xs text-purple-950 shadow-xs"
        >
          <ShieldCheck className="w-5 h-5 text-purple-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-black uppercase tracking-wider text-purple-900">
              En attente de validation responsable (Aucun déstockage effectué)
            </div>
            <p className="text-purple-800 font-medium">
              {isTechUser
                ? 'Votre déclaration a été transmise. Vous pouvez encore rectifier les informations ci-dessous et renvoyer.'
                : `Déclaration soumise par ${activeIntervention.submitted_by_name || activeIntervention.intervenant || 'le technicien'}. Vérifiez les pièces proposées et validez pour clôturer et déduire le stock.`}
            </p>
          </div>
        </div>
      )}

      {/* 2. Clôture Form & PDR Consumption Card (Toggleable Classic ⇄ Wizard) */}
      <div className="bg-white rounded-3xl border border-slate-200/90 p-6 shadow-[0_12px_32px_-6px_rgba(0,0,0,0.12),0_4px_12px_-2px_rgba(0,0,0,0.06)] space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-200 flex items-center justify-center text-amber-700 shadow-2xs shrink-0">
              <FileCheck className="w-4 h-4 text-amber-700" />
            </div>
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">
                {isTechUser
                  ? 'Déclaration d’Intervention & Proposition Pièce de Rechange (PDR)'
                  : 'Rapport de Clôture & Sortie Pièce de Rechange (PDR)'}
              </h3>
              <p className="text-[11px] text-slate-400">
                {isTechUser
                  ? 'Saisie terrain soumise à validation • Aucun déstockage magasin avant approbation Admin'
                  : 'Liaisons Excel Colonnes K, L, M, N • Déstockage direct et traçabilité industrielle'}
              </p>
            </div>
          </div>

          {/* Mode Switcher: Formulaire Classique ⇄ Assistant Wizard */}
          <div
            className="inline-flex items-center p-1 rounded-xl bg-slate-100 border border-slate-200/90 shadow-2xs self-start sm:self-auto shrink-0"
            role="group"
            aria-label="Mode de clôture BT"
          >
            <button
              type="button"
              onClick={() => setWizardMode(false)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                !isWizardMode
                  ? 'bg-white text-slate-900 shadow-2xs border border-slate-200/80'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <LayoutList className="w-3.5 h-3.5 text-slate-600" />
              <span>Formulaire Classique</span>
            </button>

            <button
              type="button"
              onClick={() => setWizardMode(true)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                isWizardMode
                  ? 'bg-amber-600 text-white shadow-2xs'
                  : 'text-slate-500 hover:text-amber-700'
              }`}
            >
              <Wand2 className="w-3.5 h-3.5" />
              <span>Assistant Wizard</span>
            </button>
          </div>
        </div>

        {isWizardMode ? (
          <div className="space-y-4">
            <WizardShell
              profile={correctiveBtWizardProfile}
              layout="split"
              className="min-h-[480px] max-h-[760px]"
            />
            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              {pauseAndSuspendButtons}
            </div>
          </div>
        ) : (
          <form onSubmit={handleClotureSubmit} className="space-y-6">
            {step1DiagnosticSection}
            {step2PdrSection}
            {step3LifecycleSection}

            {/* Modal / Form Submit Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-100">
              {pauseAndSuspendButtons}

              <button
                type="submit"
                data-testid="live-submit-btn"
                className={`px-6 py-3 rounded-xl text-white font-bold text-xs transition cursor-pointer shadow-lg active:scale-95 flex items-center justify-center gap-2 w-full sm:w-auto ${
                  isTechUser
                    ? 'bg-purple-600 hover:bg-purple-700 shadow-purple-600/25'
                    : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/25'
                }`}
              >
                {isTechUser ? <ShieldCheck className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                <span>
                  {isTechUser
                    ? 'Soumettre pour Validation Responsable (Sans déstockage)'
                    : "Clôturer l'Intervention & Valider le Rapport"}
                </span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
