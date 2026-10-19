import { FolderOpen } from 'lucide-react';

/**
 * Shared Folder, Local Network Path, and Polling Synchronization Settings.
 */
export default function SettingsDirectoryTab({
  sharedFolderPath,
  setSharedFolderPath,
  onDirectLink,
  autoWriteExcel,
  setAutoWriteExcel,
  pollingInterval,
  setPollingInterval,
  linkedFileHandle,
  linkedFileName,
  handleSaveSettings,
}) {
  return (
    <div className="space-y-6">
      <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2 flex items-center gap-2">
        <FolderOpen className="w-4 h-4 text-indigo-600" />
        Source des données et dossier réseau partagé
      </h3>

      <p className="text-xs text-slate-500 leading-relaxed max-w-3xl">
        Pour déployer le système sur plusieurs machines d'ateliers et partager la même source en temps réel, vous pouvez coupler l'application à un répertoire de stockage partagé sur votre serveur local d'usine.
      </p>

      <div className="space-y-4 w-full bg-slate-50 p-4 sm:p-5 rounded-2xl border border-slate-200">
        <div className="space-y-2">
          <label className="block text-xs font-bold text-slate-700">
            Dossier réseau cible ou lecteur mappé partagé :
          </label>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={sharedFolderPath}
              onChange={(e) => setSharedFolderPath(e.target.value)}
              className="w-full h-10 px-3 rounded-xl border border-slate-300 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-cyan-200 font-mono text-slate-800"
              placeholder="ex: Z:\Partage\CIOB_GMAO"
            />
            <button
              onClick={onDirectLink}
              className="h-10 px-4 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 font-bold text-xs rounded-xl transition flex items-center justify-center gap-2 shrink-0 cursor-pointer w-full sm:w-auto"
            >
              <FolderOpen className="w-4 h-4 text-indigo-600" />
              Changer de dossier
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">
              Écriture Excel automatique :
            </label>
            <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-600">
              <input
                type="checkbox"
                checked={autoWriteExcel}
                onChange={(e) => setAutoWriteExcel(e.target.checked)}
                className="rounded text-indigo-600 border-slate-300 focus:ring-indigo-500"
              />
              <span>Mise à jour auto d'Excel à chaque mouvement</span>
            </label>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">
              Fréquence de scrutation réseau (Auto-Reload) :
            </label>
            <select
              value={pollingInterval}
              onChange={(e) => setPollingInterval(e.target.value)}
              className="h-9 px-3 rounded-lg border border-slate-300 text-xs font-semibold bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200 text-slate-800 w-full"
            >
              <option value="off">Rafraîchissement manuel uniquement</option>
              <option value="5s">Toutes les 5 secondes (Recommandé)</option>
              <option value="10s">Toutes les 10 secondes</option>
              <option value="30s">Toutes les 30 secondes</option>
            </select>
          </div>
        </div>

        <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-200">
          <div className="text-xs text-slate-500 font-medium flex items-center gap-1.5">
            Statut de couplage :
            {linkedFileHandle ? (
              <span className="text-emerald-700 font-bold flex items-center gap-1.5 inline-flex">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping" />
                Connecté ({linkedFileName || 'Fichier réseau partagé'})
              </span>
            ) : (
              <span className="text-rose-700 font-bold flex items-center gap-1.5 inline-flex">
                <span className="w-1.5 h-1.5 bg-rose-500 rounded-full" />
                Déconnecté (Aucun fichier réseau lié)
              </span>
            )}
          </div>
          <button
            onClick={handleSaveSettings}
            className="w-full sm:w-auto px-4 h-9 bg-slate-900 hover:bg-black text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer"
          >
            Enregistrer les paramètres
          </button>
        </div>
      </div>

      <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-600 leading-relaxed max-w-full">
        <div className="font-bold text-slate-900 mb-1">Architecture réseau multi-postes :</div>
        En spécifiant le même chemin réseau partagé d'ateliers pour chaque poste d'usine,
        l'application synchronisera ses écrans automatiquement, garantissant aux opérateurs,
        techniciens et coordinateurs un état des stocks et un carnet de mouvements unifiés.
      </div>
    </div>
  );
}
