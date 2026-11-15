import {
  FileSpreadsheet,
  ChevronDown,
  Lock,
  AlertTriangle,
  Download,
} from 'lucide-react';
import { SettingsSectionCard, SETTINGS_BUTTON_STYLES } from './settingsUi';

/**
 * Raw JSON Database Inspector (Read-Only SSOT View + Type B External Export — INGEST-GOV-P9).
 */
export default function SettingsJsonEditorTab({
  jsonTarget,
  setJsonTarget,
  jsonText,
  jsonContent,
  handleDownloadJSON,
}: any) {
  const effectiveText = jsonText !== undefined ? jsonText : (jsonContent ?? '');

  return (
    <div className="space-y-6">
      <SettingsSectionCard
        tone="warning"
        title="Inspecteur JSON SSOT (Lecture Seule & Export Type B)"
        description="Consultation technique des collections stockées dans DataGateway. L'écriture JSON brute est désactivée : utilisez Mode B (Type A) pour les catalogues/actifs, Centre de Sauvegarde pour les snapshots, ou les écrans opérationnels pour les transactions."
        icon={<FileSpreadsheet />}
        headerRight={
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <select
                value={jsonTarget}
                onChange={(e) => setJsonTarget(e.target.value)}
                className="appearance-none bg-white border border-slate-200 rounded-xl pl-3.5 pr-9 py-2 text-xs font-bold text-slate-800 shadow-2xs focus:outline-none focus:border-sky-600 focus:ring-2 focus:ring-sky-100 transition cursor-pointer"
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
                title="Export externe Type B (.json — consultation uniquement, non réimportable via UnifiedImportPipeline)"
              >
                <Download className="w-4 h-4 text-slate-500" />
                <span>Exporter .json (Type B)</span>
              </button>
            )}
          </div>
        }
      >
        <div className="space-y-4">
          <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200/80 text-xs text-amber-900 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Gouvernance INGEST-GOV-P9 :</span> L&apos;édition JSON directe de la base est verrouillée en lecture seule afin de préserver les clés étrangères, l&apos;invariant stock (<code className="font-mono">StockCalculationService</code>) et la piste d&apos;audit. Pour importer ou mettre à jour des référentiels/machines, utilisez l&apos;onglet <b>Injection &amp; Mode Démo ➔ Mode B (Type A)</b>.
            </div>
          </div>

          {jsonTarget === 'users' && (
            <div className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-2xl text-slate-900 text-xs font-bold flex items-center gap-2">
              <Lock className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                Sécurité : Les comptes et mots de passe sont chiffrés dans le coffre-fort AES-256 (onglet{' '}
                <b>Sécurité &amp; Comptes</b>). Cet aperçu est en lecture seule.
              </span>
            </div>
          )}

          <div className="rounded-2xl border border-slate-200 overflow-hidden bg-white shadow-xs">
            <div className="bg-slate-50/80 px-4 py-2.5 border-b border-slate-200/80 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-700">Collection Active :</span>
                <span className="px-2.5 py-0.5 rounded-full bg-white border border-slate-200 text-xs font-mono font-bold text-sky-800">
                  {jsonTarget}.json
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-700">
                <Lock className="w-3.5 h-3.5 text-amber-600" />
                <span>Lecture seule (SSOT verrouillé)</span>
              </div>
            </div>
            <textarea
              value={effectiveText}
              readOnly={true}
              spellCheck={false}
              className="w-full h-[460px] p-4 bg-slate-50/40 text-slate-800 font-mono text-xs leading-relaxed focus:outline-none resize-y opacity-90 cursor-default"
            />
          </div>
        </div>
      </SettingsSectionCard>
    </div>
  );
}
