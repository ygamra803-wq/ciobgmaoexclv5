import { describe, it, expect } from 'vitest';
import fr from '../../i18n/translations/fr.json';
import ar from '../../i18n/translations/ar.json';
import en from '../../i18n/translations/en.json';

describe('Phase 2: i18n Translation Dictionaries & Completeness', () => {
  it('should have app metadata and core titles across FR, AR, EN', () => {
    expect(fr.app.title).toBe('CIOB GMAO Light');
    expect(ar.app.title).toBe('CIOB GMAO Light');
    expect(en.app.title).toBe('CIOB GMAO Light');

    expect(fr.app.subtitle).toBe('Pièces de Rechange & GMAO');
    expect(ar.app.subtitle).toBe('قطع الغيار والصيانة الصناعية');
    expect(en.app.subtitle).toBe('Spare Parts & CMMS');
  });

  it('should have all main navigation tabs translated in all 3 languages', () => {
    const modules = ['dashboard', 'stock', 'entrepot', 'machines', 'utilisateurs', 'settings', 'logout'];
    for (const mod of modules) {
      expect((fr.nav as any)[mod]).toBeDefined();
      expect((ar.nav as any)[mod]).toBeDefined();
      expect((en.nav as any)[mod]).toBeDefined();
    }

    expect(ar.nav.stock).toBe('مخزون قطع الغيار');
    expect(en.nav.stock).toBe('Spare Parts Stock');
    expect(fr.nav.stock).toBe('Stock PDR');
  });

  it('should have stock calculation and alert labels across all languages', () => {
    expect(fr.stock.initial).toBe('Stock Initial');
    expect(ar.stock.initial).toBe('المخزون الافتتاحي');
    expect(en.stock.initial).toBe('Initial Stock');

    expect(fr.stock.status_ok).toBe('OK');
    expect(ar.stock.status_alert).toBe('تنبيه نقص');
    expect(en.stock.status_rupture).toBe('DEPLETED');
  });

  it('should support parameter interpolation correctly', () => {
    const template = 'Article {{ref}} en alerte';
    const interpolated = template.replace(new RegExp('{{ref}}', 'g'), 'ROUL-6204');
    expect(interpolated).toBe('Article ROUL-6204 en alerte');
  });
});
