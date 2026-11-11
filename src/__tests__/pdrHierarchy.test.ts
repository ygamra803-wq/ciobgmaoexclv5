import { describe, it, expect, beforeEach } from 'vitest';
import {
  listPdrGroups,
  listPdrTypesByGroup,
  listStockItemsByGroupType,
  resolvePdrHierarchy,
  getEffectivePdrPolicyTags,
} from '../domain/stock/pdrHierarchyService';
import { getSuggestedChannels, getEffectivePolicyTags } from '../domain/corrective/needRequestService';
import { DataGateway } from '../application/DataGateway';
import { STORAGE_KEYS } from '../infrastructure/persistence/storageKeys';
import { storageService } from '../utils/storageService';
import { PdrGroup, IStockItem, StockType } from '../types/domain';
import { StockCalculationService } from '../core/domain/services/StockCalculationService';

describe('CATALOG-GROUP-P1 — PDR 3-Tier Hierarchy (Group -> Type -> SKU/Ref)', () => {
  const sampleGroups: PdrGroup[] = [
    {
      id: 'GRP-ROUL',
      code: 'ROUL',
      libelle: 'Roulements & paliers',
      description: 'Roulements à billes, rouleaux et paliers',
      default_policy_tags: ['REPLACING'],
      sort_order: 1,
      is_active: true,
    },
    {
      id: 'GRP-ETAN',
      code: 'ETAN',
      libelle: 'Étanchéité & joints',
      description: 'Joints toriques, bagues spi, garnitures',
      default_policy_tags: ['REPLACING'],
      sort_order: 2,
      is_active: true,
    },
    {
      id: 'GRP-INACTIF',
      code: 'ARCH',
      libelle: 'Groupe Archivé',
      sort_order: 99,
      is_active: false,
    },
  ];

  const sampleTypes: StockType[] = [
    {
      id_type: 'TYPE-ROUL-BILLES',
      libelle: 'Roulement à billes',
      id_group: 'GRP-ROUL',
    },
    {
      id_type: 'TYPE-ROUL-ROULEAUX',
      libelle: 'Roulement à rouleaux',
      id_group: 'GRP-ROUL',
    },
    {
      id_type: 'TYPE-JOINT-TORIQUE',
      libelle: 'Joint torique',
      id_group: 'GRP-ETAN',
    },
    {
      id_type: 'TYPE-LEGACY-UNCLASS',
      libelle: 'Type non classé hérité',
      id_group: null,
    },
  ];

  const sampleArticles: IStockItem[] = [
    {
      ref: 'PDR-ROUL-6205',
      designation: 'Roulement à billes 6205-2RS',
      id_group: 'GRP-ROUL',
      id_type: 'TYPE-ROUL-BILLES',
      type: 'TYPE-ROUL-BILLES',
      stockInitial: 10,
      entrees: 4,
      sorties: 2,
      emplacement: 'RAYON-A01',
    },
    {
      ref: 'PDR-ROUL-22210',
      designation: 'Roulement à rouleaux 22210',
      id_group: 'GRP-ROUL',
      id_type: 'TYPE-ROUL-ROULEAUX',
      type: 'TYPE-ROUL-ROULEAUX',
      stockInitial: 5,
      entrees: 0,
      sorties: 1,
      emplacement: 'RAYON-A02',
    },
    {
      ref: 'PDR-JOINT-NBR-50',
      designation: 'Joint torique NBR 50x3',
      id_group: 'GRP-ETAN',
      id_type: 'TYPE-JOINT-TORIQUE',
      type: 'TYPE-JOINT-TORIQUE',
      stockInitial: 30,
      entrees: 10,
      sorties: 5,
      emplacement: 'RAYON-B01',
    },
    {
      // Legacy item without any id_group
      ref: 'PDR-LEGACY-01',
      designation: 'Ancien filtre sans groupe',
      id_type: 'TYPE-LEGACY-UNCLASS',
      type: 'TYPE-LEGACY-UNCLASS',
      stockInitial: 7,
      entrees: 3,
      sorties: 2,
      emplacement: 'RAYON-Z99',
    },
  ];

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('1. Legacy stock item without id_group still computes stock balance accurately and resolves in catalog', () => {
    const legacyItem = sampleArticles[3];
    expect(legacyItem.id_group).toBeUndefined();

    // Verify stock math invariant remains untouched: 7 + 3 - 2 = 8
    const balance = StockCalculationService.calculateStockActuel(legacyItem, [
      { ref: legacyItem.ref, type: 'ENTREE', quantite: 3 },
      { ref: legacyItem.ref, type: 'SORTIE', quantite: 2 },
    ]);
    expect(balance).toBe(8);

    // List with 'ALL': legacy item is never excluded
    const allItems = listStockItemsByGroupType(sampleArticles, sampleTypes, 'ALL', 'ALL');
    expect(allItems).toHaveLength(4);
    expect(allItems.some((i) => i.ref === 'PDR-LEGACY-01')).toBe(true);

    // List with 'UNCLASSIFIED': returns legacy item
    const unclassItems = listStockItemsByGroupType(sampleArticles, sampleTypes, 'UNCLASSIFIED', 'ALL');
    expect(unclassItems).toHaveLength(1);
    expect(unclassItems[0].ref === 'PDR-LEGACY-01').toBe(true);
  });

  it('2. Filter Group -> Type narrows down stock items deterministically without throwing exceptions', () => {
    // Filter Group = GRP-ROUL
    const roulItems = listStockItemsByGroupType(sampleArticles, sampleTypes, 'GRP-ROUL', 'ALL');
    expect(roulItems).toHaveLength(2);
    expect(roulItems.map((i) => i.ref)).toEqual(['PDR-ROUL-6205', 'PDR-ROUL-22210']);

    // Filter Group = GRP-ROUL and Type = TYPE-ROUL-BILLES
    const billesOnly = listStockItemsByGroupType(sampleArticles, sampleTypes, 'GRP-ROUL', 'TYPE-ROUL-BILLES');
    expect(billesOnly).toHaveLength(1);
    expect(billesOnly[0].ref).toBe('PDR-ROUL-6205');

    // Filter Group = GRP-ETAN
    const etanItems = listStockItemsByGroupType(sampleArticles, sampleTypes, 'GRP-ETAN', 'ALL');
    expect(etanItems).toHaveLength(1);
    expect(etanItems[0].ref).toBe('PDR-JOINT-NBR-50');

    // Types listed for GRP-ROUL
    const roulTypes = listPdrTypesByGroup(sampleTypes, 'GRP-ROUL');
    expect(roulTypes).toHaveLength(2);
    expect(roulTypes.map((t) => t.id_type)).toEqual(['TYPE-ROUL-BILLES', 'TYPE-ROUL-ROULEAUX']);
  });

  it('3. getSuggestedChannels(PDR) strictly returns [STOCK, ACHAT] and excludes ATELIER', () => {
    const channels = getSuggestedChannels('PDR');
    expect(channels).toEqual(['STOCK', 'ACHAT']);
    expect(channels).not.toContain('ATELIER');

    const channelsUpper = getSuggestedChannels('pdr');
    expect(channelsUpper).toEqual(['STOCK', 'ACHAT']);
  });

  it('4. DataGateway.clearAllForRealFactory clears STORAGE_KEYS.PDR_GROUPS to [] without silent reinjection', () => {
    // Seed some groups
    DataGateway.savePdrGroups(sampleGroups);
    expect(storageService.getItem(STORAGE_KEYS.PDR_GROUPS)).toHaveLength(3);

    // Call factory clearAll
    let setterCalledWith: any[] | null = null;
    DataGateway.clearAllForRealFactory({
      setPdrGroups: (val: any[]) => {
        setterCalledWith = val;
      },
    });

    const inStorage = storageService.getItem(STORAGE_KEYS.PDR_GROUPS);
    expect(inStorage).toEqual([]);
    expect(setterCalledWith).toEqual([]);
    expect(storageService.getItem(STORAGE_KEYS.START_MODE)).toBe('empty');
    expect(storageService.getItem(STORAGE_KEYS.DEMO_MODE)).toBe(false);
  });

  it('5. resolvePdrHierarchy resolves group directly from item.id_group or inherits from resolved Type', () => {
    // Direct link on item
    const res1 = resolvePdrHierarchy(sampleArticles[0], sampleGroups, sampleTypes);
    expect(res1.group?.code).toBe('ROUL');
    expect(res1.type?.id_type).toBe('TYPE-ROUL-BILLES');

    // Item without id_group but with type that has id_group
    const inheritedArticle: IStockItem = {
      ref: 'PDR-INHERIT-01',
      designation: 'Roulement hérité',
      id_type: 'TYPE-ROUL-ROULEAUX',
      type: 'TYPE-ROUL-ROULEAUX',
      stockInitial: 1,
    };
    const res2 = resolvePdrHierarchy(inheritedArticle, sampleGroups, sampleTypes);
    expect(res2.group?.code).toBe('ROUL');
    expect(res2.type?.id_type).toBe('TYPE-ROUL-ROULEAUX');

    // Completely unclassified item
    const resLegacy = resolvePdrHierarchy(sampleArticles[3], sampleGroups, sampleTypes);
    expect(resLegacy.group).toBeNull();
    expect(resLegacy.type?.id_type).toBe('TYPE-LEGACY-UNCLASS');
  });

  it('6. getEffectivePdrPolicyTags and getEffectivePolicyTags inherit group default_policy_tags with fallback to REPLACING', () => {
    // Item with explicit policy tag
    const itemWithTag: IStockItem = {
      ref: 'PDR-CUSTOM',
      designation: 'Custom PDR',
      stockInitial: 1,
      policy_tags: ['REPLACING'],
    };
    expect(getEffectivePdrPolicyTags(itemWithTag, sampleGroups[0])).toEqual(['REPLACING']);

    // Item without tags, but group has default_policy_tags
    const itemWithoutTags: IStockItem = {
      ref: 'PDR-UNTYPED',
      designation: 'Untyped PDR',
      stockInitial: 1,
    };
    expect(getEffectivePdrPolicyTags(itemWithoutTags, sampleGroups[0])).toEqual(['REPLACING']);

    // Even if group had invalid tags, PDR is strictly filtered to REPLACING
    const groupWithModifying: PdrGroup = {
      id: 'GRP-TEST',
      code: 'TEST',
      libelle: 'Test',
      default_policy_tags: ['MODIFYING' as any],
    };
    expect(getEffectivePdrPolicyTags(itemWithoutTags, groupWithModifying)).toEqual(['REPLACING']);

    // needRequestService getEffectivePolicyTags also respects groupContext
    const fromNeedService = getEffectivePolicyTags(itemWithoutTags, 'PDR', sampleGroups[0]);
    expect(fromNeedService).toEqual(['REPLACING']);
  });

  it('7. listPdrGroups respects activeOnly parameter and sorts by sort_order / code', () => {
    const all = listPdrGroups(sampleGroups, false);
    expect(all).toHaveLength(3);
    expect(all[0].code).toBe('ROUL');
    expect(all[1].code).toBe('ETAN');
    expect(all[2].code).toBe('ARCH');

    const activeOnly = listPdrGroups(sampleGroups, true);
    expect(activeOnly).toHaveLength(2);
    expect(activeOnly.some((g) => g.code === 'ARCH')).toBe(false);
  });
});
