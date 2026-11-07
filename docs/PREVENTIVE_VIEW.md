# 🗓️ توثيق منظومة الصيانة الوقائية بالزمن والعدادات (`PREVENTIVE_VIEW.md`)

يوثق هذا الملف المعمارية التقنية والوظيفية لوحدة **الصيانة الوقائية (`PreventiveView.tsx`, `PreventiveSecondaryView.tsx`, و `PreventiveMetersView.tsx`)** ومحركي التنفيذ المؤرخ (`ExecutionService.ts`) والعدادات (`MeterService.ts`).

---

## 🏛️ 1. الفلسفة والهدف الوظيفي

1. **مصفوفة الأسابيع السنوية (`52-Week Master Matrix — S1..S52`):** جدولة ومراقبة المهام الوقائية عبر أسابيع السنة برموز الإجراءات القياسية (`C` Contrôle, `N` Nettoyage, `G` Graissage, `V` Vidange, `R` Remplacement, `S` Serrage, `L` Lubrification).
2. **الذاكرة الزمنية غير القابلة للطمس (`Immutable Preventive Executions`):**
   - إتمام أي مهمة وقائية لا يكتفي بقلب راية حالة مؤقتة، بل ينشئ سجلاً تاريخياً مؤرخاً (`PreventiveExecution` في `STORAGE_KEYS.PREVENTIVE_EXECUTIONS`) يحمل `periodMonth (YYYY-MM)`، المنفذ، المكون/الجزء (`id_composant`, `id_part`)، والقطع المستهلكة.
3. **الصيانة الوقائية بالعدادات وساعات التشغيل (`Meter-Based & Hybrid PM`):**
   - عبر `MeterService.ts` وواجهة `PreventiveMetersView.tsx`، تدعم المهام الوقائية 3 أنماط إطلاق (`type_declenchement`):
     - `CALENDRIER`: حسب الجدول الزمني الأسبوعي/الشهري.
     - `COMPTEUR`: عند بلوغ قراءة عداد الآلة عتبة الاستحقاق (`compteur_prochain_declenchement`).
     - `HYBRIDE`: المعيار المزدوج (الأجل الأسبق بين التقويم والعداد).
   - **تقييم العتبات (`OK` / `WARNING` / `OVERDUE`):** تنبيه استباقي (`WARNING`) عند دخول القراءة في هامش الـ 10% الأخيرة قبل العتبة، وتنبيه تجاوز (`OVERDUE`) عند بلوغها، مع نافذة جولة قراءة سريعة للورشة (`Tournée de Relevé Rapide`).
4. **حوكمة الاعتماد (`Maker-Checker`):**
   - تنفيذ الفني الميداني لمهمة وقائية تتضمن قطع غيار يسجل المطالبة (`pieces_claimed`) بحالة `PENDING_VALIDATION`، ولا تُخصم القطع من `rawStock` إلا بعد اعتماد المشرف في `ValidationCenterView.tsx`.

---

## 💾 2. مفاتيح التخزين القياسية (`STORAGE_KEYS`)

| الكيان | المفتاح القياسي | الخدمة المسؤولة |
| :--- | :--- | :--- |
| **المهام الوقائية (`preventiveTasks`)** | `gmao_preventive_tasks_v9` | `DataGateway.savePreventiveTasks` |
| **سجل التنفيذات المؤرخة (`preventiveExecutions`)** | `gmao_preventive_executions_v1` | `ExecutionService.recordExecution` |
| **قراءات العدادات (`meterReadings`)** | `gmao_meter_readings_v1` | `MeterService` / `DataGateway.saveMeterReadings` |
| **رموز الإجراءات (`preventiveActions`)** | `gmao_preventive_actions_v3` | `DataGateway.savePreventiveActions` |
| **الأدلة الفنية (`preventiveGuides`)** | `gmao_preventive_guides_v3` | `DataGateway.savePreventiveGuides` |
| **الخطط الوقائية (`preventivePlans`)** | `gmao_preventive_plans_v3` | `DataGateway.savePreventivePlans` |
