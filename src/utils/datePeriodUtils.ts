/**
 * Utility functions for Date, Period, and Month calculations across CIOB GMAO v4
 */

export interface PeriodFilterState {
  preset: 'ALL' | 'THIS_MONTH' | 'LAST_MONTH' | 'THIS_QUARTER' | 'THIS_YEAR' | 'CUSTOM_MONTH' | 'CUSTOM_RANGE';
  selectedMonth?: string; // 'YYYY-MM'
  startDate?: string;    // 'YYYY-MM-DD'
  endDate?: string;      // 'YYYY-MM-DD'
}

/**
 * Normalizes any date string or object to YYYY-MM-DD
 */
export function normalizeDateToYMD(dateInput: unknown): string | null {
  if (!dateInput) return null;
  if (typeof dateInput === 'string') {
    const trimmed = dateInput.trim();
    // Handles 'YYYY-MM-DD...'
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
      return trimmed.slice(0, 10);
    }
    // Handles 'DD/MM/YYYY...'
    const frMatch = trimmed.match(/^(\d{2})[/-](\d{2})[/-](\d{4})/);
    if (frMatch) {
      return `${frMatch[3]}-${frMatch[2]}-${frMatch[1]}`;
    }
    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString().split('T')[0];
    }
  } else if (dateInput instanceof Date && !Number.isNaN(dateInput.getTime())) {
    return dateInput.toISOString().split('T')[0];
  }
  return null;
}

/**
 * Extracts YYYY-MM from date string
 */
export function getMonthFromDate(dateInput: unknown): string {
  const ymd = normalizeDateToYMD(dateInput);
  if (ymd) return ymd.slice(0, 7);
  return new Date().toISOString().slice(0, 7);
}

/**
 * Calculates start and end YYYY-MM-DD boundaries for a given period preset
 */
export function getPeriodBoundaries(filter: PeriodFilterState): { start: string | null; end: string | null } {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-indexed

  switch (filter.preset) {
    case 'THIS_MONTH': {
      const start = new Date(Date.UTC(currentYear, currentMonth, 1)).toISOString().split('T')[0];
      const end = new Date(Date.UTC(currentYear, currentMonth + 1, 0)).toISOString().split('T')[0];
      return { start, end };
    }
    case 'LAST_MONTH': {
      const start = new Date(Date.UTC(currentYear, currentMonth - 1, 1)).toISOString().split('T')[0];
      const end = new Date(Date.UTC(currentYear, currentMonth, 0)).toISOString().split('T')[0];
      return { start, end };
    }
    case 'THIS_QUARTER': {
      const quarterStartMonth = Math.floor(currentMonth / 3) * 3;
      const start = new Date(Date.UTC(currentYear, quarterStartMonth, 1)).toISOString().split('T')[0];
      const end = new Date(Date.UTC(currentYear, quarterStartMonth + 3, 0)).toISOString().split('T')[0];
      return { start, end };
    }
    case 'THIS_YEAR': {
      const start = `${currentYear}-01-01`;
      const end = `${currentYear}-12-31`;
      return { start, end };
    }
    case 'CUSTOM_MONTH': {
      if (!filter.selectedMonth || !/^\d{4}-\d{2}$/.test(filter.selectedMonth)) {
        return { start: null, end: null };
      }
      const [y, m] = filter.selectedMonth.split('-').map(Number);
      const start = new Date(Date.UTC(y, m - 1, 1)).toISOString().split('T')[0];
      const end = new Date(Date.UTC(y, m, 0)).toISOString().split('T')[0];
      return { start, end };
    }
    case 'CUSTOM_RANGE': {
      return {
        start: filter.startDate ? normalizeDateToYMD(filter.startDate) : null,
        end: filter.endDate ? normalizeDateToYMD(filter.endDate) : null,
      };
    }
    case 'ALL':
    default:
      return { start: null, end: null };
  }
}

/**
 * Checks if a given item's date falls within the period filter
 */
export function isDateInPeriod(dateInput: unknown, filter: PeriodFilterState): boolean {
  if (filter.preset === 'ALL') return true;
  const itemDate = normalizeDateToYMD(dateInput);
  if (!itemDate) return false;

  const { start, end } = getPeriodBoundaries(filter);
  if (start && itemDate < start) return false;
  if (end && itemDate > end) return false;
  return true;
}

/**
 * Generates an array of available months (e.g. ['2026-10', '2026-09', ...]) based on actual data
 */
export function extractAvailableMonths(dates: (string | null | undefined)[]): string[] {
  const set = new Set<string>();
  // Always include current month and previous month
  const now = new Date();
  set.add(now.toISOString().slice(0, 7));
  const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  set.add(prevMonth.toISOString().slice(0, 7));

  dates.forEach((d) => {
    const ymd = normalizeDateToYMD(d);
    if (ymd) {
      set.add(ymd.slice(0, 7));
    }
  });

  return Array.from(set).sort((a, b) => b.localeCompare(a));
}
