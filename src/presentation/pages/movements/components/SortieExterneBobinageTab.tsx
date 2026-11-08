import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Truck,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  Wrench,
  RotateCcw,
  Printer,
  DollarSign,
  AlertTriangle,
  Zap,
  Trash2,
  X,
  PackageCheck,
  Building2,
  Calendar,
  User,
  FileSpreadsheet,
} from 'lucide-react';
import SortieExterneService from '../../../../application/services/SortieExterneService';
import { Logger } from '../../../../core/logger/LoggerService';
import GmaoIndustrialDataGrid from '../../../components/common/GmaoIndustrialDataGrid';
import { confirmAction } from '../../../../utils/confirmAction';
import { usePermission } from '../../../components/common/PermissionGate';
import { filterActiveMachines } from '../../../../utils/activeMachines';

export default function SortieExterneBobinageTab({
  sorties = [],
  onAddSortie = null,
  onUpdateSortie: _onUpdateSortie = null,
  onDeleteSortie = null,
  onMarkSortieReturned = null,
  onMarkSortieMounted = null,
  onClearSortiesForRealFactory: _onClearSortiesForRealFactory = null,
  onResetSortiesToBaseline: _onResetSortiesToBaseline = null,
  machines = [],
  warehouseItems = [],
  technicians = [],
  onAddMouvement = null, // Sync back to movement journal if desired
  showToast = null,
}) {
  const canCreateMovement = usePermission('movement.create');
  const canDeleteMovement = usePermission('movement.delete');
  const activeMachines = useMemo(() => filterActiveMachines(machines), [machines]);
  const activeTechnicians = useMemo(
    () =>
      (technicians || []).filter(
        (t) => t && t.is_active !== false && t.actif !== false && t.statut !== 'ARCHIVE'
      ),
    [technicians]
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [categorieFilter, setCategorieFilter] = useState('ALL');
  const [fournisseurFilter, setFournisseurFilter] = useState('ALL');

  // Pagination states
  const [pageSize, setPageSize] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);
  
  // Modals state
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [isMountModalOpen, setIsMountModalOpen] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [selectedSortie, setSelectedSortie] = useState(null);

  // Form State for New / Edit Sortie
  const [formData, setFormData] = useState({
    code: '',
    categorie_flux: 'SOUS_TRAITANCE_EXTERNE',
    nature_travail: 'Bobinage & Révision',
    ref: '',
    id_machine: '',
    code_moteur_reel: '',
    id_groupe: 'GRP-MOTEUR-001',
    id_family: 'FAM-MOTEUR-ELEC-001',
    id_template: '',
    ref_moteur: '',
    designation_moteur: '',
    date_demontage: new Date().toISOString().split('T')[0],
    technicien_demontage: '',
    type_probleme: 'grille',
    observation_probleme: '',
    date_expedition: new Date().toISOString().split('T')[0],
    fournisseur_externe: 'Bobinage Casa',
    date_arrivee_prevue: '',
    cout_bobinage: 0,
    note: '',
    id_corrective: '',
  });

  // Return Reception Form State
  const [returnFormData, setReturnFormData] = useState({
    date_arrivee_reelle: new Date().toISOString().split('T')[0],
    cout_bobinage: 0,
    note: 'Retour bobinage contrôlé et testé à vide OK',
    technicien_reception: '',
  });

  // Mount on Machine Form State
  const [mountFormData, setMountFormData] = useState({
    date_montage: new Date().toISOString().split('T')[0],
    technicien_montage: '',
    id_machine_cible: '',
    note: 'Moteur remonté sur la machine, rotation et intensité vérifiées OK',
  });

  // KPI Stats
  const stats = useMemo(() => {
    return SortieExterneService.getStats(sorties);
  }, [sorties]);

  // Distinct Fournisseurs
  const distinctFournisseurs = useMemo(() => {
    const set = new Set();
    sorties.forEach((s) => {
      if (s.fournisseur_externe) set.add(s.fournisseur_externe);
    });
    return Array.from(set);
  }, [sorties]);

  // Filtered List
  const filteredSorties = useMemo(() => {
    return sorties.filter((item) => {
      const isItemAtelier =
        String(item.categorie_flux || '').toUpperCase() === 'ATELIER_MECANIQUE' ||
        String(item.code || '').toUpperCase().startsWith('BON-ATEL');
      if (categorieFilter === 'ATELIER_MECANIQUE' && !isItemAtelier) return false;
      if (categorieFilter === 'SOUS_TRAITANCE_EXTERNE' && isItemAtelier) return false;

      // Status filter
      if (statusFilter === 'EN_COURS' || statusFilter === 'En réparation externe') {
        if (!SortieExterneService.isWorkshopOrderOpen(item.etat)) return false;
      } else if (statusFilter === 'Retourné OK') {
        if (item.etat !== 'Retourné OK' && item.etat !== 'Terminé Atelier OK') return false;
      } else if (statusFilter !== 'ALL' && item.etat !== statusFilter) {
        return false;
      }
      // Fournisseur filter
      if (fournisseurFilter !== 'ALL' && item.fournisseur_externe !== fournisseurFilter) return false;
      // Search query
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        (item.code && item.code.toLowerCase().includes(q)) ||
        (item.ref && item.ref.toLowerCase().includes(q)) ||
        (item.id_machine && item.id_machine.toLowerCase().includes(q)) ||
        (item.code_moteur_reel && item.code_moteur_reel.toLowerCase().includes(q)) ||
        (item.ref_moteur && item.ref_moteur.toLowerCase().includes(q)) ||
        (item.fournisseur_externe && item.fournisseur_externe.toLowerCase().includes(q)) ||
        (item.technicien_demontage && item.technicien_demontage.toLowerCase().includes(q)) ||
        (item.type_probleme && item.type_probleme.toLowerCase().includes(q)) ||
        (item.nature_travail && item.nature_travail.toLowerCase().includes(q)) ||
        (item.id_corrective && item.id_corrective.toLowerCase().includes(q))
      );
    });
  }, [sorties, categorieFilter, statusFilter, fournisseurFilter, searchQuery]);

  const totalItems = filteredSorties.length;
  const effectivePageSize = pageSize === 0 ? totalItems : pageSize;
  const startIndex = (currentPage - 1) * effectivePageSize;

  const paginatedSorties = useMemo(() => {
    if (pageSize === 0) return filteredSorties;
    return filteredSorties.slice(startIndex, startIndex + effectivePageSize);
  }, [filteredSorties, pageSize, startIndex, effectivePageSize]);

  // Prepare next code when opening new modal
  const handleOpenNewModal = (initialFlux: 'SOUS_TRAITANCE_EXTERNE' | 'ATELIER_MECANIQUE' = 'SOUS_TRAITANCE_EXTERNE') => {
    if (!canCreateMovement) return;
    const isAtelier = initialFlux === 'ATELIER_MECANIQUE';
    const nextCode = SortieExterneService.getNextCode(sorties, initialFlux);
    const defaultMachineCode =
      activeMachines.length > 0
        ? activeMachines[0].id_machine_registered || activeMachines[0].id_machine || activeMachines[0].code || ''
        : '';
    const defaultTechName =
      activeTechnicians.length > 0
        ? activeTechnicians[0].nom || activeTechnicians[0].id_technician || activeTechnicians[0].id || ''
        : '';
    setFormData({
      code: nextCode,
      categorie_flux: initialFlux,
      nature_travail: isAtelier ? 'Rectification / Usinage' : 'Bobinage & Révision',
      ref: `${isAtelier ? 'BA' : 'BS'}-${new Date().getFullYear()}-${String(sorties.length + 1).padStart(3, '0')}`,
      id_machine: defaultMachineCode,
      code_moteur_reel: isAtelier ? 'ARBRE-01' : '',
      id_groupe: isAtelier ? 'GRP-MECA-001' : 'GRP-MOTEUR-001',
      id_family: isAtelier ? 'FAM-ORGANE-MECA-001' : 'FAM-MOTEUR-ELEC-001',
      id_template: '',
      ref_moteur: '',
      designation_moteur: '',
      date_demontage: new Date().toISOString().split('T')[0],
      technicien_demontage: defaultTechName,
      type_probleme: isAtelier ? 'usinage / rectification' : 'grille',
      observation_probleme: '',
      date_expedition: new Date().toISOString().split('T')[0],
      fournisseur_externe: isAtelier ? 'Atelier Mécanique Interne' : 'Bobinage Casa',
      date_arrivee_prevue: new Date(Date.now() + (isAtelier ? 2 : 10) * 24 * 3600 * 1000).toISOString().split('T')[0],
      cout_bobinage: 0,
      note: '',
      id_corrective: '',
    });
    setIsNewModalOpen(true);
  };

  const handleSwitchModalFlux = (nextFlux: 'SOUS_TRAITANCE_EXTERNE' | 'ATELIER_MECANIQUE') => {
    const isAtelier = nextFlux === 'ATELIER_MECANIQUE';
    const nextCode = SortieExterneService.getNextCode(sorties, nextFlux);
    setFormData((prev) => ({
      ...prev,
      categorie_flux: nextFlux,
      code: nextCode,
      nature_travail: isAtelier ? 'Rectification / Usinage' : 'Bobinage & Révision',
      ref: `${isAtelier ? 'BA' : 'BS'}-${new Date().getFullYear()}-${String(sorties.length + 1).padStart(3, '0')}`,
      type_probleme: isAtelier ? 'usinage / rectification' : 'grille',
      fournisseur_externe: isAtelier ? 'Atelier Mécanique Interne' : 'Bobinage Casa',
      id_groupe: isAtelier ? 'GRP-MECA-001' : 'GRP-MOTEUR-001',
      id_family: isAtelier ? 'FAM-ORGANE-MECA-001' : 'FAM-MOTEUR-ELEC-001',
    }));
  };

  // Motor / Organ selection autofill
  const handleSelectMoteur = (codeMot) => {
    const found = warehouseItems.find((w) => w.code === codeMot || w.id_warehouse_item === codeMot);
    if (found) {
      setFormData((prev) => ({
        ...prev,
        code_moteur_reel: found.code || codeMot,
        ref_moteur: found.ref || prev.ref_moteur,
        designation_moteur: found.designation || found.libelle || prev.designation_moteur,
        id_machine: found.id_machine || found.emplacement || prev.id_machine,
        id_template: found.id_template || prev.id_template,
      }));
    } else {
      setFormData((prev) => ({ ...prev, code_moteur_reel: codeMot }));
    }
  };

  // Submit new / edited sortie
  const handleSubmitSortie = (e) => {
    e.preventDefault();
    if (!canCreateMovement) return;
    try {
      let created;
      if (onAddSortie) {
        created = onAddSortie(formData);
      } else {
        created = SortieExterneService.addSortie(formData);
      }
      setIsNewModalOpen(false);
      if (showToast && created) {
        const isAtel = String(created.categorie_flux || '').toUpperCase() === 'ATELIER_MECANIQUE';
        showToast(
          `${isAtel ? "Bon d'Atelier" : 'Sortie Externe'} ${created.code || ''} enregistré(e) avec succès !`,
          'success'
        );
      }

      // Sync with global movements if available
      if (onAddMouvement && created) {
        const isAtel = String(created.categorie_flux || '').toUpperCase() === 'ATELIER_MECANIQUE';
        onAddMouvement({
          type: 'Sortie Externe',
          action_id: isAtel ? 'ATELIER_RECTIFICATION' : 'REPARATION_EXTERNE',
          code_bon: created.code,
          ref: created.ref_moteur || created.code_moteur_reel,
          designation: `[${isAtel ? 'ATELIER' : 'BOBINAGE'}] ${created.designation_moteur || created.code_moteur_reel} - Machine ${created.id_machine}`,
          quantite: 1,
          unit: 'pcs',
          fournisseur: created.fournisseur_externe,
          demandeur: created.technicien_demontage,
          date: created.date_expedition,
          commentaire: `${isAtel ? 'Bon réalisation atelier' : 'Sortie bobinage'} (${created.type_probleme}). Réf : ${created.ref}`,
        });
      }
    } catch (err) {
      Logger.error('Erreur creation sortie externe:', err);
      if (showToast) {
        showToast('Erreur lors de la création de la fiche.', 'error');
      }
    }
  };

  // Handle Mark as Returned
  const handleOpenReturnModal = (sortie) => {
    if (!canCreateMovement) return;
    setSelectedSortie(sortie);
    const isAtel =
      String(sortie?.categorie_flux || '').toUpperCase() === 'ATELIER_MECANIQUE' ||
      String(sortie?.code || '').toUpperCase().startsWith('BON-ATEL');
    setReturnFormData({
      date_arrivee_reelle: new Date().toISOString().split('T')[0],
      cout_bobinage: sortie.cout_bobinage || 0,
      note:
        sortie.note ||
        (isAtel
          ? 'Usinage / Rectification terminé(e) et cotes contrôlées OK'
          : 'Retour bobinage contrôlé conforme, vernis et roulements neufs'),
      technicien_reception:
        activeTechnicians.length > 0
          ? activeTechnicians[0].nom || activeTechnicians[0].id_technician || activeTechnicians[0].id || ''
          : '',
    });
    setIsReturnModalOpen(true);
  };

  const handleConfirmReturn = (e) => {
    e.preventDefault();
    if (!canCreateMovement || !selectedSortie) return;
    if (onMarkSortieReturned) {
      onMarkSortieReturned(selectedSortie.id, returnFormData);
    } else {
      SortieExterneService.markAsReturned(selectedSortie.id, returnFormData);
    }
    setIsReturnModalOpen(false);
    if (showToast) showToast(`Organe ${selectedSortie.code_moteur_reel} marqué comme Retourné / Terminé OK !`, 'success');
  };

  // Handle Mark as Mounted
  const handleOpenMountModal = (sortie) => {
    if (!canCreateMovement) return;
    setSelectedSortie(sortie);
    setMountFormData({
      date_montage: new Date().toISOString().split('T')[0],
      technicien_montage:
        activeTechnicians.length > 0
          ? activeTechnicians[0].nom || activeTechnicians[0].id_technician || activeTechnicians[0].id || ''
          : '',
      id_machine_cible: sortie.id_machine || '',
      note: 'Organe / Moteur remonté sur la machine et testé en charge OK',
    });
    setIsMountModalOpen(true);
  };

  const handleConfirmMount = (e) => {
    e.preventDefault();
    if (!canCreateMovement || !selectedSortie) return;
    if (onMarkSortieMounted) {
      onMarkSortieMounted(selectedSortie.id, mountFormData);
    } else {
      SortieExterneService.markAsMounted(selectedSortie.id, mountFormData);
    }
    setIsMountModalOpen(false);
    if (showToast) showToast(`Organe ${selectedSortie.code_moteur_reel} remonté sur ${mountFormData.id_machine_cible} avec succès !`, 'success');
  };

  // Delete sortie
  const handleDeleteSortie = async (sortie) => {
    if (!canDeleteMovement) return;
    if (
      await confirmAction({
        title: 'Supprimer la fiche de sortie',
        message: `Confirmer la suppression de la fiche ${sortie.code} (${sortie.code_moteur_reel}) ?`,
        variant: 'danger',
      })
    ) {
      if (onDeleteSortie) {
        onDeleteSortie(sortie.id);
      } else {
        SortieExterneService.deleteSortie(sortie.id);
      }
      if (showToast) showToast(`Fiche ${sortie.code} supprimée.`, 'info');
    }
  };

  // Print Bon de Sortie Modal
  const handleOpenPrintModal = (sortie) => {
    setSelectedSortie(sortie);
    setIsPrintModalOpen(true);
  };

  // Helper Badge Render
  const renderStatusBadge = (etat) => {
    switch (etat) {
      case 'En réparation externe':
      case 'En cours atelier':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            {etat}
          </span>
        );
      case 'Retourné OK':
      case 'Terminé Atelier OK':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-indigo-50 text-indigo-800 border border-indigo-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" />
            Retourné OK (Atelier)
          </span>
        );
      case 'Monté':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            Monté sur Machine
          </span>
        );
      case 'En stock':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
            <PackageCheck className="w-3.5 h-3.5 text-slate-500" />
            En stock de réserve
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600">
            {etat}
          </span>
        );
    }
  };

  const renderProblemeBadge = (prob) => {
    const p = String(prob || '').toLowerCase();
    if (p.includes('grill') || p.includes('brûl')) {
      return (
        <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1">
          <Zap className="w-3 h-3 text-rose-500" />
          Grillé / Bobinage
        </span>
      );
    }
    if (p.includes('masse') || p.includes('isolement')) {
      return (
        <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
          <AlertTriangle className="w-3 h-3 text-amber-500" />
          Masse Électrique
        </span>
      );
    }
    if (p.includes('usinage') || p.includes('rectif') || p.includes('tournage') || p.includes('soudure') || p.includes('confection')) {
      return (
        <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-indigo-50 text-indigo-800 border border-indigo-200 flex items-center gap-1">
          <Wrench className="w-3 h-3 text-indigo-600" />
          {prob}
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200 flex items-center gap-1">
        <Wrench className="w-3 h-3 text-purple-500" />
        {prob || 'Mécanique'}
      </span>
    );
  };

  const bobinageColumns = useMemo(
    () => [
      {
        key: 'code',
        label: 'CODE / BON ATELIER',
        colLetter: 'Col A',
        icon: FileSpreadsheet,
        render: (item) => {
          const isAtel =
            String(item.categorie_flux || '').toUpperCase() === 'ATELIER_MECANIQUE' ||
            String(item.code || '').toUpperCase().startsWith('BON-ATEL');
          return (
            <div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span
                  className={`font-mono font-bold text-xs px-2 py-0.5 rounded border ${
                    isAtel
                      ? 'text-indigo-900 bg-indigo-50 border-indigo-200'
                      : 'text-purple-900 bg-purple-50 border-purple-200'
                  }`}
                >
                  {item.code}
                </span>
                {item.id_corrective && (
                  <span
                    className="font-mono text-[10px] font-bold text-amber-900 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-300"
                    title="Bon de Travail Correctif Lié"
                  >
                    BT: {item.id_corrective}
                  </span>
                )}
              </div>
              <div className="text-[10px] text-slate-400 font-mono mt-0.5 flex items-center gap-1">
                <span>Réf Bon :</span>
                <b className="text-slate-600">{item.ref}</b>
              </div>
            </div>
          );
        },
      },
      {
        key: 'machine_moteur',
        label: 'MACHINE & ORGANE / MOTEUR',
        colLetter: 'Col B',
        icon: Wrench,
        render: (item) => (
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-mono font-bold text-xs text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                {item.id_machine}
              </span>
              <span className="font-mono font-bold text-xs text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                {item.code_moteur_reel}
              </span>
            </div>
            <div className="text-[11px] text-slate-600 font-medium truncate max-w-[220px] mt-0.5" title={item.designation_moteur || item.ref_moteur}>
              {item.designation_moteur || item.ref_moteur || item.nature_travail || 'Organe Mécanique / Moteur'}
            </div>
          </div>
        ),
      },
      {
        key: 'probleme',
        label: 'TRAVAIL / DIAGNOSTIC',
        colLetter: 'Col C',
        icon: AlertTriangle,
        render: (item) => (
          <div>
            {renderProblemeBadge(item.type_probleme || item.nature_travail)}
            {item.observation_probleme && (
              <div className="text-[10px] text-slate-500 italic mt-0.5 truncate max-w-[180px]" title={item.observation_probleme}>
                {item.observation_probleme}
              </div>
            )}
          </div>
        ),
      },
      {
        key: 'demontage_expedition',
        label: 'DÉMONTAGE & EXPÉDITION',
        colLetter: 'Col D',
        icon: Calendar,
        render: (item) => (
          <div>
            <div className="text-[11px] text-slate-800 font-semibold flex items-center gap-1">
              <Calendar className="w-3 h-3 text-slate-400" />
              <span>Sortie : {item.date_expedition || item.date_demontage}</span>
            </div>
            <div className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
              <User className="w-3 h-3 text-slate-400" />
              <span>Démonté par : <b>{item.technicien_demontage || 'Non spécifié'}</b></span>
            </div>
          </div>
        ),
      },
      {
        key: 'fournisseur_arrivee',
        label: 'ATELIER / PRESTATAIRE',
        colLetter: 'Col E',
        icon: Building2,
        render: (item) => (
          <div>
            <div className="font-bold text-xs text-slate-900 flex items-center gap-1">
              <Building2 className="w-3 h-3 text-purple-600" />
              <span>{item.fournisseur_externe}</span>
            </div>
            <div className="text-[10.5px] mt-0.5">
              {item.date_arrivee_reelle ? (
                <span className="text-emerald-700 font-medium">
                  Terminé le : <b>{item.date_arrivee_reelle}</b>
                </span>
              ) : (
                <span className="text-amber-700 font-medium">
                  Prévu le : <b>{item.date_arrivee_prevue || 'En cours'}</b>
                </span>
              )}
            </div>
          </div>
        ),
      },
      {
        key: 'cout_bobinage',
        label: 'COÛT (DH)',
        colLetter: 'Col F',
        icon: DollarSign,
        align: 'right',
        render: (item) => (
          <span className="font-mono font-bold text-xs text-slate-900">
            {Number(item.cout_bobinage || 0).toLocaleString('fr-FR')} <span className="text-[10px] text-slate-400">DH</span>
          </span>
        ),
      },
      {
        key: 'etat',
        label: 'STATUT DU FLUX',
        colLetter: 'Col G',
        icon: PackageCheck,
        align: 'center',
        render: (item) => (
          <div>
            {renderStatusBadge(item.etat)}
            {item.etat === 'Monté' && item.technicien_montage && (
              <div className="text-[10px] text-slate-500 mt-0.5">
                Remonté par {item.technicien_montage}
              </div>
            )}
          </div>
        ),
      },
      {
        key: 'actions',
        label: 'ACTIONS GMAO',
        colLetter: 'Col H',
        icon: Zap,
        align: 'right',
        render: (item) => (
          <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
            {SortieExterneService.isWorkshopOrderOpen(item.etat) && (
              <button
                type="button"
                onClick={() => handleOpenReturnModal(item)}
                className="px-2 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-[10.5px] flex items-center gap-1 transition cursor-pointer border border-indigo-200"
                title="Réceptionner / Valider fin d'usinage ou de réparation"
              >
                <RotateCcw className="w-3 h-3 text-indigo-600" />
                <span>Réceptionner</span>
              </button>
            )}

            {(item.etat === 'Retourné OK' || item.etat === 'Terminé Atelier OK') && (
              <button
                type="button"
                onClick={() => handleOpenMountModal(item)}
                className="px-2 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-[10.5px] flex items-center gap-1 transition cursor-pointer border border-emerald-200"
                title="Remonter l'organe ou le moteur sur sa machine"
              >
                <Wrench className="w-3 h-3 text-emerald-600" />
                <span>Monter</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => handleOpenPrintModal(item)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              title="Imprimer / Afficher Bon d'Atelier ou de Sortie"
            >
              <Printer className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={() => handleDeleteSortie(item)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
              title="Supprimer la fiche"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ),
      },
    ],
    []
  );

  return (
    <div className="space-y-6">
      {/* 1. TOP STATS BAR (KPIS EN DIRECT) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {/* Total Sorties & Bons Atelier */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold uppercase text-slate-500">Total Atelier & Ext.</div>
            <div className="text-xl font-extrabold text-slate-900 font-mono mt-0.5">{stats.total}</div>
            <div className="text-[10px] text-slate-400 font-semibold">
              {stats.atelierCount || 0} Atelier · {stats.externeCount ?? stats.total} Ext.
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-100 text-purple-600 flex items-center justify-center font-bold">
            <Truck className="w-5 h-5" />
          </div>
        </div>

        {/* En Cours (Atelier ou Externe) */}
        <div className="bg-white p-4 rounded-2xl border border-amber-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold uppercase text-amber-600">En Cours (Usinage/Ext.)</div>
            <div className="text-xl font-extrabold text-amber-900 font-mono mt-0.5 flex items-center gap-1.5">
              <span>{stats.enCours}</span>
              {stats.enCours > 0 && (
                <span className="text-[10px] font-semibold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded-full">
                  Actif
                </span>
              )}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center font-bold">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        {/* Retournés OK */}
        <div className="bg-white p-4 rounded-2xl border border-indigo-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold uppercase text-indigo-600">Terminés / Retournés OK</div>
            <div className="text-xl font-extrabold text-indigo-900 font-mono mt-0.5">{stats.retournes}</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center font-bold">
            <RotateCcw className="w-5 h-5" />
          </div>
        </div>

        {/* Montés / En Service */}
        <div className="bg-white p-4 rounded-2xl border border-emerald-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold uppercase text-emerald-600">Montés sur Machine</div>
            <div className="text-xl font-extrabold text-emerald-900 font-mono mt-0.5">{stats.montes}</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center font-bold">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        {/* Total Coût Réparation & Usinage */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between col-span-2 sm:col-span-1">
          <div>
            <div className="text-[11px] font-bold uppercase text-slate-500">Coût Total Réalisation</div>
            <div className="text-xl font-extrabold text-purple-900 font-mono mt-0.5">
              {stats.totalCout.toLocaleString('fr-FR')} <span className="text-xs text-purple-600 font-normal">DH</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-100 text-purple-600 flex items-center justify-center font-bold">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* 2. TOOLBAR & CONTROLS */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Rechercher par Machine (POA-08), Organe/Moteur, Usinage/Rectification, Prestataire, BT..."
              className="w-full h-10 pl-10 pr-4 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white text-xs font-semibold text-slate-800 placeholder-slate-400 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/15 outline-none transition"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setCurrentPage(1);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Actions: Nouveau Bon d'Atelier & Nouvelle Sortie Externe */}
          {canCreateMovement && (
            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              <button
                type="button"
                data-testid="new-bon-atelier-btn"
                onClick={() => handleOpenNewModal('ATELIER_MECANIQUE')}
                className="h-10 px-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow-sm"
              >
                <Wrench className="w-4 h-4" />
                <span>Bon d’Atelier / Rectification</span>
              </button>
              <button
                type="button"
                data-testid="new-sortie-externe-btn"
                onClick={() => handleOpenNewModal('SOUS_TRAITANCE_EXTERNE')}
                className="h-10 px-3.5 rounded-xl bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow-sm"
              >
                <Plus className="w-4 h-4" />
                <span>Sortie Externe / Bobinage</span>
              </button>
            </div>
          )}
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 text-xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase mr-1 flex items-center gap-1">
            <Filter className="w-3 h-3" />
            Flux :
          </span>
          <button
            type="button"
            onClick={() => {
              setCategorieFilter('ALL');
              setCurrentPage(1);
            }}
            className={`px-2.5 py-1 rounded-lg font-bold text-xs transition cursor-pointer ${
              categorieFilter === 'ALL'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            Tous ({sorties.length})
          </button>
          <button
            type="button"
            onClick={() => {
              setCategorieFilter('ATELIER_MECANIQUE');
              setCurrentPage(1);
            }}
            className={`px-2.5 py-1 rounded-lg font-bold text-xs transition cursor-pointer ${
              categorieFilter === 'ATELIER_MECANIQUE'
                ? 'bg-indigo-100 text-indigo-900 border border-indigo-300'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            Atelier & Rectification ({stats.atelierCount || 0})
          </button>
          <button
            type="button"
            onClick={() => {
              setCategorieFilter('SOUS_TRAITANCE_EXTERNE');
              setCurrentPage(1);
            }}
            className={`px-2.5 py-1 rounded-lg font-bold text-xs transition cursor-pointer ${
              categorieFilter === 'SOUS_TRAITANCE_EXTERNE'
                ? 'bg-purple-100 text-purple-900 border border-purple-300'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            Sous-Traitance & Bobinage ({stats.externeCount ?? sorties.length})
          </button>

          <span className="text-slate-300 mx-1">|</span>

          <button
            type="button"
            onClick={() => {
              setStatusFilter('ALL');
              setCurrentPage(1);
            }}
            className={`px-2.5 py-1 rounded-lg font-bold text-xs transition cursor-pointer ${
              statusFilter === 'ALL'
                ? 'bg-purple-100 text-purple-900 border border-purple-300'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            Tous Statuts
          </button>

          <button
            type="button"
            onClick={() => {
              setStatusFilter('En réparation externe');
              setCurrentPage(1);
            }}
            className={`px-2.5 py-1 rounded-lg font-bold text-xs transition cursor-pointer ${
              statusFilter === 'En réparation externe'
                ? 'bg-amber-100 text-amber-900 border border-amber-300'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            En Cours ({stats.enCours})
          </button>

          <button
            type="button"
            onClick={() => {
              setStatusFilter('Retourné OK');
              setCurrentPage(1);
            }}
            className={`px-2.5 py-1 rounded-lg font-bold text-xs transition cursor-pointer ${
              statusFilter === 'Retourné OK'
                ? 'bg-indigo-100 text-indigo-900 border border-indigo-300'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            Terminés OK ({stats.retournes})
          </button>

          <button
            type="button"
            onClick={() => {
              setStatusFilter('Monté');
              setCurrentPage(1);
            }}
            className={`px-2.5 py-1 rounded-lg font-bold text-xs transition cursor-pointer ${
              statusFilter === 'Monté'
                ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            Montés ({stats.montes})
          </button>

          {/* Prestataire Dropdown */}
          {distinctFournisseurs.length > 0 && (
            <div className="ml-auto flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-slate-400 uppercase">Prestataire :</span>
              <select
                value={fournisseurFilter}
                onChange={(e) => {
                  setFournisseurFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="h-7 px-2 rounded-lg border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700 outline-none cursor-pointer"
              >
                <option value="ALL">Tous les Prestataires</option>
                {distinctFournisseurs.map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* 3. Unified Industrial Data Grid for Sorties Externes & Bons Atelier */}
      <GmaoIndustrialDataGrid
        title="Tableau Travaux_Atelier_&_Sorties_Externes • Suivi Usinage, Rectification & Bobinage"
        icon={<Truck className="w-4 h-4 text-purple-600" />}
        excelMapping="N° | Code & BT Lié (A) | Machine & Organe (B) | Travail / Diagnostic (C) | Démontage (D) | Atelier/Prestataire (E) | Coût (F) | Statut (G) | Actions (H)"
        bannerColor="purple"
        columns={bobinageColumns}
        data={paginatedSorties}
        startIndex={startIndex}
        showRowNumber={true}
        emptyIcon={<Truck className="w-8 h-8 text-slate-300" />}
        emptyMessage="Aucun bon d'atelier ou sortie externe correspondant."
        pagination={{
          currentPage,
          setCurrentPage,
          pageSize,
          setPageSize,
          totalItems,
          pageSizeOptions: [25, 50, 100, 200, 0],
          color: 'purple',
          itemLabel: 'bons / sorties',
        }}
      />

      {/* 4. MODAL: NOUVEAU BON D'ATELIER / SORTIE EXTERNE */}
      <AnimatePresence>
        {isNewModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-2xl w-full p-6 space-y-5 my-8"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-purple-50 border border-purple-200 text-purple-700 flex items-center justify-center font-bold">
                    {formData.categorie_flux === 'ATELIER_MECANIQUE' ? (
                      <Wrench className="w-5 h-5 text-indigo-600" />
                    ) : (
                      <Truck className="w-5 h-5" />
                    )}
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-slate-900">
                      {formData.categorie_flux === 'ATELIER_MECANIQUE'
                        ? 'Nouveau Bon de Réalisation / Rectification (Atelier Mécanique)'
                        : 'Nouvelle Sortie Externe / Bobinage'}
                    </h3>
                    <p className="text-xs text-slate-500">
                      {formData.categorie_flux === 'ATELIER_MECANIQUE'
                        ? 'Usinage, tournage, rectification, soudure ou confection de pièce rattachée à une machine et un BT.'
                        : 'Formulaire de sortie pour rebobinage moteur ou réparation chez sous-traitant externe.'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsNewModalOpen(false)}
                  className="w-8 h-8 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Flux Category Switcher */}
              <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-slate-100 border border-slate-200">
                <button
                  type="button"
                  onClick={() => handleSwitchModalFlux('ATELIER_MECANIQUE')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer ${
                    formData.categorie_flux === 'ATELIER_MECANIQUE'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Wrench className="w-3.5 h-3.5" />
                  <span>Bon d’Atelier / Rectification</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSwitchModalFlux('SOUS_TRAITANCE_EXTERNE')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer ${
                    formData.categorie_flux === 'SOUS_TRAITANCE_EXTERNE'
                      ? 'bg-purple-700 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Truck className="w-3.5 h-3.5" />
                  <span>Sous-Traitance / Bobinage</span>
                </button>
              </div>

              {/* Form Body */}
              <form onSubmit={handleSubmitSortie} className="space-y-4">
                {/* Identification Codes */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-purple-50/40 p-3.5 rounded-2xl border border-purple-100">
                  <div>
                    <label className="block text-[10.5px] font-bold text-purple-900 uppercase mb-1">
                      Code Interne (Automatique)
                    </label>
                    <input
                      type="text"
                      value={formData.code}
                      readOnly
                      className="w-full h-8 px-3 rounded-xl border border-purple-200 bg-white font-mono font-bold text-xs text-purple-900 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[10.5px] font-bold text-slate-700 uppercase mb-1">
                      Réf Bon Atelier / Externe
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.ref}
                      onChange={(e) => setFormData({ ...formData, ref: e.target.value })}
                      placeholder="ex: BA-2026-001 ou BS-2026-123"
                      className="w-full h-8 px-3 rounded-xl border border-slate-200 bg-white font-mono font-bold text-xs text-slate-800 outline-none focus:border-purple-500"
                    />
                  </div>
                </div>

                {/* Machine & Motor/Organ Selection */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10.5px] font-bold text-slate-700 uppercase mb-1">
                      Machine / Équipement d'Origine
                    </label>
                    <select
                      value={formData.id_machine}
                      onChange={(e) => setFormData({ ...formData, id_machine: e.target.value })}
                      className="w-full h-8 px-3 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-800 outline-none focus:bg-white focus:border-purple-500"
                    >
                      <option value="">-- Sélectionner une machine --</option>
                      {activeMachines.map((m) => {
                        const machCode = m.id_machine_registered || m.id_machine || m.code || m.id;
                        return (
                          <option key={machCode} value={machCode}>
                            {machCode} - {m.nom || m.designation || 'Machine'}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10.5px] font-bold text-slate-700 uppercase mb-1">
                      {formData.categorie_flux === 'ATELIER_MECANIQUE'
                        ? 'Code Organe / Pièce à Usiner'
                        : 'Code Moteur / Organe Réel'}
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.code_moteur_reel}
                      onChange={(e) => handleSelectMoteur(e.target.value)}
                      placeholder={
                        formData.categorie_flux === 'ATELIER_MECANIQUE'
                          ? 'ex: ARBRE-01, ROULEAU-02, BAGUE-A'
                          : 'ex: mot 23, mot 01, mot 41'
                      }
                      className="w-full h-8 px-3 rounded-xl border border-slate-200 bg-slate-50 text-xs font-mono font-bold text-slate-800 outline-none focus:bg-white focus:border-purple-500"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[10.5px] font-bold text-slate-700 uppercase mb-1">
                      {formData.categorie_flux === 'ATELIER_MECANIQUE'
                        ? 'Cotes d’Usinage / Spécifications Techniques'
                        : 'Plaque Signalétique / Réf & Caractéristiques du Moteur'}
                    </label>
                    <input
                      type="text"
                      value={formData.ref_moteur}
                      onChange={(e) => setFormData({ ...formData, ref_moteur: e.target.value })}
                      placeholder={
                        formData.categorie_flux === 'ATELIER_MECANIQUE'
                          ? 'ex: Rectification portée Ø45h6, rechargement soudure + tournage...'
                          : 'ex: Siemens 1LA7 7,5KW 10HP 2900tr/min 380V'
                      }
                      className="w-full h-8 px-3 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-800 outline-none focus:bg-white focus:border-purple-500"
                    />
                  </div>
                </div>

                {/* Problem Diagnostic & Démontage */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10.5px] font-bold text-slate-700 uppercase mb-1">
                      Nature du Travail / Défaut
                    </label>
                    <select
                      value={formData.type_probleme}
                      onChange={(e) => setFormData({ ...formData, type_probleme: e.target.value })}
                      className="w-full h-8 px-3 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-800 outline-none focus:bg-white focus:border-purple-500"
                    >
                      <optgroup label="Atelier Mécanique (Usinage & Rectification)">
                        <option value="usinage / rectification">Usinage / Rectification</option>
                        <option value="tournage arbre / axe">Tournage arbre / axe</option>
                        <option value="soudure / chaudronnerie">Soudure / Rechargement</option>
                        <option value="confection pièce sur mesure">Confection pièce sur mesure</option>
                        <option value="révision mécanique / alésage">Révision mécanique / Alésage</option>
                      </optgroup>
                      <optgroup label="Bobinage & Électromécanique">
                        <option value="grille">grille (bobinage brûlé)</option>
                        <option value="la masse électrique">la masse électrique</option>
                        <option value="problème du marche">problème du marche</option>
                        <option value="d'équilibrage">d'équilibrage rotor</option>
                        <option value="roulement bruyant">roulement bruyant</option>
                        <option value="surchauffe stator">surchauffe stator</option>
                      </optgroup>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10.5px] font-bold text-slate-700 uppercase mb-1">
                      Date Démontage
                    </label>
                    <input
                      type="date"
                      value={formData.date_demontage}
                      onChange={(e) => setFormData({ ...formData, date_demontage: e.target.value })}
                      className="w-full h-8 px-3 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-800 outline-none focus:bg-white focus:border-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[10.5px] font-bold text-slate-700 uppercase mb-1">
                      Technicien Demandeur
                    </label>
                    <select
                      value={formData.technicien_demontage}
                      onChange={(e) => setFormData({ ...formData, technicien_demontage: e.target.value })}
                      className="w-full h-8 px-3 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-800 outline-none focus:bg-white focus:border-purple-500"
                    >
                      <option value="">-- Sélectionner un technicien --</option>
                      {activeTechnicians.map((t) => (
                        <option key={t.id || t.id_technician || t.nom} value={t.nom || t.id}>
                          {t.nom || t.id}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Observation */}
                <div>
                  <label className="block text-[10.5px] font-bold text-slate-700 uppercase mb-1">
                    Instructions d'Atelier / Observation détaillée
                  </label>
                  <input
                    type="text"
                    value={formData.observation_probleme}
                    onChange={(e) => setFormData({ ...formData, observation_probleme: e.target.value })}
                    placeholder="ex: Usure portée roulement, rectification cylindre + ajustement clavette..."
                    className="w-full h-8 px-3 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-800 outline-none focus:bg-white focus:border-purple-500"
                  />
                </div>

                {/* Expedition & Sous-traitant / Atelier */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10.5px] font-bold text-slate-700 uppercase mb-1">
                      Atelier Exécutant / Prestataire
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.fournisseur_externe}
                      onChange={(e) => setFormData({ ...formData, fournisseur_externe: e.target.value })}
                      placeholder="ex: Atelier Mécanique Interne, Bobinage Casa..."
                      className="w-full h-8 px-3 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-800 outline-none focus:bg-white focus:border-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[10.5px] font-bold text-slate-700 uppercase mb-1">
                      Date de Lancement
                    </label>
                    <input
                      type="date"
                      value={formData.date_expedition}
                      onChange={(e) => setFormData({ ...formData, date_expedition: e.target.value })}
                      className="w-full h-8 px-3 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-800 outline-none focus:bg-white focus:border-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[10.5px] font-bold text-slate-700 uppercase mb-1">
                      Date Fin / Retour Prévue
                    </label>
                    <input
                      type="date"
                      value={formData.date_arrivee_prevue}
                      onChange={(e) => setFormData({ ...formData, date_arrivee_prevue: e.target.value })}
                      className="w-full h-8 px-3 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-800 outline-none focus:bg-white focus:border-purple-500"
                    />
                  </div>
                </div>

                {/* Coût estimé & BT Correctif lié */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10.5px] font-bold text-slate-700 uppercase mb-1">
                      Coût Estimé / Forfait Atelier (DH)
                    </label>
                    <input
                      type="number"
                      value={formData.cout_bobinage}
                      onChange={(e) => setFormData({ ...formData, cout_bobinage: Number(e.target.value) })}
                      className="w-full h-8 px-3 rounded-xl border border-slate-200 bg-slate-50 text-xs font-mono font-bold text-slate-800 outline-none focus:bg-white focus:border-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[10.5px] font-bold text-slate-700 uppercase mb-1">
                      Lien N° Bon de Travail (BT Correctif)
                    </label>
                    <input
                      type="text"
                      value={formData.id_corrective}
                      onChange={(e) => setFormData({ ...formData, id_corrective: e.target.value })}
                      placeholder="ex: BT-3474"
                      className="w-full h-8 px-3 rounded-xl border border-slate-200 bg-slate-50 text-xs font-mono font-bold text-slate-800 outline-none focus:bg-white focus:border-purple-500"
                    />
                  </div>
                </div>

                {/* Footer Buttons */}
                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsNewModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs transition cursor-pointer shadow-sm flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Enregistrer la Sortie Externe</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 5. MODAL: RÉCEPTION RETOUR BOBINAGE */}
      <AnimatePresence>
        {isReturnModalOpen && selectedSortie && (
          <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center font-bold">
                    <RotateCcw className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-slate-900">Réception Retour Bobinage</h3>
                    <p className="text-xs text-slate-500 font-mono">
                      {selectedSortie.code} — {selectedSortie.code_moteur_reel} ({selectedSortie.id_machine})
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsReturnModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleConfirmReturn} className="space-y-3">
                <div>
                  <label className="block text-[10.5px] font-bold text-slate-700 uppercase mb-1">
                    Date d'Arrivée Réelle à l'Atelier
                  </label>
                  <input
                    type="date"
                    required
                    value={returnFormData.date_arrivee_reelle}
                    onChange={(e) => setReturnFormData({ ...returnFormData, date_arrivee_reelle: e.target.value })}
                    className="w-full h-8 px-3 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-800 outline-none focus:bg-white focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-[10.5px] font-bold text-slate-700 uppercase mb-1">
                    Coût Final de Facturation (DH)
                  </label>
                  <input
                    type="number"
                    required
                    value={returnFormData.cout_bobinage}
                    onChange={(e) => setReturnFormData({ ...returnFormData, cout_bobinage: Number(e.target.value) })}
                    className="w-full h-8 px-3 rounded-xl border border-slate-200 bg-slate-50 text-xs font-mono font-bold text-slate-800 outline-none focus:bg-white focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-[10.5px] font-bold text-slate-700 uppercase mb-1">
                    Observation de Contrôle & Test à Vide
                  </label>
                  <textarea
                    rows={2}
                    value={returnFormData.note}
                    onChange={(e) => setReturnFormData({ ...returnFormData, note: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-800 outline-none focus:bg-white focus:border-indigo-500"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsReturnModalOpen(false)}
                    className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Valider Réception OK</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 6. MODAL: REMONTER SUR MACHINE */}
      <AnimatePresence>
        {isMountModalOpen && selectedSortie && (
          <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center font-bold">
                    <Wrench className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-slate-900">Remontage Moteur sur Machine</h3>
                    <p className="text-xs text-slate-500 font-mono">
                      {selectedSortie.code_moteur_reel} — Destination : {selectedSortie.id_machine}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsMountModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleConfirmMount} className="space-y-3">
                <div>
                  <label className="block text-[10.5px] font-bold text-slate-700 uppercase mb-1">
                    Machine Cible
                  </label>
                  <input
                    type="text"
                    required
                    value={mountFormData.id_machine_cible}
                    onChange={(e) => setMountFormData({ ...mountFormData, id_machine_cible: e.target.value })}
                    className="w-full h-8 px-3 rounded-xl border border-slate-200 bg-slate-50 text-xs font-mono font-bold text-slate-800 outline-none focus:bg-white focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-[10.5px] font-bold text-slate-700 uppercase mb-1">
                    Technicien Monteur
                  </label>
                  <select
                    value={mountFormData.technicien_montage}
                    onChange={(e) => setMountFormData({ ...mountFormData, technicien_montage: e.target.value })}
                    className="w-full h-8 px-3 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-800 outline-none focus:bg-white focus:border-emerald-500"
                  >
                    <option value="">-- Sélectionner un technicien --</option>
                    {activeTechnicians.map((t) => (
                      <option key={t.id || t.id_technician || t.nom} value={t.nom || t.id}>
                        {t.nom || t.id}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10.5px] font-bold text-slate-700 uppercase mb-1">
                    Date de Remontage
                  </label>
                  <input
                    type="date"
                    required
                    value={mountFormData.date_montage}
                    onChange={(e) => setMountFormData({ ...mountFormData, date_montage: e.target.value })}
                    className="w-full h-8 px-3 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-800 outline-none focus:bg-white focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-[10.5px] font-bold text-slate-700 uppercase mb-1">
                    Observation / Rapport de Remise en Service
                  </label>
                  <textarea
                    rows={2}
                    value={mountFormData.note}
                    onChange={(e) => setMountFormData({ ...mountFormData, note: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-800 outline-none focus:bg-white focus:border-emerald-500"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsMountModalOpen(false)}
                    className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Confirmer Mise en Service</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 7. MODAL: BON DE SORTIE OFFICIEL (POUR IMPRESSION) */}
      <AnimatePresence>
        {isPrintModalOpen && selectedSortie && (
          <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-xl w-full p-6 space-y-5 my-6 text-slate-800"
            >
              {/* Entête Document */}
              <div className="border-b-2 border-slate-900 pb-4 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold uppercase tracking-widest text-slate-500">Service Maintenance Industrielle</div>
                  <h2 className="text-lg font-black text-slate-950 uppercase tracking-tight">Bon de Sortie Réparation / Bobinage</h2>
                  <div className="font-mono text-xs font-bold text-purple-900 mt-0.5">
                    N° Bon : {selectedSortie.code} | Réf : {selectedSortie.ref}
                  </div>
                </div>
                <div className="text-right text-xs">
                  <div className="font-bold text-slate-900">Date d'Émission</div>
                  <div className="font-mono text-slate-600">{selectedSortie.date_expedition || selectedSortie.date_demontage}</div>
                </div>
              </div>

              {/* Contenu Industriel */}
              <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <div>
                  <div className="text-slate-400 font-bold uppercase text-[10px]">Machine Émettrice</div>
                  <div className="font-bold text-slate-900 text-sm">{selectedSortie.id_machine}</div>
                </div>
                <div>
                  <div className="text-slate-400 font-bold uppercase text-[10px]">Code Moteur / Composant</div>
                  <div className="font-bold text-purple-900 text-sm font-mono">{selectedSortie.code_moteur_reel}</div>
                </div>
                <div className="col-span-2">
                  <div className="text-slate-400 font-bold uppercase text-[10px]">Désignation & Caractéristiques Techniques</div>
                  <div className="font-medium text-slate-800">{selectedSortie.designation_moteur || selectedSortie.ref_moteur}</div>
                </div>
                <div>
                  <div className="text-slate-400 font-bold uppercase text-[10px]">Sous-Traitant Destinataire</div>
                  <div className="font-bold text-slate-900">{selectedSortie.fournisseur_externe}</div>
                </div>
                <div>
                  <div className="text-slate-400 font-bold uppercase text-[10px]">Date Retour Prévue</div>
                  <div className="font-bold text-slate-900">{selectedSortie.date_arrivee_prevue || 'À convenir'}</div>
                </div>
              </div>

              {/* Diagnostic Panne */}
              <div className="p-3.5 rounded-2xl border border-amber-200 bg-amber-50/50 text-xs space-y-1">
                <div className="font-bold text-amber-900 uppercase text-[10px]">Motif de Sortie & Symptôme Constaté</div>
                <div className="font-semibold text-amber-950">Type : {selectedSortie.type_probleme}</div>
                <div className="text-slate-600 italic">{selectedSortie.observation_probleme || 'Rebobinage complet du bobinage stator et remplacement roulements.'}</div>
              </div>

              {/* Signature Blocks */}
              <div className="grid grid-cols-3 gap-2 pt-4 border-t border-slate-200 text-center text-[10px]">
                <div className="p-2 rounded-xl border border-slate-200 bg-slate-50 space-y-4">
                  <div className="font-bold text-slate-600">Démonté par</div>
                  <div className="font-medium text-slate-900">{selectedSortie.technicien_demontage || 'Technicien'}</div>
                </div>
                <div className="p-2 rounded-xl border border-slate-200 bg-slate-50 space-y-4">
                  <div className="font-bold text-slate-600">Visa Responsable GMAO</div>
                  <div className="font-medium text-slate-900">Approuvé</div>
                </div>
                <div className="p-2 rounded-xl border border-slate-200 bg-slate-50 space-y-4">
                  <div className="font-bold text-slate-600">Réception Bobineur</div>
                  <div className="font-medium text-slate-400">Signature & Cachet</div>
                </div>
              </div>

              {/* Print Action */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsPrintModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  Fermer
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center gap-2"
                >
                  <Printer className="w-4 h-4" />
                  <span>Imprimer le Bon de Sortie</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
