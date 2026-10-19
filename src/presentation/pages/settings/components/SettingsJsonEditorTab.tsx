import {
  FileCode,
  Upload,
  Download,
  AlertTriangle,
  RotateCcw,
  Check,
} from 'lucide-react';

/**
 * Raw Database JSON direct editor and state import/export.
 */
export default function SettingsJsonEditorTab({
  jsonTarget,
  setJsonTarget,
  handleUploadJSON,
  handleDownloadJSON,
  jsonError,
  jsonText,
  setJsonText,
  handleCancelEdits,
  isJsonModified,
  handleSaveJSON,
}) {
  return (
    <div className="space-y-6 max-w-full overflow-hidden">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <FileCode className="w-4 h-4 text-rose-500 shrink-0" />
            Modification brute de la base de données locale au format JSON
          </h3>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
            Modifiez directement les collections brutes de votre GMAO sous forme de fichiers de données JSON.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto shrink-0">
          <select
            value={jsonTarget}
            onChange={(e) => setJsonTarget(e.target.value)}
            className="h-10 px-3 rounded-xl border border-slate-200 text-xs font-bold bg-white focus:outline-none focus:ring-2 focus:ring-cyan-200 text-slate-800 shadow-xs cursor-pointer min-w-[200px]"
          >
            <option value="rawStock">Articles & Stock_Actuel</option>
            <option value="mouvements">Mouvements & Historique</option>
            <option value="machines">Machines_Registered</option>
            <option value="families">Familles</option>
            <option value="templates">Modèles (Templates)</option>
            <option value="zones">Zones d'usine</option>
            <option value="technicians">Techniciens</option>
            <option value="operations">Coordinateurs & Chefs</option>
            <option value="types">Types de pièces</option>
          </select>

          <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 w-full sm:w-auto">
            <input
              type="file"
              id="json-file-upload-input"
              accept=".json"
              onChange={handleUploadJSON}
              className="hidden"
            />

            <button
              onClick={() => document.getElementById('json-file-upload-input')?.click()}
              className="h-10 px-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
              title="Importer un fichier JSON externe"
            >
              <Upload className="w-4 h-4 text-emerald-600" />
              <span>Importer</span>
            </button>

            <button
              onClick={handleDownloadJSON}
              className="h-10 px-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
              title="Télécharger le code actuel au format JSON"
            >
              <Download className="w-4 h-4 text-indigo-600" />
              <span>Télécharger</span>
            </button>
          </div>
        </div>
      </div>

      {jsonError && (
        <div className="p-3.5 rounded-xl border border-rose-200 bg-rose-50 text-xs font-mono text-rose-700 flex items-start gap-2 max-w-full overflow-hidden break-words">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <div className="font-bold">Erreur de structure JSON :</div>
            <div className="mt-1 opacity-90 whitespace-pre-wrap break-all text-[11px]">
              {jsonError}
            </div>
          </div>
        </div>
      )}

      <div className="border border-slate-200 rounded-2xl overflow-hidden bg-slate-950 shadow-xs w-full max-w-full">
        <div className="bg-slate-900 border-b border-slate-800 px-4 py-2.5 flex flex-col sm:flex-row gap-2 justify-between sm:items-center text-xs text-slate-400 font-mono">
          <span className="truncate">Éditeur natif de code ({jsonTarget})</span>
          <span className="text-[10px] bg-slate-800 text-slate-300 px-2.5 py-0.5 rounded-md border border-slate-700 w-fit shrink-0">
            Tableau d'objets attendu
          </span>
        </div>
        <textarea
          value={jsonText}
          onChange={(e) => setJsonText(e.target.value)}
          className="w-full h-96 p-4 bg-slate-950 text-emerald-400 font-mono text-xs leading-relaxed border-0 focus:ring-0 focus:outline-none resize-y overflow-auto block"
          spellCheck="false"
        />
      </div>

      {/* Actions de modification JSON */}
      <div className="flex flex-col sm:flex-row items-center gap-3 w-full">
        <button
          onClick={handleCancelEdits}
          disabled={!isJsonModified}
          className={`w-full sm:w-auto h-10 px-4 border font-bold text-xs rounded-xl shadow-xs transition flex items-center justify-center gap-1.5 ${
            isJsonModified
              ? 'bg-rose-50 border-rose-200 hover:bg-rose-100 text-rose-700 cursor-pointer'
              : 'bg-rose-50/50 border-rose-100 text-rose-400 cursor-not-allowed opacity-50'
          }`}
          title="Annuler les modifications et recharger les données d'origine"
        >
          <RotateCcw
            className={`w-4 h-4 ${isJsonModified ? 'text-rose-600' : 'text-rose-400'}`}
          />
          <span>Annuler</span>
        </button>

        <button
          onClick={handleSaveJSON}
          disabled={!isJsonModified}
          className={`w-full sm:w-auto h-10 px-4 border font-bold text-xs rounded-xl shadow-xs transition flex items-center justify-center gap-1.5 ${
            isJsonModified
              ? 'bg-emerald-50 border-emerald-200 hover:bg-emerald-100 text-emerald-700 cursor-pointer'
              : 'bg-emerald-50/50 border-emerald-100 text-emerald-400 cursor-not-allowed opacity-50'
          }`}
          title="Sauvegarder et appliquer définitivement le JSON"
        >
          <Check
            className={`w-4 h-4 ${isJsonModified ? 'text-emerald-600' : 'text-emerald-400'}`}
          />
          <span>Enregistrer</span>
        </button>
      </div>

      <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-500 leading-relaxed max-w-full">
        <span className="font-bold text-slate-700">Notice de sauvegarde :</span> Vous pouvez
        copier cette structure JSON pour conserver une sauvegarde externe de sécurité ou
        modifier directement les champs des éléments. Veillez à respecter les correspondances
        de clés ID pour ne pas rompre la cohérence relationnelle.
      </div>
    </div>
  );
}
