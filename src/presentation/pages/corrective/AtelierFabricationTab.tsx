import React, { useMemo, useState } from 'react';
import {
  Wrench,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  Hammer,
  PackageCheck,
  XCircle,
  FileText,
  ArrowRight,
  AlertTriangle,
  Cog,
} from 'lucide-react';
import { useGmaoStore } from '../../../store/useGmaoStore';
import { filterActiveMachines } from '../../../utils/activeMachines';
import { useAuth } from '../../../context/AuthContext';
import { AuthorizationService } from '../../../core/security/AuthorizationService';
import {
  getAllowedNextWorkshopStatuses,
  isWorkshopOrderActive,
  WORKSHOP_STATUS_LABELS,
  WORKSHOP_TYPE_LABELS,
  type IWorkshopOrder,
  type WorkshopOrderStatus,
  type WorkshopOrderType,
} from '../../../domain/corrective/workshopOrderService';

interface AtelierFabricationTabProps {
  onNavigateToBt?: (btKey: string) => void;
  showToast?: (message: string, type?: string) => void;
}

const STATUS_BADGE_STYLES: Record<WorkshopOrderStatus, string> = {
  EMIS: 'bg-amber-50 text-amber-800 border-amber-300',
  EN_COURS_FABRICATION: 'bg-blue-50 text-blue-800 border-blue-300',
  PRET_LIVRAISON: 'bg-indigo-50 text-indigo-800 border-indigo-300',
  RECEPTIONNE_MONTAGE: 'bg-emerald-50 text-emerald-800 border-emerald-300',
  ANNULE: 'bg-slate-100 text-slate-600 border-slate-300 line-through',
};

const ACTION_BUTTON_LABELS: Record<WorkshopOrderStatus, { label: string; style: string }> = {
  EMIS: { label: 'Émettre', style: 'bg-amber-600 hover:bg-amber-700 text-white' },
  EN_COURS_FABRICATION: {
    label: 'Lancer Fabrication',
    style: 'bg-blue-600 hover:bg-blue-700 text-white',
  },
  PRET_LIVRAISON: {
    label: 'Prêt Livraison',
    style: 'bg-indigo-600 hover:bg-indigo-700 text-white',
  },
  RECEPTIONNE_MONTAGE: {
    label: 'Réceptionner & Monter',
    style: 'bg-emerald-600 hover:bg-emerald-700 text-white',
  },
  ANNULE: {
    label: 'Annuler',
    style: 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200',
  },
};

export const AtelierFabricationTab: React.FC<AtelierFabricationTabProps> = ({
  onNavigateToBt,
  showToast,
}) => {
  const workshopOrders = useGmaoStore((state) => state.workshopOrders || []);
  const machines = useGmaoStore((state) => state.machines || []);
  const correctiveInterventions = useGmaoStore((state) => state.correctiveInterventions || []);
  const handleCreateWorkshopOrder = useGmaoStore((state) => state.handleCreateWorkshopOrder);
  const handleTransitionWorkshopOrderStatus = useGmaoStore(
    (state) => state.handleTransitionWorkshopOrderStatus
  );

  const { user: currentUser } = useAuth();
  const canCreate =
    Boolean(currentUser) &&
    (AuthorizationService.hasPermission(currentUser, 'workshop.create') ||
      AuthorizationService.hasPermission(currentUser, 'corrective.execute'));
  const canManage =
    Boolean(currentUser) &&
    (AuthorizationService.hasPermission(currentUser, 'workshop.manage') ||
      AuthorizationService.hasPermission(currentUser, 'corrective.execute'));

  const activeMachines = useMemo(() => filterActiveMachines(machines), [machines]);
  const machineLookup = useMemo(() => {
    const map = new Map<string, string>();
    (machines || []).forEach((m: any) => {
      const code = String(m.id_machine || m.code || m.id || '').trim();
      const nom = String(m.nom || m.designation || m.name || '').trim();
      if (code) map.set(code.toUpperCase(), nom);
    });
    return map;
  }, [machines]);

  const openBts = useMemo(() => {
    return (correctiveInterventions || []).filter((item: any) => {
      const st = String(item.statut || '').trim().toUpperCase();
      const closed = String(item.action_fermee || '').trim().toUpperCase() === 'OUI';
      return !closed && st !== 'CLOTURE' && st !== 'ANNULE';
    });
  }, [correctiveInterventions]);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [machineFilter, setMachineFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modal / creation form state
  const [showCreateForm, setShowCreateForm] = useState<boolean>(false);
  const [formType, setFormType] = useState<WorkshopOrderType>('REALISATION');
  const [formMachine, setFormMachine] = useState<string>('');
  const [formBtId, setFormBtId] = useState<string>('');
  const [formQuantite, setFormQuantite] = useState<number>(1);
  const [formDescription, setFormDescription] = useState<string>('');
  const [formObservation, setFormObservation] = useState<string>('');
  const [formSection, setFormSection] = useState<string>('SM');
  const [formDestinataire, setFormDestinataire] = useState<string>(
    'Atelier Fabrication Mécanique'
  );

  // KPIs
  const kpis = useMemo(() => {
    const total = workshopOrders.length;
    const emis = workshopOrders.filter((o) => o.statut === 'EMIS').length;
    const enCours = workshopOrders.filter((o) => o.statut === 'EN_COURS_FABRICATION').length;
    const pret = workshopOrders.filter((o) => o.statut === 'PRET_LIVRAISON').length;
    const receptionne = workshopOrders.filter((o) => o.statut === 'RECEPTIONNE_MONTAGE').length;
    const activeCount = workshopOrders.filter((o) => isWorkshopOrderActive(o.statut)).length;
    return { total, emis, enCours, pret, receptionne, activeCount };
  }, [workshopOrders]);

  const filteredOrders = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return workshopOrders.filter((ord) => {
      if (statusFilter === 'ACTIVE_ONLY' && !isWorkshopOrderActive(ord.statut)) return false;
      if (
        statusFilter !== 'ALL' &&
        statusFilter !== 'ACTIVE_ONLY' &&
        ord.statut !== statusFilter
      ) {
        return false;
      }
      if (typeFilter !== 'ALL' && ord.type_demande !== typeFilter) return false;
      if (
        machineFilter !== 'ALL' &&
        String(ord.id_machine || '').toUpperCase() !== machineFilter.toUpperCase()
      ) {
        return false;
      }
      if (q) {
        const hay = [
          ord.code_bon,
          ord.id_machine,
          ord.id_bt,
          ord.description_travaux,
          ord.observation,
          ord.emetteur_name,
          ord.emetteur_section,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [workshopOrders, statusFilter, typeFilter, machineFilter, searchQuery]);

  const handleSelectBtInForm = (btKey: string) => {
    setFormBtId(btKey);
    if (btKey) {
      const found = openBts.find(
        (b: any) => String(b.num_bt || b.id) === btKey || String(b.id) === btKey
      );
      if (found) {
        const mCode = String(found.code_machine || found.machine || '').trim();
        if (mCode) setFormMachine(mCode);
      }
    }
  };

  const handleSubmitCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanMachine = formMachine.trim();
    const cleanDesc = formDescription.trim();
    if (!cleanMachine) {
      showToast?.('Veuillez sélectionner une machine active.', 'warning');
      return;
    }
    if (!cleanDesc) {
      showToast?.('Veuillez décrire les travaux demandés à l’atelier.', 'warning');
      return;
    }

    const created = handleCreateWorkshopOrder({
      type_demande: formType,
      id_machine: cleanMachine,
      id_bt: formBtId.trim() || null,
      quantite: Math.max(1, Number(formQuantite) || 1),
      description_travaux: cleanDesc,
      observation: formObservation.trim() || undefined,
      emetteur_section: formSection.trim() || 'SM',
      destinataire: formDestinataire.trim() || 'Atelier Fabrication Mécanique',
      emetteur_user_id: currentUser?.id || 'SM',
      emetteur_name: currentUser?.name || 'Section Maintenance',
    });

    if (created) {
      showToast?.(
        created.id_bt
          ? `Bon Atelier ${created.code_bon} émis et rattaché au BT ${created.id_bt} (BT placé en attente atelier).`
          : `Bon Atelier ${created.code_bon} émis pour la machine ${created.id_machine}.`,
        'success'
      );
      setFormDescription('');
      setFormObservation('');
      setFormQuantite(1);
      setFormBtId('');
      setShowCreateForm(false);
    }
  };

  const handleTransition = (order: IWorkshopOrder, targetStatus: WorkshopOrderStatus) => {
    const res = handleTransitionWorkshopOrderStatus(order.id, targetStatus);
    if (!res.valid) {
      showToast?.(res.reason || 'Transition non autorisée.', 'error');
      return;
    }
    showToast?.(
      targetStatus === 'RECEPTIONNE_MONTAGE'
        ? order.id_bt
          ? `${order.code_bon} → Réceptionné & Monté. Le BT ${order.id_bt} peut maintenant être clôturé selon la procédure corrective.`
          : `${order.code_bon} → Pièce réceptionnée et montée sur machine.`
        : `${order.code_bon} → ${WORKSHOP_STATUS_LABELS[targetStatus]}`,
      'success'
    );
  };

  return (
    <div className="space-y-4">
      {/* Industrial Header Banner */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700 shrink-0">
            <Hammer className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-black text-slate-900 uppercase tracking-tight">
                Atelier Fabrication Mécanique — Bons de Réalisation & Rectification
              </h2>
              <span className="px-2 py-0.5 text-[10px] font-black uppercase rounded bg-slate-900 text-amber-400">
                Section Maintenance (SM) ➔ Atelier Interne
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Suivi des demandes d&apos;usinage, confection de pièces (BR) et rectification mécanique (RECT) hors mouvements de stock PDR et hors sous-traitance externe.
            </p>
          </div>
        </div>

        {canCreate && (
          <button
            type="button"
            onClick={() => setShowCreateForm((v) => !v)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-black uppercase tracking-wider shadow-sm transition-colors shrink-0"
          >
            <Plus className="w-4 h-4" />
            {showCreateForm ? 'Fermer le formulaire' : 'Nouveau Bon Atelier (BR / RECT)'}
          </button>
        )}
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs">
          <div className="text-[10px] font-bold uppercase text-slate-400">Total Bons Atelier</div>
          <div className="text-2xl font-black text-slate-900 mt-1">{kpis.total}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            {kpis.activeCount} actif(s) en cours
          </div>
        </div>
        <div className="bg-amber-50/60 border border-amber-200 rounded-xl p-3 shadow-xs">
          <div className="text-[10px] font-bold uppercase text-amber-700 flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" /> Émis (Attente Atelier)
          </div>
          <div className="text-2xl font-black text-amber-900 mt-1">{kpis.emis}</div>
          <div className="text-[11px] text-amber-700 mt-0.5">En attente prise en charge</div>
        </div>
        <div className="bg-blue-50/60 border border-blue-200 rounded-xl p-3 shadow-xs">
          <div className="text-[10px] font-bold uppercase text-blue-700 flex items-center gap-1">
            <Cog className="w-3.5 h-3.5" /> En Cours Fabrication
          </div>
          <div className="text-2xl font-black text-blue-900 mt-1">{kpis.enCours}</div>
          <div className="text-[11px] text-blue-700 mt-0.5">Usinage / Rectification</div>
        </div>
        <div className="bg-indigo-50/60 border border-indigo-200 rounded-xl p-3 shadow-xs">
          <div className="text-[10px] font-bold uppercase text-indigo-700 flex items-center gap-1">
            <PackageCheck className="w-3.5 h-3.5" /> Prêts Livraison
          </div>
          <div className="text-2xl font-black text-indigo-900 mt-1">{kpis.pret}</div>
          <div className="text-[11px] text-indigo-700 mt-0.5">Disponibles pour montage</div>
        </div>
        <div className="bg-emerald-50/60 border border-emerald-200 rounded-xl p-3 shadow-xs">
          <div className="text-[10px] font-bold uppercase text-emerald-700 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> Réceptionnés & Montés
          </div>
          <div className="text-2xl font-black text-emerald-900 mt-1">{kpis.receptionne}</div>
          <div className="text-[11px] text-emerald-700 mt-0.5">Terminés (Montage SM)</div>
        </div>
      </div>

      {/* Creation Form Drawer */}
      {showCreateForm && (
        <form
          onSubmit={handleSubmitCreate}
          className="bg-amber-50/40 border-2 border-amber-300 rounded-xl p-4 space-y-4 shadow-sm"
        >
          <div className="flex items-center justify-between border-b border-amber-200 pb-2.5">
            <div className="flex items-center gap-2">
              <Wrench className="w-4 h-4 text-amber-700" />
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">
                Émission d&apos;un Bon de Réalisation / Rectification (Atelier Mécanique)
              </h3>
            </div>
            <span className="text-[11px] font-semibold text-amber-800">
              Aucun impact sur stockActuel PDR · Ne clôture pas le BT automatiquement
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                Nature de la demande *
              </label>
              <select
                value={formType}
                onChange={(e) => setFormType(e.target.value as WorkshopOrderType)}
                className="w-full px-3 py-2 text-xs font-bold bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-amber-600"
              >
                <option value="REALISATION">REALISATION — Confection / Usinage pièce neuve (BR)</option>
                <option value="RECTIFICATION">RECTIFICATION — Réparation / Tournage / Ajustage (RECT)</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                Machine concernée (Active) *
              </label>
              <select
                value={formMachine}
                onChange={(e) => setFormMachine(e.target.value)}
                required
                className="w-full px-3 py-2 text-xs font-bold bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-amber-600"
              >
                <option value="">-- Sélectionner une machine --</option>
                {activeMachines.map((m: any) => {
                  const code = String(m.id_machine || m.code || m.id || '');
                  const nom = String(m.nom || m.designation || '');
                  return (
                    <option key={code} value={code}>
                      {code} {nom ? `— ${nom}` : ''}
                    </option>
                  );
                })}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                Lier à un BT ouvert (Optionnel)
              </label>
              <select
                value={formBtId}
                onChange={(e) => handleSelectBtInForm(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-amber-600"
              >
                <option value="">Bon autonome (Sans BT)</option>
                {openBts.map((bt: any) => {
                  const key = String(bt.num_bt || bt.id || '');
                  const mCode = String(bt.code_machine || bt.machine || '');
                  return (
                    <option key={String(bt.id)} value={key}>
                      {key} — {mCode} ({bt.anomalie || bt.panne || 'Correctif'})
                    </option>
                  );
                })}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                Quantité à usiner / rectifier *
              </label>
              <input
                type="number"
                min={1}
                value={formQuantite}
                onChange={(e) => setFormQuantite(Math.max(1, Number(e.target.value) || 1))}
                className="w-full px-3 py-2 text-xs font-bold bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-amber-600"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2">
              <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                Description technique des travaux (Cotes, matière, usinage demandé) *
              </label>
              <input
                type="text"
                required
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Ex: Rectification portée d'arbre Ø45mm + confection bague bronze..."
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-amber-600"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                Observation / Croquis / Tolérance
              </label>
              <input
                type="text"
                value={formObservation}
                onChange={(e) => setFormObservation(e.target.value)}
                placeholder="Ex: Urgence arrêt ligne, plan joint..."
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-amber-600"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            <div className="flex items-center gap-3 text-[11px] text-slate-600">
              <span>
                <strong>Émetteur:</strong> {formSection} ({currentUser?.name || 'Section Maintenance'})
              </span>
              <span>•</span>
              <span>
                <strong>Destinataire:</strong> {formDestinataire}
              </span>
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="px-3 py-1.5 text-xs font-bold text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 text-xs font-black uppercase text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-xs"
              >
                Émettre le Bon Atelier
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher par N° bon (BR/RECT), machine, BT, description..."
            className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-slate-400"
          />
        </div>

        <div className="flex items-center gap-1.5">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-1.5 text-xs font-semibold border border-slate-200 rounded-lg bg-slate-50"
          >
            <option value="ALL">Tous les statuts</option>
            <option value="ACTIVE_ONLY">En cours (Actifs uniquement)</option>
            <option value="EMIS">Émis (En attente)</option>
            <option value="EN_COURS_FABRICATION">En cours fabrication</option>
            <option value="PRET_LIVRAISON">Prêt pour livraison</option>
            <option value="RECEPTIONNE_MONTAGE">Réceptionné & Monté</option>
            <option value="ANNULE">Annulé</option>
          </select>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-2.5 py-1.5 text-xs font-semibold border border-slate-200 rounded-lg bg-slate-50"
          >
            <option value="ALL">Tous types (BR + RECT)</option>
            <option value="REALISATION">Réalisation (BR)</option>
            <option value="RECTIFICATION">Rectification (RECT)</option>
          </select>

          <select
            value={machineFilter}
            onChange={(e) => setMachineFilter(e.target.value)}
            className="px-2.5 py-1.5 text-xs font-semibold border border-slate-200 rounded-lg bg-slate-50"
          >
            <option value="ALL">Toutes les machines</option>
            {activeMachines.map((m: any) => {
              const code = String(m.id_machine || m.code || m.id || '');
              return (
                <option key={code} value={code}>
                  {code}
                </option>
              );
            })}
          </select>
        </div>
      </div>

      {/* Workshop Orders Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        {filteredOrders.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <Hammer className="w-8 h-8 text-slate-300 mx-auto" />
            <div className="text-sm font-bold text-slate-700">
              Aucun Bon de Réalisation / Rectification trouvé
            </div>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Créez un bon depuis une intervention corrective en cours (BT) ou directement via le bouton « Nouveau Bon Atelier (BR / RECT) ».
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-black uppercase text-slate-500 tracking-wider">
                  <th className="py-2.5 px-3">Code Bon</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3">Machine</th>
                  <th className="py-2.5 px-3">BT Lié</th>
                  <th className="py-2.5 px-3">Qté & Travaux Demandés</th>
                  <th className="py-2.5 px-3">Émetteur / Date</th>
                  <th className="py-2.5 px-3">Statut Atelier</th>
                  <th className="py-2.5 px-3 text-right">Progression Cycle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredOrders.map((ord) => {
                  const nextStatuses = getAllowedNextWorkshopStatuses(ord.statut);
                  const machineName = machineLookup.get(String(ord.id_machine || '').toUpperCase());
                  const dateEmissionShort = ord.date_emission
                    ? ord.date_emission.slice(0, 10)
                    : '—';

                  return (
                    <tr key={ord.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-3 font-mono font-black text-slate-900 whitespace-nowrap">
                        {ord.code_bon}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black uppercase border ${
                            ord.type_demande === 'RECTIFICATION'
                              ? 'bg-purple-50 text-purple-800 border-purple-200'
                              : 'bg-cyan-50 text-cyan-800 border-cyan-200'
                          }`}
                        >
                          {WORKSHOP_TYPE_LABELS[ord.type_demande] || ord.type_demande}
                        </span>
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="font-bold text-slate-900">{ord.id_machine}</div>
                        {machineName && (
                          <div className="text-[10px] text-slate-500 truncate max-w-[160px]">
                            {machineName}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        {ord.id_bt ? (
                          <button
                            type="button"
                            onClick={() => onNavigateToBt && onNavigateToBt(String(ord.id_bt))}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 font-mono text-[11px] font-bold"
                            title="Voir le Bon de Travail lié"
                          >
                            <FileText className="w-3 h-3" />
                            {ord.id_bt}
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">Autonome</span>
                        )}
                      </td>
                      <td className="py-3 px-3 max-w-xs">
                        <div className="font-semibold text-slate-800">
                          <span className="inline-block px-1.5 py-0.2 bg-slate-100 rounded text-[10px] font-black mr-1.5">
                            Qté: {ord.quantite}
                          </span>
                          {ord.description_travaux}
                        </div>
                        {ord.observation && (
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            Note: {ord.observation}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="font-semibold text-slate-700">
                          {ord.emetteur_section || 'SM'}{' '}
                          {ord.emetteur_name ? `· ${ord.emetteur_name}` : ''}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Émis le {dateEmissionShort}
                        </div>
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black uppercase border ${
                            STATUS_BADGE_STYLES[ord.statut] ||
                            'bg-slate-100 text-slate-700 border-slate-300'
                          }`}
                        >
                          {WORKSHOP_STATUS_LABELS[ord.statut] || ord.statut}
                        </span>
                        {ord.id_bt && isWorkshopOrderActive(ord.statut) && (
                          <div className="text-[10px] text-amber-700 font-semibold flex items-center gap-1 mt-1">
                            <AlertTriangle className="w-3 h-3" />
                            Bloque clôture BT
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        {canManage && nextStatuses.length > 0 ? (
                          <div className="inline-flex items-center justify-end gap-1.5">
                            {nextStatuses.map((targetSt) => {
                              const btnCfg = ACTION_BUTTON_LABELS[targetSt];
                              return (
                                <button
                                  key={targetSt}
                                  type="button"
                                  onClick={() => handleTransition(ord, targetSt)}
                                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase transition-colors ${btnCfg.style}`}
                                >
                                  {targetSt !== 'ANNULE' ? (
                                    <ArrowRight className="w-3 h-3" />
                                  ) : (
                                    <XCircle className="w-3 h-3" />
                                  )}
                                  {btnCfg.label}
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          <span className="text-[11px] font-semibold text-slate-400">
                            {ord.statut === 'RECEPTIONNE_MONTAGE'
                              ? '✓ Monté & Clôturé'
                              : ord.statut === 'ANNULE'
                              ? 'Annulé'
                              : 'Lecture seule'}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AtelierFabricationTab;
