import { Factory, CheckCircle2, AlertTriangle, Activity } from 'lucide-react';
import { useI18n } from '../../../../i18n/I18nContext';
import { GmaoKpiCard, GmaoKpiGrid } from '../../../components/common/GmaoKpiCard';

export default function MachinesKPIBar({
  kpis = {},
  statusFilter,
  setStatusFilter,
}) {
  const { t } = useI18n();

  const total = Number(kpis.total) || 0;
  const enService = Number(kpis.enService) || 0;
  const stoppedCount = (Number(kpis.enMaintenance) || 0) + (Number(kpis.enArret) || 0);
  const availabilityRate = total > 0 ? Math.round((enService / total) * 100) : 0;

  return (
    <GmaoKpiGrid id="machines-kpis-grid" columns={4}>
      {/* Card 1: Total Machines */}
      <GmaoKpiCard
        id="machines-kpi-total"
        title={t('machines.kpis.global_park', 'Parc Global')}
        value={total}
        unit="machines"
        icon={Factory}
        color="emerald"
        valueColored={false}
        isActive={statusFilter === 'ALL'}
        onClick={() => setStatusFilter('ALL')}
        badgeText={t(
          'machines.kpis.active_families',
          `${kpis.activeFamiliesCount || 0} Familles actives`,
          { count: kpis.activeFamiliesCount || 0 }
        )}
        footerLabel="Registre actif :"
        footerValue="Feuille Machines"
      />

      {/* Card 2: En Service */}
      <GmaoKpiCard
        id="machines-kpi-en-service"
        title={t('machines.kpis.in_service', 'En Service (Opérationnel)')}
        value={enService}
        unit="actives"
        icon={CheckCircle2}
        color="emerald"
        valueColored={true}
        isActive={statusFilter === 'En Service'}
        onClick={() => setStatusFilter(statusFilter === 'En Service' ? 'ALL' : 'En Service')}
        badgeText="Production nominale"
        footerLabel="Disponibilité parc :"
        footerValue={`${availabilityRate}% en ligne`}
      />

      {/* Card 3: En Maintenance / Panne */}
      <GmaoKpiCard
        id="machines-kpi-maintenance"
        title={t('machines.kpis.maintenance_stopped', 'En Maintenance / Arrêt')}
        value={stoppedCount}
        unit="équipements"
        icon={AlertTriangle}
        color="amber"
        valueColored={true}
        pulseIcon={stoppedCount > 0}
        isActive={statusFilter === 'En Maintenance'}
        onClick={() =>
          setStatusFilter(statusFilter === 'En Maintenance' ? 'ALL' : 'En Maintenance')
        }
        badgeText={t('machines.kpis.interventions_required', 'Interventions requises')}
        footerLabel="Impact ligne :"
        footerValue={stoppedCount > 0 ? 'Suivi prioritaire' : '0 arrêt'}
      />

      {/* Card 4: Traçabilité Sorties / Interventions */}
      <GmaoKpiCard
        id="machines-kpi-interventions"
        title={t('machines.kpis.registered_interventions', 'Interventions Enregistrées')}
        value={kpis.totalInterventions || 0}
        unit="mouvements"
        icon={Activity}
        color="indigo"
        valueColored={true}
        badgeText="Historique PDR & BT"
        footerLabel="Formule Excel :"
        footerValue="=COUNTIF(Mvt[Machine])"
      />
    </GmaoKpiGrid>
  );
}
