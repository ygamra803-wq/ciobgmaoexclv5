import { useState } from 'react';
import {
  Sliders,
  Layers,
  Cpu,
  Users,
  Activity,
  Wrench,
  FileSpreadsheet,
  Trash2,
  Package,
  Calendar,
  Power,
  CheckCircle2,
} from 'lucide-react';

/**
 * Data Injection Hub: Seed factory baseline data, reset datasets, toggle demo mode.
 */
export default function SettingsInjectionTab({
  handleInjectAll,
  initialStock = [],
  handleInjectGroup,
  handleClearGroup,
  initialMachines = [],
  initialZones = [],
  initialTechnicians = [],
  initialMouvements = [],
  initialCorrectiveInterventions = [],
  warehouseCount = 0,
  preventiveCount = 0,
  isDemoMode,
  setIsDemoMode,
  onToggleDemoMode,
  onDownloadBlankTemplate,
  showToast,
  handleSaveSettings,
  handleResetToZero,
}) {
  const [selectedDemoSection, setSelectedDemoSection] = useState('all');

  const sectionLabels = {
    all: 'Toute l’Usine (Tous les Tableaux)',
    stock: 'Stock & Articles PDR',
    parc: 'Parc Machines & Modèles',
    entrepot: 'Entrepôt & Organes',
    zones: 'Zones & Équipes Techniques',
    mouvements: 'Mouvements & Sorties Externes',
    preventive: 'Maintenance Préventive',
    corrective: 'Interventions Correctives',
  };

  const handleApplyDemoSwitch = (nextActive) => {
    if (typeof onToggleDemoMode === 'function') {
      onToggleDemoMode(nextActive, selectedDemoSection);
      return;
    }
    setIsDemoMode(nextActive);
    if (nextActive) {
      if (selectedDemoSection === 'all') {
        handleInjectAll?.();
      } else {
        handleInjectGroup?.(selectedDemoSection);
      }
    } else {
      if (selectedDemoSection === 'all') {
        handleResetToZero?.();
      } else {
        handleClearGroup?.(selectedDemoSection);
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Global & Targeted Demo Mode Control Banner */}
      <div className="p-5 rounded-2xl border-2 border-emerald-200 bg-gradient-to-br from-emerald-50/70 via-white to-cyan-50/40 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span
                className={`p-2 rounded-xl shadow-xs ${
                  isDemoMode ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-700'
                }`}
              >
                <Power className="w-5 h-5" />
              </span>
              <div>
                <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <span>Mode Données Démo Usine (Contrôle Global & Par Section)</span>
                  <span
                    className={`px-2.5 py-0.5 text-[10px] font-bold rounded-full border ${
                      isDemoMode
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                        : 'bg-amber-100 text-amber-800 border-amber-300'
                    }`}
                  >
                    {isDemoMode ? 'MODE DÉMO ACTIF' : 'MODE USINE VIERGE'}
                  </span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Activez ou désactivez les données de démonstration sur toute l'application ou ciblez uniquement une section précise sans perdre le reste de votre travail.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <select
              value={selectedDemoSection}
              onChange={(e) => setSelectedDemoSection(e.target.value)}
              className="h-10 px-3 rounded-xl border border-slate-300 bg-white text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-200 cursor-pointer"
              title="Choisir la section cible"
            >
              {Object.entries(sectionLabels).map(([key, label]) => (
                <option key={key} value={key}>
                  Cible : {label}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => handleApplyDemoSwitch(true)}
              className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-sm transition flex items-center gap-1.5 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Activer / Injecter ({selectedDemoSection === 'all' ? 'Tout' : 'Section'})</span>
            </button>

            <button
              type="button"
              onClick={() => handleApplyDemoSwitch(false)}
              className="px-4 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs transition flex items-center gap-1.5 cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
              <span>Désactiver / Vider ({selectedDemoSection === 'all' ? 'Tout' : 'Section'})</span>
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Sliders className="w-4 h-4 text-emerald-600 shrink-0" />
            Centre d'injection granulaire par module
          </h3>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
            Réinjectez ou videz individuellement chaque module de l'usine (Stock, Parc Machines, Entrepôt, Préventif, Correctif, Mouvements, Équipes).
          </p>
        </div>
        <button
          onClick={handleInjectAll}
          className="w-full lg:w-auto px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-black text-white font-black text-xs shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
        >
          Injecter Toutes les Données Usine (Excel Twin)
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Group 1: Stock */}
        <div className="p-5 rounded-2xl border border-slate-200 bg-white flex flex-col justify-between shadow-xs space-y-4">
          <div>
            <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider mb-2 flex items-center gap-2">
              <Layers className="w-3.5 h-3.5 text-cyan-600" />
              Stock & Articles ({initialStock.length})
            </h4>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Injecte la nomenclature intégrale des articles de stock, types et désignations avec leurs références et emplacements.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => handleInjectGroup('stock')}
              className="flex-1 py-2 bg-slate-50 border border-slate-200 text-slate-700 font-bold text-[11px] rounded-lg hover:bg-slate-100 transition cursor-pointer"
            >
              Injecter le Stock
            </button>
            {handleClearGroup && (
              <button
                onClick={() => handleClearGroup('stock')}
                className="px-3 py-2 bg-rose-50 border border-rose-200 text-rose-700 font-bold text-[11px] rounded-lg hover:bg-rose-100 transition cursor-pointer"
                title="Vider uniquement le Stock"
              >
                Vider
              </button>
            )}
          </div>
        </div>

        {/* Group 2: Machines */}
        <div className="p-5 rounded-2xl border border-slate-200 bg-white flex flex-col justify-between shadow-xs space-y-4">
          <div>
            <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider mb-2 flex items-center gap-2">
              <Cpu className="w-3.5 h-3.5 text-emerald-600" />
              Parc Machines ({initialMachines.length})
            </h4>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Initialise l'ensemble des machines enregistrées de l'usine, leurs familles de production, modèles et arborescences (Blueprints).
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => handleInjectGroup('parc')}
              className="flex-1 py-2 bg-slate-50 border border-slate-200 text-slate-700 font-bold text-[11px] rounded-lg hover:bg-slate-100 transition cursor-pointer"
            >
              Injecter le Parc
            </button>
            {handleClearGroup && (
              <button
                onClick={() => handleClearGroup('parc')}
                className="px-3 py-2 bg-rose-50 border border-rose-200 text-rose-700 font-bold text-[11px] rounded-lg hover:bg-rose-100 transition cursor-pointer"
                title="Vider uniquement le Parc Machines"
              >
                Vider
              </button>
            )}
          </div>
        </div>

        {/* Group 3: Entrepôt & Référentiels */}
        <div className="p-5 rounded-2xl border border-slate-200 bg-white flex flex-col justify-between shadow-xs space-y-4">
          <div>
            <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider mb-2 flex items-center gap-2">
              <Package className="w-3.5 h-3.5 text-teal-600" />
              Entrepôt & Organes ({warehouseCount})
            </h4>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Injecte les équipements de réserve de l'entrepôt, groupes d'organes, familles, modèles d'organes et types de pièces.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => handleInjectGroup('entrepot')}
              className="flex-1 py-2 bg-slate-50 border border-slate-200 text-slate-700 font-bold text-[11px] rounded-lg hover:bg-slate-100 transition cursor-pointer"
            >
              Injecter l'Entrepôt
            </button>
            {handleClearGroup && (
              <button
                onClick={() => handleClearGroup('entrepot')}
                className="px-3 py-2 bg-rose-50 border border-rose-200 text-rose-700 font-bold text-[11px] rounded-lg hover:bg-rose-100 transition cursor-pointer"
                title="Vider uniquement l'Entrepôt"
              >
                Vider
              </button>
            )}
          </div>
        </div>

        {/* Group 4: Teams & Zones */}
        <div className="p-5 rounded-2xl border border-slate-200 bg-white flex flex-col justify-between shadow-xs space-y-4">
          <div>
            <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider mb-2 flex items-center gap-2">
              <Users className="w-3.5 h-3.5 text-indigo-600" />
              Zones & Équipes ({initialZones.length + initialTechnicians.length})
            </h4>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Injecte les zones d'ateliers, les superviseurs d'opérations et le corps des techniciens qualifiés.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => handleInjectGroup('zones')}
              className="flex-1 py-2 bg-slate-50 border border-slate-200 text-slate-700 font-bold text-[11px] rounded-lg hover:bg-slate-100 transition cursor-pointer"
            >
              Injecter les Équipes
            </button>
            {handleClearGroup && (
              <button
                onClick={() => handleClearGroup('zones')}
                className="px-3 py-2 bg-rose-50 border border-rose-200 text-rose-700 font-bold text-[11px] rounded-lg hover:bg-rose-100 transition cursor-pointer"
                title="Vider uniquement Zones & Équipes"
              >
                Vider
              </button>
            )}
          </div>
        </div>

        {/* Group 5: Mouvements */}
        <div className="p-5 rounded-2xl border border-slate-200 bg-white flex flex-col justify-between shadow-xs space-y-4">
          <div>
            <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider mb-2 flex items-center gap-2">
              <Activity className="w-3.5 h-3.5 text-amber-600" />
              Mouvements Historiques ({initialMouvements.length})
            </h4>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Injecte les écritures de mouvements de stock (Sorties, Entrées, Sorties Externes, Bons de Commande).
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => handleInjectGroup('mouvements')}
              className="flex-1 py-2 bg-slate-50 border border-slate-200 text-slate-700 font-bold text-[11px] rounded-lg hover:bg-slate-100 transition cursor-pointer"
            >
              Injecter Mouvements
            </button>
            {handleClearGroup && (
              <button
                onClick={() => handleClearGroup('mouvements')}
                className="px-3 py-2 bg-rose-50 border border-rose-200 text-rose-700 font-bold text-[11px] rounded-lg hover:bg-rose-100 transition cursor-pointer"
                title="Vider uniquement les Mouvements"
              >
                Vider
              </button>
            )}
          </div>
        </div>

        {/* Group 6: Maintenance Préventive */}
        <div className="p-5 rounded-2xl border border-slate-200 bg-white flex flex-col justify-between shadow-xs space-y-4">
          <div>
            <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider mb-2 flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5 text-purple-600" />
              Maintenance Préventive ({preventiveCount})
            </h4>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Injecte le planning préventif complet, les gammes d'actions préventives et le référentiel des guides d'entretien.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => handleInjectGroup('preventive')}
              className="flex-1 py-2 bg-slate-50 border border-slate-200 text-purple-700 font-bold text-[11px] rounded-lg hover:bg-purple-50 transition cursor-pointer"
            >
              Injecter le Préventif
            </button>
            {handleClearGroup && (
              <button
                onClick={() => handleClearGroup('preventive')}
                className="px-3 py-2 bg-rose-50 border border-rose-200 text-rose-700 font-bold text-[11px] rounded-lg hover:bg-rose-100 transition cursor-pointer"
                title="Vider uniquement le Préventif"
              >
                Vider
              </button>
            )}
          </div>
        </div>

        {/* Group 7: Interventions Correctives */}
        <div className="p-5 rounded-2xl border border-slate-200 bg-white flex flex-col justify-between shadow-xs space-y-4 col-span-1 sm:col-span-2 lg:col-span-3">
          <div>
            <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider mb-2 flex items-center gap-2">
              <Wrench className="w-3.5 h-3.5 text-rose-600" />
              Interventions Correctives & Catalogue Pannes ({initialCorrectiveInterventions.length})
            </h4>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Injecte les 800 fiches de dépannage et bons de travail historiques ainsi que le catalogue des pannes, travaux à faire et intervenants.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => handleInjectGroup('corrective')}
              className="flex-1 py-2 bg-slate-50 border border-rose-200 text-rose-700 font-bold text-[11px] rounded-lg hover:bg-rose-50 transition cursor-pointer"
            >
              Injecter le Correctif
            </button>
            {handleClearGroup && (
              <button
                onClick={() => handleClearGroup('corrective')}
                className="px-4 py-2 bg-rose-50 border border-rose-200 text-rose-700 font-bold text-[11px] rounded-lg hover:bg-rose-100 transition cursor-pointer"
                title="Vider uniquement le Correctif"
              >
                Vider le Correctif
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="pt-5 border-t border-slate-100 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4 min-w-0">
          <span className="text-xs font-bold text-slate-700">
            Paramétrage de démarrage par défaut :
          </span>
          <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-600">
            <input
              type="checkbox"
              checked={isDemoMode}
              onChange={(e) => setIsDemoMode(e.target.checked)}
              className="rounded text-cyan-600 border-slate-300 focus:ring-cyan-500"
            />
            <span>Afficher les maquettes et fiches d'exemples au démarrage</span>
          </label>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full xl:w-auto">
          <button
            type="button"
            onClick={() => {
              if (typeof onDownloadBlankTemplate === 'function') {
                onDownloadBlankTemplate();
              } else {
                showToast?.("Téléchargement du gabarit vierge déclenché !", "success");
              }
            }}
            className="w-full sm:w-auto px-4 py-2 rounded-xl bg-slate-100 text-slate-800 border border-slate-300 hover:bg-slate-200 font-bold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
            title="Télécharger le modèle Excel vierge pour préparer vos données réelles"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            Gabarit Vierge (.XLSX)
          </button>
          <button
            onClick={handleSaveSettings}
            className="w-full sm:w-auto px-4 py-2 bg-slate-900 hover:bg-black text-white font-bold text-xs rounded-xl transition cursor-pointer text-center"
          >
            Enregistrer ma préférence
          </button>
          <button
            onClick={handleResetToZero}
            className="w-full sm:w-auto px-4 py-2 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 font-bold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Effacer tout et démarrer à vide
          </button>
        </div>
      </div>
    </div>
  );
}
