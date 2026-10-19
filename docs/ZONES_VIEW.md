# 🏭 توثيق صفحة المناطق والورش (Zones View)
## نظام CIOB GMAO Light UI Excel

هذا الملف يوثق بالتفصيل المعماري والتقني صفحة **المناطق والورش الصناعية (Zones View)**، المتطابقة مع ورقة العمل المرجعية `Zones` في نموذج إكسيل التوأم (**Excel Twin**) والمعمارية النظيفة الموحدة (**Dedicated Clean Seed Architecture**).

---

## 🏛️ 1. الفلسفة والهدف الوظيفي (Functional Philosophy)
- **التقسيم المكاني للمصنع (Plant Zoning & Sectors):** تعريف الورش وخطوط الإنتاج الـ 14 الرئيسية (مثال: `Détourage`, `FM`, `Polissage`, `SAT`, `FIN1`, `Auto Cuivre`...).
- **الربط التلقائي بالآلات والمسؤولين:** كل منطقة تجمع الآلات التابعة لها، والفنيين والمشرفين المعينين عليها.
- **التوجيه الميداني لطلبات الصيانة:** استخدام رمز المنطقة (`code_zone`) كنقطة ارتكاز في تسجيل طلبات التدخل وأذونات الصرف السريع.

---

## 💾 2. معمارية البيانات المرجعية المخصصة (Dedicated Clean Seed Standard)

```
/src/data/zones/seedZones.json  (14 ورشة ومنطقة إنتاجية)
               │
    /src/hooks/useMachineSubState.js
               │
    /src/presentation/router/useAppRouterProps.js
               │
           ZonesView
 (استعراض وتصفية المناطق والربط بالفنيين والآلات)
```

---

## 📊 3. بنية المنطقة الصناعية (Zone Schema)

| الحقل البرمجي | النوع | الوصف |
| :--- | :---: | :--- |
| `id_zone` | `String` | الاسم أو المعرف المرجعي للمنطقة (مثال: `Détourage`, `FM`, `SAT`). |
| `code_zone` | `String` | الرمز الأبجدي للمنطقة (مثال: `DETOURAG`, `FM`, `SAT`). |
| `libelle` | `String` | الاسم الكامل المعروض في الواجهات. |
| `type` | `String` | تصنيف الورشة (`PRODUCTION`, `FINITION`, `UTILITE`, `SUPPORT`). |
| `description` | `String` | الشرح التقني للعمليات الفيزيائية والميكانيكية في الورشة. |
