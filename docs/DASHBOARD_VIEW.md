# 📊 توثيق لوحة التحكم والقيادة (Dashboard & Cockpit View)
## نظام CIOB GMAO Light UI Excel

هذا الملف يوثق بالتفصيل المعماري والتقني صفحة **Dashboard (Tableau de Bord)**، قمرة القيادة والتحكم الإستراتيجي لنظام **CIOB GMAO Light UI Excel**.

---

## 🏛️ 1. الفلسفة والهدف الوظيفي (Functional Philosophy)
- **قمرة القيادة الشاملة (Unified Maintenance & Warehouse Cockpit):** تمنح مسؤولي الصيانة والمستودع نظرة شمولية وفورية على حالة المخزون، الحركات الجارية، طلبات الشراء، وحالة الآلات.
- **تتبع طلبات الشراء والتموين (Procurement & Order Tracking):** وحدة متكاملة لإدارة طلبات الشراء من لحظة إنشائها وحتى استلامها الفعلي وتحويلها بنقرة واحدة إلى إدخال مخزني (`Entrée Externe - REAPPRO`) يزيد من الرصيد الفعلي للمخزون فورياً.
- **الذكاء التحليلي للتدخلات (Maintenance & Flux Analytics):** استعراض حي لتوزيع الأعمال حسب نوع الإجراء (`CORRECTIVE`, `PREVENTIVE`, `AMELIORATIVE`, `USAGE`, `REAPPRO`) لتحديد نمط الصيانة الغالب (وقائي أم علاجي).
- **مكافحة توقف خطوط الإنتاج (Zero-Downtime Alerting):** قائمة مراقبة فورية لكافة القطع التي بلغت أو تجاوزت حدود الخطر (`RUPTURE` و `ALERTE`) مع زر طلب إعادة تزويد ذكي يحسب الكمية المطلوبة تلقائياً.

---

## 📊 2. المكونات والبطاقات الوظيفية (Core Dashboard Modules)

### أ. الشريط العلوي التنفيذي (Executive Header & Quick Actions)
- شارات الحالة: `CIOB GMAO Light Twin` و `100% Offline Client-Side`.
- أزرار الإجراءات السريعة:
  - `+ Nouvelle Commande`: فتح نافذة إنشاء طلب شراء أو استعجال فوري لقطع الغيار.
  - `+ Sortie / Entrée Rapide`: الانتقال المباشر لشاشة تسجيل حركات الصرف والإدخال.
  - `Exporter Excel (.xlsx)`: حفظ وتصدير مصنف إكسيل التوأم بنقرة زر.

### ب. بطاقات المؤشرات الرئيسية الأربعة (Primary KPI Cards)
1. **Articles au Catalogue (إجمالي المقالات):** عدد المراجع المعرفة في المستودع وعدد التصنيفات.
2. **Unités Physiques en Stock (الرصيد الفعلي الإجمالي):** مجموع القطع المتوفرة مع إحصائية مجموع الإدخالات والإخراجات.
3. **Seuils Critiques & Ruptures (التنبيهات والنفاد):** إجمالي القطع في حالة حرجة مع تفصيل عدد مقالات النفاد (`Ruptures`) ومقالات التنبيه (`Alertes`).
4. **Parc Machines Actif (أسطول الآلات):** عدد الآلات الإجمالي، مع تمييز الحالات (`En service`, `En maintenance`).

---

## 🛒 3. محرك تتبع طلبات الشراء (Purchase Order Tracking Engine)

| الحقل | الوصف ودوره في النظام |
| :--- | :--- |
| **`code_bon`** | رقم طلب الشراء (توليد تلقائي بصيغة `CMD-YYYY-XXX`). |
| **`ref`** | مرجع القطعة المطلوبة. |
| **`designation`** | توصيف وتفاصيل القطعة. |
| **`quantite`** | الكمية المطلوبة (يتم اقتراحها تلقائياً بالمعادلة `Seuil * 2 - StockActuel`). |
| **`fournisseur`** | المورد المتوقع أو المعتمد. |
| **`technicien`** | الفني أو رئيس الفريق طالب التموين. |
| **`id_zone` / `id_machine`** | الوجهة أو الآلة المستهدفة بالطلب (اختياري). |
| **`tags`** | مصفوفة وسوم التتبع (`#COMMANDE_EN_ATTENTE`, `#RECEPTION_VALIDE`, إلخ). |

### ⚡ آلية تحويل الطلب إلى إدخال مخزني (One-Click Reception):
عند النقر على زر **"Valider Réception"**:
1. يتم تعديل الحركة المسجلة في `Mouvements`.
2. يتحول النوع من `COMMANDE` إلى `Entrée Externe`.
3. يُسجل الإجراء كـ `REAPPRO`.
4. يُحدث التاريخ إلى تاريخ اليوم وتُضاف علامة `#RECEPTION_VALIDE`.
5. ينعكس ذلك فورياً على رصيد المخزون الفعلي `Stock Actuel` بفضل دالة `SUMIFS` المحسوبة عبر `useMemo`.

---

## 📈 4. مؤشرات تحليل التدخلات والقطع الأكثر استهلاكاً (Analytics)

1. **توزيع التدخلات حسب نوع الإجراء (`Action ID`):**
   - **Corrective (علاجي / تصليح أعطال):** باللون الأحمر.
   - **Préventive (وقائي دوري):** باللون الأزرق.
   - **Usage Direct (استهلاك مباشر بدون آلة):** باللون البنفسجي.
   - **Améliorative (تحسين وتطوير):** باللون الكهرماني.
   - **Réapprovisionnement (تموين المستودع):** باللون الزمردي.
2. **أعلى 5 قطع استهلاكاً (Top 5 Consumed Spare Parts):** تراتبية القطع الأكثر سحباً مع الرصيد المتبقي.
3. **أعلى الآلات طلباً للصيانة (Top Demanding Machines):** الآلات الأكثر تسجيلاً لأعمال التدخل والصيانة.

---

## 📐 5. بطاقات الإرشاد لمعادلات إكسيل التوأم (Excel Twin Formulas)
- **Formule Entrées (F):** `=SUMIFS(Qté, Ref, [@Ref], "Entrée")`
- **Formule Sorties (G):** `=SUMIFS(Qté, Ref, [@Ref], "Sortie")`
- **Formule Actuel (H):** `=[@[Initial]] + [@Entrees] - [@Sorties]`
- **Formule Alerte (J):** `=IF(H<=0, "RUPTURE", IF(H<=I, "ALERTE", "OK"))`

---

## 🎨 6. معايير التصميم وهوية BDR Light Excel UI
- تباين عالي وخلفية بيضاء مع حواف رمادية دقيقة وظلال ناعمة (`shadow-xs`).
- استخدام شارات حالة ملونة واضحة لسهولة المسح البصري السريع.
- نافذة إنشاء طلب الشراء منبثقة بتصميم موحد وخلفية مهدئة (`bg-slate-900/45 backdrop-blur-xs`).
- استجابة كاملة لجميع قياسات الشاشات (`Mobile`, `Tablet`, `Desktop`, `Ultra-wide`).
