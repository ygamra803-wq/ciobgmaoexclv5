# ⚙️ توثيق الإعدادات، المزامنة الشبكية `LAN`، وسجل التدقيق المؤسسي (`SETTINGS_BACKUP.md`)

يوثق هذا الملف المعمارية التقنية لوحدة **الإعدادات (`SettingsView.tsx`)** ووحداتها الفرعية العشر (`src/presentation/pages/settings/components/`).

---

## 🏛️ 1. الوحدات الفرعية لصفحة الإعدادات

تم تفكيك `SettingsView.tsx` إلى مكونات معيارية متخصصة:
1. **`SettingsLanSyncSection.tsx`:** إدارة وضع الجهاز على الشبكة المحلية (`HOST` مقابل `LAN_CLIENT`)، عرض عنوان المضيف ورمز `QR Code`، ومراقبة اتصال البث الحي (`SSE`).
2. **`SettingsServerSyncSection.tsx`:** المزامنة الصريحة (`Push / Pull`) مع ملف الحالة المركزي على الخادم (`data/gmao_state.json`) ومعالجة تعارض الإصدارات (`HTTP 409 Conflict` عبر `ServerSyncConflictModal.tsx`).
3. **`SettingsExcelTwinSection.tsx`:** تصدير واستيراد مصنفات الإكسل (`.xlsx`) وتحميل القالب الفارغ (`excelEngineService.ts`) ومزامنة المرآة المحلية (`excelMirrorService.ts`).
4. **`SettingsDataInjectionSection.tsx`:**
   - تحميل بيانات الديمو صراحةً (`DataGateway.loadDemoData` / `loadDemoSection`).
   - التصفير الشامل للمصنع الحقيقي (`DataGateway.clearAllForRealFactory`) الذي يضبط `START_MODE = 'empty'` ويصفر جميع الكيانات الـ 36+ بحيث تبقى `0` بعد تحديث الصفحة (`F5`).
5. **`SettingsAuditTrailSection.tsx`:** استعراض وفلترة وتصدير **سجل التدقيق المؤسسي غير القابل للطمس (`Append-Only Audit Ledger — STORAGE_KEYS.AUDIT_EVENTS`)** ومزامنته مع سجل الخادم (`GET /api/gmao/audit`).
6. **`SettingsIntegritySection.tsx`:** فحص نزاهة العلاقات المرجعية واكتشاف السجلات اليتيمة (`dataIntegrityService.ts`).
7. **`SettingsAppearanceSection.tsx` & `SettingsRegionalCurrencySection.tsx`:** تخصيص المظهر، كثافة الجداول، وإعدادات العملة (`CURRENCY_CONFIG`).

---

## 🔐 2. الحماية، الصلاحيات (`RBAC`)، وسجل التدقيق (`Audit Ledger`)

1. **سياسة الصلاحيات (`Fail-Closed RBAC`):**
   - تُطبق على مستوى الواجهة (`AuthorizationService.tsx`) وعلى مستوى الخادم (`src/core/security/serverRbacPolicy.ts`).
   - دور `VIEWER` ممنوع من أي كتابة (`HTTP 403`).
   - الأدوار الميدانية (`TECHNICIEN / OPERATEUR`) مسموح لها بتسجيل العمليات الميدانية فقط (`correctiveInterventions`, `preventiveExecutions`, `meterReadings`, `sortieDemands`)، وممنوعة من تعديل المخزون مباشرة أو تزوير أوامر الشراء (`replenishmentOrders`) أو تعديل سجل التدقيق (`auditEvents`).
2. **سجل التدقيق المؤسسي (`STORAGE_KEYS.AUDIT_EVENTS`):**
   - يوثق تلقائياً كل عملية حرجة (`STOCK_INITIAL_CHANGED`, `STOCK_PRICE_CHANGED`, `MACHINE_ARCHIVED`, `MACHINE_RESTORED`, `VALIDATION_APPROVED`, `VALIDATION_REJECTED`, `PO_CREATED`, `PO_RECEIVED`, `PO_CANCELLED`, `BUDGET_UPDATED`) بالقيم قبل وبعد (`before / after`) وهوية الفاعل والطابع الزمني.
