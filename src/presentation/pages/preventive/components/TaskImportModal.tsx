// src/presentation/pages/preventive/components/TaskImportModal.jsx
import { useState } from 'react';
import { Upload, FileText, CheckCircle2, AlertTriangle, X } from 'lucide-react';
import PreventiveService from '../../../../application/services/PreventiveService';

export default function TaskImportModal({ isOpen, onClose, onImportSuccess }) {
  const [rawText, setRawText] = useState('');
  const [error, setError] = useState(null);
  const [statusMsg, setStatusMsg] = useState(null);
  const [mode, setMode] = useState('append'); // 'append' | 'replace'

  if (!isOpen) return null;

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result;
      if (typeof content === 'string') {
        setRawText(content);
        setError(null);
      }
    };
    reader.readAsText(file);
  };

  const handleProcessImport = () => {
    try {
      setError(null);
      let parsed = null;
      let text = rawText.trim();

      // If user pasted JS format (e.g., export const PART_TASKS = [...] or [...])
      if (text.includes('=')) {
        text = text.substring(text.indexOf('=') + 1).trim();
      }
      if (text.endsWith(';')) {
        text = text.slice(0, -1).trim();
      }

      parsed = JSON.parse(text);

      if (!Array.isArray(parsed)) {
        throw new Error("Le contenu doit être un tableau JSON de tâches valide [...]");
      }

      if (parsed.length === 0) {
        throw new Error("Le tableau est vide.");
      }

      const updated = PreventiveService.bulkImportTasks(parsed, mode === 'replace');
      setStatusMsg(`Succès ! ${parsed.length} tâches importées avec succès.`);
      setTimeout(() => {
        onImportSuccess(updated);
        onClose();
      }, 1200);
    } catch (err) {
      setError(err.message || "Erreur de format JSON. Vérifiez la syntaxe.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">
                استيراد مهام الصيانة الوقائية (Import Tâches)
              </h3>
              <p className="text-xs text-slate-500">
                Collez un tableau JSON ou sélectionnez un fichier .json / .js
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          {/* File Upload zone */}
          <div className="border-2 border-dashed border-slate-200 hover:border-indigo-400 rounded-xl p-4 text-center transition cursor-pointer bg-slate-50/50 hover:bg-indigo-50/30 relative">
            <input
              type="file"
              accept=".json,.js,.txt"
              onChange={handleFileUpload}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <FileText className="w-8 h-8 mx-auto text-indigo-500 mb-1.5" />
            <p className="text-xs font-semibold text-slate-700">
              Cliquez pour charger un fichier (JSON ou JS) ou glissez-déposez ici
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">Formats acceptés : .json, .js, .txt</p>
          </div>

          {/* Mode Selection */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-100/70 border border-slate-200 text-xs">
            <span className="font-semibold text-slate-700">Mode d'importation :</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setMode('append')}
                className={`px-3 py-1.5 rounded-lg font-medium transition ${
                  mode === 'append'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-white text-slate-600 hover:bg-slate-200'
                }`}
              >
                Fusionner / Ajouter (Recommandé)
              </button>
              <button
                type="button"
                onClick={() => setMode('replace')}
                className={`px-3 py-1.5 rounded-lg font-medium transition ${
                  mode === 'replace'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-white text-slate-600 hover:bg-slate-200'
                }`}
              >
                Écraser tout (Remplacer)
              </button>
            </div>
          </div>

          {/* Text Area */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Ou collez directement le JSON des tâches :
            </label>
            <textarea
              rows={8}
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="[ { id: '...', nom_machine: '...', frequence: '...', ... } ]"
              className="w-full p-3 font-mono text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 bg-slate-50 focus:bg-white transition"
            />
          </div>

          {/* Feedback */}
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {statusMsg && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{statusMsg}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200/70 rounded-xl transition"
          >
            Annuler
          </button>
          <button
            onClick={handleProcessImport}
            disabled={!rawText.trim()}
            className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow-md transition"
          >
            Valider et Importer
          </button>
        </div>
      </div>
    </div>
  );
}
