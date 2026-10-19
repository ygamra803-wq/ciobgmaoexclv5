import { HardDrive, Database, Activity, FileSpreadsheet, Download } from 'lucide-react';

/**
 * Overview & Storage System Supervision Panel.
 */
export default function SettingsOverviewTab({
  localStorageSizeKB,
  storagePercentage,
  rawStock = [],
  machines = [],
  mouvements = [],
  zones = [],
  technicians = [],
  operations = [],
  warehouseItems = [],
  sortiesExterne = [],
  preventiveTasks = [],
  correctiveInterventions = [],
  linkedFileName,
  fileDetails = { size: '0 KB', lastModified: 'Non disponible' },
  linkedFileHandle,
  onDownloadBlankTemplate,
  onExportExcel,
  showToast,
}) {
  return (
    <div className="space-y-6">
      <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2 flex items-center gap-2">
        <HardDrive className="w-4 h-4 text-cyan-600" />
        Statistiques globales du stockage local
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* LocalStorage Usage */}
        <div className="p-5 rounded-2xl border border-slate-200 bg-white shadow-xs space-y-3">
          <div className="flex justify-between items-center text-xs font-bold text-slate-700">
            <span className="flex items-center gap-1.5">
              <Database className="w-4 h-4 text-cyan-600" />
              Cache Navigateur Local
            </span>
            <span className="font-mono text-cyan-800">{localStorageSizeKB} KB / 5 MB</span>
          </div>
          <div className="w-full h-2 rounded-full bg-slate-100 border border-slate-200 overflow-hidden">
            <div
              className="h-full bg-cyan-600 rounded-full transition-all duration-500"
              style={{ width: `${storagePercentage}%` }}
            />
          </div>
          <div className="text-[11px] text-slate-400 font-medium">
            Le stockage local est occupé à {storagePercentage}%.
          </div>
        </div>

        {/* Counts Card */}
        <div className="p-5 rounded-2xl border border-slate-200 bg-white shadow-xs space-y-2">
          <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
            <Activity className="w-4 h-4 text-emerald-600" />
            Nombre de fiches enregistrées
          </div>
          <div className="grid grid-cols-2 gap-2 text-[11px] font-medium text-slate-500 pt-1">
            <div>
              Articles:{' '}
              <b className="text-slate-900 font-mono font-bold">{rawStock.length}</b>
            </div>
            <div>
              Machines:{' '}
              <b className="text-slate-900 font-mono font-bold">{machines.length}</b>
            </div>
            <div>
              Mouvements:{' '}
              <b className="text-slate-900 font-mono font-bold">{mouvements.length}</b>
            </div>
            <div>
              Zones: <b className="text-slate-900 font-mono font-bold">{zones.length}</b>
            </div>
            <div>
              Techniciens:{' '}
              <b className="text-slate-900 font-mono font-bold">{technicians.length}</b>
            </div>
            <div>
              Chefs & Ops:{' '}
              <b className="text-slate-900 font-mono font-bold">{operations.length}</b>
            </div>
          </div>
        </div>

        {/* Excel Linked */}
        <div className="p-5 rounded-2xl border border-slate-200 bg-white shadow-xs space-y-2 col-span-1 md:col-span-2 lg:col-span-1">
          <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
            <FileSpreadsheet className="w-4 h-4 text-indigo-600" />
            Fichier Excel lié
          </div>
          <div className="text-xs pt-1 space-y-1 text-slate-500 font-medium">
            <div className="truncate">
              Nom:{' '}
              <span className="text-slate-900 font-mono font-bold">
                {linkedFileName || 'GMAO_Light_Template.xlsx'}
              </span>
            </div>
            <div>
              Taille: <span className="text-slate-900 font-mono">{fileDetails.size}</span>
            </div>
            <div>
              Modifié le:{' '}
              <span className="text-slate-900 font-mono">{fileDetails.lastModified}</span>
            </div>
            <div className="flex items-center gap-1 text-[10px] font-bold mt-1 text-emerald-600">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
              Liaison:{' '}
              {linkedFileHandle ? 'Connecté en Direct' : 'Simulation Active (Excel Twin)'}
            </div>
          </div>
        </div>
      </div>

      {/* FULL FACTORY EXCEL TWIN EXPORT CARD */}
      <div className="p-5 rounded-2xl border-2 border-emerald-200 bg-gradient-to-br from-emerald-50/80 via-white to-teal-50/40 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-2 bg-emerald-600 text-white rounded-xl shadow-xs">
                <FileSpreadsheet className="w-5 h-5" />
              </span>
              <div>
                <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  Exportateur Global Excel Twin (Full Factory .XLSX)
                  <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-100 text-emerald-800 rounded-full border border-emerald-200">
                    100% Offline
                  </span>
                </h4>
                <p className="text-xs text-slate-500 font-medium">
                  Génère en 1 clic un classeur Excel complet multi-onglets structuré et calibré avec l'ensemble des données de l'usine.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                if (typeof onDownloadBlankTemplate === 'function') {
                  onDownloadBlankTemplate();
                } else {
                  showToast?.("Téléchargement du gabarit vierge déclenché !", "success");
                }
              }}
              className="px-4 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 text-xs font-bold rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              title="Télécharger un modèle Excel vierge prêt pour la saisie usine avec formules intactes"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>Gabarit Vierge (Template .XLSX)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (typeof onExportExcel === 'function') {
                  onExportExcel();
                } else {
                  showToast?.("Export Excel déclenché avec succès !", "success");
                }
              }}
              className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 active:scale-95 text-white text-xs font-black rounded-xl shadow-md shadow-emerald-600/20 hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0"
            >
              <Download className="w-4 h-4" />
              <span>Exporter Tout le Modèle Excel</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-2 pt-2 border-t border-emerald-100/80 text-center">
          <div className="bg-white/80 p-2 rounded-xl border border-emerald-100">
            <div className="text-[10px] font-bold text-slate-400 uppercase">Stock</div>
            <div className="text-sm font-black text-emerald-700 font-mono">{rawStock.length}</div>
          </div>
          <div className="bg-white/80 p-2 rounded-xl border border-emerald-100">
            <div className="text-[10px] font-bold text-slate-400 uppercase">Machines</div>
            <div className="text-sm font-black text-emerald-700 font-mono">{machines.length}</div>
          </div>
          <div className="bg-white/80 p-2 rounded-xl border border-emerald-100">
            <div className="text-[10px] font-bold text-slate-400 uppercase">Mouvements</div>
            <div className="text-sm font-black text-emerald-700 font-mono">{mouvements.length}</div>
          </div>
          <div className="bg-white/80 p-2 rounded-xl border border-emerald-100">
            <div className="text-[10px] font-bold text-slate-400 uppercase">Sorties Ext.</div>
            <div className="text-sm font-black text-emerald-700 font-mono">{sortiesExterne.length}</div>
          </div>
          <div className="bg-white/80 p-2 rounded-xl border border-emerald-100">
            <div className="text-[10px] font-bold text-slate-400 uppercase">Préventif</div>
            <div className="text-sm font-black text-emerald-700 font-mono">{preventiveTasks.length}</div>
          </div>
          <div className="bg-white/80 p-2 rounded-xl border border-emerald-100">
            <div className="text-[10px] font-bold text-slate-400 uppercase">Correctif</div>
            <div className="text-sm font-black text-emerald-700 font-mono">{correctiveInterventions.length}</div>
          </div>
          <div className="bg-white/80 p-2 rounded-xl border border-emerald-100">
            <div className="text-[10px] font-bold text-slate-400 uppercase">Entrepôt</div>
            <div className="text-sm font-black text-emerald-700 font-mono">{warehouseItems.length}</div>
          </div>
          <div className="bg-white/80 p-2 rounded-xl border border-emerald-100">
            <div className="text-[10px] font-bold text-slate-400 uppercase">Zones & Staff</div>
            <div className="text-sm font-black text-emerald-700 font-mono">{zones.length + technicians.length}</div>
          </div>
        </div>
      </div>

      <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-600 leading-relaxed max-w-full">
        <div className="font-bold text-slate-900 mb-1">
          Mécanique d'unification de stockage :
        </div>
        Toutes les opérations s'effectuent directement dans le navigateur pour garantir une
        exécution fluide et ultra-rapide hors ligne. Les données de votre inventaire, de vos
        mouvements et de votre parc de machines sont préservées localement même en cas de
        coupure de réseau.
      </div>
    </div>
  );
}
