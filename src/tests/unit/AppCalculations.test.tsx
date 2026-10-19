import { describe, it, expect } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import {
  useAppCalculations,
  selectStockItems,
  selectEffectiveDesignations,
  createMemoizedSelector,
} from '../../hooks/useAppCalculations';

function HookRunner({ props, onRender }) {
  const result = useAppCalculations(props);
  onRender(result);
  return null;
}

function testHook(props) {
  let result;
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(
      <HookRunner
        props={props}
        onRender={(val) => {
          result = val;
        }}
      />
    );
  });

  act(() => {
    root.unmount();
    container.remove();
  });

  return result;
}

describe('useAppCalculations Hook & Memoized Selectors', () => {
  it('should compute stockItems with entrees, sorties, and alert status correctly', () => {
    const rawStock = [
      {
        id: 1,
        ref: 'ROUL-6204',
        designation: 'Roulement à billes 6204',
        stockInitial: 10,
        seuil: 5,
        emplacement: 'R1-B01',
      },
    ];

    const mouvements = [
      { ref: 'ROUL-6204', quantite: 3, type: 'Entrée' },
      { ref: 'ROUL-6204', quantite: 8, type: 'Sortie' },
    ];

    const result = testHook({ rawStock, mouvements });

    expect(result).toBeDefined();
    expect(result.stockItems).toHaveLength(1);

    const item = result.stockItems[0];
    expect(item.entrees).toBe(3);
    expect(item.sorties).toBe(8);
    // stockActuel = 10 + 3 - 8 = 5 (equals seuil 5 -> ALERTE)
    expect(item.stockActuel).toBe(5);
    expect(item.alerte).toBe('ALERTE');

    expect(result.stockKPIs.totalArticles).toBe(1);
    expect(result.stockKPIs.totalStockActuel).toBe(5);
    expect(result.stockKPIs.alertes).toBe(1);
    expect(result.stockKPIs.ruptures).toBe(0);
  });

  it('should detect RUPTURE when stockActuel reaches 0', () => {
    const rawStock = [
      {
        id: 2,
        ref: 'COUR-SPA-1000',
        designation: 'Courroie trapézoïdale',
        stockInitial: 4,
        seuil: 2,
      },
    ];

    const mouvements = [
      { ref: 'COUR-SPA-1000', quantite: 4, type: 'Sortie' },
    ];

    const result = testHook({ rawStock, mouvements });
    const item = result.stockItems[0];
    expect(item.stockActuel).toBe(0);
    expect(item.alerte).toBe('RUPTURE');
    expect(result.stockKPIs.ruptures).toBe(1);
  });

  it('should return safe empty defaults when no stock or movements are provided', () => {
    const result = testHook({});
    expect(result.stockItems).toEqual([]);
    expect(result.stockKPIs.totalArticles).toBe(0);
    expect(result.stockKPIs.totalStockActuel).toBe(0);
  });

  it('should preserve strict reference equality (useMemo) when unrelated props change and decouple designations from movements', () => {
    const rawStock = [
      { id: 1, ref: 'ROUL-6204', designation: 'Roulement 6204', stockInitial: 20, seuil: 5 },
    ];
    const mouvements1 = [{ ref: 'ROUL-6204', quantite: 5, type: 'Entrée' }];
    const families1 = [{ id: 'F1', nom: 'Famille 1' }];
    const families2 = [{ id: 'F1', nom: 'Famille 1' }, { id: 'F2', nom: 'Famille 2' }];

    const snapshots = [];
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    // Render 1
    act(() => {
      root.render(
        <HookRunner
          props={{ rawStock, mouvements: mouvements1, families: families1 }}
          onRender={(val) => snapshots.push(val)}
        />
      );
    });

    // Render 2: Only families changed -> stockItems, effectiveDesignations, stockKPIs MUST keep exact same reference
    act(() => {
      root.render(
        <HookRunner
          props={{ rawStock, mouvements: mouvements1, families: families2 }}
          onRender={(val) => snapshots.push(val)}
        />
      );
    });

    expect(snapshots[1].stockItems).toBe(snapshots[0].stockItems);
    expect(snapshots[1].effectiveDesignations).toBe(snapshots[0].effectiveDesignations);
    expect(snapshots[1].stockKPIs).toBe(snapshots[0].stockKPIs);

    // Render 3: Same-length movement quantity edit -> stockItems updates immediately, effectiveDesignations stays identical!
    const mouvements2 = [{ ref: 'ROUL-6204', quantite: 15, type: 'Entrée' }];
    act(() => {
      root.render(
        <HookRunner
          props={{ rawStock, mouvements: mouvements2, families: families2 }}
          onRender={(val) => snapshots.push(val)}
        />
      );
    });

    expect(snapshots[2].stockItems[0].entrees).toBe(15);
    expect(snapshots[2].stockItems[0].stockActuel).toBe(35);
    // Designations are decoupled from movements so reference is still preserved!
    expect(snapshots[2].effectiveDesignations).toBe(snapshots[1].effectiveDesignations);

    act(() => {
      root.unmount();
      container.remove();
    });
  });

  it('should memoize state selectors via createMemoizedSelector / selectStockItems', () => {
    const rawStock = [{ id: 1, ref: 'FILT-01', designation: 'Filtre Huile', stockInitial: 10, seuil: 2 }];
    const mouvements = [{ ref: 'FILT-01', quantite: 2, type: 'Sortie' }];

    const state1 = { rawStock, mouvements, designations: [] };
    const state2 = { rawStock, mouvements, designations: [], extraUnrelatedField: 123 };

    const res1 = selectStockItems(state1);
    const res2 = selectStockItems(state2);

    // Must return the exact same array reference without recomputing
    expect(res1).toBe(res2);
    expect(res1[0].stockActuel).toBe(8);

    const desig1 = selectEffectiveDesignations(state1);
    const desig2 = selectEffectiveDesignations(state2);
    expect(desig1).toBe(desig2);

    let computeCount = 0;
    const customSelector = createMemoizedSelector(
      [(s) => s.a, (s) => s.b],
      (a, b) => {
        computeCount++;
        return a + b;
      }
    );

    expect(customSelector({ a: 10, b: 20, c: 1 })).toBe(30);
    expect(customSelector({ a: 10, b: 20, c: 999 })).toBe(30);
    expect(computeCount).toBe(1);
  });
});
