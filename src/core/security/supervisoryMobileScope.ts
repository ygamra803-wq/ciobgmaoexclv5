import { ROLES, normalizeRole } from './Roles';

export type MobileSupervisoryPersona =
  | 'TECHNICIEN'
  | 'SUPERVISEUR_MAINTENANCE'
  | 'RESPONSABLE_MAGASIN'
  | 'OPERATEUR_TERRAIN'
  | 'OBSERVATEUR';

export interface MobileSupervisoryProfile {
  persona: MobileSupervisoryPersona;
  normalizedRole: string;
  roleBadge: string;
  roleLabelFr: string;
  titleFr: string;
  subtitleFr: string;
  bannerAr: string;
  canValidateCorrective: boolean;
  canValidatePreventive: boolean;
  canValidateSortieDemand: boolean;
  canReportBreakdown: boolean;
  canForceDesktop: boolean;
}

export interface PendingMakerCheckerCounts {
  prevCount: number;
  corrCount: number;
  sortieCount: number;
  total: number;
}

/**
 * Resolves the exact mobile supervisory profile and RBAC boundaries for non-technician roles.
 * Ensures Storekeepers (RESPONSABLE_MAGASIN) only see & validate storehouse SortieDemands,
 * Maintenance Supervisors (RESPONSABLE_MAINTENANCE / ADMIN) validate all 3 queues on the go,
 * and Viewers/Operators have read-only or breakdown-reporting access without validation buttons.
 */
export function resolveMobileSupervisoryProfile(user: any): MobileSupervisoryProfile {
  const norm = normalizeRole(user?.role || '');

  if (norm === ROLES.TECHNICIEN) {
    return {
      persona: 'TECHNICIEN',
      normalizedRole: norm,
      roleBadge: 'TECH',
      roleLabelFr: 'Technicien Maintenance',
      titleFr: 'Poste Terrain Technicien',
      subtitleFr: 'Exécution préventive, interventions correctives et scan QR machine.',
      bannerAr: 'واجهة الفني الميدانية لتنفيذ المهام الوقائية والتصحيحية.',
      canValidateCorrective: false,
      canValidatePreventive: false,
      canValidateSortieDemand: false,
      canReportBreakdown: true,
      canForceDesktop: false,
    };
  }

  if (norm === ROLES.RESPONSABLE_MAGASIN) {
    return {
      persona: 'RESPONSABLE_MAGASIN',
      normalizedRole: norm,
      roleBadge: 'MAGASINIER',
      roleLabelFr: 'Responsable Magasin PDR',
      titleFr: 'Guichet Mobile Magasin & Sorties PDR',
      subtitleFr:
        'Validez les demandes de sortie PDR des techniciens au comptoir, contrôlez le stock réservé et les alertes de rupture.',
      bannerAr:
        'واجهة أمين المخزن الميدانية — اعتماد طلبات صرف القطع (Bons PDR) ومراقبة المخزون المحجوز والحرج مباشرة من الهاتف.',
      canValidateCorrective: false,
      canValidatePreventive: false,
      canValidateSortieDemand: true,
      canReportBreakdown: false,
      canForceDesktop: true,
    };
  }

  if (norm === ROLES.ADMIN || norm === ROLES.RESPONSABLE_MAINTENANCE) {
    const isAdmin = norm === ROLES.ADMIN;
    return {
      persona: 'SUPERVISEUR_MAINTENANCE',
      normalizedRole: norm,
      roleBadge: isAdmin ? 'ADMIN' : 'RESP. MAINT',
      roleLabelFr: isAdmin ? 'Administrateur Système' : 'Responsable Maintenance',
      titleFr: 'Cockpit Mobile de Supervision & Validation',
      subtitleFr:
        'Approuvez les certificats terrain (BT, Préventif, Bons PDR) en atelier, scannez un équipement QR ou basculez vers le Bureau complet.',
      bannerAr:
        'مقصورة الإشراف الميداني — اعتمد شهادات الفنيين (التصحيحي، الوقائي، وطلبات الصرف) مباشرة أثناء جولتك في الورشة أو انتقل لوضع سطح المكتب.',
      canValidateCorrective: true,
      canValidatePreventive: true,
      canValidateSortieDemand: true,
      canReportBreakdown: true,
      canForceDesktop: true,
    };
  }

  if (norm === ROLES.OPERATEUR) {
    return {
      persona: 'OPERATEUR_TERRAIN',
      normalizedRole: norm,
      roleBadge: 'OPÉRATEUR',
      roleLabelFr: 'Opérateur de Production',
      titleFr: 'Poste Mobile Opérateur (Signalement & QR)',
      subtitleFr:
        'Scannez le code QR d’une machine ou déclarez rapidement une demande d’intervention (DI) en cas d’anomalie.',
      bannerAr: 'واجهة المشغّل الميدانية — مسح QR للآلة أو الإبلاغ الفوري عن عطل (طلب تدخل DI).',
      canValidateCorrective: false,
      canValidatePreventive: false,
      canValidateSortieDemand: false,
      canReportBreakdown: true,
      canForceDesktop: true,
    };
  }

  return {
    persona: 'OBSERVATEUR',
    normalizedRole: norm,
    roleBadge: 'OBSERVATEUR',
    roleLabelFr: 'Observateur / Consultation',
    titleFr: 'Consultation Mobile Terrain (Lecture Seule)',
    subtitleFr:
      'Consultez l’état du parc machines par scan QR ou basculez en mode Bureau pour consulter les rapports.',
    bannerAr: 'وضع المراقب (قراءة فقط) — مسح QR لمعاينة حالة الآلات أو الانتقال لوضع سطح المكتب للتقارير.',
    canValidateCorrective: false,
    canValidatePreventive: false,
    canValidateSortieDemand: false,
    canReportBreakdown: false,
    canForceDesktop: true,
  };
}

/**
 * Computes the role-scoped Maker-Checker pending counts visible to a given mobile supervisory profile.
 * Ensures a Storekeeper (RESPONSABLE_MAGASIN) only sees pending SortieDemands (not technical BTs/PMs),
 * and Observers/Operators see 0 validation tasks.
 */
export function getRoleScopedPendingCounts(
  profile: MobileSupervisoryProfile,
  rawCounts: PendingMakerCheckerCounts
): PendingMakerCheckerCounts {
  const prevCount = profile.canValidatePreventive ? rawCounts.prevCount : 0;
  const corrCount = profile.canValidateCorrective ? rawCounts.corrCount : 0;
  const sortieCount = profile.canValidateSortieDemand ? rawCounts.sortieCount : 0;
  return {
    prevCount,
    corrCount,
    sortieCount,
    total: prevCount + corrCount + sortieCount,
  };
}
