# 🤖 دليل وكلاء الذكاء الاصطناعي والمواصفة الهندسية المحدثة (`AI_AGENT_GUIDELINES.md`)

> **⚠️ تنبيه مرجعي للوكلاء (Authoritative Supersession Notice):**
> البوابة الإلزامية الأولى لأي وكيل ذكاء اصطناعي هي [`/AGENTS.md`](../AGENTS.md)، تليها [`/CAPABILITIES_AND_STRENGTHS.md`](../CAPABILITIES_AND_STRENGTHS.md) و[`/ARCHITECTURE.md`](../ARCHITECTURE.md) و[`/docs/DATA_SSOT.md`](./DATA_SSOT.md).
> تم تحديث هذا الملف لإزالة الفلسفات القديمة التي تخطاها النظام (مثل اعتبار `Excel Twin` مصدر الحقيقة الداخلي أو غياب الخادم المحلي `server.ts` أو حقن بذور الديمو تلقائياً عند فراغ التخزين).

---

## 🏛️ 1. المبادئ المعمارية الحاكمة (Current Architecture Principles)

1. **مصدر الحقيقة الواحد (`DataGateway` + `STORAGE_KEYS`):**
   - حالة التطبيق تُدار مركزياً في `src/store/useGmaoStore.ts` وتُحفظ عبر `src/application/DataGateway.ts` باستخدام المفاتيح القياسية في `src/infrastructure/persistence/storageKeys.ts`.
   - ملفات الإكسل (`excelEngineService.ts` و`excelMirrorService.ts`) هي **قنوات استيراد وتصدير ونسخ مرآة فقط** وليست مصدر الحقيقة الداخلي.
2. **مضيف الشبكة المحلية (`LAN Host` في `server.ts`):**
   - يعمل التطبيق محلياً في المتصفح (`Offline-First`) ويدعم العمل الجماعي على الشبكة المحلية عبر خادم Express خفيف (`server.ts`).
   - جميع مسارات `/api/gmao/*` محمية بتوكن `X-GMAO-API-TOKEN`، وقائمة الكيانات المسموحة `ALLOWED_ENTITIES`، وفحص الأدوار (`x-gmao-role` / `AuthorizationService.tsx`)، وطابور الكتابة الذرية المتسلسل (`writeQueue`)، ورقم الإصدار `version` مع رفض الكتابة المتعارضة (`409 Conflict`).
3. **منع الحقن الصامت للبيانات التجريبية (`Zero Silent Seed Reinjection`):**
   - المجموعات الفارغة (`0` سجلات) هي حالة مصنع حقيقية صالحة.
   - لا تُحمَّل بذور الديمو إلا بطلب صريح عبر `DataGateway.loadDemoData()` أو `DataGateway.loadDemoSection()`.
4. **محرك المخزون التزايدي (`IncrementalStockIndex`):**
   - يُحسب الرصيد حصراً بالمعادلة: `stockActuel = stockInitial + entrées − sorties` عبر `src/application/IncrementalStockIndex.ts` و`src/application/services/StockCalculationService.ts`.
   - يُمنع تعديل هذين الملفين إلا في حال إثبات خطأ رقمي باختبار فاشل.
5. **الذاكرة الزمنية وآلة الحالة (`Temporal Memory & FSM`):**
   - التنفيذ الوقائي يُسجل كحدث تاريخي مستقل (`PreventiveExecution` عبر `src/application/services/preventive/ExecutionService.ts`).
   - أوامر العمل التصحيحية تخضع لآلة حالة محدودة صارمة (`src/domain/maintenance/WorkOrderStateMachine.ts`).
6. **الانضباط المرجعي والأرشفة الآمنة (`Referential Discipline`):**
   - قوائم اختيار الآلات عند إنشاء المهام أو الأعطال أو الحركات تستخدم حصراً `filterActiveMachines(machines)` (`src/utils/activeMachines.ts`).
   - الكيانات المرتبطة بسجل تاريخي تُؤرشف (`ARCHIVEE` / `is_active: false`) ولا تُحذف حذفاً صلباً يترك سجلات يتيمة.

---

## 🧪 2. التحقق والاختبارات الآلية (Verification Standard)

لتشغيل حزم التحقق الأساسية في أي وقت:
```bash
npx vitest run src/tests/unit/ThreeCriticalPaths.test.ts src/tests/unit/PreventiveClearPersistence.test.ts src/tests/unit/Phase1FactoryMemory.test.ts
```
أو لتشغيل كافة اختبارات الوحدة:
```bash
npx vitest run
```
