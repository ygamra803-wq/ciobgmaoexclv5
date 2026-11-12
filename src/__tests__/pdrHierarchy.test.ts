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

describe('PDR-EXCEL-HIERARCHY-P0 — 3-Sheet Excel Export / Import & Validation Guards', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('1. Rejects a type with an orphan group_code with an explicit row error (no silent drop)', async () => {
    const { validateAndReconcilePdrCatalogImport } = await import(
      '../services/pdrHierarchyExcelService'
    );

    const report = validateAndReconcilePdrCatalogImport(
      {
        groups: [
          {
            code: 'ROUL',
            libelle: 'Roulements & Paliers',
            description: 'Roulements',
            default_policy_tags: 'REPLACING',
            sort_order: 10,
            is_active: true,
          },
        ],
        types: [
          {
            code_type: 'TYP-ORPHAN',
            libelle: 'Type sans groupe valide',
            group_code: 'UNKNOWN_GROUP',
            is_active: true,
          },
        ],
        items: [],
      },
      { mode: 'MERGE', actorRole: 'ADMIN' }
    );

    expect(report.success).toBe(false);
    expect(report.errors).toHaveLength(1);
    expect(report.errors[0].sheet).toBe('PDR_TYPES');
    expect(report.errors[0].row).toBe(2);
    expect(report.errors[0].message).toContain('UNKNOWN_GROUP');
    expect(report.created.types).toBe(0);
  });

  it('2. Rejects duplicate item.ref within PDR_ITEMS sheet with an explicit row error', async () => {
    const { validateAndReconcilePdrCatalogImport } = await import(
      '../services/pdrHierarchyExcelService'
    );

    const report = validateAndReconcilePdrCatalogImport(
      {
        groups: [
          {
            code: 'ROUL',
            libelle: 'Roulements',
            default_policy_tags: 'REPLACING',
            sort_order: 10,
            is_active: true,
          },
        ],
        types: [
          {
            code_type: 'TYP-RLM-BILLE',
            libelle: 'Roulement à billes',
            group_code: 'ROUL',
            is_active: true,
          },
        ],
        items: [
          {
            ref: 'RLM-6205',
            designation: 'Roulement 6205',
            type_code_or_id: 'TYP-RLM-BILLE',
            group_code: 'ROUL',
            seuil: 5,
            emplacement: 'MAG-A-01',
            stockInitial: 10,
            policy_tags: 'REPLACING',
          },
          {
            ref: 'rlm-6205',
            designation: 'Doublon Roulement 6205',
            type_code_or_id: 'TYP-RLM-BILLE',
            group_code: 'ROUL',
            seuil: 5,
            emplacement: 'MAG-A-02',
            stockInitial: 4,
            policy_tags: 'REPLACING',
          },
        ],
      },
      { mode: 'MERGE', actorRole: 'ADMIN' }
    );

    expect(report.success).toBe(false);
    expect(report.errors).toHaveLength(1);
    expect(report.errors[0].sheet).toBe('PDR_ITEMS');
    expect(report.errors[0].row).toBe(3);
    expect(report.errors[0].message).toContain('dupliquée');
    expect(report.created.items).toBe(1);
  });

  it('3. Rejects an item whose group_code conflicts with its resolved type group (item group != type group)', async () => {
    const { validateAndReconcilePdrCatalogImport } = await import(
      '../services/pdrHierarchyExcelService'
    );

    const report = validateAndReconcilePdrCatalogImport(
      {
        groups: [
          { code: 'ROUL', libelle: 'Roulements', sort_order: 10, is_active: true },
          { code: 'ETAN', libelle: 'Étanchéité', sort_order: 20, is_active: true },
        ],
        types: [
          {
            code_type: 'TYP-RLM-BILLE',
            libelle: 'Roulement à billes',
            group_code: 'ROUL',
            is_active: true,
          },
        ],
        items: [
          {
            ref: 'RLM-MISMATCH',
            designation: 'Roulement classé par erreur dans ETAN',
            type_code_or_id: 'TYP-RLM-BILLE',
            group_code: 'ETAN',
            seuil: 2,
            emplacement: 'MAG-A-01',
            stockInitial: 5,
          },
        ],
      },
      { mode: 'MERGE', actorRole: 'ADMIN' }
    );

    expect(report.success).toBe(false);
    expect(report.errors).toHaveLength(1);
    expect(report.errors[0].sheet).toBe('PDR_ITEMS');
    expect(report.errors[0].row).toBe(2);
    expect(report.errors[0].message).toContain('incohérence hiérarchique');
    expect(report.created.items).toBe(0);
  });

  it('4. Defaults empty policy_tags to ["REPLACING"] and ignores stockActuel column on import', async () => {
    const { validateAndReconcilePdrCatalogImport } = await import(
      '../services/pdrHierarchyExcelService'
    );

    const report = validateAndReconcilePdrCatalogImport(
      {
        groups: [{ code: 'ROUL', libelle: 'Roulements', default_policy_tags: '' }],
        types: [{ code_type: 'TYP-RLM-BILLE', libelle: 'Roulement à billes', group_code: 'ROUL' }],
        items: [
          {
            ref: 'RLM-6205',
            designation: 'Roulement 6205',
            type_code_or_id: 'TYP-RLM-BILLE',
            group_code: 'ROUL',
            seuil: 4,
            emplacement: 'MAG-A-01',
            stockInitial: 10,
            policy_tags: '',
            stockActuel: 999,
            stockActuel_info: 999,
          },
        ],
      },
      {
        mode: 'MERGE',
        actorRole: 'ADMIN',
        existingStock: [
          {
            ref: 'RLM-6205',
            designation: 'Ancien 6205',
            stockInitial: 8,
            entrees: 5,
            sorties: 3,
            stockActuel: 10,
          },
        ],
      }
    );

    expect(report.success).toBe(true);
    expect(report.errors).toHaveLength(0);
    expect(report.nextGroups[0].default_policy_tags).toEqual(['REPLACING']);
    expect(report.nextStock[0].policy_tags).toEqual(['REPLACING']);
    // stockActuel_info=999 is ignored; computed from stockInitial (10) + entrees (5) - sorties (3) = 12
    expect(report.nextStock[0].stockActuel).toBe(12);
  });

  it('5. Supports full 3-sheet .xlsx Round-Trip (Objects -> Workbook -> Buffer -> Parse -> Validate)', async () => {
    const XLSX = await import('xlsx');
    const {
      buildPdrCatalogWorkbook,
      parsePdrCatalogWorkbookBuffer,
      validateAndReconcilePdrCatalogImport,
    } = await import('../services/pdrHierarchyExcelService');

    const seedPdrGroups = (await import('../data/stock/seedPdrGroups.json')).default as PdrGroup[];
    const seedStockTypes = (await import('../data/stock/seedStockTypes.json')).default as StockType[];
    const seedStockItems = (await import('../data/stock/seedStockItems.json')).default as IStockItem[];

    const wb = buildPdrCatalogWorkbook({
      pdrGroups: seedPdrGroups,
      types: seedStockTypes,
      rawStock: seedStockItems,
    });

    expect(wb.SheetNames).toEqual(['PDR_GROUPS', 'PDR_TYPES', 'PDR_ITEMS']);

    const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
    const parsedSheets = parsePdrCatalogWorkbookBuffer(buffer);

    expect(parsedSheets.groups?.length).toBe(seedPdrGroups.length);
    expect(parsedSheets.types?.length).toBe(seedStockTypes.length);
    expect(parsedSheets.items?.length).toBe(seedStockItems.length);

    const report = validateAndReconcilePdrCatalogImport(parsedSheets, {
      mode: 'MERGE',
      actorRole: 'ADMIN',
      existingGroups: [],
      existingTypes: [],
      existingStock: [],
    });

    expect(report.success).toBe(true);
    expect(report.errors).toHaveLength(0);
    expect(report.created.groups).toBe(seedPdrGroups.length);
    expect(report.created.types).toBe(seedStockTypes.length);
    expect(report.created.items).toBe(seedStockItems.length);
  });

  it('6. Guards REPLACE_CATALOG mode against non-ADMIN role and refuses deleting items that have historical movements', async () => {
    const { validateAndReconcilePdrCatalogImport } = await import(
      '../services/pdrHierarchyExcelService'
    );

    const existingStock: IStockItem[] = [
      {
        ref: 'RLM-PROTECTED',
        designation: 'Roulement avec mouvement historique',
        id_group: 'GRP-ROUL',
        id_type: 'TYP-RLM-BILLE',
        stockInitial: 10,
        entrees: 0,
        sorties: 2,
        stockActuel: 8,
      },
    ];

    const existingMouvements = [
      { id: 1, date: '2026-01-10', type: 'Sortie', ref: 'RLM-PROTECTED', quantite: 2 },
    ];

    const newCatalogSheets = {
      groups: [{ code: 'ROUL', libelle: 'Roulements' }],
      types: [{ code_type: 'TYP-RLM-BILLE', libelle: 'Roulement à billes', group_code: 'ROUL' }],
      items: [
        {
          ref: 'RLM-NEW-ONLY',
          designation: 'Nouveau roulement uniquement',
          type_code_or_id: 'TYP-RLM-BILLE',
          group_code: 'ROUL',
          stockInitial: 5,
        },
      ],
    };

    // 6a. Non-ADMIN role is blocked from REPLACE_CATALOG
    const nonAdminReport = validateAndReconcilePdrCatalogImport(newCatalogSheets, {
      mode: 'REPLACE_CATALOG',
      actorRole: 'MAGASINIER',
      existingStock,
      existingMouvements,
    });
    expect(nonAdminReport.success).toBe(false);
    expect(nonAdminReport.errors[0].message).toContain('ADMIN');

    // 6b. ADMIN is blocked when REPLACE_CATALOG would delete 'RLM-PROTECTED' which has movements
    const fkGuardReport = validateAndReconcilePdrCatalogImport(newCatalogSheets, {
      mode: 'REPLACE_CATALOG',
      actorRole: 'ADMIN',
      existingStock,
      existingMouvements,
    });
    expect(fkGuardReport.success).toBe(false);
    expect(fkGuardReport.errors[0].message).toContain('Protection FK Mouvements');
    expect(fkGuardReport.errors[0].message).toContain('RLM-PROTECTED');
    // Original stock remains untouched
    expect(fkGuardReport.nextStock).toEqual(existingStock);
  });
});

describe('PDR-GROUP-PAGE-P0 — Groupes PDR Referentiel CRUD, Safe Deactivation & RBAC', () => {
  it('1. validateAndUpsertPdrGroup creates a group with normalized uppercase code, defaults policy_tags to [REPLACING], and rejects duplicate codes', async () => {
    const { validateAndUpsertPdrGroup } = await import('../domain/stock/pdrHierarchyService');

    const res1 = validateAndUpsertPdrGroup([], {
      code: '  hydr  ',
      libelle: 'Hydraulique & Pneumatique',
      description: 'Vérins, distributeurs et flexibles',
    });

    expect(res1.ok).toBe(true);
    expect(res1.savedGroup?.code).toBe('HYDR');
    expect(res1.savedGroup?.id).toBe('GRP-HYDR');
    expect(res1.savedGroup?.default_policy_tags).toEqual(['REPLACING']);
    expect(res1.savedGroup?.is_active).toBe(true);
    expect(res1.groups).toHaveLength(1);

    // Reject duplicate code on creation
    const dupRes = validateAndUpsertPdrGroup(res1.groups, {
      code: 'hydr',
      libelle: 'Doublon Hydraulique',
    });
    expect(dupRes.ok).toBe(false);
    expect(dupRes.error).toContain('existe déjà');

    // Allow updating existing group when editingGroupId matches
    const editRes = validateAndUpsertPdrGroup(
      res1.groups,
      {
        code: 'HYDR',
        libelle: 'Hydraulique Haute Pression',
        sort_order: 5,
      },
      'GRP-HYDR'
    );
    expect(editRes.ok).toBe(true);
    expect(editRes.savedGroup?.libelle).toBe('Hydraulique Haute Pression');
    expect(editRes.savedGroup?.sort_order).toBe(5);
  });

  it('2. safeDeleteOrDeactivatePdrGroup soft-archives (is_active=false) when linked types or articles exist, and hard-deletes when 0 children exist', async () => {
    const { safeDeleteOrDeactivatePdrGroup, computePdrGroupStats } = await import(
      '../domain/stock/pdrHierarchyService'
    );

    const groups: PdrGroup[] = [
      { id: 'GRP-ROUL', code: 'ROUL', libelle: 'Roulements', is_active: true },
      { id: 'GRP-EMPTY', code: 'EMPT', libelle: 'Groupe Vide', is_active: true },
    ];
    const types: StockType[] = [
      { id_type: 'TYP-BILLE', libelle: 'Roulement à billes', id_group: 'GRP-ROUL' },
    ];
    const items: IStockItem[] = [
      { ref: 'SKF-6205', designation: 'Roulement 6205', id_type: 'TYP-BILLE', stockInitial: 4 },
    ];

    const stats = computePdrGroupStats(groups[0], types, items);
    expect(stats.typesCount).toBe(1);
    expect(stats.itemsCount).toBe(1);

    // Group with children -> soft-archived (DEACTIVATED), never deleted
    const deactRes = safeDeleteOrDeactivatePdrGroup(groups, 'GRP-ROUL', types, items);
    expect(deactRes.mode).toBe('DEACTIVATED');
    expect(deactRes.groups).toHaveLength(2);
    expect(deactRes.groups.find((g) => g.id === 'GRP-ROUL')?.is_active).toBe(false);

    // Group with 0 children -> hard-deleted (DELETED)
    const delRes = safeDeleteOrDeactivatePdrGroup(deactRes.groups, 'GRP-EMPTY', types, items);
    expect(delRes.mode).toBe('DELETED');
    expect(delRes.groups).toHaveLength(1);
    expect(delRes.groups[0].id).toBe('GRP-ROUL');
  });

  it('3. AuthorizationService.canAccessTab grants pdr_groups to ADMIN, RESPONSABLE_MAINTENANCE, RESPONSABLE_MAGASIN and denies VIEWER/TECHNICIEN/OPERATEUR', async () => {
    const { AuthorizationService } = await import('../core/security/AuthorizationService');
    const { ROLES } = await import('../core/security/Roles');

    expect(AuthorizationService.canAccessTab({ role: ROLES.ADMIN }, 'pdr_groups')).toBe(true);
    expect(
      AuthorizationService.canAccessTab({ role: ROLES.RESPONSABLE_MAINTENANCE }, 'pdr_groups')
    ).toBe(true);
    expect(
      AuthorizationService.canAccessTab({ role: ROLES.RESPONSABLE_MAGASIN }, 'pdr_groups')
    ).toBe(true);

    expect(AuthorizationService.canAccessTab({ role: ROLES.TECHNICIEN }, 'pdr_groups')).toBe(false);
    expect(AuthorizationService.canAccessTab({ role: ROLES.OPERATEUR }, 'pdr_groups')).toBe(false);
    expect(AuthorizationService.canAccessTab({ role: ROLES.VIEWER }, 'pdr_groups')).toBe(false);
  });
});

describe('PART-GROUP-P1 — Standalone PartGroup Referentiel, PartType.id_group Linkage & Entrepôt Isolation', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('1. Enforces strict SSOT storage key separation between PART_GROUPS, COMP_GROUPS, and PDR_GROUPS', () => {
    expect(STORAGE_KEYS.PART_GROUPS).toBe('gmao_part_groups_v1');
    expect(STORAGE_KEYS.PART_GROUPS).not.toBe(STORAGE_KEYS.COMP_GROUPS);
    expect(STORAGE_KEYS.PART_GROUPS).not.toBe(STORAGE_KEYS.PDR_GROUPS);
  });

  it('2. Every type.id_group in seedPartTypes.json references a valid group in seedPartGroups.json (0 orphans)', async () => {
    const seedPartGroups = (await import('../data/warehouse/seedPartGroups.json')).default as any[];
    const seedPartTypes = (await import('../data/warehouse/seedPartTypes.json')).default as any[];

    expect(seedPartGroups.length).toBeGreaterThanOrEqual(4);
    expect(seedPartTypes.length).toBeGreaterThanOrEqual(5);

    const groupIds = new Set(
      seedPartGroups.map((g) => String(g.id_group || g.id_groupe || g.code).trim().toUpperCase())
    );
    expect(groupIds.size).toBe(seedPartGroups.length);

    for (const grp of seedPartGroups) {
      expect(grp.id_group).toBeTruthy();
      expect(grp.code).toBeTruthy();
      expect(grp.libelle).toBeTruthy();
      expect(Array.isArray(grp.default_policy_tags)).toBe(true);
      expect(grp.default_policy_tags.length).toBeGreaterThan(0);
    }

    for (const pt of seedPartTypes) {
      expect(pt.id_type).toBeTruthy();
      expect(pt.id_group).toBeTruthy();
      expect(groupIds.has(String(pt.id_group).trim().toUpperCase())).toBe(true);
    }
  });

  it('3. DataGateway.loadDemoData populates PART_GROUPS and clearAllForRealFactory wipes it to [] with zero silent reinjection', async () => {
    const { loadCollection } = await import('../infrastructure/persistence/migrateStorage');
    let loadedPartGroups: any[] = [];

    DataGateway.loadDemoData({
      setPartGroups: (groups: any[]) => {
        loadedPartGroups = groups;
      },
    });

    expect(loadedPartGroups.length).toBe(4);
    const stored = storageService.getItem(STORAGE_KEYS.PART_GROUPS);
    expect(Array.isArray(stored) && stored.length).toBe(4);

    await DataGateway.clearAllForRealFactory({
      setPartGroups: (groups: any[]) => {
        loadedPartGroups = groups;
      },
    });

    expect(loadedPartGroups).toEqual([]);
    expect(storageService.getItem(STORAGE_KEYS.PART_GROUPS)).toEqual([]);

    // Simulate reload when START_MODE === 'empty'
    expect(
      loadCollection(STORAGE_KEYS.PART_GROUPS, {
        allowDemoFallback: true,
        demoSeed: stored,
      })
    ).toEqual([]);
  });

  it('4. AuthorizationService.canAccessTab grants part_groups to ADMIN, RESPONSABLE_MAINTENANCE, RESPONSABLE_MAGASIN and denies TECHNICIEN/OPERATEUR/VIEWER', async () => {
    const { AuthorizationService } = await import('../core/security/AuthorizationService');
    const { ROLES } = await import('../core/security/Roles');

    expect(AuthorizationService.canAccessTab({ role: ROLES.ADMIN }, 'part_groups')).toBe(true);
    expect(
      AuthorizationService.canAccessTab({ role: ROLES.RESPONSABLE_MAINTENANCE }, 'part_groups')
    ).toBe(true);
    expect(
      AuthorizationService.canAccessTab({ role: ROLES.RESPONSABLE_MAGASIN }, 'part_groups')
    ).toBe(true);

    expect(AuthorizationService.canAccessTab({ role: ROLES.TECHNICIEN }, 'part_groups')).toBe(false);
    expect(AuthorizationService.canAccessTab({ role: ROLES.OPERATEUR }, 'part_groups')).toBe(false);
    expect(AuthorizationService.canAccessTab({ role: ROLES.VIEWER }, 'part_groups')).toBe(false);
  });
});

describe('P2-INDUSTRIAL-COLUMNS — PDR (unite_mesure, criticite, ref_constructeur) & Parts (id_group, matiere_nuance, ref_plan, dimensions_brut)', () => {
  it('1. Preserves PDR P2 fields (unite_mesure, criticite, ref_constructeur) in Excel export/import round-trip and applies safe defaults (PCS, B)', async () => {
    const {
      buildPdrCatalogRows,
      validateAndReconcilePdrCatalogImport,
    } = await import('../services/pdrHierarchyExcelService');

    const groups: PdrGroup[] = [
      { id: 'GRP-LUBR', code: 'LUBR', libelle: 'Lubrifiants & Fluides', is_active: true },
    ];
    const types: StockType[] = [
      { id_type: 'TYP-LUB-HUILE', libelle: 'Huile Hydraulique', id_group: 'GRP-LUBR' },
    ];
    const stockItems: IStockItem[] = [
      {
        ref: 'LUB-HUILE-46',
        designation: 'Huile Hydraulique ISO VG 46',
        id_group: 'GRP-LUBR',
        id_type: 'TYP-LUB-HUILE',
        unite_mesure: 'L',
        criticite: 'A',
        ref_constructeur: 'SHELL-TELLUS-S2-M46',
        seuil: 50,
        emplacement: 'MAG-LUB-01',
        stockInitial: 200,
        policy_tags: ['REPLACING'],
      },
      {
        ref: 'LUB-LEGACY-GREASE',
        designation: 'Cartouche Graisse Standard',
        id_group: 'GRP-LUBR',
        id_type: 'TYP-LUB-HUILE',
        seuil: 10,
        emplacement: 'MAG-LUB-02',
        stockInitial: 30,
      },
    ];

    const rows = buildPdrCatalogRows({
      pdrGroups: groups,
      types,
      rawStock: stockItems,
    });

    expect(rows.itemRows[0].unite_mesure).toBe('L');
    expect(rows.itemRows[0].criticite).toBe('A');
    expect(rows.itemRows[0].ref_constructeur).toBe('SHELL-TELLUS-S2-M46');

    // Legacy item defaults to PCS and B in export
    expect(rows.itemRows[1].unite_mesure).toBe('PCS');
    expect(rows.itemRows[1].criticite).toBe('B');

    const report = validateAndReconcilePdrCatalogImport(
      {
        groups: rows.groupRows,
        types: rows.typeRows,
        items: rows.itemRows,
      },
      {
        mode: 'MERGE',
        actorRole: 'ADMIN',
        existingGroups: [],
        existingTypes: [],
        existingStock: [],
      }
    );

    expect(report.success).toBe(true);
    const importedOil = report.nextStock.find((s) => s.ref === 'LUB-HUILE-46');
    expect(importedOil?.unite_mesure).toBe('L');
    expect(importedOil?.criticite).toBe('A');
    expect(importedOil?.ref_constructeur).toBe('SHELL-TELLUS-S2-M46');

    const importedLegacy = report.nextStock.find((s) => s.ref === 'LUB-LEGACY-GREASE');
    expect(importedLegacy?.unite_mesure).toBe('PCS');
    expect(importedLegacy?.criticite).toBe('B');
  });

  it('2. Verifies seedPartDesignations.json contains P2 workshop engineering columns (id_group, matiere_nuance, ref_plan, dimensions_brut)', async () => {
    const seedPartGroups = (await import('../data/warehouse/seedPartGroups.json')).default as any[];
    const seedPartDesignations = (await import('../data/warehouse/seedPartDesignations.json')).default as any[];

    const groupIds = new Set(seedPartGroups.map((g) => String(g.id_group).trim().toUpperCase()));
    expect(seedPartDesignations.length).toBeGreaterThanOrEqual(5);

    for (const partDiag of seedPartDesignations) {
      expect(partDiag.id_group).toBeTruthy();
      expect(groupIds.has(String(partDiag.id_group).trim().toUpperCase())).toBe(true);
      expect(partDiag.matiere_nuance).toBeTruthy();
      expect(partDiag.ref_plan).toBeTruthy();
      expect(partDiag.dimensions_brut).toBeTruthy();
      expect(Array.isArray(partDiag.policy_tags)).toBe(true);
    }
  });
});
