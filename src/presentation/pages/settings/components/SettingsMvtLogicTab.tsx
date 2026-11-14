import { RotateCcw, ShieldCheck } from 'lucide-react';
import { SettingsSectionCard } from './settingsUi';

/**
 * Movement & Stock Business Logic reference panel (3 Categories & 5 Operational Flows).
 */
export default function SettingsMvtLogicTab() {
  return (
    <div className="space-y-6">
      <SettingsSectionCard
        title="Logique des Mouvements de Stock (Référentiel des 5 Flux Usine)"
        description="Cartographie officielle des flux magasin : distinction entre flux Interne, Externe (Sous-traitance/Achat) et Commandes en Attente avec traçabilité #INCONNU."
        icon={<RotateCcw />}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Card 1: Sortie Interne */}
          <div className="p-4 rounded-2xl border border-slate-200/90 bg-slate-50/50 space-y-2.5 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-rose-600" />
                  1. Sortie Interne
                </span>
                <span className="text-[10px] font-mono font-bold bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 rounded-full">
                  Stock ➔ Atelier
                </span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Consommation directe de pièces pour la maintenance corrective, préventive ou amélioration d&apos;une machine.
              </p>
              <p className="text-[11px] text-slate-700 font-medium bg-white px-3 py-2 rounded-xl border border-slate-200/80">
                <b>En pratique :</b> sortie magasin rattachée à une machine et un bon de travail.
              </p>
            </div>
            <div className="text-[11px] font-mono text-slate-700 bg-white p-3 rounded-xl border border-slate-200/80 space-y-1">
              <div>
                <b>Traçabilité :</b> N° Bon + Tech + Zone + Machine
              </div>
              <div>
                <b>Impact Stock :</b> Déduction validée (<span className="text-rose-600 font-bold">-Qte</span>)
              </div>
            </div>
          </div>

          {/* Card 2: Entrée Interne */}
          <div className="p-4 rounded-2xl border border-slate-200/90 bg-slate-50/50 space-y-2.5 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  2. Entrée Interne (Retour)
                </span>
                <span className="text-[10px] font-mono font-bold bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-full">
                  Atelier ➔ Stock
                </span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Restitution de pièces non utilisées ou trouvées sur le terrain. Si aucun Bon n&apos;est fourni, le système applique le Tag <b>#INCONNU</b>.
              </p>
              <p className="text-[11px] text-slate-700 font-medium bg-white px-3 py-2 rounded-xl border border-slate-200/80">
                <b>En pratique :</b> réintégration d&apos;une pièce neuve non montée après intervention.
              </p>
            </div>
            <div className="text-[11px] font-mono text-slate-700 bg-white p-3 rounded-xl border border-slate-200/80 space-y-1">
              <div>
                <b>Règle Bon Vide :</b> Génère N° Bon <b className="text-amber-700">INCONNU</b>
              </div>
              <div>
                <b>Impact Stock :</b> Ajout immédiat (<span className="text-emerald-600 font-bold">+Qte</span>)
              </div>
            </div>
          </div>

          {/* Card 3: Sortie Externe */}
          <div className="p-4 rounded-2xl border border-slate-200/90 bg-slate-50/50 space-y-2.5 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-orange-600" />
                  3. Sortie Externe
                </span>
                <span className="text-[10px] font-mono font-bold bg-orange-50 text-orange-800 border border-orange-200 px-2 py-0.5 rounded-full">
                  Stock ➔ Réparation/Prêt
                </span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Envoi d&apos;un sous-ensemble (Moteur, Pompe) en réparation chez un sous-traitant extérieur ou prêt entre usines.
              </p>
              <p className="text-[11px] text-slate-700 font-medium bg-white px-3 py-2 rounded-xl border border-slate-200/80">
                <b>En pratique :</b> expédition externe pour rebobinage, usinage ou révision.
              </p>
            </div>
            <div className="text-[11px] font-mono text-slate-700 bg-white p-3 rounded-xl border border-slate-200/80 space-y-1">
              <div>
                <b>Champs :</b> N° Bon Externe + Presta/Fournisseur
              </div>
              <div>
                <b>Impact Stock :</b> Déduction (<span className="text-rose-600 font-bold">-Qte</span>)
              </div>
            </div>
          </div>

          {/* Card 4: Entrée Externe */}
          <div className="p-4 rounded-2xl border border-slate-200/90 bg-slate-50/50 space-y-2.5 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-600" />
                  4. Entrée Externe (Achat)
                </span>
                <span className="text-[10px] font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">
                  Fournisseur ➔ Stock
                </span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Réception de réapprovisionnement sous-traitant / fournisseur ou retour de pièce réparée de l&apos;extérieur.
              </p>
              <p className="text-[11px] text-slate-700 font-medium bg-white px-3 py-2 rounded-xl border border-slate-200/80">
                <b>En pratique :</b> réception sur bon de livraison fournisseur avec mise en rayon.
              </p>
            </div>
            <div className="text-[11px] font-mono text-slate-700 bg-white p-3 rounded-xl border border-slate-200/80 space-y-1">
              <div>
                <b>Champs :</b> Fournisseur + Emplacement Réception
              </div>
              <div>
                <b>Impact Stock :</b> Crédit immédiat (<span className="text-emerald-600 font-bold">+Qte</span>)
              </div>
            </div>
          </div>

          {/* Card 5: Commande */}
          <div className="p-4 rounded-2xl border border-slate-200/90 bg-slate-50/50 space-y-2.5 md:col-span-2 lg:col-span-2 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  5. Demande / Commande en Attente
                </span>
                <span className="text-[10px] font-mono font-bold bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-full">
                  En Attente ➔ Dashboard
                </span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Demande de réapprovisionnement initiée par un technicien ou chef d&apos;équipe. La demande apparaît sur le Dashboard principal dans la section <b>Commandes en Attente</b> sans modifier le Stock Actuel jusqu&apos;à la confirmation de réception.
              </p>
              <p className="text-[11px] text-slate-700 font-medium bg-white px-3 py-2 rounded-xl border border-slate-200/80">
                <b>En pratique :</b> expression de besoin magasin en attente de livraison physique.
              </p>
            </div>
            <div className="text-[11px] font-mono text-slate-700 bg-white p-3 rounded-xl border border-slate-200/80 flex flex-col sm:flex-row justify-between gap-2">
              <div>
                <b>Tag Automatique :</b>{' '}
                <span className="bg-amber-50 text-amber-900 border border-amber-200 px-2 py-0.5 rounded-full font-bold">
                  #COMMANDE_EN_ATTENTE
                </span>
              </div>
              <div>
                <b>Validation :</b> Clic sur &laquo; Valider Réception &raquo; ➔ Converti en <b>Entrée Externe</b>
              </div>
            </div>
          </div>
        </div>

        {/* Read-Only Governance Note: Maker-Checker Validation Lifecycle */}
        <div className="mt-5 p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-start gap-3 text-xs text-slate-800 leading-relaxed">
          <ShieldCheck className="w-5 h-5 text-sky-700 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold text-slate-900">
              Gouvernance Maker-Checker (Validation Superviseur) :
            </span>{' '}
            Les exécutions saisies par les techniciens terrain (Bons de Travail <code className="font-mono font-bold text-sky-800">BT</code>, exécutions préventives et demandes de sortie PDR) passent par l&apos;état intermédiaire{' '}
            <span className="font-mono font-bold px-2 py-0.5 rounded-full bg-white text-sky-900 border border-slate-300">
              PENDING_VALIDATION
            </span>{' '}
            et ne déduisent le stock physique (<code className="font-mono">Stock Actuel = Initial + Entrées − Sorties</code>) qu&apos;après approbation d&apos;un superviseur ou responsable magasin.
          </div>
        </div>
      </SettingsSectionCard>
    </div>
  );
}
