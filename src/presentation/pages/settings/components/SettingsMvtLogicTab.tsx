import { RotateCcw } from 'lucide-react';

/**
 * Movement & Stock Business Logic reference panel (3 Categories & 5 Operational Flows).
 */
export default function SettingsMvtLogicTab() {
  return (
    <div className="space-y-6">
      <div className="border-b border-slate-100 pb-4">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <RotateCcw className="w-4 h-4 text-blue-600 shrink-0" />
          <span>Logique des Mouvements de Stock (Usine Real-World Engine)</span>
        </h3>
        <p className="text-xs text-slate-500 mt-1 max-w-3xl leading-relaxed">
          Cartographie des flux d'usine : distinction nette entre flux Interne, Hors-site (Externe), et Commandes d'Achat en attente avec système intelligent de tags #INCONNU.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Card 1: Sortie Interne */}
        <div className="p-4 rounded-2xl border border-rose-200 bg-rose-50/40 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="font-extrabold text-xs text-rose-900 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-rose-600" />
              1. Sortie Interne
            </span>
            <span className="text-[10px] font-mono font-bold bg-rose-100 text-rose-700 px-2 py-0.5 rounded">
              Stock ➔ Atelier
            </span>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Consommation directe de pièces pour la maintenance corrective, préventive ou amélioration d'une machine.
          </p>
          <div className="text-[11px] font-mono text-slate-700 bg-white p-2.5 rounded-xl border border-rose-200/80 space-y-1">
            <div>
              <b>Traçabilité :</b> N° Bon + Tech + Zone + Machine
            </div>
            <div>
              <b>Impact Stock :</b> Déduction immédiate (<span className="text-rose-600 font-bold">-Qte</span>)
            </div>
          </div>
        </div>

        {/* Card 2: Entrée Interne */}
        <div className="p-4 rounded-2xl border border-cyan-200 bg-cyan-50/40 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="font-extrabold text-xs text-cyan-900 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-cyan-600" />
              2. Entrée Interne (Retour)
            </span>
            <span className="text-[10px] font-mono font-bold bg-cyan-100 text-cyan-700 px-2 py-0.5 rounded">
              Atelier ➔ Stock
            </span>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Restitution de pièces non utilisées ou trouvées sur le terrain. Si aucun Bon n'est fourni, le système applique le Tag <b>#INCONNU</b>.
          </p>
          <div className="text-[11px] font-mono text-slate-700 bg-white p-2.5 rounded-xl border border-cyan-200/80 space-y-1">
            <div>
              <b>Règle Bon Vide :</b> Génère N° Bon <b className="text-amber-700">INCONNU</b>
            </div>
            <div>
              <b>Impact Stock :</b> Ajout immédiat (<span className="text-emerald-600 font-bold">+Qte</span>)
            </div>
          </div>
        </div>

        {/* Card 3: Sortie Externe */}
        <div className="p-4 rounded-2xl border border-purple-200 bg-purple-50/40 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="font-extrabold text-xs text-purple-900 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-purple-600" />
              3. Sortie Externe
            </span>
            <span className="text-[10px] font-mono font-bold bg-purple-100 text-purple-700 px-2 py-0.5 rounded">
              Stock ➔ Réparation/Prêt
            </span>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Envoi d'un sous-ensemble (Moteur, Pompe) en réparation chez un sous-traitant extérieur ou prêt entre usines.
          </p>
          <div className="text-[11px] font-mono text-slate-700 bg-white p-2.5 rounded-xl border border-purple-200/80 space-y-1">
            <div>
              <b>Champs :</b> N° Bon Externe + Presta/Fournisseur
            </div>
            <div>
              <b>Impact Stock :</b> Déduction (<span className="text-rose-600 font-bold">-Qte</span>)
            </div>
          </div>
        </div>

        {/* Card 4: Entrée Externe */}
        <div className="p-4 rounded-2xl border border-emerald-200 bg-emerald-50/40 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="font-extrabold text-xs text-emerald-900 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-600" />
              4. Entrée Externe (Achat)
            </span>
            <span className="text-[10px] font-mono font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded">
              Fournisseur ➔ Stock
            </span>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Réception de réapprovisionnement sous-traitant / fournisseur ou retour de pièce réparée de l'extérieur.
          </p>
          <div className="text-[11px] font-mono text-slate-700 bg-white p-2.5 rounded-xl border border-emerald-200/80 space-y-1">
            <div>
              <b>Champs :</b> Fournisseur + Emplacement Réception
            </div>
            <div>
              <b>Impact Stock :</b> Crédit immédiat (<span className="text-emerald-600 font-bold">+Qte</span>)
            </div>
          </div>
        </div>

        {/* Card 5: Commande */}
        <div className="p-4 rounded-2xl border border-amber-200 bg-amber-50/40 space-y-2.5 md:col-span-2 lg:col-span-2">
          <div className="flex items-center justify-between">
            <span className="font-extrabold text-xs text-amber-900 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-600" />
              5. Demande / Commande en Attente
            </span>
            <span className="text-[10px] font-mono font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded">
              En Attente ➔ Dashboard
            </span>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Demande de réapprovisionnement initiée par un technicien ou chef d'équipe. La demande apparaît sur le Dashboard principal dans la section <b>Commandes en Attente</b> sans modifier le Stock Actuel jusqu'à la confirmation de réception.
          </p>
          <div className="text-[11px] font-mono text-slate-700 bg-white p-2.5 rounded-xl border border-amber-200/80 flex flex-col sm:flex-row justify-between gap-2">
            <div>
              <b>Tag Automatique :</b>{' '}
              <span className="bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded font-bold">
                #COMMANDE_EN_ATTENTE
              </span>
            </div>
            <div>
              <b>Validation :</b> Clic sur "Valider Réception" ➔ Converti en <b>Entrée Externe</b>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
