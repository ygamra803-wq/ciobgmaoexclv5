# 🗓️ توثيق صفحة الصيانة الوقائية (Preventive Maintenance Views)
## نظام CIOB GMAO Light UI Excel

هذا الملف يوثق بالتفصيل المعماري والتقني صفحة **الصيانة الوقائية (Preventive Maintenance)** بشقيها: **المصفوفة السنوية الرئيسية (`PreventiveView.jsx`)** و**الصفحات المرجعية الثانوية (`PreventiveSecondaryView.jsx`)**، المتطابقة مع المعمارية النظيفة الموحدة (**Dedicated Clean Seed Architecture**).

---

## 🏛️ 1. الفلسفة والهدف الوظيفي (Functional Philosophy)
- **مصفوفة الأسابيع السنوية (52-Week Master Matrix - S1..S52):** جدولة ومراقبة 1,175 مهمة صيانة دورية عبر أسابيع السنة.
- **رموز التدخلات المرجعية (Standard Action Codes):**
  - `C`: Contrôle (مراقبة وفحص)
  - `N`: Nettoyage (تنظيف وإزالة شوائب)
  - `G`: Graissage (تشحيم)
  - `V`: Vidange (تفريغ وتغيير زيوت)
  - `R`: Remplacement (استبدال دوري)
  - `S`: Serrage (شد وضبط ميكانيكي)
  - `L`: Lubrification (تزييت)
- **منشئ الخطط الوقائية (Plan Builder):** إنشاء خطط وقائية هندسية وتوليد مهامها آلياً لكل خط أو آلة.
- **دليل التعليمات الفنية (Technical Guides):** بطاقات إرشادية لكل إجراء وقائي مع معايير السلامة وقطع الغيار المقترحة.

---

## 💾 2. معمارية البيانات المرجعية المخصصة (Dedicated Clean Seed Standard)

```
/src/data/preventive/seedPreventiveTasks.json   (1,175 مهمة وقائية مجدولة S1..S52)
/src/data/preventive/seedPreventiveActions.json (7 رموز إجراءات قياسية)
/src/data/preventive/seedPreventiveGuides.json  (10 كتيبات وإرشادات فنية)
                      │
           /src/hooks/usePreventiveSubState.js
   (إدارة الحالة والتخزين gmao_preventive_tasks_v9 + معالجات CRUD)
                      │
           /src/presentation/router/useAppRouterProps.js
                      │
         ┌────────────┴────────────┐
         │                         │
  PreventiveView           PreventiveSecondaryView
(المصفوفة والتحليلات)     (منشئ الخطط، الدليل، الإجراءات)
```

---

## 📊 3. بنية المهام الوقائية (Preventive Task Schema)

| الحقل البرمجي | النوع | الوصف |
| :--- | :---: | :--- |
| `id` | `String` | المعرف الفريد للمهمة (مثال: `ID-PREV-DET01-MOTEUR-MEN-0001-1`). |
| `code` | `String` | رمز المهمة المرجعي. |
| `id_machine` | `String` | رمز الآلة المرتبطة (مطابق لـ `seedMachines.json`). |
| `nom_machine` | `String` | اسم وتسمية الآلة. |
| `id_zone` | `String` | المنطقة الصناعية (مطابق لـ `seedZones.json`). |
| `composant` | `String` | المكون أو الجزء المعني بالصيانة الوقائية. |
| `action_code` | `String` | رمز الإجراء القياسي (`C`, `N`, `G`, `V`, `R`, `S`, `L`). |
| `frequence` | `String` | الدورية (`Hebdomadaire`, `Mensuel`, `Trimestriel`, `Semestriel`, `Annuel`). |
| `planning` | `Object` | خريطة الأسابيع السنوية المجدولة (مثال: `{"S1": "C", "S5": "C"}`). |
| `etat` | `String` | الحالة التشغيلية للمهمة (`À faire`, `En cours`, `Terminé`). |
| `responsable` | `String` | الفني أو المشرف المسؤول. |
| `duree_estimee` | `String` | الزمن المقدر للإنجاز. |

---

## 🔗 4. التكامل المزدوج مع المستودع وسجلات التدخلات
- عند تأكيد إنجاز مهمة وقائية تتطلب استبدال قطعة غيار (`R` أو `V`)، يتيح النظام تسجيل حركة صرف فورية (`Sortie`) نحو حساب الآلة تلقائياً.
- ربط مباشر بين رمز الآلة في المهمة الوقائية وسجلها الكامل في صفحة الآلات (`MachinesRegisteredView`).
