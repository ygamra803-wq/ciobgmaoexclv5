# 🏭 توثيق صفحة سجل الآلات والصفحات التابعة (Machines & Hierarchy Views)
## نظام CIOB GMAO Light UI Excel

هذا الملف يوثق بالتفصيل المعماري والتقني صفحة **Machines Registered** والصفحات الثانوية التابعة لها (**Families**, **Templates**, **Blueprints**)، المتطابقة مع ورقة العمل المرجعية `Machines_Registered` في نموذج إكسيل التوأم (**Excel Twin**) والمعمارية النظيفة الموحدة (**Dedicated Clean Seed Architecture**).

---

## 🏛️ 1. الفلسفة والهدف الوظيفي (Functional Philosophy)
- **شجرة الأصول الصناعية (Asset Tree & Equipment Hierarchy):** بطاقة تعريفية لكل آلة أو خط إنتاج في المنشأة (Families ➔ Templates ➔ Blueprints ➔ Registered Machines).
- **التوليد التلقائي لرموز الآلات (Auto-ID Engine):** توليد رمز الآلة تلقائياً استناداً إلى قالب أو عائلة الآلة (مثال: `ENC-01`, `DET-01`, `PRH-01`).
- **المخططات الهندسية والمواصفات (Blueprints & Specs):** ربط كل نموذج آلة بمخطط تفصيلي يحدد القدرة بالكيلوواط، السرعة، الأبعاد، والمكونات الميكانيكية والكهربائية المطلوبة.
- **الربط الجغرافي والمسؤولية الميدانية:** ربط كل آلة بمنطقة افتراضية (`id_zone_default`) وفني صيانة مرجعي مسؤول عنها (`technician`).

---

## 💾 2. معمارية البيانات المرجعية المخصصة (Dedicated Clean Seed Standard)

تتبع منظومة الآلات المعيار الذهبي المستلهم من نظام الصيانة التصحيحية (`Standard Corrective Pattern`):

```
/src/data/machines/seedFamilies.json   (13 عائلة آلات)
/src/data/machines/seedTemplates.json  (50 قالباً ونموذجاً)
/src/data/machines/seedBlueprints.json (47 مخططاً تفصيلياً مع المواصفات)
/src/data/machines/seedMachines.json   (412 آلة مسجلة بروابطها)
/src/data/machines/seedZones.json      (14 منطقة إنتاجية)
                      │
           /src/hooks/useMachineSubState.js
   (إدارة الحالة والتخزين gmao_machines_v2 + دوال التحقق)
                      │
           /src/presentation/router/useAppRouterProps.js
                      │
     ┌────────────────┬────────────────┬────────────────┐
     │                │                │                │
MachinesRegistered  Blueprints      Families        Templates
   (سجل الآلات)    (المخططات)     (العائلات)       (النماذج)
```

---

## 📊 3. التطابق مع أعمدة إكسيل (Excel Twin Mapping)

| العمود في إكسيل | اسم الحقل البرمجي | النوع | الوصف والربط |
| :---: | :--- | :--- | :--- |
| **(A)** | `id_machine_registered` | `String` | الرمز الفريد للآلة (المفتاح الأساسي، مثال: `DET-01`, `PRH-01`). |
| **(B)** | `designation` | `String` | التسمية التفصيلية للآلة أو الخط الإنتاجي. |
| **(C)** | `id_family` | `String` | المعرف المرجعي لعائلة الآلات (مرتبط بجدول `seedFamilies.json`). |
| **(D)** | `id_templates` | `String` | المعرف المرجعي لنموذج أو قالب الآلة (مرتبط بجدول `seedTemplates.json`). |
| **(E)** | `id_blueprint` | `String` | المخطط الهندسي التابع للنموذج (مرتبط بجدول `seedBlueprints.json`). |
| **(F)** | `id_zone_default` | `String` | المنطقة الصناعية الافتراضية التي تتواجد بها الآلة (مرتبط بجدول `seedZones.json`). |
| **(G)** | `technician` | `String` | الفني الرئيسي المشرف على الصيانة (مرتبط بجدول `Technicians`). |
| **(H)** | `status` | `String` | الحالة التشغيلية للآلة (`En Service`, `En Maintenance`, `Arrêt`). |

---

## 🔗 4. الصفحات الثانوية والربط المتعدد (Secondary Views & Navigation)

1. **صفحة العائلات (`FamilyView.jsx`):**
   - استعراض العائلات الـ 13 مع عداد النماذج والآلات التابعة لكل عائلة.
   - الانتقال السريع والمصفى نحو نماذج أو آلات العائلة.
2. **صفحة النماذج والقوالب (`TemplatesView.jsx`):**
   - استعراض النماذج الـ 50، وتصفيتها حسب العائلة.
   - الربط المباشر مع المخططات الهندسية (`Blueprints`) وسجل الآلات.
3. **صفحة المخططات الهندسية (`BlueprintMachineView.jsx`):**
   - استعراض ومطابقة 47 مخططاً هندسياً يشتمل على المواصفات الفنية والمكونات الميكانيكية والكهربائية.
4. **شاشات الصرف السريع والتدخلات (`Sortie / Intervention`):**
   - عند اختيار آلة أثناء تسجيل عطل أو سحب قطعة غيار، يتم تحميل بيانات الآلة وموقعها تلقائياً.
