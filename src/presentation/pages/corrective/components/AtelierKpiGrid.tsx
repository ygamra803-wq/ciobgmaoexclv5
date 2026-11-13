import React from 'react';
import { Hammer, Clock, Cog, PackageCheck, CheckCircle2 } from 'lucide-react';
import { GmaoKpiCard, GmaoKpiGrid } from '../../../components/common/GmaoKpiCard';

export interface AtelierKpis {
  total: number;
  emis: number;
  enCours: number;
  pret: number;
  receptionne: number;
  annule: number;
  activeCount: number;
  withBtCount: number;
  brCount: number;
  rectCount: number;
}

export interface AtelierKpiGridProps {
  kpis: AtelierKpis;
  statusFilter: string;
  onSelectStatusFilter: (status: string) => void;
}

export const AtelierKpiGrid: React.FC<AtelierKpiGridProps> = ({
  kpis,
  statusFilter,
  onSelectStatusFilter,
}) => {
  return (
    <GmaoKpiGrid columns={5}>
      <GmaoKpiCard
        title="Total Bons Atelier"
        value={kpis.total}
        unit="bons"
        icon={Hammer}
        color="blue"
        valueColored={false}
        isActive={statusFilter === 'ALL'}
        onClick={() => onSelectStatusFilter('ALL')}
        badgeText="Registre BR & RECT"
        footerLabel="En cours actifs :"
        footerValue={`${kpis.activeCount} actif(s)`}
      />

      <GmaoKpiCard
        title="Émis (Attente Atelier)"
        value={kpis.emis}
        unit="en attente"
        icon={Clock}
        color="amber"
        isActive={statusFilter === 'EMIS'}
        onClick={() => onSelectStatusFilter('EMIS')}
        badgeText="Prise en charge requise"
        pulseBadge={kpis.emis > 0}
        footerLabel="Origine :"
        footerValue="Section Maint. (SM)"
      />

      <GmaoKpiCard
        title="En Cours Fabrication"
        value={kpis.enCours}
        unit="en usinage"
        icon={Cog}
        color="cyan"
        isActive={statusFilter === 'EN_COURS_FABRICATION'}
        onClick={() => onSelectStatusFilter('EN_COURS_FABRICATION')}
        badgeText="Tournage / Rectification"
        pulseBadge={kpis.enCours > 0}
        footerLabel="Répartition :"
        footerValue={`${kpis.brCount} BR · ${kpis.rectCount} RECT`}
      />

      <GmaoKpiCard
        title="Prêts Livraison SM"
        value={kpis.pret}
        unit="disponibles"
        icon={PackageCheck}
        color="indigo"
        isActive={statusFilter === 'PRET_LIVRAISON'}
        onClick={() => onSelectStatusFilter('PRET_LIVRAISON')}
        badgeText="Usinage terminé"
        footerLabel="Action SM :"
        footerValue="Réception & Montage"
      />

      <GmaoKpiCard
        title="Réceptionnés & Montés"
        value={kpis.receptionne}
        unit="montés OK"
        icon={CheckCircle2}
        color="emerald"
        isActive={statusFilter === 'RECEPTIONNE_MONTAGE'}
        onClick={() => onSelectStatusFilter('RECEPTIONNE_MONTAGE')}
        badgeText="Clôture BT débloquée"
        footerLabel="Taux achèvement :"
        footerValue={`${kpis.total ? Math.round((kpis.receptionne / kpis.total) * 100) : 0}%`}
      />
    </GmaoKpiGrid>
  );
};
