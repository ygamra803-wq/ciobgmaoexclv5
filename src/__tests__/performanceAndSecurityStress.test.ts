import { describe, it, expect, beforeEach } from 'vitest';
import { IncrementalStockIndex, normalizeType } from '../application/IncrementalStockIndex';
import { StockCalculationService } from '../domain/pdr/services/StockCalculationService';
import {
  resolveEffectiveServerRole,
  canRoleMutateEntity,
  sanitizeBulkStateForRole,
  isWeakOrEmptyApiToken,
  evaluateServerApiTokenGuard,
} from '../core/security/serverRbacPolicy';
import { AuthorizationService } from '../core/security/AuthorizationService';
import { ROLES } from '../core/security/Roles';
import {
  mergeSingleRecord,
  mergeEntityCollection,
  mergeGmaoStateSnapshot,
  getRecordLifecycleRank,
} from '../services/lanStateMergeService';

const ALLOWED_ENTITIES = [
  'rawStock',
  'stock',
  'types',
  'designations',
  'machines',
  'generalSystemTypes',
  'families',
  'templates',
  'blueprints',
  'zones',
  'machineElementsLedger',
  'mouvements',
  'preventiveTasks',
  'preventiveActions',
  'preventiveGuides',
  'preventivePlans',
  'preventiveExecutions',
  'correctiveInterventions',
  'correctiveActionsByPanne',
  'correctivePanneCategories',
  'correctiveTravauxAFaire',
  'correctiveIntervenants',
  'users',
  'technicians',
  'operations',
  'warehouseItems',
  'entrepotComponents',
  'compGroups',
  'compFamilies',
  'compTemplates',
  'partTypes',
  'partDesignations',
  'sortiesExterne',
  'sortieDemands',
  'meterReadings',
  'replenishmentOrders',
  'workshopOrders',
  'auditEvents',
] as const;

describe('CIOB GMAO v4 — Performance, Security (RBAC) & LAN Concurrency Stress Suite', () => {
  // ============================================================================
  // 1. INCREMENTAL STOCK INDEX & STOCK CALCULATION STRESS TESTS
  // ============================================================================
  describe('1. IncrementalStockIndex & StockCalculationService Stress & Invariants', () => {
    let stockIdx: IncrementalStockIndex;

    beforeEach(() => {
      stockIdx = new IncrementalStockIndex();
      StockCalculationService.clearCache();
    });

    it('1.1 processes 5,000 articles and 50,000 movements in O(A + M) with 100% mathematical parity between IncrementalStockIndex and StockCalculationService', () => {
      const ARTICLE_COUNT = 5000;
      const MOVEMENT_COUNT = 50000;

      const initialStockMap = new Map<string, number>();
      const articles: Array<{ ref: string; designation: string; stockInitial: number; seuil: number }> = [];

      for (let i = 1; i <= ARTICLE_COUNT; i++) {
        const ref = `PDR-${String(i).padStart(5, '0')}`;
        const stockInitial = (i % 50) + 20; // 20..69
        initialStockMap.set(ref, stockInitial);
        articles.push({
          ref,
          designation: `Pièce industrielle #${i}`,
          stockInitial,
          seuil: 10,
        });
      }

      const entryAliases = ['ENTREE', 'Entrée Interne', 'Réception', 'Réapprovisionnement', 'retour atelier'];
      const sortieAliases = ['SORTIE', 'Sortie Interne', 'Bon de sortie', 'Consommation', 'OUT'];
      const movements: Array<{ id: string; ref: string; type: string; quantite: number }> = [];

      for (let m = 0; m < MOVEMENT_COUNT; m++) {
        const artIdx = (m % ARTICLE_COUNT) + 1;
        const ref = `PDR-${String(artIdx).padStart(5, '0')}`;
        const isEntree = m % 3 !== 0; // 2/3 entrées, 1/3 sorties
        const type = isEntree
          ? entryAliases[m % entryAliases.length]
          : sortieAliases[m % sortieAliases.length];
        const quantite = (m % 5) + 1;

        movements.push({
          id: `MVT-${m + 1}`,
          ref,
          type,
          quantite,
        });
      }

      const t0 = performance.now();
      stockIdx.rebuild(movements, initialStockMap);
      const rebuildMs = performance.now() - t0;

      const t1 = performance.now();
      const batchResults = StockCalculationService.calculateAllStocks(articles, movements);
      const batchCalcMs = performance.now() - t1;

      expect(stockIdx.isHydrated()).toBe(true);
      expect(stockIdx.hasData()).toBe(true);
      expect(rebuildMs).toBeLessThan(1500);
      expect(batchCalcMs).toBeLessThan(1500);
      expect(batchResults).toHaveLength(ARTICLE_COUNT);

      // Verify exact mathematical parity across all 5,000 references
      for (let i = 0; i < ARTICLE_COUNT; i++) {
        const res = batchResults[i];
        const idxStock = stockIdx.calculateCurrentStock(res.ref);
        const totals = stockIdx.getTotals(res.ref);
        expect(idxStock).toBe(res.stockActuel);
        expect(totals.entrees).toBe(res.entrees);
        expect(totals.sorties).toBe(res.sorties);
        expect(res.stockActuel).toBe(Math.max(0, res.stockInitial + res.entrees - res.sorties));
      }
    });

    it('1.2 preserves exact zero-drift invariant across 2,000 rapid applyDelta, updateDelta, and rollbackDelta cycles and tracks negative discrepancies', () => {
      const ref = 'ROUL-SKF-22210';
      stockIdx.setInitialStock(ref, 100);

      // Apply 2,000 delta cycles
      for (let i = 0; i < 2000; i++) {
        stockIdx.applyDelta({ ref, type: 'Entrée Interne', quantite: 10 });
        stockIdx.applyDelta({ ref, type: 'Bon de sortie', quantite: 4 });
        // Update sortie from 4 to 6
        stockIdx.updateDelta({
          ref,
          oldType: 'SORTIE',
          oldQty: 4,
          newType: 'SORTIE',
          newQty: 6,
        });
        // Rollback both (+10 entrée and -6 sortie)
        stockIdx.rollbackDelta({ ref, type: 'ENTREE', quantity: 10 });
        stockIdx.rollbackDelta({ ref, type: 'SORTIE', quantity: 6 });
      }

      // Must return to exact initial stock (100) with zero drift
      expect(stockIdx.calculatePhysicalStock(ref)).toBe(100);
      expect(stockIdx.calculateCurrentStock(ref)).toBe(100);
      expect(stockIdx.hasNegativeDiscrepancy(ref)).toBe(false);

      // Force an over-withdrawal of 135 units to verify unclamped physical vs clamped available stock
      stockIdx.applyDelta({ ref, type: 'SORTIE', quantite: 135 });
      const integrity = stockIdx.getStockIntegrity(ref);
      expect(integrity.physicalStock).toBe(-35);
      expect(integrity.availableStock).toBe(0);
      expect(integrity.hasNegativeDiscrepancy).toBe(true);
      expect(stockIdx.calculateCurrentStock(ref)).toBe(0);
      expect(stockIdx.calculateCurrentStock(ref, undefined, { allowNegative: true })).toBe(-35);
    });

    it('1.3 serializes 40 concurrent async withdrawals via queueConcurrentMovement with zero race-condition overdrafts', async () => {
      const ref = 'COURROIE-HTD-8M';
      const article = { ref, designation: 'Courroie HTD 8M', stockInitial: 15, seuil: 3 };
      const committedMovements: Array<{ id: string; ref: string; type: string; quantite: number }> = [];

      // Launch 40 simultaneous withdrawals of 1 unit each against an initial stock of 15
      const tasks = Array.from({ length: 40 }, (_, idx) =>
        StockCalculationService.queueConcurrentMovement(ref, async () => {
          // Simulate asynchronous I/O jitter (0..2ms)
          await new Promise((r) => setTimeout(r, idx % 3));
          const check = StockCalculationService.checkAvailability(ref, 1, article, committedMovements);
          if (!check.available) {
            return { accepted: false, reason: check.message };
          }
          committedMovements.push({
            id: `MVT-CONC-${idx + 1}`,
            ref,
            type: 'SORTIE',
            quantite: 1,
          });
          return { accepted: true, remaining: check.currentStock - 1 };
        })
      );

      const outcomes = await Promise.all(tasks);
      const acceptedCount = outcomes.filter((o) => o.accepted).length;
      const rejectedCount = outcomes.filter((o) => !o.accepted).length;

      expect(acceptedCount).toBe(15);
      expect(rejectedCount).toBe(25);
      expect(committedMovements).toHaveLength(15);
      expect(StockCalculationService.calculateStockActuel(article, committedMovements)).toBe(0);
    });

    it('1.4 normalizes accented and case-varied movement types deterministically and ignores unknown types', () => {
      expect(normalizeType('  Entrée Externe ')).toBe('ENTREE');
      expect(normalizeType('RÉAPPROVISIONNEMENT')).toBe('ENTREE');
      expect(normalizeType('Bon de Sortie')).toBe('SORTIE');
      expect(normalizeType('COMMANDE_FOURNISSEUR')).toBe('COMMANDE');
      expect(normalizeType('FABRICATION_ATELIER')).toBeNull();
    });
  });

  // ============================================================================
  // 2. RBAC, PRIVILEGE ESCALATION & MAKER-CHECKER SECURITY STRESS TESTS
  // ============================================================================
  describe('2. RBAC Boundaries, Anti-Spoofing & Maker-Checker Security Stress', () => {
    const dbUsers = [
      { id: 'USR-ADMIN-1', username: 'admin.ciob', nom: 'Admin Principal', role: 'ADMIN', is_active: true },
      { id: 'USR-MAG-1', username: 'magasin.ciob', nom: 'Resp Magasin', role: 'RESPONSABLE_MAGASIN', is_active: true },
      { id: 'USR-OP-1', username: 'operateur.1', nom: 'Opérateur Presse', role: 'OPERATEUR', is_active: true },
      { id: 'USR-ARCH-1', username: 'ex.admin', nom: 'Ancien Admin', role: 'ADMIN', is_active: false, statut: 'ARCHIVE' },
    ];

    const dbTechnicians = [
      { id_technician: 'TECH-01', nom: 'Karim Maintenance', role: 'TECHNICIEN', is_active: true },
      { id_technician: 'TECH-ARCH-02', nom: 'Tech Inactif', role: 'TECHNICIEN', actif: false },
    ];

    it('2.1 blocks vertical privilege escalation (role spoofing) and archived actors in resolveEffectiveServerRole', () => {
      // Case A: Generic/anonymous actor claiming ADMIN -> downgraded to VIEWER
      const anonSpoof = resolveEffectiveServerRole(
        { 'x-gmao-role': 'ADMIN', 'x-gmao-actor': 'web-operator' },
        dbUsers,
        dbTechnicians
      );
      expect(anonSpoof.effectiveRole).toBe('VIEWER');
      expect(anonSpoof.roleSpoofDetected).toBe(true);

      // Case B: Registered TECHNICIEN claiming ADMIN -> clamped to TECHNICIEN
      const techSpoof = resolveEffectiveServerRole(
        { 'x-gmao-role': 'ADMIN', 'x-gmao-actor-id': 'TECH-01', 'x-gmao-actor': 'Karim Maintenance' },
        dbUsers,
        dbTechnicians
      );
      expect(techSpoof.claimedRole).toBe('ADMIN');
      expect(techSpoof.effectiveRole).toBe('TECHNICIEN');
      expect(techSpoof.roleSpoofDetected).toBe(true);

      // Case C: Registered OPERATEUR claiming RESPONSABLE_MAINTENANCE -> clamped to OPERATEUR
      const opSpoof = resolveEffectiveServerRole(
        { 'x-gmao-role': 'RESPONSABLE_MAINTENANCE', 'x-gmao-actor-id': 'USR-OP-1' },
        dbUsers,
        dbTechnicians
      );
      expect(opSpoof.effectiveRole).toBe('OPERATEUR');
      expect(opSpoof.roleSpoofDetected).toBe(true);

      // Case D: Archived ADMIN attempting to act -> forced to VIEWER + isArchivedActor = true
      const archivedAdmin = resolveEffectiveServerRole(
        { 'x-gmao-role': 'ADMIN', 'x-gmao-actor-id': 'USR-ARCH-1' },
        dbUsers,
        dbTechnicians
      );
      expect(archivedAdmin.isArchivedActor).toBe(true);
      expect(archivedAdmin.effectiveRole).toBe('VIEWER');

      // Case E: Archived TECHNICIEN attempting to act -> forced to VIEWER + isArchivedActor = true
      const archivedTech = resolveEffectiveServerRole(
        { 'x-gmao-role': 'TECHNICIEN', 'x-gmao-actor-id': 'TECH-ARCH-02' },
        dbUsers,
        dbTechnicians
      );
      expect(archivedTech.isArchivedActor).toBe(true);
      expect(archivedTech.effectiveRole).toBe('VIEWER');
    });

    it('2.2 enforces per-entity mutation matrix and append-only audit ledger protection in canRoleMutateEntity', () => {
      // VIEWER cannot mutate anything
      expect(canRoleMutateEntity('VIEWER', 'correctiveInterventions', 'POST').allowed).toBe(false);
      expect(canRoleMutateEntity('VIEWER', 'workshopOrders', 'POST').allowed).toBe(false);

      // auditEvents is strictly append-only (PUT/DELETE forbidden even for ADMIN)
      expect(canRoleMutateEntity('ADMIN', 'auditEvents', 'DELETE').allowed).toBe(false);
      expect(canRoleMutateEntity('ADMIN', 'auditEvents', 'PUT').allowed).toBe(false);
      expect(canRoleMutateEntity('ADMIN', 'auditEvents', 'POST').allowed).toBe(true);

      // TECHNICIEN & OPERATEUR cannot directly mutate stock ledger or admin entities
      for (const role of ['TECHNICIEN', 'OPERATEUR']) {
        expect(canRoleMutateEntity(role, 'rawStock', 'POST').allowed).toBe(false);
        expect(canRoleMutateEntity(role, 'stock', 'PUT').allowed).toBe(false);
        expect(canRoleMutateEntity(role, 'mouvements', 'POST').allowed).toBe(false);
        expect(canRoleMutateEntity(role, 'replenishmentOrders', 'POST').allowed).toBe(false);
        expect(canRoleMutateEntity(role, 'users', 'POST').allowed).toBe(false);
        expect(canRoleMutateEntity(role, 'zones', 'PUT').allowed).toBe(false);
        expect(canRoleMutateEntity(role, 'machines', 'DELETE').allowed).toBe(false);
        expect(canRoleMutateEntity(role, 'blueprints', 'DELETE').allowed).toBe(false);

        // Allowed field operational entities
        expect(canRoleMutateEntity(role, 'sortieDemands', 'POST').allowed).toBe(true);
        expect(canRoleMutateEntity(role, 'correctiveInterventions', 'POST').allowed).toBe(true);
        expect(canRoleMutateEntity(role, 'workshopOrders', 'POST').allowed).toBe(true);
      }

      // RESPONSABLE_MAGASIN can mutate stock & movements, but cannot modify users or delete machines
      expect(canRoleMutateEntity('RESPONSABLE_MAGASIN', 'rawStock', 'POST').allowed).toBe(true);
      expect(canRoleMutateEntity('RESPONSABLE_MAGASIN', 'mouvements', 'POST').allowed).toBe(true);
      expect(canRoleMutateEntity('RESPONSABLE_MAGASIN', 'users', 'POST').allowed).toBe(false);
      expect(canRoleMutateEntity('RESPONSABLE_MAGASIN', 'machines', 'DELETE').allowed).toBe(false);
    });

    it('2.3 strips unauthorized entity slices and clamps self-approved Maker-Checker payloads from TECHNICIEN in sanitizeBulkStateForRole', () => {
      const currentServerState = {
        correctiveInterventions: [
          { id: 'BT-ALREADY-OK', statut: 'CLOTURE', validation_status: 'APPROVED', stock_deducted: true },
        ],
        sortieDemands: [
          { id: 'DEM-OPEN-1', validation_status: 'PENDING_VALIDATION', stock_deducted: false },
        ],
      };

      const maliciousTechPayload = {
        expectedVersion: 4,
        users: [{ id: 'HACK-ADMIN', role: 'ADMIN' }],
        rawStock: [{ ref: 'PDR-1', stockInitial: 9999 }],
        mouvements: [{ id: 'MVT-BYPASS', ref: 'PDR-1', type: 'SORTIE', quantite: 50 }],
        workshopOrders: [{ id: 'BR-1', code_bon: 'BR-2026-001', statut: 'EMIS' }],
        correctiveInterventions: [
          // Already approved on server -> should remain APPROVED / CLOTURE
          { id: 'BT-ALREADY-OK', statut: 'CLOTURE', validation_status: 'APPROVED', stock_deducted: true },
          // New self-approval attempt by technician -> MUST be clamped to PENDING_VALIDATION & EN_COURS
          { id: 'BT-SELF-APPROVE', statut: 'CLOTURE', action_fermee: 'OUI', validation_status: 'APPROVED', stock_deducted: true },
        ],
        sortieDemands: [
          // Attempt to flip pending demand to APPROVED + stock_deducted: true -> MUST be clamped
          { id: 'DEM-OPEN-1', validation_status: 'APPROVED', stock_deducted: true },
        ],
      };

      const res = sanitizeBulkStateForRole('TECHNICIEN', maliciousTechPayload, currentServerState);
      expect(res.allowed).toBe(true);
      expect(res.strippedKeys).toEqual(expect.arrayContaining(['users', 'rawStock', 'mouvements']));
      expect(res.sanitizedState.users).toBeUndefined();
      expect(res.sanitizedState.rawStock).toBeUndefined();
      expect(res.sanitizedState.mouvements).toBeUndefined();
      expect(res.sanitizedState.workshopOrders).toHaveLength(1);

      const btAlreadyOk = res.sanitizedState.correctiveInterventions.find((i: any) => i.id === 'BT-ALREADY-OK');
      expect(btAlreadyOk.statut).toBe('CLOTURE');
      expect(btAlreadyOk.validation_status).toBe('APPROVED');

      const btSelfApprove = res.sanitizedState.correctiveInterventions.find((i: any) => i.id === 'BT-SELF-APPROVE');
      expect(btSelfApprove.validation_status).toBe('PENDING_VALIDATION');
      expect(btSelfApprove.stock_deducted).toBe(false);
      expect(btSelfApprove.statut).toBe('EN_COURS');
      expect(btSelfApprove.action_fermee).toBe('NON');

      const clampedDemand = res.sanitizedState.sortieDemands[0];
      expect(clampedDemand.validation_status).toBe('PENDING_VALIDATION');
      expect(clampedDemand.stock_deducted).toBe(false);

      // Verify replaceAll is rejected for non-admin/non-supervisor roles
      const replaceAttempt = sanitizeBulkStateForRole('TECHNICIEN', { replaceAll: true }, currentServerState);
      expect(replaceAttempt.allowed).toBe(false);
    });

    it('2.4 enforces GMAO_API_TOKEN strength and production write protection in evaluateServerApiTokenGuard', () => {
      expect(isWeakOrEmptyApiToken('')).toBe(true);
      expect(isWeakOrEmptyApiToken('change-me')).toBe(true);
      expect(isWeakOrEmptyApiToken('123456')).toBe(true);
      expect(isWeakOrEmptyApiToken('short7')).toBe(true);
      expect(isWeakOrEmptyApiToken('Strong_Prod_Token_2026!@#')).toBe(false);

      // Production write with weak server token -> rejected with 401
      const prodWeakWrite = evaluateServerApiTokenGuard({
        method: 'POST',
        providedToken: 'change-me',
        expectedToken: 'change-me',
        isProduction: true,
      });
      expect(prodWeakWrite.allowed).toBe(false);
      expect(prodWeakWrite.statusCode).toBe(401);

      // Production write with strong matching token -> allowed
      const prodStrongWrite = evaluateServerApiTokenGuard({
        method: 'POST',
        providedToken: 'Strong_Prod_Token_2026!@#',
        expectedToken: 'Strong_Prod_Token_2026!@#',
        isProduction: true,
      });
      expect(prodStrongWrite.allowed).toBe(true);

      // Mismatched token in dev or prod -> rejected with 401
      const mismatch = evaluateServerApiTokenGuard({
        method: 'GET',
        providedToken: 'Wrong_Token_Value',
        expectedToken: 'Strong_Prod_Token_2026!@#',
        isProduction: false,
      });
      expect(mismatch.allowed).toBe(false);
      expect(mismatch.statusCode).toBe(401);
    });

    it('2.5 enforces client-side AuthorizationService fail-closed guards and tab access matrix', () => {
      expect(AuthorizationService.hasPermission(null, 'stock.view')).toBe(false);
      expect(AuthorizationService.hasPermission({ role: ROLES.ADMIN }, 'non.existent.permission')).toBe(false);
      expect(AuthorizationService.isReadOnly(ROLES.VIEWER)).toBe(true);
      expect(AuthorizationService.isReadOnly(ROLES.TECHNICIEN)).toBe(false);

      // Workshop permissions: TECHNICIEN can view and create Bon d'Atelier, but only ADMIN/RESPONSABLE_MAINTENANCE can manage
      expect(AuthorizationService.hasPermission(ROLES.TECHNICIEN, 'workshop.view')).toBe(true);
      expect(AuthorizationService.hasPermission(ROLES.TECHNICIEN, 'workshop.create')).toBe(true);
      expect(AuthorizationService.hasPermission(ROLES.TECHNICIEN, 'workshop.manage')).toBe(false);
      expect(AuthorizationService.hasPermission(ROLES.RESPONSABLE_MAINTENANCE, 'workshop.manage')).toBe(true);

      // Tab access matrix
      expect(AuthorizationService.canAccessTab(ROLES.TECHNICIEN, 'corrective_atelier')).toBe(true);
      expect(AuthorizationService.canAccessTab(ROLES.TECHNICIEN, 'settings')).toBe(false);
      expect(AuthorizationService.canAccessTab(ROLES.OPERATEUR, 'corrective_di')).toBe(true);
      expect(AuthorizationService.canAccessTab(ROLES.OPERATEUR, 'validation_center')).toBe(false);
    });
  });

  // ============================================================================
  // 3. LAN HOST MULTI-DEVICE SYNC & OPTIMISTIC CONCURRENCY STRESS TESTS
  // ============================================================================
  describe('3. LAN Host Multi-Device Sync & Optimistic Concurrency Stress', () => {
    it('3.1 prevents Maker-Checker lifecycle regression even when an offline client pushes a newer timestamp (clock skew protection)', () => {
      const approvedOnServer = {
        id: 'BT-2026-900',
        num_bt: 'BT-2026-900',
        statut: 'CLOTURE',
        validation_status: 'APPROVED',
        stock_deducted: true,
        updated_at: '2026-11-10T10:00:00.000Z',
        validated_by: 'Chef Maintenance',
      };

      // Stale draft from a tablet with clock skewed +2 hours ahead
      const staleTabletDraftWithFutureClock = {
        id: 'BT-2026-900',
        num_bt: 'BT-2026-900',
        statut: 'EN_COURS',
        validation_status: 'PENDING_VALIDATION',
        stock_deducted: false,
        updated_at: '2026-11-10T12:00:00.000Z',
        observation: 'Note ajoutée hors-ligne',
      };

      expect(getRecordLifecycleRank(approvedOnServer)).toBeGreaterThan(
        getRecordLifecycleRank(staleTabletDraftWithFutureClock)
      );

      const merged = mergeSingleRecord(approvedOnServer, staleTabletDraftWithFutureClock);
      expect(merged.statut).toBe('CLOTURE');
      expect(merged.validation_status).toBe('APPROVED');
      expect(merged.stock_deducted).toBe(true);
      expect(merged.validated_by).toBe('Chef Maintenance');
      // Non-conflicting field from incoming draft is preserved
      expect(merged.observation).toBe('Note ajoutée hors-ligne');
    });

    it('3.2 merges 25 concurrent simulated LAN client syncs across correctiveInterventions, workshopOrders, and mouvements without lost updates', () => {
      const objectEntitySet = new Set(['correctiveActionsByPanne', 'correctivePanneCategories']);
      const serverState: Record<string, any> = {
        rawStock: [{ ref: 'ROUL-6204', stockInitial: 50 }],
        stock: [{ ref: 'ROUL-6204', stockInitial: 50 }],
        correctiveInterventions: [{ id: 'DI-BASE-0', statut: 'DEMANDE', updated_at: '2026-11-10T08:00:00Z' }],
        workshopOrders: [],
        mouvements: [],
      };

      // Simulate 25 mobile/desktop LAN clients pushing concurrent updates without full state knowledge
      for (let clientIdx = 1; clientIdx <= 25; clientIdx++) {
        const incomingClientState = {
          correctiveInterventions: [
            {
              id: `BT-LAN-${clientIdx}`,
              num_bt: `BT-LAN-${clientIdx}`,
              statut: 'EN_COURS',
              updated_at: `2026-11-10T09:${String(clientIdx).padStart(2, '0')}:00Z`,
            },
          ],
          workshopOrders: [
            {
              id: `BR-LAN-${clientIdx}`,
              code_bon: `BR-2026-${String(clientIdx).padStart(3, '0')}`,
              type_demande: 'REALISATION',
              statut: 'EMIS',
              id_machine: `M-${clientIdx}`,
            },
          ],
          mouvements: [
            {
              id: `MVT-LAN-${clientIdx}`,
              ref: 'ROUL-6204',
              type: 'SORTIE',
              quantite: 1,
              date: '2026-11-10',
            },
          ],
        };

        mergeGmaoStateSnapshot(serverState, incomingClientState, ALLOWED_ENTITIES, objectEntitySet, {
          preserveServerOnlyItems: true,
        });
      }

      // All 25 concurrent client records + initial server record must be preserved (0 lost updates)
      expect(serverState.correctiveInterventions).toHaveLength(26);
      expect(serverState.workshopOrders).toHaveLength(25);
      expect(serverState.mouvements).toHaveLength(25);

      // Now simulate an explicit deletion of BT-LAN-5 and BR-LAN-5 by a supervisor
      mergeGmaoStateSnapshot(
        serverState,
        {
          correctiveInterventions: serverState.correctiveInterventions.filter((i: any) => i.id !== 'BT-LAN-5'),
          workshopOrders: serverState.workshopOrders.filter((w: any) => w.id !== 'BR-LAN-5'),
          deletedIdsByEntity: {
            correctiveInterventions: ['BT-LAN-5'],
            workshopOrders: ['BR-LAN-5'],
          },
        },
        ALLOWED_ENTITIES,
        objectEntitySet,
        { preserveServerOnlyItems: true }
      );

      expect(serverState.correctiveInterventions).toHaveLength(25);
      expect(serverState.correctiveInterventions.some((i: any) => i.id === 'BT-LAN-5')).toBe(false);
      expect(serverState.workshopOrders).toHaveLength(24);
      expect(serverState.workshopOrders.some((w: any) => w.id === 'BR-LAN-5')).toBe(false);
    });

    it('3.3 deduplicates composite-keyed movements (MVT::bon::ref::type::date) during multi-device retry storms', () => {
      const existingServerMovements = [
        {
          code_bon: 'BS-2026-777',
          ref: 'FILTRE-HUILE-01',
          type: 'SORTIE',
          quantite: 2,
          date: '2026-11-10',
        },
      ];

      // Client retries sending the same movement without an explicit `id`
      const retriedClientMovements = [
        {
          code_bon: 'BS-2026-777',
          ref: 'FILTRE-HUILE-01',
          type: 'SORTIE',
          quantite: 2,
          date: '2026-11-10',
        },
        {
          code_bon: 'BS-2026-778',
          ref: 'FILTRE-AIR-02',
          type: 'SORTIE',
          quantite: 1,
          date: '2026-11-10',
        },
      ];

      const merged = mergeEntityCollection('mouvements', existingServerMovements, retriedClientMovements, {
        preserveServerOnlyItems: true,
      });

      expect(merged).toHaveLength(2);
    });
  });
});
