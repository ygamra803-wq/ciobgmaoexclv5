# 🏛️ دليل المعمارية الموحد ونظام إدارة الحالة (State Orchestrator & Architectural Standard)

> تم نقل وتوحيد محتويات هذا المستند من تعليمات المعمارية وإدارة الحالة لحفظها كمرجع توثيقي دائم ومفصل للمطورين، ولتقليل حمولة سياق العمل والرموز (Token Optimization).

---

## 1. المعيار المعماري الأساسي: نمط منسق الحالة المركزي (Centralized State Orchestrator Pattern)

لتفادي تشتت الحالة (State Drift) أو تعارض التخزين والتعديلات غير المنسقة عبر وحدات GMAO، تلتزم كافة الشاشات والوحدات بنمط المنسق المركزي:

```
1. Dedicated Domain Seed Database (/src/data/[domain]/seed[Domain]Items.json)
                       │
2. Storage & Persistence Tier (IndexedDB Batch + LocalStorage fallback)
                       │
3. Domain Sub-State Hooks (/src/hooks/use[Entity]SubState.js)
                       │
4. Master State Orchestrator (/src/hooks/useGmaoState.js)
         ├─ Unified Auto-Save & Debounce (/src/hooks/useAutoSave.js)
         └─ Multi-Tab Broadcast Sync (/src/hooks/useStateSync.js)
                       │
5. App Root Component (/src/App.jsx)
                       │
6. Router Props Coordinator (/src/presentation/router/useAppRouterProps.js)
                       │
7. Pure Presentation Views (/src/presentation/pages/.../[View].jsx)
```

---

## 2. معمارية الحقن النظيف والبيانات المرجعية المخصصة (Dedicated Clean Seed Architecture)
### *المعيار الموحد المقتبس من نظام الصيانة التصحيحية (Standard Corrective Pattern)*

يعتبر نظام الصيانة التصحيحية (`src/data/corrective/`) هو النموذج المعماري الذهبي (Gold Standard) المعتمد في التطبيق، ويتم تعميمه تدريجياً على كافة الأقسام (المخزون، الآلات، الوقائية، المستودع).

### أركان المعمارية النظيفة (The 4 Pillars):
1. **قواعد بيانات مرجعية مستقلة ونظيفة (`src/data/<domain>/`):**
   - عزل بيانات كل نطاق في ملفات JSON مخصصة ومستقلة تماماً بدلاً من حشوها في ملف ضخم غير متجانس (`initialData.json`).
   - مثال:
     - الصيانة التصحيحية: `src/data/corrective/seedCorrectiveInterventions.json` (+1745 سجلاً).
     - المخزون الحالي: `src/data/stock/seedStockItems.json` (873 مقالاً نظيفاً) و `seedStockTypes.json`.
2. **منع التخمين والترقيع وقت التشغيل (Zero Runtime Guesswork):**
   - السجلات المرجعية مكتوبة بحقول صريحة، موحدة، وثابتة الأنواع (`id`, `ref`, `designation`, `type`, `stockInitial`, `seuil`, `emplacement`).
   - لا يجوز للـ Hooks فحص مفاتيح ملتبسة وقت التشغيل (مثل فحص هل `item.Type` رقم أم فئة أم كمية).
3. **طبقة حالة فرعية نقية (Pure Domain Sub-State Hook):**
   - الـ Hook الفرعي (مثل `useStockSubState.js`) يستورد ملفات الـ Seed مباشرة ويفحص التخزين المحلي.
   - إذا كان التخزين المحلي فارغاً أو قديماً، يتم الحقن الفوري للـ Seed، مع ضمان الحفاظ على أي تعديلات جديدة قام بها المستخدم.
   - تصدير دوال CRUD موحدة وصريحة نحو المنسق المركزي (`useGmaoState.js`).
4. **تطهير واجهات العرض من أي استدعاءات هجينة (No Legacy Bleed):**
   - شاشات العرض (مثل `StockView.jsx`) شاشات نقية (Pure Presentation Views) تستقبل البيانات والدوال عبر الـ `props` من `useAppRouterProps.js`.
   - يمنع منعاً باتاً استدعاء حاويات قديمة مثل `useSpareParts()` أو `localStorage` داخل الشاشات.

---

## 3. القواعد الأربع الأساسية (The 4 Fundamental Rules)

### القاعدة 1: شاشات عرض نقية (Pure Presentation Views: Props Down, Events Up)
- لا تستدعي الشاشات إطلاقاً `localStorage.getItem` أو `localStorage.setItem` مباشرة للكيانات المشتركة للنظام.
- لا تقوم الشاشات بإنشاء عمليات `fetch` مستقلة أو دوال تمهيد داخل `useEffect` قد تمسح أو تعيد كتابة تعديلات المستخدم ببيانات افتراضية.
- تُستقبل البيانات كـ `props` للقراءة فقط من `useAppRouterProps.js`.
- كافة التعديلات تُرسل عبر دوال رد اتصال واضحة وصريحة (مثل: `onAddX`, `onUpdateX`, `onDeleteX`).

### القاعدة 2: الفصل بين البيانات التجريبية وبيانات المصنع الحقيقية (Baseline Seeds vs. Real Factory Data)
- لا يتم تحميل البيانات الأولية أو ملفات JSON إلا إذا كان التخزين غير مهيأ بالكامل لأول مرة (`gmao_initialized_flag`).
- في حال حذف المستخدم سجلات أو اختياره جداول فارغة في بيئة تشغيل مصنعية حقيقية، يمنع إعادة حقن البيانات التجريبية تلقائياً.

### القاعدة 3: الحفظ التلقائي في معاملة موحدة (Unified Single-Transaction Auto-Save)
- الحفظ الدائم مركزي وموحد في `useAutoSave.js`.
- عمليات الحفظ المجمعة تنفذ نحو IndexedDB مع تأخير مناسب (Debounced persistence) لعدم تجميد واجهة المستخدم أو معدل الإطارات (60fps).

### القاعدة 4: المزامنة عبر التبويبات المتعددة (Multi-Tab Broadcast Sync)
- تدار مركزياً عبر `useStateSync.js` باستخدام `StorageEvent` و `BroadcastChannel` لتنعكس التعديلات بين جميع التبويبات المفتوحة فورياً دون الحاجة لإعادة تحميل الصفحة.

---

## 3. التطورات المعمارية الثلاثة (The 3 Architectural Evolutions)

1. **سياقات النطاق (Domain Contexts - بديل الـ Prop-Drilling العميق):**
   - توفير سياقات مخصصة (`StockContext`, `PreventiveContext`, `MachineContext`, `SortieExterneContext`, `WarehouseContext`) في `/src/context/GmaoDomainContext.jsx`.
   - تغليف شاشات `AppRouter` لتمكين المكونات الفرعية من استهلاك الحالة مباشرة وبشكل نظيف.
2. **عامل الويب للعمليات الحسابية الثقيلة (Web Worker for Intensive Computing):**
   - تفريغ عمليات التصفية على آلاف السجلات، والبحث المصفوفي، ومؤشرات KPI، وتصدير إكسيل إلى `/src/workers/stockWorker.js` و `/src/hooks/useStockWorker.js` لضمان سلاسة العرض.
3. **مدير التراجع والإعادة العام (Global Undo / Redo Manager):**
   - إدارة سجل العمليات المركزية `Ctrl+Z` / `Ctrl+Y` في `/src/utils/undoRedoManager.js` و `/src/hooks/useUndoRedo.js` لحماية عمليات المخزون وحركات الصيانة.

---

## 4. محرك الفهرسة التزايدي ومسلمات الأمان الرياضي (Incremental Stock Index & Invariants)

لضمان دقة $O(1)$ في تحديث الأرصدة ومنع أي تباعد حسابي أو تراجع خاطئ، يلتزم `IncrementalStockIndex.ts` بالمسلمات التالية المعتمدة باختبارات الخاصية الرياضية (*Property-Based Testing* via `fast-check`):

### Stock Index Invariants (Verified by property tests)
- **P1 (Consistency):** incremental `applyDelta` produces identical final state to `rebuild` for any sequence of movements.
- **P2 (Reversibility):** `applyDelta(m)` followed by `rollbackDelta(m)` is a no-op that restores the exact prior state.
- **P3 (Atomicity):** `updateDelta(a→b)` ≡ `rollbackDelta(a)` + `applyDelta(b)`.
- **P4 (Non-negativity):** `calculateCurrentStock` $\ge 0$ for any combination of inputs.
- **Design rule (No Clamping in Totals):** raw running totals (`entrees`, `sorties`) are **NEVER** clamped. Clamping (`Math.max(0, ...)`) belongs to `calculateCurrentStock` strictly at calculation/display time.
- **Design rule (Explicit Type Aliases & Accents):** unknown movement types are logged with warning tags rather than being silently dropped or incorrectly matched.
- **Design rule (Orders Separation):** `COMMANDE` is tracked as an independent `commandes` counter that provides instant visibility without skewing physical on-hand stock.
- **Design rule (Single Write Path):** `MovementRepository` is the sole authorized writer to the index and broadcast coordinator (`add`, `edit`, `remove`, `bulkReplace`). No UI component or `useMemo` is permitted to invoke `index.rebuild` directly.

### 🔵 Technical Debt: notifyAll() on every mutation
- **Status:** Temporary (v3.0 Transition)
- **Reason:** `useAppCalculations` computes `stockItems` and `warehouseItemsComputed` based on `rawStock`/`warehouseItems` + `globalVersion`.
- **Impact:** Any single movement currently triggers a version tick that refreshes the computed stock lists.
- **Target (v3.1):** Remove `notifyAll()` from `add/edit/remove`. Move per-row balance read into `<StockRow>` via `useStockValue(ref)` and `<WarehouseRow>` via `useStockValue(id_warehouse_item)`. `useAppCalculations` will return only static catalog fields.
- **Trigger for fix:** When table views exceed 500 rows or low-spec mobile shopfloor devices report frame drops.

---

## 5. خارطة توحيد الشاشات والوحدات (Standardization Roadmap)

1. **الخروج الخارجي واللف الورشوي (`SortieRapideView` / `SortieExterneBobinageTab`):**
   - عزل الحالة في `useSortieExterneSubState.js`.
   - ربط ورش إصلاح المحركات، وحالات الموردين الخارجيين، وقطع الغيار في `useGmaoState.js`.
   - حفظ متزامن في `useAutoSave.js` ومزامنة عبر التبويبات في `useStateSync.js`.
2. **المستودع وقطع الغيار الاحتياطية (`EntrepotView`):**
   - توحيد مواقع المستودع، القطع، والمكونات في `useWarehouseSubState.js`.
3. **مساعد الذكاء الاصطناعي نكسس (`NexusView`):**
   - تمرير حالة المصنع اللحظية مباشرة من منسق الحالة المركزي بدلاً من القراءة العشوائية من التخزين المحلي.
4. **الصيانة الوقائية والمرجعية (`PreventiveView` & `PreventiveSecondaryView`):**
   - توحيد +1175 مهمة، خطة، دليل، وإجراء وقائي في `usePreventiveSubState.js`.
   - ربط استهلاك المخزون (`onAddMouvement` & `onDirectAdjustStock`) بمرسلات المنسق الرئيسي.
5. **المناطق والورش (`ZonesView`):**
   - إدارة الورش ومواقع الخطوط والآلات عبر `useMachineSubState` والتوابع المركزية.
6. **المستخدمون والفنيون (`UtilisateursView`):**
   - إدارة الفنيين والعمليات وصلاحيات الأدوار عبر `useUserSubState`.
7. **النسخ الاحتياطي والاستعادة (`SettingsView` / `AutoBackupService`):**
   - لقطات نسخ احتياطي شاملة تغطي كافة جداول النظام في `CRITICAL_KEYS` مع بث فوري للمزامنة.

---

## 5. معيار واجهة المستخدم: الجداول المجمعة بالأكورديون (Collapsible Parent-Grouped Table Standard)

لتحقيق أقصى كفاءة بي ارغونومية في الجداول والتقاويم المعقدة (جداول الصيانة الوقائية، مصفوفة 52 أسبوعاً، مواقع المستودع):

1. **تجميع الكيانات الرئيسية (Parent-Entity Grouping):**
   - سطر واحد مضغوط لكل كيان رئيسي افتراضياً (مثل: آلة، معدة، منطقة، عائلة).
   - ملخص مباشر وفوري في السطر: المعرف، الاسم، إجمالي العناصر الفرعية، شارات الحالة، والإجراءات المجدولة.
2. **التوسيع التفاعلي داخل الجدول (Accordion Expansion):**
   - النقر على السطر أو السهم يفتح العناصر الفرعية مباشرة أسفله برابط شجري مرئي (`└─`).
   - عرض البيانات الدقيقة: المكون، رمز الإجراء، الدورية، المسؤول، الحالة، وأزرار التنفيذ.
3. **الترقيم المعتمد على الكيان الرئيسي (Entity-Centric Pagination):**
   - حجم الصفحة (`pageSize`) يحسب عدد الكيانات الرئيسية (مثلاً: 20 آلة في الصفحة)، مما يضمن عدم تفتيت مهام الآلة الواحدة بين صفحات متعددة.
4. **عناصر التحكم الجماعية (Tout déplier / Tout replier):**
   - زر علوي مخصص لفتح أو طي كافة المجموعات الحالية بنقرة واحدة.
5. **مظهر إكسيل الأنيق (Excel Light Aesthetic):**
   - خطوط شبكة واضحة `border-slate-200`، تظليل تبادلي للأسطر، وأرقام متسلسلة ثابتة مع تباين عالي للطباعة والقراءة.
