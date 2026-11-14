import React from 'react';
import {
  Activity,
  RotateCcw,
  Sparkles,
  FolderSync,
  ShieldAlert,
  FileSpreadsheet,
  Shield,
  Lock,
  Gauge,
  Palette,
  Coins,
} from 'lucide-react';
import { useTranslation } from '../../../../i18n/I18nContext';

export type SettingsTone = 'default' | 'warning' | 'danger';

export interface SettingsSectionCardProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  tone?: SettingsTone;
  headerRight?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  testId?: string;
}

const TONE_STYLES: Record<
  SettingsTone,
  {
    card: string;
    header: string;
    iconColor: string;
    title: string;
    description: string;
    footer: string;
  }
> = {
  default: {
    card: 'bg-white border-slate-200/90 shadow-[0_1px_3px_rgba(15,23,42,0.05),0_6px_16px_-6px_rgba(15,23,42,0.06)] hover:shadow-[0_2px_6px_rgba(15,23,42,0.06),0_10px_22px_-8px_rgba(15,23,42,0.08)]',
    header: 'border-slate-100 bg-white',
    iconColor: 'text-sky-700',
    title: 'text-slate-900',
    description: 'text-slate-500',
    footer: 'border-slate-100 bg-slate-50/60',
  },
  warning: {
    card: 'bg-white border-amber-200/90 shadow-[0_8px_24px_-8px_rgba(245,158,11,0.14),0_2px_6px_-1px_rgba(15,23,42,0.04)]',
    header: 'border-amber-100 bg-amber-50/35',
    iconColor: 'text-amber-600',
    title: 'text-slate-900',
    description: 'text-amber-900/75',
    footer: 'border-amber-100 bg-amber-50/30',
  },
  danger: {
    card: 'bg-white border-rose-200/90 shadow-[0_8px_24px_-8px_rgba(244,63,94,0.14),0_2px_6px_-1px_rgba(15,23,42,0.04)]',
    header: 'border-rose-100 bg-rose-50/35',
    iconColor: 'text-rose-600',
    title: 'text-rose-950',
    description: 'text-rose-800/80',
    footer: 'border-rose-100 bg-rose-50/30',
  },
};

/**
 * Unified Modern BDR Light GMAO card container for all Settings sections.
 * Features pure unboxed icons, hairline slate-200 borders, soft 3D elevation,
 * and industrial teal control-panel theme alignment.
 */
export function SettingsSectionCard({
  title,
  description,
  icon,
  children,
  footer,
  tone = 'default',
  headerRight,
  className = '',
  bodyClassName = '',
  testId,
}: SettingsSectionCardProps) {
  const styles = TONE_STYLES[tone] || TONE_STYLES.default;

  return (
    <section
      data-testid={testId}
      className={`rounded-2xl border overflow-hidden transition-all duration-300 ${styles.card} ${className}`}
    >
      <div
        className={`px-5 py-4 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${styles.header}`}
      >
        <div className="flex items-start sm:items-center gap-3 min-w-0">
          {icon && (
            <span className={`shrink-0 inline-flex items-center justify-center [&>svg]:w-5 [&>svg]:h-5 ${styles.iconColor}`}>
              {icon}
            </span>
          )}
          <div className="min-w-0">
            <h3 className={`text-sm font-extrabold tracking-tight ${styles.title}`}>{title}</h3>
            {description && (
              <p className={`text-xs mt-0.5 leading-relaxed ${styles.description}`}>
                {description}
              </p>
            )}
          </div>
        </div>
        {headerRight && <div className="flex items-center gap-2 shrink-0 flex-wrap">{headerRight}</div>}
      </div>

      <div className={`p-5 ${bodyClassName}`}>{children}</div>

      {footer && (
        <div className={`px-5 py-3.5 border-t text-xs text-slate-600 ${styles.footer}`}>
          {footer}
        </div>
      )}
    </section>
  );
}

export const SETTINGS_BUTTON_STYLES = {
  primary:
    'inline-flex items-center justify-center gap-2 px-4 py-2 rounded-full bg-sky-800 hover:bg-sky-900 text-white border border-sky-900 text-xs font-semibold shadow-[0_1px_2px_rgba(15,23,42,0.10),inset_0_1px_0_rgba(255,255,255,0.12)] hover:shadow-[0_3px_8px_-2px_rgba(15,23,42,0.14)] active:translate-y-px active:scale-[0.99] transition-all duration-150 cursor-pointer disabled:opacity-50 disabled:pointer-events-none select-none whitespace-nowrap',
  secondary:
    'inline-flex items-center justify-center gap-2 px-4 py-2 rounded-full bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-950 border border-slate-200/95 hover:border-slate-300 text-xs font-semibold shadow-[0_1px_2px_rgba(15,23,42,0.05),inset_0_1px_0_rgba(255,255,255,0.9)] hover:shadow-[0_2px_6px_-1px_rgba(15,23,42,0.08)] active:bg-slate-100 active:scale-[0.99] transition-all duration-150 cursor-pointer disabled:opacity-50 disabled:pointer-events-none select-none whitespace-nowrap',
  warning:
    'inline-flex items-center justify-center gap-2 px-4 py-2 rounded-full bg-white hover:bg-amber-50/50 text-amber-800 border border-amber-300/80 hover:border-amber-400 text-xs font-semibold shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:shadow-[0_2px_5px_-1px_rgba(15,23,42,0.07)] active:bg-amber-50 active:scale-[0.99] transition-all duration-150 cursor-pointer disabled:opacity-50 disabled:pointer-events-none select-none whitespace-nowrap',
  danger:
    'inline-flex items-center justify-center gap-2 px-4 py-2 rounded-full bg-rose-700 hover:bg-rose-800 text-white border border-rose-800 text-xs font-semibold shadow-[0_1px_2px_rgba(15,23,42,0.10),inset_0_1px_0_rgba(255,255,255,0.12)] hover:shadow-[0_3px_8px_-2px_rgba(15,23,42,0.14)] active:translate-y-px active:scale-[0.99] transition-all duration-150 cursor-pointer disabled:opacity-50 disabled:pointer-events-none select-none whitespace-nowrap',
  dangerSoft:
    'inline-flex items-center justify-center gap-2 px-4 py-2 rounded-full bg-white hover:bg-rose-50/50 text-rose-700 border border-rose-200/90 hover:border-rose-300 text-xs font-semibold shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:shadow-[0_2px_5px_-1px_rgba(15,23,42,0.07)] active:bg-rose-50 active:scale-[0.99] transition-all duration-150 cursor-pointer disabled:opacity-50 disabled:pointer-events-none select-none whitespace-nowrap',
};

export const SETTINGS_INPUT_CLASS =
  'w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/70 focus:bg-white text-xs font-semibold text-slate-900 focus:outline-none focus:border-sky-600 focus:ring-2 focus:ring-sky-100 transition-all';

interface TabMetaEntry {
  category: 'factory' | 'advanced';
  icon: React.ComponentType<{ className?: string }>;
  fr: { title: string; subtitle: string };
  ar: { title: string; subtitle: string };
  en: { title: string; subtitle: string };
}

export const SETTINGS_TAB_META: Record<string, TabMetaEntry> = {
  overview: {
    category: 'factory',
    icon: Activity,
    fr: {
      title: "Vue d'ensemble & État du Stockage",
      subtitle:
        'Supervision de la capacité locale (L1/L2), volumétrie des référentiels SSOT et exports rapides.',
    },
    ar: {
      title: 'نظرة عامة وحالة التخزين',
      subtitle: 'مراقبة سعة التخزين المحلي (L1/L2)، حجم سجلات المصدر الموحد SSOT والتصدير السريع.',
    },
    en: {
      title: 'System Overview & Storage Health',
      subtitle: 'Monitor local storage quota (L1/L2), SSOT entity counts, and quick snapshot exports.',
    },
  },
  appearance: {
    category: 'factory',
    icon: Palette,
    fr: {
      title: 'Apparence, Ergonomie & Mode Terminal Terrain',
      subtitle:
        "Personnalisation du mode d'affichage (PC / Mobile Terrain), de la densité des grilles et du thème visuel.",
    },
    ar: {
      title: 'المظهر وبيئة العمل الميدانية',
      subtitle: 'تخصيص وضع العرض (سطح المكتب / الجوال الميداني)، كثافة الجداول والسمة البصرية.',
    },
    en: {
      title: 'Appearance, Layout & Field Ergonomics',
      subtitle: 'Configure device display mode (Desktop / Field Mobile), table density, and visual theme.',
    },
  },
  currency: {
    category: 'factory',
    icon: Coins,
    fr: {
      title: 'Devise, Fiscalité & Taux de Change',
      subtitle:
        'Configuration de la devise de référence ISO 4217, du symbole monétaire, de la TVA et de la période fiscale.',
    },
    ar: {
      title: 'العملة والضرائب وأسعار الصرف',
      subtitle: 'ضبط العملة المرجعية ISO 4217، رمز العملة، ضريبة القيمة المضافة والسنة المالية.',
    },
    en: {
      title: 'Currency, Tax & Exchange Rates',
      subtitle: 'Configure ISO 4217 base currency, display symbol, VAT rate, and fiscal year.',
    },
  },
  'mvt-logic': {
    category: 'factory',
    icon: RotateCcw,
    fr: {
      title: 'Référentiel des Règles de Mouvements Stock',
      subtitle:
        'Documentation opérationnelle des 5 flux magasin (Sortie/Entrée interne, externe et commandes en attente).',
    },
    ar: {
      title: 'دليل قواعد حركات المخزون',
      subtitle: 'التوثيق التشغيلي للتدفقات الخمسة للمخزن (صرف/إرجاع داخلي، خارجي، وطلبات الشراء المعلقة).',
    },
    en: {
      title: 'Stock Movement Rules Reference',
      subtitle: 'Operational reference for the 5 warehouse flows (Internal/External issue, return, and pending POs).',
    },
  },
  directory: {
    category: 'factory',
    icon: FolderSync,
    fr: {
      title: 'Réseau Local LAN & Synchronisation Excel Miroir',
      subtitle:
        "Configuration du poste hôte/client LAN, génération QR mobile terrain et liaison du fichier Excel miroir d'usine.",
    },
    ar: {
      title: 'الشبكة المحلية LAN ومزامنة ملف Excel المرآة',
      subtitle: 'إعداد عقدة المضيف/العميل على الشبكة المحلية، رمز QR للجوال، وربط ملف Excel المرآة.',
    },
    en: {
      title: 'LAN Network & Excel Mirror Synchronization',
      subtitle: 'Configure LAN Host/Client node mode, mobile QR pairing, and local Excel mirror file binding.',
    },
  },
  'backup-audit': {
    category: 'factory',
    icon: Shield,
    fr: {
      title: "Sauvegardes, Intégrité & Journal d'Audit",
      subtitle:
        'Points de restauration, diagnostic mathématique du stock, nettoyage des orphelins et journal immuable.',
    },
    ar: {
      title: 'النسخ الاحتياطي، سلامة البيانات وسجل التدقيق',
      subtitle: 'نقاط الاستعادة، فحص تطابق المخزون، معالجة السجلات اليتيمة وسجل التدقيق غير القابل للتعديل.',
    },
    en: {
      title: 'Backups, Data Integrity & Audit Ledger',
      subtitle: 'Restore points, mathematical stock diagnostics, orphan cleanup, and append-only audit logs.',
    },
  },
  admin: {
    category: 'factory',
    icon: Lock,
    fr: {
      title: 'Sécurité Administrateur, Coffre PIN & Comptes',
      subtitle:
        'Gestion de la clé maîtresse Master PIN (AES-256-GCM), des comptes système et des accès techniciens.',
    },
    ar: {
      title: 'أمان المسؤول، خزنة PIN والحسابات',
      subtitle: 'إدارة المفتاح الرئيسي Master PIN (AES-256-GCM)، حسابات النظام وصلاحيات الفنيين.',
    },
    en: {
      title: 'Admin Security, PIN Vault & User Accounts',
      subtitle: 'Manage the Master PIN key (AES-256-GCM), system portal accounts, and technician access.',
    },
  },
  injection: {
    category: 'advanced',
    icon: Sparkles,
    fr: {
      title: "Mode Démonstration & Réinitialisation d'Usine",
      subtitle:
        "Chargement contrôlé des jeux d'essai par module ou remise à zéro complète pour le démarrage réel.",
    },
    ar: {
      title: 'وضع البيانات التجريبية وإعادة ضبط المصنع',
      subtitle: 'حقن محكوم لبيانات التجربة حسب القسم أو تصفير شامل للانطلاق الفعلي بالمصنع.',
    },
    en: {
      title: 'Demo Data Seeding & Factory Reset',
      subtitle: 'Controlled per-module demo data loading or full factory wipe for production go-live.',
    },
  },
  matching: {
    category: 'advanced',
    icon: ShieldAlert,
    fr: {
      title: 'Appairage & Réconciliation des Référentiels',
      subtitle:
        'Détection et rattachement des codes machines, articles, zones ou intervenants absents des fiches officielles.',
    },
    ar: {
      title: 'مطابقة البيانات وتصحيح الارتباطات المرجعية',
      subtitle: 'اكتشاف وربط رموز الآلات أو القطع أو المناطق أو الفنيين غير المسجلين في الجداول الرسمية.',
    },
    en: {
      title: 'Entity Matching & Referential Reconciliation',
      subtitle: 'Detect and relink machine, article, zone, or user codes missing from official master tables.',
    },
  },
  'json-editor': {
    category: 'advanced',
    icon: FileSpreadsheet,
    fr: {
      title: 'Inspecteur & Éditeur JSON Brut (Maintenance Avancée)',
      subtitle:
        'Inspection directe et modification assistée des collections JSON du magasin de données SSOT.',
    },
    ar: {
      title: 'فاحص ومحرر JSON الخام (صيانة متقدمة)',
      subtitle: 'فحص مباشر وتعديل حذر لمجموعات بيانات المصدر الموحد SSOT بصيغة JSON.',
    },
    en: {
      title: 'Raw JSON Inspector & Editor (Advanced Maintenance)',
      subtitle: 'Direct inspection and guarded editing of underlying SSOT JSON data collections.',
    },
  },
  performance: {
    category: 'advanced',
    icon: Gauge,
    fr: {
      title: 'Diagnostic de Performance & Cache Multi-Niveaux',
      subtitle:
        'Supervision de la fluidité (FPS), de la latence du moteur de calcul de stock et des caches L1/L2/L3.',
    },
    ar: {
      title: 'تشخيص الأداء وذاكرة التخزين المؤقت متعددة المستويات',
      subtitle: 'مراقبة سلاسة الواجهة (FPS)، زمن استجابة محرك حساب المخزون وذاكرة الكاش L1/L2/L3.',
    },
    en: {
      title: 'Performance Diagnostics & Multi-Level Cache',
      subtitle: 'Monitor UI frame rate (FPS), stock calculation engine latency, and L1/L2/L3 cache layers.',
    },
  },
};

export function SettingsPageHeader({
  tabId,
  rightSlot,
}: {
  tabId: string;
  rightSlot?: React.ReactNode;
}) {
  const { language } = useTranslation();
  const meta = SETTINGS_TAB_META[tabId] || SETTINGS_TAB_META.overview;
  const langKey = language === 'ar' ? 'ar' : language === 'en' ? 'en' : 'fr';
  const copy = meta[langKey];
  const Icon = meta.icon;

  const categoryLabel =
    meta.category === 'factory'
      ? language === 'ar'
        ? 'تشغيل المصنع'
        : language === 'en'
          ? 'Factory Operations'
          : 'Exploitation Usine'
      : language === 'ar'
        ? 'أدوات متقدمة'
        : language === 'en'
          ? 'Advanced Tools'
          : 'Système & Avancé';

  return (
    <div className="mb-6 pb-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div className="flex items-start sm:items-center gap-3.5 min-w-0">
        <Icon className="w-6 h-6 text-sky-700 shrink-0" />
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-black uppercase tracking-wider text-sky-800">
              {categoryLabel}
            </span>
          </div>
          <h2 className="text-base md:text-lg font-black text-slate-900 tracking-tight mt-0.5">
            {copy.title}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{copy.subtitle}</p>
        </div>
      </div>
      {rightSlot && <div className="flex items-center gap-2 shrink-0">{rightSlot}</div>}
    </div>
  );
}
