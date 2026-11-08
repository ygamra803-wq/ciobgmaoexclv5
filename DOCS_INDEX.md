# 📚 فهرس التوثيق المعماري الموحد (`DOCS_INDEX.md`)

هذا الفهرس يوجّه المطورين، المدققين التقنيين، ووكلاء الذكاء الاصطناعي إلى الوثائق المعتمدة والمحدثة في مستودع **CIOB GMAO v4**، بعد تطهير المستودع من الملفات المكررة وسجلات المهام القديمة المنتهية.

---

## 🏛️ 1. الوثائق المرجعية العليا في الجذر (Root Authoritative Docs)

| الترتيب | الملف | الجمهور المستهدف | المحتوى والغرض |
| :---: | :--- | :--- | :--- |
| **1** | **[`AGENTS.md`](./AGENTS.md)** | وكلاء الذكاء الاصطناعي والمطورون | **البوابة الإلزامية الأولى:** القواعد غير القابلة للتفاوض (`SSOT`, `Zero Silent Seed`, معادلة المخزون، الفلسفة الثلاثية للأصول والـ `Blueprint`، سجل التدقيق `AUDIT_EVENTS`، وحدود الأمان). |
| **2** | **[`ARCHITECTURE.md`](./ARCHITECTURE.md)** | المهندسون والمدققون التقنيون | **الملخص المعماري وسجل القرارات (`ADR-01` إلى `ADR-10`):** هيكل النظام، الفلسفة الثلاثية (`Family/Template` ➔ `Machine Registered` ➔ `Blueprint`)، التجميع التشغيلي للخطوط (`MACHINE \| LINE`)، تدفق البيانات، وجولة التحقق في 15 دقيقة. |
| **3** | **[`CAPABILITIES_AND_STRENGTHS.md`](./CAPABILITIES_AND_STRENGTHS.md)** | الإدارة الهندسية والمراجعون | **سجل القدرات المنفذة فعلياً بالكود والاختبارات (17 محوراً):** روابط مباشرة للملفات والخدمات والاختبارات الآلية التي تثبت كل ميزة. |
| **4** | **[`README.md`](./README.md)** | جميع المستخدمين والمطورين | نظرة عامة على المنظومة، فلسفتها الصناعية، متطلبات التشغيل السريع، وأوامر البناء والاختبار. |
| **5** | **[`EXCEL_FORMULAS.md`](./EXCEL_FORMULAS.md)** | مهندسو البيانات ومستخدمو Excel | توثيق معادلات التصدير والاستيراد التوأم (`SUMIFS`, `COUNTIF`, `IF`) المتوافقة مع `excelEngineService.ts`. |

---

## 🗄️ 2. وثائق النواة المعمارية والتشغيل في `/docs`

| الملف | الوظيفة الهندسية |
| :--- | :--- |
| **[`docs/DATA_SSOT.md`](./docs/DATA_SSOT.md)** | الجدول الرسمي لجميع مفاتيح التخزين القياسية (`STORAGE_KEYS` — 36+ كياناً)، العلاقات المرجعية (`FK`)، والفلسفة الثلاثية للأصول والمخطط المعرفي (`Blueprint`) والـ `BOM Nexus`. |
| **[`docs/DESIGN_SYSTEM_UI_UX.md`](./docs/DESIGN_SYSTEM_UI_UX.md)** | **الدستور البصري ونظام التصميم لتجربة وواجهة المستخدم:** المرجع الشامل لجميع المكونات المشتركة، أزرار `Action3DButton`، بطاقات `GmaoKpiCard`، شبكة `GmaoIndustrialDataGrid`، منظومة الفلاتر، قواعد الوضع الفاتح والداكن، وقالب إنشاء الصفحات الجديدة بدون ارتباك. |
| **[`docs/COMPOSANTS_HIERARCHIE_ET_IDENTIFIANTS.md`](./docs/COMPOSANTS_HIERARCHIE_ET_IDENTIFIANTS.md)** | فلسفة الترقيم الثلاثي (`ID / CODE / REF`) والهيكل الهرمي الرباعي للمكونات (`Groupes ➔ Familles ➔ Templates ➔ Stock Entrepôt`). |
| **[`docs/WIZARD_ENGINE.md`](./docs/WIZARD_ENGINE.md)** | توثيق محرك المعالجات الموجهة (`Profile-Driven Wizard Engine`) ومفاتيح التفعيل (`WIZARD_FEATURE_FLAGS`). |
| **[`docs/USER_MANUAL.md`](./docs/USER_MANUAL.md)** | الدليل التشغيلي الميداني للمديرين والمهندسين وفنيي الصيانة. |
| **[`docs/DEPLOYMENT.md`](./docs/DEPLOYMENT.md)** | تعليمات البناء الإنتاجي (`npm run build`) وتشغيل خادم الشبكة المحلية (`server.ts`). |

---

## 🖥️ 3. مواصفات شاشات العرض التفصيلية (`docs/*_VIEW.md`)

> **قاعدة للوكلاء:** افتح فقط ملف الشاشة التي تقوم بتعديلها فعلياً.

| الملف | الشاشة المقابلة في الكود |
| :--- | :--- |
| **[`docs/DASHBOARD_VIEW.md`](./docs/DASHBOARD_VIEW.md)** | لوحة القيادة والمؤشرات التنفيذية (`DashboardView.tsx`). |
| **[`docs/MACHINES_VIEW.md`](./docs/MACHINES_VIEW.md)** | سجل آلات الإنتاج، العائلات، القوالب، الـ `Blueprint` المعرفي، وجواز الآلة 360° (`MachinesRegisteredView.tsx`). |
| **[`docs/EQUIPEMENTS_VIEW.md`](./docs/EQUIPEMENTS_VIEW.md)** | شاشة معدات النظام العام والمرافق وفئاتها (`EquipmentView.tsx` — `#equipment`). |
| **[`docs/STOCK_VIEW.md`](./docs/STOCK_VIEW.md)** | مخزون قطع الغيار `PDR` ومركز التموين وأوامر الشراء `PO` (`StockView.tsx`). |
| **[`docs/MOUVEMENTS_VIEW.md`](./docs/MOUVEMENTS_VIEW.md)** | دفتر الأستاذ الموحد لحركات المخزون (`MouvementsView.tsx`). |
| **[`docs/SORTIE_RAPIDE_VIEW.md`](./docs/SORTIE_RAPIDE_VIEW.md)** | بوابة الصرف والإدخال السريع وطلبيات الصرف الميدانية (`SortieRapideView.tsx`). |
| **[`docs/SORTIE_EXTERNE_VIEW.md`](./docs/SORTIE_EXTERNE_VIEW.md)** | أوامر الإنجاز بالورشة الميكانيكية (`BON-ATEL`) والصيانة الخارجية/لف المحركات (`SORT-EXT`) (`SortieExterneBobinageTab.tsx`). |
| **[`docs/ENTREPOT_VIEW.md`](./docs/ENTREPOT_VIEW.md)** | مستودع المكونات الدوارة والأجزاء المركبة (`EntrepotView.tsx`). |
| **[`docs/COMPONENTS_VIEW.md`](./docs/COMPONENTS_VIEW.md)** | المرجعيات الهيكلية للمكونات والأجزاء (`CompGroupView`, `CompFamilyView`, `CompTemplateView`). |
| **[`docs/PREVENTIVE_VIEW.md`](./docs/PREVENTIVE_VIEW.md)** | الصيانة الوقائية (مصفوفة 52 أسبوعاً + الصيانة بالعدادات `PreventiveMetersView.tsx`). |
| **[`docs/ZONES_VIEW.md`](./docs/ZONES_VIEW.md)** | الورش والمناطق الجغرافية (`ZonesView.tsx`). |
| **[`docs/UTILISATEURS_VIEW.md`](./docs/UTILISATEURS_VIEW.md)** | إدارة الكادر البشري، الفنيين، المشرفين، والأدوار (`UtilisateursView.tsx`). |
| **[`docs/SETTINGS_BACKUP.md`](./docs/SETTINGS_BACKUP.md)** | الإعدادات، المزامنة عبر الشبكة المحلية `LAN`, النسخ الاحتياطي، وسجل التدقيق المؤسسي (`SettingsView.tsx`). |

---

## 📖 4. التوثيق الحي ثنائي الطبقة حسب المجموعات (`docs/modules/*` ➔ `GuideView.tsx`)

هذه الملفات تُقرأ مباشرة داخل شاشة **`Guide d'utilisation`** (`src/presentation/pages/system/GuideView.tsx`) وتجمع بين **مرجع الهندسة والمعمارية للمطورين/الوكلاء (`GROUP_ARCHITECTURE.md`)** و**الأدلة التشغيلية للمستخدمين (`page-*.md`)**:

### المجموعة 01: `Stock PDR, Mouvements & Commandes (PO)` (`docs/modules/01-stock-pdr/`)
- **[`docs/modules/01-stock-pdr/GROUP_ARCHITECTURE.md`](./docs/modules/01-stock-pdr/GROUP_ARCHITECTURE.md)** — المرجع المعماري للمطورين والوكيل (`IncrementalStockIndex` $O(1)$، الحجز المؤقت `Maker-Checker`، دورة أوامر الشراء `PO`، الصلاحيات `RBAC`، وسجل التدقيق `AUDIT_EVENTS`).
- **[`docs/modules/01-stock-pdr/page-stock-articles.md`](./docs/modules/01-stock-pdr/page-stock-articles.md)** — دليل المستخدم التشغيلي لشاشة `Stock Articles` ومركز التموين وأوامر الشراء `PO`.
- **[`docs/modules/01-stock-pdr/page-sortie-entree-rapide.md`](./docs/modules/01-stock-pdr/page-sortie-entree-rapide.md)** — دليل المستخدم التشغيلي لشاشة `Sortie & Entrée Rapide` (التدفقات الخمسة، طلبيات الصرف الميدانية، وأذونات الخروج الخارجية).
- **[`docs/modules/01-stock-pdr/page-types-pdr.md`](./docs/modules/01-stock-pdr/page-types-pdr.md)** — دليل المستخدم التشغيلي لشاشة `Types PDR` (`TYP-XX`).
- **[`docs/modules/01-stock-pdr/page-designations-pdr.md`](./docs/modules/01-stock-pdr/page-designations-pdr.md)** — دليل المستخدم التشغيلي لشاشة `Désignations PDR`.

### المجموعة 02: `Parc Machines, Blueprints & Architecture 3-Tiers` (`docs/modules/02-parc-machines/`)
- **[`docs/modules/02-parc-machines/GROUP_ARCHITECTURE.md`](./docs/modules/02-parc-machines/GROUP_ARCHITECTURE.md)** — المرجع المعماري للمطورين والوكيل (فلسفة الطبقات الثلاث `Tier 1..3`، فصل إدارة آلات الإنتاج `PRODUCTION` عن معدات النظام العام `SYSTEM_GENERAL` التي تُدار في `#equipment`، التجميع التشغيلي `MACHINE | LINE`، جواز صحة الآلة 360° ومؤشر `BER`، دمج الـ `BOM As-Built` في `Nexus`، وسياسة `Safe Archive`).
- **[`docs/modules/02-parc-machines/page-machines-registered.md`](./docs/modules/02-parc-machines/page-machines-registered.md)** — دليل المستخدم التشغيلي لشاشة `Machines Enregistrées` (إنشاء وتعديل آلات الإنتاج، عرض معدات النظام العام مع التوجيه المباشر لصفحة `#equipment`، وجواز الآلة 360° والملصق الميداني `QR`).
- **[`docs/modules/02-parc-machines/page-families-machines.md`](./docs/modules/02-parc-machines/page-families-machines.md)** — دليل المستخدم التشغيلي لشاشة `Familles de Machines` (`FAM-XX`).
- **[`docs/modules/02-parc-machines/page-templates-machines.md`](./docs/modules/02-parc-machines/page-templates-machines.md)** — دليل المستخدم التشغيلي لشاشة `Modèles / Templates de Machines` (`TPL-XXX`).
- **[`docs/modules/02-parc-machines/page-blueprints-machines.md`](./docs/modules/02-parc-machines/page-blueprints-machines.md)** — دليل المستخدم التشغيلي لشاشة `Blueprints Machines` (التوأم المعرفي ونشر الخطط الوقائية بضغطة واحدة).
- **[`docs/modules/02-parc-machines/page-arborescence-nexus.md`](./docs/modules/02-parc-machines/page-arborescence-nexus.md)** — دليل المستخدم التشغيلي لشاشة `Arborescence & Nomenclature Réelle (Nexus BOM)`.

### المجموعة 03: `Maintenance Préventive & Compteurs (Meter PM)` (`docs/modules/03-preventive-meters/`)
- **[`docs/modules/03-preventive-meters/GROUP_ARCHITECTURE.md`](./docs/modules/03-preventive-meters/GROUP_ARCHITECTURE.md)** — المرجع المعماري للمطورين والوكيل (المحرك الهجين `CALENDRIER | COMPTEUR | HYBRIDE`، الذاكرة الزمنية غير القابلة للتعديل `PREVENTIVE_EXECUTIONS`، خوارزميات `MeterService` للعتبات والإنذار المبكر، وحوكمة `Maker-Checker`).
- **[`docs/modules/03-preventive-meters/page-preventive-planning-meters.md`](./docs/modules/03-preventive-meters/page-preventive-planning-meters.md)** — دليل المستخدم التشغيلي لشاشة `Planning & Compteurs Préventifs` (أوضاع العرض الـ 6، تسجيل الزيارات، جولات العدادات المجمعة `Tournée d'Atelier`، وجولات النظام العام).
- **[`docs/modules/03-preventive-meters/page-preventive-referentiel.md`](./docs/modules/03-preventive-meters/page-preventive-referentiel.md)** — دليل المستخدم التشغيلي لشاشة `Ingénierie & Référentiel Préventif` (مصمم الخطط `Plan Builder`، بطاقات الإرشاد للأعضاء `Guides & PDR`، وكتالوج أفعال `AFNOR`).

### المجموعة 04: `Maintenance Corrective (DI / BT / Clôture & Catalogue)` (`docs/modules/04-corrective-di-bt/`)
- **[`docs/modules/04-corrective-di-bt/GROUP_ARCHITECTURE.md`](./docs/modules/04-corrective-di-bt/GROUP_ARCHITECTURE.md)** — المرجع المعماري للمطورين والوكيل (آلة الحالات المحدودة `WorkOrderStateMachine`، جسر أوامر الورشة الميكانيكية والمقاولة الخارجية `CORRECTIVE-ATELIER-P0` ومنع الإغلاق المبكر `hasOpenWorkshopOrder`، بروتوكول `Maker-Checker`، حسابات الورديات الصناعية `Shifts 08:00–17:00`، وخوارزميات `MTTR/MTBF/Pareto`).
- **[`docs/modules/04-corrective-di-bt/page-demandes-intervention.md`](./docs/modules/04-corrective-di-bt/page-demandes-intervention.md)** — دليل المستخدم التشغيلي لشاشة `Demandes d'Intervention` (تسجيل البلاغات الطارئة، درجات الاستعجال P1-P4، التحقق من الآلات النشطة، والتحويل إلى أمر عمل BT).
- **[`docs/modules/04-corrective-di-bt/page-bons-travail.md`](./docs/modules/04-corrective-di-bt/page-bons-travail.md)** — دليل المستخدم التشغيلي لشاشتي `Bons de Travail` و `Intervention Live` (التشغيل الزمني المباشر، إنشاء بون ورشة/تجليخ مرتبط بالـ BT، تعليق الإغلاق حتى استلام القطعة من الورشة، ومراجعة المشرف `Maker-Checker`).
- **[`docs/modules/04-corrective-di-bt/page-cloture-analyse.md`](./docs/modules/04-corrective-di-bt/page-cloture-analyse.md)** — دليل المستخدم التشغيلي لشاشتي `Rapports Clôturés` و `Analyse Corrective & Pareto` (تحليلات باريتو 80/20، مؤشرات الاعتمادية MTTR/MTBF، التكلفة المركبة شاملاً تكلفة الورشة والمقاولة الخارجية `cout_atelier`، وتصدير التقارير).
- **[`docs/modules/04-corrective-di-bt/page-catalogue-correctif.md`](./docs/modules/04-corrective-di-bt/page-catalogue-correctif.md)** — دليل المستخدم التشغيلي لشاشة `Catalogue des Données / Référentiel Correctif` (قاعدة الأعراض، الأعمال المعيارية، مصفوفة العرض-الحل، والفنيين المؤهلين).

### المجموعة 05: `Entrepôt Organes & Pièces Détachées` (`docs/modules/05-entrepot-organes/`)
- **[`docs/modules/05-entrepot-organes/GROUP_ARCHITECTURE.md`](./docs/modules/05-entrepot-organes/GROUP_ARCHITECTURE.md)** — المرجع المعماري للمطورين والوكيل (الهيكل الهرمي الرباعي `Groupes ➔ Familles ➔ Templates ➔ Entrepôt`، ثلاثية المعرفات `ID / CODE / REF`، دورة الحياة الفيزيائية للأعضاء `DISPONIBLE / INSTALLE / EN_REPARATION / REFORME`، تركيب وتفكيك الأعضاء على شجرة `Nexus BOM`، وتقييم صحة واهتراء العضو `componentHealthScore`).
- **[`docs/modules/05-entrepot-organes/page-entrepot-organes.md`](./docs/modules/05-entrepot-organes/page-entrepot-organes.md)** — دليل المستخدم التشغيلي لشاشة `Entrepôt Organes & Pièces` (التبديل بين الأعضاء والقطع، التثبيت على الآلات، التتبع الحركي، وتصنيف الحالات).
- **[`docs/modules/05-entrepot-organes/page-groupes-organes.md`](./docs/modules/05-entrepot-organes/page-groupes-organes.md)** — دليل المستخدم التشغيلي لشاشة `Groupes d'Organes` (المستوى الأول التكنولوجي `GRP-XX`، منع تضخم الفئات، والتنقل الشلالي بنقرة واحدة).
- **[`docs/modules/05-entrepot-organes/page-familles-organes.md`](./docs/modules/05-entrepot-organes/page-familles-organes.md)** — دليل المستخدم التشغيلي لشاشة `Familles d'Organes` (المستوى الثاني التقني `FAM-COMP-XX`، الربط بالمجموعة الأب، وفلاتر العرض المتسلسلة).
- **[`docs/modules/05-entrepot-organes/page-modeles-organes.md`](./docs/modules/05-entrepot-organes/page-modeles-organes.md)** — دليل المستخدم التشغيلي لشاشة `Modèles / Templates d'Organes` (المستوى الثالث القياسي `TPL-COMP-XXX`، توحيد بطاقات المواصفات kW/tr-min/A، وربطها بالرصيد الفعلي).
- **[`docs/modules/05-entrepot-organes/page-types-pieces.md`](./docs/modules/05-entrepot-organes/page-types-pieces.md)** — دليل المستخدم التشغيلي لشاشة `Types de Pièces` (تصنيف القطع الهيكلية والميكانيكية `TYP-PART-XX`، وربطها بالتسميات والمستودع).
- **[`docs/modules/05-entrepot-organes/page-designations-pieces.md`](./docs/modules/05-entrepot-organes/page-designations-pieces.md)** — دليل المستخدم التشغيلي لشاشة `Désignations de Pièces` (السجل المعياري للمقاسات والمواصفات والأبعاد للقطع الفردية).

### المجموعة 06: `Pilotage, Finance & Gouvernance` (`docs/modules/06-pilotage-gouvernance/`)
> **ملاحظة معمارية:** تم إعداد **توثيقين مستقلين لكل صفحة**: دليل هندسي معماري للمطورين والوكلاء (`page-dev-*.md`) + دليل تشغيلي ميداني للمستخدمين (`page-user-*.md`).

- **[`docs/modules/06-pilotage-gouvernance/GROUP_ARCHITECTURE.md`](./docs/modules/06-pilotage-gouvernance/GROUP_ARCHITECTURE.md)** — المرجع المعماري الشامل لحوكمة المنظومة (الأركان السبعة، سياسة الصلاحيات Fail-Closed، والتكامل المالي والتشغيلي).
- **لوحة القيادة (`Dashboard`):**
  - **[`docs/modules/06-pilotage-gouvernance/page-dev-dashboard.md`](./docs/modules/06-pilotage-gouvernance/page-dev-dashboard.md)** — المرجع التقني (محرك التجميع، الكاش متعدد الطبقات L1/L2/L3، ومعادلات التوافر والاعتمادية دون حقن وهمي).
  - **[`docs/modules/06-pilotage-gouvernance/page-user-dashboard.md`](./docs/modules/06-pilotage-gouvernance/page-user-dashboard.md)** — دليل المستخدم التشغيلي (قراءة المؤشرات التنفيذية، تنبيهات الأعطال الحرجة، وقيمة المخزون).
- **مركز الاعتماد (`Validation Center`):**
  - **[`docs/modules/06-pilotage-gouvernance/page-dev-validation-center.md`](./docs/modules/06-pilotage-gouvernance/page-dev-validation-center.md)** — المرجع التقني (حوكمة Maker-Checker `VAL-1..VAL-5`، دالة `reconcileFieldClaim`، وإلزامية عدم خصم المخزون قبل الاعتماد).
  - **[`docs/modules/06-pilotage-gouvernance/page-user-validation-center.md`](./docs/modules/06-pilotage-gouvernance/page-user-validation-center.md)** — دليل المستخدم التشغيلي (مراجعة تقارير الفنيين، تعديل كميات القطع المصروفة، وقرارات الرفض والقبول).
- **المالية والميزانيات (`Finance & Budgets`):**
  - **[`docs/modules/06-pilotage-gouvernance/page-dev-finance-budgets.md`](./docs/modules/06-pilotage-gouvernance/page-dev-finance-budgets.md)** — المرجع التقني (مبدأ Field Claim ≠ Coût Validé ≠ ERP، بنية `FiscalBudgetConfig`، وتكلفة الملكية الإجمالية TCO).
  - **[`docs/modules/06-pilotage-gouvernance/page-user-finance-budgets.md`](./docs/modules/06-pilotage-gouvernance/page-user-finance-budgets.md)** — دليل المستخدم التشغيلي (تخصيص الميزانية السنوية، توزيع التكاليف، ومؤشر الجدوى الاقتصادية BER).
- **المستخدمون والصلاحيات (`Utilisateurs & RBAC`):**
  - **[`docs/modules/06-pilotage-gouvernance/page-dev-utilisateurs.md`](./docs/modules/06-pilotage-gouvernance/page-dev-utilisateurs.md)** — المرجع التقني (مصفوفة `PERMISSIONS`، التشفير بـ AES-GCM 256-bit، وسياسة الحماية من الهجمات بالتخمين).
  - **[`docs/modules/06-pilotage-gouvernance/page-user-utilisateurs.md`](./docs/modules/06-pilotage-gouvernance/page-user-utilisateurs.md)** — دليل المستخدم التشغيلي (إدارة الحسابات، تعيين الأدوار الوظيفية، وسياسة الأرشفة الآمنة Soft Archive).
- **المناطق والورشات (`Zones & Ateliers`):**
  - **[`docs/modules/06-pilotage-gouvernance/page-dev-zones.md`](./docs/modules/06-pilotage-gouvernance/page-dev-zones.md)** — المرجع التقني (الفصل الصارم بين الجغرافيا والتراتب الفني، وحماية الحذف `handleDeleteZone`).
  - **[`docs/modules/06-pilotage-gouvernance/page-user-zones.md`](./docs/modules/06-pilotage-gouvernance/page-user-zones.md)** — دليل المستخدم التشغيلي (المخطط المكاني للمصنع، ربط الآلات والفنيين بالورش، ومنع حذف المناطق المشغولة).
- **المعدات والنظام العام (`Équipements & Système Général`):**
  - **[`docs/modules/06-pilotage-gouvernance/page-dev-equipment.md`](./docs/modules/06-pilotage-gouvernance/page-dev-equipment.md)** — المرجع التقني (`EquipmentView.tsx`، مشاركة SSOT الوحيد `STORAGE_KEYS.MACHINES` + `STORAGE_KEYS.GENERAL_SYSTEM_TYPES`، العزل الوظيفي عن شاشة آلات الإنتاج، وصلاحيات `equipment.*`).
  - **[`docs/modules/06-pilotage-gouvernance/page-user-equipment.md`](./docs/modules/06-pilotage-gouvernance/page-user-equipment.md)** — دليل المستخدم التشغيلي (إدارة معدات المرافق وفئات النظام العام `AIR/ELEC/SEC/CHILL` والترقيم التلقائي).
- **شجرة نيكسوس والتسميات الحقيقية (`Nexus As-Built & Digital Twins`):**
  - **[`docs/modules/06-pilotage-gouvernance/page-dev-nexus.md`](./docs/modules/06-pilotage-gouvernance/page-dev-nexus.md)** — المرجع التقني (بناء التسمية الموحدة buildUnifiedMachineNexusElements، تحليل فروقات البلوبرنت، واستنساخ التسمية للخطوط التوأم).
  - **[`docs/modules/06-pilotage-gouvernance/page-user-nexus.md`](./docs/modules/06-pilotage-gouvernance/page-user-nexus.md)** — دليل المستخدم التشغيلي (استعراض التشريح الفيزيائي للآلة، مقارنة الواقع مع النظرية، والربط المباشر مع أذونات الصرف السريعة).

### المجموعة 07: `Paramètres Système, Sauvegardes & Registre d'Audit` (`docs/modules/07-settings-systeme/`)
> **ملاحظة معمارية:** قسم الإعدادات هو العصب التقني للمنظومة؛ لذلك تم تفكيكه وتوثيق كل تبويب من تبويباته العشرة **بتوثيقين مستقلين** (دليل مطورين وهندسة + دليل مستخدمين وتشغيل).

- **[`docs/modules/07-settings-systeme/GROUP_ARCHITECTURE.md`](./docs/modules/07-settings-systeme/GROUP_ARCHITECTURE.md)** — المعمارية الكلية للإعدادات (SSOT، سياسة Zero Silent Seed، السيرفر المحلي LAN، التخزين الذري writeQueue، وسجل التدقيق).
- **1. الإشراف والتخزين (`Overview / Settings`):**
  - **[`docs/modules/07-settings-systeme/page-dev-settings-overview.md`](./docs/modules/07-settings-systeme/page-dev-settings-overview.md)** — المرجع التقني (إدارة التخزين الهجين LocalStorage/IndexedDB، عقد المصنع الفارغ، والتحقق الصحي).
  - **[`docs/modules/07-settings-systeme/page-user-settings-overview.md`](./docs/modules/07-settings-systeme/page-user-settings-overview.md)** — دليل المستخدم التشغيلي (مراقبة استهلاك الذاكرة، تهيئة المصنع الجديد، وتشغيل البيانات التجريبية).
- **2. منطق وتدفقات الحركات (`Movement Logic`):**
  - **[`docs/modules/07-settings-systeme/page-dev-mvt-logic.md`](./docs/modules/07-settings-systeme/page-dev-mvt-logic.md)** — المرجع التقني (معادلة المخزون الحتمية، محرك IncrementalStockIndex O(1)، والمسارات الخمسة).
  - **[`docs/modules/07-settings-systeme/page-user-mvt-logic.md`](./docs/modules/07-settings-systeme/page-user-mvt-logic.md)** — دليل المستخدم التشغيلي (فهم حركات الصرف والإدخال، حساب سعر التكلفة PUMP، ومنع الأخطاء).
- **3. حقن واستيراد البيانات (`Excel Data Injection`):**
  - **[`docs/modules/07-settings-systeme/page-dev-injection-excel.md`](./docs/modules/07-settings-systeme/page-dev-injection-excel.md)** — المرجع التقني (معالجة الملفات، فحص Schéma بـ Zod، والمعاينة الجافة Dry-Run).
  - **[`docs/modules/07-settings-systeme/page-user-injection-excel.md`](./docs/modules/07-settings-systeme/page-user-injection-excel.md)** — دليل المستخدم التشغيلي (تحميل النماذج الجاهزة، استيراد القوائم، وتصحيح الأخطاء).
- **4. المجلد المشترك والمزامنة (`Shared Folder & LAN Sync`):**
  - **[`docs/modules/07-settings-systeme/page-dev-directory-sync.md`](./docs/modules/07-settings-systeme/page-dev-directory-sync.md)** — المرجع التقني (خادم server.ts، أمان الـ Token، حل التعارضات 409، والكتابة الذرية).
  - **[`docs/modules/07-settings-systeme/page-user-directory-sync.md`](./docs/modules/07-settings-systeme/page-user-directory-sync.md)** — دليل المستخدم التشغيلي (ربط أجهزة التابلت بشبكة الورشة، ومتابعة حالة الاتصال بالخادم).
- **5. المطابقة والربط (`Entity Matching & Audit`):**
  - **[`docs/modules/07-settings-systeme/page-dev-matching-audit.md`](./docs/modules/07-settings-systeme/page-dev-matching-audit.md)** — المرجع التقني (خوارزميات فحص المفاتيح الأجنبية Orphaned FKs، وإعادة الربط التلقائي).
  - **[`docs/modules/07-settings-systeme/page-user-matching-audit.md`](./docs/modules/07-settings-systeme/page-user-matching-audit.md)** — دليل المستخدم التشغيلي (اكتشاف الآلات أو القطع المعزولة، وإعادة تعيينها بنقرة واحدة).
- **6. محرر قاعدة البيانات (`JSON Database Editor`):**
  - **[`docs/modules/07-settings-systeme/page-dev-settings-json-editor.md`](./docs/modules/07-settings-systeme/page-dev-settings-json-editor.md)** — المرجع التقني (الفحص النحوي، حماية التراكيب الحيوية، وحفظ التعديلات الطارئة).
  - **[`docs/modules/07-settings-systeme/page-user-settings-json-editor.md`](./docs/modules/07-settings-systeme/page-user-settings-json-editor.md)** — دليل المستخدم التشغيلي (عرض البيانات الخام، البحث بالكلمات، وضوابط الحذر).
- **7. النسخ الاحتياطي والتدقيق المؤسسي (`Backup & Audit Ledger`):**
  - **[`docs/modules/07-settings-systeme/page-dev-settings-backup-audit.md`](./docs/modules/07-settings-systeme/page-dev-settings-backup-audit.md)** — المرجع التقني (سجل AUDIT_EVENTS غير القابل للتعديل، التقاط الفروقات قبل/بعد، واستعادة الحالة الكاملة).
  - **[`docs/modules/07-settings-systeme/page-user-settings-backup-audit.md`](./docs/modules/07-settings-systeme/page-user-settings-backup-audit.md)** — دليل المستخدم التشغيلي (تصدير النسخ الدورية، الاسترجاع بعد الأعطال، وتتبع تاريخ العمليات).
- **8. حساب المسؤول والخزنة المشفرة (`Admin Account & Vault`):**
  - **[`docs/modules/07-settings-systeme/page-dev-settings-admin-vault.md`](./docs/modules/07-settings-systeme/page-dev-settings-admin-vault.md)** — المرجع التقني (توليد المفاتيح بـ PBKDF2، التشفير بـ AES-GCM 256-bit، وقفل التخمين).
  - **[`docs/modules/07-settings-systeme/page-user-settings-admin-vault.md`](./docs/modules/07-settings-systeme/page-user-settings-admin-vault.md)** — دليل المستخدم التشغيلي (تعيين الرمز السري Master PIN، فتح الخزنة وقفلها التلقائي).
- **9. الأداء وذاكرة التخزين المؤقت (`Performance & Cache`):**
  - **[`docs/modules/07-settings-systeme/page-dev-settings-performance-cache.md`](./docs/modules/07-settings-systeme/page-dev-settings-performance-cache.md)** — المرجع التقني (هيكلية الكاش L1/L2/L3، الإبطال الذكي بالوسوم Tag Invalidation، ومراقبة الـ Latency).
  - **[`docs/modules/07-settings-systeme/page-user-settings-performance-cache.md`](./docs/modules/07-settings-systeme/page-user-settings-performance-cache.md)** — دليل المستخدم التشغيلي (مؤشرات سرعة الاستجابة، وتفريغ الذاكرة المؤقتة لتحسين الأداء).
- **10. العملات والمالية الدولية (`Currency & Multi-Currency ISO`):**
  - **[`docs/modules/07-settings-systeme/page-dev-settings-currency-finance.md`](./docs/modules/07-settings-systeme/page-dev-settings-currency-finance.md)** — المرجع التقني (معايير ISO 4217، التحويل الآني للـ PUMP، والاحتفاظ بسعر الصرف التاريخي).
  - **[`docs/modules/07-settings-systeme/page-user-settings-currency-finance.md`](./docs/modules/07-settings-systeme/page-user-settings-currency-finance.md)** — دليل المستخدم التشغيلي (اختيار العملة الأساسية DA/MAD/EUR/USD، وتسجيل أسعار الصرف).





