# 🏢 توثيق صفحة المستودع ومكونات المعدات (Entrepôt View)
## نظام CIOB GMAO Light UI Excel

هذا الملف يوثق بالتفصيل المعماري والتقني صفحة **المستودع ومكونات المعدات (Entrepôt View)**، المتطابقة مع ورقة العمل المرجعية `Entrepot` في نموذج إكسيل التوأم (**Excel Twin**) والمعمارية النظيفة الموحدة (**Dedicated Clean Seed Architecture**).

---

## 🏛️ 1. الفلسفة والهدف الوظيفي (Functional Philosophy)
- **سجل المكونات الكبرى (Equipment Major Components Registry):** تتبع المحركات الكهربائية، المضخات الهيدروليكية، والمخفضات الميكانيكية المركبة على آلات المصنع.
- **تاريخ اللف وإعادة التأهيل (Bobinage & Refurbishment History):** تتبع عمليات إعادة لف المحركات (Bobinage) أو الصيانة الجسيمة وتحديث حالتها (`Actif`, `En Réparation`, `En Réserve`).
- **الموقع الميداني والآلة المستضيفة:** ربط المكون مباشرة بالآلة المسجلة (`id_machine_registered`) والمنطقة (`zone`) والموضع الوظيفي (`position`).

---

## 💾 2. معمارية البيانات المرجعية المخصصة (Dedicated Clean Seed Standard)

```
/src/data/warehouse/seedWarehouseItems.json     (185 مكوناً رئيسياً في المستودع والميدان)
/src/data/warehouse/seedEntrepotComponents.json (سجل المكونات وبطاقات اللف)
                      │
           /src/hooks/useWarehouseSubState.js
   (إدارة الحالة والتخزين gmao_warehouse_items_v3 + gmao_entrepot_components_v3)
                      │
           /src/presentation/router/useAppRouterProps.js
                      │
                 EntrepotView
   (استعراض وتصفية المكونات، تاريخ اللف، وتعيين الآلات)
```

---

## 📊 3. بنية عنصر المستودع (Warehouse Component Schema)

| الحقل البرمجي | النوع | الوصف |
| :--- | :---: | :--- |
| `id_warehouse_item` | `String` | الرمز الداخلي للمكون (مثال: `mot 01`, `mot 02`). |
| `ref` | `String` | المرجع القياسي (مثال: `REF-10A111-NA`). |
| `designation` | `String` | الوصف الفني والمواصفات (مثال: `Moteur Asynchrone 10A-11,1A`). |
| `id_family` | `String` | عائلة المكون (`FAM-MOTEUR-ELEC-001`). |
| `id_template` | `String` | قالب المكون (`TPL-MOT-ASYNC-001`). |
| `id_machine` | `String` | الآلة المثبت عليها حالياً. |
| `zone` | `String` | المنطقة الصناعية الحالية. |
| `position` | `String` | موضع التركيب في الآلة. |
| `etat` | `String` | الحالة التشغيلية للمكون (`Actif`, `En Réserve`, `En Réparation`). |
| `quantite` | `Number` | الكمية المتوفرة. |
| `historique_bobinage` | `Array` | سجل وتاريخ عمليات إعادة اللف والتصليح. |
