export class CorrectiveCalculationService {
  static calculateWorkingTime(dDebut: string, hDebut: string, dFin: string, hFin: string) {
    try {
      const start = new Date(`${dDebut}T${hDebut || '08:00'}:00`);
      const end = new Date(`${dFin}T${hFin || '17:00'}:00`);
      const diffMs = Math.max(0, end.getTime() - start.getTime());
      const minutes = Math.round(diffMs / (1000 * 60)) || 60;
      const hrs = Math.floor(minutes / 60);
      const mins = minutes % 60;
      const formatted = hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
      return {
        minutes,
        formatted,
        dureeMinutes: minutes,
        dureeHeures: (minutes / 60).toFixed(1),
      };
    } catch {
      return {
        minutes: 60,
        formatted: '1h 0m',
        dureeMinutes: 60,
        dureeHeures: '1.0',
      };
    }
  }

  static computeKpis(interventions: any[] = []) {
    const list = interventions || [];
    const total = list.length;
    const clotures = list.filter((i) => i.statut === 'CLOTURE').length;
    const enCours = list.filter((i) => i.statut === 'EN_COURS').length;
    let totalDowntimeMinutes = 0;
    for (const i of list) {
      totalDowntimeMinutes += Number(i.temps_intervention_mins || i.temps_arret_minutes || i.dureeMinutes || 0);
    }
    const mttr = clotures > 0 ? (totalDowntimeMinutes / clotures).toFixed(1) : '0';
    return {
      totalInterventions: total,
      cloturesCount: clotures,
      enCoursCount: enCours,
      totalDowntimeMinutes,
      mttrMinutes: mttr,
      tauxResolution: total > 0 ? Math.round((clotures / total) * 100) : 100,
    };
  }

  static computePareto(interventions: any[] = [], field: string) {
    const counts: Record<string, number> = {};
    for (const item of interventions || []) {
      const val = item[field] || item.panne || item.machine || 'AUTRE';
      counts[val] = (counts[val] || 0) + 1;
    }
    const sorted = Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    const total = sorted.reduce((sum, item) => sum + item.count, 0);
    let cumulative = 0;
    return sorted.map((item) => {
      cumulative += item.count;
      return {
        ...item,
        percentage: total > 0 ? Math.round((item.count / total) * 100) : 0,
        cumulativePercentage: total > 0 ? Math.round((cumulative / total) * 100) : 0,
      };
    });
  }

  static detectPreventiveRecommendations(interventions: any[] = []) {
    const freq: Record<string, number> = {};
    for (const item of interventions || []) {
      const mId = item.code_machine || item.id_machine_registered || item.machine;
      if (mId) freq[mId] = (freq[mId] || 0) + 1;
    }
    return Object.entries(freq)
      .filter(([_, count]) => count >= 3)
      .map(([machine, count]) => ({
        machine,
        repetitionCount: count,
        recommendation: `Créer une inspection préventive renforcée sur ${machine} suite à ${count} pannes récentes.`,
      }));
  }
}

export default CorrectiveCalculationService;
