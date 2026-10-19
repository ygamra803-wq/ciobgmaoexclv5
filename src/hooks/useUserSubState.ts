import { useState, useMemo, useCallback, useEffect } from 'react';
import { STORAGE_KEYS } from '../infrastructure/persistence/storageKeys';
import { loadCollection } from '../infrastructure/persistence/migrateStorage';
import { DataGateway } from '../application/DataGateway';
import seedUsers from '../data/users/seedUsers.json';

function isRealPersonnelUser(u) {
  if (!u || typeof u !== 'object') return false;
  if (u.passwordHash) return false;
  const idStr = String(u.id || u.id_technician || u.id_operation || '').trim().toUpperCase();
  const usernameStr = String(u.username || '').trim().toLowerCase();
  // Filter out system login accounts that might have leaked into users storage
  if (['ADMIN', 'MAGASINIER', 'VIEWER'].includes(idStr) || ['admin', 'magasinier', 'viewer'].includes(usernameStr)) {
    return false;
  }
  if (idStr === 'TECH' && (!u.nom || u.nom === 'Technicien Maintenance')) {
    return false;
  }
  return true;
}

function sanitizePersonnelList(list) {
  if (!Array.isArray(list)) return [];
  return list.filter(isRealPersonnelUser);
}

/**
 * 🏛️ GMAO User Sub-State & Single Source of Truth
 * Conforme à la Constitution GMAO :
 * Le tableau `users` (Utilisateurs / Personnel) est le SEUL et UNIQUE conteneur maître (Single Source of Truth)
 * pour les techniciens, opérateurs et responsables d'usine.
 */
export function useUserSubState(groupedState = {}) {
  const [users, setUsers] = useState(() => {
    if (Array.isArray(groupedState.users)) {
      return sanitizePersonnelList(groupedState.users);
    }
    const loaded = loadCollection(STORAGE_KEYS.PERSONNEL, {
      allowDemoFallback: true,
      demoSeed: seedUsers,
    });
    return sanitizePersonnelList(loaded);
  });

  // Vue dérivée stricte : Techniciens = FILTER(users, role === 'Technicien')
  const technicians = useMemo(() => {
    return users
      .filter((u) => {
        if (!u || !isRealPersonnelUser(u)) return false;
        const roleStr = String(u.role || u.type_profil || '').toLowerCase();
        const idStr = String(u.id || u.id_technician || '').toUpperCase();
        return roleStr.includes('tech') || idStr.startsWith('TECH');
      })
      .map((u) => ({
        ...u,
        id_technician: u.id_technician || u.id,
      }));
  }, [users]);

  // Vue dérivée stricte : Opérations & Chefs = FILTER(users, role !== 'Technicien')
  const operations = useMemo(() => {
    return users
      .filter((u) => {
        if (!u || !isRealPersonnelUser(u)) return false;
        const roleStr = String(u.role || u.type_profil || '').toLowerCase();
        const idStr = String(u.id || u.id_technician || '').toUpperCase();
        return !roleStr.includes('tech') && !idStr.startsWith('TECH');
      })
      .map((u) => ({
        ...u,
        id_operation: u.id_operation || u.id,
      }));
  }, [users]);

  const setTechnicians = useCallback((updater) => {
    setUsers((prevUsers) => {
      const currentTechs = prevUsers.filter((u) => {
        if (!u || !isRealPersonnelUser(u)) return false;
        const roleStr = String(u.role || u.type_profil || '').toLowerCase();
        const idStr = String(u.id || u.id_technician || '').toUpperCase();
        return roleStr.includes('tech') || idStr.startsWith('TECH');
      });
      const nonTechs = prevUsers.filter((u) => {
        if (!u || !isRealPersonnelUser(u)) return false;
        const roleStr = String(u.role || u.type_profil || '').toLowerCase();
        const idStr = String(u.id || u.id_technician || '').toUpperCase();
        return !roleStr.includes('tech') && !idStr.startsWith('TECH');
      });

      const nextTechs = typeof updater === 'function' ? updater(currentTechs) : updater;
      const formatted = (Array.isArray(nextTechs) ? nextTechs : []).map((t) => ({
        ...t,
        id: t.id || t.id_technician || `TECH-${Date.now()}`,
        id_technician: t.id_technician || t.id,
        role: 'Technicien',
        type_profil: 'TECHNICIEN',
      }));

      return [...formatted, ...nonTechs];
    });
  }, []);

  const setOperations = useCallback((updater) => {
    setUsers((prevUsers) => {
      const currentOps = prevUsers.filter((u) => {
        if (!u || !isRealPersonnelUser(u)) return false;
        const roleStr = String(u.role || u.type_profil || '').toLowerCase();
        const idStr = String(u.id || u.id_operation || '').toUpperCase();
        return !roleStr.includes('tech') && !idStr.startsWith('TECH');
      });
      const techs = prevUsers.filter((u) => {
        if (!u || !isRealPersonnelUser(u)) return false;
        const roleStr = String(u.role || u.type_profil || '').toLowerCase();
        const idStr = String(u.id || u.id_technician || '').toUpperCase();
        return roleStr.includes('tech') || idStr.startsWith('TECH');
      });

      const nextOps = typeof updater === 'function' ? updater(currentOps) : updater;
      const formatted = (Array.isArray(nextOps) ? nextOps : []).map((o) => ({
        ...o,
        id: o.id || o.id_operation || `RESP-${Date.now()}`,
        id_operation: o.id_operation || o.id,
        role: o.role || (o.type_profil === 'OPERATEUR' ? 'Operateur' : 'Responsable'),
        type_profil: o.type_profil || (o.role === 'Operateur' ? 'OPERATEUR' : 'RESPONSABLE'),
      }));

      return [...techs, ...formatted];
    });
  }, []);

  useEffect(() => {
    const sanitized = sanitizePersonnelList(users);
    DataGateway.savePersonnel(sanitized, technicians, operations);
  }, [users, technicians, operations]);

  return {
    users,
    setUsers,
    technicians,
    setTechnicians,
    operations,
    setOperations,
  };
}
