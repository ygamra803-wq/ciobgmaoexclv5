import { motion, AnimatePresence } from 'motion/react';
import {
  FileSpreadsheet,
  ShoppingCart,
  Truck,
  Columns2,
  Maximize2,
  Receipt,
} from 'lucide-react';
import Action3DButton from '../../../components/common/Action3DButton';
import FormulasModalButton from '../../../components/common/FormulasModalButton';
import SortieEntreeIcon from '../../../components/common/SortieEntreeIcon';

/**
 * Header banner for SortieRapideView with Title, Formula Modal Trigger, ViewMode switcher, and SubTabs.
 */
export default function SortieRapideHeader({
  activeSubTab,
  setActiveSubTab,
  viewMode,
  handleToggleSplitSolo,
  isFloatingFormOpen,
  setIsFloatingFormOpen,
  setShowFormulasModal,
  pendingOrdersCount = 0,
}) {
  return (
    <div className="bg-white p-5 md:p-6 rounded-2xl border border-slate-200/90 shadow-[0_12px_32px_-6px_rgba(0,0,0,0.12),0_4px_12px_-2px_rgba(0,0,0,0.06)] hover:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.16),0_6px_16px_-3px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-300 ease-out flex flex-col xl:flex-row xl:items-center xl:justify-between gap-5 relative overflow-hidden group/header">
      {/* Subtle Ambient Gradient Background Highlight */}
      <div className="absolute -top-12 -right-12 w-48 h-48 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none group-hover/header:bg-indigo-500/10 transition-colors duration-500" />

      <div className="min-w-0 flex-1 flex items-start sm:items-center gap-3.5 relative">
        <SortieEntreeIcon className="w-7 h-7 text-indigo-600 shrink-0 group-hover/header:scale-110 transition-transform duration-300" />
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight">
            Gestion des Mouvements & Bons Industriels (3 Catégories & 5 Flux)
          </h2>
          <p className="text-xs text-slate-500 mt-1 max-w-3xl leading-relaxed">
            <b>Interne</b> (PDR + Parties + Composants) • <b>Bon de Sortie</b> (Réparation Externe) • <b>Externe</b> (Achats & Réappro)
          </p>
        </div>
      </div>

      {/* Right Column: Action Buttons at Top, Segmented Navigation SubTabs Below */}
      <div className="flex flex-col items-stretch sm:items-end gap-2.5 shrink-0 relative">
        {/* Top Row: Formulas Modal Button & Smart Circular 3D Switch Action Buttons */}
        <div className="flex items-center justify-end gap-2">
          <FormulasModalButton
            onClick={() => setShowFormulasModal(true)}
            title="Formules Excel (Journal Mouvements)"
          />

          {/* Smart Circular 3D Action Switch Buttons */}
          {activeSubTab === 'JOURNAL' && (
            <div className="flex items-center gap-2">
              {/* 1. Toggle Split View <-> Full Table Dedicated View */}
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={`split-toggle-${viewMode === 'SPLIT' ? 'split' : 'solo'}`}
                  initial={{ scale: 0.82, rotate: -12, opacity: 0 }}
                  animate={{ scale: 1, rotate: 0, opacity: 1 }}
                  exit={{ scale: 0.82, rotate: 12, opacity: 0 }}
                  transition={{ duration: 0.18, ease: 'easeOut' }}
                >
                  <Action3DButton
                    variant="circle"
                    color={viewMode === 'SPLIT' ? 'indigo' : 'blue'}
                    icon={viewMode === 'SPLIT' ? Maximize2 : Columns2}
                    onClick={handleToggleSplitSolo}
                    title={
                      viewMode === 'SPLIT'
                        ? 'Agrandir le Journal en Plein Écran (Vue Dédiée)'
                        : 'Revenir à la Vue Scindée (Formulaire & Journal)'
                    }
                  />
                </motion.div>
              </AnimatePresence>

              {/* 2. Quick Action: Floating Form Card Trigger (Active in Full Table Mode) */}
              {viewMode === 'JOURNAL' && (
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={`floating-form-action-${isFloatingFormOpen ? 'open' : 'closed'}`}
                    initial={{ scale: 0.82, rotate: -12, opacity: 0 }}
                    animate={{ scale: 1, rotate: 0, opacity: 1 }}
                    exit={{ scale: 0.82, rotate: 12, opacity: 0 }}
                    transition={{ duration: 0.18, ease: 'easeOut' }}
                  >
                    <Action3DButton
                      variant="circle"
                      color={isFloatingFormOpen ? 'emerald' : 'indigo'}
                      icon={Receipt}
                      showAddBadge={!isFloatingFormOpen}
                      onClick={() => setIsFloatingFormOpen((prev) => !prev)}
                      title={
                        isFloatingFormOpen
                          ? 'Fermer le formulaire flottant'
                          : 'Nouveau Bon de Mouvement (Ouvrir Formulaire Flottant)'
                      }
                    />
                  </motion.div>
                </AnimatePresence>
              )}
            </div>
          )}
        </div>

        {/* Bottom Row: Main Navigation SubTabs (Mouvements | Commandes | Réparation) */}
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
          <div className="inline-flex items-center p-1 bg-slate-100/90 rounded-2xl border border-slate-200/90 shadow-2xs select-none">
            <button
              type="button"
              onClick={() => setActiveSubTab('JOURNAL')}
              className={`py-1.5 px-3.5 rounded-xl text-xs font-bold transition-all duration-200 flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
                activeSubTab === 'JOURNAL'
                  ? 'bg-white text-indigo-950 shadow-[0_2px_8px_rgba(0,0,0,0.08)] border border-slate-200/60'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50 border border-transparent'
              }`}
            >
              <FileSpreadsheet className={`w-3.5 h-3.5 shrink-0 ${activeSubTab === 'JOURNAL' ? 'text-indigo-600' : 'text-slate-500'}`} />
              <span>Mouvements</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSubTab('COMMANDES')}
              className={`py-1.5 px-3.5 rounded-xl text-xs font-bold transition-all duration-200 flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
                activeSubTab === 'COMMANDES'
                  ? 'bg-white text-amber-950 shadow-[0_2px_8px_rgba(0,0,0,0.08)] border border-slate-200/60'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50 border border-transparent'
              }`}
            >
              <ShoppingCart className={`w-3.5 h-3.5 shrink-0 ${activeSubTab === 'COMMANDES' ? 'text-amber-600' : 'text-slate-500'}`} />
              <span>Commandes ({pendingOrdersCount})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSubTab('REPARATION_EXTERNE')}
              className={`py-1.5 px-3.5 rounded-xl text-xs font-bold transition-all duration-200 flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
                activeSubTab === 'REPARATION_EXTERNE'
                  ? 'bg-purple-900 text-white shadow-sm border border-purple-950'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50 border border-transparent'
              }`}
            >
              <Truck className={`w-3.5 h-3.5 shrink-0 ${activeSubTab === 'REPARATION_EXTERNE' ? 'text-purple-200' : 'text-purple-600'}`} />
              <span>Sortie Externe Bobinage</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
