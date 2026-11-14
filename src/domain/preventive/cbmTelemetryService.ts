import type { CorrectiveInterventionItem } from '../../types/store';

export type IoTProtocol = 'MQTT' | 'OPC_UA' | 'MODBUS_TCP';

export type CbmParameterType =
  | 'VIBRATION_RMS'
  | 'TEMPERATURE_PALIER'
  | 'PRESSION_HYDRAULIQUE'
  | 'COURANT_MOTEUR'
  | 'DEBIT_AIR';

export type CbmSeverityStatus = 'NORMAL' | 'WARNING' | 'CRITICAL' | 'OUT_OF_RANGE_FAULT';

export interface ICbmSensorRule {
  id: string;
  machineCode: string;
  machineDesignation?: string;
  organe: string;
  parameter: CbmParameterType;
  unit: 'mm/s' | '°C' | 'bar' | 'A' | 'm³/h';
  protocol: IoTProtocol;
  endpointAddress: string; // e.g. 'usine/atelier1/prs01/vib_palier', 'ns=2;s=PRS01.Temp', 'HR:40012'
  direction: 'HIGH_BAD' | 'LOW_BAD';
  warningThreshold: number;
  criticalThreshold: number;
  hysteresis: number;
  minPhysicalBound: number;
  maxPhysicalBound: number;
  autoTriggerDi: boolean;
  recommendedPdrRef?: string;
  lastValue?: number;
  lastStatus?: CbmSeverityStatus;
  lastTimestamp?: string;
}

export interface ICbmTelemetryPayload {
  sensorId?: string;
  protocol?: IoTProtocol;
  endpointAddress?: string;
  machineCode?: string;
  value: number;
  timestamp?: string;
}

export interface ICbmEvaluationResult {
  sensorId: string;
  machineCode: string;
  organe: string;
  parameter: CbmParameterType;
  unit: string;
  protocol: IoTProtocol;
  endpointAddress: string;
  measuredValue: number;
  previousStatus: CbmSeverityStatus;
  status: CbmSeverityStatus;
  warningThreshold: number;
  criticalThreshold: number;
  shouldTriggerCorrectiveDi: boolean;
  diagnosticMessageFr: string;
}

/**
 * Default physical bounds and industrial ISO standards per parameter type:
 * - Vibration RMS: ISO 10816-3 Class II/III (Warning: 4.5 mm/s, Critical: 7.1 mm/s, physical range 0..100 mm/s)
 * - Bearing Temperature: Warning 75 °C, Critical 90 °C (physical range -40..250 °C)
 * - Hydraulic Pressure: Warning 180 bar, Critical 210 bar (physical range 0..450 bar)
 * - Motor Current: Warning 38 A, Critical 45 A (physical range 0..500 A)
 */
export const CBM_PARAMETER_PRESETS: Record<
  CbmParameterType,
  {
    labelFr: string;
    unit: ICbmSensorRule['unit'];
    direction: 'HIGH_BAD' | 'LOW_BAD';
    warningThreshold: number;
    criticalThreshold: number;
    hysteresis: number;
    minPhysicalBound: number;
    maxPhysicalBound: number;
    typePanne: 'M' | 'E' | 'H' | 'P';
  }
> = {
  VIBRATION_RMS: {
    labelFr: 'Vibration RMS Palier (ISO 10816-3)',
    unit: 'mm/s',
    direction: 'HIGH_BAD',
    warningThreshold: 4.5,
    criticalThreshold: 7.1,
    hysteresis: 0.3,
    minPhysicalBound: 0,
    maxPhysicalBound: 100,
    typePanne: 'M',
  },
  TEMPERATURE_PALIER: {
    labelFr: 'Température Palier / Bobinage',
    unit: '°C',
    direction: 'HIGH_BAD',
    warningThreshold: 75,
    criticalThreshold: 90,
    hysteresis: 2.0,
    minPhysicalBound: -40,
    maxPhysicalBound: 250,
    typePanne: 'E',
  },
  PRESSION_HYDRAULIQUE: {
    labelFr: 'Pression Circuit Hydraulique',
    unit: 'bar',
    direction: 'HIGH_BAD',
    warningThreshold: 180,
    criticalThreshold: 210,
    hysteresis: 5.0,
    minPhysicalBound: 0,
    maxPhysicalBound: 450,
    typePanne: 'H',
  },
  COURANT_MOTEUR: {
    labelFr: 'Intensité Moteur Triphasé',
    unit: 'A',
    direction: 'HIGH_BAD',
    warningThreshold: 38,
    criticalThreshold: 45,
    hysteresis: 1.5,
    minPhysicalBound: 0,
    maxPhysicalBound: 500,
    typePanne: 'E',
  },
  DEBIT_AIR: {
    labelFr: 'Débit Air Comprimé Principal',
    unit: 'm³/h',
    direction: 'LOW_BAD',
    warningThreshold: 120,
    criticalThreshold: 85,
    hysteresis: 5.0,
    minPhysicalBound: 0,
    maxPhysicalBound: 2500,
    typePanne: 'P',
  },
};

/**
 * Evaluates a physical telemetry reading against a sensor rule with dimensional sanity bounds
 * and deadband hysteresis to prevent chatter around thresholds.
 */
export function evaluateSensorTelemetry(
  rule: ICbmSensorRule,
  rawValue: number
): ICbmEvaluationResult {
  const val = Number(rawValue);
  const prevStatus: CbmSeverityStatus = rule.lastStatus || 'NORMAL';
  const hyst = Math.max(0, Number(rule.hysteresis) || 0);

  if (!Number.isFinite(val) || val < rule.minPhysicalBound || val > rule.maxPhysicalBound) {
    return {
      sensorId: rule.id,
      machineCode: rule.machineCode,
      organe: rule.organe,
      parameter: rule.parameter,
      unit: rule.unit,
      protocol: rule.protocol,
      endpointAddress: rule.endpointAddress,
      measuredValue: val,
      previousStatus: prevStatus,
      status: 'OUT_OF_RANGE_FAULT',
      warningThreshold: rule.warningThreshold,
      criticalThreshold: rule.criticalThreshold,
      shouldTriggerCorrectiveDi: false,
      diagnosticMessageFr: `Défaut capteur (${rule.protocol} ${rule.endpointAddress}) : valeur ${val} ${rule.unit} hors limites physiques [${rule.minPhysicalBound}..${rule.maxPhysicalBound} ${rule.unit}].`,
    };
  }

  let status: CbmSeverityStatus = 'NORMAL';

  if (rule.direction === 'HIGH_BAD') {
    const critClear = rule.criticalThreshold - hyst;
    const warnClear = rule.warningThreshold - hyst;

    if (val >= rule.criticalThreshold || (prevStatus === 'CRITICAL' && val >= critClear)) {
      status = 'CRITICAL';
    } else if (val >= rule.warningThreshold || (prevStatus === 'WARNING' && val >= warnClear)) {
      status = 'WARNING';
    } else {
      status = 'NORMAL';
    }
  } else {
    // LOW_BAD (e.g., pressure drop or air flow drop)
    const critClear = rule.criticalThreshold + hyst;
    const warnClear = rule.warningThreshold + hyst;

    if (val <= rule.criticalThreshold || (prevStatus === 'CRITICAL' && val <= critClear)) {
      status = 'CRITICAL';
    } else if (val <= rule.warningThreshold || (prevStatus === 'WARNING' && val <= warnClear)) {
      status = 'WARNING';
    } else {
      status = 'NORMAL';
    }
  }

  const shouldTriggerCorrectiveDi = Boolean(rule.autoTriggerDi && status === 'CRITICAL');

  let diagnosticMessageFr = `Mesure nominale : ${val} ${rule.unit} (Seuil alerte: ${rule.warningThreshold} ${rule.unit}).`;
  if (status === 'CRITICAL') {
    diagnosticMessageFr = `ALERTE CRITIQUE CBM [${rule.protocol}] sur ${rule.machineCode} (${rule.organe}) : ${val} ${rule.unit} a franchi le seuil critique (${rule.criticalThreshold} ${rule.unit}).`;
  } else if (status === 'WARNING') {
    diagnosticMessageFr = `Pré-alerte CBM [${rule.protocol}] sur ${rule.machineCode} (${rule.organe}) : ${val} ${rule.unit} (Seuil warning: ${rule.warningThreshold} ${rule.unit}).`;
  }

  return {
    sensorId: rule.id,
    machineCode: rule.machineCode,
    organe: rule.organe,
    parameter: rule.parameter,
    unit: rule.unit,
    protocol: rule.protocol,
    endpointAddress: rule.endpointAddress,
    measuredValue: val,
    previousStatus: prevStatus,
    status,
    warningThreshold: rule.warningThreshold,
    criticalThreshold: rule.criticalThreshold,
    shouldTriggerCorrectiveDi,
    diagnosticMessageFr,
  };
}

/**
 * Processes an incoming MQTT / OPC-UA / Modbus telemetry frame, updates the matched sensor rule,
 * and generates a deduplicated Corrective DI payload if a CRITICAL threshold is breached.
 */
export function ingestTelemetryPayload(
  payload: ICbmTelemetryPayload,
  rules: ICbmSensorRule[],
  existingInterventions: CorrectiveInterventionItem[] = []
): {
  matchedRule: ICbmSensorRule | null;
  updatedRules: ICbmSensorRule[];
  evaluation: ICbmEvaluationResult | null;
  autoCreatedDiPayload: Partial<CorrectiveInterventionItem> | null;
  skippedDuplicateOpenDi: boolean;
} {
  const targetRule =
    (rules || []).find((r) => payload.sensorId && r.id === payload.sensorId) ||
    (rules || []).find(
      (r) =>
        payload.endpointAddress &&
        r.endpointAddress.trim().toLowerCase() === payload.endpointAddress.trim().toLowerCase()
    ) ||
    null;

  if (!targetRule) {
    return {
      matchedRule: null,
      updatedRules: rules,
      evaluation: null,
      autoCreatedDiPayload: null,
      skippedDuplicateOpenDi: false,
    };
  }

  const evaluation = evaluateSensorTelemetry(targetRule, payload.value);
  const nowIso = payload.timestamp || new Date().toISOString();

  const updatedRule: ICbmSensorRule = {
    ...targetRule,
    lastValue: evaluation.measuredValue,
    lastStatus: evaluation.status,
    lastTimestamp: nowIso,
  };

  const updatedRules = rules.map((r) => (r.id === targetRule.id ? updatedRule : r));

  if (!evaluation.shouldTriggerCorrectiveDi) {
    return {
      matchedRule: updatedRule,
      updatedRules,
      evaluation,
      autoCreatedDiPayload: null,
      skippedDuplicateOpenDi: false,
    };
  }

  // Deduplication guard: prevent alert storms if an open CBM DI/BT already exists for this machine & sensor
  const normMachine = targetRule.machineCode.trim().toUpperCase();
  const hasOpenCbmDi = (existingInterventions || []).some((item) => {
    const mCode = String(item.code_machine || item.id_machine_registered || '')
      .trim()
      .toUpperCase();
    if (mCode !== normMachine) return false;
    if (String(item.statut || '').toUpperCase() === 'CLOTURE') return false;
    const isSameSensor =
      item.cbm_sensor_id === targetRule.id ||
      String(item.anomalie || '').includes(targetRule.endpointAddress) ||
      (item.source === 'IOT_CBM_AUTO' && String(item.anomalie || '').includes(targetRule.organe));
    return isSameSensor;
  });

  if (hasOpenCbmDi) {
    return {
      matchedRule: updatedRule,
      updatedRules,
      evaluation,
      autoCreatedDiPayload: null,
      skippedDuplicateOpenDi: true,
    };
  }

  const preset = CBM_PARAMETER_PRESETS[targetRule.parameter];
  const autoCreatedDiPayload: Partial<CorrectiveInterventionItem> = {
    code_machine: targetRule.machineCode,
    type_panne: preset?.typePanne || 'M',
    anomalie: `[CBM ${targetRule.protocol}] Dépassement critique ${targetRule.organe} (${evaluation.measuredValue} ${targetRule.unit} ≥ ${targetRule.criticalThreshold} ${targetRule.unit})`,
    travail_a_faire: `Inspection conditionnelle urgente déclenchée par capteur ${targetRule.protocol} (${targetRule.endpointAddress}). Valeur mesurée: ${evaluation.measuredValue} ${targetRule.unit} (Seuil critique: ${targetRule.criticalThreshold} ${targetRule.unit}). Vérifier ${targetRule.organe}.`,
    priorite: 'HAUTE',
    demandeur: `Automate IoT (${targetRule.protocol})`,
    source: 'IOT_CBM_AUTO',
    cbm_sensor_id: targetRule.id,
    ...(targetRule.recommendedPdrRef ? { pdr_ref: targetRule.recommendedPdrRef } : {}),
  };

  return {
    matchedRule: updatedRule,
    updatedRules,
    evaluation,
    autoCreatedDiPayload,
    skippedDuplicateOpenDi: false,
  };
}
