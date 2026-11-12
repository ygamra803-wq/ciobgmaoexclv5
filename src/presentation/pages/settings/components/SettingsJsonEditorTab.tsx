import {
  FileSpreadsheet,
  Save,
  ChevronDown,
  Lock,
  CheckCircle2,
  AlertTriangle,
  Download,
  RotateCcw,
} from 'lucide-react';
import { SettingsSectionCard, SETTINGS_BUTTON_STYLES } from './settingsUi';

/**
 * Raw JSON Database Inspector & Editor Tab.
 * Styled as a clean industrial code inspector inside a warning-toned SettingsSectionCard.
 */
export default function SettingsJsonEditorTab({
  jsonTarget,
  setJsonTarget,
  jsonText,
  setJsonText,
  jsonContent,
  setJsonContent,
  jsonError,
  setJsonError,
  handleSaveJSON,
  handleDownloadJSON,
  handleCancelEdits,
  isJsonModified,
}: any) {
  const effectiveText = jsonText !== undefined ? jsonText : (jsonContent ?? '');
  const handleChangeText = (val: string) => {
    if (setJsonText) setJsonText(val);
    if (setJsonContent) setJsonContent(val);
    if (setJsonError) setJsonError(null);
  };

  return (
    <div className="space-y-6">
      <SettingsSectionCard
        tone="warning"
        title="Inspecteur & Éditeur JSON Brut (Maintenance Avancée SSOT)"
        description="Outil d'inspection et de correction directe des collections JSON stockées dans le magasin central. Toute écriture met à jour immédiatement la source de vérité (DataGateway)."
        icon={<FileSpreadsheet className="w-4 h-4" />}
        headerRight={
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <select
                value={jsonTarget}
                onChange={(e) => setJsonTarget(e.target.value)}
                className="appearance-none bg-white border border-slate-300 rounded-xl pl-3.5 pr-9 py-2 text-xs font-bold text-slate-800 shadow-2xs focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 transition cursor-pointer"
              >
                <optgroup label="1. Stock PDR & Mouvements">
                  <option value="rawStock">Articles &amp; Stock PDR (rawStock)</option>
                  <option value="mouvements">Journal des Mouvements (mouvements)</option>
                  <option value="types">Catégories &amp; Types PDR (types)</option>
                </optgroup>
                <optgroup label="2. Entrepôt & Nexus BOM">
                  <option value="warehouseItems">Articles Entrepôt (warehouseItems)</option>
                  <option value="machineElementsLedger">
                    Registre Organes Montés (machineElementsLedger)
                  </option>
                  <option value="sortiesExterne">Sorties Externes Atelier (sortiesExterne)</option>
                </optgroup>
                <optgroup label="3. Parc Machines & Architecture">
                  <option value="machines">Machines Enregistrées (machines)</option>
                  <option value="families">Familles d&apos;Équipements (families)</option>
                  <option value="templates">Modèles Constructeurs (templates)</option>
                  <option value="zones">Zones &amp; Ateliers (zones)</option>
                </optgroup>
                <optgroup label="4. Maintenance & Équipe">
                  <option value="preventiveTasks">Planning Préventif (preventiveTasks)</option>
                  <option value="correctiveInterventions">
                    Bons de Travail Correctifs (correctiveInterventions)
                  </option>
                  <option value="technicians">Techniciens &amp; Équipe (technicians)</option>
                  <option value="operations">Catalogue Opérations (operations)</option>
                </optgroup>
                <optgroup label="5. Système (Lecture Seule)">
                  <option value="users">Comptes Portail (Lecture seule)</option>
                </optgroup>
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-2.5 pointer-events-none" />
            </div>

            {handleDownloadJSON && (
              <button
                type="button"
                onClick={handleDownloadJSON}
                className={SETTINGS_BUTTON_STYLES.secondary}
                title="Télécharger cette collection au format .json"
              >
                <Download className="w-4 h-4 text-slate-600" />
                <span>Exporter .json</span>
              </button>
            )}

            {isJsonModified && handleCancelEdits && (
              <button
                type="button"
                onClick={handleCancelEdits}
                className={SETTINGS_BUTTON_STYLES.secondary}
              >
                <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                <span>Annuler</span>
              </button>
            )}

            {jsonTarget !== 'users' && (
              <button
                type="button"
                onClick={handleSaveJSON}
                className={SETTINGS_BUTTON_STYLES.primary}
              >
                <Save className="w-4 h-4" />
                <span>Appliquer et Sauvegarder JSON</span>
              </button>
            )}
          </div>
        }
      >
        <div className="space-y-4">
          <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200/90 text-xs text-amber-900 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Précaution d&apos;intégrité :</span> Modifiez uniquement les champs dont vous maîtrisez le schéma relationnel. Exportez un Snapshot JSON depuis la <b>Vue d&apos;ensemble</b> avant toute modification manuelle.
            </div>
          </div>

          {jsonError && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-mono font-bold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>Erreur de syntaxe JSON : {jsonError}</span>
            </div>
          )}

          {jsonTarget === 'users' && (
            <div className="p-3.5 bg-indigo-50 border border-indigo-200 rounded-xl text-indigo-900 text-xs font-bold flex items-center gap-2">
              <Lock className="w-4 h-4 text-indigo-600 shrink-0" />
              <span>
                Sécurité : Les comptes et mots de passe sont chiffrés dans le coffre-fort AES-256 (onglet{' '}
                <b>Sécurité &amp; Comptes</b>). Cet aperçu est en lecture seule.
              </span>
            </div>
          )}

          <div className="rounded-xl border border-slate-200 overflow-hidden bg-white shadow-2xs">
            <div className="bg-slate-100/90 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-700">Collection Active :</span>
                <span className="px-2 py-0.5 rounded bg-white border border-slate-200 text-xs font-mono font-bold text-indigo-700">
                  {jsonTarget}.json
                </span>
                {isJsonModified && (
                  <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200 text-[10px] font-bold">
                    Modifié (non sauvegardé)
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600">
                {jsonTarget === 'users' ? (
                  <>
                    <Lock className="w-3.5 h-3.5 text-amber-600" />
                    <span>Lecture seule</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Édition autorisée</span>
                  </>
                )}
              </div>
            </div>
            <textarea
              value={effectiveText}
              readOnly={jsonTarget === 'users'}
              onChange={(e) => {
                if (jsonTarget === 'users') return;
                handleChangeText(e.target.value);
              }}
              spellCheck={false}
              className={`w-full h-[460px] p-4 bg-slate-50 text-slate-800 font-mono text-xs leading-relaxed focus:outline-none focus:bg-white resize-y ${
                jsonTarget === 'users' ? 'opacity-75 cursor-not-allowed' : ''
              }`}
            />
          </div>
        </div>
      </SettingsSectionCard>
    </div>
  );
}
