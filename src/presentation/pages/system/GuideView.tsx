import AnimatedPage from '../../components/common/AnimatedPage';
import {
  BookOpen,
  Zap,
  Database,
  Layers,
  ShieldCheck,
  MapPin,
  Users,
  Factory,
  Package,
  Boxes,
  FileSpreadsheet,
  CheckCircle2,
  Sparkles,
  Wrench,
  KeyRound,
  Lock,
} from 'lucide-react';

export default function GuideView() {
  return (
    <AnimatedPage className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-[0_12px_32px_-6px_rgba(0,0,0,0.12),0_4px_12px_-2px_rgba(0,0,0,0.06)] hover:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.16),0_6px_16px_-3px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-300 ease-out">
        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2.5">
          <BookOpen className="w-5 h-5 text-amber-600 shrink-0" />
          <span>Manuel d'Utilisation, Règles d'Intégrité & Formules Excel</span>
        </h2>
        <p className="text-xs text-slate-500 mt-1 max-w-3xl">
          Retrouvez la méthodologie industrielle de remplissage des données GMAO PDR, les principes des
          tables miroirs (Excel Twins), la gouvernance des liens intelligents et la syntaxe exacte des formules.
        </p>
      </div>

      {/* Industrial Deployment Sequence / Roadmap (Workflow PDR Réel) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-[0_12px_32px_-6px_rgba(0,0,0,0.12),0_4px_12px_-2px_rgba(0,0,0,0.06)] hover:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.16),0_6px_16px_-3px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-300 ease-out space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900">
                Méthodologie Industrielle : L'Ordre Chronologique de Saisie (Workflow PDR)
              </h3>
              <p className="text-[11px] text-slate-500">
                Comment configurer une usine de A à Z sans conflits de clés et avec intégrité relationnelle totale.
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 self-start sm:self-auto">
            <CheckCircle2 className="w-3.5 h-3.5" /> 6 Étapes Standards
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Step 1: Zones */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-white hover:shadow-[0_12px_32px_-6px_rgba(0,0,0,0.12),0_4px_12px_-2px_rgba(0,0,0,0.06)] hover:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.16),0_6px_16px_-3px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-300 ease-out transition-all space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-cyan-100 text-cyan-800">
                Étape 1 • Socle Spatial
              </span>
              <MapPin className="w-4 h-4 text-cyan-600" />
            </div>
            <h4 className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
              <span>Les Zones Industrielles (`Zones`)</span>
            </h4>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Dans le monde réel, vous délimitez d'abord le bâtiment et les ateliers physiques (ex:{' '}
              <span className="font-mono font-medium text-slate-800">Tissage</span>,{' '}
              <span className="font-mono font-medium text-slate-800">Teinture</span>,{' '}
              <span className="font-mono font-medium text-slate-800">Magasin PDR</span>,{' '}
              <span className="font-mono font-medium text-slate-800">Chaudière</span>).
              Sans Zone, aucun équipement ni collaborateur ne peut être géographiquement rattaché.
            </p>
            <div className="text-[10px] font-mono text-cyan-700 bg-cyan-50/80 p-1.5 rounded-lg border border-cyan-100">
              Format type : ZONE-01, ZONE-TIS, ZONE-MAG
            </div>
          </div>

          {/* Step 2: Users */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-white hover:shadow-[0_12px_32px_-6px_rgba(0,0,0,0.12),0_4px_12px_-2px_rgba(0,0,0,0.06)] hover:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.16),0_6px_16px_-3px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-300 ease-out transition-all space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-800">
                Étape 2 • Équipe & Rôles
              </span>
              <Users className="w-4 h-4 text-indigo-600" />
            </div>
            <h4 className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
              <span>Utilisateurs & Intervenants</span>
            </h4>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              L'encadrement et la main-d'œuvre qui animent les zones. Saisis dans l'ordre hiérarchique :
              <br />
              1. <b>Responsables</b> (<span className="font-mono text-[10px]">RESP-PDR</span> Magasinier, <span className="font-mono text-[10px]">RESP-MT</span> Maintenance).
              <br />
              2. <b>Techniciens</b> (<span className="font-mono text-[10px]">TECH-01...</span>) assignés à leurs zones.
              <br />
              3. <b>Opérateurs</b> (<span className="font-mono text-[10px]">OP-01...</span>) demandeurs des consommables.
            </p>
            <div className="text-[10px] font-mono text-indigo-700 bg-indigo-50/80 p-1.5 rounded-lg border border-indigo-100">
              Auto-ID : TECH-01, OP-01, CHEF-01
            </div>
          </div>

          {/* Step 3: Machines */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-white hover:shadow-[0_12px_32px_-6px_rgba(0,0,0,0.12),0_4px_12px_-2px_rgba(0,0,0,0.06)] hover:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.16),0_6px_16px_-3px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-300 ease-out transition-all space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-blue-100 text-blue-800">
                Étape 3 • Parc Machines
              </span>
              <Factory className="w-4 h-4 text-blue-600" />
            </div>
            <h4 className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
              <span>Arborescence des Machines</span>
            </h4>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Installation des équipements de production en cascade à 3 niveaux :
              <br />
              • <b>Familles</b> : Familles technologiques (Tissage, Finition...).
              <br />
              • <b>Templates</b> : Modèles standards réutilisables.
              <br />
              • <b>Machines Enregistrées</b> : Les unités physiques en service, rattachées directement à leur{' '}
              <b>Zone</b> et <b>Technicien référent</b>.
            </p>
            <div className="text-[10px] font-mono text-blue-700 bg-blue-50/80 p-1.5 rounded-lg border border-blue-100">
              Code machine : MCH-001, CNC-01, DTA-08
            </div>
          </div>

          {/* Step 4: Stock PDR */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-white hover:shadow-[0_12px_32px_-6px_rgba(0,0,0,0.12),0_4px_12px_-2px_rgba(0,0,0,0.06)] hover:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.16),0_6px_16px_-3px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-300 ease-out transition-all space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-amber-100 text-amber-800">
                Étape 4 • Cœur du Réacteur
              </span>
              <Package className="w-4 h-4 text-amber-600" />
            </div>
            <h4 className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
              <span>Catalogue & Stock Actuel PDR</span>
            </h4>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Pour maintenir les machines en rotation continue, le magasin PDR référence les organes d'usure :
              <br />
              • <b>Types</b> : Roulements, Visserie, Courroies, Pneumatique...
              <br />
              • <b>Désignations & Diagnostics</b> associés.
              <br />
              • <b>Articles de Stock</b> : Réf unique, Emplacement physique (ex: Rayon B-04), Stock Initial et Seuil d'Alerte.
            </p>
            <div className="text-[10px] font-mono text-amber-700 bg-amber-50/80 p-1.5 rounded-lg border border-amber-100">
              Formule : Actuel = Initial + Entrées - Sorties
            </div>
          </div>

          {/* Step 5: Warehouse Components & Parts */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-white hover:shadow-[0_12px_32px_-6px_rgba(0,0,0,0.12),0_4px_12px_-2px_rgba(0,0,0,0.06)] hover:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.16),0_6px_16px_-3px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-300 ease-out transition-all space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-purple-100 text-purple-800">
                Étape 5 • Nomenclatures
              </span>
              <Boxes className="w-4 h-4 text-purple-600" />
            </div>
            <h4 className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
              <span>Entrepôt (Composants & Parts)</span>
            </h4>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Au fur et à mesure de l'exploitation, l'entrepôt s'étoffe en arborescence fine :
              <br />
              • <b>COMPONENTS</b> : Ensembles et sous-systèmes lourds (Moteurs électriques, Pompes hydrauliques, Réducteurs avec code suivi).
              <br />
              • <b>PARTS</b> : Pièces spécifiques rattachées à une machine, une zone ou conservées en magasin général.
            </p>
            <div className="text-[10px] font-mono text-purple-700 bg-purple-50/80 p-1.5 rounded-lg border border-purple-100">
              Codes : MOT-01-01, CYL-02, FIX-01
            </div>
          </div>

          {/* Step 6: Mouvements & Bons */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-white hover:shadow-[0_12px_32px_-6px_rgba(0,0,0,0.12),0_4px_12px_-2px_rgba(0,0,0,0.06)] hover:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.16),0_6px_16px_-3px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-300 ease-out transition-all space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800">
                Étape 6 • Flux Quotidiens
              </span>
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            </div>
            <h4 className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
              <span>Mouvements & Bons de Sortie</span>
            </h4>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              La vie quotidienne du magasin PDR :
              <br />
              • <b>Sortie</b> : Enregistrement avec N° de Bon (ex: Bon-012), Réf article, Quantité, Demandeur (Technicien ou Opérateur) et Machine réceptrice.
              <br />
              • <b>Entrée</b> : Réapprovisionnements fournisseurs avec mise à jour immédiate des niveaux et recalcul du statut (OK, ALERTE, RUPTURE).
            </p>
            <div className="text-[10px] font-mono text-emerald-700 bg-emerald-50/80 p-1.5 rounded-lg border border-emerald-100">
              Traçabilité 100% Hors-ligne & Export Excel
            </div>
          </div>
        </div>

        {/* Industrial Focus Notice */}
        <div className="p-3.5 rounded-xl bg-amber-50/80 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
          <Wrench className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <b className="font-semibold">Règle d'or du système GMAO Light PDR :</b> Nous focalisons 100% de l'application sur la{' '}
            <span className="font-semibold underline">Gestion Rigoureuse des Pièces de Rechange (PDR)</span> et la cohérence des stocks jumeaux (Excel Twin). 
            Les lourds workflows de billetterie ou de préventif complexe sont volontairement exclus pour garantir une rapidité d'exécution, une clarté totale pour le magasinier et une synchronisation parfaite avec les fichiers Excel d'usine.
          </div>
        </div>
      </div>

      {/* Guide Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Rule 1: Twin Tables */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-[0_12px_32px_-6px_rgba(0,0,0,0.12),0_4px_12px_-2px_rgba(0,0,0,0.06)] hover:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.16),0_6px_16px_-3px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-300 ease-out space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs">
              <Database className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-sm text-slate-900">Les Deux Tables Miroirs (Twins)</h3>
          </div>
          <div className="text-xs text-slate-600 space-y-2 leading-relaxed">
            <p>
              • <b className="text-slate-900">Stock (Articles)</b> : Tableau central des pièces de
              rechange. Colonnes : Ref (B), Désignation (C), Type (D), Initial (E), Entrées (F),
              Sorties (G), Actuel (H), Seuil (I), Alerte (J), Emplacement (K).
            </p>
            <p>
              • <b className="text-slate-900">Machines Registered</b> : Tableau central des
              équipements. Colonnes : Code Machine (B), Désignation (C), Family (D), Template (E),
              Zone (F), Technician (G), Status (H).
            </p>
            <p className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 font-medium text-slate-700">
              Ces deux tables agissent comme les deux hubs de données majeurs du système.
            </p>
          </div>
        </div>

        {/* Rule 2: Smart Links Navigation */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-[0_12px_32px_-6px_rgba(0,0,0,0.12),0_4px_12px_-2px_rgba(0,0,0,0.06)] hover:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.16),0_6px_16px_-3px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-300 ease-out space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center font-bold text-xs">
              <Layers className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-sm text-slate-900">
              Navigation par Liens Intelligents (Smart Links)
            </h3>
          </div>
          <div className="text-xs text-slate-600 space-y-2 leading-relaxed">
            <p>
              • <b className="text-cyan-700">Family → Templates</b> : Clic sur <i>Nb Templates</i>{' '}
              ouvre la liste des modèles filtrée sur la famille.
            </p>
            <p>
              • <b className="text-emerald-700">Family → Machines</b> : Clic sur <i>Nb Machines</i>{' '}
              filtre Machines Registered avec{' '}
              <span className="font-mono text-[11px] bg-slate-100 px-1 py-0.5 rounded">
                Family = Sélectionnée, Template = Tous
              </span>
              .
            </p>
            <p>
              • <b className="text-amber-700">Template → Machines</b> : Clic sur <i>Nb Machines</i>{' '}
              applique un filtre ciblé :{' '}
              <span className="font-mono text-[11px] bg-slate-100 px-1 py-0.5 rounded">
                Family = Famille parente + Template = Ce modèle
              </span>
              .
            </p>
          </div>
        </div>

        {/* Rule 3: Auto-Generated IDs */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-[0_12px_32px_-6px_rgba(0,0,0,0.12),0_4px_12px_-2px_rgba(0,0,0,0.06)] hover:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.16),0_6px_16px_-3px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-300 ease-out space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold text-xs">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-sm text-slate-900">
              Génération Automatique d'Identifiants (Auto-ID)
            </h3>
          </div>
          <div className="text-xs text-slate-600 space-y-2 leading-relaxed">
            <p>
              • <b className="text-blue-700">Technicians</b> : Auto-généré sous le format{' '}
              <span className="font-mono font-bold">TECH-01, TECH-02...</span>
            </p>
            <p>
              • <b className="text-indigo-700">Opérateurs</b> : Auto-généré sous le format{' '}
              <span className="font-mono font-bold">OP-01, OP-02...</span>
            </p>
            <p>
              • <b className="text-amber-700">Chefs d'Équipe</b> : Auto-généré sous le format{' '}
              <span className="font-mono font-bold">CHEF-01, CHEF-02...</span>
            </p>
            <p className="p-2.5 rounded-xl bg-purple-50/60 border border-purple-200 text-purple-900 font-medium">
              Distinction rigoureuse des rôles pour la gouvernance des sorties et interventions.
            </p>
          </div>
        </div>

        {/* Rule 4: Dropdowns & Quick '+' Creation */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-[0_12px_32px_-6px_rgba(0,0,0,0.12),0_4px_12px_-2px_rgba(0,0,0,0.06)] hover:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.16),0_6px_16px_-3px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-300 ease-out space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-xs">
              <Zap className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-sm text-slate-900">
              Listes Déroulantes & Création Instantanée '+'
            </h3>
          </div>
          <div className="text-xs text-slate-600 space-y-2 leading-relaxed">
            <p>
              Lors de la création d'un article ou d'une machine, vous pouvez sélectionner une entité
              existante ou cliquer sur le bouton <b>'+'</b> pour créer la catégorie immédiatement.
            </p>
            <p>
              La nouvelle entité est automatiquement enregistrée et pré-sélectionnée dans le
              formulaire en cours.
            </p>
          </div>
        </div>

        {/* Rule 5: Zero-Knowledge Vault & 2FA Security */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-[0_12px_32px_-6px_rgba(0,0,0,0.12),0_4px_12px_-2px_rgba(0,0,0,0.06)] hover:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.16),0_6px_16px_-3px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-300 ease-out space-y-3 md:col-span-2">
          <div className="flex items-center justify-between flex-wrap gap-2 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs">
                <Lock className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                  <span>Règle 5 • Architecture Zero-Knowledge & Coffre Chiffré (Vault Sécurisé)</span>
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-indigo-100 text-indigo-800 uppercase tracking-wide">
                    AES-256-GCM + PBKDF2 100k + BCrypt
                  </span>
                </h3>
                <p className="text-[11px] text-slate-500">
                  Gouvernance de sécurité industrielle : aucun mot de passe ni clé statique n'est codé en dur dans le code source.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
              <KeyRound className="w-3.5 h-3.5" />
              <span>Master PIN = Clé Cryptographique Unique</span>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-slate-600">
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
              <div className="text-[10px] font-bold uppercase text-indigo-700 flex items-center gap-1">
                <span>1. Chiffrement AES-256-GCM</span>
              </div>
              <p className="text-[11px] leading-relaxed text-slate-600">
                L'ensemble des comptes, rôles et identifiants sensibles est encapsulé dans un coffre chiffré au repos. Sans le Master PIN, les données stockées ne sont qu'un bloc de bruit aléatoire impossible à déchiffrer.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
              <div className="text-[10px] font-bold uppercase text-indigo-700 flex items-center gap-1">
                <span>2. Dérivation de Clé PBKDF2</span>
              </div>
              <p className="text-[11px] leading-relaxed text-slate-600">
                La clé de déchiffrement n'est jamais stockée. Elle est dérivée dynamiquement en mémoire vive à partir du Master PIN et d'un sel aléatoire de 16 octets via 100 000 itérations SHA-256.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
              <div className="text-[10px] font-bold uppercase text-indigo-700 flex items-center gap-1">
                <span>3. Authentification 2FA Forte</span>
              </div>
              <p className="text-[11px] leading-relaxed text-slate-600">
                La connexion exige la triple validation : Code Utilisateur + Mot de passe (haché individuellement avec BCrypt) + Master PIN pour déverrouiller la partition du coffre-fort.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Excel Formulas Reference */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-[0_12px_32px_-6px_rgba(0,0,0,0.12),0_4px_12px_-2px_rgba(0,0,0,0.06)] hover:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.16),0_6px_16px_-3px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-300 ease-out space-y-4">
        <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
          <Database className="w-4 h-4 text-emerald-600" />
          <span>Formules Excel Standardisées (Calculs Stock & Relations)</span>
        </h3>

        {/* Stock Formulas */}
        <div>
          <div className="text-xs font-semibold text-slate-700 mb-2">
            1. Formules du Stock Actuel (Feuille Stock_Actuel)
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <div className="text-[10px] font-bold text-slate-500 uppercase">
                Formule F (Entrées)
              </div>
              <div className="font-mono font-semibold text-blue-700 mt-1 text-[11px] break-all">
                =SUMIFS(Mouvement[Quantite], Mouvement[Ref], [@Ref], Mouvement[Type], "Entrée")
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <div className="text-[10px] font-bold text-slate-500 uppercase">
                Formule G (Sorties)
              </div>
              <div className="font-mono font-semibold text-rose-700 mt-1 text-[11px] break-all">
                =SUMIFS(Mouvement[Quantite], Mouvement[Ref], [@Ref], Mouvement[Type], "Sortie")
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <div className="text-[10px] font-bold text-slate-500 uppercase">
                Formule H (Stock Actuel)
              </div>
              <div className="font-mono font-bold text-emerald-700 mt-1 text-[11px]">
                =[@[Stock Initial]] + [@Entrees] - [@Sorties]
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <div className="text-[10px] font-bold text-slate-500 uppercase">
                Formule J (Alerte / Rupture)
              </div>
              <div className="font-mono font-semibold text-amber-700 mt-1 text-[11px] break-all">
                =IF([@[Stock Actuel]]&lt;=0, "RUPTURE", IF([@[Stock Actuel]]&lt;=[@Seuil], "ALERTE",
                "OK"))
              </div>
            </div>
          </div>
        </div>

        {/* Cross-Sheet Aggregations */}
        <div className="pt-3 border-t border-slate-100">
          <div className="text-xs font-semibold text-slate-700 mb-2">
            2. Formules d'Agrégation & Liens Relationnels (COUNTIF / COUNTIFS)
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <div className="text-[10px] font-bold text-slate-500 uppercase">
                Templates par Famille
              </div>
              <div className="font-mono text-cyan-800 font-semibold mt-1 text-[11px]">
                =COUNTIF(Templates!C:C, [@id_family])
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <div className="text-[10px] font-bold text-slate-500 uppercase">
                Machines par Template
              </div>
              <div className="font-mono text-amber-800 font-semibold mt-1 text-[11px]">
                =COUNTIF(Machines!D:D, [@id_templates])
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <div className="text-[10px] font-bold text-slate-500 uppercase">
                Machines par Zone
              </div>
              <div className="font-mono text-purple-800 font-semibold mt-1 text-[11px]">
                =COUNTIF(Machines!E:E, [@id_zone])
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <div className="text-[10px] font-bold text-slate-500 uppercase">
                Auto-ID Chef d'Équipe
              </div>
              <div className="font-mono text-amber-800 font-semibold mt-1 text-[11px]">
                ="CHEF-" & TEXT(COUNTIF(Op[Type],"CHEF")+1, "00")
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <div className="text-[10px] font-bold text-slate-500 uppercase">
                Classification Profil Chef
              </div>
              <div className="font-mono text-indigo-800 font-semibold mt-1 text-[11px]">
                =IF(ISNUMBER(SEARCH("CHEF",[@id_operation])),"CHEF","OPERATEUR")
              </div>
            </div>
          </div>
        </div>
      </div>
    </AnimatedPage>
  );
}
