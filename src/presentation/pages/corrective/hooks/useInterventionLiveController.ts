import { useState, useEffect, useMemo, useRef, useSyncExternalStore, type FormEvent } from 'react';
import { CorrectiveCalculationService } from '../../../../domain/corrective/services/CorrectiveCalculationService';
import { stockIndexStore } from '../../../../application/StockIndexStore';
import { isWarehouseComponent, isWarehousePart } from '../../../../core/domain/EntrepotItem';
import { rankStockItemsByMachineBom } from '../../../../core/domain';
import { useGmaoStore } from '../../../../store/useGmaoStore';
import { useAuth } from '../../../../context/AuthContext';
import {
  isTechnicianRole,
  matchesTechnicianRecord,
  getTechnicianBadgeLabel,
} from '../../../../core/security/technicianScope';
import { SortieExterneService } from '../../../../application/services/SortieExterneService';
import { AuthorizationService } from '../../../../core/security/AuthorizationService';
import { canCloseWorkOrderWithLoto } from '../../../../domain/corrective/lotoService';
import {
  getLinkedWorkshopOrdersForIntervention,
  isWorkshopOrderActive,
  type WorkshopOrderType,
} from '../../../../domain/corrective/workshopOrderService';
import {
  getLinkedNeedRequestsForIntervention,
  isNeedRequestBlockingBtClosure,
  NEED_STATUS_LABELS,
  type MaintenancePolicyTag,
  type NeedMaterialClass,
  type NeedRequestStatus,
} from '../../../../domain/corrective/needRequestService';
import type { IMachine, IMouvement, IStockItem, ITechnician, IWarehouseItem } from '../../../../types/domain';
import type { CorrectiveInterventionItem, CorrectivePdrConsumedItem } from '../../../../types/store';
import type { BlueprintStockItemInput } from '../../../../core/domain/Blueprint';
import type { ToastState } from '../../../../hooks/useAppViewController';

export type LivePieceUsedItem = CorrectivePdrConsumedItem & {
  unite?: string;
  marque?: string;
  etat_piece?: string;
};

export interface LiveInterventionFormState {
  travail_a_faire: string;
  action_realisee: string;
  intervention_nature: string;
  pdr_ref: string;
  pdr_designation: string;
  pdr_quantite: number;
  pdr_prix?: number;
  pdr_unite?: string;
  pdr_stock_actuel?: number;
  marque: string;
  etat_piece: string;
  arret_machine: boolean;
  temps_arret: string;
  pieces_utilisees: LivePieceUsedItem[];
  num_bon_saisi_par_tech: string;
  id_composant: string;
  nom_composant: string;
  id_part: string;
  nom_part: string;
  statut_composant_cloture: string;
}

export type LiveWarehouseOption = IWarehouseItem & {
  id_item?: string;
  nom_composant?: string;
  nom?: string;
  designation_part?: string;
};

export type LiveRankedStockItem = BlueprintStockItemInput & {
  type?: string;
  marque?: string;
  prix?: number;
  isBomRecommended?: boolean;
  bomPriority?: 1 | 2 | 3;
  bomSourceLabel?: string;
  bomReason?: string;
};

export interface LiveShiftStatus {
  label: string;
  color: string;
}

export interface LiveNeedFormState {
  material_class: NeedMaterialClass;
  policy_tag: MaintenancePolicyTag;
  quantite: number;
  description_besoin: string;
  id_ref_pdr: string;
}

export interface LiveBonAtelierFormState {
  type_demande: WorkshopOrderType;
  quantite: number;
  description_travaux: string;
  observation: string;
}

export interface LiveWorkshopQuickFormState {
  categorie_flux: 'ATELIER_MECANIQUE' | 'SOUS_TRAITANCE_EXTERNE';
  nature_travail: string;
  designation_piece: string;
  fournisseur_externe: string;
  cout_bobinage: number;
  suspendBtAfterCreate: boolean;
}

export interface InterventionLiveTabProps {
  interventions?: CorrectiveInterventionItem[];
  machines?: IMachine[];
  technicians?: ITechnician[];
  activeLiveId?: string | number | null;
  setActiveLiveId?: (id: string | number | null) => void;
  onSubmitForValidation?: (
    id: string | number,
    submissionData?: Partial<CorrectiveInterventionItem> & Record<string, unknown>
  ) => unknown;
  onClotureIntervention?: (
    id: string | number,
    clotureData?: Partial<CorrectiveInterventionItem> & Record<string, unknown>,
    onAddMouvement?: ((mvt: IMouvement) => void) | null
  ) => unknown;
  onUpdateIntervention?: (
    id: string | number,
    patch?: Partial<CorrectiveInterventionItem> & Record<string, unknown>
  ) => void;
  onNavigateToTab?: (tab: string) => void;
  stockItems?: IStockItem[];
  warehouseItems?: IWarehouseItem[];
  onAddMouvement?: (mvt: IMouvement) => void;
  actionsByPanne?: Record<string, string[]>;
  travauxAFaire?: string[];
  getActionsForPanne?: (panne: string) => string[];
  onAddActionForPanne?: (panneKey: string, actionText: string) => void;
  showToast?: (msg: string, type?: ToastState['type']) => void;
}

const EMPTY_FORM_STATE: LiveInterventionFormState = {
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
};

/**
 * Merges any pending single-input PDR (`pdr_ref`) with `pieces_utilisees` so a selected part
 * is never silently dropped if the user clicks Suivant/Valider without clicking "+ Ajouter".
 */
export function buildEffectivePiecesList(state: LiveInterventionFormState): LivePieceUsedItem[] {
  const baseList: LivePieceUsedItem[] = Array.isArray(state.pieces_utilisees)
    ? state.pieces_utilisees.map((item) => ({ ...item }))
    : [];
  const pendingRef = String(state.pdr_ref || '').trim();
  const pendingQty = Number(state.pdr_quantite || 0);

  if (pendingRef && pendingQty > 0) {
    const existingIdx = baseList.findIndex(
      (p) => String(p.ref || '').trim().toUpperCase() === pendingRef.toUpperCase()
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
}

export function useInterventionLiveController({
  interventions = [],
  machines = [],
  technicians = [],
  activeLiveId,
  setActiveLiveId,
  onSubmitForValidation,
  onClotureIntervention,
  onUpdateIntervention,
  onNavigateToTab,
  stockItems = [],
  warehouseItems = [],
  actionsByPanne = {},
  travauxAFaire = [],
  getActionsForPanne: getActionsForPanneProp,
  showToast,
}: InterventionLiveTabProps) {
  const { user } = useAuth();
  const isTechUser = isTechnicianRole(user);
  const isReadOnlyUser = AuthorizationService.isReadOnly(user);

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
    return (interventions || []).filter((i) => matchesTechnicianRecord(i, user, technicians));
  }, [interventions, isTechUser, user, technicians]);

  const activeIntervention = useMemo(() => {
    if (!activeLiveId) {
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

  const machineMap = useMemo(() => {
    const map = new Map<string, IMachine>();
    (machines || []).forEach((m) => {
      const id = m.id_machine_registered || m.id;
      if (id) map.set(String(id), m);
    });
    return map;
  }, [machines]);

  // Real-time ticking chronometer (1s tick)
  const [currentTimestamp, setCurrentTimestamp] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTimestamp(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const liveWorkingTime = useMemo(() => {
    const now = new Date(currentTimestamp);
    const todayStr = now.toISOString().split('T')[0];
    const nowTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    if (!activeIntervention?.date_debut || !activeIntervention?.heure_debut) {
      return CorrectiveCalculationService.calculateWorkingTime(
        todayStr,
        '08:00',
        todayStr,
        nowTimeStr
      );
    }
    return CorrectiveCalculationService.calculateWorkingTime(
      activeIntervention.date_debut,
      activeIntervention.heure_debut,
      todayStr,
      nowTimeStr
    );
  }, [activeIntervention, currentTimestamp]);

  const shiftStatus = useMemo<LiveShiftStatus>(() => {
    const now = new Date(currentTimestamp);
    const currentM = now.getHours() * 60 + now.getMinutes();

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

  const [formState, setFormState] = useState<LiveInterventionFormState>(EMPTY_FORM_STATE);
  const [travailSearch, setTravailSearch] = useState('');
  const [showTravailSuggestions, setShowTravailSuggestions] = useState(false);
  const lastHydratedInterventionIdRef = useRef<string | null>(null);

  // Sync initial values ONLY when switching to a different active intervention ID
  // so background SSE / LAN state sync updates never wipe unsaved technician input.
  useEffect(() => {
    if (!activeIntervention) {
      lastHydratedInterventionIdRef.current = null;
      return;
    }
    const currentKey = String(activeIntervention.id ?? activeIntervention.num_bt ?? '');
    if (lastHydratedInterventionIdRef.current === currentKey) return;
    lastHydratedInterventionIdRef.current = currentKey;

    const rawPieces =
      Array.isArray(activeIntervention.pieces_utilisees) &&
      activeIntervention.pieces_utilisees.length > 0
        ? activeIntervention.pieces_utilisees
        : Array.isArray(activeIntervention.pieces_proposees) &&
            activeIntervention.pieces_proposees.length > 0
          ? activeIntervention.pieces_proposees
          : [];
    const initialPieces: LivePieceUsedItem[] = rawPieces.map((p) => ({
      ref: String(p.ref || ''),
      designation: String(p.designation || p.ref || ''),
      quantite: Number(p.quantite || 1),
      prix_unitaire: Number(p.prix_unitaire || 0),
      unite: String(p.unite || 'Pièce'),
      marque: typeof p.marque === 'string' ? p.marque : '',
      etat_piece: typeof p.etat_piece === 'string' ? p.etat_piece : 'Neuve',
    }));
    setFormState({
      travail_a_faire: String(activeIntervention.travail_a_faire || ''),
      action_realisee: String(activeIntervention.action_realisee || ''),
      intervention_nature: String(activeIntervention.intervention_nature || ''),
      pdr_ref: String(activeIntervention.pdr_ref || activeIntervention.pdr || ''),
      pdr_designation: String(activeIntervention.pdr_designation || ''),
      pdr_quantite: Number(activeIntervention.pdr_quantite || 1),
      marque: String(activeIntervention.marque || ''),
      etat_piece: String(activeIntervention.etat_piece || 'Neuve'),
      arret_machine: Boolean(activeIntervention.arret_machine),
      temps_arret: String(activeIntervention.temps_arret || ''),
      pieces_utilisees: initialPieces,
      num_bon_saisi_par_tech: String(activeIntervention.num_bon_saisi_par_tech || ''),
      id_composant: String(activeIntervention.id_composant || ''),
      nom_composant: String(activeIntervention.nom_composant || ''),
      id_part: String(activeIntervention.id_part || ''),
      nom_part: String(activeIntervention.nom_part || ''),
      statut_composant_cloture: String(activeIntervention.statut_composant_cloture || 'En service'),
    });
    setTravailSearch(String(activeIntervention.travail_a_faire || ''));
  }, [activeIntervention]);

  // Linked Workshop / External Orders & Need Requests
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

  const linkedNeedRequests = useMemo(() => {
    if (!activeIntervention) return [];
    return getLinkedNeedRequestsForIntervention(activeIntervention, needRequests);
  }, [activeIntervention, needRequests]);

  const blockingNeedRequests = useMemo(() => {
    return linkedNeedRequests.filter((req) => isNeedRequestBlockingBtClosure(req));
  }, [linkedNeedRequests]);

  const [showNeedRequestForm, setShowNeedRequestForm] = useState(false);
  const [needForm, setNeedForm] = useState<LiveNeedFormState>({
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
      nom_technicien_demandeur: user?.name || activeIntervention.intervenant || 'Technicien',
      material_class: needForm.material_class,
      policy_tags_snapshot: [needForm.policy_tag],
      id_ref_pdr: needForm.id_ref_pdr.trim() || formState.pdr_ref || null,
      designation_pdr: formState.pdr_designation || null,
      id_part: formState.id_part || activeIntervention.id_part || null,
      nom_part: String(formState.nom_part || activeIntervention.nom_part || '') || null,
      id_composant: formState.id_composant || activeIntervention.id_composant || null,
      nom_composant:
        String(formState.nom_composant || activeIntervention.nom_composant || '') || null,
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
  const [bonAtelierForm, setBonAtelierForm] = useState<LiveBonAtelierFormState>({
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
      setFormState((prev) => ({
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
  const [workshopQuickForm, setWorkshopQuickForm] = useState<LiveWorkshopQuickFormState>({
    categorie_flux: 'ATELIER_MECANIQUE',
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

    setFormState((prev) => ({
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
        id_sortie_atelier: String(created.id),
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

  // Machine components & structural parts from Entrepôt
  const machineComponents = useMemo(() => {
    if (!activeIntervention?.code_machine || !Array.isArray(warehouseItems)) return [];
    const code = String(activeIntervention.code_machine).trim().toUpperCase();
    return warehouseItems.filter((w) => {
      const wMach = String(w.id_machine_registered || w.id_machine || w.machine_id || '')
        .trim()
        .toUpperCase();
      return (wMach === code || wMach.includes(code)) && isWarehouseComponent(w);
    });
  }, [activeIntervention?.code_machine, warehouseItems]);

  const machineParts = useMemo(() => {
    if (!activeIntervention?.code_machine || !Array.isArray(warehouseItems)) return [];
    const code = String(activeIntervention.code_machine).trim().toUpperCase();
    return warehouseItems.filter((w) => {
      const wMach = String(w.id_machine_registered || w.id_machine || w.machine_id || '')
        .trim()
        .toUpperCase();
      return (wMach === code || wMach.includes(code)) && isWarehousePart(w);
    });
  }, [activeIntervention?.code_machine, warehouseItems]);

  const filteredSuggestions = useMemo(() => {
    if (!travailSearch) return (travauxAFaire || []).slice(0, 15);
    const term = travailSearch.toLowerCase();
    return (travauxAFaire || [])
      .filter((item) => String(item).toLowerCase().includes(term))
      .slice(0, 20);
  }, [travailSearch, travauxAFaire]);

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

  // BOM-Ranked Stock Items for PDR lookup
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

  const handleSelectPdr = (item: LiveRankedStockItem) => {
    const stockQty = Number(item.stockActuel ?? item.stock_actuel ?? item.quantite ?? 0);
    setFormState((prev) => ({
      ...prev,
      pdr_ref: String(item.ref || item.code_article || ''),
      pdr_designation: String(item.designation || item.nom || ''),
      pdr_prix: Number(item.prix || item.prix_unitaire || 0),
      pdr_unite: String(item.unite || 'Pièce'),
      pdr_stock_actuel: stockQty,
      marque: String(item.marque || prev.marque || 'Origine'),
    }));
    setPdrSearch(
      `${item.ref || item.code_article || ''} - ${item.designation || item.nom || ''}`
    );
    setShowPdrList(false);
  };

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
        (p: LivePieceUsedItem) =>
          String(p.ref || '').toUpperCase() !== String(refToRemove || '').toUpperCase()
      ),
    }));
  };

  const executeClotureOrSubmit = (): boolean => {
    if (!activeIntervention) {
      showToast?.('Aucune intervention active sélectionnée', 'warning');
      return false;
    }

    const effectivePieces = buildEffectivePiecesList(formState);
    const selectedNature = String(formState.intervention_nature || '').trim().toUpperCase();

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

    const targetMachine = machineMap.get(String(activeIntervention.code_machine || ''));
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
          submitted_by_name: getTechnicianBadgeLabel(user, technicians),
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
          submitted_by_name: getTechnicianBadgeLabel(user, technicians),
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
      onNavigateToTab?.('corrective_bt');
      return true;
    }

    // 2. ADMIN / SUPERVISOR PATH: Direct approved closure & single stock deduction
    if (openWorkshopOrders.length > 0) {
      const openCodes = openWorkshopOrders
        .map((o) => ('code_bon' in o ? o.code_bon : o.code))
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

    const closedResult =
      typeof onClotureIntervention === 'function'
        ? onClotureIntervention(activeIntervention.id, {
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
          })
        : null;

    if (closedResult === null) {
      showToast?.(
        'Clôture refusée : vérifiez la disponibilité du stock PDR, le travail réalisé, le permis LOTO ou les bons atelier liés.',
        'error'
      );
      return false;
    }

    showToast?.(
      `Intervention ${activeIntervention.num_bt || activeIntervention.code_machine} validée et clôturée (${liveWorkingTime.formatted} ouvré)`,
      'success'
    );

    setActiveLiveId?.(null);
    onNavigateToTab?.('corrective_cloture');
    return true;
  };

  const handleClotureSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    executeClotureOrSubmit();
  };

  const actorName = getTechnicianBadgeLabel(user, technicians);
  const actorRole = String(user?.role || (isTechUser ? 'TECHNICIEN' : 'ADMIN'))
    .trim()
    .toUpperCase();

  return {
    user,
    isTechUser,
    isReadOnlyUser,
    actorName,
    actorRole,
    activeIntervention,
    liveWorkingTime,
    shiftStatus,
    formState,
    setFormState,
    travailSearch,
    setTravailSearch,
    showTravailSuggestions,
    setShowTravailSuggestions,
    filteredSuggestions,
    smartAnomalyActions,
    pdrSearch,
    setPdrSearch,
    showPdrList,
    setShowPdrList,
    rankedMachineStockItems,
    matchedStockItems,
    handleSelectPdr,
    handleAddPieceToList,
    handleRemovePieceFromList,
    machineComponents,
    machineParts,
    linkedWorkshopOrders,
    linkedInternalWorkshopOrders,
    linkedNeedRequests,
    showNeedRequestForm,
    setShowNeedRequestForm,
    needForm,
    setNeedForm,
    handleEmitNeedRequest,
    handleNeedFieldHandoff,
    showBonAtelierMecaniqueForm,
    setShowBonAtelierMecaniqueForm,
    bonAtelierForm,
    setBonAtelierForm,
    handleEmitBonAtelierMecanique,
    showQuickWorkshopForm,
    setShowQuickWorkshopForm,
    workshopQuickForm,
    setWorkshopQuickForm,
    handleQuickCreateWorkshopOrder,
    handleStartLiveIntervention,
    handleTransitionWorkshopOrderStatus,
    handleMarkSortieReturned,
    executeClotureOrSubmit,
    handleClotureSubmit,
  };
}
