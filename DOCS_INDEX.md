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
| **[`docs/MACHINES_VIEW.md`](./docs/MACHINES_VIEW.md)** | سجل الآلات، العائلات، القوالب، الـ `Blueprint` المعرفي، وجواز الآلة 360° (`MachinesRegisteredView.tsx`). |
| **[`docs/STOCK_VIEW.md`](./docs/STOCK_VIEW.md)** | مخزون قطع الغيار `PDR` ومركز التموين وأوامر الشراء `PO` (`StockView.tsx`). |
| **[`docs/MOUVEMENTS_VIEW.md`](./docs/MOUVEMENTS_VIEW.md)** | دفتر الأستاذ الموحد لحركات المخزون (`MouvementsView.tsx`). |
| **[`docs/SORTIE_RAPIDE_VIEW.md`](./docs/SORTIE_RAPIDE_VIEW.md)** | بوابة الصرف والإدخال السريع وطلبيات الصرف الميدانية (`SortieRapideView.tsx`). |
| **[`docs/SORTIE_EXTERNE_VIEW.md`](./docs/SORTIE_EXTERNE_VIEW.md)** | الصيانة الخارجية وإعادة لف المحركات (`SortieExterneBobinageView.tsx`). |
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
- **[`docs/modules/02-parc-machines/GROUP_ARCHITECTURE.md`](./docs/modules/02-parc-machines/GROUP_ARCHITECTURE.md)** — المرجع المعماري للمطورين والوكيل (فلسفة الطبقات الثلاث `Tier 1..3`، التجميع التشغيلي `MACHINE | LINE` ومنع الحلقات `wouldCreateHierarchyCycle`، جواز صحة الآلة 360° ومؤشر `BER`، دمج الـ `BOM As-Built` في `Nexus`، وسياسة `Safe Archive`).
- **[`docs/modules/02-parc-machines/page-machines-registered.md`](./docs/modules/02-parc-machines/page-machines-registered.md)** — دليل المستخدم التشغيلي لشاشة `Machines Enregistrées` وجواز الآلة 360° والملصق الميداني `QR`.
- **[`docs/modules/02-parc-machines/page-families-machines.md`](./docs/modules/02-parc-machines/page-families-machines.md)** — دليل المستخدم التشغيلي لشاشة `Familles de Machines` (`FAM-XX`).
- **[`docs/modules/02-parc-machines/page-templates-machines.md`](./docs/modules/02-parc-machines/page-templates-machines.md)** — دليل المستخدم التشغيلي لشاشة `Modèles / Templates de Machines` (`TPL-XXX`).
- **[`docs/modules/02-parc-machines/page-blueprints-machines.md`](./docs/modules/02-parc-machines/page-blueprints-machines.md)** — دليل المستخدم التشغيلي لشاشة `Blueprints Machines` (التوأم المعرفي ونشر الخطط الوقائية بضغطة واحدة).
- **[`docs/modules/02-parc-machines/page-arborescence-nexus.md`](./docs/modules/02-parc-machines/page-arborescence-nexus.md)** — دليل المستخدم التشغيلي لشاشة `Arborescence & Nomenclature Réelle (Nexus BOM)`.

### المجموعة 03: `Maintenance Préventive & Compteurs (Meter PM)` (`docs/modules/03-preventive-meters/`)
- **[`docs/modules/03-preventive-meters/GROUP_ARCHITECTURE.md`](./docs/modules/03-preventive-meters/GROUP_ARCHITECTURE.md)** — المرجع المعماري للمطورين والوكيل (المحرك الهجين `CALENDRIER | COMPTEUR | HYBRIDE`، الذاكرة الزمنية غير القابلة للتعديل `PREVENTIVE_EXECUTIONS`، خوارزميات `MeterService` للعتبات والإنذار المبكر، وحوكمة `Maker-Checker`).
- **[`docs/modules/03-preventive-meters/page-preventive-planning-meters.md`](./docs/modules/03-preventive-meters/page-preventive-planning-meters.md)** — دليل المستخدم التشغيلي لشاشة `Planning & Compteurs Préventifs` (أوضاع العرض الـ 6، تسجيل الزيارات، جولات العدادات المجمعة `Tournée d'Atelier`، وجولات النظام العام).
- **[`docs/modules/03-preventive-meters/page-preventive-referentiel.md`](./docs/modules/03-preventive-meters/page-preventive-referentiel.md)** — دليل المستخدم التشغيلي لشاشة `Ingénierie & Référentiel Préventif` (مصمم الخطط `Plan Builder`، بطاقات الإرشاد للأعضاء `Guides & PDR`، وكتالوج أفعال `AFNOR`).

### المجموعة 04: `Maintenance Corrective (DI / BT / Clôture & Catalogue)` (`docs/modules/04-corrective-di-bt/`)
- **[`docs/modules/04-corrective-di-bt/GROUP_ARCHITECTURE.md`](./docs/modules/04-corrective-di-bt/GROUP_ARCHITECTURE.md)** — المرجع المعماري للمطورين والوكيل (آلة الحالات المحدودة `WorkOrderStateMachine` والانتقالات المحمية، بروتوكول `Maker-Checker` للتوفيق بين قطع الغيار المستهلكة، حسابات الورديات الصناعية `Shifts 08:00–17:00` واستقطاع فترات الغداء تلقائياً، وخوارزميات `MTTR/MTBF/Pareto`).
- **[`docs/modules/04-corrective-di-bt/page-demandes-intervention.md`](./docs/modules/04-corrective-di-bt/page-demandes-intervention.md)** — دليل المستخدم التشغيلي لشاشة `Demandes d'Intervention` (تسجيل البلاغات الطارئة، درجات الاستعجال P1-P4، التحقق من الآلات النشطة، والتحويل إلى أمر عمل BT).
- **[`docs/modules/04-corrective-di-bt/page-bons-travail.md`](./docs/modules/04-corrective-di-bt/page-bons-travail.md)** — دليل المستخدم التشغيلي لشاشتي `Bons de Travail` و `Intervention Live` (التشغيل الزمني المباشر، الخصم التلقائي لاستراحة الغداء، تتبع القطع المصروفة، ومراجعة المشرف `Maker-Checker`).
- **[`docs/modules/04-corrective-di-bt/page-cloture-analyse.md`](./docs/modules/04-corrective-di-bt/page-cloture-analyse.md)** — دليل المستخدم التشغيلي لشاشتي `Rapports Clôturés` و `Analyse Corrective & Pareto` (تحليلات باريتو 80/20، مؤشرات الاعتمادية MTTR/MTBF، التكلفة المركبة، وتصدير التقارير).
- **[`docs/modules/04-corrective-di-bt/page-catalogue-correctif.md`](./docs/modules/04-corrective-di-bt/page-catalogue-correctif.md)** — دليل المستخدم التشغيلي لشاشة `Catalogue des Données / Référentiel Correctif` (قاعدة الأعراض، الأعمال المعيارية، مصفوفة العرض-الحل، والفنيين المؤهلين).


