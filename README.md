# 🏭 CIOB GMAO Nexus v5.0.2 (`ciobGMAO-nexusV5.0.2`) — Industrial Maintenance, Asset & Inventory Platform

[![Version](https://img.shields.io/badge/version-5.0.2-047857.svg)](./CHANGELOG.md)
[![Release](https://img.shields.io/badge/release-ciobGMAO--nexusV5.0.2-0f766e.svg)](./CHANGELOG.md)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Contributor Covenant](https://img.shields.io/badge/Contributor%20Covenant-2.1-4baaaa.svg)](./CODE_OF_CONDUCT.md)
[![Security Policy](https://img.shields.io/badge/Security-LAN%20Fail--Closed-b91c1c.svg)](./SECURITY.md)

منظومة صناعية متكاملة لإدارة الصيانة (الوقائية بالزمن والعدادات، والتصحيحية)، الأصول الصناعية ومخططاتها المعرفية (`Blueprints`)، مخزون قطع الغيار (`PDR`)، أوامر الشراء والتموين (`PO`)، مستودع المكونات الدوارة (`Entrepôt / Bobinage`)، الرقابة المالية، وحوكمة الاعتماد والتدقيق المؤسسي، مصممة للعمل الفوري بدون إنترنت (**Offline-First PWA**) أو عبر شبكة المصنع المحلية (**LAN Multi-Postes Host**).

---

## 🧭 البوابة السريعة للتوثيق الهندسي والحوكمة

| الوثيقة | الغرض |
| :--- | :--- |
| **[`AGENTS.md`](./AGENTS.md)** | **البوابة الإلزامية الأولى** للمطورين ووكلاء الذكاء الاصطناعي (القواعد التسع غير القابلة للتفاوض). |
| **[`ARCHITECTURE.md`](./ARCHITECTURE.md)** | الملخص المعماري التنفيذي، الفلسفة الثلاثية للأصول والـ `Blueprint`، وسجل القرارات (`ADR-01` إلى `ADR-12`). |
| **[`CAPABILITIES_AND_STRENGTHS.md`](./CAPABILITIES_AND_STRENGTHS.md)** | سجل القدرات الهندسية الـ 17 المنفذة بالكود والاختبارات الآلية (`Vitest`). |
| **[`docs/DATA_SSOT.md`](./docs/DATA_SSOT.md)** | جدول مفاتيح التخزين القياسية (`STORAGE_KEYS` — 36+ كياناً) والعلاقات المرجعية (`FK`). |
| **[`DOCS_INDEX.md`](./DOCS_INDEX.md)** | الفهرس الكامل لوثائق المشروع ومواصفات الشاشات (`docs/*_VIEW.md`). |
| **[`CHANGELOG.md`](./CHANGELOG.md)** | سجل الإصدارات والترقيات (`5.0.2` / `ciobGMAO-nexusV5.0.2` ← `4.2.0` ← `4.0.0`). |
| **[`CONTRIBUTING.md`](./CONTRIBUTING.md)** | دليل المساهمة القياسي، نظام الوسوم (`Git Tags/Releases`)، ومعايير الدمج والاختبار. |
| **[`SECURITY.md`](./SECURITY.md)** | سياسة الأمان، الإبلاغ المسؤول عن الثغرات، وضوابط خادم `LAN` والمصادقة. |
| **[`CODE_OF_CONDUCT.md`](./CODE_OF_CONDUCT.md)** | ميثاق السلوك المهني للمساهمين (`Contributor Covenant v2.1`). |
| **[`LICENSE`](./LICENSE)** | الترخيص القانوني المعتمد للمشروع (**MIT License**). |

---

## 🏛️ الفلسفة الصناعية الثلاثية للأصول والمخطط المعرفي (`3-Tier Asset & Cognitive Blueprint Philosophy`)

ينفرِد **CIOB GMAO Nexus (v5.0.2)** بفصل هندسي صارم يمنع الخلط بين التصنيف النظري، الواقع الفيزيائي في الورشة، والذاكرة المعرفية المتراكمة:

1. **المستوى الأول — العائلة والقالب (`Family & Template`):**
   - التصنيف الهندسي العام (`Family`) وبطاقة المواصفات القياسية للطراز (`Template`: القدرة، السرعة، الصانع، الموديل).
2. **المستوى الثاني — الآلة المسجلة (`Machine Registered` — الأصل الفيزيائي في الورشة):**
   - المعدة الحقيقية العاملة في المصنع (`gmao_machines_v2`).
   - **تمتلك حصرياً:** موقعها الجغرافي الفعلي (`Zone`)، الفني المسؤول عنها (`Technician`)، عداد ساعات تشغيلها الحي (`compteur_actuel` / `meterReadings`)، ومكوناتها وأجزاءها المركبة فعلياً (`machineElementsLedger` / `Entrepôt`).
   - تدعم اختيارياً **التجميع التشغيلي للخطوط (`Rôle Opérationnel: MACHINE | LINE`)** عبر `parent_id` لتجميع مؤشرات التوقف والتكلفة وباريتو لخط الإنتاج دون المساس باستقلالية المنطقة أو القالب لكل آلة.
3. **المستوى الثالث — المخطط المعرفي (`Blueprint` — البصمة الهندسية والذاكرة المتراكمة):**
   - كيان معرفي افتراضي (`gmao_blueprints_v2`) يرتبط بالقالب والآلات المسجلة.
   - يتعلم ويتطور باستمرار مع كل عطل تصحيحي أو صيانة وقائية أو تركيب قطعة في `Nexus`، فيراكم شجرة الـ `BOM` النظرية (`components_theoriques`, `parts_theoriques`, `pdr_theoriques`)، خطط الوقائي المعيارية، والأعطال الشائعة.
   - **قاعدة ذهبية:** الـ `Blueprint` افتراضي؛ لا يمتلك أبداً منطقة جغرافية (`Zone`) ولا فنياً مسؤولاً (`Technician`).

---

## ⚙️ الركائز الهندسية والقدرات الرئيسية

1. **مصدر حقيقة واحد (`SSOT`) وصفر حقن صامت للبذور:**
   - تُدار الحالة عبر `useGmaoStore.ts` وتُحفظ عبر `DataGateway.ts` ومفاتيح `STORAGE_KEYS`.
   - حالة المصنع الفارغ (`0` سجلات و`START_MODE === 'empty'`) مصونة بالكامل ولا تعيد حقن أي بيانات تجريبية عند تحديث الصفحة (`F5`).
2. **معادلة المخزون الحتمية ومحرك التموين (`PO`):**
   - `stockActuel = stockInitial + entrées − sorties` عبر `IncrementalStockIndex.ts` بتعقيد $O(1)$.
   - محرك أوامر الشراء (`ReplenishmentOrder`: `BROUILLON ➔ COMMANDE ➔ RECEPTION_PARTIELLE ➔ RECU_CONFORME`) يولد تلقائياً حركات `Entrée` عند الاستلام دون المساس بكود محرك الحساب.
3. **الصيانة الوقائية المزدوجة (الزمن + العدادات):**
   - مصفوفة 52 أسبوعاً (`CALENDRIER`) + صيانة شرطية بالعدادات (`COMPTEUR` / `HYBRIDE`: ساعات، دورات، كيلومتر) عبر `MeterService.ts` مع جولة قراءة سريعة للورشة وسجل تنفيذ تاريخي غير قابل للطمس (`PreventiveExecution`).
4. **الصيانة التصحيحية وجواز السفر الفني 360° (`Machine Passport 360°`):**
   - آلة حالة محدودة صارمة (`WorkOrderStateMachine`: `DEMANDE ➔ EN_COURS / EN_ATTENTE_PDR ➔ CLOTURE`) مع صرف متعدد القطع (`Multi-PDR`).
   - جواز سفر فني 360° لكل آلة يعرض درجة الصحة (`Health Score`)، التكلفة الشاملة (`TCO`)، تنبيهات تكرار أعطال الأعضاء (`BER Alerts`)، وسجل العدادات والتدخلات.
5. **حوكمة الاعتماد (`Maker-Checker`) وسجل التدقيق المؤسسي (`Append-Only Audit Ledger`):**
   - أعمال الفنيين الميدانيين تخضع لاعتماد المشرف في `ValidationCenterView` قبل الخصم الفعلي من المخزون.
   - سجل تدقيق غير قابل للتعديل أو الحذف (`STORAGE_KEYS.AUDIT_EVENTS`) يوثق القيم قبل وبعد (`before / after`) لكل عملية حرجة (تعديل مخزون افتتاحي/سعر، أرشفة آلة، اعتماد/رفض، أوامر شراء، وتعديلات الميزانية المالية).
6. **مضيف الشبكة المحلية (`LAN Host`) والأمان (`RBAC`):**
   - خادم `server.ts` يدعم المزامنة متعددة الأجهزة عبر الشبكة المحلية بكتابة ذرية متسلسلة (`writeQueue`)، فحص تعارض الإصدارات (`HTTP 409`)، وحماية صارمة (`X-GMAO-API-TOKEN` + `serverRbacPolicy.ts`).

---

## 🚀 التشغيل السريع والتحقق الآلي

```bash
# 1. تثبيت الحزم
npm install

# 2. تشغيل بيئة التطوير (المنفذ 3000)
npm run dev

# 3. تشغيل حزمة الاختبارات الآلية الشاملة (Vitest)
npx vitest run

# 4. فحص سلامة الكود والبناء الإنتاجي
npm run typecheck
npm run lint
npm run build
```

---

## 🏷️ توحيد الإصدار وإصدارات Git (`Versioning & Release Tagging`)

- **الإصدار المعتمد:** `5.0.2` (وفق معيار **SemVer 2.0.0**)
- **معرّف الإصدار الرسمي:** `ciobGMAO-nexusV5.0.2`
- **اسم الحزمة في `package.json`:** `ciobgmao-nexus`
- **أتمتة الإطلاق:** دفع أي وسم يطابق `ciobGMAO-nexusV*` أو `v*.*.*` يشغّل تلقائياً خط أنابيب [`.github/workflows/release.yml`](./.github/workflows/release.yml) للتحقق من المطابقة والاختبارات وإنشاء GitHub Release وحزم البناء.

