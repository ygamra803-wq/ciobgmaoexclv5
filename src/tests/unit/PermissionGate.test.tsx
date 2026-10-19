import { describe, it, expect, vi } from 'vitest';
import { usePermission } from '../../presentation/components/common/PermissionGate.jsx';
import * as AuthContextModule from '../../context/AuthContext.jsx';

describe('UI RBAC Guards & usePermission', () => {
  it('should return true for admin accessing delete operations', () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: { id: 'usr-1', role: 'ADMIN' }
    });

    expect(usePermission('stock.delete')).toBe(true);
    expect(usePermission('user.delete')).toBe(true);
    expect(usePermission('settings.restore')).toBe(true);
  });

  it('should return false for technicien attempting admin-only operations', () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: { id: 'usr-2', role: 'TECHNICIEN' }
    });

    expect(usePermission('stock.delete')).toBe(false);
    expect(usePermission('user.create')).toBe(false);
    expect(usePermission('settings.edit')).toBe(false);
  });

  it('should return true for technicien accessing allowed operations like movement.create', () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: { id: 'usr-3', role: 'TECHNICIEN' }
    });

    expect(usePermission('movement.create')).toBe(true);
    expect(usePermission('stock.view')).toBe(true);
  });

  it('should return false when user is not logged in', () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: null
    });

    expect(usePermission('stock.view')).toBe(false);
    expect(usePermission('movement.create')).toBe(false);
  });
});
