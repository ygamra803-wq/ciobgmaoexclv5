import { useRef } from 'react';
import { Logger } from '../core/logger/LoggerService';
import { SparePartApplicationService } from '../application/services/SparePartApplicationService';
import { MachineApplicationService } from '../application/services/MachineApplicationService';
import { TaskApplicationService } from '../application/services/TaskApplicationService';

/**
 * Hook to manage one-way persistence synchronization from React state to Enterprise IndexedDB repositories.
 */
export function useEnterpriseDbSync(state) {
  const { rawStock, machines, mouvements } = state;
  const syncInProgressRef = useRef(false);

  async function syncEnterpriseDb() {
    if (syncInProgressRef.current) return;
    syncInProgressRef.current = true;

    try {
      const sparePartService = new SparePartApplicationService();
      const machineService = new MachineApplicationService();
      const taskService = new TaskApplicationService();

      const [idbParts, idbMachines, idbTasks] = await Promise.all([
        sparePartService.listSpareParts(),
        machineService.listMachines(),
        taskService.listTasks(),
      ]);

      // Parts Sync (State -> IDB only)
      if (idbParts.length === 0 && rawStock.length > 0) {
        const partsToCreate = rawStock.map(p => ({
          ...p,
          id: p.id || p.ref || `part_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`
        }));
        await Promise.all(partsToCreate.map((p) => sparePartService.createSparePart(p)));
      }

      // Machines Sync (State -> IDB only)
      if (idbMachines.length === 0 && machines.length > 0) {
        const machinesToCreate = machines.map(m => ({
          ...m,
          id: m.id || m.id_machine_registered || `mch_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
          id_machine_registered: m.id_machine_registered || m.id
        }));
        await Promise.all(machinesToCreate.map((m) => machineService.createMachine(m)));
      }

      // Tasks Sync (State -> IDB only)
      if (idbTasks.length === 0 && mouvements.length > 0) {
        const tasksToCreate = mouvements.map(t => ({
          ...t,
          id: t.id || t.code_bon || `task_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`
        }));
        await Promise.all(tasksToCreate.map((t) => taskService.createTask(t)));
      }
    } catch (_err) {
      Logger.error('Enterprise DB Sync Error:', _err, 'useEnterpriseDbSync');
    } finally {
      syncInProgressRef.current = false;
    }
  }

  return { syncEnterpriseDb };
}
