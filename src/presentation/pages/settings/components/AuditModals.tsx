import { Users, Package, Link2 } from 'lucide-react';

/**
 * Modals for Settings Audit: Zone, User, Article, and Relink modals.
 */
export function AuditZoneModal({
  isOpen,
  onClose,
  auditZoneForm,
  setAuditZoneForm,
  getNextZoneId,
  setZones,
  showToast,
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="text-sm font-bold text-slate-900">
            Fiche d'enregistrement de Zone
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 font-bold text-lg cursor-pointer"
          >
            ×
          </button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1">
              Nom de la Zone / Atelier
            </label>
            <input
              type="text"
              value={auditZoneForm.libelle}
              onChange={(e) =>
                setAuditZoneForm((prev) => ({ ...prev, libelle: e.target.value }))
              }
              className="w-full text-xs font-medium border border-slate-300 rounded-lg p-2"
              placeholder="ex: Atelier Conditionnement"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-800 font-bold cursor-pointer"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={() => {
              if (!auditZoneForm.libelle.trim()) {
                showToast?.('Veuillez saisir un nom de zone valide.', 'error');
                return;
              }

              const id = getNextZoneId();
              const newZone = {
                id_zone: id,
                libelle: auditZoneForm.libelle.trim(),
                nom: auditZoneForm.libelle.trim(),
                description: '',
              };
              setZones((prev) => [...prev, newZone]);
              showToast?.(
                `Zone "${auditZoneForm.libelle.trim()}" enregistrée avec l'ID ${id}.`,
                'success'
              );
              onClose();
            }}
            className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-xs rounded-lg shadow-sm transition cursor-pointer"
          >
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
}

export function AuditUserModal({
  isOpen,
  onClose,
  auditUserForm,
  setAuditUserForm,
  getNextUserId,
  zones = [],
  setTechnicians,
  setOperations,
  showToast,
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-cyan-50 border border-cyan-200 text-cyan-700 flex items-center justify-center font-bold">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Fiche d'enregistrement d'utilisateur
              </h3>
              <p className="text-[11px] text-slate-500">
                Audit GMAO & Sécurisation des Identifiants
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 font-bold text-lg cursor-pointer"
          >
            ×
          </button>
        </div>

        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-600">
              ID Sécurisé généré :
            </span>
            <span className="font-mono font-extrabold text-xs bg-slate-900 text-white px-2.5 py-0.5 rounded-md">
              {getNextUserId(auditUserForm.type)}
            </span>
          </div>
          <p className="text-[10px] text-slate-500 leading-tight">
            🔒 L'ID est unique et séquentiel. Il garantit la traçabilité intégrale des mouvements d'ateliers même si le nom est corrigé ultérieurement.
          </p>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">
              Profil / Type d'utilisateur
            </label>
            <select
              value={auditUserForm.type}
              onChange={(e) =>
                setAuditUserForm((prev) => ({ ...prev, type: e.target.value }))
              }
              className="w-full text-xs font-semibold border border-slate-300 rounded-lg p-2 bg-white text-slate-800"
            >
              <option value="TECHNICIEN">Technicien (Maintenance / GMAO)</option>
              <option value="OPERATEUR">Opérateur (Production)</option>
              <option value="CHEF">Chef d'équipe / Superviseur</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">
              Nom complet
            </label>
            <input
              type="text"
              value={auditUserForm.nom}
              onChange={(e) =>
                setAuditUserForm((prev) => ({ ...prev, nom: e.target.value }))
              }
              className="w-full text-xs font-semibold border border-slate-300 rounded-lg p-2 text-slate-800"
              placeholder="Nom de l'utilisateur"
            />
          </div>

          {auditUserForm.type === 'TECHNICIEN' ? (
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Spécialité
              </label>
              <input
                type="text"
                value={auditUserForm.specialite}
                onChange={(e) =>
                  setAuditUserForm((prev) => ({ ...prev, specialite: e.target.value }))
                }
                className="w-full text-xs font-semibold border border-slate-300 rounded-lg p-2 text-slate-800"
                placeholder="Spécialité du technicien (ex: Mécanique, Électricité)"
              />
            </div>
          ) : (
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Zone d'affectation
              </label>
              <select
                value={auditUserForm.id_zone}
                onChange={(e) =>
                  setAuditUserForm((prev) => ({ ...prev, id_zone: e.target.value }))
                }
                className="w-full text-xs font-semibold border border-slate-300 rounded-lg p-2 bg-white text-slate-800"
              >
                <option value="">Sélectionner une zone</option>
                {zones.map((z) => (
                  <option key={z.id_zone} value={z.id_zone}>
                    {z.libelle || z.nom}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 text-xs text-slate-600 hover:text-slate-800 font-semibold cursor-pointer"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={() => {
              if (!auditUserForm.nom.trim()) {
                showToast?.('Veuillez saisir un nom valide.', 'error');
                return;
              }

              const type = auditUserForm.type;
              const id = getNextUserId(type);

              if (type === 'TECHNICIEN') {
                const newTech = {
                  id_technician: id,
                  nom: auditUserForm.nom.trim(),
                  specialite: auditUserForm.specialite.trim() || 'Générale',
                  contact: '',
                  avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(
                    auditUserForm.nom.trim()
                  )}`,
                };
                setTechnicians((prev) => [...prev, newTech]);
              } else {
                const newOp = {
                  id_operation: id,
                  nom: auditUserForm.nom.trim(),
                  id_zone: auditUserForm.id_zone || zones[0]?.id_zone || 'ZONE-DET',
                  type_profil: type,
                  avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(
                    auditUserForm.nom.trim()
                  )}`,
                };
                setOperations((prev) => [...prev, newOp]);
              }

              showToast?.(
                `Utilisateur "${auditUserForm.nom.trim()}" enregistré avec l'ID ${id}.`,
                'success'
              );
              onClose();
            }}
            className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-xs rounded-lg shadow-xs transition cursor-pointer"
          >
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
}

export function AuditArticleModal({
  isOpen,
  onClose,
  auditArticleForm,
  setAuditArticleForm,
  types = [],
  setRawStock,
  rawStock = [],
  storageService,
  showToast,
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-teal-50 border border-teal-200 text-teal-700 flex items-center justify-center font-bold">
              <Package className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Fiche d'enregistrement Pièce PDR
              </h3>
              <p className="text-[11px] text-slate-500">
                Inscription officielle au Référentiel Stock Articles
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 font-bold text-lg cursor-pointer"
          >
            ×
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">
              Référence PDR (Code Article)
            </label>
            <input
              type="text"
              value={auditArticleForm.ref}
              onChange={(e) =>
                setAuditArticleForm((p) => ({ ...p, ref: e.target.value }))
              }
              className="w-full text-xs font-mono font-bold border border-slate-300 rounded-lg p-2 text-slate-800 bg-slate-50"
              readOnly
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">
              Désignation de la pièce
            </label>
            <input
              type="text"
              value={auditArticleForm.designation}
              onChange={(e) =>
                setAuditArticleForm((p) => ({ ...p, designation: e.target.value }))
              }
              className="w-full text-xs font-semibold border border-slate-300 rounded-lg p-2 text-slate-800"
              placeholder="ex: Roulement à billes 6204-2RS"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Famille / Type
              </label>
              <select
                value={auditArticleForm.type}
                onChange={(e) =>
                  setAuditArticleForm((p) => ({ ...p, type: e.target.value }))
                }
                className="w-full text-xs font-semibold border border-slate-300 rounded-lg p-2 bg-white text-slate-800"
              >
                {(types || []).map((t) => (
                  <option key={t.id_type || t} value={t.id_type || t}>
                    {t.libelle || t.nom || t.id_type || t}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Emplacement
              </label>
              <input
                type="text"
                value={auditArticleForm.emplacement}
                onChange={(e) =>
                  setAuditArticleForm((p) => ({ ...p, emplacement: e.target.value }))
                }
                className="w-full text-xs font-medium border border-slate-300 rounded-lg p-2 text-slate-800"
                placeholder="ex: Magasin PDR"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Stock Initial
              </label>
              <input
                type="number"
                min="0"
                value={auditArticleForm.stockInitial}
                onChange={(e) =>
                  setAuditArticleForm((p) => ({
                    ...p,
                    stockInitial: Number(e.target.value) || 0,
                  }))
                }
                className="w-full text-xs font-mono font-medium border border-slate-300 rounded-lg p-2 text-slate-800"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Seuil d'Alerte
              </label>
              <input
                type="number"
                min="0"
                value={auditArticleForm.seuil}
                onChange={(e) =>
                  setAuditArticleForm((p) => ({
                    ...p,
                    seuil: Number(e.target.value) || 0,
                  }))
                }
                className="w-full text-xs font-mono font-medium border border-slate-300 rounded-lg p-2 text-slate-800"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 text-xs text-slate-600 hover:text-slate-800 font-semibold cursor-pointer"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={() => {
              if (!auditArticleForm.ref.trim() || !auditArticleForm.designation.trim()) {
                showToast?.('Veuillez renseigner la référence et la désignation.', 'error');
                return;
              }
              const newArticle = {
                ref: auditArticleForm.ref.trim(),
                designation: auditArticleForm.designation.trim(),
                type: auditArticleForm.type || types[0]?.id_type || 'MECANIQUE',
                emplacement: auditArticleForm.emplacement || 'Magasin PDR',
                stockInitial: Number(auditArticleForm.stockInitial) || 0,
                stockActuel: Number(auditArticleForm.stockInitial) || 0,
                seuil: Number(auditArticleForm.seuil) || 5,
              };
              if (setRawStock) {
                setRawStock((prev) => [...prev, newArticle]);
              }
              if (storageService) {
                storageService.saveArticles([...rawStock, newArticle]);
              }
              showToast?.(`Article "${newArticle.ref}" enregistré avec succès.`, 'success');
              onClose();
            }}
            className="px-4 py-1.5 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-lg shadow-xs transition cursor-pointer"
          >
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
}

export function AuditRelinkModal({
  isOpen,
  onClose,
  relinkData,
  setRelinkData,
  machines = [],
  rawStock = [],
  zones = [],
  technicians = [],
  operations = [],
  handleExecuteRelink,
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center font-bold">
              <Link2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Rattachement & Correction de Clé
              </h3>
              <p className="text-[11px] text-slate-500">
                Correction en cascade de la clé étrangère
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 font-bold text-lg cursor-pointer"
          >
            ×
          </button>
        </div>

        <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-100 space-y-1.5 text-xs text-indigo-950">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-600">Élément à corriger :</span>
            <span className="font-mono font-bold px-2 py-0.5 bg-white text-indigo-900 rounded border border-indigo-200">
              {relinkData.oldKey}
            </span>
          </div>
          <div className="text-[11px] text-indigo-800 leading-relaxed">
            Ce code apparaît dans <b>{relinkData.occurrencesCount}</b> écriture(s). Choisissez l'élément officiel ci-dessous pour rediriger et corriger toutes ces références automatiquement.
          </div>
        </div>

        <div className="space-y-2">
          <label className="block text-[11px] font-bold text-slate-700">
            Rattacher vers l'élément officiel :
          </label>
          <select
            value={relinkData.targetKey}
            onChange={(e) =>
              setRelinkData((prev) => ({ ...prev, targetKey: e.target.value }))
            }
            className="w-full text-xs font-semibold border border-slate-300 rounded-lg p-2.5 bg-white text-slate-800 focus:outline-none focus:border-indigo-500"
          >
            <option value="">Sélectionner un élément valide...</option>
            {relinkData.entityType === 'machine' &&
              machines.map((m) => (
                <option key={m.id_machine_registered} value={m.id_machine_registered}>
                  {m.id_machine_registered} — {m.designation || 'Machine'}
                </option>
              ))}
            {relinkData.entityType === 'article' &&
              rawStock.map((s) => (
                <option key={s.ref} value={s.ref}>
                  {s.ref} — {s.designation || 'Article'}
                </option>
              ))}
            {relinkData.entityType === 'zone' &&
              zones.map((z) => (
                <option key={z.id_zone} value={z.id_zone}>
                  {z.id_zone} — {z.libelle || z.nom || 'Zone'}
                </option>
              ))}
            {relinkData.entityType === 'user' && (
              <>
                <optgroup label="Techniciens">
                  {technicians.map((t) => (
                    <option key={t.id_technician || t.nom} value={t.nom}>
                      {t.nom} ({t.id_technician || 'TECH'})
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Opérateurs & Chefs">
                  {operations.map((o) => (
                    <option key={o.id_operation || o.nom} value={o.nom}>
                      {o.nom} ({o.type_profil || 'OP'})
                    </option>
                  ))}
                </optgroup>
              </>
            )}
          </select>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 text-xs text-slate-600 hover:text-slate-800 font-semibold cursor-pointer"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleExecuteRelink}
            disabled={!relinkData.targetKey}
            className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs rounded-lg shadow-xs transition cursor-pointer"
          >
            Appliquer ({relinkData.occurrencesCount} écritures)
          </button>
        </div>
      </div>
    </div>
  );
}
