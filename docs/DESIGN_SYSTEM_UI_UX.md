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

### 3. هيكلية ورأس الصفحة القياسي والظهور التدريجي (`AnimatedPage` & Floating Header Card)

تُغلَّف كل صفحة مرجعية أو تشغيلية بالمكون **`<AnimatedPage className="space-y-5">`** لضمان الظهور التدريجي المتناسق وإيقاع المسافات الرأسية (`space-y-5`).  
وتبدأ ببطاقة هيدر عائمة (`Floating Header Card`) ذات ظل صناعي متدرج، وحركة رفع ناعمة عند التحويم (`hover:-translate-y-0.5 transition-all duration-300 ease-out`)، وتوهج محيطي خفيف في الزاوية (`group/header`):

```tsx
import AnimatedPage from '@/presentation/components/common/AnimatedPage';
import PageHeaderIcon from '@/presentation/components/common/PageHeaderIcon';
import Action3DButton from '@/presentation/components/common/Action3DButton';
import FormulasModalButton from '@/presentation/components/common/FormulasModalButton';
import { ShieldAlert, Tag } from 'lucide-react';

<AnimatedPage className="space-y-5">
  <div className="bg-white border border-slate-200/90 rounded-2xl p-5 md:p-6 shadow-[0_12px_32px_-6px_rgba(0,0,0,0.12),0_4px_12px_-2px_rgba(0,0,0,0.06)] hover:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.16),0_6px_16px_-3px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-300 ease-out flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-4 w-full relative overflow-hidden group/header">
    {/* توهج زاوية خفيف يتفاعل مع التحويم */}
    <div className="absolute -top-12 -right-12 w-48 h-48 bg-amber-500/5 rounded-full blur-2xl pointer-events-none group-hover/header:bg-amber-500/10 transition-colors duration-500" />

    {/* الجزء الأيسر: الأيقونة المجردة + العنوان والوصف */}
    <div className="flex items-center gap-3 min-w-0 relative">
      <PageHeaderIcon icon={ShieldAlert} colorClass="text-amber-600" />
      <div>
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">
            Équipements & Système Général
          </h2>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-50 text-amber-800 border border-amber-200">
            SYS-GEN
          </span>
        </div>
        <p className="text-xs text-slate-500 mt-0.5">
          Référentiel des utilités d'usine rattachées aux zones réelles.
        </p>
      </div>
    </div>

    {/* الجزء الأيمن: زر المعادلات + الأزرار الدائرية ثلاثية الأبعاد مع شارة الإضافة */}
    <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
      <FormulasModalButton
        onClick={() => setShowFormulasModal(true)}
        title="Voir les formules Excel & règles d'architecture"
      />

      <Action3DButton
        variant="circle"
        color="amber"
        icon={ShieldAlert}
        showAddBadge={true}
        onClick={handleCreateModalOpen}
        title="Ajouter un Nouvel Équipement"
      />
    </div>
  </div>
</AnimatedPage>
```

### خصائص `PageHeaderIcon` وأزرار الهيدر:
- **`PageHeaderIcon`:** يبتعد عن وضع الأيقونة داخل صندوق رمادي مغلق في الهيدر، بل يعتمد أيقونة مسطحة تفاعلية:  
  `w-7 h-7 ${colorClass} shrink-0 group-hover/header:scale-110 transition-transform duration-300`
- **`FormulasModalButton`:** زر قياسي يفتح نافذة منبثقة من 4 إلى 5 بطاقات تشرح معادلات الإكسيل التوأم (`=[@id_zone] → Zones!B:B`) وقواعد الحوكمة الرسمية والترقيم التلقائي.
- **`Action3DButton` في الهيدر:** يُلزم في شريط الهيدر استخدام النمط الدائري `variant="circle"` حصراً (مع `showAddBadge={true}` للإضافة) لإعطاء كثافة بصرية نظيفة وأنيقة تشبه لوحات التحكم الصناعية.

### 3.1 قاعدة الصف الواحد النظيف لبطاقة الهيدر وفصل الفلاتر الصارم (Single-Row Header Purity)
- **قاعدة الصف الواحد (`Single-Row Layout`):** بطاقة الهيدر العائمة (`Floating Header Card`) يجب أن تبقى صفاً واحداً متوازناً وموجزاً (`flex items-center justify-between`): الأيقونة غير المحبوسة (`PageHeaderIcon`) والعنوان وشارات التعريف والوصف في الطرف الأيسر، وأزرار الإجراءات الدائرية التكتيكية (`FormulasModalButton`, `Action3DButton variant="circle"`) في الطرف الأيمن.
- **منع حشر الفلاتر داخل الهيدر (Strict Prohibition):**  
  > ⚠️ **قاعدة غير قابلة للتفاوض:** يُمنع منعاً باتاً وضع حقول البحث النصي، أو مدخلات اختيار التواريخ والشهور (`input type="date"` أو `month`)، أو أزرار تبديل فئات الأصول (`Toutes classes | Production | Système Général`) داخل بطاقة الهيدر.  
  > **السبب المعماري:** حشر الفلاتر في الهيدر يضخّم ارتفاع البطاقة، ويُجبر أزرار الإجراءات على التمدد والتشوه لتصبح مربعات أو مستطيلات صلبة تفقد أناقتها، كما يكسر انسيابية الصفحة عند الطباعة والتجاوب على الشاشات المختلفة.  
  > **الحل القياسي:** كل أدوات التحكم الزمني والفلاتر تُنقل حصرياً إلى **بطاقة فلاتر وتحكم زمني مستقلة ومرتفعة (`Dedicated Elevated Filter & Period Card`)** تقع أسفل بطاقات مؤشرات الـ KPI.

---

## 4. أزرار التفاعل اللمسية ثلاثية الأبعاد (Tactile 3D Action Buttons)

المكون المركزي للأزرار في المنظومة هو **`Action3DButton`** (`src/presentation/components/common/Action3DButton.tsx`).  
يمنح الزر إحساساً فيزيائياً ملموساً يشبه أجهزة ومفاتيح التحكم الدائرية في غرف المراقبة الصناعية.

### 4.1 الفيزياء والأنيميشن التفاعلي (Physics Tokens)
- **الارتفاع والظل الطبيعي:**  
  `shadow-[0_4px_12px_-2px_rgba(0,0,0,0.08),0_1px_3px_rgba(0,0,0,0.05)]`
- **حالة التحويم (Hover Floating):**  
  `hover:-translate-y-1` مصحوباً بهالة ضوئية مشعة مطابقة للون التوكيد (`theme.glow`).
- **حالة الضغط اللمسي (Active Tactile Depression):**  
  `active:translate-y-0.5 active:scale-95 active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.12)]`

### 4.2 أشكال الأزرار وفلسفة استخدامها (`variant`)
1. **`circle` (النمط الإلزامي في الهيدر وأشرطة الأدوات):**  
   دائرة متقنة ثلاثية الأبعاد (`w-10 sm:w-11 h-10 sm:h-11 rounded-full bg-white border`). هو الخيار المعتمد حصرياً لأزرار الهيدر (معادلات Excel، تصدير، طباعة، وإضافة سجلات مع `showAddBadge={true}`).
2. **`pill` (كبسولة بيضاء بإطار ملون):**  
   (`px-4 py-2 rounded-full bg-white border text-xs gap-2`) للأزرار المرفقة بنص واضح خارج الهيدر.
3. **`square` (مربع ناعم الزوايا):**  
   (`px-4 py-2.5 rounded-xl border text-xs gap-2`) مخصص للقوائم المنسدلة وأشرطة الفرز الجانبية.
4. **`solid` (زر النداء الحاسم - Primary CTA):**  
   زر ممتلئ بلون تدرجي غني (`bg-gradient-to-b text-white shadow-[0_4px_14px_rgba(...)]`) يُستخدم حصرياً لأزرار الحفظ أو التثبيت النهائي في النوافذ المنبثقة.

### 4.3 انضباط الخصائص وتمرير الألوان (`color` vs `variant` Discipline)
> 🚨 **خطأ هندسي شائع وممنوع:**  
> يُمنع تمرير اسم اللون في خاصية `variant` (مثل كتابة `variant="emerald"` أو `variant="slate"` خطأ كلياً!).  
> تمرير اللون في `variant` يلغي نمط الدائرة ويُجبر الزر على الرجوع لشكل كبسولة أو مستطيل مشوه.  
> **الصيغة الصحيحة دائماً:**  
> `<Action3DButton variant="circle" color="emerald" icon={FileSpreadsheet} title="..." />`  
> `<Action3DButton variant="circle" color="slate" icon={Printer} title="..." />`

### 4.4 لوحات الألوان المدعومة (`color`)
- `cyan`: قسم قطع الغيار والمخزون.
- `emerald`: قسم الآلات وتسجيل الأصول وتصدير الإكسيل الرسمي.
- `indigo`: الصيانة الوقائية والمخططات والمستودع والمستخدمين وتقرير الإدارة.
- `amber`: الصيانة العلاجية، أوامر الشغل، والأنظمة العامة (`EquipmentView`).
- `purple`: الورشات والمناطق الجغرافية.
- `slate`: الإجراءات المحايدة (طباعة، إلغاء، تحديث).
- `rose`: الإجراءات الخطرة أو التحذيرية وزر إعادة الضبط السريع.
- `accent`: متكيف تلقائياً مع خيار المستخدم في الإعدادات (`data-accent`).

---

## 5. بطاقات المؤشرات التفاعلية وشبكات الـ KPI القياسية (Interactive 4-Tier `GmaoKpiCard`)

جميع بطاقات الـ KPI في جميع صفحات L1 تعتمد بنية موحدة من **4 طبقات صارمة** (`src/presentation/components/common/GmaoKpiCard.tsx`)، والأهم هو **التوازن بين التصميم والمنطق**: فالبطاقات ليست أرقاماً صماء، بل تعمل **كفلاتر تفاعلية حية (`isActive` + `onClick`)** تعيد تصفية الجدول أو تبديل التبويب فور النقر عليها!

```
┌─────────────────────────────────────────────────────────────────┐
│ Tier 1: العنوان العلوي (Uppercase) ── الأيقونة الحرة (w-6 h-6)   │
│ Tier 2: الرقم المونو الضخم (3xl Monospace) + الوحدة (unit)       │
│ Tier 3: شارة إكسيل الحسابية السياقية (badgeText)                 │
├─────────────────────────────────────────────────────────────────┤
│ Tier 4: التذييل التحليلي (footerLabel : footerValue)            │
└─────────────────────────────────────────────────────────────────┘
```

### 5.1 نموذج الكود القياسي (توازن التصميم والمنطق التفاعلي)
```tsx
import GmaoKpiCard, { GmaoKpiGrid } from '@/presentation/components/common/GmaoKpiCard';
import { ShieldAlert, CheckCircle2, AlertTriangle, Layers } from 'lucide-react';

<GmaoKpiGrid columns={4}>
  <GmaoKpiCard
    title="Équipements Installés"
    value={kpiStats.totalActive}
    unit="équip."
    icon={ShieldAlert}
    color="slate"
    valueColored={false}
    isActive={activeSection === 'equipments' && statusFilter === 'ALL'}
    onClick={() => {
      setActiveSection('equipments');
      setStatusFilter('ALL');
    }}
    badgeText="Registre Actif (SSOT)"
    footerLabel="Feuille Machines :"
    footerValue="Classe SYSTEM_GENERAL"
  />

  <GmaoKpiCard
    title="En Service Opérationnel"
    value={kpiStats.enService}
    unit="actifs"
    icon={CheckCircle2}
    color="emerald"
    isActive={activeSection === 'equipments' && statusFilter === 'En Service'}
    onClick={() => {
      setActiveSection('equipments');
      setStatusFilter(statusFilter === 'En Service' ? 'ALL' : 'En Service');
    }}
    badgeText="95% Disponibilité"
    footerLabel="Interventions :"
    footerValue="Éligibles PM & BT"
  />
</GmaoKpiGrid>
```

### 5.2 القواعد الإلزامية في `GmaoKpiCard`
1. **اكتمال الطبقات الأربع:** يجب دائماً تمرير `title`, `value`, `unit`, `icon`, `color`, `badgeText`, `footerLabel`, `footerValue`.
2. **التفاعل المنطقي (`isActive` + `onClick`):** النقر على البطاقة يفعّل الفلتر المقابل في الجدول، والنقر عليها مرة ثانية يعيد الفلتر إلى `'ALL'`.

---

## 6. جداول البيانات الصناعية الموحدة (`GmaoIndustrialDataGrid`)

المكون المركزي لعرض البيانات في كل التطبيق هو **`GmaoIndustrialDataGrid`** (`src/presentation/components/common/GmaoIndustrialDataGrid.tsx`).

### 6.1 العقد البرمجي الإلزامي للجدول وبطاقة القاع (`TablePaginationCard`)
لكي يظهر الجدول بكامل عناصره (شريط مطابقة الإكسيل العلوي، أيقونات الأعمدة، شارات الحروف `Col B..H`، الفرز التفاعلي، ترقيم الصفوف `#`، وبطاقة قاع الجدول `TablePaginationCard`)، يجب تمرير الخصائص التالية دون نقص:

```tsx
<GmaoIndustrialDataGrid
  title="Registre des Équipements — Système Général"
  icon={<ShieldAlert className="w-4 h-4 text-amber-600" />}
  excelMapping="id_machine (B) | designation (C) | id_general_system_type (D) | id_zone_default (E) | status (H)"
  bannerColor="amber"
  columns={equipmentColumns}
  data={paginatedData}
  rowKey={(row) => row.id_machine_registered}
  sortField={sortField}
  sortOrder={sortOrder}
  onSort={handleSort}
  renderSortIcon={renderSortIcon}
  startIndex={startIndex}
  showRowNumber={true}
  emptyIcon={<ShieldAlert className="w-8 h-8 text-slate-300" />}
  emptyMessage="Aucun enregistrement trouvé."
  pagination={{
    currentPage,
    setCurrentPage,
    pageSize,
    setPageSize,
    totalItems,
    pageSizeOptions: [20, 50, 100, 200, 0],
    color: 'amber',
    itemLabel: 'équipements',
  }}
/>
```

### 6.2 العقد الإلزامي لتعريف الأعمدة (`label` + `colLetter` + `icon` + `sortable`)
> ⚠️ **تحذير صارم:** يُمنع استخدام خاصية `title` في تعريف أعمدة `GmaoIndustrialDataGrid` لأن المكون يقرأ حصرياً `col.label` و`col.colLetter` و`col.icon`!

1. **عمود الكود/المعرّف (`Col B`):** يُعرض داخل شارة إكسيل فاتحة مؤطرة (`bg-slate-100 text-slate-900 border border-slate-200/90 shadow-2xs font-mono font-bold text-xs`) مع أيقونة ملونة صغيرة (`w-3 h-3`). يُمنع استخدام شارات سوداء داكنة (`bg-slate-900`) داخل الجدول الفاتح.
2. **عمود الاسم/التعيين (`Col C`):** يبدأ بمربع أيقونة مؤطر (`w-7 h-7 rounded-lg flex items-center justify-center border shadow-2xs`) يليه الاسم بخط عريض (`font-bold text-xs sm:text-[12.5px] text-slate-900`) وتحته سطر فرعي بخط `font-mono text-[10px] text-slate-400`.
3. **فصل الأعمدة المرجعية:** لا تدمج المنطقة (`Zone`) والفني (`Technicien`) في عمود واحد؛ افصل كل مرجع في عمود إكسيل مستقل (`Col E`, `Col F`) لسهولة الفرز والقراءة.
4. **عمود الإجراءات (`actions` — العمود الأخير):**
   - `headerClassName: 'w-32 text-center font-bold text-slate-400 tracking-widest select-none'`
   - جميع أزرار الإجراءات داخل الصف يجب أن تكون **مربعات مؤطرة بحجم `28x28px`**:  
     `w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 border border-slate-200 shadow-2xs transition cursor-pointer`  
     مع تلوين دلالي عند التحويم (`hover:text-emerald-700 hover:bg-emerald-50 hover:border-emerald-200`، `hover:text-indigo-600...`، `hover:text-rose-600...`).

```tsx
const columns = [
  {
    key: 'id',
    label: 'Code',
    colLetter: 'B',
    icon: Hash,
    sortable: true,
    render: (row) => (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-mono font-bold text-xs bg-slate-100 text-slate-900 border border-slate-200/90 shadow-2xs">
        <Hash className="w-3 h-3 text-indigo-600 shrink-0" />
        <span>{row.id}</span>
      </span>
    ),
  },
  {
    key: 'actions',
    label: 'Actions',
    align: 'center',
    headerClassName: 'w-28 text-center font-bold text-slate-400 tracking-widest select-none',
    render: (row) => (
      <div className="flex items-center justify-center gap-1.5">
        <button
          type="button"
          onClick={() => handleEdit(row)}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 transition cursor-pointer shadow-2xs"
          title="Modifier"
        >
          <Edit2 className="w-3.5 h-3.5" />
        </button>
      </div>
    ),
  },
];
```

### 6.3 المبدأ المعماري للعرض المزدوج (`Dual-Mode Container: Tableau Excel ⇄ Cartes / Grille`)
يدعم **`GmaoIndustrialDataGrid`** رسمياً وضع العرض المزدوج داخل **نفس الحاوية ثلاثية الأبعاد** دون تكرار كود الترقيم (`TablePaginationCard`) أو الحالة الفارغة (`Empty State`):

1. **التفعيل التلقائي عبر `renderCard`:**
   - بمجرد تمرير الدالة الاختيارية `renderCard={(item, index, rowNumber) => ReactNode}` إلى `<GmaoIndustrialDataGrid>`، يتفعّل تلقائياً مفتاح التبديل المدمج في يمين البانر العلوي (`Tableau Excel` ⇄ `Cartes / Grille`).
   - يمكن أيضاً التحكم بالوضع خارجياً عبر تمرير `displayMode` و `onDisplayModeChange` مع `showDisplayModeToggle={false}` (كما في تبويبات `Catalogue & Données GMAO`).
2. **ثبات الحاوية والخدمات المشتركة:**
   - في كلا الوضعين (`excel` و `grid`)، تظل البطاقة الخارجية (`rounded-2xl border border-slate-200 shadow-[...]`)، وشريط البانر العلوي الملوّن (`bannerColor`)، وحالة التحميل (`Skeleton`)، والحالة الفارغة (`Empty State`)، وبطاقة قاع الجدول (`TablePaginationCard`) موحّدة بالكامل.
3. **تصميم البطاقات التشغيلية المخصّصة (`Domain-Specific Operational Cards`):**
   - في وضع `Cartes / Grille`، تُعرض كل سجل كبطاقة هوية تشغيلية (`bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs hover:shadow-md`) داخل منطقة التمرير المؤطرة (`bg-slate-50/40 p-4 md:p-5`)، وتضمّ:
     - **رأس البطاقة (`Card Header`):** الكود المرجعي (`font-mono`) + الآلة/الكيان + شارة الحالة أو الأولوية.
     - **جسم البطاقة (`Card Body`):** صندوق معلومات مؤطر (`bg-slate-50 rounded-xl border border-slate-200/70 p-2.5`) يعرض المسؤول، التاريخ، ووصف العطل/العمل.
     - **تذييل البطاقة (`Card Footer`):** شارة الاعتماد أو الارتباط (`ValidationStatusBadge` / `BT Lié`) على اليسار، وزر الإجراء المباشر (`Générer BT`, `Chrono Live`, `Valider`, `Progression Atelier`, `Fiche Rapport`) على اليمين.

---

## 7. منظومة بطاقة الفلاتر والفرز المتقدمة (`Excel Filter & Sort Card`)

في صفحات المراجع والأسطول (`UtilisateursView`, `EquipmentView`, `ZonesView`)، تتكون بطاقة الفلاتر المرتفعة (`rounded-2xl p-4 md:p-5 shadow-[0_12px_32px_-6px_rgba(0,0,0,0.12)...] hover:-translate-y-0.5`) من **4 أجزاء قياسية**:

1. **شريط الترويسة العلوي (`Header Toolbar`):**
   - صندوق أيقونة `SlidersHorizontal` كهرماني (`w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-200/80 text-amber-700`).
   - عنوان البطاقة + **شارة العداد الحي** (`{filtered.length} / {total.length}` بتنسيق `bg-amber-50 text-amber-800 font-mono border-amber-200/70`).
   - على اليمين: أزرار الحالات السريعة (اختياري) + زر **Export Excel** الزمردي (`h-8 px-3 rounded-xl border-emerald-200/80 bg-emerald-50 text-emerald-800`) + زر **Reset** الدائري الوردي (`w-8 h-8 rounded-full border-rose-200/80 bg-rose-50 text-rose-700`) الذي يظهر فقط عند تفعيل أي فلتر أو تغيير الفرز.
2. **رأس كل حقل فلترة (`Label + Col. X Badge`):**
   - فوق كل حقل بحث أو `CustomSelect` أو زر فرز، يوضع صف علوي (`flex items-center justify-between mb-1.5`) يضم اسم الحقل على اليسار وشارة عمود الإكسيل على اليمين (`Col. B+C`, `Col. D`, `Col. E` بتنسيق `px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-slate-100 text-slate-700 border border-slate-200`).
3. **الأيقونة المؤطرة داخل الحقل (`Amber Boxed prefixIcon`):**
   - كل حقل إدخال أو `CustomSelect` يحتوي على أيقونة بادئة داخل مربع كهرماني صغير:  
     `w-5 h-5 rounded-md bg-amber-100 border border-amber-300/80 flex items-center justify-center text-amber-700 shadow-2xs shrink-0`
4. **قائمة الفرز المنسدلة (`Tri Dynamique`) وشريط الشارات النشطة (`Active Filter Chips`):**
   - الحقل الرابع في الشبكة يُخصص لزر وقائمة الفرز (`Tri : CODE (B) / DÉSIGNATION (C)...`) مع أسهم التصاعدي والتنازلي (`ArrowUp` / `ArrowDown`).
   - عند وجود أي فلتر نشط، يظهر في أسفل البطاقة شريط شارات قابلة للإزالة (`bg-indigo-50 border-indigo-200 text-indigo-800`).

### 7.2 بطاقة الفلاتر والتحكم الزمني المستقلة في شاشات التقارير والقيادة (`Dedicated Elevated Filter & Period Card`)
في شاشات التقارير والقيادة الحساسة (`Rapport Mensuel Direction`, `Rapport Vacation / Hebdo`)، يتم فصل أدوات الفلترة والتحكم الزمني بالكامل عن بطاقة الهيدر، وتوضع في **بطاقة مستقلة مرتفعة تقع أسفل بطاقات الـ KPI أو شريط الفروقات (`Delta Strip`) وقبل الجداول ومصفوفات القرار**:

- **الهيكلية المعمارية للبطاقة:**
  1. **الترويسة الصناعية (`Header Toolbar`):**
     - أيقونة `SlidersHorizontal` داخل مربع كهرماني ناعم (`w-8 h-8 rounded-xl bg-amber-500/10 border-amber-200/80 text-amber-700`).
     - العنوان الواضح (`Filtres & Période d'Analyse`) مع شارة الفترة النشطة بالأرقام المونو (`YYYY-MM` أو `Du → Au`).
     - شارة حية للتكلفة الإجمالية أو ملخص السجلات (`Coût Total Officiel C1` مع شارة `Delta Badge`).
     - زر تصدير الإكسيل السريع (`Export Excel .xlsx`) وزر إعادة الضبط السريع الدائري الوردي (`RotateCcw`).
  2. **شبكة المدخلات المنظمة (`Grid Inputs`):**
     - **محدد النطاق الزمني:** أزرار الفترات السريعة (`Aujourd'hui | Hier | 7 jours | 12 mois`) أو محدد الشهور (`type="month"`) مدعوماً بأزرار سريعة لأحدث 4 شهور نشطة.
     - **محدد صنف المعدات (`Asset Class Filter`):** تبديل سلس بين `Toutes classes` و`Production` و`Système Général` مع شارة `Col. B`.
     - **حقل البحث النصي المباشر:** مزود بـ `prefixIcon` كهرماني وشارة الأعمدة المستهدفة (`Col. A-B`).

---

## 8. التبويبات وقوائم التنقل (Tabs & Segmented Controls)

### 8.1 تبويبات الصفحات الكبرى (`SettingsNavTabs` Style)
تعتمد الصفحات التي تحتوي على أقسام متعددة (مثل شاشة الإعدادات أو الصيانة الوقائية) على بطاقات تبويب شبكية:
- كل تبويب يحتوي على أيقونة ملونة داخل صندوق أبيض محدد، عنوان رئيسي غليظ، ووصف وظيفي مصغر بخط مونو.
- التبويب النشط يكتسب خلفية وظلاً بلون التوكيد:  
  `${tab.activeBg} ${tab.activeBorder} ${tab.activeText} shadow-xs font-bold scale-[1.01]`

### 8.2 شريط الخيارات المجزأة المدمج في الهيدر (Segmented Toggle Control)
للتبديل الثنائي داخل الصفحة (مثل التبديل بين `Équipements` و`Types Système` داخل بطاقة الهيدر):
- الحاوية الخارجية: `p-1 bg-slate-100 rounded-xl border border-slate-200/80 inline-flex items-center gap-1`.
- الزر النشط: `bg-white text-slate-900 font-bold shadow-2xs rounded-lg px-3 py-1.5 text-xs`.
- الزر الخامل: `text-slate-500 hover:text-slate-800 font-semibold px-3 py-1.5 text-xs transition`.

---

## 9. النوافذ المنبثقة، مربعات التأكيد، والتنبيهات (Modals, Dialogs & Toast)

### 9.1 نوافذ الحوار والتأكيد (`ConfirmDialog` & Light Modals)
- **الخلفية المضببة:** `bg-slate-900/60 backdrop-blur-xs fixed inset-0 z-50`.
- **البطاقة المركزية:** `bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150`.
- **ترويسة النافذة المنبثقة:** خلفية بيضاء نظيفة (`bg-white border-b border-slate-200 px-5 py-4`) مع أيقونة ملونة داخل مربع مؤطر (`w-8 h-8 rounded-xl bg-amber-50 border border-amber-200`) وزر إغلاق مربع (`w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200`).

### 9.2 التنبيهات العائمة (`Toast`)
تظهر في الزاوية العلوية أو السفلية بإشعار لطيف ومؤقت، يدعم 4 حالات: `success`, `error`, `info`, `warning`.
يُمنع استخدام `window.alert` في أي مكان في الكود.

---

## 10. الوضع الفاتح والداكن ومحرك الانتقالات (Light & Dark Mode Engine)

### 10.1 الوضع الفاتح كأساس للمصنع (Light UI Excel)
البيئة الأساسية للتطبيق هي واجهة فاتحة ذات تباين ناصع، صُممت خصيصاً لأجهزة الكمبيوتر والتابلت في الورشات والمصانع التي تعاني من انعكاسات الإضاءة العالية.

### 10.2 معمارية الوضع الداكن (`.dark`)
يتم تفعيل الوضع الداكن عبر إضافة صنف `.dark` لعنصر `<html>` الجذري في `src/index.css`.

---

## 11. دستور إنشاء أو مراجعة صفحة: قائمة الفحص وموانع الأخطاء (Checklist & Anti-Patterns)

عند إنشاء صفحة جديدة أو مراجعة صفحة قائمة (على غرار `UtilisateursView.tsx` و`EquipmentView.tsx`)، يجب التحقق من البنود الـ 8 التالية:

1. ✅ **تغليف الصفحة:** هل الصفحة مغلفة بـ `<AnimatedPage className="space-y-5">`؟
2. ✅ **بطاقة الهيدر العائمة:** هل تحتوي على `<PageHeaderIcon />`، و`<FormulasModalButton />`، وأزرار `<Action3DButton variant="circle" showAddBadge={true} />` مع ظل صناعي متدرج وتفاعل `hover:-translate-y-0.5`؟
3. ✅ **بطاقات الـ KPI التفاعلية:** هل تحتوي كل بطاقة `GmaoKpiCard` على الطبقات الأربع كاملة (`unit`, `badgeText`, `footerLabel`, `footerValue`) وهل تعمل كفلتر تفاعلي عبر `isActive` و`onClick`؟
4. ✅ **بطاقة الفلاتر والفرز:** هل تتضمن شارة العداد (`filtered / total`)، زر `Export Excel`، زر `Reset` الدائري الوردي، شارات الأعمدة (`Col. B+C`, `Col. D`...) فوق الحقول، أيقونة `prefixIcon` الكهرمانية المؤطرة، وقائمة الفرز المنسدلة (`Tri`)؟
5. ✅ **أعمدة الجدول (`GmaoIndustrialDataGrid`):** هل كل عمود معرّف بـ (`label` + `colLetter` + `icon` + `sortable: true`)؟ (**ممنوع** استخدام `title` بدلاً من `label`).
6. ✅ **بطاقة قاع الجدول (`pagination`):** هل تم تمرير كائن `pagination` الكامل مع `startIndex` و`showRowNumber={true}` و`excelMapping` إلى `GmaoIndustrialDataGrid`؟
7. ✅ **الشارات وأزرار الإجراءات داخل الجدول:** هل أكواد الصفوف تستخدم الشارة الفاتحة (`bg-slate-100 text-slate-900 border-slate-200/90`) وليس الشارة السوداء الداكنة؟ وهل أزرار الإجراءات في العمود الأخير مربعة مؤطرة (`w-7 h-7 rounded-lg border border-slate-200 shadow-2xs`)؟
8. ✅ **صفر بيانات وهمية صامتة:** الحالة الفارغة الصريحة تعرض رسالة واضحة دون حقن أي بذور تلقائية.

---
**تاريخ اعتماد الوثيقة:** نوفمبر 2026  
**الإصدار:** v4.1.0 (Production Master — Calibrated on `UtilisateursView` & `EquipmentView`)  
**المرجعية:** `CIOB GMAO v4 Constitution & Design System`

