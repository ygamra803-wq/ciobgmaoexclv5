import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import AnimatedPage from '../../components/common/AnimatedPage';
import PageHeaderIcon from '../../components/common/PageHeaderIcon';
import Action3DButton from '../../components/common/Action3DButton';
import { AutoBackupService } from '../../../core/backup/AutoBackupService';
import {
  Settings as SettingsIcon,
  Download,
  Database,
  FileSpreadsheet,
} from 'lucide-react';

import initialPdrGroups from '../../../data/stock/seedPdrGroups.json';
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
import { AuthorizationService, type AuthActor } from '../../../core/security/AuthorizationService';
import { filterActiveMachines } from '../../../utils/activeMachines';
import { StockCalculationService } from '../../../domain/pdr/services/StockCalculationService';
import { stockIndex } from '../../../application/IncrementalStockIndex';
import { useGmaoStore } from '../../../store/useGmaoStore';
import { confirmAction } from '../../../utils/confirmAction';
import { useTranslation } from '../../../i18n/I18nContext';
import type {
  IStockItem,
  IMouvement,
  IMachine,
  IMachineFamily,
  IMachineTemplate,
  IZone,
  ITechnician,
  IOperation,
  StockType,
  IWarehouseItem,
  PdrGroup,
} from '../../../types/domain';
import type {
  PreventiveTaskItem,
  CorrectiveInterventionItem,
  MachineElement,
  SortieExterneItem,
  StateUpdater,
} from '../../../types/store';
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
import SettingsCurrencyTab from './components/SettingsCurrencyTab';
import { SettingsPageHeader } from './components/settingsUi';
import {
  AuditZoneModal,
  AuditUserModal,
  AuditArticleModal,
  AuditRelinkModal,
  BulkRelinkModal,
  type AuditZoneRecord,
  type AuditTechnicianRecord,
  type AuditOperationRecord,
  type AuditStockRecord,
  type AuditMachineRecord,
  type AuditRelinkDataState,
} from './components/AuditModals';

export interface LinkedFileHandleLike {
  getFile: () => Promise<{ size: number; lastModified: number }>;
}

export interface SettingsAccountSummary {
  id: string;
  code?: string;
  username?: string;
  name?: string;
  libelle?: string;
  role: string;
  titleFr?: string;
  avatar?: string;
  badgeColor?: string;
  description?: string;
  personnelId?: string | null;
  personnelName?: string | null;
  id_zone?: string | null;
  specialite?: string | null;
  isActive?: boolean;
}

interface SettingsAuthContextShape {
  user?: (AuthActor & { id?: string; username?: string; name?: string }) | null;
  getAvailableAccounts?: (includeInactive?: boolean) => SettingsAccountSummary[];
  updateUserPassword?: (username: string, newPass: string, masterPin?: string) => Promise<unknown>;
  resetAllAccountsToDefaults?: (masterPin?: string) => Promise<boolean>;
  switchSessionToUser?: (username: string, masterPin?: string) => Promise<unknown>;
  isVaultExists?: boolean;
  isVaultUnlocked?: boolean;
  setupMasterPin?: (pin: string) => Promise<boolean>;
}

import {
  computeDiscoveredAuditItems,
  getNextUserIdFromCatalog,
  getNextZoneIdFromCatalog,
  type DiscoveredAuditItem,
} from './components/settingsAuditDiscovery';

export type { DiscoveredAuditItem };

interface BackupSnapshotSummary {
  id: string;
  timestamp: string | number;
  userId: string;
  reason?: string;
}

interface RestoredBackupPayload {
  Stock_Actuel?: IStockItem[];
  Mouvement?: IMouvement[];
  Machines_Registered?: IMachine[];
  Families?: IMachineFamily[];
  Templates?: IMachineTemplate[];
  Zones?: IZone[];
  Technicians?: ITechnician[];
  Operations?: IOperation[];
}

interface SettingsPerformanceStats {
  heapMB: number | string;
  recalcStats: ReturnType<typeof performanceService.getStats>;
}

export interface SettingsViewProps {
  rawStock?: IStockItem[];
  setRawStock?: (val: StateUpdater<IStockItem[]>) => void;
  mouvements?: IMouvement[];
  setMouvements?: (val: StateUpdater<IMouvement[]>) => void;
  machines?: IMachine[];
  setMachines?: (val: StateUpdater<IMachine[]>) => void;
  families?: IMachineFamily[];
  setFamilies?: (val: StateUpdater<IMachineFamily[]>) => void;
  templates?: IMachineTemplate[];
  setTemplates?: (val: StateUpdater<IMachineTemplate[]>) => void;
  zones?: IZone[];
  setZones?: (val: StateUpdater<IZone[]>) => void;
  technicians?: ITechnician[];
  setTechnicians?: (val: StateUpdater<ITechnician[]>) => void;
  operations?: IOperation[];
  setOperations?: (val: StateUpdater<IOperation[]>) => void;
  types?: Array<StockType | string>;
  setTypes?: (val: StateUpdater<StockType[]>) => void;
  warehouseItems?: IWarehouseItem[];
  sortiesExterne?: SortieExterneItem[];
  preventiveTasks?: PreventiveTaskItem[];
  setPreventiveTasks?: (val: StateUpdater<PreventiveTaskItem[]>) => void;
  correctiveInterventions?: CorrectiveInterventionItem[];
  setCorrectiveInterventions?: (val: StateUpdater<CorrectiveInterventionItem[]>) => void;
  machineElementsLedger?: MachineElement[];
  setMachineElementsLedger?: (val: StateUpdater<MachineElement[]>) => void;
  onResetCorrective?: () => void;
  onBulkImportCorrective?: (items: CorrectiveInterventionItem[]) => void;
  onLoadDemoData?: () => void;
  onClearAllForRealFactory?: () => void;
  onLoadDemoSection?: (section: string) => void;
  onClearDemoSection?: (section: string) => void;
  onExportExcel?: () => void;
  onDownloadBlankTemplate?: () => void;
  showToast?: (message: string, type?: string) => void;
  linkedFileHandle?: LinkedFileHandleLike | null;
  linkedFileName?: string | null;
  onDirectLink?: () => void;
  initialTab?: string;
  [key: string]: unknown;
}

function getErrorMessage(err: unknown, fallback = 'Erreur inattendue'): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === 'string' && err.trim()) return err;
  if (err && typeof err === 'object' && 'message' in err) {
    const msg = (err as { message?: unknown }).message;
    if (typeof msg === 'string' && msg.trim()) return msg;
  }
  return fallback;
}

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
  machineElementsLedger = [],
  setMachineElementsLedger,
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
  initialTab,
}: SettingsViewProps) {
  const { language } = useTranslation();
  const langKey = (language === 'ar' || language === 'en' ? language : 'fr') as 'fr' | 'ar' | 'en';

  const headerCopy = {
    fr: {
      title: 'Configuration & Paramètres',
      subTitle: '/ Settings & Twin Engine',
      desc: 'Supervision du stockage local, diffusion LAN / QR, injection de maquettes, appairage automatique et liaison dossier réseau.',
      badge: 'Mode Hybride LAN & Offline Actif',
    },
    ar: {
      title: 'الإعدادات وتكوين النظام',
      subTitle: '/ Settings & Twin Engine',
      desc: 'إشراف التخزين المحلي، البث عبر الشبكة المحلية ورموز QR، حقن البيانات، المطابقة المرجعية التلقائية وربط مجلد الشبكة.',
      badge: 'الوضع الهجين LAN وبدون اتصال نشط',
    },
    en: {
      title: 'System Configuration & Settings',
      subTitle: '/ Settings & Twin Engine',
      desc: 'Local storage supervision, LAN / QR broadcasting, dataset injection, automatic referential matching, and network folder linking.',
      badge: 'Hybrid LAN & Offline Mode Active',
    },
  }[langKey];

  const [activeTab, setActiveTab] = useState(() => {
    const pendingTarget = localStorage.getItem('gmao_settings_target_tab');
    if (pendingTarget) {
      localStorage.removeItem('gmao_settings_target_tab');
      return pendingTarget;
    }
    return initialTab || 'overview';
  });

  useEffect(() => {
    const pendingTarget = localStorage.getItem('gmao_settings_target_tab');
    if (pendingTarget) {
      localStorage.removeItem('gmao_settings_target_tab');
      setActiveTab(pendingTarget);
    } else if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

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
  const authContext = (useAuth() || {}) as SettingsAuthContextShape;
  const {
    user: currentUser,
    getAvailableAccounts,
    updateUserPassword,
    resetAllAccountsToDefaults,
    switchSessionToUser,
    isVaultExists,
    isVaultUnlocked,
    setupMasterPin,
  } = authContext;

  // Internal RBAC capability flags (ST-1 & ST-AUTH-NULL: fail-closed when currentUser is null)
  const canManageSettings =
    Boolean(currentUser) && AuthorizationService.hasPermission(currentUser, 'settings.manage');
  const canManageUsers =
    Boolean(currentUser) && AuthorizationService.hasPermission(currentUser, 'users.manage');
  const canBackupSettings =
    Boolean(currentUser) && AuthorizationService.hasPermission(currentUser, 'settings.backup');
  const canViewSettings =
    Boolean(currentUser) && AuthorizationService.hasPermission(currentUser, 'settings.view');

  const allowedTabIds = useMemo(() => {
    const ids: string[] = [];
    if (canViewSettings || canBackupSettings) {
      ids.push('overview', 'mvt-logic');
    }
    if (canManageSettings) {
      ids.push('injection');
    }
    if (canViewSettings || canBackupSettings) {
      ids.push('directory', 'matching');
    }
    if (canManageSettings) {
      ids.push('json-editor');
    }
    if (canViewSettings || canBackupSettings) {
      ids.push('backup-audit');
    }
    if (canManageSettings && canManageUsers) {
      ids.push('admin');
    }
    if (canViewSettings) {
      ids.push('performance');
    }
    ids.push('appearance', 'currency');
    return ids;
  }, [canManageSettings, canManageUsers, canBackupSettings, canViewSettings]);

  useEffect(() => {
    if (allowedTabIds.length > 0 && !allowedTabIds.includes(activeTab)) {
      setActiveTab(allowedTabIds[0]);
    }
  }, [allowedTabIds, activeTab]);

  const [accountsList, setAccountsList] = useState<SettingsAccountSummary[]>(() => {
    return getAvailableAccounts ? getAvailableAccounts(true) : [];
  });
  const [masterPinSetup, setMasterPinSetup] = useState('');
  const [currentMasterPin, setCurrentMasterPin] = useState('');

  useEffect(() => {
    if (getAvailableAccounts) {
      setAccountsList(getAvailableAccounts(true));
    }
  }, [getAvailableAccounts, isVaultUnlocked, technicians]);

  const handleResetAllAccounts = async (providedPin?: string) => {
    if (!canManageSettings || !canManageUsers) {
      showToast?.('Accès refusé : privilèges Administrateur requis.', 'error');
      return;
    }
    const pin = typeof providedPin === 'string' ? providedPin.trim() : '';
    if (!pin) {
      showToast?.('Master PIN requis pour autoriser la réinitialisation du coffre-fort.', 'error');
      return;
    }
    try {
      if (resetAllAccountsToDefaults) {
        await resetAllAccountsToDefaults(pin);
        setAccountsList(getAvailableAccounts ? getAvailableAccounts(true) : []);
        showToast?.('Le coffre-fort a été réinitialisé. Définissez votre nouveau Master PIN.', 'info');
      }
    } catch (err: unknown) {
      showToast?.(getErrorMessage(err, 'Échec de la réinitialisation.'), 'error');
      throw err;
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
  const [relinkData, setRelinkData] = useState<AuditRelinkDataState>({
    entityType: 'machine',
    oldKey: '',
    targetKey: '',
    occurrencesCount: 0,
  });

  // Sequential ID Generator Helpers for audit manual registration
  const getNextUserId = (type: string) => getNextUserIdFromCatalog(type, technicians, operations);
  const getNextZoneId = () => getNextZoneIdFromCatalog(zones);

  // AUDIT & VERIFICATION ENGINE (Multi-Entity Strict Relational Matching)
  const discoveredItems = useMemo<DiscoveredAuditItem[]>(() => {
    return computeDiscoveredAuditItems({
      auditTarget,
      mouvements,
      rawStock,
      machines,
      zones,
      technicians,
      operations,
      correctiveInterventions,
      preventiveTasks,
    });
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
    let targetData: unknown[] = [];
    if (jsonTarget === 'rawStock') targetData = rawStock;
    else if (jsonTarget === 'mouvements') targetData = mouvements;
    else if (jsonTarget === 'machines') targetData = machines;
    else if (jsonTarget === 'preventiveTasks' || jsonTarget === 'preventive')
      targetData = preventiveTasks;
    else if (jsonTarget === 'correctiveInterventions') targetData = correctiveInterventions;
    else if (jsonTarget === 'warehouseItems') targetData = warehouseItems;
    else if (jsonTarget === 'sortiesExterne') targetData = sortiesExterne;
    else if (jsonTarget === 'machineElementsLedger') targetData = machineElementsLedger;
    else if (jsonTarget === 'families') targetData = families;
    else if (jsonTarget === 'templates') targetData = templates;
    else if (jsonTarget === 'zones') targetData = zones;
    else if (jsonTarget === 'technicians') targetData = technicians;
    else if (jsonTarget === 'operations') targetData = operations;
    else if (jsonTarget === 'types') targetData = types;
    else if (jsonTarget === 'users')
      targetData = (accountsList || []).map((u: SettingsAccountSummary) => ({
        id: u.id,
        username: u.username || u.code,
        name: u.name || u.libelle,
        role: u.role,
        personnelId: u.personnelId || null,
        isActive: u.isActive !== false,
      }));
    return JSON.stringify(targetData, null, 2);
  }, [
    jsonTarget,
    rawStock,
    mouvements,
    machines,
    preventiveTasks,
    correctiveInterventions,
    warehouseItems,
    sortiesExterne,
    machineElementsLedger,
    families,
    templates,
    zones,
    technicians,
    operations,
    types,
    accountsList,
  ]);

  const isJsonModified = useMemo(() => {
    return jsonText !== originalJsonText;
  }, [jsonText, originalJsonText]);

  useEffect(() => {
    setJsonText(originalJsonText);
    setJsonError(null);
  }, [originalJsonText, activeTab]);

  const handleSaveJSON = () => {
    if (!canManageSettings) {
      showToast?.('Accès refusé : privilèges Administrateur requis pour modifier la base JSON.', 'error');
      return;
    }
    try {
      const parsed: unknown = JSON.parse(jsonText);
      if (!Array.isArray(parsed)) {
        throw new Error("La structure doit être un tableau JSON d'objets.");
      }

      const store = useGmaoStore.getState();

      if (jsonTarget === 'rawStock') {
        const parsedStock = parsed as IStockItem[];
        const calcMap = new Map(
          StockCalculationService.calculateAllStocks(parsedStock, mouvements).map((c) => [
            String(c.ref || '').trim().toUpperCase(),
            c,
          ])
        );
        const recalculatedStock: IStockItem[] = parsedStock.map((art: IStockItem) => {
          const k = String(art?.ref || '').trim().toUpperCase();
          const c = calcMap.get(k);
          if (!c) return art;
          return {
            ...art,
            entrees: c.entrees,
            sorties: c.sorties,
            stockActuel: c.stockActuel,
            alerte: c.alerte,
          };
        });
        const initMap = new Map<string, number>();
        recalculatedStock.forEach((art: IStockItem) => {
          if (art?.ref) initMap.set(String(art.ref).trim().toUpperCase(), Number(art.stockInitial) || 0);
        });
        stockIndex.rebuild(mouvements, initMap);
        setRawStock?.(recalculatedStock);
        storageService.saveArticles(recalculatedStock);
      } else if (jsonTarget === 'mouvements') {
        const parsedMvts = parsed as IMouvement[];
        const calcMap = new Map(
          StockCalculationService.calculateAllStocks(rawStock, parsedMvts).map((c) => [
            String(c.ref || '').trim().toUpperCase(),
            c,
          ])
        );
        const recalculatedStock: IStockItem[] = (rawStock || []).map((art: IStockItem) => {
          const k = String(art?.ref || '').trim().toUpperCase();
          const c = calcMap.get(k);
          if (!c) return art;
          return {
            ...art,
            entrees: c.entrees,
            sorties: c.sorties,
            stockActuel: c.stockActuel,
            alerte: c.alerte,
          };
        });
        const initMap = new Map<string, number>();
        recalculatedStock.forEach((art: IStockItem) => {
          if (art?.ref) initMap.set(String(art.ref).trim().toUpperCase(), Number(art.stockInitial) || 0);
        });
        stockIndex.rebuild(parsedMvts, initMap);
        setMouvements?.(parsedMvts);
        if (setRawStock) setRawStock(recalculatedStock);
        storageService.saveArticles(recalculatedStock);
      } else if (jsonTarget === 'machines') {
        if (setMachines) setMachines(parsed as IMachine[]);
        else store.setMachines(parsed as IMachine[]);
      } else if (jsonTarget === 'preventiveTasks' || jsonTarget === 'preventive') {
        if (setPreventiveTasks) setPreventiveTasks(parsed as PreventiveTaskItem[]);
        else store.setPreventiveTasks(parsed as PreventiveTaskItem[]);
      } else if (jsonTarget === 'correctiveInterventions') {
        if (setCorrectiveInterventions) setCorrectiveInterventions(parsed as CorrectiveInterventionItem[]);
        else store.setCorrectiveInterventions(parsed as CorrectiveInterventionItem[]);
      } else if (jsonTarget === 'warehouseItems') {
        store.setWarehouseItems(parsed as IWarehouseItem[]);
      } else if (jsonTarget === 'sortiesExterne') {
        store.setSortiesExterne(parsed as SortieExterneItem[]);
      } else if (jsonTarget === 'machineElementsLedger') {
        if (setMachineElementsLedger) setMachineElementsLedger(parsed as MachineElement[]);
        else store.setMachineElementsLedger(parsed as MachineElement[]);
      } else if (jsonTarget === 'families') {
        if (setFamilies) setFamilies(parsed as IMachineFamily[]);
        else store.setFamilies(parsed as IMachineFamily[]);
      } else if (jsonTarget === 'templates') {
        if (setTemplates) setTemplates(parsed as IMachineTemplate[]);
        else store.setTemplates(parsed as IMachineTemplate[]);
      } else if (jsonTarget === 'zones') {
        if (setZones) setZones(parsed as IZone[]);
        else store.setZones(parsed as IZone[]);
      } else if (jsonTarget === 'technicians') {
        if (setTechnicians) setTechnicians(parsed as ITechnician[]);
        else store.setTechnicians(parsed as ITechnician[]);
      } else if (jsonTarget === 'operations') {
        if (setOperations) setOperations(parsed as IOperation[]);
        else store.setOperations(parsed as IOperation[]);
      } else if (jsonTarget === 'types') {
        if (setTypes) setTypes(parsed as StockType[]);
        else store.setTypes(parsed as StockType[]);
      }

      setJsonError(null);
      showToast?.('Modification appliquée et synchronisée avec succès !', 'success');
    } catch (err: unknown) {
      setJsonError(getErrorMessage(err));
      showToast?.('Erreur de validation du JSON.', 'error');
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
      showToast?.('Fichier JSON téléchargé avec succès.', 'success');
    } catch {
      showToast?.('Erreur lors du téléchargement.', 'error');
    }
  };

  const handleUploadJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event: ProgressEvent<FileReader>) => {
      try {
        const result = event.target?.result;
        const text = typeof result === 'string' ? result : '';
        const parsed: unknown = JSON.parse(text);
        if (!Array.isArray(parsed)) {
          showToast?.("Avertissement : Le fichier importé n'est pas un tableau d'objets.", 'info');
        }
        setJsonText(JSON.stringify(parsed, null, 2));
        setJsonError(null);
        showToast?.(
          "Fichier chargé dans l'éditeur. Veuillez l'enregistrer pour appliquer.",
          'success'
        );
      } catch (err: unknown) {
        setJsonError(`JSON invalide : ${getErrorMessage(err)}`);
        showToast?.('Le fichier importé contient un JSON invalide.', 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleCancelEdits = () => {
    setJsonText(originalJsonText);
    setJsonError(null);
    showToast?.("Modification annulée. Retour aux données d'origine.", 'info');
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
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('gmao:sync_settings_updated', {
          detail: { sharedFolderPath, autoWriteExcel, pollingInterval },
        })
      );
    }
    showToast?.('Paramètres système et synchronisation réseau mis à jour !', 'success');
  };

  // DATA INJECTION HUB HANDLERS
  const handleResetToZero = async () => {
    if (!canManageSettings) {
      showToast?.('Accès refusé : privilèges Administrateur requis pour réinitialiser l’usine.', 'error');
      return;
    }
    if (
      await confirmAction({
        title: 'Réinitialisation Mode Usine Réelle',
        message: 'Êtes-vous sûr de vouloir TOUT effacer ? Cette action videra toutes les tables locales de stockage (Mode Usine Réelle).',
        variant: 'danger',
      })
    ) {
      if (typeof onClearAllForRealFactory === 'function') {
        onClearAllForRealFactory();
      } else {
        useGmaoStore.getState().setPdrGroups([]);
        setRawStock?.([]);
        setMouvements?.([]);
        setMachines?.([]);
        setFamilies?.([]);
        setTemplates?.([]);
        setZones?.([]);
        setTechnicians?.([]);
        setOperations?.([]);
        setTypes?.([]);
        if (setPreventiveTasks) setPreventiveTasks([]);
        if (setCorrectiveInterventions) setCorrectiveInterventions([]);
      }
      setIsDemoMode(false);
      showToast?.('Base de données vidée (Mode Usine Réelle actif) !', 'info');
    }
  };

  const handleInjectGroup = (group: string) => {
    if (!canManageSettings) {
      showToast?.('Accès refusé : privilèges Administrateur requis.', 'error');
      return;
    }
    if (typeof onLoadDemoSection === 'function') {
      onLoadDemoSection(group);
      const labels: Record<string, string> = {
        stock: 'Groupes PDR, Types, Stock & Désignations',
        parc: 'Parc Machines, Familles, Modèles & Plans',
        entrepot: 'Entrepôt, Organes & Pièces Détachées',
        zones: 'Zones & Équipes Techniques',
        mouvements: 'Mouvements & Sorties Externes',
        preventive: 'Planning & Référentiel Préventif',
        corrective: 'Interventions Correctives & Catalogue Pannes',
      };
      showToast?.(`Données Démo injectées avec succès pour : ${labels[group] || group}.`, 'success');
      return;
    }

    if (group === 'stock') {
      useGmaoStore.getState().setPdrGroups(initialPdrGroups as unknown as PdrGroup[]);
      setTypes?.(initialStockTypes as StockType[]);
      setRawStock?.(initialStock as IStockItem[]);
      showToast?.(`${initialStock.length} articles injectés dans le stock avec quantités.`, 'success');
    } else if (group === 'parc') {
      setMachines?.(initialMachines as IMachine[]);
      setFamilies?.(initialFamilies as IMachineFamily[]);
      setTemplates?.(initialTemplates as IMachineTemplate[]);
      showToast?.(`Parc machine initialisé avec succès (${initialMachines.length} machines).`, 'success');
    } else if (group === 'zones') {
      setZones?.(initialZones as IZone[]);
      setTechnicians?.(initialTechnicians as ITechnician[]);
      setOperations?.(initialOperations as IOperation[]);
      showToast?.('Zones et équipes initialisées avec succès.', 'success');
    } else if (group === 'mouvements') {
      setMouvements?.(initialMouvements as unknown as IMouvement[]);
      showToast?.(`${initialMouvements.length} mouvements historiques injectés.`, 'success');
    } else if (group === 'corrective') {
      if (typeof onResetCorrective === 'function') {
        onResetCorrective();
      } else if (typeof onBulkImportCorrective === 'function') {
        onBulkImportCorrective(initialCorrectiveInterventions as CorrectiveInterventionItem[]);
      }
      showToast?.(`${initialCorrectiveInterventions.length} interventions correctives injectées.`, 'success');
    }
  };

  const handleClearGroup = (group: string) => {
    if (!canManageSettings) {
      showToast?.('Accès refusé : privilèges Administrateur requis.', 'error');
      return;
    }
    if (!group || group === 'all') {
      handleResetToZero();
      return;
    }
    if (typeof onClearDemoSection === 'function') {
      onClearDemoSection(group);
      showToast?.(`La section "${group}" a été vidée avec succès.`, 'info');
    }
  };

  const handleToggleDemoMode = (nextActive: boolean, targetSection = 'all') => {
    if (!canManageSettings) {
      showToast?.('Accès refusé : privilèges Administrateur requis.', 'error');
      return;
    }
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
    if (!canManageSettings) {
      showToast?.('Accès refusé : privilèges Administrateur requis.', 'error');
      return;
    }
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
    showToast?.("Injection globale de toute l'usine (Données Démo SSOT) terminée avec succès.", 'success');
  };

  // Orphan calculations & handlers
  const preventiveOrphans = useMemo(
    () =>
      dataIntegrityService
        .annotatePreventiveOrphans(preventiveTasks, machines)
        .filter((t) => Boolean(t._isOrphan)),
    [preventiveTasks, machines]
  );
  const correctiveOrphans = useMemo(
    () =>
      dataIntegrityService
        .annotateCorrectiveOrphans(correctiveInterventions, machines)
        .filter((i) => Boolean(i._isOrphan)),
    [correctiveInterventions, machines]
  );
  const systemGeneralBomLeaks = useMemo(
    () => dataIntegrityService.getSystemGeneralBomLeaks(machineElementsLedger, machines),
    [machineElementsLedger, machines]
  );

  const handlePurgeSystemGeneralBomLeaks = async () => {
    if (!canManageSettings) {
      showToast?.('Accès refusé : privilèges Administrateur requis.', 'error');
      return;
    }
    if (systemGeneralBomLeaks.length === 0) {
      showToast?.('Aucune fuite BOM sur Système Général détectée.', 'info');
      return;
    }
    if (
      await confirmAction({
        title: 'Détacher les éléments BOM de Système Général',
        message: `Supprimer ${systemGeneralBomLeaks.length} liaison(s) BOM de production rattachée(s) par erreur à un équipement Système Général ?`,
        variant: 'danger',
      })
    ) {
      const { kept, removedCount } = dataIntegrityService.purgeSystemGeneralBomLeaks(
        machineElementsLedger,
        machines
      );
      if (setMachineElementsLedger) {
        setMachineElementsLedger(kept as MachineElement[]);
      } else {
        useGmaoStore.getState().setMachineElementsLedger(kept as MachineElement[]);
      }
      runIntegrityCheck();
      showToast?.(
        `${removedCount} élément(s) BOM détaché(s) des équipements Système Général avec succès.`,
        'success'
      );
    }
  };

  const handlePurgePreventiveOrphans = async () => {
    if (!canManageSettings) {
      showToast?.('Accès refusé : privilèges Administrateur requis.', 'error');
      return;
    }
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
      await confirmAction({
        title: 'Purger les tâches orphelines',
        message: `Supprimer définitivement ${preventiveOrphans.length} tâche(s) préventive(s) orpheline(s) ?\n\n${impact.warnings[0] || ''}`,
        variant: 'danger',
      })
    ) {
      const { kept } = dataIntegrityService.purgeOrphanPreventiveTasks(preventiveTasks, machines);
      setPreventiveTasks?.(kept as PreventiveTaskItem[]);
      showToast?.(`${preventiveOrphans.length} tâche(s) orpheline(s) purgée(s) avec succès.`, 'success');
    }
  };

  const handlePurgeCorrectiveOrphans = async () => {
    if (!canManageSettings) {
      showToast?.('Accès refusé : privilèges Administrateur requis.', 'error');
      return;
    }
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
      await confirmAction({
        title: 'Purger les interventions orphelines',
        message: `Supprimer définitivement ${correctiveOrphans.length} intervention(s) corrective(s) orpheline(s) ?\n\n${impact.warnings[0] || ''}`,
        variant: 'danger',
      })
    ) {
      const { kept } = dataIntegrityService.purgeOrphanCorrectiveInterventions(
        correctiveInterventions,
        machines
      );
      setCorrectiveInterventions?.(kept as CorrectiveInterventionItem[]);
      showToast?.(
        `${correctiveOrphans.length} intervention(s) orpheline(s) purgée(s) avec succès.`,
        'success'
      );
    }
  };

  const [bulkRelinkModal, setBulkRelinkModal] = useState<{
    isOpen: boolean;
    entityType: string;
    targetMachineId: string;
  }>({
    isOpen: false,
    entityType: 'preventive',
    targetMachineId: '',
  });

  useEffect(() => {
    if (!bulkRelinkModal.isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setBulkRelinkModal((prev) => ({ ...prev, isOpen: false }));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [bulkRelinkModal.isOpen]);

  const handleBulkRelink = (entityType: string) => {
    const orphans = entityType === 'preventive' ? preventiveOrphans : correctiveOrphans;
    if (orphans.length === 0) {
      showToast?.('Aucun élément orphelin à réassigner.', 'info');
      return;
    }
    const activeMachinesList = filterActiveMachines(machines);
    if (activeMachinesList.length === 0) {
      showToast?.('Aucune machine active disponible pour la réassignation.', 'error');
      return;
    }
    const firstId = String(
      activeMachinesList[0]?.id_machine_registered ||
        activeMachinesList[0]?.id ||
        activeMachinesList[0]?.code ||
        ''
    );
    setBulkRelinkModal({
      isOpen: true,
      entityType,
      targetMachineId: firstId,
    });
  };

  const handleConfirmBulkRelink = (e: React.FormEvent) => {
    e.preventDefault();
    const target = bulkRelinkModal.targetMachineId.trim();
    if (!target) return;
    const entityType = bulkRelinkModal.entityType;
    if (entityType === 'preventive') {
      const { updated, changedCount, error } = dataIntegrityService.bulkRelinkOrphans({
        entityType: 'preventive',
        items: preventiveTasks,
        machines,
        newMachineId: target,
      });
      if (error) {
        showToast?.('Erreur: Machine cible invalide ou archivée.', 'error');
        return;
      }
      setPreventiveTasks?.(updated as PreventiveTaskItem[]);
      setBulkRelinkModal({ isOpen: false, entityType: 'preventive', targetMachineId: '' });
      showToast?.(`${changedCount} élément(s) réassigné(s) avec succès à ${target}.`, 'success');
    } else {
      const { updated, changedCount, error } = dataIntegrityService.bulkRelinkOrphans({
        entityType: 'corrective',
        items: correctiveInterventions,
        machines,
        newMachineId: target,
      });
      if (error) {
        showToast?.('Erreur: Machine cible invalide ou archivée.', 'error');
        return;
      }
      setCorrectiveInterventions?.(updated as CorrectiveInterventionItem[]);
      setBulkRelinkModal({ isOpen: false, entityType: 'preventive', targetMachineId: '' });
      showToast?.(`${changedCount} élément(s) réassigné(s) avec succès à ${target}.`, 'success');
    }
  };

  const handleRegisterDiscovered = () => {
    if (discoveredItems.length === 0) return;

    if (auditTarget === 'machines') {
      const defaultFamily = families[0]?.id_family || '';
      const defaultTemplate = templates[0]?.id_templates || '';
      const defaultZone = zones[0]?.id_zone || '';
      const defaultTech = technicians[0]?.nom || '';

      const newMachines: IMachine[] = discoveredItems.map((dm: DiscoveredAuditItem) => ({
        id_machine_registered: dm.code,
        designation: `Machine Auto-Détectée ${dm.code}`,
        id_family: defaultFamily,
        id_templates: defaultTemplate,
        id_zone_default: defaultZone,
        technician: defaultTech,
        status: 'En service',
      }));
      setMachines?.((prev: IMachine[]) => [...prev, ...newMachines]);
      showToast?.(`${newMachines.length} machines enregistrées avec succès.`, 'success');
    } else if (auditTarget === 'utilisateurs') {
      let regTech = 0;
      let regChef = 0;
      let regOp = 0;

      const nextTechs: ITechnician[] = [...technicians];
      const nextOps: IOperation[] = [...operations];

      discoveredItems.forEach((item: DiscoveredAuditItem) => {
        const name = item.code;
        const role = item.inferredRole || 'TECHNICIEN';

        if (role === 'TECHNICIEN') {
          const nums = nextTechs
            .map((t: ITechnician) => {
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
            .filter((o: IOperation) => o.type_profil === 'CHEF' || String(o.id_operation).startsWith('CHEF'))
            .map((o: IOperation) => {
              const m = String(o.id_operation || '').match(/CHEF-(\d+)/i);
              return m ? parseInt(m[1], 10) : 0;
            })
            .filter((n: number) => !isNaN(n));
          const max = nums.length > 0 ? Math.max(...nums) : 0;
          const nextId = `CHEF-${String(max + 1).padStart(2, '0')}`;

          nextOps.push({
            id_operation: nextId,
            nom: name,
            id_zone: zones[0]?.id_zone || '',
            type_profil: 'CHEF',
            avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(name)}`,
          });
          regChef++;
        } else {
          const nums = nextOps
            .filter(
              (o: IOperation) => o.type_profil === 'OPERATEUR' || !String(o.id_operation).startsWith('CHEF')
            )
            .map((o: IOperation) => {
              const m = String(o.id_operation || '').match(/OP-(\d+)/i);
              return m ? parseInt(m[1], 10) : 0;
            })
            .filter((n: number) => !isNaN(n));
          const max = nums.length > 0 ? Math.max(...nums) : 0;
          const nextId = `OP-${String(max + 1).padStart(2, '0')}`;

          nextOps.push({
            id_operation: nextId,
            nom: name,
            id_zone: zones[0]?.id_zone || '',
            type_profil: 'OPERATEUR',
            avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(name)}`,
          });
          regOp++;
        }
      });

      setTechnicians?.(nextTechs);
      setOperations?.(nextOps);
      showToast?.(
        `${discoveredItems.length} utilisateur(s) enregistrés automatiquement (${regTech} Techs, ${regChef} Chefs, ${regOp} Opérateurs) avec identifiants séquentiels uniques.`,
        'success'
      );
    } else if (auditTarget === 'articles') {
      const firstType = types[0];
      const defaultType =
        typeof firstType === 'string'
          ? firstType
          : firstType?.id_type || firstType?.libelle || 'MECANIQUE';
      const newArticles: IStockItem[] = discoveredItems.map((item: DiscoveredAuditItem) => {
        const baseArticle: IStockItem = {
          ref: item.code,
          designation: `Pièce PDR ${item.code}`,
          type: defaultType,
          stockInitial: 0,
          seuil: 5,
          emplacement: 'Magasin PDR',
        };
        const calc = StockCalculationService.calculateStockByRef(baseArticle, mouvements);
        return {
          ...baseArticle,
          entrees: calc?.entrees ?? 0,
          sorties: calc?.sorties ?? 0,
          stockActuel: calc?.stockActuel ?? 0,
          alerte: calc?.alerte ?? 'RUPTURE',
        };
      });
      if (setRawStock) {
        setRawStock((prev: IStockItem[]) => [...prev, ...newArticles]);
      }
      storageService.saveArticles([...rawStock, ...newArticles]);
      showToast?.(`${newArticles.length} article(s) de stock enregistrés et calculés avec succès.`, 'success');
    } else {
      showToast?.(
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
      if (setMouvements && result.nextMouvements) setMouvements(result.nextMouvements as IMouvement[]);
      if (setCorrectiveInterventions && result.nextInterventions)
        setCorrectiveInterventions(result.nextInterventions as CorrectiveInterventionItem[]);
      if (setPreventiveTasks && result.nextPreventiveTasks)
        setPreventiveTasks(result.nextPreventiveTasks as PreventiveTaskItem[]);
      if (setMachines && result.nextMachines) setMachines(result.nextMachines as IMachine[]);

      showToast?.(
        `${result.affectedCount} occurrence(s) rattachée(s) et corrigée(s) vers "${relinkData.targetKey}".`,
        'success'
      );
      setShowRelinkModal(false);
      setRelinkData({ entityType: 'machine', oldKey: '', targetKey: '', occurrencesCount: 0 });
    }
  };

  const [backupsList, setBackupsList] = useState<BackupSnapshotSummary[]>([]);
  const [showBackupManagerModal, setShowBackupManagerModal] = useState(false);
  const [auditLogs, setAuditLogs] = useState<Array<Record<string, unknown>>>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [accessLogs, setAccessLogs] = useState<Array<Record<string, unknown>>>([]);
  const [auditSubTab, setAuditSubTab] = useState('access');
  const [integrityReport, setIntegrityReport] = useState<ReturnType<typeof dataIntegrityService.getIntegrityReport> | null>(null);
  const [checkingIntegrity, setCheckingIntegrity] = useState(false);
  const [currentChecksum, setCurrentChecksum] = useState('');
  const [syncQueueState, setSyncQueueState] = useState(() => syncQueueService.getState());
  const [perfStats, setPerfStats] = useState<SettingsPerformanceStats>({
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
    } catch (err: unknown) {
      errorTracker.captureException(err instanceof Error ? err : new Error(getErrorMessage(err)), {
        source: 'Diagnostic Simulation',
      });
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
          machineElementsLedger,
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

  const handleRepairData = async () => {
    if (
      !(await confirmAction({
        title: 'Auto-réparation des anomalies',
        message: 'Voulez-vous corriger automatiquement les anomalies de stocks négatifs, décalages de calculs Excel et valeurs manquantes ?',
        variant: 'warning',
      }))
    )
      return;
    const { repairedStock, fixedCount } = dataIntegrityService.autoHealData({
      rawStock,
      mouvements,
    });
    if (setRawStock) {
      setRawStock(repairedStock as IStockItem[]);
    }
    storageService.saveArticles(repairedStock as IStockItem[]);
    runIntegrityCheck();
    showToast?.(
      `${fixedCount} correction(s) et alignement(s) de formules appliqués avec succès.`,
      'success'
    );
  };

  const runPerformanceBenchmark = async () => {
    try {
      await performanceService.measure('Calcul_Formules_Twin_Stock', async () => {
        const mvtsMap = new Map<string, { in: number; out: number }>();
        for (const m of mouvements) {
          const r = String(m.ref || '').trim().toUpperCase();
          if (!r) continue;
          if (!mvtsMap.has(r)) mvtsMap.set(r, { in: 0, out: 0 });
          const item = mvtsMap.get(r)!;
          const normType: string = StockCalculationService.normalizeType(m.type);
          const qty = Math.max(0, Number(m.quantite) || 0);
          if (normType === 'ENTREE' || normType === 'RETOUR') {
            item.in += qty;
          } else if (normType === 'SORTIE') {
            item.out += qty;
          }
        }
        return rawStock.map((s: IStockItem) => {
          const r = String(s.ref || '').trim().toUpperCase();
          const mvt = mvtsMap.get(r);
          return {
            ...s,
            calc: (Number(s.stockInitial) || 0) + (mvt?.in || 0) - (mvt?.out || 0),
          };
        });
      });
      refreshPerformanceMetrics();
      showToast?.('Benchmark de performance calculé avec succès.', 'success');
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
    setAccessLogs(Array.isArray(logs) ? (logs as Array<Record<string, unknown>>) : []);
  };

  const handleClearAccessLogs = async () => {
    if (!canManageSettings) {
      showToast?.('Accès refusé : privilèges Administrateur requis pour vider le journal des accès.', 'error');
      return;
    }
    if (
      await confirmAction({
        title: 'Vider le journal des accès',
        message: 'Êtes-vous sûr de vouloir vider le journal des connexions et sessions ?',
        variant: 'danger',
      })
    ) {
      accessLogService.clearLogs();
      setAccessLogs([]);
      showToast?.('Journal des accès réinitialisé.', 'info');
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
      setAuditLogs(Array.isArray(list) ? (list as Array<Record<string, unknown>>) : []);
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
      !(await confirmAction({
        title: 'Restaurer une sauvegarde',
        message: 'Attention : Cette action va écraser toutes vos données actuelles. Confirmer ?',
        variant: 'danger',
      }))
    )
      return;
    try {
      const data: unknown = await backupService.restoreBackup(id);
      if (!data) {
        showToast?.('Sauvegarde introuvable ou impossible à restaurer.', 'error');
        return;
      }
      if (typeof data === 'object' && data !== null) {
        const payload = data as RestoredBackupPayload;
        if (payload.Stock_Actuel) setRawStock?.(payload.Stock_Actuel);
        if (payload.Mouvement) setMouvements?.(payload.Mouvement);
        if (payload.Machines_Registered) setMachines?.(payload.Machines_Registered);
        if (payload.Families) setFamilies?.(payload.Families);
        if (payload.Templates) setTemplates?.(payload.Templates);
        if (payload.Zones) setZones?.(payload.Zones);
        if (payload.Technicians) setTechnicians?.(payload.Technicians);
        if (payload.Operations) setOperations?.(payload.Operations);
      }
      // Rebuild stock index & recalculate stock invariant across the restored SSOT store
      const store = useGmaoStore.getState();
      const restoredStock: IStockItem[] = Array.isArray(store.rawStock) ? store.rawStock : rawStock;
      const restoredMvts: IMouvement[] = Array.isArray(store.mouvements) ? store.mouvements : mouvements;
      const calcMap = new Map(
        StockCalculationService.calculateAllStocks(restoredStock, restoredMvts).map((c) => [
          String(c.ref || '').trim().toUpperCase(),
          c,
        ])
      );
      const recalculatedStock: IStockItem[] = restoredStock.map((art: IStockItem) => {
        const k = String(art?.ref || '').trim().toUpperCase();
        const c = calcMap.get(k);
        if (!c) return art;
        return {
          ...art,
          entrees: c.entrees,
          sorties: c.sorties,
          stockActuel: c.stockActuel,
          alerte: c.alerte,
        };
      });
      const initMap = new Map<string, number>();
      recalculatedStock.forEach((art: IStockItem) => {
        if (art?.ref) initMap.set(String(art.ref).trim().toUpperCase(), Number(art.stockInitial) || 0);
      });
      stockIndex.rebuild(restoredMvts, initMap);
      if (setRawStock) setRawStock(recalculatedStock);
      storageService.saveArticles(recalculatedStock);

      showToast?.('Restauration complète (SSOT + Stock recalculé) réussie !', 'success');
      logger.info('Backup restored manually', { backupId: id });
    } catch {
      showToast?.('Erreur lors de la restauration.', 'error');
    }
  };

  const handleExportBackup = async (id: string) => {
    try {
      await backupService.exportBackup(id);
      showToast?.('Export réussi !', 'success');
    } catch {
      showToast?.("Erreur lors de l'export.", 'error');
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
    <AnimatedPage className="space-y-5 pb-10 settings-excel-ui">
      {/* Executive Header Card (Shared BDR Light GMAO + Industrial Steel-Blue Theme) */}
      <div className="bg-white px-5 py-4 md:px-6 md:py-5 rounded-2xl border border-slate-200/90 shadow-[0_12px_32px_-6px_rgba(0,0,0,0.12),0_4px_12px_-2px_rgba(0,0,0,0.06)] hover:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.16),0_6px_16px_-3px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-300 ease-out flex flex-col md:flex-row md:items-center justify-between gap-4 relative overflow-hidden group/header">
        <div className="absolute -top-12 -right-12 w-48 h-48 bg-sky-600/5 rounded-full blur-2xl pointer-events-none group-hover/header:bg-sky-600/10 transition-colors duration-500" />
        <div className="min-w-0 flex-1 flex items-start sm:items-center gap-3.5 relative">
          <PageHeaderIcon icon={SettingsIcon} colorClass="text-sky-700" />
          <div className="min-w-0">
            <h1 className="text-lg md:text-xl font-black text-slate-900 tracking-tight truncate">
              {headerCopy.title}
            </h1>
            <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-snug">
              {headerCopy.desc}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2.5 shrink-0 relative">
          <Action3DButton
            variant="circle"
            color="sky"
            icon={Download}
            onClick={() => {
              const ok = AutoBackupService.exportFullBackupJSON();
              showToast?.(
                ok ? 'Snapshot JSON opérationnel téléchargé.' : "Erreur lors de l'export Snapshot.",
                ok ? 'success' : 'error'
              );
            }}
            title="Exporter Snapshot JSON complet"
            ariaLabel="Exporter Snapshot JSON complet"
            className="shadow-[0_8px_20px_-4px_rgba(15,23,42,0.14),0_3px_8px_-2px_rgba(15,23,42,0.08),inset_0_1px_1px_rgba(255,255,255,0.95)]"
          />
          <Action3DButton
            variant="circle"
            color="slate"
            icon={Database}
            onClick={() => setShowBackupManagerModal(true)}
            title="Gestionnaire des sauvegardes et restauration"
            ariaLabel="Gestionnaire des sauvegardes et restauration"
            className="shadow-[0_8px_20px_-4px_rgba(15,23,42,0.14),0_3px_8px_-2px_rgba(15,23,42,0.08),inset_0_1px_1px_rgba(255,255,255,0.95)]"
          />
          {onExportExcel && (
            <Action3DButton
              variant="circle"
              color="emerald"
              icon={FileSpreadsheet}
              onClick={onExportExcel}
              title="Exporter Classeur Miroir Excel (.xlsx)"
              ariaLabel="Exporter Classeur Miroir Excel"
              className="shadow-[0_8px_20px_-4px_rgba(16,185,129,0.22),0_3px_8px_-2px_rgba(15,23,42,0.08),inset_0_1px_1px_rgba(255,255,255,0.95)]"
            />
          )}
        </div>
      </div>

      {/* Modular Navigation Tabs */}
      <SettingsNavTabs
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        discoveredItemsCount={discoveredItems.length}
        allowedTabIds={allowedTabIds}
      />

      {/* Modular Tab Panels */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-[0_12px_32px_-8px_rgba(15,23,42,0.08),0_4px_12px_-2px_rgba(15,23,42,0.04)] p-5 sm:p-7 w-full max-w-full overflow-hidden">
        <SettingsPageHeader tabId={activeTab} />
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          >

        {activeTab === 'overview' && allowedTabIds.includes('overview') && (
          <SettingsOverviewTab
            storageUsage={{ kb: localStorageSizeKB }}
            localStorageSizeKB={localStorageSizeKB}
            totalUsedMB={totalUsedMB}
            allocatedCacheCeilingMB={allocatedCacheCeilingMB}
            idbQuotaInfo={idbQuotaInfo}
            handleCeilingChange={handleCeilingChange}
            storagePercentage={storagePercentage}
            rawStock={rawStock}
            rawStockCount={rawStock.length}
            machines={machines}
            machinesCount={machines.length}
            mouvements={mouvements}
            mouvementsCount={mouvements.length}
            zones={zones}
            zonesCount={zones.length}
            technicians={technicians}
            techniciansCount={technicians.length}
            operations={operations}
            warehouseItems={warehouseItems}
            sortiesExterne={sortiesExterne}
            preventiveTasks={preventiveTasks}
            preventiveCount={preventiveTasks.length}
            correctiveInterventions={correctiveInterventions}
            linkedFileName={linkedFileName}
            fileDetails={fileDetails}
            linkedFileHandle={linkedFileHandle}
            onDownloadBlankTemplate={onDownloadBlankTemplate}
            onExportExcel={onExportExcel}
            onOpenBackupManager={() => setShowBackupManagerModal(true)}
            showToast={showToast}
          />
        )}

        {activeTab === 'mvt-logic' && allowedTabIds.includes('mvt-logic') && <SettingsMvtLogicTab />}

        {activeTab === 'injection' && allowedTabIds.includes('injection') && (
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

        {activeTab === 'directory' && allowedTabIds.includes('directory') && (
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

        {activeTab === 'matching' && allowedTabIds.includes('matching') && (
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

        {activeTab === 'json-editor' && allowedTabIds.includes('json-editor') && (
          <SettingsJsonEditorTab
            jsonTarget={jsonTarget}
            setJsonTarget={setJsonTarget}
            handleUploadJSON={handleUploadJSON}
            handleDownloadJSON={handleDownloadJSON}
            jsonError={jsonError}
            setJsonError={setJsonError}
            jsonText={jsonText}
            setJsonText={setJsonText}
            handleCancelEdits={handleCancelEdits}
            isJsonModified={isJsonModified}
            handleSaveJSON={handleSaveJSON}
          />
        )}

        {activeTab === 'backup-audit' && allowedTabIds.includes('backup-audit') && (
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
            systemGeneralBomLeaks={systemGeneralBomLeaks}
            handlePurgePreventiveOrphans={handlePurgePreventiveOrphans}
            handlePurgeCorrectiveOrphans={handlePurgeCorrectiveOrphans}
            handlePurgeSystemGeneralBomLeaks={handlePurgeSystemGeneralBomLeaks}
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

        {activeTab === 'admin' && allowedTabIds.includes('admin') && (
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
            technicians={technicians}
            onNavigateToUsers={() => useGmaoStore.getState().setCurrentTab('utilisateurs')}
          />
        )}

        {activeTab === 'performance' && allowedTabIds.includes('performance') && (
          <PerformanceDashboardPanel
            rawStock={rawStock}
            mouvements={mouvements}
            showToast={showToast}
          />
        )}

        {activeTab === 'appearance' && <AppearanceLayoutSelector showToast={showToast} />}

        {activeTab === 'currency' && <SettingsCurrencyTab showToast={showToast} />}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Modular Audit & Relink Modals */}
      <AuditZoneModal
        isOpen={showAuditZoneModal}
        onClose={() => setShowAuditZoneModal(false)}
        auditZoneForm={auditZoneForm}
        setAuditZoneForm={setAuditZoneForm}
        getNextZoneId={getNextZoneId}
        setZones={(setZones || (() => {})) as unknown as React.Dispatch<React.SetStateAction<AuditZoneRecord[]>>}
        showToast={showToast}
      />

      <AuditUserModal
        isOpen={showAuditUserModal}
        onClose={() => setShowAuditUserModal(false)}
        auditUserForm={auditUserForm}
        setAuditUserForm={setAuditUserForm}
        getNextUserId={getNextUserId}
        zones={zones as unknown as AuditZoneRecord[]}
        setTechnicians={(setTechnicians || (() => {})) as unknown as React.Dispatch<React.SetStateAction<AuditTechnicianRecord[]>>}
        setOperations={(setOperations || (() => {})) as unknown as React.Dispatch<React.SetStateAction<AuditOperationRecord[]>>}
        showToast={showToast}
      />

      <AuditArticleModal
        isOpen={showAuditArticleModal}
        onClose={() => setShowAuditArticleModal(false)}
        auditArticleForm={auditArticleForm}
        setAuditArticleForm={setAuditArticleForm}
        types={types}
        setRawStock={setRawStock as unknown as React.Dispatch<React.SetStateAction<AuditStockRecord[]>>}
        rawStock={rawStock as unknown as AuditStockRecord[]}
        mouvements={mouvements as unknown as Array<Record<string, unknown>>}
        storageService={storageService as unknown as { saveArticles: (articles: AuditStockRecord[]) => void }}
        showToast={showToast}
      />

      <AuditRelinkModal
        isOpen={showRelinkModal}
        onClose={() => setShowRelinkModal(false)}
        relinkData={relinkData}
        setRelinkData={setRelinkData}
        machines={machines as unknown as AuditMachineRecord[]}
        rawStock={rawStock as unknown as AuditStockRecord[]}
        zones={zones as unknown as AuditZoneRecord[]}
        technicians={technicians as unknown as AuditTechnicianRecord[]}
        operations={operations as unknown as AuditOperationRecord[]}
        handleExecuteRelink={handleExecuteRelink}
      />

      <BulkRelinkModal
        modalState={bulkRelinkModal}
        setModalState={setBulkRelinkModal}
        machines={machines}
        onConfirm={handleConfirmBulkRelink}
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
