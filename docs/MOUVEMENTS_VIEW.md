# 📦 توثيق صفحة حركات المخزن والصرف (Mouvements & Sorties Views)
## نظام CIOB GMAO Light UI Excel

هذا الملف يوثق بالتفصيل المعماري والتقني صفحات **حركات المخزن والصرف السريع (`MouvementsView.jsx` و `SortieView.jsx`)**، المتطابقة مع ورقة العمل المرجعية `Mouvement` في نموذج إكسيل التوأم (**Excel Twin**) والمعمارية النظيفة الموحدة (**Dedicated Clean Seed Architecture**).

---

## 🏛️ 1. الفلسفة والهدف الوظيفي (Functional Philosophy)
- **دفتر الأستاذ لحركات القطع (Stock Movement Ledger):** توثيق كل حركة دخول (`Entrée Interne`, `Entrée Externe`), خروج (`Sortie Interne`, `Bon de Sortie`), أو تسوية مخزنية.
- **الربط المباشر بأوامر العمل والآلات:** كل حركة صرف تسجل رقم طلب الشراء أو أمر العمل (`num_commande` / `num_ot`)، الآلة المستفيدة (`id_machine_registered`)، والمنطقة (`id_zone`).
- **إعادة الحساب الفوري للرصيد المخزني:** تحديث كمية `stockActuel` للقطعة فور تسجيل حركة الصرف أو الإدخال بدون أي تعارض.

---

## 💾 2. معمارية البيانات المرجعية المخصصة (Dedicated Clean Seed Standard)

```
/src/data/movements/seedMouvements.json  (665 حركة مخزنية مفصلة)
                   │
        /src/hooks/useMovementSubState.js
   (تطبيع وتخزين الحركات gmao_mouvements_v2)
                   │
        /src/presentation/router/useAppRouterProps.js
                   │
         ┌─────────┴─────────┐
         │                   │
   MouvementsView        SortieView
(سجل الحركات الشامل)  (الصرف السريع الميداني)
```

---

## 📊 3. بنية حركة المخزن (Movement Schema)

| الحقل البرمجي | النوع | الوصف والربط |
| :--- | :---: | :--- |
| `id` | `Number` | المعرف التسلسلي للحركة. |
| `code_bon` | `String` | رمز إذن الصرف أو الاستلام (مثال: `Bon-001`). |
| `num_commande` | `String` | رقم أمر الشغل أو الطلب المرجعي (`OT-1234`, `CMD-042`). |
| `date` | `String` | تاريخ تنفيذ الحركة (`YYYY-MM-DD`). |
| `ref` | `String` | مرجع القطعة (مطابق لـ `seedStock.json`). |
| `quantite` | `Number` | الكمية المصروفة أو المدخلة. |
| `type` | `String` | نوع الحركة (`Sortie Interne`, `Entrée Externe`, `COMMANDE`). |
| `action_id` | `String` | نوع التدخل (`CORRECTIVE`, `PREVENTIVE`, `REAPPRO`, `MACHINE`). |
| `technicien` | `String` | اسم الفني المستلم (مطابق لـ `seedTechnicians.json`). |
| `id_zone` | `String` | المنطقة الصناعية (مطابق لـ `seedZones.json`). |
| `id_machine_registered` | `String` | رمز الآلة المستفيدة (مطابق لـ `seedMachines.json`). |
| `commentaire` | `String` | البيان أو الملاحظات الميدانية. |
