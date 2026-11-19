import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGmaoStore } from '../../store/useGmaoStore';
import { LiveStoppedMachinesBoard } from '../../presentation/pages/corrective/components/LiveStoppedMachinesBoard';
import { InterventionLiveHandoffPanels } from '../../presentation/pages/corrective/components/InterventionLiveHandoffPanels';
import InterventionLiveTab from '../../presentation/pages/corrective/InterventionLiveTab';
import { I18nProvider } from '../../i18n/I18nContext';
import type { CorrectiveInterventionItem } from '../../types/store';

let currentMockUser: any = { id: 'ADM-1', name: 'Admin', role: 'ADMIN' };

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    user: currentMockUser,
    login: vi.fn(),
    logout: vi.fn(),
    isAuthenticated: true,
    isLoading: false,
    authError: null,
    hasPermission: () => true,
  }),
}));

function mount(element: React.ReactElement): {
  container: HTMLDivElement;
  unmount: () => void;
} {
  const container = document.createElement('div');
  document.body.appendChild(container);
  let root: Root | null = null;
  act(() => {
    root = createRoot(container);
    root.render(element);
  });
  return {
    container,
    unmount: () => {
      act(() => {
        root?.unmount();
      });
      container.remove();
    },
  };
}

function makeAuthWrapper(user: any) {
  currentMockUser = user;
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <I18nProvider>{children}</I18nProvider>;
  };
}

describe('Corrective Phase C — Small Factory UX & Field Efficiency Hardening', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    useGmaoStore.setState({
      machines: [
        {
          id: 'EXT-01',
          id_machine_registered: 'EXT-01',
          designation: 'Extrudeuse Principale 01',
          id_zone_default: 'Z-EXT',
          cout_arret_horaire: 1200,
        } as any,
      ],
      technicians: [
        {
          id: 'TECH-01',
          id_technician: 'TECH-01',
          nom: 'Karim Field',
          taux_horaire: 100,
        } as any,
      ],
      rawStock: [
        {
          id: 'PDR-1',
          ref: 'RLT-6205',
          designation: 'Roulement SKF 6205',
          stockInitial: 5,
          prixUnitaire: 120,
        } as any,
        {
          id: 'PDR-2',
          ref: 'CT-LOW',
          designation: 'Contacteur 24V',
          stockInitial: 1,
          prixUnitaire: 250,
        } as any,
      ],
      mouvements: [],
      correctiveInterventions: [],
      workshopOrders: [],
      sortiesExterne: [],
      needRequests: [],
      auditEvents: [],
      activeLiveInterventionId: null,
    });
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  // =========================================================================
  // C1: Live Stopped Machines Board
  // =========================================================================
  describe('C1 — LiveStoppedMachinesBoard', () => {
    it('shows emerald nominal bar when no active machines are stopped', () => {
      const closedStopped: CorrectiveInterventionItem = {
        id: 'BT-CLOSED',
        num_bt: 'BT-2026-001',
        code_machine: 'EXT-01',
        statut: 'CLOTURE',
        action_fermee: 'OUI',
        arret_machine: true,
        anomalie: 'Panne réglée',
      } as any;
      const activeNotStopped: CorrectiveInterventionItem = {
        id: 'BT-RUN',
        num_bt: 'BT-2026-002',
        code_machine: 'EXT-01',
        statut: 'EN_COURS',
        arret_machine: false,
        anomalie: 'Bruit léger',
      } as any;

      const { container, unmount } = mount(
        <LiveStoppedMachinesBoard
          interventions={[closedStopped, activeNotStopped]}
          machines={useGmaoStore.getState().machines}
          onOpenLive={vi.fn()}
        />
      );

      expect(container.querySelector('[data-testid="live-stopped-board-ok"]')).not.toBeNull();
      expect(container.querySelector('[data-testid="live-stopped-board"]')).toBeNull();
      unmount();
    });

    it('renders active stopped machines with estimated loss and triggers 1-click Live jump', () => {
      const onOpenLive = vi.fn();
      const nowMs = Date.parse('2026-05-10T10:00:00');
      const stoppedBt: CorrectiveInterventionItem = {
        id: 'BT-STOP-1',
        num_bt: 'BT-2026-010',
        code_machine: 'EXT-01',
        statut: 'EN_COURS',
        arret_machine: true,
        priorite: 'HAUTE',
        date_debut: '2026-05-10',
        heure_debut: '08:00',
        intervenant: 'Karim Field',
        anomalie: 'Surchauffe moteur principal',
      } as any;

      const { container, unmount } = mount(
        <LiveStoppedMachinesBoard
          interventions={[stoppedBt]}
          machines={useGmaoStore.getState().machines}
          onOpenLive={onOpenLive}
          nowMs={nowMs}
        />
      );

      expect(container.querySelector('[data-testid="live-stopped-board"]')).not.toBeNull();
      expect(container.querySelector('[data-testid="stopped-machine-card-EXT-01"]')).not.toBeNull();
      // 2h elapsed * 1200 DH/h = 2,400 DH estimated production loss
      const lossBadge = container.querySelector('[data-testid="live-stopped-total-loss"]');
      expect(lossBadge?.textContent).toContain('2');
      expect(lossBadge?.textContent).toContain('400');

      const openBtn = container.querySelector(
        '[data-testid="stopped-open-live-BT-STOP-1"]'
      ) as HTMLButtonElement;
      expect(openBtn).not.toBeNull();
      act(() => {
        openBtn.click();
      });
      expect(onOpenLive).toHaveBeenCalledTimes(1);
      expect(onOpenLive).toHaveBeenCalledWith(stoppedBt);
      unmount();
    });
  });

  // =========================================================================
  // C2: Unified Workshop Panel + Internal BR/RECT Cost in BT TCO
  // =========================================================================
  describe('C2 — Unified Workshop Panel & Internal Workshop Cost TCO', () => {
    it('flows optional internal workshop heures_atelier & cout_atelier into BT cout_atelier and TCO on closure', () => {
      const store = useGmaoStore.getState();
      const bt: CorrectiveInterventionItem = {
        id: 'BT-ATEL-1',
        num_bt: 'BT-2026-050',
        code_machine: 'EXT-01',
        statut: 'EN_COURS',
        date_debut: '2026-05-10',
        heure_debut: '08:00',
        arret_machine: false,
        intervenant: 'Karim Field',
        anomalie: 'Usure arbre entraînement',
      } as any;
      store.setCorrectiveInterventions([bt]);

      const order = store.handleCreateWorkshopOrder({
        type_demande: 'RECTIFICATION',
        id_machine: 'EXT-01',
        id_bt: 'BT-2026-050',
        quantite: 1,
        description_travaux: 'Rectification portée roulement Ø40',
        heures_atelier: 3,
        cout_atelier: 650,
      });

      expect(order).not.toBeNull();
      expect(order?.heures_atelier).toBe(3);
      expect(order?.cout_atelier).toBe(650);

      // Complete internal workshop order lifecycle
      expect(
        useGmaoStore
          .getState()
          .handleTransitionWorkshopOrderStatus(order!.id, 'EN_COURS_FABRICATION').valid
      ).toBe(true);
      expect(
        useGmaoStore
          .getState()
          .handleTransitionWorkshopOrderStatus(order!.id, 'PRET_LIVRAISON').valid
      ).toBe(true);
      expect(
        useGmaoStore
          .getState()
          .handleTransitionWorkshopOrderStatus(order!.id, 'RECEPTIONNE_MONTAGE').valid
      ).toBe(true);

      // Close BT and confirm internal workshop cost is included in cout_atelier & cout_total_tco
      const closed = useGmaoStore.getState().handleClotureIntervention('BT-ATEL-1', {
        actorRole: 'ADMIN',
        action_realisee: 'Arbre rectifié remonté et contrôlé',
        date_fin: '2026-05-10',
        heure_fin: '09:00',
        temps_intervention_mins: 60,
        pieces_utilisees: [{ ref: 'RLT-6205', designation: 'Roulement SKF 6205', quantite: 1, prix_unitaire: 120 }],
      });

      expect(closed).not.toBeNull();
      expect(closed?.cout_pdr).toBe(120);
      expect(closed?.cout_atelier).toBe(650);
      expect(closed?.cout_total).toBe(770);
      // TCO = 120 (PDR) + 650 (Atelier) + 100 (1h * 100 DH/h MO) + 0 (no stoppage) = 870 DH
      expect(closed?.cout_total_tco).toBe(870);
    });

    it('switches cleanly between Internal (BR/RECT) and External (Sous-traitance) in one unified Live panel', () => {
      function Harness() {
        const [showInt, setShowInt] = React.useState(false);
        const [showExt, setShowExt] = React.useState(false);
        const [bonForm, setBonForm] = React.useState<{
          type_demande: 'REALISATION' | 'RECTIFICATION';
          quantite: number;
          description_travaux: string;
          observation: string;
          heures_atelier: number;
          cout_atelier: number;
        }>({
          type_demande: 'REALISATION',
          quantite: 1,
          description_travaux: '',
          observation: '',
          heures_atelier: 0,
          cout_atelier: 0,
        });
        const [extForm, setExtForm] = React.useState<{
          categorie_flux: 'ATELIER_MECANIQUE' | 'SOUS_TRAITANCE_EXTERNE';
          nature_travail: string;
          designation_piece: string;
          fournisseur_externe: string;
          cout_bobinage: number;
          suspendBtAfterCreate: boolean;
        }>({
          categorie_flux: 'SOUS_TRAITANCE_EXTERNE',
          nature_travail: 'Bobinage complet',
          designation_piece: '',
          fournisseur_externe: 'Bobinage Atlas',
          cout_bobinage: 0,
          suspendBtAfterCreate: true,
        });

        return (
          <InterventionLiveHandoffPanels
            activeIntervention={{ id: 'BT-1', num_bt: 'BT-2026-001', code_machine: 'EXT-01' }}
            formState={{ intervention_nature: 'ATELIER' }}
            isTechUser={false}
            showNeedRequestForm={false}
            setShowNeedRequestForm={vi.fn()}
            needForm={{
              material_class: 'PDR',
              policy_tag: 'REPLACING',
              quantite: 1,
              description_besoin: '',
              id_ref_pdr: '',
            }}
            setNeedForm={vi.fn()}
            handleEmitNeedRequest={vi.fn()}
            linkedNeedRequests={[]}
            handleNeedFieldHandoff={vi.fn()}
            linkedWorkshopOrders={[]}
            linkedInternalWorkshopOrders={[]}
            showBonAtelierMecaniqueForm={showInt}
            setShowBonAtelierMecaniqueForm={setShowInt}
            bonAtelierForm={bonForm}
            setBonAtelierForm={setBonForm}
            handleEmitBonAtelierMecanique={vi.fn()}
            handleTransitionWorkshopOrderStatus={() => ({ valid: true })}
            handleMarkSortieReturned={vi.fn()}
            showQuickWorkshopForm={showExt}
            setShowQuickWorkshopForm={setShowExt}
            workshopQuickForm={extForm}
            setWorkshopQuickForm={setExtForm}
            handleQuickCreateWorkshopOrder={vi.fn()}
          />
        );
      }

      const { container, unmount } = mount(<Harness />);

      // Initially neither form is duplicated/open
      expect(container.querySelector('[data-testid="bon-atelier-mecanique-form"]')).toBeNull();
      expect(container.querySelector('[data-testid="external-workshop-form"]')).toBeNull();

      // Switch to Internal BR/RECT
      act(() => {
        (
          container.querySelector('[data-testid="toggle-bon-atelier-mecanique-btn"]') as HTMLButtonElement
        ).click();
      });
      expect(container.querySelector('[data-testid="bon-atelier-mecanique-form"]')).not.toBeNull();
      expect(container.querySelector('[data-testid="bon-atelier-heures-input"]')).not.toBeNull();
      expect(container.querySelector('[data-testid="bon-atelier-cout-input"]')).not.toBeNull();
      expect(container.querySelector('[data-testid="external-workshop-form"]')).toBeNull();

      // Switch to External Sous-traitance -> automatically closes Internal form
      act(() => {
        (
          container.querySelector('[data-testid="toggle-quick-workshop-btn"]') as HTMLButtonElement
        ).click();
      });
      expect(container.querySelector('[data-testid="bon-atelier-mecanique-form"]')).toBeNull();
      expect(container.querySelector('[data-testid="external-workshop-form"]')).not.toBeNull();
      unmount();
    });
  });

  // =========================================================================
  // C3: Flexible Factory Fast-Track NeedRequest
  // =========================================================================
  describe('C3 — Flexible Factory Fast-Track NeedRequest', () => {
    it('fast-tracks in-stock NeedRequest in 1 step for ADMIN without mutating stock and logs audit event', () => {
      const store = useGmaoStore.getState();
      const created = store.handleCreateNeedRequest({
        id_machine: 'EXT-01',
        id_bt: 'BT-2026-099',
        material_class: 'PDR',
        id_ref_pdr: 'RLT-6205',
        quantite: 2,
        description_besoin: 'Roulement SKF 6205 en stock magasin',
      });
      expect(created).not.toBeNull();
      expect(created?.statut).toBe('DEMANDE_TECH');

      const res = useGmaoStore.getState().handleFastTrackNeedRequest(created!.id, {
        actorRole: 'ADMIN',
        actorId: 'ADM-1',
        actorName: 'Directeur Usine',
      });

      expect(res.valid).toBe(true);
      expect(res.needRequest?.statut).toBe('REMIS_TECHNICIEN');
      expect(res.needRequest?.canal_appro).toBe('STOCK');
      expect(res.needRequest?.fast_track).toBe(true);
      expect(res.needRequest?.timestamps?.REVUE_SUPERVISEUR).toBeTruthy();
      expect(res.needRequest?.timestamps?.REMIS_TECHNICIEN).toBeTruthy();

      // Invariant #6: ZERO direct stock mutation during NeedRequest fast-track
      expect(useGmaoStore.getState().mouvements).toHaveLength(0);

      // Immutable audit trail logged
      const audit = useGmaoStore
        .getState()
        .auditEvents.find((e) => e.actionType === 'NEED_REQUEST_FAST_TRACK');
      expect(audit).toBeDefined();
      expect(audit?.entityId).toBe(created!.code_demande);
    });

    it('blocks Fast-Track fail-closed for TECHNICIEN, VIEWER, and insufficient stock', () => {
      const store = useGmaoStore.getState();
      const lowStockNeed = store.handleCreateNeedRequest({
        id_machine: 'EXT-01',
        id_bt: 'BT-2026-100',
        material_class: 'PDR',
        id_ref_pdr: 'CT-LOW',
        quantite: 3, // Stock is only 1
        description_besoin: '3 contacteurs 24V',
      });
      expect(lowStockNeed).not.toBeNull();

      // 1. Technician blocked fail-closed
      const techAttempt = useGmaoStore.getState().handleFastTrackNeedRequest(lowStockNeed!.id, {
        actorRole: 'TECHNICIEN',
        isTechnician: true,
      });
      expect(techAttempt.valid).toBe(false);
      expect(techAttempt.reason).toMatch(/RBAC/i);

      // 2. Viewer blocked fail-closed
      const viewerAttempt = useGmaoStore.getState().handleFastTrackNeedRequest(lowStockNeed!.id, {
        actorRole: 'VIEWER',
      });
      expect(viewerAttempt.valid).toBe(false);

      // 3. Admin blocked when live stock < requested quantity
      const insufficientAttempt = useGmaoStore
        .getState()
        .handleFastTrackNeedRequest(lowStockNeed!.id, {
          actorRole: 'ADMIN',
        });
      expect(insufficientAttempt.valid).toBe(false);
      expect(insufficientAttempt.reason).toMatch(/Stock insuffisant/i);
    });
  });

  // =========================================================================
  // C4: Live Top-3 Machine History & Clôture Express (0 PDR)
  // =========================================================================
  describe('C4 — Live Machine History (Top 3) & Clôture Express (0 PDR)', () => {
    const pastInterventions: CorrectiveInterventionItem[] = [
      {
        id: 'HIST-1',
        num_bt: 'BT-2026-001',
        code_machine: 'EXT-01',
        statut: 'CLOTURE',
        action_fermee: 'OUI',
        date_cloture: '2026-04-01',
        anomalie: 'Capteur encrassé',
        action_realisee: 'Nettoyage cellule photoélectrique',
      } as any,
      {
        id: 'HIST-2',
        num_bt: 'BT-2026-002',
        code_machine: 'EXT-01',
        statut: 'CLOTURE',
        action_fermee: 'OUI',
        date_cloture: '2026-04-15',
        anomalie: 'Relais thermique déclenché',
        cause_racine: 'Surcharge vis sans fin',
        pieces_utilisees: [{ ref: 'RLT-6205', designation: 'Roulement', quantite: 1 }],
      } as any,
      {
        id: 'HIST-3',
        num_bt: 'BT-2026-003',
        code_machine: 'EXT-01',
        statut: 'CLOTURE',
        action_fermee: 'OUI',
        date_cloture: '2026-05-01',
        anomalie: 'Fuite raccord hydraulique',
        action_realisee: 'Resserrage et joint neuf',
      } as any,
      {
        id: 'HIST-4',
        num_bt: 'BT-2026-004',
        code_machine: 'EXT-01',
        statut: 'CLOTURE',
        action_fermee: 'OUI',
        date_cloture: '2026-03-10',
        anomalie: 'Ancienne panne #4 (ne doit pas apparaître dans Top 3)',
        action_realisee: 'Action ancienne',
      } as any,
    ];

    it('renders Top 3 closed failures on active machine and runs Clôture Express (0 PDR) for ADMIN', () => {
      const activeBt: CorrectiveInterventionItem = {
        id: 'BT-LIVE-1',
        num_bt: 'BT-2026-090',
        code_machine: 'EXT-01',
        statut: 'EN_COURS',
        date_debut: '2026-05-10',
        heure_debut: '08:00',
        anomalie: 'Déclenchement thermique',
      } as any;
      const onCloture = vi.fn(() => ({ ...activeBt, statut: 'CLOTURE' }));
      const Wrapper = makeAuthWrapper({ id: 'ADM-1', name: 'Admin', role: 'ADMIN' });

      const { container, unmount } = mount(
        <Wrapper>
          <InterventionLiveTab
            interventions={[activeBt, ...pastInterventions]}
            machines={useGmaoStore.getState().machines}
            technicians={useGmaoStore.getState().technicians}
            activeLiveId="BT-LIVE-1"
            onClotureIntervention={onCloture}
            showToast={vi.fn()}
          />
        </Wrapper>
      );

      // Top 3 machine history panel shows exact 3 newest closed interventions (HIST-3, HIST-2, HIST-1)
      const historyPanel = container.querySelector('[data-testid="live-recent-failures-panel"]');
      expect(historyPanel).not.toBeNull();
      expect(container.querySelector('[data-testid="recent-failure-card-0"]')?.textContent).toContain(
        'BT-2026-003'
      );
      expect(container.querySelector('[data-testid="recent-failure-card-1"]')?.textContent).toContain(
        'BT-2026-002'
      );
      expect(container.querySelector('[data-testid="recent-failure-card-2"]')?.textContent).toContain(
        'BT-2026-001'
      );
      expect(container.querySelector('[data-testid="recent-failure-card-3"]')).toBeNull();

      // Clôture Express: select preset chip and click submit
      const presetBtn = Array.from(container.querySelectorAll('button')).find((b) =>
        b.textContent?.includes('Réarmement relais thermique')
      ) as HTMLButtonElement;
      expect(presetBtn).toBeDefined();
      act(() => {
        presetBtn.click();
      });

      const expressBtn = container.querySelector(
        '[data-testid="live-quick-minor-submit-btn"]'
      ) as HTMLButtonElement;
      expect(expressBtn.disabled).toBe(false);
      act(() => {
        expressBtn.click();
      });

      expect(onCloture).toHaveBeenCalledTimes(1);
      const payload = (onCloture.mock.calls[0] as unknown as [string, Record<string, any>])[1];
      expect(payload.action_realisee).toBe('Réarmement relais thermique');
      expect(payload.intervention_nature).toBe('REGLAGE');
      expect(payload.pieces_utilisees).toEqual([]);
      unmount();
    });

    it('locks Clôture Express when LOTO is CONSIGNE and routes TECHNICIEN through Maker-Checker', () => {
      // 1. LOTO CONSIGNE blocks ADMIN Clôture Express
      const lotoActiveBt: CorrectiveInterventionItem = {
        id: 'BT-LOTO-1',
        num_bt: 'BT-2026-091',
        code_machine: 'EXT-01',
        statut: 'EN_COURS',
        requires_loto: true,
        loto_status: 'CONSIGNE',
        loto: { status: 'CONSIGNE', num_cadenas: 'CAD-99' } as any,
        anomalie: 'Intervention électrique',
      } as any;
      const AdminWrapper = makeAuthWrapper({ id: 'ADM-1', name: 'Admin', role: 'ADMIN' });
      const { container: adminContainer, unmount: unmountAdmin } = mount(
        <AdminWrapper>
          <InterventionLiveTab
            interventions={[lotoActiveBt]}
            machines={useGmaoStore.getState().machines}
            activeLiveId="BT-LOTO-1"
            onClotureIntervention={vi.fn()}
            showToast={vi.fn()}
          />
        </AdminWrapper>
      );
      expect(
        adminContainer.querySelector('[data-testid="live-quick-minor-blocker"]')
      ).not.toBeNull();
      const lockedBtn = adminContainer.querySelector(
        '[data-testid="live-quick-minor-submit-btn"]'
      ) as HTMLButtonElement;
      expect(lockedBtn.disabled).toBe(true);
      unmountAdmin();

      // 2. TECHNICIEN Express routes strictly through onSubmitForValidation (Maker-Checker)
      const techBt: CorrectiveInterventionItem = {
        id: 'BT-TECH-1',
        num_bt: 'BT-2026-092',
        code_machine: 'EXT-01',
        statut: 'EN_COURS',
        intervenant: 'Karim Field',
        technicien_matricule: 'TECH-01',
        anomalie: 'Capteur bloqué',
      } as any;
      const onSubmitForValidation = vi.fn(() => ({ ...techBt, validation_status: 'PENDING_VALIDATION' }));
      const onDirectCloture = vi.fn();
      const TechWrapper = makeAuthWrapper({
        id: 'U-TECH',
        personnelId: 'TECH-01',
        name: 'Karim Field',
        role: 'TECHNICIEN',
      });

      const { container: techContainer, unmount: unmountTech } = mount(
        <TechWrapper>
          <InterventionLiveTab
            interventions={[techBt]}
            machines={useGmaoStore.getState().machines}
            technicians={useGmaoStore.getState().technicians}
            activeLiveId="BT-TECH-1"
            onSubmitForValidation={onSubmitForValidation}
            onClotureIntervention={onDirectCloture}
            showToast={vi.fn()}
          />
        </TechWrapper>
      );

      const chip = Array.from(techContainer.querySelectorAll('button')).find((b) =>
        b.textContent?.includes('Nettoyage capteur / cellule')
      ) as HTMLButtonElement;
      act(() => {
        chip.click();
      });
      const submitBtn = techContainer.querySelector(
        '[data-testid="live-quick-minor-submit-btn"]'
      ) as HTMLButtonElement;
      act(() => {
        submitBtn.click();
      });

      expect(onSubmitForValidation).toHaveBeenCalledTimes(1);
      expect(onDirectCloture).not.toHaveBeenCalled();
      unmountTech();
    });
  });
});
