import {  useState, useEffect, useMemo  } from 'react';
import { UserCheck, Plus, X, Wrench, ShieldCheck, ClipboardList, Check, MapPin } from 'lucide-react';
import CustomSelect from '../../components/common/CustomSelect';
import UserCodePicker from '../../components/common/UserCodePicker';
import {
  RESPONSABLE_TEMPLATES,
  formatTemplateLabels,
} from '../../../data/responsableTemplates';

export default function AddUserModal({
  isOpen,
  onClose,
  zones = [],
  technicians = [],
  operations = [],
  onAddTechnician,
  onAddOperation,
  initialType = 'TECHNICIEN', // 'TECHNICIEN' | 'OPERATEUR' | 'RESPONSABLE' | 'CHEF'
  onOpenAddZoneModal,
}) {
  const normalizedInitialType =
    initialType === 'CHEF' ? 'RESPONSABLE' : initialType || 'TECHNICIEN';

  const [profileType, setProfileType] = useState(normalizedInitialType);
  const [selectedTemplates, setSelectedTemplates] = useState(['RMT']);
  const [selectedZones, setSelectedZones] = useState(['ALL']);
  const [customCode, setCustomCode] = useState('');

  const [form, setForm] = useState({
    nom: '',
    id_zone: zones[0]?.id_zone || '',
    specialite: '',
  });
  const [error, setError] = useState('');

  // Auto-calculation of next sequential ID
  const getNextId = (type) => {
    if (type === 'TECHNICIEN') {
      const nums = technicians
        .map((t) => {
          const m = String(t.id_technician || '').match(/TECH-(\d+)/i);
          return m ? parseInt(m[1], 10) : 0;
        })
        .filter((n) => !isNaN(n));
      const max = nums.length > 0 ? Math.max(...nums) : 0;
      return `TECH-${String(max + 1).padStart(2, '0')}`;
    } else if (type === 'OPERATEUR') {
      const nums = operations
        .filter(
          (o) =>
            o.type_profil === 'OPERATEUR' &&
            !String(o.id_operation).startsWith('RESP') &&
            !String(o.id_operation).startsWith('CHEF')
        )
        .map((o) => {
          const m = String(o.id_operation || '').match(/OP-(\d+)/i);
          return m ? parseInt(m[1], 10) : 0;
        })
        .filter((n) => !isNaN(n));
      const max = nums.length > 0 ? Math.max(...nums) : 0;
      return `OP-${String(max + 1).padStart(2, '0')}`;
    } else if (type === 'RESPONSABLE' || type === 'CHEF') {
      const nums = operations
        .filter(
          (o) =>
            o.type_profil === 'RESPONSABLE' ||
            o.type_profil === 'CHEF' ||
            String(o.id_operation).startsWith('RESP') ||
            String(o.id_operation).startsWith('CHEF')
        )
        .map((o) => {
          const m = String(o.id_operation || '').match(/(?:RESP|CHEF)-(\d+)/i);
          return m ? parseInt(m[1], 10) : 0;
        })
        .filter((n) => !isNaN(n));
      const max = nums.length > 0 ? Math.max(...nums) : 0;
      return `RESP-${String(max + 1).padStart(2, '0')}`;
    }
    return '';
  };

  const autoNextId = useMemo(() => getNextId(profileType), [profileType, technicians, operations]);

  const currentPrefix =
    profileType === 'TECHNICIEN'
      ? 'TECH-'
      : profileType === 'OPERATEUR'
        ? 'OP-'
        : 'RESP-';

  const takenNumbers = useMemo(() => {
    const set = new Set();
    if (profileType === 'TECHNICIEN') {
      (technicians || []).forEach((t) => {
        const m = String(t.id_technician || t.id || '').match(/TECH-(\d+)/i);
        if (m) set.add(parseInt(m[1], 10));
      });
    } else if (profileType === 'OPERATEUR') {
      (operations || []).forEach((o) => {
        if (
          o.type_profil === 'OPERATEUR' &&
          !String(o.id_operation || '').startsWith('RESP') &&
          !String(o.id_operation || '').startsWith('CHEF')
        ) {
          const m = String(o.id_operation || o.id || '').match(/OP-(\d+)/i);
          if (m) set.add(parseInt(m[1], 10));
        }
      });
    } else {
      (operations || []).forEach((o) => {
        if (
          o.type_profil === 'RESPONSABLE' ||
          o.type_profil === 'CHEF' ||
          String(o.id_operation || '').startsWith('RESP') ||
          String(o.id_operation || '').startsWith('CHEF')
        ) {
          const m = String(o.id_operation || o.id || '').match(/(?:RESP|CHEF)-(\d+)/i);
          if (m) set.add(parseInt(m[1], 10));
        }
      });
    }
    return set;
  }, [profileType, technicians, operations]);

  useEffect(() => {
    if (isOpen) {
      const initP = initialType === 'CHEF' ? 'RESPONSABLE' : initialType || 'TECHNICIEN';
      setProfileType(initP);
      setSelectedTemplates(['RMT']);
      setSelectedZones(['ALL']);
      setCustomCode(getNextId(initP));
      setForm({
        nom: '',
        id_zone: zones[0]?.id_zone || '',
        specialite:
          initP === 'TECHNICIEN'
            ? 'Mécanique / Électrique'
            : initP === 'RESPONSABLE'
              ? 'Responsable Maintenance'
              : 'Opérateur de Ligne',
      });
      setError('');
    }
  }, [isOpen, initialType, zones]);

  const handleSelectProfileType = (newType) => {
    setProfileType(newType);
    setCustomCode(getNextId(newType));
    setForm((prev) => ({
      ...prev,
      specialite:
        newType === 'TECHNICIEN'
          ? 'Mécanique / Électrique'
          : newType === 'RESPONSABLE'
            ? 'Responsable Maintenance'
            : 'Opérateur de Ligne',
    }));
  };

  // Handle template selection toggle (Multi-select)
  const handleToggleTemplate = (tplId) => {
    let next;
    if (selectedTemplates.includes(tplId)) {
      if (selectedTemplates.length > 1) {
        next = selectedTemplates.filter((id) => id !== tplId);
      } else {
        next = selectedTemplates; // keep at least one
      }
    } else {
      next = [...selectedTemplates, tplId];
    }
    setSelectedTemplates(next);
  };

  // Toggle zone in multi-select for Responsable
  const handleToggleZone = (zoneId) => {
    if (zoneId === 'ALL') {
      if (selectedZones.includes('ALL')) {
        setSelectedZones([]);
      } else {
        setSelectedZones(['ALL']);
      }
      return;
    }

    let next = selectedZones.filter((z) => z !== 'ALL');
    if (next.includes(zoneId)) {
      next = next.filter((z) => z !== zoneId);
    } else {
      next.push(zoneId);
    }
    setSelectedZones(next);
  };

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.nom.trim()) {
      setError('Veuillez renseigner le nom complet de l’utilisateur.');
      return;
    }

    const finalId = customCode || autoNextId;

    if (profileType === 'TECHNICIEN') {
      if (technicians.some((t) => t.nom.toLowerCase().trim() === form.nom.toLowerCase().trim())) {
        setError('Un technicien portant ce nom existe déjà.');
        return;
      }
      onAddTechnician({
        id_technician: finalId,
        nom: form.nom.trim(),
        id_zone: form.id_zone,
        specialite: form.specialite.trim() || 'Spécialiste GMAO',
      });
    } else if (profileType === 'OPERATEUR') {
      if (operations.some((o) => o.nom.toLowerCase().trim() === form.nom.toLowerCase().trim())) {
        setError('Un opérateur portant ce nom existe déjà.');
        return;
      }
      onAddOperation({
        id_operation: finalId,
        nom: form.nom.trim(),
        id_zone: form.id_zone,
        type_profil: 'OPERATEUR',
      });
    } else {
      // RESPONSABLE
      if (operations.some((o) => o.nom.toLowerCase().trim() === form.nom.toLowerCase().trim())) {
        setError('Un responsable portant ce nom existe déjà.');
        return;
      }
      if (selectedZones.length === 0) {
        setError('Veuillez affecter au moins une zone ou cocher "ALL (Toutes les zones)".');
        return;
      }

      const activeTpls = selectedTemplates.length > 0 ? selectedTemplates : ['RMT'];
      const tplLabel = formatTemplateLabels(activeTpls);
      const isAll = selectedZones.includes('ALL');
      const zoneString = isAll ? 'ALL' : selectedZones.join(', ');

      onAddOperation({
        id_operation: finalId,
        nom: form.nom.trim(),
        id_zone: zoneString,
        zones: isAll ? ['ALL'] : selectedZones,
        type_profil: 'RESPONSABLE',
        templates: activeTpls,
        template_ids: activeTpls,
        template_id: activeTpls.join(', '),
        template_label: tplLabel,
      });
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs overflow-y-auto animate-fadeIn">
      <div className="bg-white rounded-2xl max-w-xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col my-4 sm:my-6">
        {/* Header */}
        <div className="px-5 py-4 bg-white border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-700 shadow-2xs font-bold shrink-0">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base text-slate-900 leading-tight">
                {profileType === 'TECHNICIEN'
                  ? 'Nouveau Technicien'
                  : profileType === 'RESPONSABLE'
                    ? 'Nouveau Responsable'
                    : 'Nouvel Opérateur de Ligne'}
              </h3>
              <p className="text-[11.5px] text-slate-500 mt-0.5">
                Rôle & affectation avec génération d'identifiant séquentiel
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition cursor-pointer"
            aria-label="Fermer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Profile Switcher Tabs */}
        <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200">
          <label className="text-[10.5px] font-bold text-slate-500 block mb-1.5 uppercase tracking-wider">
            Famille de Profil / Rôle
          </label>
          <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-200/60 rounded-xl border border-slate-200/80">
            <button
              type="button"
              onClick={() => handleSelectProfileType('TECHNICIEN')}
              className={`py-2 px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                profileType === 'TECHNICIEN'
                  ? 'bg-white text-blue-900 shadow-xs border border-slate-200/60'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Wrench className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span className="truncate">Technicien</span>
              <span className="text-[10px] font-mono text-slate-400 hidden sm:inline">(TECH)</span>
            </button>

            <button
              type="button"
              onClick={() => handleSelectProfileType('OPERATEUR')}
              className={`py-2 px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                profileType === 'OPERATEUR'
                  ? 'bg-white text-indigo-900 shadow-xs border border-slate-200/60'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ClipboardList className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
              <span className="truncate">Opérateur</span>
              <span className="text-[10px] font-mono text-slate-400 hidden sm:inline">(OP)</span>
            </button>

            <button
              type="button"
              onClick={() => handleSelectProfileType('RESPONSABLE')}
              className={`py-2 px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                profileType === 'RESPONSABLE'
                  ? 'bg-white text-rose-900 shadow-xs border border-slate-200/60'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5 text-rose-600 shrink-0" />
              <span className="truncate">Responsable</span>
              <span className="text-[10px] font-mono text-slate-400 hidden sm:inline">(RESP)</span>
            </button>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs overflow-y-auto max-h-[70vh]">
          {error && (
            <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
              {error}
            </div>
          )}

          {/* User Code with 01-99 Pick Popover */}
          <UserCodePicker
            prefix={currentPrefix}
            currentCode={customCode || autoNextId}
            onChangeCode={(code) => setCustomCode(code)}
            autoGeneratedCode={autoNextId}
            takenNumbers={takenNumbers}
            label="Code Utilisateur"
            helperText={
              profileType === 'RESPONSABLE'
                ? 'Code séquentiel RESP-xx selon l’ordre d’ajout global'
                : 'Généré automatiquement selon le profil choisi'
            }
          />

          {/* SECTION: RESPONSABLE TEMPLATES (Fixed System Templates - Multi-Select) */}
          {profileType === 'RESPONSABLE' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-slate-700 block uppercase tracking-wider">
                  Sélection des Templates Responsable (Multi-sélection)
                </label>
                <span className="text-[10px] text-indigo-600 font-bold bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">
                  {selectedTemplates.length} actif(s)
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {RESPONSABLE_TEMPLATES.map((tpl) => {
                  const isSelected = selectedTemplates.includes(tpl.id);
                  return (
                    <div
                      key={tpl.id}
                      onClick={() => handleToggleTemplate(tpl.id)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                        isSelected
                          ? `${tpl.cardBorder} ring-2 ring-indigo-500/20 shadow-xs bg-indigo-50/20`
                          : 'border-slate-200 bg-white hover:bg-slate-50/80'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={`text-[10px] font-mono font-black px-2 py-0.5 rounded-md border ${tpl.badgeClass}`}
                        >
                          {tpl.badge}
                        </span>
                        <div
                          className={`w-4 h-4 rounded-md flex items-center justify-center border transition ${
                            isSelected
                              ? 'bg-indigo-600 border-indigo-600 text-white'
                              : 'border-slate-300 bg-white'
                          }`}
                        >
                          {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                        </div>
                      </div>
                      <div className="mt-1.5">
                        <h4 className="font-bold text-xs text-slate-900 leading-tight">
                          {tpl.label}
                        </h4>
                        <p className="text-[10.5px] text-slate-500 mt-0.5 leading-snug">
                          {tpl.description}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="text-[10px] text-slate-400">
                Vous pouvez cocher un ou plusieurs templates pour ce responsable (ex: RMT + RZN).
              </p>
            </div>
          )}

          {/* Nom / Intitulé */}
          <div>
            <label className="text-[11px] font-bold text-slate-700 block mb-1 uppercase tracking-wider">
              Nom Complet du Membre <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              autoFocus
              placeholder={
                profileType === 'TECHNICIEN'
                  ? 'ex: Karim Bennani'
                  : profileType === 'RESPONSABLE'
                    ? 'ex: Nabile Ghazawi'
                    : 'ex: Nettoyage et Graissage Ligne 1'
              }
              value={form.nom}
              onChange={(e) => setForm({ ...form, nom: e.target.value })}
              className="w-full h-9 px-3 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15 shadow-2xs transition"
            />
          </div>

          {/* ZONE AFFECTATION FOR RESPONSABLE (Multi-Select with ALL option) */}
          {profileType === 'RESPONSABLE' ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                  Affectation de Zone(s) <span className="text-rose-500">*</span>
                </label>
                {onOpenAddZoneModal && (
                  <button
                    type="button"
                    onClick={() => {
                      onOpenAddZoneModal();
                    }}
                    className="text-[10.5px] font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer flex items-center gap-0.5"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Nouvelle Zone</span>
                  </button>
                )}
              </div>

              {/* ALL option chip */}
              <div className="flex flex-wrap gap-1.5 p-2.5 rounded-xl border border-slate-200 bg-slate-50/60">
                <button
                  type="button"
                  onClick={() => handleToggleZone('ALL')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border ${
                    selectedZones.includes('ALL')
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <MapPin className="w-3 h-3" />
                  <span>ALL (Toutes les zones)</span>
                  {selectedZones.includes('ALL') && <Check className="w-3 h-3 stroke-[3]" />}
                </button>

                {/* Individual Zone Chips */}
                {zones.map((z) => {
                  const isChecked = !selectedZones.includes('ALL') && selectedZones.includes(z.id_zone);
                  return (
                    <button
                      key={z.id_zone}
                      type="button"
                      disabled={selectedZones.includes('ALL')}
                      onClick={() => handleToggleZone(z.id_zone)}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1 cursor-pointer border ${
                        selectedZones.includes('ALL')
                          ? 'opacity-40 bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                          : isChecked
                            ? 'bg-blue-600 text-white border-blue-600 shadow-2xs font-bold'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <span>{z.libelle}</span>
                      <span className="text-[10px] font-mono opacity-80">({z.id_zone})</span>
                      {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                    </button>
                  );
                })}
              </div>
              <p className="text-[10px] text-slate-500">
                {selectedZones.includes('ALL')
                  ? 'Ce responsable a autorité sur toutes les zones (ex: Maintenance générale ou Magasin).'
                  : `Zones sélectionnées : ${selectedZones.join(', ') || 'Aucune'}`}
              </p>
            </div>
          ) : (
            /* STANDARD ZONE SELECT FOR TECH AND OPERATEUR */
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                  Zone de Rattachement <span className="text-rose-500">*</span>
                </label>
                {onOpenAddZoneModal && (
                  <button
                    type="button"
                    onClick={() => {
                      onOpenAddZoneModal();
                    }}
                    className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer flex items-center gap-0.5"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Nouvelle Zone</span>
                  </button>
                )}
              </div>
              <CustomSelect
                value={form.id_zone}
                onChange={(val) => setForm({ ...form, id_zone: val })}
                options={zones.map((z) => ({
                  value: z.id_zone,
                  label: `${z.libelle} (${z.id_zone})`,
                }))}
                placeholder="-- Choisir une Zone --"
              />
            </div>
          )}

          {/* Spécialité (if Technicien) */}
          {profileType === 'TECHNICIEN' && (
            <div>
              <label className="text-[11px] font-bold text-slate-700 block mb-1 uppercase tracking-wider">
                Spécialité / Compétence
              </label>
              <input
                type="text"
                placeholder="ex: Mécanique, Électricité, Automatisme..."
                value={form.specialite}
                onChange={(e) => setForm({ ...form, specialite: e.target.value })}
                className="w-full h-9 px-3 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15 shadow-2xs transition"
              />
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-semibold transition cursor-pointer text-xs shadow-2xs"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition shadow-xs cursor-pointer text-xs flex items-center gap-1.5 active:scale-[0.98]"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Créer & Enregistrer</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
