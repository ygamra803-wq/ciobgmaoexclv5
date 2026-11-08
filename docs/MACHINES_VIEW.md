# 🏭 توثيق منظومة الأصول، سجل الآلات، والـ `Blueprint` المعرفي (`MACHINES_VIEW.md`)

يوثق هذا الملف المعمارية والفلسفة الصناعية لصفحة **سجل الآلات (`MachinesRegisteredView.tsx`)** والصفحات التابعة لها (**العائلات `FamilyView.tsx`**, **القوالب `TemplatesView.tsx`**, **المخططات المعرفية `BlueprintMachineView.tsx`**, و**جواز السفر الفني الشامل `MachinePassport360Modal.tsx`**).

---

## 🏛️ 1. الفلسفة الصناعية الثلاثية للأصول (`3-Tier Asset & Cognitive Blueprint Philosophy`)

يفصل النظام بشكل صارم بين ثلاثة مستويات لمنع الخلط بين التصنيف القياسي، المعدة المادية في الورشة، والذاكرة المعرفية المتراكمة:

1. **المستوى الأول — العائلة والقالب (`Family & Template`):**
   - **العائلة (`Family` — `gmao_families_v2`):** التصنيف الهندسي العام للمعدات (مثال: `Détourage`, `Presse Hydraulique`, `Compresseur`).
   - **القالب (`Template` — `gmao_templates_v2`):** الطراز القياسي للصانع والمواصفات الفنية العامة (القدرة بالكيلوواط، السرعة، الأبعاد).
2. **المستوى الثاني — الآلة المسجلة (`Machine Registered` — الأصل الفيزيائي في الورشة):**
   - هي الماكينة الحقيقية العاملة على أرض المصنع (`gmao_machines_v2`).
   - **فصل صارم بين آلات الإنتاج (`PRODUCTION`) ومعدات النظام العام (`SYSTEM_GENERAL`):**
     - **آلات الإنتاج (`PRODUCTION`):** تُنشأ وتُعدّل في شاشة `MachinesRegisteredView.tsx` (`#machines`) وترتبط وجوبياً بـ `Family` و`Template` و`Blueprint`.
     - **معدات النظام العام والمرافق (`SYSTEM_GENERAL`):** تُعرَض في `MachinesRegisteredView.tsx` للمتابعة الشاملة للأسطول وجواز الـ 360° فقط، بينما يتم إنشاؤها وتعديلها وإدارة أنواعها (`GENERAL_SYSTEM_TYPES`) حصرياً في صفحتها المستقلة **`EquipmentView.tsx` (`#equipment`)** ضمن مجموعة `Pilotage` (انظر [`docs/EQUIPEMENTS_VIEW.md`](./EQUIPEMENTS_VIEW.md)).
   - **المالك الحصري للواقع الفيزيائي:** تمتلك وحدها منطقتها الجغرافية الفعلية (`id_zone_default`)، الفني المسؤول عنها (`technician`)، عداد ساعات تشغيلها الحي (`compteur_actuel` / `meterReadings`)، والمكونات والأجزاء المركبة عليها فعلياً في `Nexus / machineElementsLedger`.
   - **التجميع التشغيلي الاختياري للخطوط (`Rôle Opérationnel: MACHINE | LINE`):** يمكن تحديد الدور التشغيلي لآلة الإنتاج كـ `MACHINE` أو `LINE` وربطها اختيارياً بخط إنتاج أو آلة أم (`parent_id`) عبر `src/utils/assetHierarchy.ts` لتجميع مؤشرات التوقف والتكلفة وباريتو للخط، مع احتفاظ كل آلة بمنطقتها وقالبها ومخططها المستقل تماماً.
3. **المستوى الثالث — المخطط المعرفي (`Blueprint` — البصمة الهندسية الافتراضية):**
   - كيان معرفي افتراضي (`gmao_blueprints_v2`) يرتبط بالقالب والآلة.
   - يتعلم ويتطور تراكمياً مع كل عملية إصلاح تصحيحي أو صيانة وقائية أو ربط في `Nexus`، فيحفظ شجرة الـ `BOM` النظرية (`components_theoriques`, `parts_theoriques`, `pdr_theoriques`)، خطط الوقائي المعيارية، والأعطال الشائعة.
   - **قاعدة ذهبية:** الـ `Blueprint` افتراضي بحت؛ لا يمتلك أبداً منطقة جغرافية (`Zone`) ولا فنياً مسؤولاً (`Technician`).

---

## 📊 2. بنية سجل الآلة المسجلة (`Machine Registered Schema`)

| الحقل البرمجي | النوع | الوصف والربط المرجعي |
| :--- | :---: | :--- |
| `id_machine_registered` | `String` | الرمز الفريد للآلة في المصنع (`DET-01`, `PRH-01`). |
| `designation` | `String` | التسمية التفصيلية للآلة أو الخط الإنتاجي. |
| `id_family` | `String` | المعرف المرجعي لعائلة الآلة (`families.id_family`). |
| `id_templates` | `String` | المعرف المرجعي لقالب/طراز الآلة (`templates.id_templates`). |
| `id_blueprint` | `String` | المعرف المرجعي للبصمة المعرفية (`blueprints.id_blueprint`). |
| `id_zone_default` | `String` | المنطقة الصناعية الفعلية للآلة (`zones.id_zone`). |
| `technician` | `String` | الفني الرئيسي المسؤول عن الآلة (`users` / `technicians`). |
| `status` | `String` | الحالة التشغيلية (`En Service`, `En Maintenance`, `Arrêt`, `ARCHIVEE`). |
| `asset_level` | `'MACHINE' \| 'LINE'` | الدور التشغيلي (آلة إنتاج/نظام عام أو خط إنتاج تجميعي). |
| `parent_id` | `String \| null` | معرف الخط الأب أو الآلة الأم (اختياري للتجميع التشغيلي فقط، مع منع الحلقات الدائرية). |
| `compteur_actuel` | `Number` | القراءة الحالية لعداد الآلة (ساعات، دورات، كيلومتر). |
| `unite_compteur` | `String` | وحدة قياس العداد (`HEURES`, `CYCLES`, `KM`). |

---

## 🛡️ 3. جواز السفر الفني الشامل 360° (`MachinePassport360Modal.tsx`)

من داخل جدول `MachinesRegisteredView.tsx`، يفتح زر **Passeport 360°** بطاقة الفحص الشاملة للآلة المحسوبة عبر `MachineHealthPassportService.ts`:
1. **مؤشر الصحة الشامل (`Health Score / 100`)** وتكلفة الملكية الشاملة (`TCO = Correctif PDR + Préventif + Bobinage Externe`).
2. **تنبيهات تكرار أعطال الأعضاء (`Recurrent Organ Failure / BER Alerts`)** عند تعطل نفس العضو 3 مرات أو أكثر.
3. **سجل قراءات العدادات (`meterReadings`)** والفوارق التراكمية ($\Delta$).
4. **السجل التاريخي الموحد** لأوامر العمل التصحيحية (`BT`) والتنفيذات الوقائية المؤرخة (`PreventiveExecution`).
