import { describe, it, expect, beforeEach } from 'vitest';
import {
  normalizePolicyTags,
  getEffectivePolicyTags,
  getSuggestedChannels,
  suggestWorkshopType,
  validateNeedRequestTransition,
} from '../domain/corrective/needRequestService';
import { useGmaoStore } from '../store/useGmaoStore';
import { storageService } from '../utils/storageService';
import { STORAGE_KEYS } from '../infrastructure/persistence/storageKeys';

describe('POLICY-TAGS-P0 — Material Policy Tags & Channel Guidance (REPLACING / REPAIRABLE / MODIFYING)', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    useGmaoStore.setState({
      machines: [
        {
          id: 'PRESS-01',
          id_machine_registered: 'PRESS-01',
          designation: 'Presse Hydraulique 200T',
          status: 'OPERATIONNELLE',
        } as any,
      ],
      rawStock: [
        {
          id: 'PDR-RLM-6205',
          ref: 'RLM-6205',
          designation: 'Roulement Rigide à Billes 6205',
          stockInitial: 10,
          stockActuel: 10,
          policy_tags: ['REPLACING'],
        } as any,
      ],
      partDesignations: [
        {
          id: 'PART-FLASQUE',
          ref: 'FLASQUE-01',
          designation: 'Flasque palier bronze',
          policy_tags: ['REPAIRABLE', 'MODIFYING'],
        } as any,
        {
          id: 'PART-AXE-STD',
          ref: 'AXE-STD-20',
          designation: 'Axe standard trempé Ø20',
          policy_tags: ['REPLACING'],
        } as any,
      ],
      warehouseItems: [
        {
          id: 'COMP-MTR-15KW',
          code: 'MTR-15KW',
          designation: 'Moteur Asynchrone 15kW 1500tr/min',
          nature: 'COMPOSANT',
          policy_tags: ['REPAIRABLE'],
        } as any,
      ],
      mouvements: [],
      workshopOrders: [],
      needRequests: [],
      correctiveInterventions: [
        {
          id: 'bt-policy-1',
          num_bt: 'BT-2026-101',
          code_machine: 'PRESS-01',
          anomalie: 'Vibrations et usure palier',
          statut: 'EN_COURS',
          action_fermee: 'NON',
          intervenant: 'Karim Tech',
        } as any,
      ],
    });
  });

  it('1. PDR without tags -> effective [REPLACING] -> channels [STOCK, ACHAT] only (ignores ATELIER suggestion)', () => {
    // 1a. Normalization and fallback on empty
    expect(normalizePolicyTags(null)).toEqual([]);
    expect(normalizePolicyTags(['replacing', '  ', 'REPLACING'])).toEqual(['REPLACING']);

    // 1b. getEffectivePolicyTags for PDR strictly resolves to ['REPLACING'] even if entity is unconfigured
    const effectiveEmpty = getEffectivePolicyTags(null, 'PDR');
    expect(effectiveEmpty).toEqual(['REPLACING']);

    const effectiveEntityWithoutTags = getEffectivePolicyTags({ ref: 'RLM-100' }, 'PDR');
    expect(effectiveEntityWithoutTags).toEqual(['REPLACING']);

    // Even if stray tags are accidentally passed, PDR catalog filters out MODIFYING/REPAIRABLE
    const effectiveStray = getEffectivePolicyTags(
      { policy_tags: ['REPAIRABLE', 'MODIFYING'] },
      'PDR'
    );
    expect(effectiveStray).toEqual(['REPLACING']);

    // 1c. Channel suggestion for PDR is strictly STOCK and ACHAT
    const pdrChannels = getSuggestedChannels('PDR', effectiveEmpty);
    expect(pdrChannels).toEqual(['STOCK', 'ACHAT']);
    expect(pdrChannels).not.toContain('ATELIER');
    expect(pdrChannels).not.toContain('EXTERNE');

    // Workshop type for PDR is always null (cannot fabricate standard catalog bearing)
    expect(suggestWorkshopType(effectiveEmpty, 'PDR')).toBeNull();
  });

  it('2. PART with [MODIFYING, REPAIRABLE] -> channels include ATELIER; suggestWorkshopType -> RECTIFICATION', () => {
    const tags = ['MODIFYING', 'REPAIRABLE'] as const;
    const effective = getEffectivePolicyTags({ policy_tags: tags }, 'PART');
    expect(effective).toEqual(['MODIFYING', 'REPAIRABLE']);

    const channels = getSuggestedChannels('PART', effective);
    expect(channels).toContain('ATELIER');
    expect(channels).toContain('STOCK');
    expect(channels).toContain('ACHAT');
    expect(channels).toContain('EXTERNE');

    // Prefer RECTIFICATION when part is repairable/modifiable
    const workshopType = suggestWorkshopType(effective, 'PART');
    expect(workshopType).toBe('RECTIFICATION');
  });

  it('3. PART with [REPLACING] only -> still allows STOCK/ACHAT/ATELIER; suggestWorkshopType -> REALISATION', () => {
    const tags = ['REPLACING'] as const;
    const channels = getSuggestedChannels('PART', tags);

    // Can be taken from stock, bought, or manufactured fresh (REALISATION)
    expect(channels).toContain('STOCK');
    expect(channels).toContain('ACHAT');
    expect(channels).toContain('ATELIER');

    const workshopType = suggestWorkshopType(tags, 'PART');
    expect(workshopType).toBe('REALISATION');
  });

  it('4. COMPONENT with [REPAIRABLE] -> includes EXTERNE and ATELIER; not reduced to STOCK only', () => {
    const tags = ['REPAIRABLE'] as const;
    const channels = getSuggestedChannels('COMPONENT', tags);

    // Motor / pump / gear reducer repair prioritizes EXTERNE / ATELIER / ACHAT
    expect(channels).toEqual(['EXTERNE', 'ATELIER', 'ACHAT']);
    expect(channels).toContain('EXTERNE');
    expect(channels).toContain('ATELIER');
    expect(channels).not.toContain('STOCK');

    const workshopType = suggestWorkshopType(tags, 'COMPONENT');
    expect(workshopType).toBe('RECTIFICATION');

    // If COMPONENT is strictly REPLACING:
    const replacingCompChannels = getSuggestedChannels('COMPONENT', ['REPLACING']);
    expect(replacingCompChannels).toEqual(['ACHAT', 'EXTERNE']);
  });

  it('5. NeedRequest creation captures policy_tags_snapshot and is immune to later catalog edits (Snapshot Invariance)', () => {
    const store = useGmaoStore.getState();

    // 5a. Create NeedRequest linking to PART-FLASQUE (which currently has ['REPAIRABLE', 'MODIFYING'])
    const createdNeed = store.handleCreateNeedRequest({
      id_machine: 'PRESS-01',
      id_bt: 'BT-2026-101',
      material_class: 'PART',
      id_part: 'FLASQUE-01',
      quantite: 1,
      description_besoin: 'Usinage rectification portée flasque',
    });

    expect(createdNeed).not.toBeNull();
    expect(createdNeed?.policy_tags_snapshot).toEqual(['REPAIRABLE', 'MODIFYING']);

    // Check persistence
    const savedRequests = storageService.getItem(STORAGE_KEYS.NEED_REQUESTS);
    expect(savedRequests[0].policy_tags_snapshot).toEqual(['REPAIRABLE', 'MODIFYING']);

    // 5b. Now mutate the catalog definition of PART-FLASQUE to only ['REPLACING']
    useGmaoStore.setState({
      partDesignations: [
        {
          id: 'PART-FLASQUE',
          ref: 'FLASQUE-01',
          designation: 'Flasque palier bronze (modifié)',
          policy_tags: ['REPLACING'],
        } as any,
      ],
    });

    // 5c. The historical NeedRequest snapshot MUST NOT CHANGE
    const requestInStore = useGmaoStore
      .getState()
      .needRequests.find((r) => r.id === createdNeed!.id);
    expect(requestInStore?.policy_tags_snapshot).toEqual(['REPAIRABLE', 'MODIFYING']);
  });

  it('6. PDR -> ATELIER exception requires notes_superviseur: rejected without notes, accepted with notes', () => {
    const store = useGmaoStore.getState();

    const pdrNeed = store.handleCreateNeedRequest({
      id_machine: 'PRESS-01',
      id_bt: 'BT-2026-101',
      material_class: 'PDR',
      id_ref_pdr: 'RLM-6205',
      quantite: 1,
      description_besoin: 'Roulement 6205 introuvable sur le marché',
    });
    expect(pdrNeed).not.toBeNull();

    // 6a. Attempt to route PDR to ATELIER without supervisor notes -> REJECTED
    const rejectedReview = store.handleReviewNeedRequest(pdrNeed!.id, {
      decision: 'APPROVISIONNEMENT',
      canal_appro: 'ATELIER',
      actorRole: 'RESPONSABLE_MAINTENANCE',
      notes_superviseur: '', // Empty notes
    });
    expect(rejectedReview.valid).toBe(false);
    expect(rejectedReview.reason).toContain('justification superviseur');

    // 6b. With explicit supervisor justification notes -> ACCEPTED as documented exception
    const acceptedReview = store.handleReviewNeedRequest(pdrNeed!.id, {
      decision: 'APPROVISIONNEMENT',
      canal_appro: 'ATELIER',
      actorRole: 'RESPONSABLE_MAINTENANCE',
      notes_superviseur: 'Dérogation exceptionnelle : usinage bague d adaptation sur tour pour dépannage urgent.',
    });
    expect(acceptedReview.valid).toBe(true);
    expect(acceptedReview.needRequest?.statut).toBe('APPROVISIONNEMENT');
    expect(acceptedReview.needRequest?.canal_appro).toBe('ATELIER');
  });

  it('7. No regression: validateNeedRequestTransition and COR-ATELIER workshop auto-linking remain guarded', () => {
    // Cannot transition directly from DEMANDE_TECH to CLOTURE_FIELD
    const invalidJump = validateNeedRequestTransition('DEMANDE_TECH', 'CLOTURE_FIELD', {
      actorRole: 'ADMIN',
    });
    expect(invalidJump.valid).toBe(false);

    // Valid transition from DEMANDE_TECH to APPROVISIONNEMENT with valid canal
    const validTransition = validateNeedRequestTransition('DEMANDE_TECH', 'APPROVISIONNEMENT', {
      actorRole: 'ADMIN',
      canal_appro: 'STOCK',
    });
    expect(validTransition.valid).toBe(true);
  });
});
