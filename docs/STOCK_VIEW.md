# 📦 توثيق صفحة المخزون الفعلي (Stock Actuel — Articles View)
## نظام CIOB GMAO Light UI Excel

هذا الملف يوثق بالتفصيل المعماري والتقني صفحة **Stock Actuel (Articles)**، المتطابقة مع ورقة العمل المرجعية `Stock_Actuel` في نموذج إكسيل التوأم (**Excel Twin**).

---

## 🏛️ 1. الفلسفة والهدف الوظيفي (Functional Philosophy)
- **الإدارة الدقيقة لقطع الغيار والمستهلكات الصناعية (Spare Parts & Consumables):** تتيح للمسؤولين والفنيين مراقبة الأرصدة المتوفرة في المستودعات في الوقت الفعلي.
- **التحديث الحي بالمعادلات الرياضية (Dynamic Live Recalculation):** لا يتم تخزين الرصيد النهائي كقيمة ثابتة بل يُحسب تلقائياً من خلال دمج المخزون الافتتاحي مع جميع حركات الإدخال والإخراج.
- **مكافحة نفاد المخزون (Stockout Prevention):** نظام تنبيه ثلاثي المستويات (`OK`, `ALERTE`, `RUPTURE`) يعتمد على الحد الأدنى (`Seuil d'alerte`).
- **معمارية الحقن النظيف (Dedicated Clean Seed Standard):** اتباع المعيار المعتمد في الصيانة التصحيحية بتوفير قاعدة بيانات مرجعية مستقلة ونظيفة في `/src/data/stock/seedStockItems.json` و `/src/data/stock/seedStockTypes.json` مع إزالة الترقيع وقت التشغيل.

---

## 💾 2. معمارية البيانات وتدفق الحالة (Data Architecture & State Flow)

```
/src/data/stock/seedStockItems.json (873 مقال مرجعي نظيف)
/src/data/stock/seedStockTypes.json (فئات المقالات)
                      │
           /src/hooks/useStockSubState.js
   (إدارة الحالة والتخزين gmao_raw_stock_v7 + CRUD موحد)
                      │
           /src/hooks/useAppCalculations.js
     (حساب Stock Actuel = Initial + Entrées - Sorties)
                      │
           /src/presentation/router/useAppRouterProps.js
                      │
           /src/presentation/pages/stock/StockView.jsx
```

---

## 📊 3. التطابق مع أعمدة إكسيل (Excel Twin Mapping)

| العمود في إكسيل | اسم الحقل البرمجي | النوع | المعادلة المرجعية في إكسيل / الوصف |
| :---: | :--- | :---: | :--- |
| **(A)** | `id` | `Number` | المعرف التسلسلي للسطر. |
| **(B)** | `ref` | `String` | الرمز الفريد للمقال (مثال: `ROUL-6204-2RS`, `DISJ-16A`). |
| **(C)** | `designation` | `String` | الوصف التجاري والفني للمقال. |
| **(D)** | `id_type` | `String` | المعرف المرجعي لنوع/فئة المقال (مرتبط بجدول `Types`). |
| **(E)** | `stockInitial` | `Number` | المخزون الافتتاحي عند بدء الدورة أو الجرد الأولي. |
| **(F)** | `entrees` | `Number` | مجموع الإدخالات: `=SUMIFS(Mouv[Qte], Mouv[Ref], [@Ref], Mouv[Type], "*Entrée*")` |
| **(G)** | `sorties` | `Number` | مجموع الإخراجات: `=SUMIFS(Mouv[Qte], Mouv[Ref], [@Ref], Mouv[Type], "*Sortie*")` |
| **(H)** | `stockActuel` | `Number` | الرصيد الفعلي المتاح: `=[@[Stock Initial]] + [@[Entrées]] - [@[Sorties]]` |
| **(I)** | `seuil` | `Number` | عتبة التنبيه الدنيا المحددة للمقال. |
| **(J)** | `alerte` | `String` | حالة المخزون: `=IF([@StockActuel]<=0, "RUPTURE", IF([@StockActuel]<=[@Seuil], "ALERTE", "OK"))` |
| **(K)** | `emplacement` | `String` | موقع التخزين الدقيق في المستودع (مثال: `R1-B04`, `MAG-A2`). |

---

## ⚙️ 3. المنطق البرمجي والحسابات (Logic & Implementation)

```javascript
// محاكاة حسابات إكسيل في React عبر useMemo عالي الأداء
const stockItems = useMemo(() => {
  const mvtSummary = {};
  mouvements.forEach((m) => {
    const r = String(m.ref || '').trim().toLowerCase();
    if (!r) return;
    if (!mvtSummary[r]) mvtSummary[r] = { entrees: 0, sorties: 0 };
    const q = Number(m.quantite || 0);
    const t = String(m.type || '').toLowerCase();
    if (t.includes('sort')) {
      mvtSummary[r].sorties += q;
    } else if (t.includes('entr')) {
      mvtSummary[r].entrees += q;
    }
  });

  return rawStock.map((art) => {
    const r = String(art.ref || '').trim().toLowerCase();
    const e = mvtSummary[r]?.entrees || 0;
    const s = mvtSummary[r]?.sorties || 0;
    const initial = Number(art.stockInitial || 0);
    const current = initial + e - s;
    const seuil = Number(art.seuil || 0);
    let alerte = 'OK';
    if (current <= 0) alerte = 'RUPTURE';
    else if (current <= seuil) alerte = 'ALERTE';

    return {
      ...art,
      entrees: e,
      sorties: s,
      stockActuel: current,
      alerte,
    };
  });
}, [rawStock, mouvements]);
```

---

## 🎨 4. معايير واجهة المستخدم (BDR Light Excel UI)
- بطاقات إحصائية علوية تلخص: إجمالي المقالات، إجمالي القطع المتوفرة، عدد مقالات التنبيه، وعدد مقالات النفاد.
- شريط فلاتر متعدد: تصفية بالنوع (`Type`), والبحث النصي بالمرجع والوصف والموقع.
- نافذة منبثقة موحدة (`AddArticleModal`) بتعتيم خلفي خفيف وأزرار مطابقة لهوية النظام.
