import { useAuth } from '../../../context/AuthContext';
import { AuthorizationService } from '../../../core/security/AuthorizationService';
import { ShieldAlert } from 'lucide-react';

/**
 * Hook to check if current logged-in user possesses a permission
 * @param {string} permission - Key from PERMISSIONS (e.g. 'stock.delete')
 * @returns {boolean}
 */
export function usePermission(permission) {
  const auth = useAuth();
  const user = auth?.user;
  if (!user) return false;
  return AuthorizationService.hasPermission(user, permission);
}

/**
 * PermissionGate Component
 * Conditionally renders children if the authenticated user has permission.
 */
export function PermissionGate({
  permission,
  children,
  fallback = null,
  showWarning = false,
  warningMessage = 'Accès restreint aux utilisateurs autorisés.'
}) {
  const isAllowed = usePermission(permission);

  if (isAllowed) {
    return <>{children}</>;
  }

  if (showWarning) {
    return (
      <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-2.5 text-xs text-amber-800">
        <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
        <span className="font-medium">{warningMessage}</span>
      </div>
    );
  }

  return fallback;
}

/**
 * RestrictedButton Component
 * Renders a button that is disabled or hidden when the user lacks required permission.
 */
export function RestrictedButton({
  permission,
  children,
  onClick,
  className = '',
  disabledClassName = 'opacity-40 cursor-not-allowed grayscale',
  hideIfDenied = false,
  tooltipIfDenied = 'Opération réservée aux administrateurs',
  disabled = false,
  ...props
}) {
  const isAllowed = usePermission(permission);

  if (!isAllowed && hideIfDenied) {
    return null;
  }

  const isDisabled = disabled || !isAllowed;

  return (
    <button
      {...props}
      disabled={isDisabled}
      onClick={isAllowed ? onClick : undefined}
      title={!isAllowed ? tooltipIfDenied : props.title}
      className={`${className} ${isDisabled ? disabledClassName : ''}`}
    >
      {children}
    </button>
  );
}

export default PermissionGate;
