import { useState, useMemo } from 'react';
import {
  X,
  Printer,
  ShieldCheck,
  Wrench,
  Calendar,
  Layers,
  User,
  Clock,
  Package,
} from 'lucide-react';

export default function PrintWorkOrderModal({
  task,
  onClose,
  recommendedPDR = [],
  companyName = 'GMAO ENTERPRISE - USINE DE PRODUCTION',
}) {
  const pdrItems = useMemo(() => {
    if (task?.derniers_pdr_utilises && task.derniers_pdr_utilises.length > 0) {
      return task.derniers_pdr_utilises;
    }
    return recommendedPDR;
  }, [task, recommendedPDR]);

  const [safetyLOTO, setSafetyLOTO] = useState({
    consignationElec: true,
    purgevide: true,
    cadenasPose: true,
    portEPI: true,
    balisageZone: false,
  });

  const otRef = useMemo(() => {
    if (!task) return 'OT-PREV-0001';
    const cleanId = (task.id || '').replace(/[^a-zA-Z0-9]/g, '').slice(-4);
    return `OT-PREV-${task.id_machine || 'MACH'}-${(task.action_code || 'C')}-${cleanId || '0001'}`;
  }, [task]);

  if (!task) return null;

  const toggleSafety = (key) => {
    setSafetyLOTO(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/70 backdrop-blur-xs overflow-y-auto print:p-0 print:bg-white print:static print:inset-auto">
      <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 shadow-2xl w-full max-w-4xl overflow-hidden my-4 sm:my-8 print:border-none print:shadow-none print:m-0 print:max-w-none print:rounded-none">
        
        {/* MODAL ACTION BAR (Hidden when printing) */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between print:hidden">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-xl border border-indigo-500/30">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-slate-100 text-base sm:text-lg">
                Bon d'Intervention Préventive (Ordre de Travail)
              </h2>
              <p className="text-xs text-slate-400 font-mono">
                Réf: {otRef} • Machine: {task.id_machine}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-xl flex items-center gap-2 shadow-sm transition-all cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimer / Exporter PDF</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* PRINTABLE WORK ORDER BODY */}
        <div className="p-6 sm:p-10 space-y-6 text-slate-800 print:p-6 print:space-y-4 font-sans text-sm">
          
          {/* HEADER INDUSTRIAL */}
          <div className="border-b-2 border-slate-800 pb-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 bg-slate-900 text-white font-mono font-black text-xs rounded tracking-wider">
                  GMAO-PRO
                </span>
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                  BON D'INTERVENTION PRÉVENTIVE
                </h1>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-1 uppercase tracking-wide">
                {companyName} • Département Maintenance Industrielle
              </p>
            </div>

            <div className="text-left sm:text-right font-mono bg-slate-50 p-3 rounded-xl border border-slate-200">
              <div className="text-xs text-slate-500">ORDRE DE TRAVAIL N°</div>
              <div className="text-base font-black text-indigo-700">{otRef}</div>
              <div className="text-xs text-slate-600 mt-0.5">
                Date: <strong className="text-slate-900">{new Date().toLocaleDateString('fr-FR')}</strong>
              </div>
            </div>
          </div>

          {/* SECTION 1: IDENTIFICATION MACHINE & PASSPORT */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-indigo-600" /> Équipement Cible
              </div>
              <div className="font-bold text-slate-900 text-base mt-1">{task.id_machine}</div>
              <div className="text-xs text-slate-600">{task.nom_machine || 'Équipement de production'}</div>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-emerald-600" /> Localisation & Périodicité
              </div>
              <div className="font-bold text-slate-900 text-base mt-1">Zone: {task.id_zone || 'AFM'}</div>
              <div className="text-xs text-slate-600">Fréquence: <strong>{task.frequence || 'Mensuel'}</strong> (Échéance: {task.prochaine_echeance || 'Planifiée'})</div>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-amber-600" /> Intervenant Assigné
              </div>
              <div className="font-bold text-slate-900 text-base mt-1">{task.responsable || 'Technicien'}</div>
              <div className="text-xs text-slate-600 flex items-center gap-1 mt-0.5">
                <Clock className="w-3.5 h-3.5 text-slate-400" /> Durée allouée: <strong>{task.duree_estimee || '15 min'}</strong>
              </div>
            </div>
          </div>

          {/* SECTION 2: CONSIGNATION & PROTOCOLE LOTO (Sécurité Industrielle) */}
          <div className="bg-amber-50/70 rounded-xl p-4 border border-amber-300">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-amber-900 font-bold text-sm uppercase">
                <ShieldCheck className="w-4 h-4 text-amber-700" />
                Protocole de Sécurité & Consignation LOTO Obligatoire
              </div>
              <span className="text-[11px] font-bold px-2 py-0.5 bg-amber-200/80 text-amber-900 rounded font-mono">
                CONFORME NF C 18-510 / ISO 12100
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1 text-xs">
              <label 
                onClick={() => toggleSafety('consignationElec')}
                className="flex items-center gap-2 bg-white/80 p-2 rounded-lg border border-amber-200 cursor-pointer"
              >
                <input 
                  type="checkbox" 
                  checked={safetyLOTO.consignationElec} 
                  onChange={() => {}} 
                  className="rounded text-amber-600 focus:ring-amber-500" 
                />
                <span className="font-medium text-slate-800">1. Coupure & Consignation électrique (BR/BC)</span>
              </label>

              <label 
                onClick={() => toggleSafety('purgevide')}
                className="flex items-center gap-2 bg-white/80 p-2 rounded-lg border border-amber-200 cursor-pointer"
              >
                <input 
                  type="checkbox" 
                  checked={safetyLOTO.purgevide} 
                  onChange={() => {}} 
                  className="rounded text-amber-600 focus:ring-amber-500" 
                />
                <span className="font-medium text-slate-800">2. Purge énergies résiduelles (Pneu/Hydrau)</span>
              </label>

              <label 
                onClick={() => toggleSafety('cadenasPose')}
                className="flex items-center gap-2 bg-white/80 p-2 rounded-lg border border-amber-200 cursor-pointer"
              >
                <input 
                  type="checkbox" 
                  checked={safetyLOTO.cadenasPose} 
                  onChange={() => {}} 
                  className="rounded text-amber-600 focus:ring-amber-500" 
                />
                <span className="font-medium text-slate-800">3. Cadenassage personnel posé</span>
              </label>

              <label 
                onClick={() => toggleSafety('portEPI')}
                className="flex items-center gap-2 bg-white/80 p-2 rounded-lg border border-amber-200 cursor-pointer"
              >
                <input 
                  type="checkbox" 
                  checked={safetyLOTO.portEPI} 
                  onChange={() => {}} 
                  className="rounded text-amber-600 focus:ring-amber-500" 
                />
                <span className="font-medium text-slate-800">4. EPI requis (Gants, Lunettes, Chaussures S3)</span>
              </label>

              <label 
                onClick={() => toggleSafety('balisageZone')}
                className="flex items-center gap-2 bg-white/80 p-2 rounded-lg border border-amber-200 cursor-pointer"
              >
                <input 
                  type="checkbox" 
                  checked={safetyLOTO.balisageZone} 
                  onChange={() => {}} 
                  className="rounded text-amber-600 focus:ring-amber-500" 
                />
                <span className="font-medium text-slate-800">5. Balisage & signalisation zone de travail</span>
              </label>
            </div>
          </div>

          {/* SECTION 3: TÂCHES ET GAMME OPÉRATOIRE */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="bg-slate-100 px-4 py-2.5 font-bold text-xs uppercase tracking-wider text-slate-700 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Wrench className="w-3.5 h-3.5 text-indigo-600" />
                Gamme Opératoire & Points de Contrôle
              </span>
              <span className="font-mono text-slate-500">Code: {task.code}</span>
            </div>

            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                  <th className="p-3 w-16 text-center">Action</th>
                  <th className="p-3">Organe / Composant</th>
                  <th className="p-3">Instructions & Gamme Technique</th>
                  <th className="p-3 w-28 text-center">Résultat</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                <tr>
                  <td className="p-3 text-center align-top">
                    <span className="inline-block px-2.5 py-1 font-mono font-black text-xs bg-indigo-100 text-indigo-800 rounded-md border border-indigo-200">
                      {task.action_code || 'C'}
                    </span>
                    <div className="text-[10px] font-bold text-slate-600 mt-1">{task.type_intervention || 'Contrôle'}</div>
                  </td>
                  <td className="p-3 font-bold text-slate-900 align-top">
                    <div>{task.composant}</div>
                    <div className="text-[11px] text-slate-500 font-normal mt-0.5">Réf: {task.ref || 'STD-GMAO'}</div>
                  </td>
                  <td className="p-3 text-slate-700 align-top leading-relaxed">
                    <p className="font-medium text-slate-900">{task.consigne || 'Exécuter les vérifications conformément au manuel constructeur.'}</p>
                    <div className="mt-2 text-[11px] text-slate-500 bg-slate-50 p-2 rounded border border-slate-200/80">
                      <strong>Recommandations:</strong> Vérifier jeux mécaniques, absence de fuites, températures normales de fonctionnement et fixations.
                    </div>
                  </td>
                  <td className="p-3 align-top text-center">
                    <div className="space-y-1.5 inline-block text-left text-[11px]">
                      <div className="flex items-center gap-1.5">
                        <input type="checkbox" className="rounded" /> <span>Conforme</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <input type="checkbox" className="rounded" /> <span>Anomalie (BT)</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <input type="checkbox" className="rounded" /> <span>Remplacé</span>
                      </div>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* SECTION 4: PIÈCES DE RECHANGE & CONSOMMABLES (PDR) */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="bg-slate-100 px-4 py-2.5 font-bold text-xs uppercase tracking-wider text-slate-700 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5 text-indigo-600" />
                Pièces de Rechange (PDR) & Consommables Utilisés
              </span>
              <span className="text-[11px] text-slate-500 font-normal">À imputer au stock</span>
            </div>

            {pdrItems.length === 0 ? (
              <div className="p-4 text-xs text-slate-500 italic bg-slate-50 text-center">
                Aucun consommable lourd prescrit par défaut. Inscrire manuellement les articles prélevés en magasin ci-dessous.
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                    <th className="p-2.5">Réf PDR</th>
                    <th className="p-2.5">Désignation Consommable / Pièce</th>
                    <th className="p-2.5 w-24 text-center">Quantité</th>
                    <th className="p-2.5 w-20 text-right">P.U (DT)</th>
                    <th className="p-2.5 w-20 text-center">Pointé</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {pdrItems.map((pdr, idx) => (
                    <tr key={idx}>
                      <td className="p-2.5 font-mono text-slate-700 font-semibold">{pdr.reference || pdr.id_article}</td>
                      <td className="p-2.5 text-slate-800 font-medium">{pdr.designation}</td>
                      <td className="p-2.5 text-center font-bold font-mono">{pdr.quantite} {pdr.unite || 'U'}</td>
                      <td className="p-2.5 text-right font-mono text-slate-600">{Number(pdr.prix_unitaire || 0).toFixed(2)}</td>
                      <td className="p-2.5 text-center">
                        <input type="checkbox" defaultChecked className="rounded text-indigo-600" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* SECTION 5: RAPPORT DU TECHNICIEN & VISA */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div className="border border-slate-200 rounded-xl p-4 space-y-2">
              <div className="text-xs font-bold uppercase text-slate-700">Observations & Relevés du Technicien</div>
              <div className="h-20 bg-slate-50 rounded-lg border border-dashed border-slate-300 p-2 text-xs text-slate-600">
                {task.observations || 'RAS. L\'équipement a été nettoyé, graissé et testé sous tension nominale. Prêt pour exploitation.'}
              </div>
              <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                <span>Temps passé réel: ____________ min</span>
                <span>État final: [ ] En service [ ] À l'arrêt</span>
              </div>
            </div>

            <div className="border border-slate-200 rounded-xl p-4 flex flex-col justify-between">
              <div>
                <div className="text-xs font-bold uppercase text-slate-700">Visas & Bon Pour Remise en Service</div>
                <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
                  <div className="p-2 border border-slate-200 rounded-lg text-center h-20 flex flex-col justify-between">
                    <span className="text-slate-500 text-[10px]">Signature Technicien</span>
                    <span className="font-mono text-slate-800 font-bold text-xs">{task.responsable || 'Technicien'}</span>
                  </div>
                  <div className="p-2 border border-slate-200 rounded-lg text-center h-20 flex flex-col justify-between">
                    <span className="text-slate-500 text-[10px]">Visa Responsable / Chef</span>
                    <span className="text-slate-400 italic text-[11px]">Lu et validé</span>
                  </div>
                </div>
              </div>
              <div className="text-[10px] text-slate-400 font-mono text-center mt-2">
                Document généré automatiquement via GMAO Enterprise Cloud
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
