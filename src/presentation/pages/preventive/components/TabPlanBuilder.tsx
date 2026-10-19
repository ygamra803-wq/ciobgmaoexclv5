import { useState, useEffect, useMemo, useRef } from 'react';
import {
  CheckCircle2,
  Plus,
  Trash2,
  RotateCcw,
  Sparkles,
  Clock,
  FileSpreadsheet,
  Download,
  Loader2,
} from 'lucide-react';
import Action3DButton from '../../../components/common/Action3DButton';
import PreventiveService from '../../../../application/services/PreventiveService';
import { Logger } from '../../../../core/logger/LoggerService';
import { filterActiveMachines } from '../../../../utils/activeMachines';

export default function TabPlanBuilder({
  machines = [],
  zones = [],
  technicians = [],
  guides = [],
  actions = [],
  stockItems = [],
  warehouseItems = [],
  blueprints = [],
  onCreatePlanWithTasks,
  onNavigateToMainView,
}) {
  // Plan Builder State
  const [selectedMachineId, setSelectedMachineId] = useState('');
  const [targetZone, setTargetZone] = useState('');
  const [targetTechnician, setTargetTechnician] = useState('');
  const [planReference, setPlanReference] = useState('');
  const [frequenceGlobale, setFrequenceGlobale] = useState('Mensuel');
  const [startWeek, setStartWeek] = useState('S1');
  const [isGroupedIntervention, setIsGroupedIntervention] = useState(true);
  const [scheduledDate, setScheduledDate] = useState(() => {
    const d = new Date();
    return d.toISOString().split('T')[0];
  });
  const [planDescription, setPlanDescription] = useState('');

  // Import states
  const [isImporting, setIsImporting] = useState(false);
  const [importStatus, setImportStatus] = useState(null);
  const excelFileInputRef = useRef(null);

  // NOUVELLES FONCTIONNALITÉS INDUSTRIELLES
  // 1. Mode de calcul récurrence (Fixed vs Floating)
  const [modeCalculRecurrence, setModeCalculRecurrence] = useState('FIXE'); // 'FIXE' | 'GLISSANT'
  // 2. Type de Déclenchement (Calendrier vs Compteur Horaire/Cycles)
  const [typeDeclencheur, setTypeDeclencheur] = useState('CALENDRIER'); // 'CALENDRIER' | 'COMPTEUR' | 'HYBRIDE'
  const [compteurUnite, setCompteurUnite] = useState('Heures'); // 'Heures' | 'Cycles' | 'Km'
  const [compteurIntervalle, setCompteurIntervalle] = useState(500);
  const [compteurIndexActuel, setCompteurIndexActuel] = useState(0);

  // Selected Tasks to generate
  const [taskList, setTaskList] = useState([]);
  const [includeGlobalMachineAction, setIncludeGlobalMachineAction] = useState(true);
  const [globalActionCode, setGlobalActionCode] = useState('N');

  // Fast component picker state
  const [componentPickerOpen, setComponentPickerOpen] = useState(false);
  const [customComponentName, setCustomComponentName] = useState('');

  // 1. Strict Relational Lineage: Machine Components from Entrepôt & Blueprints
  const machineComponents = useMemo(() => {
    if (!selectedMachineId) return [];
    const mach = machines.find((m) => m.id_machine_registered === selectedMachineId || m.code_machine === selectedMachineId || m.id === selectedMachineId);
    if (!mach) return [];

    const compMap = new Map();

    // 1a. Components already registered directly on the machine entity
    const realComps = mach.components_reels || mach.components_theoriques || [];
    realComps.forEach((c) => {
      const name = c.nom || c.id_component || c.type || c.designation;
      if (name) compMap.set(String(name).toLowerCase(), { nom: name, source: 'Machine Réelle', icon: 'wrench' });
    });

    // 1b. Components in warehouseItems linked to this machine
    (warehouseItems || []).forEach((w) => {
      const isTarget =
        w.id_machine_registered === mach.id_machine_registered ||
        w.code_machine === mach.code_machine ||
        w.machine === mach.code_machine ||
        w.id_machine === mach.id_machine_registered;
      if (isTarget && w.designation) {
        compMap.set(String(w.designation).toLowerCase(), {
          nom: w.designation,
          ref: w.ref,
          source: 'Entrepôt Composant',
          icon: 'package',
        });
      }
    });

    // 1c. Components from Blueprints matching machine template
    const templateId = mach.id_machine_template || mach.template || mach.id_template;
    if (templateId) {
      (blueprints || []).forEach((bp) => {
        if (bp.id_machine_template === templateId || bp.template === templateId) {
          const bpName = bp.nom_organe || bp.composant || bp.designation;
          if (bpName) {
            compMap.set(String(bpName).toLowerCase(), {
              nom: bpName,
              ref: bp.ref,
              source: 'Blueprint Modèle',
              icon: 'blueprint',
            });
          }
        }
      });
    }

    return Array.from(compMap.values());
  }, [selectedMachineId, machines, warehouseItems, blueprints]);

  // 2. Strict Relational Lineage: Available PDR parts from Magasin Stock
  const availablePdrList = useMemo(() => {
    const list = [];
    const seen = new Set();
    (stockItems || []).forEach((item) => {
      const ref = String(item.ref || item.reference || item.code || '').trim();
      if (ref && !seen.has(ref.toLowerCase())) {
        seen.add(ref.toLowerCase());
        list.push({
          ref,
          designation: item.designation || ref,
          stockActuel: Number(item.stockActuel ?? item.stock_actuel ?? 0),
          seuil: Number(item.seuil ?? 2),
          unite: item.unit || item.unite || 'pcs',
        });
      }
    });
    return list;
  }, [stockItems]);

  const handleReset = () => {
    setSelectedMachineId('');
    setTargetZone('');
    setTargetTechnician('');
    setPlanReference('');
    setFrequenceGlobale('Mensuel');
    setStartWeek('S1');
    setIsGroupedIntervention(true);
    setPlanDescription('');
    setTaskList([]);
    setIncludeGlobalMachineAction(true);
    setGlobalActionCode('N');
    setModeCalculRecurrence('FIXE');
    setTypeDeclencheur('CALENDRIER');
  };

  // When a machine is selected, automatically discover its Zone, Technician and Components
  useEffect(() => {
    if (!selectedMachineId) return;

    const mach = machines.find((m) => m.id_machine_registered === selectedMachineId || m.code_machine === selectedMachineId || m.id === selectedMachineId);
    
    // 1. Auto-discover Zone from machine or zones table
    const autoZone = mach?.id_zone || mach?.zone || (zones[0]?.id_zone || zones[0]?.nom || 'AFM');
    setTargetZone(autoZone);

    // 2. Auto-discover Technician assigned to this machine or technicians table (SSOT Utilisateurs)
    const autoTech = mach?.technicien_responsable || mach?.technicien || (technicians[0]?.nom || technicians[0]?.name || 'Technicien');
    setTargetTechnician(autoTech);

    // 3. Auto-generate Reference
    const cleanId = (mach?.code_machine || selectedMachineId).replace(/[^a-zA-Z0-9]/g, '');
    setPlanReference(`Plan-2025-${autoZone}-${cleanId}-${startWeek}`);
    setPlanDescription(`Plan de maintenance préventive structuré pour ${mach?.nom || selectedMachineId}`);

    // 4. Initial default task suggestions from real machine components or guides
    const initialTasks = [];

    const compsToAdd = machineComponents.length > 0 
      ? machineComponents.map(c => c.nom)
      : ['Roulement', 'Courroie', 'Niveau d\'huile', 'Glissière', 'Armoire électrique'];

    compsToAdd.slice(0, 6).forEach((compName) => {
      const guideObj = guides.find((g) => g.composant_nom.toLowerCase() === String(compName).toLowerCase()) 
        || guides.find((g) => String(compName).toLowerCase().includes(g.composant_nom.toLowerCase()));

      const acts = guideObj ? guideObj.actions_liees : ['C'];

      acts.forEach((actCode) => {
        const actObj = actions.find((a) => a.code === actCode);
        const fiche = guideObj?.fiches_actions?.[actCode] || {};
        initialTasks.push({
          id_temp: `${compName}-${actCode}-${Date.now()}-${Math.random()}`,
          composant: compName,
          action_code: actCode,
          type_intervention: actObj?.libelle || 'Contrôle',
          frequence: 'Mensuel',
          target_week: startWeek,
          duree_estimee: fiche.duree || actObj?.duree_standard || '10 min',
          consigne: fiche.description || actObj?.description || `Effectuer ${actObj?.libelle || actCode} sur ${compName}`,
          is_global_machine: false,
          pdr_ref: '',
        });
      });
    });

    setTaskList(initialTasks);
  }, [selectedMachineId, machines, zones, technicians, guides, actions, startWeek, machineComponents]);

  // Handle adding a component with its guide actions
  const handleAddComponentWithGuide = (compName) => {
    if (!compName) return;
    const guideObj = guides.find((g) => g.composant_nom.toLowerCase() === compName.toLowerCase())
      || guides.find((g) => compName.toLowerCase().includes(g.composant_nom.toLowerCase()));

    const acts = guideObj ? guideObj.actions_liees : ['C'];
    const newItems = acts.map((actCode) => {
      const actObj = actions.find((a) => a.code === actCode);
      const fiche = guideObj?.fiches_actions?.[actCode] || {};
      return {
        id_temp: `${compName}-${actCode}-${Date.now()}-${Math.random()}`,
        composant: compName,
        action_code: actCode,
        type_intervention: actObj?.libelle || 'Contrôle',
        frequence: frequenceGlobale,
        target_week: startWeek,
        duree_estimee: fiche.duree || actObj?.duree_standard || '15 min',
        consigne: fiche.description || actObj?.description || `Effectuer ${actObj?.libelle || actCode} sur ${compName}`,
        is_global_machine: false,
      };
    });

    setTaskList((prev) => [...prev, ...newItems]);
    setCustomComponentName('');
    setComponentPickerOpen(false);
  };

  const handleRemoveTask = (idTemp) => {
    setTaskList((prev) => prev.filter((t) => t.id_temp !== idTemp));
  };

  const handleUpdateTaskField = (idTemp, field, value) => {
    setTaskList((prev) =>
      prev.map((t) => {
        if (t.id_temp === idTemp) {
          const updated = { ...t, [field]: value };
          if (field === 'action_code') {
            const actObj = actions.find((a) => a.code === value);
            updated.type_intervention = actObj?.libelle || value;
          }
          return updated;
        }
        return t;
      })
    );
  };

  // Total duration calculation
  const totalMinutes = useMemo(() => {
    let sum = 0;
    taskList.forEach((t) => {
      const min = parseInt(String(t.duree_estimee).replace(/[^0-9]/g, ''), 10) || 10;
      sum += min;
    });
    if (includeGlobalMachineAction) {
      sum += 25;
    }
    return sum;
  }, [taskList, includeGlobalMachineAction]);

  // Handle Final Submission of the Plan
  const handleGeneratePlan = (e) => {
    e.preventDefault();
    if (!selectedMachineId) {
      alert('Veuillez sélectionner une machine dans la liste.');
      return;
    }

    const machObj = machines.find((m) => m.id_machine_registered === selectedMachineId || m.code_machine === selectedMachineId || m.id === selectedMachineId);
    const machCode = machObj?.code_machine || selectedMachineId;
    const machName = machObj?.nom || `Machine ${machCode}`;

    const finalTasks = taskList.map((t) => ({
      ...t,
      mode_calcul_recurrence: modeCalculRecurrence,
      type_declencheur: typeDeclencheur,
      compteur_unite: compteurUnite,
      compteur_seuil_intervalle: Number(compteurIntervalle),
      compteur_actuel: Number(compteurIndexActuel),
      compteur_prochain_declenchement: Number(compteurIndexActuel) + Number(compteurIntervalle),
    }));

    // Add global machine action if toggled
    if (includeGlobalMachineAction) {
      const actObj = actions.find((a) => a.code === globalActionCode);
      finalTasks.unshift({
        composant: 'Machine entière',
        action_code: globalActionCode,
        type_intervention: actObj?.libelle || 'Nettoyage',
        frequence: frequenceGlobale,
        target_week: startWeek,
        mode_calcul_recurrence: modeCalculRecurrence,
        type_declencheur: typeDeclencheur,
        compteur_unite: compteurUnite,
        compteur_seuil_intervalle: Number(compteurIntervalle),
        compteur_actuel: Number(compteurIndexActuel),
        compteur_prochain_declenchement: Number(compteurIndexActuel) + Number(compteurIntervalle),
        duree_estimee: '25 min',
        consigne: `Intervention globale (${actObj?.libelle || 'Nettoyage'}) sur l'ensemble du bâti et des sécurités de ${machCode}.`,
        is_global_machine: true,
      });
    }

    if (finalTasks.length === 0) {
      alert('Veuillez ajouter au moins une tâche préventive au plan.');
      return;
    }

    const planPayload = {
      id_machine: machCode,
      nom_machine: machName,
      id_zone: targetZone,
      id_technicien: targetTechnician,
      ref: planReference,
      semaine_cible: startWeek,
      date_prevue: scheduledDate,
      is_groupee: isGroupedIntervention,
      mode_calcul_recurrence: modeCalculRecurrence,
      type_declencheur: typeDeclencheur,
      compteur_unite: compteurUnite,
      compteur_seuil_intervalle: Number(compteurIntervalle),
      compteur_actuel: Number(compteurIndexActuel),
      description: planDescription,
    };

    onCreatePlanWithTasks(planPayload, finalTasks);

    if (onNavigateToMainView) {
      onNavigateToMainView();
    }
  };

  // Import Excel Handler
  const handleExcelFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsImporting(true);
    setImportStatus({ type: 'loading', message: 'Lecture et injection du fichier Excel...' });

    try {
      const importedTasks = await PreventiveService.importFromExcel(file);
      setImportStatus({
        type: 'success',
        message: `Succès ! ${importedTasks.length} tâches injectées directement dans le planning (localStorage).`,
      });
      setTimeout(() => {
        setIsImporting(false);
        setImportStatus(null);
        if (e.target) e.target.value = '';
        if (onNavigateToMainView) {
          onNavigateToMainView();
        }
      }, 1500);
    } catch (err) {
      Logger.error('Erreur import Excel:', err);
      setImportStatus({
        type: 'error',
        message: `Erreur d'import Excel: ${err?.message || 'Fichier invalide'}`,
      });
      setIsImporting(false);
    }
  };

  // Load Factory Public JSON (1175 tasks across 6 files)
  const handleLoadPublicJson = async () => {
    setIsImporting(true);
    setImportStatus({ type: 'loading', message: "Chargement des 6 fichiers JSON d'usine (/data/preventive/)..." });

    try {
      const loaded = await PreventiveService.loadFromPublicJson();
      setImportStatus({
        type: 'success',
        message: `Succès ! ${loaded.length} tâches chargées depuis les fichiers JSON publics.`,
      });
      setTimeout(() => {
        setIsImporting(false);
        setImportStatus(null);
        if (onNavigateToMainView) {
          onNavigateToMainView();
        }
      }, 1400);
    } catch (err) {
      Logger.error('Erreur chargement JSON:', err);
      setImportStatus({
        type: 'error',
        message: `Erreur: ${err?.message || 'Impossible de charger les fichiers JSON'}`,
      });
      setIsImporting(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Hidden file input for Excel */}
      <input
        type="file"
        ref={excelFileInputRef}
        onChange={handleExcelFileChange}
        accept=".xlsx, .xls, .csv"
        className="hidden"
      />

      {/* 3D TACTILE SUB-BANNER HEADER */}
      <div className="bg-white p-5 md:p-6 rounded-2xl border border-slate-200/90 shadow-[0_12px_32px_-6px_rgba(0,0,0,0.12),0_4px_12px_-2px_rgba(0,0,0,0.06)] hover:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.16),0_6px_16px_-3px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-300 ease-out flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative overflow-hidden group/gen">
        <div className="flex items-start sm:items-center gap-3.5 relative">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent border border-emerald-200/90 shadow-[0_4px_12px_rgba(16,185,129,0.12)] flex items-center justify-center text-emerald-700 shrink-0">
            <Sparkles className="w-6 h-6 text-emerald-700" />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h3 className="text-lg font-black text-slate-900 tracking-tight">
                Concepteur de Plans & Déploiement Assisté
              </h3>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-2xs">
                ASSISTANT GMAO
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
              Sélectionnez une machine : le système charge automatiquement sa Zone, son Technicien affecté et ses composants guides métier pour générer un plan clé en main.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0 self-start md:self-center">
          {/* Duration summary */}
          <div className="px-3.5 py-2 rounded-2xl bg-slate-50 border border-slate-200/90 flex items-center gap-2 text-xs font-bold text-slate-700 shadow-2xs">
            <Clock className="w-3.5 h-3.5 text-emerald-600" />
            <span>Durée : <strong className="text-emerald-700 font-mono">{totalMinutes} min ({ (totalMinutes / 60).toFixed(1) }h)</strong></span>
          </div>

          {/* 3D Action: Importer Planning Excel */}
          <Action3DButton
            variant="pill"
            color="emerald"
            icon={isImporting ? Loader2 : FileSpreadsheet}
            label={isImporting ? 'Import...' : 'Importer Excel'}
            disabled={isImporting}
            onClick={() => excelFileInputRef.current?.click()}
            title="Importer directement une matrice ou planning depuis un fichier Excel (.xlsx / .xls)"
          />

          {/* 3D Action: Pack Usine JSON */}
          <Action3DButton
            variant="circle"
            color="teal"
            icon={Download}
            disabled={isImporting}
            onClick={handleLoadPublicJson}
            title="Recharger le pack de données d'usine (1175 tâches) depuis /public/data/preventive/*.json"
          />

          {/* 3D Action: Reset Form */}
          <Action3DButton
            variant="circle"
            color="slate"
            icon={RotateCcw}
            onClick={handleReset}
            title="Réinitialiser les sélections du formulaire"
          />
        </div>
      </div>

      {/* Message de statut d'import */}
      {importStatus && (
        <div
          className={`p-3.5 rounded-xl text-xs font-bold flex items-center gap-2.5 transition-all animate-in fade-in duration-200 ${
            importStatus.type === 'loading'
              ? 'bg-amber-50 text-amber-800 border border-amber-200'
              : importStatus.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          {importStatus.type === 'loading' && <Loader2 className="w-4 h-4 animate-spin text-amber-600 shrink-0" />}
          {importStatus.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
          <span>{importStatus.message}</span>
        </div>
      )}

      {/* FORMULAIRE PRINCIPAL DE CONCEPTION (Grid 3 colonnes) */}
      <form onSubmit={handleGeneratePlan} className="space-y-5">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* COLONNE GAUCHE: IDENTIFICATION MACHINE & AUTOMATISME (STEP 1) */}
          <div className="bg-white rounded-2xl p-5 md:p-6 border border-slate-200/90 shadow-[0_12px_32px_-6px_rgba(0,0,0,0.12),0_4px_12px_-2px_rgba(0,0,0,0.06)] hover:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.16),0_6px_16px_-3px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-300 ease-out space-y-4">
            <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
              <div className="w-7 h-7 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black text-xs shadow-xs">
                1
              </div>
              <div>
                <h4 className="font-black text-slate-900 text-xs uppercase tracking-wider">
                  Équipement & Affectation
                </h4>
                <p className="text-[10.5px] text-slate-400">Détection automatique de la zone</p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Machine Cible *
              </label>
              <select
                required
                value={selectedMachineId}
                onChange={(e) => setSelectedMachineId(e.target.value)}
                className="w-full px-3 py-2.5 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all cursor-pointer"
              >
                <option value="">-- Sélectionner une Machine du Parc --</option>
                {filterActiveMachines(machines).length > 0 ? (
                  filterActiveMachines(machines).map((m) => (
                    <option key={m.id_machine_registered || m.id || m.code_machine} value={m.code_machine || m.id_machine_registered}>
                      {m.code_machine || m.id_machine_registered} - {m.nom || m.designation || 'Machine'} ({m.id_zone || m.zone || 'Zone'})
                    </option>
                  ))
                ) : (
                  <>
                    <option value="FRM-01">FRM-01 - Formeuse Hydraulique (AFM)</option>
                    <option value="TRP-01">TRP-01 - Tour à repousser CNC (Repoussage)</option>
                    <option value="SER-04">SER-04 - Sertisseuse automatique (SAT)</option>
                    <option value="DET-02">DET-02 - Détoureuse circulaire (Détourage)</option>
                    <option value="POL-03">POL-03 - Polisseuse automatique (Polissage)</option>
                  </>
                )}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[10.5px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Zone Usine (Auto)
                </label>
                <select
                  value={targetZone}
                  onChange={(e) => setTargetZone(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 font-mono focus:bg-white focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                >
                  <option value="">-- Sélectionner Zone --</option>
                  {zones.map((z) => {
                    const zName = z.id_zone || z.nom || z.code_zone || 'Zone';
                    return (
                      <option key={zName} value={zName}>
                        {zName} {z.nom && z.nom !== zName ? `- ${z.nom}` : ''}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <label className="block text-[10.5px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Technicien (Auto)
                </label>
                <select
                  value={targetTechnician}
                  onChange={(e) => setTargetTechnician(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-emerald-500 truncate cursor-pointer"
                >
                  <option value="">-- Sélectionner Technicien --</option>
                  {technicians.map((t) => {
                    const tName = t.nom || t.name || 'Technicien';
                    return (
                      <option key={t.id_technician || t.id || tName} value={tName}>
                        {tName} ({t.id_zone || t.zone || 'Usine'})
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[10.5px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Réf Plan Préventif (Norme / ISO)
              </label>
              <input
                type="text"
                value={planReference}
                onChange={(e) => setPlanReference(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-mono font-bold"
              />
            </div>

            {/* ACTION GLOBALE MACHINE TOGGLE */}
            <div className="p-3.5 bg-emerald-50/70 border border-emerald-200/90 rounded-2xl space-y-2">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeGlobalMachineAction}
                  onChange={(e) => setIncludeGlobalMachineAction(e.target.checked)}
                  className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                />
                <span className="text-xs font-black text-emerald-950">
                  Inclure Action Globale Bâti / Sécurité
                </span>
              </label>
              <p className="text-[11px] text-emerald-800 leading-relaxed">
                Applique une action globale (ex: Nettoyage complet N) à la machine sans la restreindre à un seul organe.
              </p>
              {includeGlobalMachineAction && (
                <div className="flex items-center gap-2 pt-1">
                  <span className="text-[11px] text-slate-700 font-bold">Action :</span>
                  <select
                    value={globalActionCode}
                    onChange={(e) => setGlobalActionCode(e.target.value)}
                    className="px-2.5 py-1 text-xs font-bold bg-white border border-emerald-300 rounded-lg text-emerald-900 shadow-2xs"
                  >
                    <option value="N">N - Nettoyage Général & Bâti</option>
                    <option value="V">V - Vérification globale des sécurités</option>
                    <option value="C">C - Contrôle visuel d'ensemble</option>
                    <option value="R">R - Révision complète de la machine</option>
                  </select>
                </div>
              )}

              <div className="pt-2 border-t border-emerald-200/60">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isGroupedIntervention}
                    onChange={(e) => setIsGroupedIntervention(e.target.checked)}
                    className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                  />
                  <span className="text-[11.5px] font-bold text-emerald-950">
                    Regrouper les composants sous le même Bon d'OT
                  </span>
                </label>
              </div>
            </div>
          </div>

          {/* COLONNE CENTRE & DROITE: TACHES DU PLAN ET GUIDE (STEP 2 & 3) */}
          <div className="lg:col-span-2 bg-white rounded-2xl p-5 md:p-6 border border-slate-200/90 shadow-[0_12px_32px_-6px_rgba(0,0,0,0.12),0_4px_12px_-2px_rgba(0,0,0,0.06)] hover:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.16),0_6px_16px_-3px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-300 ease-out space-y-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3 flex-wrap gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-black text-xs shadow-xs">
                    2
                  </div>
                  <div>
                    <h4 className="font-black text-slate-900 text-xs uppercase tracking-wider">
                      Composants & Tâches Associées ({taskList.length})
                    </h4>
                    <p className="text-[10.5px] text-slate-400">
                      Génération d'opérations normalisées avec durées préconisées
                    </p>
                  </div>
                </div>

                {/* BOUTON AJOUTER COMPOSANT */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setComponentPickerOpen(!componentPickerOpen)}
                    className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-xs rounded-xl border border-emerald-200 flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Ajouter un Composant</span>
                  </button>

                  {componentPickerOpen && (
                    <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl shadow-xl border border-slate-200 p-3.5 z-30 space-y-2.5 max-h-96 overflow-y-auto">
                      {machineComponents.length > 0 && (
                        <div>
                          <p className="text-[11px] font-black text-indigo-900 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                            <span>Composants de la Machine</span>
                            <span className="text-[10px] px-1.5 py-0.2 bg-indigo-50 rounded text-indigo-700 font-mono font-bold">
                              Entrepôt / Blueprints
                            </span>
                          </p>
                          <div className="space-y-1 mb-2">
                            {machineComponents.map((c, i) => (
                              <button
                                type="button"
                                key={`mach-c-${i}`}
                                onClick={() => handleAddComponentWithGuide(c.nom)}
                                className="w-full text-left px-2.5 py-1.5 text-xs rounded-xl bg-indigo-50/60 hover:bg-indigo-100 text-indigo-950 font-bold flex items-center justify-between transition-colors cursor-pointer border border-indigo-200/60"
                              >
                                <span className="truncate">{c.nom}</span>
                                <span className="text-[9.5px] px-1.5 py-0.5 rounded bg-white text-indigo-700 font-mono">
                                  {c.source}
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      <div>
                        <p className="text-[11px] font-black text-slate-800 uppercase tracking-wider mb-1.5">
                          Guides Métier Standards :
                        </p>
                        <div className="max-h-36 overflow-y-auto space-y-1">
                          {guides.map((g) => (
                            <button
                              type="button"
                              key={g.id}
                              onClick={() => handleAddComponentWithGuide(g.composant_nom)}
                              className="w-full text-left px-2.5 py-1.5 text-xs rounded-lg hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 flex items-center justify-between transition-colors cursor-pointer"
                            >
                              <span className="font-semibold truncate">{g.composant_nom}</span>
                              <span className="font-mono text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 font-bold shrink-0 ml-1">
                                {(g.actions_liees || []).join('+')}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-100 flex gap-2">
                        <input
                          type="text"
                          placeholder="Nom personnalisé..."
                          value={customComponentName}
                          onChange={(e) => setCustomComponentName(e.target.value)}
                          className="flex-1 px-2.5 py-1.5 text-xs border border-slate-200 rounded-xl"
                        />
                        <button
                          type="button"
                          onClick={() => handleAddComponentWithGuide(customComponentName)}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl cursor-pointer"
                        >
                          OK
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* LISTE DES TACHES EN COURS DE CONFIGURATION */}
              {taskList.length === 0 ? (
                <div className="text-center py-10 bg-slate-50/70 rounded-2xl border border-dashed border-slate-200 text-slate-400 text-xs">
                  Sélectionnez une machine à gauche pour charger ses composants ou cliquez sur "Ajouter un Composant".
                </div>
              ) : (
                <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
                  {taskList.map((task) => (
                    <div
                      key={task.id_temp}
                      className="p-3 bg-slate-50 hover:bg-white border border-slate-200/90 hover:border-indigo-300 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs transition-all shadow-2xs"
                    >
                      <div className="flex items-center gap-2.5 flex-1 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-900 font-mono font-black flex items-center justify-center shrink-0 border border-indigo-200">
                          {task.action_code}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 truncate">{task.composant}</span>
                            <span className="text-slate-300">•</span>
                            <span className="text-slate-600 font-medium truncate">{task.type_intervention}</span>
                          </div>
                          <p className="text-[10.5px] text-slate-400 line-clamp-1">{task.consigne}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap shrink-0">
                        {/* PDR Selector from Magasin Stock */}
                        <select
                          value={task.pdr_ref || ''}
                          onChange={(e) => handleUpdateTaskField(task.id_temp, 'pdr_ref', e.target.value)}
                          className={`px-2 py-1 text-[11px] rounded-lg border font-mono ${
                            task.pdr_ref
                              ? 'bg-amber-50 text-amber-900 border-amber-300 font-bold'
                              : 'bg-white text-slate-500 border-slate-200'
                          }`}
                          title="Pièce de rechange requise (Stock PDR Magasin)"
                        >
                          <option value="">-- Sans PDR --</option>
                          {availablePdrList.map((p) => (
                            <option key={p.ref} value={p.ref}>
                              {p.ref} ({p.stockActuel > 0 ? `Stock: ${p.stockActuel}` : 'Rupture'})
                            </option>
                          ))}
                        </select>

                        {/* Action Code selector */}
                        <select
                          value={task.action_code}
                          onChange={(e) => handleUpdateTaskField(task.id_temp, 'action_code', e.target.value)}
                          className="px-2 py-1 text-xs font-bold bg-white border border-slate-200 rounded-lg text-slate-800"
                        >
                          {actions.map((a) => (
                            <option key={a.code} value={a.code}>
                              {a.code} ({a.libelle})
                            </option>
                          ))}
                        </select>

                        {/* Frequency selector */}
                        <select
                          value={task.frequence}
                          onChange={(e) => handleUpdateTaskField(task.id_temp, 'frequence', e.target.value)}
                          className="px-2 py-1 text-xs bg-white border border-slate-200 rounded-lg text-slate-700"
                        >
                          <option value="Hebdo">Hebdo</option>
                          <option value="Mensuel">Mensuel</option>
                          <option value="Trimestriel">Trimestriel</option>
                          <option value="Semestriel">Semestriel</option>
                          <option value="Annuel">Annuel</option>
                        </select>

                        {/* Duration */}
                        <span className="text-[10.5px] font-mono text-slate-600 bg-slate-100 border border-slate-200 px-2 py-1 rounded-lg">
                          {task.duree_estimee}
                        </span>

                        {/* Remove button */}
                        <button
                          type="button"
                          onClick={() => handleRemoveTask(task.id_temp)}
                          className="p-1 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* OPTIONS DE PROGRAMMATION ET VALIDATION (STEP 3) */}
            <div className="pt-4 border-t border-slate-100 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10.5px] font-black text-slate-600 uppercase tracking-wider mb-1">
                    Semaine Cible (S1-S52)
                  </label>
                  <select
                    value={startWeek}
                    onChange={(e) => setStartWeek(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 font-mono"
                  >
                    {Array.from({ length: 52 }, (_, i) => `S${i + 1}`).map((s) => (
                      <option key={s} value={s}>
                        Semaine {s}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10.5px] font-black text-slate-600 uppercase tracking-wider mb-1">
                    Date d'intervention
                  </label>
                  <input
                    type="date"
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-[10.5px] font-black text-slate-600 uppercase tracking-wider mb-1">
                    Fréquence Récurrente
                  </label>
                  <select
                    value={frequenceGlobale}
                    onChange={(e) => setFrequenceGlobale(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="Hebdo">Hebdomadaire (Toutes les semaines)</option>
                    <option value="Mensuel">Mensuel (Toutes les 4 semaines)</option>
                    <option value="Trimestriel">Trimestriel (Toutes les 12 sem.)</option>
                    <option value="Semestriel">Semestriel (Toutes les 26 sem.)</option>
                    <option value="Annuel">Annuel</option>
                  </select>
                </div>
              </div>

              {/* LOGIQUE INDUSTRIELLE (RECURRENCE GLISSANTE & COMPTEURS) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-indigo-50/50 border border-indigo-200/70 rounded-2xl">
                <div>
                  <label className="block text-[10.5px] font-black text-indigo-950 uppercase tracking-wider mb-1">
                    Mode de Récurrence
                  </label>
                  <select
                    value={modeCalculRecurrence}
                    onChange={(e) => setModeCalculRecurrence(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-bold bg-white border border-indigo-200 rounded-xl text-indigo-900"
                  >
                    <option value="FIXE">Planning Fixe (Calendrier calendaire figé)</option>
                    <option value="GLISSANT">Planning Glissant / Dynamique (Recalcul après réalisation)</option>
                  </select>
                  <p className="text-[10px] text-indigo-700 mt-1 leading-relaxed">
                    {modeCalculRecurrence === 'FIXE' 
                      ? 'Les échéances restent ancrées aux semaines prévues du calendrier annuel.' 
                      : 'Si la tâche est effectuée avec retard (ex: S3 au lieu de S1), la prochaine sera décalée à S7.'}
                  </p>
                </div>

                <div>
                  <label className="block text-[10.5px] font-black text-indigo-950 uppercase tracking-wider mb-1">
                    Type de Déclencheur
                  </label>
                  <select
                    value={typeDeclencheur}
                    onChange={(e) => setTypeDeclencheur(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-bold bg-white border border-indigo-200 rounded-xl text-indigo-900"
                  >
                    <option value="CALENDRIER">Calendrier Périodique (Semaines / Mois)</option>
                    <option value="COMPTEUR">Compteur d'Usage (Heures / Cycles)</option>
                    <option value="HYBRIDE">Hybride (1er terme échu : Temps OU Compteur)</option>
                  </select>

                  {typeDeclencheur !== 'CALENDRIER' && (
                    <div className="grid grid-cols-3 gap-2 mt-2 pt-2 border-t border-indigo-200/60">
                      <div>
                        <span className="text-[10px] font-bold text-indigo-900 block">Unité</span>
                        <select
                          value={compteurUnite}
                          onChange={(e) => setCompteurUnite(e.target.value)}
                          className="w-full px-1.5 py-1 text-xs bg-white border border-indigo-200 rounded-lg"
                        >
                          <option value="Heures">Heures</option>
                          <option value="Cycles">Cycles</option>
                          <option value="Km">Km</option>
                        </select>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-indigo-900 block">Intervalle</span>
                        <input
                          type="number"
                          min="1"
                          value={compteurIntervalle}
                          onChange={(e) => setCompteurIntervalle(e.target.value)}
                          className="w-full px-1.5 py-1 text-xs bg-white border border-indigo-200 rounded-lg font-bold"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-indigo-900 block">Index Actuel</span>
                        <input
                          type="number"
                          min="0"
                          value={compteurIndexActuel}
                          onChange={(e) => setCompteurIndexActuel(e.target.value)}
                          className="w-full px-1.5 py-1 text-xs bg-white border border-indigo-200 rounded-lg"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* BOUTON GENERER LE PLAN */}
              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedMachineId('');
                    setTaskList([]);
                  }}
                  className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Réinitialiser</span>
                </button>

                <button
                  type="submit"
                  disabled={!selectedMachineId || taskList.length === 0}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer active:scale-95"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Générer le Plan & Programmer les Tâches</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
