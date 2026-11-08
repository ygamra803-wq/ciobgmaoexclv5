# 🎨 الدستور البصري ونظام التصميم لتجربة وواجهة المستخدم
## `CIOB GMAO v4 — Design System & UI/UX Constitution Guide`

> **الغرض من هذه الوثيقة:**  
> هذه الوثيقة هي **المرجع الهندسي والتصميمي الملزم والنهائي** لكل ما يتعلق بعناصر وواجهات المستخدم (`UI/UX`) في تطبيق **CIOB GMAO v4**.  
> تم استخراج وتوثيق هذه القواعد **مباشرة وحصرياً مما هو موجود ومطبق فعلياً في كود المشروع الإنتاجي** (`src/index.css`، ومجلد `src/presentation/components/common/`، وتخطيطات الصفحات المختلفة).  
> **الهدف المستقبلي:** القضاء التام على الارتباك أو تشتت الأنماط عند تطوير أو إضافة شاشات جديدة، وضمان تجانس بصري وتفاعلي فائق الدقة، وتسهيل الدخول السلس لمرحلة الوضع الداكن والوضع الفاتح (`Light & Dark Mode`).

---

## 📑 فهرس المحتويات (Table of Contents)

1. [الفلسفة المعمارية للألوان: قاعدة 60-30-10 وسجل الأيقونات](#1-الفلسفة-المعمارية-للألوان-قاعدة-60-30-10-وسجل-الأيقونات)
2. [التيبوغرافيا والخطوط (Typography & Monospace Rules)](#2-التيبوغرافيا-والخطوط-typography--monospace-rules)
3. [هيكلية ورأس الصفحة القياسي (Page Header & Actions Bar)](#3-هيكلية-ورأس-الصفحة-القياسي-page-header--actions-bar)
4. [أزرار التفاعل اللمسية ثلاثية الأبعاد (Tactile 3D Action Buttons)](#4-أزرار-التفاعل-اللمسية-ثلاثية-الأبعاد-tactile-3d-action-buttons)
5. [بطاقات المؤشرات وشبكات الـ KPI القياسية (4-Tier GmaoKpiCard)](#5-بطاقات-المؤشرات-وشبكات-الـ-kpi-القياسية-4-tier-gmaokpicard)
6. [جداول البيانات الصناعية الموحدة (GmaoIndustrialDataGrid)](#6-جداول-البيانات-الصناعية-الموحدة-gmaoindustrialdatagrid)
7. [منظومة الفلاتر والبحث والتحكم الزمني (IndustrialFilterCard & PeriodFilterBar)](#7-منظومة-الفلاتر-والبحث-والتحكم-الزمني-industrialfiltercard--periodfilterbar)
8. [التبويبات وقوائم التنقل (Tabs & Segmented Controls)](#8-التبويبات-وقوائم-التنقل-tabs--segmented-controls)
9. [النوافذ المنبثقة، مربعات التأكيد، والتنبيهات (Modals, Dialogs & Toast)](#9-النوافذ-المنبثقة-مربعات-التأكيد-والتنبيهات-modals-dialogs--toast)
10. [الوضع الفاتح والداكن ومحرك الانتقالات (Light & Dark Mode Engine)](#10-الوضع-الفاتح-والداكن-ومحرك-الانتقالات-light--dark-mode-engine)
11. [دستور إنشاء صفحة جديدة: القالب المعياري وموانع الأخطاء (Checklist & Anti-Patterns)](#11-دستور-إنشاء-صفحة-جديدة-القالب-المعياري-وموانع-الأخطاء-checklist--anti-patterns)

---

## 1. الفلسفة المعمارية للألوان: قاعدة 60-30-10 وسجل الأيقونات

### 1.1 معمارية الألوان بنسبة 60-30-10 (`src/index.css`)
يعتمد النظام قاعدة هرمية صارمة لمنع التشتت البصري:

```
┌─────────────────────────────────────────────────────────────────┐
│ 60% الخلفية الهادئة والمساحة البيضاء (Dominant Canvas)            │
│ #FAFAF9 / bg-white / bg-slate-50 / divide-slate-100              │
├─────────────────────────────────────────────────────────────────┤
│ 30% البنية الهيكلية والتنظيمية (Structural Elements)            │
│ الحدود: border-slate-200 / border-slate-300                     │
│ النصوص الثانوية: text-slate-500 / text-slate-600                │
│ خلفيات ترويسات الجداول: bg-slate-100 / bg-slate-50/90            │
├─────────────────────────────────────────────────────────────────┤
│ 10% ألوان التوكيد التفاعلية الديناميكية (Dynamic Accent Focus)   │
│ Emerald | Blue | Indigo | Slate (قابلة للتغيير من الإعدادات)    │
│ ألوان السلامة التشغيلية الثابتة: Amber (تحذير) / Rose (خطر)       │
└─────────────────────────────────────────────────────────────────┘
```

#### فئات التوكيد الدلالية (Semantic Accent Classes):
- `.bg-accent-main`: الخلفية الأساسية المعتمدة للون التوكيد (`var(--color-accent-600)`).
- `.hover:bg-accent-hover`: حالة المرور (`var(--color-accent-700)`).
- `.text-accent-main`: لون النص البارز (`var(--color-accent-600)`).
- `.bg-accent-subtle`: خلفية فائقة النعومة للبطاقات والشارات (`var(--color-accent-50)`).
- `.border-accent-subtle`: حد ناعم يطابق لون التوكيد (`var(--color-accent-200)`).
- `.btn-primary-accent`: الزر البارز الرئيسي بنسبة 10%.
- `.pill-active-accent`: الشارة أو التبويب النشط.

### 1.2 سجل ألوان أيقونات الأقسام المعتمد (Canonical Icon Registry)
في `src/index.css`، كل مجال وظيفي يمتلك هوية لونية ثابتة ومحكومة عبر الـ CSS بدون تكرار في كود المكونات:

| المجال الوظيفي | الأيقونات التمثيلية | اللون المعتمد | الكود اللوني / الفئة |
| :--- | :--- | :--- | :--- |
| **لوحة القيادة والمؤشرات التنفيذية** | `LayoutDashboard`, `FileBarChart2` | **Blue** | `#2563eb` (`text-blue-600`) |
| **المخزون وقطع الغيار وطلبيات الصرف** | `Package`, `Tag`, `SortieEntreeIcon` | **Cyan** | `#0891b2` (`text-cyan-700`) |
| **الآلات المسجلة والأنطولوجيا ومصفوفة Nexus** | `Factory`, `GitBranch`, `Layers` | **Emerald** | `#059669` (`text-emerald-700`) |
| **الصيانة الوقائية، المستودع، والبلوبرنت** | `Calendar`, `Warehouse`, `Fingerprint`, `Users` | **Indigo** | `#4f46e5` (`text-indigo-700`) |
| **الصيانة العلاجية، الورشات، ودليل الاستخدام** | `Wrench`, `Database`, `BookOpen` | **Amber** | `#d97706` (`text-amber-700`) |
| **المناطق الجغرافية والهندسة الميكانيكية** | `MapPin`, `Settings2`, `Boxes` | **Purple** | `#9333ea` (`text-purple-700`) |
| **العمليات المالية والميزانية والعملات** | `Coins`, `DollarSign`, `Wallet` | **Emerald/Slate** | `#047857` (`text-emerald-700`) |

---

## 2. التيبوغرافيا والخطوط (Typography & Monospace Rules)

### 2.1 القاعدة الذهبية للخط الثابت (`font-mono`)
في البيئة الصناعية، الأرقام والأكواد يجب أن تكون متراصة ومقروءة بدقة عالية جداً دون تفاوت في عرض الحروف:
- **يُمنع منعاً باتاً** استخدام خط النصوص العادي للأرقام المالية، الأكواد، التواريخ، أو الكميات.
- **استخدام `font-mono` إلزامي** في الحالات التالية:
  1. **المعرفات والأكواد:** مثل `ART-0042`، `MCH-012`، `BT-2026-0089`، `TPL-COMP-003`.
  2. **القيم الرئيسية في بطاقات KPI:** الرقم الكبير مثل `14 250` أو `98.4%`.
  3. **الكميات والأسعار في الجداول:** مثل `15 U`، `450.00 MAD`، `120 h`.
  4. **التواريخ والشهور:** مثل `2026-11-08`، `2026-10`.
  5. **معادلات إكسيل وتعيين الأعمدة:** مثل `(Col E)`، `SUMIFS(...)`.

### 2.2 مقاييس النصوص القياسية (Type Scale)
- **عنوان الصفحة الرئيسي:** `text-xl sm:text-2xl font-black text-slate-900 tracking-tight`.
- **الوصف التوضيحي للهيدر:** `text-xs sm:text-[13px] text-slate-500 font-medium`.
- **عنوان بطاقة KPI:** `text-[10.5px] font-extrabold text-slate-500 uppercase tracking-wider`.
- **رقم الـ KPI الضخم:** `text-3xl font-black font-mono tracking-tight`.
- **عناوين أعمدة الجداول:** `text-[11px] font-extrabold uppercase text-slate-700 tracking-wider`.
- **خلايا الجداول العادية:** `text-xs font-semibold text-slate-800`.
- **شارات البيانات المصغرة (Badges):** `text-[10px] or text-[9.5px] font-mono font-bold`.

---

## 3. هيكلية ورأس الصفحة القياسي (Page Header & Actions Bar)

كل صفحة تشغيلية في المنظومة تبدأ بكتلة هيدر موحدة تجمع بين أيقونة المجال، العنوان الهرمي، وشريط الأزرار التفاعلية:

```tsx
import PageHeaderIcon from '@/presentation/components/common/PageHeaderIcon';
import Action3DButton from '@/presentation/components/common/Action3DButton';
import FormulasModalButton from '@/presentation/components/common/FormulasModalButton';
import { Package, Plus, RefreshCw } from 'lucide-react';

<div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-slate-200/80">
  {/* الجزء الأيسر: الأيقونة المجردة + العنوان والوصف */}
  <div className="flex items-center gap-3.5 group/header">
    <PageHeaderIcon icon={Package} colorClass="text-cyan-700" />
    <div>
      <div className="flex items-center gap-2 flex-wrap">
        <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
          Stock Articles & PDR
        </h1>
        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cyan-50 text-cyan-800 border border-cyan-200">
          STK-CORE
        </span>
      </div>
      <p className="text-xs sm:text-[13px] text-slate-500 font-medium mt-0.5">
        Gestion du catalogue des pièces de rechange et calcul du stock actif en temps réel.
      </p>
    </div>
  </div>

  {/* الجزء الأيمن: شريط الإجراءات بالأزرار ثلاثية الأبعاد */}
  <div className="flex items-center gap-2.5 self-end sm:self-auto flex-wrap">
    <FormulasModalButton domain="stock" />
    
    <Action3DButton
      icon={RefreshCw}
      variant="circle"
      color="slate"
      title="Actualiser les données"
      onClick={handleRefresh}
    />

    <Action3DButton
      icon={Plus}
      variant="pill"
      color="cyan"
      label="Nouvel Article"
      showAddBadge={true}
      onClick={handleCreateModalOpen}
    />
  </div>
</div>
```

### خصائص `PageHeaderIcon`:
- يبتعد عن وضع الأيقونة داخل صندوق رمادي مغلق في الهيدر، بل يعتمد أيقونة مسطحة تفاعلية:  
  `w-7 h-7 ${colorClass} shrink-0 group-hover/header:scale-110 transition-transform duration-300`

---

## 4. أزرار التفاعل اللمسية ثلاثية الأبعاد (Tactile 3D Action Buttons)

المكون المركزي للأزرار في المنظومة هو **`Action3DButton`** (`src/presentation/components/common/Action3DButton.tsx`).  
يمنح الزر إحساساً فيزيائياً ملموساً يشبه أجهزة التحكم في غرف المراقبة الصناعية.

### 4.1 الفيزياء والأنيميشن التفاعلي (Physics Tokens)
- **الارتفاع والظل الطبيعي:**  
  `shadow-[0_4px_12px_-2px_rgba(0,0,0,0.08),0_1px_3px_rgba(0,0,0,0.05)]`
- **حالة التحويم (Hover Floating):**  
  `hover:-translate-y-1` مصحوباً بهالة ضوئية مشعة مطابقة للون التوكيد (`theme.glow`).
- **حالة الضغط اللمسي (Active Tactile Depression):**  
  `active:translate-y-0.5 active:scale-95 active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.12)]`

### 4.2 أشكال الأزرار المتاحة (`variant`)
1. **`circle` (افتراضي):** دائرة متقنة (`w-10 sm:w-11 h-10 sm:h-11 rounded-full bg-white border`) للأفعال السريعة (تحديث، طباعة، مسح QR).
2. **`pill`:** كبسولة بيضاء بإطار ملون (`px-4 py-2 rounded-full bg-white border text-xs gap-2`) للأزرار المرفقة بنص واضح.
3. **`square`:** مربع بزوايا مستديرة ناعمة (`px-4 py-2.5 rounded-xl border text-xs gap-2`).
4. **`solid`:** زر ممتلئ بلون تدرجي غني (`bg-gradient-to-b text-white`) يُستخدم كزر نداء أساسي لاتخاذ قرار (`Primary CTA`).

### 4.3 لوحات الألوان المدعومة (`color`)
- `cyan`: قسم قطع الغيار والمخزون.
- `emerald`: قسم الآلات وتسجيل الأصول.
- `indigo`: الصيانة الوقائية والمخططات والمستودع.
- `amber`: الصيانة العلاجية وأوامر الشغل.
- `purple`: الورشات والمناطق.
- `slate`: الإجراءات المحايدة (إلغاء، تصدير، تحديث).
- `rose`: الإجراءات الخطرة أو التحذيرية.
- `accent`: متكيف تلقائياً مع خيار المستخدم في الإعدادات (`data-accent`).

---

## 5. بطاقات المؤشرات وشبكات الـ KPI القياسية (4-Tier GmaoKpiCard)

جميع بطاقات الـ KPI في جميع صفحات L1 تعتمد بنية موحدة من **4 طبقات صارمة** (`src/presentation/components/common/GmaoKpiCard.tsx`):

```
┌─────────────────────────────────────────────────────────────────┐
│ Tier 1: العنوان العلوي (Uppercase) ── الأيقونة الحرة (w-6 h-6)   │
│ Tier 2: الرقم المونو الضخم (3xl Monospace) + الوحدة             │
│ Tier 3: شارة إكسيل الحسابية السياقية (Badge / Formula Cue)        │
├─────────────────────────────────────────────────────────────────┤
│ Tier 4: التذييل التحليلي (Border-t) ── التسمية | القيمة / الشريط │
└─────────────────────────────────────────────────────────────────┘
```

### 5.1 نموذج الكود القياسي
```tsx
import { GmaoKpiCard, GmaoKpiGrid } from '@/presentation/components/common/GmaoKpiCard';
import { Package, AlertTriangle, CheckCircle, TrendingDown } from 'lucide-react';

<GmaoKpiGrid columns={4}>
  <GmaoKpiCard
    id="kpi-stock-total"
    title="Articles Actifs"
    value={142}
    unit="réfs"
    icon={Package}
    color="cyan"
    badgeText="100% Vérifié"
    badgePrefix="Inventaire"
    footerLabel="Taux de rotation"
    footerValue="4.2x / an"
    progressBarPercent={75}
  />

  <GmaoKpiCard
    id="kpi-stock-rupture"
    title="Rupture Critique"
    value={3}
    unit="articles"
    icon={AlertTriangle}
    color="rose"
    pulseIcon={true}
    badgeText="Action Immédiate"
    footerLabel="Commandes PO requises"
    footerValue="3 en attente"
    progressBarPercent={100}
  />
</GmaoKpiGrid>
```

### 5.2 تفاصيل التصميم الدقيقة في `GmaoKpiCard`
- **التوهج المحيطي غير المباشر (Ambient Corner Glow):**  
  `absolute -top-10 -right-10 w-28 h-28 rounded-full blur-xl pointer-events-none transition-colors`
- **الشبكة المرنة (`GmaoKpiGrid`):** تدعم خاصية `columns={4}` أو `columns={5}` وتتكيف تلقائياً على الشاشات الصغيرة:
  - 4 أعمدة: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4`.
  - 5 أعمدة: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4`.

---

## 6. جداول البيانات الصناعية الموحدة (GmaoIndustrialDataGrid)

المكون المركزي لعرض البيانات في كل التطبيق هو **`GmaoIndustrialDataGrid`** (`src/presentation/components/common/GmaoIndustrialDataGrid.tsx`).

### 6.1 المزايا الهندسية المدمجة
1. **شريط المعلومات العلوي الصناعي (Banner Header):** يوضح أيقونة الجدول، عنوانه، ومطابقة الأعمدة في ملف الإكسيل التوأم `(Col A → Z)`.
2. **الترويسة الثابتة والفرز (Sticky thead & Sort):** يظل شريط العناوين ثابتاً أثناء التمرير الرأسي مع مؤشرات فرز سهمية واضحة (`ArrowUpDown`, `ArrowUp`, `ArrowDown`).
3. **فواصل الأعمدة الدقيقة (Crisp Column Grid Borders):** حدود واضحة ورأسية تفصل الخلايا تماثل بيئة Excel الاحترافية (`border-r border-slate-300` في الترويسة و `border-r border-slate-200` في الجسم).
4. **التمرير الافتراضي عالي الأداء (Virtual Scrolling 60fps):** تفعيل محرك `@tanstack/react-virtual` تلقائياً عندما يتجاوز عدد السجلات `virtualThreshold` (35 صفاً فما فوق)، للتعامل بسلاسة مع أكثر من 10,000 سجل دون أي هبوط في معدل الإطارات.
5. **تضمين بطاقة الترقيم (`TablePaginationCard`):** مدمجة بسلاسة في التذييل السفلي، وتتيح للمستخدم تحديد حجم الصفحة (`25, 50, 100, 200, Tout`).
6. **هياكل التحميل والشاشات الفارغة (Skeletons & Empty States):** شريط تحميل متلألئ عبر `TableSkeletonRows`، وشاشة فارغة معبرة لا تحقن بيانات وهمية.

### 6.2 تعريف الأعمدة القياسي (Column Definition Spec)
```tsx
const columns = [
  {
    key: 'ref',
    label: 'Référence PDR',
    colLetter: 'A',
    icon: Tag,
    sortable: true,
    width: '160px',
    render: (row) => (
      <span className="font-mono font-bold text-cyan-900 bg-cyan-50/60 px-2 py-0.5 rounded border border-cyan-200/60">
        {row.ref}
      </span>
    ),
  },
  {
    key: 'designation',
    label: 'Désignation Standard',
    colLetter: 'B',
    sortable: true,
    render: (row) => <span className="font-semibold text-slate-800">{row.designation}</span>,
  },
  {
    key: 'stock_actuel',
    label: 'Stock Actuel',
    colLetter: 'E',
    sortable: true,
    align: 'right',
    render: (row) => (
      <span className="font-mono font-black text-slate-900">
        {row.stock_actuel} <span className="text-[10px] text-slate-400 font-normal">U</span>
      </span>
    ),
  },
];
```

---

## 7. منظومة الفلاتر والبحث والتحكم الزمني (IndustrialFilterCard & PeriodFilterBar)

### 7.1 بطاقة الفلاتر المركزية (`IndustrialFilterCard`)
مكون يجمع كل حقول التصفية والبحث في بطاقة مرتفعة ذات ظل صناعي ناعم:

- **الرأس:** أيقونة الفلتر + العنوان + شارة العداد الحي (`filteredCount / totalCount`) + زر تصدير الإكسيل + زر إعادة التعيين الدائري (`RotateCcw`).
- **شريط الحالات السريعة (Quick Status Presets):** أزرار كبسولية بألوان تنبيهية مخصصة وفلاتر فورية بنقرة واحدة.
- **شبكة الإدخال (Filter Grid Inputs):** حقول الإدخال المغلفة بـ `FilterField` ومزودة بشارة العمود المطابق في إكسيل `(Omni, Col C, etc.)`.
- **شريط الشارات النشطة (Active Chips):** يعرض الفلاتر المطبقة حالياً مع زر إزالة مفرد وزر "إلغاء الكل".

```tsx
<IndustrialFilterCard
  title="Filtres & Recherche Avancée"
  color="cyan"
  filteredCount={filteredItems.length}
  totalCount={allItems.length}
  hasActiveFilters={Boolean(searchTerm || statusFilter)}
  onReset={handleResetFilters}
  onExportExcel={handleExportExcel}
  presets={[
    { key: 'ALL', label: 'Tous', count: 142, isActive: status === 'ALL', onClick: () => setStatus('ALL') },
    { key: 'ALERT', label: 'En Rupture', count: 3, colorDot: 'bg-rose-500', isActive: status === 'ALERT', onClick: () => setStatus('ALERT') },
  ]}
>
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
    <FilterSearchInput
      value={searchTerm}
      onChange={setSearchTerm}
      onClear={() => setSearchTerm('')}
      colBadge="Omni"
    />
    {/* حقول Select إضافية مغلفة بـ FilterField */}
  </div>
</IndustrialFilterCard>
```

### 7.2 شريط التصفية الزمني (`PeriodFilterBar`)
مكون زمني قياسي لإدارة الفترات التاريخية بدون تعقيد:
- يدعم خيارات جاهزة: `Tout`, `Ce mois`, `Mois dernier`, `Trimestre`.
- قائمة منسدلة لاختيار شهر محدد: `Mois spécifique...`.
- درج منبثق لاختيار فترة مخصصة باليوم: `Plage libre (Du ... Au ...)`.
- يعرض عداد السجلات المصفاة على الجانب الأيمن.

---

## 8. التبويبات وقوائم التنقل (Tabs & Segmented Controls)

### 8.1 تبويبات الصفحات الكبرى (`SettingsNavTabs` Style)
تعتمد الصفحات التي تحتوي على أقسام متعددة (مثل شاشة الإعدادات أو الصيانة الوقائية) على بطاقات تبويب شبكية:
- كل تبويب يحتوي على أيقونة ملونة داخل صندوق أبيض محدد، عنوان رئيسي غليظ، ووصف وظيفي مصغر بخط مونو.
- التبويب النشط يكتسب خلفية وظلاً بلون التوكيد:  
  `${tab.activeBg} ${tab.activeBorder} ${tab.activeText} shadow-xs font-bold scale-[1.01]`

### 8.2 شريط الخيارات المجزأة (Segmented Toggle Control)
للتبديل الثنائي أو الثلاثي داخل الصفحة:
- الحاوية الخارجية: `p-1 bg-slate-100 rounded-xl border border-slate-200/80 inline-flex items-center gap-1`.
- الزر النشط: `bg-white text-slate-900 font-bold shadow-2xs rounded-lg px-3 py-1.5 text-xs`.
- الزر الخامل: `text-slate-500 hover:text-slate-800 font-semibold px-3 py-1.5 text-xs transition`.

---

## 9. النوافذ المنبثقة، مربعات التأكيد، والتنبيهات (Modals, Dialogs & Toast)

### 9.1 نوافذ الحوار والتأكيد (`ConfirmDialog`)
تعتمد المنظومة بروتوكول تأكيد عالمي عبر وعد جافاسكريبت (`confirmAction(...)`):
- **الخلفية المضببة:** `bg-slate-950/60 backdrop-blur-xs fixed inset-0 z-[120]`.
- **البطاقة المركزية:** `bg-white dark:bg-slate-900 rounded-2xl shadow-2xl p-5 md:p-6 border`.
- **المتغيرات:**
  - `danger` (عمليات الحذف أو الأرشفة): أيقونة `AlertTriangle` بلون وردي وزر أحمر `bg-rose-600` مع التركيز التلقائي على زر الإلغاء كإجراء أمان.
  - `warning` (تنبيه تنفيذي): أيقونة `AlertCircle` بلون برتقالي `amber`.
  - `info` (تأكيد اعتيادي): أيقونة `Info` بلون أزرق أو زمردي.
- **التفاعل بلوحة المفاتيح:** زر `Escape` يغلق الحوار ويعيد `false`.

### 9.2 التنبيهات العائمة (`Toast`)
تظهر في الزاوية العلوية أو السفلية بإشعار لطيف ومؤقت، يدعم 4 حالات: `success`, `error`, `info`, `warning`.
يُمنع استخدام `window.alert` في أي مكان في الكود.

---

## 10. الوضع الفاتح والداكن ومحرك الانتقالات (Light & Dark Mode Engine)

### 10.1 الوضع الفاتح كأساس للمصنع (Light UI Excel)
البيئة الأساسية للتطبيق هي واجهة فاتحة ذات تباين ناصع، صُممت خصيصاً لأجهزة الكمبيوتر والتابلت في الورشات والمصانع التي تعاني من انعكاسات الإضاءة العالية.

### 10.2 معمارية الوضع الداكن (`.dark`)
يتم تفعيل الوضع الداكن عبر إضافة صنف `.dark` لعنصر `<html>` الجذري.
في `src/index.css`:
```css
@custom-variant dark (&:where(.dark, .dark *));

/* تحويلات الجداول في الوضع الداكن */
.dark table thead th svg.lucide {
  color: #94a3b8 !important; /* text-slate-400 */
}
.dark table.border-collapse thead tr > th:not(:last-child) {
  border-right: 1px solid #334155 !important; /* slate-700 */
}
.dark table.border-collapse tbody tr > td:not(:last-child) {
  border-right: 1px solid #1e293b !important; /* slate-800 */
}
.dark table.border-collapse tbody tr:not(:last-child) > td {
  border-bottom: 1px solid #1e293b !important;
}
```

### 10.3 محرك انتقالات الرؤية (View Transitions API)
الانتقال بين الثيمات أو بين الصفحات يعتمد واجهة برمجة الانتقالات الحديثة:
```css
::view-transition-old(root),
::view-transition-new(root) {
  animation-duration: 350ms;
  animation-timing-function: cubic-bezier(0.16, 1, 0.3, 1);
}
```

### 10.4 ضوابط التباين والأمان البصري في الثيمات
- **قاعدة الأيقونات البيضاء داخل الأزرار الداكنة:**  
  إذا كان الزر مصمتاً بلون قوي (`.btn-primary-accent` أو `.bg-accent-main` أو `text-white`)، يجب أن تظل الأيقونة بداخله ناصعة البياض `#ffffff` وألا تتأثر بألوان الـ CSS التلقائية للأيقونات.
- **حدود التقسيم في الجداول:** في الوضع الفاتح تكون `border-slate-200` و `border-slate-300`. وفي الوضع الداكن تكون `border-slate-800` و `border-slate-700`.

---

## 11. دستور إنشاء صفحة جديدة: القالب المعياري وموانع الأخطاء

عند الحاجة لإضافة صفحة تشغيلية جديدة مستقبلاً، يجب على المهندس أو الوكيل اتباع الخطوات الإلزامية التالية:

### 11.1 الهيكل العظمي للصفحة (Master Page Anatomy)

```tsx
import { useState, useMemo } from 'react';
import PageHeaderIcon from '@/presentation/components/common/PageHeaderIcon';
import Action3DButton from '@/presentation/components/common/Action3DButton';
import { GmaoKpiCard, GmaoKpiGrid } from '@/presentation/components/common/GmaoKpiCard';
import IndustrialFilterCard, { FilterSearchInput } from '@/presentation/components/common/IndustrialFilterCard';
import GmaoIndustrialDataGrid from '@/presentation/components/common/GmaoIndustrialDataGrid';
import { Sparkles, Plus, RefreshCw } from 'lucide-react';

export default function NewModuleView() {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // 1. البيانات الحقيقية من المخزن الموحد (useGmaoStore)
  // 2. عمليات الفرز والتصفية عبر useMemo
  // 3. تعريف مصفوفة الأعمدة columns

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-view-transition pb-12">
      {/* 1. رأس الصفحة القياسي */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-slate-200/80">
        <div className="flex items-center gap-3.5 group/header">
          <PageHeaderIcon icon={Sparkles} colorClass="text-indigo-700" />
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Titre de la Nouvelle Page
            </h1>
            <p className="text-xs sm:text-[13px] text-slate-500 font-medium mt-0.5">
              Description claire et concise de l'objectif opérationnel de la page.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Action3DButton icon={RefreshCw} variant="circle" color="slate" onClick={() => {}} />
          <Action3DButton icon={Plus} variant="pill" color="indigo" label="Ajouter un élément" showAddBadge={true} onClick={() => {}} />
        </div>
      </div>

      {/* 2. شبكة المؤشرات KPI */}
      <GmaoKpiGrid columns={4}>
        {/* بطاقات GmaoKpiCard القياسية */}
      </GmaoKpiGrid>

      {/* 3. بطاقة الفلاتر والبحث */}
      <IndustrialFilterCard
        title="Filtres & Recherche"
        color="indigo"
        filteredCount={filteredData.length}
        totalCount={rawData.length}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <FilterSearchInput value={searchTerm} onChange={setSearchTerm} onClear={() => setSearchTerm('')} />
        </div>
      </IndustrialFilterCard>

      {/* 4. جدول البيانات الرئيسي */}
      <GmaoIndustrialDataGrid
        title="Registre des Éléments"
        icon={Sparkles}
        bannerColor="indigo"
        excelMapping="COLONNES A → H"
        columns={columns}
        data={paginatedData}
        pagination={{
          currentPage,
          setCurrentPage,
          pageSize,
          setPageSize,
          totalItems: filteredData.length,
        }}
      />
    </div>
  );
}
```

### 11.2 قائمة موانع الأخطاء والانحراف التصميمي (Anti-Patterns Checklist)
❌ **ممنوع:** إنشاء جدول عادي بـ `<table>` يدوي دون استخدام `GmaoIndustrialDataGrid`.  
❌ **ممنوع:** استخدام أزرار عادية بألوان Hex عشوائية مثل `style={{ backgroundColor: '#23a1f2' }}`.  
❌ **ممنوع:** وضع أرقام الـ KPI أو الأكواد بخط عادي، بل يجب دائماً إدراج `font-mono`.  
❌ **ممنوع:** عرض "بطاقات بيضاء" بلا حدود؛ فالحدود الرمادية `border border-slate-200` إلزامية لضبط التباين الصناعي.  
❌ **ممنوع:** حقن أي بيانات وهمية أو أرقام تجريبية تلقائية عند وجود فراغ؛ الحالة الفارغة الصريحة هي الأصل الحتمي.  
❌ **ممنوع:** كسر قاعدة 60-30-10 بتلوين كامل خلفية الصفحة بألوان فاقعة.

---
**تاريخ اعتماد الوثيقة:** نوفمبر 2026  
**الإصدار:** v4.0.0 (Production Master)  
**المرجعية:** `CIOB GMAO v4 Constitution & Design System`
