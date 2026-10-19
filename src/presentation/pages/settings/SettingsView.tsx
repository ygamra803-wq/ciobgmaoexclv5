import {  useState, useMemo, useEffect  } from 'react';
import AnimatedPage from '../../components/common/AnimatedPage';
import {
  Settings as SettingsIcon,
  Sliders,
  Database,
  HardDrive,
  RefreshCw,
  Check,
  AlertTriangle,
  FileSpreadsheet,
  Cpu,
  Layers,
  Users,
  ShieldAlert,
  Download,
  Upload,
  RotateCcw,
  FolderOpen,
  CheckCircle2,
  FileCode,
  Trash2,
  Clock,
  Activity,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  UserCheck,
  Globe,
  LogIn,
  LogOut as LogOutIcon,
  Laptop,
  Shield,
  ShieldCheck,
  Zap,
  Wifi,
  Gauge,
  Bug,
  KeyRound,
  Save,
  Wrench,
  Palette,
  Link2,
  Package,
} from 'lucide-react';

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
import { vaultService } from '../../../utils/vaultService';
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
import TelemetryAuditPanel from '../../components/settings/TelemetryAuditPanel';
import PerformanceDashboardPanel from '../../components/settings/PerformanceDashboardPanel';
import AppearanceLayoutSelector from '../../components/settings/AppearanceLayoutSelector';
import SettingsInjectionTab from './components/SettingsInjectionTab';
import SyncButtons from '../../components/common/SyncButtons';


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
}) {
  const [activeTab, setActiveTab] = useState('overview'); // overview, injection, directory, matching, json-editor

  // Local storage size computation (L1 Rapide + L2 IndexedDB High-Capacity)
  const localStorageSizeKB = useMemo(() => {
    let total = 0;
    for (let x in localStorage) {
      if (Object.prototype.hasOwnProperty.call(localStorage, x)) {
        total += (localStorage[x].length + x.length) * 2;
      }
    }
    return (total / 1024).toFixed(1);
  }, [rawStock, mouvements, machines, families, templates, zones, technicians, operations, types]);

  const [allocatedCacheCeilingMB, setAllocatedCacheCeilingMB] = useState(() => {
    const saved = localStorage.getItem('gmao_cache_ceiling_mb');
    return saved ? Number(saved) : 1024; // 1 GB (1024 MB) default industrial standard
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

  const handleCeilingChange = (newCeilingMB) => {
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
  } = useAuth() || {};

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
      } catch (err) {
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

  const [auditTarget, setAuditTarget] = useState('machines'); // machines, articles, zones, utilisateurs, correctif, preventif
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
  const getNextUserId = (type) => {
    if (type === 'TECHNICIEN') {
      const nums = technicians
        .map((t) => {
          const m = String(t.id_technician || '').match(/TECH-(\d+)/i);
          return m ? parseInt(m[1], 10) : 0;
        })
        .filter((n) => !isNaN(n));
      const max = nums.length > 0 ? Math.max(...nums) : 0;
      return `TECH-${String(max + 1).padStart(2, '0')}`;
    } else if (type === 'OPERATEUR') {
      const nums = operations
        .filter((o) => o.type_profil === 'OPERATEUR')
        .map((o) => {
          const m = String(o.id_operation || '').match(/OP-(\d+)/i);
          return m ? parseInt(m[1], 10) : 0;
        })
        .filter((n) => !isNaN(n));
      const max = nums.length > 0 ? Math.max(...nums) : 0;
      return `OP-${String(max + 1).padStart(2, '0')}`;
    } else if (type === 'CHEF') {
      const nums = operations
        .filter((o) => o.type_profil === 'CHEF')
        .map((o) => {
          const m = String(o.id_operation || '').match(/CHEF-(\d+)/i);
          return m ? parseInt(m[1], 10) : 0;
        })
        .filter((n) => !isNaN(n));
      const max = nums.length > 0 ? Math.max(...nums) : 0;
      return `CHEF-${String(max + 1).padStart(2, '0')}`;
    }
    return '';
  };

  const getNextZoneId = () => {
    const nums = zones
      .map((z) => {
        const m = String(z.id_zone || '').match(/ZONE-(\d+)/i);
        return m ? parseInt(m[1], 10) : 0;
      })
      .filter((n) => !isNaN(n));
    const max = nums.length > 0 ? Math.max(...nums) : 0;
    return `ZONE-${String(max + 1).padStart(2, '0')}`;
  };

  // AUDIT & VERIFICATION ENGINE (Multi-Entity Strict Relational Matching)
  const discoveredItems = useMemo(() => {
    const candidates = {};

    if (auditTarget === 'machines') {
      const registeredIds = new Set(
        (machines || []).map((m) =>
          String(m.id_machine_registered || '').toLowerCase().trim()
        ).filter(Boolean)
      );

      // 1. Strict FK from Mouvements
      (mouvements || []).forEach((m, idx) => {
        const code = String(m.id_machine_registered || '').trim();
        if (code && !registeredIds.has(code.toLowerCase())) {
          if (!candidates[code]) {
            candidates[code] = { count: 0, sources: new Set(), sample: `Mouvement #${idx + 1}` };
          }
          candidates[code].count += 1;
          candidates[code].sources.add('Mouvements');
        }
      });

      // 2. Strict FK from Corrective Interventions
      (correctiveInterventions || []).forEach((ci) => {
        const code = String(ci.id_machine || ci.machine_id || '').trim();
        if (code && !registeredIds.has(code.toLowerCase())) {
          if (!candidates[code]) {
            candidates[code] = { count: 0, sources: new Set(), sample: `Correctif (${ci.id || ci.code_bon || 'BT'})` };
          }
          candidates[code].count += 1;
          candidates[code].sources.add('Correctif Hub');
        }
      });

      // 3. Strict FK from Preventive Tasks
      (preventiveTasks || []).forEach((pt) => {
        const code = String(pt.machine_id || pt.id_machine || '').trim();
        if (code && !registeredIds.has(code.toLowerCase())) {
          if (!candidates[code]) {
            candidates[code] = { count: 0, sources: new Set(), sample: `Préventif (${pt.id || pt.code || 'Tâche'})` };
          }
          candidates[code].count += 1;
          candidates[code].sources.add('Planning Préventif');
        }
      });

      // 4. Secondary Regex Text Scanning in comments
      const mchRegex = /\b([A-Z]{2,4}-\d{2,3}|[A-Z]{2,4}-\d{1,2})\b/gi;
      const scanTexts = (text, sourceLabel) => {
        if (!text) return;
        let match;
        mchRegex.lastIndex = 0;
        while ((match = mchRegex.exec(text)) !== null) {
          const code = match[1].toUpperCase();
          if ([
            'B1', 'R1', 'R2', 'R3', 'R4', 'R5', 'R6',
            'A1', 'A2', 'A3', 'A4', 'A5', 'A6',
            'REF', 'TPL', 'FAM', 'ZONE', 'TECH', 'CHEF', 'OP', 'MCH', 'PDR', 'STOCK',
          ].includes(code)) continue;

          if (!registeredIds.has(code.toLowerCase())) {
            if (!candidates[code]) {
              candidates[code] = { count: 0, sources: new Set(), sample: sourceLabel };
            }
            candidates[code].count += 1;
            candidates[code].sources.add(sourceLabel);
          }
        }
      };

      (mouvements || []).forEach((m, idx) => {
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
        (rawStock || []).map((s) => String(s.ref || '').toUpperCase().trim()).filter(Boolean)
      );

      (mouvements || []).forEach((m, idx) => {
        const ref = String(m.ref || '').trim();
        if (ref && !registeredRefs.has(ref.toUpperCase())) {
          if (!candidates[ref]) {
            candidates[ref] = { count: 0, sources: new Set(), sample: `Mvt #${idx + 1} (${m.type || 'Mvt'} ${m.quantite || 1})` };
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
      const registeredZones = new Set([
        ...(zones || []).map((z) => String(z.id_zone || '').toLowerCase().trim()),
        ...(zones || []).map((z) => String(z.libelle || '').toLowerCase().trim()),
        ...(zones || []).map((z) => String(z.nom || '').toLowerCase().trim()),
      ].filter(Boolean));

      (mouvements || []).forEach((m, idx) => {
        const code = String(m.id_zone || '').trim();
        if (code && !registeredZones.has(code.toLowerCase())) {
          if (!candidates[code]) {
            candidates[code] = { count: 0, sources: new Set(), sample: `Mouvement #${idx + 1}` };
          }
          candidates[code].count += 1;
          candidates[code].sources.add('Mouvements');
        }
      });

      (machines || []).forEach((m) => {
        const code = String(m.id_zone_default || m.id_zone || '').trim();
        if (code && !registeredZones.has(code.toLowerCase())) {
          if (!candidates[code]) {
            candidates[code] = { count: 0, sources: new Set(), sample: `Machine ${m.id_machine_registered}` };
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
      const registeredNames = new Set([
        ...(technicians || []).map((t) => String(t.nom || '').toLowerCase().trim()),
        ...(technicians || []).map((t) => String(t.id_technician || '').toLowerCase().trim()),
        ...(operations || []).map((o) => String(o.nom || '').toLowerCase().trim()),
        ...(operations || []).map((o) => String(o.id_operation || '').toLowerCase().trim()),
      ].filter(Boolean));

      const userMap = {};
      const addCandidate = (rawName, sourceField) => {
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

      (mouvements || []).forEach((m) => {
        if (m.technicien) addCandidate(m.technicien, 'Technicien');
        if (m.operation) addCandidate(m.operation, 'Opération/Chef');
        if (m.demandeur) addCandidate(m.demandeur, 'Demandeur');
      });

      (correctiveInterventions || []).forEach((ci) => {
        if (ci.technicien_id || ci.technicien) addCandidate(ci.technicien_id || ci.technicien, 'Technicien');
        if (ci.demandeur) addCandidate(ci.demandeur, 'Demandeur');
      });

      (machines || []).forEach((m) => {
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
        (machines || []).map((m) => String(m.id_machine_registered || '').toUpperCase().trim()).filter(Boolean)
      );
      (correctiveInterventions || []).forEach((ci) => {
        const mKey = String(ci.id_machine || ci.machine_id || '').trim();
        if (mKey && !registeredMachines.has(mKey.toUpperCase())) {
          if (!candidates[mKey]) {
            candidates[mKey] = { count: 0, sources: new Set(), sample: `Intervention ${ci.id || ci.code_bon || 'Sans ID'}` };
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
        (machines || []).map((m) => String(m.id_machine_registered || '').toUpperCase().trim()).filter(Boolean)
      );
      (preventiveTasks || []).forEach((pt) => {
        const mKey = String(pt.machine_id || pt.id_machine || '').trim();
        if (mKey && !registeredMachines.has(mKey.toUpperCase())) {
          if (!candidates[mKey]) {
            candidates[mKey] = { count: 0, sources: new Set(), sample: `Tâche ${pt.id || pt.code || 'Sans ID'}` };
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
  }, [auditTarget, mouvements, rawStock, machines, zones, technicians, operations, correctiveInterventions, preventiveTasks]);

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
  }, [discoveredItems, auditCurrentPage, auditPageSize, auditStartIndex, auditEffectivePageSize]);

  const auditDisplayedItems = useMemo(() => {
    const minRows = 19;
    if (rawAuditDisplayedData.length >= minRows) return rawAuditDisplayedData;
    const padded = [...rawAuditDisplayedData];
    for (let i = 0; i < minRows - rawAuditDisplayedData.length; i++) {
      padded.push({ __isEmptyPlaceholder: true, code: `empty-${i}` });
    }
    return padded;
  }, [rawAuditDisplayedData]);

  // JSON Advanced Editor States
  const [jsonTarget, setJsonTarget] = useState('rawStock');
  const [jsonText, setJsonText] = useState('');
  const [jsonError, setJsonError] = useState(null);

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

  // Load JSON for edit
  useEffect(() => {
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

    setJsonText(JSON.stringify(targetData, null, 2));
    setJsonError(null);
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
    activeTab,
  ]);

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
      showToast('Modification appliquee avec succes !', 'success');
    } catch (err) {
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
      showToast('Fichier JSON telecharge avec succes.', 'success');
    } catch {
      showToast('Erreur lors du telechargement.', 'error');
    }
  };

  const handleUploadJSON = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target.result;
        const parsed = JSON.parse(text);
        if (!Array.isArray(parsed)) {
          showToast("Avertissement : Le fichier importe n'est pas un tableau d'objets.", 'info');
        }
        setJsonText(JSON.stringify(parsed, null, 2));
        setJsonError(null);
        showToast(
          "Fichier charge dans l'editeur. Veuillez l'enregistrer pour appliquer.",
          'success'
        );
      } catch (err) {
        setJsonError(`JSON invalide : ${err.message}`);
        showToast('Le fichier importe contient un JSON invalide.', 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleCancelEdits = () => {
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

    setJsonText(JSON.stringify(targetData, null, 2));
    setJsonError(null);
    showToast("Modification annulee. Retour aux donnees d'origine.", 'info');
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

  // Settings modification handlers
  const handleSaveSettings = () => {
    storageService.setItem('gmao_shared_folder_path', sharedFolderPath);
    storageService.setItem('gmao_auto_write_excel', String(autoWriteExcel));
    storageService.setItem('gmao_polling_interval', pollingInterval);
    storageService.setItem(STORAGE_KEYS.START_MODE, isDemoMode ? 'demo' : 'empty');
    storageService.setItem(STORAGE_KEYS.DEMO_MODE, isDemoMode);
    showToast('Parametres systeme mis a jour !', 'success');
  };

  // DATA INJECTION HUB HANDLERS
  const handleResetToZero = () => {
    if (
      window.confirm(
        'Etes-vous sur de vouloir TOUT effacer ? Cette action videra toutes les tables locales de stockage (Mode Usine Réelle).'
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
      showToast('Base de donnees videe (Mode Usine Réelle actif) !', 'info');
    }
  };

  const handleInjectGroup = (group) => {
    if (typeof onLoadDemoSection === 'function') {
      onLoadDemoSection(group);
      const labels = {
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
      showToast(`${initialStock.length} articles injectes dans le stock avec quantites.`, 'success');
    } else if (group === 'parc') {
      setMachines(initialMachines);
      setFamilies(initialFamilies);
      setTemplates(initialTemplates);
      showToast(`Parc machine initialise avec succes (${initialMachines.length} machines).`, 'success');
    } else if (group === 'zones') {
      setZones(initialZones);
      setTechnicians(initialTechnicians);
      setOperations(initialOperations);
      showToast(`Zones et equipes initialisees avec succes.`, 'success');
    } else if (group === 'mouvements') {
      setMouvements(initialMouvements);
      showToast(`${initialMouvements.length} mouvements historiques injectes.`, 'success');
    } else if (group === 'corrective') {
      if (typeof onResetCorrective === 'function') {
        onResetCorrective();
      } else if (typeof onBulkImportCorrective === 'function') {
        onBulkImportCorrective(initialCorrectiveInterventions);
      }
      showToast(`${initialCorrectiveInterventions.length} interventions correctives injectees.`, 'success');
    }
  };

  const handleClearGroup = (group) => {
    if (!group || group === 'all') {
      handleResetToZero();
      return;
    }
    if (typeof onClearDemoSection === 'function') {
      onClearDemoSection(group);
      showToast(`La section "${group}" a été vidée avec succès.`, 'info');
    }
  };

  const handleToggleDemoMode = (nextActive, targetSection = 'all') => {
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
    showToast('Injection globale de toute l\'usine (Données Démo SSOT) terminee avec succes.', 'success');
  };

  // Orphan calculations & handlers
  const preventiveOrphans = useMemo(
    () => dataIntegrityService.annotatePreventiveOrphans(preventiveTasks, machines).filter((t) => t._isOrphan),
    [preventiveTasks, machines]
  );
  const correctiveOrphans = useMemo(
    () => dataIntegrityService.annotateCorrectiveOrphans(correctiveInterventions, machines).filter((i) => i._isOrphan),
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
    if (window.confirm(`Supprimer définitivement ${preventiveOrphans.length} tâche(s) préventive(s) orpheline(s) ?\n\n${impact.warnings[0] || ''}`)) {
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
    if (window.confirm(`Supprimer définitivement ${correctiveOrphans.length} intervention(s) corrective(s) orpheline(s) ?\n\n${impact.warnings[0] || ''}`)) {
      const { kept } = dataIntegrityService.purgeOrphanCorrectiveInterventions(correctiveInterventions, machines);
      setCorrectiveInterventions(kept);
      showToast?.(`${correctiveOrphans.length} intervention(s) orpheline(s) purgée(s) avec succès.`, 'success');
    }
  };

  const handleBulkRelink = (entityType) => {
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
    const target = window.prompt(`Entrez le code de la machine active cible parmi (${activeMachines.slice(0, 10).join(', ')}...):`, activeMachines[0]);
    if (!target) return;

    const items = entityType === 'preventive' ? preventiveTasks : correctiveInterventions;
    const { updated, changedCount, error } = dataIntegrityService.bulkRelinkOrphans({
      entityType,
      items,
      machines,
      newMachineId: target,
    });

    if (error) {
      showToast?.(`Erreur: Machine cible invalide ou archivée.`, 'error');
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

      const newMachines = discoveredItems.map((dm) => ({
        id_machine_registered: dm.code,
        designation: `Machine Auto-Detectee ${dm.code}`,
        id_family: defaultFamily,
        id_templates: defaultTemplate,
        id_zone_default: defaultZone,
        technician: defaultTech,
        status: 'En service',
      }));
      setMachines((prev) => [...prev, ...newMachines]);
      showToast(`${newMachines.length} machines enregistrées avec succès.`, 'success');
    } else if (auditTarget === 'utilisateurs') {
      let regTech = 0;
      let regChef = 0;
      let regOp = 0;

      let nextTechs = [...technicians];
      let nextOps = [...operations];

      discoveredItems.forEach((item) => {
        const name = item.code;
        const role = item.inferredRole || 'TECHNICIEN';

        if (role === 'TECHNICIEN') {
          const nums = nextTechs
            .map((t) => {
              const m = String(t.id_technician || '').match(/TECH-(\d+)/i);
              return m ? parseInt(m[1], 10) : 0;
            })
            .filter((n) => !isNaN(n));
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
            .filter((o) => o.type_profil === 'CHEF' || String(o.id_operation).startsWith('CHEF'))
            .map((o) => {
              const m = String(o.id_operation || '').match(/CHEF-(\d+)/i);
              return m ? parseInt(m[1], 10) : 0;
            })
            .filter((n) => !isNaN(n));
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
              (o) => o.type_profil === 'OPERATEUR' || !String(o.id_operation).startsWith('CHEF')
            )
            .map((o) => {
              const m = String(o.id_operation || '').match(/OP-(\d+)/i);
              return m ? parseInt(m[1], 10) : 0;
            })
            .filter((n) => !isNaN(n));
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
      const newArticles = discoveredItems.map((item) => ({
        ref: item.code,
        designation: `Pièce PDR ${item.code}`,
        type: defaultType,
        stockInitial: 0,
        stockActuel: 0,
        seuil: 5,
        emplacement: 'Magasin PDR',
      }));
      if (setRawStock) {
        setRawStock((prev) => [...prev, ...newArticles]);
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
      if (setCorrectiveInterventions && result.nextInterventions) setCorrectiveInterventions(result.nextInterventions);
      if (setPreventiveTasks && result.nextPreventiveTasks) setPreventiveTasks(result.nextPreventiveTasks);
      if (setMachines && result.nextMachines) setMachines(result.nextMachines);

      showToast?.(
        `${result.affectedCount} occurrence(s) rattachée(s) et corrigée(s) vers "${relinkData.targetKey}".`,
        'success'
      );
      setShowRelinkModal(false);
      setRelinkData({ entityType: 'machine', oldKey: '', targetKey: '', occurrencesCount: 0 });
    }
  };


  const [backupsList, setBackupsList] = useState([]);
  const [showBackupManagerModal, setShowBackupManagerModal] = useState(false);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [accessLogs, setAccessLogs] = useState([]);
  const [auditSubTab, setAuditSubTab] = useState('access'); // 'access' | 'backups' | 'events' | 'integrity' | 'performance' | 'telemetry'
  const [integrityReport, setIntegrityReport] = useState(null);
  const [checkingIntegrity, setCheckingIntegrity] = useState(false);
  const [currentChecksum, setCurrentChecksum] = useState('');
  const [syncQueueState, setSyncQueueState] = useState(() => syncQueueService.getState());
  const [perfStats, setPerfStats] = useState({
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
      throw new Error(`Erreur Diagnostic Simulée CIOB GMAO [Code: DIAG-${Date.now().toString().slice(-4)}]`);
    } catch (err) {
      errorTracker.captureException(err, { source: 'Diagnostic Simulation' });
      refreshTelemetry();
      showToast?.('Erreur de test interceptée et enregistrée avec succès dans le journal local !', 'info');
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
    showToast?.('Rapport d\'erreurs exporté en JSON', 'success');
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
    if (!window.confirm('Voulez-vous corriger automatiquement les anomalies de stocks négatifs, décalages de calculs Excel et valeurs manquantes ?')) return;
    const { repairedStock, fixedCount } = dataIntegrityService.autoHealData({ rawStock, mouvements });
    if (setRawStock) {
      setRawStock(repairedStock);
    }
    storageService.saveArticles(repairedStock);
    runIntegrityCheck();
    showToast?.(`${fixedCount} correction(s) et alignement(s) de formules appliqués avec succès.`, 'success');
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
        return rawStock.map((s) => ({
          ...s,
          calc: (Number(s.stockInitial) || 0) + (mvtsMap.get((s.ref || '').toUpperCase())?.in || 0) - (mvtsMap.get((s.ref || '').toUpperCase())?.out || 0),
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

  const handleRestoreBackup = async (id) => {
    if (!window.confirm('Attention : Cette action va écraser toutes vos données actuelles. Confirmer ?')) return;
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

  const handleExportBackup = async (id) => {
    try {
      await backupService.exportBackup(id);
      showToast('Export réussi !', 'success');
    } catch {
      showToast('Erreur lors de l\'export.', 'error');
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
      {/* Header Banner - White, high-contrast, no emojis */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700">
              <SettingsIcon className="w-5 h-5 text-slate-600 animate-spin-slow" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <span>Configuration & Parametres</span>
                <span className="text-xs font-normal text-slate-400 font-mono">
                  / Settings & Twin Engine
                </span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Supervision du stockage local, injection de maquettes, appairage automatique et
                liaison dossier reseau.
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-cyan-50 text-cyan-800 border border-cyan-200/60 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
            Mode Offline Local Actif
          </span>
        </div>
      </div>

      {/* Navigation Tabs - Place in card, full-width responsive grid, with premium light theme and matching color highlights */}
      <div className="bg-white p-2 rounded-2xl border border-slate-200 shadow-xs w-full">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2 w-full">
          {[
            {
              id: 'overview',
              label: 'Supervision',
              sub: 'Supervision Stockage',
              icon: HardDrive,
              color: 'text-cyan-600',
              activeBg: 'bg-cyan-50/70',
              activeBorder: 'border-cyan-500',
              activeText: 'text-cyan-950',
              activeIconBg: 'bg-cyan-100/80',
            },
            {
              id: 'mvt-logic',
              label: 'Logique Mouvements',
              sub: 'Intern/Extern & Commande',
              icon: RotateCcw,
              color: 'text-blue-600',
              activeBg: 'bg-blue-50/70',
              activeBorder: 'border-blue-500',
              activeText: 'text-blue-950',
              activeIconBg: 'bg-blue-100/80',
            },
            {
              id: 'injection',
              label: 'Injection',
              sub: "Centre d'injection",
              icon: Sliders,
              color: 'text-emerald-600',
              activeBg: 'bg-emerald-50/70',
              activeBorder: 'border-emerald-500',
              activeText: 'text-emerald-950',
              activeIconBg: 'bg-emerald-100/80',
            },
            {
              id: 'directory',
              label: 'Reseau & Excel',
              sub: 'Twin Dossier Reseau',
              icon: FileSpreadsheet,
              color: 'text-indigo-600',
              activeBg: 'bg-indigo-50/70',
              activeBorder: 'border-indigo-500',
              activeText: 'text-indigo-950',
              activeIconBg: 'bg-indigo-100/80',
            },
            {
              id: 'matching',
              label: `Appairage (${discoveredItems.length})`,
              sub: 'Audit & Synchro',
              icon: ShieldAlert,
              color: 'text-amber-500',
              activeBg: 'bg-amber-50/70',
              activeBorder: 'border-amber-500',
              activeText: 'text-amber-950',
              activeIconBg: 'bg-amber-100/80',
            },
            {
              id: 'json-editor',
              label: 'Base JSON',
              sub: 'Editeur de Base',
              icon: FileCode,
              color: 'text-rose-500',
              activeBg: 'bg-rose-50/70',
              activeBorder: 'border-rose-500',
              activeText: 'text-rose-950',
              activeIconBg: 'bg-rose-100/80',
            },
            {
              id: 'backup-audit',
              label: 'Logs d\'Accès & Audit',
              sub: 'Historique, IP & Restauration',
              icon: Shield,
              color: 'text-fuchsia-600',
              activeBg: 'bg-fuchsia-50/70',
              activeBorder: 'border-fuchsia-500',
              activeText: 'text-fuchsia-950',
              activeIconBg: 'bg-fuchsia-100/80',
            },
            {
              id: 'admin',
              label: 'Compte Admin',
              sub: 'Profil & Securite',
              icon: UserCheck,
              color: 'text-violet-600',
              activeBg: 'bg-violet-50/70',
              activeBorder: 'border-violet-500',
              activeText: 'text-violet-950',
              activeIconBg: 'bg-violet-100/80',
            },
            {
              id: 'performance',
              label: 'Performance & Cache',
              sub: 'Dashboard, Caching & Alertes',
              icon: Activity,
              color: 'text-teal-600',
              activeBg: 'bg-teal-50/70',
              activeBorder: 'border-teal-500',
              activeText: 'text-teal-950',
              activeIconBg: 'bg-teal-100/80',
            },
            {
              id: 'appearance',
              label: 'Apparence',
              sub: 'Thème, disposition & interface',
              icon: Palette,
              color: 'text-purple-600',
              activeBg: 'bg-purple-50/70',
              activeBorder: 'border-purple-500',
              activeText: 'text-purple-950',
              activeIconBg: 'bg-purple-100/80',
            },
          ].map((tab) => {
            const IconComponent = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-3 p-3.5 rounded-xl border transition-all text-left cursor-pointer w-full ${
                  isActive
                    ? `${tab.activeBg} ${tab.activeBorder} ${tab.activeText} shadow-xs font-bold scale-[1.01]`
                    : 'bg-slate-50/50 hover:bg-slate-50 border-slate-200/80 text-slate-600'
                }`}
              >
                <div
                  className={`p-2 rounded-lg shrink-0 border transition-all ${isActive ? `${tab.activeBorder} ${tab.activeIconBg}` : 'bg-white border-slate-200/80'}`}
                >
                  <IconComponent className={`w-4 h-4 ${tab.color}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <div
                    className={`text-xs font-bold leading-tight truncate ${isActive ? 'text-slate-900' : 'text-slate-700'}`}
                  >
                    {tab.label}
                  </div>
                  <div
                    className={`text-[10px] mt-0.5 font-mono truncate ${isActive ? 'text-slate-600' : 'text-slate-400'}`}
                  >
                    {tab.sub}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Panels */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 sm:p-6 w-full max-w-full overflow-hidden">
        {/* PANEL 1: SUPERVISION */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2 flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-cyan-600" />
              Statistiques globales du stockage local
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* LocalStorage & IndexedDB High-Capacity Usage */}
              <div className="p-5 rounded-2xl border border-slate-200 bg-white shadow-xs space-y-3">
                <div className="flex justify-between items-center text-xs font-bold text-slate-700">
                  <span className="flex items-center gap-1.5">
                    <Database className="w-4 h-4 text-cyan-600" />
                    Cache Navigateur (IndexedDB L2 + L1)
                  </span>
                  <span className="font-mono text-cyan-800">
                    {totalUsedMB} MB / {allocatedCacheCeilingMB >= 1024 ? `${allocatedCacheCeilingMB / 1024} GB` : `${allocatedCacheCeilingMB} MB`}
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-100 border border-slate-200 overflow-hidden">
                  <div
                    className="h-full bg-cyan-600 rounded-full transition-all duration-500"
                    style={{ width: `${Math.max(1, parseFloat(storagePercentage))}%` }}
                  />
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 font-medium pt-0.5">
                  <span>
                    L1 Rapide: <b className="text-slate-700 font-mono">{localStorageSizeKB} KB</b> • L2 IndexedDB:{' '}
                    <b className="text-emerald-700 font-mono">
                      {idbQuotaInfo.isPersisted ? 'Persistant' : 'Actif'} (Disque: {idbQuotaInfo.browserQuotaGB} GB)
                    </b>
                  </span>
                  <select
                    value={allocatedCacheCeilingMB}
                    onChange={(e) => handleCeilingChange(e.target.value)}
                    className="px-2 py-0.5 text-[10px] font-bold bg-slate-50 border border-slate-200 rounded-lg text-slate-700 cursor-pointer focus:outline-none focus:border-cyan-500"
                    title="Plafond de capacité alloué au cache industriel"
                  >
                    <option value={256}>Plafond: 256 MB</option>
                    <option value={512}>Plafond: 512 MB</option>
                    <option value={1024}>Plafond: 1 GB (Recommandé)</option>
                    <option value={2048}>Plafond: 2 GB (Big Data)</option>
                    <option value={5120}>Plafond: 5 GB (Max Usine)</option>
                  </select>
                </div>
              </div>

              {/* Counts Card */}
              <div className="p-5 rounded-2xl border border-slate-200 bg-white shadow-xs space-y-2">
                <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Activity className="w-4 h-4 text-emerald-600" />
                  Nombre de fiches enregistrees
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] font-medium text-slate-500 pt-1">
                  <div>
                    Articles:{' '}
                    <b className="text-slate-900 font-mono font-bold">{rawStock.length}</b>
                  </div>
                  <div>
                    Machines:{' '}
                    <b className="text-slate-900 font-mono font-bold">{machines.length}</b>
                  </div>
                  <div>
                    Mouvements:{' '}
                    <b className="text-slate-900 font-mono font-bold">{mouvements.length}</b>
                  </div>
                  <div>
                    Zones: <b className="text-slate-900 font-mono font-bold">{zones.length}</b>
                  </div>
                  <div>
                    Techniciens:{' '}
                    <b className="text-slate-900 font-mono font-bold">{technicians.length}</b>
                  </div>
                  <div>
                    Chefs & Ops:{' '}
                    <b className="text-slate-900 font-mono font-bold">{operations.length}</b>
                  </div>
                </div>
              </div>

              {/* Excel Linked */}
              <div className="p-5 rounded-2xl border border-slate-200 bg-white shadow-xs space-y-2 col-span-1 md:col-span-2 lg:col-span-1">
                <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <FileSpreadsheet className="w-4 h-4 text-indigo-600" />
                  Fichier Excel lie
                </div>
                <div className="text-xs pt-1 space-y-1 text-slate-500 font-medium">
                  <div className="truncate">
                    Nom:{' '}
                    <span className="text-slate-900 font-mono font-bold">
                      {linkedFileName || 'GMAO_Light_Template.xlsx'}
                    </span>
                  </div>
                  <div>
                    Taille: <span className="text-slate-900 font-mono">{fileDetails.size}</span>
                  </div>
                  <div>
                    Modifie le:{' '}
                    <span className="text-slate-900 font-mono">{fileDetails.lastModified}</span>
                  </div>
                  <div className="flex items-center gap-1 text-[10px] font-bold mt-1 text-emerald-600">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                    Liaison:{' '}
                    {linkedFileHandle ? 'Connecte en Direct' : 'Simulation Active (Excel Twin)'}
                  </div>
                </div>
              </div>
            </div>

            {/* FULL FACTORY EXCEL TWIN EXPORT CARD */}
            <div className="p-5 rounded-2xl border-2 border-emerald-200 bg-gradient-to-br from-emerald-50/80 via-white to-teal-50/40 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="p-2 bg-emerald-600 text-white rounded-xl shadow-xs">
                      <FileSpreadsheet className="w-5 h-5" />
                    </span>
                    <div>
                      <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
                        Exportateur Global Excel Twin (Full Factory .XLSX)
                        <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-100 text-emerald-800 rounded-full border border-emerald-200">
                          100% Offline
                        </span>
                      </h4>
                      <p className="text-xs text-slate-500 font-medium">
                        Génère en 1 clic un classeur Excel complet multi-onglets structuré et calibré avec l'ensemble des données de l'usine.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      if (typeof onDownloadBlankTemplate === 'function') {
                        onDownloadBlankTemplate();
                      } else {
                        showToast?.("Téléchargement du gabarit vierge déclenché !", "success");
                      }
                    }}
                    className="px-4 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 text-xs font-bold rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    title="Télécharger un modèle Excel vierge prêt pour la saisie usine avec formules intactes"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                    <span>Gabarit Vierge (Template .XLSX)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (typeof onExportExcel === 'function') {
                        onExportExcel();
                      } else {
                        showToast?.("Export Excel déclenché avec succès !", "success");
                      }
                    }}
                    className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 active:scale-95 text-white text-xs font-black rounded-xl shadow-md shadow-emerald-600/20 hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0"
                  >
                    <Download className="w-4 h-4" />
                    <span>Exporter Tout le Modèle Excel</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-2 pt-2 border-t border-emerald-100/80 text-center">
                <div className="bg-white/80 p-2 rounded-xl border border-emerald-100">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Stock</div>
                  <div className="text-sm font-black text-emerald-700 font-mono">{rawStock.length}</div>
                </div>
                <div className="bg-white/80 p-2 rounded-xl border border-emerald-100">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Machines</div>
                  <div className="text-sm font-black text-emerald-700 font-mono">{machines.length}</div>
                </div>
                <div className="bg-white/80 p-2 rounded-xl border border-emerald-100">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Mouvements</div>
                  <div className="text-sm font-black text-emerald-700 font-mono">{mouvements.length}</div>
                </div>
                <div className="bg-white/80 p-2 rounded-xl border border-emerald-100">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Sorties Ext.</div>
                  <div className="text-sm font-black text-emerald-700 font-mono">{sortiesExterne.length}</div>
                </div>
                <div className="bg-white/80 p-2 rounded-xl border border-emerald-100">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Préventif</div>
                  <div className="text-sm font-black text-emerald-700 font-mono">{preventiveTasks.length}</div>
                </div>
                <div className="bg-white/80 p-2 rounded-xl border border-emerald-100">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Correctif</div>
                  <div className="text-sm font-black text-emerald-700 font-mono">{correctiveInterventions.length}</div>
                </div>
                <div className="bg-white/80 p-2 rounded-xl border border-emerald-100">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Entrepôt</div>
                  <div className="text-sm font-black text-emerald-700 font-mono">{warehouseItems.length}</div>
                </div>
                <div className="bg-white/80 p-2 rounded-xl border border-emerald-100">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Zones & Staff</div>
                  <div className="text-sm font-black text-emerald-700 font-mono">{zones.length + technicians.length}</div>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-600 leading-relaxed max-w-full">
              <div className="font-bold text-slate-900 mb-1">
                Mecanique d'unification de stockage:
              </div>
              Toutes les operations s'effectuent directement dans le navigateur pour garantir une
              execution fluide et ultra-rapide hors ligne. Les donnees de votre inventaire, de vos
              mouvements et de votre parc de machines sont preservees localement meme en cas de
              coupure de reseau.
            </div>
          </div>
        )}

        {/* PANEL: LOGIQUE MOUVEMENTS (INTERN / EXTERN / COMMANDE) */}
        {activeTab === 'mvt-logic' && (
          <div className="space-y-6">
            <div className="border-b border-slate-100 pb-4">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-blue-600 shrink-0" />
                <span>Logique des Mouvements de Stock (Usine Real-World Engine)</span>
              </h3>
              <p className="text-xs text-slate-500 mt-1 max-w-3xl leading-relaxed">
                Cartographie des flux d'usine : distinction nette entre flux Interne, Hors-site
                (Externe), et Commandes d'Achat en attente avec système intelligent de tags
                #INCONNU.
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
                  Consommation directe de pièces pour la maintenance corrective, préventive ou
                  amélioration d'une machine.
                </p>
                <div className="text-[11px] font-mono text-slate-700 bg-white p-2.5 rounded-xl border border-rose-200/80 space-y-1">
                  <div>
                    <b>Traçabilité :</b> N° Bon + Tech + Zone + Machine
                  </div>
                  <div>
                    <b>Impact Stock :</b> Déduction immédiate (
                    <span className="text-rose-600 font-bold">-Qte</span>)
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
                  Restitution de pièces non utilisées ou trouvées sur le terrain. Si aucun Bon n'est
                  fourni, le système applique le Tag <b>#INCONNU</b>.
                </p>
                <div className="text-[11px] font-mono text-slate-700 bg-white p-2.5 rounded-xl border border-cyan-200/80 space-y-1">
                  <div>
                    <b>Règle Bon Vide :</b> Génère N° Bon <b className="text-amber-700">INCONNU</b>
                  </div>
                  <div>
                    <b>Impact Stock :</b> Ajout immédiat (
                    <span className="text-emerald-600 font-bold">+Qte</span>)
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
                  Envoi d'un sous-ensemble (Moteur, Pompe) en réparation chez un sous-traitant
                  extérieur ou prêt entre usines.
                </p>
                <div className="text-[11px] font-mono text-slate-700 bg-white p-2.5 rounded-xl border border-purple-200/80 space-y-1">
                  <div>
                    <b>Champs :</b> N° Bon Externe + Presta/Fournisseur
                  </div>
                  <div>
                    <b>Impact Stock :</b> Déduction (
                    <span className="text-rose-600 font-bold">-Qte</span>)
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
                  Réception de réapprovisionnement sous-traitant / fournisseur ou retour de pièce
                  réparée de l'extérieur.
                </p>
                <div className="text-[11px] font-mono text-slate-700 bg-white p-2.5 rounded-xl border border-emerald-200/80 space-y-1">
                  <div>
                    <b>Champs :</b> Fournisseur + Emplacement Réception
                  </div>
                  <div>
                    <b>Impact Stock :</b> Crédit immédiat (
                    <span className="text-emerald-600 font-bold">+Qte</span>)
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
                  Demande de réapprovisionnement initiée par un technicien ou chef d'équipe. La
                  demande apparaît sur le Dashboard principal dans la section{' '}
                  <b>Commandes en Attente</b> sans modifier le Stock Actuel jusqu'à la confirmation
                  de réception.
                </p>
                <div className="text-[11px] font-mono text-slate-700 bg-white p-2.5 rounded-xl border border-amber-200/80 flex flex-col sm:flex-row justify-between gap-2">
                  <div>
                    <b>Tag Automatique :</b>{' '}
                    <span className="bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded font-bold">
                      #COMMANDE_EN_ATTENTE
                    </span>
                  </div>
                  <div>
                    <b>Validation :</b> Clic sur "Valider Réception" ➔ Converti en{' '}
                    <b>Entrée Externe</b>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* PANEL 2: INJECTION HUB */}
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

        {/* PANEL 3: EXCEL & DIRECTORY LINK */}
        {activeTab === 'directory' && (
          <div className="space-y-6">
            {/* Explicit Server Synchronization Card */}
            <SyncButtons showToast={showToast} />

            <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2 flex items-center gap-2">
              <FolderOpen className="w-4 h-4 text-indigo-600" />
              Source des donnees et dossier reseau partage
            </h3>

            <p className="text-xs text-slate-500 leading-relaxed max-w-3xl">
              Pour deployer le systeme sur plusieurs machines d'ateliers et partager la meme source
              en temps reel, vous pouvez coupler l'application a un repertoire de stockage partagé
              sur votre serveur local d'usine.
            </p>

            <div className="space-y-4 w-full bg-slate-50 p-4 sm:p-5 rounded-2xl border border-slate-200">
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700">
                  Dossier reseau cible ou lecteur mappe partage :
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={sharedFolderPath}
                    onChange={(e) => setSharedFolderPath(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-slate-300 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-cyan-200 font-mono text-slate-800"
                    placeholder="ex: Z:\Partage\CIOB_GMAO"
                  />
                  <button
                    onClick={onDirectLink}
                    className="h-10 px-4 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 font-bold text-xs rounded-xl transition flex items-center justify-center gap-2 shrink-0 cursor-pointer w-full sm:w-auto"
                  >
                    <FolderOpen className="w-4 h-4 text-indigo-600" />
                    Changer de dossier
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">
                    Ecriture Excel automatique :
                  </label>
                  <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-600">
                    <input
                      type="checkbox"
                      checked={autoWriteExcel}
                      onChange={(e) => setAutoWriteExcel(e.target.checked)}
                      className="rounded text-indigo-600 border-slate-300 focus:ring-indigo-500"
                    />
                    <span>Mise a jour auto d'Excel a chaque mouvement</span>
                  </label>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">
                    Frequence de scrutation reseau (Auto-Reload) :
                  </label>
                  <select
                    value={pollingInterval}
                    onChange={(e) => setPollingInterval(e.target.value)}
                    className="h-9 px-3 rounded-lg border border-slate-300 text-xs font-semibold bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200 text-slate-800 w-full"
                  >
                    <option value="off">Rafraichissement manuel uniquement</option>
                    <option value="5s">Toutes les 5 secondes (Recommande)</option>
                    <option value="10s">Toutes les 10 secondes</option>
                    <option value="30s">Toutes les 30 secondes</option>
                  </select>
                </div>
              </div>

              <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-200">
                <div className="text-xs text-slate-500 font-medium flex items-center gap-1.5">
                  Statut de couplage:
                  {linkedFileHandle ? (
                    <span className="text-emerald-700 font-bold flex items-center gap-1.5 inline-flex">
                      <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping" />
                      Connecté ({linkedFileName || 'Fichier réseau partagé'})
                    </span>
                  ) : (
                    <span className="text-rose-700 font-bold flex items-center gap-1.5 inline-flex">
                      <span className="w-1.5 h-1.5 bg-rose-500 rounded-full" />
                      Déconnecté (Aucun fichier réseau lié)
                    </span>
                  )}
                </div>
                <button
                  onClick={handleSaveSettings}
                  className="w-full sm:w-auto px-4 h-9 bg-slate-900 hover:bg-black text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer"
                >
                  Enregistrer les parametres
                </button>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-600 leading-relaxed max-w-full">
              <div className="font-bold text-slate-900 mb-1">Architecture reseau multi-postes:</div>
              En specifiant le meme chemin reseau partage d'ateliers pour chaque poste d'usine,
              l'application synchronisera ses ecrans automatiquement, garantissant aux operateurs,
              techniciens et coordinateurs un etat des stocks et un carnet de mouvements unifies.
            </div>
          </div>
        )}

        {/* PANEL 4: AUDIT & MATCHING */}
        {activeTab === 'matching' && (
          <div className="space-y-6">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-amber-500 shrink-0" />
                  Audit & vérification des données (Appairage)
                </h3>
                <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
                  Détection automatique des éléments (machines, zones, utilisateurs) présents dans
                  l'historique mais manquants dans les fiches officielles.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row items-center gap-3">
                <div className="relative">
                  <select
                    value={auditTarget}
                    onChange={(e) => setAuditTarget(e.target.value)}
                    className="appearance-none bg-white border border-slate-300 rounded-xl pl-4 pr-10 py-2 text-xs font-bold text-slate-700 shadow-sm focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200 transition"
                  >
                    <option value="machines">Machines (Parc)</option>
                    <option value="articles">Articles & PDR (Stock)</option>
                    <option value="zones">Zones (Emplacements)</option>
                    <option value="utilisateurs">Utilisateurs (Membres & Techs)</option>
                    <option value="correctif">Liaisons Correctif (Interventions)</option>
                    <option value="preventif">Liaisons Préventif (Tâches)</option>
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-2.5 pointer-events-none" />
                </div>
                {(auditTarget === 'machines' || auditTarget === 'articles' || auditTarget === 'utilisateurs') &&
                  discoveredItems.length > 0 && (
                    <button
                      onClick={handleRegisterDiscovered}
                      className="w-full lg:w-auto px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Enregistrer les {getAuditLabel()} ({discoveredItems.length})
                    </button>
                  )}
              </div>
            </div>

            {discoveredItems.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-100 space-y-2 max-w-full">
                <Check className="w-8 h-8 text-emerald-500 mx-auto bg-emerald-50 p-1.5 rounded-full" />
                <h4 className="text-sm font-bold text-slate-900">
                  Tout est parfaitement apparié !
                </h4>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  Aucun identifiant ou nom de {getAuditLabel().toLowerCase()} manquant n'a été
                  détecté dans les historiques. Vos analyses sont pleinement fiables.
                </p>
              </div>
            ) : (
              <div className="space-y-4 w-full max-w-full overflow-hidden">
                <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/40 text-xs text-amber-800 flex items-start gap-2.5 leading-relaxed">
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Écart de base détecté :</span> Certains éléments de
                    type "{getAuditLabel()}" apparaissent dans vos mouvements mais ne figurent pas
                    dans la liste officielle.
                    {auditTarget === 'machines' || auditTarget === 'articles' || auditTarget === 'utilisateurs'
                      ? " Cliquez sur 'Enregistrer les " +
                        getAuditLabel() +
                        "' pour une inscription automatique, ou utilisez 'Rattacher' pour corriger une clé erronée."
                      : " Cliquez sur Rattacher pour relier ces occurrences à un élément officiel existant, ou sur Enregistrer pour créer la fiche."}
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 shadow-[0_12px_32px_-6px_rgba(0,0,0,0.12),0_4px_12px_-2px_rgba(0,0,0,0.06)] hover:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.16),0_6px_16px_-3px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-300 ease-out overflow-hidden max-w-full">
                  <div className="max-h-[62vh] overflow-y-auto overflow-x-auto">
                    <table className="min-w-[650px] w-full text-left text-xs whitespace-nowrap border-collapse">
                      <thead className="bg-slate-100/90 text-[11px] font-bold text-slate-700 uppercase tracking-wider border-b border-slate-200 select-none">
                        <tr>
                          <th className="py-2.5 px-3 text-center w-12 text-slate-500 font-mono text-[10px] bg-slate-200/50 border-r border-slate-200 shrink-0">
                            N°
                          </th>
                          <th className="p-3">Élément / Utilisateur détecté</th>
                          <th className="p-3">Occurrences & Sources</th>
                          <th className="p-3">Action / ID proposé</th>
                          <th className="p-3 text-right">Action manuelle</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium">
                        {auditDisplayedItems.map((dm, index) => {
                          if (dm.__isEmptyPlaceholder) {
                            return (
                              <tr key={dm.code} className="h-10 border-b border-slate-100 bg-slate-50/30 text-slate-300 select-none">
                                <td className="py-2.5 px-3 text-center text-[10px] font-mono border-r border-slate-100">
                                  —
                                </td>
                                <td className="py-2.5 px-3">—</td>
                                <td className="py-2.5 px-3">—</td>
                                <td className="py-2.5 px-3">—</td>
                                <td className="py-2.5 px-3 text-right">—</td>
                              </tr>
                            );
                          }

                          const rowIndex = auditStartIndex + index + 1;
                          const proposedId =
                            auditTarget === 'utilisateurs'
                              ? getNextUserId(dm.inferredRole || 'TECHNICIEN')
                              : null;

                          return (
                            <tr
                              key={dm.code}
                              className="hover:bg-slate-50/80 transition text-slate-700 border-b border-slate-100"
                            >
                              <td className="py-2.5 px-3 text-center font-mono text-[10.5px] font-bold text-slate-600 bg-slate-50/50 border-r border-slate-200/60 select-none">
                                {rowIndex}
                              </td>
                              <td className="p-3">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-xs font-bold text-slate-900 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200">
                                    {dm.code}
                                  </span>
                                  {auditTarget === 'utilisateurs' && (
                                    <span
                                      className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                                        dm.inferredRole === 'CHEF'
                                          ? 'bg-amber-50 text-amber-800 border-amber-200'
                                          : dm.inferredRole === 'OPERATEUR'
                                            ? 'bg-indigo-50 text-indigo-800 border-indigo-200'
                                            : 'bg-cyan-50 text-cyan-800 border-cyan-200'
                                      }`}
                                    >
                                      {dm.inferredRole}
                                    </span>
                                  )}
                                  {auditTarget === 'articles' && (
                                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold border bg-teal-50 text-teal-800 border-teal-200">
                                      PDR Stock
                                    </span>
                                  )}
                                  {(auditTarget === 'correctif' || auditTarget === 'preventif') && (
                                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold border bg-rose-50 text-rose-800 border-rose-200">
                                      Liaison orpheline
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="p-3 text-slate-600 font-mono">
                                <div className="font-bold text-slate-800">
                                  {dm.count} apparition{dm.count > 1 ? 's' : ''}
                                </div>
                                {dm.sourceList && (
                                  <div className="text-[10px] text-slate-400 font-sans">
                                    {dm.sourceList}
                                  </div>
                                )}
                              </td>
                              <td className="p-3">
                                {auditTarget === 'utilisateurs' ? (
                                  <span className="text-[11px] font-mono font-bold bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded-md border border-emerald-200">
                                    ➔ {proposedId}
                                  </span>
                                ) : (
                                  <span className="text-[10px] bg-cyan-50 text-cyan-800 px-2 py-0.5 rounded-full border border-cyan-200">
                                    Créer la fiche ({getAuditLabel()})
                                  </span>
                                )}
                              </td>
                              <td className="p-3 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    onClick={() => {
                                      setRelinkData({
                                        entityType:
                                          dm.entityType ||
                                          (auditTarget === 'utilisateurs'
                                            ? 'user'
                                            : auditTarget === 'articles'
                                              ? 'article'
                                              : auditTarget === 'zones'
                                                ? 'zone'
                                                : 'machine'),
                                        oldKey: dm.code,
                                        targetKey: '',
                                        occurrencesCount: dm.count,
                                      });
                                      setShowRelinkModal(true);
                                    }}
                                    className="px-2.5 py-1 text-[11px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition cursor-pointer flex items-center gap-1 shrink-0"
                                    title="Rattacher et corriger les occurrences vers un élément existant"
                                  >
                                    <Link2 className="w-3 h-3" />
                                    <span>Rattacher</span>
                                  </button>
                                  <button
                                    onClick={() => {
                                      if (
                                        auditTarget === 'machines' ||
                                        auditTarget === 'correctif' ||
                                        auditTarget === 'preventif'
                                      ) {
                                        if (setMachines) {
                                          setMachines((prev) => [
                                            ...prev,
                                            {
                                              id_machine_registered: dm.code,
                                              designation: `Machine Auto-Detectee ${dm.code}`,
                                              id_family: families[0]?.id_family || 'FAM-EMB',
                                              id_templates:
                                                templates[0]?.id_templates || 'TPL-RCF100',
                                              id_zone_default: zones[0]?.id_zone || 'ZONE-DET',
                                              technician: technicians[0]?.nom || 'Technicien',
                                              status: 'En service',
                                            },
                                          ]);
                                        }
                                        showToast?.(
                                          `Machine "${dm.code}" ajoutée avec succès.`,
                                          'success'
                                        );
                                      } else if (auditTarget === 'articles') {
                                        setAuditArticleForm({
                                          ref: dm.code,
                                          designation: `Pièce PDR ${dm.code}`,
                                          type: types[0]?.id_type || 'MECANIQUE',
                                          emplacement: 'Magasin PDR',
                                          stockInitial: 0,
                                          seuil: 5,
                                        });
                                        setShowAuditArticleModal(true);
                                      } else if (auditTarget === 'zones') {
                                        setAuditZoneForm({ libelle: dm.code });
                                        setShowAuditZoneModal(true);
                                      } else if (auditTarget === 'utilisateurs') {
                                        setAuditUserForm({
                                          type: dm.inferredRole || 'TECHNICIEN',
                                          nom: dm.code,
                                          id_zone: zones[0]?.id_zone || '',
                                          specialite:
                                            dm.inferredRole === 'TECHNICIEN'
                                              ? 'GMAO & Maintenance'
                                              : '',
                                        });
                                        setShowAuditUserModal(true);
                                      }
                                    }}
                                    className="px-3 py-1 text-[11px] font-extrabold text-cyan-700 bg-cyan-50 hover:bg-cyan-100 rounded-lg transition cursor-pointer shrink-0"
                                  >
                                    Enregistrer
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Table Footer Card with Page Size Selector & Pagination */}
                  <div className="bg-slate-50/70 p-4 border-t border-slate-200 flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-semibold text-slate-600">Lignes par page :</span>
                      <div className="flex bg-slate-200/70 rounded-lg p-0.5 border border-slate-300/60">
                        {[25, 50, 100, 200, 0].map((size) => (
                          <button
                            key={size}
                            type="button"
                            onClick={() => {
                              setAuditPageSize(size);
                              setAuditCurrentPage(1);
                            }}
                            className={`px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                              auditPageSize === size
                                ? 'bg-white text-teal-800 shadow-xs border border-slate-200/50'
                                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                            }`}
                          >
                            {size === 0 ? 'Tout' : size}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-xs font-semibold text-slate-500">
                        Affichage <b className="text-slate-900">{auditTotalItems === 0 ? 0 : auditStartIndex + 1}</b> à{' '}
                        <b className="text-slate-900">
                          {Math.min(auditStartIndex + rawAuditDisplayedData.length, auditTotalItems)}
                        </b>{' '}
                        sur <b className="text-slate-900">{auditTotalItems}</b>
                      </div>

                      {auditPageSize !== 0 && auditTotalPages > 1 && (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setAuditCurrentPage((p) => Math.max(1, p - 1))}
                            disabled={auditCurrentPage === 1}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-semibold transition cursor-pointer shadow-2xs"
                          >
                            <ChevronLeft className="w-3.5 h-3.5" />
                            Précédent
                          </button>

                          <span className="px-2 font-mono text-xs font-bold text-slate-600">
                            Page {auditCurrentPage} sur {auditTotalPages}
                          </span>

                          <button
                            type="button"
                            onClick={() => setAuditCurrentPage((p) => Math.min(auditTotalPages, p + 1))}
                            disabled={auditCurrentPage === auditTotalPages}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-semibold transition cursor-pointer shadow-2xs"
                          >
                            Suivant
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* AUDIT ZONE REGISTRATION MODAL */}
            {showAuditZoneModal && (
              <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <h3 className="text-sm font-bold text-slate-900">
                      Fiche d'enregistrement de Zone
                    </h3>
                    <button
                      onClick={() => setShowAuditZoneModal(false)}
                      className="text-slate-400 hover:text-slate-600 font-bold text-lg"
                    >
                      ×
                    </button>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 mb-1">
                        Nom de la Zone / Atelier
                      </label>
                      <input
                        type="text"
                        value={auditZoneForm.libelle}
                        onChange={(e) =>
                          setAuditZoneForm((prev) => ({ ...prev, libelle: e.target.value }))}

                        className="w-full text-xs font-medium border border-slate-300 rounded-lg p-2"
                        placeholder="ex: Atelier Conditionnement"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
                    <button
                      type="button"
                      onClick={() => setShowAuditZoneModal(false)}
                      className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-800 font-bold"
                    >
                      Annuler
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (!auditZoneForm.libelle.trim()) {
                          showToast('Veuillez saisir un nom de zone valide.', 'error');
                          return;
                        }

                        const id = getNextZoneId();
                        const newZone = {
                          id_zone: id,
                          libelle: auditZoneForm.libelle.trim(),
                          nom: auditZoneForm.libelle.trim(),
                          description: '',
                        };
                        setZones((prev) => [...prev, newZone]);
                        showToast(
                          `Zone "${auditZoneForm.libelle.trim()}" enregistrée avec l'ID ${id}.`,
                          'success'
                        );
                        setShowAuditZoneModal(false);
                      }}
                      className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-xs rounded-lg shadow-sm transition"
                    >
                      Enregistrer
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* AUDIT USER REGISTRATION MODAL */}
            {showAuditUserModal && (
              <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-cyan-50 border border-cyan-200 text-cyan-700 flex items-center justify-center font-bold">
                        <Users className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">
                          Fiche d'enregistrement d'utilisateur
                        </h3>
                        <p className="text-[11px] text-slate-500">
                          Audit GMAO & Sécurisation des Identifiants
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setShowAuditUserModal(false)}
                      className="text-slate-400 hover:text-slate-600 font-bold text-lg cursor-pointer"
                    >
                      ×
                    </button>
                  </div>

                  {/* ID & Security Notice Badge */}
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-600">
                        ID Sécurisé généré :
                      </span>
                      <span className="font-mono font-extrabold text-xs bg-slate-900 text-white px-2.5 py-0.5 rounded-md">
                        {getNextUserId(auditUserForm.type)}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500 leading-tight">
                      🔒 L'ID est unique et séquentiel. Il garantit la traçabilité intégrale des
                      mouvements d'ateliers même si le nom est corrigé ultérieurement.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Profil / Type d'utilisateur
                      </label>
                      <select
                        value={auditUserForm.type}
                        onChange={(e) =>
                          setAuditUserForm((prev) => ({ ...prev, type: e.target.value }))}

                        className="w-full text-xs font-semibold border border-slate-300 rounded-lg p-2 bg-white text-slate-800"
                      >
                        <option value="TECHNICIEN">Technicien (Maintenance / GMAO)</option>
                        <option value="OPERATEUR">Opérateur (Production)</option>
                        <option value="CHEF">Chef d'équipe / Superviseur</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Nom complet
                      </label>
                      <input
                        type="text"
                        value={auditUserForm.nom}
                        onChange={(e) =>
                          setAuditUserForm((prev) => ({ ...prev, nom: e.target.value }))
                        }
                        className="w-full text-xs font-semibold border border-slate-300 rounded-lg p-2 text-slate-800"
                        placeholder="Nom de l'utilisateur"
                      />
                    </div>

                    {auditUserForm.type === 'TECHNICIEN' ? (
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          Spécialité
                        </label>
                        <input
                          type="text"
                          value={auditUserForm.specialite}
                          onChange={(e) =>
                            setAuditUserForm((prev) => ({ ...prev, specialite: e.target.value }))
                          }
                          className="w-full text-xs font-semibold border border-slate-300 rounded-lg p-2 text-slate-800"
                          placeholder="Spécialité du technicien (ex: Mécanique, Électricité)"
                        />
                      </div>
                    ) : (
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          Zone d'affectation
                        </label>
                        <select
                          value={auditUserForm.id_zone}
                          onChange={(e) =>
                            setAuditUserForm((prev) => ({ ...prev, id_zone: e.target.value }))
                          }
                          className="w-full text-xs font-semibold border border-slate-300 rounded-lg p-2 bg-white text-slate-800"
                        >
                          <option value="">Sélectionner une zone</option>
                          {zones.map((z) => (
                            <option key={z.id_zone} value={z.id_zone}>
                              {z.libelle || z.nom}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
                    <button
                      type="button"
                      onClick={() => setShowAuditUserModal(false)}
                      className="px-3.5 py-1.5 text-xs text-slate-600 hover:text-slate-800 font-semibold cursor-pointer"
                    >
                      Annuler
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (!auditUserForm.nom.trim()) {
                          showToast('Veuillez saisir un nom valide.', 'error');
                          return;
                        }

                        const type = auditUserForm.type;
                        const id = getNextUserId(type);

                        if (type === 'TECHNICIEN') {
                          const newTech = {
                            id_technician: id,
                            nom: auditUserForm.nom.trim(),
                            specialite: auditUserForm.specialite.trim() || 'Générale',
                            contact: '',
                            avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(auditUserForm.nom.trim())}`,
                          };
                          setTechnicians((prev) => [...prev, newTech]);
                        } else {
                          const newOp = {
                            id_operation: id,
                            nom: auditUserForm.nom.trim(),
                            id_zone: auditUserForm.id_zone || zones[0]?.id_zone || 'ZONE-DET',
                            type_profil: type,
                            avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(auditUserForm.nom.trim())}`,
                          };
                          setOperations((prev) => [...prev, newOp]);
                        }

                        showToast(
                          `Utilisateur "${auditUserForm.nom.trim()}" enregistré avec l'ID ${id}.`,
                          'success'
                        );
                        setShowAuditUserModal(false);
                      }}
                      className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-xs rounded-lg shadow-xs transition cursor-pointer"
                    >
                      Enregistrer
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* AUDIT ARTICLE REGISTRATION MODAL */}
            {showAuditArticleModal && (
              <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-teal-50 border border-teal-200 text-teal-700 flex items-center justify-center font-bold">
                        <Package className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">
                          Fiche d'enregistrement Pièce PDR
                        </h3>
                        <p className="text-[11px] text-slate-500">
                          Inscription officielle au Référentiel Stock Articles
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setShowAuditArticleModal(false)}
                      className="text-slate-400 hover:text-slate-600 font-bold text-lg cursor-pointer"
                    >
                      ×
                    </button>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Référence PDR (Code Article)
                      </label>
                      <input
                        type="text"
                        value={auditArticleForm.ref}
                        onChange={(e) =>
                          setAuditArticleForm((p) => ({ ...p, ref: e.target.value }))
                        }
                        className="w-full text-xs font-mono font-bold border border-slate-300 rounded-lg p-2 text-slate-800 bg-slate-50"
                        readOnly
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Désignation de la pièce
                      </label>
                      <input
                        type="text"
                        value={auditArticleForm.designation}
                        onChange={(e) =>
                          setAuditArticleForm((p) => ({ ...p, designation: e.target.value }))
                        }
                        className="w-full text-xs font-semibold border border-slate-300 rounded-lg p-2 text-slate-800"
                        placeholder="ex: Roulement à billes 6204-2RS"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          Famille / Type
                        </label>
                        <select
                          value={auditArticleForm.type}
                          onChange={(e) =>
                            setAuditArticleForm((p) => ({ ...p, type: e.target.value }))
                          }
                          className="w-full text-xs font-semibold border border-slate-300 rounded-lg p-2 bg-white text-slate-800"
                        >
                          {(types || []).map((t) => (
                            <option key={t.id_type || t} value={t.id_type || t}>
                              {t.libelle || t.nom || t.id_type || t}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          Emplacement
                        </label>
                        <input
                          type="text"
                          value={auditArticleForm.emplacement}
                          onChange={(e) =>
                            setAuditArticleForm((p) => ({ ...p, emplacement: e.target.value }))
                          }
                          className="w-full text-xs font-medium border border-slate-300 rounded-lg p-2 text-slate-800"
                          placeholder="ex: Magasin PDR"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          Stock Initial
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={auditArticleForm.stockInitial}
                          onChange={(e) =>
                            setAuditArticleForm((p) => ({
                              ...p,
                              stockInitial: Number(e.target.value) || 0,
                            }))
                          }
                          className="w-full text-xs font-mono font-medium border border-slate-300 rounded-lg p-2 text-slate-800"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          Seuil d'Alerte
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={auditArticleForm.seuil}
                          onChange={(e) =>
                            setAuditArticleForm((p) => ({
                              ...p,
                              seuil: Number(e.target.value) || 0,
                            }))
                          }
                          className="w-full text-xs font-mono font-medium border border-slate-300 rounded-lg p-2 text-slate-800"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
                    <button
                      type="button"
                      onClick={() => setShowAuditArticleModal(false)}
                      className="px-3.5 py-1.5 text-xs text-slate-600 hover:text-slate-800 font-semibold cursor-pointer"
                    >
                      Annuler
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (!auditArticleForm.ref.trim() || !auditArticleForm.designation.trim()) {
                          showToast?.('Veuillez renseigner la référence et la désignation.', 'error');
                          return;
                        }
                        const newArticle = {
                          ref: auditArticleForm.ref.trim(),
                          designation: auditArticleForm.designation.trim(),
                          type: auditArticleForm.type || types[0]?.id_type || 'MECANIQUE',
                          emplacement: auditArticleForm.emplacement || 'Magasin PDR',
                          stockInitial: Number(auditArticleForm.stockInitial) || 0,
                          stockActuel: Number(auditArticleForm.stockInitial) || 0,
                          seuil: Number(auditArticleForm.seuil) || 5,
                        };
                        if (setRawStock) {
                          setRawStock((prev) => [...prev, newArticle]);
                        }
                        storageService.saveArticles([...rawStock, newArticle]);
                        showToast?.(`Article "${newArticle.ref}" enregistré avec succès.`, 'success');
                        setShowAuditArticleModal(false);
                      }}
                      className="px-4 py-1.5 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-lg shadow-xs transition cursor-pointer"
                    >
                      Enregistrer
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* AUDIT RELINK & CASCADE REPAIR MODAL */}
            {showRelinkModal && (
              <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center font-bold">
                        <Link2 className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">
                          Rattachement & Correction de Clé
                        </h3>
                        <p className="text-[11px] text-slate-500">
                          Correction en cascade de la clé étrangère
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setShowRelinkModal(false)}
                      className="text-slate-400 hover:text-slate-600 font-bold text-lg cursor-pointer"
                    >
                      ×
                    </button>
                  </div>

                  <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-100 space-y-1.5 text-xs text-indigo-950">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-slate-600">Élément à corriger :</span>
                      <span className="font-mono font-bold px-2 py-0.5 bg-white text-indigo-900 rounded border border-indigo-200">
                        {relinkData.oldKey}
                      </span>
                    </div>
                    <div className="text-[11px] text-indigo-800 leading-relaxed">
                      Ce code apparaît dans <b>{relinkData.occurrencesCount}</b> écriture(s). Choisissez l'élément officiel ci-dessous pour rediriger et corriger toutes ces références automatiquement.
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-[11px] font-bold text-slate-700">
                      Rattacher vers l'élément officiel :
                    </label>
                    <select
                      value={relinkData.targetKey}
                      onChange={(e) =>
                        setRelinkData((prev) => ({ ...prev, targetKey: e.target.value }))
                      }
                      className="w-full text-xs font-semibold border border-slate-300 rounded-lg p-2.5 bg-white text-slate-800 focus:outline-none focus:border-indigo-500"
                    >
                      <option value="">Sélectionner un élément valide...</option>
                      {relinkData.entityType === 'machine' &&
                        machines.map((m) => (
                          <option key={m.id_machine_registered} value={m.id_machine_registered}>
                            {m.id_machine_registered} — {m.designation || 'Machine'}
                          </option>
                        ))}
                      {relinkData.entityType === 'article' &&
                        rawStock.map((s) => (
                          <option key={s.ref} value={s.ref}>
                            {s.ref} — {s.designation || 'Article'}
                          </option>
                        ))}
                      {relinkData.entityType === 'zone' &&
                        zones.map((z) => (
                          <option key={z.id_zone} value={z.id_zone}>
                            {z.id_zone} — {z.libelle || z.nom || 'Zone'}
                          </option>
                        ))}
                      {relinkData.entityType === 'user' && (
                        <>
                          <optgroup label="Techniciens">
                            {technicians.map((t) => (
                              <option key={t.id_technician || t.nom} value={t.nom}>
                                {t.nom} ({t.id_technician || 'TECH'})
                              </option>
                            ))}
                          </optgroup>
                          <optgroup label="Opérateurs & Chefs">
                            {operations.map((o) => (
                              <option key={o.id_operation || o.nom} value={o.nom}>
                                {o.nom} ({o.type_profil || 'OP'})
                              </option>
                            ))}
                          </optgroup>
                        </>
                      )}
                    </select>
                  </div>

                  <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
                    <button
                      type="button"
                      onClick={() => setShowRelinkModal(false)}
                      className="px-3.5 py-1.5 text-xs text-slate-600 hover:text-slate-800 font-semibold cursor-pointer"
                    >
                      Annuler
                    </button>
                    <button
                      type="button"
                      onClick={handleExecuteRelink}
                      disabled={!relinkData.targetKey}
                      className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs rounded-lg shadow-xs transition cursor-pointer"
                    >
                      Appliquer ({relinkData.occurrencesCount} écritures)
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* PANEL 5: ADVANCED JSON PLAYGROUND */}
        {activeTab === 'json-editor' && (
          <div className="space-y-6 max-w-full overflow-hidden">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <FileCode className="w-4 h-4 text-rose-500 shrink-0" />
                  Modification brute de la base de donnees locale au format JSON
                </h3>
                <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
                  Modifiez directement les collections brutes de votre GMAO sous forme de fichiers
                  de donnees JSON.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto shrink-0">
                <select
                  value={jsonTarget}
                  onChange={(e) => setJsonTarget(e.target.value)}
                  className="h-10 px-3 rounded-xl border border-slate-200 text-xs font-bold bg-white focus:outline-none focus:ring-2 focus:ring-cyan-200 text-slate-800 shadow-xs cursor-pointer min-w-[200px]"
                >
                  <option value="rawStock">Articles & Stock_Actuel</option>
                  <option value="mouvements">Mouvements & Historique</option>
                  <option value="machines">Machines_Registered</option>
                  <option value="families">Familles</option>
                  <option value="templates">Modeles (Templates)</option>
                  <option value="zones">Zones d'usine</option>
                  <option value="technicians">Techniciens</option>
                  <option value="operations">Coordinateurs & Chefs</option>
                  <option value="types">Types de pieces</option>
                </select>

                <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 w-full sm:w-auto">
                  {/* Input cache pour le chargement du fichier JSON */}
                  <input
                    type="file"
                    id="json-file-upload-input"
                    accept=".json"
                    onChange={handleUploadJSON}
                    className="hidden"
                  />

                  <button
                    onClick={() => document.getElementById('json-file-upload-input').click()}
                    className="h-10 px-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                    title="Importer un fichier JSON externe"
                  >
                    <Upload className="w-4 h-4 text-emerald-600" />
                    <span>Importer</span>
                  </button>

                  <button
                    onClick={handleDownloadJSON}
                    className="h-10 px-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                    title="Telecharger le code actuel au format JSON"
                  >
                    <Download className="w-4 h-4 text-indigo-600" />
                    <span>Telecharger</span>
                  </button>
                </div>
              </div>
            </div>

            {jsonError && (
              <div className="p-3.5 rounded-xl border border-rose-200 bg-rose-50 text-xs font-mono text-rose-700 flex items-start gap-2 max-w-full overflow-hidden break-words">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <div className="font-bold">Erreur de structure JSON :</div>
                  <div className="mt-1 opacity-90 whitespace-pre-wrap break-all text-[11px]">
                    {jsonError}
                  </div>
                </div>
              </div>
            )}

            <div className="border border-slate-200 rounded-2xl overflow-hidden bg-slate-950 shadow-xs w-full max-w-full">
              <div className="bg-slate-900 border-b border-slate-800 px-4 py-2.5 flex flex-col sm:flex-row gap-2 justify-between sm:items-center text-xs text-slate-400 font-mono">
                <span className="truncate">Editeur natif de code ({jsonTarget})</span>
                <span className="text-[10px] bg-slate-800 text-slate-300 px-2.5 py-0.5 rounded-md border border-slate-700 w-fit shrink-0">
                  Tableau d'objets attendu
                </span>
              </div>
              <textarea
                value={jsonText}
                onChange={(e) => setJsonText(e.target.value)}
                className="w-full h-96 p-4 bg-slate-950 text-emerald-400 font-mono text-xs leading-relaxed border-0 focus:ring-0 focus:outline-none resize-y overflow-auto block"
                spellCheck="false"
              />
            </div>

            {/* Actions de modification JSON */}
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full">
              <button
                onClick={handleCancelEdits}
                disabled={!isJsonModified}
                className={`w-full sm:w-auto h-10 px-4 border font-bold text-xs rounded-xl shadow-xs transition flex items-center justify-center gap-1.5 ${
                  isJsonModified
                    ? 'bg-rose-50 border-rose-200 hover:bg-rose-100 text-rose-700 cursor-pointer'
                    : 'bg-rose-50/50 border-rose-100 text-rose-400 cursor-not-allowed opacity-50'
                }`}
                title="Annuler les modifications et recharger les donnees d'origine"
              >
                <RotateCcw
                  className={`w-4 h-4 ${isJsonModified ? 'text-rose-600' : 'text-rose-400'}`}
                />
                <span>Annuler</span>
              </button>

              <button
                onClick={handleSaveJSON}
                disabled={!isJsonModified}
                className={`w-full sm:w-auto h-10 px-4 border font-bold text-xs rounded-xl shadow-xs transition flex items-center justify-center gap-1.5 ${
                  isJsonModified
                    ? 'bg-emerald-50 border-emerald-200 hover:bg-emerald-100 text-emerald-700 cursor-pointer'
                    : 'bg-emerald-50/50 border-emerald-100 text-emerald-400 cursor-not-allowed opacity-50'
                }`}
                title="Sauvegarder et appliquer definitivement le JSON"
              >
                <Check
                  className={`w-4 h-4 ${isJsonModified ? 'text-emerald-600' : 'text-emerald-400'}`}
                />
                <span>Enregistrer</span>
              </button>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-500 leading-relaxed max-w-full">
              <span className="font-bold text-slate-700">Notice de sauvegarde :</span> Vous pouvez
              copier cette structure JSON pour conserver une sauvegarde externe de securite ou
              modifier directement les champs des elements. Veillez a respecter les correspondances
              de cles ID pour ne pas rompre la coherence relationnelle.
            </div>
          </div>
        )}


        {/* PANEL: SAUVEGARDES, AUDIT & LOGS D'ACCÈS */}
        {activeTab === 'backup-audit' && (
          <div className="space-y-6 max-w-full overflow-hidden">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-fuchsia-600 shrink-0" />
                  <span>Traçabilité, Sécurité & Journal des Accès (Audit Logs)</span>
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Surveillance en temps réel des sessions de connexion, adresses IP des postes, durées d'activité et historique des modifications.
                </p>
              </div>

              {/* Subtabs Switcher */}
              <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200 shrink-0">
                <button
                  onClick={() => setAuditSubTab('access')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    auditSubTab === 'access'
                      ? 'bg-white text-fuchsia-700 shadow-xs border border-fuchsia-200'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Laptop className="w-3.5 h-3.5 text-fuchsia-600" />
                  <span>Connexions & Postes ({accessLogs.length})</span>
                </button>
                <button
                  onClick={() => setAuditSubTab('events')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    auditSubTab === 'events'
                      ? 'bg-white text-fuchsia-700 shadow-xs border border-fuchsia-200'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Activity className="w-3.5 h-3.5 text-blue-600" />
                  <span>Actions & Données ({auditLogs.length})</span>
                </button>
                <button
                  onClick={() => setAuditSubTab('backups')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    auditSubTab === 'backups'
                      ? 'bg-white text-fuchsia-700 shadow-xs border border-fuchsia-200'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Points de Restauration ({backupsList.length})</span>
                </button>
                <button
                  onClick={() => {
                    setAuditSubTab('integrity');
                    runIntegrityCheck();
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    auditSubTab === 'integrity'
                      ? 'bg-white text-emerald-700 shadow-xs border border-emerald-200'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Intégrité des Données</span>
                </button>
                <button
                  onClick={() => {
                    setAuditSubTab('performance');
                    refreshPerformanceMetrics();
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    auditSubTab === 'performance'
                      ? 'bg-white text-amber-700 shadow-xs border border-amber-200'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Gauge className="w-3.5 h-3.5 text-amber-600" />
                  <span>Performance & Sync</span>
                </button>
                <button
                  onClick={() => {
                    setAuditSubTab('telemetry');
                    refreshTelemetry();
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    auditSubTab === 'telemetry'
                      ? 'bg-white text-indigo-700 shadow-xs border border-indigo-200'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Bug className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Erreurs & Analytics ({errorReports.length})</span>
                </button>
              </div>
            </div>

            {/* SUBTAB 1: ACCESS LOGS & SESSIONS */}
            {auditSubTab === 'access' && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-fuchsia-50/60 p-3.5 rounded-2xl border border-fuchsia-200/80">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-fuchsia-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                      <Globe className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-fuchsia-950">
                        Surveillance des Postes & Historique de Connexion
                      </h4>
                      <p className="text-[11px] text-fuchsia-800/80">
                        Enregistre l'adresse IP, le nom du poste/ordinateur, le navigateur, l'heure d'entrée et la durée d'utilisation.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={loadAccessLogs}
                      className="px-2.5 py-1.5 bg-white hover:bg-slate-50 text-fuchsia-800 text-xs font-bold rounded-xl border border-fuchsia-200 shadow-xs flex items-center gap-1.5 cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5 text-fuchsia-600" />
                      <span>Actualiser</span>
                    </button>
                    <button
                      onClick={handleClearAccessLogs}
                      className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-xl border border-rose-200 shadow-xs flex items-center gap-1.5 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Vider</span>
                    </button>
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
                  <div className="overflow-x-auto max-h-[500px]">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-100/90 border-b border-slate-200 text-slate-700 font-bold uppercase sticky top-0 z-10 text-[11px]">
                        <tr>
                          <th className="px-4 py-3">Statut & Session</th>
                          <th className="px-4 py-3">Utilisateur Connecté</th>
                          <th className="px-4 py-3">Poste / Ordinateur</th>
                          <th className="px-4 py-3">Adresse IP</th>
                          <th className="px-4 py-3">Système & Navigateur</th>
                          <th className="px-4 py-3">Heure Connexion</th>
                          <th className="px-4 py-3">Heure Déconnexion</th>
                          <th className="px-4 py-3 text-right">Durée Session</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {accessLogs.map((log) => (
                            <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                              <td className="px-4 py-3 whitespace-nowrap">
                                <span
                                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                                    log.status === 'En cours'
                                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                      : 'bg-slate-100 text-slate-700 border border-slate-200'
                                  }`}
                                >
                                  <span
                                    className={`w-1.5 h-1.5 rounded-full ${
                                      log.status === 'En cours' ? 'bg-emerald-500 animate-ping' : 'bg-slate-400'
                                    }`}
                                  />
                                  {log.status}
                                </span>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <div className="font-bold text-slate-900">{log.userName}</div>
                                <div className="text-[10px] text-slate-500 font-mono">{log.userRole}</div>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <div className="flex items-center gap-1.5 text-slate-800 font-bold font-mono">
                                  <Laptop className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                                  <span>{log.stationName || 'Station-Client'}</span>
                                </div>
                                <div className="text-[10px] text-slate-400 font-mono">ID: {log.deviceId}</div>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <span className="font-mono text-indigo-700 bg-indigo-50 border border-indigo-200/80 px-2 py-0.5 rounded font-bold text-[11px]">
                                  {log.ip}
                                </span>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <div className="text-slate-800 font-medium">{log.os}</div>
                                <div className="text-[10.5px] text-slate-500">{log.browser} • {log.screenRes}</div>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap font-mono text-[11px] text-slate-700">
                                <div className="flex items-center gap-1">
                                  <LogIn className="w-3 h-3 text-emerald-600" />
                                  <span>{new Date(log.loginTime).toLocaleString('fr-FR')}</span>
                                </div>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap font-mono text-[11px] text-slate-500">
                                {log.logoutTime ? (
                                  <div className="flex items-center gap-1">
                                    <LogOutIcon className="w-3 h-3 text-rose-500" />
                                    <span>{new Date(log.logoutTime).toLocaleString('fr-FR')}</span>
                                  </div>
                                ) : (
                                  <span className="italic text-emerald-600 font-sans text-xs">Session active...</span>
                                )}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-right font-mono font-bold text-slate-800">
                                {log.durationMinutes ? `${log.durationMinutes} min` : '< 1 min'}
                              </td>
                            </tr>
                          ))}

                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* SUBTAB 2: DATA & AUDIT EVENTS */}
            {auditSubTab === 'events' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Journal des Modifications de Données
                  </h4>
                  <button onClick={loadAuditLogs} className="text-xs text-fuchsia-600 hover:text-fuchsia-700 flex items-center gap-1 font-bold cursor-pointer">
                    <RefreshCw className={`w-3.5 h-3.5 ${loadingAudit ? 'animate-spin' : ''}`} /> Actualiser
                  </button>
                </div>
                
                <div className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden">
                  <div className="max-h-[450px] overflow-y-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 border-b border-slate-200 text-slate-600 font-bold uppercase sticky top-0 z-10">
                        <tr>
                          <th className="px-4 py-2">Horodatage</th>
                          <th className="px-4 py-2">Action</th>
                          <th className="px-4 py-2">Cible</th>
                          <th className="px-4 py-2">Acteur</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {auditLogs.length === 0 ? (
                          <tr><td colSpan="4" className="px-4 py-6 text-center text-slate-500">Aucun événement enregistré</td></tr>
                        ) : [...auditLogs].sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 100).map(log => (
                          <tr key={log.id} className="hover:bg-white transition-colors">
                            <td className="px-4 py-2.5 whitespace-nowrap font-mono text-[10px] text-slate-500">
                              {new Date(log.timestamp).toLocaleString()}
                            </td>
                            <td className="px-4 py-2.5">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                log.action === 'CREATE' ? 'bg-emerald-100 text-emerald-700' :
                                log.action === 'UPDATE' ? 'bg-blue-100 text-blue-700' :
                                log.action === 'DELETE' ? 'bg-rose-100 text-rose-700' :
                                'bg-slate-200 text-slate-700'
                              }`}>
                                {log.action}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 font-bold text-slate-700 truncate max-w-[100px]" title={log.entityId}>
                              {log.entity} <span className="font-normal text-slate-400 font-mono text-[10px]">({log.entityId})</span>
                            </td>
                            <td className="px-4 py-2.5 text-slate-600 truncate max-w-[80px]">{log.userId}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* SUBTAB 3: BACKUPS & RESTORE */}
            {auditSubTab === 'backups' && (
              <div className="space-y-4">
                {/* Server Synchronization Card */}
                <SyncButtons showToast={showToast} />

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Points de Restauration Locaux
                  </h4>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowBackupManagerModal(true)}
                      className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs transition"
                    >
                      <Database className="w-3.5 h-3.5" />
                      Gestionnaire Avancé de Sauvegardes
                    </button>
                    <button onClick={loadBackups} className="text-xs text-fuchsia-600 hover:text-fuchsia-700 flex items-center gap-1 font-bold cursor-pointer">
                      <RefreshCw className="w-3.5 h-3.5" /> Actualiser
                    </button>
                  </div>
                </div>
                
                <div className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 border-b border-slate-200 text-slate-600 font-bold uppercase">
                      <tr>
                        <th className="px-4 py-2">Date & Heure</th>
                        <th className="px-4 py-2">Utilisateur</th>
                        <th className="px-4 py-2 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {backupsList.length === 0 ? (
                        <tr><td colSpan="3" className="px-4 py-6 text-center text-slate-500">Aucune sauvegarde disponible</td></tr>
                      ) : backupsList.map(b => (
                        <tr key={b.id} className="hover:bg-white transition-colors">
                          <td className="px-4 py-2.5 whitespace-nowrap font-mono text-[11px]">{new Date(b.timestamp).toLocaleString()}</td>
                          <td className="px-4 py-2.5 truncate max-w-[100px]">{b.userId}</td>
                          <td className="px-4 py-2.5 text-right flex items-center justify-end gap-2">
                             <button onClick={() => handleExportBackup(b.id)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer" title="Exporter en JSON">
                               <Download className="w-3.5 h-3.5" />
                             </button>
                             <button onClick={() => handleRestoreBackup(b.id)} className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer" title="Restaurer cette version">
                               <RotateCcw className="w-3.5 h-3.5" />
                             </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* SUBTAB 4: DATA INTEGRITY & TWIN EXCEL FORMULAS */}
            {auditSubTab === 'integrity' && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-emerald-50/70 p-3.5 rounded-2xl border border-emerald-200/80">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-emerald-950">
                        Diagnostic d'Intégrité des Données & Formules Jumelles
                      </h4>
                      <p className="text-[11px] text-emerald-800/80">
                        Vérifie la concordance mathématique (Stock Actuel = Initial + Entrées - Sorties), l'absence de valeurs négatives et l'empreinte Checksum.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={runIntegrityCheck}
                      disabled={checkingIntegrity}
                      className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${checkingIntegrity ? 'animate-spin' : ''}`} />
                      <span>{checkingIntegrity ? 'Vérification...' : 'Lancer l\'Audit'}</span>
                    </button>
                    <button
                      onClick={handleRepairData}
                      className="px-3 py-1.5 bg-white hover:bg-emerald-50 text-emerald-800 text-xs font-bold rounded-xl border border-emerald-300 shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <Zap className="w-3.5 h-3.5 text-amber-600" />
                      <span>Réparer Auto</span>
                    </button>
                  </div>
                </div>

                {/* Status KPI Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
                    <div className="text-[11px] font-mono text-slate-500">Statut Global</div>
                    <div className="text-base font-black mt-1 flex items-center gap-1.5">
                      {integrityReport?.overall?.valid ? (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          <span className="text-emerald-700">100% Conforme</span>
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="w-4 h-4 text-amber-600" />
                          <span className="text-amber-700">{integrityReport?.overall?.totalErrors || 0} anomalie(s)</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
                    <div className="text-[11px] font-mono text-slate-500">Articles Contrôlés</div>
                    <div className="text-base font-black text-slate-900 mt-1 font-mono">
                      {rawStock.length} articles
                    </div>
                  </div>
                  <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
                    <div className="text-[11px] font-mono text-slate-500">Mouvements Audités</div>
                    <div className="text-base font-black text-slate-900 mt-1 font-mono">
                      {mouvements.length} lignes
                    </div>
                  </div>
                  <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
                    <div className="text-[11px] font-mono text-slate-500">Empreinte Checksum</div>
                    <div className="text-xs font-mono font-bold text-slate-700 mt-1 truncate" title={currentChecksum}>
                      0x{currentChecksum || 'N/A'}
                    </div>
                  </div>
                </div>

                {/* Bulk Orphan Cleanup Panel */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2">
                      <ShieldAlert className="w-5 h-5 text-amber-600" />
                      <div>
                        <h5 className="text-xs font-bold text-slate-900">Gestion des Liaisons Orphelines (Intégrité Relationnelle)</h5>
                        <p className="text-[11px] text-slate-500">Détection et nettoyage des tâches ou interventions pointant vers des machines supprimées ou archivées.</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-amber-50 text-amber-800 border border-amber-200">
                        {preventiveOrphans.length + correctiveOrphans.length} Orphelins total
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Preventive Orphans */}
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between space-y-3">
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-800">Tâches Préventives</span>
                          <span className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold ${preventiveOrphans.length > 0 ? 'bg-amber-100 text-amber-900' : 'bg-emerald-100 text-emerald-900'}`}>
                            {preventiveOrphans.length} orpheline(s)
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1">
                          Liées à des machines inexistantes ou archivées.
                        </p>
                      </div>
                      <div className="flex items-center gap-2 pt-2 border-t border-slate-200">
                        <button
                          onClick={handlePurgePreventiveOrphans}
                          disabled={preventiveOrphans.length === 0}
                          className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-40 text-white font-bold text-xs rounded-xl transition flex items-center gap-1 cursor-pointer shadow-2xs"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Purger Préventif</span>
                        </button>
                        <button
                          onClick={() => handleBulkRelink('preventive')}
                          disabled={preventiveOrphans.length === 0}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-bold text-xs rounded-xl transition flex items-center gap-1 cursor-pointer shadow-2xs"
                        >
                          <Link2 className="w-3.5 h-3.5" />
                          <span>Relier en Masse</span>
                        </button>
                      </div>
                    </div>

                    {/* Corrective Orphans */}
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between space-y-3">
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-800">Interventions Correctives & BTs</span>
                          <span className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold ${correctiveOrphans.length > 0 ? 'bg-amber-100 text-amber-900' : 'bg-emerald-100 text-emerald-900'}`}>
                            {correctiveOrphans.length} orpheline(s)
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1">
                          Demandes et ordres de travail sans machine active.
                        </p>
                      </div>
                      <div className="flex items-center gap-2 pt-2 border-t border-slate-200">
                        <button
                          onClick={handlePurgeCorrectiveOrphans}
                          disabled={correctiveOrphans.length === 0}
                          className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-40 text-white font-bold text-xs rounded-xl transition flex items-center gap-1 cursor-pointer shadow-2xs"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Purger Correctif</span>
                        </button>
                        <button
                          onClick={() => handleBulkRelink('corrective')}
                          disabled={correctiveOrphans.length === 0}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-bold text-xs rounded-xl transition flex items-center gap-1 cursor-pointer shadow-2xs"
                        >
                          <Link2 className="w-3.5 h-3.5" />
                          <span>Relier en Masse</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Audit Results Table */}
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
                  <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800">
                      Rapport d'Audit Détaillé ({integrityReport?.overall?.totalErrors || 0} Erreurs, {integrityReport?.overall?.totalWarnings || 0} Avertissements)
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">
                      Horodatage: {integrityReport?.timestamp ? new Date(integrityReport.timestamp).toLocaleTimeString() : 'En attente'}
                    </span>
                  </div>

                  {(!integrityReport || (integrityReport.overall.totalErrors === 0 && integrityReport.overall.totalWarnings === 0)) ? (
                    <div className="p-6 text-center text-xs text-slate-500 space-y-1">
                      <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                      <div className="font-bold text-slate-800 mt-2">Aucune anomalie détectée</div>
                      <div>Toutes les formules Excel Twin et les cohérences relationnelles sont parfaitement alignées.</div>
                    </div>
                  ) : (
                    <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 text-xs">
                      {integrityReport.stock.errors.map((err, i) => (
                        <div key={`se-${i}`} className="p-3 bg-rose-50/50 flex items-start gap-2.5">
                          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                          <div className="min-w-0 flex-1">
                            <span className="font-bold text-rose-900 font-mono">[{err.type}]</span>
                            <span className="ml-2 text-rose-800">{err.message}</span>
                          </div>
                        </div>
                      ))}
                      {integrityReport.stock.warnings.map((warn, i) => (
                        <div key={`sw-${i}`} className="p-3 bg-amber-50/40 flex items-start gap-2.5">
                          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                          <div className="min-w-0 flex-1">
                            <span className="font-bold text-amber-900 font-mono">[{warn.type}]</span>
                            <span className="ml-2 text-amber-800">{warn.message}</span>
                          </div>
                        </div>
                      ))}
                      {integrityReport.movements?.errors?.map((err, i) => (
                        <div key={`me-${i}`} className="p-3 bg-rose-50/50 flex items-start gap-2.5">
                          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                          <div className="min-w-0 flex-1">
                            <span className="font-bold text-rose-900 font-mono">[MVT_{err.type}]</span>
                            <span className="ml-2 text-rose-800">{err.message}</span>
                          </div>
                        </div>
                      ))}
                      {integrityReport.movements?.warnings?.map((warn, i) => (
                        <div key={`mw-${i}`} className="p-3 bg-amber-50/40 flex items-start gap-2.5">
                          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                          <div className="min-w-0 flex-1">
                            <span className="font-bold text-amber-900 font-mono">[MVT_{warn.type}]</span>
                            <span className="ml-2 text-amber-800">{warn.message}</span>
                          </div>
                        </div>
                      ))}
                      {integrityReport.referential?.errors?.map((err, i) => (
                        <div key={`re-${i}`} className="p-3 bg-rose-50/50 flex items-start gap-2.5">
                          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                          <div className="min-w-0 flex-1">
                            <span className="font-bold text-rose-900 font-mono">[REF_{err.type}]</span>
                            <span className="ml-2 text-rose-800">{err.message}</span>
                          </div>
                        </div>
                      ))}
                      {integrityReport.referential?.warnings?.map((warn, i) => (
                        <div key={`rw-${i}`} className="p-3 bg-amber-50/40 flex items-start gap-2.5">
                          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                          <div className="min-w-0 flex-1">
                            <span className="font-bold text-amber-900 font-mono">[REF_{warn.type}]</span>
                            <span className="ml-2 text-amber-800">{warn.message}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* SUBTAB 5: PERFORMANCE MONITOR & OFFLINE SYNC QUEUE */}
            {auditSubTab === 'performance' && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-amber-50/70 p-3.5 rounded-2xl border border-amber-200/80">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-amber-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                      <Gauge className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-amber-950">
                        Moniteur de Performance & File d'Attente Offline
                      </h4>
                      <p className="text-[11px] text-amber-800/80">
                        Suivi des temps d'exécution, consommation mémoire JS Heap et état des opérations en attente de synchronisation.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={runPerformanceBenchmark}
                      className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <Zap className="w-3.5 h-3.5" />
                      <span>Tester le Recalcul</span>
                    </button>
                    <button
                      onClick={() => performanceService.exportReport()}
                      className="px-3 py-1.5 bg-white hover:bg-amber-50 text-amber-900 text-xs font-bold rounded-xl border border-amber-300 shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5 text-amber-700" />
                      <span>Exporter CSV</span>
                    </button>
                  </div>
                </div>

                {/* Explicit Manual Server Sync Card (gmao_state.json) */}
                <SyncButtons showToast={showToast} />

                {/* Metrics Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
                    <div className="text-[11px] font-mono text-slate-500">Consommation Mémoire Heap</div>
                    <div className="text-lg font-black text-slate-900 mt-1 font-mono">
                      {perfStats.heapMB ? `${perfStats.heapMB.toFixed(1)} Mo` : 'Non disponible'}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1">Estimée via performance.memory</div>
                  </div>

                  <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
                    <div className="text-[11px] font-mono text-slate-500">Recalcul Twin (Moyenne)</div>
                    <div className="text-lg font-black text-amber-600 mt-1 font-mono">
                      {perfStats.recalcStats?.avg ? `${perfStats.recalcStats.avg} ms` : 'À tester'}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1">
                      Min: {perfStats.recalcStats?.min ?? 'N/A'}ms • Max: {perfStats.recalcStats?.max ?? 'N/A'}ms
                    </div>
                  </div>

                  <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
                    <div className="text-[11px] font-mono text-slate-500">File de Synchronisation</div>
                    <div className="text-lg font-black mt-1 font-mono flex items-center gap-2">
                      <span className={syncQueueState.isOnline ? 'text-emerald-700' : 'text-amber-600'}>
                        {syncQueueState.isOnline ? 'En ligne' : 'Hors-ligne'}
                      </span>
                      <span className="text-xs font-bold text-slate-400">
                        ({syncQueueState.pendingCount} en attente)
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1">
                      {syncQueueState.failedCount} échec(s) • IndexedDB actif
                    </div>
                  </div>
                </div>

                {/* Sync Queue Detail Box */}
                <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3 shadow-xs">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                    <div className="flex items-center gap-2">
                      <Wifi className="w-4 h-4 text-emerald-600" />
                      <span className="text-xs font-bold text-slate-800">
                        Gestionnaire de File d'Attente de Synchronisation
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => syncQueueService.processQueue()}
                        className="px-2.5 py-1 text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg transition cursor-pointer"
                      >
                        Rejouer la file
                      </button>
                      <button
                        onClick={() => syncQueueService.clearQueue()}
                        className="px-2.5 py-1 text-[11px] bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-lg transition cursor-pointer"
                      >
                        Vider la file
                      </button>
                    </div>
                  </div>

                  <p className="text-xs text-slate-500 leading-relaxed">
                    Le service <strong>SyncQueueService</strong> enregistre toute transaction d'écriture en mode hors-ligne dans IndexedDB avec priorité d'exécution et tentatives automatiques (jusqu'à 3 essais) dès que le réseau ou le partage est réactivé.
                  </p>
                </div>
              </div>
            )}

            {/* SUBTAB 6: ERROR TRACKING & USAGE ANALYTICS */}
            {auditSubTab === 'telemetry' && (
              <TelemetryAuditPanel
                errorReports={errorReports}
                analyticsEvents={analyticsEvents}
                onSimulateError={handleSimulateError}
                onExportErrors={handleExportErrorReports}
                onClearErrors={handleClearErrorReports}
                onClearAnalytics={handleClearAnalytics}
                onRefresh={refreshTelemetry}
              />
            )}
          </div>
        )}

        {/* PANEL 6: ADMIN ACCOUNT & SECURITY SETTINGS - VAULT CHIFFRÉ ZERO-KNOWLEDGE */}
        {activeTab === 'admin' && (
          <div className="space-y-6 max-w-full overflow-hidden animate-in fade-in duration-200">
            {/* 1. Header Card - Info & Active User Status */}
            <div className="p-6 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl border border-indigo-500/20 text-white shadow-xl relative overflow-hidden">
              <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
              <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-indigo-600/30 border border-indigo-400/30 flex items-center justify-center text-indigo-300 shadow-inner shrink-0">
                    <ShieldCheck className="w-7 h-7" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold flex items-center gap-2 flex-wrap">
                      <span>Gestion du Compte Administrateur & Sécurité PIN — Vault Chiffré</span>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        AES-256 + BCrypt — Aucun mot de passe dans le code
                      </span>
                    </h3>
                    <p className="text-xs text-indigo-200/80 mt-1">
                      Architecture Zero-Knowledge : le Master PIN est la clé cryptographique unique déchiffrant le coffre AES-256-GCM.
                    </p>
                  </div>
                </div>
                <div className="bg-white/10 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-white/10 flex items-center gap-3 shrink-0">
                  <div className="w-8 h-8 rounded-xl bg-indigo-500 text-white font-extrabold text-xs flex items-center justify-center font-mono">
                    {currentUser?.avatar || 'AD'}
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-indigo-300 font-bold">Session Active</div>
                    <div className="text-xs font-bold text-white font-mono">{currentUser?.name || 'Administrateur'}</div>
                    <div className="text-[10px] text-emerald-300 font-mono font-bold">
                      {isVaultUnlocked ? '🟢 Vault Déverrouillé' : '🔒 Vault Verrouillé'}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 2. Master PIN Setup - Configuration initiale du coffre */}
            {!isVaultExists && (
              <div className="bg-amber-50 p-6 rounded-3xl border border-amber-200 shadow-md space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-amber-100 flex items-center justify-center text-amber-600">
                    <ShieldAlert className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-amber-800">Premier Lancement — Définir Master PIN</h4>
                    <p className="text-xs text-amber-700">
                      Aucun mot de passe dans le code — Définissez votre Master PIN (4 à 8 chiffres) qui servira de clé de chiffrement maîtresse.
                    </p>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="password"
                    value={masterPinSetup}
                    onChange={(e) => setMasterPinSetup(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="Master PIN — 4 à 8 chiffres (ex: 1234)"
                    className="flex-1 px-4 py-2.5 rounded-xl border border-amber-300 bg-white text-xs font-mono font-bold focus:border-amber-500 outline-none"
                    maxLength={8}
                  />
                  <button
                    onClick={async () => {
                      try {
                        if (setupMasterPin) {
                          await setupMasterPin(masterPinSetup);
                          showToast('Master PIN configuré — Coffre-fort chiffré créé avec succès !', 'success');
                          setMasterPinSetup('');
                          if (getAvailableAccounts) setAccountsList(getAvailableAccounts());
                        }
                      } catch (err) {
                        showToast(err.message, 'error');
                      }
                    }}
                    className="px-6 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold text-xs transition cursor-pointer shadow-sm"
                  >
                    Créer Vault Chiffré (AES-256)
                  </button>
                </div>
              </div>
            )}

            {/* 3. System Accounts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Box A: Change PIN & Role & Cryptographic Engine */}
              <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-md space-y-5">
                <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                    <KeyRound className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-800">Master PIN — Clé Maîtresse Cryptographique</h4>
                    <p className="text-xs text-slate-500">Architecture Zero-Knowledge : sans le PIN, les données au repos restent chiffrées et indéchiffrables.</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Master PIN Actuel (pour validation)</label>
                    <input
                      type="password"
                      value={currentMasterPin}
                      onChange={(e) => setCurrentMasterPin(e.target.value.replace(/[^0-9]/g, ''))}
                      placeholder="Master PIN actuel — requis pour déchiffrer"
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-mono font-bold focus:bg-white focus:border-indigo-500 outline-none transition"
                      maxLength={8}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Nouveau Master PIN (4-8 chiffres)</label>
                    <input
                      type="password"
                      value={tempPin}
                      onChange={(e) => setTempPin(e.target.value.replace(/[^0-9]/g, ''))}
                      placeholder="Nouveau Master PIN (ex: 5678)"
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-mono font-bold focus:bg-white focus:border-indigo-500 outline-none transition"
                      maxLength={8}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Libellé du Rôle Administrateur</label>
                    <input
                      type="text"
                      value={tempRole}
                      onChange={(e) => setTempRole(e.target.value)}
                      placeholder="Ex: Gestionnaire Principal du Stock"
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold focus:bg-white focus:border-indigo-500 outline-none transition"
                    />
                  </div>

                  {/* Live Vault Engine — Sel dynamique et chiffrement AES */}
                  <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-2xl text-slate-400 font-mono text-[11px] space-y-2 overflow-hidden shadow-inner">
                    <div className="flex items-center justify-between text-slate-300 border-b border-slate-800 pb-1.5 font-bold">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        VAULT CHIFFRÉ — PIN = KEY
                      </span>
                      <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded text-emerald-400">
                        AES-256-GCM + PBKDF2 100k + BCrypt
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-1">
                      <span className="text-slate-500">Sel Aléatoire:</span>
                      <span className="col-span-2 text-indigo-400 truncate select-all">
                        {localStorage.getItem('gmao_vault_salt_v2')?.substring(0, 24) || 'Généré aléatoirement...'}...
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-1">
                      <span className="text-slate-500">Ciphertext:</span>
                      <span className="col-span-2 text-amber-400 truncate select-all">
                        {localStorage.getItem('gmao_vault_cipher_v2')?.substring(0, 32) || 'Aucun — Vault verrouillé'}...
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-1 pt-1.5 border-t border-slate-800/80">
                      <span className="text-slate-500 font-bold">État du Coffre:</span>
                      <span className={`col-span-2 font-bold ${isVaultUnlocked ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {isVaultUnlocked
                          ? 'Déverrouillé — Clé valide — En mémoire vive'
                          : 'Verrouillé — Données chiffrées au repos'}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={async () => {
                      try {
                        if (!currentMasterPin) {
                          showToast('Veuillez saisir le Master PIN actuel pour validation.', 'error');
                          return;
                        }
                        if (!tempPin || tempPin.length < 4) {
                          showToast('Le nouveau Master PIN doit comporter au moins 4 chiffres.', 'error');
                          return;
                        }
                        const vault = await vaultService.decryptVault(currentMasterPin);
                        await vaultService.encryptVault(vault, tempPin);
                        await vaultService.setPinHash(tempPin);
                        storageService.removeItem('gmao_admin_pin');
                        storageService.setItem('gmao_admin_role', tempRole.trim());
                        showToast('Master PIN modifié — Coffre-fort re-chiffré avec la nouvelle clé !', 'success');
                        setCurrentMasterPin('');
                        setTempPin('');
                      } catch (err) {
                        showToast(err.message, 'error');
                      }
                    }}
                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold text-xs transition shadow-md flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                  >
                    <Save className="w-4 h-4" />
                    <span>Changer Master PIN — Re-chiffrer Vault</span>
                  </button>
                </div>
              </div>

              {/* Box B: Comptes Système — 2FA */}
              <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-md space-y-5">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                      <Users className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-800">Comptes Système — Coffre Protégé</h4>
                      <p className="text-xs text-slate-500">Authentification 2FA : Code d'accès + Mot de passe + Master PIN</p>
                    </div>
                  </div>
                  <button
                    onClick={handleResetAllAccounts}
                    className="text-[11px] font-bold text-rose-600 hover:bg-rose-50 px-2.5 py-1.5 rounded-xl transition border border-rose-200 cursor-pointer"
                  >
                    Reset Vault
                  </button>
                </div>

                <div className="space-y-3">
                  {accountsList.map((userAcc) => (
                    <div
                      key={userAcc.id || userAcc.code || userAcc.username}
                      className="p-3.5 rounded-2xl border border-slate-200/80 hover:border-indigo-200 bg-slate-50/50 hover:bg-indigo-50/30 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-slate-900 text-white font-extrabold text-xs flex items-center justify-center font-mono shrink-0 shadow-xs">
                          {(userAcc.code || userAcc.username || 'US').substring(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-slate-800 flex items-center gap-2 flex-wrap">
                            <span className="truncate">{userAcc.libelle || userAcc.name}</span>
                            <span className="text-[10px] font-mono text-slate-500">@{userAcc.code || userAcc.username}</span>
                            <span className="text-[9px] px-1.5 py-0.5 rounded font-bold bg-slate-200 text-slate-700">
                              {userAcc.role}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5 truncate">
                            Mot de passe : •••••••• (Hash BCrypt dans le coffre chiffré) — ID : {(userAcc.id || 'ID-001').substring(0, 12)}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
                        <button
                          onClick={async () => {
                            const newPass = prompt(`Nouveau mot de passe pour @${userAcc.code || userAcc.username} (au moins 4 caractères) :`);
                            if (!newPass || newPass.trim().length < 4) return;
                            const pin = prompt('Master PIN requis pour déverrouiller et mettre à jour le coffre-fort :');
                            if (!pin) return;
                            try {
                              if (updateUserPassword) {
                                await updateUserPassword(userAcc.code || userAcc.username, newPass.trim(), pin.trim());
                                showToast(`Mot de passe de @${userAcc.code || userAcc.username} mis à jour dans le coffre chiffré !`, 'success');
                                if (getAvailableAccounts) setAccountsList(getAvailableAccounts());
                              }
                            } catch (err) {
                              showToast(err.message, 'error');
                            }
                          }}
                          className="px-2.5 py-1.5 bg-white border border-slate-200 hover:bg-amber-500 hover:text-white text-slate-700 font-bold text-[11px] rounded-xl transition shadow-2xs cursor-pointer"
                        >
                          Changer Pass
                        </button>
                        <button
                          onClick={async () => {
                            const pin = prompt('Master PIN requis pour confirmer le basculement de session (2FA) :');
                            if (!pin) return;
                            try {
                              if (switchSessionToUser) {
                                await switchSessionToUser(userAcc.code || userAcc.username, pin.trim());
                                showToast(`Session -> @${userAcc.code || userAcc.username} — 2FA: Code + PIN`, 'success');
                              }
                            } catch (err) {
                              showToast(err.message, 'error');
                            }
                          }}
                          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px] rounded-xl transition shadow-2xs cursor-pointer"
                        >
                          Basculer (2FA)
                        </button>
                      </div>
                    </div>
                  ))}

                  {accountsList.length === 0 && (
                    <div className="text-xs text-slate-400 text-center py-6 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                      Coffre-fort verrouillé — Veuillez saisir le Master PIN pour charger les comptes déchiffrés.
                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>
        )}

        {/* PANEL 9: PERFORMANCE & MONITORING DASHBOARD */}
        {activeTab === 'performance' && (
          <PerformanceDashboardPanel
            rawStock={rawStock}
            mouvements={mouvements}
            showToast={showToast}
          />
        )}

        {/* PANEL 10: APPEARANCE & LAYOUT SELECTOR */}
        {activeTab === 'appearance' && (
          <AppearanceLayoutSelector showToast={showToast} />
        )}
      </div>

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
