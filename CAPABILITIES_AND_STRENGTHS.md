# قدرات النظام وتقنياته — CIOB GMAO

> **المرجعية الهندسية للوثيقة:**
> توثّق هذه الوثيقة القدرات التشغيلية والضمانات التصميمية المُنفَّذة فعلياً في الشيفرة المصدرية لنظام **CIOB GMAO v4**، مع ربط كل قدرة بمسار الملف البرمجي أو مفتاح التخزين أو ملف الاختبار الآلي الذي يثبتها.

---

## 1. ملخص تنفيذي (نصف صفحة)

**CIOB GMAO v4** هو نظام إدارة صيانة صناعية ومخزون قطع غيار (`GMAO / CMMS`) يعمل بمرجعية **تطبيق ويب تشغيلي أولاً (`Web-First Operational Platform`)**، صُمّم لضبط العمليات اليومية في المصنع عبر خمس ركائز مترابطة:
1. **إدارة الأصول والآلات (`Parc Machines & BOM`):** هيكلة الآلات حسب المناطق الصناعية (`Zones`) والعائلات (`Families`) وقوائم المكونات (`machineElementsLedger`).
2. **محرك المخزون والحركات (`Stock PDR & Mouvements`):** تتبع دقيق لقطع الغيار، أذونات الصرف السريع (`Sortie Rapide`)، الإرجاع، والطلبات المفتوحة.
3. **الصيانة الوقائية المبنية على الأحداث (`Event-Sourced Preventive Maintenance`):** جدولة المهام الدورية وتوثيق كل عملية تنفيذ كحدث زمني مستقل يحفظ التكلفة والمدة والفني المنفذ وقطع الغيار المستهلكة.
4. **الصيانة التصحيحية المحكومة بآلة حالة (`FSM-Governed Corrective Maintenance`):** إدارة طلبات التدخل (`DI`) وأوامر العمل (`Bon de Travail - BT`) بدورة حياة مضبوطة وحسابات اعتمادية آلية (`MTTR`، `MTBF`، ونسبة الإتاحة `Availability %`).
5. **الإغلاق الشهري التنفيذي (`Monthly Executive Close`):** توليد تقارير إدارة المصنع الشهرية ومؤشرات المقارنة الشهرية (`Month-over-Month`) مباشرةً من السجلات المؤرخة.

**لماذا يُعوَّل على عموده الفقري للبيانات؟**
يرتكز النظام على بوابة كتابة موحدة (`DataGateway`) تفرض مصدر حقيقة واحداً (`SSOT`)، وتفصل بشكل قاطع بين وضع التجربة (`Demo Mode`) ووضع المصنع الفارغ أو التشغيلي (`Empty / Custom Factory Mode`)، وتمنع الحذف الصلب للآلات المرتبطة بسجلات تاريخية، وتحسب أرصدة المخزون بمعادلة رياضية حتمية قابلة للتدقيق، مع خادم مزامنة محلي (`server.ts`) يدعم الكتابة الذرية (`Atomic Write Queue`) والتحكم التفاؤلي بالتزامن (`Optimistic Concurrency Control - HTTP 409`).

---

## 2. مصدر الحقيقة الواحد (SSOT)

### أ) بوابة الكتابة الموحدة والمفاتيح القياسية (`Canonical Storage Keys`)
- **القدرة التصميمية:** تمر جميع عمليات حفظ وتحديث وتفريغ الكيانات عبر بوابة برمجية واحدة هي `DataGateway`، والتي تكتب حصرياً في مفاتيح التخزين القياسية المعرّفة في `STORAGE_KEYS`.
- **المراجع البرمجية:**
  - تعريف المفاتيح القياسية وخريطة ترحيل المفاتيح القديمة (`LEGACY_KEY_MAP` و `ALL_LEGACY_KEYS`): `src/infrastructure/persistence/storageKeys.ts`.
  - بوابة الكتابة الموحدة: `src/application/DataGateway.ts` (الدوال `saveMachines`, `saveStock`, `saveMouvements`, `savePreventiveTasks`, `savePreventiveExecutions`, `saveCorrectiveInterventions`, إلخ).

### ب) الفصل الصارم بين `Demo` و `Empty` والبيانات التشغيلية الحقيقية
- **التقنية المُنفَّذة (`4-Stage Self-Healing Hydration`):** تعتمد دالة القراءة الموحدة `loadCollection(canonicalKey, options)` في `src/infrastructure/persistence/migrateStorage.ts` على أربع مراحل متدرجة:
  1. **المرحلة 1 (`Canonical Key`):** قراءة المفتاح القياسي من `storageService`. إذا كان يحتوي على مصفوفة بيانات للمستخدم، أو مصفوفة فارغة `[]` خارج وضع العرض التوضيحي، تُعتمد فوراً كمصدر حقيقة نهائي.
  2. **المرحلة 2 (`Legacy Key Migration`):** فحص المفاتيح القديمة المعرّفة في `LEGACY_KEY_MAP` لمرة واحدة فقط، ويُعطَّل هذا الفحص تماماً إذا كان النظام في وضع التفريغ الصريح (`START_MODE === 'empty'` أو `DEMO_MODE === false`).
  3. **المرحلة 3 (`Snapshot Recovery`):** الاستعادة من `FULL_STATE_SNAPSHOT` (`gmao_full_state_v1`) عند الحاجة، بشرط عدم وجود النظام في وضع `START_MODE === 'empty'`.
  4. **المرحلة 4 (`Explicit Demo Fallback`):** لا يتم تحميل بذور العرض (`demoSeed`) إلا إذا كانت راية `STORAGE_KEYS.DEMO_MODE` (`gmao_demo_data_loaded_v1`) مفعّلة صراحةً بقيمة `true` و `START_MODE !== 'empty'`.

### ج) الأثر التشغيلي بعد التحديث (`F5`) والتفريغ للمصنع الحقيقي (`clearAllForRealFactory`)
- عند استدعاء `DataGateway.clearAllForRealFactory()` في `src/application/DataGateway.ts`:
  - تُضبط الرايات السيادية: `DEMO_MODE = false` و `START_MODE = 'empty'`.
  - تُحذف اللقطة المجمعة `FULL_STATE_SNAPSHOT` وتُطهَّر جميع المفاتيح القديمة عبر `DataGateway.purgeLegacyKeysFor(null)` لمنع عودة أي بيانات قديمة.
  - تُكتب مصفوفات فارغة `[]` (أو كائنات `{}` للقواميس) في جميع المفاتيح القياسية عبر الذاكرة و `localStorage` و `IndexedDB` (`indexedDBService.setItemsBatch` و `indexedDBService.clear`).
- **النتيجة التشغيلية:** بعد التفريغ الكامل أو الجزئي والضغط على `F5`، يبقى النظام فارغاً تماماً وجاهزاً لإدخال بيانات المصنع الحقيقية، وأي سجل يضيفه المستخدم لاحقاً يُحفظ ويستمر بعد `F5`.
- **الاختبارات المُثبتة:**
  - `src/tests/unit/PreventiveClearPersistence.test.ts`
  - `src/tests/unit/ThreeCriticalPaths.test.ts` (المسار الثاني)

---

## 3. سلامة السجلات الصناعية (سلامة مرجعية)

### أ) فحص الاعتماديات وأرشفة الآلة بدل الحذف الصلب (`Soft-Archive vs. Hard-Delete`)
- **القدرة التصميمية:** يمنع النظام الحذف الصلب (`Hard Delete`) لأي آلة تمتلك تاريخاً تشغيلياً مرتبطاً بها، ويحوّل العملية إلى أرشفة آمنة (`status: 'ARCHIVEE'` / `statut: 'Archivée'` / `is_active: false`) للحفاظ على دقة تقارير التكلفة ومؤشرات `MTBF` و `MTTR`.
- **المرجع البرمجي:** الدالة `dataIntegrityService.getMachineDependencies(machineId, datasets)` في `src/services/dataIntegrityService.ts` تفحص ارتباط الآلة عبر أربعة مسارات قبل السماح بالحذف:
  1. المهام الوقائية (`preventiveTasks` -> `preventiveCount`).
  2. التدخلات التصحيحية (`correctiveInterventions` -> `correctiveCount`).
  3. حركات المخزون (`mouvements` -> `movementsCount`).
  4. دفتر مكونات الآلة (`machineElementsLedger` -> `bomCount`).
  - لا تُرجع الدالة `canHardDelete: true` إلا إذا كان مجموع الروابط `total === 0`.

### ب) استبعاد الآلات المؤرشفة من قوائم الإنشاء الجديدة
- **القدرة التصميمية:** الآلات المؤرشفة أو غير النشطة تبقى محفوظة في السجلات التاريخية للتقارير، لكنها تُستبعد تلقائياً من جميع قوائم الاختيار عند إنشاء أمر عمل جديد أو مهمة وقائية جديدة أو حركة صرف.
- **المراجع البرمجية:**
  - `filterActiveMachines(machines)` و `getActiveMachineCodes(machines)` في `src/utils/activeMachines.ts`.
  - `dataIntegrityService.buildActiveMachineIdSet(machines)` في `src/services/dataIntegrityService.ts`.
- **الاختبار المُثبت:** `src/tests/unit/ThreeCriticalPaths.test.ts` (المسار الثالث: استبعاد الآلات ذات الحالة `Archivée` و `ARCHIVEE` و `is_active: false`).

### ج) كشف السجلات اليتيمة وإعادة الربط المتسلسل (`Referential Integrity & Cascade Relink`)
- **القدرة التصميمية:** يوفر النظام محرك فحص مرجعي شامل يحسب درجة صحة البيانات (`healthScore` من 0 إلى 100 وتصنيف `A+` إلى `D`) ويكتشف أي إشارات يتيمة (`_isOrphan`) مع أدوات لإعادة ربط المفاتيح الأجنبية عبر الوحدات.
- **المراجع البرمجية في `src/services/dataIntegrityService.ts`:**
  - `validateReferentialIntegrity` و `scanReferentialIntegrity`: فحص تطابق مراجع القطع والآلات والمناطق والفنيين.
  - `annotatePreventiveOrphans` و `annotateCorrectiveOrphans` (مربوطتان أيضاً داخل `DataGateway.savePreventiveTasks` و `DataGateway.saveCorrectiveInterventions`).
  - `relinkForeignKey` و `bulkRelinkOrphans`: إعادة توجيه كود آلة أو منطقة أو قطعة عبر الحركات والتدخلات والمهام الوقائية دفعةً واحدة.

### د) توحيد تصنيف المستودع وحراس الحذف المرجعي للقوالب والأجزاء (`Warehouse Taxonomy & Referential Delete Guards`)
- **توحيد التصنيف القياسي (`isWarehouseComponent` & `isWarehousePart`):**
  - المرجع البرمجي: `src/core/domain/EntrepotItem.ts` يوفّر الدوال المعيارية `isComponentNature`, `isPartNature`, `isWarehouseComponent`, و `isWarehousePart` لضمان التطابق التام بين شاشة المستودع (`EntrepotView.tsx`) وشاشة طلبات التدخل التصحيحي (`DemandesInterventionTab.tsx`) مع دعم الحقول القياسية (`nature: 'COMPONENT' | 'PART'`) والسجلات القديمة (`category: 'COMPOSANT'`, `nature: 'PARTIE'`) والروابط الهيكلية (`id_comp_template`, `id_designation`).
- **حراس الحذف المرجعي والأرشفة الآمنة (`src/hooks/useAppComplexHandlers.ts`):**
  - يمنع النظام الحذف الصلب لأي تصنيف أو قالب (`TypeMachine`, `Famille`, `Template`, `CompGroup`, `CompFamily`, `CompTemplate`, `PartType`, `PartDesignation`) إذا كان مرتبطاً بسجلات تابعة (`machines`, `blueprints`, `warehouseItems`).
  - عند محاولة حذف عنصر مستودع (`handleDeleteWarehouseItem`)، يمنع النظام الحذف إذا كان العنصر مركّباً حالياً على آلة (`status === 'MONTE'` أو `machine_id` نشط)، ويحوّل العملية تلقائياً إلى **أرشفة آمنة** (`status: 'REFORME'`, `is_active: false`) إذا كان العنصر مرتبطاً بسجل حركات (`mouvements`) أو تدخلات (`correctiveInterventions`) أو إرساليات خارجية (`sortiesExterne`) أو لف محركات (`bobinage`).
- **الاختبار المُثبت:** `src/tests/unit/DomainEntities.test.ts` (`EntrepotItem Nature & Taxonomy Classification (FIX-2)`).

---

## 4. محرك المخزون

### أ) المعادلة الرياضية الموحدة (`Twin Excel Formula`)
يُحسب الرصيد الفعلي وحالة التنبيه لكل صنف في المخزون وفق المعادلة الحتمية:
```text
stockActuel = stockInitial + Somme(Entrées) - Somme(Sorties)
alerte      = stockActuel <= 0 ? 'RUPTURE' : (stockActuel <= seuil ? 'ALERTE' : 'OK')
```

### ب) المسار التقني الواحد للحساب وتطبيع الحركات
- **الفهرس التراكمي السريع (`O(1) Incremental Stock Index`):**
  - الملف الأساسي: `src/application/IncrementalStockIndex.ts` (وتُشير إليه مسارات المجال `src/domain/pdr/services/IncrementalStockIndex.ts` و `src/core/domain/services/IncrementalStockIndex.ts` كمرجع واحد مطابق).
  - الدالة `normalizeType(raw)` تطبّع جميع مسميات الحركات (مثل `Entrée`, `Entrée Interne`, `Réception`, `Retour`, `Sortie`, `Sortie Interne`, `Sortie Externe`, `Bon de sortie`, `Consommation`, `Commande`) مع إزالة التشكيل والهمزات (`NFD normalization`) وتحويلها إلى الأنواع القياسية: `'ENTREE' | 'SORTIE' | 'COMMANDE'`.
  - الدوال `calculatePhysicalStock` و `calculateCurrentStock` و `getStockIntegrity` تحسب الرصيد المادي والرصيد المتاح وتكشف أي عجز سالب (`hasNegativeDiscrepancy`).
- **ربط الواجهة التفاعلية والحسابات:**
  - `src/application/StockIndexStore.ts`: مخزن الحالة للفهرس التراكمي بدعم `useSyncExternalStore`.
  - `src/hooks/useAppCalculations.ts`: الدالتان `syncMovementsToIndex(mouvements)` و `calculateStockItems(rawStock, mouvements)` والخطاف `useAppCalculations`.
  - `src/services/reactiveCalculationEngine.ts`: الدالة `recalculateStockReactive(rawStock, mouvements)` و `computeStockKPIs(stockItems)`.
  - `src/domain/pdr/services/StockCalculationService.ts`: خدمة حساب المخزون والمدخلات والمخرجات مع التخزين المؤقت (`MultiLevelCacheManager`).

### ج) ترابط البذور القياسية الموثّق بالاختبارات
- تحتوي بيانات العرض القياسية على:
  - **`102` حركة مخزون** في `src/data/movements/seedMouvements.json`، جميع مراجعها (`ref`) موجودة ومطابقة بنسبة 100% لأصناف `src/data/stock/seedStockItems.json`.
  - **`12` تدخلاً تصحيحياً** في `src/data/corrective/seedCorrectiveInterventions.json`، مرتبطة بآلات مسجلة في `seedMachines.json` وبأصناف مخزون حقيقية عبر `pdr_ref`.
  - **أمثلة رقمية موثّقة في الاختبارات الآلية:**
    - الصنف `Raccord01`: رصيد أولي `stockInitial = 82`، حركات صرف `sorties = 4` ← الرصيد المحسوب `stockActuel = 78`.
    - الصنف `Distributeur05`: رصيد أولي `stockInitial = 4`، حركات صرف `sorties = 4` ← الرصيد المحسوب `stockActuel = 0` وحالة التنبيه `alerte = 'RUPTURE'`.
- **الاختبارات المُثبتة:**
  - `src/tests/unit/StockMovementsCorrectiveSeeds.test.ts`
  - `src/tests/unit/ThreeCriticalPaths.test.ts` (المسار الأول)

---

## 5. الذاكرة الزمنية للصيانة الوقائية

### أ) كيان `PreventiveExecutionRecord` كسجل حدث زمني مستقل
- **القدرة التصميمية:** إنهاء مهمة صيانة وقائية لا يكتفي بقلب حقل نصي في جدول المهام، بل يُنشئ سجل حدث تاريخي غير قابل للضياع (`PreventiveExecutionRecord`) يُحفظ في المفتاح القياسي `STORAGE_KEYS.PREVENTIVE_EXECUTIONS` (`gmao_preventive_executions_v1`).
- **المرجع البرمجي:** `ExecutionService.recordExecution(task, validationData)` في `src/application/services/preventive/ExecutionService.ts` يسجل لكل تنفيذ:
  - معرف الحدث الفريد (`EXEC-<MACHINE>-<TIMESTAMP>-<HASH>`)، ومعرف المهمة (`taskId`)، وكود الآلة (`machineCode`)، والمنطقة (`zone`)، والجزء (`organe`).
  - التاريخ المعياري (`executedAt` بصيغة `YYYY-MM-DD`)، وشهر الفترة (`periodMonth` بصيغة `YYYY-MM`)، ورقم الأسبوع (`periodWeek` بصيغة `S1..S52`).
  - اسم الفني المنفذ (`executorName`)، ومدة التنفيذ بالدقائق (`durationMinutes`)، وتكلفة ساعة العمل (`laborRate`).
  - قائمة قطع الغيار المستهلكة (`sparesUsed`)، وتكلفة القطع (`sparesCost`)، والتكلفة الإجمالية للتدخل (`totalCost = sparesCost + laborCost`).
- بالتوازي، تقوم `TaskService.markTaskAsDone` في `src/application/services/preventive/TaskService.ts` بتحديث تاريخ آخر تنفيذ (`derniere_realisation`) وحساب تاريخ الاستحقاق القادم (`prochaine_echeance`) تلقائياً بناءً على دورية المهمة (`frequence`).

### ب) واجهة السجل التاريخي (`Historique d'Exécution`)
- **المرجع البرمجي:** `src/presentation/pages/preventive/components/PreventiveExecutionsHistoryView.tsx`.
- تعرض الواجهة سجلات `PreventiveExecutionRecord` مع تصفية زمنية عبر `PeriodFilterBar`، وبحث نصي فوري (بالآلة، الفني، الكود، الجزء، أو الملاحظات)، وبطاقات مؤشرات مجمّعة للفترة المحددة:
  1. إجمالي التنفيذات المنجزة (`totalExecs`).
  2. إجمالي ساعات العمل المنفذة (`hours`).
  3. تكلفة قطع الغيار المستهلكة (`totalSparesCost`).
  4. التكلفة الإجمالية للصيانة الوقائية (`totalCost`).

### ج) الاستمرار بعد `F5` والتصفير مع `clearAllForRealFactory`
- تُحمَّل سجلات التنفيذ عبر `ExecutionService.getExecutions()` باستخدام `loadCollection(STORAGE_KEYS.PREVENTIVE_EXECUTIONS, { allowDemoFallback: false, demoSeed: [] })`، مما يضمن بقاءها بعد تحديث الصفحة (`F5`) وتصفيرها الكامل عند استدعاء `DataGateway.clearAllForRealFactory()`.
- **الاختبار المُثبت:** `src/tests/unit/Phase1FactoryMemory.test.ts` (`P1.1`, `P1.2`, `P1.6`).

### د) الجسر التنبؤي (`Correctif ⇄ Préventif`) ومزامنة عداد ساعات الآلة (`FIX-4`)
- **الجسر التنبؤي ثنائي الاتجاه (`Bidirectional Maintenance Bridge`):**
  1. **من التصحيحي إلى الوقائي (`Pont Prédictif Anti-Récidive`):** يرصد `CorrectiveCalculationService.detectPreventiveRecommendations` الآلات التي تعرضت لـ `≥ 3` أعطال متكررة مع تحديد العطل الأكثر تكراراً (`anomalie`). وعند النقر على `+ Créer routine` في `PreventiveView.tsx` أو `Créer la Tâche Préventive` في `AnalyseCorrectiveTab.tsx`، يقوم النظام (مع حارس منع التكرار) بإنشاء خطة ومهمة وقائية مجدولة فعلياً في `preventiveTasks` عبر `handleCreatePlanWithTasks`.
  2. **من الوقائي إلى التصحيحي (`Anomalie Préventive → DI Corrective`):** يتيح `onCreateCorrective` في `useAppRouterProps.ts` تحويل أي شذوذ يُكتشف أثناء الفحص الوقائي إلى طلب تدخل تصحيحي (`DI`) مربوط بـ `id_tache_preventive` دون الكتابة فوق معرف التدخل (`id`).
- **مزامنة عداد ساعات الآلة (`Machine Hour-Counter Propagation`):**
  - عند إدخال قراءة عداد الساعات (`compteur_releve`) أثناء التحقق من مهمة وقائية (`handleMarkTaskDone`) أو تحديث العداد (`handleUpdateTaskCounter`)، ينشر `TaskService` و `useGmaoStore` القراءة الجديدة (`dernier_releve`, `compteur_actuel`) على جميع المهام الوقائية التابعة لنفس الآلة، ويُحدّث حقل `compteur_heures` و `dernier_releve_compteur` في بطاقة الآلة (`machines`) تلقائياً.
- **الاختبار المُثبت:** `src/tests/unit/ThreeCriticalPaths.test.ts` (المسار السابع: `FIX-4`).

---

## 6. الزمن والتقارير

### أ) شريط التصفية الزمنية وأدوات التاريخ (`PeriodFilterBar` & `datePeriodUtils`)
- **المراجع البرمجية:**
  - مكوّن الواجهة: `src/presentation/components/common/PeriodFilterBar.tsx`.
  - دوال التطبيع والحساب الزمني: `src/utils/datePeriodUtils.ts` (`normalizeDateToYMD`, `getMonthFromDate`, `isDateInPeriod`, `extractAvailableMonths`, `getPeriodBoundaries`).
- **القدرات المُنفَّذة:**
  - تطبيع صيغ التواريخ المتعددة (`ISO-8601`, `DD/MM/YYYY`, `YYYY-MM-DD`) إلى صيغة قياسية موحدة `YYYY-MM-DD` للمقارنة الزمنية الدقيقة.
  - أوضاع تصفية جاهزة ومخصصة: الكل (`ALL`)، هذا الشهر (`THIS_MONTH`)، الشهر الماضي (`LAST_MONTH`)، ربع سنوي (`THIS_QUARTER`)، اختيار شهر محدد من الأشهر المتوفرة في السجلات (`CUSTOM_MONTH`)، أو نطاق تاريخ حر من-إلى (`CUSTOM_RANGE`)، مع عداد فوري للسجلات المطابقة (`filteredCount / totalCount`).

### ب) التقرير الشهري التنفيذي (`MonthlyExecutiveReportView` & `MonthlyReportCalculationService`)
- **المراجع البرمجية:**
  - محرك الحساب: `src/application/services/MonthlyReportCalculationService.ts`.
  - محرك مؤشرات الاعتمادية: `src/domain/services/AvailabilityCalculationService.ts`.
  - واجهة العرض التنفيذي: `src/presentation/components/views/MonthlyExecutiveReportView.tsx`.
- **ماذا يُحسب ومن أي سجلات؟**
  1. **تقييم المخزون والطلبات المفتوحة (من `stockItems` و `mouvements`):**
     - القيمة المالية الإجمالية للمخزون الحالي (`stockValuationTotal`)، وعدد الأصناف في حالة نفاد (`ruptureCount` عند `stockActuel <= 0`) أو تنبيه (`alerteCount` عند `stockActuel <= seuil`).
     - عدد وقيمة طلبات الشراء المفتوحة (`openOrdersCount` و `openOrdersValue`) التي لم تُختم بوسم الاستلام `#RECEPTION_VALIDE`.
  2. **استهلاك الشهر وأعلى 5 قطع غيار استهلاكاً (من `mouvements` المؤرخة ضمن `YYYY-MM`):**
     - عدد وتكلفة حركات الصرف (`monthSortiesCount`, `monthConsumptionCost`) وحركات الإدخال (`monthEntreesCount`, `monthEntriesCost`)، وترتيب أعلى 5 قطع مستهلكة (`topConsumedParts`) حسب التكلفة والكمية.
  3. **الأعطال التصحيحية ومؤشرات الاعتمادية (من `correctiveInterventions` المؤرخة ضمن `YYYY-MM`):**
     - إجمالي الأعطال (`correctiveCount`)، وساعات التوقف (`totalDowntimeHours`)، وتكلفة قطع غيار الأعطال (`correctiveSparesCost`)، وترتيب أعلى 3 آلات حرجة توقفاً (`topFailingMachines`).
     - حساب `MTTR` (`AvailabilityCalculationService.calculateMTTR`)، و `MTBF` (`calculateMTBF`)، ونسبة الإتاحة التشغيلية للمصنع `availabilityRate` (`calculateAvailability`).
  4. **انضباط الصيانة الوقائية وتوزيع الفنيين (من `preventiveExecutions` و `preventiveTasks` و `correctiveInterventions`):**
     - نسبة الانضباط الوقائي (`preventiveDisciplineRate %`)، وساعات العمل الوقائي (`preventiveLaborHours`)، وتكلفته (`preventiveTotalCost`)، وجدول توزيع أحمال العمل لكل فني (`technicianBreakdown`).
  5. **المقارنة الشهرية (`Month-over-Month Comparison`):**
     - تحسب `calculateMonthOverMonthComparison` الفروقات المئوية والاتجاهات (`UP` / `DOWN` / `STABLE`) بين الشهر المحدد (`currentMonth`) والشهر السابق له (`previousMonth`) عبر `DeltaBadge`.

### ج) التصدير والطباعة الرسمية
- **المرجع البرمجي:** `src/services/monthlyReportExportService.ts`.
- **تصدير ملف Excel متعدد الأوراق (`exportMonthlyReportToExcel`):** يولّد مصنف `.xlsx` (`GMAO_Rapport_Mensuel_Direction_<YYYY-MM>.xlsx`) مكوّناً من **5 أوراق عمل**:
  1. `Synthese_Direction`: جدول المؤشرات التنفيذية والمقارنة مع الشهر السابق.
  2. `Ruptures_et_Alertes`: قائمة الشراء ذات الأولوية للأصناف النافدة والحرجة مع الكمية المقترحة للطلب والميزانية التقديرية.
  3. `Mouvements_du_Mois`: سجل حركات المخزون للشهر المحدد.
  4. `Pannes_Correctives_Mois`: سجل التدخلات التصحيحية للشهر المحدد.
  5. `Executions_Preventives`: سجل التنفيذات الوقائية للشهر المحدد.
- **الطباعة الرسمية (`triggerMonthlyReportPrint`):** تهيئة عرض الطباعة عبر `window.print()` مع ترويسة تنفيذية وجدول توقيعات رسمي ثلاثي (`Responsable Maintenance`, `Responsable Magasin PDR`, `Direction Générale d’Usine`).

---

## 7. طبقة الحماية والتشغيل الشبكي (الخادم والمزامنة)

> **توصيف دقيق لمستوى النضج:** يعمل الخادم المحلي (`server.ts`) كمضيف شبكة محلية (`LAN Host`) يعتمد على ذاكرة متسلسلة وملف حالة ذري (`data/gmao_state.json`) مع سجل تدقيق إلحاقي (`data/gmao_audit.jsonl`). وهو مصمم لتشغيل ومزامنة حواسيب وهواتف المصنع على الشبكة المحلية، وليس نظام قواعد بيانات موزعة متعدد المستأجرين (`Multi-Tenant Cloud ERP`).

### أ) القائمة البيضاء للكيانات (`ALLOWED_ENTITIES`) وحماية `POST /api/gmao/state`
- **المرجع البرمجي:** `server.ts` (الأسطر `15–55` و `506–608`).
- يعرّف الخادم قائمة بيضاء صارمة (`ALLOWED_ENTITIES`) تضم **32 كياناً قياسياً فقط** (`rawStock`, `stock`, `types`, `designations`, `machines`, `families`, `templates`, `blueprints`, `zones`, `machineElementsLedger`, `mouvements`, `preventiveTasks`, `preventiveActions`, `preventiveGuides`, `preventivePlans`, `preventiveExecutions`, `correctiveInterventions`, `correctiveActionsByPanne`, `correctivePanneCategories`, `correctiveTravauxAFaire`, `correctiveIntervenants`, `users`, `technicians`, `operations`, `warehouseItems`, `entrepotComponents`, `compGroups`, `compFamilies`, `compTemplates`, `partTypes`, `partDesignations`, `sortiesExterne`).
- يفرض حارس المسارات `requireAllowedEntity` الرد `403 Forbidden` على أي طلب CRUD يستهدف كياناً خارج القائمة البيضاء.
- عند استدعاء `POST /api/gmao/state`، يرفض الخادم أي حمولة ليست كائناً (`400 Bad Request`)، ويتجاهل أي مفاتيح غير مدرجة في `ALLOWED_ENTITIES`، ويتحقق من نوع كل كيان (مصفوفة مقابل قاموس كائن في `OBJECT_ENTITY_SET`).

### ب) المصادقة بالتوكن (`API Token`) والتحكم بالصلاحيات (`RBAC`)
- **المراجع البرمجية:** `authenticateApi` في `server.ts` (الأسطر `95–192`)، و `AuthorizationService` في `src/core/security/AuthorizationService.ts`، و `src/services/serverSyncService.ts`.
- **حماية التوكن (`x-gmao-api-token`):**
  - في طلبات التعديل (`POST`, `PUT`, `DELETE`)، يتحقق الخادم من الترويسة `x-gmao-api-token` مقابل المتغير البيئي `GMAO_API_TOKEN`، مع دعم وضع التشديد الصارم `GMAO_STRICT_TOKEN=true`، ويرفض أي توكن خاطئ فوراً بالرد `401 Unauthorized`.
- **فرض الأدوار (`x-gmao-role`):**
  - يطبّع الخادم الدور عبر `normalizeServerRole` إلى الأدوار القياسية (`ADMIN`, `RESPONSABLE_MAINTENANCE`, `RESPONSABLE_MAGASIN`, `TECHNICIEN`, `OPERATEUR`, `VIEWER`).
  - يمنع دور المراقب (`VIEWER`) من أي تعديل على حالة الخادم (`403 Forbidden`)، كما يمنع `serverSyncService.pushToServer` إرسال طلبات الدفع من طرف العميل لدور `VIEWER`.
  - يحمي الكيانات الإدارية (`ADMIN_ONLY_ENTITIES`: `users`, `technicians`, `operations`, `zones`) بحيث لا يعدلها إلا `ADMIN` أو `RESPONSABLE_MAINTENANCE`.
  - يمنع أدوار `TECHNICIEN` و `OPERATEUR` من حذف سجلات الكتالوج الأساسي (`CATALOG_PROTECTED_ENTITIES`).
- **حماية إضافية في `server.ts`:** ترويسات أمان قياسية (`Content-Security-Policy`, `X-Content-Type-Options: nosniff`, `X-XSS-Protection`, `Referrer-Policy`) ومحدد معدل طلبات في الذاكرة (`apiRateLimiter`: `300` طلب/دقيقة لكل عنوان IP مع الرد `429 Too Many Requests`).

### ج) طابور الكتابة المتسلسل الذري (`Serialized Atomic Write Queue`) وسجل التدقيق
- **المرجع البرمجي:** الدالة `persistState` في `server.ts` (الأسطر `299–346`).
- تُنفَّذ جميع عمليات الكتابة على القرص عبر سلسلة وعود متسلسلة غير حاجبة (`writeQueue: Promise<void>`) تمنع سباقات الكتابة المتزامنة (`Race Conditions`).
- تتم الكتابة أولاً في ملف مؤقت `data/gmao_state.json.tmp` عبر `fs.promises.writeFile` ثم يُستبدل الملف الأصلي ذرياً عبر `fs.promises.rename(STATE_TMP_FILE, STATE_FILE)` لضمان عدم تلف ملف JSON عند انقطاع التيار أو تعطل العملية.
- مع كل عملية حفظ، يُلحق سجل تدقيق غير قابل للتعديل في `data/gmao_audit.jsonl` يتضمن (`id`, `timestamp`, `version`, `actor`, `action`, `entity`, `summary`) ويُعرض عبر `GET /api/gmao/audit`.

### د) التحكم التفاؤلي بالتزامن (`version` / `409 Conflict`) والبث الفوري (`SSE`) واكتشاف `LAN`
- **التحكم بالإصدار (`Optimistic Concurrency`):**
  - يحمل `dbState` عداد إصدار متزايد (`version`) وتاريخ تحديث (`updatedAt`) وترويسة `ETag: W/"v<version>"`.
  - يرسل `serverSyncService.pushToServer` رقم الإصدار المتوقع (`expectedVersion`). إذا كان إصدار الخادم أحدث من إصدار العميل (`expectedVersion < dbState.version`) ولم يُطلب الفرض الصريح (`force !== true`)، يرفض الخادم الكتابة الفوقية الصامتة ويرد بـ `409 Conflict` مرفقاً بالحالة الأحدث للخادم، وتطلق الواجهة الحدث `gmao:server_conflict` لمعالجته.
- **البث الفوري (`Server-Sent Events - SSE`):**
  - يوفّر الخادم المسار `GET /api/gmao/events` لبث أحداث `STATE_UPDATED` مع رقم الإصدار الجديد لجميع العملاء المتصلين لحظة انتهاء `writeQueue`، ويشترك العميل عبر `networkConfigService.subscribeToRevisionStream`.
- **اكتشاف الشبكة المحلية (`LAN Discovery`) ومصفوفة QR بدون إنترنت:**
  - يفحص المسار `GET /api/network/info` واجهات الشبكة الفعلية عبر `os.networkInterfaces()` ويعطي الأولوية لشبكات LAN الخاصة (`192.168.x.x`, `10.x.x.x`, `172.16-31.x.x`).
  - يدير `src/services/networkConfigService.ts` التبديل بين وضع المضيف (`HOST`) ووضع العميل الشبكي (`LAN_CLIENT`) عبر `resolveApiUrl`، ويولّد مصفوفة QR حتمية بأبعاد `21x21` (`generateDeterministicQrMatrix`) محلياً بالكامل بدون أي اتصال بالإنترنت.
- **الاختبارات المُثبتة:**
  - `src/tests/unit/Round4ServerSyncAndConcurrency.test.ts`
  - `src/tests/unit/Round5RbacAndSecurity.test.ts`
  - `src/tests/unit/Round7LanArchitectureAndRefactoring.test.ts`

---

## 8. آلة الحالة المحدودة للصيانة التصحيحية (`Work Order FSM`)

- **المراجع البرمجية:**
  - آلة الحالة: `src/domain/corrective/services/WorkOrderStateMachine.ts`.
  - معالجات الحالة في المخزن المركزي: `src/store/useGmaoStore.ts` (`handleConvertToBt`, `handleStartLiveIntervention`, `handleClotureIntervention`, `handleUpdateCorrectiveIntervention`).
  - واجهات التشغيل الميداني: `src/presentation/pages/corrective/BonsTravailTab.tsx` و `src/presentation/pages/corrective/InterventionLiveTab.tsx`.
- **الحالات القياسية المعتمدة (`WorkOrderStatus`):**
  `DEMANDE` ← `BT_PLANIFIE` ← `EN_COURS` ⇄ `EN_ATTENTE_PDR` ← `CLOTURE` (أو `ANNULE`).
- **الضمانات التصميمية المُنفَّذة:**
  1. **تطبيع المسميات (`normalizeStatus`):** تحويل جميع المسميات التاريخية والفرنسية (`DEMANDE_CREEE`, `DI`, `PLANIFIE`, `LIVE`, `ON_HOLD`, `FERME`, `TERMINE`, إلخ) إلى الحالات الست القياسية.
  2. **حراسة الانتقالات على مستوى المخزن (`Store-Level Transition Guards`):** تتحقق جميع دوال التحويل والبدء والتحديث والإغلاق في `useGmaoStore.ts` عبر `WorkOrderStateMachine.validateTransition` قبل تعديل الحالة، وتعتبر حالتي `CLOTURE` و `ANNULE` حالات نهائية (`Terminal States`) لا تقبل إعادة الإغلاق أو الرجوع إلى `EN_COURS`.
  3. **التعليق المؤقت بانتظار قطعة غيار (`EN_ATTENTE_PDR`):** إتاحة تعليق أمر العمل من جدول `BonsTravailTab` أو شاشة `InterventionLiveTab` إلى حالة `EN_ATTENTE_PDR` واستئنافه لاحقاً إلى `EN_COURS` مع فلترة مخصصة وعداد مستقل.
  4. **الإغلاق الذري غير المتكرر ومنع الخصم المزدوج (`Idempotent BT Closure & Single Movement Path`):**
     - يرفض `handleClotureIntervention` في `src/store/useGmaoStore.ts` أي محاولة لإعادة إغلاق أمر عمل مغلق مسبقاً (`statut === 'CLOTURE'` أو `action_fermee === 'OUI'`) ويُرجع `null` دون المساس بالمخزون.
     - عند الإغلاق الصالح مع استهلاك قطعة غيار (`pdr_ref` و `pdr_quantite > 0`)، تمر حركة الصرف عبر مسار واحد فقط (`onAddMouvement` عند تمريره من الموجه، أو `movementRepository.add` + `setMouvements` عند الاستدعاء المباشر للمخزن) لمنع تكرار الإضافة في `movementRepository`.
  5. **استهلاك متعدد لقطع الغيار (`Multi-PDR pieces_utilisees`) وتحديث حالة المكون (`Component Lifecycle Sync` — `FIX-3`):**
     - يدعم `handleClotureIntervention` في `src/store/useGmaoStore.ts` وشاشة `InterventionLiveTab.tsx` إضافة قائمة متعددة من قطع الغيار المستهلكة (`pieces_utilisees`) في نفس أمر العمل، مع توليد حركة صرف مستقلة (`BS-BT-<num>-1`, `BS-BT-<num>-2`, ...) لكل قطعة، وحساب التكلفة الإجمالية (`cout_pdr` / `pdr_cost`) المتوافقة مع `MonthlyReportCalculationService.ts`، مع الحفاظ على التوافق التام مع الحقل المفرد `pdr_ref`.
     - عند ربط التدخل التصحيحي بمكون مستودع (`id_composant`)، تتيح شاشة الإغلاق تحديد الحالة الجديدة للمكون بعد التدخل (`En service`, `En réparation`, `Hors service`) وتُحدّث سجله في `warehouseItems` تلقائياً مع ختم رقم أمر العمل وتاريخ آخر تدخل (`derniere_intervention_bt`, `derniere_intervention_date`).
- **الاختبارات المُثبتة:**
  - `src/tests/unit/Round6FsmAndMonthlyReport.test.ts`
  - `src/tests/unit/ThreeCriticalPaths.test.ts` (المساران الخامس والسادس: `FIX-1` و `FIX-3`)

---

## 9. سجل التحقق الآلي (`Automated Verification Matrix`)

| المجال الهندسي | القدرة الموثّقة | ملف الاختبار الآلي (`Vitest`) |
|---|---|---|
| **SSOT والتفريغ** | ثبات التفريغ (`clearAllForRealFactory`)، تطهير المفاتيح القديمة، وعدم عودة البيانات بعد `F5` | `src/tests/unit/PreventiveClearPersistence.test.ts` |
| **المسارات الحرجة السبعة** | 1) معادلة المخزون، 2) ثبات التفريغ الشامل، 3) عزل الآلات المؤرشفة، 4) منع الحقن التلقائي للبذور، 5) الإغلاق الذري لأوامر العمل (`BT`) وحراسة `EN_ATTENTE_PDR`، 6) الصرف المتعدد لقطع الغيار (`Multi-PDR`) وتحديث حالة المكون، 7) الجسر التنبؤي (`Correctif → Préventif`) ومزامنة عداد ساعات الآلة | `src/tests/unit/ThreeCriticalPaths.test.ts` |
| **ترابط البذور ومحرك المخزون** | توحيد `IncrementalStockIndex` و `StockCalculationService` وتطابق الرصيد 100% مع كشف `RUPTURE` و `ALERTE` | `src/tests/unit/StockMovementsCorrectiveSeeds.test.ts` |
| **الذاكرة الزمنية والتقارير** | `ExecutionService.recordExecution`، تحديث الاستحقاق، فلاتر الفترات، وحساب التقرير الشهري | `src/tests/unit/Phase1FactoryMemory.test.ts` |
| **التزامن والتدقيق (الخادم)** | كشف تعارض الإصدارات (`SERVER_NEWER`)، معالجة `HTTP 409 Conflict`، وسجل التدقيق `GET /api/gmao/audit` | `src/tests/unit/Round4ServerSyncAndConcurrency.test.ts` |
| **الأمن والصلاحيات (RBAC)** | مصفوفة صلاحيات `AuthorizationService`، منع `VIEWER` من الدفع، وفحص `x-gmao-role` و `x-gmao-api-token` | `src/tests/unit/Round5RbacAndSecurity.test.ts` |
| **آلة الحالة والاعتمادية** | حراسة انتقالات `WorkOrderStateMachine`، حساب `MTTR / MTBF / OEE`، والمقارنة الشهرية (`MoM`) | `src/tests/unit/Round6FsmAndMonthlyReport.test.ts` |
| **معمارية LAN وتفكيك الإعدادات** | أوضاع `HOST / LAN_CLIENT`، مصفوفة QR الحتمية `21x21`، مسارات `/api/network/info` و `/api/gmao/events`، وتفكيك `SettingsView.tsx` | `src/tests/unit/Round7LanArchitectureAndRefactoring.test.ts` |

---

## 10. الحدود الهندسية الصريحة (`Explicit System Boundaries`)

التزاماً بالشفافية الهندسية أمام المستثمرين والمطورين:
1. **منصة ويب تشغيلية أولاً (`Web-First Operational Platform`):** يعمل النظام بكامل قدراته عبر المتصفح مع تخزين هجين (`Memory Cache + localStorage + IndexedDB`) وخادم Node/Express محلي (`server.ts`).
2. **نطاق التشغيل الشبكي المحلي (`LAN Host Scope`):** يوفر الخادم الحالي كتابة ذرية متسلسلة (`writeQueue` إلى `gmao_state.json`) ورقم إصدار (`version`) وكشف تعارض (`HTTP 409`) وبث إشعارات تحديث (`SSE`). هذا التصميم مناسب لمزامنة عدة أجهزة داخل ورشة أو مصنع محلي، لكنه ليس قاعدة بيانات علائقية موزعة (`PostgreSQL / Cloud SQL`) لآلاف المستخدمين المتزامنين في نفس اللحظة.
3. **التقييم المالي التشغيلي وليس المحاسبة القانونية (`Operational Valuation vs. Financial ERP`):** يحسب النظام تكلفة قطع الغيار المستهلكة، قيمة المخزون الحالي، وتكلفة ساعات الصيانة لأغراض الضبط الصناعي وإدارة المصنع، ولا يدّعي استبدال برامج المحاسبة القانونية والفوترة الضريبية (`SAP FI/CO` أو `ERP` المالي).
