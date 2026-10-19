import { useState } from 'react';
import {
  Calculator,
  X,
  Clock,
  TrendingUp,
  Layers,
} from 'lucide-react';
import { useI18n } from '../../../i18n/I18nContext';

export default function CorrectiveFormulasModal({ isOpen, onClose }) {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState('time'); // 'time' | 'mttr' | 'pareto'

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div
        className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent p-5 border-b border-slate-200/90 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-300/80 flex items-center justify-center text-amber-700 shadow-xs">
              <Calculator className="w-5 h-5 text-amber-700" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-slate-900 tracking-tight">
                  {t('corrective.formulas.title')}
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-100 text-amber-900 border border-amber-200">
                  GMAO Twin
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {t('corrective.formulas.subtitle')}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full border border-slate-200 bg-white hover:bg-slate-100 text-slate-500 hover:text-slate-800 flex items-center justify-center transition cursor-pointer shadow-2xs"
            aria-label={t('corrective.buttons.close')}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Tab Selector */}
        <div className="flex items-center gap-2 px-6 pt-4 border-b border-slate-100 bg-slate-50/50">
          <button
            onClick={() => setActiveTab('time')}
            className={`px-4 py-2 text-xs font-bold rounded-t-xl border-b-2 transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'time'
                ? 'border-amber-600 text-amber-800 bg-white shadow-2xs'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>1. Temps d'Intervention Usine (NETWORKDAYS)</span>
          </button>

          <button
            onClick={() => setActiveTab('mttr')}
            className={`px-4 py-2 text-xs font-bold rounded-t-xl border-b-2 transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'mttr'
                ? 'border-amber-600 text-amber-800 bg-white shadow-2xs'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>2. MTTR & MTBF & Disponibilité</span>
          </button>

          <button
            onClick={() => setActiveTab('pareto')}
            className={`px-4 py-2 text-xs font-bold rounded-t-xl border-b-2 transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'pareto'
                ? 'border-amber-600 text-amber-800 bg-white shadow-2xs'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>3. Loi de Pareto (80/20)</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs text-slate-600">
          {activeTab === 'time' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200/80 space-y-2">
                <span className="font-extrabold text-amber-950 uppercase text-[10.5px] tracking-wider block">
                  Configuration des Horaires d'Usine & Déduction des Pauses
                </span>
                <p className="leading-relaxed">
                  Le calcul du temps d'intervention effectif reproduit fidèlement la formule Excel avancée. Il exclut automatiquement les pauses déjeuner, les nuits hors-shift et les dimanches non ouvrés :
                </p>
                <div className="font-mono bg-white p-3 rounded-xl border border-amber-200 text-[11px] text-slate-800 space-y-1 shadow-2xs">
                  <div><b>entre1</b> = 08:00 (Début Shift Matin)</div>
                  <div><b>sortie1</b> = 13:15 (Début Pause Déjeuner)</div>
                  <div><b>entre2</b> = 14:00 (Reprise Shift Après-midi)</div>
                  <div><b>pause</b> = 00:45 (Durée de pause déduite)</div>
                  <div><b>sortie2</b> = 17:00 (Fin de Journée Ouvrée)</div>
                  <div className="text-emerald-700 font-bold pt-1 border-t border-slate-100">
                    → Temps Ouvré Max / Jour = 08h 15m (495 minutes)
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="font-bold text-slate-800">Formule Mathématique Appliquée :</h4>
                <div className="bg-slate-900 text-emerald-400 p-3 rounded-xl font-mono text-xs overflow-x-auto shadow-inner">
                  {`Temps = (JoursOuvrés - 1) * 495m + MinutesJour1 + MinutesJourFin - PausesDéduites`}
                </div>
                <p className="text-[11px] text-slate-500">
                  Les interventions chevauchant la pause de midi (13:15 à 14:00) voient 45 minutes déduites automatiquement pour ne pas fausser le temps de main-d'œuvre payée.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'mttr' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-4 rounded-2xl bg-blue-50/80 border border-blue-200/80 space-y-2">
                  <span className="font-extrabold text-blue-950 uppercase text-[10.5px] tracking-wider block">
                    MTTR (Mean Time To Repair)
                  </span>
                  <div className="font-mono bg-white p-2.5 rounded-xl border border-blue-200 text-xs text-blue-900 font-bold">
                    MTTR = Σ(Temps de Réparation) / Nb Interventions
                  </div>
                  <p className="text-[11px] leading-relaxed text-slate-600">
                    Mesure la maintenabilité et la rapidité moyenne de remise en service de la machine.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-purple-50/80 border border-purple-200/80 space-y-2">
                  <span className="font-extrabold text-purple-950 uppercase text-[10.5px] tracking-wider block">
                    MTBF (Mean Time Between Failures)
                  </span>
                  <div className="font-mono bg-white p-2.5 rounded-xl border border-purple-200 text-xs text-purple-900 font-bold">
                    MTBF = (Temps Fonctionnement - Arrêts) / Nb Pannes
                  </div>
                  <p className="text-[11px] leading-relaxed text-slate-600">
                    Mesure la fiabilité intrinsèque de l'équipement industriel entre deux pannes consécutives.
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-emerald-50/80 border border-emerald-200/80 space-y-2">
                <span className="font-extrabold text-emerald-950 uppercase text-[10.5px] tracking-wider block">
                  Taux de Disponibilité Opérationnelle (%)
                </span>
                <div className="font-mono bg-white p-2.5 rounded-xl border border-emerald-200 text-xs text-emerald-900 font-bold">
                  Disponibilité = ((Temps d'Ouverture Usine - Temps d'Arrêt) / Temps d'Ouverture) × 100
                </div>
                <p className="text-[11px] text-slate-600">
                  Objectif cible usine : <b>≥ 95%</b> pour les machines critiques de production.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'pareto' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-rose-50/80 border border-rose-200/80 space-y-2">
                <span className="font-extrabold text-rose-950 uppercase text-[10.5px] tracking-wider block">
                  Principe de Pareto 80 / 20
                </span>
                <p className="leading-relaxed">
                  20% des causes (anomalies ou machines) sont responsables de 80% des arrêts et des temps d'intervention :
                </p>
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-rose-500" />
                    <span><b>Zone Critique A (0% à 80%)</b> : Anomalies prioritaires nécessitant un plan préventif immédiat.</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    <span><b>Zone Intermédiaire B (80% à 95%)</b> : Pannes secondaires sous surveillance.</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-slate-400" />
                    <span><b>Zone C (95% à 100%)</b> : Pannes résiduelles non critiques.</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 p-4 border-t border-slate-200 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition cursor-pointer shadow-xs active:scale-95"
          >
            Fermer la Documentation
          </button>
        </div>
      </div>
    </div>
  );
}
