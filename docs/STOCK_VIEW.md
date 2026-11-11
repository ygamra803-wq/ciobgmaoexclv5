# 📦 توثيق مخزون قطع الغيار، هرم PDR الثلاثي، ومحرك أوامر الشراء (`STOCK_VIEW.md`)

يوثق هذا الملف المعمارية التقنية لصفحة **المخزون الفعلي (`StockView.tsx`)**، هرم تصنيف قطع الغيار الثلاثي (`Group ➔ Type ➔ Designation/SKU` — `CATALOG-GROUP-P1`)، وسوم السياسة المادية (`POLICY-TAGS-P1`)، محرك الفهرسة التزايدي (`IncrementalStockIndex.ts`)، ومركز التموين وأوامر الشراء (`StockReplenishmentModal.tsx`).

---

## 🏛️ 1. المسلمات الهندسية للمخزون (`Stock Engine Invariants`)

1. **معادلة الرصيد الوحيدة غير القابلة للالتفاف:**
   $$\text{stockActuel} = \text{stockInitial} + \text{entrées} - \text{sorties}$$
   تُحسب حصرياً على مستوى مرجع الصنف (`ref`) عبر `src/application/IncrementalStockIndex.ts` ($O(1)$) و`src/application/services/StockCalculationService.ts`.
2. **عزل قطع الغيار الاستهلاكية (`PDR` vs `Entrepôt`):**
   - جدول `rawStock` (`gmao_raw_stock_v8`) مخصص حصرياً لقطع الغيار الاستهلاكية (`PDR`) التي تُخصم بالكمية.
   - المكونات الدوارة والأجزاء المركبة (`COMPONENT / PART` في `warehouseItems`) تُدار بدورة حياة الحالة في المستودع (`Entrepôt`) ولا تختلط بحسابات `rawStock`.
3. **تنبيهات العتبات الحتمية:**
   - `RUPTURE`: عندما يكون `stockActuel <= 0`.
   - `ALERTE`: عندما يكون `0 < stockActuel <= seuil`.
   - `OK`: عندما يكون `stockActuel > seuil`.
4. **التدقيق المؤسسي التلقائي (`Audit Ledger`):**
   - أي تعديل على الرصيد الافتتاحي (`stockInitial`) أو السعر الوحدوي (`prix_unitaire`) أو حد الأمان (`seuil`) يُوثق تلقائياً بالقيم السابقة واللاحقة (`before / after`) في `STORAGE_KEYS.AUDIT_EVENTS` عبر `AuditService.ts`.

---

## 🌲 2. هرم كتالوج قطع الغيار الثلاثي (`CATALOG-GROUP-P1`: `Group ➔ Type ➔ Designation/SKU`)

يرتكز كتالوج قطع الغيار على ثلاث طبقات مترابطة يديرها `src/domain/stock/pdrHierarchyService.ts`:

1. **المستوى 1 — مجموعات قطع الغيار (`PdrGroup` — `STORAGE_KEYS.PDR_GROUPS = 'gmao_pdr_groups_v1'`):**
   - يمثل المجال التكنولوجي الأعلى (`GRP-PDR-01` Roulements & Paliers، `GRP-PDR-02` Transmission & Courroies، `GRP-PDR-03` Étanchéité & Joints، `GRP-PDR-04` Électrotechnique، `GRP-PDR-05` Hydraulique & Pneumatique، `GRP-PDR-06` Lubrifiants & Fluides، `GRP-PDR-07` Visserie & Fixation).
   - يُدار عبر نافذة `src/presentation/pages/stock/components/PdrGroupsModal.tsx`، ويحمل وسوم السياسة الافتراضية (`default_policy_tags`).
   - يُمنع الحذف الصلب للمجموعة المرتبطة بأنواع أو أصناف نشطة، ويُستعاض عنه بالتعطيل الآمن (`is_active: false`) عبر `canDeactivateOrDeletePdrGroup`.
2. **المستوى 2 — أنواع قطع الغيار (`StockType` — `STORAGE_KEYS.STOCK_TYPES = 'gmao_types_v5'`):**
   - يرتبط كل نوع بمجموعته الأب عبر الحقل الكانوني `id_group` (`TYP-01` إلى `TYP-21` في البذرة القياسية).
   - تفرض الفلاتر الشلالية في `StockView.tsx` و`TypeView.tsx` و`DesignationView.tsx` تصفية الأنواع تلقائياً عند اختيار المجموعة، مع دعم فلتر `Non classé` (`UNCATEGORIZED_GROUP_FILTER`) لرصد الأصناف غير المصنفة.
3. **المستوى 3 — الأصناف والتسميات (`IStockItem` — `STORAGE_KEYS.RAW_STOCK = 'gmao_raw_stock_v8'`):**
   - يرتبط كل صنف (`ref`) بنوعه (`id_type` / `type`) وبمجموعته (`id_group`)، مع حل هرمي تلقائي عبر `resolvePdrHierarchy(item, types, groups)` ووحدة استيراد/تصدير Excel ثلاثية الأوراق (`PDR_GROUPS`, `PDR_TYPES`, `PDR_ITEMS`) في `src/services/pdrHierarchyExcelService.ts` تدعم وضعي `MERGE` و`REPLACE_CATALOG`.

---

## 🏷️ 3. وسوم السياسة المادية (`POLICY-TAGS-P1` — `MaterialPolicyTag`)

يُصنف كل صنف أو مجموعة وفق السياسة الهندسية والتشغيلية عبر `src/domain/warehouse/policyTagsService.ts`:
- `PDR_MAGASIN`: قطعة غيار قياسية مخزنية.
- `FABRICABLE_ATELIER`: قطعة قابلة للتصنيع/الخراطة داخل الورشة الميكانيكية (`Atelier Fabrication`).
- `REPARABLE_ATELIER`: قطعة قابلة للإصلاح أو التجليخ (`Rectification`).
- `SOUS_TRAITABLE`: قابلة للإرسال لمقاول خارجي (لف محركات، صيانة إلكترونية).
- `CONSOMMABLE_CRITIQUE`: مستهلك حيوي ذو أولوية تموين قصوى.

تنتقل وسوم السياسة بالوراثة من `PdrGroup.default_policy_tags` إلى الصنف ما لم يحدد الصنف وسوماً خاصة به (`getEffectivePdrPolicyTags`).

---

## 🛒 4. محرك إعادة التموين وأوامر الشراء (`Replenishment & Purchase Orders — PO`)

تضم شاشة المخزون مركز التموين الذكي (`StockReplenishmentModal.tsx` — المفتاح `STORAGE_KEYS.REPLENISHMENT_ORDERS = 'gmao_replenishment_orders_v1'`):
1. **رصد النواقص واقتراح الكميات:** يلتقط تلقائياً كافة الأصناف التي وصلت إلى `stockActuel <= seuil` ويقترح كمية الطلب الاقتصادية $\max(1, \text{seuil} \times 2 - \text{stockActuel})$.
2. **دورة حياة أمر الشراء (`ReplenishmentOrder FSM`):**
   $$\text{BROUILLON} \longrightarrow \text{COMMANDE} \longrightarrow \text{RECEPTION\_PARTIELLE} \longrightarrow \text{RECU\_CONFORME} \quad (\text{أو } \text{ANNULE})$$
3. **حراسة الاستلام المخزني (`handleReceiveReplenishmentOrder`):**
   - يمنع إعادة استلام أمر مغلق (`RECU_CONFORME`) أو ملغى (`ANNULE`).
   - يفرض سقف الكمية المستلمة $\min(\text{quantiteRecueNow}, \text{remainingNeeded})$ لمنع تجاوز الكمية المطلوبة.
   - يولد تلقائياً حركة إدخال مخزني (`type: 'Entrée'`, `action_id: 'reapprovisionnement'`) ويعيد بناء فهرس المخزون عبر `movementRepository.bulkReplace` دون لمس كود محرك الحساب الأساسي.
   - يسجل أحداث `PO_CREATED`، `PO_RECEIVED`، و`PO_CANCELLED` في سجل التدقيق المؤسسي (`auditEvents`).
