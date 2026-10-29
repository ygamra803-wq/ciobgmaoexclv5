import { useState, useMemo } from 'react';
import {
  Clock,
  Wrench,
  CheckCircle2,
  Trash2,
  Package,
  DollarSign,
  AlertCircle,
  Search,
  ShieldCheck,
  AlertTriangle,
  X,
} from 'lucide-react';
import type { PreventiveExecutionRecord } from '../../../../types/preventive';
import PeriodFilterBar from '../../../components/common/PeriodFilterBar';
import { type PeriodFilterState, isDateInPeriod } from '../../../../utils/datePeriodUtils';
import { useI18n } from '../../../../i18n/I18nContext';
import { confirmAction } from '../../../../utils/confirmAction';
import { useAuth } from '../../../../context/AuthContext';
import { useGmaoStore } from '../../../../store/useGmaoStore';
import { reconcileFieldClaim } from '../../../../core/security/validationReconciliation';
import { hasPreventiveExecutionAnomaly } from '../../../../application/services/MachineHealthPassportService';

interface PreventiveExecutionsHistoryViewProps {
  executions: PreventiveExecutionRecord[];
  stockItems?: any[];
  isTechUser?: boolean;
  onReviewPreventiveExecution?: (executionId: string, decisionData: any) => any;
  showToast?: (msg: string, type?: string) => void;
  onDeleteExecution?: (id: string) => void;
  onNavigateToMachine?: (code: string) => void;
}

export default function PreventiveExecutionsHistoryView({
  executions = [],
  stockItems = [],
  isTechUser = false,
  onReviewPreventiveExecution,
  showToast,
  onDeleteExecution,
  onNavigateToMachine,
}: PreventiveExecutionsHistoryViewProps) {
  const { language } = useI18n();
  const { user } = useAuth();
  const [periodFilter, setPeriodFilter] = useState<PeriodFilterState>({ preset: 'ALL' });
  const [validationFilter, setValidationFilter] = useState<string>('ALL');
  const [search, setSearch] = useState('');
  const [_deletingId, setDeletingId] = useState<string | null>(null);

  // V3 Admin Maker-Checker Review Modal State
  const [reviewExecution, setReviewExecution] = useState<PreventiveExecutionRecord | null>(null);
  const [reviewSpares, setReviewSpares] = useState<any[]>([]);
  const [reviewNote, setReviewNote] = useState<string>('');
  const [skipStockDeduction, setSkipStockDeduction] = useState<boolean>(false);
  const [createFollowUpDi, setCreateFollowUpDi] = useState<boolean>(false);
  const [followUpDiAnomalie, setFollowUpDiAnomalie] = useState<string>('');

  const storeMouvements = useGmaoStore((s) => s.mouvements);
  const storeCorrectiveInterventions = useGmaoStore((s) => s.correctiveInterventions);
  const storeSortieDemands = useGmaoStore((s) => s.sortieDemands);

  const reviewReconciliation = useMemo(() => {
    if (!reviewExecution) return null;
    return reconcileFieldClaim({
      claimType: 'PREVENTIVE',
      claimId: String(reviewExecution.id),
      numBonSaisi: reviewExecution.num_bon_saisi_par_tech,
      machineCode: reviewExecution.machineCode,
      proposedSpares: reviewSpares,
      stockItems,
      mouvements: storeMouvements,
      correctiveInterventions: storeCorrectiveInterventions,
      preventiveExecutions: executions,
      sortieDemands: storeSortieDemands,
    });
  }, [
    reviewExecution,
    reviewSpares,
    stockItems,
    storeMouvements,
    storeCorrectiveInterventions,
    executions,
    storeSortieDemands,
  ]);

  const availableDates = useMemo(() => {
    return executions.map((e) => e.executedAt);
  }, [executions]);

  const pendingCount = useMemo(
    () => executions.filter((e) => e.validation_status === 'PENDING_VALIDATION').length,
    [executions]
  );
  const clarificationCount = useMemo(
    () => executions.filter((e) => e.validation_status === 'NEEDS_CLARIFICATION').length,
    [executions]
  );

  const filteredExecutions = useMemo(() => {
    return executions.filter((item) => {
      // 1. Period Filter
      if (!isDateInPeriod(item.executedAt, periodFilter)) {
        return false;
      }
      // 2. Validation Status Filter
      if (validationFilter !== 'ALL') {
        const st = item.validation_status || 'APPROVED';
        if (validationFilter === 'APPROVED') {
          if (st !== 'APPROVED' && st !== 'NONE') return false;
        } else if (st !== validationFilter) {
          return false;
        }
      }
      // 3. Text Search
      if (search.trim()) {
        const q = search.toLowerCase();
        const match =
          (item.taskCode || '').toLowerCase().includes(q) ||
          (item.machineCode || '').toLowerCase().includes(q) ||
          (item.machineName || '').toLowerCase().includes(q) ||
          (item.executorName || '').toLowerCase().includes(q) ||
          (item.organe || '').toLowerCase().includes(q) ||
          (item.id_composant || '').toLowerCase().includes(q) ||
          (item.nom_composant || '').toLowerCase().includes(q) ||
          (item.id_part || '').toLowerCase().includes(q) ||
          (item.nom_part || '').toLowerCase().includes(q) ||
          (item.notes || '').toLowerCase().includes(q) ||
          (item.num_bon_saisi_par_tech || '').toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [executions, periodFilter, validationFilter, search]);

  // Aggregate metrics for filtered period
  const metrics = useMemo(() => {
    const totalExecs = filteredExecutions.length;
    const totalMinutes = filteredExecutions.reduce((sum, e) => sum + (e.durationMinutes || 0), 0);
    const totalSparesCost = filteredExecutions.reduce((sum, e) => sum + (e.sparesCost || 0), 0);
    const totalCost = filteredExecutions.reduce((sum, e) => sum + (e.totalCost || 0), 0);
    const hours = (totalMinutes / 60).toFixed(1);
    return { totalExecs, totalMinutes, hours, totalSparesCost, totalCost };
  }, [filteredExecutions]);

  const handleOpenReviewModal = (exec: PreventiveExecutionRecord) => {
    setReviewExecution(exec);
    const initialSpares =
      Array.isArray(exec.sparesProposed) && exec.sparesProposed.length > 0
        ? exec.sparesProposed
        : Array.isArray(exec.sparesUsed)
        ? exec.sparesUsed
        : [];
    const mappedSpares = initialSpares.map((s) => ({
      ref: s.ref || (s as any).reference || '',
      designation: s.designation || s.ref || 'Pièce PDR',
      qty: Math.max(1, Number(s.qty ?? (s as any).quantite ?? 1)),
      unit: s.unit || (s as any).unite || 'pcs',
      unitPrice: Number(s.unitPrice ?? (s as any).prix_unitaire ?? 0),
    }));
    const rec = reconcileFieldClaim({
      claimType: 'PREVENTIVE',
      claimId: String(exec.id),
      numBonSaisi: exec.num_bon_saisi_par_tech,
      machineCode: exec.machineCode,
      proposedSpares: mappedSpares,
      stockItems,
      mouvements: storeMouvements,
      correctiveInterventions: storeCorrectiveInterventions,
      preventiveExecutions: executions,
      sortieDemands: storeSortieDemands,
    });
    setReviewSpares(mappedSpares);
    setSkipStockDeduction(Boolean(rec?.exactMovementMatch));
    const hasAnom = hasPreventiveExecutionAnomaly(exec);
    setCreateFollowUpDi(hasAnom && !(exec as any)?.generated_di_id);
    setFollowUpDiAnomalie(
      exec.notes ||
        `Anomalie constatée lors du contrôle préventif sur ${exec.organe || exec.machineCode || 'équipement'}`
    );
    setReviewNote(exec.validation_note || '');
  };

  const handleReviewDecision = (
    decision: 'APPROVED' | 'NEEDS_CLARIFICATION' | 'REJECTED'
  ) => {
    if (!reviewExecution || !onReviewPreventiveExecution) return;
    if (
      (decision === 'NEEDS_CLARIFICATION' || decision === 'REJECTED') &&
      !reviewNote.trim()
    ) {
      showToast?.('Veuillez saisir un motif de clarification ou de rejet.', 'warning');
      return;
    }

    const updated = onReviewPreventiveExecution(reviewExecution.id, {
      decision,
      validation_note: reviewNote.trim(),
      validated_by_id: user?.id || 'admin',
      validated_by_name: user?.name || user?.nom || 'Administrateur',
      approvedSpares: reviewSpares,
      skipStockDeduction,
      createFollowUpDi: decision === 'APPROVED' && createFollowUpDi,
      followUpDiAnomalie: followUpDiAnomalie.trim(),
    });

    if (decision === 'APPROVED') {
      const diSuffix =
        createFollowUpDi || updated?.generated_di_id
          ? ' + DI corrective de suivi générée automatiquement !'
          : '.';
      showToast?.(
        skipStockDeduction
          ? `Exécution ${reviewExecution.machineCode} approuvée (coût imputé sur machine sans 2e déstockage)${diSuffix}`
          : `Exécution ${reviewExecution.machineCode} approuvée et stock PDR déduit avec succès${diSuffix}`,
        'success'
      );
    } else if (decision === 'NEEDS_CLARIFICATION') {
      showToast?.(
        `Demande de clarification envoyée au technicien (${reviewExecution.executorName}).`,
        'info'
      );
    } else {
      showToast?.(`Exécution ${reviewExecution.machineCode} rejetée (sans déstockage).`, 'warning');
    }
    setReviewExecution(null);
  };

  const handleDelete = async (id: string) => {
    const msg =
      language === 'ar'
        ? 'هل أنت متأكد من حذف سجل التنفيذ هذا؟'
        : "Supprimer cet enregistrement d'exécution ?";
    if (
      await confirmAction({
        title: language === 'ar' ? 'تأكيد الحذف' : 'Suppression de rapport',
        message: msg,
        variant: 'danger',
      })
    ) {
      onDeleteExecution?.(id);
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-4" dir="ltr">
      {/* Header and Period Filter */}
      <div className="flex flex-col gap-3">
        <PeriodFilterBar
          value={periodFilter}
          onChange={setPeriodFilter}
          availableDates={availableDates}
          filteredCount={filteredExecutions.length}
          totalCount={executions.length}
        />

        {/* Quick Search and Statistics Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-2xs">
            <div className="text-[11px] font-bold text-slate-500 uppercase flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>{language === 'ar' ? 'التنفيذات المنجزة' : 'Interventions Réalisées'}</span>
            </div>
            <div className="text-xl font-extrabold text-slate-900 mt-1 font-mono">
              {metrics.totalExecs}
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-2xs">
            <div className="text-[11px] font-bold text-slate-500 uppercase flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-indigo-600" />
              <span>{language === 'ar' ? 'ساعات العمل' : 'Temps Passé'}</span>
            </div>
            <div className="text-xl font-extrabold text-indigo-600 mt-1 font-mono">
              {metrics.hours} <span className="text-xs font-normal text-slate-500">h</span>
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-2xs">
            <div className="text-[11px] font-bold text-slate-500 uppercase flex items-center gap-1.5">
              <Package className="w-3.5 h-3.5 text-amber-600" />
              <span>{language === 'ar' ? 'تكلفة قطع الغيار المعتمدة' : 'Coût PDR Consommée'}</span>
            </div>
            <div className="text-xl font-extrabold text-amber-600 mt-1 font-mono">
              {metrics.totalSparesCost.toFixed(2)} <span className="text-xs font-normal text-slate-500">DT</span>
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-2xs">
            <div className="text-[11px] font-bold text-slate-500 uppercase flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
              <span>{language === 'ar' ? 'التكلفة الإجمالية' : 'Coût Total Préventif'}</span>
            </div>
            <div className="text-xl font-extrabold text-slate-900 mt-1 font-mono">
              {metrics.totalCost.toFixed(2)} <span className="text-xs font-normal text-slate-500">DT</span>
            </div>
          </div>
        </div>

        {/* Maker-Checker Validation Status Filter Pills */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 flex-wrap">
            {[
              { key: 'ALL', label: `Toutes (${executions.length})` },
              {
                key: 'PENDING_VALIDATION',
                label: `À valider (${pendingCount})`,
                badgeClass:
                  pendingCount > 0
                    ? 'bg-purple-100 text-purple-900 border-purple-300 font-black animate-pulse'
                    : '',
              },
              {
                key: 'NEEDS_CLARIFICATION',
                label: `À clarifier (${clarificationCount})`,
                badgeClass:
                  clarificationCount > 0
                    ? 'bg-rose-100 text-rose-900 border-rose-300 font-black'
                    : '',
              },
              { key: 'APPROVED', label: 'Approuvées & Déstockées' },
            ].map((pill) => {
              const active = validationFilter === pill.key;
              return (
                <button
                  key={pill.key}
                  type="button"
                  onClick={() => setValidationFilter(pill.key)}
                  className={`px-3 py-1.5 rounded-xl text-xs border transition cursor-pointer ${
                    active
                      ? 'bg-slate-900 text-white border-slate-900 font-bold shadow-2xs'
                      : pill.badgeClass ||
                        'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 font-medium'
                  }`}
                >
                  {pill.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Search bar */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={
              language === 'ar'
                ? 'بحث بالآلة أو الفني أو الكود أو الملاحظات...'
                : 'Rechercher par machine, technicien, organe, code, N° bon...'
            }
            className="w-full h-10 pl-9 pr-3 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold uppercase text-[11px]">
              <tr>
                <th className="py-3 px-4">{language === 'ar' ? 'التاريخ' : 'Date & Période'}</th>
                <th className="py-3 px-4">{language === 'ar' ? 'الآلة' : 'Machine'}</th>
                <th className="py-3 px-4">{language === 'ar' ? 'المهمة والعنصر' : 'Composant & Action'}</th>
                <th className="py-3 px-4">{language === 'ar' ? 'الفني المنفذ' : 'Technicien'}</th>
                <th className="py-3 px-4 text-center">{language === 'ar' ? 'الاعتماد' : 'Statut Validation'}</th>
                <th className="py-3 px-4 text-center">{language === 'ar' ? 'المدة' : 'Durée'}</th>
                <th className="py-3 px-4">{language === 'ar' ? 'القطع المقترحة / المعتمدة' : 'PDR (Proposée / Validée)'}</th>
                <th className="py-3 px-4 text-right">{language === 'ar' ? 'التكلفة' : 'Coût Total'}</th>
                <th className="py-3 px-4 text-right">{language === 'ar' ? 'إجراءات' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredExecutions.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <AlertCircle className="w-6 h-6 text-slate-300" />
                      <span>
                        {language === 'ar'
                          ? 'لا توجد سجلات تنفيذ مسجلة لهذه الفترة'
                          : "Aucun enregistrement d'exécution pour cette période"}
                      </span>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredExecutions.map((exec) => {
                  const valStatus = exec.validation_status || 'APPROVED';
                  const isPending = valStatus === 'PENDING_VALIDATION';
                  const isClarify = valStatus === 'NEEDS_CLARIFICATION';
                  const isRejected = valStatus === 'REJECTED';
                  const displayedSpares =
                    exec.sparesUsed && exec.sparesUsed.length > 0
                      ? exec.sparesUsed
                      : exec.sparesProposed || [];

                  return (
                    <tr key={exec.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="font-mono font-bold text-slate-900">{exec.executedAt}</div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          {exec.periodMonth} • {exec.periodWeek}
                        </div>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => onNavigateToMachine?.(exec.machineCode)}
                          className="font-bold text-indigo-700 hover:text-indigo-900 hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <Wrench className="w-3.5 h-3.5 text-indigo-500" />
                          <span>{exec.machineCode}</span>
                        </button>
                        <div className="text-[10.5px] text-slate-500 truncate max-w-[140px]">
                          {exec.machineName}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono font-bold text-xs bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">
                            {exec.actionCode}
                          </span>
                          <span className="font-semibold text-slate-800">{exec.organe}</span>
                          {exec.id_composant && (
                            <span className="px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 font-mono text-[10px] font-bold">
                              {exec.id_composant}
                            </span>
                          )}
                          {exec.id_part && (
                            <span className="px-1.5 py-0.2 rounded bg-teal-50 text-teal-700 border border-teal-200 font-mono text-[10px] font-bold">
                              {exec.id_part}
                            </span>
                          )}
                        </div>
                        {exec.notes && (
                          <div className="text-[11px] text-slate-500 italic mt-0.5 truncate max-w-[200px]" title={exec.notes}>
                            « {exec.notes} »
                          </div>
                        )}
                        {exec.validation_note && (
                          <div className="text-[10.5px] text-rose-700 font-semibold mt-0.5">
                            Note Resp.: « {exec.validation_note} »
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 font-semibold text-slate-700 text-[11px]">
                          {exec.executorName}
                        </span>
                        {exec.num_bon_saisi_par_tech && (
                          <div className="text-[10px] font-mono text-indigo-700 mt-0.5">
                            Bon: {exec.num_bon_saisi_par_tech}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        {isPending ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-black bg-purple-100 text-purple-900 border border-purple-300">
                            À VALIDER
                          </span>
                        ) : isClarify ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-black bg-rose-100 text-rose-900 border border-rose-300">
                            À CLARIFIER
                          </span>
                        ) : isRejected ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-black bg-slate-200 text-slate-700">
                            REJETÉ
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                            APPROUVÉ
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center whitespace-nowrap font-mono font-medium text-slate-700">
                        {exec.durationMinutes} min
                      </td>
                      <td className="py-3 px-4">
                        {displayedSpares.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {displayedSpares.map((pdr, idx) => (
                              <span
                                key={idx}
                                className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border ${
                                  isPending || isClarify
                                    ? 'bg-purple-50 text-purple-900 border-purple-200'
                                    : 'bg-amber-50 text-amber-800 border-amber-200'
                                }`}
                                title={`${pdr.designation} (${pdr.qty} ${pdr.unit})`}
                              >
                                {pdr.ref || pdr.designation} x{pdr.qty}
                                {isPending ? ' (Prop.)' : ''}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[11px]">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap font-mono font-extrabold text-slate-900">
                        {exec.totalCost.toFixed(2)} DT
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {!isTechUser &&
                            onReviewPreventiveExecution &&
                            (isPending || isClarify) && (
                              <button
                                type="button"
                                onClick={() => handleOpenReviewModal(exec)}
                                className="px-2.5 py-1 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-[11px] font-bold shadow-2xs transition cursor-pointer"
                              >
                                Valider
                              </button>
                            )}
                          {onDeleteExecution && (
                            <button
                              type="button"
                              onClick={() => handleDelete(exec.id)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                              title={language === 'ar' ? 'حذف السجل' : 'Supprimer'}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* V3 Admin Maker-Checker Review Modal for Preventive Executions */}
      {reviewExecution && (
        <div
          data-testid="preventive-maker-checker-modal"
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
        >
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-xl w-full p-6 space-y-4 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-purple-100 border border-purple-200 text-purple-700 flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    Contrôle & Validation d&apos;Exécution Préventive
                  </h3>
                  <p className="text-xs text-slate-500">
                    {reviewExecution.machineCode} • {reviewExecution.organe} ({reviewExecution.actionCode}) — Technicien : <b>{reviewExecution.executorName}</b>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setReviewExecution(null)}
                className="w-8 h-8 rounded-full hover:bg-slate-100 text-slate-400 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-200/80 text-xs space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-semibold">Date d&apos;exécution :</span>
                <span className="font-mono font-bold text-slate-900">{reviewExecution.executedAt} ({reviewExecution.durationMinutes} min)</span>
              </div>
              {reviewExecution.num_bon_saisi_par_tech && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-semibold">N° Bon Magasin saisi :</span>
                  <span className="font-mono font-bold text-indigo-700">{reviewExecution.num_bon_saisi_par_tech}</span>
                </div>
              )}
              {reviewExecution.notes && (
                <div className="pt-1 border-t border-slate-200/60 text-slate-700 italic">
                  « {reviewExecution.notes} »
                </div>
              )}
            </div>

            {/* V4 Smart Reconciliation Banner */}
            {reviewReconciliation && (
              <div
                data-testid="v4-preventive-reconciliation-panel"
                className={`p-3 rounded-2xl border space-y-1.5 text-xs ${
                  reviewReconciliation.hasCritical
                    ? 'bg-rose-50/90 border-rose-300 text-rose-950'
                    : reviewReconciliation.hasWarning
                    ? 'bg-amber-50/90 border-amber-300 text-amber-950'
                    : 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5">
                    {reviewReconciliation.hasWarning ? (
                      <AlertTriangle
                        className={`w-4 h-4 shrink-0 ${
                          reviewReconciliation.hasCritical ? 'text-rose-600' : 'text-amber-600'
                        }`}
                      />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    )}
                    Contrôle Automatique de Concordance (V4)
                  </span>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-white/80 border border-current/20">
                    {reviewReconciliation.alerts.length === 0
                      ? '0 anomalie détectée'
                      : `${reviewReconciliation.alerts.length} alerte(s)`}
                  </span>
                </div>

                {reviewReconciliation.alerts.length > 0 ? (
                  <div className="space-y-1.5">
                    {reviewReconciliation.alerts.map((alert, idx) => (
                      <div
                        key={`${alert.code}-${idx}`}
                        className={`px-2.5 py-1.5 rounded-xl border text-[11px] flex items-start justify-between gap-2 ${
                          alert.severity === 'critical'
                            ? 'bg-white border-rose-200 text-rose-900'
                            : 'bg-white border-amber-200 text-amber-900'
                        }`}
                      >
                        <div>
                          <span className="font-black mr-1">{alert.title} :</span>
                          <span>{alert.detail}</span>
                        </div>
                        <span
                          className={`px-1.5 py-0.2 rounded text-[9.5px] font-mono font-black shrink-0 ${
                            alert.severity === 'critical'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {alert.code}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-emerald-800 font-medium">
                    Concordance vérifiée : aucun doublon de bon ni dépassement de stock détecté.
                  </p>
                )}
              </div>
            )}

            {/* Proposed Spare Parts Inspection & Adjustment */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-800 uppercase">
                <span>Pièces PDR déclarées à déduire du stock ({reviewSpares.length})</span>
                <span className="text-[10.5px] font-mono text-purple-700">
                  Vérification Stock Actuel
                </span>
              </div>

              {reviewSpares.length === 0 ? (
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-500">
                  Aucune pièce PDR déclarée sur cette exécution préventive (contrôle / nettoyage sans déstockage).
                </div>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {reviewSpares.map((sp, idx) => {
                    const stockMatch = (stockItems || []).find(
                      (s) => String(s.ref || '').toLowerCase() === String(sp.ref || '').toLowerCase()
                    );
                    const stockActuel = Number(stockMatch?.stockActuel ?? 0);
                    const isShort = stockMatch && sp.qty > stockActuel;

                    return (
                      <div
                        key={idx}
                        className="p-2.5 rounded-xl bg-indigo-50/50 border border-indigo-200 flex items-center justify-between gap-2 text-xs"
                      >
                        <div className="min-w-0">
                          <div className="font-bold text-slate-900 truncate">
                            {sp.ref} — {sp.designation}
                          </div>
                          <div className="text-[10.5px] font-mono text-slate-500 flex items-center gap-2">
                            <span>
                              Stock Actuel:{' '}
                              <b className={isShort ? 'text-rose-600' : 'text-emerald-700'}>
                                {stockMatch ? stockActuel : 'N/A'}
                              </b>
                            </span>
                            {isShort && (
                              <span className="text-rose-600 font-bold flex items-center gap-0.5">
                                <AlertTriangle className="w-3 h-3" /> Stock insuffisant
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <input
                            type="number"
                            min={0}
                            value={sp.qty}
                            onChange={(e) => {
                              const val = Math.max(0, Number(e.target.value || 0));
                              setReviewSpares((prev) =>
                                prev.map((item, i) => (i === idx ? { ...item, qty: val } : item))
                              );
                            }}
                            className="w-16 px-2 py-1 rounded-lg border border-slate-300 bg-white font-mono font-bold text-center text-xs"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setReviewSpares((prev) => prev.filter((_, i) => i !== idx))
                            }
                            className="p-1 text-rose-500 hover:text-rose-700"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
                {reviewSpares.length > 0 && (
                  <label className="flex items-start gap-2 pt-2 border-t border-slate-200/80 text-[11px] text-slate-700 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={skipStockDeduction}
                      onChange={(e) => setSkipStockDeduction(e.target.checked)}
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

            {/* Auto-DI sur Anomalie Préventive */}
            <div className="p-3 rounded-2xl bg-amber-50/70 border border-amber-200 space-y-2">
              <label className="flex items-start gap-2 text-xs text-amber-950 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={createFollowUpDi}
                  onChange={(e) => setCreateFollowUpDi(e.target.checked)}
                  className="mt-0.5 rounded border-amber-400 text-amber-600 focus:ring-amber-500"
                />
                <span>
                  <strong className="font-black">
                    Créer une DI corrective de suivi (Auto-DI sur anomalie préventive)
                  </strong>{' '}
                  — Génère automatiquement une Demande d&apos;Intervention liée à{' '}
                  <code className="font-mono font-bold">{reviewExecution.machineCode}</code> dès l&apos;approbation.
                </span>
              </label>

              {createFollowUpDi && (
                <div className="pt-1">
                  <label className="block text-[10px] font-bold text-amber-900 uppercase mb-1">
                    Description de l&apos;anomalie pour la DI corrective :
                  </label>
                  <input
                    type="text"
                    value={followUpDiAnomalie}
                    onChange={(e) => setFollowUpDiAnomalie(e.target.value)}
                    className="w-full rounded-xl border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-900"
                  />
                </div>
              )}
            </div>

            {/* Validation / Clarification Note */}
            <div className="text-xs">
              <label className="block font-bold text-slate-700 uppercase mb-1">
                Note de Validation / Motif de Clarification :
              </label>
              <textarea
                rows={2}
                value={reviewNote}
                onChange={(e) => setReviewNote(e.target.value)}
                placeholder="Ex: Référence roulement vérifiée conforme au bon magasin, ou préciser le N° de bon..."
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
              />
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => handleReviewDecision('REJECTED')}
                className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-rose-100 text-rose-700 text-xs font-bold cursor-pointer transition"
              >
                Rejeter (Remettre À faire)
              </button>
              <button
                type="button"
                onClick={() => handleReviewDecision('NEEDS_CLARIFICATION')}
                className="px-3.5 py-2 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-900 text-xs font-bold cursor-pointer transition"
              >
                Demander Clarification
              </button>
              <button
                type="button"
                onClick={() => handleReviewDecision('APPROVED')}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-xs cursor-pointer transition"
              >
                {skipStockDeduction ? 'Approuver (Sans 2e déstockage)' : 'Approuver & Déduire Stock'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
