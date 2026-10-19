/**
 * SmartLink Component
 * Enables smart navigation and automatic filtering across GMAO tables.
 * 
 * @param {Object} props
 * @param {string} props.id - Target record ID (e.g. 'TYPE-001', 'ROUL-6204', 'ZONE-01')
 * @param {string} props.table - Target table/view name (e.g. 'types', 'articles', 'zones')
 * @param {React.ReactNode} [props.children] - Optional custom display content
 * @param {Function} [props.onClick] - Optional click handler callback (table, id) => void
 * @param {string} [props.className] - Optional custom CSS classes
 */
import { Logger } from '../core/logger/LoggerService';
import { storageService } from '../utils/storageService';

function SmartLink({ id, table, children, onClick, className = '' }) {
  const handleClick = (e) => {
    if (e) e.stopPropagation();
    Logger.debug(`🔗 Navigating to ${table} with filter: ${id}`);
    
    if (id) {
      try {
        storageService.setItem('activeFilter', id);
        storageService.setItem('gmao_smart_filter', { table, filterId: id, timestamp: Date.now() });
      } catch (err) {
        Logger.warn('⚠️ Could not save smart filter to storageService:', err);
      }
    }
    
    if (onClick) {
      onClick(table, id);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`text-blue-600 hover:text-blue-800 hover:underline cursor-pointer font-mono font-bold inline-flex items-center gap-1 transition ${className}`}
      title={`Cliquer pour accéder à ${table} (${id})`}
    >
      {children || id}
    </button>
  );
}

export default SmartLink;
