import { useState, useEffect, useMemo } from 'react';
import {
  Factory,
  Plus,
  X,
  MapPin,
  Users,
  Radio,
  Cpu,
  FileText,
  Hash,
  Calendar,
  ShieldAlert,
  Settings2,
  Check,
  Wand2,
  LayoutList,
} from 'lucide-react';
import { HubIcon } from '../../components/common/icons/HubIcon';
import { CategoryIcon } from '../../components/common/icons/CategoryIcon';
import CustomSelect from '../../components/common/CustomSelect';
import SequentialCodePicker from '../../components/common/SequentialCodePicker';
import { WizardShell, useWizardFeature, type WizardProfile } from '../../components/common/wizard';
import { useGmaoStore } from '../../../store/useGmaoStore';
import { filterActiveMachines } from '../../../utils/activeMachines';
import {
  ASSET_HIERARCHY_LEVEL_LABELS,
  wouldCreateHierarchyCycle,
  type AssetHierarchyLevel,
} from '../../../utils/assetHierarchy';

function generateMachineCode(selectedTemplateId, existingMachines = []) {
  if (!selectedTemplateId) return 'MCH-01';

  // Clean prefix from selected template ID (e.g. DET -> DET, TPL-RCF100 -> RCF100)
  const prefix =
    selectedTemplateId
      .replace(/^TPL-?/i, '')
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '') || 'MCH';

  let maxIndex = 0;
  existingMachines.forEach((m) => {
    const code = String(m.id_machine_registered || '').toUpperCase();
    const tpl = String(m.id_templates || '').toUpperCase();
    if (code.startsWith(`${prefix}-`) || code.startsWith(prefix) || tpl === selectedTemplateId.toUpperCase()) {
      const match = code.match(/\d+$/);
      if (match) {
        const num = parseInt(match[0], 10);
        if (num > maxIndex) maxIndex = num;
      }
    }
  });

  const nextNum = maxIndex + 1;
  return `${prefix}-${String(nextNum).padStart(2, '0')}`;
}

export function generateSystemGeneralCode(systemTypeObj, existingMachines = []) {
  const rawPrefix =
    systemTypeObj?.code ||
    String(systemTypeObj?.id || '')
      .replace(/^SYS-?/i, '')
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '') ||
    'SYS';
  const prefix = String(rawPrefix).toUpperCase().replace(/[^A-Z0-9]/g, '') || 'SYS';

  let maxIndex = 0;
  existingMachines.forEach((m) => {
    const code = String(m?.id_machine_registered || '').toUpperCase();
    const sysId = String(m?.id_general_system_type || '').toUpperCase();
    if (
      code.startsWith(`${prefix}-`) ||
      (systemTypeObj?.id && sysId === String(systemTypeObj.id).toUpperCase() && code.startsWith(prefix))
    ) {
      const match = code.match(/\d+$/);
      if (match) {
        const num = parseInt(match[0], 10);
        if (num > maxIndex) maxIndex = num;
      }
    }
  });

  const nextNum = maxIndex + 1;
  return `${prefix}-${String(nextNum).padStart(2, '0')}`;
}

export default function AddMachineModal({
  isOpen,
  onClose,
  families = [],
  templates = [],
  blueprints = [],
  zones = [],
  technicians = [],
  machines = [],
  onAddMachine,
  onOpenAddFamilyModal,
  onOpenAddTemplateModal,
  onOpenAddBlueprintModal,
  onOpenAddZoneModal,
  onOpenAddTechModal,
  onNavigateToEquipment,
}: any) {
  const { isEnabled: isWizardMode, setEnabled: setWizardMode } =
    useWizardFeature('machines_onboarding');

  const storeGeneralSystemTypes = useGmaoStore((state) => state.generalSystemTypes);

  const generalSystemTypes = useMemo(
    () => (Array.isArray(storeGeneralSystemTypes) ? storeGeneralSystemTypes : []),
    [storeGeneralSystemTypes]
  );

  const activeSystemTypes = useMemo(
    () => generalSystemTypes.filter((t) => t && t.is_active !== false),
    [generalSystemTypes]
  );

  const activeTechnicians = useMemo(
    () =>
      (Array.isArray(technicians) ? technicians : []).filter(
        (t) =>
          t &&
          t.is_active !== false &&
          t.actif !== false &&
          String(t.statut || '').toUpperCase() !== 'ARCHIVE'
      ),
    [technicians]
  );

  const [formError, setFormError] = useState('');

  const [form, setForm] = useState({
    asset_class: 'PRODUCTION' as 'PRODUCTION' | 'SYSTEM_GENERAL',
    asset_level: 'MACHINE' as AssetHierarchyLevel,
    parent_id: '',
    id_general_system_type: '',
    id_machine_registered: '',
    designation: '',
    serial_number: '',
    date_mise_en_service: new Date().toISOString().slice(0, 10),
    id_family: families[0]?.id_family || '',
    id_templates: templates[0]?.id_templates || '',
    id_blueprint: '',
    id_zone_default: zones[0]?.id_zone || zones[0]?.code_zone || '',
    technician: activeTechnicians[0]?.id_technician || '',
    status: 'En Service',
  });

  useEffect(() => {
    if (isOpen) {
      const initialFam = families[0]?.id_family || '';
      const relTemplates = initialFam
        ? templates.filter((t) => t.id_family === initialFam)
        : templates;
      const initialTpl = relTemplates[0]?.id_templates || templates[0]?.id_templates || '';
      const autoCode = generateMachineCode(initialTpl, machines);

      setFormError('');

      setForm({
        asset_class: 'PRODUCTION',
        asset_level: 'MACHINE',
        parent_id: '',
        id_general_system_type: activeSystemTypes[0]?.id || '',
        id_machine_registered: autoCode,
        designation: '',
        serial_number: `SN-${new Date().getFullYear()}-${autoCode.replace(/[^A-Z0-9]/g, '')}`,
        date_mise_en_service: new Date().toISOString().slice(0, 10),
        id_family: initialFam,
        id_templates: initialTpl,
        id_blueprint: '',
        id_zone_default: zones[0]?.id_zone || zones[0]?.code_zone || '',
        technician: activeTechnicians[0]?.id_technician || '',
        status: 'En Service',
      });
    }
  }, [isOpen]);

  const isSystemGeneral = false;

  const selectedSystemTypeObj = useMemo(
    () => generalSystemTypes.find((t) => t.id === form.id_general_system_type) || null,
    [generalSystemTypes, form.id_general_system_type]
  );

  // Cascading templates according to selected family
  const availableTemplates = form.id_family
    ? templates.filter((t) => t.id_family === form.id_family)
    : templates;

  // Cascading blueprints according to selected template / family
  const availableBlueprints = useMemo(() => {
    if (form.id_templates) {
      const byTpl = blueprints.filter((b) => b.id_templates === form.id_templates);
      if (byTpl.length > 0) return byTpl;
    }
    if (form.id_family) {
      const byFam = blueprints.filter((b) => b.id_family === form.id_family);
      if (byFam.length > 0) return byFam;
    }
    return blueprints;
  }, [blueprints, form.id_templates, form.id_family]);

  // Format blueprint options with clean non-selected default
  const blueprintOptions = useMemo(() => {
    const list = [
      {
        value: '',
        label: '— Non sélectionné (Optionnel) —',
        sublabel: 'Aucun schéma ou plan technique assigné',
      },
    ];

    availableBlueprints.forEach((b) => {
      list.push({
        value: b.id_blueprint,
        label: `${b.id_blueprint} • ${b.libelle || b.ref_plan || ''}`,
        sublabel: `${b.ref_plan ? `Plan: ${b.ref_plan}` : ''} ${b.revision ? `(${b.revision})` : ''} • ${b.type_schema || ''}`,
        badge: b.type_schema || 'Schéma',
        badgeColor:
          b.type_schema === 'Mécanique'
            ? 'bg-blue-100 text-blue-800'
            : b.type_schema === 'Électrique'
              ? 'bg-amber-100 text-amber-800'
              : b.type_schema === 'Hydraulique'
                ? 'bg-indigo-100 text-indigo-800'
                : 'bg-slate-100 text-slate-800',
      });
    });

    return list;
  }, [availableBlueprints]);

  const handleFamilyChange = (newFam) => {
    const relTpl = newFam ? templates.filter((t) => t.id_family === newFam) : [];
    const newTpl = isSystemGeneral ? '' : relTpl[0]?.id_templates || '';
    const autoCode = isSystemGeneral
      ? form.id_machine_registered || generateSystemGeneralCode(selectedSystemTypeObj, machines)
      : generateMachineCode(newTpl, machines);

    const relBps = blueprints.filter((b) => b.id_family === newFam);
    const keepBp = relBps.some((b) => b.id_blueprint === form.id_blueprint);

    setForm((prev) => ({
      ...prev,
      id_family: newFam,
      id_templates: newTpl,
      id_blueprint: keepBp ? prev.id_blueprint : '',
      id_machine_registered: autoCode,
    }));
  };

  const handleTemplateChange = (newTpl) => {
    const autoCode = isSystemGeneral
      ? form.id_machine_registered || generateSystemGeneralCode(selectedSystemTypeObj, machines)
      : generateMachineCode(newTpl, machines);
    const relBps = blueprints.filter((b) => b.id_templates === newTpl);
    const keepBp = relBps.some((b) => b.id_blueprint === form.id_blueprint);

    setForm((prev) => ({
      ...prev,
      id_templates: newTpl,
      id_blueprint: keepBp ? prev.id_blueprint : '',
      id_machine_registered: autoCode,
    }));
  };

  // Prefix and auto code calculation for machines
  const machinePrefix = useMemo(() => {
    if (isSystemGeneral) {
      const sysCode =
        selectedSystemTypeObj?.code ||
        String(selectedSystemTypeObj?.id || '')
          .replace(/^SYS-?/i, '')
          .toUpperCase()
          .replace(/[^A-Z0-9]/g, '') ||
        'SYS';
      return `${sysCode}-`;
    }
    const tpl = form.id_templates || templates[0]?.id_templates || '';
    if (!tpl) return 'MCH-';
    const clean = tpl
      .replace(/^TPL-?/i, '')
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '');
    return clean ? `${clean}-` : 'MCH-';
  }, [isSystemGeneral, selectedSystemTypeObj, form.id_templates, templates]);

  const autoMachineCode = useMemo(() => {
    if (isSystemGeneral) {
      return generateSystemGeneralCode(selectedSystemTypeObj, machines);
    }
    return generateMachineCode(form.id_templates, machines);
  }, [isSystemGeneral, selectedSystemTypeObj, form.id_templates, machines]);

  const takenMachineNumbers = useMemo(() => {
    const set = new Set();
    const cleanPrefix = machinePrefix.replace(/-$/, '').toUpperCase();
    machines.forEach((m) => {
      const code = String(m.id_machine_registered || '').toUpperCase();
      if (!isSystemGeneral || code.startsWith(cleanPrefix)) {
        const match = code.match(/(\d+)$/);
        if (match) {
          set.add(parseInt(match[1], 10));
        }
      }
    });
    return set;
  }, [machines, isSystemGeneral, machinePrefix]);

  const familyOptions = useMemo(() => {
    const base = families.map((f) => ({
      value: f.id_family,
      label: `${f.libelle} (${f.id_family})`,
    }));
    return base;
  }, [families]);

  const templateOptions = useMemo(() => {
    const list = (availableTemplates.length > 0 ? availableTemplates : templates).map((t) => ({
      value: t.id_templates,
      label: `${t.libelle} (${t.id_templates})`,
    }));
    return list;
  }, [availableTemplates, templates]);

  const [isSubmittingMachine, setIsSubmittingMachine] = useState(false);

  const handleSafeClose = () => {
    if (!isSubmittingMachine) {
      onClose();
    }
  };

  const submitMachineRegistration = () => {
    if (isSubmittingMachine) return false;
    const codeNorm = String(form.id_machine_registered || '').trim().toUpperCase();
    if (!codeNorm || !form.designation.trim()) {
      setFormError('Veuillez renseigner le code matricule et la désignation de la machine.');
      return false;
    }
    const isDuplicate = (machines || []).some(
      (m) => String(m?.id_machine_registered || m?.id || '').trim().toUpperCase() === codeNorm
    );
    if (isDuplicate) {
      setFormError(`Le code machine "${codeNorm}" existe déjà dans le parc enregistré.`);
      return false;
    }
    setFormError('');

    try {
      const cleanParent = form.parent_id ? String(form.parent_id).trim().toUpperCase() : null;
      if (cleanParent && wouldCreateHierarchyCycle(machines, codeNorm, cleanParent)) {
        setFormError('Rattachement hiérarchique invalide : boucle circulaire détectée.');
        return false;
      }
      setIsSubmittingMachine(true);
      onAddMachine({
        id_machine_registered: codeNorm,
        designation: form.designation.trim(),
        serial_number:
          form.serial_number?.trim() ||
          `SN-${new Date().getFullYear()}-${codeNorm.replace(/[^A-Z0-9]/g, '')}`,
        date_mise_en_service: form.date_mise_en_service || new Date().toISOString().slice(0, 10),
        asset_class: 'PRODUCTION',
        asset_level: form.asset_level || 'MACHINE',
        parent_id: cleanParent,
        id_parent: cleanParent,
        id_general_system_type: null,
        id_family: form.id_family,
        id_templates: form.id_templates || availableTemplates[0]?.id_templates || '',
        id_blueprint: form.id_blueprint || '',
        id_zone_default: form.id_zone_default,
        technician: form.technician,
        status: form.status,
      });

      onClose();
      return true;
    } finally {
      setIsSubmittingMachine(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    submitMachineRegistration();
  };

  if (!isOpen) return null;

  // ============================================================================
  // SHARED SECTIONS FOR CLASSIC FORM & 3-STEP WIZARD (ZERO DUPLICATION)
  // ============================================================================
  const step1IdentitySection = (
    <div className="space-y-4">
      {/* 1. Catégorie d'Actif (PRODUCTION ici — Redirection Équipements pour SYSTEM_GENERAL) */}
      <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold text-xs">
            <Factory className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>Machine de Production</span>
          </span>
          <span className="text-[11px] text-slate-500">
            Pour un compresseur, extincteur ou utilité générale :
          </span>
        </div>
        {onNavigateToEquipment && (
          <button
            type="button"
            onClick={() => {
              onClose();
              onNavigateToEquipment();
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 font-bold text-xs transition cursor-pointer"
          >
            <ShieldAlert className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span>Gérer dans Équipements (Système Général) ➔</span>
          </button>
        )}
      </div>

      {/* Sequential Code Picker for Machine */}
      <div>
        <SequentialCodePicker
          prefix={machinePrefix}
          currentCode={form.id_machine_registered}
          onChangeCode={(newCode) =>
            setForm((prev) => ({ ...prev, id_machine_registered: newCode }))
          }
          autoGeneratedCode={autoMachineCode}
          takenNumbers={takenMachineNumbers}
          label="Code Machine / Équipement (B)"
          helperText={
            isSystemGeneral
              ? 'Code auto-dérivé du type de système général (ex: AIR-01, SEC-01) avec édition libre'
              : "Code séquentiel de l'équipement avec choix libre du numéro"
          }
        />
      </div>

      <div>
        <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1.5 flex items-center gap-1">
          <Cpu className="w-3 h-3 text-slate-500" />
          <span>Désignation de l&apos;Équipement (C) *</span>
        </label>
        <input
          type="text"
          placeholder={
            isSystemGeneral
              ? 'ex: Compresseur Atlas Copco GA55 / Extincteur CO2 Atelier'
              : 'ex: Ligne Ensacheuse 03'
          }
          value={form.designation}
          onChange={(e) => setForm({ ...form, designation: e.target.value })}
          className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-xs font-medium focus:bg-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 shadow-2xs transition"
          required
        />
      </div>
    </div>
  );

  const step2ArborescenceSection = (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3.5">
        {/* Family with '+' Button */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1">
              <HubIcon className="w-3 h-3 text-cyan-600" />
              <span>Famille (D)</span>
              {isSystemGeneral && (
                <span className="text-[9.5px] font-normal text-slate-400 lowercase italic">
                  (optionnel)
                </span>
              )}
            </label>
            {onOpenAddFamilyModal && (
              <button
                type="button"
                onClick={onOpenAddFamilyModal}
                className="text-[11px] text-emerald-700 hover:text-emerald-900 font-bold inline-flex items-center gap-0.5 cursor-pointer bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200/60"
              >
                <Plus className="w-3 h-3" />
                <span>Nouvelle</span>
              </button>
            )}
          </div>
          <CustomSelect
            value={form.id_family}
            onChange={(val) => handleFamilyChange(val)}
            options={familyOptions}
            placeholder={isSystemGeneral ? '— Optionnel —' : '-- Choisir Famille --'}
          />
        </div>

        {/* Template with '+' Button */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1">
              <CategoryIcon className="w-3 h-3 text-amber-600" />
              <span>Template (E)</span>
              {isSystemGeneral && (
                <span className="text-[9.5px] font-normal text-slate-400 lowercase italic">
                  (optionnel)
                </span>
              )}
            </label>
            {onOpenAddTemplateModal && (
              <button
                type="button"
                onClick={onOpenAddTemplateModal}
                className="text-[11px] text-emerald-700 hover:text-emerald-900 font-bold inline-flex items-center gap-0.5 cursor-pointer bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200/60"
              >
                <Plus className="w-3 h-3" />
                <span>Nouveau</span>
              </button>
            )}
          </div>
          <CustomSelect
            value={form.id_templates}
            onChange={(val) => handleTemplateChange(val)}
            options={templateOptions}
            placeholder={isSystemGeneral ? '— Optionnel —' : '-- Choisir Modèle --'}
          />
        </div>
      </div>

      {/* Blueprint / Plan Schéma Technique (Optionnel) */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1">
            <FileText className="w-3 h-3 text-cyan-600" />
            <span>Blueprint / Schéma Machine</span>
            <span className="text-[10px] font-normal text-slate-400 lowercase italic">(optionnel)</span>
          </label>
          {onOpenAddBlueprintModal && (
            <button
              type="button"
              onClick={onOpenAddBlueprintModal}
              className="text-[11px] text-cyan-700 hover:text-cyan-900 font-bold inline-flex items-center gap-0.5 cursor-pointer bg-cyan-50 px-1.5 py-0.5 rounded border border-cyan-200/60"
            >
              <Plus className="w-3 h-3" />
              <span>Nouveau Blueprint</span>
            </button>
          )}
        </div>
        <CustomSelect
          value={form.id_blueprint}
          onChange={(val) => setForm({ ...form, id_blueprint: val })}
          options={blueprintOptions}
          placeholder="— Non sélectionné —"
        />
        {form.id_blueprint && (
          <p className="mt-1 text-[11px] text-cyan-700 font-medium flex items-center gap-1">
            <FileText className="w-3 h-3" />
            <span>Plan lié : {blueprintOptions.find((o) => o.value === form.id_blueprint)?.label}</span>
          </p>
        )}
      </div>

      {/* Regroupement Opérationnel (Ligne / Machine Mère — Optionnel pour Rollup analytique) */}
      <div className="grid grid-cols-2 gap-3.5 pt-2 border-t border-slate-100">
        <div>
          <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1.5">
            Rôle Opérationnel
          </label>
          <CustomSelect
            value={form.asset_level || 'MACHINE'}
            onChange={(val) => setForm({ ...form, asset_level: (val || 'MACHINE') as AssetHierarchyLevel })}
            options={(Object.keys(ASSET_HIERARCHY_LEVEL_LABELS) as AssetHierarchyLevel[]).map((lvl) => ({
              value: lvl,
              label: ASSET_HIERARCHY_LEVEL_LABELS[lvl],
            }))}
          />
        </div>
        <div>
          <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1.5">
            Rattachement Ligne / Machine Mère <span className="text-[10px] font-normal text-slate-400 italic">(optionnel)</span>
          </label>
          <CustomSelect
            value={form.parent_id || ''}
            onChange={(val) => setForm({ ...form, parent_id: val || '' })}
            options={[
              { value: '', label: '— Machine indépendante (Aucune ligne mère) —' },
              ...filterActiveMachines(machines)
                .filter(
                  (m) =>
                    !wouldCreateHierarchyCycle(
                      machines,
                      form.id_machine_registered,
                      m.id_machine_registered
                    )
                )
                .map((m) => ({
                  value: m.id_machine_registered,
                  label: `${m.id_machine_registered} • ${m.designation}`,
                })),
            ]}
          />
        </div>
      </div>
    </div>
  );

  const step3ExploitationSection = (
    <div className="space-y-4">
      {/* N° de Série & Date de Mise en Service */}
      <div className="grid grid-cols-2 gap-3.5">
        <div>
          <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1 flex items-center gap-1">
            <Hash className="w-3 h-3 text-slate-500" />
            <span>N° de Série (N° Série)</span>
          </label>
          <input
            type="text"
            value={form.serial_number}
            onChange={(e) => setForm({ ...form, serial_number: e.target.value })}
            placeholder="Ex: SN-2024-PRS01"
            className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-xs font-mono font-medium focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>
        <div>
          <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1 flex items-center gap-1">
            <Calendar className="w-3 h-3 text-slate-500" />
            <span>Mise en Service</span>
          </label>
          <input
            type="date"
            value={form.date_mise_en_service}
            onChange={(e) => setForm({ ...form, date_mise_en_service: e.target.value })}
            className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-xs font-medium focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3.5">
        {/* Zone with '+' Button (Real physical zone) */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1">
              <MapPin className="w-3 h-3 text-purple-600" />
              <span>Zone Physique Réelle (F)</span>
            </label>
            {onOpenAddZoneModal && (
              <button
                type="button"
                onClick={onOpenAddZoneModal}
                className="text-[11px] text-emerald-700 hover:text-emerald-900 font-bold inline-flex items-center gap-0.5 cursor-pointer bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200/60"
              >
                <Plus className="w-3 h-3" />
                <span>Nouveau</span>
              </button>
            )}
          </div>
          <CustomSelect
            value={form.id_zone_default}
            onChange={(val) => setForm({ ...form, id_zone_default: val })}
            options={zones.map((z) => {
              const idZ = z.id_zone || z.code_zone || z.code;
              const codeZ = z.code_zone || z.code || z.id_zone;
              const showDual = idZ && codeZ && idZ !== codeZ;
              return {
                value: idZ,
                label: `${z.code_zone ? z.code_zone + ' • ' : ''}${z.libelle}${showDual ? ` (${idZ})` : ''}`,
              };
            })}
            placeholder="-- Choisir Zone Physique --"
          />
        </div>

        {/* Technician with '+' Button */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1">
              <Users className="w-3 h-3 text-blue-600" />
              <span>Technicien (G)</span>
            </label>
            {onOpenAddTechModal && (
              <button
                type="button"
                onClick={onOpenAddTechModal}
                className="text-[11px] text-emerald-700 hover:text-emerald-900 font-bold inline-flex items-center gap-0.5 cursor-pointer bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200/60"
              >
                <Plus className="w-3 h-3" />
                <span>Nouveau</span>
              </button>
            )}
          </div>
          <CustomSelect
            value={form.technician}
            onChange={(val) => setForm({ ...form, technician: val })}
            options={activeTechnicians.map((t) => ({
              value: t.id_technician,
              label: `${t.nom} (${t.id_technician})`,
            }))}
            placeholder="-- Choisir Technicien --"
          />
        </div>
      </div>

      <div>
        <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1.5 flex items-center gap-1">
          <Radio className="w-3 h-3 text-slate-500" />
          <span>Statut Opérationnel (H)</span>
        </label>
        <CustomSelect
          value={form.status}
          onChange={(val) => setForm({ ...form, status: val })}
          options={[
            {
              value: 'En Service',
              label: 'En Service (Opérationnel)',
              badge: 'Actif',
              badgeColor: 'bg-emerald-100 text-emerald-800',
            },
            {
              value: 'En Maintenance',
              label: 'En Maintenance',
              badge: 'Entretien',
              badgeColor: 'bg-amber-100 text-amber-800',
            },
            {
              value: 'En Panne',
              label: 'En Panne / Incident',
              badge: 'Incident',
              badgeColor: 'bg-rose-100 text-rose-800',
            },
            {
              value: 'Arrêt',
              label: 'Arrêt Machine',
              badge: 'Arrêt',
              badgeColor: 'bg-slate-100 text-slate-800',
            },
          ]}
        />
      </div>

      {/* Récapitulatif en mode Wizard */}
      {isWizardMode && (
        <div className="p-3.5 rounded-xl bg-emerald-50/50 border border-emerald-200/80 space-y-2">
          <div className="flex items-center justify-between border-b border-emerald-200/60 pb-1.5">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-900">
              Synthèse Immatriculation (Liaison B→H)
            </span>
            <span className="text-[10.5px] font-mono font-bold px-2 py-0.5 rounded bg-white text-emerald-800 border border-emerald-200">
              {form.id_machine_registered || '—'}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div>
              <span className="text-slate-500">Désignation (C) : </span>
              <strong className="text-slate-900">{form.designation || 'Non renseignée'}</strong>
            </div>
            <div>
              <span className="text-slate-500">Classe : </span>
              <strong className="text-slate-900">
                {isSystemGeneral ? 'Système Général' : 'Production'}
              </strong>
            </div>
            <div>
              <span className="text-slate-500">Famille / Modèle : </span>
              <strong className="font-mono text-slate-800">
                {form.id_family || '—'} / {form.id_templates || '—'}
              </strong>
            </div>
            <div>
              <span className="text-slate-500">Zone / Tech : </span>
              <strong className="font-mono text-slate-800">
                {form.id_zone_default || '—'} • {form.technician || '—'}
              </strong>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const machineWizardProfile: WizardProfile = {
    id: 'machines-onboarding-wizard',
    moduleKey: 'machines_onboarding',
    code: form.id_machine_registered || 'WIZ-MAC',
    title: isSystemGeneral
      ? 'Assistant Système Général'
      : 'Assistant Immatriculation Machine',
    subtitle: 'Enregistrement guidé au référentiel Parc Machines (Colonnes B → H)',
    themeColor: 'emerald',
    finishLabel: isSystemGeneral
      ? 'Enregistrer le Système Général'
      : 'Enregistrer la Machine',
    cancelLabel: 'Annuler',
    onCancel: handleSafeClose,
    onFinish: async () => submitMachineRegistration(),
    steps: [
      {
        id: 'step-1-identite',
        code: 'ÉTAPE 01',
        title: 'Identité & Code',
        description:
          "Choisissez la catégorie d'actif, le code matricule séquentiel (Col B) et la désignation officielle (Col C).",
        badge: 'COL B-C',
        icon: Factory,
        content: step1IdentitySection,
        validate: () => {
          const codeNorm = form.id_machine_registered.trim().toUpperCase();
          if (!codeNorm) {
            return {
              isValid: false,
              severity: 'critical',
              message: "Veuillez définir le code matricule de l'équipement (Col B).",
            };
          }
          if (
            (machines || []).some(
              (m) => String(m?.id_machine_registered || m?.id || '').trim().toUpperCase() === codeNorm
            )
          ) {
            return {
              isValid: false,
              severity: 'critical',
              message: `Le code machine "${codeNorm}" existe déjà dans le parc enregistré.`,
            };
          }
          if (!form.designation.trim()) {
            return {
              isValid: false,
              severity: 'critical',
              message: "Veuillez saisir la désignation officielle de l'équipement (Col C).",
            };
          }
          if (isSystemGeneral && !form.id_general_system_type) {
            return {
              isValid: false,
              severity: 'critical',
              message: 'Veuillez sélectionner ou créer un Type de Système Général.',
            };
          }
          return { isValid: true };
        },
      },
      {
        id: 'step-2-arborescence',
        code: 'ÉTAPE 02',
        title: 'Famille & Blueprint',
        description:
          "Rattachez l'équipement à sa Famille (Col D), son Modèle Template (Col E) et son Schéma Blueprint.",
        badge: 'COL D-E',
        optional: isSystemGeneral,
        validateOn: 'always',
        icon: FileText,
        content: step2ArborescenceSection,
        validate: () => {
          if (!isSystemGeneral && families.length > 0 && !form.id_family) {
            return {
              isValid: true,
              severity: 'warning',
              message: 'Aucune famille sélectionnée : le rattachement analytique sera générique.',
            };
          }
          return { isValid: true };
        },
      },
      {
        id: 'step-3-exploitation',
        code: 'ÉTAPE 03',
        title: 'Zone & Exploitation',
        description:
          'Définissez le N° de série, la Zone physique (Col F), le Technicien référent (Col G) et le Statut (Col H).',
        badge: 'COL F-H',
        icon: MapPin,
        content: step3ExploitationSection,
        validate: () => {
          if (!form.id_zone_default && zones.length > 0) {
            return {
              isValid: false,
              severity: 'critical',
              message: "Veuillez sélectionner la Zone physique d'affectation (Col F).",
            };
          }
          return { isValid: true };
        },
      },
    ],
  };

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmittingMachine) {
          handleSafeClose();
        }
      }}
      className="fixed inset-0 z-50 bg-slate-900/45 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`bg-white rounded-3xl shadow-2xl w-full ${
          isWizardMode ? 'max-w-2xl' : 'max-w-lg'
        } border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] transition-all duration-200`}
      >
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between gap-3 bg-white shrink-0 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center shadow-2xs font-bold border shrink-0 ${
                isSystemGeneral
                  ? 'bg-teal-50 border-teal-200/80 text-teal-700'
                  : 'bg-emerald-50 border-emerald-200/80 text-emerald-700'
              }`}
            >
              {isSystemGeneral ? <ShieldAlert className="w-5 h-5" /> : <Factory className="w-5 h-5" />}
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-base text-slate-900 truncate">
                {isSystemGeneral ? 'Nouveau Système Général / Utilité' : 'Nouvelle Machine Registered'}
              </h3>
              <p className="text-xs text-slate-500 truncate">
                {isSystemGeneral
                  ? 'Équipement transversal / sécurité rattaché à une zone physique réelle'
                  : "Ajout d'un équipement au catalogue global (Liaison B→H)"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Mode Switcher: Formulaire Classique ⇄ Assistant Wizard */}
            <div
              className="inline-flex items-center p-1 rounded-xl bg-slate-100 border border-slate-200/90 shadow-2xs"
              role="group"
              aria-label="Mode de saisie machine"
            >
              <button
                type="button"
                disabled={isSubmittingMachine}
                onClick={() => setWizardMode(false)}
                title="Afficher le formulaire complet classique"
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                  !isWizardMode
                    ? 'bg-white text-slate-900 shadow-2xs border border-slate-200/80'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <LayoutList className="w-3.5 h-3.5 text-slate-600" />
                <span>Formulaire Classique</span>
              </button>
              <button
                type="button"
                disabled={isSubmittingMachine}
                onClick={() => setWizardMode(true)}
                title="Activer l'assistant guidé étape par étape (Wizard)"
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                  isWizardMode
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'text-slate-500 hover:text-emerald-700'
                }`}
              >
                <Wand2 className="w-3.5 h-3.5" />
                <span>Assistant Wizard</span>
              </button>
            </div>

            <button
              type="button"
              disabled={isSubmittingMachine}
              onClick={handleSafeClose}
              aria-label="Fermer la fenêtre"
              className="w-8 h-8 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {isWizardMode ? (
          <WizardShell
            profile={machineWizardProfile}
            layout="compact"
            className="min-h-[460px] max-h-[78vh] border-0 shadow-none rounded-none"
          />
        ) : (
          <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs overflow-y-auto">
            {formError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 font-bold flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{formError}</span>
              </div>
            )}
            {step1IdentitySection}
            {step2ArborescenceSection}
            {step3ExploitationSection}

            {/* Modal Actions */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
              <button
                type="button"
                disabled={isSubmittingMachine}
                onClick={handleSafeClose}
                className="px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition cursor-pointer text-xs disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={isSubmittingMachine || (isSystemGeneral && !form.id_general_system_type)}
                className="px-5 py-2.5 rounded-xl btn-primary-accent disabled:opacity-50 text-white font-bold transition shadow-xs cursor-pointer text-xs flex items-center gap-1.5 active:scale-[0.98]"
              >
                <Plus className="w-4 h-4" />
                <span>{isSystemGeneral ? 'Enregistrer le Système Général' : 'Enregistrer la Machine'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
