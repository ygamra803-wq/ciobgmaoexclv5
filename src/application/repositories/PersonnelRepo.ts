import { STORAGE_KEYS } from '../../infrastructure/persistence/storageKeys';
import { storageService } from '../../utils/storageService';
import type { IOperation, ITechnician, IUserRecord } from '../../types/domain';

/**
 * Domain repository owning registered users, technicians, and production operators.
 */
export const PersonnelRepo = {
  savePersonnel<
    TUser = IUserRecord,
    TTech = ITechnician,
    TOp = IOperation,
  >(
    users: ReadonlyArray<TUser> = [],
    technicians: ReadonlyArray<TTech> | null = null,
    operations: ReadonlyArray<TOp> | null = null
  ): TUser[] {
    const cleanUsers = Array.isArray(users) ? [...users] : [];
    storageService.setItem(STORAGE_KEYS.PERSONNEL, cleanUsers);
    if (Array.isArray(technicians)) {
      storageService.setItem(STORAGE_KEYS.TECHNICIANS, [...technicians]);
    }
    if (Array.isArray(operations)) {
      storageService.setItem(STORAGE_KEYS.OPERATIONS, [...operations]);
    }
    return cleanUsers;
  },

  saveUsers<TUser = IUserRecord>(users: ReadonlyArray<TUser> = []): TUser[] {
    return this.savePersonnel(users);
  },

  saveTechnicians<TTech = ITechnician>(technicians: ReadonlyArray<TTech> = []): TTech[] {
    const clean = Array.isArray(technicians) ? [...technicians] : [];
    storageService.setItem(STORAGE_KEYS.TECHNICIANS, clean);
    return clean;
  },

  saveOperations<TOp = IOperation>(operations: ReadonlyArray<TOp> = []): TOp[] {
    const clean = Array.isArray(operations) ? [...operations] : [];
    storageService.setItem(STORAGE_KEYS.OPERATIONS, clean);
    return clean;
  },
};
