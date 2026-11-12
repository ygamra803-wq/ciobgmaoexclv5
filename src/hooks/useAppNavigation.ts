import { useState, startTransition } from 'react';

/**
 * Hook to manage application tab filters and smart navigation links
 */
export function useAppNavigation({ setCurrentTab }) {
  // Filter States
  const [stockSearch, setStockSearch] = useState('');
  const [stockTypeFilter, setStockTypeFilter] = useState('ALL');
  const [stockAlertOnly, setStockAlertOnly] = useState(false);

  const [mchSearch, setMchSearch] = useState('');
  const [mchFamilyFilter, setMchFamilyFilter] = useState('ALL');
  const [mchTemplateFilter, setMchTemplateFilter] = useState('ALL');
  const [mchZoneFilter, setMchZoneFilter] = useState('ALL');

  const [diagTypeFilter, setDiagTypeFilter] = useState('ALL');
  const [typeGroupFilter, setTypeGroupFilter] = useState('ALL');
  const [quickCreateDesignationType, setQuickCreateDesignationType] = useState(null);
  const [quickCreateCompTemplateFamily, setQuickCreateCompTemplateFamily] = useState(null);
  const [quickCreateTemplateFamily, setQuickCreateTemplateFamily] = useState(null);
  const [quickCreateBlueprintPreset, setQuickCreateBlueprintPreset] = useState(null);
  const [quickSortiePreset, setQuickSortiePreset] = useState(null);
  const [opZoneFilter, setOpZoneFilter] = useState('ALL');
  const [techZoneFilter, setTechZoneFilter] = useState('ALL');
  const [templateFamilyFilter, setTemplateFamilyFilter] = useState('ALL');
  const [blueprintFamilyFilter, setBlueprintFamilyFilter] = useState('ALL');
  const [blueprintTemplateFilter, setBlueprintTemplateFilter] = useState('ALL');

  // Groupe Entrepôt Filter States
  const [whFamilyFilter, setWhFamilyFilter] = useState('ALL');
  const [whTemplateFilter, setWhTemplateFilter] = useState('ALL');
  const [whPartGroupFilter, setWhPartGroupFilter] = useState('ALL');
  const [whTypeFilter, setWhTypeFilter] = useState('ALL');
  const [whNatureFilter, setWhNatureFilter] = useState('ALL');
  const [whSearch, setWhSearch] = useState('');
  const [compFamilyGroupFilter, setCompFamilyGroupFilter] = useState('');
  const [compTemplateGroupFilter, setCompTemplateGroupFilter] = useState('');
  const [compTemplateFamilyFilter, setCompTemplateFamilyFilter] = useState('');
  const [partTypeGroupFilter, setPartTypeGroupFilter] = useState('ALL');
  const [partDesignationTypeFilter, setPartDesignationTypeFilter] = useState('');

  // SMART NAVIGATION HANDLERS
  const handleNavigateToStockFiltered = (typeId) => {
    setStockTypeFilter(typeId);
    setStockAlertOnly(false);
    startTransition(() => setCurrentTab('stock'));
  };

  const handleNavigateToStockFilteredByRef = (refVal) => {
    setStockSearch(refVal);
    setStockTypeFilter('ALL');
    startTransition(() => setCurrentTab('stock'));
  };

  const handleNavigateToDesignationsFiltered = (typeId) => {
    setDiagTypeFilter(typeId);
    startTransition(() => setCurrentTab('designations'));
  };

  const handleNavigateToPdrGroups = () => {
    startTransition(() => setCurrentTab('pdr_groups'));
  };

  const handleNavigateToTypesByGroup = (groupId) => {
    setTypeGroupFilter(groupId || 'ALL');
    startTransition(() => setCurrentTab('types'));
  };

  const handleNavigateToStockByGroup = (_groupId) => {
    setStockTypeFilter('ALL');
    setStockAlertOnly(false);
    startTransition(() => setCurrentTab('stock'));
  };

  const handleNavigateToCreateDesignationForType = (typeId) => {
    setDiagTypeFilter(typeId);
    setQuickCreateDesignationType(typeId);
    startTransition(() => setCurrentTab('designations'));
  };

  const handleNavigateToQuickSortieFromDesignation = (item) => {
    if (!item) return;
    setQuickSortiePreset({
      source: 'STOCK_PDR',
      ref: item.ref || item.id_designation || item.id_diag || '',
      designation: item.designation || item.libelle || item.nom || '',
      type: item.id_type || item.type || '',
      emplacement: item.emplacement || '',
    });
    startTransition(() => setCurrentTab('sortie'));
  };

  const handleNavigateToQuickSortieFromPartDesignation = (item) => {
    if (!item) return;
    setQuickSortiePreset({
      source: 'WAREHOUSE_PARTIE',
      ref: item.ref || item.id_part || '',
      designation: item.designation || item.nom || item.libelle || '',
      type: item.id_type || item.type || '',
      emplacement: item.emplacement || '',
    });
    startTransition(() => setCurrentTab('sortie'));
  };

  const handleNavigateToCreateCompTemplateForFamily = (familyId) => {
    setCompTemplateFamilyFilter(familyId || '');
    setQuickCreateCompTemplateFamily(familyId);
    startTransition(() => setCurrentTab('comp_templates'));
  };

  const handleNavigateToQuickSortieFromCompTemplate = (item) => {
    if (!item) return;
    setQuickSortiePreset({
      source: 'WAREHOUSE_COMPOSANT',
      ref: item.id_templates || item.ref || '',
      designation: item.libelle || item.designation || '',
      type: item.id_family || '',
      emplacement: item.emplacement || '',
    });
    startTransition(() => setCurrentTab('sortie'));
  };

  const handleNavigateToQuickSortieFromMachine = (machine) => {
    if (!machine) return;
    const targetZone = machine.id_zone_default || machine.id_zone || '';
    setQuickSortiePreset({
      source: 'STOCK_PDR',
      id_machine_registered: machine.id_machine_registered || '',
      id_zone: targetZone,
      technicien: machine.technician || '',
    });
    startTransition(() => setCurrentTab('sortie'));
  };

  const handleNavigateToQuickSortieFromNexus = (preset) => {
    if (!preset) return;
    setQuickSortiePreset({
      source: 'STOCK_PDR',
      ...preset,
    });
    startTransition(() => setCurrentTab('sortie'));
  };

  const handleNavigateToDiagFiltered = handleNavigateToDesignationsFiltered;

  const handleNavigateToFamilyFiltered = (familyId) => {
    setWhSearch(familyId || '');
    startTransition(() => setCurrentTab('families'));
  };

  const handleNavigateToTemplatesFiltered = (familyId) => {
    setTemplateFamilyFilter(familyId);
    startTransition(() => setCurrentTab('templates'));
  };

  const handleNavigateToMachinesByFamily = (familyId) => {
    setMchFamilyFilter(familyId);
    setMchTemplateFilter('ALL');
    startTransition(() => setCurrentTab('machines'));
  };

  const handleNavigateToMachinesByTemplate = (familyId, templateId) => {
    setMchFamilyFilter(familyId);
    setMchTemplateFilter(templateId);
    startTransition(() => setCurrentTab('machines'));
  };

  const handleNavigateToTechsByZone = (zoneId) => {
    setTechZoneFilter(zoneId);
    startTransition(() => setCurrentTab('technicians'));
  };

  const handleNavigateToOpsByZone = (zoneId) => {
    setOpZoneFilter(zoneId);
    startTransition(() => setCurrentTab('operations'));
  };

  const handleNavigateToMachinesByZone = (zoneId) => {
    setMchZoneFilter(zoneId);
    startTransition(() => setCurrentTab('machines'));
  };

  // GROUPE ENTREPÔT NAVIGATION HANDLERS
  const handleNavigateToCompGroups = () => {
    startTransition(() => setCurrentTab('comp_groups'));
  };

  const handleNavigateToCompFamiliesByGroup = (groupId) => {
    setCompFamilyGroupFilter(groupId || '');
    startTransition(() => setCurrentTab('comp_families'));
  };

  const handleNavigateToCompTemplatesByGroup = (groupId) => {
    setCompTemplateGroupFilter(groupId || '');
    setCompTemplateFamilyFilter('');
    startTransition(() => setCurrentTab('comp_templates'));
  };

  const handleNavigateToCompTemplates = (familyId) => {
    setCompTemplateFamilyFilter(familyId || '');
    startTransition(() => setCurrentTab('comp_templates'));
  };

  const handleNavigateToCompFamilies = (familyId) => {
    if (typeof familyId === 'string') {
      setCompFamilyGroupFilter('');
    }
    startTransition(() => setCurrentTab('comp_families'));
  };

  const handleNavigateToPartGroups = () => {
    startTransition(() => setCurrentTab('part_groups'));
  };

  const handleNavigateToPartTypesByGroup = (groupId) => {
    setPartTypeGroupFilter(groupId || 'ALL');
    startTransition(() => setCurrentTab('part_types'));
  };

  const handleNavigateToEntrepotByPartGroup = (groupId) => {
    setWhPartGroupFilter(groupId || 'ALL');
    setWhTypeFilter('ALL');
    setWhNatureFilter('PART');
    startTransition(() => setCurrentTab('entrepot'));
  };

  const handleNavigateToPartDesignations = (typeId) => {
    setPartDesignationTypeFilter(typeId || '');
    startTransition(() => setCurrentTab('part_designations'));
  };

  const handleNavigateToPartTypes = (typeId) => {
    if (typeof typeId === 'string') {
      setWhSearch(typeId);
    }
    startTransition(() => setCurrentTab('part_types'));
  };

  const handleNavigateToEntrepotByComp = (familyId, templateId) => {
    setWhFamilyFilter(familyId || 'ALL');
    setWhTemplateFilter(templateId || 'ALL');
    setWhNatureFilter('COMPONENT');
    startTransition(() => setCurrentTab('entrepot'));
  };

  const handleNavigateToEntrepotByTemplate = (templateId, familyId) => {
    setWhFamilyFilter(familyId || 'ALL');
    setWhTemplateFilter(templateId || 'ALL');
    setWhNatureFilter('COMPONENT');
    startTransition(() => setCurrentTab('entrepot'));
  };

  const handleNavigateToEntrepotByType = (typeId) => {
    setWhTypeFilter(typeId || 'ALL');
    setWhNatureFilter('PART');
    startTransition(() => setCurrentTab('entrepot'));
  };

  const handleNavigateToEntrepotByPart = (refOrPart, typeId) => {
    if (typeId) setWhTypeFilter(typeId);
    setWhSearch(refOrPart || '');
    setWhNatureFilter('PART');
    startTransition(() => setCurrentTab('entrepot'));
  };

  const handleNavigateToMachineById = (machineId) => {
    setMchSearch(machineId || '');
    setMchFamilyFilter('ALL');
    setMchTemplateFilter('ALL');
    setMchZoneFilter('ALL');
    startTransition(() => setCurrentTab('machines'));
  };

  const handleNavigateToZoneById = (zoneId) => {
    if (typeof zoneId === 'string') {
      setWhSearch(zoneId);
    }
    startTransition(() => setCurrentTab('zones'));
  };

  const handleNavigateToBlueprintsFiltered = (familyId, templateId) => {
    if (familyId) setBlueprintFamilyFilter(familyId);
    if (templateId) setBlueprintTemplateFilter(templateId);
    startTransition(() => setCurrentTab('blueprints'));
  };

  const handleNavigateToCreateTemplateForFamily = (familyId) => {
    setTemplateFamilyFilter(familyId || 'ALL');
    setQuickCreateTemplateFamily(familyId);
    startTransition(() => setCurrentTab('templates'));
  };

  const handleNavigateToCreateBlueprintForTemplate = (familyId, templateId) => {
    if (familyId) setBlueprintFamilyFilter(familyId);
    if (templateId) setBlueprintTemplateFilter(templateId);
    setQuickCreateBlueprintPreset({
      id_family: familyId || '',
      id_templates: templateId || '',
    });
    startTransition(() => setCurrentTab('blueprints'));
  };

  return {
    filters: {
      stockSearch,
      setStockSearch,
      stockTypeFilter,
      setStockTypeFilter,
      stockAlertOnly,
      setStockAlertOnly,
      mchSearch,
      setMchSearch,
      mchFamilyFilter,
      setMchFamilyFilter,
      mchTemplateFilter,
      setMchTemplateFilter,
      mchZoneFilter,
      setMchZoneFilter,
      diagTypeFilter,
      setDiagTypeFilter,
      typeGroupFilter,
      setTypeGroupFilter,
      quickCreateDesignationType,
      setQuickCreateDesignationType,
      quickCreateCompTemplateFamily,
      setQuickCreateCompTemplateFamily,
      quickCreateTemplateFamily,
      setQuickCreateTemplateFamily,
      quickCreateBlueprintPreset,
      setQuickCreateBlueprintPreset,
      quickSortiePreset,
      setQuickSortiePreset,
      opZoneFilter,
      setOpZoneFilter,
      techZoneFilter,
      setTechZoneFilter,
      templateFamilyFilter,
      setTemplateFamilyFilter,
      blueprintFamilyFilter,
      setBlueprintFamilyFilter,
      blueprintTemplateFilter,
      setBlueprintTemplateFilter,
      whFamilyFilter,
      setWhFamilyFilter,
      whTemplateFilter,
      setWhTemplateFilter,
      whPartGroupFilter,
      setWhPartGroupFilter,
      whTypeFilter,
      setWhTypeFilter,
      whNatureFilter,
      setWhNatureFilter,
      whSearch,
      setWhSearch,
      compFamilyGroupFilter,
      setCompFamilyGroupFilter,
      compTemplateGroupFilter,
      setCompTemplateGroupFilter,
      compTemplateFamilyFilter,
      setCompTemplateFamilyFilter,
      partTypeGroupFilter,
      setPartTypeGroupFilter,
      partDesignationTypeFilter,
      setPartDesignationTypeFilter,
    },
    navigation: {
      handleNavigateToStockFiltered,
      handleNavigateToStockFilteredByRef,
      handleNavigateToDesignationsFiltered,
      handleNavigateToPdrGroups,
      handleNavigateToTypesByGroup,
      handleNavigateToStockByGroup,
      handleNavigateToCreateDesignationForType,
      handleNavigateToQuickSortieFromDesignation,
      handleNavigateToQuickSortieFromPartDesignation,
      handleNavigateToCreateCompTemplateForFamily,
      handleNavigateToQuickSortieFromCompTemplate,
      handleNavigateToQuickSortieFromMachine,
      handleNavigateToQuickSortieFromNexus,
      handleNavigateToDiagFiltered,
      handleNavigateToFamilyFiltered,
      handleNavigateToTemplatesFiltered,
      handleNavigateToCreateTemplateForFamily,
      handleNavigateToMachinesByFamily,
      handleNavigateToMachinesByTemplate,
      handleNavigateToTechsByZone,
      handleNavigateToOpsByZone,
      handleNavigateToMachinesByZone,
      handleNavigateToCompGroups,
      handleNavigateToCompFamiliesByGroup,
      handleNavigateToCompTemplatesByGroup,
      handleNavigateToCompTemplates,
      handleNavigateToCompFamilies,
      handleNavigateToPartGroups,
      handleNavigateToPartTypesByGroup,
      handleNavigateToEntrepotByPartGroup,
      handleNavigateToPartDesignations,
      handleNavigateToPartTypes,
      handleNavigateToEntrepotByComp,
      handleNavigateToEntrepotByTemplate,
      handleNavigateToEntrepotByType,
      handleNavigateToEntrepotByPart,
      handleNavigateToMachineById,
      handleNavigateToZoneById,
      handleNavigateToBlueprintsFiltered,
      handleNavigateToCreateBlueprintForTemplate,
    },
  };
}
