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

  it('should return empty actions array when storage is empty (Zero Silent Seed Reinjection)', () => {
    (storageService.getItem as ReturnType<typeof vi.fn>).mockImplementation(() => null);
    const actions = PreventiveService.getActions();
    expect(actions).toEqual([]);
  });

  it('should return persisted actions when present in storage', () => {
    (storageService.getItem as ReturnType<typeof vi.fn>).mockImplementation((key: string) => {
      if (key === 'gmao_preventive_actions_v1') {
        return [{ id: 'ACT-C-001', action_id: 'ACT-C-001', code: 'C', libelle: 'Contrôle' }];
      }
      return null;
    });
    const actions = PreventiveService.getActions();
    expect(actions.length).toBeGreaterThan(0);
    expect(actions[0].code).toBe('C');
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
