import type { MouseEvent } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Edit,
  Inbox,
  Lock,
  MapPin,
  MoreVertical,
  SlidersHorizontal,
  TrendingDown,
  TrendingUp,
  XCircle,
} from 'lucide-react';
import { StockItem } from '../../../../core/domain';
import { resolvePdrHierarchy } from '../../../../domain/stock/pdrHierarchyService';
import { resolveStockUnitPrice } from '../../../../domain/stock/stockCockpitService';
import type { IStockItem, IType, PdrGroup } from '../../../../types/domain';
import type { ReservedStockEntry } from '../../../../core/security/validationReconciliation';

const TYPE_STYLES: Record<string, string> = {
  Foret: 'bg-amber-50 text-amber-700 border-amber-200',
  Tenaille: 'bg-slate-100 text-slate-700 border-slate-200',
  Cheville: 'bg-violet-50 text-violet-700 border-violet-200',
  Poinçon: 'bg-rose-50 text-rose-700 border-rose-200',
  Vis: 'bg-blue-50 text-blue-700 border-blue-200',
  Raccord: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  Roulement: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Courroie: 'bg-orange-50 text-orange-700 border-orange-200',
  Capteur: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  teflon: 'bg-teal-50 text-teal-700 border-teal-200',
};

function getTypeStyle(typeStr?: string): string {
  if (!typeStr) return 'bg-cyan-50 text-cyan-800 border-cyan-200';
  const clean = String(typeStr).trim();
  const key = Object.keys(TYPE_STYLES).find((k) => k.toLowerCase() === clean.toLowerCase());
  return (key && TYPE_STYLES[key]) || 'bg-cyan-50 text-cyan-800 border-cyan-200';
}

interface StockDataGridRowProps {
  t: (key: string, fallback?: string) => string;
  item: IStockItem;
  rowNum: number;
  types: IType[];
  effectivePdrGroups: PdrGroup[];
  reservedEntry: ReservedStockEntry | null;
  isMenuOpen: boolean;
  canCreateMovement: boolean;
  canEditStock: boolean;
  onToggleMenu: (ref: string | null) => void;
  onContextMenu: (e: MouseEvent<HTMLTableRowElement>, item: IStockItem) => void;
  onFilterDomaine: (domaine: string) => void;
  onFilterType: (typeVal: string) => void;
  onOpenQuickModal: (item: IStockItem, flow: string, action: string) => void;
  onOpenEditArticle: (item: IStockItem) => void;
  isInventoryMode?: boolean;
  inventoryCountStr?: string;
  onChangeInventoryCount?: (ref: string, value: string) => void;
}

export function StockDataGridRow({
  t,
  item,
  rowNum,
  types,
  effectivePdrGroups,
  reservedEntry,
  isMenuOpen,
  canCreateMovement,
  canEditStock,
  onToggleMenu,
  onContextMenu,
  onFilterDomaine,
  onFilterType,
  onOpenQuickModal,
  onOpenEditArticle,
  isInventoryMode = false,
  inventoryCountStr,
  onChangeInventoryCount,
}: StockDataGridRowProps) {
  const domainItem = new StockItem(item);
  const typeObj = types.find((typeItem) => typeItem.id_type === item.id_type || typeItem.libelle === item.type);
  const hierarchy = resolvePdrHierarchy(item, effectivePdrGroups, types);
  const effDomaine = String(
    item.domaine_technique ||
      hierarchy.type?.domaine_technique ||
      hierarchy.group?.domaine_technique ||
      ''
  )
    .trim()
    .toUpperCase();

  const crit = String(item.criticite || 'B').trim().toUpperCase();
  const critStyle =
    crit === 'A'
      ? 'bg-rose-100 text-rose-800 border-rose-300'
      : crit === 'C'
        ? 'bg-slate-100 text-slate-600 border-slate-200'
        : 'bg-amber-50 text-amber-800 border-amber-200';

  const actuel = domainItem.getActuel();
  const uom = String(item.unite_mesure || item.unite || 'PCS').toUpperCase();
  const reservedQty = reservedEntry?.reservedQty || 0;
  const netDispo = actuel - reservedQty;
  const isNetCrit = reservedQty > 0 && netDispo <= domainItem.getSeuilAlerte();
  const tooltipText =
    reservedQty > 0
      ? `Stock Physique : ${actuel} ${uom}\nRéservé (En attente validation) : ${reservedQty} ${uom}\nDisponible Net : ${netDispo} ${uom}\nDétail : ${reservedEntry?.sources
          .map((s) => `${s.code} (${s.machineCode || s.claimType}: ${s.qty})`)
          .join(', ')}`
      : `Stock Physique Actuel : ${actuel} ${uom}`;

  return (
    <tr
      onContextMenu={(e) => onContextMenu(e, item)}
      className="even:bg-slate-50/70 odd:bg-white hover:bg-cyan-50/40 border-b border-slate-200/70 transition-colors"
    >
      <td className="py-3 px-3 text-center font-mono text-[11px] font-bold text-slate-400 bg-slate-100/40 border-r border-slate-200/80 shrink-0">
        {rowNum}
      </td>

      <td className="py-3 px-3.5 font-mono font-bold text-slate-900 whitespace-nowrap">
        <div className="flex flex-col items-start gap-1">
          <div className="flex items-center gap-1.5">
            <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200">
              {item.ref}
            </span>
            <span
              className={`px-1.5 py-0.2 rounded text-[9.5px] font-mono font-black border ${critStyle}`}
              title={`Criticité PDR : Classe ${crit}`}
            >
              {crit}
            </span>
          </div>
          {item.ref_constructeur && (
            <span
              className="text-[10px] font-mono font-medium text-slate-500 max-w-[160px] truncate"
              title={`Réf. Constructeur / OEM : ${item.ref_constructeur}`}
            >
              OEM: {item.ref_constructeur}
            </span>
          )}
          {item.code_equivalents && (
            <span
              className="text-[9.5px] font-mono font-semibold text-indigo-600 bg-indigo-50/70 px-1.5 py-0.2 rounded border border-indigo-100 max-w-[165px] truncate"
              title={`Codes équivalents : ${item.code_equivalents}`}
            >
              Éq: {item.code_equivalents}
            </span>
          )}
        </div>
      </td>

      <td className="py-3 px-3.5 font-bold text-slate-900 whitespace-nowrap">
        <div className="flex flex-col items-start gap-1">
          <span>{item.designation}</span>
          <div className="flex items-center gap-1 flex-wrap">
            {(item.policy_tags && item.policy_tags.length > 0
              ? item.policy_tags
              : ['REPLACING']
            ).map((tag: string) => (
              <span
                key={tag}
                className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-sky-50 text-sky-800 border border-sky-200"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      </td>

      <td className="py-3 px-3 whitespace-nowrap">
        <div className="flex flex-col gap-1 items-start">
          <div className="flex items-center gap-1 flex-wrap">
            {hierarchy.group && (
              <span
                className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded font-mono text-[9.5px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200"
                title={`Groupe PDR: ${hierarchy.group.libelle} (${hierarchy.group.code})`}
              >
                <span>{hierarchy.group.code}</span>
              </span>
            )}
            {effDomaine && (
              <button
                type="button"
                onClick={() => onFilterDomaine(effDomaine)}
                className="px-1.5 py-0.2 rounded font-mono text-[9px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 transition cursor-pointer"
                title={`Filtrer sur le Domaine Technique : ${effDomaine}`}
              >
                {effDomaine}
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              const filterVal = item.type || item.id_type;
              if (filterVal) onFilterType(filterVal);
            }}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[11px] font-semibold transition cursor-pointer shadow-2xs ${getTypeStyle(item.type)}`}
            title={t('stock.filter_by_type_tooltip', 'Filtrer par ce Type')}
          >
            <span>{item.type || (typeObj ? typeObj.libelle : item.id_type)}</span>
          </button>
        </div>
      </td>

      <td className="py-3 px-2.5 text-right font-mono text-slate-600">
        <span>{item.stockInitial}</span>
        <span className="ml-1 text-[9.5px] text-slate-400 font-semibold">
          {item.unite_mesure || item.unite || 'PCS'}
        </span>
      </td>

      <td className="py-3 px-2.5 text-right font-mono font-bold text-emerald-700">
        {Number(item.entrees || 0) > 0 ? `+${item.entrees}` : '0'}
      </td>

      <td className="py-3 px-2.5 text-right font-mono font-bold text-rose-700">
        {Number(item.sorties || 0) > 0 ? `-${item.sorties}` : '0'}
      </td>

      <td className="py-3 px-2.5 text-right font-mono">
        <div className="inline-flex flex-col items-end gap-1" title={tooltipText}>
          <div className="flex items-center gap-1">
            <span className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 font-black text-slate-900 text-sm">
              {actuel}
            </span>
            <span className="px-1.5 py-0.5 rounded bg-slate-100/80 border border-slate-200/80 text-[9.5px] font-mono font-bold text-slate-600">
              {uom}
            </span>
          </div>
          {reservedQty > 0 && (
            <div className="flex flex-col items-end gap-0.5 text-[10px] leading-tight">
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-purple-50 text-purple-800 border border-purple-200 font-bold">
                <Lock className="w-2.5 h-2.5 text-purple-600" />
                <span>Réservé: -{reservedQty}</span>
              </span>
              <span
                className={`px-1.5 py-0.5 rounded font-bold border ${
                  netDispo <= 0
                    ? 'bg-rose-100 text-rose-800 border-rose-300'
                    : isNetCrit
                      ? 'bg-amber-100 text-amber-900 border-amber-300'
                      : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                }`}
              >
                Dispo net: {netDispo} {uom}
              </span>
            </div>
          )}
        </div>
      </td>

      <td className="py-3 px-2.5 text-right font-mono text-slate-500 font-semibold">
        <div className="flex flex-col items-end gap-0.5">
          <div>
            <span>{domainItem.getSeuilAlerte()}</span>
            <span className="ml-1 text-[9.5px] text-slate-400">
              {item.unite_mesure || item.unite || 'PCS'}
            </span>
          </div>
          {Number(item.delai_appro_jours) > 0 && (
            <span
              className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-amber-50 text-amber-800 border border-amber-200"
              title={`Délai d'approvisionnement fournisseur : ${item.delai_appro_jours} jour(s)`}
            >
              Délai: {item.delai_appro_jours}j
            </span>
          )}
        </div>
      </td>

      <td className="py-3 px-3 text-center whitespace-nowrap">
        {domainItem.getCriticite() === 'RUPTURE' && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-rose-50 text-rose-700 border border-rose-300">
            <XCircle className="w-3.5 h-3.5" />
            <span>{t('stock.status_rupture', 'RUPTURE')}</span>
          </span>
        )}
        {domainItem.getCriticite() === 'ALERTE' && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-amber-50 text-amber-700 border border-amber-300">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>{t('stock.status_alert', 'ALERTE')}</span>
          </span>
        )}
        {domainItem.getCriticite() === 'OK' && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-300">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>{t('stock.status_ok', 'OK')}</span>
          </span>
        )}
      </td>

      <td className="py-3 px-3.5 font-mono text-slate-700 whitespace-nowrap">
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200 text-xs font-semibold">
          <MapPin className="w-3 h-3 text-purple-500" />
          <span>{item.emplacement || t('stock.not_assigned', 'Non assigné')}</span>
        </span>
      </td>

      {isInventoryMode && (() => {
        const hasVal = inventoryCountStr !== undefined && inventoryCountStr.trim() !== '';
        const parsedCount = hasVal ? Number(inventoryCountStr) : NaN;
        const isValidCount = hasVal && Number.isFinite(parsedCount) && parsedCount >= 0;
        const ecart = isValidCount ? Number((parsedCount - actuel).toFixed(4)) : 0;
        const unitPrice = resolveStockUnitPrice(item);
        const ecartValue = Number((ecart * unitPrice).toFixed(2));
        return (
          <>
            <td className="py-2.5 px-3 bg-indigo-50/40 border-l border-indigo-200/70 whitespace-nowrap">
              <input
                type="number"
                min="0"
                step="1"
                placeholder={String(actuel)}
                value={inventoryCountStr ?? ''}
                onChange={(e) => onChangeInventoryCount?.(item.ref, e.target.value)}
                data-testid={`inv-count-input-${item.ref}`}
                className="w-24 h-8 px-2.5 rounded-lg border border-indigo-300 bg-white font-mono font-black text-xs text-right text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </td>
            <td className="py-2.5 px-3 bg-indigo-50/40 text-right font-mono whitespace-nowrap">
              {!isValidCount ? (
                <span className="text-[11px] text-slate-400">—</span>
              ) : (
                <div className="flex flex-col items-end gap-0.5">
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-black border ${
                      ecart > 0
                        ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                        : ecart < 0
                          ? 'bg-rose-100 text-rose-900 border-rose-300'
                          : 'bg-slate-100 text-slate-600 border-slate-200'
                    }`}
                  >
                    {ecart > 0 ? `+${ecart}` : ecart} {uom}
                  </span>
                  {unitPrice > 0 && ecart !== 0 && (
                    <span
                      className={`text-[10px] font-bold ${
                        ecart > 0 ? 'text-emerald-700' : 'text-rose-700'
                      }`}
                    >
                      {ecartValue > 0 ? '+' : ''}
                      {ecartValue.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} DH
                    </span>
                  )}
                </div>
              )}
            </td>
          </>
        );
      })()}

      <td className="py-3 px-3.5 text-center whitespace-nowrap action-menu-container relative">
        {canCreateMovement ? (
          <div className="flex items-center justify-center gap-1.5">
            <button
              type="button"
              onClick={() => onOpenQuickModal(item, 'Sortie Interne', 'CORRECTIVE')}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-bold transition shadow-2xs cursor-pointer active:scale-95"
              title={t('stock.quick_sortie_title', 'Sortie Rapide / Intervention')}
            >
              <TrendingDown className="w-3.5 h-3.5 text-rose-400" />
              <span>{t('stock.actions.quick_sortie', 'Sortie')}</span>
            </button>

            <div className="relative">
              <button
                type="button"
                onClick={() => onToggleMenu(isMenuOpen ? null : item.ref)}
                className={`w-8 h-8 rounded-xl border flex items-center justify-center transition cursor-pointer ${
                  isMenuOpen
                    ? 'bg-cyan-100 text-cyan-900 border-cyan-400 shadow-2xs'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
                title={t('stock.actions_menu_title', 'Menu des Flux & Actions rapides')}
              >
                <MoreVertical className="w-3.5 h-3.5" />
              </button>

              {isMenuOpen && (
                <div className="absolute right-0 top-full mt-1.5 w-60 bg-white rounded-2xl border border-slate-200 shadow-2xl z-50 p-2 space-y-1 text-left animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="px-2.5 py-1.5 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                    <span>{t('stock.flux_menu_header', 'FLUX & ACTIONS PDR')}</span>
                    <span className="font-mono text-cyan-800">{item.ref}</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => onOpenQuickModal(item, 'Sortie Interne', 'CORRECTIVE')}
                    className="w-full px-2.5 py-1.5 rounded-xl text-xs font-semibold text-slate-700 hover:bg-rose-50 hover:text-rose-950 flex items-center gap-2 transition cursor-pointer"
                  >
                    <div className="w-6 h-6 rounded-lg bg-rose-100 flex items-center justify-center text-rose-600 shrink-0">
                      <TrendingDown className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <div className="font-bold">{t('stock.actions.quick_sortie', 'Sortie Interne')}</div>
                      <div className="text-[10px] text-slate-400">{t('stock.actions.quick_sortie_sub', 'Corrective, Préventive, Usage')}</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => onOpenQuickModal(item, 'Entrée Interne', 'RETOUR')}
                    className="w-full px-2.5 py-1.5 rounded-xl text-xs font-semibold text-slate-700 hover:bg-cyan-50 hover:text-cyan-950 flex items-center gap-2 transition cursor-pointer"
                  >
                    <div className="w-6 h-6 rounded-lg bg-cyan-100 flex items-center justify-center text-cyan-600 shrink-0">
                      <TrendingUp className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <div className="font-bold">{t('stock.actions.quick_entree', 'Entrée Interne')}</div>
                      <div className="text-[10px] text-slate-400">{t('stock.actions.quick_entree_sub', 'Retour Atelier, Récupération')}</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => onOpenQuickModal(item, 'Entrée Externe', 'REAPPRO')}
                    className="w-full px-2.5 py-1.5 rounded-xl text-xs font-semibold text-slate-700 hover:bg-emerald-50 hover:text-emerald-950 flex items-center gap-2 transition cursor-pointer"
                  >
                    <div className="w-6 h-6 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
                      <Inbox className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <div className="font-bold">{t('stock.actions.external_entree', 'Entrée Externe')}</div>
                      <div className="text-[10px] text-slate-400">{t('stock.actions.external_entree_sub', 'Réappro Fournisseur (+ Qté)')}</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => onOpenQuickModal(item, 'Ajustement', 'INVENTAIRE')}
                    className="w-full px-2.5 py-1.5 rounded-xl text-xs font-semibold text-slate-700 hover:bg-amber-50 hover:text-amber-950 flex items-center gap-2 transition cursor-pointer"
                  >
                    <div className="w-6 h-6 rounded-lg bg-amber-100 flex items-center justify-center text-amber-600 shrink-0">
                      <SlidersHorizontal className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <div className="font-bold">{t('stock.actions.adjust_stock', 'Ajuster le Stock')}</div>
                      <div className="text-[10px] text-slate-400">{t('stock.actions.adjust_stock_sub', 'Corriger valeur réelle / écart')}</div>
                    </div>
                  </button>

                  {canEditStock && (
                    <div className="border-t border-slate-100 my-1 pt-1">
                      <button
                        type="button"
                        onClick={() => onOpenEditArticle(item)}
                        className="w-full px-2.5 py-1.5 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 flex items-center gap-2 transition cursor-pointer"
                      >
                        <div className="w-6 h-6 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700 shrink-0">
                          <Edit className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <div className="font-bold text-slate-800">{t('stock.actions.edit_article', "Modifier l'Article")}</div>
                          <div className="text-[10px] text-slate-400">{t('stock.actions.edit_article_sub', 'Désignation, Seuil, Emplacement')}</div>
                        </div>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          <span
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-500 border border-slate-200 text-[10.5px] font-mono font-bold select-none"
            title="Consultation uniquement — Déclarez vos consommations PDR dans vos Bons de Travail ou Tâches Préventives"
          >
            Consultation
          </span>
        )}
      </td>
    </tr>
  );
}
