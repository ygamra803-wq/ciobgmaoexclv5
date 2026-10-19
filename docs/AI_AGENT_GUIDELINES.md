# 🤖 دليل مطوري ووكلاء الذكاء الاصطناعي (AI Agent & Core Engineering Spec)

هذا التوثيق يمثل المواصفة الهندسية الدقيقة لنظام **CIOB GMAO Light UI Excel**، وهو مخصص لمساعدي الذكاء الاصطناعي (**AI Agents**) والمهندسين الذين يقومون بصيانة وتطوير النظام، لضمان عدم كسر القواعد الأساسية، والحفاظ على التطابق الدقيق مع **Excel Twin** ومبدأ الـ **100% Offline Client-Side Execution**.

---

## 🏛️ 1. المبادئ المعمارية الحاكمة (Golden Architecture Principles)

1. **العمل المستقل دون خادم (Strict Offline Client-Side Execution):**
   - التطبيق لا يعتمد على خادم Node/Express لتشغيل قواعد بيانات (مثل SQLite أو Postgres) في وضع الإنتاج للعميل.
   - محرك التخزين الأساسي هو **IndexedDB** للبيانات الكبيرة و **LocalStorage** للتهيئة والحالات الخفيفة عبر `storageService` و `indexedDBService`.
   - يمنع تماماً تثبيت حزم C++ Native (مثل `better-sqlite3`, `sharp`, `sqlite3`) في حزم الواجهة الأمامية.

2. **نموذج التوأم لإكسيل (Excel Twin Model & Single Source of Truth):**
   - كل جدول هو صورة طبق الأصل من ورقة عمل (`Worksheet`) في النموذج المرجعي `GMAO_Light_Template_V2_Formules.xlsx`.
   - جميع الحسابات (الأرصدة، مجموع الوارد والصادر، التنبيهات) تتم في الذاكرة اللحظية عبر `formulaEngine.js` ومحسوبة في الوقت الحقيقي عبر خطاف `useAppCalculations`.

3. **التحسين الرياضي للأداء والتصيير (React 19 & Memoization Discipline):**
   - استخدام `useMemo` و `useCallback` لمنع أي Re-render غير مبرر في الشاشات والجداول الكبيرة.
   - تثبيت حجم الجداول على معيار **20 سطر مرئي** (سطر العنوان + 19 سطر بيانات أو سطور بديلة فارغة ناعمة) مع حاوية تمرير هيدروليكية `max-h-[62vh] overflow-y-auto`.

---

## 🧬 2. هيكلية الحالات وتدفق البيانات (State Management & Hooks Flow)

```text
[LocalStorage / IndexedDB]
       │
       ▼
[useGmaoState] ── (Composes 5 Domain Sub-Hooks)
       │
       ├─► useStockSubState        (rawStock, designations, types)
       ├─► useMovementSubState     (mouvements)
       ├─► useMachineSubState      (machines, families, templates)
       ├─► useWarehouseSubState    (warehouseItems, compFamilies, compTemplates, partTypes, partDesignations)
       └─► useUserSubState         (zones, technicians, operations)
       │
       ▼
[useGmaoPersistence] ── (useAutoSave: Debounced 1000ms + useStateSync Multi-Tab)
       │
       ▼
[useAppCalculations] ── (Real-time SUMIFS: stockItems, stockKPIs, warehouseItemsComputed)
       │
       ▼
[useAppRouterProps] ── (useMemo: Passes optimized props to modules)
       │
       ▼
[AppRouter] ── (Renders Active View: Dashboard, Stock, SortieRapide, Machines, etc.)
```

---

## 📐 3. محرك الحسابات الرياضي (`src/utils/formulaEngine.js`)

### معادلة الرصيد الفعلي للمقال (`Stock Actuel`):
```excel
= StockInitial + SUMIFS(Mouvement[Quantite], Mouvement[Ref], [@Ref], Mouvement[Type], "Entrée") - SUMIFS(Mouvement[Quantite], Mouvement[Ref], [@Ref], Mouvement[Type], "Sortie")
```
في الجافاسكريبت:
```javascript
const entrees = sumMovements(mouvements, ref, 'Entrée');
const sorties = sumMovements(mouvements, ref, 'Sortie');
const stockActuel = Number(stockInitial || 0) + entrees - sorties;
```

### معادلة شارة التنبيه (`Alerte`):
```javascript
if (isAchatUnique) {
  alerte = 'OK';
} else if (displayStock <= 0) {
  alerte = 'RUPTURE'; // خلفية حمراء
} else if (displayStock <= Number(seuil || 0)) {
  alerte = 'ALERTE';  // خلفية برتقالية
} else {
  alerte = 'OK';      // خلفية خضراء
}
```

---

## 🔒 4. الأمان والمصادقة الصارمة (`src/core/security/AuthService.js`)

- **تشفير كلمات المرور:** يتم التشفير حصراً بخوارزمية الهاش الأحادية (`bcrypt.hashSync(pass, 10)`).
- **قواعد منع التسريب (Data Leak Prevention):**
  - **يمنع قطعياً** تخزين `defaultPass` أو أي كلمة مرور صريحة في كائنات المستخدمين بعد التعيين.
  - **يمنع قطعياً** إدراج `passwordHash` أو `defaultPass` داخل كائن الجلسة `currentSession` في `localStorage`.
  - يجب تنظيف الجلسة لتقتصر فقط على: `id`, `username`, `name`, `role`, `token`, `loginTime`.

---

## 🧪 5. مصفوفة الاختبارات والتحقق البرمجي (Testing Standard)

التطبيق مدعوم ببيئة اختبارات شاملة مبنية على **Vitest**:

| مسار ملف الاختبار | نطاق التحقق والمهمة |
| :--- | :--- |
| `src/test/unit/AppCalculations.test.jsx` | فحص محرك حسابات الوارد والمنصرف والرصيد الفعلي والتنبيهات. |
| `src/test/unit/baselineStock.test.js` | فحص اتساق بيانات المخزون المرجعية مع نموذج إكسيل. |
| `src/test/unit/MovementNormalization.test.js` | فحص تنظيف وتأهيل حركات الصرف والإدخال والتدفقات الـ 5. |
| `src/test/unit/AutoBackupService.test.js` | فحص النسخ الاحتياطي المضغوط وفك الضغط واسترجاع البيانات. |
| `src/test/unit/PermissionGate.test.jsx` | فحص بوابات الصلاحيات وحماية الشاشات حسب رتبة المستخدم. |
| `src/test/utils/securityService.test.js` | فحص تشفير الـ PIN والتحقق الأمني. |
| `src/test/e2e/offlineSync.test.js` | فحص المزامنة المحلية عند انقطاع وعودة الاتصال. |

**لتشغيل الاختبارات في أي وقت:**
```bash
npx vitest run
```

---

## 🏛️ 7. الميثاق الهندسي لمحرك البيانات العلائقي (The Deterministic Relational Engine & 2-Tier Architecture)

### 1. فلسفة "الآلة الميكانيكية وشاشة الـ LCD" (Mechanical Engine + LCD Screen Philosophy):
- التطبيق يُعامل كأنه مصنف إكسيل موحد في الذاكرة (**Unified In-Memory Excel Workbook**) ذو منطق علائقي حتمي وصارم.
- شاشات وواجهات المستخدم (**UI Views**) هي مجرد **شاشات عرض رقمية (LCD Readouts)**:
  - **يمنع قطعياً** أن تخترع الواجهة بيانات محلية مستقلة أو تنشئ مصفوفات خاصة بها معزولة عن باقي النظام (No Data Silos).
  - جميع الأرقام والإحصائيات والعدادات تحسب ديناميكياً عبر معادلات إكسيل الصريحة (`SUMIFS`, `COUNTIFS`, `FILTER`, `VLOOKUP`).

### 2. بنية المستويين لكل قسم (2-Tier Module Architecture):
لكل مجموعة رئيسية في النظام مستويان متكاملان:
1. **المستوى 1: الصفحات التشغيلية (المركز الأول - Transactional / Operational Data):**
   - مثل: `Correctif Hub` (DI, BT, Chrono, Clôture), `Planning Préventif`, `Stock Articles & Sorties`, `Machines Registered`.
   - **قاعدة ذهبية:** تخزن هذه الصفحات حصراً **المفاتيح المرجعية الخارجية (Foreign Keys)** مثل (`machine_id`, `panne_code`, `technicien_id`, `pdr_ref`)، ويمنع منعاً باتاً تخزين أسماء ونصوص حرة مكررة.
2. **المستوى 2: الصفحات المرجعية (المركز الثاني / الكواليس - Master Data & Tools):**
   - مثل: `Catalogue & Données GMAO` (كتالوج الـ 282 عطلاً، مهام الورشة الـ 114 القياسية، مصفوفات الحلول 71), `Ingénierie & Référentiel Préventif`, `Familles & Blueprints`.
   - توفر هذه الشاشات الكتالوجات والقوالب الثابتة التي تغذي المستوى التشغيلي وتمنع التكرار البشري.

### 3. شجرة النسب والاعتمادية بين البيانات (Strict Data Lineage):
- `Zones` (المواقع والورشات) ──► تغذي `Machines Registered`.
- `Machines Registered` ──► تغذي قطع الغيار (`PDR / Stock / Entrepôt`)، وجداول الصيانة الوقائية (`Preventive`)، والصيانة العلاجية (`Corrective`).
- `Utilisateurs` (جدول المستخدمين) هو **المصدر الوحيد والحصري** لجميع العمال والتقنيين:
  - تبويب الفنيين في الصيانة العلاجية (`Équipe Intervenants`) هو مجرد استعلام ديناميكي:
    `Intervenants = FILTER(Utilisateurs, role === 'Technicien')`
  - إجمالي تدخلات الفني يحسب بمعادلة إكسيل:
    `TotalInterventions = COUNTIFS(BonsTravail, technicien_id === user.id)`

### 4. تقسيم التخزين والحقن المباشر في ذاكرة الجهاز (Unified Local Storage Partitions):
- **القسم الأول (Master Referential):** الكتالوجات المرجعية والآلات والتصنيفات والقوالب (تعديلاتها نادرة ومضبوطة).
- **القسم الثاني (Operations History):** سجل العمليات اليومية وحركات الصرف والإدخال وبطاقات العمل (تنمو وتُسجل تراكمياً).
