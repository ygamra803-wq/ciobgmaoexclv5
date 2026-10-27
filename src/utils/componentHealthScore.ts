export interface ComponentWearAnalysis {
  componentId: string;
  correctiveCount: number;
  recentBreakdowns6Months: number;
  preventiveCount: number;
  externalRepairCount: number;
  bobinageCount: number;
  correctiveCost: number;
  preventiveCost: number;
  externalCost: number;
  cumulativeRepairCost: number;
  replacementValue: number;
  costRatioPercent: number;
  wearScore: number; // 0 (critical) to 100 (new)
  statusLevel: 'OPTIMAL' | 'WATCH' | 'REFORM';
  shouldReform: boolean;
  reformReasons: string[];
  recommendation: string;
}

function normalizeStr(val: unknown): string {
  return String(val ?? '')
    .trim()
    .toUpperCase();
}

function estimateDefaultReplacementValue(component: any): number {
  const explicit = Number(
    component?.prix_achat ??
      component?.valeur_neuf ??
      component?.prix_unitaire ??
      component?.prix ??
      0
  );
  if (Number.isFinite(explicit) && explicit > 0) {
    return explicit;
  }

  const fam = normalizeStr(component?.id_family || component?.code || component?.designation);
  if (fam.includes('MOT')) return 950;
  if (fam.includes('RED')) return 1200;
  if (fam.includes('POM')) return 850;
  if (fam.includes('VER') || fam.includes('HYD')) return 750;
  if (fam.includes('VAR') || fam.includes('ELEC')) return 1100;
  return 800;
}

function parseDateSafe(raw: unknown): Date | null {
  if (!raw) return null;
  const d = new Date(String(raw));
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Evaluates a rotating component's cumulative repair cost (Corrective PDR + Preventive PDR + External/Bobinage)
 * against its new replacement value (BER — Beyond Economic Repair >= 70%) and 6-month failure frequency.
 */
export function evaluateComponentWearAndLifecycle(
  component: any,
  context: {
    correctiveInterventions?: any[];
    preventiveExecutions?: any[];
    sortiesExterne?: any[];
    stockItems?: any[];
    referenceDate?: Date;
  } = {}
): ComponentWearAnalysis {
  const {
    correctiveInterventions = [],
    preventiveExecutions = [],
    sortiesExterne = [],
    stockItems = [],
    referenceDate = new Date(),
  } = context;

  const itemId = normalizeStr(
    component?.id_warehouse_item || component?.id || component?.code || ''
  );
  const itemCode = normalizeStr(component?.code || component?.ref || '');
  const itemDesig = normalizeStr(
    component?.designation || component?.designation_part || component?.nom || ''
  );
  const itemMach = normalizeStr(
    component?.id_machine_registered || component?.id_machine || ''
  );

  // Build quick price lookup from stockItems
  const priceByRef = new Map<string, number>();
  for (const s of stockItems || []) {
    const r = normalizeStr(s?.ref || s?.code_article);
    const p = Number(s?.prix_unitaire ?? s?.prix_achat_ht ?? s?.prix ?? 0);
    if (r && Number.isFinite(p) && p > 0) {
      priceByRef.set(r, p);
    }
  }

  // 1. Match Corrective Interventions (exclude REJECTED)
  const linkedCorrective = (correctiveInterventions || []).filter((ci: any) => {
    if (ci?.validation_status === 'REJECTED') return false;
    const cId = normalizeStr(ci?.id_composant);
    const pId = normalizeStr(ci?.id_part);
    if (itemId && (cId === itemId || pId === itemId)) return true;
    if (itemCode && (cId === itemCode || pId === itemCode)) return true;
    const cName = normalizeStr(ci?.nom_composant || ci?.nom_part);
    const ciMach = normalizeStr(ci?.code_machine);
    return Boolean(itemDesig && cName === itemDesig && (!itemMach || ciMach === itemMach));
  });

  // 2. Match Preventive Executions (exclude REJECTED)
  const linkedPreventive = (preventiveExecutions || []).filter((pe: any) => {
    if (pe?.validation_status === 'REJECTED') return false;
    const cId = normalizeStr(pe?.id_composant);
    const pId = normalizeStr(pe?.id_part);
    if (itemId && (cId === itemId || pId === itemId)) return true;
    if (itemCode && (cId === itemCode || pId === itemCode)) return true;
    const peComp = normalizeStr(
      pe?.nom_composant || pe?.nom_part || pe?.organe || pe?.composant
    );
    const peMach = normalizeStr(pe?.machineCode || pe?.id_machine);
    return Boolean(itemDesig && peComp === itemDesig && (!itemMach || peMach === itemMach));
  });

  // 3. Match External Repairs (Sorties Externe)
  const linkedExterne = (sortiesExterne || []).filter((se: any) => {
    const sCompId = normalizeStr(
      se?.id_composant ||
        se?.code_composant ||
        se?.id_warehouse_item ||
        se?.code_moteur
    );
    if (itemId && sCompId === itemId) return true;
    if (itemCode && sCompId === itemCode) return true;
    const sDesig = normalizeStr(se?.designation || se?.nom_composant);
    return Boolean(itemDesig && sDesig === itemDesig);
  });

  // 4. Calculate Corrective Cost & 6-month breakdowns
  const sixMonthsAgo = new Date(referenceDate.getTime() - 180 * 24 * 60 * 60 * 1000);
  let correctiveCost = 0;
  let recentBreakdowns6Months = 0;

  for (const ci of linkedCorrective) {
    const explicitCost = Number(ci?.cout_pdr ?? ci?.cout_total ?? 0);
    if (Number.isFinite(explicitCost) && explicitCost > 0) {
      correctiveCost += explicitCost;
    } else {
      const pieces = Array.isArray(ci?.pieces_utilisees)
        ? ci.pieces_utilisees
        : Array.isArray(ci?.pieces_proposees)
        ? ci.pieces_proposees
        : [];
      for (const p of pieces) {
        const qty = Number(p?.quantite ?? p?.qty ?? 1);
        const unitPrice =
          Number(p?.prix_unitaire ?? p?.unitPrice ?? 0) ||
          priceByRef.get(normalizeStr(p?.ref || p?.reference)) ||
          25;
        correctiveCost += qty * unitPrice;
      }
    }

    const ciDate = parseDateSafe(ci?.date_fin || ci?.date_demande || ci?.demande_date || ci?.created_at);
    if (!ciDate || ciDate >= sixMonthsAgo) {
      recentBreakdowns6Months += 1;
    }
  }

  // 5. Calculate Preventive Cost
  let preventiveCost = 0;
  for (const pe of linkedPreventive) {
    const explicitCost = Number(pe?.totalCost ?? pe?.cout_total ?? 0);
    if (Number.isFinite(explicitCost) && explicitCost > 0) {
      preventiveCost += explicitCost;
    } else {
      const spares = Array.isArray(pe?.sparePartsUsed)
        ? pe.sparePartsUsed
        : Array.isArray(pe?.sparesUsed)
        ? pe.sparesUsed
        : [];
      for (const sp of spares) {
        const qty = Number(sp?.quantity ?? sp?.quantite ?? sp?.qty ?? 1);
        const unitPrice =
          Number(sp?.unitPrice ?? sp?.prix_unitaire ?? 0) ||
          priceByRef.get(normalizeStr(sp?.partCode || sp?.ref || sp?.reference)) ||
          15;
        preventiveCost += qty * unitPrice;
      }
    }
  }

  // 6. Calculate External / Bobinage Cost
  const bobinages = Array.isArray(component?.historique_bobinage)
    ? component.historique_bobinage
    : [];
  let externalCost = 0;

  for (const se of linkedExterne) {
    const c = Number(se?.cout_reparation ?? se?.cout ?? se?.montant ?? se?.prix ?? 220);
    externalCost += Number.isFinite(c) && c > 0 ? c : 220;
  }

  for (const bob of bobinages) {
    const c = Number(bob?.cout ?? bob?.cout_bobinage ?? bob?.montant ?? 240);
    externalCost += Number.isFinite(c) && c > 0 ? c : 240;
    const bDate = parseDateSafe(bob?.date_demontage || bob?.date_reception);
    if (bDate && bDate >= sixMonthsAgo) {
      recentBreakdowns6Months += 1;
    }
  }

  const bobinageCount = bobinages.length + linkedExterne.length;
  const cumulativeRepairCost = Math.round((correctiveCost + preventiveCost + externalCost) * 100) / 100;
  const replacementValue = estimateDefaultReplacementValue(component);
  const costRatioPercent =
    replacementValue > 0 ? Math.round((cumulativeRepairCost / replacementValue) * 100) : 0;

  const reformReasons: string[] = [];
  if (costRatioPercent >= 70) {
    reformReasons.push(
      `Coût cumulé (${cumulativeRepairCost.toFixed(0)} DT) atteint ${costRatioPercent}% de la valeur à neuf (${replacementValue.toFixed(0)} DT) [Seuil BER ≥ 70%]`
    );
  }
  if (recentBreakdowns6Months >= 3) {
    reformReasons.push(`${recentBreakdowns6Months} défaillances / pannes sur les 6 derniers mois`);
  }
  if (bobinageCount >= 3) {
    reformReasons.push(`${bobinageCount} rebobinages / révisions externes cumulés`);
  }

  const shouldReform = reformReasons.length > 0;
  const isWatch =
    !shouldReform &&
    (costRatioPercent >= 45 || recentBreakdowns6Months === 2 || bobinageCount === 2);

  const statusLevel: 'OPTIMAL' | 'WATCH' | 'REFORM' = shouldReform
    ? 'REFORM'
    : isWatch
    ? 'WATCH'
    : 'OPTIMAL';

  // Compute 0-100 health score
  const costPenalty = Math.min(60, Math.round(costRatioPercent * 0.65));
  const failurePenalty = Math.min(35, recentBreakdowns6Months * 12 + bobinageCount * 10);
  const wearScore = Math.max(5, Math.min(100, 100 - costPenalty - failurePenalty));

  const recommendation = shouldReform
    ? 'Réparation non économique — Recommandation : À réformer (Remplacement conseillé)'
    : isWatch
    ? 'Surveillance accrue — Usure modérée (Planifier organe de réserve)'
    : 'Bon état technico-économique — Maintenir le cycle préventif standard';

  return {
    componentId: itemId || itemCode,
    correctiveCount: linkedCorrective.length,
    recentBreakdowns6Months,
    preventiveCount: linkedPreventive.length,
    externalRepairCount: linkedExterne.length,
    bobinageCount,
    correctiveCost,
    preventiveCost,
    externalCost,
    cumulativeRepairCost,
    replacementValue,
    costRatioPercent,
    wearScore,
    statusLevel,
    shouldReform,
    reformReasons,
    recommendation,
  };
}
