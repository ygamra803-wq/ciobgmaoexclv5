import { useState, useEffect, useMemo } from 'react';
import {
  X,
  Zap,
  TrendingDown,
  TrendingUp,
  SlidersHorizontal,
  Wrench,
  Clock,
  Sparkles,
  Users,
  RotateCcw,
  Inbox,
  CheckCircle2,
  Factory,
  MapPin,
  Tag,
  Boxes,
  AlertTriangle,
} from 'lucide-react';
import CustomSelect from '../../components/common/CustomSelect';
import SequentialCodePicker from '../../components/common/SequentialCodePicker';
import { filterActiveMachines } from '../../../utils/activeMachines';
import { useGmaoStore } from '../../../store/useGmaoStore';
import { resolveActiveActorContext } from '../../../store/slices/storeBootstrapSlice';

export default function QuickMovementModal({
  isOpen,
  onClose,
  article,
  initialFlow = 'Sortie Interne',
  initialAction = 'CORRECTIVE',
  zones = [],
  machines = [],
  technicians = [],
  mouvements = [],
  onAddMouvement,
}: any) {
  const activeMachines = useMemo(() => filterActiveMachines(machines), [machines]);
  const activeTechnicians = useMemo(
    () =>
      (technicians || []).filter(
        (t) => t && t.is_active !== false && t.actif !== false && t.statut !== 'ARCHIVE'
      ),
    [technicians]
  );

  const normalizeFlow = (flow: string) => {
    if (flow === 'Ajustement & Recalibrage' || flow === 'Ajustement') return 'Ajustement';
    if (flow === 'Sortie') return 'Sortie Interne';
    if (flow === 'Entrée') return 'Entrée Externe';
    return flow || 'Sortie Interne';
  };
  const normalizeAction = (action: string, flow?: string) => {
    if (action === 'RETOUR_ATELIER') return 'RETOUR';
    if (flow === 'Ajustement' && (!action || action === 'INVENTAIRE')) return 'AJUSTEMENT_ENTREE';
    return action || 'CORRECTIVE';
  };

  const [flowType, setFlowType] = useState(() => normalizeFlow(initialFlow));
  const [actionId, setActionId] = useState(() =>
    normalizeAction(initialAction, normalizeFlow(initialFlow))
  );
  const [quantite, setQuantite] = useState(1);
  const [targetStock, setTargetStock] = useState(article?.stockActuel ?? 0);
  const [adjustMode, setAdjustMode] = useState<'DIRECT' | 'DELTA'>('DIRECT');
  const [idZone, setIdZone] = useState(zones[0]?.id_zone || '');
  const [idMachine, setIdMachine] = useState(activeMachines[0]?.id_machine_registered || '');
  const [technicien, setTechnicien] = useState(activeTechnicians[0]?.nom || '');
  const [fournisseur, setFournisseur] = useState('Fournisseur Central Industriel');
  const [commentaire, setCommentaire] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  const autoBonCode = useMemo(() => {
    const nums = (mouvements || [])
      .map((m) => {
        const raw = String(m.code_bon || '');
        const match = raw.match(/(\d+)/);
        return match ? parseInt(match[1], 10) : 0;
      })
      .filter((n) => !isNaN(n) && n > 0);
    const max = nums.length > 0 ? Math.max(...nums) : 0;
    return `Bon-${String(max + 1).padStart(3, '0')}`;
  }, [mouvements]);

  const takenBonNumbers = useMemo(() => {
    const set = new Set();
    (mouvements || []).forEach((m) => {
      const match = String(m.code_bon || '').match(/(\d+)/);
      if (match) set.add(parseInt(match[1], 10));
    });
    return set;
  }, [mouvements]);

  const [codeBon, setCodeBon] = useState(autoBonCode);

  // Synchronize when initialFlow or article changes
  useEffect(() => {
    if (article) {
      const normFlow = normalizeFlow(initialFlow);
      setFlowType(normFlow);
      setActionId(normalizeAction(initialAction, normFlow));
      setQuantite(1);
      setTargetStock(article.stockActuel ?? 0);
      setAdjustMode(normFlow === 'Ajustement' ? 'DIRECT' : 'DELTA');
      setCommentaire('');
      setValidationError(null);
      setCodeBon(autoBonCode);
    }
  }, [initialFlow, initialAction, article, autoBonCode]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !article) return null;

  // Handle flow change
  const handleFlowChange = (newFlow: string) => {
    setFlowType(newFlow);
    setValidationError(null);
    if (newFlow === 'Sortie Interne') {
      setActionId('CORRECTIVE');
    } else if (newFlow === 'Entrée Interne') {
      setActionId('RETOUR');
    } else if (newFlow === 'Entrée Externe') {
      setActionId('REAPPRO');
    } else if (newFlow === 'Ajustement') {
      setAdjustMode('DIRECT');
      setTargetStock(Number(article.stockActuel || 0));
      setActionId('AJUSTEMENT_ENTREE');
    }
  };

  // Filter available machines by zone
  const availableMachines = idZone
    ? activeMachines.filter((m) => m.id_zone_default === idZone)
    : activeMachines;

  const currentStock = Number(article.stockActuel ?? article.stockInitial ?? 0);
  const articleRef = String(article.ref || article.id_warehouse_item || article.code || '').trim();
  const isDeltaOut =
    flowType === 'Sortie Interne' ||
    (flowType === 'Ajustement' && adjustMode === 'DELTA' && actionId === 'AJUSTEMENT_SORTIE');
  const qteNum = Math.max(1, Number(quantite || 1));

  // Calculate previewed stock after movement & detect stock deficit
  let previewStock = currentStock;
  if (flowType === 'Sortie Interne') {
    previewStock = currentStock - qteNum;
  } else if (flowType === 'Entrée Interne' || flowType === 'Entrée Externe') {
    previewStock = currentStock + qteNum;
  } else if (flowType === 'Ajustement') {
    if (adjustMode === 'DIRECT') {
      previewStock = Math.max(0, Number(targetStock || 0));
    } else {
      previewStock =
        actionId === 'AJUSTEMENT_SORTIE' ? currentStock - qteNum : currentStock + qteNum;
    }
  }

  const hasStockDeficit =
    (flowType !== 'Ajustement' || adjustMode === 'DELTA') && isDeltaOut && qteNum > currentStock;

  const handleSubmit = (e: any) => {
    e.preventDefault();
    setValidationError(null);

    if (hasStockDeficit) {
      setValidationError(
        `Stock insuffisant pour [${articleRef}] : disponible ${currentStock}, demandé ${qteNum}.`
      );
      return;
    }

    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const actualCodeBon = codeBon || autoBonCode;
    const actor = resolveActiveActorContext();
    const isFieldOnlyRole = actor.actorRole === 'TECHNICIEN' || actor.actorRole === 'OPERATEUR';

    // Maker-Checker enforcement: if a field technician submits a Sortie Interne, route through SortieDemand
    if (isFieldOnlyRole && flowType === 'Sortie Interne') {
      const store = useGmaoStore.getState();
      if (typeof store.handleSubmitSortieDemand === 'function') {
        store.handleSubmitSortieDemand({
          code_bon_tech: actualCodeBon,
          type: 'Sortie Interne',
          date: dateStr,
          technicien: technicien || actor.actorName,
          submitted_by_id: actor.actorId,
          submitted_by_name: technicien || actor.actorName,
          id_machine_registered: idMachine,
          id_zone: idZone,
          notes: commentaire || `Sortie rapide (${actionId})`,
          items: [
            {
              ref: articleRef,
              designation: article.designation || articleRef,
              quantite: qteNum,
              prix_unitaire: Number(article.prix_unitaire ?? article.prixUnitaire ?? article.prix ?? 0) || 0,
            },
          ],
        });
      }
      onClose();
      return;
    }

    if (flowType === 'Ajustement' && adjustMode === 'DIRECT') {
      const clampedTarget = Math.max(0, Number(targetStock) || 0);
      const diff = clampedTarget - currentStock;
      if (diff === 0) {
        onClose();
        return;
      }

      const mvtType = diff > 0 ? 'Entrée' : 'Sortie';
      const mvtRecord = {
        id: crypto.randomUUID(),
        code_bon: actualCodeBon,
        date: dateStr,
        heure: timeStr,
        timestamp: now.toISOString(),
        ref: articleRef,
        designation: article.designation,
        quantite: Math.abs(diff),
        stock_avant: currentStock,
        stock_apres: clampedTarget,
        type: mvtType,
        action_id: 'INVENTAIRE',
        technicien: technicien || actor.actorName || 'Magasinier Central',
        id_zone: idZone || '',
        id_machine_registered: '',
        commentaire: commentaire
          ? `[Ajustement Inventaire Réel] ${commentaire}`
          : `[Ajustement Inventaire Réel] Rectification du stock de ${currentStock} à ${clampedTarget}`,
      };

      if (onAddMouvement) {
        onAddMouvement(mvtRecord);
      }

      const store = useGmaoStore.getState();
      if (typeof store.appendAuditEvent === 'function') {
        store.appendAuditEvent({
          actorId: actor.actorId,
          actorName: actor.actorName,
          actorRole: actor.actorRole,
          actionType: 'STOCK_INVENTORY_ADJUSTED',
          entityType: 'STOCK_ITEM',
          entityId: articleRef,
          before: { stockActuel: currentStock },
          after: {
            stockActuel: clampedTarget,
            delta: diff,
            mode: 'DIRECT',
            code_bon: actualCodeBon,
            commentaire: mvtRecord.commentaire,
          },
        });
      }
    } else {
      // Delta Movement
      const mvtType = isDeltaOut ? 'Sortie' : 'Entrée';
      const effectiveActionId =
        flowType === 'Ajustement' ? 'INVENTAIRE' : actionId;

      const mvtRecord = {
        id: crypto.randomUUID(),
        code_bon: actualCodeBon,
        date: dateStr,
        heure: timeStr,
        timestamp: now.toISOString(),
        ref: articleRef,
        designation: article.designation,
        quantite: qteNum,
        stock_avant: currentStock,
        stock_apres: previewStock,
        type: mvtType,
        action_id: effectiveActionId,
        id_zone: flowType.includes('Entrée') || flowType === 'Ajustement' ? '' : idZone,
        id_machine_registered:
          flowType.includes('Entrée') || flowType === 'Ajustement' ? '' : idMachine,
        technicien: technicien || actor.actorName || 'Technicien Intervenant',
        fournisseur: flowType === 'Entrée Externe' ? fournisseur : '',
        emplacement_reception: article.emplacement || '',
        commentaire:
          commentaire ||
          (flowType === 'Ajustement'
            ? `[Ajustement Inventaire Delta ${isDeltaOut ? '-' : '+'}${qteNum}]`
            : `Action Rapide: ${flowType} - ${actionId}`),
      };

      if (onAddMouvement) {
        onAddMouvement(mvtRecord);
      }

      if (flowType === 'Ajustement') {
        const store = useGmaoStore.getState();
        if (typeof store.appendAuditEvent === 'function') {
          store.appendAuditEvent({
            actorId: actor.actorId,
            actorName: actor.actorName,
            actorRole: actor.actorRole,
            actionType: 'STOCK_INVENTORY_ADJUSTED',
            entityType: 'STOCK_ITEM',
            entityId: articleRef,
            before: { stockActuel: currentStock },
            after: {
              stockActuel: previewStock,
              delta: isDeltaOut ? -qteNum : qteNum,
              mode: 'DELTA',
              code_bon: actualCodeBon,
              commentaire: mvtRecord.commentaire,
            },
          });
        }
      }
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/45 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg border border-slate-200 overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-cyan-50 border border-cyan-200/80 flex items-center justify-center text-cyan-700 shadow-2xs font-bold">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-slate-900">Action & Flux Rapide</h3>
                <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-700">
                  {article.ref}
                </span>
              </div>
              <p className="text-xs text-slate-500 truncate max-w-xs">{article.designation}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          {/* N° Bon de Mouvement */}
          <div>
            <SequentialCodePicker
              prefix="Bon-"
              currentCode={codeBon}
              onChangeCode={(newCode) => setCodeBon(newCode)}
              autoGeneratedCode={autoBonCode}
              takenNumbers={takenBonNumbers}
              padLength={3}
              label="N° Bon de Mouvement (A)"
              helperText="Code séquentiel du bon ou sélection libre d'un numéro disponible"
            />
          </div>

          {/* 1. Sélection du Flux Principal */}
          <div>
            <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1.5 flex items-center gap-1.5">
              <SlidersHorizontal className="w-3.5 h-3.5 text-cyan-600" />
              <span>Type de Flux (Opération PDR)</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                {
                  id: 'Sortie Interne',
                  label: 'Sortie Interne',
                  desc: 'Machine / Zone',
                  icon: <TrendingDown className="w-3.5 h-3.5" />,
                  color: 'border-rose-300 text-rose-950 bg-rose-50',
                  activeColor: 'ring-2 ring-rose-500 bg-rose-100/70 border-rose-500 font-bold',
                },
                {
                  id: 'Entrée Interne',
                  label: 'Entrée Interne',
                  desc: 'Retour Atelier',
                  icon: <TrendingUp className="w-3.5 h-3.5" />,
                  color: 'border-cyan-300 text-cyan-950 bg-cyan-50',
                  activeColor: 'ring-2 ring-cyan-500 bg-cyan-100/70 border-cyan-500 font-bold',
                },
                {
                  id: 'Entrée Externe',
                  label: 'Entrée Externe',
                  desc: 'Réappro / Fournisseur',
                  icon: <Inbox className="w-3.5 h-3.5" />,
                  color: 'border-emerald-300 text-emerald-950 bg-emerald-50',
                  activeColor: 'ring-2 ring-emerald-500 bg-emerald-100/70 border-emerald-500 font-bold',
                },
                {
                  id: 'Ajustement',
                  label: 'Ajustement',
                  desc: 'Inventaire & Recalibrage',
                  icon: <SlidersHorizontal className="w-3.5 h-3.5" />,
                  color: 'border-amber-300 text-amber-950 bg-amber-50',
                  activeColor: 'ring-2 ring-amber-500 bg-amber-100/70 border-amber-500 font-bold',
                },
              ].map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => handleFlowChange(f.id)}
                  className={`p-2.5 rounded-xl border text-left transition flex flex-col justify-between cursor-pointer ${
                    flowType === f.id ? f.activeColor : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-[11px]">{f.label}</span>
                    {f.icon}
                  </div>
                  <span className="text-[9.5px] text-slate-500 leading-tight">{f.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 2. Sélection de l'Action / Motif spécifique */}
          <div>
            <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1.5 flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-indigo-600" />
              <span>Motif & Action de l'Intervention</span>
            </label>

            {flowType === 'Sortie Interne' && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: 'CORRECTIVE', label: 'Corrective', tag: 'Panne', icon: <Wrench className="w-3 h-3 text-rose-600" /> },
                  { id: 'PREVENTIVE', label: 'Préventive', tag: 'Entretien', icon: <Clock className="w-3 h-3 text-blue-600" /> },
                  { id: 'AMELIORATIVE', label: 'Amélioration', tag: 'Projet', icon: <Sparkles className="w-3 h-3 text-emerald-600" /> },
                  { id: 'USAGE', label: 'Usage Perso', tag: 'Intervenant', icon: <Users className="w-3 h-3 text-purple-600" /> },
                ].map((act) => (
                  <button
                    key={act.id}
                    type="button"
                    onClick={() => setActionId(act.id)}
                    className={`p-2 rounded-xl border text-left transition cursor-pointer flex items-center justify-between ${
                      actionId === act.id
                        ? 'bg-rose-50 border-rose-400 text-rose-950 font-bold ring-1 ring-rose-300'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      {act.icon}
                      <span className="text-xs">{act.label}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {flowType === 'Entrée Interne' && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {[
                  { id: 'RETOUR', label: 'Retour Atelier', desc: 'Pièce non utilisée', icon: <RotateCcw className="w-3 h-3 text-cyan-600" /> },
                  { id: 'RECUPERATION', label: 'Récupération', desc: 'Démontage machine', icon: <Boxes className="w-3 h-3 text-blue-600" /> },
                  { id: 'INVENTAIRE', label: 'Surplus Inventaire', desc: 'Écart positif', icon: <CheckCircle2 className="w-3 h-3 text-emerald-600" /> },
                ].map((act) => (
                  <button
                    key={act.id}
                    type="button"
                    onClick={() => setActionId(act.id)}
                    className={`p-2 rounded-xl border text-left transition cursor-pointer flex items-center justify-between ${
                      actionId === act.id
                        ? 'bg-cyan-50 border-cyan-400 text-cyan-950 font-bold ring-1 ring-cyan-300'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      {act.icon}
                      <span className="text-xs">{act.label}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {flowType === 'Entrée Externe' && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {[
                  { id: 'REAPPRO', label: 'Réapprovisionnement', desc: 'Bon Fournisseur', icon: <Inbox className="w-3 h-3 text-emerald-600" /> },
                  { id: 'RETOUR_GARANTIE', label: 'Retour Garantie', desc: 'Échange constructeur', icon: <CheckCircle2 className="w-3 h-3 text-teal-600" /> },
                  { id: 'ACHAT_DIRECT', label: 'Achat Direct', desc: 'Achat d’urgence', icon: <Tag className="w-3 h-3 text-indigo-600" /> },
                ].map((act) => (
                  <button
                    key={act.id}
                    type="button"
                    onClick={() => setActionId(act.id)}
                    className={`p-2 rounded-xl border text-left transition cursor-pointer flex items-center justify-between ${
                      actionId === act.id
                        ? 'bg-emerald-50 border-emerald-400 text-emerald-950 font-bold ring-1 ring-emerald-300'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      {act.icon}
                      <span className="text-xs">{act.label}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {flowType === 'Ajustement' && (
              <div className="space-y-2">
                <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setAdjustMode('DIRECT');
                      setValidationError(null);
                    }}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                      adjustMode === 'DIRECT'
                        ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    Corriger le Stock Réel (Valeur Finale)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAdjustMode('DELTA');
                      if (actionId !== 'AJUSTEMENT_ENTREE' && actionId !== 'AJUSTEMENT_SORTIE') {
                        setActionId('AJUSTEMENT_ENTREE');
                      }
                      setValidationError(null);
                    }}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                      adjustMode === 'DELTA'
                        ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    Ajustement par Quantité (+ / -)
                  </button>
                </div>

                {adjustMode === 'DELTA' && (
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setActionId('AJUSTEMENT_ENTREE');
                        setValidationError(null);
                      }}
                      className={`p-2 rounded-xl border text-left transition cursor-pointer flex items-center justify-between ${
                        actionId === 'AJUSTEMENT_ENTREE'
                          ? 'bg-emerald-50 border-emerald-400 text-emerald-950 font-bold ring-1 ring-emerald-300'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-xs">+ Écart Positif (Ajout)</span>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setActionId('AJUSTEMENT_SORTIE');
                        setValidationError(null);
                      }}
                      className={`p-2 rounded-xl border text-left transition cursor-pointer flex items-center justify-between ${
                        actionId === 'AJUSTEMENT_SORTIE'
                          ? 'bg-rose-50 border-rose-400 text-rose-950 font-bold ring-1 ring-rose-300'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <TrendingDown className="w-3.5 h-3.5 text-rose-600" />
                        <span className="text-xs">- Écart Négatif (Retrait)</span>
                      </div>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 3. Quantité & Calcul du Nouveau Stock */}
          <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Stock Actuel Avant Opération
                </span>
                <span className="font-mono text-base font-black text-slate-900">
                  {currentStock} <span className="text-xs font-normal text-slate-500">pcs</span>
                </span>
              </div>

              <div className="text-center font-black text-slate-400">→</div>

              <div className="text-right">
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider block ${
                    hasStockDeficit ? 'text-rose-600' : 'text-emerald-600'
                  }`}
                >
                  Nouveau Solde Estimé
                </span>
                <span
                  className={`font-mono text-base font-black ${
                    hasStockDeficit ? 'text-rose-700' : 'text-emerald-700'
                  }`}
                >
                  {previewStock} <span className="text-xs font-normal text-slate-500">pcs</span>
                </span>
              </div>
            </div>

            {flowType === 'Ajustement' && adjustMode === 'DIRECT' ? (
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  Nouveau Stock Réel en Inventaire
                </label>
                <input
                  type="number"
                  min="0"
                  value={targetStock}
                  onChange={(e) => setTargetStock(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  className="w-full h-10 px-3 rounded-xl border border-slate-300 bg-white font-mono font-black text-sm text-slate-900 focus:ring-1 focus:ring-amber-500"
                  required
                />
              </div>
            ) : (
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  Quantité à {isDeltaOut ? 'déduire (-)' : 'ajouter (+)'}
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    value={quantite}
                    onChange={(e) => {
                      setQuantite(Math.max(1, parseInt(e.target.value, 10) || 1));
                      setValidationError(null);
                    }}
                    className={`w-full h-10 px-3 rounded-xl border bg-white font-mono font-black text-sm text-slate-900 focus:ring-1 ${
                      hasStockDeficit
                        ? 'border-rose-400 focus:ring-rose-500'
                        : 'border-slate-300 focus:ring-cyan-500'
                    }`}
                    required
                  />
                  <div className="flex gap-1">
                    {[1, 2, 5, 10].map((quickQte) => (
                      <button
                        key={quickQte}
                        type="button"
                        onClick={() => {
                          setQuantite(quickQte);
                          setValidationError(null);
                        }}
                        className="px-2.5 h-10 rounded-xl bg-white border border-slate-200 text-xs font-mono font-bold text-slate-700 hover:bg-slate-100 cursor-pointer"
                      >
                        {isDeltaOut ? `-${quickQte}` : `+${quickQte}`}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {(hasStockDeficit || validationError) && (
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-2 text-[11px] font-semibold">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>
                  {validationError ||
                    `Stock insuffisant pour [${articleRef}] : disponible ${currentStock} pcs, demandé ${qteNum} pcs.`}
                </span>
              </div>
            )}
          </div>

          {/* 4. Données de Traçabilité (Zone, Machine, Technicien) */}
          {flowType === 'Sortie Interne' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1 flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-purple-600" />
                  <span>Zone Destinataire</span>
                </label>
                <CustomSelect
                  value={idZone}
                  onChange={(val) => {
                    setIdZone(val);
                    const relMch = activeMachines.filter((m) => m.id_zone_default === val);
                    setIdMachine(relMch[0]?.id_machine_registered || '');
                  }}
                  options={zones.map((z) => ({ value: z.id_zone, label: `${z.libelle} (${z.id_zone})` }))}
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1 flex items-center gap-1">
                  <Factory className="w-3 h-3 text-emerald-600" />
                  <span>Machine / Équipement</span>
                </label>
                <CustomSelect
                  value={idMachine}
                  onChange={(val) => setIdMachine(val)}
                  options={availableMachines.map((m) => ({
                    value: m.id_machine_registered,
                    label: `${m.id_machine_registered} - ${m.designation}`,
                  }))}
                />
              </div>
            </div>
          )}

          {flowType === 'Entrée Externe' && (
            <div>
              <label className="text-[11px] font-bold text-slate-600 block mb-1">
                Fournisseur / Origine
              </label>
              <input
                type="text"
                placeholder="Nom du fournisseur..."
                value={fournisseur}
                onChange={(e) => setFournisseur(e.target.value)}
                className="w-full h-9 px-3 rounded-xl border border-slate-200 bg-white text-xs"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold text-slate-600 block mb-1 flex items-center gap-1">
                <Users className="w-3 h-3 text-blue-600" />
                <span>Intervenant / Technicien</span>
              </label>
              <CustomSelect
                value={technicien}
                onChange={(val) => setTechnicien(val)}
                options={activeTechnicians.map((t) => ({ value: t.nom, label: `${t.nom} (${t.id_technician})` }))}
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-600 block mb-1">
                Note / Commentaire rapide
              </label>
              <input
                type="text"
                placeholder="Optionnel..."
                value={commentaire}
                onChange={(e) => setCommentaire(e.target.value)}
                className="w-full h-9 px-3 rounded-xl border border-slate-200 bg-white text-xs"
              />
            </div>
          </div>

          {/* Modal Actions */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition cursor-pointer text-xs"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={hasStockDeficit}
              className={`px-5 py-2.5 rounded-xl font-bold transition shadow-xs text-xs flex items-center gap-1.5 ${
                hasStockDeficit
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  : 'bg-slate-900 hover:bg-black text-white cursor-pointer active:scale-[0.98]'
              }`}
            >
              <CheckCircle2 className={`w-4 h-4 ${hasStockDeficit ? 'text-slate-400' : 'text-emerald-400'}`} />
              <span>Valider l'Opération Immédiate</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
