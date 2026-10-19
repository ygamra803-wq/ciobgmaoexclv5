# AGENTS.md — CIOB GMAO Light UI Excel System Instructions & Architecture

هذا الملف يحتوي على الإرشادات المرجعية والمعمارية لنظام **CIOB GMAO Light UI Excel** لمطوري ومساعدي الذكاء الاصطناعي (**AI Agents & Developers**).

---

## 🏛️ 1. المبادئ المعمارية الأساسية (Core Architecture Principles)

1. **العمل بدون اتصال بالإنترنت (100% Offline Client-Side Execution):**
   - التطبيق مصمم ليعمل بالكامل داخل المتصفح بدون أي خادم خلفي إلزامي.
   - يعتمد على `localStorage` لتخزين واسترجاع البيانات محلياً.
   - متوافق مع استيراد وتصدير ملفات **Excel (`.xlsx`)** و **JSON**.

2. **التطابق الدقيق مع جداول ومعادلات Excel (Excel Twin Model):**
   - كل جدول في واجهة المستخدم يمثل ورقة عمل (`Worksheet`) في إكسيل.
   - أسماء الأعمدة والتنسيقات ومفاتيح الربط تتطابق مع النموذج المرجعي `GMAO_Light_Template_V2_Formules.xlsx`.
   - محاكاة دقيقة لحسابات الإدخالات، الإخراجات، ورصيد المخزون في الوقت الفعلي عبر الـ `useMemo` في React.

3. **الروابط الذكية والانتقال السلس (Smart Navigation & Links):**
   - الروابط بين الجداول تمكّن المستخدم من النقر على أي معرف (مثل `id_type`, `id_zone`, `id_family`) للانتقال المباشر وتطبيق الفلاتر تلقائياً على الجدول التابع.

---

## 📊 2. هيكل الكيانات والبيانات (Data Schemas)

### أ. المخزون والمقالات (`Stock_Actuel / Articles`)
- `id`: المعرف الرقمي الفريد.
- `ref`: المرجع الفريد للقطعة (رمز المقال، مثال: `ROUL-6204-2RS`).
- `designation`: اسم ووصف المقال.
- `id_type`: نوع المقال المرجعي (مرتبط بجدول `Types`).
- `id_diag`: التشخيص المرجعي (مرتبط بجدول `Diagnostics`).
- `stockInitial`: المخزون الافتتاحي (العمود E في إكسيل).
- `entrees`: مجموع كميات الإدخال المحسوبة (العمود F في إكسيل عبر `SUMIFS`).
- `sorties`: مجموع كميات الإخراج المحسوبة (العمود G في إكسيل عبر `SUMIFS`).
- `stockActuel`: الرصيد الفعلي المحسوب `= stockInitial + entrees - sorties` (العمود H).
- `seuil`: الحد الأدنى للتنبيه (العمود I).
- `alerte`: الحالة المحسوبة (`OK`, `ALERTE`, `RUPTURE`).
- `emplacement`: مكان التخزين بالمستودع (مثال: `R1-B04`).

### ب. حركات المخزون (`Mouvements`)
- `id`: معرف الحركة.
- `code_bon`: رقم وصل الطلب/الصرف (مثال: `Bon-001`).
- `date`: تاريخ العملية (`YYYY-MM-DD`).
- `ref`: مرجع المقال المستخدم.
- `quantite`: الكمية المصروفة أو المدخلة.
- `type`: نوع الحركة (`Sortie` أو `Entrée`).
- `action_id`: نوع وفلتر التدخل (`CORRECTIVE`, `PREVENTIVE`, `AMELIORATIVE`, `USAGE`, `REAPPRO`, `RETOUR`, `INVENTAIRE`).
- `usage_type`: المستفيد في حالة الاستعمال الشخصي (`technician`, `operation`, `chef`).
- `technicien`: اسم أو معرف الفني القائم بالعملية أو المستلم/الطلب.
- `id_zone`: المنطقة المعنية (تُستنتج تلقائياً في حالة الـ `USAGE` وتُعطل في الـ `Entrée`).
- `id_machine_registered`: الآلة المعنية بالتدخل (تُخفى تلقائياً عند اختيار `USAGE` أو `Entrée`).
- `operation`: نوع العملية أو المشرف المعني (يُخفى في الـ `CORRECTIVE` و `Entrée`).
- `fournisseur`: اسم المورد في حالة الـ `Entrée` (Réapprovisionnement).
- `emplacement_reception`: مكان التخزين/المستودع في حالة الـ `Entrée`.
- `commentaire`: ملاحظات أو سبب التدخل.

### ج. الآلات المسجلة (`Machines_Registered`)
- `id_machine_registered`: رمز الآلة الفريد (مثال: `MCH-001`, `CNC-01`).
- `designation`: اسم وتوصيف الآلة.
- `id_family`: عائلة الآلة (مرتبط بجدول `Families`).
- `id_templates`: نموذج الآلة (مرتبط بجدول `Templates`).
- `id_zone_default`: المنطقة الافتراضية للآلة (مرتبط بجدول `Zones`).
- `technician`: الفني المسؤول.
- `status`: حالة التشغيل (`En service`, `En maintenance`, `Arrêt`).

### د. العمليات والمشرفين (`Operations & Chefs`)
- `id_operation`: رمز العملية أو المشرف المولد تلقائياً (`OP-01...` أو `CHEF-01...`).
- `nom`: اسم أو وصف العملية أو المشرف.
- `id_zone`: منطقة التدخل أو التواجد.
- `type_profil`: نوع الحساب/الملف (`OPERATEUR` أو `CHEF`).

---

## 🎨 3. معايير واجهة المستخدم والتصميم (UI & Styling Rules)

- **التباين العالي ودعم تبديل وضع الشريط الجانبي (Dark / Light Sidebar Switcher):**
  - الشريط الجانبي (`Sidebar`): يدعم التبديل الفوري بين الوضع الداكن الأنيق المريح للعين (`Dark: bg-slate-800/90 text-slate-200`) والوضع الفاتح الناصع (`Light: bg-white/95 text-slate-800`) مع حفظ الاختيار في `localStorage`.
  - التبويب النشط في الشريط الجانبي: تصميم دائري زجاجي مكبّر ثلاثي الأبعاد (3D Magnifying Glass Lens) مرتفع بطبقة عميقة مع إطار متناسق ديناميكياً مع لون أيقونة كل صفحة بسطوع ناعم ومتزن وتكبير بصري للأيقونة (`scale-110`).
  - نقاء الخلفية والهدوء البصري: إبقاء خلفية الشريط الجانبي نقية وشفافة بدون أشعة إضاءة سفلية عشوائية.
  - البطاقات العلوية (`Top Banners`): خلفية بيضاء (`bg-white border-slate-200 shadow-xs`) لتطابق شريط الفلاتر والجداول.
- **الأيقونات المعبرة:**
  - `Machines Registered`: أيقونة المصنع والمنشأة الصناعية (`Factory`).
  - `Families`: أيقونة `hub` (`HubIcon` Google Material Symbols Outlined SVG أوفلاين 100%).
  - `Templates`: أيقونة `category` (`CategoryIcon` Google Material Icons Outlined SVG أوفلاين 100%).
  - `Familles (Composants)`: أيقونة `spoke` (`SpokeIcon` Google Material Symbols Outlined SVG أوفلاين 100%).
  - `Types (Parts)`: أيقونة `layers` (`LayersIcon` Google Material Symbols Outlined SVG أوفلاين 100%).
  - `Operations`: أيقونة قائمة المهام والإجراءات الميدانية (`ClipboardList`).
  - استخدام أيقونات SVG حصراً (أوفلاين 100%) من مكتبة `lucide-react` وشعار التطبيق SVG مدمج.
  - يمنع استخدام الرموز التعبيرية (Emojis) كأيقونات أساسية في عناصر التحكم أو القوائم.
  - **الفصل التام بين بيانات المستودع (Entrepôt Parts) والمخزون (Stock PDR):**
    صفحات `Part Types` و `Part Designations` مخصصة حصراً لقطع وأجزاء المستودع (`Entrepôt`) وتمتلك قاعدة بيانات وجداول مستقلة تماماً عن جداول المخزون العام (`Stock_Actuel / Types / Diagnostics`).

---

## ⚡ 4. إرشادات التعديل والتطوير (Developer & Agent Guidelines)

1. **عند تعديل الحسابات:** تأكد دائماً من مطابقة معادلات الجافاسكريبت لمعادلات إكسيل الموثقة في `EXCEL_FORMULAS.md`.
2. **عند إضافة كيانات جديدة:** يجب تحديث دوال التصدير والاستيراد لـ Excel في `src/App.jsx`.
3. **الحفاظ على الأداء:** استخدم `useMemo` لعمليات تجميع البيانات ومحاكاة الـ `SUMIFS` لضمان استجابة فورية.

---

## 🧩 5. وثيقة محدد الأكواد التسلسلي المشترك (SequentialCodePicker Architecture)

- **الجمع بين التوليد التلقائي والاختيار اليدوي الحر:** يولد الكود التسلسلي التالي تلقائياً، مع إتاحة شبكة الأرقام لاختيار رقم شاغر مفضل أو العودة للتوليد التلقائي.
- **منع التكرار:** الأرقام المحجوزة مسبقاً (`takenNumbers`) تظهر مشطوبة وغير قابلة للنقر.
- **الخصائص:** `prefix`, `currentCode`, `onChangeCode`, `autoGeneratedCode`, `takenNumbers`, `disabled`, `maxNumbers`, `padLength`.

---

## 💎 6. وثيقة الأزرار التفاعلية ثلاثية الأبعاد (Action3DButton & FormulasModalButton Architecture)

- **العمق البصري الثلاثي الأبعاد (3D Tactile Elevation):**
  - الظل العائم: `shadow-[0_2px_6px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)]`.
  - التفاعل: انزلاق للأعلى عند التمرير (`hover:-translate-y-0.5`) وضغط tactile عند النقر (`active:translate-y-0`).
  - تكبير الأيقونة التفاعلي: `group-hover:scale-110 transition-transform duration-200`.
- **الأشكال:** `circle`, `pill`, `square`, `solid`.
- **المكونات:** `Action3DButton` للإجراءات و `FormulasModalButton` لعرض معادلات إكسيل.

---

## 🖥️ 7. خارطة الطريق المعمارية: النشر المزدوج (Web & Windows Desktop)

- **اعتماد npm:** كمرجع موحد في بيئات النشر السحابي والـ CI/CD لضمان استقرار البناء.
- **جاهزية PWA Desktop:** التطبيق مزود بـ `VitePWA` وملف `manifest.json` ويعمل دون اتصال بالإنترنت (Offline 100%).
- **التحزيم المكتبي الأصلي:** يمكن تحزيم مجلد `dist` المولد عبر Tauri أو Electron لإنتاج ملف تنفيذي مباشر `.exe` لنظام ويندوز.

---

## 📐 8. معايير تصميم الجداول الموحدة (Standardized Excel Twin Table Architecture)

1. **إجمالي الأسطر في العرض (20 سطر):** سطر العناوين (`<thead>` رقم 1) + 19 سطر بيانات من **N° 1** إلى **N° 19**.
2. **العبوة التكميلية التلقائية (`minRows = 19`):** تعبئة الأسطر الشاغرة بكائنات نائبة رمادية ناعمة تحتوي على `—`.
3. **حاوية التمرير الهيدروليكي:** استخدام `max-h-[62vh] overflow-y-auto overflow-x-auto`.
4. **شريط التنقل (Pagination):** افتراضي الصفحة `pageSize = 25` وخيارات `[25, 50, 100, 200, 0]` (حيث `0` = Tout).
5. **ثبات صف عناوين الأعمدة وحيادية الأيقونات:**
   - ثبات السطر: `sticky top-0 bg-slate-100 text-[11px] font-bold text-slate-700 uppercase tracking-wider border-b border-slate-200 z-10 shadow-2xs select-none`.
   - حيادية الأيقونات: استخدام `text-slate-400 shrink-0` حصراً داخل العناوين.
   - رموز أعمدة إكسيل: إدراج الرمز الحرفي `(A)`, `(B)`, `(C)`... بجانب كل عنوان.
   - المحاذاة: الأرقام والكميات لليمين، النصوص لليسار، الحالات والأكواد والإجراءات بالمنتصف.
6. **بطاقة الإجراءات السريعة ثلاثية النقاط (3-Dots Action Menu Popover Card & Smart Quick Actions):**
   - عنوان العمود الأخير: **`•••`** مع خاصية `font-bold text-slate-400 tracking-widest text-center`.
   - زر الإجراء السريع المستقل: تصميم نقي بأيقونة SVG سوداء مستقلة (`text-slate-900`) بدون نصوص (`p-1.5 bg-white hover:bg-slate-100/80 text-slate-800 hover:text-black transition border-r border-slate-200`).
   - **معيار أيقونات الإجراء السريع للتسجيل (Target Entity Icon + Plus Standard):**
     تتطابق أيقونة زر الإجراء السريع للتسجيل مع أيقونة الكيان الهدف المراد تسجيله مع دمج شارة علامة الجمع (`+`):
     - **في صفحة `Familles Machines` (`FamilyView`):** الكيان الهدف هو نموذج (`Template`) ➔ الأيقونة هي `CategoryPlusIcon` (أيقونة Category مع شارة `+` بيضاء دقيقة) لتفتح نافذة تسجيل النموذج مسبقة التعبئة بـ `id_family`.
     - **في صفحة `Templates Machines` (`TemplatesView`):** الكيان الهدف هو مخطط (`Blueprint`) ➔ الأيقونة هي `BlueprintPlusIcon` (أيقونة البصمة الهندسية مع شارة `+`) لتفتح نافذة تسجيل الـ Blueprint مسبقة التعبئة بـ `id_family` و `id_templates`.
     - **في صفحة `Types PDR` (`TypeView`):** الكيان الهدف هو توصيف (`Designation`) ➔ الأيقونة هي `BadgePlus` لتفتح نافذة تسجيل التوصيف مسبقة التعبئة بـ `id_type`.
     - **صفحات `Désignations` (PDR & Parts):** زر حركة سحب سريع بأيقونة السهمين المزدوجين `SortieEntreeIcon`.
     - **صفحات `Familles & Templates (Composants)`:** زر تصفية مكونات المستودع بأيقونة `Warehouse`.
   - **القائمة المنبثقة التفاعلية (Popover Menu):** قائمة غنية بخيارات الكيان وإغلاق تلقائي عند النقر الخارجي.
   - **تفريغ الحالة المسبقة (Preset State Cleanup):** تصفير حالات `quickCreate...Preset` فوراً عند إغلاق أو حفظ النافذة.

---

## 🧭 9. وثيقة نظام مسار التنقل الذكي (Smart Dynamic Breadcrumbs Architecture)

- **الفلسفة:** استبدال العناوين الثابتة بمسار تفاعلي ذكي يعكس موقع المستخدم والفلاتر النشطة، مع إمكانية الرجوع السلس بنقرة واحدة (Smart Backtracking).
- **الهوية البصرية:** كبسولة بيضاء عائمة (`rounded-full bg-white border border-zinc-200/90 shadow-[0_2px_8px_rgba(0,0,0,0.04)]`) مع نقطة النبض الحية الخضراء (`w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0`).
- **قواعد المنطق الديناميكي:**
  1. **Stock PDR:** مسارات `Stock PDR / Articles` أو `Stock PDR / Type: [Nom] / Articles` أو `Stock PDR / Réf: [Val]`.
  2. **Entrepôt Parts:** مسارات `Entrepôt / Stock Entrepôt` أو `Entrepôt / Famille: [Code] / Templates Composants`.
  3. **Machines:** مسارات `Machines / Machines Registered` أو `Machines / Famille: [Code] / Templates` أو `Machines / Blueprints`.
- **تدفق البيانات:** تمرير كائن `filters` إلى `Header.jsx` مع حساب المسار تلقائياً في الوقت الحقيقي عبر `useMemo`.

---

## 🎬 10. وثيقة التبويبات المتماثلة والانتقالات الحركية (Segmented Dual-Tabs & Fluid Motion Design System)

- **الهيكل الشبكي المتساوي (Equal-Width Segmented Tabs):**
  - استخدام شبكة ثنائية متكافئة الأبعاد (`inline-grid grid-cols-2`) مع تحديد عرض متوازن (`w-full sm:w-[340px]`).
  - حاوية كبسولية مضغوطة (`p-1 bg-slate-100/90 rounded-2xl border border-slate-200/90 shadow-2xs`).
  - التبويب النشط: بروز ناعم بخلفية بيضاء وظل راقٍ (`bg-white text-slate-900 shadow-[0_2px_8px_rgba(0,0,0,0.08)] border border-slate-200/60`).
- **تأثير تبديل الزر الأيقوني (3D Action Switch Animation):**
  - تغليف الزر داخل `AnimatePresence (mode="wait")` مع `motion.div`.
  - معايير الحركة: `initial={{ scale: 0.82, rotate: -12, opacity: 0 }}`, `animate={{ scale: 1, rotate: 0, opacity: 1 }}`, `exit={{ scale: 0.82, rotate: 12, opacity: 0 }}` بزمن `0.18s` ومنحنى `easeOut`.
- **الانتقال التدريجي للجداول (Dual-Table Smooth Transition):**
  - تغليف الجداول المنفصلة بـ `AnimatePresence (mode="wait")` و `motion.div` بمفتاح فريد لكل تبويب.
  - انسياب عمودي ناعم وتلاشي: `initial={{ opacity: 0, y: 6 }}`, `animate={{ opacity: 1, y: 0 }}`, `exit={{ opacity: 0, y: -6 }}` بزمن `0.22s` لتجربة استخدام فائقة السلاسة.

