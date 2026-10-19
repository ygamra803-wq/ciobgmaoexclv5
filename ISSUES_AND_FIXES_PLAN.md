# 🛠️ سجل المشاكل الهندسية وخطة الإصلاحات المعتمدة (Engineering Issues & Fixes Plan)

> **منهجية التقييم:** يعتمد هذا المستند تقييماً هندسياً واقعياً ومباشراً مبنياً على الفحص الفعلي للشيفرة المصدرية والاختبارات الميدانية، دون أي نسب مئوية تضخيمية أو تصنيفات دعائية.
> - لخارطة الطريق المعمارية وخطة المراحل المفصّلة (`P0` → `P6`)، راجع: [`ROADMAP_AND_PHASES_PLAN.md`](./ROADMAP_AND_PHASES_PLAN.md).
> - للنسخة المؤرشفة السابقة، راجع: [`docs/history/ARCHIVED_ISSUES_PLAN_v4.md`](./docs/history/ARCHIVED_ISSUES_PLAN_v4.md).

---

## 📊 دليل حالات التصنيف (Status Legend)

| الرمز | الحالة | التعريف الهندسي |
| :--- | :--- | :--- |
| 🟢 | **محلول (Resolved)** | تم تنفيذ الحل بالكامل في الشيفرة المصدرية، والتحقق منه عبر البناء (`compile_applet`) والفحص (`lint_applet`) والاختبار الوظيفي. |
| 🟡 | **جزئي (Partial / In-Progress)** | تم إنجاز الجزء الأساسي من المعالجة مع بقاء مهام تنظيف معماري أو تحسينات إضافية قيد المتابعة. |
| 🔴 | **مفتوح (Open / Backlog)** | متطلبات مستقبلية أو تحسينات مرصودة في قائمة الانتظار لم يبدأ تنفيذها بعد. |

---

## 1. وحدة المصدر المرجعي للبيانات والتخزين (Data SSOT & Persistence)

| المعرف | المشكلة المرصودة | الحالة | التفاصيل الهندسية والحل المنفّذ |
| :--- | :--- | :--- | :--- |
| **DATA-01** | **تعارض البيانات بعد Clear / Reset / Demo وانبعاث بذور الديمو عند F5** | 🟢 **محلول (Resolved)** | تم حصر كافة مسارات الكتابة والتفريغ والتحميل عبر `src/application/DataGateway.ts` كمسار كتابة أحادي (Single Write Path). عند استدعاء `clearAllForRealFactory` يتم تثبيت `DEMO_MODE = false` و `START_MODE = 'empty'` صراحةً في `storageService` و `localStorage`، وحذف اللقطة المجمعة `FULL_STATE_SNAPSHOT`، وكتابة `[]` على جميع المفاتيح الـ Canonical، وتعطيل استعادة اللقطة في `migrateStorage.ts` و `App.tsx` أثناء وضع المصنع الفارغ. |
| **DATA-02** | **غياب بروتوكول اختبار يدوي موثق للتحقق من ثبات SSOT** | 🟢 **محلول (Resolved)** | تم إنشاء وتوثيق بروتوكول الاختبار اليدوي الخماسي في [`docs/MANUAL_SSOT_TEST.md`](./docs/MANUAL_SSOT_TEST.md) بـ 5 خطوات متسلسلة: (1. بدء فارغ `START_MODE=empty` ← 2. تحميل ديمو `loadDemoData` ← 3. تصفير شامل `clearAllForRealFactory` ← 4. إضافة 3 مهام وقائية في `gmao_preventive_tasks_v9` ← 5. تحديث `F5` والتأكد من بقاء المهام الثلاث فقط دون انبعاث بذور الديمو). |
| **DATA-03** | **ترحيل المفاتيح القديمة (Legacy Keys Migration)** | 🟢 **محلول (Resolved)** | تعمل دالة `migrateStorageOnce()` في `src/infrastructure/persistence/migrateStorage.ts` عند الإقلاع لترحيل البيانات من المفاتيح القديمة إلى المفاتيح الـ Canonical لمرة واحدة ثم تنظيف المفاتيح المهجورة. |

---

## 2. المزامنة مع الخادم وإدارة التعارض (Server Synchronization & Conflict Resolution)

| المعرف | المشكلة المرصودة | الحالة | التفاصيل الهندسية والحل المنفّذ |
| :--- | :--- | :--- | :--- |
| **SYNC-01** | **غموض توقيت المزامنة مع الخادم (`gmao_state.json`)** | 🟢 **محلول (Resolved)** | تم بناء خدمة `src/services/serverSyncService.ts` وتوفير أزرار تحكم يدوية صريحة («حفظ على الخادم» / «استعادة من الخادم») عبر كبسولة **Sync Serveur** في الشريط العلوي (`Header.tsx`) وبطاقة المزامنة في شاشة الإعدادات (`SettingsView.tsx` و `PerformanceDashboardPanel.tsx`)، مع حظر أي مزامنة صامتة متكررة في الخلفية (No Silent Background Polling). |
| **SYNC-02** | **غياب آلية فض التعارض بين نسخة المتصفح ونسخة الخادم** | 🟢 **محلول (Resolved)** | تم تطوير دالة `detectConflict` في `serverSyncService.ts` ونافذة فض التعارض التفاعلية `src/presentation/components/common/ServerSyncConflictModal.tsx` التي تعرض مقارنة كمية وزمنية دقيقة بين المتصفح و `gmao_state.json` وتمنح المستخدم الخيار الصريح بين فرض الحفظ المحلي أو استعادة بيانات الخادم أو الإلغاء، مع إضافة `DataGateway.loadFullServerState` لتطبيق الحالة مباشرة دون الحاجة لإعادة تحميل الصفحة. |

---

## 3. البنية المعمارية وبيئة التشغيل والنشر (Architecture, Runtime & Deployment)

| المعرف | المشكلة المرصودة | الحالة | التفاصيل الهندسية والحل المنفّذ |
| :--- | :--- | :--- | :--- |
| **ARCH-11** | **انقسام نسخ React في Vite dev cache وخطأ `Invalid hook call` (`useState` of null)** | 🟢 **محلول (Resolved)** | تم توحيد مسارات `react` و `react-dom` في `vite.config.ts` عبر `resolve.alias` و `dedupe`، وإدراج كافة الحزم الخارجية (`zustand`, `motion/react`, `recharts`, `exceljs`, `xlsx`, `hyperformula`, `react-window`, `zod`, إلخ) في `optimizeDeps.include`، وتحويل استيرادات الواجهات في `src/presentation/router/AppRouter.tsx` من `React.lazy` إلى استيرادات ثابتة مباشرة (Static Imports) لمنع إعادة التجميع المتأخرة أثناء التشغيل. |
| **DEPLOY-01** | **فشل تشغيل الخادم في بيئة الإنتاج Cloud Run بسبب مسار `app.get('*')` في Express 5** | 🟢 **محلول (Resolved)** | تم استبدال `app.get('*', ...)` بالصيغة المعيارية المتوافقة مع Express 5 (`path-to-regexp` v8) وهي `app.get('/{*splat}', ...)` في `server.ts`، مع تحويل استيراد `vite` إلى استيراد ديناميكي `await import('vite')` داخل بيئة التطوير فقط. |
| **SEC-01** | **حماية نقاط نهاية `/api/gmao/*` وترويسات الأمان** | 🟢 **محلول (Resolved)** | تم تطبيق ترويسات `CSP`، وتحديد معدل الطلبات (Rate Limiting)، والتحقق من الهوية عبر `authenticateApi` في `server.ts`. |

---

## 4. التصدير إلى GitHub وتنظيف المستودع من الملفات الزائدة (Git Export & Dead Code Cleanup)

| المعرف | المشكلة المرصودة | الحالة | التفاصيل الهندسية والحل المنفّذ |
| :--- | :--- | :--- | :--- |
| **GIT-01** | **فشل عملية Staging / Commit والتصدير إلى GitHub بسبب `git-lfs`** | 🟢 **محلول (Resolved)** | تم استبدال قواعد `filter=lfs diff=lfs merge=lfs -text` في `.gitattributes` بالمعيار القياسي المدمج في Git وهو `binary` لكافة الملفات الثنائية (`*.png`, `*.xlsx`, `*.pdf`, `*.zip`, إلخ)، وتحديث اختبار الوحدة `src/tests/unit/GitLfsConfiguration.test.ts` واجتيازه بنجاح. |
| **GIT-02** | **تضخم حمولة المزامنة (GitHub Trees API Payload Bloat)** | 🟢 **محلول (Resolved)** | تم تحديث `.gitignore` لاستثناء `/data/gmao_state.json` و `/GMAO_x5f_Light_x5f_Template_x5f_V2_x5f_Formules.xlsx`، وحذف الملفات الميتة غير المستخدمة (`GMAO_x5f_Light_x5f_Template_x5f_V2_x5f_Formules.xlsx`، `src/data/_legacy/seedData.ts`، `bun.lock`، وملفات `scripts/data_*.json`). |
| **GIT-03** | **استبعاد مجلد بذور البيانات `src/data/` بالخطأ في GitHub بسبب قاعدة `data/` غير المقيدة بالجذر في `.gitignore`** | 🟢 **محلول (Resolved)** | في معيار Git، القاعدة `data/` بدون شرطة مائلة بادئة تطابق أي مجلد باسم `data` في أي مستوى شجري بما في ذلك `src/data/` (الذي يضم 29 ملف `seed*.json` يستوردها `DataGateway.ts`). تم تقييد القاعدة بالجذر حصراً عبر `/data/` مع إضافة قاعدة استثناء صريحة `!/src/data/` لضمان رفع كافة ملفات البذور (`src/data/**`) إلى GitHub ونجاح البناء لدى أي مستخدم أو في CI/CD. |
| **ARCH-09** | **وجود مجلدات مكررة قديمة خارج `src/` (`/app/applet/` و `/mobile/`)** | 🟢 **محلول (Resolved)** | تم حذف المجلدين المكررين غير المستخدمين `/app` و `/mobile` الجذري (38 ملفاً زائداً) مع الحفاظ الكامل على `src/mobile/` وكافة ملفات `src/` الأصلية. |

---

## 5. تدقيق محرك المخزون، جدول الحركات، والصيانة العلاجية (Stock Actuel, Mouvements & Corrective Audit Plan)

> **حالة هذا القسم:** تم تنفيذ الخطة الثلاثية المعتمدة بالكامل والتحقق منها عبر اختبارات الوحدة الآلية (`src/tests/unit/StockMovementsCorrectiveSeeds.test.ts`).

| المعرف | المحور | المشكلة المرصودة (Root Cause & Evidence) | الحالة | خطة المعالجة والحل الهندسي المنفّذ |
| :--- | :--- | :--- | :--- | :--- |
| **STOCK-01** | **Stock Actuel & Index** | **ازدواجية نسخ `IncrementalStockIndex` (3 ملفات) و`StockCalculationService` (ملفان):**<br>1. `src/application/IncrementalStockIndex.ts` (النسخة المعيارية المعتمدة في `StockIndexStore` و`useAppCalculations`، توحد المفاتيح بـ `.trim().toUpperCase()` وتدعم `ENTREE / SORTIE / COMMANDE`).<br>2. `src/domain/pdr/services/IncrementalStockIndex.tsx` (نسخة مكررة غير مستخدمة في الإنتاج، توحد بـ `.toLowerCase()`).<br>3. `src/core/domain/services/IncrementalStockIndex.ts` (نسخة قديمة حساسة لحالة الأحرف بدون `toUpperCase()`).<br>4. `src/core/domain/services/StockCalculationService.ts` (نسخة مكررة تشترط `movement.type === 'Entrée'` حرفياً وتفشل مع `'Sortie Interne'`). | 🟢 **محلول (Resolved)** | **توحيد المرجع البرمجي وإزالة الكود الميت:**<br>- تم اعتماد `src/application/IncrementalStockIndex.ts` و `src/domain/pdr/services/StockCalculationService.ts` كمرجعين وحيدين في التطبيق مع استخدام `normalizeType` وتطبيع `.trim().toUpperCase()`.<br>- تم تحويل النسخ المكررة في `domain/pdr/services/IncrementalStockIndex.tsx` و `core/domain/services/*` إلى Re-exports مباشرة للنسخة المعيارية لمنع أي انقسام (Split-Brain Instance) مع الحفاظ على توافق كافة الاختبارات والـ Web Worker. |
| **STOCK-02** | **Stock Actuel vs Seeds** | **فجوة التطابق بين `seedStockItems.json` و `seedMouvements.json`:**<br>- يوجد في `seedStockItems.json` (873 مقالاً) **102 مقال** يختلف فيها `stockActuel` عن `stockInitial` (21 مقالاً بزيادة صافٍ `Entrée` و81 مقالاً بنقص صافٍ `Sortie` مثل `Raccord01`, `Raccord03`, `Raccord04`, `Distributeur05`, `Courroie21`).<br>- بسبب وجود حركتين فقط سابقاً في `seedMouvements.json`، كانت المعادلة الديناميكية (`stockInitial + entrees - sorties`) تُرجع `stockActuel = stockInitial` لـ 100 مقال عند تحميل الديمو، مما يُخفي حالات `RUPTURE` و `ALERTE` الفعلية. | 🟢 **محلول (Resolved)** | **مزامنة رياضية 100% بين بذرة الحركات وبذرة المخزون (دون تغيير معادلة العرض):**<br>- تم اشتقاق حركات الديمو في `seedMouvements.json` من الفروق الفعلية للـ 102 مقال بحيث يُنتج محرك الحساب الديناميكي تطابقاً بنسبة 100% (`0 mismatches`) مع أرصدة المصنع المرجعية، وتظهر حالات `RUPTURE` (مثل `Distributeur05 = 0`) و`ALERTE` تلقائياً.<br>- عند كون `rawStock` فارغاً (`[]`) بعد `Clear Factory`، يُرجع `calculateStockItems` المصفوفة `[]` فوراً دون أي سقوط احتياطي. |
| **MOV-01** | **Tableau des Mouvements** | **هشاشة بذرة الحركات (`seedMouvements.json`) وتطابق المراجع (`ref`):**<br>- كان `seedMouvements.json` يحتوي على سجلين فقط، مما يجعل جدول الحركات يبدو شبه فارغ في وضع الديمو. | 🟢 **محلول (Resolved)** | **بناء سجل حركات ديمو متكامل وموثق المراجع:**<br>- تم تحديث `seedMouvements.json` ليضم **102 حركة** (`Sortie Interne` و `Entrée`) بمراجع `ref` مطابقة 100% لـ `seedStockItems.json` ومربوطة بآلات وفنيين حقيقيين.<br>- تم التحقق من التصفير الكامل (`[]` + `stockIndexStore.reset()`) عند `clearAllForRealFactory`. |
| **CORR-01** | **Corrective (DI / BT)** | **ضعف بذرة التدخلات العلاجية (`seedCorrectiveInterventions.json`) وعدم اتساقها مع القواميس والمخزون:**<br>- كان `seedCorrectiveInterventions.json` يضم سجلين فقط موسومين بالخطأ `"travail_a_faire": "préventive"` وبمراجع قطع غير موجودة في `seedStockItems.json`. | 🟢 **محلول (Resolved)** | **إثراء وتصحيح بذرة الصيانة العلاجية وربطها العلائقي:**<br>- تم تحديث `seedCorrectiveInterventions.json` بـ **12 تدخلاً علاجياً متوازناً (`BT/DI`)** تغطي الفئات الأربع (`M`, `E`, `H`, `P`) ومختلف حالات دورة الحياة (`CLOTURE`, `EN_COURS`, `EN_ATTENTE_PDR`).<br>- تم ربط كافة التدخلات بآلات حقيقية (`DET-05`, `DET-08`, `PCE-01`, `FRL-01..04`) وفنيين حقيقيين ومراجع قطع غيار `pdr_ref` مطابقة لـ `seedStockItems.json` (`paliers01`, `Courroie28`, `Raccord01`, `Distributeur05`, إلخ). |
| **DATA-04** | **Preventive Persistence (P0 Separate Track)** | **بقاء أو عودة مهام الصيانة الوقائية (`Preventive` — 1175 مهمة) بعد التفريغ بسبب 5 ثغرات متداخلة:**<br>1. **سباق `IndexedDB` غير المتزامن (L2 Hydration Race):** `hydrateFromIndexedDB` في `useGmaoPersistence.ts` كان يستعيد النسخة القديمة من `IndexedDB` إذا كان المفتاح في `localStorage` مصفوفة فارغة `[]` (`existing.length === 0`).<br>2. **انبعاث المفاتيح القديمة (Stage 2 Legacy Key Resurrection):** `clearAllForRealFactory` لم يكن يحذف المفاتيح القديمة (`gmao_preventive_tasks_v8`, `gmao_preventive_tasks`, إلخ)، مما يسمح للمرحلة الثانية في `loadCollection` بإعادة ملء المفتاح الـ Canonical عند كون قيمته `[]`.<br>3. **ازدواجية الحالة (`usePreventiveSubState.ts`):** وجود hook موازٍ بـ `useEffect` يكتب تلقائياً عند التغيير بمعزل عن `useGmaoStore`.<br>4. **نقص تفويض الدوال في `PreventiveService.ts`:** غياب `getTasks`, `saveTasks`, `bulkImportTasks`, `updateTaskStatus` في الواجهة الموحدة مما يكسر استيراد المهام وتحديث حالتها.<br>5. **أرقام احتياطية مضللة في واجهة الإعدادات (`SettingsView` / `SettingsOverviewTab` / `SettingsInjectionTab`):** وجود `preventiveTasks?.length \|\| 1175` و `stock?.length \|\| 800` يجعل العدادات تعرض `1175` و `800` حتى عندما تكون المصفوفة الفعلية `0` بعد التفريغ! | 🟢 **محلول (Resolved)** | **تطهير جذري لطبقات التخزين وتوحيد الحالة والواجهة:**<br>- **حماية `hydrateFromIndexedDB`:** منع الاستعادة من `IndexedDB` عندما يكون `START_MODE === 'empty'` أو عندما يكون المفتاح الـ Canonical مصفوفة موجودة صراحةً في `localStorage` (`existing !== null`).<br>- **تطهير المفاتيح القديمة و `IndexedDB`:** إضافة `DataGateway.purgeLegacyKeysFor()` ومسح `ALL_LEGACY_KEYS` و `indexedDBService.clearAll()` داخل `clearAllForRealFactory` و `clearDemoSection('preventive')`، مع تعطيل Stage 2 في `migrateStorage.ts` عند وضع المصنع الفارغ.<br>- **توحيد الحالة:** تحويل `usePreventiveSubState.ts` إلى غلاف مباشر لـ `usePreventiveSlice` من `useGmaoStore`، وربط حدث `preventive_tasks_updated` بـ `useGmaoPersistence.ts`، واستكمال كافة دوال `PreventiveService.ts` و `TaskService.ts`.<br>- **إزالة الأرقام الوهمية:** حذف كافة معاملات `\|\| 1175` و `\|\| 800` و `\|\| 185` من مكونات `SettingsView` لتعكس الصفر الحقيقي (`0`) فور التفريغ.<br>- **التحقق الآلي:** تم إثبات الحل باختبارات `src/tests/unit/PreventiveClearPersistence.test.ts`. |

---

## 6. الأداء، الاختبارات، PWA، وتوثيق API (Performance, CI/CD, PWA & OpenAPI)

| المعرف | المشكلة / التحسين المرصود | الحالة | التفاصيل الهندسية والحل المنفّذ / المخطط |
| :--- | :--- | :--- | :--- |
| **PERF-03** | **تحسين التمرير الافتراضي (Virtual Scrolling) وإضافة Infinite Scroll للجداول الضخمة** | 🟢 **محلول (Resolved)** | تم دمج `@tanstack/react-virtual` إلى جانب `react-window` في كل من `VirtualizedTable.tsx` و `GmaoIndustrialDataGrid.tsx` لدعم عرض 10,000+ سجل بسرعة 60fps، مع إنشاء الخطاف `src/hooks/useInfiniteScroll.ts` للتحميل التدريجي اللانهائي. |
| **TEST-02** | **أتمتة الاختبارات الشاملة (CI/CD, Coverage, Integration & Playwright E2E)** | 🟢 **محلول (Resolved)** | تم ترقية `.github/workflows/ci-cd.yml` ليشمل 5 مراحل (Quality Gates, Unit Tests + V8 Coverage `@vitest/coverage-v8`, Integration Tests, Playwright E2E `playwright.config.ts` + `e2e/specs/gmao.spec.ts`, Build Artifacts)، مع أتمتة اختبار بروتوكول `MANUAL_SSOT_TEST` الخماسي وفض التعارض في `src/tests/integration/EnhancementsAndSsotIntegration.test.ts`. |
| **PWA-01** | **ترقية Service Worker ودعم Background Sync و Push Notifications** | 🟢 **محلول (Resolved)** | تم تحديث `public/service-worker.js` إلى معمارية الكاش ثلاثية الطبقات (`gmao-v4`, `gmao-data-v4`, `gmao-assets-v4`) مع تنظيف تلقائي للحجم (LRU)، ودعم `Background Sync` (`sync-gmao-data`) و `Push Notifications`، وإنشاء `src/utils/notificationService.ts` وتفعيل `runtimeCaching` لـ `/api/gmao/*` في `vite.config.ts`. |
| **API-01** | **توثيق API التفاعلي عبر OpenAPI 3.0 / Swagger** | 🟢 **محلول (Resolved)** | تم إنشاء `src/config/swaggerConfig.ts` وربط واجهة التوثيق التفاعلية على المسارين `/api/docs` و `/api/docs.json` في `server.ts` مع توثيق المصادقة `X-GMAO-API-TOKEN` وكافة نقاط النهاية (`/api/health`, `/api/gmao/state`, `/api/gmao/:entity`). |
| **ARCH-12** | **تسلل الآلات المؤرشفة / غير النشطة إلى قوائم إنشاء المهام وأوامر العمل الجديدة** | 🟢 **محلول (Resolved)** | تم إنشاء المرشح الموحد `src/utils/activeMachines.ts` (`filterActiveMachines`, `getActiveMachineCodes`) لاستبعاد أي آلة تحمل حالة `ARCHIVEE / ARCHIVÉE / ARCHIVED / ARCHIVE` أو `is_active === false` أو `actif === false` من قوائم الاختيار وإنشاء المهام الوقائية أو التدخلات العلاجية (`BonsTravailTab.tsx`، `PlanningPreventifView.tsx`، `dataIntegrityService.ts`)، مع الحفاظ على السجلات التاريخية المرتبطة بها (Soft Delete). |
| **SEC-02** | **عزل أسرار بيئة التشغيل ومنع تسرب `.env.local` إلى المستودع** | 🟢 **محلول (Resolved)** | تم ضبط `.gitignore` لاستثناء `.env` و `.env.local` و `.env.*.local`، وتوثيق المتغيرات المطلوبة في `.env.example` فقط (`VITE_SECRET_KEY`, `VITE_CRYPTO_KEY`, `GMAO_API_TOKEN`) بدون أي مفاتيح حقيقية في المستودع، وتحصين `server.ts` بالتحقق من `GMAO_API_TOKEN`. |
| **IOT-01** | **الربط المباشر مع حساسات المصنع الحية (MQTT / OPC-UA)** | 🔴 **مفتوح (Open / Backlog)** | حالياً يتم تحديث العدادات والساعات يدوياً أو عبر استيراد Excel؛ الربط المباشر مع بروتوكولات المصنع الحية مدرج ضمن خارطة الطريق المستقبلية. |

---

## 7. مصفوفة التحقق الخماسية والاختبارات الحرجة المعتمدة (Five-Point Verification & Critical Test Matrix)

> يوثق هذا القسم البنود الخمسة الحاسمة المعتمدة لضمان استقرار النظام دون المساس بالمحركات المستقرة (`IncrementalStockIndex`, `StockCalculationService`):

| البند | النطاق الهندسي | الآلية المطبقة في الشيفرة | ملف التحقق الآلي | الحالة |
| :--- | :--- | :--- | :--- | :--- |
| **1) إثبات التفريغ الشامل والصمود بعد `F5`** | `Load Demo` ← `Clear All` ← `F5`: بقاء `Preventive` و `Stock` و `Movements` و `Corrective` فارغة تماماً (`[]`) وعرض العدادات `0`. | كتابة `[]` في المفاتيح الـ Canonical، حذف `ALL_LEGACY_KEYS` و `FULL_STATE_SNAPSHOT`، مسح `IndexedDB`، تثبيت `START_MODE = 'empty'`، ومنع `hydrateFromIndexedDB` أو `migrateStorage` من الكتابة فوق `[]`. | `src/tests/unit/PreventiveClearPersistence.test.ts`<br>`src/tests/unit/ThreeCriticalPaths.test.ts` | 🟢 **محلول ومُثبت** |
| **2) جولة الديمو المترابطة (10 دقائق)** | ترابط `Stock actuel` (873 مقالاً مع ظهور `RUPTURE` و `ALERTE`) + `Mouvements` (102 حركة) + `Corrective` (12 تدخلاً علاجياً بدون وسم `préventive` خاطئ). | تطابق 100% بين `seedStockItems.json` و `seedMouvements.json` (102 حركة تغطي فروق الـ 102 مقال)، وربط `seedCorrectiveInterventions.json` (12 سجل `BT/DI`) بمراجع `pdr_ref` وآلات وفنيين حقيقيين. | `src/tests/unit/StockMovementsCorrectiveSeeds.test.ts`<br>`src/tests/unit/ThreeCriticalPaths.test.ts` | 🟢 **محلول ومُثبت** |
| **3) الحفاظ على المحركات المستقرة (Do Not Touch What Works)** | عدم إعادة كتابة `IncrementalStockIndex` أو `StockCalculationService` أو إضافة محركات صيغ مكررة أو `bcryptjs`. | الإبقاء على `src/application/IncrementalStockIndex.ts` و `src/domain/pdr/services/StockCalculationService.ts` كمرجع وحيد مع توجيه المسارات القديمة عبر `re-export` فقط دون تغيير معادلة الرصيد. | `src/tests/unit/StockMovementsCorrectiveSeeds.test.ts` | 🟢 **ملتزم بالكامل** |
| **4) المسارات الاختبارية الحرجة الثلاثة** | 1. معادلة `stockInitial + entrées − sorties` على عينة البذرة.<br>2. `clearAll` يصفر مفاتيح `Preventive` (الـ Canonical + الـ Legacy).<br>3. استبعاد الآلات المؤرشفة من قوائم إنشاء مهمة جديدة. | تنفيذ اختبارات صارمة تغطي المسارات الثلاثة في `ThreeCriticalPaths.test.ts` إلى جانب اختبارات التكامل الشاملة في `EnhancementsAndSsotIntegration.test.ts`. | `src/tests/unit/ThreeCriticalPaths.test.ts` | 🟢 **مجتاز (3/3)** |
| **5) أمان بيئة التشغيل (`Runtime & Secrets`)** | عزل `.env.local` (`VITE_SECRET_KEY`, `VITE_CRYPTO_KEY`, `GMAO_API_TOKEN`) وعدم رفع الأسرار إلى Git وحماية الخادم. | حذف أي ملف `.env.local` من شجرة العمل، تحصين `.gitignore`، وقصر التوثيق على `.env.example` مع إلزامية `X-GMAO-API-TOKEN` في `server.ts`. | `src/tests/unit/GitLfsConfiguration.test.ts` | 🟢 **محلول ومُثبت** |
