import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import InterventionReportModal, {
  buildInitialReportFields,
  getInterventionReportDraftKey,
} from '../../presentation/pages/corrective/components/InterventionReportModal';

describe('InterventionReportModal (RPT-MODAL-P0)', () => {
  let container: HTMLDivElement;
  let root: Root | null = null;

  beforeEach(() => {
    localStorage.clear();
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(async () => {
    if (root) {
      await act(async () => {
        root?.unmount();
      });
      root = null;
    }
    container.remove();
    document.body.classList.remove('gmao-printing-technical-report');
    vi.restoreAllMocks();
  });

  it('builds factual auto-fill without fabricating executive summary, RCA, or recommendations', () => {
    const fields = buildInitialReportFields(
      {
        id: 'bt-42',
        num_bt: 'BT-2026-042',
        date_fin: '2026-11-10',
        code_machine: 'EXT-04',
        type_panne: 'Mécanique',
        anomalie: 'Échauffement palier réducteur',
        temps_intervention_calc: '01:45',
        intervenant: 'Karim Benali',
      },
      {
        id_machine_registered: 'EXT-04',
        designation: 'Extrudeuse Bivis 75mm',
      },
      'Karim Benali'
    );

    expect(fields.date).toBe('10/11/2026');
    expect(fields.code_machine).toBe('EXT-04');
    expect(fields.equipment_type).toBe('Extrudeuse Bivis 75mm');
    expect(fields.ref_bt).toBe('BT-2026-042');
    expect(fields.maintenance_type).toBe('Corrective');
    expect(fields.downtime).toBe('01:45');
    expect(fields.defect_nature).toBe('Type Mécanique — Échauffement palier réducteur');
    expect(fields.tech_name).toBe('Karim Benali');
    expect(fields.doc_ref).toBe('RT-BT-2026-042');

    // Manual fields remain strictly empty (zero fabrication)
    expect(fields.executive_summary).toBe('');
    expect(fields.rca_1_component).toBe('');
    expect(fields.root_cause_detail).toBe('');
    expect(fields.action_repair_1).toBe('');
    expect(fields.reco_1).toBe('');
  });

  it('renders formatted A4 document when opened without context (manual empty mode)', async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(<InterventionReportModal isOpen={true} onClose={() => {}} />);
    });

    const portal = document.body.querySelector('#gmao-report-print-portal');
    expect(portal).not.toBeNull();
    expect(portal?.textContent).toContain('Rapport Technique d’Intervention et de Maintenance');
    expect(portal?.textContent).toContain('1. Résumé exécutif (Executive Summary)');
    expect(portal?.textContent).toContain('2. Diagnostic et analyse des causes racines');
    expect(portal?.textContent).not.toContain('<!doctype html>');

    const refInput = portal?.querySelector('input[data-field="ref_bt"]') as HTMLInputElement | null;
    expect(refInput).not.toBeNull();
    expect(refInput?.value).toBe('');
  });

  it('persists draft JSON in localStorage, supports extra RCA rows, and restores saved draft', async () => {
    const intervention = {
      id: 99,
      num_bt: 'BT-2026-099',
      date_demande: '2026-11-12',
      code_machine: 'INJ-12',
      type_panne: 'Hydraulique',
      anomalie: 'Chute pression circuit principal',
      temps_arret: '02:10',
    };
    const machine = { id_machine_registered: 'INJ-12', designation: 'Presse à injecter 320T' };
    const showToast = vi.fn();

    await act(async () => {
      root = createRoot(container);
      root.render(
        <InterventionReportModal
          isOpen={true}
          onClose={() => {}}
          intervention={intervention}
          machine={machine}
          technicianName="Nabil Haddad"
          showToast={showToast}
        />
      );
    });

    const portal = document.body.querySelector('#gmao-report-print-portal')!;
    const summaryEl = portal.querySelector(
      'textarea[data-field="executive_summary"]'
    ) as HTMLTextAreaElement;
    const rootDetailEl = portal.querySelector(
      'textarea[data-field="root_cause_detail"]'
    ) as HTMLTextAreaElement;

    const nativeTextAreaValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      'value'
    )!.set!;

    await act(async () => {
      nativeTextAreaValueSetter.call(summaryEl, 'Remise en service validée après purge circuit.');
      summaryEl.dispatchEvent(new Event('input', { bubbles: true }));
      nativeTextAreaValueSetter.call(rootDetailEl, 'Joint torique valve proportionnelle usé.');
      rootDetailEl.dispatchEvent(new Event('input', { bubbles: true }));
    });

    // Add an extra RCA diagnostic row
    const addRcaBtn = Array.from(portal.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Ajouter une ligne')
    )!;
    await act(async () => {
      addRcaBtn.click();
    });

    const extraCompEl = portal.querySelector(
      'textarea[data-field="rca_extra_3_component"]'
    ) as HTMLTextAreaElement | null;
    expect(extraCompEl).not.toBeNull();

    await act(async () => {
      nativeTextAreaValueSetter.call(extraCompEl, 'Filtre retour HP');
      extraCompEl!.dispatchEvent(new Event('input', { bubbles: true }));
    });

    // Save draft
    const saveBtn = Array.from(portal.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Enregistrer brouillon')
    )!;
    await act(async () => {
      saveBtn.click();
    });

    const draftKey = getInterventionReportDraftKey(intervention);
    expect(draftKey).toBe('gmao_report_draft_BT-2026-099');
    const savedRaw = localStorage.getItem(draftKey);
    expect(savedRaw).not.toBeNull();
    const saved = JSON.parse(savedRaw!);
    expect(saved.fields.executive_summary).toBe('Remise en service validée après purge circuit.');
    expect(saved.fields.root_cause_detail).toBe('Joint torique valve proportionnelle usé.');
    expect(saved.extraRcaRows).toHaveLength(1);
    expect(saved.extraRcaRows[0].component).toBe('Filtre retour HP');
    expect(showToast).toHaveBeenCalledWith(
      'Brouillon du rapport technique enregistré.',
      'success'
    );

    // Unmount and remount to confirm draft reload
    await act(async () => {
      root?.unmount();
      root = createRoot(container);
      root.render(
        <InterventionReportModal
          isOpen={true}
          onClose={() => {}}
          intervention={intervention}
          machine={machine}
          technicianName="Nabil Haddad"
        />
      );
    });

    const reopenedPortal = document.body.querySelector('#gmao-report-print-portal')!;
    const reloadedSummary = reopenedPortal.querySelector(
      'textarea[data-field="executive_summary"]'
    ) as HTMLTextAreaElement;
    const reloadedExtra = reopenedPortal.querySelector(
      'textarea[data-field="rca_extra_3_component"]'
    ) as HTMLTextAreaElement;
    expect(reloadedSummary.value).toBe('Remise en service validée après purge circuit.');
    expect(reloadedExtra.value).toBe('Filtre retour HP');
  });

  it('scopes window.print() cleanly without throwing', async () => {
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {
      expect(document.body.classList.contains('gmao-printing-technical-report')).toBe(true);
    });

    await act(async () => {
      root = createRoot(container);
      root.render(<InterventionReportModal isOpen={true} onClose={() => {}} />);
    });

    const portal = document.body.querySelector('#gmao-report-print-portal')!;
    const printBtn = Array.from(portal.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Imprimer')
    )!;

    await act(async () => {
      printBtn.click();
    });

    expect(printSpy).toHaveBeenCalledTimes(1);
  });
});
