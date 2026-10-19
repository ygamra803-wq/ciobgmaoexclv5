import { useRef } from 'react';
import {
  X,
  Printer,
  FileText,
  Calendar,
  Clock,
  Factory,
  User,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Download,
  CheckCircle2,
  Package
} from 'lucide-react';
import { sanitizeHtml, sanitizeString, sanitizeFilename } from '../../../utils/sanitize';

/**
 * MovementVoucherModal
 * Generates an official, printable voucher (Bon de Sortie / Entrée / Commande)
 * 100% Offline-friendly with professional A4 print styling and SVG barcode.
 */
export default function MovementVoucherModal({
  movement,
  isOpen,
  onClose,
  articleInfo = {},
  destinationInfo = {},
  intervenantInfo = {},
  equationInfo = {}
}) {
  const printRef = useRef(null);

  if (!isOpen || !movement) return null;

  const isSortie = String(movement.type || '').toLowerCase().includes('sortie');
  const voucherTitle = isSortie ? 'BON DE SORTIE DE STOCK (PDR)' : "BON D'ENTRÉE / RÉCEPTION";

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadHtml = () => {
    if (!printRef.current) return;
    const content = sanitizeHtml(printRef.current.innerHTML);
    const safeCodeTitle = sanitizeString(String(movement.code_bon || 'Mouvement'));
    const safeDateTitle = sanitizeString(String(movement.date || ''));
    const safeFileCode = sanitizeFilename(movement.code_bon, 'Mouvement');
    const safeFileDate = sanitizeFilename(movement.date, 'print');

    const fullHtml = `<!DOCTYPE html>
<html lang="fr" dir="ltr">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src 'self' data:; script-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none';">
  <title>Bon_${safeCodeTitle}_${safeDateTitle}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; margin: 20px; color: #1e293b; }
    .voucher-card { max-width: 800px; margin: 0 auto; border: 2px solid #cbd5e1; border-radius: 12px; padding: 24px; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; margin-bottom: 16px; }
    th, td { border: 1px solid #e2e8f0; padding: 8px 12px; text-align: left; font-size: 13px; }
    th { background: #f8fafc; font-weight: bold; }
    .barcode { font-family: monospace; letter-spacing: 4px; font-weight: bold; }
    @media print {
      body { margin: 0; padding: 0; }
      .no-print { display: none !important; }
      .voucher-card { border: none !important; box-shadow: none !important; }
    }
  </style>
</head>
<body>
  <div class="voucher-card">
    ${content}
  </div>
</body>
</html>`;

    const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Bon_${safeFileCode}_${safeFileDate}.html`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/70 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-auto">
        {/* Header Bar with Action Controls (Hidden when printing) */}
        <div className="no-print px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center shadow-xs">
              <FileText className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-wide">Édition & Impression du Bon Officiel</h2>
              <p className="text-[11px] text-slate-400 font-mono">Format A4 Normalisé • CIOB GMAO Twin Model</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadHtml}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition flex items-center gap-1.5 cursor-pointer border border-slate-700"
              title="Télécharger le bon en fichier HTML autonome"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Exporter HTML</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white transition flex items-center gap-1.5 cursor-pointer shadow-md shadow-indigo-600/30"
              title="Lancer l'impression directe (A4)"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Imprimer</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer ml-1"
              title="Fermer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Voucher Content */}
        <div className="p-6 sm:p-8 max-h-[80vh] overflow-y-auto print:max-h-none print:overflow-visible print:p-0 bg-white" ref={printRef}>
          <div className="p-6 sm:p-8 border-2 border-slate-300 rounded-2xl bg-white space-y-6 print:border-none print:p-0">
            {/* Top Company Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-5 border-b-2 border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-slate-900 text-white flex flex-col items-center justify-center font-black text-lg tracking-tighter">
                  CIOB
                </div>
                <div>
                  <h1 className="text-base font-black tracking-tight text-slate-900 uppercase">
                    CIOB GMAO LIGHT ENTERPRISE
                  </h1>
                  <p className="text-xs font-medium text-slate-600">
                    Direction Technique & Maintenance Industrielle
                  </p>
                  <p className="text-[10px] text-slate-400 font-mono">
                    Système Centralisé de Gestion des Pièces de Rechange (PDR)
                  </p>
                </div>
              </div>

              {/* Voucher Code & Type */}
              <div className="text-right flex flex-col items-end sm:items-end w-full sm:w-auto">
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                    isSortie
                      ? 'bg-rose-100 text-rose-800 border border-rose-300'
                      : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  }`}
                >
                  {isSortie ? <TrendingDown className="w-3.5 h-3.5" /> : <TrendingUp className="w-3.5 h-3.5" />}
                  {voucherTitle}
                </span>

                <div className="mt-2 text-right">
                  <div className="text-lg font-black font-mono text-slate-900">
                    N° {movement.code_bon || 'BON-000'}
                  </div>
                  {movement.num_commande && (
                    <div className="text-xs font-bold text-indigo-700 font-mono">
                      OT / CDE : {movement.num_commande}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Metadata Bar (Date, Heure, Statut, Simulated Barcode) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Date d'opération</span>
                <span className="font-semibold text-slate-800 flex items-center gap-1.5 mt-0.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-500" />
                  {movement.date || '----/--/--'}
                </span>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Heure d'enregistrement</span>
                <span className="font-semibold text-slate-800 flex items-center gap-1.5 mt-0.5">
                  <Clock className="w-3.5 h-3.5 text-slate-500" />
                  {movement.heure || '10:00:00'}
                </span>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Statut du Bon</span>
                <span className="font-bold text-emerald-700 flex items-center gap-1.5 mt-0.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  {movement.statut || 'Effectué & Validé'}
                </span>
              </div>

              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Code-Barres Vérif.</span>
                <div className="font-mono text-[9.5px] font-bold text-slate-700 tracking-widest mt-0.5">
                  ||||| | |||| || |||
                </div>
              </div>
            </div>

            {/* Main Article Details Table */}
            <div className="space-y-1.5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5 text-indigo-600" />
                Détails de l'Article / Composant Concerné
              </h3>

              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Référence Article</th>
                      <th className="py-2.5 px-3">Désignation & Type</th>
                      <th className="py-2.5 px-3 text-center">Emplacement</th>
                      <th className="py-2.5 px-3 text-right">Quantité</th>
                      <th className="py-2.5 px-3 text-right">Équation Stock</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    <tr>
                      <td className="py-3 px-3 font-mono font-bold text-indigo-900">
                        {movement.ref || 'RÉF-INCONNUE'}
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-semibold text-slate-900">{articleInfo.designation || 'Article'}</div>
                        <div className="text-[11px] text-slate-500 font-medium">
                          {articleInfo.type ? `Type: ${articleInfo.type}` : 'Catalogue Standard'} • {articleInfo.sourceCat || 'PDR'}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-center font-mono font-semibold text-slate-700">
                        {movement.emplacement || articleInfo.emplacement || 'R1-B01'}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <span className="font-black text-sm text-slate-900">
                          {movement.quantite || 1}
                        </span>{' '}
                        <span className="text-[10px] text-slate-500 font-bold uppercase">U</span>
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-xs text-slate-700">
                        {equationInfo.stockAvant != null
                          ? `${equationInfo.stockAvant} ${isSortie ? '-' : '+'} ${movement.quantite || 1} = ${equationInfo.stockApres}`
                          : 'Validé'}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Context & Affectation (Machine, Zone, Intervenant, Action) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Left Column: Destination & Machine */}
              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                  <Factory className="w-3.5 h-3.5 text-indigo-600" />
                  Affectation & Destination
                </h4>
                <div className="text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Machine cible :</span>
                    <span className="font-bold text-slate-900 font-mono">
                      {movement.id_machine_registered || destinationInfo.code || 'Atelier Général'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Zone industrielle :</span>
                    <span className="font-medium text-slate-800">
                      {destinationInfo.zone || movement.id_zone || 'Zone Usine'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Nature Intervention :</span>
                    <span className="font-bold text-indigo-700">
                      {movement.action_id || 'CORRECTIVE'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Right Column: Intervenant & Demandeur */}
              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-indigo-600" />
                  Demandeur & Opération
                </h4>
                <div className="text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Intervenant / Demandeur :</span>
                    <span className="font-bold text-slate-900">
                      {intervenantInfo.name || movement.technicien || 'Technicien de Quart'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Poste / Rôle :</span>
                    <span className="font-medium text-slate-800">
                      {intervenantInfo.role || 'Service Maintenance'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">N° Commande / OT :</span>
                    <span className="font-bold text-slate-800 font-mono">
                      {movement.num_commande || 'N/A'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Commentaire / Observation */}
            {movement.commentaire && (
              <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl text-xs space-y-1">
                <span className="font-bold text-amber-900 block text-[11px] uppercase tracking-wider">
                  Observations & Motif de la sortie :
                </span>
                <p className="text-amber-800 italic">"{movement.commentaire}"</p>
              </div>
            )}

            {/* Signatures & Visas Blocks (3 official boxes) */}
            <div className="pt-4 border-t-2 border-slate-200">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="border border-slate-300 rounded-xl p-3 bg-slate-50/30 flex flex-col justify-between h-28">
                  <span className="text-[10px] font-bold uppercase text-slate-500">
                    1. Le Demandeur (Technicien)
                  </span>
                  <div className="text-[11px] font-semibold text-slate-800">
                    {intervenantInfo.name || movement.technicien || 'Signature'}
                  </div>
                </div>

                <div className="border border-slate-300 rounded-xl p-3 bg-slate-50/30 flex flex-col justify-between h-28">
                  <span className="text-[10px] font-bold uppercase text-slate-500">
                    2. Responsable Magasin (Visa)
                  </span>
                  <div className="text-[11px] font-semibold text-emerald-800 flex items-center justify-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Approuvé & Délivré</span>
                  </div>
                </div>

                <div className="border border-slate-300 rounded-xl p-3 bg-slate-50/30 flex flex-col justify-between h-28">
                  <span className="text-[10px] font-bold uppercase text-slate-500">
                    3. Chef de Maintenance / Visa
                  </span>
                  <div className="text-[10px] text-slate-400 italic">
                    Date & Cachet Officiel
                  </div>
                </div>
              </div>
            </div>

            {/* Footer Notice */}
            <div className="pt-2 text-center text-[9.5px] text-slate-400 font-mono">
              CIOB GMAO Enterprise • Document généré automatiquement pour traçabilité ISO 9001 / GMAO Excel Twin
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
