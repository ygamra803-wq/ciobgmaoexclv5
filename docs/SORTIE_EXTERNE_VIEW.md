# 🛠️ توثيق أوامر الإنجاز بالورشة الميكانيكية والصرف الخارجي (`SORTIE_EXTERNE_VIEW.md`)

يوثق هذا الملف المعمارية والفلسفة الصناعية لتبويب وخدمة **أوامر الإنجاز بالورشة الميكانيكية والمقاولة الخارجية (`SortieExterneBobinageTab.tsx` + `SortieExterneService.ts`)** المرتبطة بالمفتاح الموحد `STORAGE_KEYS.SORTIE_EXTERNE` وبأوامر العمل التصحيحية (`BT`).

---

## 🏛️ 1. الفلسفة الصناعية المزدوجة (`CORRECTIVE-ATELIER-P0`)

في الواقع الصناعي للمصنع، عندما يتعطل عضو أو قطعة ميكانيكية/كهربائية ولا تتوفر قطعة بديلة جاهزة للتركيب الفوري، يتفرع العمل إلى مسارين متكاملين يديرهما `SortieExterneService.ts` بتوافق عكسي كامل:

1. **المسار الأول — الورشة الميكانيكية الداخلية (`ATELIER_MECANIQUE`):**
   - **الترقيم القياسي:** كود داخلي `BON-ATEL-001` ورقم بون `BA-YYYY-xxx`.
   - **طبيعة الأعمال (`nature_travail`):**
     - خراطة وتجليخ (`Usinage / Rectification`).
     - خراطة عمود أو محور (`Tournage arbre / axe`).
     - تلحيم وتعبئة معدنية (`Soudure / Rechargement`).
     - تصنيع قطعة حسب الطلب (`Confection pièce sur mesure`).
     - مراجعة ميكانيكية وتجويف (`Révision mécanique / Alésage`).
   - **الحالة الابتدائية:** `'En cours atelier'`.
2. **المسار الثاني — المقاولة الخارجية وإعادة لف المحركات (`SOUS_TRAITANCE_EXTERNE`):**
   - **الترقيم القياسي:** كود داخلي `SORT-EXT-001` ورقم بون `BS-YYYY-xxx`.
   - **طبيعة الأعمال:** لفّ كامل للمحركات (`Bobinage complet`)، تغيير رولمانات وعزل، إصلاح مغير سرعة أو بطاقة إلكترونية لدى مورد خارجي.
   - **الحالة الابتدائية:** `'En réparation externe'`.

---

## 🔄 2. دورة الحياة والربط الصارم مع الصيانة التصحيحية (`BT Bridge & Closure Guard`)

```text
[ En cours atelier / En réparation externe ]  ──(حارس FSM يمنع إغلاق الـ BT الأب)
                     │
                     ▼ (handleMarkSortieReturned)
              [ Retourné OK ]                 ──(تحديث cout_atelier وفك حظر إغلاق الـ BT)
                     │
                     ▼ (handleMarkSortieMounted)
                 [ Monté ]                    ──(تحديث حالة العضو في المستودع إلى Actif على الآلة)
```

1. **الربط التلقائي بأمر العمل (`id_corrective`):**
   - عند إنشاء أو تحديث أي بون ورشة أو مقاولة خارجية مرتبط برقم `BT` (`id_corrective`)، يقوم `syncCorrectiveInterventionsWithSortieRecord` في `useGmaoStore.ts` بمزامنة الحقول التالية على أمر العمل الأب فوراً:
     - `id_sortie_atelier` و`code_sortie_atelier`
     - `cout_atelier` و`cout_total = cout_pdr + cout_atelier`
     - `nature_travail_atelier` و`prestataire_atelier`
2. **منع الإغلاق المبكر لأمر العمل (`WorkOrderStateMachine` Guard):**
   - طالما أن `SortieExterneService.isWorkshopOrderOpen(etat)` يُرجع `true`، يرفض النظام إغلاق الـ `BT` (`CLOTURE`) سواء عبر الإغلاق المباشر أو عبر اعتماد `Maker-Checker`، ويبقى الـ `BT` في حالة انتظار (`EN_ATTENTE_PDR`) حتى يتم استلام القطعة/العضو (`Retourné OK`) أو تركيبه (`Monté`).
