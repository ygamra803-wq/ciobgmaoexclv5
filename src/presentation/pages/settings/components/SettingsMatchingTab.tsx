import {
  ShieldAlert,
  ChevronDown,
  CheckCircle2,
  Check,
  AlertTriangle,
  Link2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { SettingsSectionCard, SETTINGS_BUTTON_STYLES } from './settingsUi';

/**
 * Matching & Orphaned entity reconciliation table and actions.
 */
export default function SettingsMatchingTab({
  auditTarget,
  setAuditTarget,
  discoveredItems = [],
  handleRegisterDiscovered,
  getAuditLabel,
  auditDisplayedItems = [],
  auditStartIndex = 0,
  getNextUserId,
  setRelinkData,
  setShowRelinkModal,
  setMachines,
  families = [],
  templates = [],
  zones = [],
  technicians = [],
  showToast,
  setAuditArticleForm,
  types = [],
  setShowAuditArticleModal,
  setAuditZoneForm,
  setShowAuditZoneModal,
  setAuditUserForm,
  setShowAuditUserModal,
  auditPageSize,
  setAuditPageSize,
  setAuditCurrentPage,
  auditTotalItems = 0,
  rawAuditDisplayedData = [],
  auditTotalPages = 1,
  auditCurrentPage = 1,
}: any) {
  return (
    <SettingsSectionCard
      title="Audit & Vérification des Données (Appairage)"
      description="Détection automatique des éléments (machines, zones, utilisateurs, articles) présents dans l'historique mais manquants dans les fiches officielles."
      icon={<ShieldAlert />}
      headerRight={
        <div className="flex flex-col sm:flex-row items-center gap-2.5">
          <div className="relative">
            <select
              value={auditTarget}
              onChange={(e) => setAuditTarget(e.target.value)}
              className="appearance-none bg-white border border-slate-200 rounded-xl pl-3.5 pr-9 py-2 text-xs font-bold text-slate-800 shadow-2xs focus:outline-none focus:border-sky-600 focus:ring-2 focus:ring-sky-100 transition cursor-pointer"
            >
              <option value="machines">Machines (Parc)</option>
              <option value="articles">Articles &amp; PDR (Stock)</option>
              <option value="zones">Zones (Emplacements)</option>
              <option value="utilisateurs">Utilisateurs (Membres &amp; Techs)</option>
              <option value="correctif">Liaisons Correctif (Interventions)</option>
              <option value="preventif">Liaisons Préventif (Tâches)</option>
            </select>
            <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-2.5 pointer-events-none" />
          </div>
          {(auditTarget === 'machines' ||
            auditTarget === 'articles' ||
            auditTarget === 'utilisateurs') &&
            discoveredItems.length > 0 && (
              <button
                onClick={handleRegisterDiscovered}
                className={SETTINGS_BUTTON_STYLES.primary}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>
                  Enregistrer les {getAuditLabel()} ({discoveredItems.length})
                </span>
              </button>
            )}
        </div>
      }
    >
      {discoveredItems.length === 0 ? (
        <div className="p-8 text-center bg-slate-50/70 rounded-2xl border border-slate-200/80 space-y-2 max-w-full">
          <Check className="w-8 h-8 text-emerald-600 mx-auto" />
          <h4 className="text-sm font-extrabold text-slate-900">
            Tout est parfaitement apparié !
          </h4>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Aucun identifiant ou nom de {getAuditLabel().toLowerCase()} manquant n&apos;a été détecté dans les historiques. Vos analyses sont pleinement fiables.
          </p>
        </div>
      ) : (
        <div className="space-y-4 w-full max-w-full overflow-hidden">
          <div className="p-3.5 rounded-2xl border border-amber-200 bg-amber-50/50 text-xs text-amber-900 flex items-start gap-2.5 leading-relaxed">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Écart de base détecté :</span> Certains éléments de type &laquo; {getAuditLabel()} &raquo; apparaissent dans vos mouvements mais ne figurent pas dans la liste officielle.
              {auditTarget === 'machines' ||
              auditTarget === 'articles' ||
              auditTarget === 'utilisateurs'
                ? " Cliquez sur 'Enregistrer les " +
                  getAuditLabel() +
                  "' pour une inscription automatique, ou utilisez 'Rattacher' pour corriger une clé erronée."
                : ' Cliquez sur Rattacher pour relier ces occurrences à un élément officiel existant, ou sur Enregistrer pour créer la fiche.'}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden max-w-full">
            <div className="max-h-[60vh] overflow-y-auto overflow-x-auto">
              <table className="min-w-[650px] w-full text-left text-xs whitespace-nowrap border-collapse">
                <thead className="bg-slate-50 text-[11px] font-bold text-slate-700 uppercase tracking-wider border-b border-slate-200 select-none">
                  <tr>
                    <th className="py-2.5 px-3 text-center w-12 text-slate-500 font-mono text-[10px] shrink-0">
                      N°
                    </th>
                    <th className="px-3.5 py-2.5">Élément / Utilisateur détecté</th>
                    <th className="px-3.5 py-2.5">Occurrences &amp; Sources</th>
                    <th className="px-3.5 py-2.5">Action / ID proposé</th>
                    <th className="px-3.5 py-2.5 text-right">Action manuelle</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {auditDisplayedItems.map((dm: any, index: number) => {
                    const rowIndex = auditStartIndex + index + 1;
                    const proposedId =
                      auditTarget === 'utilisateurs'
                        ? getNextUserId(dm.inferredRole || 'TECHNICIEN')
                        : null;

                    return (
                      <tr
                        key={dm.code}
                        className="hover:bg-slate-50/80 transition text-slate-700"
                      >
                        <td className="py-2.5 px-3 text-center font-mono text-[10.5px] font-bold text-slate-500 bg-slate-50/40 select-none">
                          {rowIndex}
                        </td>
                        <td className="px-3.5 py-2.5">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-slate-900 bg-slate-100 px-2.5 py-0.5 rounded-lg border border-slate-200">
                              {dm.code}
                            </span>
                            {auditTarget === 'utilisateurs' && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold border bg-slate-100 text-slate-700 border-slate-200">
                                {dm.inferredRole}
                              </span>
                            )}
                            {auditTarget === 'articles' && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold border bg-slate-100 text-slate-700 border-slate-200">
                                PDR Stock
                              </span>
                            )}
                            {(auditTarget === 'correctif' || auditTarget === 'preventif') && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold border bg-amber-50 text-amber-800 border-amber-200">
                                Liaison orpheline
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3.5 py-2.5 text-slate-600 font-mono">
                          <div className="font-bold text-slate-800">
                            {dm.count} apparition{dm.count > 1 ? 's' : ''}
                          </div>
                          {dm.sourceList && (
                            <div className="text-[10px] text-slate-400 font-sans">
                              {dm.sourceList}
                            </div>
                          )}
                        </td>
                        <td className="px-3.5 py-2.5">
                          {auditTarget === 'utilisateurs' ? (
                            <span className="text-[11px] font-mono font-bold bg-emerald-50 text-emerald-800 px-2.5 py-0.5 rounded-full border border-emerald-200">
                              ➔ {proposedId}
                            </span>
                          ) : (
                            <span className="text-[10px] font-semibold bg-emerald-50 text-emerald-800 px-2.5 py-0.5 rounded-full border border-emerald-200">
                              Créer la fiche ({getAuditLabel()})
                            </span>
                          )}
                        </td>
                        <td className="px-3.5 py-2.5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => {
                                setRelinkData({
                                  entityType:
                                    dm.entityType ||
                                    (auditTarget === 'utilisateurs'
                                      ? 'user'
                                      : auditTarget === 'articles'
                                        ? 'article'
                                        : auditTarget === 'zones'
                                          ? 'zone'
                                          : 'machine'),
                                  oldKey: dm.code,
                                  targetKey: '',
                                  occurrencesCount: dm.count,
                                });
                                setShowRelinkModal(true);
                              }}
                              className={SETTINGS_BUTTON_STYLES.secondary}
                              title="Rattacher et corriger les occurrences vers un élément existant"
                            >
                              <Link2 className="w-3 h-3" />
                              <span>Rattacher</span>
                            </button>
                            <button
                              onClick={() => {
                                if (
                                  auditTarget === 'machines' ||
                                  auditTarget === 'correctif' ||
                                  auditTarget === 'preventif'
                                ) {
                                  if (setMachines) {
                                    setMachines((prev: any[]) => [
                                      ...prev,
                                      {
                                        id_machine_registered: dm.code,
                                        designation: `Machine Auto-Détectée ${dm.code}`,
                                        id_family: families[0]?.id_family || '',
                                        id_templates: templates[0]?.id_templates || '',
                                        id_zone_default: zones[0]?.id_zone || '',
                                        technician: technicians[0]?.nom || '',
                                        status: 'En service',
                                      },
                                    ]);
                                  }
                                  showToast?.(
                                    `Machine "${dm.code}" ajoutée avec succès.`,
                                    'success'
                                  );
                                } else if (auditTarget === 'articles') {
                                  setAuditArticleForm({
                                    ref: dm.code,
                                    designation: `Pièce PDR ${dm.code}`,
                                    type: types[0]?.id_type || 'MECANIQUE',
                                    emplacement: 'Magasin PDR',
                                    stockInitial: 0,
                                    seuil: 5,
                                  });
                                  setShowAuditArticleModal(true);
                                } else if (auditTarget === 'zones') {
                                  setAuditZoneForm({ libelle: dm.code });
                                  setShowAuditZoneModal(true);
                                } else if (auditTarget === 'utilisateurs') {
                                  setAuditUserForm({
                                    type: dm.inferredRole || 'TECHNICIEN',
                                    nom: dm.code,
                                    id_zone: zones[0]?.id_zone || '',
                                    specialite:
                                      dm.inferredRole === 'TECHNICIEN'
                                        ? 'GMAO & Maintenance'
                                        : '',
                                  });
                                  setShowAuditUserModal(true);
                                }
                              }}
                              className={SETTINGS_BUTTON_STYLES.primary}
                            >
                              Enregistrer
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Table Footer Card with Page Size Selector & Pagination */}
            <div className="bg-slate-50/70 px-4 py-3 border-t border-slate-100 flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-slate-600">Lignes par page :</span>
                <div className="flex items-center gap-1 bg-slate-100/90 rounded-xl p-1 border border-slate-200/90">
                  {[25, 50, 100, 200, 0].map((size) => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => {
                        setAuditPageSize(size);
                        setAuditCurrentPage(1);
                      }}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all duration-150 cursor-pointer border ${
                        auditPageSize === size
                          ? 'bg-white text-slate-950 border-slate-200 shadow-2xs'
                          : 'bg-transparent text-slate-600 hover:text-slate-900 hover:bg-white/60 border-transparent'
                      }`}
                    >
                      {size === 0 ? 'Tout' : size}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-xs font-semibold text-slate-500">
                  Affichage <b className="text-slate-900">{auditTotalItems === 0 ? 0 : auditStartIndex + 1}</b> à{' '}
                  <b className="text-slate-900">
                    {Math.min(auditStartIndex + rawAuditDisplayedData.length, auditTotalItems)}
                  </b>{' '}
                  sur <b className="text-slate-900">{auditTotalItems}</b>
                </div>

                {auditPageSize !== 0 && auditTotalPages > 1 && (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setAuditCurrentPage((p: number) => Math.max(1, p - 1))}
                      disabled={auditCurrentPage === 1}
                      className={SETTINGS_BUTTON_STYLES.secondary}
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                      <span>Précédent</span>
                    </button>

                    <span className="px-2 font-mono text-xs font-bold text-slate-600">
                      Page {auditCurrentPage} sur {auditTotalPages}
                    </span>

                    <button
                      type="button"
                      onClick={() => setAuditCurrentPage((p: number) => Math.min(auditTotalPages, p + 1))}
                      disabled={auditCurrentPage === auditTotalPages}
                      className={SETTINGS_BUTTON_STYLES.secondary}
                    >
                      <span>Suivant</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </SettingsSectionCard>
  );
}
