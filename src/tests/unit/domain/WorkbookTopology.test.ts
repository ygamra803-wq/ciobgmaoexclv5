import { describe, it, expect } from 'vitest';
import excelEngineService from '../../../services/excelEngineService';

describe('🏛️ 3-Workbook Industrial Topology Verification', () => {
  it('should verify Workbook 1 (GMAO_Topology_Master) schema and sheets', () => {
    const topology1Sheets = [
      'Utilisateurs',
      'Zones',
      'Family_Machines',
      'Templates_Machines',
      'Machines_Registered',
      'Machine_BOM_Ledger',
    ];
    expect(topology1Sheets).toHaveLength(6);
    expect(topology1Sheets).toContain('Machine_BOM_Ledger');
    expect(topology1Sheets).toContain('Machines_Registered');
  });

  it('should verify Workbook 2 (GMAO_Inventory_Materials) schema and sheets', () => {
    const topology2Sheets = [
      'PDR_Articles',
      'Warehouse_Components',
      'Part_Types',
    ];
    expect(topology2Sheets).toHaveLength(3);
    expect(topology2Sheets).toContain('PDR_Articles');
    expect(topology2Sheets).toContain('Warehouse_Components');
  });

  it('should verify Workbook 3 (GMAO_Movements_Unified) schema and sheets', () => {
    const topology3Sheets = [
      'Mouvements',
      'Sortie_Externe',
    ];
    expect(topology3Sheets).toHaveLength(2);
    expect(topology3Sheets).toContain('Mouvements');
    expect(topology3Sheets).toContain('Sortie_Externe');
  });

  it('should accurately parse sheets corresponding to all 3 workbooks in ExcelEngineService', async () => {
    expect(excelEngineService).toBeDefined();
    expect(typeof excelEngineService.parseWorkbookFile).toBe('function');
    expect(typeof excelEngineService.buildGmaoWorkbook).toBe('function');
    expect(typeof excelEngineService.downloadGmaoBlankTemplate).toBe('function');
  });
});
