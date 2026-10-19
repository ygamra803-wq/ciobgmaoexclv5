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
}) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-500 shrink-0" />
            Audit & vérification des données (Appairage)
          </h3>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
            Détection automatique des éléments (machines, zones, utilisateurs) présents dans l'historique mais manquants dans les fiches officielles.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative">
            <select
              value={auditTarget}
              onChange={(e) => setAuditTarget(e.target.value)}
              className="appearance-none bg-white border border-slate-300 rounded-xl pl-4 pr-10 py-2 text-xs font-bold text-slate-700 shadow-sm focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200 transition cursor-pointer"
            >
              <option value="machines">Machines (Parc)</option>
              <option value="articles">Articles & PDR (Stock)</option>
              <option value="zones">Zones (Emplacements)</option>
              <option value="utilisateurs">Utilisateurs (Membres & Techs)</option>
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
                className="w-full lg:w-auto px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
              >
                <CheckCircle2 className="w-4 h-4" />
                Enregistrer les {getAuditLabel()} ({discoveredItems.length})
              </button>
            )}
        </div>
      </div>

      {discoveredItems.length === 0 ? (
        <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-100 space-y-2 max-w-full">
          <Check className="w-8 h-8 text-emerald-500 mx-auto bg-emerald-50 p-1.5 rounded-full" />
          <h4 className="text-sm font-bold text-slate-900">
            Tout est parfaitement apparié !
          </h4>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Aucun identifiant ou nom de {getAuditLabel().toLowerCase()} manquant n'a été détecté dans les historiques. Vos analyses sont pleinement fiables.
          </p>
        </div>
      ) : (
        <div className="space-y-4 w-full max-w-full overflow-hidden">
          <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/40 text-xs text-amber-800 flex items-start gap-2.5 leading-relaxed">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Écart de base détecté :</span> Certains éléments de type "{getAuditLabel()}" apparaissent dans vos mouvements mais ne figurent pas dans la liste officielle.
              {auditTarget === 'machines' ||
              auditTarget === 'articles' ||
              auditTarget === 'utilisateurs'
                ? " Cliquez sur 'Enregistrer les " +
                  getAuditLabel() +
                  "' pour une inscription automatique, ou utilisez 'Rattacher' pour corriger une clé erronée."
                : " Cliquez sur Rattacher pour relier ces occurrences à un élément officiel existant, ou sur Enregistrer pour créer la fiche."}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-[0_12px_32px_-6px_rgba(0,0,0,0.12),0_4px_12px_-2px_rgba(0,0,0,0.06)] hover:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.16),0_6px_16px_-3px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-300 ease-out overflow-hidden max-w-full">
            <div className="max-h-[62vh] overflow-y-auto overflow-x-auto">
              <table className="min-w-[650px] w-full text-left text-xs whitespace-nowrap border-collapse">
                <thead className="bg-slate-100/90 text-[11px] font-bold text-slate-700 uppercase tracking-wider border-b border-slate-200 select-none">
                  <tr>
                    <th className="py-2.5 px-3 text-center w-12 text-slate-500 font-mono text-[10px] bg-slate-200/50 border-r border-slate-200 shrink-0">
                      N°
                    </th>
                    <th className="p-3">Élément / Utilisateur détecté</th>
                    <th className="p-3">Occurrences & Sources</th>
                    <th className="p-3">Action / ID proposé</th>
                    <th className="p-3 text-right">Action manuelle</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {auditDisplayedItems.map((dm, index) => {
                    if (dm.__isEmptyPlaceholder) {
                      return (
                        <tr key={dm.code} className="h-10 border-b border-slate-100 bg-slate-50/30 text-slate-300 select-none">
                          <td className="py-2.5 px-3 text-center text-[10px] font-mono border-r border-slate-100">
                            —
                          </td>
                          <td className="py-2.5 px-3">—</td>
                          <td className="py-2.5 px-3">—</td>
                          <td className="py-2.5 px-3">—</td>
                          <td className="py-2.5 px-3 text-right">—</td>
                        </tr>
                      );
                    }

                    const rowIndex = auditStartIndex + index + 1;
                    const proposedId =
                      auditTarget === 'utilisateurs'
                        ? getNextUserId(dm.inferredRole || 'TECHNICIEN')
                        : null;

                    return (
                      <tr
                        key={dm.code}
                        className="hover:bg-slate-50/80 transition text-slate-700 border-b border-slate-100"
                      >
                        <td className="py-2.5 px-3 text-center font-mono text-[10.5px] font-bold text-slate-600 bg-slate-50/50 border-r border-slate-200/60 select-none">
                          {rowIndex}
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-slate-900 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200">
                              {dm.code}
                            </span>
                            {auditTarget === 'utilisateurs' && (
                              <span
                                className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                                  dm.inferredRole === 'CHEF'
                                    ? 'bg-amber-50 text-amber-800 border-amber-200'
                                    : dm.inferredRole === 'OPERATEUR'
                                      ? 'bg-indigo-50 text-indigo-800 border-indigo-200'
                                      : 'bg-cyan-50 text-cyan-800 border-cyan-200'
                                }`}
                              >
                                {dm.inferredRole}
                              </span>
                            )}
                            {auditTarget === 'articles' && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold border bg-teal-50 text-teal-800 border-teal-200">
                                PDR Stock
                              </span>
                            )}
                            {(auditTarget === 'correctif' || auditTarget === 'preventif') && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold border bg-rose-50 text-rose-800 border-rose-200">
                                Liaison orpheline
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-3 text-slate-600 font-mono">
                          <div className="font-bold text-slate-800">
                            {dm.count} apparition{dm.count > 1 ? 's' : ''}
                          </div>
                          {dm.sourceList && (
                            <div className="text-[10px] text-slate-400 font-sans">
                              {dm.sourceList}
                            </div>
                          )}
                        </td>
                        <td className="p-3">
                          {auditTarget === 'utilisateurs' ? (
                            <span className="text-[11px] font-mono font-bold bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded-md border border-emerald-200">
                              ➔ {proposedId}
                            </span>
                          ) : (
                            <span className="text-[10px] bg-cyan-50 text-cyan-800 px-2 py-0.5 rounded-full border border-cyan-200">
                              Créer la fiche ({getAuditLabel()})
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
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
                              className="px-2.5 py-1 text-[11px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition cursor-pointer flex items-center gap-1 shrink-0"
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
                                    setMachines((prev) => [
                                      ...prev,
                                      {
                                        id_machine_registered: dm.code,
                                        designation: `Machine Auto-Détectée ${dm.code}`,
                                        id_family: families[0]?.id_family || 'FAM-EMB',
                                        id_templates: templates[0]?.id_templates || 'TPL-RCF100',
                                        id_zone_default: zones[0]?.id_zone || 'ZONE-DET',
                                        technician: technicians[0]?.nom || 'Technicien',
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
                              className="px-3 py-1 text-[11px] font-extrabold text-cyan-700 bg-cyan-50 hover:bg-cyan-100 rounded-lg transition cursor-pointer shrink-0"
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
            <div className="bg-slate-50/70 p-4 border-t border-slate-200 flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-slate-600">Lignes par page :</span>
                <div className="flex bg-slate-200/70 rounded-lg p-0.5 border border-slate-300/60">
                  {[25, 50, 100, 200, 0].map((size) => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => {
                        setAuditPageSize(size);
                        setAuditCurrentPage(1);
                      }}
                      className={`px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                        auditPageSize === size
                          ? 'bg-white text-teal-800 shadow-xs border border-slate-200/50'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
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
                      onClick={() => setAuditCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={auditCurrentPage === 1}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-semibold transition cursor-pointer shadow-2xs"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                      Précédent
                    </button>

                    <span className="px-2 font-mono text-xs font-bold text-slate-600">
                      Page {auditCurrentPage} sur {auditTotalPages}
                    </span>

                    <button
                      type="button"
                      onClick={() => setAuditCurrentPage((p) => Math.min(auditTotalPages, p + 1))}
                      disabled={auditCurrentPage === auditTotalPages}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-semibold transition cursor-pointer shadow-2xs"
                    >
                      Suivant
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
