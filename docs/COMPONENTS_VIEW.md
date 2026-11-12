# ⚙️ توثيق الهرم المزدوج للأعضاء الدوارة والأجزاء الميكانيكية (`COMPONENTS_VIEW.md`)
## نظام CIOB GMAO v4

يوثق هذا الملف المعمارية التقنية والفلسفة الصناعية لصفحات **المرجعيات الهرمية للأعضاء الدوارة (`Components`) والأجزاء الميكانيكية (`Parts`)** داخل قسم المستودع (`Entrepôt`)، وكيف تنفصلان تماماً في التخزين والدلالة عن مخزن قطع الغيار الاستهلاكية (`PDR`).

---

## 🏛️ 1. الفلسفة الصناعية: لماذا نفصل بين `Components` و`Parts` و`PDR`؟

| المحور | 1. الأعضاء الدوارة (`Components`) | 2. الأجزاء الميكانيكية (`Parts`) | 3. قطع الغيار الاستهلاكية (`PDR`) |
| :--- | :--- | :--- | :--- |
| **مفتاح المجموعة الأب (`SSOT`)** | `gmao_comp_groups_v2` | `gmao_part_groups_v1` | `gmao_pdr_groups_v1` |
| **شاشة المستوى الأول** | `CompGroupView.tsx` (`#comp_groups`) | `PartGroupView.tsx` (`#part_groups`) | `PdrGroupView.tsx` (`#pdr_groups`) |
| **السلسلة الهرمية** | **4 مستويات:**<br>`CompGroup ➔ CompFamily ➔ CompTemplate ➔ Entrepôt` | **4 مستويات توأم:**<br>`PartGroup ➔ PartType ➔ PartDesignation ➔ Entrepôt` | **3 مستويات:**<br>`PdrGroup ➔ StockType ➔ StockItem (SKU)` |
| **الطبيعة الفيزيائية** | وحدات كهروميكانيكية متكاملة تدور بين الخدمة واللف والاحتياط (محركات، مضخات، مخفضات، مغيرات سرعة). | أجزاء بنيوية وميكانيكية قابلة للخراطة والتجليخ وتوطين الأعطال (أعمدة، تروس، فلنجات، هياكل). | مستهلكات قياسية تُشترى وتُخصم بالكمية (رولمانات، سيور، فلاتر، موانع تسرب، زيوت). |
| **سياسة الصيانة الافتراضية** | `REPAIRABLE` / `REPLACING` | `REPAIRABLE` / `MODIFYING` / `REPLACING` | `REPLACING` |

---

## 🌲 2. الهرم المزدوج رباعي المستويات في المستودع (`Dual 4-Tier Entrepôt Taxonomy`)

```text
   مسار الأعضاء الدوارة (Components)                    مسار الأجزاء الميكانيكية (Parts)
   ─────────────────────────────────                    ────────────────────────────────
   1. Groupes d'Organes (CompGroupView)                 1. Groupes de Pièces (PartGroupView)
                 ▼                                                    ▼
   2. Familles d'Organes (CompFamilyView)               2. Types de Pièces (PartTypeView)
                 ▼                                                    ▼
   3. Modèles / Templates (CompTemplateView)            3. Désignations Pièces (PartDesignationView)
                 ▼                                                    ▼
   4. Entrepôt (nature: 'COMPONENT')                    4. Entrepôt (nature: 'PART')
```

### أ) شاشات مسار الأعضاء الدوارة (`Components` — الحقول الهندسية `C2`):
1. **مجموعات الأعضاء (`CompGroupView.tsx` — `#comp_groups`):** التصنيفات العليا (`MOTEUR`, `REDUCTEUR`, `POMPE`, `VARIATEUR`) مع وسوم السياسة الافتراضية.
2. **عائلات الأعضاء (`CompFamilyView.tsx` — `#comp_families`):** العائلات الوظيفية (`MOT-3PH`, `MOT-SERVO`, `PMP-HYD`) المرتبطة بالمجموعة عبر `getGroupId`.
3. **قوالب وموديلات الأعضاء (`CompTemplateView.tsx` — `#comp_templates`):** بطاقة المواصفات القياسية المزودة بحقول **لوحة المحرك/العضو (`C2`)**:
   - `mode_reparation_defaut`: سياسة الإصلاح الافتراضية (`BOBINAGE`, `REVISION_INTERNE`, `ECHANGE_STANDARD`, `SOUS_TRAITANCE_EXTERNE`, `REMPLACEMENT_NEUF`).
   - `puissance` (`kW`), `vitesse` (`tr/min`), `tension_nominale` (`V`), `courant_nominal_a` (`A`), `indice_protection` (`IP55`/`IP65`), `type_fixation` (`B3`/`B5`/`B14`/`B35`).

### ب) شاشات مسار الأجزاء الميكانيكية (`Parts` — الحقول الهندسية `C3`):
1. **مجموعات الأجزاء (`PartGroupView.tsx` — `#part_groups`):** شاشة مرجعية مستقلة تدير المجموعات الخمس القياسية (`GRP-PART-01` إلى `GRP-PART-05`) مع فلتر المجال التقني (`domaine_technique`) والتعطيل الآمن (`is_active: false`) عند ارتباطها بأنواع نشطة.
2. **أنواع الأجزاء (`PartTypeView.tsx` — `#part_types`):** تصنيفات الأجزاء (`ARBRE`, `ENGRENAGE`, `FLASQUE`, `CARTER`) المربوطة بمجموعة الأب عبر `id_group` مع فلتر شلالي وخيار `Non classé`.
3. **تسميات الأجزاء (`PartDesignationView.tsx` — `#part_designations`):** السجل الهندسي التفصيلي المزود بـ **رباعية الورشة الميكانيكية (`C3`)**:
   - `matiere_nuance`: سبيكة المعدن أو الخامة (`42CrMo4`, `C45`, `Bronze CuSn12`, `Inox 316L`).
   - `ref_plan`: رقم المخطط الهندسي (`PLN-ARB-014`).
   - `dimensions_brut`: أبعاد القطعة الخام (`Ø85 x 420 mm`) لأوامر التصنيع (`BR`).
   - `traitement_thermique`: المعالجة الحرارية أو السطحية (`Trempe + Revenu 58 HRC`, `Cémentation`, `Nitruration`).

---

## 💾 3. معمارية البذور ومفاتيح التخزين القياسية (`Dedicated Clean Seed Standard`)

```text
/src/data/warehouse/seedCompGroups.json        ➔ STORAGE_KEYS.COMP_GROUPS       (gmao_comp_groups_v2)
/src/data/warehouse/seedCompFamilies.json      ➔ STORAGE_KEYS.COMP_FAMILIES     (gmao_comp_families_v3)
/src/data/warehouse/seedCompTemplates.json     ➔ STORAGE_KEYS.COMP_TEMPLATES    (gmao_comp_templates_v3)
/src/data/warehouse/seedPartGroups.json        ➔ STORAGE_KEYS.PART_GROUPS       (gmao_part_groups_v1)
/src/data/warehouse/seedPartTypes.json         ➔ STORAGE_KEYS.PART_TYPES        (gmao_part_types_v2)
/src/data/warehouse/seedPartDesignations.json  ➔ STORAGE_KEYS.PART_DESIGNATIONS (gmao_part_designations_v2)
```
