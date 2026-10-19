/**
 * Preventive Scheduling Domain Functions
 */

export function calculateNextDueDate(lastDate, frequency = 'WEEKLY') {
  const base = lastDate instanceof Date ? new Date(lastDate) : new Date(lastDate || Date.now());
  if (isNaN(base.getTime())) {
    return new Date();
  }

  const next = new Date(base.getTime());
  const freqUpper = String(frequency).toUpperCase();

  switch (freqUpper) {
    case 'DAILY':
    case 'JOURNALIER':
      next.setDate(next.getDate() + 1);
      break;
    case 'WEEKLY':
    case 'HEBDO':
    case 'HEBDOMADAIRE':
      next.setDate(next.getDate() + 7);
      break;
    case 'BIWEEKLY':
    case 'QUINZAINE':
      next.setDate(next.getDate() + 14);
      break;
    case 'MONTHLY':
    case 'MENSUEL':
      next.setMonth(next.getMonth() + 1);
      break;
    case 'QUARTERLY':
    case 'TRIMESTRIEL':
      next.setMonth(next.getMonth() + 3);
      break;
    case 'SEMIANNUAL':
    case 'SEMESTRIEL':
      next.setMonth(next.getMonth() + 6);
      break;
    case 'ANNUAL':
    case 'ANNUEL':
      next.setFullYear(next.getFullYear() + 1);
      break;
    default:
      next.setDate(next.getDate() + 7);
  }

  return next;
}

export function getComplianceRate(completed = 0, scheduled = 0) {
  const sched = Number(scheduled) || 0;
  const comp = Number(completed) || 0;
  if (sched <= 0) return 100;
  return Math.min(100, Math.max(0, Math.round((comp / sched) * 100)));
}
