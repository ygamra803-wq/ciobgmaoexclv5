import React, { useState } from 'react';
import {
  Radio,
  Activity,
  AlertTriangle,
  CheckCircle2,
  Plus,
  Zap,
  Thermometer,
  Gauge,
} from 'lucide-react';
import {
  CBM_PARAMETER_PRESETS,
  ingestTelemetryPayload,
  type CbmParameterType,
  type ICbmEvaluationResult,
  type ICbmSensorRule,
  type IoTProtocol,
} from '../../../../domain/preventive/cbmTelemetryService';
import { useGmaoStore } from '../../../../store/useGmaoStore';
import type { IMachine } from '../../../../types/domain';

interface CbmIoTSensorPanelProps {
  machines: IMachine[];
  showToast?: (message: string, type?: 'success' | 'warning' | 'error' | 'info') => void;
}

export default function CbmIoTSensorPanel({
  machines = [],
  showToast,
}: CbmIoTSensorPanelProps) {
  const correctiveInterventions = useGmaoStore((s) => s.correctiveInterventions) || [];
  const handleAddDemandeIntervention = useGmaoStore((s) => s.handleAddDemandeIntervention);

  const defaultMachineCode = String(
    machines[0]?.id_machine_registered || machines[0]?.id || machines[0]?.code || 'PRS-01'
  ).trim();

  const [sensorRules, setSensorRules] = useState<ICbmSensorRule[]>(() => {
    if (machines.length === 0) return [];
    const m0 = machines[0];
    const code = String(m0.id_machine_registered || m0.id || m0.code || 'PRS-01').trim();
    return [
      {
        id: `CBM-${code}-VIB`,
        machineCode: code,
        machineDesignation: m0.designation || code,
        organe: 'Palier Arbre Principal',
        parameter: 'VIBRATION_RMS',
        unit: 'mm/s',
        protocol: 'MQTT',
        endpointAddress: `usine/atelier/${code.toLowerCase()}/vib_rms`,
        direction: 'HIGH_BAD',
        warningThreshold: 4.5,
        criticalThreshold: 7.1,
        hysteresis: 0.3,
        minPhysicalBound: 0,
        maxPhysicalBound: 100,
        autoTriggerDi: true,
        lastValue: 2.8,
        lastStatus: 'NORMAL',
      },
      {
        id: `CBM-${code}-TEMP`,
        machineCode: code,
        machineDesignation: m0.designation || code,
        organe: 'Bobinage Moteur Principal',
        parameter: 'TEMPERATURE_PALIER',
        unit: '°C',
        protocol: 'OPC_UA',
        endpointAddress: `ns=2;s=${code}.Moteur.TempC`,
        direction: 'HIGH_BAD',
        warningThreshold: 75,
        criticalThreshold: 90,
        hysteresis: 2.0,
        minPhysicalBound: -40,
        maxPhysicalBound: 250,
        autoTriggerDi: true,
        lastValue: 62,
        lastStatus: 'NORMAL',
      },
    ];
  });

  // New sensor rule form
  const [newMachCode, setNewMachCode] = useState<string>(defaultMachineCode);
  const [newOrgane, setNewOrgane] = useState<string>('Palier / Roulement');
  const [newParam, setNewParam] = useState<CbmParameterType>('VIBRATION_RMS');
  const [newProtocol, setNewProtocol] = useState<IoTProtocol>('MQTT');
  const [newEndpoint, setNewEndpoint] = useState<string>(
    `usine/atelier/${defaultMachineCode.toLowerCase()}/capteur_01`
  );

  // Telemetry Simulator state
  const [selectedSensorId, setSelectedSensorId] = useState<string>(
    sensorRules[0]?.id || ''
  );
  const [simulatedValue, setSimulatedValue] = useState<string>('8.4');
  const [lastEval, setLastEval] = useState<ICbmEvaluationResult | null>(null);

  const handleAddSensorRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMachCode) return;
    const preset = CBM_PARAMETER_PRESETS[newParam];
    const machObj = machines.find(
      (m) =>
        String(m.id_machine_registered || m.id || m.code || '').trim().toUpperCase() ===
        newMachCode.trim().toUpperCase()
    );
    const created: ICbmSensorRule = {
      id: `CBM-${newMachCode}-${Date.now().toString().slice(-4)}`,
      machineCode: newMachCode,
      machineDesignation: machObj?.designation || newMachCode,
      organe: newOrgane.trim() || 'Organe Machine',
      parameter: newParam,
      unit: preset.unit,
      protocol: newProtocol,
      endpointAddress: newEndpoint.trim() || `HR:40001`,
      direction: preset.direction,
      warningThreshold: preset.warningThreshold,
      criticalThreshold: preset.criticalThreshold,
      hysteresis: preset.hysteresis,
      minPhysicalBound: preset.minPhysicalBound,
      maxPhysicalBound: preset.maxPhysicalBound,
      autoTriggerDi: true,
      lastStatus: 'NORMAL',
    };
    setSensorRules((prev) => [...prev, created]);
    setSelectedSensorId(created.id);
    showToast?.(
      `Capteur CBM ${created.protocol} (${created.endpointAddress}) rattaché à ${created.machineCode}.`,
      'success'
    );
  };

  const handleSimulateTelemetry = (e: React.FormEvent) => {
    e.preventDefault();
    const targetId = selectedSensorId || sensorRules[0]?.id;
    if (!targetId) return;

    const val = Number(simulatedValue);
    const result = ingestTelemetryPayload(
      {
        sensorId: targetId,
        value: val,
      },
      sensorRules,
      correctiveInterventions
    );

    setSensorRules(result.updatedRules);
    setLastEval(result.evaluation);

    if (result.autoCreatedDiPayload && typeof handleAddDemandeIntervention === 'function') {
      handleAddDemandeIntervention(result.autoCreatedDiPayload);
      showToast?.(
        `Alerte Critique CBM : DI automatique générée pour ${result.matchedRule?.machineCode} (${result.evaluation?.measuredValue} ${result.evaluation?.unit}) !`,
        'error'
      );
    } else if (result.skippedDuplicateOpenDi) {
      showToast?.(
        `Seuil critique atteint, mais une DI CBM est déjà ouverte pour ce capteur (Anti-spam).`,
        'warning'
      );
    } else if (result.evaluation?.status === 'WARNING') {
      showToast?.(
        `Pré-alerte CBM enregistrée : ${result.evaluation.diagnosticMessageFr}`,
        'warning'
      );
    } else if (result.evaluation?.status === 'OUT_OF_RANGE_FAULT') {
      showToast?.(result.evaluation.diagnosticMessageFr, 'error');
    } else {
      showToast?.(`Télémesure nominale enregistrée (${val}).`, 'success');
    }
  };

  return (
    <div
      className="bg-white rounded-3xl border border-slate-200 p-5 shadow-xs space-y-5 text-xs"
      data-testid="cbm-iot-sensor-panel"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 border border-cyan-300 text-cyan-700 flex items-center justify-center shrink-0">
            <Radio className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
              <span>Maintenance Conditionnelle & Capteurs IoT (CBM : MQTT / OPC-UA / Modbus)</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cyan-50 text-cyan-800 border border-cyan-200">
                ISO 10816-3
              </span>
            </h3>
            <p className="text-[11px] text-slate-500">
              Surveillance temps réel avec hystérésis, bornes physiques anti-bruit et déclenchement automatique de DI sur dépassement critique.
            </p>
          </div>
        </div>
      </div>

      {/* Active Sensors Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {sensorRules.map((rule) => {
          const statusCls =
            rule.lastStatus === 'CRITICAL'
              ? 'bg-rose-50 border-rose-300 text-rose-950'
              : rule.lastStatus === 'WARNING'
              ? 'bg-amber-50 border-amber-300 text-amber-950'
              : rule.lastStatus === 'OUT_OF_RANGE_FAULT'
              ? 'bg-purple-50 border-purple-300 text-purple-950'
              : 'bg-slate-50 border-slate-200 text-slate-900';

          return (
            <div
              key={rule.id}
              className={`p-3.5 rounded-2xl border ${statusCls} flex flex-col justify-between gap-2`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {rule.parameter === 'TEMPERATURE_PALIER' ? (
                    <Thermometer className="w-4 h-4 text-amber-600" />
                  ) : rule.parameter === 'VIBRATION_RMS' ? (
                    <Activity className="w-4 h-4 text-cyan-600" />
                  ) : (
                    <Gauge className="w-4 h-4 text-indigo-600" />
                  )}
                  <span className="font-black font-mono text-xs">{rule.machineCode}</span>
                  <span className="font-bold text-slate-700">• {rule.organe}</span>
                </div>
                <span className="px-2 py-0.5 rounded font-mono font-bold text-[10px] bg-white border border-slate-200">
                  {rule.protocol} • {rule.endpointAddress}
                </span>
              </div>

              <div className="flex items-center justify-between pt-1">
                <div className="text-[11px] font-mono">
                  Seuils : Warn <b>{rule.warningThreshold} {rule.unit}</b> | Crit{' '}
                  <b className="text-rose-700">{rule.criticalThreshold} {rule.unit}</b> (±{rule.hysteresis})
                </div>
                <div className="flex items-center gap-2">
                  {rule.lastValue !== undefined && (
                    <span className="font-mono font-black text-sm">
                      {rule.lastValue} {rule.unit}
                    </span>
                  )}
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                      rule.lastStatus === 'CRITICAL'
                        ? 'bg-rose-600 text-white'
                        : rule.lastStatus === 'WARNING'
                        ? 'bg-amber-500 text-slate-950'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    {rule.lastStatus || 'NORMAL'}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Telemetry Simulator & Rule Creator */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-2">
        {/* Ingestion / Test Frame */}
        <form
          onSubmit={handleSimulateTelemetry}
          className="p-4 rounded-2xl bg-slate-900 text-white space-y-3"
        >
          <div className="flex items-center justify-between">
            <span className="font-black text-cyan-300 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-cyan-400" />
              Ingestion Télémesure IoT / Test Déclenchement DI
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className="sm:col-span-2">
              <label className="block text-[10px] text-slate-400 uppercase font-bold mb-1">
                Capteur Cible
              </label>
              <select
                value={selectedSensorId}
                onChange={(e) => setSelectedSensorId(e.target.value)}
                className="w-full py-1.5 px-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white font-mono text-xs"
              >
                {sensorRules.map((r) => (
                  <option key={r.id} value={r.id}>
                    [{r.protocol}] {r.machineCode} — {r.organe} (Crit: {r.criticalThreshold} {r.unit})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] text-slate-400 uppercase font-bold mb-1">
                Valeur Mesurée
              </label>
              <input
                type="number"
                step="0.1"
                required
                value={simulatedValue}
                onChange={(e) => setSimulatedValue(e.target.value)}
                className="w-full py-1.5 px-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white font-mono font-bold text-xs text-center"
              />
            </div>
          </div>

          {lastEval && (
            <div
              className={`p-2.5 rounded-xl border text-[11px] flex items-start gap-2 ${
                lastEval.status === 'CRITICAL'
                  ? 'bg-rose-950/90 border-rose-500 text-rose-100'
                  : lastEval.status === 'WARNING'
                  ? 'bg-amber-950/90 border-amber-500 text-amber-100'
                  : 'bg-emerald-950/80 border-emerald-600 text-emerald-100'
              }`}
            >
              {lastEval.status === 'CRITICAL' ? (
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              )}
              <span>{lastEval.diagnosticMessageFr}</span>
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs cursor-pointer"
            >
              Injecter Trame & Évaluer Seuils CBM
            </button>
          </div>
        </form>

        {/* Add New CBM Sensor Rule */}
        <form
          onSubmit={handleAddSensorRule}
          className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3"
        >
          <div className="font-black text-slate-900 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
            <Plus className="w-4 h-4 text-indigo-600" />
            Ajouter un Capteur Conditionnel (MQTT / OPC-UA / Modbus)
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-bold text-slate-600 mb-0.5">Machine</label>
              <select
                value={newMachCode}
                onChange={(e) => setNewMachCode(e.target.value)}
                className="w-full py-1.5 px-2 rounded-lg border border-slate-300 bg-white font-mono text-xs"
              >
                {machines.map((m) => {
                  const code = String(m.id_machine_registered || m.id || m.code || '');
                  return (
                    <option key={code} value={code}>
                      {code} — {m.designation}
                    </option>
                  );
                })}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                Paramètre Physique
              </label>
              <select
                value={newParam}
                onChange={(e) => setNewParam(e.target.value as CbmParameterType)}
                className="w-full py-1.5 px-2 rounded-lg border border-slate-300 bg-white text-xs font-semibold"
              >
                {(Object.keys(CBM_PARAMETER_PRESETS) as CbmParameterType[]).map((k) => (
                  <option key={k} value={k}>
                    {CBM_PARAMETER_PRESETS[k].labelFr} ({CBM_PARAMETER_PRESETS[k].unit})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-600 mb-0.5">Protocole</label>
              <select
                value={newProtocol}
                onChange={(e) => setNewProtocol(e.target.value as IoTProtocol)}
                className="w-full py-1.5 px-2 rounded-lg border border-slate-300 bg-white font-mono text-xs"
              >
                <option value="MQTT">MQTT (Topic JSON)</option>
                <option value="OPC_UA">OPC-UA (NodeId)</option>
                <option value="MODBUS_TCP">Modbus TCP (Registre HR)</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                Adresse Topic / NodeId / Registre
              </label>
              <input
                type="text"
                required
                value={newEndpoint}
                onChange={(e) => setNewEndpoint(e.target.value)}
                className="w-full py-1.5 px-2 rounded-lg border border-slate-300 bg-white font-mono text-xs"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <input
              type="text"
              value={newOrgane}
              onChange={(e) => setNewOrgane(e.target.value)}
              placeholder="Organe surveillé (ex: Palier Avant)"
              className="py-1.5 px-2.5 rounded-lg border border-slate-300 bg-white text-xs w-48"
            />
            <button
              type="submit"
              className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs cursor-pointer"
            >
              Rattacher Capteur
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
