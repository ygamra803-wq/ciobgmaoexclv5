# 🏢 توثيق صفحة المستودع ومكونات المعدات (Entrepôt View)
## نظام CIOB GMAO Light UI Excel

هذا الملف يوثق بالتفصيل المعماري والتقني صفحة **المستودع ومكونات المعدات (Entrepôt View)**، المتطابقة مع ورقة العمل المرجعية `Entrepot` في نموذج إكسيل التوأم (**Excel Twin**) والمعمارية النظيفة الموحدة (**Dedicated Clean Seed Architecture**).

---

## 🏛️ 1. الفلسفة والهدف الوظيفي (Functional Philosophy)
- **سجل الأعضاء الدوارة والأجزاء الميكانيكية (`warehouseItems` — `COMPONENT` & `PART`):** تتبع المحركات الكهربائية، المضخات الهيدروليكية، والمخفضات الميكانيكية (`nature: 'COMPONENT'`) إلى جانب الأجزاء البنيوية والميكانيكية المصنعة أو الاحتياطية (`nature: 'PART'`)، مع فصلها الكامل عن مخزن قطع الغيار الاستهلاكية (`rawStock` / `PDR`).
- **تغذية مزدوجة من هرمين رباعيين مستقلين:**
  1. **مسار الأعضاء (`Components`):** `CompGroup (gmao_comp_groups_v2) ➔ CompFamily ➔ CompTemplate ➔ Entrepôt`.
  2. **مسار الأجزاء (`Parts`):** `PartGroup (gmao_part_groups_v1) ➔ PartType ➔ PartDesignation ➔ Entrepôt`.
- **تاريخ اللف وإعادة التأهيل (`Bobinage & Refurbishment History`):** تتبع عمليات إعادة لف المحركات (`Bobinage` / `SORT-EXT`) أو الصيانة بالورشة الميكانيكية (`BR / RECT`) وتحديث حالتها (`Actif`, `En Réparation`, `En Réserve`, `Réformé`).
- **الموقع الميداني والآلة المستضيفة:** ربط المكون أو الجزء مباشرة بالآلة المسجلة (`id_machine_registered`) والمنطقة (`zone`) والموضع الوظيفي (`position`).

---

## 💾 2. معمارية البيانات المرجعية المخصصة (Dedicated Clean Seed Standard)

```
/src/data/warehouse/seedWarehouseItems.json     (سجل عناصر المستودع: COMPONENT + PART)
/src/data/warehouse/seedEntrepotComponents.json (سجل المكونات وبطاقات اللف)
/src/data/warehouse/seedCompGroups.json         (مجموعات الأعضاء الدوارة)
/src/data/warehouse/seedPartGroups.json         (مجموعات الأجزاء الميكانيكية المستقلة)
                      │
           /src/application/DataGateway.ts & /src/store/useGmaoStore.ts
   (إدارة الكيانات المرجعية والمصدر الحقيقي الوحيد SSOT)
                      │
           /src/presentation/router/useAppRouterProps.ts
                      │
                 EntrepotView
   (استعراض وتصفية الأعضاء والأجزاء، تاريخ اللف، وتعيين الآلات)
```

---

## 📊 3. بنية عنصر المستودع (Warehouse Item Schema)

| الحقل البرمجي | النوع | الوصف |
| :--- | :---: | :--- |
| `id_warehouse_item` / `id` | `String` | الرمز الداخلي للمكون أو الجزء (مثال: `mot 01`, `mot 02`). |
| `nature` | `'COMPONENT' \| 'PART'` | الطبيعة الصناعية (عضو دوار قابل للإصلاح أو جزء ميكانيكي/بنيوي) وتُفحص عبر `isWarehouseComponent` و`isWarehousePart`. |
| `ref` | `String` | المرجع القياسي (مثال: `REF-10A111-NA`). |
| `designation` | `String` | الوصف الفني والمواصفات (مثال: `Moteur Asynchrone 10A-11,1A`). |
| `id_family` / `id_type` | `String` | عائلة المكون (`FAM-MOTEUR-ELEC-001`) أو نوع الجزء (`TYP-PART-XX`). |
| `id_template` / `id_designation` | `String` | قالب المكون (`TPL-MOT-ASYNC-001`) أو تسمية الجزء (`PartDesignation`). |
| `id_machine` | `String` | الآلة المثبت عليها حالياً. |
| `zone` | `String` | المنطقة الصناعية الحالية. |
| `position` | `String` | موضع التركيب في الآلة. |
| `etat` / `status` | `String` | الحالة التشغيلية (`Actif`, `En Réserve`, `En Réparation`, `Réformé`). |
| `quantite` | `Number` | الكمية المتوفرة. |
| `historique_bobinage` | `Array` | سجل وتاريخ عمليات إعادة اللف والتصليح. |
