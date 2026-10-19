import fc from 'fast-check';
import { describe, it, expect } from 'vitest';
import { IncrementalStockIndex } from '../application/IncrementalStockIndex';

const refArb = fc.constantFrom('PDR-001', 'PDR-002', 'PDR-003');
const typeArb = fc.constantFrom(
  'Entrée',
  'entree',
  'ENTREE',
  'Sortie',
  'sortie',
  'SORTIE',
  'Commande',
  'Réception',
  'Consommation',
  'Retour atelier'
);
const qtyArb = fc.integer({ min: 1, max: 1000 });
const mvtArb = fc.record({ ref: refArb, type: typeArb, quantity: qtyArb });
const REFS = ['PDR-001', 'PDR-002', 'PDR-003'];

const extractMathTotals = (t: { entrees: number; sorties: number; commandes: number }) => ({
  entrees: t.entrees,
  sorties: t.sorties,
  commandes: t.commandes,
});

describe('IncrementalStockIndex — Invariants', () => {
  it('P1: applyDelta incremental ≡ rebuild (final state)', () => {
    fc.assert(
      fc.property(fc.array(mvtArb, { maxLength: 500 }), (mvs) => {
        const viaRebuild = new IncrementalStockIndex();
        viaRebuild.rebuild(mvs);
        const viaDelta = new IncrementalStockIndex();
        for (const m of mvs) viaDelta.applyDelta(m);
        for (const ref of REFS) {
          expect(extractMathTotals(viaDelta.getTotals(ref))).toEqual(extractMathTotals(viaRebuild.getTotals(ref)));
        }
      }),
      { numRuns: 200 }
    );
  });

  it('P2: apply → rollback restores exact prior state', () => {
    fc.assert(
      fc.property(mvtArb, (m) => {
        const idx = new IncrementalStockIndex();
        const before = idx.getTotals(m.ref);
        idx.applyDelta(m);
        idx.rollbackDelta(m);
        expect(extractMathTotals(idx.getTotals(m.ref))).toEqual(extractMathTotals(before));
      })
    );
  });

  it('P3: updateDelta(a→b) ≡ rollback(a) then apply(b)', () => {
    fc.assert(
      fc.property(mvtArb, mvtArb, (a, b) => {
        const ref = 'PDR-001';
        const x = new IncrementalStockIndex();
        x.applyDelta({ ...a, ref });
        x.updateDelta({
          ref,
          oldType: a.type,
          oldQty: a.quantity,
          newType: b.type,
          newQty: b.quantity,
        });

        const y = new IncrementalStockIndex();
        y.applyDelta({ ...a, ref });
        y.rollbackDelta({ ...a, ref });
        y.applyDelta({ ...b, ref });

        expect(extractMathTotals(x.getTotals(ref))).toEqual(extractMathTotals(y.getTotals(ref)));
      })
    );
  });

  it('P4: stock is never negative, regardless of movements', () => {
    fc.assert(
      fc.property(
        fc.array(mvtArb, { maxLength: 300 }),
        fc.integer({ min: 0, max: 100 }),
        (mvs, initial) => {
          const idx = new IncrementalStockIndex();
          idx.rebuild(mvs);
          expect(idx.calculateCurrentStock('PDR-001', initial)).toBeGreaterThanOrEqual(0);
        }
      )
    );
  });
});
