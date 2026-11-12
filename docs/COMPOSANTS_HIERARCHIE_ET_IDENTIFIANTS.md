# ⚙️ المعمارية الهرمية للمكونات وفلسفة الترقيم الثلاثي (ID / CODE / REF)

يقدم هذا المستند المرجع الفني والهندسي الشامل للنظام المعتمد في **CIOB GMAO Light UI Excel** لهيكلة وتصنيف المكونات الصناعية (Composants Industriels) وفلسفة التمييز الصارمة بين المعرفات الثلاثية (`ID`, `CODE`, `REF`).

---

## 🏛️ 1. فلسفة الثلاثية المعيارية (`ID` مقابل `CODE` مقابل `REF`)

في إدارة الصيانة والمخازن الصناعية (GMAO / CMMS)، يؤدي الخلط بين الأرقام والمعرفات إلى أخطاء فادحة في جرد المخزون، أوامر الشراء، وربط حركات الصيانة. يفصل النظام بين هذه المفاهيم هندسياً كالتالي:

```
┌─────────────────┬───────────────────────────────────┬──────────────────────────────────────────┐
│ الحقل (Champ)   │ المعنى والهدف                     │ مثال واقعي (محرك 4kW Siemens)            │
├─────────────────┼───────────────────────────────────┼──────────────────────────────────────────┤
│ 1. ID           │ الهوية الرقمية الثابتة للنظام      │ GRP-MOTEUR-001                           │
│ (Passport ID)   │ (System Primary Key)              │ FAM-MOT-3PH-001                          │
│                 │ فريد 100%، لا يتغير، للربط البرمجي │ TPL-MOT-3PH-40KW-1430-001                │
├─────────────────┼───────────────────────────────────┼──────────────────────────────────────────┤
│ 2. CODE         │ الكود البشري المختصر للمصنع       │ MOTEUR                                   │
│ (Code Maison)   │ (Internal Plant Code)             │ MOT-3PH                                  │
│                 │ سهل النطق، يكتب على اللوحات وفي   │ MOT-3PH-40KW-1430                        │
│                 │ أوامر الشغل، يقرأه التقني بالعين │                                          │
├─────────────────┼───────────────────────────────────┼──────────────────────────────────────────┤
│ 3. REF          │ مرجع المصنّع الأصلي للمعدّة       │ Siemens 1LA7083-4AA                      │
│ (Ref Fabricant) │ (Manufacturer Part Number / P/N)  │ ABB M2BAX-132SMA                         │
│                 │ خاص بالكتالوجات، الطلبيات مع المورد│ SEW DRS71S4                              │
│                 │ والمواصفات الميكانيكية/الكهربائية │                                          │
└─────────────────┴───────────────────────────────────┴──────────────────────────────────────────┘
```

### القيمة العملية للفصل بينها:
1. **التقني في الميدان (Sur le Terrain):** يحتاج إلى **`CODE`** سريع ومقروء مثل `MOT-3PH-40KW-1430` ليعرف فوراً أنه محرك ثلاثي الأطوار باستطاعة 4 كيلوواط وسرعة 1430 دورة في الدقيقة دون الحاجة لتفكيك المحرك.
2. **مصلحة المشتريات والمخزن (Achats / Magasin):** تحتاج إلى **`REF`** المصنّع الرسمي (`Siemens 1LA7083-4AA`) لطلب القطعة المطابقة هندسياً من الموردين من حيث أبعاد التثبيت (B3/B5 Flasque) ومواصفات العزل.
3. **قاعدة البيانات والتتبع التاريخي (Audit & Traceability):** تعتمد كلياً على **`ID`** الدائم، مما يضمن بقاء سجلات أوامر الشغل وحركات المخزن سليمة حتى لو تم تعديل الاسم أو الكود التجاري لاحقاً.

---

## 🌲 2. الهيكلية الهرمية للمكونات (Architecture 4 Niveaux)

تم تصميم هرم المكونات ليعكس بدقة نفس نظام **الماكينات (Zone $\rightarrow$ Type Machine $\rightarrow$ Machine $\rightarrow$ Organe)**، محققاً انسجاماً معمارياً تاماً في كافة أرجاء النظام:

```
[ Niveau 1 : GROUPE COMPOSANT ]
  │   (MOTEUR, REDUCTEUR, POMPE, VARIATEUR...)
  │
  └───► [ Niveau 2 : FAMILLE COMPOSANT ]
          │   (Moteur Triphasé, Monophasé, Synchrone, Servo...)
          │
          └───► [ Niveau 3 : TEMPLATE / MODÈLE ]
                  │   (Moteur Triphasé 4.0KW 1430 tr/min B3)
                  │
                  └───► [ Niveau 4 : STOCK ENTREPÔT (Élément Réel) ]
                          (القطعة المادية برقم السيريال والموقع في الرف A-01-03)
```

---

## 🔍 3. تفصيل المستويات الأربعة مع الأمثلة الصناعية

### 🔷 المستوى 1: Groupe Composant (المجموعة الكبرى)
* **الشاشة المسؤولة:** `CompGroupView.tsx` (المسار: `src/presentation/pages/referentiel/CompGroupView.tsx`)
* **المفهوم:** الصنف التكنولوجي العام للمكون الصناعي.
* **الهدف:** منع تكدس عشرات العائلات في قائمة مسطحة واحدة وتوفير تجميع منطقي عالي المستوى.
* **أمثلة في النظام الأساسي:**
  * `GRP-MOTEUR-001` | كود: **`MOTEUR`** | محركات ومحركات تحريك كهربائية
  * `GRP-REDUCTEUR-001` | كود: **`REDUCTEUR`** | مخفضات سرعة وعلب تروس ميكانيكية
  * `GRP-POMPE-001` | كود: **`POMPE`** | مضخات هيدروليكية وطرد مركزي
  * `GRP-VARIATEUR-001` | كود: **`VARIATEUR`** | مغيرات سرعة ودرايفرات تحكم

---

### 🔶 المستوى 2: Famille Composant (العائلة التقنية)
* **الشاشة المسؤولة:** `CompFamilyView.tsx` (المسار: `src/presentation/pages/referentiel/CompFamilyView.tsx`)
* **المفهوم:** التكنولوجيا الدقيقة أو مبدأ التشغيل الفيزيائي داخل المجموعة الواحدة.
* **الهدف:** توحيد الخصائص المشتركة لمجموعة فرعية مع ربطها بالمجموعة الأب (`id_groupe`).
* **أمثلة تابعة لمجموعة `MOTEUR`:**
  * `FAM-MOT-3PH-001` | كود: **`MOT-3PH`** | محرك ثلاثي الأطوار (Triphasé 380V/400V)
  * `FAM-MOT-1PH-001` | كود: **`MOT-1PH`** | محرك أحادي الطور (Monophasé 220V)
  * `FAM-MOT-ASYNC-001` | كود: **`MOT-ASYNC`** | محرك تحريضي غير متزامن
  * `FAM-MOT-SYNC-001` | كود: **`MOT-SYNC`** | محرك متزامن بمغناطيس دائم
  * `FAM-MOT-SERVO-001` | كود: **`MOT-SERVO`** | سيرفو موتور تحكم دقيق بمحاور CNC
  * `FAM-MOT-DC-001` | كود: **`MOT-DC`** | محرك تيار مستمر

---

### 🔮 المستوى 3: Template Composant (النموذج القياسي / بطاقة المواصفات ولوحة البيانات `C2`)
* **الشاشة المسؤولة:** `CompTemplateView.tsx` (المسار: `src/presentation/pages/referentiel/CompTemplateView.tsx`)
* **المفهوم:** بطاقة المواصفات الفنية المعيارية ولوحة بيانات المحرك/العضو (`Nameplate Specs`) وسياسة إصلاحه الافتراضية.
* **الحقول الهندسية القياسية (`C2`):**
  * `mode_reparation_defaut`: سياسة الإصلاح الافتراضية (`BOBINAGE`, `REVISION_INTERNE`, `ECHANGE_STANDARD`, `SOUS_TRAITANCE_EXTERNE`, `REMPLACEMENT_NEUF`).
  * `puissance` (`kW`)، `vitesse` (`tr/min`)، `tension_nominale` (`V`)، `courant_nominal_a` (`A`)، `indice_protection` (`IP55`, `IP65`)، `type_fixation` (`B3`, `B5`, `B14`, `B35`).
* **أمثلة تابعة لعائلة `MOT-3PH`:**
  * **النموذج الأول:**
    * الكود: `MOT-3PH-40KW-1430` | المرجع المصنّع: `Siemens 1LA7083-4AA`
    * لوحة البيانات: `4.0KW` • `1430 tr/min` • `380V` • `8.8A` • `IP55` • `B3` • `BOBINAGE`
  * **النموذج الثاني:**
    * الكود: `MOT-3PH-75KW-2910` | المرجع المصنّع: `ABB M2BAX-132SMA`
    * لوحة البيانات: `7.5KW` • `2910 tr/min` • `380V` • `14.2A` • `IP55` • `B3` • `BOBINAGE`

---

### 🟢 المستوى 4: Stock Entrepôt (القطعة المادية الحقيقية في الرف)
* **الشاشة المسؤولة:** `EntrepotView.tsx` (المسار: `src/presentation/pages/warehouse/EntrepotView.tsx`)
* **المفهوم:** المحرك أو المكون الفعلي الملموس الموجود على رفوف المستودع أو المركب على الآلة.
* **الخصائص الخاصة به:**
  * الرقم التسلسلي الفردي (`N° de Série`).
  * موقع التخزين في المستودع (مثال: `Rayon A-02, Étagère 3`).
  * الحالة الفنية للقطعة (`Actif`, `En réserve`, `En bobinage`, `Réformé`).

---

## ⚡ 4. التفاعل والتنقل الذكي وتوحيد قراءة معرف المجموعة (`getGroupId`)

1. **الفلاتر المتسلسلة الشلالية (`Cascading Filters`):**
   * عند فتح شاشة **Templates** واختيار مجموعة `MOTEUR` (Niv 1)، يتم تصفية قائمة العائلات (Niv 2) لتقتصر حصراً على عائلات المحركات، وتختفي عائلات المضخات والمخفضات لتجنب الأخطاء.
2. **القراءة الموحدة لمعرف المجموعة (`getGroupId` & `getGroupRecordId`):**
   * لضمان التوافق التام بين السجلات التي تحمل `id_group` أو `id_groupe`، تستخدم جميع الشاشات الدالتين الموحدتين `getGroupId(record)` و`getGroupRecordId(group)` من `src/domain/stock/pdrHierarchyService.ts`.
3. **الهرم التوأم للأجزاء الميكانيكية (`Parts 4-Level Hierarchy`) وعزل مخزن `PDR`:**
   * بالتوازي مع هرم الأعضاء الدوارة (`Components`)، يمتلك قسم الأجزاء الميكانيكية هرمه الرباعي المستقل (`PartGroup ➔ PartType ➔ PartDesignation ➔ Entrepôt` عبر `PartGroupView.tsx` — `#part_groups`)، بينما يمتلك مخزن قطع الغيار الاستهلاكية هرمه الثلاثي المستقل (`PdrGroup ➔ StockType ➔ StockItem SKU` عبر `PdrGroupView.tsx` — `#pdr_groups`).

---

## 💾 5. التخزين ومفاتيح الحفظ المحلي المعزولة (`Isolated Persistence Schema`)

| الكيان | مفتاح التخزين في `STORAGE_KEYS` | الشاشة المرجعية | آلية الإدارة والحفظ |
| :--- | :--- | :--- | :--- |
| **Groupes d'Organes (`CompGroup`)** | `gmao_comp_groups_v2` | `CompGroupView.tsx` (`#comp_groups`) | `DataGateway.saveCompGroups` + `useGmaoStore.ts` |
| **Familles d'Organes (`CompFamily`)** | `gmao_comp_families_v3` | `CompFamilyView.tsx` (`#comp_families`) | `DataGateway.saveCompFamilies` + `useGmaoStore.ts` |
| **Modèles / Templates (`CompTemplate`)** | `gmao_comp_templates_v3` | `CompTemplateView.tsx` (`#comp_templates`) | `DataGateway.saveCompTemplates` + `useGmaoStore.ts` |
| **Groupes de Pièces (`PartGroup`)** | `gmao_part_groups_v1` | `PartGroupView.tsx` (`#part_groups`) | `DataGateway.savePartGroups` + `useGmaoStore.ts` |
| **Types de Pièces (`PartType`)** | `gmao_part_types_v2` | `PartTypeView.tsx` (`#part_types`) | `DataGateway.savePartTypes` + `useGmaoStore.ts` |
| **Désignations Pièces (`PartDesignation`)**| `gmao_part_designations_v2` | `PartDesignationView.tsx` (`#part_designations`)| `DataGateway.savePartDesignations` + `useGmaoStore.ts` |
| **Groupes PDR (`PdrGroup`)** | `gmao_pdr_groups_v1` | `PdrGroupView.tsx` (`#pdr_groups`) | `DataGateway.savePdrGroups` + `useGmaoStore.ts` |
| **Entrepôt Stock (`WarehouseItem`)** | `gmao_warehouse_items_v3` | `EntrepotView.tsx` (`#entrepot`) | `DataGateway.saveWarehouseItems` + `useGmaoStore.ts` |

---

*تم إعداد هذا التوثيق ليكون دليلاً معمارياً دائماً يضمن اتساق تصنيف المكونات والأجزاء وقطع الغيار وجودة إدخال البيانات في مصانع الإنتاج.*
