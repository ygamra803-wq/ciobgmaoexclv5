# 🗄️ الأرشيف الهندسي لجولات التدقيق والإصلاح (Archived Engineering Audit — Rounds 1 to 7)

> **حالة المستند:** أرشيف تاريخي مغلق (`Archived & Verified`).
> جميع البنود الواردة في هذا السجل تم حلها، والتحقق منها بالاختبارات الآلية، وتحويلها إلى **ضمانات تصميم وقدرات معمارية دائمة** في [`ARCHITECTURE.md`](../../ARCHITECTURE.md).

---

## 1. وحدة المصدر المرجعي للبيانات والتخزين (Data SSOT & Persistence)

| المعرف | المشكلة التاريخية التي عُولجت | الضمانة الهندسية المعتمدة |
| :--- | :--- | :--- |
| **DATA-01** | تعارض البيانات بعد Clear / Reset / Demo وانبعاث بذور الديمو عند F5 | حصر كافة مسارات الكتابة والتفريغ والتحميل عبر `src/application/DataGateway.ts` كمسار كتابة أحادي (`Single Write Path`) مع تثبيت `DEMO_MODE = false` و `START_MODE = 'empty'`. |
| **DATA-02** | غياب بروتوكول اختبار يدوي موثق للتحقق من ثبات SSOT | توثيق وأتمتة بروتوكول الاختبار الخماسي في `docs/MANUAL_SSOT_TEST.md` و `EnhancementsAndSsotIntegration.test.ts`. |
| **DATA-03** | ترحيل المفاتيح القديمة (Legacy Keys Migration) | ترحيل لمرة واحدة عبر `migrateStorageOnce()` مع تنظيف المفاتيح المهجورة. |
| **DATA-04** | بقاء مهام الصيانة الوقائية بعد التفريغ | تطهير `ALL_LEGACY_KEYS` و `indexedDBService.clearAll()` داخل `clearAllForRealFactory` وحماية `hydrateFromIndexedDB` وإزالة الأرقام الاحتياطية الوهمية من الواجهات (`PreventiveClearPersistence.test.ts`). |

---

## 2. المزامنة مع الخادم وإدارة التعارض (Server Synchronization & Conflict Resolution)

| المعرف | المشكلة التاريخية التي عُولجت | الضمانة الهندسية المعتمدة |
| :--- | :--- | :--- |
| **SYNC-01** | غموض توقيت المزامنة مع الخادم (`gmao_state.json`) | بناء `src/services/serverSyncService.ts` مع تحكم صريح ومزامنة خلفية مضبوطة بدون استقصاء صامت عشوائي. |
| **SYNC-02** | غياب آلية فض التعارض بين نسخة المتصفح ونسخة الخادم | تطوير `detectConflict` ونافذة `ServerSyncConflictModal.tsx` مع دعم `409 Conflict` عبر `version / ETag`. |

---

## 3. البنية المعمارية وبيئة التشغيل والمستودع (Architecture, Runtime & Git)

| المعرف | المشكلة التاريخية التي عُولجت | الضمانة الهندسية المعتمدة |
| :--- | :--- | :--- |
| **ARCH-09 / ARCH-11** | مجلدات مكررة قديمة وانقسام نسخ React في Vite | حذف المجلدات الميتة خارج `src/`، وتوحيد `resolve.alias` و `dedupe` في `vite.config.ts`. |
| **ARCH-12** | تسلل الآلات المؤرشفة إلى قوائم الإنشاء الجديدة | اعتماد المرشح الموحد `src/utils/activeMachines.ts` (`filterActiveMachines`) مع الحفاظ على التاريخ (`Soft Delete`). |
| **DEPLOY-01 / SEC-01 / SEC-02** | توافق Express 5 وعزل الأسرار وحماية `/api/gmao/*` | صيغة `app.get('/{*splat}')`، عزل `.env.local`، وإلزامية `X-GMAO-API-TOKEN` وقائمة `ALLOWED_ENTITIES` البيضاء. |
| **GIT-01 / GIT-02 / GIT-03** | قواعد Binary و `.gitignore` لبذور `src/data/` | ضبط `.gitattributes` على `binary` وتقييد `/data/` بالجذر مع استثناء `!/src/data/` (`GitLfsConfiguration.test.ts`). |

---

## 4. محرك المخزون والحركات والصيانة العلاجية (Stock, Movements & Corrective)

| المعرف | المشكلة التاريخية التي عُولجت | الضمانة الهندسية المعتمدة |
| :--- | :--- | :--- |
| **STOCK-01 / STOCK-02** | ازدواجية نسخ `IncrementalStockIndex` وتطابق البذور | توحيد المرجع في `src/application/IncrementalStockIndex.ts` و `src/domain/pdr/services/StockCalculationService.ts` ومزامنة `seedMouvements.json` رياضياً بنسبة 100% (`0 mismatches`). |
| **MOV-01 / CORR-01** | اتساق بذرة الحركات والتدخلات العلاجية | 102 حركة مرجعية و12 تدخلاً علاجياً (`BT/DI`) مربوطة بآلات وفنيين ومراجع قطع حقيقية (`StockMovementsCorrectiveSeeds.test.ts`). |

---

## 5. جولات التدقيق المؤسسي الشامل (Rounds 3 to 7)

| المعرف | الجولة | الضمانة الهندسية المعتمدة واختبار التحقق |
| :--- | :--- | :--- |
| **C-02 / C-03 / C-04** | **Round 3** | توحيد مفاتيح الصيانة العلاجية في `useGmaoStore.ts`، تمرير `preventiveExecutions` في `App.tsx`، ومنع الخصم المزدوج للمخزون في `PreventiveView.tsx` (`Round3StateAndWiringFixes.test.ts`). |
| **H-01..H-06 / M-01** | **Round 3** | فحص ارتباط الآلات قبل حذف المنطقة أو أرشفة الفني، مقارنة النص الكامل في `useAutoSave.ts`، وربط `onCreateCorrective` وأزرار الهاتف السريعة (`Round3StateAndWiringFixes.test.ts`). |
| **C-01 / H-04** | **Round 4** | طابور كتابة ذري غير حاجب (`.tmp` ➔ `rename`) في `server.ts`، عداد إصدار `version / ETag` مع حماية `409 Conflict`، وسجل تدقيق إلحاقي `data/gmao_audit.jsonl` (`Round4ServerSyncAndConcurrency.test.ts`). |
| **M-02 / C-05** | **Round 5** | مصفوفة صلاحيات الأدوار المؤسسية (`RBAC`) في `AuthorizationService.tsx` و `AppRouter.tsx`، وفحص `x-gmao-role` وتوكن API على الخادم (`Round5RbacAndSecurity.test.ts`). |
| **M-03 / M-04** | **Round 6** | آلة الحالة المحدودة `WorkOrderStateMachine.ts` لمنع الانتقالات غير الصالحة وإعادة الإغلاق، دقة مؤشرات `MTTR / MTBF / Availability`، وشاشة التقرير الشهري التنفيذي وتصدير Excel متعدد الأوراق (`Round6FsmAndMonthlyReport.test.ts`). |
| **M-05 / P3.1..P3.4** | **Round 7** | تفكيك `SettingsView.tsx` إلى 10 مكونات فرعية معيارية، وبناء معمارية المضيف الشبكي (`HOST` مقابل `LAN_CLIENT`) عبر `networkConfigService.ts` ونقاط `/api/network/info` و `/api/gmao/revision` و `/api/gmao/events` (`Round7LanArchitectureAndRefactoring.test.ts`). |
