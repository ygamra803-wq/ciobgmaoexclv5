# ⚙️ توثيق شجرة المكونات وتصنيفات الأجزاء (Components & Parts Views)
## نظام CIOB GMAO Light UI Excel

هذا الملف يوثق بالتفصيل المعماري والتقني صفحات **الهيكل الهرمي للمكونات والأجزاء (Components & Parts Tree Views)**، المتطابقة مع الجداول المرجعية في نموذج إكسيل التوأم (**Excel Twin**) والمعمارية النظيفة الموحدة (**Dedicated Clean Seed Architecture**).

---

## 🏛️ 1. الهيكل الهرمي للمكونات (Component & Part Hierarchy)

```
       المجموعات الكبرى (Component Groups - 4)
                      ▼
         العائلات (Component Families - 8)
                      ▼
        القوالب (Component Templates - 126)
                      ▼
       أنواع الأجزاء (Part Types - 5)
                      ▼
    تسميات الأجزاء (Part Designations - 5)
```

1. **المجموعات الكبرى (`CompGroupView.jsx`):** التصنيفات الهندسية العليا (`Mécanique`, `Électrique`, `Hydraulique`, `Pneumatique`).
2. **عائلات المكونات (`CompFamilyView.jsx`):** المجموعات الوظيفية (`Moteurs Électriques`, `Pompes`, `Vérins`, `Réducteurs`...).
3. **قوالب المكونات (`CompTemplateView.jsx`):** 126 قالباً وموديلاً للمكونات الصناعية.
4. **أنواع وتسميات الأجزاء (`PartTypeView.jsx` & `PartDesignationView.jsx`):** تفصيل قطع الغيار والأجزاء الدقيقة التابعة للمكونات.

---

## 💾 2. معمارية البيانات المرجعية المخصصة (Dedicated Clean Seed Standard)

```
/src/data/warehouse/seedCompGroups.json        (4 مجموعات رئيسية)
/src/data/warehouse/seedCompFamilies.json      (8 عائلات وظيفية)
/src/data/warehouse/seedCompTemplates.json     (126 قالباً وموديلاً)
/src/data/warehouse/seedPartTypes.json         (5 تصنيفات أجزاء)
/src/data/warehouse/seedPartDesignations.json  (5 تسميات تفصيلية)
                      │
           /src/hooks/useWarehouseSubState.js
                      │
           /src/presentation/router/useAppRouterProps.js
                      │
   ┌───────────┬───────────┬───────────┬───────────┬───────────┐
   │           │           │           │           │           │
CompGroup   CompFamily  CompTemplate PartType  PartDesignation
```
