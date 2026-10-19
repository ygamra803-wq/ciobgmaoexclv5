/**
 * Security, Authentication & Session Types
 */

export type UserRole = 'ADMIN' | 'RESPONSABLE_MAINTENANCE' | 'TECHNICIEN' | 'MAGASINIER' | 'OPERATEUR' | 'VISITEUR';

export interface IUserSession {
  sessionId: string;
  userId: string;
  username: string;
  role: UserRole;
  token?: string;
  signature?: string;
  salt?: string;
  iterations?: number;
  loginTimestamp: number;
  lastActivityTimestamp: number;
  expiresAt: number;
  permissions: string[];
}

export interface IAuditLog {
  id: string | number;
  timestamp: string | number;
  userId: string;
  username: string;
  role?: string;
  action: string;
  entityType: string;
  entityId?: string;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  status: 'SUCCESS' | 'FAILURE' | 'WARNING';
}

export interface IVaultRecord {
  id: string;
  version: number;
  encryptedData: string;
  iv: string;
  salt: string;
  iterations: number;
  checksum: string;
  updatedAt: string;
}
