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

describe('SEED-RESET-P0 — 3-Tier PDR Seed Referential Integrity & Ordered Demo Lifecycle', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('1. Every type.id_group in seedStockTypes.json references an existing group in seedPdrGroups.json (0 orphan types)', async () => {
    const seedPdrGroups = (await import('../data/stock/seedPdrGroups.json')).default as PdrGroup[];
    const seedStockTypes = (await import('../data/stock/seedStockTypes.json')).default as StockType[];

    expect(seedPdrGroups.length).toBeGreaterThanOrEqual(7);
    expect(seedStockTypes.length).toBeGreaterThanOrEqual(14);

    const groupIds = new Set(seedPdrGroups.map((g) => g.id));
    expect(groupIds.size).toBe(seedPdrGroups.length);

    for (const grp of seedPdrGroups) {
      expect(grp.default_policy_tags).toEqual(['REPLACING']);
      expect(grp.is_active).toBe(true);
    }

    for (const t of seedStockTypes) {
      expect(t.id_type).toBeTruthy();
      expect(t.libelle).toBeTruthy();
      expect(t.id_group).toBeTruthy();
      expect(groupIds.has(String(t.id_group))).toBe(true);
    }
  });

  it('2. Every item in seedStockItems.json has a unique ref, valid id_type, matching id_group === type.id_group, and policy_tags = [REPLACING] (0 orphan items)', async () => {
    const seedPdrGroups = (await import('../data/stock/seedPdrGroups.json')).default as PdrGroup[];
    const seedStockTypes = (await import('../data/stock/seedStockTypes.json')).default as StockType[];
    const seedStockItems = (await import('../data/stock/seedStockItems.json')).default as IStockItem[];

    expect(seedStockItems.length).toBeGreaterThanOrEqual(15);
    expect(seedStockItems.length).toBeLessThanOrEqual(40);

    const groupMap = new Map(seedPdrGroups.map((g) => [g.id, g]));
    const typeMap = new Map(seedStockTypes.map((t) => [t.id_type, t]));
    const seenRefs = new Set<string>();

    for (const item of seedStockItems) {
      const normalizedRef = String(item.ref).trim().toUpperCase();
      expect(normalizedRef.length).toBeGreaterThan(0);
      expect(seenRefs.has(normalizedRef)).toBe(false);
      seenRefs.add(normalizedRef);

      expect(item.id_type).toBeTruthy();
      const matchedType = typeMap.get(String(item.id_type));
      expect(matchedType).toBeDefined();

      expect(item.id_group).toBeTruthy();
      expect(groupMap.has(String(item.id_group))).toBe(true);
      expect(item.id_group).toBe(matchedType?.id_group);

      expect(item.policy_tags).toEqual(['REPLACING']);
      expect(item.stockActuel).toBe(
        Number(item.stockInitial || 0) + Number(item.entrees || 0) - Number(item.sorties || 0)
      );
    }
  });

  it('3. Every mov.ref in seedMouvements.json exists in seedStockItems.json and matches dynamic stock calculation', async () => {
    const seedStockItems = (await import('../data/stock/seedStockItems.json')).default as IStockItem[];
    const seedMouvements = (await import('../data/movements/seedMouvements.json')).default as any[];

    expect(seedMouvements.length).toBeGreaterThan(0);

    const itemByRef = new Map(
      seedStockItems.map((item) => [String(item.ref).trim().toUpperCase(), item])
    );

    for (const mov of seedMouvements) {
      const refKey = String(mov.ref || '').trim().toUpperCase();
      expect(itemByRef.has(refKey)).toBe(true);
      expect(Number(mov.quantite)).toBeGreaterThan(0);
    }

    for (const item of seedStockItems) {
      const itemMovs = seedMouvements.filter(
        (m) => String(m.ref).trim().toUpperCase() === String(item.ref).trim().toUpperCase()
      );
      const computed = StockCalculationService.calculateStockActuel(item, itemMovs);
      expect(computed).toBe(item.stockActuel);
    }
  });

  it('4. DataGateway.loadDemoData loads Groups -> Types -> Items -> Mouvements and clearAllForRealFactory wipes them with zero silent reinjection', async () => {
    const { loadCollection } = await import('../infrastructure/persistence/migrateStorage');
    const callOrder: string[] = [];

    DataGateway.loadDemoData({
      setPdrGroups: () => callOrder.push('pdrGroups'),
      setTypes: () => callOrder.push('types'),
      setRawStock: () => callOrder.push('rawStock'),
      setMouvements: () => callOrder.push('mouvements'),
    });

    expect(callOrder).toEqual(['pdrGroups', 'types', 'rawStock', 'mouvements']);

    const storedGroups = storageService.getItem(STORAGE_KEYS.PDR_GROUPS);
    const storedTypes = storageService.getItem(STORAGE_KEYS.STOCK_TYPES);
    const storedStock = storageService.getItem(STORAGE_KEYS.RAW_STOCK);
    const storedMovs = storageService.getItem(STORAGE_KEYS.MOUVEMENTS);

    expect(Array.isArray(storedGroups) && storedGroups.length).toBe(7);
    expect(Array.isArray(storedTypes) && storedTypes.length).toBe(21);
    expect(Array.isArray(storedStock) && storedStock.length).toBe(28);
    expect(Array.isArray(storedMovs) && storedMovs.length).toBe(36);

    // Clear all for real factory
    await DataGateway.clearAllForRealFactory();

    expect(storageService.getItem(STORAGE_KEYS.PDR_GROUPS)).toEqual([]);
    expect(storageService.getItem(STORAGE_KEYS.STOCK_TYPES)).toEqual([]);
    expect(storageService.getItem(STORAGE_KEYS.RAW_STOCK)).toEqual([]);
    expect(storageService.getItem(STORAGE_KEYS.MOUVEMENTS)).toEqual([]);

    // Simulate F5 reload with allowDemoFallback: true -> must remain [] when START_MODE === 'empty'
    expect(
      loadCollection(STORAGE_KEYS.PDR_GROUPS, {
        allowDemoFallback: true,
        demoSeed: storedGroups,
      })
    ).toEqual([]);
    expect(
      loadCollection(STORAGE_KEYS.STOCK_TYPES, {
        allowDemoFallback: true,
        demoSeed: storedTypes,
      })
    ).toEqual([]);
    expect(
      loadCollection(STORAGE_KEYS.RAW_STOCK, {
        allowDemoFallback: true,
        demoSeed: storedStock,
      })
    ).toEqual([]);
  });
});

