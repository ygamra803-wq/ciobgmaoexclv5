import { useState, useMemo, useEffect } from 'react';
import AnimatedPage from '../../components/common/AnimatedPage';
import { Settings as SettingsIcon } from 'lucide-react';

import initialStock from '../../../data/stock/seedStockItems.json';
import initialStockTypes from '../../../data/stock/seedStockTypes.json';
import initialMouvements from '../../../data/movements/seedMouvements.json';
import initialMachines from '../../../data/machines/seedMachines.json';
import initialFamilies from '../../../data/machines/seedFamilies.json';
import initialTemplates from '../../../data/machines/seedTemplates.json';
import initialZones from '../../../data/zones/seedZones.json';
import initialTechnicians from '../../../data/users/seedTechnicians.json';
import initialOperations from '../../../data/users/seedOperations.json';
import initialCorrectiveInterventions from '../../../data/corrective/seedCorrectiveInterventions.json';
import { storageService } from '../../../utils/storageService';
import { indexedDBService } from '../../../infrastructure/database/IndexedDBService';
import { STORAGE_KEYS } from '../../../infrastructure/persistence/storageKeys';
import { backupService } from '../../../utils/BackupService';
import { auditService } from '../../../utils/AuditService';
import { accessLogService } from '../../../utils/AccessLogService';
import { logger } from '../../../utils/Logger';
import { Logger } from '../../../core/logger/LoggerService';
import { dataIntegrityService } from '../../../services/dataIntegrityService';
import { performanceService } from '../../../services/performanceService';
import { syncQueueService } from '../../../services/syncQueueService';
import { errorTracker } from '../../../services/ErrorTrackingService';
import { analytics } from '../../../services/AnalyticsService';
import { useAuth } from '../../../context/AuthContext';
import BackupManagerModal from '../../components/backup/BackupManagerModal';
import PerformanceDashboardPanel from '../../components/settings/PerformanceDashboardPanel';
import AppearanceLayoutSelector from '../../components/settings/AppearanceLayoutSelector';

import SettingsNavTabs from './components/SettingsNavTabs';
import SettingsOverviewTab from './components/SettingsOverviewTab';
import SettingsMvtLogicTab from './components/SettingsMvtLogicTab';
import SettingsInjectionTab from './components/SettingsInjectionTab';
import SettingsDirectoryTab from './components/SettingsDirectoryTab';
import SettingsMatchingTab from './components/SettingsMatchingTab';
import SettingsJsonEditorTab from './components/SettingsJsonEditorTab';
import SettingsBackupAuditTab from './components/SettingsBackupAuditTab';
import SettingsAdminTab from './components/SettingsAdminTab';
import {
  AuditZoneModal,
  AuditUserModal,
  AuditArticleModal,
  AuditRelinkModal,
} from './components/AuditModals';

export default function SettingsView({
  rawStock = [],
  setRawStock,
  mouvements = [],
  setMouvements,
  machines = [],
  setMachines,
  families = [],
  setFamilies,
  templates = [],
  setTemplates,
  zones = [],
  setZones,
  technicians = [],
  setTechnicians,
  operations = [],
  setOperations,
  types = [],
  setTypes,
  warehouseItems = [],
  sortiesExterne = [],
  preventiveTasks = [],
  setPreventiveTasks,
  correctiveInterventions = [],
  setCorrectiveInterventions,
  onResetCorrective,
  onBulkImportCorrective,
  onLoadDemoData,
  onClearAllForRealFactory,
  onLoadDemoSection,
  onClearDemoSection,
  onExportExcel,
  onDownloadBlankTemplate,
  showToast,
  linkedFileHandle,
  linkedFileName,
  onDirectLink,
}: any) {
  const [activeTab, setActiveTab] = useState('overview');

  // Local storage size computation (L1 Rapide + L2 IndexedDB High-Capacity)
  const localStorageSizeKB = useMemo(() => {
    let total = 0;
    for (const x in localStorage) {
      if (Object.prototype.hasOwnProperty.call(localStorage, x)) {
        total += (localStorage[x].length + x.length) * 2;
      }
    }
    return (total / 1024).toFixed(1);
  }, [rawStock, mouvements, machines, families, templates, zones, technicians, operations, types]);

  const [allocatedCacheCeilingMB, setAllocatedCacheCeilingMB] = useState(() => {
    const saved = localStorage.getItem('gmao_cache_ceiling_mb');
    return saved ? Number(saved) : 1024;
  });

  const [idbQuotaInfo, setIdbQuotaInfo] = useState({
    usageBytes: 0,
    usageMB: '0.00',
    usageKB: '0.0',
    allocatedCeilingMB: 1024,
    browserQuotaGB: '1.0',
    percentage: '0.00',
    isPersisted: false,
  });

  useEffect(() => {
    let mounted = true;
    indexedDBService.getStorageQuotaInfo(allocatedCacheCeilingMB).then((info) => {
      if (mounted && info) {
        setIdbQuotaInfo(info);
      }
    });
    return () => {
      mounted = false;
    };
  }, [rawStock, mouvements, machines, preventiveTasks, correctiveInterventions, allocatedCacheCeilingMB]);

  const handleCeilingChange = (newCeilingMB: number | string) => {
    const val = Number(newCeilingMB) || 1024;
    setAllocatedCacheCeilingMB(val);
    localStorage.setItem('gmao_cache_ceiling_mb', String(val));
    indexedDBService.requestPersistentStorage();
    showToast?.(
      `Capacité Cache Navigateur (IndexedDB L2) configurée sur ${val >= 1024 ? `${val / 1024} GB` : `${val} MB`}`,
      'success'
    );
  };

  const totalUsedMB = useMemo(() => {
    const l1MB = parseFloat(localStorageSizeKB) / 1024;
    const l2MB = parseFloat(idbQuotaInfo.usageMB) || 0;
    return Math.max(l1MB, l2MB).toFixed(2);
  }, [localStorageSizeKB, idbQuotaInfo.usageMB]);

  const storagePercentage = useMemo(() => {
    const usedMB = parseFloat(totalUsedMB) || 0;
    return Math.min(100, (usedMB / allocatedCacheCeilingMB) * 100).toFixed(2);
  }, [totalUsedMB, allocatedCacheCeilingMB]);

  // Shared working directory path
  const [sharedFolderPath, setSharedFolderPath] = useState(() => {
    return localStorage.getItem('gmao_shared_folder_path') || 'Z:\\Partage\\CIOB_GMAO';
  });

  const [autoWriteExcel, setAutoWriteExcel] = useState(() => {
    return localStorage.getItem('gmao_auto_write_excel') !== 'false';
  });

  const [pollingInterval, setPollingInterval] = useState(() => {
    return localStorage.getItem('gmao_polling_interval') || '10s';
  });

  const [isDemoMode, setIsDemoMode] = useState(() => {
    const demoFlag = storageService.getItem(STORAGE_KEYS.DEMO_MODE);
    const startMode = storageService.getItem(STORAGE_KEYS.START_MODE);
    return (demoFlag === true || demoFlag === 'true') && startMode !== 'empty';
  });

  // Admin & Security Config States (Zero-Knowledge Vault)
  const {
    user: currentUser,
    getAvailableAccounts,
    updateUserPassword,
    resetAllAccountsToDefaults,
    switchSessionToUser,
    isVaultExists,
    isVaultUnlocked,
    setupMasterPin,
  } = (useAuth() || {}) as any;

  const [accountsList, setAccountsList] = useState(() => {
    return getAvailableAccounts ? getAvailableAccounts() : [];
  });
  const [masterPinSetup, setMasterPinSetup] = useState('');
  const [currentMasterPin, setCurrentMasterPin] = useState('');

  useEffect(() => {
    if (getAvailableAccounts) {
      setAccountsList(getAvailableAccounts());
    }
  }, [getAvailableAccounts, isVaultUnlocked]);

  const handleResetAllAccounts = async () => {
    if (window.confirm('Voulez-vous réinitialiser le coffre-fort et tous les comptes système ?')) {
      const pin = prompt('Veuillez saisir votre Master PIN pour autoriser la réinitialisation :');
      if (!pin) return;
      try {
        if (resetAllAccountsToDefaults) {
          await resetAllAccountsToDefaults(pin);
          setAccountsList(getAvailableAccounts ? getAvailableAccounts() : []);
          showToast('Le coffre-fort a été réinitialisé. Définissez votre nouveau Master PIN.', 'info');
        }
      } catch (err: any) {
        showToast(err.message || 'Échec de la réinitialisation.', 'error');
      }
    }
  };

  const [tempRole, setTempRole] = useState(() => {
    return (
      localStorage.getItem('gmao_admin_role') || 'Gestionnaire Principal du Stock & Mouvements'
    );
  });

  const [tempPin, setTempPin] = useState('');

  const [auditTarget, setAuditTarget] = useState('machines');
  const [showAuditUserModal, setShowAuditUserModal] = useState(false);
  const [auditUserForm, setAuditUserForm] = useState({
    type: 'TECHNICIEN',
    nom: '',
    id_zone: '',
    specialite: '',
  });
  const [showAuditZoneModal, setShowAuditZoneModal] = useState(false);
  const [auditZoneForm, setAuditZoneForm] = useState({ libelle: '' });
  const [showAuditArticleModal, setShowAuditArticleModal] = useState(false);
  const [auditArticleForm, setAuditArticleForm] = useState({
    ref: '',
    designation: '',
    type: '',
    emplacement: 'Magasin PDR',
    stockInitial: 0,
    seuil: 5,
  });
  const [showRelinkModal, setShowRelinkModal] = useState(false);
  const [relinkData, setRelinkData] = useState({
    entityType: 'machine',
    oldKey: '',
    targetKey: '',
    occurrencesCount: 0,
  });

  // Sequential ID Generator Helpers for audit manual registration
  const getNextUserId = (type: string) => {
    if (type === 'TECHNICIEN') {
      const nums = technicians
        .map((t: any) => {
          const m = String(t.id_technician || '').match(/TECH-(\d+)/i);
          return m ? parseInt(m[1], 10) : 0;
        })
        .filter((n: number) => !isNaN(n));
      const max = nums.length > 0 ? Math.max(...nums) : 0;
      return `TECH-${String(max + 1).padStart(2, '0')}`;
    } else if (type === 'OPERATEUR') {
      const nums = operations
        .filter((o: any) => o.type_profil === 'OPERATEUR')
        .map((o: any) => {
          const m = String(o.id_operation || '').match(/OP-(\d+)/i);
          return m ? parseInt(m[1], 10) : 0;
        })
        .filter((n: number) => !isNaN(n));
      const max = nums.length > 0 ? Math.max(...nums) : 0;
      return `OP-${String(max + 1).padStart(2, '0')}`;
    } else if (type === 'CHEF') {
      const nums = operations
        .filter((o: any) => o.type_profil === 'CHEF')
        .map((o: any) => {
          const m = String(o.id_operation || '').match(/CHEF-(\d+)/i);
          return m ? parseInt(m[1], 10) : 0;
        })
        .filter((n: number) => !isNaN(n));
      const max = nums.length > 0 ? Math.max(...nums) : 0;
      return `CHEF-${String(max + 1).padStart(2, '0')}`;
    }
    return '';
  };

  const getNextZoneId = () => {
    const nums = zones
      .map((z: any) => {
        const m = String(z.id_zone || '').match(/ZONE-(\d+)/i);
        return m ? parseInt(m[1], 10) : 0;
      })
      .filter((n: number) => !isNaN(n));
    const max = nums.length > 0 ? Math.max(...nums) : 0;
    return `ZONE-${String(max + 1).padStart(2, '0')}`;
  };

  // AUDIT & VERIFICATION ENGINE (Multi-Entity Strict Relational Matching)
  const discoveredItems = useMemo(() => {
    const candidates: Record<string, any> = {};

    if (auditTarget === 'machines') {
      const registeredIds = new Set(
        (machines || [])
          .map((m: any) => String(m.id_machine_registered || '').toLowerCase().trim())
          .filter(Boolean)
      );

      (mouvements || []).forEach((m: any, idx: number) => {
        const code = String(m.id_machine_registered || '').trim();
        if (code && !registeredIds.has(code.toLowerCase())) {
          if (!candidates[code]) {
            candidates[code] = { count: 0, sources: new Set(), sample: `Mouvement #${idx + 1}` };
          }
          candidates[code].count += 1;
          candidates[code].sources.add('Mouvements');
        }
      });

      (correctiveInterventions || []).forEach((ci: any) => {
        const code = String(ci.id_machine || ci.machine_id || '').trim();
        if (code && !registeredIds.has(code.toLowerCase())) {
          if (!candidates[code]) {
            candidates[code] = {
              count: 0,
              sources: new Set(),
              sample: `Correctif (${ci.id || ci.code_bon || 'BT'})`,
            };
          }
          candidates[code].count += 1;
          candidates[code].sources.add('Correctif Hub');
        }
      });

      (preventiveTasks || []).forEach((pt: any) => {
        const code = String(pt.machine_id || pt.id_machine || '').trim();
        if (code && !registeredIds.has(code.toLowerCase())) {
          if (!candidates[code]) {
            candidates[code] = {
              count: 0,
              sources: new Set(),
              sample: `Préventif (${pt.id || pt.code || 'Tâche'})`,
            };
          }
          candidates[code].count += 1;
          candidates[code].sources.add('Planning Préventif');
        }
      });

      const mchRegex = /\b([A-Z]{2,4}-\d{2,3}|[A-Z]{2,4}-\d{1,2})\b/gi;
      const scanTexts = (text: string, sourceLabel: string) => {
        if (!text) return;
        let match;
        mchRegex.lastIndex = 0;
        while ((match = mchRegex.exec(text)) !== null) {
          const code = match[1].toUpperCase();
          if (
            [
              'B1', 'R1', 'R2', 'R3', 'R4', 'R5', 'R6',
              'A1', 'A2', 'A3', 'A4', 'A5', 'A6',
              'REF', 'TPL', 'FAM', 'ZONE', 'TECH', 'CHEF', 'OP', 'MCH', 'PDR', 'STOCK',
            ].includes(code)
          ) {
            continue;
          }

          if (!registeredIds.has(code.toLowerCase())) {
            if (!candidates[code]) {
              candidates[code] = { count: 0, sources: new Set(), sample: sourceLabel };
            }
            candidates[code].count += 1;
            candidates[code].sources.add(sourceLabel);
          }
        }
      };

      (mouvements || []).forEach((m: any, idx: number) => {
        scanTexts(m.commentaire, `Commentaire Mvt #${idx + 1}`);
      });

      return Object.entries(candidates)
        .map(([code, meta]) => ({
          code,
          count: meta.count,
          sourceList: Array.from(meta.sources).join(', '),
          sample: meta.sample,
          entityType: 'machine',
        }))
        .sort((a, b) => b.count - a.count);
    } else if (auditTarget === 'articles') {
      const registeredRefs = new Set(
        (rawStock || [])
          .map((s: any) => String(s.ref || '').toUpperCase().trim())
          .filter(Boolean)
      );

      (mouvements || []).forEach((m: any, idx: number) => {
        const ref = String(m.ref || '').trim();
        if (ref && !registeredRefs.has(ref.toUpperCase())) {
          if (!candidates[ref]) {
            candidates[ref] = {
              count: 0,
              sources: new Set(),
              sample: `Mvt #${idx + 1} (${m.type || 'Mvt'} ${m.quantite || 1})`,
            };
          }
          candidates[ref].count += 1;
          candidates[ref].sources.add('Journal Mouvements');
        }
      });

      return Object.entries(candidates)
        .map(([code, meta]) => ({
          code,
          count: meta.count,
          sourceList: Array.from(meta.sources).join(', '),
          sample: meta.sample,
          entityType: 'article',
        }))
        .sort((a, b) => b.count - a.count);
    } else if (auditTarget === 'zones') {
      const registeredZones = new Set(
        [
          ...(zones || []).map((z: any) => String(z.id_zone || '').toLowerCase().trim()),
          ...(zones || []).map((z: any) => String(z.libelle || '').toLowerCase().trim()),
          ...(zones || []).map((z: any) => String(z.nom || '').toLowerCase().trim()),
        ].filter(Boolean)
      );

      (mouvements || []).forEach((m: any, idx: number) => {
        const code = String(m.id_zone || '').trim();
        if (code && !registeredZones.has(code.toLowerCase())) {
          if (!candidates[code]) {
            candidates[code] = { count: 0, sources: new Set(), sample: `Mouvement #${idx + 1}` };
          }
          candidates[code].count += 1;
          candidates[code].sources.add('Mouvements');
        }
      });

      (machines || []).forEach((m: any) => {
        const code = String(m.id_zone_default || m.id_zone || '').trim();
        if (code && !registeredZones.has(code.toLowerCase())) {
          if (!candidates[code]) {
            candidates[code] = {
              count: 0,
              sources: new Set(),
              sample: `Machine ${m.id_machine_registered}`,
            };
          }
          candidates[code].count += 1;
          candidates[code].sources.add('Parc Machines');
        }
      });

      return Object.entries(candidates)
        .map(([code, meta]) => ({
          code,
          count: meta.count,
          sourceList: Array.from(meta.sources).join(', '),
          sample: meta.sample,
          entityType: 'zone',
        }))
        .sort((a, b) => b.count - a.count);
    } else if (auditTarget === 'utilisateurs') {
      const registeredNames = new Set(
        [
          ...(technicians || []).map((t: any) => String(t.nom || '').toLowerCase().trim()),
          ...(technicians || []).map((t: any) => String(t.id_technician || '').toLowerCase().trim()),
          ...(operations || []).map((o: any) => String(o.nom || '').toLowerCase().trim()),
          ...(operations || []).map((o: any) => String(o.id_operation || '').toLowerCase().trim()),
        ].filter(Boolean)
      );

      const userMap: Record<string, any> = {};
      const addCandidate = (rawName: string, sourceField: string) => {
        if (!rawName) return;
        const name = rawName.trim();
        if (!name) return;
        if (registeredNames.has(name.toLowerCase())) return;
        if (/^(OP-|CHEF-|TECH-)/i.test(name)) return;

        if (!userMap[name]) {
          userMap[name] = {
            count: 0,
            techCount: 0,
            opCount: 0,
            demandeurCount: 0,
            sources: new Set(),
          };
        }
        userMap[name].count += 1;
        userMap[name].sources.add(sourceField);
        if (sourceField === 'Technicien') userMap[name].techCount += 1;
        if (sourceField === 'Opération/Chef') userMap[name].opCount += 1;
        if (sourceField === 'Demandeur') userMap[name].demandeurCount += 1;
      };

      (mouvements || []).forEach((m: any) => {
        if (m.technicien) addCandidate(m.technicien, 'Technicien');
        if (m.operation) addCandidate(m.operation, 'Opération/Chef');
        if (m.demandeur) addCandidate(m.demandeur, 'Demandeur');
      });

      (correctiveInterventions || []).forEach((ci: any) => {
        if (ci.technicien_id || ci.technicien)
          addCandidate(ci.technicien_id || ci.technicien, 'Technicien');
        if (ci.demandeur) addCandidate(ci.demandeur, 'Demandeur');
      });

      (machines || []).forEach((m: any) => {
        if (m.technician) addCandidate(m.technician, 'Parc Machine');
      });

      return Object.entries(userMap)
        .map(([name, meta]) => {
          let inferredRole;
          if (/\bchef\b/i.test(name) || /\bsuperviseur\b/i.test(name)) {
            inferredRole = 'CHEF';
          } else if (/\bop/i.test(name) || /\bopér/i.test(name) || meta.opCount > meta.techCount) {
            inferredRole = 'OPERATEUR';
          } else {
            inferredRole = 'TECHNICIEN';
          }
          const sourceList = Array.from(meta.sources).join(', ');
          return {
            code: name,
            count: meta.count,
            inferredRole,
            sourceList,
            entityType: 'user',
          };
        })
        .sort((a, b) => b.count - a.count);
    } else if (auditTarget === 'correctif') {
      const registeredMachines = new Set(
        (machines || [])
          .map((m: any) => String(m.id_machine_registered || '').toUpperCase().trim())
          .filter(Boolean)
      );
      (correctiveInterventions || []).forEach((ci: any) => {
        const mKey = String(ci.id_machine || ci.machine_id || '').trim();
        if (mKey && !registeredMachines.has(mKey.toUpperCase())) {
          if (!candidates[mKey]) {
            candidates[mKey] = {
              count: 0,
              sources: new Set(),
              sample: `Intervention ${ci.id || ci.code_bon || 'Sans ID'}`,
            };
          }
          candidates[mKey].count += 1;
          candidates[mKey].sources.add('Bons de Travail');
        }
      });
      return Object.entries(candidates)
        .map(([code, meta]) => ({
          code,
          count: meta.count,
          sourceList: Array.from(meta.sources).join(', '),
          sample: meta.sample,
          entityType: 'machine',
        }))
        .sort((a, b) => b.count - a.count);
    } else if (auditTarget === 'preventif') {
      const registeredMachines = new Set(
        (machines || [])
          .map((m: any) => String(m.id_machine_registered || '').toUpperCase().trim())
          .filter(Boolean)
      );
      (preventiveTasks || []).forEach((pt: any) => {
        const mKey = String(pt.machine_id || pt.id_machine || '').trim();
        if (mKey && !registeredMachines.has(mKey.toUpperCase())) {
          if (!candidates[mKey]) {
            candidates[mKey] = {
              count: 0,
              sources: new Set(),
              sample: `Tâche ${pt.id || pt.code || 'Sans ID'}`,
            };
          }
          candidates[mKey].count += 1;
          candidates[mKey].sources.add('Tâches Préventives');
        }
      });
      return Object.entries(candidates)
        .map(([code, meta]) => ({
          code,
          count: meta.count,
          sourceList: Array.from(meta.sources).join(', '),
          sample: meta.sample,
          entityType: 'machine',
        }))
        .sort((a, b) => b.count - a.count);
    }

    return [];
  }, [
    auditTarget,
    mouvements,
    rawStock,
    machines,
    zones,
    technicians,
    operations,
    correctiveInterventions,
    preventiveTasks,
  ]);

  const [auditCurrentPage, setAuditCurrentPage] = useState(1);
  const [auditPageSize, setAuditPageSize] = useState(25);

  useEffect(() => {
    setAuditCurrentPage(1);
  }, [auditTarget]);

  const auditTotalItems = discoveredItems.length;
  const auditTotalPages = auditPageSize === 0 ? 1 : Math.ceil(auditTotalItems / auditPageSize) || 1;
  const auditEffectivePageSize = auditPageSize === 0 ? auditTotalItems : auditPageSize;
  const auditStartIndex = (auditCurrentPage - 1) * auditEffectivePageSize;

  const rawAuditDisplayedData = useMemo(() => {
    return auditPageSize === 0
      ? discoveredItems
      : discoveredItems.slice(auditStartIndex, auditStartIndex + auditEffectivePageSize);
  }, [discoveredItems, auditPageSize, auditStartIndex, auditEffectivePageSize]);

  const auditDisplayedItems = rawAuditDisplayedData;

  // JSON Advanced Editor States
  const [jsonTarget, setJsonTarget] = useState('rawStock');
  const [jsonText, setJsonText] = useState('');
  const [jsonError, setJsonError] = useState<string | null>(null);

  const originalJsonText = useMemo(() => {
    let targetData = [];
    if (jsonTarget === 'rawStock') targetData = rawStock;
    else if (jsonTarget === 'mouvements') targetData = mouvements;
    else if (jsonTarget === 'machines') targetData = machines;
    else if (jsonTarget === 'families') targetData = families;
    else if (jsonTarget === 'templates') targetData = templates;
    else if (jsonTarget === 'zones') targetData = zones;
    else if (jsonTarget === 'technicians') targetData = technicians;
    else if (jsonTarget === 'operations') targetData = operations;
    else if (jsonTarget === 'types') targetData = types;
    return JSON.stringify(targetData, null, 2);
  }, [
    jsonTarget,
    rawStock,
    mouvements,
    machines,
    families,
    templates,
    zones,
    technicians,
    operations,
    types,
  ]);

  const isJsonModified = useMemo(() => {
    return jsonText !== originalJsonText;
  }, [jsonText, originalJsonText]);

  useEffect(() => {
    setJsonText(originalJsonText);
    setJsonError(null);
  }, [originalJsonText, activeTab]);

  const handleSaveJSON = () => {
    try {
      const parsed = JSON.parse(jsonText);
      if (!Array.isArray(parsed)) {
        throw new Error("La structure doit être un tableau JSON d'objets.");
      }

      if (jsonTarget === 'rawStock') setRawStock(parsed);
      else if (jsonTarget === 'mouvements') setMouvements(parsed);
      else if (jsonTarget === 'machines') setMachines(parsed);
      else if (jsonTarget === 'families') setFamilies(parsed);
      else if (jsonTarget === 'templates') setTemplates(parsed);
      else if (jsonTarget === 'zones') setZones(parsed);
      else if (jsonTarget === 'technicians') setTechnicians(parsed);
      else if (jsonTarget === 'operations') setOperations(parsed);
      else if (jsonTarget === 'types') setTypes(parsed);

      setJsonError(null);
      showToast('Modification appliquée avec succès !', 'success');
    } catch (err: any) {
      setJsonError(err.message);
      showToast('Erreur de validation du JSON.', 'error');
    }
  };

  const handleDownloadJSON = () => {
    try {
      const blob = new Blob([jsonText], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `gmao_config_${jsonTarget}_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showToast('Fichier JSON téléchargé avec succès.', 'success');
    } catch {
      showToast('Erreur lors du téléchargement.', 'error');
    }
  };

  const handleUploadJSON = (e: any) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event: any) => {
      try {
        const text = event.target.result;
        const parsed = JSON.parse(text);
        if (!Array.isArray(parsed)) {
          showToast("Avertissement : Le fichier importé n'est pas un tableau d'objets.", 'info');
        }
        setJsonText(JSON.stringify(parsed, null, 2));
        setJsonError(null);
        showToast(
          "Fichier chargé dans l'éditeur. Veuillez l'enregistrer pour appliquer.",
          'success'
        );
      } catch (err: any) {
        setJsonError(`JSON invalide : ${err.message}`);
        showToast('Le fichier importé contient un JSON invalide.', 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleCancelEdits = () => {
    setJsonText(originalJsonText);
    setJsonError(null);
    showToast("Modification annulée. Retour aux données d'origine.", 'info');
  };

  // Directory details
  const [fileDetails, setFileDetails] = useState({ size: '1.2 Mo', lastModified: '30/08 10:23' });
  useEffect(() => {
    async function fetchFileDetails() {
      if (linkedFileHandle) {
        try {
          const file = await linkedFileHandle.getFile();
          const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
          const date = new Date(file.lastModified);
          const formattedDate =
            date.toLocaleDateString('fr-FR') +
            ' ' +
            date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
          setFileDetails({ size: `${sizeMB} Mo`, lastModified: formattedDate });
        } catch (e) {
          Logger.error('Failed to get linked file details:', e, 'SettingsView');
        }
      }
    }
    fetchFileDetails();
  }, [linkedFileHandle]);

  const handleSaveSettings = () => {
    storageService.setItem('gmao_shared_folder_path', sharedFolderPath);
    storageService.setItem('gmao_auto_write_excel', String(autoWriteExcel));
    storageService.setItem('gmao_polling_interval', pollingInterval);
    storageService.setItem(STORAGE_KEYS.START_MODE, isDemoMode ? 'demo' : 'empty');
    storageService.setItem(STORAGE_KEYS.DEMO_MODE, isDemoMode);
    showToast('Paramètres système mis à jour !', 'success');
  };

  // DATA INJECTION HUB HANDLERS
  const handleResetToZero = () => {
    if (
      window.confirm(
        'Êtes-vous sûr de vouloir TOUT effacer ? Cette action videra toutes les tables locales de stockage (Mode Usine Réelle).'
      )
    ) {
      if (typeof onClearAllForRealFactory === 'function') {
        onClearAllForRealFactory();
      } else {
        setRawStock([]);
        setMouvements([]);
        setMachines([]);
        setFamilies([]);
        setTemplates([]);
        setZones([]);
        setTechnicians([]);
        setOperations([]);
        setTypes([]);
        if (setPreventiveTasks) setPreventiveTasks([]);
        if (setCorrectiveInterventions) setCorrectiveInterventions([]);
      }
      setIsDemoMode(false);
      showToast('Base de données vidée (Mode Usine Réelle actif) !', 'info');
    }
  };

  const handleInjectGroup = (group: string) => {
    if (typeof onLoadDemoSection === 'function') {
      onLoadDemoSection(group);
      const labels: Record<string, string> = {
        stock: 'Stock, Types & Désignations',
        parc: 'Parc Machines, Familles, Modèles & Plans',
        entrepot: 'Entrepôt, Organes & Pièces Détachées',
        zones: 'Zones & Équipes Techniques',
        mouvements: 'Mouvements & Sorties Externes',
        preventive: 'Planning & Référentiel Préventif',
        corrective: 'Interventions Correctives & Catalogue Pannes',
      };
      showToast(`Données Démo injectées avec succès pour : ${labels[group] || group}.`, 'success');
      return;
    }

    if (group === 'stock') {
      setRawStock(initialStock);
      setTypes(initialStockTypes);
      showToast(`${initialStock.length} articles injectés dans le stock avec quantités.`, 'success');
    } else if (group === 'parc') {
      setMachines(initialMachines);
      setFamilies(initialFamilies);
      setTemplates(initialTemplates);
      showToast(`Parc machine initialisé avec succès (${initialMachines.length} machines).`, 'success');
    } else if (group === 'zones') {
      setZones(initialZones);
      setTechnicians(initialTechnicians);
      setOperations(initialOperations);
      showToast('Zones et équipes initialisées avec succès.', 'success');
    } else if (group === 'mouvements') {
      setMouvements(initialMouvements);
      showToast(`${initialMouvements.length} mouvements historiques injectés.`, 'success');
    } else if (group === 'corrective') {
      if (typeof onResetCorrective === 'function') {
        onResetCorrective();
      } else if (typeof onBulkImportCorrective === 'function') {
        onBulkImportCorrective(initialCorrectiveInterventions);
      }
      showToast(`${initialCorrectiveInterventions.length} interventions correctives injectées.`, 'success');
    }
  };

  const handleClearGroup = (group: string) => {
    if (!group || group === 'all') {
      handleResetToZero();
      return;
    }
    if (typeof onClearDemoSection === 'function') {
      onClearDemoSection(group);
      showToast(`La section "${group}" a été vidée avec succès.`, 'info');
    }
  };

  const handleToggleDemoMode = (nextActive: boolean, targetSection = 'all') => {
    if (targetSection === 'all') {
      setIsDemoMode(nextActive);
      storageService.setItem(STORAGE_KEYS.DEMO_MODE, nextActive);
      storageService.setItem(STORAGE_KEYS.START_MODE, nextActive ? 'demo' : 'empty');
      if (nextActive) {
        handleInjectAll();
      } else {
        handleResetToZero();
      }
    } else {
      if (nextActive) {
        handleInjectGroup(targetSection);
      } else {
        handleClearGroup(targetSection);
      }
    }
  };

  const handleInjectAll = () => {
    if (typeof onLoadDemoData === 'function') {
      onLoadDemoData();
    } else {
      handleInjectGroup('stock');
      handleInjectGroup('parc');
      handleInjectGroup('zones');
      handleInjectGroup('mouvements');
      handleInjectGroup('corrective');
    }
    setIsDemoMode(true);
    showToast("Injection globale de toute l'usine (Données Démo SSOT) terminée avec succès.", 'success');
  };

  // Orphan calculations & handlers
  const preventiveOrphans = useMemo(
    () =>
      dataIntegrityService
        .annotatePreventiveOrphans(preventiveTasks, machines)
        .filter((t: any) => t._isOrphan),
    [preventiveTasks, machines]
  );
  const correctiveOrphans = useMemo(
    () =>
      dataIntegrityService
        .annotateCorrectiveOrphans(correctiveInterventions, machines)
        .filter((i: any) => i._isOrphan),
    [correctiveInterventions, machines]
  );

  const handlePurgePreventiveOrphans = () => {
    const impact = dataIntegrityService.previewClearImpact({
      action: 'CLEAR_PREVENTIVE',
      machines,
      preventiveTasks,
      correctiveInterventions,
    });
    if (preventiveOrphans.length === 0) {
      showToast?.('Aucune tâche préventive orpheline à purger.', 'info');
      return;
    }
    if (
      window.confirm(
        `Supprimer définitivement ${preventiveOrphans.length} tâche(s) préventive(s) orpheline(s) ?\n\n${impact.warnings[0] || ''}`
      )
    ) {
      const { kept } = dataIntegrityService.purgeOrphanPreventiveTasks(preventiveTasks, machines);
      setPreventiveTasks(kept);
      showToast?.(`${preventiveOrphans.length} tâche(s) orpheline(s) purgée(s) avec succès.`, 'success');
    }
  };

  const handlePurgeCorrectiveOrphans = () => {
    const impact = dataIntegrityService.previewClearImpact({
      action: 'CLEAR_CORRECTIVE',
      machines,
      preventiveTasks,
      correctiveInterventions,
    });
    if (correctiveOrphans.length === 0) {
      showToast?.('Aucune intervention corrective orpheline à purger.', 'info');
      return;
    }
    if (
      window.confirm(
        `Supprimer définitivement ${correctiveOrphans.length} intervention(s) corrective(s) orpheline(s) ?\n\n${impact.warnings[0] || ''}`
      )
    ) {
      const { kept } = dataIntegrityService.purgeOrphanCorrectiveInterventions(
        correctiveInterventions,
        machines
      );
      setCorrectiveInterventions(kept);
      showToast?.(
        `${correctiveOrphans.length} intervention(s) orpheline(s) purgée(s) avec succès.`,
        'success'
      );
    }
  };

  const handleBulkRelink = (entityType: string) => {
    const orphans = entityType === 'preventive' ? preventiveOrphans : correctiveOrphans;
    if (orphans.length === 0) {
      showToast?.('Aucun élément orphelin à réassigner.', 'info');
      return;
    }
    const activeMachines = Array.from(dataIntegrityService.buildActiveMachineIdSet(machines));
    if (activeMachines.length === 0) {
      showToast?.('Aucune machine active disponible pour la réassignation.', 'error');
      return;
    }
    const target = window.prompt(
      `Entrez le code de la machine active cible parmi (${activeMachines.slice(0, 10).join(', ')}...):`,
      activeMachines[0]
    );
    if (!target) return;

    const items = entityType === 'preventive' ? preventiveTasks : correctiveInterventions;
    const { updated, changedCount, error } = dataIntegrityService.bulkRelinkOrphans({
      entityType,
      items,
      machines,
      newMachineId: target,
    });

    if (error) {
      showToast?.('Erreur: Machine cible invalide ou archivée.', 'error');
      return;
    }

    if (entityType === 'preventive') {
      setPreventiveTasks(updated);
    } else {
      setCorrectiveInterventions(updated);
    }
    showToast?.(`${changedCount} élément(s) réassigné(s) avec succès à ${target}.`, 'success');
  };

  const handleRegisterDiscovered = () => {
    if (discoveredItems.length === 0) return;

    if (auditTarget === 'machines') {
      const defaultFamily = families[0]?.id_family || 'FAM-EMB';
      const defaultTemplate = templates[0]?.id_templates || 'TPL-RCF100';
      const defaultZone = zones[0]?.id_zone || 'ZONE-DET';
      const defaultTech = technicians[0]?.nom || 'Rachid';

      const newMachines = discoveredItems.map((dm: any) => ({
        id_machine_registered: dm.code,
        designation: `Machine Auto-Détectée ${dm.code}`,
        id_family: defaultFamily,
        id_templates: defaultTemplate,
        id_zone_default: defaultZone,
        technician: defaultTech,
        status: 'En service',
      }));
      setMachines((prev: any[]) => [...prev, ...newMachines]);
      showToast(`${newMachines.length} machines enregistrées avec succès.`, 'success');
    } else if (auditTarget === 'utilisateurs') {
      let regTech = 0;
      let regChef = 0;
      let regOp = 0;

      const nextTechs = [...technicians];
      const nextOps = [...operations];

      discoveredItems.forEach((item: any) => {
        const name = item.code;
        const role = item.inferredRole || 'TECHNICIEN';

        if (role === 'TECHNICIEN') {
          const nums = nextTechs
            .map((t: any) => {
              const m = String(t.id_technician || '').match(/TECH-(\d+)/i);
              return m ? parseInt(m[1], 10) : 0;
            })
            .filter((n: number) => !isNaN(n));
          const max = nums.length > 0 ? Math.max(...nums) : 0;
          const nextId = `TECH-${String(max + 1).padStart(2, '0')}`;

          nextTechs.push({
            id_technician: nextId,
            nom: name,
            specialite: 'GMAO & Maintenance',
            contact: '',
            avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(name)}`,
          });
          regTech++;
        } else if (role === 'CHEF') {
          const nums = nextOps
            .filter((o: any) => o.type_profil === 'CHEF' || String(o.id_operation).startsWith('CHEF'))
            .map((o: any) => {
              const m = String(o.id_operation || '').match(/CHEF-(\d+)/i);
              return m ? parseInt(m[1], 10) : 0;
            })
            .filter((n: number) => !isNaN(n));
          const max = nums.length > 0 ? Math.max(...nums) : 0;
          const nextId = `CHEF-${String(max + 1).padStart(2, '0')}`;

          nextOps.push({
            id_operation: nextId,
            nom: name,
            id_zone: zones[0]?.id_zone || 'ZONE-DET',
            type_profil: 'CHEF',
            avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(name)}`,
          });
          regChef++;
        } else {
          const nums = nextOps
            .filter(
              (o: any) => o.type_profil === 'OPERATEUR' || !String(o.id_operation).startsWith('CHEF')
            )
            .map((o: any) => {
              const m = String(o.id_operation || '').match(/OP-(\d+)/i);
              return m ? parseInt(m[1], 10) : 0;
            })
            .filter((n: number) => !isNaN(n));
          const max = nums.length > 0 ? Math.max(...nums) : 0;
          const nextId = `OP-${String(max + 1).padStart(2, '0')}`;

          nextOps.push({
            id_operation: nextId,
            nom: name,
            id_zone: zones[0]?.id_zone || 'ZONE-DET',
            type_profil: 'OPERATEUR',
            avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(name)}`,
          });
          regOp++;
        }
      });

      setTechnicians(nextTechs);
      setOperations(nextOps);
      showToast(
        `${discoveredItems.length} utilisateur(s) enregistrés automatiquement (${regTech} Techs, ${regChef} Chefs, ${regOp} Opérateurs) avec identifiants séquentiels uniques.`,
        'success'
      );
    } else if (auditTarget === 'articles') {
      const defaultType = types[0]?.id_type || 'MECANIQUE';
      const newArticles = discoveredItems.map((item: any) => ({
        ref: item.code,
        designation: `Pièce PDR ${item.code}`,
        type: defaultType,
        stockInitial: 0,
        stockActuel: 0,
        seuil: 5,
        emplacement: 'Magasin PDR',
      }));
      if (setRawStock) {
        setRawStock((prev: any[]) => [...prev, ...newArticles]);
      }
      storageService.saveArticles([...rawStock, ...newArticles]);
      showToast(`${newArticles.length} article(s) de stock enregistrés avec succès.`, 'success');
    } else {
      showToast(
        'Veuillez enregistrer les éléments manuellement pour attribuer leurs libellés ou utilisez le bouton Rattacher.',
        'info'
      );
    }
  };

  const handleExecuteRelink = () => {
    if (!relinkData.oldKey || !relinkData.targetKey) {
      showToast?.('Veuillez sélectionner un élément cible valide.', 'error');
      return;
    }
    const result = dataIntegrityService.relinkForeignKey({
      entityType: relinkData.entityType,
      oldKey: relinkData.oldKey,
      newKey: relinkData.targetKey,
      datasets: {
        mouvements,
        correctiveInterventions,
        preventiveTasks,
        machines,
      },
    });

    if (result.success) {
      if (setMouvements && result.nextMouvements) setMouvements(result.nextMouvements);
      if (setCorrectiveInterventions && result.nextInterventions)
        setCorrectiveInterventions(result.nextInterventions);
      if (setPreventiveTasks && result.nextPreventiveTasks)
        setPreventiveTasks(result.nextPreventiveTasks);
      if (setMachines && result.nextMachines) setMachines(result.nextMachines);

      showToast?.(
        `${result.affectedCount} occurrence(s) rattachée(s) et corrigée(s) vers "${relinkData.targetKey}".`,
        'success'
      );
      setShowRelinkModal(false);
      setRelinkData({ entityType: 'machine', oldKey: '', targetKey: '', occurrencesCount: 0 });
    }
  };

  const [backupsList, setBackupsList] = useState<any[]>([]);
  const [showBackupManagerModal, setShowBackupManagerModal] = useState(false);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [accessLogs, setAccessLogs] = useState<any[]>([]);
  const [auditSubTab, setAuditSubTab] = useState('access');
  const [integrityReport, setIntegrityReport] = useState<any>(null);
  const [checkingIntegrity, setCheckingIntegrity] = useState(false);
  const [currentChecksum, setCurrentChecksum] = useState('');
  const [syncQueueState, setSyncQueueState] = useState(() => syncQueueService.getState());
  const [perfStats, setPerfStats] = useState<any>({
    heapMB: 0,
    recalcStats: null,
  });
  const [errorReports, setErrorReports] = useState(() => errorTracker.getReports());
  const [analyticsEvents, setAnalyticsEvents] = useState(() => analytics.getEvents());

  const refreshTelemetry = () => {
    setErrorReports(errorTracker.getReports());
    setAnalyticsEvents(analytics.getEvents());
  };

  const handleSimulateError = () => {
    try {
      throw new Error(
        `Erreur Diagnostic Simulée CIOB GMAO [Code: DIAG-${Date.now().toString().slice(-4)}]`
      );
    } catch (err: any) {
      errorTracker.captureException(err, { source: 'Diagnostic Simulation' });
      refreshTelemetry();
      showToast?.(
        'Erreur de test interceptée et enregistrée avec succès dans le journal local !',
        'info'
      );
    }
  };

  const handleExportErrorReports = () => {
    const jsonStr = errorTracker.exportReportsAsJson();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ciob_gmao_error_reports_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast?.("Rapport d'erreurs exporté en JSON", 'success');
  };

  const handleClearErrorReports = () => {
    errorTracker.clearReports();
    refreshTelemetry();
    showToast?.('Journal des erreurs vidé avec succès', 'success');
  };

  const handleClearAnalytics = () => {
    analytics.clearEvents();
    refreshTelemetry();
    showToast?.('Journal des événements analytics réinitialisé', 'success');
  };

  const runIntegrityCheck = () => {
    setCheckingIntegrity(true);
    setTimeout(() => {
      try {
        const rep = dataIntegrityService.getIntegrityReport({
          stock: rawStock,
          movements: mouvements,
          machines,
          zones,
          technicians,
          operations,
          preventiveTasks,
          correctiveInterventions,
        });
        const cs = dataIntegrityService.calculateChecksum({
          rawStock,
          mouvements,
          machines,
          families,
          zones,
          technicians,
        });
        setIntegrityReport(rep);
        setCurrentChecksum(cs);
      } catch (err) {
        Logger.error('Erreur diagnostic intégrité:', err, 'SettingsView');
      } finally {
        setCheckingIntegrity(false);
      }
    }, 120);
  };

  const handleRepairData = () => {
    if (
      !window.confirm(
        'Voulez-vous corriger automatiquement les anomalies de stocks négatifs, décalages de calculs Excel et valeurs manquantes ?'
      )
    )
      return;
    const { repairedStock, fixedCount } = dataIntegrityService.autoHealData({
      rawStock,
      mouvements,
    });
    if (setRawStock) {
      setRawStock(repairedStock);
    }
    storageService.saveArticles(repairedStock);
    runIntegrityCheck();
    showToast?.(
      `${fixedCount} correction(s) et alignement(s) de formules appliqués avec succès.`,
      'success'
    );
  };

  const runPerformanceBenchmark = async () => {
    try {
      await performanceService.measure('Calcul_Formules_Twin_Stock', async () => {
        const mvtsMap = new Map();
        for (const m of mouvements) {
          const r = (m.ref || '').toUpperCase();
          if (!mvtsMap.has(r)) mvtsMap.set(r, { in: 0, out: 0 });
          const item = mvtsMap.get(r);
          if (m.type === 'Entrée') item.in += Number(m.quantite) || 0;
          else if (m.type === 'Sortie') item.out += Number(m.quantite) || 0;
        }
        return rawStock.map((s: any) => ({
          ...s,
          calc:
            (Number(s.stockInitial) || 0) +
            (mvtsMap.get((s.ref || '').toUpperCase())?.in || 0) -
            (mvtsMap.get((s.ref || '').toUpperCase())?.out || 0),
        }));
      });
      refreshPerformanceMetrics();
      showToast('Benchmark de performance calculé avec succès.', 'success');
    } catch (e) {
      Logger.error('Performance benchmark error:', e, 'SettingsView');
    }
  };

  const refreshPerformanceMetrics = () => {
    setPerfStats({
      heapMB: performanceService.getMemoryUsage(),
      recalcStats: performanceService.getStats('Calcul_Formules_Twin_Stock'),
    });
    setSyncQueueState(syncQueueService.getState());
  };

  const loadAccessLogs = () => {
    const logs = accessLogService.getLogs();
    setAccessLogs(logs || []);
  };

  const handleClearAccessLogs = () => {
    if (window.confirm('Êtes-vous sûr de vouloir vider le journal des connexions et sessions ?')) {
      accessLogService.clearLogs();
      setAccessLogs([]);
      showToast('Journal des accès réinitialisé.', 'info');
    }
  };

  const loadBackups = async () => {
    try {
      const list = await backupService.getBackupsList();
      setBackupsList(list || []);
    } catch (e) {
      Logger.error('Failed to load backups list:', e, 'SettingsView');
    }
  };

  const loadAuditLogs = async () => {
    try {
      setLoadingAudit(true);
      const list = await auditService.getLog();
      setAuditLogs(list || []);
    } catch (e) {
      Logger.error('Failed to load audit logs:', e, 'SettingsView');
    } finally {
      setLoadingAudit(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'backup-audit') {
      loadBackups();
      loadAuditLogs();
      loadAccessLogs();
      runIntegrityCheck();
      refreshPerformanceMetrics();
    }
  }, [activeTab]);

  const handleRestoreBackup = async (id: string) => {
    if (
      !window.confirm('Attention : Cette action va écraser toutes vos données actuelles. Confirmer ?')
    )
      return;
    try {
      const data = await backupService.restoreBackup(id);
      if (data.Stock_Actuel) setRawStock(data.Stock_Actuel);
      if (data.Mouvement) setMouvements(data.Mouvement);
      if (data.Machines_Registered) setMachines(data.Machines_Registered);
      if (data.Families) setFamilies(data.Families);
      if (data.Templates) setTemplates(data.Templates);
      if (data.Zones) setZones(data.Zones);
      if (data.Technicians) setTechnicians(data.Technicians);
      if (data.Operations) setOperations(data.Operations);
      showToast('Restauration réussie !', 'success');
      logger.info('Backup restored manually', { backupId: id });
    } catch {
      showToast('Erreur lors de la restauration.', 'error');
    }
  };

  const handleExportBackup = async (id: string) => {
    try {
      await backupService.exportBackup(id);
      showToast('Export réussi !', 'success');
    } catch {
      showToast("Erreur lors de l'export.", 'error');
    }
  };

  const getAuditLabel = () => {
    switch (auditTarget) {
      case 'machines':
        return 'Machines';
      case 'articles':
        return 'Articles PDR';
      case 'zones':
        return 'Zones';
      case 'utilisateurs':
        return 'Utilisateurs';
      case 'correctif':
        return 'Liaisons Correctif';
      case 'preventif':
        return 'Liaisons Préventif';
      default:
        return 'Éléments';
    }
  };

  return (
    <AnimatedPage className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700">
              <SettingsIcon className="w-5 h-5 text-slate-600 animate-spin-slow" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <span>Configuration & Paramètres</span>
                <span className="text-xs font-normal text-slate-400 font-mono">
                  / Settings & Twin Engine
                </span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Supervision du stockage local, diffusion LAN / QR, injection de maquettes, appairage
                automatique et liaison dossier réseau.
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-cyan-50 text-cyan-800 border border-cyan-200/60 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
            Mode Hybride LAN & Offline Actif
          </span>
        </div>
      </div>

      {/* Modular Navigation Tabs */}
      <SettingsNavTabs
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        discoveredItemsCount={discoveredItems.length}
      />

      {/* Modular Tab Panels */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 sm:p-6 w-full max-w-full overflow-hidden">
        {activeTab === 'overview' && (
          <SettingsOverviewTab
            localStorageSizeKB={localStorageSizeKB}
            totalUsedMB={totalUsedMB}
            allocatedCacheCeilingMB={allocatedCacheCeilingMB}
            idbQuotaInfo={idbQuotaInfo}
            handleCeilingChange={handleCeilingChange}
            storagePercentage={storagePercentage}
            rawStock={rawStock}
            machines={machines}
            mouvements={mouvements}
            zones={zones}
            technicians={technicians}
            operations={operations}
            warehouseItems={warehouseItems}
            sortiesExterne={sortiesExterne}
            preventiveTasks={preventiveTasks}
            correctiveInterventions={correctiveInterventions}
            linkedFileName={linkedFileName}
            fileDetails={fileDetails}
            linkedFileHandle={linkedFileHandle}
            onDownloadBlankTemplate={onDownloadBlankTemplate}
            onExportExcel={onExportExcel}
            showToast={showToast}
          />
        )}

        {activeTab === 'mvt-logic' && <SettingsMvtLogicTab />}

        {activeTab === 'injection' && (
          <SettingsInjectionTab
            handleInjectAll={handleInjectAll}
            initialStock={initialStock}
            handleInjectGroup={handleInjectGroup}
            handleClearGroup={handleClearGroup}
            initialMachines={initialMachines}
            initialZones={initialZones}
            initialTechnicians={initialTechnicians}
            initialMouvements={initialMouvements}
            initialCorrectiveInterventions={initialCorrectiveInterventions}
            warehouseCount={warehouseItems.length}
            preventiveCount={preventiveTasks.length}
            isDemoMode={isDemoMode}
            setIsDemoMode={setIsDemoMode}
            onToggleDemoMode={handleToggleDemoMode}
            onDownloadBlankTemplate={onDownloadBlankTemplate}
            showToast={showToast}
            handleSaveSettings={handleSaveSettings}
            handleResetToZero={handleResetToZero}
          />
        )}

        {activeTab === 'directory' && (
          <SettingsDirectoryTab
            sharedFolderPath={sharedFolderPath}
            setSharedFolderPath={setSharedFolderPath}
            onDirectLink={onDirectLink}
            autoWriteExcel={autoWriteExcel}
            setAutoWriteExcel={setAutoWriteExcel}
            pollingInterval={pollingInterval}
            setPollingInterval={setPollingInterval}
            linkedFileHandle={linkedFileHandle}
            linkedFileName={linkedFileName}
            handleSaveSettings={handleSaveSettings}
            showToast={showToast}
          />
        )}

        {activeTab === 'matching' && (
          <SettingsMatchingTab
            auditTarget={auditTarget}
            setAuditTarget={setAuditTarget}
            discoveredItems={discoveredItems}
            handleRegisterDiscovered={handleRegisterDiscovered}
            getAuditLabel={getAuditLabel}
            auditDisplayedItems={auditDisplayedItems}
            auditStartIndex={auditStartIndex}
            getNextUserId={getNextUserId}
            setRelinkData={setRelinkData}
            setShowRelinkModal={setShowRelinkModal}
            setMachines={setMachines}
            families={families}
            templates={templates}
            zones={zones}
            technicians={technicians}
            showToast={showToast}
            setAuditArticleForm={setAuditArticleForm}
            types={types}
            setShowAuditArticleModal={setShowAuditArticleModal}
            setAuditZoneForm={setAuditZoneForm}
            setShowAuditZoneModal={setShowAuditZoneModal}
            setAuditUserForm={setAuditUserForm}
            setShowAuditUserModal={setShowAuditUserModal}
            auditPageSize={auditPageSize}
            setAuditPageSize={setAuditPageSize}
            setAuditCurrentPage={setAuditCurrentPage}
            auditTotalItems={auditTotalItems}
            rawAuditDisplayedData={rawAuditDisplayedData}
            auditTotalPages={auditTotalPages}
            auditCurrentPage={auditCurrentPage}
          />
        )}

        {activeTab === 'json-editor' && (
          <SettingsJsonEditorTab
            jsonTarget={jsonTarget}
            setJsonTarget={setJsonTarget}
            handleUploadJSON={handleUploadJSON}
            handleDownloadJSON={handleDownloadJSON}
            jsonError={jsonError}
            jsonText={jsonText}
            setJsonText={setJsonText}
            handleCancelEdits={handleCancelEdits}
            isJsonModified={isJsonModified}
            handleSaveJSON={handleSaveJSON}
          />
        )}

        {activeTab === 'backup-audit' && (
          <SettingsBackupAuditTab
            auditSubTab={auditSubTab}
            setAuditSubTab={setAuditSubTab}
            accessLogs={accessLogs}
            auditLogs={auditLogs}
            backupsList={backupsList}
            errorReports={errorReports}
            analyticsEvents={analyticsEvents}
            loadAccessLogs={loadAccessLogs}
            handleClearAccessLogs={handleClearAccessLogs}
            loadAuditLogs={loadAuditLogs}
            loadingAudit={loadingAudit}
            loadBackups={loadBackups}
            setShowBackupManagerModal={setShowBackupManagerModal}
            handleExportBackup={handleExportBackup}
            handleRestoreBackup={handleRestoreBackup}
            runIntegrityCheck={runIntegrityCheck}
            checkingIntegrity={checkingIntegrity}
            handleRepairData={handleRepairData}
            integrityReport={integrityReport}
            rawStock={rawStock}
            mouvements={mouvements}
            currentChecksum={currentChecksum}
            preventiveOrphans={preventiveOrphans}
            correctiveOrphans={correctiveOrphans}
            handlePurgePreventiveOrphans={handlePurgePreventiveOrphans}
            handlePurgeCorrectiveOrphans={handlePurgeCorrectiveOrphans}
            handleBulkRelink={handleBulkRelink}
            refreshPerformanceMetrics={refreshPerformanceMetrics}
            runPerformanceBenchmark={runPerformanceBenchmark}
            perfStats={perfStats}
            syncQueueState={syncQueueState}
            refreshTelemetry={refreshTelemetry}
            handleSimulateError={handleSimulateError}
            handleExportErrorReports={handleExportErrorReports}
            handleClearErrorReports={handleClearErrorReports}
            handleClearAnalytics={handleClearAnalytics}
            showToast={showToast}
          />
        )}

        {activeTab === 'admin' && (
          <SettingsAdminTab
            currentUser={currentUser}
            isVaultUnlocked={isVaultUnlocked}
            isVaultExists={isVaultExists}
            masterPinSetup={masterPinSetup}
            setMasterPinSetup={setMasterPinSetup}
            setupMasterPin={setupMasterPin}
            showToast={showToast}
            getAvailableAccounts={getAvailableAccounts}
            setAccountsList={setAccountsList}
            currentMasterPin={currentMasterPin}
            setCurrentMasterPin={setCurrentMasterPin}
            tempPin={tempPin}
            setTempPin={setTempPin}
            tempRole={tempRole}
            setTempRole={setTempRole}
            handleResetAllAccounts={handleResetAllAccounts}
            accountsList={accountsList}
            updateUserPassword={updateUserPassword}
            switchSessionToUser={switchSessionToUser}
          />
        )}

        {activeTab === 'performance' && (
          <PerformanceDashboardPanel
            rawStock={rawStock}
            mouvements={mouvements}
            showToast={showToast}
          />
        )}

        {activeTab === 'appearance' && <AppearanceLayoutSelector showToast={showToast} />}
      </div>

      {/* Modular Audit & Relink Modals */}
      <AuditZoneModal
        isOpen={showAuditZoneModal}
        onClose={() => setShowAuditZoneModal(false)}
        auditZoneForm={auditZoneForm}
        setAuditZoneForm={setAuditZoneForm}
        getNextZoneId={getNextZoneId}
        setZones={setZones}
        showToast={showToast}
      />

      <AuditUserModal
        isOpen={showAuditUserModal}
        onClose={() => setShowAuditUserModal(false)}
        auditUserForm={auditUserForm}
        setAuditUserForm={setAuditUserForm}
        getNextUserId={getNextUserId}
        zones={zones}
        setTechnicians={setTechnicians}
        setOperations={setOperations}
        showToast={showToast}
      />

      <AuditArticleModal
        isOpen={showAuditArticleModal}
        onClose={() => setShowAuditArticleModal(false)}
        auditArticleForm={auditArticleForm}
        setAuditArticleForm={setAuditArticleForm}
        types={types}
        setRawStock={setRawStock}
        rawStock={rawStock}
        storageService={storageService}
        showToast={showToast}
      />

      <AuditRelinkModal
        isOpen={showRelinkModal}
        onClose={() => setShowRelinkModal(false)}
        relinkData={relinkData}
        setRelinkData={setRelinkData}
        machines={machines}
        rawStock={rawStock}
        zones={zones}
        technicians={technicians}
        operations={operations}
        handleExecuteRelink={handleExecuteRelink}
      />

      {showBackupManagerModal && (
        <BackupManagerModal
          isOpen={showBackupManagerModal}
          onClose={() => setShowBackupManagerModal(false)}
          onDataRestored={() => {
            if (showToast) showToast('Données restaurées avec succès !', 'success');
            loadBackups();
            setTimeout(() => {
              window.location.reload();
            }, 700);
          }}
        />
      )}
    </AnimatedPage>
  );
}
