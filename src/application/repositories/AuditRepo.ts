import { STORAGE_KEYS } from '../../infrastructure/persistence/storageKeys';
import { storageService } from '../../utils/storageService';
import { safeId } from '../../utils/safeId';
import type { AuditSnapshot, IAuditEvent } from '../../types/audit';

/**
 * Normalizes arbitrary audit snapshot values into a frozen object record or null before persisting.
 */
export function freezeAuditSnapshot(val: unknown): AuditSnapshot {
  if (val && typeof val === 'object' && !Array.isArray(val)) {
    return Object.freeze({ ...(val as Record<string, unknown>) });
  }
  if (Array.isArray(val)) {
    return Object.freeze({ items: Object.freeze([...val]) });
  }
  return val == null ? null : Object.freeze({ value: val });
}

export interface AppendAuditEventInput {
  id?: string;
  ts?: string;
  actorId?: string;
  actorName?: string;
  actorRole?: string;
  actionType: string;
  entityType: string;
  entityId: string;
  before: unknown;
  after: unknown;
  meta?: Record<string, unknown>;
}

/**
 * Domain repository owning the institutional append-only audit ledger (`STORAGE_KEYS.AUDIT_EVENTS`).
 */
export const AuditRepo = {
  getAuditEvents(): IAuditEvent[] {
    const raw = storageService.getItem(STORAGE_KEYS.AUDIT_EVENTS);
    return Array.isArray(raw) ? (raw as IAuditEvent[]) : [];
  },

  saveAuditEvents(list: IAuditEvent[] = []): IAuditEvent[] {
    const clean = Array.isArray(list) ? list : [];
    storageService.setItem(STORAGE_KEYS.AUDIT_EVENTS, clean);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('gmao_audit_events_synced', { detail: { list: clean } }));
    }
    return clean;
  },

  appendAuditEvent(payload: AppendAuditEventInput): { event: IAuditEvent; list: IAuditEvent[] } {
    const current = this.getAuditEvents();
    const safeBefore = freezeAuditSnapshot(payload.before);
    const safeAfter = freezeAuditSnapshot(payload.after);
    const event: IAuditEvent = Object.freeze({
      id: payload.id || safeId('AUD'),
      ts: payload.ts || new Date().toISOString(),
      actorId: String(payload.actorId || payload.actorName || 'SYSTEM').trim(),
      actorName: String(payload.actorName || payload.actorId || 'Système GMAO').trim(),
      actorRole: String(payload.actorRole || 'ADMIN').trim().toUpperCase(),
      actionType: String(payload.actionType || 'MUTATION').trim(),
      entityType: String(payload.entityType || 'ENTITY').trim(),
      entityId: String(payload.entityId || 'UNKNOWN').trim(),
      before: safeBefore,
      after: safeAfter,
      meta: Object.freeze({
        ...(typeof navigator !== 'undefined' && navigator.userAgent ? { userAgent: navigator.userAgent } : {}),
        ...(payload.meta || {}),
      }),
    });
    const next = [event, ...current];
    this.saveAuditEvents(next);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('gmao_audit_event_appended', { detail: { event, list: next } }));
    }
    return { event, list: next };
  },
};
