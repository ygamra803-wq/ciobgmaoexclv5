# 👥 توثيق صفحة المستخدمين والفنيين (Utilisateurs View)
## نظام CIOB GMAO Light UI Excel

هذا الملف يوثق بالتفصيل المعماري والتقني صفحة **المستخدمين (Utilisateurs View)** بفئاتهم الثلاث: **الفنيون (Techniciens)**، **المسؤولون والمشرفون (Responsables)**، و**المشغلون (Opérateurs)**، المتطابقة مع ورقة العمل المرجعية `Users` في نموذج إكسيل التوأم (**Excel Twin**) والمعمارية النظيفة الموحدة (**Dedicated Clean Seed Architecture**).

---

## 🏛️ 1. الفلسفة والهدف الوظيفي (Functional Philosophy)
- **إدارة الكادر البشري للصيانة والتشغيل:** سجل الفنيين الميدانيين والمشرفين والمشغلين مع تخصصاتهم ومناطق تغطيتهم.
- **تحديد الصلاحيات والمناصب المرجعية:** ربط المشرفين بنماذج المسؤولية (`RMG` - مسؤول مخزن، `RMT` - مسؤول صيانة، `RZN` - مسؤول منطقة).
- **التتبع الميداني في الصرف والتدخلات:** استخدام اسم الفني في أذونات الخروج (`Sorties`)، أوامر الشغل (`Bons de Travail`)، والمهام الوقائية.

---

## 💾 2. معمارية البيانات المرجعية المخصصة (Dedicated Clean Seed Standard)

```
/src/data/users/seedTechnicians.json (الفنيون الميدانيون والتخصصات)
/src/data/users/seedOperations.json  (المشرفون، المسؤولون، والمشغلون)
               │
    /src/hooks/useUserSubState.js
               │
    /src/presentation/router/useAppRouterProps.js
               │
         UtilisateursView
(إدارة الفنيين والمسؤولين والمشغلين مع مرشحات المناطق)
```

---

## 📊 3. جداول البيانات وبنيتها (Schemas)

### أ. الفنيون (`seedTechnicians.json`):
| الحقل البرمجي | النوع | الوصف |
| :--- | :---: | :--- |
| `id_technician` | `String` | الرمز المرجعي (مثال: `TECH-01`, `TECH-02`). |
| `nom` | `String` | اسم الفني (مثال: `Rachid`, `Youssef`, `Mhammed`). |
| `id_zone` | `String` | المنطقة الرئيسية التابع لها. |
| `specialite` | `String` | التخصص المهني (ميكانيك، كهرباء، تشكيل، صيانة). |

### ب. المشرفون والمشغلون (`seedOperations.json`):
| الحقل البرمجي | النوع | الوصف |
| :--- | :---: | :--- |
| `id_operation` | `String` | المعرف (مثال: `RESP-01`, `OP-01`). |
| `nom` | `String` | الاسم الكامل. |
| `type_profil` | `String` | نوع الحساب (`RESPONSABLE` أو `OPERATEUR`). |
| `id_zone` | `String` | المنطقة المسندة أو `ALL` للمشرفين العامين. |
| `templates` | `Array` | مصفوفة قوالب المسؤولية (`RMG`, `RMT`, `RZN`). |
