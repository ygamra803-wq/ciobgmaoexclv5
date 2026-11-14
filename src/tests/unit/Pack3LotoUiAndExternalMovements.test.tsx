import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import LotoPermitPanel from '../../presentation/pages/corrective/components/LotoPermitPanel';
import { MovementArticlesSection } from '../../presentation/pages/movements/components/MovementArticlesSection';
import { ExternalMovementContextSections } from '../../presentation/pages/movements/components/ExternalMovementContextSections';
import { useGmaoStore } from '../../store/useGmaoStore';
import { storageService } from '../../utils/storageService';

function setNativeInputValue(input: HTMLInputElement, value: string) {
  const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
  descriptor?.set?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

describe('Pack 3 — LOTO UI Permit, Live Focus Guard & Extracted SortieRapide Components', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    localStorage.clear();
    storageService.setItem('gmao_active_user', {
      id: 'ADMIN-01',
      nom: 'Chef Maintenance',
      role: 'ADMIN',
    });
    useGmaoStore.setState({
      correctiveInterventions: [],
      activeLiveInterventionId: null,
      auditEvents: [],
    });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('focuses activeLiveInterventionId for LOTO-pending BT while keeping statut at BT_PLANIFIE until CONSIGNE', () => {
    useGmaoStore.setState({
      correctiveInterventions: [
        {
          id: 'BT-FOCUS-LOTO',
          num_bt: 'BT-2026-501',
          code_machine: 'PRESS-05',
          statut: 'BT_PLANIFIE',
          requires_loto: true,
          loto_status: 'ATTENTE_CONSIGNATION',
        } as any,
      ],
    });

    useGmaoStore.getState().handleStartLiveIntervention('BT-FOCUS-LOTO');
    expect(useGmaoStore.getState().activeLiveInterventionId).toBe('BT-FOCUS-LOTO');
    expect(useGmaoStore.getState().correctiveInterventions[0].statut).toBe('BT_PLANIFIE');

    const consignRes = useGmaoStore.getState().handleConsignInterventionLoto('BT-FOCUS-LOTO', {
      num_cadenas: 'CAD-99',
      energy_types: ['HYDRAULIQUE'],
      vat_verified: true,
    });
    expect(consignRes.valid).toBe(true);

    useGmaoStore.getState().handleStartLiveIntervention('BT-FOCUS-LOTO');
    expect(useGmaoStore.getState().correctiveInterventions[0].statut).toBe('EN_COURS');
  });

  it('walks through full LotoPermitPanel lifecycle: enable -> VAT error -> CONSIGNE -> start EN_COURS -> zone guard -> DECONSIGNE', () => {
    const toastSpy = vi.fn();

    useGmaoStore.setState({
      correctiveInterventions: [
        {
          id: 'BT-UI-LOTO',
          num_bt: 'BT-2026-777',
          code_machine: 'TOUR-03',
          statut: 'BT_PLANIFIE',
          requires_loto: false,
        } as any,
      ],
    });

    const renderFromStore = () => {
      const currentBt = useGmaoStore
        .getState()
        .correctiveInterventions.find((i: any) => i.id === 'BT-UI-LOTO');
      act(() => {
        root.render(
          <LotoPermitPanel
            intervention={currentBt}
            onUpdateIntervention={(id, patch) =>
              useGmaoStore.getState().handleUpdateCorrectiveIntervention(id, patch)
            }
            onStartWork={(id) => useGmaoStore.getState().handleStartLiveIntervention(id)}
            showToast={toastSpy}
            actorId="ADMIN-01"
            actorName="Chef Maintenance"
            actorRole="ADMIN"
          />
        );
      });
    };

    renderFromStore();
    expect(container.querySelector('[data-testid="loto-status-badge"]')?.textContent).toBe('NON_REQUIS');

    // 1. Enable LOTO permit on BT
    act(() => {
      (container.querySelector('[data-testid="loto-enable-btn"]') as HTMLButtonElement).click();
    });
    renderFromStore();

    expect(useGmaoStore.getState().correctiveInterventions[0].requires_loto).toBe(true);
    expect(container.querySelector('[data-testid="loto-status-badge"]')?.textContent).toBe(
      'ATTENTE_CONSIGNATION'
    );

    // 2. Enter padlock + energy without VAT -> must block with error banner
    const padlockInput = container.querySelector('[data-testid="loto-padlock-input"]') as HTMLInputElement;
    act(() => {
      setNativeInputValue(padlockInput, 'CAD-UI-501');
      (container.querySelector('[data-testid="loto-energy-ELECTRIQUE"]') as HTMLButtonElement).click();
    });
    act(() => {
      (container.querySelector('[data-testid="loto-consign-submit-btn"]') as HTMLButtonElement).click();
    });

    expect(container.querySelector('[data-testid="loto-error-banner"]')?.textContent).toContain('VAT');
    expect(useGmaoStore.getState().correctiveInterventions[0].loto_status).toBe('ATTENTE_CONSIGNATION');

    // 3. Confirm VAT -> transitions to CONSIGNE
    const vatCheckbox = container.querySelector('[data-testid="loto-vat-checkbox"]') as HTMLInputElement;
    act(() => {
      vatCheckbox.click();
    });
    act(() => {
      (container.querySelector('[data-testid="loto-consign-submit-btn"]') as HTMLButtonElement).click();
    });
    renderFromStore();

    expect(useGmaoStore.getState().correctiveInterventions[0].loto_status).toBe('CONSIGNE');
    expect(useGmaoStore.getState().correctiveInterventions[0].loto?.num_cadenas).toBe('CAD-UI-501');
    expect(container.querySelector('[data-testid="loto-status-badge"]')?.textContent).toBe('CONSIGNE');

    // 4. Start work from panel button -> transitions BT to EN_COURS
    act(() => {
      (container.querySelector('[data-testid="loto-start-work-btn"]') as HTMLButtonElement).click();
    });
    renderFromStore();
    expect(useGmaoStore.getState().correctiveInterventions[0].statut).toBe('EN_COURS');

    // 5. Attempt deconsign without zone clearance -> must remain CONSIGNE
    act(() => {
      (container.querySelector('[data-testid="loto-deconsign-submit-btn"]') as HTMLButtonElement).click();
    });
    expect(container.querySelector('[data-testid="loto-error-banner"]')?.textContent).toContain('zone');
    expect(useGmaoStore.getState().correctiveInterventions[0].loto_status).toBe('CONSIGNE');

    // 6. Confirm zone clearance -> transitions to DECONSIGNE
    const zoneCheckbox = container.querySelector('[data-testid="loto-zone-cleared-checkbox"]') as HTMLInputElement;
    act(() => {
      zoneCheckbox.click();
    });
    act(() => {
      (container.querySelector('[data-testid="loto-deconsign-submit-btn"]') as HTMLButtonElement).click();
    });
    renderFromStore();

    expect(useGmaoStore.getState().correctiveInterventions[0].loto_status).toBe('DECONSIGNE');
    expect(container.querySelector('[data-testid="loto-status-badge"]')?.textContent).toBe('DECONSIGNE');
  });

  it('renders MovementArticlesSection with Stock Réservé soft-lock badge and net deficit alert', () => {
    act(() => {
      root.render(
        <MovementArticlesSection
          form={{ type: 'Sortie Interne' }}
          mouvementItems={[
            {
              ref: 'RLT-6205',
              designation: 'Roulement 6205 2RS',
              quantite: 6,
              unit: 'pcs',
              source: 'STOCK_PDR',
            },
          ]}
          unifiedSearchCatalog={[
            {
              ref: 'RLT-6205',
              designation: 'Roulement 6205 2RS',
              stockActuel: 10,
              emplacement: 'A-12',
              raw: { stockActuel: 10, seuil: 2 },
            },
          ]}
          getExternalReservedQtyForRef={() => 5}
          handleAddItem={vi.fn()}
          handleRemoveItem={vi.fn()}
          handleUpdateItem={vi.fn()}
          onOpenItemCatalog={vi.fn()}
        />
      );
    });

    expect(container.querySelector('[data-testid="soft-lock-reserved-RLT-6205"]')?.textContent).toBe('5');
    expect(container.textContent).toContain('Déficit: -1 pcs');
    expect(container.textContent).toContain('1 article(s) en déficit');
  });

  it('renders ExternalMovementContextSections for Bon de Sortie, Entrée Externe, and Commande flows', () => {
    const receiveRepairSpy = vi.fn();
    const setFormSpy = vi.fn();

    act(() => {
      root.render(
        <ExternalMovementContextSections
          isBonSortie={false}
          isEntreeExterne={true}
          isCommandeFlow={true}
          form={{
            action_id: 'RETOUR_REPARATION',
            fournisseur: '',
            emplacement_reception: '',
            priorite: 'URGENTE',
            technicien: '',
            commentaire: '',
          }}
          setForm={setFormSpy}
          supplierOptions={['BOBINAGE-NORD']}
          machines={[]}
          activeMachinesList={[]}
          technicians={[{ id_technician: 'T-01', nom: 'Karim' }]}
          activeExternalRepairs={[{ code_bon: 'BSE-2026-01', ref: 'MOT-15KW' }]}
          handleReceiveRepairReturn={receiveRepairSpy}
        />
      );
    });

    expect(container.textContent).toContain('Nature de la Réception Externe');
    expect(container.textContent).toContain("Informations de la Demande d'Achat");
    expect(container.textContent).toContain('BSE-2026-01');

    const repairBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('BSE-2026-01')
    );
    expect(repairBtn).toBeDefined();
    act(() => {
      repairBtn!.click();
    });
    expect(receiveRepairSpy).toHaveBeenCalledWith({ code_bon: 'BSE-2026-01', ref: 'MOT-15KW' });
  });
});
