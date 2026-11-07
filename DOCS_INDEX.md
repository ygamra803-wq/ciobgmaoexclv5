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
