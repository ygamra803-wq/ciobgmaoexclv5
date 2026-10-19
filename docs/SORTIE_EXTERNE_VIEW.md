# 🛠️ توثيق صفحة الصرف الخارجي ولف المحركات (Sortie Externe Bobinage)
## نظام CIOB GMAO Light UI Excel

هذا الملف يوثق بالتفصيل المعماري والتقني صفحة **الصرف الخارجي وإصلاح المحركات (`SortieExterneView.jsx`)**، المتطابقة مع ورقة العمل المرجعية `Sortie_Externe` في نموذج إكسيل التوأم (**Excel Twin**) والمعمارية النظيفة الموحدة (**Dedicated Clean Seed Architecture**).

---

## 🏛️ 1. الفلسفة والهدف الوظيفي (Functional Philosophy)
- **دورة حياة الصيانة الخارجية (External Repair Lifecycle):** تتبع خروج المحركات والمعدات الكبرى نحو ورش ومقاولي الصيانة الخارجية (Bobinage, Usinage, Révision).
- **مراحل التتبع (Workflow States):**
  1. `En réparation externe`: تم فك المكون وإرساله للمورد الخارجي.
  2. `Retourné OK`: تم استلام المكون بعد الإصلاح وفحصه في ورشة المصنع.
  3. `Monté`: تمت إعادة تركيب المكون على الآلة وتجربته تحت الحمل.
  4. `En stock`: المكون جاهز في المستودع كقطعة احتياطية جاهزة.
- **التكاليف وأمر الشغل:** ربط كل عملية إصلاح بأمر الصيانة التصحيحية (`id_corrective`) والتكلفة الإجمالية بالدرهم (`cout_bobinage`).

---

## 💾 2. معمارية البيانات المرجعية المخصصة (Dedicated Clean Seed Standard)

```
/src/data/movements/seedSortiesExternes.json  (سجل أذونات الصرف الخارجي)
                     │
      /src/hooks/useSortieExterneSubState.js
   (إدارة الحالة والتخزين gmao_sortie_externe_bobinage_v2)
                     │
      /src/presentation/router/useAppRouterProps.js
                     │
              SortieExterneView
   (تتبع المحركات، إشعارات الورود، وتسجيل تكلفة اللف)
```
