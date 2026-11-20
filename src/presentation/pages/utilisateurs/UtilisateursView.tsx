import {  useState, useRef, useMemo, useEffect  } from 'react';
import AnimatedPage from '../../components/common/AnimatedPage';
import CustomSelect from '../../components/common/CustomSelect';
import GmaoIndustrialDataGrid from '../../components/common/GmaoIndustrialDataGrid';
import {
  Users,
  User,
  Plus,
  Search,
  MapPin,
  Trash2,
  Edit2,
  AlertTriangle,
  SlidersHorizontal,
  ArrowUpDown,
  ChevronDown,
  Sparkles,
  ClipboardList,
  Wrench,
  ArrowDown,
  ArrowUp,
  ShieldCheck,
  Check,
  Hash,
  Crown,
  Globe,
  X,
  RotateCcw,
  FileSpreadsheet,
  Key,
  Lock,
  Unlock,
  ArrowRightLeft,
} from 'lucide-react';
import SupervisorAccount from '../../components/common/icons/SupervisorAccount';
import UserCodePicker from '../../components/common/UserCodePicker';
import FormulasModalButton from '../../components/common/FormulasModalButton';
import Action3DButton from '../../components/common/Action3DButton';
import PageHeaderIcon from '../../components/common/PageHeaderIcon';
import { GmaoKpiCard, GmaoKpiGrid } from '../../components/common/GmaoKpiCard';
import {
  RESPONSABLE_TEMPLATES,
  normalizeTemplateIds,
  getTemplatesForUser,
  formatTemplateLabels,
} from '../../../domain/users/responsableTemplates';
import { useTranslation } from '../../../i18n/I18nContext';
import { useAuth } from '../../../context/AuthContext';
import { usePermission } from '../../components/common/PermissionGate';
import { exportTypeBWorkbook } from '../../../utils/safeExcelExport';
import UtilisateursModals from './components/UtilisateursModals';
import { computePersonnelWorkload } from '../../../application/services/PersonnelWorkloadService';
import { matchesMemberZone } from '../../../application/services/ZoneOperationalAnalyticsService';
import { validatePasswordPolicy } from '../../../core/security/AuthService';
import { LicenseGateService } from '../../../core/security/LicenseGateService';

export default function UtilisateursView({
  technicians = [],
  operations = [],
  zones = [],
  machines = [],
  correctiveInterventions = [],
  preventiveTasks = [],
  preventiveExecutions = [],
  sortiesExterne = [],
  techZoneFilter,
  setTechZoneFilter,
  opZoneFilter,
  setOpZoneFilter,
  onAddTechnician,
  onUpdateTechnician,
  onDeleteTechnician,
  onReassignTechnicianWorkload,
  onAddOperation,
  onUpdateOperation,
  onDeleteOperation,
  onOpenAddZoneModal,
  onOpenAddZone,
  showToast,
}) {
  const { t } = useTranslation();
  const {
    user: currentUser,
    accounts: authAccounts,
    getAccountForPersonnel,
    upsertPersonnelAuthAccount,
    toggleAccountActive,
    removePersonnelAuthAccount,
  } = useAuth();
  const isAdmin = currentUser?.role === 'ADMIN';
  const canManageUsersPerm = usePermission('users.manage');
  const canManageUsers = Boolean(currentUser) && (isAdmin || canManageUsersPerm);
  const handleOpenZoneModal = onOpenAddZoneModal || onOpenAddZone;

  const [localSearch, setLocalSearch] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    const handler = setTimeout(() => {
      setSearch(localSearch);
    }, 200);
    return () => clearTimeout(handler);
  }, [localSearch]);

  const [profileFilter, setProfileFilter] = useState('ALL'); // ALL, TECHNICIEN, OPERATEUR, RESPONSABLE, RMT, RZN, RPD, RMG
  const [zoneFilter, setZoneFilter] = useState('ALL');
  const [accessFilter, setAccessFilter] = useState<
    'ALL' | 'ACTIVE' | 'OVERLOADED' | 'NO_ACCOUNT' | 'NO_PASSWORD' | 'DISABLED' | 'ARCHIVED'
  >('ALL');

  // Sync incoming zone navigation filters from ZonesView
  useEffect(() => {
    if (techZoneFilter !== undefined && techZoneFilter !== 'ALL') {
      setZoneFilter(techZoneFilter || 'ALL');
      setProfileFilter('TECHNICIEN');
      if (setTechZoneFilter) setTechZoneFilter('ALL');
    }
  }, [techZoneFilter]);

  useEffect(() => {
    if (opZoneFilter !== undefined && opZoneFilter !== 'ALL') {
      setZoneFilter(opZoneFilter || 'ALL');
      setProfileFilter('ALL');
      if (setOpZoneFilter) setOpZoneFilter('ALL');
    }
  }, [opZoneFilter]);

  const [showAddModal, setShowAddModal] = useState(false);
  const [showFormulasModal, setShowFormulasModal] = useState(false);
  const [userToEdit, setUserToEdit] = useState(null);
  const [userToDelete, setUserToDelete] = useState(null);

  // Account Access Modal state (R1/R2 Individual Identity & Login Activation)
  const [userForAccessModal, setUserForAccessModal] = useState(null);
  const [accessForm, setAccessForm] = useState({
    username: '',
    role: 'TECHNICIEN',
    plainPassword: '',
    isActive: true,
  });
  const [accessError, setAccessError] = useState(null);
  const [accessSavedMsg, setAccessSavedMsg] = useState(null);

  // Phase C: 1-Click Workload Reassignment Modal state
  const [userToReassign, setUserToReassign] = useState<{ id: string; nom?: string } | null>(null);
  const [reassignTargetId, setReassignTargetId] = useState('');
  const [reassignScopes, setReassignScopes] = useState({
    includeMachines: true,
    includeOpenBts: true,
    includeActivePm: true,
  });

  // Phase C: Optional 1-Step Onboarding Auth Account creation inside Add User modal
  const [onboardingAccess, setOnboardingAccess] = useState({
    enabled: false,
    username: '',
    usernameTouched: false,
    role: 'TECHNICIEN',
    plainPassword: '',
    error: '',
  });

  const openAccessModal = (person) => {
    const existingAcc = getAccountForPersonnel ? getAccountForPersonnel(person.id) : null;
    const defaultRole =
      person.type === 'TECHNICIEN'
        ? 'TECHNICIEN'
        : person.type === 'OPERATEUR'
          ? 'OPERATEUR'
          : Array.isArray(person.template_ids) &&
              person.template_ids.includes('RMG') &&
              !person.template_ids.includes('RMT')
            ? 'RESPONSABLE_MAGASIN'
            : 'RESPONSABLE_MAINTENANCE';
    setUserForAccessModal(person);
    setAccessForm({
      username: existingAcc?.username || String(person.id || '').toLowerCase(),
      role: existingAcc?.role || defaultRole,
      plainPassword: '',
      isActive: existingAcc ? existingAcc.isActive !== false : true,
    });
    setAccessError(null);
    setAccessSavedMsg(null);
  };

  const handleSaveAccessModal = async (e) => {
    e.preventDefault();
    if (!userForAccessModal || !upsertPersonnelAuthAccount) return;
    setAccessError(null);
    setAccessSavedMsg(null);
    const existingAcc = getAccountForPersonnel
      ? getAccountForPersonnel(userForAccessModal.id)
      : null;
    const hasConfiguredPassword = Boolean(existingAcc?.hasPassword);
    const trimmedPassword = String(accessForm.plainPassword || '').trim();
    if (accessForm.isActive && !hasConfiguredPassword && !trimmedPassword) {
      setAccessError(
        'Veuillez saisir un mot de passe sécurisé (min. 8 caractères, 1 lettre et 1 chiffre) lors de la première activation.'
      );
      return;
    }
    try {
      await upsertPersonnelAuthAccount({
        personnelId: userForAccessModal.id,
        nom: userForAccessModal.nom,
        id_zone: userForAccessModal.id_zone || null,
        specialite: userForAccessModal.specialite || null,
        role: accessForm.role,
        username: accessForm.username,
        plainPassword: trimmedPassword,
        isActive: accessForm.isActive,
      });
      setAccessSavedMsg('Accès GMAO mis à jour avec succès.');
      setTimeout(() => {
        setUserForAccessModal(null);
        setAccessSavedMsg(null);
      }, 650);
    } catch (err: any) {
      setAccessError(err?.message || "Erreur lors de la mise à jour de l'accès");
    }
  };

  const [showSortMenu, setShowSortMenu] = useState(false);
  const sortMenuRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (sortMenuRef.current && !sortMenuRef.current.contains(event.target)) {
        setShowSortMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Auto-calculation of next ID respecting order (TECH-xx, OP-xx, RESP-xx)
  const getNextId = (type) => {
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
        .filter(
          (o) =>
            o.type_profil === 'OPERATEUR' &&
            !String(o.id_operation).startsWith('RESP') &&
            !String(o.id_operation).startsWith('CHEF')
        )
        .map((o) => {
          const m = String(o.id_operation || '').match(/OP-(\d+)/i);
          return m ? parseInt(m[1], 10) : 0;
        })
        .filter((n) => !isNaN(n));
      const max = nums.length > 0 ? Math.max(...nums) : 0;
      return `OP-${String(max + 1).padStart(2, '0')}`;
    } else if (type === 'RESPONSABLE' || type === 'CHEF') {
      const nums = operations
        .filter(
          (o) =>
            o.type_profil === 'RESPONSABLE' ||
            o.type_profil === 'CHEF' ||
            String(o.id_operation).startsWith('RESP') ||
            String(o.id_operation).startsWith('CHEF')
        )
        .map((o) => {
          const m = String(o.id_operation || '').match(/(?:RESP|CHEF)-(\d+)/i);
          return m ? parseInt(m[1], 10) : 0;
        })
        .filter((n) => !isNaN(n));
      const max = nums.length > 0 ? Math.max(...nums) : 0;
      return `RESP-${String(max + 1).padStart(2, '0')}`;
    }
    return '';
  };

  // Form for Add/Edit
  const [form, setForm] = useState({
    type: 'TECHNICIEN', // TECHNICIEN, OPERATEUR, RESPONSABLE
    nom: '',
    id_zone: zones[0]?.id_zone || '',
    zones: ['ALL'],
    templates: ['RMT'],
    template_id: 'RMT',
    specialite: '',
    customCode: '',
  });

  const modalAutoNextId = useMemo(() => getNextId(form.type), [form.type, technicians, operations]);

  const modalPrefix = form.type === 'TECHNICIEN' ? 'TECH-' : form.type === 'OPERATEUR' ? 'OP-' : 'RESP-';

  const modalTakenNumbers = useMemo(() => {
    const set = new Set();
    if (form.type === 'TECHNICIEN') {
      (technicians || []).forEach((t) => {
        const m = String(t.id_technician || t.id || '').match(/TECH-(\d+)/i);
        if (m) set.add(parseInt(m[1], 10));
      });
    } else if (form.type === 'OPERATEUR') {
      (operations || []).forEach((o) => {
        if (
          o.type_profil === 'OPERATEUR' &&
          !String(o.id_operation || '').startsWith('RESP') &&
          !String(o.id_operation || '').startsWith('CHEF')
        ) {
          const m = String(o.id_operation || o.id || '').match(/OP-(\d+)/i);
          if (m) set.add(parseInt(m[1], 10));
        }
      });
    } else {
      (operations || []).forEach((o) => {
        if (
          o.type_profil === 'RESPONSABLE' ||
          o.type_profil === 'CHEF' ||
          String(o.id_operation || '').startsWith('RESP') ||
          String(o.id_operation || '').startsWith('CHEF')
        ) {
          const m = String(o.id_operation || o.id || '').match(/(?:RESP|CHEF)-(\d+)/i);
          if (m) set.add(parseInt(m[1], 10));
        }
      });
    }
    return set;
  }, [form.type, technicians, operations]);

  // Calculate combined users list with full multi-template metadata
  const combinedUsers = useMemo(() => {
    const list = [];

    // Add technicians
    technicians.forEach((t) => {
      const isArchived =
        t.is_active === false || t.actif === false || t.statut === 'ARCHIVE';
      list.push({
        id: t.id_technician,
        nom: t.nom,
        id_zone: t.id_zone,
        zones: [t.id_zone],
        type: 'TECHNICIEN',
        specialite: t.specialite || 'Spécialité Maintenance',
        templates: [],
        template_ids: [],
        template_id: null,
        template_label: null,
        isArchived,
        raw: t,
      });
    });

    // Add operations (Operators and Responsables)
    operations.forEach((o) => {
      const isArchived =
        o.is_active === false || o.actif === false || o.statut === 'ARCHIVE';
      const isResp =
        o.type_profil === 'RESPONSABLE' ||
        o.type_profil === 'CHEF' ||
        String(o.id_operation).startsWith('RESP') ||
        String(o.id_operation).startsWith('CHEF');

      const opZones = Array.isArray(o.zones)
        ? o.zones
        : o.id_zone
          ? o.id_zone.split(',').map((s) => s.trim())
          : ['ALL'];

      const userTemplates = isResp ? getTemplatesForUser(o) : [];
      const userTemplateIds = userTemplates.map((t) => t.id);
      const templateIdStr = userTemplateIds.join(', ');
      const templateLabelStr = isResp
        ? userTemplates.map((t) => t.label).join(', ')
        : 'Opérateur Ligne de Production';

      list.push({
        id: o.id_operation,
        nom: o.nom,
        id_zone: o.id_zone || (opZones.includes('ALL') ? 'ALL' : opZones.join(', ')),
        zones: opZones,
        type: isResp ? 'RESPONSABLE' : 'OPERATEUR',
        templates: userTemplates,
        template_ids: userTemplateIds,
        template_id: templateIdStr,
        template_label: templateLabelStr,
        specialite: isResp
          ? userTemplates.map((t) => t.description).join(' • ') || 'Responsabilité & Coordination'
          : 'Opérateur Ligne de Production',
        isArchived,
        raw: o,
      });
    });

    return list;
  }, [technicians, operations]);

  const workloadReport = useMemo(
    () =>
      computePersonnelWorkload({
        technicians,
        operations,
        machines,
        correctiveInterventions,
        preventiveTasks,
        preventiveExecutions,
        sortiesExterne,
        authAccounts,
      }),
    [
      technicians,
      operations,
      machines,
      correctiveInterventions,
      preventiveTasks,
      preventiveExecutions,
      sortiesExterne,
      authAccounts,
    ]
  );

  const overloadedCount = useMemo(
    () =>
      combinedUsers.filter(
        (u) => !u.isArchived && workloadReport.byPersonId[u.id]?.workloadLevel === 'SURCHARGE'
      ).length,
    [combinedUsers, workloadReport]
  );

  const noAccountCount = useMemo(
    () =>
      combinedUsers.filter(
        (u) => !u.isArchived && !workloadReport.byPersonId[u.id]?.hasAccount
      ).length,
    [combinedUsers, workloadReport]
  );

  const activeTechniciansForReassign = useMemo(
    () =>
      combinedUsers
        .filter((u) => !u.isArchived && u.type === 'TECHNICIEN')
        .map((u) => ({
          id: u.id,
          nom: u.nom || u.id,
          specialite: u.specialite,
          id_zone: u.id_zone,
          assignedCount: workloadReport.byPersonId[u.id]?.totalActiveWorkload ?? 0,
        })),
    [combinedUsers, workloadReport]
  );

  const openReassignModal = (person: { id: string; nom?: string }) => {
    const firstCandidate =
      activeTechniciansForReassign.find((t) => t.id !== person.id)?.id || '';
    setUserToReassign({ id: person.id, nom: person.nom });
    setReassignTargetId(firstCandidate);
    setReassignScopes({
      includeMachines: true,
      includeOpenBts: true,
      includeActivePm: true,
    });
  };

  const handleSubmitReassign = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userToReassign || !reassignTargetId || !onReassignTechnicianWorkload) return;
    const res = onReassignTechnicianWorkload({
      sourceTechId: userToReassign.id,
      targetTechId: reassignTargetId,
      includeMachines: reassignScopes.includeMachines,
      includeOpenBts: reassignScopes.includeOpenBts,
      includeActivePm: reassignScopes.includeActivePm,
    });
    if (res) {
      setUserToReassign(null);
    }
  };

  // Filters with multi-template, case-insensitive zone, and security/lifecycle awareness
  const filtered = combinedUsers.filter((u) => {
    if (accessFilter === 'ACTIVE') {
      if (u.isArchived) return false;
    } else if (accessFilter === 'OVERLOADED') {
      const w = workloadReport.byPersonId[u.id];
      if (u.isArchived || w?.workloadLevel !== 'SURCHARGE') return false;
    } else if (accessFilter === 'NO_ACCOUNT') {
      const w = workloadReport.byPersonId[u.id];
      if (u.isArchived || w?.hasAccount) return false;
    } else if (accessFilter === 'ARCHIVED') {
      if (!u.isArchived) return false;
    } else if (accessFilter === 'NO_PASSWORD') {
      const w = workloadReport.byPersonId[u.id];
      if (u.isArchived || !w?.missingPasswordWarning) return false;
    } else if (accessFilter === 'DISABLED') {
      const acc = getAccountForPersonnel ? getAccountForPersonnel(u.id) : null;
      if (u.isArchived || !acc || acc.isActive !== false) return false;
    }

    if (profileFilter !== 'ALL') {
      if (profileFilter === 'TECHNICIEN' || profileFilter === 'OPERATEUR' || profileFilter === 'RESPONSABLE') {
        if (u.type !== profileFilter) return false;
      } else {
        // Specific template filter: RMT, RZN, RPD, RMG
        const hasTpl =
          (Array.isArray(u.template_ids) && u.template_ids.includes(profileFilter)) ||
          (Array.isArray(u.templates) && u.templates.some((t) => t.id === profileFilter)) ||
          (typeof u.template_id === 'string' && u.template_id.includes(profileFilter));
        if (!hasTpl) return false;
      }
    }
    if (zoneFilter !== 'ALL') {
      const targetZoneObj =
        zones.find(
          (z) =>
            String(z.id_zone || '').trim().toUpperCase() === String(zoneFilter).trim().toUpperCase() ||
            String(z.code_zone || '').trim().toUpperCase() === String(zoneFilter).trim().toUpperCase()
        ) || { id_zone: zoneFilter };
      if (!matchesMemberZone(u, targetZoneObj, { includeAll: true })) {
        return false;
      }
    }
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      String(u?.id || '').toLowerCase().includes(q) ||
      String(u?.nom || '').toLowerCase().includes(q) ||
      String(u?.id_zone || '').toLowerCase().includes(q) ||
      String(u?.template_label || '').toLowerCase().includes(q) ||
      String(u?.template_id || '').toLowerCase().includes(q) ||
      (Array.isArray(u?.template_ids) && u.template_ids.some((tid) => tid.toLowerCase().includes(q))) ||
      String(u?.specialite || '').toLowerCase().includes(q)
    );
  });

  // Pagination & Sorting
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState('nom');
  const [sortOrder, setSortOrder] = useState('asc');

  useEffect(() => {
    setCurrentPage(1);
  }, [search, profileFilter, zoneFilter, accessFilter, pageSize]);

  const sortedData = useMemo(() => {
    if (!sortField) return filtered;
    return [...filtered].sort((a, b) => {
      if (sortField === 'workload') {
        const wA = workloadReport.byPersonId[a.id]?.totalActiveWorkload ?? 0;
        const wB = workloadReport.byPersonId[b.id]?.totalActiveWorkload ?? 0;
        return sortOrder === 'asc' ? wA - wB : wB - wA;
      }
      let valA = a[sortField] || '';
      let valB = b[sortField] || '';
      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();
      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filtered, sortField, sortOrder, workloadReport]);

  const totalItems = sortedData.length;
  const effectivePageSize = pageSize === 0 ? totalItems : pageSize;
  const startIndex = (currentPage - 1) * effectivePageSize;
  const rawDisplayedData =
    pageSize === 0 ? sortedData : sortedData.slice(startIndex, startIndex + effectivePageSize);
  const displayedData = rawDisplayedData;

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  // Submit Handler
  const handleSave = async (e) => {
    e.preventDefault();
    if (!canManageUsers) return;
    if (!form.nom.trim()) return;

    if (userToEdit) {
      // Edit mode
      const isTech = userToEdit.id.startsWith('TECH-');
      if (isTech) {
        onUpdateTechnician(userToEdit.id, {
          ...userToEdit.raw,
          id_technician: userToEdit.id,
          nom: form.nom.trim(),
          id_zone: form.id_zone,
          specialite: form.specialite,
        });
        const existingAcc = getAccountForPersonnel ? getAccountForPersonnel(userToEdit.id) : null;
        if (existingAcc && upsertPersonnelAuthAccount) {
          upsertPersonnelAuthAccount({
            personnelId: userToEdit.id,
            nom: form.nom.trim(),
            id_zone: form.id_zone,
            specialite: form.specialite,
            role: existingAcc.role,
            username: existingAcc.username,
            isActive: existingAcc.isActive,
          }).catch(() => {});
        }
      } else {
        const isResp = form.type === 'RESPONSABLE';
        const isAll = (form.zones || []).includes('ALL');
        const selectedTpls = isResp
          ? form.templates && form.templates.length > 0
            ? form.templates
            : [form.template_id || 'RMT']
          : [];
        const tplLabel = isResp ? formatTemplateLabels(selectedTpls) : null;
        const resolvedZoneStr = isResp ? (isAll ? 'ALL' : form.zones.join(', ')) : form.id_zone;
        onUpdateOperation(userToEdit.id, {
          ...userToEdit.raw,
          id_operation: userToEdit.id,
          nom: form.nom.trim(),
          id_zone: resolvedZoneStr,
          zones: isResp ? form.zones : [form.id_zone],
          type_profil: isResp ? 'RESPONSABLE' : 'OPERATEUR',
          templates: isResp ? selectedTpls : null,
          template_ids: isResp ? selectedTpls : null,
          template_id: isResp ? selectedTpls.join(', ') : null,
          template_label: tplLabel,
        });
        const existingAcc = getAccountForPersonnel ? getAccountForPersonnel(userToEdit.id) : null;
        if (existingAcc && upsertPersonnelAuthAccount) {
          upsertPersonnelAuthAccount({
            personnelId: userToEdit.id,
            nom: form.nom.trim(),
            id_zone: resolvedZoneStr || null,
            specialite: isResp ? tplLabel || 'Supervision & Validation' : 'Opérateur Ligne de Production',
            role: existingAcc.role,
            username: existingAcc.username,
            isActive: existingAcc.isActive,
          }).catch(() => {});
        }
      }
      setUserToEdit(null);
      setShowAddModal(false);
    } else {
      // Add mode - Auto calculate ID on submission or use picked custom code
      const nextId = (form.customCode || getNextId(form.type)).trim().toUpperCase();
      const cleanName = form.nom.trim();
      const duplicateExists = combinedUsers.some(
        (u) =>
          String(u.id || '').trim().toUpperCase() === nextId ||
          (u.type === form.type && String(u.nom || '').trim().toLowerCase() === cleanName.toLowerCase())
      );
      if (duplicateExists) {
        showToast?.(
          `Un membre avec le code "${nextId}" ou le nom "${cleanName}" existe déjà.`,
          'warning'
        );
        return;
      }

      // Pre-validate 1-step GMAO login onboarding BEFORE mutating personnel list
      const wantsImmediateAccess = Boolean(
        isAdmin && onboardingAccess.enabled && upsertPersonnelAuthAccount
      );
      const loginUsername = String(onboardingAccess.username || nextId)
        .trim()
        .toLowerCase();
      if (wantsImmediateAccess) {
        if (loginUsername.length < 3 || !/^[a-zA-Z0-9_.-]+$/.test(loginUsername)) {
          setOnboardingAccess((prev) => ({
            ...prev,
            error: "L'identifiant de connexion doit contenir au moins 3 caractères valides.",
          }));
          return;
        }
        const usernameCollision = (authAccounts || []).some(
          (a) => String(a?.username || '').trim().toLowerCase() === loginUsername
        );
        if (usernameCollision) {
          setOnboardingAccess((prev) => ({
            ...prev,
            error: `L'identifiant "${loginUsername}" est déjà utilisé par un autre compte.`,
          }));
          return;
        }
        try {
          const validPass = validatePasswordPolicy(onboardingAccess.plainPassword);
          if (LicenseGateService.isLicenseActive()) {
            const matchesLicense = await LicenseGateService.verifyLicenseKey(validPass, {
              touchLastAuth: false,
            });
            if (matchesLicense) {
              throw new Error(
                'Le mot de passe utilisateur doit être différent de la clé de licence commerciale.'
              );
            }
          }
        } catch (err: any) {
          setOnboardingAccess((prev) => ({
            ...prev,
            error:
              err?.message ||
              'Mot de passe invalide (min. 8 caractères, 1 lettre et 1 chiffre).',
          }));
          return;
        }
      }

      let resolvedZoneForAccount: string | null = form.id_zone || null;
      let resolvedSpecForAccount: string | null = form.specialite || null;

      if (form.type === 'TECHNICIEN') {
        onAddTechnician({
          id_technician: nextId,
          nom: cleanName,
          id_zone: form.id_zone,
          specialite: form.specialite || 'Spécialité Maintenance',
        });
        resolvedSpecForAccount = form.specialite || 'Spécialité Maintenance';
      } else if (form.type === 'OPERATEUR') {
        onAddOperation({
          id_operation: nextId,
          nom: cleanName,
          id_zone: form.id_zone,
          type_profil: 'OPERATEUR',
        });
        resolvedSpecForAccount = 'Opérateur Ligne de Production';
      } else {
        const isAll = (form.zones || []).includes('ALL');
        const selectedTpls =
          form.templates && form.templates.length > 0
            ? form.templates
            : [form.template_id || 'RMT'];
        const tplLabel = formatTemplateLabels(selectedTpls);
        const zoneStr = isAll ? 'ALL' : form.zones.join(', ');
        onAddOperation({
          id_operation: nextId,
          nom: cleanName,
          id_zone: zoneStr,
          zones: form.zones,
          type_profil: 'RESPONSABLE',
          templates: selectedTpls,
          template_ids: selectedTpls,
          template_id: selectedTpls.join(', '),
          template_label: tplLabel,
        });
        resolvedZoneForAccount = zoneStr || null;
        resolvedSpecForAccount = tplLabel || 'Supervision & Validation';
      }

      if (wantsImmediateAccess && upsertPersonnelAuthAccount) {
        try {
          await upsertPersonnelAuthAccount({
            personnelId: nextId,
            nom: cleanName,
            id_zone: resolvedZoneForAccount,
            specialite: resolvedSpecForAccount,
            role: onboardingAccess.role,
            username: loginUsername,
            plainPassword: onboardingAccess.plainPassword.trim(),
            isActive: true,
          });
          showToast?.(`Membre ${cleanName} créé avec accès @${loginUsername} activé.`, 'success');
        } catch (err: any) {
          showToast?.(
            `Membre ${cleanName} créé, mais accès non activé : ${err?.message || 'Erreur'}`,
            'warning'
          );
        }
      }

      setOnboardingAccess({
        enabled: false,
        username: '',
        usernameTouched: false,
        role: 'TECHNICIEN',
        plainPassword: '',
        error: '',
      });
      setShowAddModal(false);
    }

    // Reset Form
    setForm({
      type: 'TECHNICIEN',
      nom: '',
      id_zone: zones[0]?.id_zone || '',
      zones: ['ALL'],
      templates: ['RMT'],
      template_id: 'RMT',
      specialite: '',
      customCode: '',
    });
  };

  // Delete / Soft-Archive Handler
  const confirmDelete = () => {
    if (!canManageUsers || !userToDelete) return;
    const isTech = userToDelete.id.startsWith('TECH-');
    const result = isTech
      ? onDeleteTechnician(userToDelete.id)
      : onDeleteOperation(userToDelete.id);
    if (result === 'ARCHIVED') {
      toggleAccountActive?.(userToDelete.id, false);
    } else {
      removePersonnelAuthAccount?.(userToDelete.id);
    }
    setUserToDelete(null);
  };

  const handleReactivateUser = (user) => {
    if (!canManageUsers || !user) return;
    const isTech = user.id.startsWith('TECH-');
    if (isTech) {
      onUpdateTechnician(user.id, {
        ...user.raw,
        is_active: true,
        actif: true,
        statut: 'ACTIF',
      });
    } else {
      onUpdateOperation(user.id, {
        ...user.raw,
        is_active: true,
        actif: true,
        statut: 'ACTIF',
      });
    }
    showToast?.(`Membre ${user.nom} réactivé avec succès.`, 'success');
  };

  const handleExportExcel = () => {
    const headers = [
      'ID Utilisateur',
      'Nom & Prénom',
      'Rôle / Profil',
      "Zone d'affectation",
      'Spécialité / Templates',
      'Machines Affectées',
      'BT Ouverts',
      'Tâches PM Actives',
      'Statut Fiche',
      'Accès GMAO',
    ];
    const rows = filtered.map((u) => {
      const acc = getAccountForPersonnel ? getAccountForPersonnel(u.id) : null;
      const w = workloadReport.byPersonId[u.id];
      return [
        u.id || '',
        u.nom || '',
        u.type || '',
        u.id_zone || '',
        u.template_label || u.specialite || '',
        w?.assignedMachinesCount ?? 0,
        w?.openCorrectiveCount ?? 0,
        w?.activePreventiveTasksCount ?? 0,
        u.isArchived ? 'ARCHIVÉ' : 'ACTIF',
        acc
          ? acc.isActive === false
            ? 'Désactivé'
            : acc.hasPassword === false
              ? `@${acc.username} (Sans mot de passe)`
              : `@${acc.username} (${acc.role})`
          : 'Non activé',
      ];
    });
    exportTypeBWorkbook({
      filename: `Utilisateurs_Equipes_${new Date().toISOString().slice(0, 10)}.xlsx`,
      screenName: 'Utilisateurs & Équipes GMAO',
      sheets: [
        {
          name: 'Personnel_GMAO',
          headers,
          rows,
        },
      ],
    });
  };

  const renderSortIcon = (field) => {
    if (sortField !== field) {
      return (
        <ArrowUpDown className="w-3 h-3 text-slate-300 group-hover:text-slate-500 transition shrink-0" />
      );
    }
    return sortOrder === 'asc' ? (
      <ArrowUp className="w-3 h-3 text-indigo-700 shrink-0 font-bold" />
    ) : (
      <ArrowDown className="w-3 h-3 text-indigo-700 shrink-0 font-bold" />
    );
  };

  const userColumns = useMemo(
    () => [
      {
        key: 'id',
        label: t('utilisateurs.columns.id'),
        colLetter: 'B',
        icon: Hash,
        sortable: true,
        render: (user) => (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-mono font-bold text-xs bg-slate-100 text-slate-900 border border-slate-200/90 shadow-2xs">
            <Hash className="w-3 h-3 text-indigo-600 shrink-0" />
            <span>{user.id}</span>
          </span>
        ),
      },
      {
        key: 'nom',
        label: t('utilisateurs.columns.user'),
        colLetter: 'C',
        icon: User,
        sortable: true,
        render: (user) => {
          const isResp = user.type === 'RESPONSABLE';
          const isTech = user.type === 'TECHNICIEN';
          const isOp = user.type === 'OPERATEUR';
          return (
            <div className="flex items-center gap-2.5">
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 border shadow-2xs ${
                  isTech
                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                    : isOp
                      ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                      : 'bg-purple-50 text-purple-700 border-purple-200'
                }`}
              >
                {isTech ? (
                  <Wrench className="w-3.5 h-3.5 text-blue-600" />
                ) : isOp ? (
                  <ClipboardList className="w-3.5 h-3.5 text-indigo-600" />
                ) : (
                  <SupervisorAccount className="w-3.5 h-3.5 text-amber-600" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span
                    className={`font-bold text-xs sm:text-[12.5px] leading-tight ${
                      user.isArchived ? 'text-slate-400 line-through' : 'text-slate-900'
                    }`}
                  >
                    {user.nom}
                  </span>
                  {user.isArchived && (
                    <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 text-[9.5px] font-mono font-bold uppercase">
                      Archivé
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1 mt-0.5">
                  <User className="w-2.5 h-2.5 text-slate-400" />
                  <span>
                    {isResp
                      ? 'Cadre / Supervision'
                      : isTech
                        ? 'Maintenance Industrielle'
                        : 'Opérations & Lignes'}
                  </span>
                </span>
              </div>
            </div>
          );
        },
      },
      {
        key: 'type',
        label: t('utilisateurs.columns.perimeter'),
        colLetter: 'D',
        icon: ShieldCheck,
        sortable: true,
        render: (user) => {
          const isResp = user.type === 'RESPONSABLE';
          const isOp = user.type === 'OPERATEUR';
          const tpls =
            Array.isArray(user.templates) && user.templates.length > 0
              ? user.templates
              : getTemplatesForUser(user);

          if (isOp) {
            return (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-2xs">
                <ClipboardList className="w-3 h-3 text-indigo-600 shrink-0" />
                <span>Opérateur Ligne (OP)</span>
              </span>
            );
          }
          if (isResp) {
            return (
              <div className="flex flex-wrap gap-1 items-center max-w-sm">
                {tpls.map((tpl, tplIdx) => (
                  <span
                    key={`tpl-${user.id || 'u'}-${tpl.id || tplIdx}`}
                    className={`inline-flex items-center gap-1 text-[10.5px] font-bold border px-2.5 py-0.5 rounded-full shadow-2xs ${tpl.badgeClass || ''}`}
                    title={`${tpl.label || ''} - ${tpl.description || ''}`}
                  >
                    <Crown className="w-2.5 h-2.5 shrink-0 opacity-80" />
                    <span>
                      [{tpl.id}] {tpl.label}
                    </span>
                  </span>
                ))}
              </div>
            );
          }
          return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 shadow-2xs">
              <Wrench className="w-3 h-3 text-blue-600 shrink-0" />
              <span>Technicien (TECH)</span>
            </span>
          );
        },
      },
      {
        key: 'id_zone',
        label: t('utilisateurs.columns.zones'),
        colLetter: 'E',
        icon: MapPin,
        sortable: true,
        render: (user) => {
          if (user.zones && user.zones.includes('ALL')) {
            return (
              <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full bg-purple-50 text-purple-700 border border-purple-200 shadow-2xs">
                <Globe className="w-3 h-3 text-purple-600 shrink-0" />
                <span>ALL (Toutes les zones)</span>
              </span>
            );
          }
          const userZoneList = user.zones && user.zones.length > 0 ? user.zones : [user.id_zone];
          return (
            <div className="flex flex-wrap gap-1 items-center max-w-xs">
              {userZoneList.map((zid, zIdx) => {
                const zObj = zones.find((z) => z.id_zone === zid);
                return (
                  <span
                    key={`zone-tag-${user.id || 'u'}-${zid || 'na'}-${zIdx}`}
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200 shadow-2xs"
                  >
                    <MapPin className="w-2.5 h-2.5 text-emerald-600 shrink-0" />
                    <span className="font-semibold text-slate-800">{zObj ? zObj.libelle : zid}</span>
                    <span className="text-[10px] font-mono text-slate-400">({zid})</span>
                  </span>
                );
              })}
            </div>
          );
        },
      },
      {
        key: 'specialite',
        label: t('utilisateurs.columns.specialite'),
        colLetter: 'F',
        icon: Wrench,
        render: (user) => (
          <div className="flex items-center gap-1.5 text-xs max-w-xs truncate" title={user.specialite}>
            <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <span className="font-medium text-slate-700 truncate">
              {user.specialite || '— Polyvalent / Affectation Générale —'}
            </span>
          </div>
        ),
      },
      {
        key: 'workload',
        label: 'Charge & Parc',
        icon: Wrench,
        sortable: true,
        render: (user) => {
          const w = workloadReport.byPersonId[user.id];
          if (!w || user.isArchived) {
            return <span className="text-[11px] font-mono text-slate-400">— Archivé —</span>;
          }
          if (w.totalActiveWorkload === 0) {
            return (
              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10.5px] font-medium bg-slate-100 text-slate-500 border border-slate-200">
                {user.type === 'TECHNICIEN' ? 'Aucune affectation' : 'Sans ticket actif'}
              </span>
            );
          }
          return (
            <div className="flex flex-wrap items-center gap-1 text-[10px] font-mono">
              {w.assignedMachinesCount > 0 && (
                <span
                  className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold"
                  title={w.assignedMachineCodes.join(', ')}
                >
                  {w.assignedMachinesCount} mach.
                </span>
              )}
              {w.openCorrectiveCount > 0 && (
                <span className="px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 font-bold">
                  {w.openCorrectiveCount} BT
                </span>
              )}
              {w.activePreventiveTasksCount > 0 && (
                <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold">
                  {w.activePreventiveTasksCount} PM
                </span>
              )}
            </div>
          );
        },
      },
      {
        key: 'acces_gmao',
        label: 'Accès GMAO',
        colLetter: 'G',
        icon: Key,
        render: (user) => {
          const acc = getAccountForPersonnel ? getAccountForPersonnel(user.id) : null;
          if (acc && acc.isActive !== false && acc.hasPassword === false) {
            return (
              <button
                type="button"
                onClick={() => isAdmin && openAccessModal(user)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-50 text-rose-800 border border-rose-200 hover:bg-rose-100 transition cursor-pointer shadow-2xs"
                title={`Compte @${acc.username} sans mot de passe — Cliquer pour définir un mot de passe`}
              >
                <AlertTriangle className="w-3 h-3 text-rose-600 shrink-0" />
                <span>Sans mot de passe</span>
              </button>
            );
          }
          if (acc && acc.isActive !== false) {
            return (
              <button
                type="button"
                onClick={() => isAdmin && openAccessModal(user)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 transition cursor-pointer shadow-2xs"
                title={`Compte actif : @${acc.username} (${acc.role}) — Cliquer pour configurer`}
              >
                <Unlock className="w-3 h-3 text-emerald-600 shrink-0" />
                <span className="font-mono">@{acc.username}</span>
              </button>
            );
          }
          if (acc && acc.isActive === false) {
            return (
              <button
                type="button"
                onClick={() => isAdmin && openAccessModal(user)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 transition cursor-pointer shadow-2xs"
                title="Accès désactivé — Cliquer pour réactiver"
              >
                <Lock className="w-3 h-3 text-amber-600 shrink-0" />
                <span>Désactivé</span>
              </button>
            );
          }
          return (
            <button
              type="button"
              onClick={() => isAdmin && openAccessModal(user)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 transition cursor-pointer shadow-2xs"
              title="Activer un compte de connexion pour ce membre"
            >
              <Key className="w-3 h-3 text-slate-400 shrink-0" />
              <span>Activer accès</span>
            </button>
          );
        },
      },
      {
        key: 'actions',
        label: t('utilisateurs.columns.actions'),
        align: 'center',
        headerClassName: 'w-28 text-center font-bold text-slate-400 tracking-widest select-none',
        render: (user) => {
          const w = workloadReport.byPersonId[user.id];
          const hasTechWorkload =
            !user.isArchived &&
            user.type === 'TECHNICIEN' &&
            Boolean(
              w &&
                (w.assignedMachinesCount > 0 ||
                  w.openCorrectiveCount > 0 ||
                  w.activePreventiveTasksCount > 0)
            );
          return (
          <div className="flex items-center justify-center gap-1.5">
            {isAdmin && (
              <button
                type="button"
                onClick={() => openAccessModal(user)}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-200 transition cursor-pointer shadow-2xs"
                title="Configurer l'accès GMAO (Identifiant / Mot de passe / Activation)"
              >
                <Key className="w-3.5 h-3.5" />
              </button>
            )}
            {canManageUsers && hasTechWorkload && onReassignTechnicianWorkload && (
              <button
                type="button"
                onClick={() => openReassignModal(user)}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-indigo-700 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 transition cursor-pointer shadow-2xs"
                title="Réaffecter machines / BT / PM vers un autre technicien"
              >
                <ArrowRightLeft className="w-3.5 h-3.5" />
              </button>
            )}
            {canManageUsers && user.isArchived && (
              <button
                type="button"
                onClick={() => handleReactivateUser(user)}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-emerald-600 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition cursor-pointer shadow-2xs"
                title="Réactiver ce membre archivé"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
            {canManageUsers && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    const userTpls = normalizeTemplateIds(
                      user.templates || user.template_ids || user.template_id
                    );
                    setUserToEdit(user);
                    setForm({
                      type: user.type,
                      nom: user.nom,
                      id_zone: user.id_zone,
                      zones:
                        user.zones && user.zones.length > 0
                          ? user.zones
                          : [user.id_zone || 'ALL'],
                      templates: userTpls.length > 0 ? userTpls : ['RMT'],
                      template_id: userTpls.join(', ') || 'RMT',
                      specialite:
                        user.specialite === 'Spécialité Maintenance' ||
                        user.specialite?.includes('Opérateur') ||
                        user.specialite?.includes('Supervision') ||
                        user.specialite?.includes('Responsabilité')
                          ? ''
                          : user.specialite || '',
                      customCode: user.id,
                    });
                    setShowAddModal(true);
                  }}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 transition cursor-pointer shadow-2xs"
                  title="Modifier l'utilisateur"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                {!user.isArchived && (
                  <button
                    type="button"
                    onClick={() => setUserToDelete(user)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 transition cursor-pointer shadow-2xs"
                    title="Supprimer / Archiver l'utilisateur"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </>
            )}
          </div>
          );
        },
      },
    ],
    [zones, authAccounts, workloadReport, isAdmin, canManageUsers, getAccountForPersonnel, onReassignTechnicianWorkload]
  );

  return (
    <AnimatedPage className="space-y-5">
      {/* 1. Header section with Stats - Wrapped inside elegant card */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 md:p-6 shadow-[0_12px_32px_-6px_rgba(0,0,0,0.12),0_4px_12px_-2px_rgba(0,0,0,0.06)] hover:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.16),0_6px_16px_-3px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-300 ease-out flex items-center justify-between gap-3 sm:gap-4 w-full relative overflow-hidden group/header">
          {/* Subtle Ambient Gradient Background Highlight */}
          <div className="absolute -top-12 -right-12 w-48 h-48 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none group-hover/header:bg-indigo-500/10 transition-colors duration-500" />

          <div className="flex items-center gap-3 min-w-0 relative">
            <PageHeaderIcon icon={Users} colorClass="text-purple-700" />
            <div>
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                {t('utilisateurs.title')}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {t('utilisateurs.subtitle')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <FormulasModalButton
              onClick={() => setShowFormulasModal(true)}
              title={t('utilisateurs.buttons.view_formulas')}
            />

            {canManageUsers && (
              <Action3DButton
                variant="circle"
                color="indigo"
                icon={Users}
                showAddBadge={true}
                onClick={() => {
                  const initNextCode = getNextId('TECHNICIEN');
                  setForm({
                    type: 'TECHNICIEN',
                    nom: '',
                    id_zone: zones[0]?.id_zone || '',
                    zones: ['ALL'],
                    templates: ['RMT'],
                    template_id: 'RMT',
                    specialite: '',
                    customCode: initNextCode,
                  });
                  setOnboardingAccess({
                    enabled: false,
                    username: initNextCode.toLowerCase(),
                    usernameTouched: false,
                    role: 'TECHNICIEN',
                    plainPassword: '',
                    error: '',
                  });
                  setUserToEdit(null);
                  setShowAddModal(true);
                }}
                title={t('utilisateurs.buttons.add_user')}
              />
            )}
          </div>
        </div>

        {/* Unified 4-Tier Light Excel KPI Bar (Interactive Profile Filters) */}
        <GmaoKpiGrid columns={4}>
          {/* Card 1: Total Membres Actifs */}
          <GmaoKpiCard
            title={t('utilisateurs.stats.total_users')}
            value={combinedUsers.filter((u) => !u.isArchived).length}
            unit={t('utilisateurs.stats.unit_members', 'membres')}
            icon={Users}
            color="slate"
            valueColored={false}
            isActive={profileFilter === 'ALL'}
            onClick={() => setProfileFilter('ALL')}
            badgeText={t('utilisateurs.stats.registered_members')}
            footerLabel={t('utilisateurs.stats.footer_sheet', 'Feuille Personnel :')}
            footerValue={
              combinedUsers.some((u) => u.isArchived)
                ? `${combinedUsers.filter((u) => u.isArchived).length} archivé(s)`
                : t('utilisateurs.stats.footer_directory', 'Annuaire global')
            }
          />

          {/* Card 2: Techniciens Actifs */}
          <GmaoKpiCard
            title={t('utilisateurs.stats.technicians')}
            value={combinedUsers.filter((u) => !u.isArchived && u.type === 'TECHNICIEN').length}
            unit={t('utilisateurs.stats.unit_technicians', 'techniciens')}
            icon={Wrench}
            color="blue"
            isActive={profileFilter === 'TECHNICIEN'}
            onClick={() => setProfileFilter(profileFilter === 'TECHNICIEN' ? 'ALL' : 'TECHNICIEN')}
            badgeText={t('utilisateurs.stats.technicians_sub')}
            footerLabel={t('utilisateurs.stats.footer_interventions', 'Interventions :')}
            footerValue={t('utilisateurs.stats.footer_prev_corr', 'Préventif & Correctif')}
          />

          {/* Card 3: Opérateurs Actifs */}
          <GmaoKpiCard
            title={t('utilisateurs.stats.operators')}
            value={combinedUsers.filter((u) => !u.isArchived && u.type === 'OPERATEUR').length}
            unit={t('utilisateurs.stats.unit_operators', 'opérateurs')}
            icon={ClipboardList}
            color="indigo"
            isActive={profileFilter === 'OPERATEUR'}
            onClick={() => setProfileFilter(profileFilter === 'OPERATEUR' ? 'ALL' : 'OPERATEUR')}
            badgeText={t('utilisateurs.stats.operators_sub')}
            footerLabel={t('utilisateurs.stats.footer_field', 'Terrain :')}
            footerValue={t('utilisateurs.stats.footer_di', 'Signalement DI')}
          />

          {/* Card 4: Responsables Actifs */}
          <GmaoKpiCard
            title={t('utilisateurs.stats.responsables')}
            value={combinedUsers.filter((u) => !u.isArchived && u.type === 'RESPONSABLE').length}
            unit={t('utilisateurs.stats.unit_managers', 'cadres')}
            icon={ShieldCheck}
            color="rose"
            isActive={profileFilter === 'RESPONSABLE'}
            onClick={() => setProfileFilter(profileFilter === 'RESPONSABLE' ? 'ALL' : 'RESPONSABLE')}
            badgeText={t('utilisateurs.stats.responsables_sub')}
            footerLabel={t('utilisateurs.stats.footer_governance', 'Gouvernance :')}
            footerValue="RMT • RZN • RPD • RMG"
          />
        </GmaoKpiGrid>

        {/* Filter and search controls - Fully responsive & styled */}
        <div className="relative z-30 bg-white border border-slate-200 rounded-2xl p-4 md:p-5 shadow-[0_12px_32px_-6px_rgba(0,0,0,0.12),0_4px_12px_-2px_rgba(0,0,0,0.06)] hover:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.16),0_6px_16px_-3px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-300 ease-out space-y-4">
          {/* Header Toolbar: Icon + Title + Count Badge + Excel Export + Circular Reset */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-200/80 flex items-center justify-center text-amber-700 shadow-2xs shrink-0">
                <SlidersHorizontal className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="text-xs font-black uppercase tracking-wider text-slate-800">
                    {t('utilisateurs.filters.title')}
                  </span>
                  <span className="bg-amber-50 text-amber-800 px-2.5 py-0.5 rounded-lg text-[11px] font-bold border border-amber-200/70 shadow-2xs font-mono">
                    {filtered.length} / {combinedUsers.length}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 font-medium">
                  {t('utilisateurs.filters.subtitle')}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap shrink-0">
              {/* Access / Security / Lifecycle Quick Filter Pills */}
              <div className="inline-flex flex-wrap items-center gap-1 p-1 rounded-xl bg-slate-100 border border-slate-200/70">
                {[
                  { id: 'ALL' as const, label: 'Tous', count: combinedUsers.length },
                  { id: 'ACTIVE' as const, label: 'Actifs', count: workloadReport.summary.totalActive },
                  ...(overloadedCount > 0
                    ? [{ id: 'OVERLOADED' as const, label: 'Surchargés', count: overloadedCount }]
                    : []),
                  ...(noAccountCount > 0
                    ? [{ id: 'NO_ACCOUNT' as const, label: 'Sans accès', count: noAccountCount }]
                    : []),
                  ...(workloadReport.summary.missingPasswordCount > 0
                    ? [
                        {
                          id: 'NO_PASSWORD' as const,
                          label: 'Sans MDP',
                          count: workloadReport.summary.missingPasswordCount,
                        },
                      ]
                    : []),
                  { id: 'DISABLED' as const, label: 'Désactivés', count: workloadReport.summary.disabledAccessCount },
                  { id: 'ARCHIVED' as const, label: 'Archivés', count: workloadReport.summary.archivedCount },
                ].map((pill) => (
                  <button
                    key={pill.id}
                    type="button"
                    onClick={() => setAccessFilter(pill.id)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                      accessFilter === pill.id
                        ? pill.id === 'NO_PASSWORD' || pill.id === 'OVERLOADED'
                          ? 'bg-rose-600 text-white shadow-2xs'
                          : 'bg-white text-slate-900 shadow-2xs'
                        : pill.id === 'NO_PASSWORD' || pill.id === 'OVERLOADED'
                          ? 'text-rose-700 hover:bg-rose-50'
                          : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <span>{pill.label}</span>
                    <span
                      className={`text-[10px] font-mono px-1 rounded ${
                        accessFilter === pill.id && (pill.id === 'NO_PASSWORD' || pill.id === 'OVERLOADED')
                          ? 'bg-rose-700 text-white'
                          : 'bg-slate-200/70 text-slate-700'
                      }`}
                    >
                      {pill.count}
                    </span>
                  </button>
                ))}
              </div>

              {/* Export Excel Button (Type B — Consultation externe) */}
              <button
                onClick={handleExportExcel}
                className="h-8 px-3 rounded-xl border border-emerald-200/80 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs active:scale-95"
                title={`${t('utilisateurs.buttons.export_excel')} — Type B : Export externe (non réimportable ; pour Round-Trip utilisez Paramètres ➔ REF_PERSONNEL)`}
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                <span>{t('utilisateurs.buttons.export_excel')} (Type B)</span>
              </button>

              {/* Circular Reset Button */}
              {(localSearch || profileFilter !== 'ALL' || zoneFilter !== 'ALL' || accessFilter !== 'ALL' || sortField !== 'nom' || sortOrder !== 'asc') && (
                <button
                  onClick={() => {
                    setLocalSearch('');
                    setProfileFilter('ALL');
                    setZoneFilter('ALL');
                    setAccessFilter('ALL');
                    setSortField('nom');
                    setSortOrder('asc');
                  }}
                  title={t('utilisateurs.filters.reset_tooltip')}
                  className="w-8 h-8 rounded-full border border-rose-200/80 bg-rose-50 hover:bg-rose-100 text-rose-700 transition flex items-center justify-center cursor-pointer shadow-2xs active:scale-95 animate-in fade-in shrink-0"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
            {/* Search */}
            <div className="relative w-full">
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-800">
                  {t('utilisateurs.filters.search_label')}
                </label>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wide bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs">
                  Col. B+C+E
                </span>
              </div>
              <div className="relative flex items-center">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-md bg-amber-100 border border-amber-300/80 flex items-center justify-center text-amber-700 shadow-2xs pointer-events-none z-10">
                  <Search className="w-3 h-3" />
                </span>
                <input
                  type="text"
                  placeholder={t('utilisateurs.filters.search_placeholder')}
                  value={localSearch}
                  onChange={(e) => setLocalSearch(e.target.value)}
                  className="w-full h-10 pl-9 pr-8 text-xs font-medium text-slate-800 placeholder-slate-400 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-amber-500 focus:bg-white focus:ring-2 focus:ring-amber-500/20 transition"
                />
                {localSearch && (
                  <button
                    onClick={() => setLocalSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer z-10"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Profile filter select */}
            <div className="w-full">
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-800">
                  {t('utilisateurs.filters.role_label')}
                </label>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wide bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs">
                  Col. D
                </span>
              </div>
              <CustomSelect
                prefixIcon={
                  <span className="w-5 h-5 rounded-md bg-amber-100 border border-amber-300/80 flex items-center justify-center text-amber-700 shadow-2xs shrink-0">
                    <User className="w-3 h-3" />
                  </span>
                }
                options={[
                  { value: 'ALL', label: t('utilisateurs.filters.all_profiles') },
                  { value: 'TECHNICIEN', label: `[D] ${t('utilisateurs.filters.technicians')}` },
                  { value: 'OPERATEUR', label: `[D] ${t('utilisateurs.filters.operators')}` },
                  { value: 'RESPONSABLE', label: `[D] ${t('utilisateurs.filters.responsables')}` },
                  { value: 'RMT', label: '• [RMT] Responsable Maintenance' },
                  { value: 'RZN', label: '• [RZN] Responsable Zone' },
                  { value: 'RPD', label: '• [RPD] Responsable Production' },
                  { value: 'RMG', label: '• [RMG] Responsable Magasin' },
                ]}
                value={profileFilter}
                onChange={setProfileFilter}
              />
            </div>

            {/* Zone Filter */}
            <div className="w-full">
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-800">
                  {t('utilisateurs.filters.zone_label')}
                </label>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wide bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs">
                  Col. E
                </span>
              </div>
              <CustomSelect
                prefixIcon={
                  <span className="w-5 h-5 rounded-md bg-amber-100 border border-amber-300/80 flex items-center justify-center text-amber-700 shadow-2xs shrink-0">
                    <MapPin className="w-3 h-3" />
                  </span>
                }
                options={[
                  { value: 'ALL', label: t('utilisateurs.filters.all_zones') },
                  ...zones.map((z, zIdx) => ({
                    value: z.id_zone || `zone-${zIdx}`,
                    label: `[E] ${z.libelle || z.id_zone || ''} (${z.id_zone || zIdx})`,
                  })),
                ]}
                value={zoneFilter}
                onChange={setZoneFilter}
              />
            </div>

            {/* Sort Dropdown (Tri) */}
            <div className="w-full relative" ref={sortMenuRef}>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-800">
                  {t('utilisateurs.filters.sort_label')}
                </label>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wide bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs">
                  {t('utilisateurs.filters.order_asc')}
                </span>
              </div>
              <button
                onClick={() => setShowSortMenu(!showSortMenu)}
                className={`w-full h-10 px-3 rounded-xl border text-xs font-semibold transition flex items-center justify-between cursor-pointer ${
                  showSortMenu || sortField !== 'nom' || sortOrder !== 'asc'
                    ? 'bg-amber-50 text-amber-800 border-amber-300 ring-1 ring-amber-200 shadow-2xs'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-md bg-amber-100 border border-amber-300/80 flex items-center justify-center text-amber-700 shadow-2xs shrink-0">
                    <ArrowUpDown className="w-3 h-3" />
                  </span>
                  <span>
                    {t('utilisateurs.filters.sort_label')} : <b className="font-mono text-slate-900">{sortField.toUpperCase()}</b> (
                    {sortOrder === 'asc' ? t('utilisateurs.filters.order_asc') : t('utilisateurs.filters.order_desc')})
                  </span>
                </div>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-slate-400 transition-transform ${showSortMenu ? 'rotate-180' : ''}`}
                />
              </button>

              {showSortMenu && (
                <div className="absolute left-0 right-0 mt-2 bg-white rounded-2xl border border-slate-200 shadow-xl z-50 p-3 space-y-2 animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    <span className="flex items-center gap-1.5 text-slate-700 font-semibold">
                      <SlidersHorizontal className="w-3.5 h-3.5 text-amber-700" />
                      {t('utilisateurs.filters.sort_by')}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 gap-1 text-xs">
                    <button
                      onClick={() => {
                        if (sortField === 'id') {
                          setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                        } else {
                          setSortField('id');
                          setSortOrder('asc');
                        }
                      }}
                      className={`flex items-center justify-between px-3 py-2 rounded-lg font-medium transition cursor-pointer ${
                        sortField === 'id'
                          ? 'bg-amber-50 text-amber-950 border border-amber-300 font-bold'
                          : 'hover:bg-slate-50 text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <span>{t('utilisateurs.filters.id_col')}</span>
                      {sortField === 'id' &&
                        (sortOrder === 'asc' ? (
                          <ArrowUp className="w-3 h-3 text-amber-700 shrink-0" />
                        ) : (
                          <ArrowDown className="w-3 h-3 text-amber-700 shrink-0" />
                        ))}
                    </button>

                    <button
                      onClick={() => {
                        if (sortField === 'nom') {
                          setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                        } else {
                          setSortField('nom');
                          setSortOrder('asc');
                        }
                      }}
                      className={`flex items-center justify-between px-3 py-2 rounded-lg font-medium transition cursor-pointer ${
                        sortField === 'nom'
                          ? 'bg-amber-50 text-amber-950 border border-amber-300 font-bold'
                          : 'hover:bg-slate-50 text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <span>{t('utilisateurs.filters.name_col')}</span>
                      {sortField === 'nom' &&
                        (sortOrder === 'asc' ? (
                          <ArrowUp className="w-3 h-3 text-amber-700 shrink-0" />
                        ) : (
                          <ArrowDown className="w-3 h-3 text-amber-700 shrink-0" />
                        ))}
                    </button>

                    <button
                      onClick={() => {
                        if (sortField === 'type') {
                          setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                        } else {
                          setSortField('type');
                          setSortOrder('asc');
                        }
                      }}
                      className={`flex items-center justify-between px-3 py-2 rounded-lg font-medium transition cursor-pointer ${
                        sortField === 'type'
                          ? 'bg-amber-50 text-amber-950 border border-amber-300 font-bold'
                          : 'hover:bg-slate-50 text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <span>{t('utilisateurs.filters.profile_col')}</span>
                      {sortField === 'type' &&
                        (sortOrder === 'asc' ? (
                          <ArrowUp className="w-3 h-3 text-amber-700 shrink-0" />
                        ) : (
                          <ArrowDown className="w-3 h-3 text-amber-700 shrink-0" />
                        ))}
                    </button>

                    <button
                      onClick={() => {
                        if (sortField === 'id_zone') {
                          setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                        } else {
                          setSortField('id_zone');
                          setSortOrder('asc');
                        }
                      }}
                      className={`flex items-center justify-between px-3 py-2 rounded-lg font-medium transition cursor-pointer ${
                        sortField === 'id_zone'
                          ? 'bg-amber-50 text-amber-950 border border-amber-300 font-bold'
                          : 'hover:bg-slate-50 text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <span>{t('utilisateurs.filters.zone_col')}</span>
                      {sortField === 'id_zone' &&
                        (sortOrder === 'asc' ? (
                          <ArrowUp className="w-3 h-3 text-amber-700 shrink-0" />
                        ) : (
                          <ArrowDown className="w-3 h-3 text-amber-700 shrink-0" />
                        ))}
                    </button>

                    <button
                      onClick={() => {
                        if (sortField === 'workload') {
                          setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                        } else {
                          setSortField('workload');
                          setSortOrder('desc');
                        }
                      }}
                      className={`flex items-center justify-between px-3 py-2 rounded-lg font-medium transition cursor-pointer ${
                        sortField === 'workload'
                          ? 'bg-amber-50 text-amber-950 border border-amber-300 font-bold'
                          : 'hover:bg-slate-50 text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <span>Charge &amp; Parc (Mach. / BT / PM)</span>
                      {sortField === 'workload' &&
                        (sortOrder === 'asc' ? (
                          <ArrowUp className="w-3 h-3 text-amber-700 shrink-0" />
                        ) : (
                          <ArrowDown className="w-3 h-3 text-amber-700 shrink-0" />
                        ))}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Active Filter Chips */}
          {(localSearch || profileFilter !== 'ALL' || zoneFilter !== 'ALL' || accessFilter !== 'ALL') && (
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 text-xs">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{t('utilisateurs.filters.active_filters')}</span>
              {localSearch && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-800 text-xs font-semibold">
                  <Search className="w-3 h-3 text-indigo-600" />
                  {t('utilisateurs.filters.filter_search')}: &quot;{localSearch}&quot;
                  <button
                    onClick={() => setLocalSearch('')}
                    className="hover:bg-indigo-200/60 p-0.5 rounded-full transition cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {profileFilter !== 'ALL' && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-800 text-xs font-semibold">
                  <User className="w-3 h-3 text-indigo-600" />
                  {t('utilisateurs.filters.filter_profile')}: {profileFilter}
                  <button
                    onClick={() => setProfileFilter('ALL')}
                    className="hover:bg-indigo-200/60 p-0.5 rounded-full transition cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {zoneFilter !== 'ALL' && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-800 text-xs font-semibold">
                  <MapPin className="w-3 h-3 text-indigo-600" />
                  {t('utilisateurs.filters.filter_zone')}: {zoneFilter}
                  <button
                    onClick={() => setZoneFilter('ALL')}
                    className="hover:bg-indigo-200/60 p-0.5 rounded-full transition cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {accessFilter !== 'ALL' && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold">
                  <Key className="w-3 h-3 text-rose-600" />
                  Statut/Accès: {accessFilter}
                  <button
                    onClick={() => setAccessFilter('ALL')}
                    className="hover:bg-rose-200/60 p-0.5 rounded-full transition cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
            </div>
          )}
        </div>

        {/* Unified Industrial Data Grid */}
        <GmaoIndustrialDataGrid
          title={t('utilisateurs.table.title')}
          icon={<Users className="w-4 h-4 text-indigo-600" />}
          excelMapping="id_user (B) | nom (C) | type_profil (D) | id_zone (E) | specialite (F)"
          bannerColor="indigo"
          columns={userColumns}
          data={displayedData}
          sortField={sortField}
          sortOrder={sortOrder}
          onSort={handleSort}
          renderSortIcon={renderSortIcon}
          startIndex={startIndex}
          showRowNumber={true}
          emptyIcon={<Users className="w-8 h-8 text-slate-300" />}
          emptyMessage={t('utilisateurs.table.empty_msg')}
          pagination={{
            currentPage,
            setCurrentPage,
            pageSize,
            setPageSize,
            totalItems,
            pageSizeOptions: [20, 50, 100, 200, 0],
            color: 'indigo',
            itemLabel: t('utilisateurs.table.item_label'),
          }}
        />

        {/* Manual Add / Edit Modal */}
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              <div className="bg-white border-b border-slate-200 px-5 py-4 flex items-center justify-between shrink-0">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Users className="w-4 h-4 text-indigo-600" />
                  {userToEdit
                    ? t('utilisateurs.modal.edit_title')
                    : t('utilisateurs.modal.add_title')}
                </h3>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition cursor-pointer"
                  aria-label="Fermer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSave} className="p-5 space-y-4 overflow-y-auto">
                {/* Mode Select (Enabled ONLY for creation, disabled for editing) */}
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    {t('utilisateurs.modal.profile_type')}
                  </label>
                  <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-200/60 rounded-xl border border-slate-200/80">
                    {[
                      { key: 'TECHNICIEN', label: t('utilisateurs.modal.technician_tab'), sub: '(TECH)' },
                      { key: 'OPERATEUR', label: t('utilisateurs.modal.operator_tab'), sub: '(OP)' },
                      { key: 'RESPONSABLE', label: t('utilisateurs.modal.responsable_tab'), sub: '(RESP)' },
                    ].map((item, itmIdx) => (
                      <button
                        key={`profile-tab-${item.key || itmIdx}`}
                        type="button"
                        disabled={!!userToEdit}
                        onClick={() => {
                          const nextCode = getNextId(item.key);
                          setForm({
                            ...form,
                            type: item.key,
                            customCode: nextCode,
                          });
                          setOnboardingAccess((prev) => ({
                            ...prev,
                            username: prev.usernameTouched ? prev.username : nextCode.toLowerCase(),
                            role:
                              item.key === 'TECHNICIEN'
                                ? 'TECHNICIEN'
                                : item.key === 'OPERATEUR'
                                  ? 'OPERATEUR'
                                  : (form.templates || []).includes('RMG') &&
                                      !(form.templates || []).includes('RMT')
                                    ? 'RESPONSABLE_MAGASIN'
                                    : 'RESPONSABLE_MAINTENANCE',
                            error: '',
                          }));
                        }}
                        className={`py-2 px-2 text-center text-xs font-bold rounded-lg transition flex items-center justify-center gap-1 cursor-pointer ${
                          form.type === item.key
                            ? 'bg-white text-slate-900 shadow-[0_12px_32px_-6px_rgba(0,0,0,0.12),0_4px_12px_-2px_rgba(0,0,0,0.06)] hover:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.16),0_6px_16px_-3px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-300 ease-out border border-slate-200/60'
                            : 'text-slate-600 hover:text-slate-900'
                        } disabled:opacity-50`}
                      >
                        <span className="truncate">{item.label}</span>
                        <span className="text-[10px] font-mono text-slate-400 hidden sm:inline">{item.sub}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* ID Field with UserCodePicker when adding, or readonly box when editing */}
                {userToEdit ? (
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                      {t('utilisateurs.modal.unique_id')}
                    </label>
                    <div className="w-full h-10 px-3 bg-slate-100 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-700 flex items-center shadow-2xs">
                      {userToEdit.id}
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">
                      {t('utilisateurs.modal.id_readonly_text')}
                    </p>
                  </div>
                ) : (
                  <UserCodePicker
                    prefix={modalPrefix}
                    currentCode={form.customCode || modalAutoNextId}
                    onChangeCode={(code) => setForm((prev) => ({ ...prev, customCode: code }))}
                    autoGeneratedCode={modalAutoNextId}
                    takenNumbers={modalTakenNumbers}
                    label={t('utilisateurs.modal.code_user')}
                    helperText={`${t('utilisateurs.modal.auto_id_helper')} (${form.type})`}
                  />
                )}

                {/* Template Selection for RESPONSABLE (Multi-Select) */}
                {form.type === 'RESPONSABLE' && (
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        {t('utilisateurs.modal.templates_label')}
                      </label>
                      <span className="text-[10px] text-indigo-600 font-bold bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">
                        {(form.templates || []).length}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {RESPONSABLE_TEMPLATES.map((tpl, tplIdx) => {
                        const isSelected = (form.templates || []).includes(tpl.id);
                        return (
                          <button
                            key={`resp-template-opt-${tpl.id || tplIdx}`}
                            type="button"
                            onClick={() => {
                              const current = form.templates || [];
                              let next;
                              if (isSelected) {
                                if (current.length > 1) {
                                  next = current.filter((id) => id !== tpl.id);
                                } else {
                                  next = current; // Keep at least one selected
                                }
                              } else {
                                next = [...current, tpl.id];
                              }
                              setForm({
                                ...form,
                                templates: next,
                                template_id: next.join(', '),
                              });
                            }}
                            className={`p-2.5 rounded-xl border text-left transition flex flex-col justify-between cursor-pointer ${
                              isSelected
                                ? 'bg-indigo-50/70 border-indigo-500 ring-2 ring-indigo-500/20 shadow-[0_12px_32px_-6px_rgba(0,0,0,0.12),0_4px_12px_-2px_rgba(0,0,0,0.06)] hover:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.16),0_6px_16px_-3px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-300 ease-out'
                                : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${tpl.badgeClass}`}
                              >
                                {tpl.id}
                              </span>
                              <div
                                className={`w-4 h-4 rounded-md flex items-center justify-center border transition ${
                                  isSelected
                                    ? 'bg-indigo-600 border-indigo-600 text-white'
                                    : 'border-slate-300 bg-white'
                                }`}
                              >
                                {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                              </div>
                            </div>
                            <span className="text-xs font-bold text-slate-900 line-clamp-1">
                              {tpl.label}
                            </span>
                            <span className="text-[10px] text-slate-500 line-clamp-1 mt-0.5">
                              {tpl.description}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">
                      {t('utilisateurs.modal.resp_templates_note')}
                    </p>
                  </div>
                )}

                {/* Name */}
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    {t('utilisateurs.modal.full_name')}
                  </label>
                  <input
                    type="text"
                    required
                    value={form.nom}
                    onChange={(e) => setForm({ ...form, nom: e.target.value })}
                    placeholder={t('utilisateurs.modal.full_name_placeholder')}
                    className="w-full h-10 px-3 text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:bg-white transition"
                  />
                </div>

                {/* Zones Selection */}
                {form.type === 'RESPONSABLE' ? (
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                          {t('utilisateurs.modal.zones_assignment')}
                        </label>
                        {handleOpenZoneModal && (
                          <button
                            type="button"
                            onClick={handleOpenZoneModal}
                            className="text-[10px] text-indigo-600 hover:text-indigo-800 hover:underline font-bold flex items-center gap-0.5 cursor-pointer"
                          >
                            <Plus className="w-3 h-3" />
                            <span>{t('utilisateurs.modal.new_zone')}</span>
                          </button>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const currentZones = form.zones || [];
                          if (currentZones.includes('ALL')) {
                            setForm({ ...form, zones: [zones[0]?.id_zone || ''] });
                          } else {
                            setForm({ ...form, zones: ['ALL'] });
                          }
                        }}
                        className={`text-[10px] font-bold px-2 py-0.5 rounded border transition cursor-pointer ${
                          (form.zones || []).includes('ALL')
                            ? 'bg-purple-600 border-purple-600 text-white'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        {t('utilisateurs.modal.all_zones_btn')}
                      </button>
                    </div>

                    {!(form.zones || []).includes('ALL') && (
                      <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto p-2 bg-slate-50 border border-slate-200 rounded-xl">
                        {zones.map((z, zIdx) => {
                          const isChecked = (form.zones || []).includes(z.id_zone);
                          return (
                            <label
                              key={`zone-chk-${z.id_zone || zIdx}`}
                              className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer p-1.5 rounded-lg hover:bg-white transition"
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  const currentZones = (form.zones || []).filter((x) => x !== 'ALL');
                                  if (e.target.checked) {
                                    setForm({ ...form, zones: [...currentZones, z.id_zone] });
                                  } else {
                                    const next = currentZones.filter((x) => x !== z.id_zone);
                                    setForm({ ...form, zones: next.length > 0 ? next : ['ALL'] });
                                  }
                                }}
                                className="w-3.5 h-3.5 text-indigo-600 rounded border-slate-300"
                              />
                              <span className="truncate">{z.libelle}</span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5 flex items-center justify-between">
                      <span>{t('utilisateurs.modal.single_zone_assignment')}</span>
                      {handleOpenZoneModal && (
                        <button
                          type="button"
                          onClick={() => {
                            setShowAddModal(false);
                            handleOpenZoneModal();
                          }}
                          className="text-[10px] text-indigo-600 hover:underline font-bold inline-flex items-center gap-0.5 cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                          <span>{t('utilisateurs.modal.new_zone')}</span>
                        </button>
                      )}
                    </label>
                    <select
                      value={form.id_zone}
                      onChange={(e) => setForm({ ...form, id_zone: e.target.value })}
                      className="w-full h-10 px-3 text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:bg-white transition"
                    >
                      {zones.map((z, zIdx) => (
                        <option key={`zone-opt-${z.id_zone || zIdx}`} value={z.id_zone}>
                          {z.libelle} ({z.id_zone})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Specialty (Shown ONLY for Technicians) */}
                {form.type === 'TECHNICIEN' && (
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                      {t('utilisateurs.modal.specialty')}
                    </label>
                    <input
                      type="text"
                      value={form.specialite}
                      onChange={(e) => setForm({ ...form, specialite: e.target.value })}
                      placeholder={t('utilisateurs.modal.specialty_placeholder')}
                      className="w-full h-10 px-3 text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:bg-white transition"
                    />
                  </div>
                )}

                {/* 1-Step GMAO Login Onboarding (Admin only, New User creation) */}
                {!userToEdit && isAdmin && upsertPersonnelAuthAccount && (
                  <div className="p-3.5 rounded-xl bg-emerald-50/60 border border-emerald-200 space-y-3">
                    <label className="flex items-center justify-between gap-3 cursor-pointer">
                      <div>
                        <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                          <Key className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                          <span>Activer l&apos;accès GMAO immédiatement (1 étape)</span>
                        </div>
                        <div className="text-[10.5px] text-slate-500 mt-0.5">
                          Crée le compte de connexion (identifiant + mot de passe) en même temps que la fiche.
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={onboardingAccess.enabled}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          const defaultCode = (form.customCode || modalAutoNextId || '').toLowerCase();
                          setOnboardingAccess((prev) => ({
                            ...prev,
                            enabled: checked,
                            username: prev.usernameTouched ? prev.username : defaultCode,
                            error: '',
                          }));
                        }}
                        className="w-4 h-4 text-emerald-600 rounded border-slate-300 shrink-0"
                      />
                    </label>

                    {onboardingAccess.enabled && (
                      <div className="space-y-3 pt-2 border-t border-emerald-200/70">
                        {onboardingAccess.error && (
                          <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-[11px] font-semibold flex items-center gap-1.5">
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                            <span>{onboardingAccess.error}</span>
                          </div>
                        )}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          <div>
                            <label className="block text-[10.5px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                              Identifiant de connexion
                            </label>
                            <input
                              type="text"
                              value={onboardingAccess.username}
                              onChange={(e) =>
                                setOnboardingAccess((prev) => ({
                                  ...prev,
                                  username: e.target.value,
                                  usernameTouched: true,
                                  error: '',
                                }))
                              }
                              placeholder={(form.customCode || modalAutoNextId || 'tech-01').toLowerCase()}
                              className="w-full h-9 px-2.5 text-xs font-mono bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
                            />
                          </div>
                          <div>
                            <label className="block text-[10.5px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                              Rôle applicatif
                            </label>
                            <select
                              value={onboardingAccess.role}
                              onChange={(e) =>
                                setOnboardingAccess((prev) => ({
                                  ...prev,
                                  role: e.target.value,
                                  error: '',
                                }))
                              }
                              className="w-full h-9 px-2.5 text-xs font-semibold bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
                            >
                              <option value="TECHNICIEN">Technicien</option>
                              <option value="OPERATEUR">Opérateur Ligne</option>
                              <option value="RESPONSABLE_MAGASIN">Magasin / RMG</option>
                              <option value="RESPONSABLE_MAINTENANCE">Responsable Maint.</option>
                              <option value="VIEWER">Observateur</option>
                              <option value="ADMIN">Administrateur</option>
                            </select>
                          </div>
                        </div>
                        <div>
                          <label className="block text-[10.5px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                            Mot de passe initial
                          </label>
                          <input
                            type="password"
                            value={onboardingAccess.plainPassword}
                            onChange={(e) =>
                              setOnboardingAccess((prev) => ({
                                ...prev,
                                plainPassword: e.target.value,
                                error: '',
                              }))
                            }
                            placeholder="Min. 8 car. (lettre + chiffre, distinct de la licence)"
                            className="w-full h-9 px-2.5 text-xs font-mono bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
                  >
                    {t('utilisateurs.buttons.cancel')}
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition cursor-pointer shadow-[0_12px_32px_-6px_rgba(0,0,0,0.12),0_4px_12px_-2px_rgba(0,0,0,0.06)] hover:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.16),0_6px_16px_-3px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-300 ease-out"
                  >
                    {userToEdit ? t('utilisateurs.buttons.save') : t('utilisateurs.buttons.create')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        <UtilisateursModals
          userToDelete={userToDelete}
          userToDeleteWorkload={
            userToDelete ? workloadReport.byPersonId[userToDelete.id] || null : null
          }
          setUserToDelete={setUserToDelete}
          confirmDelete={confirmDelete}
          onOpenReassign={onReassignTechnicianWorkload ? openReassignModal : undefined}
          userToReassign={userToReassign}
          userToReassignWorkload={
            userToReassign ? workloadReport.byPersonId[userToReassign.id] || null : null
          }
          setUserToReassign={setUserToReassign}
          reassignTargetId={reassignTargetId}
          setReassignTargetId={setReassignTargetId}
          reassignScopes={reassignScopes}
          setReassignScopes={setReassignScopes}
          activeTechniciansForReassign={activeTechniciansForReassign}
          handleSubmitReassign={handleSubmitReassign}
          userForAccessModal={userForAccessModal}
          setUserForAccessModal={setUserForAccessModal}
          accessForm={accessForm}
          setAccessForm={setAccessForm}
          accessError={accessError}
          accessSavedMsg={accessSavedMsg}
          handleSaveAccessModal={handleSaveAccessModal}
          showFormulasModal={showFormulasModal}
          setShowFormulasModal={setShowFormulasModal}
        />
    </AnimatedPage>
  );
}
