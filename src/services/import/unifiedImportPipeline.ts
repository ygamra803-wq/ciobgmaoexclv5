/**
 * Unified Import Pipeline — Thin Facade & Dispatcher (`SPLIT-PIPELINE-P1`)
 *
 * Re-exports all public validators, exporters, official templates, and commit listener hooks
 * from modular bundle units under `./bundles/*` and `./pipelineShared`.
 */
import {
  AssetsMachinesBundleInput,
  CmCatalogBundleInput,
  DemoBundleInput,
  EntrepotBomBundleInput,
  ImportReport,
  PmCatalogBundleInput,
  RefParcBundleInput,
  RefPdrBundleInput,
  RefPersonnelBundleInput,
  UnifiedImportOptions,
} from './types/unifiedImportTypes';
import {
  exportRefParcBundle,
  getRefParcOfficialTemplate,
  validateAndCommitRefParcBundle,
} from './bundles/refParcBundle';
import {
  exportRefPersonnelBundle,
  getRefPersonnelOfficialTemplate,
  validateAndCommitRefPersonnelBundle,
} from './bundles/refPersonnelBundle';
import {
  exportAssetsMachinesBundle,
  getAssetsMachinesOfficialTemplate,
  validateAndCommitAssetsMachinesBundle,
} from './bundles/assetsMachinesBundle';
import {
  exportRefPdrBundle,
  getRefPdrOfficialTemplate,
  validateAndCommitRefPdrBundle,
} from './bundles/refPdrBundle';
import {
  exportPmCatalogBundle,
  getPmCatalogOfficialTemplate,
  validateAndCommitPmCatalogBundle,
} from './bundles/pmCatalogBundle';
import {
  exportEntrepotBomBundle,
  getEntrepotBomOfficialTemplate,
  validateAndCommitEntrepotBomBundle,
} from './bundles/entrepotBomBundle';
import {
  exportCmCatalogBundle,
  getCmCatalogOfficialTemplate,
  validateAndCommitCmCatalogBundle,
} from './bundles/cmCatalogBundle';
import { validateAndCommitDemoBundle } from './bundles/demoBundle';

export {
  type PipelineCommitSyncListener,
  registerPipelineCommitListener,
} from './pipelineShared';

export {
  validateAndCommitRefParcBundle,
  validateAndCommitRefPersonnelBundle,
  validateAndCommitAssetsMachinesBundle,
  validateAndCommitRefPdrBundle,
  validateAndCommitPmCatalogBundle,
  validateAndCommitEntrepotBomBundle,
  validateAndCommitCmCatalogBundle,
  validateAndCommitDemoBundle,
  exportRefParcBundle,
  exportRefPersonnelBundle,
  exportAssetsMachinesBundle,
  exportRefPdrBundle,
  exportPmCatalogBundle,
  exportEntrepotBomBundle,
  exportCmCatalogBundle,
  getRefParcOfficialTemplate,
  getRefPersonnelOfficialTemplate,
  getAssetsMachinesOfficialTemplate,
  getRefPdrOfficialTemplate,
  getPmCatalogOfficialTemplate,
  getEntrepotBomOfficialTemplate,
  getCmCatalogOfficialTemplate,
};

/**
 * Unified entry point dispatching `REF_PARC`, `REF_PERSONNEL`, `ASSETS_MACHINES`, `REF_PDR`, `PM_CATALOG`, `ENTREPOT_BOM`, `CM_CATALOG`, or `DEMO_BUNDLE` bundles.
 */
export function runUnifiedImportPipeline(
  bundle:
    | (RefParcBundleInput & { bundleType: 'REF_PARC' })
    | (RefPersonnelBundleInput & { bundleType: 'REF_PERSONNEL' })
    | (AssetsMachinesBundleInput & { bundleType: 'ASSETS_MACHINES' })
    | (RefPdrBundleInput & { bundleType: 'REF_PDR' })
    | (PmCatalogBundleInput & { bundleType: 'PM_CATALOG' })
    | (EntrepotBomBundleInput & { bundleType: 'ENTREPOT_BOM' })
    | (CmCatalogBundleInput & { bundleType: 'CM_CATALOG' })
    | (DemoBundleInput & { bundleType: 'DEMO_BUNDLE' }),
  options: UnifiedImportOptions = {}
): ImportReport<any> {
  if (bundle.bundleType === 'REF_PARC') {
    return validateAndCommitRefParcBundle(bundle, options);
  }
  if (bundle.bundleType === 'REF_PERSONNEL') {
    return validateAndCommitRefPersonnelBundle(bundle, options);
  }
  if (bundle.bundleType === 'ASSETS_MACHINES') {
    return validateAndCommitAssetsMachinesBundle(bundle, options);
  }
  if (bundle.bundleType === 'REF_PDR') {
    return validateAndCommitRefPdrBundle(bundle, options);
  }
  if (bundle.bundleType === 'PM_CATALOG') {
    return validateAndCommitPmCatalogBundle(bundle, options);
  }
  if (bundle.bundleType === 'ENTREPOT_BOM') {
    return validateAndCommitEntrepotBomBundle(bundle, options);
  }
  if (bundle.bundleType === 'CM_CATALOG') {
    return validateAndCommitCmCatalogBundle(bundle, options);
  }
  if (bundle.bundleType === 'DEMO_BUNDLE') {
    return validateAndCommitDemoBundle(bundle, options);
  }
  throw new Error(`Type de paquet non pris en charge : ${(bundle as any)?.bundleType}`);
}
