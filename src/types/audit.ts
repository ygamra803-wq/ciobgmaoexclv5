/**
 * Append-Only Enterprise Audit Event Types (AUDIT-LEDGER-P0)
 * Records immutable before/after snapshots for critical GMAO state mutations.
 */

export type AuditEntityType =
  | 'STOCK_ITEM'
  | 'MACHINE'
  | 'CORRECTIVE_BT'
  | 'PREVENTIVE_EXECUTION'
  | 'SORTIE_DEMAND'
  | 'REPLENISHMENT_ORDER'
  | 'FINANCIAL_BUDGET';

export type AuditActionType =
  | 'STOCK_INITIAL_CHANGED'
  | 'STOCK_PRICE_CHANGED'
  | 'STOCK_INITIAL_AND_PRICE_CHANGED'
  | 'MACHINE_ARCHIVED'
  | 'MACHINE_RESTORED'
  | 'VALIDATION_APPROVED'
  | 'VALIDATION_REJECTED'
  | 'VALIDATION_NEEDS_CLARIFICATION'
  | 'PO_CREATED'
  | 'PO_STATUS_CHANGED'
  | 'PO_RECEIVED'
  | 'PO_CANCELLED'
  | 'BUDGET_UPDATED'
  | string;

/** Immutable snapshot stored on audit ledger entries (object map or null when entity did not exist). */
export type AuditSnapshot = Readonly<Record<string, unknown>> | null;

export interface IAuditEvent {
  id: string;
  ts: string;
  actorId: string;
  actorName: string;
  actorRole: string;
  actionType: AuditActionType;
  entityType: AuditEntityType | string;
  entityId: string;
  before: AuditSnapshot;
  after: AuditSnapshot;
  meta?: {
    ip?: string;
    userAgent?: string;
    summary?: string;
    [key: string]: unknown;
  };
}
