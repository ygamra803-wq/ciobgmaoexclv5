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
} from 'lucide-react';
import { HubIcon } from '../../components/common/icons/HubIcon';
import { CategoryIcon } from '../../components/common/icons/CategoryIcon';
import CustomSelect from '../../components/common/CustomSelect';
import SequentialCodePicker from '../../components/common/SequentialCodePicker';
import { useGmaoStore } from '../../../store/useGmaoStore';

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
}) {
  const storeGeneralSystemTypes = useGmaoStore((state) => state.generalSystemTypes);
  const handleAddGeneralSystemType = useGmaoStore((state) => state.handleAddGeneralSystemType);
  const handleToggleGeneralSystemType = useGmaoStore((state) => state.handleToggleGeneralSystemType);

  const generalSystemTypes = useMemo(
    () => (Array.isArray(storeGeneralSystemTypes) ? storeGeneralSystemTypes : []),
    [storeGeneralSystemTypes]
  );

  const activeSystemTypes = useMemo(
    () => generalSystemTypes.filter((t) => t && t.is_active !== false),
    [generalSystemTypes]
  );

  const [showNewSysTypeForm, setShowNewSysTypeForm] = useState(false);
  const [showManageSysTypes, setShowManageSysTypes] = useState(false);
  const [newSysTypeName, setNewSysTypeName] = useState('');
  const [newSysTypeCode, setNewSysTypeCode] = useState('');

  const [form, setForm] = useState({
    asset_class: 'PRODUCTION' as 'PRODUCTION' | 'SYSTEM_GENERAL',
    id_general_system_type: '',
    id_machine_registered: '',
    designation: '',
    serial_number: '',
    date_mise_en_service: new Date().toISOString().slice(0, 10),
    id_family: families[0]?.id_family || '',
    id_templates: templates[0]?.id_templates || '',
    id_blueprint: '',
    id_zone_default: zones[0]?.id_zone || '',
    technician: technicians[0]?.id_technician || '',
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

      setShowNewSysTypeForm(false);
      setShowManageSysTypes(false);
      setNewSysTypeName('');
      setNewSysTypeCode('');

      setForm({
        asset_class: 'PRODUCTION',
        id_general_system_type: activeSystemTypes[0]?.id || '',
        id_machine_registered: autoCode,
        designation: '',
        serial_number: `SN-${new Date().getFullYear()}-${autoCode.replace(/[^A-Z0-9]/g, '')}`,
        date_mise_en_service: new Date().toISOString().slice(0, 10),
        id_family: initialFam,
        id_templates: initialTpl,
        id_blueprint: '',
        id_zone_default: zones[0]?.id_zone || '',
        technician: technicians[0]?.id_technician || '',
        status: 'En Service',
      });
    }
  }, [isOpen]);

  const isSystemGeneral = form.asset_class === 'SYSTEM_GENERAL';

  const selectedSystemTypeObj = useMemo(
    () => generalSystemTypes.find((t) => t.id === form.id_general_system_type) || null,
    [generalSystemTypes, form.id_general_system_type]
  );

  // Switch between PRODUCTION and SYSTEM_GENERAL
  const handleAssetClassChange = (targetClass: 'PRODUCTION' | 'SYSTEM_GENERAL') => {
    if (targetClass === form.asset_class) return;

    if (targetClass === 'SYSTEM_GENERAL') {
      const firstSysType = activeSystemTypes[0] || generalSystemTypes[0] || null;
      const autoCode = generateSystemGeneralCode(firstSysType, machines);
      setForm((prev) => ({
        ...prev,
        asset_class: 'SYSTEM_GENERAL',
        id_general_system_type: firstSysType?.id || '',
        id_family: '',
        id_templates: '',
        id_blueprint: '',
        id_machine_registered: autoCode,
        serial_number: `SN-${new Date().getFullYear()}-${autoCode.replace(/[^A-Z0-9]/g, '')}`,
      }));
    } else {
      const initialFam = families[0]?.id_family || '';
      const relTemplates = initialFam
        ? templates.filter((t) => t.id_family === initialFam)
        : templates;
      const initialTpl = relTemplates[0]?.id_templates || templates[0]?.id_templates || '';
      const autoCode = generateMachineCode(initialTpl, machines);
      setForm((prev) => ({
        ...prev,
        asset_class: 'PRODUCTION',
        id_general_system_type: '',
        id_family: initialFam,
        id_templates: initialTpl,
        id_machine_registered: autoCode,
        serial_number: `SN-${new Date().getFullYear()}-${autoCode.replace(/[^A-Z0-9]/g, '')}`,
      }));
    }
  };

  const handleSystemTypeChange = (newSysTypeId: string) => {
    const sysObj = generalSystemTypes.find((t) => t.id === newSysTypeId) || null;
    const autoCode = generateSystemGeneralCode(sysObj, machines);
    setForm((prev) => ({
      ...prev,
      id_general_system_type: newSysTypeId,
      id_machine_registered: autoCode,
      serial_number: `SN-${new Date().getFullYear()}-${autoCode.replace(/[^A-Z0-9]/g, '')}`,
    }));
  };

  const handleCreateQuickSysType = () => {
    const trimmedName = newSysTypeName.trim();
    if (!trimmedName) return;
    const cleanCode =
      (newSysTypeCode.trim() || trimmedName.substring(0, 3))
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .slice(0, 8) || 'SYS';
    const created = handleAddGeneralSystemType({
      name: trimmedName,
      code: cleanCode,
      id: `SYS-${cleanCode}`,
    });
    if (created) {
      const autoCode = generateSystemGeneralCode(created, machines);
      setForm((prev) => ({
        ...prev,
        id_general_system_type: created.id,
        id_machine_registered: autoCode,
        serial_number: `SN-${new Date().getFullYear()}-${autoCode.replace(/[^A-Z0-9]/g, '')}`,
      }));
      setNewSysTypeName('');
      setNewSysTypeCode('');
      setShowNewSysTypeForm(false);
    }
  };

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

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.id_machine_registered || !form.designation) return;
    if (isSystemGeneral && !form.id_general_system_type) return;

    onAddMachine({
      id_machine_registered: form.id_machine_registered.trim().toUpperCase(),
      designation: form.designation.trim(),
      serial_number:
        form.serial_number?.trim() ||
        `SN-${new Date().getFullYear()}-${form.id_machine_registered.replace(/[^A-Z0-9]/g, '')}`,
      date_mise_en_service: form.date_mise_en_service || new Date().toISOString().slice(0, 10),
      asset_class: form.asset_class,
      id_general_system_type: isSystemGeneral ? form.id_general_system_type : null,
      id_family: isSystemGeneral ? form.id_family || '' : form.id_family,
      id_templates: isSystemGeneral
        ? form.id_templates || ''
        : form.id_templates || availableTemplates[0]?.id_templates || '',
      id_blueprint: form.id_blueprint || '',
      id_zone_default: form.id_zone_default,
      technician: form.technician,
      status: form.status,
    });

    onClose();
  };

  const familyOptions = useMemo(() => {
    const base = families.map((f) => ({
      value: f.id_family,
      label: `${f.libelle} (${f.id_family})`,
    }));
    if (isSystemGeneral) {
      return [
        {
          value: '',
          label: '— Aucune famille (Optionnel pour Système Général) —',
        },
        ...base,
      ];
    }
    return base;
  }, [families, isSystemGeneral]);

  const templateOptions = useMemo(() => {
    const list = (availableTemplates.length > 0 ? availableTemplates : templates).map((t) => ({
      value: t.id_templates,
      label: `${t.libelle} (${t.id_templates})`,
    }));
    if (isSystemGeneral) {
      return [
        {
          value: '',
          label: '— Aucun modèle (Optionnel pour Système Général) —',
        },
        ...list,
      ];
    }
    return list;
  }, [availableTemplates, templates, isSystemGeneral]);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/45 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center shadow-2xs font-bold border ${
                isSystemGeneral
                  ? 'bg-teal-50 border-teal-200/80 text-teal-700'
                  : 'bg-emerald-50 border-emerald-200/80 text-emerald-700'
              }`}
            >
              {isSystemGeneral ? <ShieldAlert className="w-5 h-5" /> : <Factory className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900">
                {isSystemGeneral ? 'Nouveau Système Général / Utilité' : 'Nouvelle Machine Registered'}
              </h3>
              <p className="text-xs text-slate-500">
                {isSystemGeneral
                  ? 'Équipement transversal / sécurité rattaché à une zone physique réelle'
                  : "Ajout d'un équipement au catalogue global (Liaison B→H)"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs overflow-y-auto">
          {/* 1. Catégorie d'Actif (PRODUCTION vs SYSTEM_GENERAL) */}
          <div>
            <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1.5">
              Catégorie d'Actif (Classification fonctionnelle)
            </label>
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-2xl border border-slate-200/80">
              <button
                type="button"
                onClick={() => handleAssetClassChange('PRODUCTION')}
                className={`py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer ${
                  !isSystemGeneral
                    ? 'bg-white text-emerald-800 shadow-xs border border-emerald-200/80'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Factory className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Équipement de Production</span>
              </button>
              <button
                type="button"
                onClick={() => handleAssetClassChange('SYSTEM_GENERAL')}
                className={`py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer ${
                  isSystemGeneral
                    ? 'bg-white text-teal-800 shadow-xs border border-teal-200/80'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <ShieldAlert className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                <span>Système Général / Sécurité</span>
              </button>
            </div>
          </div>

          {/* 2. Type de Système Général (Visible uniquement si SYSTEM_GENERAL) */}
          {isSystemGeneral && (
            <div className="p-3.5 rounded-2xl bg-teal-50/50 border border-teal-200/80 space-y-2.5">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <label className="text-[11px] font-bold text-teal-900 uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5 text-teal-600" />
                  <span>Type de Système Général *</span>
                </label>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setShowNewSysTypeForm((v) => !v);
                      setShowManageSysTypes(false);
                    }}
                    className="text-[11px] text-teal-800 hover:text-teal-950 font-bold inline-flex items-center gap-0.5 cursor-pointer bg-white px-2 py-0.5 rounded-lg border border-teal-200 shadow-2xs"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Nouveau type</span>
                  </button>
                  {generalSystemTypes.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowManageSysTypes((v) => !v);
                        setShowNewSysTypeForm(false);
                      }}
                      className="text-[11px] text-slate-600 hover:text-slate-900 font-semibold inline-flex items-center gap-1 cursor-pointer bg-white px-2 py-0.5 rounded-lg border border-slate-200 shadow-2xs"
                      title="Activer / Désactiver des types"
                    >
                      <Settings2 className="w-3 h-3" />
                      <span>Gérer ({generalSystemTypes.length})</span>
                    </button>
                  )}
                </div>
              </div>

              <CustomSelect
                value={form.id_general_system_type}
                onChange={(val) => handleSystemTypeChange(val)}
                options={activeSystemTypes.map((st) => ({
                  value: st.id,
                  label: `${st.name} (${st.id})`,
                  badge: st.code,
                  badgeColor: 'bg-teal-100 text-teal-800',
                }))}
                placeholder={
                  activeSystemTypes.length === 0
                    ? '— Créez un type via + Nouveau type —'
                    : '— Choisir Type de Système Général —'
                }
              />

              {/* Inline + Nouveau type mini-form */}
              {showNewSysTypeForm && (
                <div className="p-2.5 bg-white rounded-xl border border-teal-200 space-y-2 animate-in fade-in">
                  <div className="text-[10.5px] font-bold text-teal-800">
                    Ajouter un nouveau type de système général
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-2">
                      <input
                        type="text"
                        placeholder="Nom (ex: Air comprimé, Sécurité...)"
                        value={newSysTypeName}
                        onChange={(e) => {
                          const val = e.target.value;
                          setNewSysTypeName(val);
                          if (!newSysTypeCode) {
                            setNewSysTypeCode(
                              val
                                .replace(/[^a-zA-Z0-9]/g, '')
                                .slice(0, 3)
                                .toUpperCase()
                            );
                          }
                        }}
                        className="w-full h-8 px-2.5 rounded-lg border border-slate-200 text-xs font-medium"
                      />
                    </div>
                    <div>
                      <input
                        type="text"
                        placeholder="Code (ex: AIR)"
                        value={newSysTypeCode}
                        onChange={(e) =>
                          setNewSysTypeCode(
                            e.target.value
                              .toUpperCase()
                              .replace(/[^A-Z0-9]/g, '')
                              .slice(0, 6)
                          )
                        }
                        className="w-full h-8 px-2.5 rounded-lg border border-slate-200 text-xs font-mono font-bold uppercase"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => setShowNewSysTypeForm(false)}
                      className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 text-[11px] font-semibold cursor-pointer"
                    >
                      Annuler
                    </button>
                    <button
                      type="button"
                      onClick={handleCreateQuickSysType}
                      className="px-3 py-1 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Check className="w-3 h-3" />
                      <span>Créer & Sélectionner</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Inline Manage Active/Inactive Types */}
              {showManageSysTypes && (
                <div className="p-2.5 bg-white rounded-xl border border-slate-200 space-y-1.5 max-h-36 overflow-y-auto animate-in fade-in">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Activer / Désactiver les types existants
                  </div>
                  {generalSystemTypes.map((st) => (
                    <div
                      key={st.id}
                      className="flex items-center justify-between py-1 px-2 rounded-lg bg-slate-50 border border-slate-200/70"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10.5px] font-bold px-1.5 py-0.5 rounded bg-teal-50 text-teal-800 border border-teal-200">
                          {st.id}
                        </span>
                        <span className="text-xs font-semibold text-slate-800">{st.name}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleToggleGeneralSystemType(st.id, !st.is_active)}
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold cursor-pointer border transition ${
                          st.is_active !== false
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                            : 'bg-slate-200 text-slate-600 border-slate-300 hover:bg-slate-300'
                        }`}
                      >
                        {st.is_active !== false ? 'Actif' : 'Inactif'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

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
              <span>Désignation de l'Équipement (C)</span>
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
                  const codeZ = z.code_zone || z.code || z.id_zone;
                  const idZ = z.id_zone;
                  const showDual = idZ && idZ !== codeZ;
                  return {
                    value: codeZ,
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
                options={technicians.map((t) => ({
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

          {/* Modal Actions */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition cursor-pointer text-xs"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSystemGeneral && !form.id_general_system_type}
              className="px-5 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-800 disabled:opacity-50 text-white font-bold transition shadow-xs cursor-pointer text-xs flex items-center gap-1.5 active:scale-[0.98]"
            >
              <Plus className="w-4 h-4" />
              <span>{isSystemGeneral ? 'Enregistrer le Système Général' : 'Enregistrer la Machine'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
