/**
 * IndexedDB Service Re-export for Backward Compatibility.
 * All operations are delegated to the unified Single Source of Truth:
 * '@/infrastructure/database/IndexedDBService.js'
 */

export {
  indexedDBService,
  indexedDBService as default,
  IndexedDBService,
} from '../infrastructure/database/IndexedDBService';
