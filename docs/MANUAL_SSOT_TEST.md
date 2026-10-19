# 🧪 بروتوكول الاختبار اليدوي الخماسي لوحدة المصدر المرجعي (SSOT Manual Verification Protocol)

يوثق هذا الدليل خطوات التحقق اليدوي من عدم حدوث أي تعارض أو انبعاث تلقائي لبيانات الديمو بعد عمليات التصفير الشامل (`Clear`) أو إعادة التعيين (`Reset`) أو تحميل الديمو (`Demo`)، وضمان أن جميع عمليات الكتابة تمر حصرياً عبر `DataGateway.ts` باتجاه المفاتيح المرجعية (Canonical `STORAGE_KEYS`).

---

## 🎯 الهدف الهندسي
التأكد من أن:
1. جميع عمليات الكتابة والتفريغ والتحميل تمر عبر مسار أحادي (`DataGateway.ts`).
2. بعد تنفيذ التصفير الشامل لمصنع حقيقي (`clearAllForRealFactory`)، يتم تثبيت الرايات:
   - `gmao_demo_data_loaded_v1` (`DEMO_MODE`) = `false`
   - `gmao_start_mode` (`START_MODE`) = `'empty'`
   - إزالة اللقطة المجمعة `gmao_full_state_v1` (`FULL_STATE_SNAPSHOT`)
   - كتابة مصفوفات فارغة `[]` (أو كائنات `{}`) صراحةً في كافة المفاتيح المرجعية (Canonical Keys).
3. عند الضغط على `F5` (تحديث الصفحة بالكامل)، لا يتم تفعيل أي سقوط احتياطي (`allowDemoFallback`) ولا تعود بذور الديمو للظهور.

---

## 📋 خطوات الاختبار الخمس (5-Step Verification Procedure)

### الخطوة 1: البدء بوضع نظيف فارغ (`START_MODE = empty`)
1. افتح أدوات المطور في المتصفح (`F12` -> `Application` -> `Local Storage`).
2. نفّذ الأمر التالي في وحدة التحكم (`Console`) أو من شاشة **الإعدادات -> حقن البيانات (Injection) -> تصفير شامل (Mode Usine Réelle)**:
   ```js
   localStorage.clear();
   localStorage.setItem('gmao_demo_data_loaded_v1', 'false');
   localStorage.setItem('gmao_start_mode', 'empty');
   location.reload();
   ```
3. **التحقق المتوقع:**
   - قيمة `gmao_demo_data_loaded_v1` تساوي `'false'`.
   - قيمة `gmao_start_mode` تساوي `'empty'`.
   - جميع الجداول (الآلات، المخزون، المهام الوقائية، التدخلات التصحيحية) تعرض `0` سجل (`[]`).

---

### الخطوة 2: تحميل بيانات الديمو (`loadDemoData`)
1. انتقل إلى **Paramètres (الإعدادات) -> Injection & Réinitialisation**.
2. اضغط على زر **Injecter toutes les données Démo (تحميل بيانات الديمو)** (الذي يستدعي `DataGateway.loadDemoData`).
3. **التحقق المتوقع:**
   - تتغير قيمة `gmao_demo_data_loaded_v1` إلى `'true'`.
   - تتغير قيمة `gmao_start_mode` إلى `'demo'`.
   - تمتلئ المفاتيح المرجعية (`gmao_machines_v2`, `gmao_raw_stock_v8`, `gmao_preventive_tasks_v9`, إلخ) ببيانات المصنع التجريبية.

---

### الخطوة 3: التصفير الشامل لمصنع حقيقي (`clearAllForRealFactory`)
1. من نفس شاشة الإعدادات، اضغط على زر **Tout Effacer / Mode Usine Réelle** (الذي يستدعي `DataGateway.clearAllForRealFactory`).
2. **التحقق المتوقع:**
   - يتم ضبط `gmao_demo_data_loaded_v1` = `'false'` و `gmao_start_mode` = `'empty'`.
   - يتم حذف `gmao_full_state_v1` (`FULL_STATE_SNAPSHOT`).
   - تُكتب القيمة `"[]"` صراحةً في كافة المفاتيح المرجعية وعلى رأسها `gmao_preventive_tasks_v9` و `gmao_machines_v2` و `gmao_raw_stock_v8`.

---

### الخطوة 4: إضافة 3 مهام وقائية جديدة يدوياً
1. انتقل إلى قسم **Planning & Matrice Préventive** (أو **Ingénierie & Référentiel Préventif**).
2. أضف **3 مهام وقائية جديدة** يدوياً عبر واجهة التطبيق.
3. افتح `Local Storage` وتحقق من المفتاح المرجعي `gmao_preventive_tasks_v9`.
4. **التحقق المتوقع:**
   - يحتوي المفتاح `gmao_preventive_tasks_v9` على مصفوفة JSON تضم **3 مهام بالضبط** (`length === 3`).
   - تظل بقية المفاتيح التي لم يُضف إليها شيء فارغة `[]`.

---

### الخطوة 5: تحديث الصفحة بالكامل (`F5`) والتحقق من الثبات (Persistence Check)
1. اضغط على مفتاح **`F5`** (أو زر إعادة تحميل المتصفح).
2. **التحقق المتوقع:**
   - تبقى **المهام الوقائية الثلاث فقط** التي أُنشئت في الخطوة 4 ظاهرة في الجدول وفي `gmao_preventive_tasks_v9`.
   - **لا تنبعث** أي بذور ديمو في المهام الوقائية أو المخزون أو الآلات.
   - تظل رايات `DEMO_MODE = false` و `START_MODE = 'empty'` ثابتة دون تغيير.

---

## ☁️ اختبار المزامنة الصريحة مع الخادم (`gmao_state.json`)
1. اضغط على كبسولة **Sync Serveur** في الشريط العلوي (`Header`) أو انتقل إلى **Paramètres -> Performance & Sync**.
2. اضغط على زر **«حفظ على الخادم» (Push JSON)**:
   - يتم إرسال الحالة الحالية إلى `POST /api/gmao/state` وتحديث طابع آخر مزامنة.
3. عدّل بيانات محلية ثم اضغط على **«استعادة من الخادم» (Pull JSON)**:
   - إذا وُجد اختلاف بين المتصفح والخادم، تظهر نافذة **تعارض في مزامنة البيانات (`ServerSyncConflictModal`)** بمقارنة كمية وزمنية واضحة تتيح لك الاختيار بين:
     - **فرض الحفظ المحلي على الخادم (Écraser le serveur)**
     - **استعادة بيانات الخادم وتحديث المتصفح (Écraser mes données)**
     - **إلغاء الأمر (Annuler)**
