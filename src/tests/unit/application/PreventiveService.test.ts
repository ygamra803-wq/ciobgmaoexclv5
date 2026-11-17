import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PreventiveService } from '../../../application/services/PreventiveService';
import { storageService } from '../../../utils/storageService';

// Mock storage
vi.mock('../../../utils/storageService', () => ({
  storageService: {
    getItem: vi.fn(),
    setItem: vi.fn(),
  },
}));

describe('PreventiveService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return initial actions when storage is empty', () => {
    (storageService.getItem as any).mockImplementation((key: string) => {
      if (key === 'gmao_demo_data_loaded_v1') return true;
      return null;
    });
    const actions = PreventiveService.getActions();
    expect(actions.length).toBeGreaterThan(0);
  });

  it('should add a new action', () => {
    vi.spyOn(PreventiveService, 'getActions').mockReturnValue([]);
    vi.spyOn(PreventiveService, 'saveActions').mockImplementation(() => {});
    const actionData = { code: 'C', libelle: 'Contrôle' };
    const updated = PreventiveService.addAction(actionData);
    expect(updated.length).toBe(1);
    expect(updated[0].code).toBe('C');
    expect(PreventiveService.saveActions).toHaveBeenCalled();
  });
});
