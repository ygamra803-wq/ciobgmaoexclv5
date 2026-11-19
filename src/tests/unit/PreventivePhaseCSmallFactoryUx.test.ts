import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildWeeklyCockpitSummary } from '../../presentation/pages/preventive/components/PreventiveWeeklyCockpit';
import {
  loadPersistedCbmRules,
  savePersistedCbmRules,
} from '../../presentation/pages/preventive/components/CbmIoTSensorPanel';
import {
  CBM_PARAMETER_PRESETS,
  ingestTelemetryPayload,
  type ICbmSensorRule,
} from '../../domain/preventive/cbmTelemetryService';
import {
  buildNexusAutomationCallbacks,
  getCurrentIsoWeekKey,
} from '../../presentation/router/hooks/buildNexusAutomationCallbacks';
import { resolvePreventiveLaborRate } from '../../domain/preventive/preventiveScheduleEngine';
import { storageService } from '../../utils/storageService';
import { STORAGE_KEYS } from '../../infrastructure/persistence/storageKeys';
import type { IMachine, ITechnician } from '../../types/domain';
import type { PreventiveTaskItem } from '../../types/store';

describe('Phase C — Small-Factory Preventive Simplification & Field Ergonomics', () => {
  beforeEach(() => {
    localStorage.clear();
    storageService.removeItem(STORAGE_KEYS.CBM_MANUAL_RULES);
  });

  describe('1. Today & This Week Cockpit (buildWeeklyCockpitSummary)', () => {
    const machines: IMachine[] = [
      {
        id: 'PRS-01',
        id_machine_registered: 'PRS-01',
        designation: 'Presse Hydraulique 100T',
        status: 'ACTIVE',
        compteur_heures: 520,
      },
      {
        id: 'CNV-02',
        id_machine_registered: 'CNV-02',
        designation: 'Convoyeur Principal',
        status: 'ACTIVE',
        compteur_heures: 100,
      },
      {
        id: 'OLD-99',
        id_machine_registered: 'OLD-99',
        designation: 'Ancienne Machine Archivée',
        status: 'ARCHIVEE',
        compteur_heures: 900,
      },
    ];

    it('classifies overdue tasks, current week S{N} todo tasks, and completed cycle tasks while excluding archived machines', () => {
      const refDate = new Date('2026-04-15T10:00:00Z');
      const currentWeekNum = 16; // S16

      const tasks: Array<PreventiveTaskItem & { _isOrphan?: boolean }> = [
        {
          id: 'TSK-OVERDUE-COUNTER',
          id_machine: 'PRS-01',
          composant: 'Filtre Hydraulique',
          action_code: 'V',
          frequence: 'Mensuel',
          type_declencheur: 'COMPTEUR',
          compteur_seuil_intervalle: 250,
          compteur_prochain_declenchement: 500, // machine is at 520h -> OVERDUE
          etat: 'À faire',
          planning: { S16: 'V' },
        },
        {
          id: 'TSK-THIS-WEEK-TODO',
          id_machine: 'CNV-02',
          composant: 'Tension Bande',
          action_code: 'C',
          frequence: 'Hebdo',
          type_declencheur: 'CALENDRIER',
          prochaine_echeance: '2026-04-18',
          etat: 'À faire',
          planning: { S16: 'C' },
        },
        {
          id: 'TSK-THIS-WEEK-DONE',
          id_machine: 'CNV-02',
          composant: 'Graissage Paliers',
          action_code: 'G',
          frequence: 'Hebdo',
          type_declencheur: 'CALENDRIER',
          derniere_realisation: '2026-04-14',
          prochaine_echeance: '2026-04-21',
          etat: 'Fait',
          planning: { S16: 'G' },
        },
        {
          id: 'TSK-ARCHIVED-MACH',
          id_machine: 'OLD-99',
          composant: 'Moteur',
          action_code: 'C',
          frequence: 'Hebdo',
          prochaine_echeance: '2026-01-01',
          etat: 'En retard',
          planning: { S16: 'C' },
        },
      ];

      const summary = buildWeeklyCockpitSummary(tasks, machines, currentWeekNum, refDate);

      expect(summary.currentWeekKey).toBe('S16');
      expect(summary.overdueTasks).toHaveLength(1);
      expect(summary.overdueTasks[0].task.id).toBe('TSK-OVERDUE-COUNTER');
      expect(summary.thisWeekTodoTasks).toHaveLength(1);
      expect(summary.thisWeekTodoTasks[0].task.id).toBe('TSK-THIS-WEEK-TODO');
      expect(summary.thisWeekDoneTasks).toHaveLength(1);
      expect(summary.thisWeekDoneTasks[0].task.id).toBe('TSK-THIS-WEEK-DONE');

      // Priority queue puts overdue first, then this week's todo
      expect(summary.priorityQueue.map((e) => e.task.id)).toEqual([
        'TSK-OVERDUE-COUNTER',
        'TSK-THIS-WEEK-TODO',
      ]);
      expect(summary.weeklyTotalCount).toBe(3);
      expect(summary.weeklyCompletionRate).toBe(33);
    });
  });

  describe('2. Manual Conditional Readings Persistence & Zero Fake Sensor Seeds', () => {
    it('starts with 0 rules when storage is empty (Zero Silent Seed Reinjection) and persists manual readings', () => {
      expect(loadPersistedCbmRules()).toEqual([]);

      const preset = CBM_PARAMETER_PRESETS.TEMPERATURE_PALIER;
      const manualRule: ICbmSensorRule = {
        id: 'CBM-PRS-01-MAN',
        machineCode: 'PRS-01',
        organe: 'Palier Moteur Principal',
        parameter: 'TEMPERATURE_PALIER',
        unit: preset.unit,
        protocol: 'MANUEL',
        endpointAddress: 'Thermomètre IR Terrain',
        direction: preset.direction,
        warningThreshold: 75,
        criticalThreshold: 90,
        hysteresis: 2,
        minPhysicalBound: -40,
        maxPhysicalBound: 250,
        autoTriggerDi: true,
        lastStatus: 'NORMAL',
      };

      savePersistedCbmRules([manualRule]);
      const loaded = loadPersistedCbmRules();
      expect(loaded).toHaveLength(1);
      expect(loaded[0].protocol).toBe('MANUEL');

      // Ingest a critical manual reading (94 °C >= 90 °C)
      const ingestResult = ingestTelemetryPayload(
        {
          sensorId: manualRule.id,
          protocol: 'MANUEL',
          value: 94,
          timestamp: '2026-04-15T11:00:00Z',
        },
        loaded,
        []
      );

      expect(ingestResult.evaluation?.status).toBe('CRITICAL');
      expect(ingestResult.autoCreatedDiPayload).not.toBeNull();
      expect(ingestResult.autoCreatedDiPayload?.code_machine).toBe('PRS-01');

      savePersistedCbmRules(ingestResult.updatedRules);
      const reloadedAfterReading = loadPersistedCbmRules();
      expect(reloadedAfterReading[0].lastValue).toBe(94);
      expect(reloadedAfterReading[0].lastStatus).toBe('CRITICAL');
      expect(storageService.getItem(STORAGE_KEYS.CBM_MANUAL_RULES)).toBeTruthy();
    });
  });

  describe('3. Anti-Recurrence Bridge Immediate Current-Week Linking & Deduplication', () => {
    it('schedules anti-recurrence routines directly on the current ISO week instead of S1 and deduplicates existing routines', () => {
      const currentWeekKey = getCurrentIsoWeekKey();
      expect(currentWeekKey).toMatch(/^S([1-9]|[1-4][0-9]|5[0-2])$/);

      const handleCreatePlanWithTasks = vi.fn();
      const handleAddPreventiveAction = vi.fn();
      const showToast = vi.fn();

      const machines: IMachine[] = [
        {
          id: 'FRM-01',
          id_machine_registered: 'FRM-01',
          designation: 'Fraiseuse CNC',
          id_zone_default: 'Z-USINAGE',
          technician: 'Karim Benali',
        },
      ];

      const existingTasks: PreventiveTaskItem[] = [];

      const callbacks = buildNexusAutomationCallbacks({
        machines,
        preventiveTasks: existingTasks,
        handleCreatePlanWithTasks,
        handleAddPreventiveAction,
        showToast,
      });

      const outcome1 = callbacks.onAdoptRecommendation({
        code_machine: 'FRM-01',
        anomalie: 'Surchauffe_Broche',
        suggestedIntervalDays: 7,
        recommendedAction: 'Vérifier refroidissement et graissage broche',
      });

      expect(outcome1.skipped).toBe(false);
      expect(outcome1.semaine_cible).toBe(currentWeekKey);
      expect(handleCreatePlanWithTasks).toHaveBeenCalledTimes(1);

      const [planMeta, tasksPayload] = handleCreatePlanWithTasks.mock.calls[0];
      expect(planMeta.id_machine).toBe('FRM-01');
      expect(planMeta.semaine_cible).toBe(currentWeekKey);
      expect(planMeta.date_prevue).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(tasksPayload[0].composant).toBe('Contrôle Surchauffe Broche');
      expect(tasksPayload[0].frequence).toBe('Hebdo');

      // Now simulate that the task exists in preventiveTasks and verify deduplication
      const callbacksWithExisting = buildNexusAutomationCallbacks({
        machines,
        preventiveTasks: [
          {
            id: 'TSK-1',
            id_machine: 'FRM-01',
            composant: 'Contrôle Surchauffe Broche',
          } as PreventiveTaskItem,
        ],
        handleCreatePlanWithTasks,
        handleAddPreventiveAction,
        showToast,
      });

      const outcome2 = callbacksWithExisting.onAdoptRecommendation({
        code_machine: 'FRM-01',
        anomalie: 'Surchauffe_Broche',
      });
      expect(outcome2.skipped).toBe(true);
      expect(handleCreatePlanWithTasks).toHaveBeenCalledTimes(1);
    });
  });

  describe('4. Single-PC Multi-Role Technician Hourly Rate Resolution', () => {
    it('resolves the selected field technician hourly rate on a shared workshop PC', () => {
      const technicians: ITechnician[] = [
        {
          id_technician: 'TECH-01',
          nom: 'Youssef',
          prenom: 'Alami',
          taux_horaire: 55,
          is_active: true,
        },
        {
          id_technician: 'TECH-02',
          nom: 'Mehdi',
          prenom: 'Tazi',
          taux_horaire: 42,
          is_active: true,
        },
      ];

      expect(resolvePreventiveLaborRate(technicians, 'Youssef Alami')).toBe(55);
      expect(resolvePreventiveLaborRate(technicians, 'Mehdi Tazi')).toBe(42);
      expect(resolvePreventiveLaborRate(technicians, 'Inconnu')).toBe(35);
    });
  });
});
