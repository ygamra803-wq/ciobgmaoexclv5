import React, { useMemo, useState } from 'react';
import {
  BookOpen,
  Boxes,
  Search,
  ExternalLink,
  Code2,
  UserCheck,
  Layers,
  ChevronRight,
  CheckCircle2,
  Clock,
  FileText,
  Sparkles,
  ArrowUpRight,
  Cpu,
  Wrench,
  CalendarClock,
  Factory,
  BarChart3,
  Settings,
} from 'lucide-react';

interface GuideViewProps {
  onNavigateToTab?: (tabId: string) => void;
}

interface ParsedMarkdownDoc {
  id: string;
  groupId: string;
  groupTitle: string;
  docType: 'architecture' | 'page';
  audience: 'developer' | 'user';
  tabId?: string;
  title: string;
  subtitle?: string;
  summary: string;
  relatedTabs: string[];
  body: string;
  filePath: string;
}

interface RoadmapGroupMeta {
  groupId: string;
  number: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  tabs: { tabId: string; label: string }[];
}

const MODULE_ROADMAP: RoadmapGroupMeta[] = [
  {
    groupId: '01-stock-pdr',
    number: '01',
    title: 'Stock PDR, Mouvements & Commandes (PO)',
    description:
      'Catalogue articles PDR, moteur O(1) IncrementalStockIndex, réservations Maker-Checker, 5 flux magasin, demandes terrain et cycle de réapprovisionnement fournisseurs (PO).',
    icon: Boxes,
    tabs: [
      { tabId: 'stock', label: 'Stock Articles & PO' },
      { tabId: 'sortie', label: 'Sortie & Entrée Rapide' },
      { tabId: 'types', label: 'Types PDR' },
      { tabId: 'designations', label: 'Désignations PDR' },
    ],
  },
  {
    groupId: '02-parc-machines',
    number: '02',
    title: 'Parc Machines, Blueprints & Architecture 3-Tiers',
    description:
      'Machines enregistrées, hiérarchie opérationnelle (MACHINE / LINE), Familles, Modèles constructeurs, Blueprints cognitifs et Passeport Santé.',
    icon: Factory,
    tabs: [
      { tabId: 'machines', label: 'Machines Enregistrées' },
      { tabId: 'families', label: 'Familles de Machines' },
      { tabId: 'templates', label: 'Modèles (Templates)' },
      { tabId: 'blueprints', label: 'Blueprints Machines' },
      { tabId: 'nexus', label: 'Arborescence Nexus' },
    ],
  },
  {
    groupId: '03-preventive-meters',
    number: '03',
    title: 'Maintenance Préventive & Compteurs (Meter PM)',
    description:
      'Matrice annuelle 12 mois, exécutions horodatées (PreventiveExecution), suivi par compteurs (heures/cycles) et référentiel d’ingénierie préventive.',
    icon: CalendarClock,
    tabs: [
      { tabId: 'preventive', label: 'Planning & Compteurs Préventifs' },
      { tabId: 'preventive_referentiel', label: 'Ingénierie & Référentiel Préventif' },
    ],
  },
  {
    groupId: '04-corrective-di-bt',
    number: '04',
    title: 'Maintenance Corrective (DI / BT & Clôture)',
    description:
      'Cycle complet Demande d’Intervention (DI) ➔ Bon de Travail (BT) ➔ Clôture, machine à états finis, symptômes/causes/remèdes et historique pannes.',
    icon: Wrench,
    tabs: [
      { tabId: 'corrective_di', label: 'Demandes d’Intervention (DI)' },
      { tabId: 'corrective_bt', label: 'Bons de Travail (BT)' },
      { tabId: 'corrective_cloture', label: 'Clôture & Retour d’Expérience' },
      { tabId: 'corrective_referentiel', label: 'Catalogue Symptômes / Causes' },
    ],
  },
  {
    groupId: '05-entrepot-organes',
    number: '05',
    title: 'Entrepôt Organes & Pièces Détachées',
    description:
      'Gestion physique et référentielle des organes complets (moteurs, réducteurs, pompes) et pièces détachées montables sur le parc machines.',
    icon: Cpu,
    tabs: [
      { tabId: 'entrepot', label: 'Entrepôt Organes & Pièces' },
      { tabId: 'comp_groups', label: 'Groupes d’Organes' },
      { tabId: 'comp_families', label: 'Familles d’Organes' },
      { tabId: 'comp_templates', label: 'Modèles d’Organes' },
      { tabId: 'part_types', label: 'Types de Pièces' },
      { tabId: 'part_designations', label: 'Désignations de Pièces' },
    ],
  },
  {
    groupId: '06-pilotage-gouvernance',
    number: '06',
    title: 'Pilotage, Finance & Validation Maker-Checker',
    description:
      'Tableau de bord exécutif, budgets & TCO, centre de validation Maker-Checker, utilisateurs RBAC et zones géographiques d’atelier.',
    icon: BarChart3,
    tabs: [
      { tabId: 'dashboard', label: 'Tableau de Bord' },
      { tabId: 'validation_center', label: 'Centre de Validation' },
      { tabId: 'finance', label: 'Coûts & Budgets' },
      { tabId: 'utilisateurs', label: 'Utilisateurs & Rôles' },
      { tabId: 'zones', label: 'Zones & Ateliers' },
      { tabId: 'nexus', label: 'Nexus (Nomenclature As-Built & Jumeaux)' },
    ],
  },
  {
    groupId: '07-settings-systeme',
    number: '07',
    title: 'Paramètres Système, Sauvegardes & Registre d’Audit',
    description:
      'Supervision, logique des mouvements, injection Excel, synchronisation réseau local LAN, éditeur JSON, registre d’audit append-only, performance et devises.',
    icon: Settings,
    tabs: [
      { tabId: 'settings', label: 'Supervision & Stockage' },
      { tabId: 'settings_mvt_logic', label: 'Logique & Flux Mouvements' },
      { tabId: 'settings_injection', label: 'Injection Données Excel' },
      { tabId: 'settings_directory', label: 'Dossier Partagé & Sync LAN' },
      { tabId: 'settings_matching', label: 'Appairage & Audit' },
      { tabId: 'settings_json_editor', label: 'Base JSON' },
      { tabId: 'settings_backup_audit', label: 'Sauvegardes & Audit Ledger' },
      { tabId: 'settings_admin', label: 'Compte Admin & Coffre-Fort' },
      { tabId: 'settings_performance', label: 'Performance & Cache' },
      { tabId: 'settings_currency', label: 'Devises & Finance ISO' },
    ],
  },
];

const TAB_LABELS: Record<string, string> = {
  stock: 'Stock Articles & PO',
  sortie: 'Sortie & Entrée Rapide',
  types: 'Types PDR',
  designations: 'Désignations PDR',
  machines: 'Machines Enregistrées',
  families: 'Familles Machines',
  templates: 'Modèles Machines',
  blueprints: 'Blueprints Machines',
  nexus: 'Arborescence Nexus',
  preventive: 'Planning Préventif',
  preventive_referentiel: 'Référentiel Préventif',
  corrective: 'Maintenance Corrective',
  corrective_di: 'Demandes (DI)',
  corrective_bt: 'Bons de Travail (BT)',
  corrective_cloture: 'Clôture BT',
  corrective_referentiel: 'Catalogue Données Correctives',
  entrepot: 'Entrepôt Organes & Pièces',
  validation_center: 'Centre de Validation (Maker-Checker)',
  finance: 'Coûts & Budgets',
  dashboard: 'Tableau de Bord',
  zones: 'Zones & Ateliers',
  utilisateurs: 'Utilisateurs & Rôles',
  settings: 'Supervision & Stockage',
  settings_mvt_logic: 'Logique des Mouvements',
  settings_injection: 'Injection Données Excel',
  settings_directory: 'Dossier Partagé & Sync LAN',
  settings_matching: 'Appairage & Réconciliation',
  settings_json_editor: 'Base JSON',
  settings_backup_audit: 'Sauvegardes & Audit Ledger',
  settings_admin: 'Compte Admin & Coffre-Fort',
  settings_performance: 'Performance & Cache',
  settings_currency: 'Devises & Finance ISO',
};

const rawMarkdownFiles = import.meta.glob('/docs/modules/**/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

function parseFrontmatter(raw: string, filePath: string): ParsedMarkdownDoc {
  const normalized = raw.replace(/\r\n/g, '\n');
  let body = normalized;
  const meta: Record<string, string | string[]> = {};

  if (normalized.startsWith('---\n')) {
    const endIdx = normalized.indexOf('\n---\n', 4);
    if (endIdx !== -1) {
      const fmBlock = normalized.slice(4, endIdx);
      body = normalized.slice(endIdx + 5).trim();
      let currentArrayKey: string | null = null;

      for (const line of fmBlock.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        if (trimmed.startsWith('- ') && currentArrayKey) {
          const arr = (meta[currentArrayKey] as string[]) || [];
          arr.push(trimmed.slice(2).trim());
          meta[currentArrayKey] = arr;
          continue;
        }
        const colonIdx = line.indexOf(':');
        if (colonIdx !== -1) {
          const key = line.slice(0, colonIdx).trim();
          const val = line.slice(colonIdx + 1).trim();
          if (!val) {
            currentArrayKey = key;
            meta[key] = [];
          } else {
            currentArrayKey = null;
            meta[key] = val;
          }
        }
      }
    }
  }

  // Strip top H1 from body if it duplicates title
  const bodyWithoutDuplicateH1 = body.replace(/^#\s+[^\n]+\n+/, '');

  return {
    id: (meta.id as string) || filePath,
    groupId: (meta.groupId as string) || '01-stock-pdr',
    groupTitle: (meta.groupTitle as string) || 'Documentation GMAO',
    docType: ((meta.docType as string) === 'architecture' ? 'architecture' : 'page'),
    audience: ((meta.audience as string) === 'developer' ? 'developer' : 'user'),
    tabId: meta.tabId as string | undefined,
    title: (meta.title as string) || filePath,
    subtitle: meta.subtitle as string | undefined,
    summary: (meta.summary as string) || '',
    relatedTabs: Array.isArray(meta.relatedTabs) ? meta.relatedTabs : [],
    body: bodyWithoutDuplicateH1,
    filePath,
  };
}

function renderInlineFormatting(text: string): React.ReactNode[] {
  // Handle inline math $\text{...}$, bold **...**, inline code `...`, and italics *...*
  const tokens = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\$[^$]+\$)/g);
  return tokens.map((tok, idx) => {
    if (tok.startsWith('**') && tok.endsWith('**')) {
      return (
        <strong key={idx} className="font-bold text-slate-900">
          {tok.slice(2, -2)}
        </strong>
      );
    }
    if (tok.startsWith('`') && tok.endsWith('`')) {
      return (
        <code
          key={idx}
          className="px-1.5 py-0.5 mx-0.5 rounded-md bg-slate-100 border border-slate-200 font-mono text-[11.5px] text-emerald-800 font-semibold"
        >
          {tok.slice(1, -1)}
        </code>
      );
    }
    if (tok.startsWith('$') && tok.endsWith('$')) {
      const cleanFormula = tok
        .slice(1, -1)
        .replace(/\\text\{([^}]+)\}/g, '$1')
        .replace(/\\times/g, '×')
        .replace(/\\le/g, '≤')
        .replace(/\\ge/g, '≥')
        .replace(/\\rightarrow/g, '➔')
        .replace(/\\sum/g, '∑')
        .replace(/\\max/g, 'max')
        .replace(/\\min/g, 'min')
        .replace(/\\left\(/g, '(')
        .replace(/\\right\)/g, ')')
        .replace(/\\_/g, '_')
        .replace(/\\/g, ' ');
      return (
        <span
          key={idx}
          className="px-2 py-0.5 mx-0.5 rounded bg-amber-50 border border-amber-200 font-mono text-xs font-bold text-amber-900"
        >
          {cleanFormula}
        </span>
      );
    }
    return <React.Fragment key={idx}>{tok}</React.Fragment>;
  });
}

function MarkdownBodyRenderer({ markdown }: { markdown: string }) {
  const blocks = useMemo(() => {
    const lines = markdown.split('\n');
    const result: Array<
      | { type: 'h2'; text: string }
      | { type: 'h3'; text: string }
      | { type: 'hr' }
      | { type: 'code'; code: string }
      | { type: 'formula'; formula: string }
      | { type: 'table'; headers: string[]; rows: string[][] }
      | { type: 'ul'; items: string[] }
      | { type: 'ol'; items: string[] }
      | { type: 'p'; text: string }
    > = [];

    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      const trimmed = line.trim();

      if (!trimmed) {
        i++;
        continue;
      }

      if (trimmed === '---') {
        result.push({ type: 'hr' });
        i++;
        continue;
      }

      if (trimmed.startsWith('## ')) {
        result.push({ type: 'h2', text: trimmed.slice(3).trim() });
        i++;
        continue;
      }

      if (trimmed.startsWith('### ')) {
        result.push({ type: 'h3', text: trimmed.slice(4).trim() });
        i++;
        continue;
      }

      // Block math $$...$$
      if (trimmed.startsWith('$$')) {
        const formulaLines: string[] = [];
        if (trimmed.endsWith('$$') && trimmed.length > 4) {
          formulaLines.push(trimmed.slice(2, -2));
          i++;
        } else {
          i++;
          while (i < lines.length && !lines[i].trim().endsWith('$$')) {
            formulaLines.push(lines[i]);
            i++;
          }
          if (i < lines.length) i++;
        }
        const cleanFormula = formulaLines
          .join(' ')
          .replace(/\\text\{([^}]+)\}/g, '$1')
          .replace(/\\times/g, '×')
          .replace(/\\le/g, '≤')
          .replace(/\\ge/g, '≥')
          .replace(/\\sum/g, '∑')
          .replace(/\\max/g, 'max')
          .replace(/\\min/g, 'min')
          .replace(/\\left\(/g, '(')
          .replace(/\\right\)/g, ')')
          .replace(/\\_/g, '_')
          .replace(/\\/g, ' ');
        result.push({ type: 'formula', formula: cleanFormula.trim() });
        continue;
      }

      // Code block ```
      if (trimmed.startsWith('```')) {
        const codeLines: string[] = [];
        i++;
        while (i < lines.length && !lines[i].trim().startsWith('```')) {
          codeLines.push(lines[i]);
          i++;
        }
        if (i < lines.length) i++;
        result.push({ type: 'code', code: codeLines.join('\n') });
        continue;
      }

      // Table | ... |
      if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
        const tableLines: string[] = [];
        while (i < lines.length && lines[i].trim().startsWith('|')) {
          tableLines.push(lines[i].trim());
          i++;
        }
        if (tableLines.length >= 2) {
          const parseRow = (r: string) =>
            r
              .slice(1, -1)
              .split('|')
              .map((c) => c.trim());
          const headers = parseRow(tableLines[0]);
          const rows = tableLines
            .slice(2)
            .filter((r) => !/^\|[\s:-]+\|$/.test(r))
            .map(parseRow);
          result.push({ type: 'table', headers, rows });
        }
        continue;
      }

      // Unordered list
      if (trimmed.startsWith('- ')) {
        const items: string[] = [];
        while (i < lines.length && lines[i].trim().startsWith('- ')) {
          items.push(lines[i].trim().slice(2).trim());
          i++;
        }
        result.push({ type: 'ul', items });
        continue;
      }

      // Ordered list
      if (/^\d+\.\s+/.test(trimmed)) {
        const items: string[] = [];
        while (i < lines.length && (/^\d+\.\s+/.test(lines[i].trim()) || lines[i].startsWith('   - '))) {
          const currentTrimmed = lines[i].trim();
          if (/^\d+\.\s+/.test(currentTrimmed)) {
            items.push(currentTrimmed.replace(/^\d+\.\s+/, ''));
          } else if (items.length > 0) {
            items[items.length - 1] += ` — ${currentTrimmed.replace(/^-\s+/, '')}`;
          }
          i++;
        }
        result.push({ type: 'ol', items });
        continue;
      }

      // Paragraph
      const pLines: string[] = [];
      while (
        i < lines.length &&
        lines[i].trim() !== '' &&
        !lines[i].trim().startsWith('#') &&
        !lines[i].trim().startsWith('- ') &&
        !/^\d+\.\s+/.test(lines[i].trim()) &&
        !lines[i].trim().startsWith('|') &&
        !lines[i].trim().startsWith('```') &&
        !lines[i].trim().startsWith('$$') &&
        lines[i].trim() !== '---'
      ) {
        pLines.push(lines[i].trim());
        i++;
      }
      result.push({ type: 'p', text: pLines.join(' ') });
    }

    return result;
  }, [markdown]);

  return (
    <div className="space-y-4">
      {blocks.map((block, index) => {
        if (block.type === 'hr') {
          return <hr key={index} className="border-slate-200 my-5" />;
        }
        if (block.type === 'h2') {
          return (
            <div key={index} className="pt-3 pb-1 border-b border-slate-200/80 flex items-center gap-2.5">
              <span className="w-2 h-5 rounded-full bg-emerald-600 shrink-0" />
              <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                {block.text}
              </h2>
            </div>
          );
        }
        if (block.type === 'h3') {
          return (
            <h3 key={index} className="text-sm font-extrabold text-emerald-950 pt-2 flex items-center gap-2">
              <ChevronRight className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{block.text}</span>
            </h3>
          );
        }
        if (block.type === 'formula') {
          return (
            <div
              key={index}
              className="p-3.5 rounded-2xl bg-gradient-to-r from-amber-50/90 to-emerald-50/60 border border-amber-200/80 font-mono text-xs sm:text-sm font-bold text-slate-900 text-center shadow-2xs"
            >
              {block.formula}
            </div>
          );
        }
        if (block.type === 'code') {
          return (
            <pre
              key={index}
              className="p-4 rounded-2xl bg-slate-900 text-emerald-300 font-mono text-xs overflow-x-auto border border-slate-800 leading-relaxed"
            >
              <code>{block.code}</code>
            </pre>
          );
        }
        if (block.type === 'table') {
          return (
            <div key={index} className="overflow-x-auto rounded-2xl border border-slate-200 shadow-2xs">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100/90 border-b border-slate-200 text-slate-700 font-black uppercase tracking-wider text-[10.5px]">
                    {block.headers.map((h, hi) => (
                      <th key={hi} className="py-2.5 px-3.5">
                        {renderInlineFormatting(h)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/70 bg-white">
                  {block.rows.map((row, ri) => (
                    <tr key={ri} className="hover:bg-emerald-50/30 transition-colors">
                      {row.map((cell, ci) => (
                        <td key={ci} className="py-2.5 px-3.5 text-slate-700 leading-relaxed">
                          {renderInlineFormatting(cell)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
        if (block.type === 'ul') {
          return (
            <ul key={index} className="space-y-2 pl-1">
              {block.items.map((item, ii) => (
                <li key={ii} className="flex items-start gap-2.5 text-xs sm:text-[13px] text-slate-700 leading-relaxed">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 mt-2 shrink-0" />
                  <div className="flex-1">{renderInlineFormatting(item)}</div>
                </li>
              ))}
            </ul>
          );
        }
        if (block.type === 'ol') {
          return (
            <ol key={index} className="space-y-2.5 pl-1">
              {block.items.map((item, ii) => (
                <li key={ii} className="flex items-start gap-2.5 text-xs sm:text-[13px] text-slate-700 leading-relaxed">
                  <span className="w-5 h-5 rounded-lg bg-emerald-100 border border-emerald-200 text-emerald-900 font-black text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                    {ii + 1}
                  </span>
                  <div className="flex-1">{renderInlineFormatting(item)}</div>
                </li>
              ))}
            </ol>
          );
        }
        return (
          <p key={index} className="text-xs sm:text-[13px] text-slate-700 leading-relaxed">
            {renderInlineFormatting(block.text)}
          </p>
        );
      })}
    </div>
  );
}

export default function GuideView({ onNavigateToTab }: GuideViewProps) {
  const allDocs = useMemo<ParsedMarkdownDoc[]>(() => {
    const parsed = Object.entries(rawMarkdownFiles).map(([path, content]) =>
      parseFrontmatter(content, path)
    );
    return parsed.sort((a, b) => {
      if (a.groupId !== b.groupId) return a.groupId.localeCompare(b.groupId);
      // Put operational page guides first in user mode, architecture first in dev mode
      if (a.docType !== b.docType) return a.docType === 'page' ? -1 : 1;
      return a.filePath.localeCompare(b.filePath);
    });
  }, []);

  const [selectedGroupId, setSelectedGroupId] = useState<string>('01-stock-pdr');
  const [audienceFilter, setAudienceFilter] = useState<'all' | 'user' | 'developer'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedDocId, setSelectedDocId] = useState<string>(() => {
    const firstPage = allDocs.find((d) => d.docType === 'page');
    return firstPage?.id || allDocs[0]?.id || '';
  });

  const filteredDocs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return allDocs.filter((doc) => {
      if (selectedGroupId !== 'all' && doc.groupId !== selectedGroupId) return false;
      if (audienceFilter === 'user' && doc.audience !== 'user') return false;
      if (audienceFilter === 'developer' && doc.audience !== 'developer') return false;
      if (!q) return true;
      return (
        doc.title.toLowerCase().includes(q) ||
        doc.summary.toLowerCase().includes(q) ||
        doc.body.toLowerCase().includes(q) ||
        (doc.tabId && doc.tabId.toLowerCase().includes(q))
      );
    });
  }, [allDocs, selectedGroupId, audienceFilter, searchQuery]);

  const activeDoc = useMemo(() => {
    return (
      filteredDocs.find((d) => d.id === selectedDocId) ||
      filteredDocs[0] ||
      allDocs.find((d) => d.id === selectedDocId) ||
      allDocs[0]
    );
  }, [filteredDocs, allDocs, selectedDocId]);

  const docsCountByGroup = useMemo(() => {
    const counts: Record<string, { total: number; pages: number; arch: number }> = {};
    for (const d of allDocs) {
      if (!counts[d.groupId]) counts[d.groupId] = { total: 0, pages: 0, arch: 0 };
      counts[d.groupId].total += 1;
      if (d.docType === 'page') counts[d.groupId].pages += 1;
      else counts[d.groupId].arch += 1;
    }
    return counts;
  }, [allDocs]);

  const handleSelectDocByTab = (tabId: string) => {
    const targetDoc = allDocs.find((d) => d.tabId === tabId);
    if (targetDoc) {
      setSelectedGroupId(targetDoc.groupId);
      setAudienceFilter('all');
      setSelectedDocId(targetDoc.id);
    } else if (onNavigateToTab) {
      onNavigateToTab(tabId);
    }
  };

  return (
    <div className="space-y-5 pb-10">
      {/* En-tête Exécutif du Centre de Documentation Vivant */}
      <div className="rounded-3xl bg-gradient-to-br from-emerald-950 via-emerald-900 to-teal-950 text-white p-5 sm:p-7 shadow-lg border border-emerald-800/60 relative overflow-hidden">
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
          <div className="space-y-2 max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-800/70 border border-emerald-600/40 text-emerald-200 text-[11px] font-bold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>Centre de Connaissances Vivant — Double Couche (Opérateur & Architecte)</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-3">
              <BookOpen className="w-7 h-7 text-amber-300 shrink-0" />
              <span>Guide d’Utilisation & Architecture Métier CIOB GMAO v4</span>
            </h1>
            <p className="text-xs sm:text-sm text-emerald-100/90 leading-relaxed">
              Documentation officielle synchronisée avec le code source (`docs/modules/*`). Chaque groupe combine un{' '}
              <strong className="text-white">Guide Opérationnel par Écran</strong> (destiné aux magasiniers, techniciens et responsables) et une{' '}
              <strong className="text-amber-300">Spécification d’Architecture & Invariants</strong> (destinée aux développeurs, auditeurs et agents d’ingénierie).
            </p>
          </div>

          {/* Sélecteur de profil de lecture */}
          <div className="flex flex-col sm:flex-row lg:flex-col gap-2 shrink-0 bg-emerald-950/60 p-2.5 rounded-2xl border border-emerald-800/80">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-300 px-1">
              Mode de Lecture :
            </span>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setAudienceFilter('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  audienceFilter === 'all'
                    ? 'bg-amber-400 text-slate-950 shadow-xs'
                    : 'bg-emerald-900/60 text-emerald-100 hover:bg-emerald-800/70'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Tout ({allDocs.length})</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setAudienceFilter('user');
                  const firstUserDoc = allDocs.find(
                    (d) => (selectedGroupId === 'all' || d.groupId === selectedGroupId) && d.audience === 'user'
                  );
                  if (firstUserDoc) setSelectedDocId(firstUserDoc.id);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  audienceFilter === 'user'
                    ? 'bg-emerald-400 text-slate-950 shadow-xs'
                    : 'bg-emerald-900/60 text-emerald-100 hover:bg-emerald-800/70'
                }`}
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>Guides Utilisateur</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setAudienceFilter('developer');
                  const firstDevDoc = allDocs.find(
                    (d) => (selectedGroupId === 'all' || d.groupId === selectedGroupId) && d.audience === 'developer'
                  );
                  if (firstDevDoc) setSelectedDocId(firstDevDoc.id);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  audienceFilter === 'developer'
                    ? 'bg-cyan-400 text-slate-950 shadow-xs'
                    : 'bg-emerald-900/60 text-emerald-100 hover:bg-emerald-800/70'
                }`}
              >
                <Code2 className="w-3.5 h-3.5" />
                <span>Architecture & Dev</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Cartes des 6 Groupes Fonctionnels de l'Application */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
        {MODULE_ROADMAP.map((group) => {
          const stats = docsCountByGroup[group.groupId] || { total: 0, pages: 0, arch: 0 };
          const isDocumented = stats.total > 0;
          const isSelected = selectedGroupId === group.groupId;
          const IconComponent = group.icon;

          return (
            <div
              key={group.groupId}
              onClick={() => {
                if (isDocumented) {
                  setSelectedGroupId(group.groupId);
                  const firstGroupDoc = allDocs.find((d) => d.groupId === group.groupId);
                  if (firstGroupDoc) setSelectedDocId(firstGroupDoc.id);
                }
              }}
              className={`rounded-2xl p-4 border transition-all flex flex-col justify-between gap-3 ${
                isDocumented ? 'cursor-pointer' : 'opacity-80'
              } ${
                isSelected
                  ? 'bg-emerald-50/90 border-emerald-600 ring-2 ring-emerald-500/20 shadow-sm'
                  : isDocumented
                  ? 'bg-white border-slate-200 hover:border-emerald-400 shadow-2xs'
                  : 'bg-slate-50/80 border-slate-200/80'
              }`}
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs shrink-0 ${
                        isDocumented
                          ? 'bg-emerald-700 text-white shadow-2xs'
                          : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      <IconComponent className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 block">
                        Groupe {group.number}
                      </span>
                      <h3 className="text-xs sm:text-sm font-black text-slate-900 leading-snug">
                        {group.title}
                      </h3>
                    </div>
                  </div>

                  {isDocumented ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 border border-emerald-300 text-emerald-900 text-[10px] font-black shrink-0">
                      <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                      <span>{stats.total} Docs Vérifiés</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-200/80 text-slate-600 text-[10px] font-bold shrink-0">
                      <Clock className="w-3 h-3" />
                      <span>Prochaine étape</span>
                    </span>
                  )}
                </div>

                <p className="text-[11.5px] text-slate-600 leading-relaxed">{group.description}</p>
              </div>

              {/* Liens rapides vers les écrans du groupe */}
              <div className="pt-2 border-t border-slate-200/70 flex flex-wrap items-center gap-1.5">
                {group.tabs.map((t) => {
                  const hasPageDoc = allDocs.some((d) => d.tabId === t.tabId);
                  return (
                    <button
                      key={t.tabId}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (hasPageDoc) {
                          handleSelectDocByTab(t.tabId);
                        } else if (onNavigateToTab) {
                          onNavigateToTab(t.tabId);
                        }
                      }}
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10.5px] font-bold transition cursor-pointer ${
                        hasPageDoc
                          ? 'bg-white border border-emerald-300 text-emerald-900 hover:bg-emerald-600 hover:text-white'
                          : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-400 hover:text-slate-900'
                      }`}
                      title={
                        hasPageDoc
                          ? `Lire le guide de l'écran ${t.label}`
                          : `Ouvrir directement l'écran ${t.label}`
                      }
                    >
                      <span>{t.label}</span>
                      <ArrowUpRight className="w-3 h-3 opacity-70" />
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Corps Principal : Sommaire Latéral + Lecteur de Document */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Colonne Gauche : Recherche & Arborescence des Fichiers du Groupe */}
        <div className="lg:col-span-4 xl:col-span-3 bg-white rounded-3xl border border-slate-200 shadow-xs p-4 space-y-4 lg:sticky lg:top-4">
          {/* Barre de recherche */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher (PO, stock, retour, TYP...)"
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-900 focus:outline-none focus:border-emerald-600 focus:bg-white transition"
            />
          </div>

          {/* Liste structurée des documents */}
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <span className="text-[10.5px] font-black uppercase tracking-wider text-slate-500">
                Sommaire du Groupe Actif ({filteredDocs.length})
              </span>
              {selectedGroupId !== 'all' && (
                <button
                  type="button"
                  onClick={() => setSelectedGroupId('all')}
                  className="text-[10.5px] font-bold text-emerald-700 hover:underline cursor-pointer"
                >
                  Voir tout
                </button>
              )}
            </div>

            <div className="space-y-1.5">
              {filteredDocs.map((doc) => {
                const isSelected = activeDoc?.id === doc.id;
                const isArch = doc.docType === 'architecture';

                return (
                  <button
                    key={doc.id}
                    type="button"
                    onClick={() => setSelectedDocId(doc.id)}
                    className={`w-full text-left p-3 rounded-2xl border transition-all flex items-start gap-2.5 cursor-pointer ${
                      isSelected
                        ? isArch
                          ? 'bg-slate-900 border-slate-800 text-white shadow-sm'
                          : 'bg-emerald-700 border-emerald-700 text-white shadow-sm'
                        : 'bg-slate-50/70 border-slate-200/80 hover:bg-white hover:border-emerald-300 text-slate-800'
                    }`}
                  >
                    <div
                      className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                        isSelected
                          ? 'bg-white/15 text-white'
                          : isArch
                          ? 'bg-cyan-100 text-cyan-900'
                          : 'bg-emerald-100 text-emerald-900'
                      }`}
                    >
                      {isArch ? <Code2 className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className={`text-[9.5px] font-black uppercase tracking-wider px-1.5 py-0.2 rounded ${
                            isSelected
                              ? 'bg-white/20 text-white'
                              : isArch
                              ? 'bg-cyan-100 text-cyan-900'
                              : 'bg-emerald-100 text-emerald-900'
                          }`}
                        >
                          {isArch ? 'Architecture & Dev' : 'Guide Écran'}
                        </span>
                        {doc.tabId && (
                          <span
                            className={`text-[9.5px] font-mono px-1.5 py-0.2 rounded ${
                              isSelected ? 'bg-black/25 text-emerald-200' : 'bg-slate-200 text-slate-700'
                            }`}
                          >
                            #{doc.tabId}
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-extrabold mt-1 leading-snug truncate">{doc.title}</p>
                      {doc.subtitle && (
                        <p
                          className={`text-[10.5px] mt-0.5 line-clamp-1 ${
                            isSelected ? 'text-emerald-100' : 'text-slate-500'
                          }`}
                        >
                          {doc.subtitle}
                        </p>
                      )}
                    </div>
                  </button>
                );
              })}

              {filteredDocs.length === 0 && (
                <div className="p-6 text-center rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-500">
                  Aucun document ne correspond à votre filtre « {searchQuery} ».
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Colonne Droite : Contenu Détaillé du Document Sélectionné */}
        <div className="lg:col-span-8 xl:col-span-9">
          {activeDoc ? (
            <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
              {/* Bannière du Document */}
              <div
                className={`p-5 sm:p-6 border-b ${
                  activeDoc.docType === 'architecture'
                    ? 'bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 text-white border-slate-800'
                    : 'bg-gradient-to-r from-emerald-50/90 via-teal-50/50 to-white text-slate-900 border-slate-200'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10.5px] font-black uppercase tracking-wider ${
                          activeDoc.docType === 'architecture'
                            ? 'bg-cyan-400 text-slate-950'
                            : 'bg-emerald-700 text-white'
                        }`}
                      >
                        {activeDoc.docType === 'architecture'
                          ? 'Spécification Architecture & Logique Métier'
                          : 'Guide Opérationnel Utilisateur'}
                      </span>
                      <span
                        className={`text-xs font-bold ${
                          activeDoc.docType === 'architecture' ? 'text-emerald-300' : 'text-emerald-800'
                        }`}
                      >
                        • {activeDoc.groupTitle}
                      </span>
                      <span
                        className={`text-[11px] font-mono px-2 py-0.5 rounded ${
                          activeDoc.docType === 'architecture'
                            ? 'bg-white/10 text-slate-300'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {activeDoc.filePath}
                      </span>
                    </div>

                    <h2 className="text-lg sm:text-xl font-black tracking-tight">{activeDoc.title}</h2>
                    {activeDoc.subtitle && (
                      <p
                        className={`text-xs sm:text-sm font-medium ${
                          activeDoc.docType === 'architecture' ? 'text-slate-300' : 'text-slate-600'
                        }`}
                      >
                        {activeDoc.subtitle}
                      </p>
                    )}
                  </div>

                  {/* Bouton d'action directe pour ouvrir la page correspondante */}
                  {activeDoc.tabId && onNavigateToTab && (
                    <button
                      type="button"
                      onClick={() => onNavigateToTab(activeDoc.tabId!)}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-black shadow-sm transition shrink-0 cursor-pointer"
                    >
                      <span>Ouvrir l’écran dans l’application</span>
                      <ExternalLink className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Résumé exécutif */}
                {activeDoc.summary && (
                  <div
                    className={`mt-4 p-3.5 rounded-2xl text-xs leading-relaxed border ${
                      activeDoc.docType === 'architecture'
                        ? 'bg-white/5 border-white/10 text-emerald-100'
                        : 'bg-white border-emerald-200/80 text-slate-700 shadow-2xs'
                    }`}
                  >
                    <strong className="font-black uppercase tracking-wider text-[10.5px] mr-1.5">
                      Résumé :
                    </strong>
                    {activeDoc.summary}
                  </div>
                )}
              </div>

              {/* Corps du Document Markdown */}
              <div className="p-5 sm:p-7">
                <MarkdownBodyRenderer markdown={activeDoc.body} />
              </div>

              {/* Pied de document : Navigation croisée & raccourcis d'écrans */}
              {activeDoc.relatedTabs.length > 0 && (
                <div className="px-5 sm:px-7 py-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <span className="text-xs font-extrabold text-slate-700">
                    Écrans & Guides Associés dans ce Groupe :
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {activeDoc.relatedTabs.map((relTab) => {
                      const linkedDoc = allDocs.find((d) => d.tabId === relTab);
                      const label = TAB_LABELS[relTab] || relTab;
                      return (
                        <div key={relTab} className="inline-flex items-center rounded-xl overflow-hidden border border-slate-300 bg-white shadow-2xs">
                          {linkedDoc && (
                            <button
                              type="button"
                              onClick={() => setSelectedDocId(linkedDoc.id)}
                              className="px-3 py-1.5 text-xs font-bold text-slate-800 hover:bg-emerald-50 hover:text-emerald-800 transition flex items-center gap-1.5 cursor-pointer"
                              title={`Lire le guide : ${linkedDoc.title}`}
                            >
                              <BookOpen className="w-3.5 h-3.5 text-emerald-700" />
                              <span>{label}</span>
                            </button>
                          )}
                          {onNavigateToTab && (
                            <button
                              type="button"
                              onClick={() => onNavigateToTab(relTab)}
                              className="px-2.5 py-1.5 bg-slate-100 hover:bg-emerald-700 hover:text-white text-slate-700 text-[11px] font-bold border-l border-slate-200 transition flex items-center gap-1 cursor-pointer"
                              title={`Aller directement à l'écran ${label}`}
                            >
                              <span>Ouvrir</span>
                              <ExternalLink className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
