import React, { useEffect } from 'react';
import { MapPin, Users, Package, Link2, Layers, X } from 'lucide-react';
import { StockCalculationService } from '../../../../domain/pdr/services/StockCalculationService';
import { filterActiveMachines } from '../../../../utils/activeMachines';
import type { IMachine } from '../../../../types/domain';
import Action3DButton from '../../../components/common/Action3DButton';
import { SETTINGS_BUTTON_STYLES, SETTINGS_INPUT_CLASS } from './settingsUi';

export interface AuditZoneFormState {
  libelle: string;
}

export interface AuditZoneRecord {
  id_zone: string;
  libelle?: string;
  nom?: string;
  description?: string;
}

export interface AuditZoneModalProps {
  isOpen: boolean;
  onClose: () => void;
  auditZoneForm: AuditZoneFormState;
  setAuditZoneForm: React.Dispatch<React.SetStateAction<AuditZoneFormState>>;
  getNextZoneId: () => string;
  setZones: React.Dispatch<React.SetStateAction<AuditZoneRecord[]>>;
  showToast?: (message: string, type?: string) => void;
}

export interface AuditUserFormState {
  type: string;
  nom: string;
  specialite: string;
  id_zone: string;
}

export interface AuditTechnicianRecord {
  id_technician?: string;
  nom: string;
  specialite?: string;
  contact?: string;
  avatar?: string;
}

export interface AuditOperationRecord {
  id_operation?: string;
  nom: string;
  id_zone?: string;
  type_profil?: string;
  avatar?: string;
}

export interface AuditUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  auditUserForm: AuditUserFormState;
  setAuditUserForm: React.Dispatch<React.SetStateAction<AuditUserFormState>>;
  getNextUserId: (type: string) => string;
  zones?: AuditZoneRecord[];
  setTechnicians: React.Dispatch<React.SetStateAction<AuditTechnicianRecord[]>>;
  setOperations: React.Dispatch<React.SetStateAction<AuditOperationRecord[]>>;
  showToast?: (message: string, type?: string) => void;
}

export interface AuditArticleFormState {
  ref: string;
  designation: string;
  type: string;
  emplacement: string;
  stockInitial: number;
  seuil: number;
}

export interface AuditArticleTypeOption {
  id_type?: string;
  libelle?: string;
  nom?: string;
}

export interface AuditStockRecord {
  ref: string;
  designation?: string;
  type?: string;
  emplacement?: string;
  stockInitial?: number;
  seuil?: number;
  entrees?: number;
  sorties?: number;
  stockActuel?: number;
  alerte?: string;
  [key: string]: unknown;
}

export interface AuditStorageServiceAdapter {
  saveArticles: (articles: AuditStockRecord[]) => void;
}

export interface AuditArticleModalProps {
  isOpen: boolean;
  onClose: () => void;
  auditArticleForm: AuditArticleFormState;
  setAuditArticleForm: React.Dispatch<React.SetStateAction<AuditArticleFormState>>;
  types?: Array<AuditArticleTypeOption | string>;
  setRawStock?: React.Dispatch<React.SetStateAction<AuditStockRecord[]>>;
  rawStock?: AuditStockRecord[];
  mouvements?: Array<Record<string, unknown>>;
  storageService?: AuditStorageServiceAdapter;
  showToast?: (message: string, type?: string) => void;
}

export interface AuditRelinkDataState {
  oldKey: string;
  targetKey: string;
  occurrencesCount: number;
  entityType: 'machine' | 'article' | 'zone' | 'user' | string;
}

export interface AuditMachineRecord {
  id_machine_registered: string;
  designation?: string;
}

export interface AuditRelinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  relinkData: AuditRelinkDataState;
  setRelinkData: React.Dispatch<React.SetStateAction<AuditRelinkDataState>>;
  machines?: AuditMachineRecord[];
  rawStock?: AuditStockRecord[];
  zones?: AuditZoneRecord[];
  technicians?: AuditTechnicianRecord[];
  operations?: AuditOperationRecord[];
  handleExecuteRelink: () => void;
}

/**
 * Modals for Settings Audit: Zone, User, Article, and Relink modals.
 * Unified light headers, slate/sky badges, and SETTINGS_BUTTON_STYLES.
 */
export function AuditZoneModal({
  isOpen,
  onClose,
  auditZoneForm,
  setAuditZoneForm,
  getNextZoneId,
  setZones,
  showToast,
}: AuditZoneModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-white rounded-2xl border border-slate-200/90 shadow-2xl max-w-md w-full p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
          <div className="flex items-center gap-3">
            <MapPin className="w-5 h-5 text-sky-700 shrink-0" />
            <div>
              <h3 className="text-sm font-extrabold text-slate-900">
                Fiche d&apos;enregistrement de Zone
              </h3>
              <p className="text-[11px] text-slate-500">
                Inscription au Référentiel des Emplacements Usine
              </p>
            </div>
          </div>
          <Action3DButton
            variant="circle"
            color="slate"
            icon={X}
            onClick={onClose}
            title="Fermer"
            ariaLabel="Fermer"
            className="!w-8 !h-8"
          />
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">
              Nom de la Zone / Atelier
            </label>
            <input
              type="text"
              value={auditZoneForm.libelle}
              onChange={(e) =>
                setAuditZoneForm((prev) => ({ ...prev, libelle: e.target.value }))
              }
              className={SETTINGS_INPUT_CLASS}
              placeholder="ex: Atelier Conditionnement"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
          <button
            type="button"
            onClick={onClose}
            className={SETTINGS_BUTTON_STYLES.secondary}
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
              const newZone: AuditZoneRecord = {
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
            className={SETTINGS_BUTTON_STYLES.primary}
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
}: AuditUserModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-white rounded-2xl border border-slate-200/90 shadow-2xl max-w-md w-full p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
          <div className="flex items-center gap-3">
            <Users className="w-5 h-5 text-sky-700 shrink-0" />
            <div>
              <h3 className="text-sm font-extrabold text-slate-900">
                Fiche d&apos;enregistrement d&apos;utilisateur
              </h3>
              <p className="text-[11px] text-slate-500">
                Audit GMAO &amp; Sécurisation des Identifiants
              </p>
            </div>
          </div>
          <Action3DButton
            variant="circle"
            color="slate"
            icon={X}
            onClick={onClose}
            title="Fermer"
            ariaLabel="Fermer"
            className="!w-8 !h-8"
          />
        </div>

        <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-600">
              ID Sécurisé généré :
            </span>
            <span className="font-mono font-extrabold text-xs bg-white text-sky-900 border border-slate-300 px-2.5 py-0.5 rounded-full">
              {getNextUserId(auditUserForm.type)}
            </span>
          </div>
          <p className="text-[10px] text-slate-500 leading-tight">
            L&apos;ID est unique et séquentiel. Il garantit la traçabilité intégrale des mouvements d&apos;ateliers même si le nom est corrigé ultérieurement.
          </p>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">
              Profil / Type d&apos;utilisateur
            </label>
            <select
              value={auditUserForm.type}
              onChange={(e) =>
                setAuditUserForm((prev) => ({ ...prev, type: e.target.value }))
              }
              className={`${SETTINGS_INPUT_CLASS} bg-white`}
            >
              <option value="TECHNICIEN">Technicien (Maintenance / GMAO)</option>
              <option value="OPERATEUR">Opérateur (Production)</option>
              <option value="CHEF">Chef d&apos;équipe / Superviseur</option>
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
              className={SETTINGS_INPUT_CLASS}
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
                className={SETTINGS_INPUT_CLASS}
                placeholder="Spécialité du technicien (ex: Mécanique, Électricité)"
              />
            </div>
          ) : (
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Zone d&apos;affectation
              </label>
              <select
                value={auditUserForm.id_zone}
                onChange={(e) =>
                  setAuditUserForm((prev) => ({ ...prev, id_zone: e.target.value }))
                }
                className={`${SETTINGS_INPUT_CLASS} bg-white`}
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
            className={SETTINGS_BUTTON_STYLES.secondary}
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
                const newTech: AuditTechnicianRecord = {
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
                const newOp: AuditOperationRecord = {
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
            className={SETTINGS_BUTTON_STYLES.primary}
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
  mouvements = [],
  storageService,
  showToast,
}: AuditArticleModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const firstTypeOption = types[0];
  const defaultTypeValue =
    typeof firstTypeOption === 'string'
      ? firstTypeOption
      : firstTypeOption?.id_type || 'MECANIQUE';

  return (
    <div
      className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-white rounded-2xl border border-slate-200/90 shadow-2xl max-w-md w-full p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
          <div className="flex items-center gap-3">
            <Package className="w-5 h-5 text-sky-700 shrink-0" />
            <div>
              <h3 className="text-sm font-extrabold text-slate-900">
                Fiche d&apos;enregistrement Pièce PDR
              </h3>
              <p className="text-[11px] text-slate-500">
                Inscription officielle au Référentiel Stock Articles
              </p>
            </div>
          </div>
          <Action3DButton
            variant="circle"
            color="slate"
            icon={X}
            onClick={onClose}
            title="Fermer"
            ariaLabel="Fermer"
            className="!w-8 !h-8"
          />
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
              className={`${SETTINGS_INPUT_CLASS} font-mono font-bold`}
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
              className={SETTINGS_INPUT_CLASS}
              placeholder="ex: Roulement à billes 6204-2RS"
            />
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Famille / Type
              </label>
              <select
                value={auditArticleForm.type}
                onChange={(e) =>
                  setAuditArticleForm((p) => ({ ...p, type: e.target.value }))
                }
                className={`${SETTINGS_INPUT_CLASS} bg-white`}
              >
                {(types || []).map((t, idx) => {
                  const val = typeof t === 'string' ? t : t.id_type || String(idx);
                  const label =
                    typeof t === 'string' ? t : t.libelle || t.nom || t.id_type || val;
                  return (
                    <option key={val} value={val}>
                      {label}
                    </option>
                  );
                })}
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
                className={SETTINGS_INPUT_CLASS}
                placeholder="ex: Magasin PDR"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
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
                className={`${SETTINGS_INPUT_CLASS} font-mono`}
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Seuil d&apos;Alerte
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
                className={`${SETTINGS_INPUT_CLASS} font-mono`}
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
          <button
            type="button"
            onClick={onClose}
            className={SETTINGS_BUTTON_STYLES.secondary}
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
              const baseArticle = {
                ref: auditArticleForm.ref.trim(),
                designation: auditArticleForm.designation.trim(),
                type: auditArticleForm.type || defaultTypeValue,
                emplacement: auditArticleForm.emplacement || 'Magasin PDR',
                stockInitial: Number(auditArticleForm.stockInitial) || 0,
                seuil: Number(auditArticleForm.seuil) || 5,
              };
              const calc = StockCalculationService.calculateStockByRef(baseArticle, mouvements);
              const newArticle: AuditStockRecord = {
                ...baseArticle,
                entrees: calc?.entrees ?? 0,
                sorties: calc?.sorties ?? 0,
                stockActuel: calc?.stockActuel ?? baseArticle.stockInitial,
                alerte: calc?.alerte ?? 'OK',
              };
              if (setRawStock) {
                setRawStock((prev) => [...prev, newArticle]);
              }
              if (storageService) {
                storageService.saveArticles([...rawStock, newArticle]);
              }
              showToast?.(
                `Article "${newArticle.ref}" enregistré avec succès (Stock calculé : ${newArticle.stockActuel}).`,
                'success'
              );
              onClose();
            }}
            className={SETTINGS_BUTTON_STYLES.primary}
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
}: AuditRelinkModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-white rounded-2xl border border-slate-200/90 shadow-2xl max-w-md w-full p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
          <div className="flex items-center gap-3">
            <Link2 className="w-5 h-5 text-sky-700 shrink-0" />
            <div>
              <h3 className="text-sm font-extrabold text-slate-900">
                Rattachement &amp; Correction de Clé
              </h3>
              <p className="text-[11px] text-slate-500">
                Correction en cascade de la clé étrangère
              </p>
            </div>
          </div>
          <Action3DButton
            variant="circle"
            color="slate"
            icon={X}
            onClick={onClose}
            title="Fermer"
            ariaLabel="Fermer"
            className="!w-8 !h-8"
          />
        </div>

        <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-1.5 text-xs text-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-600">Élément à corriger :</span>
            <span className="font-mono font-bold px-2.5 py-0.5 bg-white text-sky-900 rounded-full border border-slate-300">
              {relinkData.oldKey}
            </span>
          </div>
          <div className="text-[11px] text-slate-700 leading-relaxed">
            Ce code apparaît dans <b>{relinkData.occurrencesCount}</b> écriture(s). Choisissez l&apos;élément officiel ci-dessous pour rediriger et corriger toutes ces références automatiquement.
          </div>
        </div>

        <div className="space-y-2">
          <label className="block text-[11px] font-bold text-slate-700">
            Rattacher vers l&apos;élément officiel :
          </label>
          <select
            value={relinkData.targetKey}
            onChange={(e) =>
              setRelinkData((prev) => ({ ...prev, targetKey: e.target.value }))
            }
            className={`${SETTINGS_INPUT_CLASS} bg-white`}
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
            className={SETTINGS_BUTTON_STYLES.secondary}
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleExecuteRelink}
            disabled={!relinkData.targetKey}
            className={SETTINGS_BUTTON_STYLES.primary}
          >
            Appliquer ({relinkData.occurrencesCount} écritures)
          </button>
        </div>
      </div>
    </div>
  );
}

export interface BulkRelinkModalState {
  isOpen: boolean;
  entityType: string;
  targetMachineId: string;
}

export interface BulkRelinkModalProps {
  modalState: BulkRelinkModalState;
  setModalState: React.Dispatch<React.SetStateAction<BulkRelinkModalState>>;
  machines: IMachine[];
  onConfirm: (e: React.FormEvent) => void;
}

export function BulkRelinkModal({
  modalState,
  setModalState,
  machines,
  onConfirm,
}: BulkRelinkModalProps) {
  if (!modalState.isOpen) return null;

  const closeModal = () => setModalState((prev) => ({ ...prev, isOpen: false }));

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={closeModal}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-white rounded-2xl border border-slate-200/90 shadow-2xl w-full max-w-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 bg-white border-b border-slate-100 text-slate-900 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Layers className="w-5 h-5 text-sky-700 shrink-0" />
            <div>
              <h4 className="text-sm font-extrabold text-slate-900">
                Réassigner en masse (
                {modalState.entityType === 'preventive'
                  ? 'Tâches Préventives'
                  : 'Interventions Correctives'}
                )
              </h4>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Sélectionnez la machine active cible pour rattacher les éléments orphelins
              </p>
            </div>
          </div>
          <Action3DButton
            variant="circle"
            color="slate"
            icon={X}
            onClick={closeModal}
            title="Fermer"
            ariaLabel="Fermer"
            className="!w-8 !h-8"
          />
        </div>
        <form onSubmit={onConfirm} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Machine Active Cible
            </label>
            <select
              required
              value={modalState.targetMachineId}
              onChange={(e) =>
                setModalState((prev) => ({ ...prev, targetMachineId: e.target.value }))
              }
              className={`${SETTINGS_INPUT_CLASS} bg-white`}
            >
              {filterActiveMachines(machines).map((m: IMachine) => {
                const mId = String(m.id_machine_registered || m.id || m.code || '');
                return (
                  <option key={mId} value={mId}>
                    {mId} — {m.designation || m.nom || 'Machine'}
                  </option>
                );
              })}
            </select>
          </div>
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={closeModal}
              className={SETTINGS_BUTTON_STYLES.secondary}
            >
              Annuler
            </button>
            <button
              type="submit"
              className={SETTINGS_BUTTON_STYLES.primary}
            >
              Confirmer la réassignation
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

