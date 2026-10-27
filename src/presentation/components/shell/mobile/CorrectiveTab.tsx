import { useState, useMemo, useEffect } from 'react';
import {
  Wrench,
  Plus,
  Play,
  Send,
  AlertTriangle,
  X,
  Trash2,
  Package,
  Search,
  FileText,
  Clock,
} from 'lucide-react';
import { getTechnicianDisplayName } from '../../../../core/security/technicianScope';
import { filterActiveMachines } from '../../../../utils/activeMachines';

export type MobileCorrFilter = 'ACTIVE' | 'CLARIFY' | 'PENDING' | 'ALL';

interface ProposedBtPart {
  ref: string;
  designation: string;
  quantite: number;
  unite: string;
  prix_unitaire: number;
}

interface CorrectiveTabProps {
  currentUser: any;
  technicians: any[];
  techScope: any;
  machines: any[];
  zones: any[];
  stockItems: any[];
  activeLiveInterventionId?: string | null;
  initialFilter?: MobileCorrFilter;
  initialOpenNewDi?: boolean;
  initialBtToSubmit?: any | null;
  onClearInitialIntent?: () => void;
  onAddDemandeIntervention: (data: any) => any;
  onStartLiveIntervention: (id: string) => void;
  onSubmitInterventionForValidation: (id: string, submissionData: any) => any;
  onOpenMachineQrModal?: (machineId: string) => void;
  showToast?: (msg: string, type?: string) => void;
}

export default function CorrectiveTab({
  currentUser,
  technicians = [],
  techScope,
  machines = [],
  zones = [],
  stockItems = [],
  activeLiveInterventionId,
  initialFilter = 'ACTIVE',
  initialOpenNewDi = false,
  initialBtToSubmit = null,
  onClearInitialIntent,
  onAddDemandeIntervention,
  onStartLiveIntervention,
  onSubmitInterventionForValidation,
  onOpenMachineQrModal,
  showToast,
}: CorrectiveTabProps) {
  const [corrFilter, setCorrFilter] = useState<MobileCorrFilter>(initialFilter);
  const [searchQuery, setSearchQuery] = useState('');

  // Quick New DI Sheet State
  const [showNewDiSheet, setShowNewDiSheet] = useState(false);
  const [diMachineId, setDiMachineId] = useState('');
  const [diAnomalie, setDiAnomalie] = useState('');
  const [diCategorie, setDiCategorie] = useState('MECANIQUE');
  const [diUrgence, setDiUrgence] = useState<'Mineure' | 'Majeure' | 'Critique (Arrêt)'>('Majeure');
  const [diArretMachine, setDiArretMachine] = useState(false);

  // BT Report Submission Sheet State (Maker-Checker)
  const [selectedBtForSubmit, setSelectedBtForSubmit] = useState<any | null>(null);
  const [btActionRealisee, setBtActionRealisee] = useState('');
  const [btNumBon, setBtNumBon] = useState('');
  const [btArretMachine, setBtArretMachine] = useState(false);
  const [btTempsArret, setBtTempsArret] = useState('');
  const [btPiecesProposees, setBtPiecesProposees] = useState<ProposedBtPart[]>([]);
  const [pickerRef, setPickerRef] = useState('');
  const [pickerQty, setPickerQty] = useState('1');

  const activeMachines = useMemo(() => filterActiveMachines(machines), [machines]);

  useEffect(() => {
    setCorrFilter(initialFilter);
  }, [initialFilter]);

  useEffect(() => {
    if (initialOpenNewDi) {
      setShowNewDiSheet(true);
      onClearInitialIntent?.();
    } else if (initialBtToSubmit) {
      handleOpenBtSubmitSheet(initialBtToSubmit);
      onClearInitialIntent?.();
    }
  }, [initialOpenNewDi, initialBtToSubmit]);

  const myInterventions = techScope?.myCorrectiveInterventions || [];
  const openCorrective = techScope?.openCorrective || [];
  const clarifyCorrective = techScope?.needsClarificationCorrective || [];
  const pendingValCorrective = techScope?.pendingValidationCorrective || [];

  const filteredItems = useMemo(() => {
    let base: any[] = [];
    if (corrFilter === 'CLARIFY') {
      base = clarifyCorrective;
    } else if (corrFilter === 'PENDING') {
      base = pendingValCorrective;
    } else if (corrFilter === 'ACTIVE') {
      const combined = [...clarifyCorrective, ...openCorrective];
      base = combined.filter(
        (item, idx, arr) => arr.findIndex((x) => String(x.id) === String(item.id)) === idx
      );
    } else {
      base = myInterventions;
    }

    const q = searchQuery.trim().toLowerCase();
    if (!q) return base;
    return base.filter((item: any) => {
      const machine = String(item.code_machine || item.id_machine_registered || '').toLowerCase();
      const bt = String(item.num_bt || item.id || '').toLowerCase();
      const anom = String(item.anomalie || item.travail_a_faire || '').toLowerCase();
      return machine.includes(q) || bt.includes(q) || anom.includes(q);
    });
  }, [corrFilter, searchQuery, myInterventions, openCorrective, clarifyCorrective, pendingValCorrective]);

  const handleCreateMobileDi = (e: React.FormEvent) => {
    e.preventDefault();
    if (!diMachineId || !diAnomalie.trim()) return;

    const targetMachine = activeMachines.find(
      (m) =>
        String(m.id_machine_registered || m.id || m.code) === String(diMachineId)
    );
    const machineCode = targetMachine?.id_machine_registered || targetMachine?.id || diMachineId;
    const targetZone = zones.find(
      (z) =>
        String(z.id_zone || z.code_zone) ===
        String(targetMachine?.id_zone_default || targetMachine?.id_zone)
    );
    const techName =
      getTechnicianDisplayName(currentUser, technicians) ||
      currentUser?.personnelName ||
      currentUser?.name ||
      currentUser?.nom ||
      'Technicien';
    const techId = String(
      currentUser?.personnelId ||
        currentUser?.code ||
        currentUser?.id_technician ||
        currentUser?.id ||
        ''
    );

    onAddDemandeIntervention({
      code_machine: machineCode,
      id_machine_registered: machineCode,
      nom_machine: targetMachine?.designation || targetMachine?.nom || machineCode,
      id_zone: targetMachine?.id_zone_default || targetMachine?.id_zone || '',
      zone:
        targetZone?.nom_zone ||
        targetZone?.libelle ||
        targetMachine?.id_zone_default ||
        targetMachine?.id_zone ||
        '',
      anomalie: diAnomalie.trim(),
      travail_a_faire: diAnomalie.trim(),
      urgence: diUrgence,
      priorite: diUrgence === 'Critique (Arrêt)' ? 'Critique' : diUrgence,
      arret_machine: diArretMachine || diUrgence === 'Critique (Arrêt)',
      categorie_panne: diCategorie,
      type_panne: diCategorie,
      demandeur: techName,
      intervenant: techName,
      id_technician: techId,
      technicien_matricule: techId,
    });

    setDiAnomalie('');
    setDiArretMachine(false);
    setShowNewDiSheet(false);
    showToast?.("Demande d'intervention (DI) enregistrée sur le terrain.", 'success');
  };

  const handleOpenBtSubmitSheet = (bt: any) => {
    setSelectedBtForSubmit(bt);
    setBtActionRealisee(bt.action_realisee || bt.travail_a_faire || '');
    setBtNumBon(bt.num_bon_saisi_par_tech || '');
    setBtArretMachine(Boolean(bt.arret_machine));
    setBtTempsArret(bt.temps_arret || '');

    const initialParts: ProposedBtPart[] = [];
    const rawList =
      Array.isArray(bt.pieces_proposees) && bt.pieces_proposees.length > 0
        ? bt.pieces_proposees
        : bt.pdr_ref
        ? [
            {
              ref: bt.pdr_ref,
              designation: bt.pdr_designation || bt.pdr_ref,
              quantite: Number(bt.pdr_quantite || 1),
            },
          ]
        : [];

    rawList.forEach((p: any) => {
      const ref = String(p?.ref || p?.code_article || '').trim();
      if (!ref) return;
      const stockMatch = stockItems.find(
        (s) => String(s.ref || '').trim().toUpperCase() === ref.toUpperCase()
      );
      initialParts.push({
        ref,
        designation: String(p?.designation || stockMatch?.designation || ref).trim(),
        quantite: Math.max(1, Number(p?.quantite ?? p?.qty ?? 1)),
        unite: String(p?.unite || p?.unit || stockMatch?.unite || 'Pièce'),
        prix_unitaire: Number(
          p?.prix_unitaire ?? p?.unitPrice ?? stockMatch?.prix ?? stockMatch?.prix_unitaire ?? 0
        ),
      });
    });

    setBtPiecesProposees(initialParts);
    setPickerRef('');
    setPickerQty('1');
  };

  const handleAddBtPartRow = () => {
    const cleanRef = pickerRef.trim();
    if (!cleanRef) return;
    const qtyNum = Math.max(1, Number(pickerQty) || 1);
    const matchedStock = stockItems.find(
      (s) => String(s.ref || '').trim().toUpperCase() === cleanRef.toUpperCase()
    );

    setBtPiecesProposees((prev) => {
      const idx = prev.findIndex((p) => p.ref.toUpperCase() === cleanRef.toUpperCase());
      if (idx >= 0) {
        return prev.map((item, i) =>
          i === idx ? { ...item, quantite: item.quantite + qtyNum } : item
        );
      }
      return [
        ...prev,
        {
          ref: cleanRef,
          designation: matchedStock?.designation || cleanRef,
          quantite: qtyNum,
          unite: matchedStock?.unite || 'Pièce',
          prix_unitaire: Number(matchedStock?.prix || matchedStock?.prix_unitaire || 0),
        },
      ];
    });
    setPickerRef('');
    setPickerQty('1');
  };

  const handleRemoveBtPartRow = (refToRemove: string) => {
    setBtPiecesProposees((prev) => prev.filter((p) => p.ref !== refToRemove));
  };

  const handleSubmitMobileBt = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBtForSubmit || !btActionRealisee.trim()) return;

    const finalParts = [...btPiecesProposees];
    if (pickerRef.trim()) {
      const cleanRef = pickerRef.trim();
      const qtyNum = Math.max(1, Number(pickerQty) || 1);
      const matchedStock = stockItems.find(
        (s) => String(s.ref || '').trim().toUpperCase() === cleanRef.toUpperCase()
      );
      const existingIdx = finalParts.findIndex(
        (p) => p.ref.toUpperCase() === cleanRef.toUpperCase()
      );
      if (existingIdx >= 0) {
        finalParts[existingIdx] = {
          ...finalParts[existingIdx],
          quantite: finalParts[existingIdx].quantite + qtyNum,
        };
      } else {
        finalParts.push({
          ref: cleanRef,
          designation: matchedStock?.designation || cleanRef,
          quantite: qtyNum,
          unite: matchedStock?.unite || 'Pièce',
          prix_unitaire: Number(matchedStock?.prix || matchedStock?.prix_unitaire || 0),
        });
      }
    }

    const techName =
      getTechnicianDisplayName(currentUser, technicians) ||
      currentUser?.personnelName ||
      currentUser?.name ||
      currentUser?.nom ||
      'Technicien';
    const techId = String(
      currentUser?.personnelId ||
        currentUser?.code ||
        currentUser?.id_technician ||
        currentUser?.id ||
        'tech'
    );

    // Maker-Checker Submission: sets validation_status = 'PENDING_VALIDATION', action_fermee = 'NON'
    // Zero direct stock movement until Admin reviews and approves
    onSubmitInterventionForValidation(selectedBtForSubmit.id, {
      action_realisee: btActionRealisee.trim(),
      travail_a_faire: selectedBtForSubmit.travail_a_faire || btActionRealisee.trim(),
      intervenant: techName,
      submitted_by_id: techId,
      submitted_by_name: techName,
      submitted_at: new Date().toISOString(),
      pieces_proposees: finalParts,
      num_bon_saisi_par_tech: btNumBon.trim(),
      arret_machine: btArretMachine,
      temps_arret: btTempsArret.trim(),
    });

    setSelectedBtForSubmit(null);
    showToast?.(
      'Rapport BT transmis au responsable (En attente validation — sans clôture ni déduction stock immédiate).',
      'success'
    );
  };

  return (
    <div data-testid="mobile-tab-corrective" className="space-y-3">
      {/* Header & Filter Bar */}
      <div className="bg-white rounded-2xl p-3.5 border border-slate-200 shadow-2xs space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
            <Wrench className="w-4 h-4 text-amber-600" />
            <span>Correctif Terrain ({filteredItems.length})</span>
          </h2>
          <button
            type="button"
            onClick={() => setShowNewDiSheet(true)}
            data-testid="mobile-corr-new-di-btn"
            className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-1 shadow-2xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Nouvelle DI</span>
          </button>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filtrer par machine, N° BT ou anomalie..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-8 pr-3 py-2 text-xs text-slate-800"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {[
            {
              id: 'ACTIVE',
              label: `Actifs (${openCorrective.length})`,
              activeClass: 'bg-slate-900 text-white',
            },
            {
              id: 'CLARIFY',
              label: `À clarifier (${clarifyCorrective.length})`,
              activeClass: 'bg-rose-600 text-white',
            },
            {
              id: 'PENDING',
              label: `En attente val. (${pendingValCorrective.length})`,
              activeClass: 'bg-purple-600 text-white',
            },
            {
              id: 'ALL',
              label: `Tous (${myInterventions.length})`,
              activeClass: 'bg-amber-600 text-white',
            },
          ].map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setCorrFilter(f.id as MobileCorrFilter)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                corrFilter === f.id
                  ? f.activeClass
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Interventions Cards */}
      {filteredItems.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 border border-slate-200 text-center space-y-2">
          <Wrench className="w-8 h-8 text-slate-400 mx-auto" />
          <div className="text-sm font-bold text-slate-800">Aucune intervention dans ce filtre</div>
          <p className="text-xs text-slate-500">
            Utilisez « Nouvelle DI » pour signaler une anomalie sur une machine active.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredItems.map((item: any) => {
            const status = String(item.statut || 'DEMANDE').toUpperCase();
            const vStatus = String(item.validation_status || 'NONE').toUpperCase();
            const isClosed =
              status === 'CLOTURE' || String(item.action_fermee || '').toUpperCase() === 'OUI';
            const isClarify = vStatus === 'NEEDS_CLARIFICATION' || vStatus === 'REJECTED';
            const isPending =
              vStatus === 'PENDING_VALIDATION' || status === 'EN_ATTENTE_VALIDATION';
            const isLive =
              status === 'EN_COURS' ||
              (activeLiveInterventionId && String(activeLiveInterventionId) === String(item.id));
            const machineCode = item.code_machine || item.id_machine_registered || 'MACHINE';

            return (
              <div
                key={item.id}
                data-testid={`mobile-corr-card-${item.id}`}
                className={`bg-white rounded-2xl p-4 border shadow-2xs space-y-3 ${
                  isClarify
                    ? 'border-rose-400 ring-1 ring-rose-200'
                    : isLive
                    ? 'border-emerald-300'
                    : 'border-slate-200'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        type="button"
                        onClick={() => onOpenMachineQrModal?.(machineCode)}
                        className="font-mono text-sm font-black text-slate-900 hover:text-amber-700 underline decoration-dotted cursor-pointer"
                        title="Ouvrir Fiche Terrain Machine"
                      >
                        {machineCode}
                      </button>

                      <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-mono text-[10px] font-bold">
                        {item.num_bt || item.id}
                      </span>

                      {isClarify && (
                        <span className="px-2 py-0.5 rounded bg-rose-600 text-white font-mono text-[10px] font-black">
                          À CLARIFIER
                        </span>
                      )}
                      {isPending && (
                        <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-800 font-mono text-[10px] font-bold">
                          EN ATTENTE VALIDATION
                        </span>
                      )}
                      {isLive && !isPending && !isClosed && (
                        <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-mono text-[10px] font-black">
                          EN_COURS (LIVE)
                        </span>
                      )}
                      {isClosed && (
                        <span className="px-2 py-0.5 rounded bg-slate-200 text-slate-800 font-mono text-[10px] font-bold">
                          CLÔTURÉ
                        </span>
                      )}
                    </div>

                    <div className="text-xs font-bold text-slate-900">
                      {item.anomalie || item.travail_a_faire || 'Anomalie signalée'}
                    </div>

                    {item.action_realisee && (
                      <div className="text-[11px] text-slate-600">
                        Action : {item.action_realisee}
                      </div>
                    )}

                    <div className="flex items-center gap-2 flex-wrap text-[10px] font-mono text-slate-500">
                      {item.demande_date && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {item.demande_date} {item.demande_heure || ''}
                        </span>
                      )}
                      {item.urgence && <span>• Urgence : {item.urgence}</span>}
                    </div>
                  </div>

                  <span className="px-2 py-1 rounded-lg bg-slate-100 text-slate-700 font-mono text-[10px] font-bold shrink-0">
                    {status}
                  </span>
                </div>

                {/* Supervisor Clarification Banner */}
                {item.validation_note && (
                  <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2 text-xs text-rose-900">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-black">Note Admin (À clarifier) : </span>
                      <span>{item.validation_note}</span>
                    </div>
                  </div>
                )}

                {/* Proposed Spares Summary */}
                {Array.isArray(item.pieces_proposees) && item.pieces_proposees.length > 0 && (
                  <div className="p-2 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center gap-1.5 flex-wrap text-[11px] text-slate-700 font-mono">
                    <Package className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span>PDR proposées :</span>
                    {item.pieces_proposees.map((p: any, idx: number) => (
                      <span
                        key={`${p.ref}-${idx}`}
                        className="px-1.5 py-0.5 rounded bg-white border border-slate-200 text-[10px] font-bold"
                      >
                        {p.ref} ×{p.quantite ?? p.qty ?? 1}
                      </span>
                    ))}
                  </div>
                )}

                {/* Action Footer */}
                {!isClosed && (
                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                    {(status === 'DEMANDE' || status === 'BT_PLANIFIE') && (
                      <button
                        type="button"
                        onClick={() => {
                          onStartLiveIntervention(item.id);
                          showToast?.('Intervention démarrée en mode Live (EN_COURS).', 'info');
                        }}
                        data-testid={`mobile-corr-start-btn-${item.id}`}
                        className="px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs"
                      >
                        <Play className="w-3.5 h-3.5" />
                        <span>Démarrer Live</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => handleOpenBtSubmitSheet(item)}
                      data-testid={`mobile-corr-submit-open-btn-${item.id}`}
                      className={`px-4 py-2.5 rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-2xs ${
                        isClarify
                          ? 'bg-rose-600 hover:bg-rose-500 text-white'
                          : isPending
                          ? 'bg-purple-700 hover:bg-purple-600 text-white'
                          : 'bg-slate-900 hover:bg-slate-800 text-white'
                      }`}
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>
                        {isClarify
                          ? 'Corriger Rapport'
                          : isPending
                          ? 'Modifier Rapport'
                          : 'Soumettre pour validation'}
                      </span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* SHEET 1: QUICK NEW DI (Demande d'Intervention) */}
      {showNewDiSheet && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-3">
          <form
            onSubmit={handleCreateMobileDi}
            data-testid="mobile-new-di-sheet"
            className="w-full max-w-md max-h-[90vh] overflow-y-auto bg-white rounded-3xl p-5 space-y-4 shadow-2xl border border-slate-200"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-mono font-bold uppercase text-amber-700 bg-amber-50 px-2 py-0.5 rounded">
                  Terrain
                </span>
                <h3 className="text-sm font-black text-slate-900 mt-0.5">
                  Signaler une Anomalie (Nouvelle DI)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowNewDiSheet(false)}
                className="p-2 rounded-xl bg-slate-100 text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Équipement actif (filterActiveMachines) *
                </label>
                <select
                  required
                  value={diMachineId}
                  onChange={(e) => setDiMachineId(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-xs font-mono bg-white"
                >
                  <option value="">— Sélectionner la machine / équipement —</option>
                  {activeMachines.map((m: any) => {
                    const code = m.id_machine_registered || m.id || m.code;
                    const label = m.designation || m.nom || code;
                    return (
                      <option key={code} value={code}>
                        {code} — {label}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Catégorie
                  </label>
                  <select
                    value={diCategorie}
                    onChange={(e) => setDiCategorie(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-2.5 py-2 text-xs bg-white font-semibold"
                  >
                    <option value="MECANIQUE">Mécanique</option>
                    <option value="ELECTRIQUE">Électrique</option>
                    <option value="PNEUMATIQUE">Pneumatique</option>
                    <option value="HYDRAULIQUE">Hydraulique</option>
                    <option value="SECURITE">Sécurité / Général</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Urgence
                  </label>
                  <select
                    value={diUrgence}
                    onChange={(e) => setDiUrgence(e.target.value as any)}
                    className="w-full rounded-xl border border-slate-300 px-2.5 py-2 text-xs bg-white font-semibold"
                  >
                    <option value="Mineure">Mineure</option>
                    <option value="Majeure">Majeure</option>
                    <option value="Critique (Arrêt)">Critique (Arrêt)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Description du symptôme / anomalie *
                </label>
                <textarea
                  required
                  rows={3}
                  value={diAnomalie}
                  onChange={(e) => setDiAnomalie(e.target.value)}
                  placeholder="Ex: Bruit anormal roulement, fuite d'air vanne principale..."
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
                />
              </div>

              <label className="flex items-center gap-2 p-2.5 rounded-xl bg-rose-50/70 border border-rose-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={diArretMachine}
                  onChange={(e) => setDiArretMachine(e.target.checked)}
                  className="rounded border-rose-300 text-rose-600"
                />
                <span className="text-xs font-bold text-rose-900">
                  Machine à l'arrêt suite à cette anomalie
                </span>
              </label>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowNewDiSheet(false)}
                className="px-4 py-2.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="submit"
                data-testid="mobile-di-submit-btn"
                className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black cursor-pointer shadow-sm"
              >
                Créer la DI
              </button>
            </div>
          </form>
        </div>
      )}

      {/* SHEET 2: BT REPORT SUBMISSION (Maker-Checker — No Immediate Stock Deduction) */}
      {selectedBtForSubmit && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-3">
          <form
            onSubmit={handleSubmitMobileBt}
            data-testid="mobile-bt-submit-sheet"
            className="w-full max-w-md max-h-[90vh] overflow-y-auto bg-white rounded-3xl p-5 space-y-4 shadow-2xl border border-slate-200"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-xs font-black text-amber-700">
                    {selectedBtForSubmit.code_machine || selectedBtForSubmit.id_machine_registered}{' '}
                    • {selectedBtForSubmit.num_bt || selectedBtForSubmit.id}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-900 font-mono text-[10px] font-bold">
                    Maker-Checker
                  </span>
                </div>
                <h3 className="text-sm font-black text-slate-900 mt-0.5">
                  Soumettre le rapport d'intervention
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedBtForSubmit(null)}
                className="p-2 rounded-xl bg-slate-100 text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {selectedBtForSubmit.validation_note && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-900">
                <span className="font-black">Note Admin (À clarifier) : </span>
                {selectedBtForSubmit.validation_note}
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Action réalisée sur le terrain *
                </label>
                <textarea
                  required
                  rows={3}
                  value={btActionRealisee}
                  onChange={(e) => setBtActionRealisee(e.target.value)}
                  placeholder="Décrivez la réparation effectuée, les réglages et essais..."
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
                />
              </div>

              {/* Multi-PDR Proposal Section */}
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-black text-slate-800 flex items-center gap-1.5">
                    <Package className="w-3.5 h-3.5 text-amber-600" />
                    <span>Pièces proposées (sans déduction stock immédiate)</span>
                  </label>
                  <span className="text-[10px] font-mono text-slate-500">
                    {btPiecesProposees.length} réf.
                  </span>
                </div>

                {btPiecesProposees.length > 0 && (
                  <div className="space-y-1.5">
                    {btPiecesProposees.map((part) => (
                      <div
                        key={part.ref}
                        className="flex items-center justify-between gap-2 bg-white px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs"
                      >
                        <div className="min-w-0">
                          <span className="font-mono font-black text-slate-900">{part.ref}</span>
                          <span className="text-slate-500 ml-1.5 truncate">{part.designation}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-mono font-bold text-amber-800">
                            ×{part.quantite} {part.unite}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveBtPartRow(part.ref)}
                            className="p-1 rounded-lg text-rose-600 hover:bg-rose-50 cursor-pointer"
                            title="Retirer cette pièce"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-1.5">
                  <select
                    value={pickerRef}
                    onChange={(e) => setPickerRef(e.target.value)}
                    aria-label="Choisir une référence PDR pour BT"
                    className="flex-1 min-w-0 rounded-xl border border-slate-300 px-2.5 py-2 text-xs font-mono bg-white"
                  >
                    <option value="">— Ajouter une PDR du stock —</option>
                    {stockItems.map((s) => (
                      <option key={s.ref} value={s.ref}>
                        {s.ref} — {s.designation} (Dispo: {s.stockActuel})
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min="1"
                    value={pickerQty}
                    onChange={(e) => setPickerQty(e.target.value)}
                    aria-label="Quantité PDR BT"
                    className="w-16 rounded-xl border border-slate-300 px-2 py-2 text-xs font-mono text-center bg-white"
                  />
                  <button
                    type="button"
                    onClick={handleAddBtPartRow}
                    disabled={!pickerRef}
                    className="p-2 rounded-xl bg-amber-500 disabled:bg-slate-200 text-slate-950 cursor-pointer shrink-0"
                    title="Ajouter la pièce"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                {/* Optional N° Bon Magasin */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 mb-1 flex items-center gap-1">
                    <FileText className="w-3 h-3" />
                    <span>N° Bon de sortie magasin (optionnel)</span>
                  </label>
                  <input
                    type="text"
                    value={btNumBon}
                    onChange={(e) => setBtNumBon(e.target.value)}
                    placeholder="Ex: BS-2026-089"
                    className="w-full rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-mono bg-white"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSelectedBtForSubmit(null)}
                className="px-4 py-2.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="submit"
                data-testid="mobile-bt-submit-btn"
                className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Transmettre au Responsable</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
