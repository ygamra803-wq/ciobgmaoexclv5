import { describe, it, expect, beforeEach } from 'vitest';
import { SortieExterneService } from '../application/services/SortieExterneService';
import { WorkOrderStateMachine } from '../domain/corrective/services/WorkOrderStateMachine';
import { validateWorkshopOrderTransition } from '../domain/corrective/workshopOrderService';
import { STORAGE_KEYS } from '../infrastructure/persistence/storageKeys';
import { storageService } from '../utils/storageService';
import { useGmaoStore } from '../store/useGmaoStore';

describe('CORRECTIVE-ATELIER-P0 — Workshop & External Realization Bridge + Closure Guard', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    useGmaoStore.setState({
      machines: [],
      rawStock: [],
      mouvements: [],
      sortiesExterne: [],
      workshopOrders: [],
      correctiveInterventions: [],
      warehouseItems: [],
    });
  });

  it('1. generates BON-ATEL-xxx for ATELIER_MECANIQUE and SORT-EXT-xxx for SOUS_TRAITANCE_EXTERNE backward-compatibly', () => {
    const list0: any[] = [];
    const atel1 = SortieExterneService.addSortie(
      {
        categorie_flux: 'ATELIER_MECANIQUE',
        id_machine: 'PRESS-01',
        id_corrective: 'BT-001',
        designation_moteur: 'Arbre principal Presse 01',
        nature_travail: 'Tournage arbre / axe',
        fournisseur_externe: 'Atelier Mécanique Interne',
        cout_bobinage: 350,
      },
      list0
    );

    expect(atel1.code).toBe('BON-ATEL-001');
    expect(atel1.categorie_flux).toBe('ATELIER_MECANIQUE');
    expect(atel1.etat).toBe('En cours atelier');
    expect(atel1.ref).toMatch(/^BA-\d{4}-\d{3}$/);
    expect(SortieExterneService.isWorkshopOrderOpen(atel1.etat)).toBe(true);

    const list1 = [atel1];
    const ext1 = SortieExterneService.addSortie(
      {
        id_machine: 'COMP-01',
        id_corrective: 'BT-002',
        designation_moteur: 'Moteur 15kW Compresseur',
        type_probleme: 'Bobinage complet',
        fournisseur_externe: 'Bobinage Atlas',
        cout_bobinage: 1200,
      },
      list1
    );

    expect(ext1.code).toBe('SORT-EXT-001');
    expect(ext1.categorie_flux).toBe('SOUS_TRAITANCE_EXTERNE');
    expect(ext1.etat).toBe('En réparation externe');
    expect(ext1.ref).toMatch(/^BS-\d{4}-\d{3}$/);

    const list2 = [ext1, atel1];
    const stats = SortieExterneService.getStats(list2);
    expect(stats.total).toBe(2);
    expect(stats.enCours).toBe(2);
    expect(stats.atelierCount).toBe(1);
    expect(stats.externeCount).toBe(1);
    expect(stats.totalCout).toBe(1550);
  });

  it('2. blocks WorkOrderStateMachine transition to CLOTURE when hasOpenWorkshopOrder is true', () => {
    const blocked = WorkOrderStateMachine.validateTransition(
      { id: 'bt-1', statut: 'EN_COURS' },
      'CLOTURE',
      {
        action_realisee: 'Démontage arbre pour rectification atelier',
        hasOpenWorkshopOrder: true,
        actorRole: 'ADMIN',
      }
    );

    expect(blocked.valid).toBe(false);
    expect(blocked.reason).toContain('Atelier');

    // Once workshop order is completed (hasOpenWorkshopOrder = false), closure from EN_ATTENTE_PDR or EN_ATTENTE_ATELIER is allowed
    const allowed = WorkOrderStateMachine.validateTransition(
      { id: 'bt-1', statut: 'EN_ATTENTE_ATELIER' },
      'CLOTURE',
      {
        action_realisee: 'Arbre rectifié à l’atelier et remonté sur machine',
        hasOpenWorkshopOrder: false,
        actorRole: 'ADMIN',
      }
    );

    expect(allowed.valid).toBe(true);
    expect(allowed.fromStatus).toBe('EN_ATTENTE_PDR');
    expect(allowed.toStatus).toBe('CLOTURE');
  });

  it('3. syncs Bon d’Atelier with parent BT, prevents premature BT closure while open, and rolls up cout_atelier + cout_pdr on closure', () => {
    const store = useGmaoStore.getState();

    // 1. Seed active machine and spare part
    store.setMachines([
      {
        id_machine_registered: 'MACH-ATEL-01',
        code: 'MACH-ATEL-01',
        nom: 'Extrudeuse Principale',
        id_zone_default: 'Z-PROD',
        status: 'EN_SERVICE',
      } as any,
    ]);

    store.setRawStock([
      {
        ref: 'ROUL-6205',
        designation: 'Roulement 6205 SKF',
        stockInitial: 10,
        prix: 150,
        seuil: 2,
      } as any,
    ]);

    // 2. Create Corrective Demande -> Promote to BT (EN_COURS)
    const demande = useGmaoStore.getState().handleAddDemandeIntervention({
      code_machine: 'MACH-ATEL-01',
      anomalie: 'Usure portée arbre + roulement grippé',
      type_panne: 'Mécanique',
      priorite: 'Haute',
    });

    const bt = useGmaoStore.getState().handleConvertToBt(demande.id, {
      num_bt: 'BT-ATEL-101',
      intervenant: 'Tech Atelier',
      travail_a_faire: 'Rectification arbre à l’atelier + remplacement roulement',
    });
    expect(bt).toBeTruthy();

    // 3. Create linked Bon d'Atelier (ATELIER_MECANIQUE) while BT is open
    const bonAtelier = useGmaoStore.getState().handleAddSortieExterne({
      categorie_flux: 'ATELIER_MECANIQUE',
      id_machine: 'MACH-ATEL-01',
      id_corrective: bt.num_bt,
      designation_moteur: 'Arbre Extrudeuse MACH-ATEL-01',
      nature_travail: 'Usinage / Rectification',
      fournisseur_externe: 'Atelier Mécanique Interne',
      cout_bobinage: 400,
    });

    expect(bonAtelier.code).toBe('BON-ATEL-001');
    expect(bonAtelier.etat).toBe('En cours atelier');

    // Verify parent BT was automatically linked and synced with workshop fields
    const syncedBt = useGmaoStore
      .getState()
      .correctiveInterventions.find((i: any) => i.id === bt.id);
    expect(syncedBt?.code_sortie_atelier).toBe('BON-ATEL-001');
    expect(syncedBt?.cout_atelier).toBe(400);
    expect(syncedBt?.cout_total).toBe(400);

    // 4. Attempt to close BT while Bon d'Atelier is still 'En cours atelier' -> MUST BE BLOCKED
    const blockedClosure = useGmaoStore.getState().handleClotureIntervention(bt.id, {
      actorRole: 'ADMIN',
      action_realisee: 'Tentative clôture avant fin usinage',
      intervention_nature: 'ATELIER',
    });
    expect(blockedClosure).toBeNull();

    const stillOpenBt = useGmaoStore
      .getState()
      .correctiveInterventions.find((i: any) => i.id === bt.id);
    expect(stillOpenBt?.statut).not.toBe('CLOTURE');

    // 5. Mark Bon d'Atelier as 'Retourné OK' with final workshop cost = 550 DH
    useGmaoStore.getState().handleMarkSortieReturned(bonAtelier.id, 550);

    const afterReturnBt = useGmaoStore
      .getState()
      .correctiveInterventions.find((i: any) => i.id === bt.id);
    expect(afterReturnBt?.cout_atelier).toBe(550);

    // 6. Now close BT with 2 bearings (2 * 150 = 300 DH PDR) -> MUST SUCCEED and compute cout_total = 300 + 550 = 850 DH
    const closedBt = useGmaoStore.getState().handleClotureIntervention(bt.id, {
      actorRole: 'ADMIN',
      action_realisee: 'Arbre rectifié remonté + 2 roulements 6205 remplacés',
      intervention_nature: 'ATELIER',
      pieces_utilisees: [
        {
          ref: 'ROUL-6205',
          designation: 'Roulement 6205 SKF',
          quantite: 2,
          prix_unitaire: 150,
        },
      ],
    });

    expect(closedBt).toBeTruthy();
    expect(closedBt?.statut).toBe('CLOTURE');
    expect(closedBt?.cout_pdr).toBe(300);
    expect(closedBt?.cout_atelier).toBe(550);
    expect(closedBt?.cout_total).toBe(850);
  });

  it('4. COR-ATELIER-P0: creates a WorkshopOrder (REALISATION) linked to id_bt, persists in STORAGE_KEYS.WORKSHOP_ORDERS, and does not touch stock movements', () => {
    const year = new Date().getFullYear();
    const order = useGmaoStore.getState().handleCreateWorkshopOrder({
      type_demande: 'REALISATION',
      id_machine: 'PRESS-HYD-02',
      id_bt: 'BT-2026-501',
      quantite: 2,
      description_travaux: 'Confection de 2 bagues de guidage en bronze Ø60x85',
      observation: 'Tolérance H7/g6',
    });

    expect(order).toBeTruthy();
    expect(order?.code_bon).toBe(`BR-${year}-001`);
    expect(order?.type_demande).toBe('REALISATION');
    expect(order?.statut).toBe('EMIS');
    expect(order?.id_machine).toBe('PRESS-HYD-02');
    expect(order?.id_bt).toBe('BT-2026-501');
    expect(order?.quantite).toBe(2);
    expect(order?.emetteur_section).toBe('SM');
    expect(order?.destinataire).toBe('Atelier Fabrication Mécanique');

    // Persisted in STORAGE_KEYS.WORKSHOP_ORDERS
    const persisted = storageService.getItem(STORAGE_KEYS.WORKSHOP_ORDERS);
    expect(Array.isArray(persisted)).toBe(true);
    expect(persisted).toHaveLength(1);
    expect(persisted[0].code_bon).toBe(`BR-${year}-001`);

    // Zero stock movement or SortieExterne pollution
    expect(useGmaoStore.getState().mouvements).toHaveLength(0);
    expect(useGmaoStore.getState().sortiesExterne).toHaveLength(0);
  });

  it('5. COR-ATELIER-P0: enforces guarded FSM transitions (EMIS -> EN_COURS_FABRICATION -> PRET_LIVRAISON -> RECEPTIONNE_MONTAGE) and rejects illegal jumps', () => {
    // Valid step 1: EMIS -> EN_COURS_FABRICATION
    const step1 = validateWorkshopOrderTransition('EMIS', 'EN_COURS_FABRICATION');
    expect(step1.valid).toBe(true);
    expect(step1.normalizedTarget).toBe('EN_COURS_FABRICATION');

    // Invalid jump: EMIS -> RECEPTIONNE_MONTAGE (skipping fabrication & prêt livraison)
    const illegalJump = validateWorkshopOrderTransition('EMIS', 'RECEPTIONNE_MONTAGE');
    expect(illegalJump.valid).toBe(false);
    expect(illegalJump.reason).toContain('Transition non autorisée');

    // Terminal states cannot transition further
    const fromTerminal = validateWorkshopOrderTransition(
      'RECEPTIONNE_MONTAGE',
      'EN_COURS_FABRICATION'
    );
    expect(fromTerminal.valid).toBe(false);

    const fromCancelled = validateWorkshopOrderTransition('ANNULE', 'EN_COURS_FABRICATION');
    expect(fromCancelled.valid).toBe(false);
  });

  it('6. COR-ATELIER-P0: creating a WorkshopOrder from an open BT sets BT to EN_ATTENTE_PDR (never CLOTURE / action_fermee=OUI) and blocks BT closure until RECEPTIONNE_MONTAGE', () => {
    const demande = useGmaoStore.getState().handleAddDemandeIntervention({
      code_machine: 'TOUR-CNC-04',
      anomalie: 'Jeu excessif palier broche',
      type_panne: 'Mécanique',
      priorite: 'Urgente',
    });

    const bt = useGmaoStore.getState().handleConvertToBt(demande.id, {
      num_bt: 'BT-CNC-404',
      intervenant: 'Karim SM',
      travail_a_faire: 'Rectification entretoise palier broche',
    });
    expect(bt?.statut).toBe('EN_COURS');
    expect(bt?.action_fermee).toBe('NON');

    // Emit RECTIFICATION workshop order linked to BT-CNC-404
    const rectOrder = useGmaoStore.getState().handleCreateWorkshopOrder({
      type_demande: 'RECTIFICATION',
      id_machine: 'TOUR-CNC-04',
      id_bt: bt.num_bt,
      quantite: 1,
      description_travaux: 'Rectification plane entretoise palier broche (-0.15mm)',
    });
    expect(rectOrder).toBeTruthy();
    expect(rectOrder?.code_bon).toMatch(/^RECT-\d{4}-001$/);

    // Verify BT is placed in waiting status (EN_ATTENTE_PDR) and NOT closed
    const btAfterEmit = useGmaoStore
      .getState()
      .correctiveInterventions.find((i: any) => i.id === bt.id);
    expect(btAfterEmit?.statut).toBe('EN_ATTENTE_PDR');
    expect(btAfterEmit?.statut).not.toBe('CLOTURE');
    expect(btAfterEmit?.action_fermee).toBe('NON');
    expect(btAfterEmit?.code_bon_atelier).toBe(rectOrder?.code_bon);
    expect(btAfterEmit?.statut_bon_atelier).toBe('EMIS');

    // Attempt to close BT while WorkshopOrder is EMIS -> BLOCKED
    const blockedAtEmis = useGmaoStore.getState().handleClotureIntervention(bt.id, {
      actorRole: 'ADMIN',
      action_realisee: 'Essai clôture prématurée',
    });
    expect(blockedAtEmis).toBeNull();

    // Illegal jump on store handler EMIS -> RECEPTIONNE_MONTAGE -> REJECTED
    const badTransition = useGmaoStore
      .getState()
      .handleTransitionWorkshopOrderStatus(rectOrder!.id, 'RECEPTIONNE_MONTAGE');
    expect(badTransition.valid).toBe(false);

    // Valid progression: EMIS -> EN_COURS_FABRICATION -> PRET_LIVRAISON -> RECEPTIONNE_MONTAGE
    expect(
      useGmaoStore
        .getState()
        .handleTransitionWorkshopOrderStatus(rectOrder!.id, 'EN_COURS_FABRICATION').valid
    ).toBe(true);
    expect(
      useGmaoStore
        .getState()
        .handleTransitionWorkshopOrderStatus(rectOrder!.id, 'PRET_LIVRAISON').valid
    ).toBe(true);
    expect(
      useGmaoStore
        .getState()
        .handleTransitionWorkshopOrderStatus(rectOrder!.id, 'RECEPTIONNE_MONTAGE').valid
    ).toBe(true);

    // Even after RECEPTIONNE_MONTAGE, BT is NOT auto-closed without explicit corrective closure
    const btAfterReception = useGmaoStore
      .getState()
      .correctiveInterventions.find((i: any) => i.id === bt.id);
    expect(btAfterReception?.statut).toBe('EN_ATTENTE_PDR');
    expect(btAfterReception?.action_fermee).toBe('NON');
    expect(btAfterReception?.statut_bon_atelier).toBe('RECEPTIONNE_MONTAGE');

    // Now explicit BT closure succeeds
    const closedBt = useGmaoStore.getState().handleClotureIntervention(bt.id, {
      actorRole: 'ADMIN',
      action_realisee: 'Entretoise rectifiée réceptionnée et remontée sur palier broche',
      intervention_nature: 'ATELIER',
    });
    expect(closedBt).toBeTruthy();
    expect(closedBt?.statut).toBe('CLOTURE');
    expect(closedBt?.action_fermee).toBe('OUI');
  });
});

