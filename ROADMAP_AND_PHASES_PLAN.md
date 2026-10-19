# 🗺️ خارطة الطريق المعمارية وخطة المراحل المفصّلة — CIOB GMAO v4 (`ROADMAP_AND_PHASES_PLAN.md`)

> **المرجعية الهندسية:** يُعد هذا المستند المرجع التتبّعي الحي (Living Architectural Roadmap) لكافة مراحل تطوير وترقية **CIOB GMAO v4** بعد استقرار المصدر المرجعي للبيانات (`SSOT`)، ومحرك المخزون (`IncrementalStockIndex`)، وبروتوكول تفريغ المصنع (`clearAllForRealFactory`).
> - لسجل المشاكل والحلول الأساسية المنفذة في البنية التحتية، راجع: [`ISSUES_AND_FIXES_PLAN.md`](./ISSUES_AND_FIXES_PLAN.md).
> - **قاعدة التحديث:** بعد كل تعديل برمجي أو إغلاق لأي بند، يتم تحديث حالة البند في هذه الوثيقة فوراً مع ذكر الملفات المعدّلة واختبارات التحقق.

---

## ⚖️ دستور العمل الهندسي (Core Engineering Rules)

1. **لا إعادة بناء من الصفر (No Rewrite from Scratch):** البناء تراكمي فوق الطبقات الحالية (`DataGateway`, `useGmaoStore`, `server.ts`, `IncrementalStockIndex`).
2. **لا لمس لمحرك المخزون المستقر:** يُحظر تعديل `src/application/IncrementalStockIndex.ts` أو `src/domain/pdr/services/StockCalculationService.ts` إلا لخلل مُثبت بدليل رقمي.
3. **الفصل الصارم بين «المرجع الثابت» و«الحدث المؤرخ»:** الآلات، المقالات، وخطط الصيانة هي قواميس مرجعية؛ أما تنفيذ صيانة أو صرف قطعة أو عطل فهي أحداث تاريخية لا تمسح ما قبلها.
4. **عقدة الحقيقة الواحدة (Single Host Brain / Octopus Architecture):** خادم المضيف (`Host`) هو المالك الوحيد للحالة وملف الإكسل الشبكي؛ كافة الهواتف والمتصفحات والحواسيب الأخرى هي أطراف عميلة (`Clients`) تقرأ وتكتب عبر `API` المضيف حصراً.
5. **بوابة إغلاق كل مرحلة (Stage Gate):** لا انتقال لمرحلة تالية قبل إغلاق معيار القبول اليدوي والآلي للمرحلة الحالية.

---

## 📊 دليل حالات التصنيف (Status Legend)

| الرمز | الحالة | التعريف الهندسي |
| :--- | :--- | :--- |
| 🟢 | **منجز ومُثبت (Completed & Verified)** | تم التنفيذ في الشيفرة المصدرية والتحقق منه عبر الاختبارات الآلية (`vitest` / `compile_applet`) ومعيار القبول. |
| 🟡 | **قيد التنفيذ / جزئي (In-Progress / Partial)** | البنية التحتية موجودة جزئياً أو جاري استكمالها برمجياً. |
| 🔴 | **مجدول (Planned / Pending)** | موثق بالكامل وجاهز للتنفيذ في دوره المعماري حسب ترتيب المراحل. |

---

## 🧭 نظرة عامة على المراحل (Master Phases Overview)

| المرحلة | الاسم | الهدف المعماري والتشغيلي | الحالة العامة | الترتيب والاعتمادية |
| :--- | :--- | :--- | :--- | :--- |
| **P0** | **تثبيت وتشغيل (Baseline Stability)** | منع الانحدار، إثبات التفريغ الشامل، جولة الديمو المترابطة، أمان المفاتيح | 🟢 **منجز ومُثبت** | الأساس المنجز (مربوط بـ `ISSUES_AND_FIXES_PLAN.md`) |
| **P1** | **الزمن والتاريخ (Event-Sourced History)** | تحويل النظام من «حالة آنية» إلى «ذاكرة مصنع مؤرخة» (`PreventiveExecution` + فلاتر الشهر) | 🟢 **منجز ومُثبت بالكامل** | يعتمد على `P0` |
| **P2** | **تقارير وإدارة (Management & Monthly Close)** | تقديم قيمة مالية وتشغيلية لأصحاب المصنع (تقرير إغلاق الشهر + التصدير) | 🔴 **مجدول** | يعتمد على `P1` |
| **P3** | **مضيف الشبكة (LAN Host Single Brain)** | توحيد الحقيقة عبر خادم مركزي واحد على الشبكة المحلية ومنع الكتابة المتوازية | 🟡 **جزئي (أساس `server.ts` موجود)** | يعتمد على `P1` |
| **P4** | **واجهة وجودة (UX, i18n, Theme & RBAC)** | تحسين تجربة الاستخدام، التعريب، الثيم الموحد، وصلاحيات الأدوار الخفيفة | 🟡 **جزئي (مستمر بالتوازي الخفيف)** | بالتوازي دون كسر `P1–P3` |
| **P5** | **منصات وأطراف (Mobile Field UI & Desktop Host)** | واجهة هاتف ميدانية مختزلة للمهام السريعة (`/m`) + تغليف سطح المكتب (`Windows/Mac`) | 🟡 **جزئي (`src/mobile` موجود للتهذيب)** | يعتمد على `P1` و `P3` |
| **P6** | **إكسل الشبكي الناضج (Excel Mirror & Lock Discipline)** | تحويل ملف Excel الشبكي إلى مرآة رسمية يديرها المضيف حصراً دون تعارض أقفال (`EBUSY`) | 🟡 **جزئي (`excelSyncService` موجود)** | يعتمد على `P3` |

---

## 🛡️ المرحلة P0 — تثبيت وتشغيل (Baseline Stability & Zero Regression)

> **الهدف:** بناء أرضية صلبة لا تنهار عند التفريغ أو التحديث (`F5`) أو تحميل الديمو، مع حماية المحركات الأساسية.

| المعرف | البند التفصيلي | التوصيف الهندسي والملفات المعنية | معيار القبول والتحقق | الحالة |
| :--- | :--- | :--- | :--- | :--- |
| **P0.1** | **تفريغ المصنع الكامل والصمود بعد `F5`** | `clearAllForRealFactory` يصفر كافة المفاتيح الـ Canonical والـ Legacy ويمسح `IndexedDB` ويثبت `START_MODE = 'empty'` (`DataGateway.ts`, `useGmaoPersistence.ts`, `migrateStorage.ts`). | `Load Demo` ← `Clear All` ← `F5`: تبقى `Preventive`, `Stock`, `Movements`, `Corrective` فارغة (`0`). | 🟢 **منجز ومُثبت** (`PreventiveClearPersistence.test.ts`) |
| **P0.2** | **جولة الديمو المترابطة (10 دقائق)** | ترابط `seedStockItems.json` (873 مقالاً) مع `seedMouvements.json` (102 حركة) لظهور حالات `RUPTURE/ALERTE`، و12 تدخلاً علاجياً في `seedCorrectiveInterventions.json` بمراجع قطع حقيقية. | تطابق رياضي 100% (`0 mismatches`) بين الحركات وأرصدة المخزون في الديمو. | 🟢 **منجز ومُثبت** (`StockMovementsCorrectiveSeeds.test.ts`) |
| **P0.3** | **عزل الأسرار وتأمين الخادم** | عدم تتبع `.env.local` في Git، توثيق `.env.example` فقط، وحماية `/api/gmao/*` عبر `X-GMAO-API-TOKEN` في `server.ts`. | خلو المستودع من أي أسرار، واجتياز `GitLfsConfiguration.test.ts`. | 🟢 **منجز ومُثبت** |
| **P0.4** | **المسارات الاختبارية الحرجة الثلاثة** | 1. معادلة الرصيد `stockInitial + entrées - sorties`.<br>2. تصفير مفاتيح `Preventive` (الـ Canonical + الـ Legacy).<br>3. استبعاد الآلات المؤرشفة (`filterActiveMachines`). | اجتياز `src/tests/unit/ThreeCriticalPaths.test.ts` بالكامل (3/3). | 🟢 **منجز ومُثبت** |

---

## ⏳ المرحلة P1 — الزمن والتاريخ (Event-Sourced Factory Memory)

> **الهدف:** الانتقال من «أداة تعرض الحالة الآنية فقط» إلى «ذاكرة مصنع تاريخية» تفصل بين الخطة الثابتة وسجل التنفيذ الفعلي، وتمكّن من تصفية أي شهر بدقة.

| المعرف | البند التفصيلي | التوصيف الهندسي الدقيق (Data Models & Mechanics) | الملفات المستهدفة | الحالة |
| :--- | :--- | :--- | :--- | :--- |
| **P1.1** | **نموذج حدث تنفيذ الصيانة الوقائية (`PreventiveExecution`)** | إنشاء كيان مستقل لسجل التنفيذ بدلاً من الاكتفاء بتبديل حالة المهمة:<br>- `id: string`<br>- `taskId: string`<br>- `machineCode: string`<br>- `executedAt: string`<br>- `periodMonth: string` (`YYYY-MM`) | `src/types.ts`<br>`src/application/services/preventive/ExecutionService.ts`<br>`src/application/DataGateway.ts` | 🟢 **منجز ومُثبت** (`Phase1FactoryMemory.test.ts`) |
| **P1.2** | **واجهة التسجيل السريع ونافذة التفاصيل الاختيارية** | - عند نقر الفني على «تم التنفيذ ✓» في الجدول أو البطاقة: يُنشأ فوراً سجل `PreventiveExecution` بتاريخ اللحظة واسم المستخدم الحالي، وتُحدَّث `lastExecutedAt` في المهمة مع حساب موعد الاستحقاق التالي حسب الدورية (`hebdomadaire`, `mensuel`, `trimestriel`, إلخ).<br>- توفير نافذة تفاصيل منبثقة لإدخال: (المدة الفعلية، فني التنفيذ، ملاحظات، وقطع غيار مستهلكة تسجل حركات `Sortie Interne` آلياً). | `src/presentation/pages/preventive/PreventiveView.tsx`<br>`src/presentation/pages/preventive/components/TabMainView.tsx`<br>`src/application/services/preventive/TaskService.ts` | 🟢 **منجز ومُثبت** (`Phase1FactoryMemory.test.ts`) |
| **P1.3** | **توحيد التواريخ الصالحة في الحركات والأعطال** | - التأكد أن كل سطر في `Mouvement` يملك تاريخاً صالحاً قابل للفرز والفلترة (`YYYY-MM-DD`).<br>- التأكد أن كل تدخل علاجي (`CorrectiveIntervention` / `WorkOrder`) يملك `date_demande` / `date_cloture` صالحة، وحقل `downtimeHours` (مدة توقف الآلة) وتكلفة القطع. | `src/utils/datePeriodUtils.ts`<br>`src/presentation/pages/corrective/BonsTravailTab.tsx`<br>`src/presentation/pages/warehouse/MouvementsJournalTable.tsx` | 🟢 **منجز ومُثبت** (`Phase1FactoryMemory.test.ts`) |
| **P1.4** | **شريط فلتر الفترة الموحد (Month / Date Range Filter)** | إضافة شريط تصفية زمني موحد وواضح (`الكل`، `هذا الشهر`، `الشهر الماضي`، `شهور مخصصة`، `نطاق حر`) في الواجهات الثلاث:<br>1. جدول الحركات (`MouvementsJournalTable.tsx`)<br>2. التدخلات العلاجية (`BonsTravailTab.tsx`)<br>3. سجل تنفيذ الصيانة الوقائية (`PreventiveExecutionsHistoryView.tsx`) | `src/presentation/components/common/PeriodFilterBar.tsx`<br>`MouvementsJournalTable.tsx`<br>`BonsTravailTab.tsx`<br>`PreventiveExecutionsHistoryView.tsx` | 🟢 **منجز ومُثبت** (`Phase1FactoryMemory.test.ts`) |
| **P1.5** | **محرك المؤشرات الشهرية المشتقة (`MonthlyFactoryMetrics`)** | حساب مؤشرات الشهر المختار (`YYYY-MM`) آلياً من السجلات المؤرخة:<br>- **تقييم المخزون الحالي:** `∑(stockActuel × prixUnitaire)`<br>- **استهلاك الشهر مالياً:** `∑(Sorties du mois × prixUnitaire)`<br>- **أكثر 5 قطع استهلاكاً في الشهر** (كمية وقيمة)<br>- **عدد الأعطال وساعات التوقف (`Downtime`)** وأكثر الآلات تعطلاً<br>- **نسبة الانضباط الوقائي الشهري:** `(عدد التنفيذات المسجلة في الشهر ÷ عدد المهام المجدولة للشهر) × 100` | `src/application/services/MonthlyReportCalculationService.ts`<br>`src/presentation/pages/preventive/components/PreventiveAnalyticsView.tsx` | 🟢 **منجز ومُثبت** (`Phase1FactoryMemory.test.ts`) |
| **P1.6** | **شمول السجل الجديد في التفريغ والنسخ الاحتياطي والمزامنة** | ربط مفتاح `PREVENTIVE_EXECUTIONS` (`gmao_preventive_executions_v1`) بـ:<br>- `clearAllForRealFactory()` (تصفير كامل `[]`)<br>- `loadFullServerState()` و `applyRemoteStateUpdate()`<br>- `serverSyncService.ts` و `server.ts` | `src/application/DataGateway.ts`<br>`src/services/serverSyncService.ts`<br>`server.ts`<br>`src/tests/unit/Phase1FactoryMemory.test.ts` | 🟢 **منجز ومُثبت** (`Phase1FactoryMemory.test.ts`) |

> **معيار إغلاق المرحلة P1:** اختيار شهر محدد (مثلاً `2026-10`) يعرض بدقة حركات ذلك الشهر، أعطاله، وسجل تنفيذاته الوقائية مع تكلفتها ونسبة إنجازها، وعند تفريغ المصنع (`Clear All`) يُصفَّر سجل `PreventiveExecution` تماماً مع باقي الجداول.

---

## 📊 المرحلة P2 — تقارير وإدارة (Executive Monthly Report & Financial Visibility)

> **الهدف:** منح أصحاب المصنع والإدارة في بداية كل شهر وثيقة تنفيذية ومالية حاسمة بضغطة زر دون الحاجة للغوص في الجداول التقنية.

| المعرف | البند التفصيلي | التوصيف الهندسي الدقيق | الملفات المستهدفة | الحالة |
| :--- | :--- | :--- | :--- | :--- |
| **P2.1** | **شاشة «تقرير الشهر التنفيذي» (`Rapport Mensuel Direction`)** | صفحة أو تبويب مخصص للإدارة يعرض ملخص الشهر المختار (`YYYY-MM`) في 4 بطاقات تنفيذية وجداول مختصرة:<br>1. **الميزانية والمخزون:** القيمة المالية الإجمالية للمخزون الحالي + تكلفة القطع المستهلكة خلال الشهر + قيمة الطلبيات المفتوحة.<br>2. **انضباط الصيانة الوقائية:** نسبة الإنجاز الشهري (`%`)، عدد المهام المنفذة مقابل المتأخرة، وتوزيع الإنجاز حسب الفنيين.<br>3. **الأعطال والتوقفات (`Corrective & Downtime`):** إجمالي الأعطال، مجموع ساعات التوقف، وأكثر 3 آلات استنزافاً لقطع الغيار والوقت.<br>4. **نواقص المخزون الحرجة (`RUPTURE / ALERTE`):** قائمة القطع التي تتطلب شراءً فورياً لتأمين الشهر الجديد. | `src/presentation/components/views/MonthlyExecutiveReportView.tsx` (جديد)<br>`src/presentation/components/views/RapportsView.tsx` | 🔴 **مجدول** |
| **P2.2** | **تصدير التقرير الشهري (`Print PDF` + `Excel Mensuel`)** | - تصميم قالب طباعة رسمي نظيف (`@media print` / PDF) يحمل ترويسة المصنع وفترة التقرير وتوقيع المسؤول.<br>- زر تصدير ملف `Excel` متعدد الأوراق خاص بالشهر المختار (ملخص الإدارة + حركات الشهر + أعطال الشهر + تنفيذات الوقائي للشهر). | `src/services/monthlyReportExportService.ts` (جديد)<br>`MonthlyExecutiveReportView.tsx` | 🔴 **مجدول** |
| **P2.3** | **مقارنة شهر بشهر (`Month-over-Month Delta`)** | إظهار مؤشر اتجاه بسيط (`▲ / ▼ %`) مقارنة بالشهر السابق في: تكلفة استهلاك القطع، عدد الأعطال، ونسبة الانضباط الوقائي. | `MonthlyReportCalculationService.ts`<br>`MonthlyExecutiveReportView.tsx` | 🔴 **مجدول** |

> **معيار إغلاق المرحلة P2:** توليد تقرير شهر كامل قابل للطباعة والتصدير إلى Excel بأرقام متطابقة 100% مع شاشات المخزون والحركات والصيانة.

---

## 🌐 المرحلة P3 — مضيف الشبكة: مخ واحد على LAN (Octopus Host Architecture)

> **الهدف:** تحقيق رؤية «التطبيق الأصلي يعمل كخادم مضيف (`Host`) في شبكة الشركة (`Wi-Fi / LAN`) ويمنح رابطاً لباقي الهواتف والحواسيب للعمل على مصدر حقيقة واحد للبيانات».

| المعرف | البند التفصيلي | التوصيف الهندسي الدقيق | الملفات المستهدفة | الحالة |
| :--- | :--- | :--- | :--- | :--- |
| **P3.1** | **وضعان صريحان للتشغيل (`Host Node` مقابل `LAN Client`)** | - **وضع المضيف (`Host`):** الحاسوب الرئيسي الذي يشغّل `server.ts` ويملك قاعدة البيانات المحلية (`data/gmao_state.json`) وملف الإكسل الشبكي.<br>- **وضع العميل (`Client`):** أي متصفح أو هاتف يفتح رابط المضيف (`http://<HOST_LAN_IP>:3000`)؛ يقرأ الحالة ويكتب التعديلات مباشرة إلى المضيف عبر `/api/gmao/*` مع تحديث فوري. | `server.ts`<br>`src/services/serverSyncService.ts`<br>`src/services/networkConfigService.ts` | 🟡 **جزئي** |
| **P3.2** | **لوحة بث الشبكة المحلية ورمز QR (`LAN Broadcast & QR Panel`)** | تحسين قسم الاتصالات الشبكية في `SettingsView` ليعرض:<br>- عنوان `IP` المحلي الفعلي للمضيف على شبكة الـ Wi-Fi (عبر نقطة نهاية `/api/network/info` في `server.ts` تقرأ `os.networkInterfaces()`).<br>- رابط الدخول المباشر للواجهة الكاملة (`http://<IP>:3000`) ورابط واجهة الهاتف السريعة (`http://<IP>:3000/#mobile`).<br>- رمز `QR Code` يمسحه الفني بهاتفه لفتح التطبيق فوراً على نفس الشبكة، مع مؤشر حالة اتصال واضح (`متصل بالمضيف 🟢` / `عمل محلي مؤقت 🟡`). | `server.ts` (`/api/network/info`)<br>`src/presentation/components/views/SettingsView.tsx`<br>`src/presentation/components/layout/Header.tsx` | 🟡 **جزئي** |
| **P3.3** | **طابور الكتابة المتسلسل على الخادم (`Server-Side Write Mutex`)** | لمنع تلف `data/gmao_state.json` إذا ضغط فنيان على هاتفيهما في نفس الثانية:<br>- إضافة قفل تسلسلي (`Async Mutex / Write Queue`) داخل `server.ts` يضمن تنفيذ عمليات الكتابة واحدة تلو الأخرى بترتيب وصولها (`Atomic File Write` عبر كتابة ملف مؤقت `.tmp` ثم `fs.rename`).<br>- إضافة رقم نسخة متزايد (`revision: number` و `updatedAt`) في `gmao_state.json`. | `server.ts`<br>`src/services/serverSyncService.ts` | 🔴 **مجدول** |
| **P3.4** | **المزامنة اللحظية الخفيفة بين الأطراف (`SSE / Revision Sync`)** | إشعار الأجهزة المتصلة على الشبكة المحلية عند حدوث تعديل جديد على المضيف (عبر `Server-Sent Events /api/gmao/events` أو فحص `revision` خفيف عند عودة التركيز للنافذة `window.onfocus`) لتتحدث شاشات الجميع دون تضارب. | `server.ts`<br>`src/services/serverSyncService.ts` | 🔴 **مجدول** |

> **معيار إغلاق المرحلة P3:** فتح رابط المضيف من متصفح آخر أو هاتف على نفس الشبكة، تسجيل حركة مخزون أو إنهاء مهمة وقائية من الهاتف، وظهورها على شاشة الحاسوب المضيف بأمان دون فقدان بيانات.

---

## 🎨 المرحلة P4 — واجهة وجودة وتخصيص (UX, i18n, Theme & Light Roles)

> **الهدف:** صقل الواجهة بصرياً ولغوياً وتنظيم الصلاحيات اليومية دون تعقيد، بالتوازي الخفيف مع المراحل الأساسية.

| المعرف | البند التفصيلي | التوصيف الهندسي الدقيق | الملفات المستهدفة | الحالة |
| :--- | :--- | :--- | :--- | :--- |
| **P4.1** | **إكمال القاموس اللغوي المزدوج (`FR / AR`)** | استبدال النصوص الثابتة المتبقية في الواجهات (وخاصة النوافذ المنبثقة والتقارير الجديدة) بمفاتيح ترجمة في `translations.ts` مع دعم اتجاه `RTL / LTR` السلس. | `src/i18n/translations.ts`<br>مكونات العرض في `src/presentation/` | 🟡 **جزئي** |
| **P4.2** | **توحيد متغيرات الثيم (`Industrial Dark / High-Contrast Light`)** | ضمان وضوح القراءة في بيئة المصنع (تباين عالٍ تحت إضاءة الورشة القوية للفنيين، وثيم داكن مريح لغرفة التحكم والإدارة). | `src/index.css`<br>`src/context/ThemeContext.tsx` | 🟡 **جزئي** |
| **P4.3** | **أدوار المستخدمين الخفيفة (`Technician / Storekeeper / Admin`)** | تخصيص العرض حسب الدور دون تعقيد أمني معطل للعمل:<br>- **فني (`Technicien`):** يرى مهامه الوقائية، الأعطال، وطلب القطع.<br>- **أمين مخزن (`Magasinier`):** يركز على `Stock Actuel`، تسليم القطع (`Sortie`)، واستلام الطلبيات (`Entrée`).<br>- **مدير / مسؤول (`Responsable / Admin`):** يملك صلاحية التقرير المالي الشهري، الإعدادات، وتفريغ المصنع. | `src/context/AuthContext.tsx`<br>`src/presentation/router/AppRouter.tsx` | 🟡 **جزئي** |

---

## 📱 المرحلة P5 — منصات وأطراف التشغيل (Mobile Field UI & Desktop Host Packaging)

> **الهدف:** تطبيق مبدأ «نفس المحرك ونفس البيانات، لكن واجهة الهاتف مختزلة للميدان وواجهة الحاسوب شاملة للإدارة»، مع تجهيز تغليف الحاسوب كبرنامج أصلي.

| المعرف | البند التفصيلي | التوصيف الهندسي الدقيق | الملفات المستهدفة | الحالة |
| :--- | :--- | :--- | :--- | :--- |
| **P5.1** | **واجهة الهاتف الميدانية المختزلة للمهام السريعة (`Field Mobile Mode`)** | تهذيب وتفعيل واجهة الهاتف (`src/mobile/` أو وضع العرض الميداني السريع) لتقتصر على **3 إجراءات سريعة بأزرار كبيرة قابلة للمس بيد واحدة**:<br>1. **مهامي الوقائية اليوم (`Mes Tâches PM`):** قائمة مهام اليوم/الأسبوع مع زر `✓ تم التنفيذ` (يولّد `PreventiveExecution` مباشرة).<br>2. **تبليغ عطل سريع (`Signaler Panne / DI`):** اختيار الآلة + وصف مختصر + نوع العطل بـ 3 نقرات.<br>3. **صرف قطعة غيار (`Sortie PDR Rapide`):** بحث سريع بالمرجع أو الاسم + تحديد الكمية والآلة وتسجيل حركة `Sortie Interne`. | `src/mobile/`<br>`src/presentation/components/views/FieldMobileView.tsx`<br>`src/presentation/router/AppRouter.tsx` | 🟡 **جزئي (`src/mobile` موجود ويحتاج ربطاً بـ `P1`)** |
| **P5.2** | **التبديل التلقائي أو اليدوي لوضع الهاتف (`Auto / Manual Mobile Switch`)** | إمكانية فتح واجهة الهاتف تلقائياً على الشاشات الصغيرة (`< 768px`) أو عبر زر تبديل سريع في الشريط العلوي (`وضع الميدان 📱`) أو عبر رابط QR المباشر من المضيف. | `src/App.tsx`<br>`src/presentation/components/layout/Header.tsx` | 🔴 **مجدول** |
| **P5.3** | **تغليف تطبيق الحاسوب الأصلي (`Windows / Mac Native Host`)** | تجهيز ملفات التغليف الرسمي لتشغيل التطبيق كبرنامج سطح مكتب أصلي (`Electron` أو `Tauri` أو حزمة تشغيل محلية مستقلة `Standalone Node + Chromium Host`) يشغّل `server.ts` تلقائياً في الخلفية ويفتح الواجهة دون حاجة لتثبيت أدوات برمجية في حاسوب المصنع. | `scripts/desktop/`<br>`package.json` | 🔴 **مجدول (بعد استقرار `P3`)** |

> **معيار إغلاق المرحلة P5:** فني يفتح التطبيق من هاتفه عبر الـ Wi-Fi، يجد الواجهة المختزلة ذات الأزرار الثلاثة فقط، ينفذ مهمة وقائية ويصرف قطعة غيار في أقل من 30 ثانية، وتظهر فوراً في التقرير الشهري على حاسوب الإدارة.

---

## 📗 المرحلة P6 — إكسل الشبكي الناضج: مرآة رسمية بلا تعارض (Network Excel Mirror)

> **الهدف:** حماية ملف Excel الموجود على مجلد الشبكة المشترك (`Shared Network Folder`) من التلف أو أقفال الويندوز (`EBUSY`)، بجعل **المضيف (`Host`) هو الكاتب الوحيد إليه**.

| المعرف | البند التفصيلي | التوصيف الهندسي الدقيق | الملفات المستهدفة | الحالة |
| :--- | :--- | :--- | :--- | :--- |
| **P6.1** | **حصر الكتابة على ملف Excel الشبكي بالمضيف (`Host-Only Excel Writer`)** | - منع الحواسيب الفرعية أو الهواتف من محاولة فتح أو كتابة ملف `.xlsx` الشبكي مباشرة.<br>- وحده الخادم المضيف (`Host`) يقرأ ويكتب إلى مسار ملف Excel المحدد في الإعدادات. | `server.ts`<br>`src/services/excelSyncService.ts` | 🔴 **مجدول** |
| **P6.2** | **إدارة قفل الملف في الشبكة (`File Lock & Retry Queue`)** | في حال كان ملف Excel مفتوحاً للمشاهدة على حاسوب المدير في الشبكة (مما يسبب قفل الملف في Windows `EBUSY / EPERM`):<br>- يكتشف المضيف أن الملف مقفل، فلا ينهار ولا يضيع التعديل.<br>- يحتفظ بالتعديل في `gmao_state.json` ويضع عملية تحديث Excel في طابور انتظار (`Pending Excel Sync`) مع تنبيه واضح في الواجهة (`ملف Excel مفتوح حالياً على جهاز آخر — سيتم التحديث فور إغلاقه`). | `server.ts`<br>`src/services/excelSyncService.ts`<br>`src/presentation/components/views/SettingsView.tsx` | 🔴 **مجدول** |
| **P6.3** | **تصدير أوراق السجلات الشهرية إلى ملف Excel المربوط** | تحديث بنية التزامن مع ملف Excel لتشمل ورقة خاصة بسجل التنفيذ الوقائي المؤرخ (`PreventiveExecutions`) وحركات الشهر، ليبقى ملف الإكسل مرآة كاملة لقاعدة بيانات التطبيق. | `src/services/excelService.ts`<br>`src/services/excelSyncService.ts` | 🔴 **مجدول** |

> **معيار إغلاق المرحلة P6:** حتى لو تم تثبيت التطبيق على حاسوبين أو أكثر، يتولى المضيف الرئيسي فقط تحديث ملف Excel على الشبكة دون أي تضارب أو تلف للملف.

---

## 📝 سجل تحديثات خارطة الطريق (Roadmap Changelog)

| التاريخ | المرحلة / البند | ملخص التحديث الهندسي | حالة البناء والاختبار |
| :--- | :--- | :--- | :--- |
| `2026-10-10` | **تأسيس الوثيقة (`P0`–`P6`)** | إنشاء وثيقة `ROADMAP_AND_PHASES_PLAN.md` وتوثيق المراحل السبع (`P0` إلى `P6`) بالمعايير الهندسية الدقيقة، وتثبيت إغلاق `P0` بالكامل. | 🟢 `12/12` اختباراً حرجاً ناجحاً (`compile_applet` سليم) |
| `2026-10-10` | **P1.1 مكتمل (`PreventiveExecution`)** | بناء نموذج واختبار حدث تنفيذ الصيانة الوقائية المستقل (`ExecutionService` + `DataGateway`) وفصل الخطة الثابتة عن سجل التنفيذ المؤرخ. | 🟢 بناء ناجح (`compile_applet`) |
| `2026-10-18` | **إغلاق المرحلة P1 بالكامل (`P1.1` → `P1.6`)** | اكتمال بنية ذاكرة المصنع المؤرخة: تسجيل التنفيذ مع حساب التكرار الآلي والقطع، توحيد صيغ التواريخ، شريط فلترة الفترات `PeriodFilterBar` في الجداول الثلاثة، محرك مؤشرات الشهر `MonthlyReportCalculationService`، والتصفير الشامل والمزامنة. | 🟢 اجتياز اختبارات `Phase1FactoryMemory.test.ts` (7/7) وبناء سليم (`compile_applet`) |

