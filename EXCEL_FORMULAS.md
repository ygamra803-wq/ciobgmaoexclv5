# توثيق شامل لمعادلات وقواعد حساب Excel في CIOB GMAO

يقدم هذا الملف مرجعاً رياضياً وهندسياً دقيقاً لكافة المعادلات والصيغ الحسابية المستخدمة في نظام **CIOB GMAO Light UI Excel**، والمطابقة تماماً لملف القالب المرجعي `GMAO_Light_Template_V2_Formules.xlsx`.

---

## 1. معادلات ورقة المخزون (Feuille Stock_Actuel)

### أ. حساب إجمالي الإدخالات (Entrées - Column F)
- **صيغة Excel:**
  ```excel
  =SUMIFS(Mouvements!D:D, Mouvements!C:C, [@Ref], Mouvements!E:E, "Entrée")
  ```
  *(في الصيغة الفرنسية: `=SOMME.SI.ENS(Mouvements!D:D; Mouvements!C:C; [@Ref]; Mouvements!E:E; "Entrée")`)*
- **التطبيق في React/JavaScript:**
  ```javascript
  const entrees = mouvements
    .filter(m => m.ref === item.ref && (m.type === 'Entrée' || m.type === 'Entree'))
    .reduce((sum, m) => sum + (Number(m.quantite) || 0), 0);
  ```

---

### ب. حساب إجمالي الإخراجات والصرف (Sorties - Column G)
- **صيغة Excel:**
  ```excel
  =SUMIFS(Mouvements!D:D, Mouvements!C:C, [@Ref], Mouvements!E:E, "Sortie")
  ```
  *(في الصيغة الفرنسية: `=SOMME.SI.ENS(Mouvements!D:D; Mouvements!C:C; [@Ref]; Mouvements!E:E; "Sortie")`)*
- **التطبيق في React/JavaScript:**
  ```javascript
  const sorties = mouvements
    .filter(m => m.ref === item.ref && m.type === 'Sortie')
    .reduce((sum, m) => sum + (Number(m.quantite) || 0), 0);
  ```

---

### ج. حساب المخزون الفعلي الحالي (Stock Actuel - Column H)
- **صيغة Excel:**
  ```excel
  =[@[Stock Initial]] + [@[Entrées]] - [@[Sorties]]
  ```
  *(أو بصيغة الخلايا: `=E2 + F2 - G2`)*
- **التطبيق في React/JavaScript:**
  ```javascript
  const stockActuel = Number(item.stockInitial) + entrees - sorties;
  ```

---

### د. حساب حالة التنبيه والنفاد (Alerte - Column J)
- **صيغة Excel:**
  ```excel
  =IF([@[Stock Actuel]] <= 0, "RUPTURE", IF([@[Stock Actuel]] <= [@[Seuil]], "ALERTE", "OK"))
  ```
  *(في الصيغة الفرنسية: `=SI([@[Stock Actuel]]<=0; "RUPTURE"; SI([@[Stock Actuel]]<=[@[Seuil]]; "ALERTE"; "OK"))`)*
- **التطبيق في React/JavaScript:**
  ```javascript
  let alerte = 'OK';
  if (stockActuel <= 0) {
    alerte = 'RUPTURE';
  } else if (stockActuel <= seuil) {
    alerte = 'ALERTE';
  }
  ```

---

## 2. معادلات التوليد التلقائي للمعرفات (Auto-Increment ID Formulas)

### أ. توليد كود الفني الجديد (Technician ID)
- **صيغة Excel:**
  ```excel
  ="TECH-" & TEXT(COUNTA(Technicians!A:A) + 1, "00")
  ```
- **التطبيق في React/JavaScript:**
  ```javascript
  const nextId = `TECH-${String(technicians.length + 1).padStart(2, '0')}`;
  ```

---

### ب. توليد كود العملية الجديدة (Operation ID)
- **صيغة Excel:**
  ```excel
  ="OP-" & TEXT(COUNTA(Operations!A:A) + 1, "00")
  ```
- **التطبيق في React/JavaScript:**
  ```javascript
  const nextId = `OP-${String(operations.length + 1).padStart(2, '0')}`;
  ```

---

## 3. مؤشرات الأداء الحسابية (Dashboard KPI Formulas)

| المؤشر | معادلة Excel المقابلة | الشرح |
| :--- | :--- | :--- |
| **Total Articles** | `=COUNTA(Stock_Actuel!A2:A1000)` | إجمالي عدد قطع الغيار والمقالات المسجلة |
| **Total Stock Phys.** | `=SUM(Stock_Actuel!H2:H1000)` | إجمالي عدد الوحدات الفيزيائية الموجودة في المخزن |
| **Articles en Rupture** | `=COUNTIF(Stock_Actuel!J2:J1000, "RUPTURE")` | عدد المواد التي نفد رصيدها (<= 0) |
| **Articles en Alerte** | `=COUNTIF(Stock_Actuel!J2:J1000, "ALERTE")` | عدد المواد التي اقترب رصيدها من حد الطلب (<= Seuil) |
| **Total Mouvements** | `=COUNTA(Mouvements!A2:A5000)` | إجمالي عدد حركات الإدخال والإخراج المسجلة |
| **Machines Actives** | `=COUNTIF(Machines_Registered!G:G, "En service")` | عدد الآلات في حالة عمل وتشغيل مستمر |

---

## 4. شجرة العلاقات الهرمية (Relational Lookups & XLOOKUP Equivalents)

```text
[Stock_Actuel]
   ├── id_type ───> [Types] (id_type, designation, color_badge)
   └── id_diag ───> [Diagnostics] (id_diag, id_type, symptome, gravite)

[Machines_Registered]
   ├── id_family ────> [Families] (id_family, nom_famille)
   ├── id_templates ─> [Templates] (id_templates, id_family, constructeur)
   └── id_zone ──────> [Zones] (id_zone, nom_zone, responsable)

[Mouvements]
   ├── ref ──────────────────> [Stock_Actuel] (Ref, Designation, Emplacement)
   ├── id_zone ──────────────> [Zones] (id_zone, nom_zone)
   ├── id_machine_registered ─> [Machines_Registered] (id_machine_registered)
   ├── technicien ───────────> [Technicians] (id_technician, nom)
   └── operation ────────────> [Operations] (id_operation, designation)
```
