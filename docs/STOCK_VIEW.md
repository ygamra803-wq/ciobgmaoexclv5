# 📦 توثيق مخزون قطع الغيار ومحرك أوامر الشراء والتموين (`STOCK_VIEW.md`)

يوثق هذا الملف المعمارية التقنية لصفحة **المخزون الفعلي (`StockView.tsx`)**، محرك الفهرسة التزايدي (`IncrementalStockIndex.ts`)، ومركز التموين وأوامر الشراء (`StockReplenishmentModal.tsx`).

---

## 🏛️ 1. المسلمات الهندسية للمخزون (`Stock Engine Invariants`)

1. **معادلة الرصيد الوحيدة غير القابلة للالتفاف:**
   $$\text{stockActuel} = \text{stockInitial} + \text{entrées} - \text{sorties}$$
   تُحسب حصرياً عبر `src/application/IncrementalStockIndex.ts` ($O(1)$) و`src/application/services/StockCalculationService.ts`.
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

## 🛒 2. محرك إعادة التموين وأوامر الشراء (`Replenishment & Purchase Orders — PO`)

تضم شاشة المخزون مركز التموين الذكي (`StockReplenishmentModal.tsx` — المفتاح `STORAGE_KEYS.REPLENISHMENT_ORDERS = 'gmao_replenishment_orders_v1'`):
1. **رصد النواقص واقتراح الكميات:** يلتقط تلقائياً كافة الأصناف التي وصلت إلى `stockActuel <= seuil` ويقترح كمية الطلب الاقتصادية $\max(1, \text{seuil} \times 2 - \text{stockActuel})$.
2. **دورة حياة أمر الشراء (`ReplenishmentOrder FSM`):**
   $$\text{BROUILLON} \longrightarrow \text{COMMANDE} \longrightarrow \text{RECEPTION\_PARTIELLE} \longrightarrow \text{RECU\_CONFORME} \quad (\text{أو } \text{ANNULE})$$
3. **حراسة الاستلام المخزني (`handleReceiveReplenishmentOrder`):**
   - يمنع إعادة استلام أمر مغلق (`RECU_CONFORME`) أو ملغى (`ANNULE`).
   - يفرض سقف الكمية المستلمة $\min(\text{quantiteRecueNow}, \text{remainingNeeded})$ لمنع تجاوز الكمية المطلوبة.
   - يولد تلقائياً حركة إدخال مخزني (`type: 'Entrée'`, `action_id: 'reapprovisionnement'`) ويعيد بناء فهرس المخزون عبر `movementRepository.bulkReplace` دون لمس كود محرك الحساب الأساسي.
   - يسجل أحداث `PO_CREATED`، `PO_RECEIVED`، و`PO_CANCELLED` في سجل التدقيق المؤسسي (`auditEvents`).
