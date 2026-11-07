# 🛡️ سجل الضمانات الهندسية والقائمة المفتوحة المختصرة (`ISSUES_AND_FIXES_PLAN.md`)

> **قاعدة التوثيق المعتمدة:**
> كل بند تم إغلاقه والتحقق منه آلياً يُنقل من «سجل المشاكل» إلى **سجل القدرات والقرارات المعمارية (`Capability / Design Decision`)** في [`ARCHITECTURE.md`](./ARCHITECTURE.md)، ويُحفظ تاريخه التفصيلي في الأرشيف الهندسي:
> - 🏛️ **وثيقة القدرات والقرارات المعمارية (للمستثمر والمبرمج):** [`ARCHITECTURE.md`](./ARCHITECTURE.md)
> - 🗺️ **خارطة الطريق والمراحل (`P0` → `P6`):** [`ROADMAP_AND_PHASES_PLAN.md`](./ROADMAP_AND_PHASES_PLAN.md)
> - 🗄️ **أرشيف الجولات المغلقة (`Rounds 1–7` & `v4`):** [`docs/history/ARCHIVED_ISSUES_ROUNDS_1_TO_7.md`](./docs/history/ARCHIVED_ISSUES_ROUNDS_1_TO_7.md) | [`docs/history/ARCHIVED_ISSUES_PLAN_v4.md`](./docs/history/ARCHIVED_ISSUES_PLAN_v4.md)

---

## 1️⃣ ملخص القدرات والضمانات المُثبتة (Verified Capabilities Summary)

جميع المسارات الحرجة للعمود الفقري مُغلقة ومُثبتة باختبارات الوحدة والتكامل (`Vitest` + `TypeScript` + `ESLint`):

| الركيزة | القدرة الهندسية المُثبتة (Capability / Design Decision) | مرجع الاختبار الآلي |
| :--- | :--- | :--- |
| **مصدر الحقيقة والتفريغ (`SSOT`)** | مسار أحادي عبر `DataGateway.ts` لـ 32 مفتاحاً؛ تفريغ المصنع (`clearAllForRealFactory`) يصفر جميع الجداول والـ `IndexedDB` والمفاتيح القديمة ويثبت `START_MODE = 'empty'` بصمود تام بعد `F5`. | `PreventiveClearPersistence.test.ts`<br>`ThreeCriticalPaths.test.ts` |
| **محرك المخزون (`Inventory`)** | معادلة رصيد حتمية (`stockInitial + entrées − sorties`) عبر مرجع وحيد (`IncrementalStockIndex.ts`) مع تطابق 100% لبذور الديمو (`873` مقالاً و`102` حركة) ومنع الخصم المزدوج. | `StockMovementsCorrectiveSeeds.test.ts`<br>`Round3StateAndWiringFixes.test.ts` |
| **الذاكرة الزمنية و`FSM`** | فصل الخطة الوقائية عن حدث التنفيذ المؤرخ (`PreventiveExecution`)، وضبط دورة حياة أوامر العمل عبر آلة حالة صارمة (`WorkOrderStateMachine.ts`) تمنع إعادة الإغلاق. | `Phase1FactoryMemory.test.ts`<br>`Round6FsmAndMonthlyReport.test.ts` |
| **التقرير الشهري (`Monthly Close`)** | حساب مؤشرات الشهر (`MonthlyReportCalculationService.ts`) و`MTTR/MTBF/Availability` من السجلات المؤرخة مباشرة مع مقارنة `MoM Delta` وتصدير `PDF / Excel` متعدد الأوراق. | `Round6FsmAndMonthlyReport.test.ts` |
| **الأمان والمضيف الشبكي (`LAN Host`)** | حماية `/api/gmao/*` بتوكن `X-GMAO-API-TOKEN` وقائمة `ALLOWED_ENTITIES` وصلاحيات `RBAC` (`x-gmao-role`)، مع كتابة ذرية متسلسلة (`.tmp` ➔ `rename`) ورقم إصدار `version / 409 Conflict` وبث `LAN QR + SSE`. | `Round4ServerSyncAndConcurrency.test.ts`<br>`Round5RbacAndSecurity.test.ts`<br>`Round7LanArchitectureAndRefactoring.test.ts` |
| **نظافة المعمارية والمستودع** | تفكيك `SettingsView.tsx` إلى 10 مكونات معيارية رشيقة، عزل الأسرار في `.env.example`، وضبط `.gitignore` و`.gitattributes` لسلامة التصدير إلى GitHub. | `Round7LanArchitectureAndRefactoring.test.ts`<br>`GitLfsConfiguration.test.ts` |

---

## 2️⃣ القائمة المفتوحة المختصرة (Short Active Backlog)

لا إصلاحات عشوائية خارج هذه القائمة؛ كل بند مفتوح محدد بمعيار إغلاق واضح:

| المعرف | المرحلة | البند المفتوح | معيار الإغلاق القابل للتحقق (Stage Gate) | الحالة |
| :--- | :--- | :--- | :--- | :--- |
| **P4.1 / P4.2** | **P4** | استكمال مفاتيح الترجمة المزدوجة (`FR / AR`) وتوحيد تباين الثيم (`Industrial Dark / High-Contrast Light`) في النوافذ الفرعية المتبقية. | تبديل اللغة والثيم في كافة الشاشات دون نصوص ثابتة غير مترجمة. | 🟡 **جزئي** |
| **P5.1 / P5.2** | **P5** | ربط واجهة الهاتف الميدانية المختزلة (`Field Mobile Mode`) بإنشاء `PreventiveExecution` المباشر والتبديل التلقائي/اليدوي السلس. | تنفيذ مهمة وقائية وصرف قطعة غيار من واجهة الهاتف في أقل من 30 ثانية وظهورها في التقرير الشهري. | 🟡 **جزئي** |
| **P5.3** | **P5** | تغليف تطبيق الحاسوب المضيف (`Desktop Host Packaging` لـ Windows/Mac) لتشغيل `server.ts` تلقائياً بضغطة زر. | حزمة تشغيل محلية مستقلة تفتح الخادم والواجهة دون تثبيت أدوات برمجية. | 🔴 **مجدول** |
| **P6.1..P6.3** | **P6** | حصر كتابة ملف `Excel` الشبكي بالمضيف (`Host-Only Excel Writer`) مع طابور انتظار عند قفل الملف (`EBUSY Retry Queue`). | عدم انهيار التزامن عند كون ملف Excel مفتوحاً للمشاهدة على جهاز آخر في الشبكة. | 🔴 **مجدول** |
| **IOT-01** | **Future** | الربط المباشر مع حساسات المصنع الحية (`MQTT / OPC-UA`) لتحديث عدادات الساعات آلياً. | استقبال قراءات العدادات من وسيط MQTT وتحديث استحقاق الصيانة الوقائية تلقائياً. | 🔴 **مجدول (Backlog)** |
