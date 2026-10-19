import { useState, useMemo } from 'react';
import AnimatedPage from '../../components/common/AnimatedPage';
import SortieEntreeIcon from '../../components/common/SortieEntreeIcon';
import DashboardKPIs from './components/DashboardKPIs';
import Action3DButton from '../../components/common/Action3DButton';
import FormulasModalButton from '../../components/common/FormulasModalButton';
import { useSmartTableLoader } from '../../hooks/useSmartTableLoader';
import TableSkeletonRows from '../../components/common/TableSkeletonRows';
import {
  Package,
  AlertTriangle,
  XCircle,
  TrendingDown,
  TrendingUp,
  ArrowRight,
  Plus,
  ShoppingCart,
  Clock,
  FileSpreadsheet,
  Layers,
  ChevronRight,
  Trash2,
  ShieldCheck,
  Zap,
  Warehouse,
  Inbox,
  CheckCircle2,
  Check,
  Truck,
  Activity,
  Factory,
  UserCheck,
  LayoutDashboard,
  Calculator,
  Wrench,
  X,
  ShieldAlert,
} from 'lucide-react';
import { dataIntegrityService } from '../../../services/dataIntegrityService';

export default function DashboardView({
  stockItems = [],
  machines = [],
  warehouseItems: _warehouseItems = [],
  mouvements = [],
  types = [],
  diagnostics: _diagnostics = [],
  zones: _zones = [],
  technicians = [],
  operations = [],
  stockKPIs = {
    totalArticles: 0,
    totalStockActuel: 0,
    totalEntrees: 0,
    totalSorties: 0,
    ruptures: 0,
    alertes: 0,
    ok: 0,
  },
  onNavigateToStock,
  onNavigateToMachines,
  onNavigateToWarehouse,
  onNavigateToSortie,
  onNavigateToPreventive: _onNavigateToPreventive,
  onNavigateToCorrective,
  onNavigateToZones,
  onNavigateToUsers,
  onNavigateToSettings,
  correctiveInterventions = [],
  correctiveKpis: _correctiveKpis = null,
  onQuickSortie,
  onAddMouvement,
  onUpdateMouvement,
  onDeleteMouvement,
  onExportExcel,
}) {
  // --- Modals State ---
  const [showFormulasModal, setShowFormulasModal] = useState(false);
  const [formulaTab, setFormulaTab] = useState('stock'); // 'stock' | 'kpi'
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [orderForm, setOrderForm] = useState({
    ref: '',
    designation: '',
    quantite: 5,
    order_nature: 'STOCK_PERMANENT', // 'STOCK_PERMANENT' | 'ACHAT_UNIQUE'
    fournisseur: '',
    technicien: '',
    id_zone: '',
    id_machine_registered: '',
    commentaire: 'Demande de réapprovisionnement',
    code_bon: '',
  });

  const [orderFilterTab, setOrderFilterTab] = useState('ALL'); // 'ALL' | 'PENDING' | 'RECEIVED'
  const [selectedArticleForOrder, setSelectedArticleForOrder] = useState(null);

  // Filter alert & rupture items
  const alertAndRuptureItems = useMemo(() => {
    return stockItems.filter((s) => s.alerte === 'RUPTURE' || s.alerte === 'ALERTE');
  }, [stockItems]);

  // Filter purchase orders (Commandes & Réapprovisionnements)
  const allOrders = useMemo(() => {
    return mouvements.filter(
      (m) =>
        m.type === 'COMMANDE' ||
        m.action_id === 'COMMANDE' ||
        (Array.isArray(m.tags) && m.tags.includes('#COMMANDE_EN_ATTENTE')) ||
        (Array.isArray(m.tags) && m.tags.includes('#RECEPTION_VALIDE'))
    );
  }, [mouvements]);

  const pendingOrders = useMemo(() => {
    return allOrders.filter(
      (m) =>
        !Array.isArray(m.tags) ||
        !m.tags.includes('#RECEPTION_VALIDE')
    );
  }, [allOrders]);

  const completedOrders = useMemo(() => {
    return allOrders.filter(
      (m) => Array.isArray(m.tags) && m.tags.includes('#RECEPTION_VALIDE')
    );
  }, [allOrders]);

  const displayedOrders = useMemo(() => {
    if (orderFilterTab === 'PENDING') return pendingOrders;
    if (orderFilterTab === 'RECEIVED') return completedOrders;
    return allOrders;
  }, [orderFilterTab, pendingOrders, completedOrders, allOrders]);

  // Track External Repairs (Bons de Sortie / Pièces chez les prestataires)
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  
  const externalRepairs = useMemo(() => {
    return mouvements.filter(
      (m) =>
        m.type === 'Sortie Externe' ||
        m.is_bon_sortie === true ||
        (Array.isArray(m.tags) && m.tags.includes('#BON_SORTIE')) ||
        (Array.isArray(m.tags) && m.tags.includes('#SORTIE_EXTERNE')) ||
        m.action_id === 'REPARATION_EXTERNE' ||
        m.prestataire_externe
    );
  }, [mouvements]);

  const pendingExternalRepairs = useMemo(() => {
    return externalRepairs.filter(
      (m) =>
        !Array.isArray(m.tags) ||
        (!m.tags.includes('#RETOUR_RECU') && !m.tags.includes('#RECEPTION_VALIDE'))
    );
  }, [externalRepairs]);

  const overdueRepairs = useMemo(() => {
    return pendingExternalRepairs.filter(
      (m) => m.date_retour_prevue && m.date_retour_prevue < todayStr
    );
  }, [pendingExternalRepairs, todayStr]);

  // Calculate analytics for GMAO actions
  const actionStats = useMemo(() => {
    const counts = {
      CORRECTIVE: 0,
      PREVENTIVE: 0,
      AMELIORATIVE: 0,
      USAGE: 0,
      REAPPRO: 0,
      RETOUR: 0,
      AUTRE: 0,
    };

    let totalSortieQty = 0;
    let totalEntreeQty = 0;

    mouvements.forEach((m) => {
      const act = String(m.action_id || '').toUpperCase();
      const type = String(m.type || '').toLowerCase();
      const q = Number(m.quantite || 0);

      if (type.includes('sort')) {
        totalSortieQty += q;
      } else if (type.includes('entr')) {
        totalEntreeQty += q;
      }

      if (counts[act] !== undefined) {
        counts[act] += 1;
      } else {
        counts.AUTRE += 1;
      }
    });

    const totalActions = Object.values(counts).reduce((a, b) => a + b, 0) || 1;

    return {
      counts,
      totalActions,
      totalSortieQty,
      totalEntreeQty,
    };
  }, [mouvements]);

  // Top 5 consumed spare parts
  const topConsumedArticles = useMemo(() => {
    const usageByRef = {};
    mouvements.forEach((m) => {
      const type = String(m.type || '').toLowerCase();
      if (type.includes('sort')) {
        const ref = String(m.ref || '').trim();
        if (ref) {
          usageByRef[ref] = (usageByRef[ref] || 0) + Number(m.quantite || 0);
        }
      }
    });

    return Object.entries(usageByRef)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([ref, qty]) => {
        const item = stockItems.find((s) => String(s.ref).toLowerCase() === ref.toLowerCase());
        return {
          ref,
          designation: item?.designation || 'Article catalogué',
          qty,
          stockActuel: item?.stockActuel ?? 0,
          alerte: item?.alerte || 'OK',
        };
      });
  }, [mouvements, stockItems]);

  // Machine health & interventions
  const machineHealth = useMemo(() => {
    let enService = 0;
    let enMaintenance = 0;
    let arret = 0;

    machines.forEach((m) => {
      const status = String(m.status || '').toLowerCase();
      if (status.includes('maint')) {
        enMaintenance += 1;
      } else if (status.includes('arr') || status.includes('hors')) {
        arret += 1;
      } else {
        enService += 1;
      }
    });

    // Count interventions per machine
    const mchInterventions = {};
    mouvements.forEach((m) => {
      if (m.id_machine_registered) {
        const id = String(m.id_machine_registered).trim();
        mchInterventions[id] = (mchInterventions[id] || 0) + 1;
      }
    });

    const topMachines = Object.entries(mchInterventions)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([id, count]) => {
        const mch = machines.find((m) => String(m.id_machine_registered) === id);
        return {
          id,
          designation: mch?.designation || id,
          zone: mch?.id_zone_default || 'Atelier',
          count,
        };
      });

    return {
      enService,
      enMaintenance,
      arret,
      total: machines.length,
      topMachines,
    };
  }, [machines, mouvements]);

  // Real-time Master Excel Referential Integrity Health Check
  const referentialAudit = useMemo(() => {
    return dataIntegrityService.scanReferentialIntegrity({
      machines,
      zones: _zones,
      technicians,
      operations,
      rawStock: stockItems,
      warehouseItems: _warehouseItems,
      preventiveTasks: [],
      correctiveInterventions,
      mouvements,
    });
  }, [machines, _zones, technicians, operations, stockItems, _warehouseItems, correctiveInterventions, mouvements]);

  const { isDataReady: isWatchlistReady } = useSmartTableLoader(alertAndRuptureItems);

  // Open Order modal for specific article
  const handleOpenOrderForArticle = (article) => {
    const needed = Math.max(1, (Number(article.seuil) || 3) * 2 - (Number(article.stockActuel) || 0));
    const nextCmdNum = `CMD-${new Date().getFullYear()}-${String(allOrders.length + 1).padStart(3, '0')}`;
    setOrderForm({
      ref: article.ref,
      designation: article.designation,
      quantite: needed,
      order_nature: 'STOCK_PERMANENT',
      fournisseur: 'Fournisseur Principal',
      technicien: technicians[0]?.nom || 'Responsable Magasin',
      id_zone: '',
      id_machine_registered: '',
      commentaire: `Réapprovisionnement pour alerte stock (${article.stockActuel}/${article.seuil})`,
      code_bon: nextCmdNum,
    });
    setSelectedArticleForOrder(article);
    setShowOrderModal(true);
  };

  // Open Generic Order Modal
  const handleOpenNewOrder = () => {
    const nextCmdNum = `CMD-${new Date().getFullYear()}-${String(allOrders.length + 1).padStart(3, '0')}`;
    setOrderForm({
      ref: stockItems[0]?.ref || '',
      designation: stockItems[0]?.designation || '',
      quantite: 5,
      order_nature: 'STOCK_PERMANENT',
      fournisseur: '',
      technicien: technicians[0]?.nom || '',
      id_zone: '',
      id_machine_registered: '',
      commentaire: "Demande d'achat magasin",
      code_bon: nextCmdNum,
    });
    setSelectedArticleForOrder(null);
    setShowOrderModal(true);
  };

  // Submit Order Creation
  const handleSubmitOrder = (e) => {
    e.preventDefault();
    if (!orderForm.ref || !orderForm.quantite) return;

    const isAchatUnique = orderForm.order_nature === 'ACHAT_UNIQUE';
    const tags = ['#COMMANDE_EN_ATTENTE'];
    if (isAchatUnique) {
      tags.push('#Achat_Unique', '#Non_Stockable');
    } else {
      tags.push('#REAPPRO', '#Stock_Permanent');
    }

    const newOrderMouvement = {
      id: crypto.randomUUID(),
      code_bon: orderForm.code_bon || `CMD-${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
      heure: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      timestamp: new Date().toISOString(),
      ref: orderForm.ref,
      designation: orderForm.designation,
      quantite: Number(orderForm.quantite) || 1,
      type: 'COMMANDE',
      action_id: 'COMMANDE',
      technicien: orderForm.technicien,
      fournisseur: orderForm.fournisseur,
      id_zone: orderForm.id_zone,
      id_machine_registered: orderForm.id_machine_registered,
      commentaire: `${isAchatUnique ? '[ACHAT UNIQUE] ' : ''}${orderForm.commentaire}`,
      tags: tags,
      is_achat_unique: isAchatUnique,
    };

    if (onAddMouvement) {
      onAddMouvement(newOrderMouvement);
    }
    setShowOrderModal(false);
  };

  // Quick Validate Reception -> Converts Order to Entrée Externe
  const handleValidateReception = (order) => {
    if (!onUpdateMouvement) return;
    const today = new Date().toISOString().split('T')[0];
    const isAchatUnique =
      order.is_achat_unique ||
      (Array.isArray(order.tags) && order.tags.includes('#Achat_Unique'));

    const tags = ['#RECEPTION_VALIDE', '#ENTREE_EXTERNE'];
    if (isAchatUnique) {
      tags.push('#Achat_Unique', '#Non_Stockable');
    }

    onUpdateMouvement(order.id, {
      type: 'Entrée Externe',
      action_id: isAchatUnique ? 'ACHAT_DIRECT' : 'REAPPRO',
      date: today,
      heure: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      timestamp: new Date().toISOString(),
      tags: tags,
      commentaire: `${order.commentaire ? order.commentaire + ' | ' : ''}Réceptionné le ${today}`,
      is_achat_unique: isAchatUnique,
    });
  };

  return (
    <AnimatedPage className="space-y-6 select-none font-sans">
      {/* 1. Top Executive Banner & Quick Action Buttons (BDR Light GMAO Header Card with 3D Tactile Elevation) */}
      <div className="bg-white p-5 md:p-6 rounded-2xl border border-slate-200/90 shadow-[0_12px_32px_-6px_rgba(0,0,0,0.12),0_4px_12px_-2px_rgba(0,0,0,0.06)] hover:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.16),0_6px_16px_-3px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-300 ease-out flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative overflow-hidden group/header">
        {/* Subtle Ambient Gradient Background Highlight */}
        <div className="absolute -top-12 -right-12 w-48 h-48 bg-blue-500/5 rounded-full blur-2xl pointer-events-none group-hover/header:bg-blue-500/10 transition-colors duration-500" />

        <div className="min-w-0 flex-1 flex items-start sm:items-center gap-3.5 relative">
          {/* 3D Elevated Page Badge Icon */}
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-transparent border border-blue-200/90 shadow-[0_4px_12px_rgba(59,130,246,0.12)] flex items-center justify-center text-blue-700 group-hover/header:scale-105 group-hover/header:border-blue-400/80 transition-all duration-300 shrink-0">
            <LayoutDashboard className="w-6 h-6 text-blue-700 transition-transform duration-300 group-hover/header:scale-110" />
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
                Tableau de Bord & Pilotage Opérationnel
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100/90 text-emerald-800 border border-emerald-200/80 flex items-center gap-1 shadow-2xs">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>CIOB GMAO Light Twin</span>
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200/60 font-mono">
                100% Offline
              </span>
            </div>
            <p className="text-xs text-slate-500 max-w-3xl leading-relaxed">
              Supervision en temps réel des flux de magasin, seuils critiques de réapprovisionnement,
              état du parc machines et traçabilité intégrale des interventions.
            </p>
          </div>
        </div>

        {/* Action Buttons — 3D Circular Archetype */}
        <div className="flex items-center gap-2.5 shrink-0 relative self-end md:self-auto">
          {/* 3D Formula Circular Trigger Button */}
          <FormulasModalButton
            onClick={() => setShowFormulasModal(true)}
            title="Formules Excel (GMAO Twin)"
          />

          {/* 3D Circular Nouvelle Commande Button */}
          <Action3DButton
            variant="circle"
            color="amber"
            icon={ShoppingCart}
            showAddBadge={true}
            onClick={handleOpenNewOrder}
            title="Nouvelle Commande / Demande d'Achat"
            ariaLabel="Nouvelle Commande"
          />

          {/* 3D Circular Correctif Nexus Button */}
          {onNavigateToCorrective && (
            <Action3DButton
              variant="circle"
              color="amber"
              icon={Wrench}
              onClick={() => onNavigateToCorrective('corrective')}
              title="Maintenance Corrective Nexus (DI · BT · Live · Clôture · Pareto)"
              ariaLabel="Maintenance Corrective"
            />
          )}

          {/* 3D Circular Sortie / Entrée Rapide Button */}
          <Action3DButton
            variant="circle"
            color="teal"
            icon={SortieEntreeIcon}
            onClick={onNavigateToSortie}
            title="Sortie / Entrée Rapide (Mouvements)"
            ariaLabel="Sortie / Entrée Rapide"
          />

          {/* 3D Circular Exporter Excel Button */}
          {onExportExcel && (
            <Action3DButton
              variant="circle"
              color="emerald"
              icon={FileSpreadsheet}
              onClick={onExportExcel}
              title="Exporter Excel (.xlsx)"
              ariaLabel="Exporter Excel"
            />
          )}
        </div>
      </div>

      {/* Referential Integrity Quick Health Banner */}
      {referentialAudit?.summary && !referentialAudit.summary.isFullyAligned && (
        <div className="p-4 sm:p-5 rounded-3xl bg-amber-500/10 border border-amber-300/90 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs text-amber-950 shadow-xs animate-fade-in">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center font-bold shrink-0 shadow-xs">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="font-black text-sm text-slate-900 flex items-center gap-2 flex-wrap">
                <span>Écarts Référentiels Détectés ({referentialAudit.summary.totalOrphanErrors || 0} orphelin{(referentialAudit.summary.totalOrphanErrors || 0) > 1 ? 's' : ''})</span>
                <span className="px-2.5 py-0.5 rounded-full bg-amber-200 text-amber-900 font-mono text-[10.5px] font-extrabold border border-amber-300">
                  Santé {referentialAudit.healthScore ?? 100}% · Grade {referentialAudit.statusGrade || 'A+'}
                </span>
              </div>
              <p className="text-slate-600 text-[11px] mt-0.5 max-w-2xl leading-relaxed">
                Des mouvements ou interventions font référence à des machines ou techniciens non enregistrés dans les listes maîtresses.
              </p>
            </div>
          </div>

          <button
            onClick={() => onNavigateToSettings?.('matching')}
            className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-md shadow-amber-600/20 hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0 active:scale-95"
          >
            <Zap className="w-4 h-4" />
            <span>Vérifier & Appairer (1 Clic)</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 2. Top Primary KPI Metrics Grid */}
      <DashboardKPIs
        stockKPIs={stockKPIs}
        types={types}
        machineHealth={machineHealth}
        onNavigateToStock={onNavigateToStock}
        onNavigateToMachines={onNavigateToMachines}
      />

      {/* 2.5 Hub Maintenance Corrective Industrielle Nexus */}
      <div className="bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-white rounded-3xl border border-amber-300/80 shadow-[0_8px_30px_rgba(245,158,11,0.08)] p-5 md:p-6 space-y-4 relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center text-white shadow-md shadow-amber-500/20 shrink-0">
              <Wrench className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-base font-black text-slate-900 tracking-tight">
                  Maintenance Corrective Nexus
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-amber-500 text-white tracking-wider font-mono">
                  Hub Dédié
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/90 text-slate-700 border border-amber-200">
                  5 Sous-sections
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-1 max-w-2xl leading-relaxed">
                Pilotage complet des pannes : Demandes (DI), Ordres de Travail (BT), Chronomètre d’Atelier avec déduction automatique de pause, Clôture avec sortie PDR et Pareto 80/20.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap shrink-0">
            <button
              onClick={() => onNavigateToCorrective?.('corrective')}
              className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 shadow-md shadow-amber-600/25 hover:shadow-lg transition-all flex items-center gap-2 cursor-pointer active:scale-95"
            >
              <Wrench className="w-3.5 h-3.5" />
              <span>Ouvrir Correctif Nexus</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Quick Tabs Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 pt-2 border-t border-amber-200/60">
          <button
            onClick={() => onNavigateToCorrective?.('corrective_di')}
            className="p-2.5 rounded-xl bg-white/90 hover:bg-white border border-amber-200/80 hover:border-amber-400 text-left transition-all group cursor-pointer shadow-2xs hover:shadow-xs"
          >
            <div className="text-[10px] font-bold text-slate-400 uppercase">1. Demandes</div>
            <div className="text-xs font-black text-slate-800 group-hover:text-amber-600 flex items-center justify-between mt-0.5">
              <span>DI Usine</span>
              <span className="text-[11px] font-mono font-bold px-1.5 py-0.2 rounded bg-rose-50 text-rose-700 border border-rose-200">
                {(correctiveInterventions || []).filter((i) => i.statut === 'DEMANDE_CREEE' || i.statut === 'EN_ATTENTE_VALIDATION').length}
              </span>
            </div>
          </button>

          <button
            onClick={() => onNavigateToCorrective?.('corrective_bt')}
            className="p-2.5 rounded-xl bg-white/90 hover:bg-white border border-amber-200/80 hover:border-amber-400 text-left transition-all group cursor-pointer shadow-2xs hover:shadow-xs"
          >
            <div className="text-[10px] font-bold text-slate-400 uppercase">2. Bons Travail</div>
            <div className="text-xs font-black text-slate-800 group-hover:text-amber-600 flex items-center justify-between mt-0.5">
              <span>BT Planifiés</span>
              <span className="text-[11px] font-mono font-bold px-1.5 py-0.2 rounded bg-blue-50 text-blue-700 border border-blue-200">
                {(correctiveInterventions || []).filter((i) => i.statut === 'BT_PLANIFIE' || i.statut === 'EN_ATTENTE_PDR').length}
              </span>
            </div>
          </button>

          <button
            onClick={() => onNavigateToCorrective?.('corrective_live')}
            className="p-2.5 rounded-xl bg-white/90 hover:bg-white border border-amber-200/80 hover:border-amber-400 text-left transition-all group cursor-pointer shadow-2xs hover:shadow-xs"
          >
            <div className="text-[10px] font-bold text-slate-400 uppercase">3. Chrono Live</div>
            <div className="text-xs font-black text-slate-800 group-hover:text-amber-600 flex items-center justify-between mt-0.5">
              <span>Intervention Live</span>
              <span className="text-[11px] font-mono font-bold px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                {(correctiveInterventions || []).filter((i) => i.statut === 'EN_COURS').length} en cours
              </span>
            </div>
          </button>

          <button
            onClick={() => onNavigateToCorrective?.('corrective_cloture')}
            className="p-2.5 rounded-xl bg-white/90 hover:bg-white border border-amber-200/80 hover:border-amber-400 text-left transition-all group cursor-pointer shadow-2xs hover:shadow-xs"
          >
            <div className="text-[10px] font-bold text-slate-400 uppercase">4. Rapports</div>
            <div className="text-xs font-black text-slate-800 group-hover:text-amber-600 flex items-center justify-between mt-0.5">
              <span>Clôturées</span>
              <span className="text-[11px] font-mono font-bold px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 border border-slate-200">
                {(correctiveInterventions || []).filter((i) => i.statut === 'CLOTURE').length}
              </span>
            </div>
          </button>

          <button
            onClick={() => onNavigateToCorrective?.('corrective_analyse')}
            className="p-2.5 rounded-xl bg-white/90 hover:bg-white border border-amber-200/80 hover:border-amber-400 text-left transition-all group cursor-pointer shadow-2xs hover:shadow-xs"
          >
            <div className="text-[10px] font-bold text-slate-400 uppercase">5. Décisionnel</div>
            <div className="text-xs font-black text-slate-800 group-hover:text-amber-600 flex items-center justify-between mt-0.5">
              <span>Pareto 80/20</span>
              <span className="text-[11px] font-mono font-bold px-1.5 py-0.2 rounded bg-purple-50 text-purple-700 border border-purple-200">
                MTTR
              </span>
            </div>
          </button>
        </div>
      </div>

      {/* 3. Procurement & Purchase Orders Tracking Center */}
      <div className="bg-white rounded-3xl border border-amber-200/90 shadow-[0_8px_30px_rgba(245,158,11,0.06)] hover:shadow-[0_12px_36px_rgba(245,158,11,0.1)] transition-all duration-300 p-5 md:p-6 space-y-4 relative overflow-hidden">
        {/* Subtle Ambient Background Highlight */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="border-b border-slate-100/90 pb-4 relative space-y-3">
          <div className="flex items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <ShoppingCart className="w-6 h-6 text-amber-600 shrink-0 mt-0.5 sm:mt-0" />
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="font-extrabold text-base text-slate-900 tracking-tight">
                    Suivi des Commandes & Réapprovisionnements
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-extrabold bg-amber-100/90 text-amber-950 border border-amber-200/80 shadow-2xs">
                    {pendingOrders.length} en attente
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Gérez vos demandes d'achats. Cliquez sur <b className="text-emerald-700">"Valider Réception"</b> pour convertir la commande en Entrée de Stock.
                </p>
              </div>
            </div>

            <Action3DButton
              icon={ShoppingCart}
              showAddBadge={true}
              variant="circle"
              color="amber"
              title="Créer une nouvelle commande"
              onClick={handleOpenNewOrder}
            />
          </div>

          {/* Filter Tabs Bar */}
          <div className="flex items-center justify-between pt-1 flex-wrap gap-2">
            <div className="inline-flex p-1 bg-slate-100/90 rounded-xl border border-slate-200/80 text-xs font-medium shadow-2xs">
              <button
                onClick={() => setOrderFilterTab('ALL')}
                className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                  orderFilterTab === 'ALL'
                    ? 'bg-white text-slate-900 font-bold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Toutes ({allOrders.length})
              </button>
              <button
                onClick={() => setOrderFilterTab('PENDING')}
                className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                  orderFilterTab === 'PENDING'
                    ? 'bg-white text-amber-900 font-bold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                En cours ({pendingOrders.length})
              </button>
              <button
                onClick={() => setOrderFilterTab('RECEIVED')}
                className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                  orderFilterTab === 'RECEIVED'
                    ? 'bg-white text-emerald-900 font-bold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Réceptionnées ({completedOrders.length})
              </button>
            </div>

            <div className="text-[11px] text-slate-400 font-mono">
              Affichage de {displayedOrders.length} commande(s)
            </div>
          </div>
        </div>

        {/* Order Cards Grid */}
        {displayedOrders.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 relative">
            {displayedOrders.map((cmd, idx) => {
              const art = stockItems.find(
                (s) => String(s.ref).toLowerCase() === String(cmd.ref).toLowerCase()
              );
              const isReceived =
                Array.isArray(cmd.tags) && cmd.tags.includes('#RECEPTION_VALIDE');

              return (
                <div
                  key={`dash-cmd-${cmd.id ?? ''}-${cmd.ref ?? ''}-${idx}`}
                  className={`p-4 rounded-2xl border transition-all duration-300 relative flex flex-col justify-between space-y-3 ${
                    isReceived
                      ? 'bg-emerald-50/30 border-emerald-200/90 shadow-2xs'
                      : 'bg-white border-amber-200/90 hover:border-amber-400/90 shadow-[0_2px_10px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_20px_rgba(245,158,11,0.12)] hover:-translate-y-0.5'
                  }`}
                >
                  <div className="space-y-2">
                    {/* Card Top Row */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono font-extrabold text-xs text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 shadow-2xs">
                          {cmd.ref}
                        </span>
                        <span className="text-[10.5px] font-bold text-amber-950 bg-amber-100/90 px-2 py-0.5 rounded-full border border-amber-200 font-mono">
                          {cmd.code_bon || 'CMD'}
                        </span>
                        {Array.isArray(cmd.tags) && cmd.tags.includes('#Achat_Unique') ? (
                          <span className="text-[10px] font-bold text-purple-800 bg-purple-100/90 px-2 py-0.5 rounded-full border border-purple-200">
                            Achat Unique
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-blue-800 bg-blue-100/90 px-2 py-0.5 rounded-full border border-blue-200">
                            Stock Permanent
                          </span>
                        )}
                      </div>

                      {isReceived ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-200 shadow-2xs">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>Réceptionné</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-950 border border-amber-200/80 shadow-2xs">
                          <Clock className="w-3 h-3 text-amber-600" />
                          <span>En attente</span>
                        </span>
                      )}
                    </div>

                    {/* Designation & Quantities */}
                    <div>
                      <div className="font-bold text-xs text-slate-900 line-clamp-1">
                        {art ? art.designation : cmd.designation || 'Article commandé'}
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono mt-1 flex items-center justify-between">
                        <span>
                          Quantité :{' '}
                          <b className="text-slate-900 text-xs font-black">
                            {cmd.quantite} pcs
                          </b>
                        </span>
                        <span>Date : {cmd.date}</span>
                      </div>
                    </div>

                    {/* Details Info Pill */}
                    {(cmd.technicien || cmd.fournisseur || cmd.id_zone) && (
                      <div className="text-[10.5px] text-slate-600 bg-slate-50/90 p-2.5 rounded-xl border border-slate-200/80 font-mono space-y-0.5">
                        {cmd.fournisseur && (
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400">Fournisseur:</span>
                            <b className="text-slate-800">{cmd.fournisseur}</b>
                          </div>
                        )}
                        {cmd.technicien && (
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400">Demandeur:</span>
                            <b className="text-slate-800">{cmd.technicien}</b>
                          </div>
                        )}
                        {cmd.id_zone && (
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400">Destination:</span>
                            <b className="text-slate-800">
                              {cmd.id_zone}{' '}
                              {cmd.id_machine_registered ? `(${cmd.id_machine_registered})` : ''}
                            </b>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Actions Buttons */}
                  <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
                    {!isReceived ? (
                      <button
                        onClick={() => handleValidateReception(cmd)}
                        className="flex-1 py-1.5 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white font-bold text-xs rounded-xl shadow-[0_2px_8px_rgba(16,185,129,0.25)] hover:shadow-[0_4px_12px_rgba(16,185,129,0.35)] transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-98"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Valider Réception (Entrée)</span>
                      </button>
                    ) : (
                      <div className="flex-1 py-1.5 text-center text-emerald-900 font-bold text-xs bg-emerald-100/70 border border-emerald-200/80 rounded-xl">
                        ✓ Entrée de stock enregistrée
                      </div>
                    )}

                    {onDeleteMouvement && (
                      <button
                        onClick={() => onDeleteMouvement(cmd.id)}
                        className="p-1.5 rounded-xl border border-slate-200 hover:bg-rose-50 hover:text-rose-600 text-slate-400 transition cursor-pointer"
                        title="Supprimer la commande"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-slate-50/80 border border-slate-200/80 rounded-2xl p-6 text-center space-y-2">
            <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-800 mx-auto flex items-center justify-center shadow-2xs">
              <ShoppingCart className="w-5 h-5" />
            </div>
            <h4 className="text-xs font-bold text-slate-800">Aucune commande répertoriée</h4>
            <p className="text-[11px] text-slate-500 max-w-md mx-auto">
              Initiez facilement une commande d'achat ou un réassort pour vos pièces sous seuil d'alerte en cliquant sur le bouton ci-dessous.
            </p>
            <button
              onClick={handleOpenNewOrder}
              className="mt-2 px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-xs transition inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Créer une Commande d'Achat</span>
            </button>
          </div>
        )}
      </div>

      {/* 3.5 External Repairs & Overdue Tracking Section (Bons de Sortie) */}
      <div className="bg-white rounded-3xl border border-purple-200/90 shadow-[0_8px_30px_rgba(168,85,247,0.06)] hover:shadow-[0_12px_36px_rgba(168,85,247,0.1)] transition-all duration-300 p-5 md:p-6 space-y-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-purple-100/90 pb-4 relative">
          <div className="flex items-center gap-3">
            <Truck className="w-6 h-6 text-purple-600 shrink-0" />
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-extrabold text-base text-slate-900 tracking-tight">
                  Matériels en Réparation Externe (Bons de Sortie)
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-extrabold bg-purple-100/90 text-purple-950 border border-purple-200/80 shadow-2xs">
                  {pendingExternalRepairs.length} en cours
                </span>
                {overdueRepairs.length > 0 && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-extrabold bg-rose-100 text-rose-900 border border-rose-300 flex items-center gap-1 animate-pulse shadow-2xs">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                    <span>{overdueRepairs.length} en retard</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Suivi des moteurs, pompes et pièces envoyés en usinage/bobinage. Réceptionnez le retour pour réintégrer l'article.
              </p>
            </div>
          </div>

          <Action3DButton
            icon={Truck}
            showAddBadge={true}
            variant="circle"
            color="purple"
            title="Nouveau Bon de Sortie"
            onClick={onNavigateToSortie}
          />
        </div>

        {/* List of External Repairs */}
        {pendingExternalRepairs.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 relative">
            {pendingExternalRepairs.map((rep, idx) => {
              const isLate = rep.date_retour_prevue && rep.date_retour_prevue < todayStr;
              return (
                <div
                  key={`dash-rep-${rep.id ?? ''}-${idx}`}
                  className={`p-4 rounded-2xl border transition-all duration-300 relative flex flex-col justify-between space-y-3 ${
                    isLate
                      ? 'bg-rose-50/40 border-rose-300/90 shadow-[0_2px_10px_rgba(244,63,94,0.06)] ring-1 ring-rose-400/20'
                      : 'bg-white border-purple-200/90 hover:border-purple-400/90 shadow-[0_2px_10px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_20px_rgba(168,85,247,0.12)] hover:-translate-y-0.5'
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-extrabold text-xs text-purple-950 bg-purple-100/90 px-2 py-0.5 rounded border border-purple-300 shadow-2xs">
                          {rep.code_bon || 'BS-EXT'}
                        </span>
                        <span className="text-[10px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200 font-mono">
                          {rep.ref}
                        </span>
                      </div>
                      {isLate ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-900 border border-rose-300 shadow-2xs">
                          <AlertTriangle className="w-3 h-3 text-rose-600" />
                          <span>Délai Dépassé</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-900 border border-purple-200/80 shadow-2xs">
                          <Clock className="w-3 h-3 text-purple-600" />
                          <span>Chez Prestataire</span>
                        </span>
                      )}
                    </div>

                    <div>
                      <div className="font-bold text-xs text-slate-900 line-clamp-1">
                        {rep.designation || 'Pièce en réparation'}
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono mt-1 flex items-center justify-between">
                        <span>Qté : <b className="text-slate-900 font-black">{rep.quantite} pcs</b></span>
                        <span className={isLate ? 'text-rose-700 font-bold font-mono' : 'text-purple-950 font-semibold'}>
                          Retour : {rep.date_retour_prevue || 'Non fixé'}
                        </span>
                      </div>
                    </div>

                    {(rep.prestataire_externe || rep.id_machine_registered) && (
                      <div className="text-[10.5px] text-slate-600 bg-slate-50/90 p-2.5 rounded-xl border border-slate-200/80 font-mono space-y-0.5">
                        {rep.prestataire_externe && (
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400">Prestataire:</span>
                            <b className="text-purple-950">{rep.prestataire_externe}</b>
                          </div>
                        )}
                        {rep.id_machine_registered && (
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400">Machine:</span>
                            <b className="text-slate-800">{rep.id_machine_registered}</b>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="pt-2 border-t border-slate-100">
                    <button
                      onClick={onNavigateToSortie}
                      className="w-full py-1.5 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white font-bold text-xs rounded-xl shadow-[0_2px_8px_rgba(147,51,234,0.25)] hover:shadow-[0_4px_12px_rgba(147,51,234,0.35)] transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-98"
                    >
                      <Inbox className="w-3.5 h-3.5" />
                      <span>Réceptionner le Retour (Entrée)</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-slate-50/80 border border-slate-200/80 rounded-2xl p-5 text-center space-y-1.5">
            <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-500" />
            <div className="text-xs font-bold text-slate-800">Aucune pièce en réparation externe</div>
            <p className="text-[11px] text-slate-500">
              Tous les moteurs et équipements sont présents au sein du site.
            </p>
          </div>
        )}
      </div>

      {/* 4. GMAO Flux Intelligence & Action Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Actions & Interventions Breakdown */}
        <div className="bg-white rounded-3xl border border-slate-200/90 p-5 md:p-6 shadow-[0_8px_30px_rgba(0,0,0,0.04)] hover:shadow-[0_12px_36px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-300 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Activity className="w-6 h-6 text-blue-600 shrink-0" />
              <div>
                <h3 className="font-extrabold text-sm text-slate-900 tracking-tight">
                  Répartition des Interventions
                </h3>
                <p className="text-[11px] text-slate-500">Par type d'action GMAO</p>
              </div>
            </div>
            <span className="text-xs font-mono font-bold text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200/60 shadow-2xs">
              {mouvements.length} mvts
            </span>
          </div>

          <div className="space-y-3 text-xs">
            {/* Corrective */}
            <div className="space-y-1">
              <div className="flex items-center justify-between font-medium">
                <span className="text-rose-700 font-bold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-rose-500" />
                  Corrective (Dépannage)
                </span>
                <span className="font-mono font-bold text-slate-800">
                  {actionStats.counts.CORRECTIVE} (
                  {Math.round((actionStats.counts.CORRECTIVE / actionStats.totalActions) * 100)}%)
                </span>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-rose-500 h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.round(
                      (actionStats.counts.CORRECTIVE / actionStats.totalActions) * 100
                    )}%`,
                  }}
                />
              </div>
            </div>

            {/* Preventive */}
            <div className="space-y-1">
              <div className="flex items-center justify-between font-medium">
                <span className="text-blue-700 font-bold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                  Préventive (Systématique)
                </span>
                <span className="font-mono font-bold text-slate-800">
                  {actionStats.counts.PREVENTIVE} (
                  {Math.round((actionStats.counts.PREVENTIVE / actionStats.totalActions) * 100)}%)
                </span>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-blue-500 h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.round(
                      (actionStats.counts.PREVENTIVE / actionStats.totalActions) * 100
                    )}%`,
                  }}
                />
              </div>
            </div>

            {/* Usage Direct */}
            <div className="space-y-1">
              <div className="flex items-center justify-between font-medium">
                <span className="text-purple-700 font-bold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-purple-500" />
                  Usage Direct / Consommables
                </span>
                <span className="font-mono font-bold text-slate-800">
                  {actionStats.counts.USAGE} (
                  {Math.round((actionStats.counts.USAGE / actionStats.totalActions) * 100)}%)
                </span>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-purple-500 h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.round(
                      (actionStats.counts.USAGE / actionStats.totalActions) * 100
                    )}%`,
                  }}
                />
              </div>
            </div>

            {/* Ameliorative */}
            <div className="space-y-1">
              <div className="flex items-center justify-between font-medium">
                <span className="text-amber-700 font-bold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  Améliorative / Travaux Neufs
                </span>
                <span className="font-mono font-bold text-slate-800">
                  {actionStats.counts.AMELIORATIVE} (
                  {Math.round((actionStats.counts.AMELIORATIVE / actionStats.totalActions) * 100)}%)
                </span>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-amber-500 h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.round(
                      (actionStats.counts.AMELIORATIVE / actionStats.totalActions) * 100
                    )}%`,
                  }}
                />
              </div>
            </div>

            {/* Reapprovisionnements & Entrees */}
            <div className="space-y-1">
              <div className="flex items-center justify-between font-medium">
                <span className="text-emerald-700 font-bold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  Réapprovisionnement Magasin
                </span>
                <span className="font-mono font-bold text-slate-800">
                  {actionStats.counts.REAPPRO} (
                  {Math.round((actionStats.counts.REAPPRO / actionStats.totalActions) * 100)}%)
                </span>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.round(
                      (actionStats.counts.REAPPRO / actionStats.totalActions) * 100
                    )}%`,
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Top 5 Most Consumed Articles */}
        <div className="bg-white rounded-3xl border border-slate-200/90 p-5 md:p-6 shadow-[0_8px_30px_rgba(0,0,0,0.04)] hover:shadow-[0_12px_36px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-300 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <TrendingDown className="w-6 h-6 text-amber-600 shrink-0" />
              <div>
                <h3 className="font-extrabold text-sm text-slate-900 tracking-tight">
                  Top 5 Pièces Consommées
                </h3>
                <p className="text-[11px] text-slate-500">Volume total de sorties</p>
              </div>
            </div>
            <button
              onClick={onNavigateToStock}
              className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-0.5 cursor-pointer"
            >
              <span>Stock</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-2">
            {topConsumedArticles.length > 0 ? (
              topConsumedArticles.map((art, idx) => {
                // Medal styling for top 3
                const rankStyles = [
                  'bg-amber-100 text-amber-900 border border-amber-300 font-extrabold shadow-2xs',
                  'bg-slate-200 text-slate-800 border border-slate-300 font-bold',
                  'bg-orange-100 text-orange-900 border border-orange-200 font-bold',
                  'bg-slate-100 text-slate-600 border border-slate-200 font-medium',
                  'bg-slate-100 text-slate-600 border border-slate-200 font-medium',
                ];

                return (
                  <div
                    key={`top-art-${art.ref ?? ''}-${idx}`}
                    className="p-2.5 rounded-xl bg-slate-50/90 border border-slate-200/70 hover:border-slate-300 flex items-center justify-between text-xs transition-colors"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className={`w-5 h-5 rounded-full text-[10px] flex items-center justify-center font-mono ${rankStyles[idx] || rankStyles[4]}`}>
                          {idx + 1}
                        </span>
                        <span className="font-mono font-bold text-slate-900">{art.ref}</span>
                      </div>
                      <div className="text-[11px] text-slate-500 truncate max-w-[180px]">
                        {art.designation}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono font-black text-rose-600 text-sm">
                        -{art.qty} pcs
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        Reste : {art.stockActuel}
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-xs text-slate-400 text-center py-6">
                Aucune sortie enregistrée pour le moment.
              </div>
            )}
          </div>
        </div>

        {/* Top Demanding Machines */}
        <div className="bg-white rounded-3xl border border-slate-200/90 p-5 md:p-6 shadow-[0_8px_30px_rgba(0,0,0,0.04)] hover:shadow-[0_12px_36px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-300 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Factory className="w-6 h-6 text-purple-600 shrink-0" />
              <div>
                <h3 className="font-extrabold text-sm text-slate-900 tracking-tight">
                  Machines les Plus Sollicitées
                </h3>
                <p className="text-[11px] text-slate-500">Nombre d'interventions / dépannages</p>
              </div>
            </div>
            <button
              onClick={onNavigateToMachines}
              className="text-xs font-bold text-purple-600 hover:text-purple-800 flex items-center gap-0.5 cursor-pointer"
            >
              <span>Parc</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-2">
            {machineHealth.topMachines.length > 0 ? (
              machineHealth.topMachines.map((mch, idx) => (
                <div
                  key={`top-mch-${mch.id ?? ''}-${idx}`}
                  className="p-2.5 rounded-xl bg-slate-50/90 border border-slate-200/70 hover:border-slate-300 flex items-center justify-between text-xs transition-colors"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200 text-[11px] shadow-2xs">
                        {mch.id}
                      </span>
                      <span className="text-[11px] font-bold text-slate-700 truncate max-w-[140px]">
                        {mch.designation}
                      </span>
                    </div>
                    <div className="text-[10.5px] text-slate-400 font-mono">
                      Zone : {mch.zone}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-900 font-mono font-bold text-xs border border-purple-200/80 shadow-2xs">
                      {mch.count} interventions
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-xs text-slate-400 text-center py-6">
                Aucune machine associée aux sorties.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 5. Critical Watchlist & Recent Flux Live Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Watchlist Ruptures & Alertes */}
        <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200/90 p-5 md:p-6 shadow-[0_8px_30px_rgba(0,0,0,0.04)] hover:shadow-[0_12px_36px_rgba(0,0,0,0.08)] transition-all duration-300 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="w-6 h-6 text-rose-600 shrink-0" />
              <div>
                <h3 className="font-extrabold text-sm text-slate-900 tracking-tight">
                  Articles Sous Seuil Critique ({alertAndRuptureItems.length})
                </h3>
                <p className="text-[11px] text-slate-500">
                  Pièces nécessitant un réapprovisionnement urgent
                </p>
              </div>
            </div>

            <button
              onClick={onNavigateToStock}
              className="text-xs font-bold text-blue-600 hover:text-blue-800 inline-flex items-center gap-1 cursor-pointer"
            >
              <span>Voir tout le Stock</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="overflow-x-auto border border-slate-200/80 rounded-2xl shadow-2xs">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 text-[10.5px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3 px-3.5">Ref</th>
                  <th className="py-3 px-3.5">Désignation</th>
                  <th className="py-3 px-2 text-right">Stock Actuel</th>
                  <th className="py-3 px-2 text-right">Seuil</th>
                  <th className="py-3 px-3 text-center">État</th>
                  <th className="py-3 px-3">Emplacement</th>
                  <th className="py-3 px-3 text-center">Actions Rapides</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {!isWatchlistReady ? (
                  <TableSkeletonRows cols={7} rows={6} color="rose" />
                ) : alertAndRuptureItems.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="py-8 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-1.5">
                        <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                        <span className="font-semibold text-slate-700">Aucun article en alerte ou rupture</span>
                        <span className="text-xs text-slate-500">Tous les niveaux de stock sont optimaux</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  alertAndRuptureItems.slice(0, 8).map((item, idx) => (
                  <tr key={`alert-item-${item.id ?? ''}-${item.ref ?? ''}-${idx}`} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-3.5 font-mono font-bold text-slate-900">{item.ref}</td>
                    <td className="py-3 px-3.5 font-medium text-slate-800">{item.designation}</td>
                    <td className="py-3 px-2 text-right font-mono font-black text-rose-600">
                      {item.stockActuel}
                    </td>
                    <td className="py-3 px-2 text-right font-mono text-slate-500">{item.seuil}</td>
                    <td className="py-3 px-3 text-center">
                      {item.alerte === 'RUPTURE' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200 shadow-2xs">
                          <XCircle className="w-3 h-3" />
                          <span>RUPTURE</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-200 shadow-2xs">
                          <AlertTriangle className="w-3 h-3" />
                          <span>ALERTE</span>
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-600">{item.emplacement}</td>
                    <td className="py-3 px-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <Action3DButton
                          icon={ShoppingCart}
                          showAddBadge={true}
                          variant="circle"
                          color="amber"
                          title="Commander réapprovisionnement"
                          onClick={() => handleOpenOrderForArticle(item)}
                        />
                        <button
                          onClick={() => onQuickSortie(item)}
                          className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-black text-white text-[11px] font-bold shadow-2xs transition cursor-pointer active:scale-95"
                          title="Faire une sortie"
                        >
                          Sortie
                        </button>
                      </div>
                    </td>
                  </tr>
                )))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Live Flux Feed */}
        <div className="bg-white rounded-3xl border border-slate-200/90 p-5 md:p-6 shadow-[0_8px_30px_rgba(0,0,0,0.04)] hover:shadow-[0_12px_36px_rgba(0,0,0,0.08)] transition-all duration-300 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <SortieEntreeIcon className="w-6 h-6 text-slate-800 shrink-0" strokeWidth={2.25} />
              <div>
                <h3 className="font-extrabold text-sm text-slate-900 tracking-tight">Derniers Mouvements</h3>
                <p className="text-[11px] text-slate-500">Flux récents de magasin</p>
              </div>
            </div>
            <button
              onClick={onNavigateToSortie}
              className="text-xs font-bold text-blue-600 hover:text-blue-800 inline-flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Sortie</span>
            </button>
          </div>

          <div className="space-y-2.5">
            {mouvements.slice(0, 6).map((m, idx) => {
              const art = stockItems.find(
                (s) => String(s.ref).toLowerCase() === String(m.ref).toLowerCase()
              );
              const isSortie = String(m.type || '').toLowerCase().includes('sort');

              return (
                <div
                  key={`feed-mvt-${m.id ?? ''}-${m.code_bon ?? ''}-${idx}`}
                  className="p-3 rounded-2xl bg-slate-50/90 border border-slate-200/80 flex items-center justify-between text-xs hover:border-slate-300 hover:shadow-2xs transition"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.2 rounded-full font-mono shadow-2xs ${
                          isSortie
                            ? 'bg-rose-100 text-rose-800 border border-rose-200'
                            : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        }`}
                      >
                        {m.type}
                      </span>
                      <span className="font-mono font-bold text-slate-900">{m.ref}</span>
                    </div>
                    <div className="text-[11px] text-slate-600 truncate max-w-[170px] font-medium">
                      {art ? art.designation : m.designation || 'Article'}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      {m.code_bon || 'Bon'} • {m.date} • {m.technicien || 'Tech'}
                    </div>
                  </div>
                  <div className="text-right font-mono font-black text-sm">
                    {isSortie ? (
                      <span className="text-rose-600">-{m.quantite}</span>
                    ) : (
                      <span className="text-emerald-600">+{m.quantite}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 7. GMAO Shortcuts Hub */}
      <div className="bg-white rounded-3xl border border-slate-200/90 p-5 md:p-6 shadow-[0_8px_30px_rgba(0,0,0,0.04)] hover:shadow-[0_12px_36px_rgba(0,0,0,0.08)] transition-all duration-300 space-y-3">
        <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2 tracking-tight">
          <Zap className="w-4 h-4 text-amber-500" />
          <span>Accès Rapide aux Modules GMAO</span>
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
          <button
            onClick={onNavigateToStock}
            className="p-3.5 rounded-2xl bg-slate-50/90 hover:bg-blue-50/80 border border-slate-200/80 hover:border-blue-300 text-left shadow-[0_2px_8px_rgba(0,0,0,0.03)] hover:shadow-[0_6px_16px_rgba(59,130,246,0.12)] hover:-translate-y-0.5 transition-all duration-300 space-y-1.5 cursor-pointer group"
          >
            <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Package className="w-5 h-5" />
            </div>
            <div className="font-bold text-xs text-slate-900 group-hover:text-blue-700 transition-colors">Magasin Stock</div>
            <div className="text-[10px] text-slate-500">Gestion des articles</div>
          </button>

          <button
            onClick={onNavigateToSortie}
            className="p-3.5 rounded-2xl bg-slate-50/90 hover:bg-emerald-50/80 border border-slate-200/80 hover:border-emerald-300 text-left shadow-[0_2px_8px_rgba(0,0,0,0.03)] hover:shadow-[0_6px_16px_rgba(16,185,129,0.12)] hover:-translate-y-0.5 transition-all duration-300 space-y-1.5 cursor-pointer group"
          >
            <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center group-hover:scale-110 transition-transform">
              <SortieEntreeIcon className="w-5 h-5" />
            </div>
            <div className="font-bold text-xs text-slate-900 group-hover:text-emerald-700 transition-colors">Sorties & Entrées</div>
            <div className="text-[10px] text-slate-500">Enregistrer un bon</div>
          </button>

          <button
            onClick={onNavigateToMachines}
            className="p-3.5 rounded-2xl bg-slate-50/90 hover:bg-purple-50/80 border border-slate-200/80 hover:border-purple-300 text-left shadow-[0_2px_8px_rgba(0,0,0,0.03)] hover:shadow-[0_6px_16px_rgba(168,85,247,0.12)] hover:-translate-y-0.5 transition-all duration-300 space-y-1.5 cursor-pointer group"
          >
            <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Factory className="w-5 h-5" />
            </div>
            <div className="font-bold text-xs text-slate-900 group-hover:text-purple-700 transition-colors">Parc Machines</div>
            <div className="text-[10px] text-slate-500">Arborescence actifs</div>
          </button>

          <button
            onClick={onNavigateToWarehouse}
            className="p-3.5 rounded-2xl bg-slate-50/90 hover:bg-teal-50/80 border border-slate-200/80 hover:border-teal-300 text-left shadow-[0_2px_8px_rgba(0,0,0,0.03)] hover:shadow-[0_6px_16px_rgba(20,184,166,0.12)] hover:-translate-y-0.5 transition-all duration-300 space-y-1.5 cursor-pointer group"
          >
            <div className="w-9 h-9 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Warehouse className="w-5 h-5" />
            </div>
            <div className="font-bold text-xs text-slate-900 group-hover:text-teal-700 transition-colors">Entrepôt</div>
            <div className="text-[10px] text-slate-500">Éléments & Moteurs</div>
          </button>

          <button
            onClick={onNavigateToZones}
            className="p-3.5 rounded-2xl bg-slate-50/90 hover:bg-amber-50/80 border border-slate-200/80 hover:border-amber-300 text-left shadow-[0_2px_8px_rgba(0,0,0,0.03)] hover:shadow-[0_6px_16px_rgba(245,158,11,0.12)] hover:-translate-y-0.5 transition-all duration-300 space-y-1.5 cursor-pointer group"
          >
            <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Layers className="w-5 h-5" />
            </div>
            <div className="font-bold text-xs text-slate-900 group-hover:text-amber-700 transition-colors">Zones & Ateliers</div>
            <div className="text-[10px] text-slate-500">Emplacements usine</div>
          </button>

          <button
            onClick={onNavigateToUsers}
            className="p-3.5 rounded-2xl bg-slate-50/90 hover:bg-indigo-50/80 border border-slate-200/80 hover:border-indigo-300 text-left shadow-[0_2px_8px_rgba(0,0,0,0.03)] hover:shadow-[0_6px_16px_rgba(99,102,241,0.12)] hover:-translate-y-0.5 transition-all duration-300 space-y-1.5 cursor-pointer group"
          >
            <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center group-hover:scale-110 transition-transform">
              <UserCheck className="w-5 h-5" />
            </div>
            <div className="font-bold text-xs text-slate-900 group-hover:text-indigo-700 transition-colors">Personnel GMAO</div>
            <div className="text-[10px] text-slate-500">Techniciens & Chefs</div>
          </button>

          <button
            onClick={onNavigateToSettings}
            className="p-3.5 rounded-2xl bg-slate-50/90 hover:bg-slate-100 border border-slate-200/80 hover:border-slate-300 text-left shadow-[0_2px_8px_rgba(0,0,0,0.03)] hover:shadow-[0_6px_16px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-300 space-y-1.5 cursor-pointer group"
          >
            <div className="w-9 h-9 rounded-xl bg-slate-200 text-slate-700 flex items-center justify-center group-hover:scale-110 transition-transform">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div className="font-bold text-xs text-slate-900 group-hover:text-slate-950 transition-colors">Excel Twin</div>
            <div className="text-[10px] text-slate-500">Sauvegardes & Sync</div>
          </button>
        </div>
      </div>

      {/* 8. Purchase Order Modal (BDR Light Excel Unified Modal System) */}
      {showOrderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/45 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center font-bold">
                  <ShoppingCart className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-slate-900">
                    {selectedArticleForOrder
                      ? `Commander Réappro : ${selectedArticleForOrder.ref}`
                      : "Créer une Commande d'Achat"}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Enregistre une commande en attente dans le flux de traçabilité
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowOrderModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Form Body */}
            <form onSubmit={handleSubmitOrder} className="p-6 space-y-4 text-xs">
              {/* Type / Nature d'achat Toggle */}
              <div className="space-y-1.5 p-3 rounded-2xl bg-slate-50 border border-slate-200">
                <label className="font-bold text-slate-800 block text-xs">
                  Type & Nature de la Commande *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setOrderForm({ ...orderForm, order_nature: 'STOCK_PERMANENT' })
                    }
                    className={`p-2.5 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                      orderForm.order_nature === 'STOCK_PERMANENT'
                        ? 'bg-blue-50/90 border-blue-400 text-blue-900 ring-2 ring-blue-500/20'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs">📦 Pièce Stock Permanente</span>
                      {orderForm.order_nature === 'STOCK_PERMANENT' && (
                        <Check className="w-3.5 h-3.5 text-blue-600" />
                      )}
                    </div>
                    <span className="text-[10px] text-slate-500 mt-1">
                      Consommable suivi avec seuils et alertes RUPTURE
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setOrderForm({ ...orderForm, order_nature: 'ACHAT_UNIQUE' })
                    }
                    className={`p-2.5 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                      orderForm.order_nature === 'ACHAT_UNIQUE'
                        ? 'bg-purple-50/90 border-purple-400 text-purple-900 ring-2 ring-purple-500/20'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs">⚡ Achat Unique / Spécifique</span>
                      {orderForm.order_nature === 'ACHAT_UNIQUE' && (
                        <Check className="w-3.5 h-3.5 text-purple-600" />
                      )}
                    </div>
                    <span className="text-[10px] text-slate-500 mt-1">
                      Non-stockable récurrent (#Achat_Unique, sans fausses alertes)
                    </span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Code / N° de Commande *</label>
                  <input
                    type="text"
                    required
                    value={orderForm.code_bon}
                    onChange={(e) => setOrderForm({ ...orderForm, code_bon: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs focus:bg-white focus:border-amber-500 outline-none"
                    placeholder="CMD-2026-001"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Quantité Demandée *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={orderForm.quantite}
                    onChange={(e) => setOrderForm({ ...orderForm, quantite: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs font-bold text-slate-900 focus:bg-white focus:border-amber-500 outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Référence de l'Article *</label>
                <input
                  type="text"
                  required
                  value={orderForm.ref}
                  onChange={(e) => {
                    const r = e.target.value;
                    const matched = stockItems.find(
                      (s) => String(s.ref).toLowerCase() === r.toLowerCase()
                    );
                    setOrderForm({
                      ...orderForm,
                      ref: r,
                      designation: matched ? matched.designation : orderForm.designation,
                    });
                  }}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs focus:bg-white focus:border-amber-500 outline-none"
                  placeholder="Ex: ROUL-6204-2RS"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Désignation / Spécifications</label>
                <input
                  type="text"
                  value={orderForm.designation}
                  onChange={(e) => setOrderForm({ ...orderForm, designation: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:border-amber-500 outline-none"
                  placeholder="Description détaillée de la pièce"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Fournisseur Prévu</label>
                  <input
                    type="text"
                    value={orderForm.fournisseur}
                    onChange={(e) => setOrderForm({ ...orderForm, fournisseur: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:border-amber-500 outline-none"
                    placeholder="Ex: SKF Maroc, Distributeur"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Demandeur / Responsable</label>
                  <select
                    value={orderForm.technicien}
                    onChange={(e) => setOrderForm({ ...orderForm, technicien: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:border-amber-500 outline-none"
                  >
                    <option value="">Sélectionner un responsable...</option>
                    {technicians.map((t) => (
                      <option key={t.id_technician || t.nom} value={t.nom}>
                        {t.nom} ({t.specialite || 'Tech'})
                      </option>
                    ))}
                    {operations
                      .filter((o) => o.type_profil === 'CHEF')
                      .map((c) => (
                        <option key={c.id_operation || c.nom} value={c.nom}>
                          {c.nom} (Chef)
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Notes & Justification</label>
                <textarea
                  rows="2"
                  value={orderForm.commentaire}
                  onChange={(e) => setOrderForm({ ...orderForm, commentaire: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:border-amber-500 outline-none"
                  placeholder="Justification de la commande..."
                />
              </div>

              {/* Modal Actions */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowOrderModal(false)}
                  className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 font-bold hover:bg-slate-50 transition cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold shadow-xs transition flex items-center gap-1.5 cursor-pointer active:scale-98"
                >
                  <Check className="w-4 h-4" />
                  <span>Confirmer la Commande</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EXCEL FORMULAS MODAL (DASHBOARD TWIN) */}
      {showFormulasModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-3xl w-full p-5 space-y-4 animate-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700 shrink-0 shadow-2xs">
                  <Calculator className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
                    <span>Formules Excel Miroir — CIOB GMAO Twin</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold">
                      Excel Twin
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    Modèle mathématique et formules réelles de calcul issues de <code className="font-mono text-slate-700 font-bold">GMAO_Light_Template_V2_Formules.xlsx</code>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowFormulasModal(false)}
                className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition cursor-pointer shrink-0"
                title="Fermer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center gap-1.5 p-1 bg-slate-100/90 rounded-xl shrink-0 border border-slate-200/70">
              <button
                type="button"
                onClick={() => setFormulaTab('stock')}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  formulaTab === 'stock'
                    ? 'bg-white text-blue-700 shadow-xs border border-slate-200/80'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Package className="w-3.5 h-3.5" />
                <span>1. Stock & Flux (Mouvements)</span>
              </button>

              <button
                type="button"
                onClick={() => setFormulaTab('kpis')}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  formulaTab === 'kpis'
                    ? 'bg-white text-emerald-700 shadow-xs border border-slate-200/80'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Activity className="w-3.5 h-3.5" />
                <span>2. Indicateurs & KPIs (Pilotage)</span>
              </button>

              <button
                type="button"
                onClick={() => setFormulaTab('autoid')}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  formulaTab === 'autoid'
                    ? 'bg-white text-purple-700 shadow-xs border border-slate-200/80'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Zap className="w-3.5 h-3.5" />
                <span>3. Auto-ID & Séquences</span>
              </button>
            </div>

            {/* Modal Content - Scrollable container */}
            <div className="overflow-y-auto space-y-3 pr-1 flex-1">
              {/* TAB 1: STOCK & FLUX */}
              {formulaTab === 'stock' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Formule 1: Entrées Cumulées */}
                  <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/90 flex flex-col justify-between gap-2 hover:border-blue-300 transition">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 truncate">
                        <TrendingUp className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                        <span className="truncate">Total Entrées (Col. F)</span>
                      </div>
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-blue-100/80 text-blue-800 border border-blue-200 shrink-0">
                        Feuille Stock_Actuel!F
                      </span>
                    </div>
                    <div className="space-y-1">
                      <div className="font-mono text-xs text-blue-800 font-bold bg-white p-2 rounded-lg border border-blue-100 break-all select-all">
                        =SUMIFS(Mouvements!D:D, Mouvements!C:C, [@Ref], Mouvements!E:E, "Entrée")
                      </div>
                      <div className="text-[10px] font-mono text-slate-500 italic pl-1">
                        FR: =SOMME.SI.ENS(Mouvements!D:D; Mouvements!C:C; [@Ref]; Mouvements!E:E; "Entrée")
                      </div>
                    </div>
                    <p className="text-[10.5px] text-slate-500 leading-tight">
                      Agrégation conditionnelle multi-critères des réceptions fournisseurs et retours d'atelier pour la référence active.
                    </p>
                  </div>

                  {/* Formule 2: Sorties Cumulées */}
                  <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/90 flex flex-col justify-between gap-2 hover:border-rose-300 transition">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 truncate">
                        <TrendingDown className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                        <span className="truncate">Total Sorties (Col. G)</span>
                      </div>
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-rose-100/80 text-rose-800 border border-rose-200 shrink-0">
                        Feuille Stock_Actuel!G
                      </span>
                    </div>
                    <div className="space-y-1">
                      <div className="font-mono text-xs text-rose-800 font-bold bg-white p-2 rounded-lg border border-rose-100 break-all select-all">
                        =SUMIFS(Mouvements!D:D, Mouvements!C:C, [@Ref], Mouvements!E:E, "Sortie")
                      </div>
                      <div className="text-[10px] font-mono text-slate-500 italic pl-1">
                        FR: =SOMME.SI.ENS(Mouvements!D:D; Mouvements!C:C; [@Ref]; Mouvements!E:E; "Sortie")
                      </div>
                    </div>
                    <p className="text-[10.5px] text-slate-500 leading-tight">
                      Somme automatique de toutes les sorties (interventions curatives, préventives et consommations d'atelier).
                    </p>
                  </div>

                  {/* Formule 3: Équation Stock Actuel */}
                  <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/90 flex flex-col justify-between gap-2 hover:border-emerald-300 transition">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 truncate">
                        <Package className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span className="truncate">Stock Actuel (Col. H)</span>
                      </div>
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-100/80 text-emerald-800 border border-emerald-200 shrink-0">
                        Feuille Stock_Actuel!H
                      </span>
                    </div>
                    <div className="space-y-1">
                      <div className="font-mono text-xs text-emerald-800 font-bold bg-white p-2 rounded-lg border border-emerald-100 break-all select-all">
                        =[@[Stock Initial]] + [@[Entrées]] - [@[Sorties]]
                      </div>
                      <div className="text-[10px] font-mono text-slate-500 italic pl-1">
                        Cellules: =E2 + F2 - G2
                      </div>
                    </div>
                    <p className="text-[10.5px] text-slate-500 leading-tight">
                      Balance en temps réel calculée pour chaque article avec propagation instantanée des flux d'entrées et sorties.
                    </p>
                  </div>

                  {/* Formule 4: Seuil d'Alerte et Rupture */}
                  <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/90 flex flex-col justify-between gap-2 hover:border-amber-300 transition">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 truncate">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        <span className="truncate">Statut d'Alerte (Col. J)</span>
                      </div>
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-amber-100/80 text-amber-800 border border-amber-200 shrink-0">
                        Feuille Stock_Actuel!J
                      </span>
                    </div>
                    <div className="space-y-1">
                      <div className="font-mono text-xs text-amber-800 font-bold bg-white p-2 rounded-lg border border-amber-100 break-all select-all">
                        =IF([@[Stock Actuel]]&lt;=0, "RUPTURE", IF([@[Stock Actuel]]&lt;=[@[Seuil]], "ALERTE", "OK"))
                      </div>
                      <div className="text-[10px] font-mono text-slate-500 italic pl-1">
                        FR: =SI([@[Stock Actuel]]&lt;=0; "RUPTURE"; SI([@[Stock Actuel]]&lt;=[@[Seuil]]; "ALERTE"; "OK"))
                      </div>
                    </div>
                    <p className="text-[10.5px] text-slate-500 leading-tight">
                      Déclenchement automatique des seuils critiques et alimentation dynamique de la liste de réapprovisionnement.
                    </p>
                  </div>
                </div>
              )}

              {/* TAB 2: KPIS & PILOTAGE */}
              {formulaTab === 'kpis' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* KPI 1: Total Articles */}
                  <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/90 flex flex-col justify-between gap-2 hover:border-blue-300 transition">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 truncate">
                        <Package className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                        <span className="truncate">Total Articles au Catalogue</span>
                      </div>
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-blue-100/80 text-blue-800 border border-blue-200 shrink-0">
                        COUNTA
                      </span>
                    </div>
                    <div className="space-y-1">
                      <div className="font-mono text-xs text-blue-800 font-bold bg-white p-2 rounded-lg border border-blue-100 break-all select-all">
                        =COUNTA(Stock_Actuel!A2:A1000)
                      </div>
                      <div className="text-[10px] font-mono text-slate-500 italic pl-1">
                        FR: =NBVAL(Stock_Actuel!A2:A1000)
                      </div>
                    </div>
                    <p className="text-[10.5px] text-slate-500 leading-tight">
                      Nombre total de références de pièces de rechange enregistrées dans la nomenclature.
                    </p>
                  </div>

                  {/* KPI 2: Total Stock Physique */}
                  <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/90 flex flex-col justify-between gap-2 hover:border-emerald-300 transition">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 truncate">
                        <Layers className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span className="truncate">Stock Physique Global (Unités)</span>
                      </div>
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-100/80 text-emerald-800 border border-emerald-200 shrink-0">
                        SUM
                      </span>
                    </div>
                    <div className="space-y-1">
                      <div className="font-mono text-xs text-emerald-800 font-bold bg-white p-2 rounded-lg border border-emerald-100 break-all select-all">
                        =SUM(Stock_Actuel!H2:H1000)
                      </div>
                      <div className="text-[10px] font-mono text-slate-500 italic pl-1">
                        FR: =SOMME(Stock_Actuel!H2:H1000)
                      </div>
                    </div>
                    <p className="text-[10.5px] text-slate-500 leading-tight">
                      Somme cumulative de toutes les unités d'articles présentes physiquement dans le magasin.
                    </p>
                  </div>

                  {/* KPI 3: Articles en Rupture */}
                  <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/90 flex flex-col justify-between gap-2 hover:border-rose-300 transition">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 truncate">
                        <XCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                        <span className="truncate">Articles en Rupture Critique</span>
                      </div>
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-rose-100/80 text-rose-800 border border-rose-200 shrink-0">
                        COUNTIF
                      </span>
                    </div>
                    <div className="space-y-1">
                      <div className="font-mono text-xs text-rose-800 font-bold bg-white p-2 rounded-lg border border-rose-100 break-all select-all">
                        =COUNTIF(Stock_Actuel!J2:J1000, "RUPTURE")
                      </div>
                      <div className="text-[10px] font-mono text-slate-500 italic pl-1">
                        FR: =NB.SI(Stock_Actuel!J2:J1000; "RUPTURE")
                      </div>
                    </div>
                    <p className="text-[10.5px] text-slate-500 leading-tight">
                      Nombre d'articles dont le stock actuel est nul ou inférieur à 0 (rupture immédiate).
                    </p>
                  </div>

                  {/* KPI 4: Articles en Alerte */}
                  <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/90 flex flex-col justify-between gap-2 hover:border-amber-300 transition">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 truncate">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        <span className="truncate">Articles Sous Seuil d'Alerte</span>
                      </div>
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-amber-100/80 text-amber-800 border border-amber-200 shrink-0">
                        COUNTIF
                      </span>
                    </div>
                    <div className="space-y-1">
                      <div className="font-mono text-xs text-amber-800 font-bold bg-white p-2 rounded-lg border border-amber-100 break-all select-all">
                        =COUNTIF(Stock_Actuel!J2:J1000, "ALERTE")
                      </div>
                      <div className="text-[10px] font-mono text-slate-500 italic pl-1">
                        FR: =NB.SI(Stock_Actuel!J2:J1000; "ALERTE")
                      </div>
                    </div>
                    <p className="text-[10.5px] text-slate-500 leading-tight">
                      Nombre d'articles dont le stock disponible est inférieur ou égal au seuil de sécurité.
                    </p>
                  </div>

                  {/* KPI 5: Total Mouvements */}
                  <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/90 flex flex-col justify-between gap-2 hover:border-indigo-300 transition">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 truncate">
                        <Activity className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                        <span className="truncate">Volume Total des Mouvements</span>
                      </div>
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-indigo-100/80 text-indigo-800 border border-indigo-200 shrink-0">
                        COUNTA
                      </span>
                    </div>
                    <div className="space-y-1">
                      <div className="font-mono text-xs text-indigo-800 font-bold bg-white p-2 rounded-lg border border-indigo-100 break-all select-all">
                        =COUNTA(Mouvements!A2:A5000)
                      </div>
                      <div className="text-[10px] font-mono text-slate-500 italic pl-1">
                        FR: =NBVAL(Mouvements!A2:A5000)
                      </div>
                    </div>
                    <p className="text-[10.5px] text-slate-500 leading-tight">
                      Nombre total d'opérations d'entrées et de sorties tracées dans le registre historique.
                    </p>
                  </div>

                  {/* KPI 6: Machines Actives */}
                  <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/90 flex flex-col justify-between gap-2 hover:border-teal-300 transition">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 truncate">
                        <Factory className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                        <span className="truncate">Parc Machines Opérationnel</span>
                      </div>
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-teal-100/80 text-teal-800 border border-teal-200 shrink-0">
                        COUNTIF
                      </span>
                    </div>
                    <div className="space-y-1">
                      <div className="font-mono text-xs text-teal-800 font-bold bg-white p-2 rounded-lg border border-teal-100 break-all select-all">
                        =COUNTIF(Machines_Registered!G:G, "En service")
                      </div>
                      <div className="text-[10px] font-mono text-slate-500 italic pl-1">
                        FR: =NB.SI(Machines_Registered!G:G; "En service")
                      </div>
                    </div>
                    <p className="text-[10.5px] text-slate-500 leading-tight">
                      Nombre d'équipements industriels en état de fonctionnement continu.
                    </p>
                  </div>
                </div>
              )}

              {/* TAB 3: AUTO-ID & SEQUENCES */}
              {formulaTab === 'autoid' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Auto-ID 1: Code Bon */}
                  <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/90 flex flex-col justify-between gap-2 hover:border-purple-300 transition">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 truncate">
                        <Zap className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                        <span className="truncate">Code Bon de Commande / Sortie</span>
                      </div>
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-purple-100/80 text-purple-800 border border-purple-200 shrink-0">
                        Bon-001...
                      </span>
                    </div>
                    <div className="space-y-1">
                      <div className="font-mono text-xs text-purple-800 font-bold bg-white p-2 rounded-lg border border-purple-100 break-all select-all">
                        ="Bon-" &amp; TEXT(COUNTA(Mouvements!B:B)+1, "000")
                      </div>
                      <div className="text-[10px] font-mono text-slate-500 italic pl-1">
                        FR: ="Bon-" &amp; TEXTE(NBVAL(Mouvements!B:B)+1; "000")
                      </div>
                    </div>
                    <p className="text-[10.5px] text-slate-500 leading-tight">
                      Incrémentation automatique du numéro de bon de mouvement avec formatage sur 3 chiffres.
                    </p>
                  </div>

                  {/* Auto-ID 2: Code Technicien */}
                  <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/90 flex flex-col justify-between gap-2 hover:border-cyan-300 transition">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 truncate">
                        <UserCheck className="w-3.5 h-3.5 text-cyan-600 shrink-0" />
                        <span className="truncate">Code Technicien (TECH)</span>
                      </div>
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-cyan-100/80 text-cyan-800 border border-cyan-200 shrink-0">
                        TECH-01...
                      </span>
                    </div>
                    <div className="space-y-1">
                      <div className="font-mono text-xs text-cyan-800 font-bold bg-white p-2 rounded-lg border border-cyan-100 break-all select-all">
                        ="TECH-" &amp; TEXT(COUNTA(Technicians!A:A)+1, "00")
                      </div>
                      <div className="text-[10px] font-mono text-slate-500 italic pl-1">
                        FR: ="TECH-" &amp; TEXTE(NBVAL(Technicians!A:A)+1; "00")
                      </div>
                    </div>
                    <p className="text-[10.5px] text-slate-500 leading-tight">
                      Attribution séquentielle des identifiants des techniciens et agents de maintenance.
                    </p>
                  </div>

                  {/* Auto-ID 3: Code Opérateur */}
                  <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/90 flex flex-col justify-between gap-2 hover:border-blue-300 transition">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 truncate">
                        <Zap className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                        <span className="truncate">Code Opérateur (OP)</span>
                      </div>
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-blue-100/80 text-blue-800 border border-blue-200 shrink-0">
                        OP-01...
                      </span>
                    </div>
                    <div className="space-y-1">
                      <div className="font-mono text-xs text-blue-800 font-bold bg-white p-2 rounded-lg border border-blue-100 break-all select-all">
                        ="OP-" &amp; TEXT(COUNTIF(Operations!D:D, "OPERATEUR")+1, "00")
                      </div>
                      <div className="text-[10px] font-mono text-slate-500 italic pl-1">
                        FR: ="OP-" &amp; TEXTE(NB.SI(Operations!D:D; "OPERATEUR")+1; "00")
                      </div>
                    </div>
                    <p className="text-[10.5px] text-slate-500 leading-tight">
                      Génération automatique des codes d'opérateurs de production sur 2 chiffres.
                    </p>
                  </div>

                  {/* Auto-ID 4: Code Chef */}
                  <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/90 flex flex-col justify-between gap-2 hover:border-amber-300 transition">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 truncate">
                        <Zap className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        <span className="truncate">Code Chef d'Équipe (CHEF)</span>
                      </div>
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-amber-100/80 text-amber-800 border border-amber-200 shrink-0">
                        CHEF-01...
                      </span>
                    </div>
                    <div className="space-y-1">
                      <div className="font-mono text-xs text-amber-800 font-bold bg-white p-2 rounded-lg border border-amber-100 break-all select-all">
                        ="CHEF-" &amp; TEXT(COUNTIF(Operations!D:D, "CHEF")+1, "00")
                      </div>
                      <div className="text-[10px] font-mono text-slate-500 italic pl-1">
                        FR: ="CHEF-" &amp; TEXTE(NB.SI(Operations!D:D; "CHEF")+1; "00")
                      </div>
                    </div>
                    <p className="text-[10.5px] text-slate-500 leading-tight">
                      Génération automatique des codes de responsables et chefs de postes.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 shrink-0">
              <span className="flex items-center gap-1.5 font-mono text-[11px]">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>100% Conforme aux spécifications Excel GMAO Template V2</span>
              </span>
              <button
                type="button"
                onClick={() => setShowFormulasModal(false)}
                className="px-4 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition cursor-pointer shadow-xs"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </AnimatedPage>
  );
}
