import { useState, useMemo } from 'react';
import AnimatedPage from '../../components/common/AnimatedPage';
import {
  GitBranch,
  Wrench,
  Boxes,
  Plus,
  Trash2,
  Edit2,
  Copy,
  AlertTriangle,
  CheckCircle2,
  Search,
  FileSpreadsheet,
  Zap,
  MapPin,
  Cpu,
  ShieldAlert,
  X,
} from 'lucide-react';
import * as XLSX from 'xlsx';

/**
 * NexusView — Registre Central des Éléments & BOM Machines
 * Architecture Single Source of Truth (SSOT) pour la nomenclature des machines
 */
export default function NexusView({
  machines = [],
  zones = [],
  families = [],
  _templates = [],
  stockItems = [],
  warehouseItems = [],
  partTypes = [],
  _mouvements = [],
  machineElementsLedger = [],
  onAddMachineElement,
  onUpdateMachineElement,
  onDeleteMachineElement,
  onDuplicateBOMToTwins,
  onNavigate = () => {},
  showToast,
}) {
  const [selectedMachineId, setSelectedMachineId] = useState(() => {
    return machines[0]?.id_machine_registered || 'DET-01';
  });

  const [machineSearch, setMachineSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL'); // 'ALL' | 'PDR' | 'COMPONENT' | 'PART' | 'CRITICAL' | 'ALERT'
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingElement, setEditingElement] = useState(null);

  // Formulaire d'ajout / modification d'un élément
  const [formData, setFormData] = useState({
    element_type: 'PDR',
    ref_element: '',
    designation: '',
    qte_montee: 1,
    unite: 'U',
    criticalite: 'CRITIQUE',
    duree_vie_estimee_heures: 5000,
    heures_actuelles: 0,
    date_installation: new Date().toISOString().split('T')[0],
    emplacement_machine: '',
    technicien: 'tech',
    statut: 'OPERATIONNEL',
    remarques: '',
  });

  // Machine active sélectionnée
  const activeMachine = useMemo(() => {
    return machines.find((m) => m.id_machine_registered === selectedMachineId) || machines[0] || null;
  }, [selectedMachineId, machines]);

  // Zone et famille de la machine active
  const activeZone = useMemo(() => {
    if (!activeMachine) return null;
    return zones.find((z) => z.id_zone === activeMachine.id_zone_default || z.code_zone === activeMachine.id_zone_default);
  }, [activeMachine, zones]);

  const activeFamily = useMemo(() => {
    if (!activeMachine) return null;
    return families.find((f) => f.id_family === activeMachine.id_family);
  }, [activeMachine, families]);

  // Liste filtrée des machines pour le sélecteur
  const filteredMachinesList = useMemo(() => {
    if (!machineSearch.trim()) return machines;
    const q = machineSearch.toLowerCase();
    return machines.filter(
      (m) =>
        (m.id_machine_registered && m.id_machine_registered.toLowerCase().includes(q)) ||
        (m.designation && m.designation.toLowerCase().includes(q)) ||
        (m.id_zone_default && m.id_zone_default.toLowerCase().includes(q))
    );
  }, [machines, machineSearch]);

  // Éléments du BOM Ledger rattachés à la machine active
  const currentMachineElements = useMemo(() => {
    if (!activeMachine) return [];
    return machineElementsLedger.filter(
      (item) => item.id_machine_registered === activeMachine.id_machine_registered
    );
  }, [activeMachine, machineElementsLedger]);

  // Filtrage selon le type et la recherche
  const displayedElements = useMemo(() => {
    return currentMachineElements.filter((item) => {
      // Type filter
      if (typeFilter === 'PDR' && item.element_type !== 'PDR') return false;
      if (typeFilter === 'COMPONENT' && item.element_type !== 'COMPONENT') return false;
      if (typeFilter === 'PART' && item.element_type !== 'PART') return false;
      if (typeFilter === 'CRITICAL' && item.criticalite !== 'CRITIQUE') return false;
      if (typeFilter === 'ALERT' && item.statut !== 'A_REMPLACER') return false;

      // Search term
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchRef = (item.ref_element || '').toLowerCase().includes(q);
        const matchDesig = (item.designation || '').toLowerCase().includes(q);
        const matchLoc = (item.emplacement_machine || '').toLowerCase().includes(q);
        if (!matchRef && !matchDesig && !matchLoc) return false;
      }

      return true;
    });
  }, [currentMachineElements, typeFilter, searchTerm]);

  // Machines jumelles (Twins) partageant le même template ou famille
  const twinMachines = useMemo(() => {
    if (!activeMachine) return [];
    return machines.filter(
      (m) =>
        m.id_machine_registered !== activeMachine.id_machine_registered &&
        m.id_templates === activeMachine.id_templates &&
        m.id_family === activeMachine.id_family
    );
  }, [activeMachine, machines]);

  // KPI globaux et pour la machine active
  const kpis = useMemo(() => {
    const totalMounted = currentMachineElements.length;
    const criticalCount = currentMachineElements.filter((e) => e.criticalite === 'CRITIQUE').length;
    const alertCount = currentMachineElements.filter((e) => e.statut === 'A_REMPLACER').length;
    const totalWorkshopElements = machineElementsLedger.length;

    return {
      totalMounted,
      criticalCount,
      alertCount,
      totalWorkshopElements,
    };
  }, [currentMachineElements, machineElementsLedger]);

  // Suggestions automatiques lors du choix de référence
  const referenceOptions = useMemo(() => {
    if (formData.element_type === 'PDR') {
      return stockItems.map((s) => ({
        ref: s.ref || s.id_article,
        designation: s.designation || s.nom || '',
        stock: s.stockActuel ?? s.stock_actuel ?? s.qte ?? 0,
      }));
    }
    if (formData.element_type === 'COMPONENT') {
      return warehouseItems.map((w) => ({
        ref: w.id_warehouse_item || w.ref || '',
        designation: w.designation || '',
        stock: w.quantite ?? 1,
      }));
    }
    return partTypes.map((p) => ({
      ref: p.id_part_type || p.code || '',
      designation: p.designation || p.libelle || '',
      stock: 1,
    }));
  }, [formData.element_type, stockItems, warehouseItems, partTypes]);

  // Ouvrir modal d'ajout
  const handleOpenAddModal = () => {
    setEditingElement(null);
    setFormData({
      element_type: 'PDR',
      ref_element: '',
      designation: '',
      qte_montee: 1,
      unite: 'U',
      criticalite: 'CRITIQUE',
      duree_vie_estimee_heures: 5000,
      heures_actuelles: 0,
      date_installation: new Date().toISOString().split('T')[0],
      emplacement_machine: '',
      technicien: 'tech',
      statut: 'OPERATIONNEL',
      remarques: '',
    });
    setIsAddModalOpen(true);
  };

  // Ouvrir modal de modification
  const handleOpenEditModal = (element) => {
    setEditingElement(element);
    setFormData({
      element_type: element.element_type || 'PDR',
      ref_element: element.ref_element || '',
      designation: element.designation || '',
      qte_montee: element.qte_montee || 1,
      unite: element.unite || 'U',
      criticalite: element.criticalite || 'CRITIQUE',
      duree_vie_estimee_heures: element.duree_vie_estimee_heures || 5000,
      heures_actuelles: element.heures_actuelles || 0,
      date_installation: element.date_installation || new Date().toISOString().split('T')[0],
      emplacement_machine: element.emplacement_machine || '',
      technicien: element.technicien || 'tech',
      statut: element.statut || 'OPERATIONNEL',
      remarques: element.remarques || '',
    });
    setIsAddModalOpen(true);
  };

  // Sauvegarder élément (Ajout ou Mise à jour)
  const handleSaveElement = (e) => {
    e.preventDefault();
    if (!formData.ref_element.trim()) {
      showToast?.('Veuillez sélectionner ou saisir une référence valide.', 'error');
      return;
    }

    if (editingElement) {
      onUpdateMachineElement?.(editingElement.id, formData);
      showToast?.(`Élément ${formData.ref_element} mis à jour avec succès.`, 'success');
    } else {
      onAddMachineElement?.({
        ...formData,
        id_machine_registered: activeMachine.id_machine_registered,
      });
      showToast?.(`Élément ${formData.ref_element} rattaché à la machine ${activeMachine.id_machine_registered}.`, 'success');
    }

    setIsAddModalOpen(false);
  };

  // Duplication vers les machines jumelles
  const handleCloneToTwins = () => {
    if (!twinMachines.length) {
      showToast?.('Aucune machine jumelle détectée pour ce modèle.', 'info');
      return;
    }
    const twinIds = twinMachines.map((m) => m.id_machine_registered);
    onDuplicateBOMToTwins?.(activeMachine.id_machine_registered, twinIds);
    showToast?.(`Nomenclature dupliquée avec succès vers ${twinIds.length} machines jumelles (${twinIds.join(', ')}).`, 'success');
  };

  // Exporter la nomenclature de la machine ou du registre entier en Excel
  const handleExportBOMExcel = () => {
    try {
      const wb = XLSX.utils.book_new();

      // Feuille 1 : Machine active BOM
      const currentBOMData = currentMachineElements.map((item) => ({
        'Machine ID': item.id_machine_registered,
        Type: item.element_type,
        'Référence Élément': item.ref_element,
        Désignation: item.designation,
        'Qté Montée': item.qte_montee,
        Unité: item.unite,
        'Emplacement Machine': item.emplacement_machine,
        Criticité: item.criticalite,
        'Durée de Vie (H)': item.duree_vie_estimee_heures,
        'Heures Actuelles': item.heures_actuelles,
        'Date Installation': item.date_installation,
        Technicien: item.technicien,
        Statut: item.statut,
        Remarques: item.remarques,
      }));
      const wsCurrent = XLSX.utils.json_to_sheet(currentBOMData);
      XLSX.utils.book_append_sheet(wb, wsCurrent, `BOM_${activeMachine.id_machine_registered}`);

      // Feuille 2 : Registre Complet Atelier
      const fullBOMData = machineElementsLedger.map((item) => ({
        'Machine ID': item.id_machine_registered,
        Type: item.element_type,
        'Référence Élément': item.ref_element,
        Désignation: item.designation,
        'Qté Montée': item.qte_montee,
        Unité: item.unite,
        'Emplacement Machine': item.emplacement_machine,
        Criticité: item.criticalite,
        'Durée de Vie (H)': item.duree_vie_estimee_heures,
        'Heures Actuelles': item.heures_actuelles,
        'Date Installation': item.date_installation,
        Technicien: item.technicien,
        Statut: item.statut,
        Remarques: item.remarques,
      }));
      const wsFull = XLSX.utils.json_to_sheet(fullBOMData);
      XLSX.utils.book_append_sheet(wb, wsFull, 'REGISTRE_BOM_COMPLET');

      XLSX.writeFile(wb, `GMAO_Nexus_BOM_${activeMachine.id_machine_registered}.xlsx`);
      showToast?.('Nomenclature BOM exportée avec succès en Excel.', 'success');
    } catch {
      showToast?.("Erreur lors de l'export Excel.", 'error');
    }
  };

  return (
    <AnimatedPage className="space-y-6 max-w-7xl mx-auto p-1 sm:p-2 text-slate-800">
      {/* 1. EN-TÊTE PRINCIPAL (Format Light UI Excel) */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
            <GitBranch className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-bold text-slate-900">
                Nexus Matrix : Registre Central des Éléments & BOM Machines
              </h2>
              <span className="text-xs text-slate-400">·</span>
              <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                Single Source of Truth
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1 max-w-3xl leading-relaxed">
              Point central de rattachement des pièces de rechange (PDR), composants et organes mécaniques montés sur chaque machine enregistrée.
            </p>
          </div>
        </div>

        {/* Boutons d'action globaux */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleExportBOMExcel}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-2xs transition active:scale-95 cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Exporter BOM (Excel)</span>
          </button>

          <button
            type="button"
            onClick={handleOpenAddModal}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Monter un Élément</span>
          </button>
        </div>
      </div>

      {/* 2. KPI CARDS BANNER */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Éléments sur cette Machine
          </div>
          <div className="text-xl font-bold font-mono text-slate-900 mt-1">
            {kpis.totalMounted}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">
            Machine : {activeMachine?.id_machine_registered}
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Pièces Critiques
          </div>
          <div className="text-xl font-bold font-mono text-amber-600 mt-1">
            {kpis.criticalCount}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">
            Surveillance renforcée
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Alertes Remplacement
          </div>
          <div className="text-xl font-bold font-mono text-rose-600 mt-1">
            {kpis.alertCount}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">
            Cycle de vie dépassé
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Total Registre Usine
          </div>
          <div className="text-xl font-bold font-mono text-emerald-700 mt-1">
            {kpis.totalWorkshopElements}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">
            Toutes machines confondues
          </div>
        </div>
      </div>

      {/* 3. BARRE DE SÉLECTION DE LA MACHINE ET FICHE TECHNIQUE */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-emerald-600" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Machine Enregistrée Sélectionnée
            </h3>
          </div>

          {/* Recherche rapide dans la liste des machines */}
          <div className="flex items-center gap-2 w-full md:w-auto">
            <div className="relative flex-1 md:w-72">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Chercher code machine (ex: DET-01, PRH-01)..."
                value={machineSearch}
                onChange={(e) => setMachineSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-hidden focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <select
              value={selectedMachineId}
              onChange={(e) => setSelectedMachineId(e.target.value)}
              className="py-1.5 px-3 text-xs font-bold rounded-lg border border-slate-200 bg-slate-50 focus:outline-hidden focus:border-emerald-500"
            >
              {filteredMachinesList.map((m) => (
                <option key={m.id_machine_registered} value={m.id_machine_registered}>
                  {m.id_machine_registered} {m.designation ? `— ${m.designation}` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Fiche synthétique de la machine */}
        {activeMachine && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 p-3.5 rounded-xl bg-slate-50/80 border border-slate-200/80 text-xs">
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Identifiant</span>
              <span className="font-mono font-bold text-slate-900">{activeMachine.id_machine_registered}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Désignation</span>
              <span className="font-semibold text-slate-800 truncate block">
                {activeMachine.designation || activeMachine.nom || 'Équipement de Production'}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Zone / Atelier</span>
              <span className="font-medium text-slate-700 flex items-center gap-1">
                <MapPin className="w-3 h-3 text-slate-400" />
                {activeZone?.nom || activeZone?.code_zone || activeMachine.id_zone_default || 'Atelier'}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Modèle & Famille</span>
              <span className="font-medium text-slate-700 truncate block">
                {activeMachine.id_templates || 'Standard'} {activeFamily ? `(${activeFamily.nom || activeFamily.libelle || activeFamily.name})` : ''}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Statut Machine</span>
              <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                {activeMachine.status || 'OPÉRATIONNEL'}
              </span>
            </div>
          </div>
        )}

        {/* Alerte machines jumelles (Twin Machines) */}
        {twinMachines.length > 0 && (
          <div className="flex items-center justify-between p-3 rounded-xl bg-blue-50/70 border border-blue-200 text-xs">
            <div className="flex items-center gap-2">
              <Boxes className="w-4 h-4 text-blue-600" />
              <span>
                <b>{twinMachines.length} Machine(s) jumelle(s) détectée(s)</b> de même modèle ({twinMachines.map((t) => t.id_machine_registered).join(', ')}).
              </span>
            </div>

            <button
              type="button"
              onClick={handleCloneToTwins}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-2xs transition active:scale-95 cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Cloner la Nomenclature vers les Sœurs</span>
            </button>
          </div>
        )}
      </div>

      {/* 4. TABLEAU DE LA NOMENCLATURE ET DES ÉLÉMENTS MONTÉS */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          {/* Filtres par onglets */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
            {[
              { id: 'ALL', label: `Tous (${currentMachineElements.length})` },
              { id: 'PDR', label: `PDR (${currentMachineElements.filter((e) => e.element_type === 'PDR').length})` },
              { id: 'COMPONENT', label: `Composants (${currentMachineElements.filter((e) => e.element_type === 'COMPONENT').length})` },
              { id: 'PART', label: `Organes (${currentMachineElements.filter((e) => e.element_type === 'PART').length})` },
              { id: 'CRITICAL', label: `Critiques (${currentMachineElements.filter((e) => e.criticalite === 'CRITIQUE').length})` },
              { id: 'ALERT', label: `À Remplacer (${currentMachineElements.filter((e) => e.statut === 'A_REMPLACER').length})` },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setTypeFilter(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer shrink-0 ${
                  typeFilter === tab.id
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200/80'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Recherche dans la nomenclature */}
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Filtrer éléments montés..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-hidden focus:border-emerald-500"
            />
          </div>
        </div>

        {/* Grille des éléments */}
        {displayedElements.length === 0 ? (
          <div className="text-center py-12 px-4 border border-dashed border-slate-200 rounded-xl space-y-3">
            <Boxes className="w-10 h-10 text-slate-300 mx-auto" />
            <div className="text-xs font-bold text-slate-700">Aucun élément monté ne correspond aux critères</div>
            <p className="text-[11px] text-slate-400 max-w-md mx-auto">
              Utilisez le bouton "Monter un Élément" pour rattacher des pièces de rechange (PDR), distributeurs, courroies ou roulements à cette machine.
            </p>
            <button
              type="button"
              onClick={handleOpenAddModal}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 shadow-2xs transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Monter le premier élément</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px]">
                <tr>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3">Référence & Désignation</th>
                  <th className="py-2.5 px-3">Emplacement Machine</th>
                  <th className="py-2.5 px-3 text-center">Qté Montée</th>
                  <th className="py-2.5 px-3">Criticité</th>
                  <th className="py-2.5 px-3">Usure Estimée</th>
                  <th className="py-2.5 px-3">Statut</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {displayedElements.map((item) => {
                  const lifeRatio = Math.min(100, Math.round(((item.heures_actuelles || 0) / (item.duree_vie_estimee_heures || 1)) * 100));
                  const isHighWear = lifeRatio >= 85 || item.statut === 'A_REMPLACER';

                  return (
                    <tr key={item.id} className={`transition ${isHighWear ? 'bg-rose-50/40 hover:bg-rose-50/70' : 'hover:bg-slate-50/70'}`}>
                      {/* Type Badge */}
                      <td className="py-3 px-3 shrink-0">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                            item.element_type === 'PDR'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : item.element_type === 'COMPONENT'
                              ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                              : 'bg-purple-50 text-purple-700 border border-purple-200'
                          }`}
                        >
                          {item.element_type}
                        </span>
                      </td>

                      {/* Réf & Désignation */}
                      <td className="py-3 px-3 max-w-xs">
                        <div className="font-mono font-bold text-slate-900">{item.ref_element}</div>
                        <div className="text-[11px] text-slate-500 truncate">{item.designation}</div>
                      </td>

                      {/* Emplacement */}
                      <td className="py-3 px-3 text-slate-600 font-medium">
                        {item.emplacement_machine || 'Non spécifié'}
                      </td>

                      {/* Quantité */}
                      <td className="py-3 px-3 text-center font-mono font-bold text-slate-800">
                        {item.qte_montee} {item.unite || 'U'}
                      </td>

                      {/* Criticité */}
                      <td className="py-3 px-3">
                        <span
                          className={`inline-flex items-center gap-1 text-[11px] font-semibold ${
                            item.criticalite === 'CRITIQUE'
                              ? 'text-rose-600'
                              : item.criticalite === 'MAJEURE'
                              ? 'text-amber-600'
                              : 'text-slate-600'
                          }`}
                        >
                          {item.criticalite === 'CRITIQUE' && <ShieldAlert className="w-3.5 h-3.5" />}
                          {item.criticalite}
                        </span>
                      </td>

                      {/* Cycle de Vie / RUL Prédictif */}
                      <td className="py-3 px-3 w-40">
                        {(() => {
                          const maxH = item.duree_vie_estimee_heures || 5000;
                          const currentH = item.heures_actuelles || 0;
                          const remainingH = Math.max(0, maxH - currentH);
                          const rulPercent = Math.max(0, Math.min(100, Math.round((remainingH / maxH) * 100)));

                          return (
                            <div className="space-y-1">
                              <div className="flex items-center justify-between text-[10px] font-mono text-slate-600 font-semibold">
                                <span className={rulPercent <= 15 ? 'text-rose-600 font-bold' : ''}>
                                  RUL: {remainingH} h
                                </span>
                                <span className="text-slate-400 font-normal">({rulPercent}%)</span>
                              </div>
                              <div className="w-full h-1.5 rounded-full bg-slate-200 overflow-hidden" title={`Usure : ${currentH}h / ${maxH}h (RUL: ${remainingH}h)`}>
                                <div
                                  className={`h-full rounded-full transition-all duration-300 ${
                                    rulPercent <= 15
                                      ? 'bg-rose-500'
                                      : rulPercent <= 40
                                      ? 'bg-amber-500'
                                      : 'bg-emerald-500'
                                  }`}
                                  style={{ width: `${100 - rulPercent}%` }}
                                />
                              </div>
                            </div>
                          );
                        })()}
                      </td>

                      {/* Statut */}
                      <td className="py-3 px-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold ${
                            item.statut === 'A_REMPLACER'
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : item.statut === 'EN_REVISION'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          }`}
                        >
                          {item.statut === 'A_REMPLACER' && <AlertTriangle className="w-3 h-3" />}
                          {item.statut === 'OPERATIONNEL' && <CheckCircle2 className="w-3 h-3" />}
                          {item.statut || 'OPERATIONNEL'}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Remplacer via Mouvement Rapide */}
                          <button
                            type="button"
                            onClick={() => {
                              onNavigate?.('stock');
                              showToast?.(`Aller au Stock PDR pour préparer la sortie de ${item.ref_element}.`, 'info');
                            }}
                            title="Remplacer cette pièce via Mouvement Rapide"
                            className="p-1.5 rounded-lg text-emerald-700 hover:bg-emerald-50 border border-transparent hover:border-emerald-200 transition cursor-pointer"
                          >
                            <Zap className="w-3.5 h-3.5" />
                          </button>

                          {/* Édition */}
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(item)}
                            title="Modifier les caractéristiques"
                            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition cursor-pointer"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          {/* Suppression */}
                          <button
                            type="button"
                            onClick={() => {
                              if (window.confirm(`Détacher ${item.ref_element} de la machine ${activeMachine.id_machine_registered} ?`)) {
                                onDeleteMachineElement?.(item.id);
                                showToast?.(`Élément ${item.ref_element} détaché du registre.`, 'info');
                              }
                            }}
                            title="Détacher de la machine"
                            className="p-1.5 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 transition cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 5. MODAL INTERACTIF D'AJOUT / MODIFICATION D'UN ÉLÉMENT */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-xl w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Wrench className="w-5 h-5 text-emerald-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  {editingElement ? 'Modifier l’Élément Monté' : `Monter un Élément sur ${activeMachine.id_machine_registered}`}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveElement} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                {/* Type de pièce */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Type d'Élément</label>
                  <select
                    value={formData.element_type}
                    onChange={(e) => setFormData({ ...formData, element_type: e.target.value, ref_element: '', designation: '' })}
                    className="w-full p-2 rounded-lg border border-slate-200 focus:outline-hidden focus:border-emerald-500"
                  >
                    <option value="PDR">Pièce de Rechange (PDR)</option>
                    <option value="COMPONENT">Composant Déplaçable</option>
                    <option value="PART">Organe / Pièce Spécifique</option>
                  </select>
                </div>

                {/* Criticité */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Niveau de Criticité</label>
                  <select
                    value={formData.criticalite}
                    onChange={(e) => setFormData({ ...formData, criticalite: e.target.value })}
                    className="w-full p-2 rounded-lg border border-slate-200 focus:outline-hidden focus:border-emerald-500"
                  >
                    <option value="CRITIQUE">Critique (Arrêt Ligne Immédiat)</option>
                    <option value="MAJEURE">Majeure (Dégradation Performance)</option>
                    <option value="MINEURE">Mineure (Accessoire)</option>
                  </select>
                </div>
              </div>

              {/* Sélection ou Saisie de la référence */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Référence de la Pièce / Organe
                </label>
                <div className="space-y-1.5">
                  <select
                    value={formData.ref_element}
                    onChange={(e) => {
                      const selectedRef = e.target.value;
                      const found = referenceOptions.find((o) => o.ref === selectedRef);
                      setFormData({
                        ...formData,
                        ref_element: selectedRef,
                        designation: found?.designation || formData.designation,
                      });
                    }}
                    className="w-full p-2 rounded-lg border border-slate-200 focus:outline-hidden focus:border-emerald-500 font-mono text-xs"
                  >
                    <option value="">-- Choisir depuis le Stock / Catalogue ({referenceOptions.length} dispo) --</option>
                    {referenceOptions.map((opt) => (
                      <option key={opt.ref} value={opt.ref}>
                        {opt.ref} — {opt.designation} (Stock: {opt.stock})
                      </option>
                    ))}
                  </select>

                  <input
                    type="text"
                    placeholder="Ou saisir une référence libre..."
                    value={formData.ref_element}
                    onChange={(e) => setFormData({ ...formData, ref_element: e.target.value })}
                    className="w-full p-2 rounded-lg border border-slate-200 focus:outline-hidden focus:border-emerald-500 font-mono text-xs"
                  />
                </div>
              </div>

              {/* Désignation */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Désignation Complète</label>
                <input
                  type="text"
                  placeholder="ex: Roulement à billes SKF 6204 2RS C3"
                  value={formData.designation}
                  onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                  className="w-full p-2 rounded-lg border border-slate-200 focus:outline-hidden focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                {/* Quantité montée */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Quantité Montée</label>
                  <input
                    type="number"
                    min="1"
                    value={formData.qte_montee}
                    onChange={(e) => setFormData({ ...formData, qte_montee: Number(e.target.value) || 1 })}
                    className="w-full p-2 rounded-lg border border-slate-200 focus:outline-hidden focus:border-emerald-500 font-mono"
                  />
                </div>

                {/* Durée de vie estimée */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Vie Estimée (Heures)</label>
                  <input
                    type="number"
                    min="100"
                    step="500"
                    value={formData.duree_vie_estimee_heures}
                    onChange={(e) => setFormData({ ...formData, duree_vie_estimee_heures: Number(e.target.value) || 5000 })}
                    className="w-full p-2 rounded-lg border border-slate-200 focus:outline-hidden focus:border-emerald-500 font-mono"
                  />
                </div>

                {/* Heures actuelles */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Heures Actuelles</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.heures_actuelles}
                    onChange={(e) => setFormData({ ...formData, heures_actuelles: Number(e.target.value) || 0 })}
                    className="w-full p-2 rounded-lg border border-slate-200 focus:outline-hidden focus:border-emerald-500 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Emplacement machine */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Emplacement sur Machine</label>
                  <input
                    type="text"
                    placeholder="ex: Palier droit arbre primaire"
                    value={formData.emplacement_machine}
                    onChange={(e) => setFormData({ ...formData, emplacement_machine: e.target.value })}
                    className="w-full p-2 rounded-lg border border-slate-200 focus:outline-hidden focus:border-emerald-500"
                  />
                </div>

                {/* Statut */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Statut Opérationnel</label>
                  <select
                    value={formData.statut}
                    onChange={(e) => setFormData({ ...formData, statut: e.target.value })}
                    className="w-full p-2 rounded-lg border border-slate-200 focus:outline-hidden focus:border-emerald-500"
                  >
                    <option value="OPERATIONNEL">Opérationnel (En service)</option>
                    <option value="A_REMPLACER">À Remplacer Prochainement</option>
                    <option value="EN_REVISION">En Révision / Contrôle</option>
                  </select>
                </div>
              </div>

              {/* Boutons d'action du formulaire */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-3.5 py-2 rounded-xl font-semibold bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 transition cursor-pointer"
                >
                  Annuler
                </button>

                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition active:scale-95 cursor-pointer"
                >
                  {editingElement ? 'Enregistrer les Modifications' : 'Monter cet Élément'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AnimatedPage>
  );
}
