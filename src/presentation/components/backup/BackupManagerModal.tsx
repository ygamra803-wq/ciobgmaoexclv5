import { useState, useEffect, useRef } from 'react';
import {
  X,
  Database,
  RotateCcw,
  Download,
  Upload,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ShieldCheck,
  Plus,
  Layers,
  Server,
  Activity,
} from 'lucide-react';
import { AutoBackupService } from '../../../core/backup/AutoBackupService';
import { usePermission } from '../common/PermissionGate';

export default function BackupManagerModal({ isOpen, onClose, onDataRestored }) {
  const [activeTab, setActiveTab] = useState('snapshots'); // 'snapshots' | 'partitions'
  const [snapshots, setSnapshots] = useState([]);
  const [confirmRestoreId, setConfirmRestoreId] = useState(null);
  const [confirmResetOps, setConfirmResetOps] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const fileInputRef = useRef(null);

  const canBackup = usePermission('settings.backup');
  const canRestore = usePermission('settings.restore');

  const refreshList = () => {
    setSnapshots(AutoBackupService.listSnapshots());
  };

  useEffect(() => {
    if (isOpen) {
      refreshList();
      setSuccessMsg('');
      setErrorMsg('');
      setConfirmRestoreId(null);
      setConfirmResetOps(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCreateManual = () => {
    const snap = AutoBackupService.createSnapshot('Sauvegarde manuelle utilisateur', true);
    if (snap) {
      setSuccessMsg('Point de restauration créé avec succès !');
      refreshList();
      setTimeout(() => setSuccessMsg(''), 4000);
    } else {
      setErrorMsg('Échec de création du point de restauration.');
    }
  };

  const handleExecuteRestore = async (id) => {
    setIsRestoring(true);
    try {
      const ok = await AutoBackupService.restoreSnapshot(id);
      setIsRestoring(false);
      setConfirmRestoreId(null);
      if (ok) {
        setSuccessMsg('Données restaurées avec succès ! Actualisation...');
        refreshList();
        if (onDataRestored) {
          onDataRestored();
        } else {
          setTimeout(() => {
            window.location.reload();
          }, 1000);
        }
      } else {
        setErrorMsg('Erreur lors de la restauration du point.');
      }
    } catch {
      setIsRestoring(false);
      setErrorMsg('Erreur inattendue lors de la restauration.');
    }
  };

  const handleDelete = (id) => {
    AutoBackupService.deleteSnapshot(id);
    refreshList();
  };

  const handleExportFull = () => {
    AutoBackupService.exportFullBackupJSON();
  };

  const handleExportPartition = (type) => {
    AutoBackupService.exportPartitionJSON(type);
  };

  const handleResetOperations = () => {
    const ok = AutoBackupService.resetOperationsHistory();
    setConfirmResetOps(false);
    if (ok) {
      setSuccessMsg('Historique des opérations réinitialisé avec succès (Référentiel Master préservé).');
      refreshList();
      if (onDataRestored) {
        onDataRestored();
      } else {
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      }
    } else {
      setErrorMsg('Erreur lors de la réinitialisation des opérations.');
    }
  };

  const handleFileImport = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const text = evt.target?.result;
        const ok = AutoBackupService.importFullBackupJSON(text);
        if (ok) {
          setSuccessMsg('Sauvegarde importée avec succès !');
          refreshList();
          if (onDataRestored) onDataRestored();
        } else {
          setErrorMsg('Fichier de sauvegarde invalide.');
        }
      } catch {
        setErrorMsg('Erreur de lecture du fichier JSON.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/70 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-auto flex flex-col max-h-[88vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-600 flex items-center justify-center shadow-xs">
              <Database className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-wide">Sauvegardes & Partitions GMAO</h2>
              <p className="text-[11px] text-slate-400 font-mono">Modèle Dual Partition (Master / Opérations) • 100% Offline</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="px-6 pt-3 bg-slate-50 border-b border-slate-200 flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('snapshots')}
            className={`px-3 py-2 text-xs font-bold rounded-t-xl transition-all border-b-2 cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'snapshots'
                ? 'text-slate-900 border-emerald-600 bg-white shadow-xs'
                : 'text-slate-500 border-transparent hover:text-slate-800'
            }`}
          >
            <Clock className="w-3.5 h-3.5 text-emerald-600" />
            <span>Points de Restauration ({snapshots.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('partitions')}
            className={`px-3 py-2 text-xs font-bold rounded-t-xl transition-all border-b-2 cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'partitions'
                ? 'text-slate-900 border-indigo-600 bg-white shadow-xs'
                : 'text-slate-500 border-transparent hover:text-slate-800'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-indigo-600" />
            <span>Modèle Dual Partition (Master vs Opérations)</span>
          </button>
        </div>

        {/* Status Alerts */}
        {successMsg && (
          <div className="mx-4 mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs font-bold text-emerald-800 shrink-0 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {errorMsg && (
          <div className="mx-4 mt-3 p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-xs font-bold text-rose-800 shrink-0 animate-in fade-in">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Tab 1: Snapshots Manager */}
        {activeTab === 'snapshots' && (
          <>
            {/* Toolbar */}
            <div className="p-4 bg-white border-b border-slate-100 flex flex-wrap items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={!canBackup}
                  onClick={handleCreateManual}
                  className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-xs font-bold text-white transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Créer un point maintenant</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportFull}
                  className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700 transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  title="Télécharger toutes les données au format JSON"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Exporter Global JSON</span>
                </button>
              </div>

              <div>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".json"
                  onChange={handleFileImport}
                  className="hidden"
                />
                <button
                  type="button"
                  disabled={!canRestore}
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700 transition flex items-center gap-1.5 cursor-pointer shadow-2xs disabled:opacity-40"
                  title="Restaurer à partir d'un fichier .json externe"
                >
                  <Upload className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Importer JSON</span>
                </button>
              </div>
            </div>

            {/* Snapshots List */}
            <div className="p-4 overflow-y-auto space-y-2.5 grow">
              {snapshots.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs space-y-2">
                  <Database className="w-8 h-8 mx-auto text-slate-300" />
                  <p className="font-medium">Aucun point de restauration enregistré.</p>
                  <p className="text-[11px] text-slate-400">
                    Cliquez sur "Créer un point maintenant" ou effectuez des modifications pour en générer un automatiquement.
                  </p>
                </div>
              ) : (
                snapshots.map((snap) => {
                  const totalItems = Object.values(snap.counts || {}).reduce((acc, c) => acc + (Number(c) || 0), 0);
                  const isConfirming = confirmRestoreId === snap.id;

                  return (
                    <div
                      key={snap.id}
                      className={`p-3.5 rounded-2xl border transition-all ${
                        isConfirming
                          ? 'bg-amber-50/70 border-amber-300 shadow-xs'
                          : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-xs'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-slate-900 font-mono">
                              {snap.dateStr}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                snap.isManual
                                  ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {snap.isManual ? 'Manuel' : 'Automatique'}
                            </span>
                          </div>

                          <div className="text-[11px] text-slate-600 font-medium flex items-center gap-1.5">
                            <Clock className="w-3 h-3 text-slate-400" />
                            <span>{snap.reason}</span>
                          </div>

                          {/* Counts breakdown */}
                          <div className="flex flex-wrap gap-2 text-[10px] font-mono text-slate-500 pt-0.5">
                            <span>PDR: <b>{snap.counts?.spare_parts ?? 0}</b></span>
                            <span>•</span>
                            <span>Mouvements: <b>{snap.counts?.movements ?? 0}</b></span>
                            <span>•</span>
                            <span>Machines: <b>{snap.counts?.machines ?? 0}</b></span>
                            <span>•</span>
                            <span>Total: <b>{totalItems}</b> enregistrements</span>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 self-end sm:self-center">
                          {isConfirming ? (
                            <div className="flex items-center gap-1.5 bg-amber-100 p-1.5 rounded-xl border border-amber-300 animate-in fade-in">
                              <span className="text-[10px] font-bold text-amber-900 px-1">Confirmer ?</span>
                              <button
                                type="button"
                                disabled={isRestoring}
                                onClick={() => handleExecuteRestore(snap.id)}
                                className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-[11px] cursor-pointer shadow-2xs"
                              >
                                {isRestoring ? 'Restauration...' : 'Oui, Restaurer'}
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmRestoreId(null)}
                                className="px-2 py-1 rounded-lg bg-white text-slate-700 font-bold text-[11px] hover:bg-slate-100 border border-slate-300 cursor-pointer"
                              >
                                Annuler
                              </button>
                            </div>
                          ) : (
                            <>
                              <button
                                type="button"
                                disabled={!canRestore}
                                onClick={() => setConfirmRestoreId(snap.id)}
                                className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 border border-slate-200 text-xs font-bold text-slate-700 transition flex items-center gap-1 cursor-pointer disabled:opacity-40"
                                title="Restaurer l'état à ce point"
                              >
                                <RotateCcw className="w-3 h-3 text-emerald-600" />
                                <span>Restaurer</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleDelete(snap.id)}
                                className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                                title="Supprimer ce point"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}

        {/* Tab 2: Dual Partition Model (Constitution AGENTS.md) */}
        {activeTab === 'partitions' && (
          <div className="p-5 overflow-y-auto space-y-4 grow">
            {/* Partition 1 Card: Master Referential */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-800 flex items-center justify-center font-bold">
                    <Server className="w-4 h-4 text-indigo-700" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                      Partition 1 : Référentiel Master Usine (Master Referential)
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      412 Machines • 19 Zones • 282 Pannes • 114 Tâches Standard • Utilisateurs
                    </p>
                  </div>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-900 font-mono">
                  Protégé & Immuable
                </span>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                Cette partition contient les fondations immuables de l'usine. Elle n'est jamais altérée par les mouvements quotidiens et sert de source de vérité universelle (SSOT).
              </p>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => handleExportPartition('master')}
                  className="px-3 py-1.5 rounded-xl bg-white hover:bg-indigo-50 border border-indigo-200 text-indigo-800 font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <Download className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Exporter Référentiel Master JSON</span>
                </button>
              </div>
            </div>

            {/* Partition 2 Card: Operations History */}
            <div className="p-4 rounded-2xl bg-amber-50/50 border border-amber-200/80 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
                    <Activity className="w-4 h-4 text-amber-700" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                      Partition 2 : Historique Opérationnel (Operations History)
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Demandes DI • Bons de Travail BT • Mouvements Magasin • Suivi Réalisations
                    </p>
                  </div>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 font-mono">
                  Transactionnel
                </span>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                Cette partition accumule les activités quotidiennes et les mouvements de stock. Vous pouvez l'exporter ou la purger pour démarrer un nouvel exercice sans toucher à la configuration de vos machines.
              </p>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => handleExportPartition('operations')}
                  className="px-3 py-1.5 rounded-xl bg-white hover:bg-amber-50 border border-amber-200 text-amber-900 font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <Download className="w-3.5 h-3.5 text-amber-700" />
                  <span>Exporter Opérations JSON</span>
                </button>

                {confirmResetOps ? (
                  <div className="flex items-center gap-1.5 bg-rose-100 p-1.5 rounded-xl border border-rose-300 animate-in fade-in">
                    <span className="text-[10px] font-bold text-rose-900 px-1">Confirmer la purge ?</span>
                    <button
                      type="button"
                      onClick={handleResetOperations}
                      className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-[11px] cursor-pointer shadow-2xs"
                    >
                      Oui, Purger Opérations
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmResetOps(false)}
                      className="px-2 py-1 rounded-lg bg-white text-slate-700 font-bold text-[11px] hover:bg-slate-100 border border-slate-300 cursor-pointer"
                    >
                      Annuler
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmResetOps(true)}
                    className="px-3 py-1.5 rounded-xl bg-white hover:bg-rose-50 border border-rose-200 text-rose-700 font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-2xs"
                    title="Purger l'historique sans toucher aux machines et catalogues"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                    <span>Purger Historique Opérations</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <div className="flex items-center gap-1.5 font-mono text-[11px]">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Moteur Relational Hétérogène • IndexDB & LocalStorage</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 font-bold text-xs text-slate-800 transition cursor-pointer"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
