import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import GmaoIndustrialDataGrid, { VirtualizedIndustrialDataGrid } from '../../presentation/components/common/GmaoIndustrialDataGrid';
import { VirtualizedTable } from '../../presentation/components/common/VirtualizedTable';
import DetailedTaskListView from '../../presentation/pages/preventive/components/DetailedTaskListView';
import { I18nProvider } from '../../i18n/I18nContext';

describe('Virtual Scrolling Architecture & Performance (60fps Engine)', () => {
  const generateLargeDataset = (count: number) => {
    return Array.from({ length: count }, (_, i) => ({
      id: `ITEM-${i + 1}`,
      ref: `ROUL-${6000 + i}`,
      designation: `Roulement à billes standard ${i + 1}`,
      quantite: (i * 7) % 100,
    }));
  };

  const columns = [
    { key: 'ref', label: 'Référence' },
    { key: 'designation', label: 'Désignation' },
    { key: 'quantite', label: 'Quantité' },
  ];

  it('GmaoIndustrialDataGrid virtualizes 1,000 records without rendering 1,000 DOM rows', () => {
    const data1000 = generateLargeDataset(1000);

    const html = renderToString(
      <I18nProvider>
        <GmaoIndustrialDataGrid
          title="Stock Global"
          columns={columns}
          data={data1000}
          virtualThreshold={30}
        />
      </I18nProvider>
    );

    // Virtual badge should be rendered
    expect(html).toContain('Virtual 60fps');

    // Count <tr> tags rendered in output: should be under 50 (slice + spacers), NOT 1,000!
    const trMatches = html.match(/<tr/g) || [];
    expect(trMatches.length).toBeLessThan(50);
    expect(trMatches.length).toBeGreaterThan(0);
  });

  it('VirtualizedIndustrialDataGrid renders react-window mode cleanly', () => {
    const data500 = generateLargeDataset(500);

    const html = renderToString(
      <I18nProvider>
        <VirtualizedIndustrialDataGrid
          title="Stock React Window"
          columns={columns}
          data={data500}
        />
      </I18nProvider>
    );

    expect(html).toContain('Virtual 60fps');
    expect(html).toContain('Stock React Window');
  });

  it('DetailedTaskListView virtualizes 1,000 tasks grouped by machine with initialPageSize=0 (Tous)', () => {
    const machines = [
      { id: 'M-1', code_machine: 'M-1', nom: 'Presse 100T', id_zone: 'ZONE-A' },
      { id: 'M-2', code_machine: 'M-2', nom: 'Laminoir 500', id_zone: 'ZONE-B' },
      { id: 'M-3', code_machine: 'M-3', nom: 'Tour Parallèle', id_zone: 'ZONE-C' },
    ];

    const tasks1000 = Array.from({ length: 1000 }, (_, i) => ({
      id: `TASK-${i + 1}`,
      id_machine: `M-${(i % 3) + 1}`,
      composant: `Composant Mécanique ${i + 1}`,
      action_code: 'G',
      frequence: 'Mensuel',
      prochaine_echeance: '2026-10-15',
      responsable: 'Tech Ali',
      cout_cumule: 120,
      etat: i % 5 === 0 ? 'En retard' : i % 2 === 0 ? 'Fait' : 'À faire',
    }));

    const html = renderToString(
      <I18nProvider>
        <DetailedTaskListView
          tasks={tasks1000}
          machines={machines}
          initialPageSize={0}
        />
      </I18nProvider>
    );

    // Virtual badge must be present
    expect(html).toContain('Virtual 60fps');

    // Count <tr> tags in rendered HTML: must be virtualized to under 50 rows, NEVER 1,000+!
    const trMatches = html.match(/<tr/g) || [];
    expect(trMatches.length).toBeLessThan(50);
    expect(trMatches.length).toBeGreaterThan(0);
  });

  it('DetailedTaskListView virtualizes in flat continuous view with initialPageSize=100', () => {
    const tasks100 = Array.from({ length: 100 }, (_, i) => ({
      id: `FLAT-TASK-${i + 1}`,
      id_machine: 'M-1',
      composant: `Composant ${i + 1}`,
      action_code: 'C',
      etat: 'À faire',
    }));

    const html = renderToString(
      <I18nProvider>
        <DetailedTaskListView
          tasks={tasks100}
          initialPageSize={100}
          initialGroupByMachine={false}
        />
      </I18nProvider>
    );

    expect(html).toContain('Virtual 60fps');
    const trMatches = html.match(/<tr/g) || [];
    expect(trMatches.length).toBeLessThan(50);
  });

  it('VirtualizedTable component renders smoothly with react-window List', () => {
    const data200 = generateLargeDataset(200);

    const html = renderToString(
      <VirtualizedTable
        data={data200}
        columns={columns}
        rowHeight={48}
        height={400}
      />
    );

    expect(html).toContain('ROUL-6000');
    expect(html).toContain('Roulement à billes standard 1');
  });
});
