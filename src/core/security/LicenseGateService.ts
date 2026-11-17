import { SecurityService } from './SecurityService';
import { PBKDF2_STANDARD_ITERATIONS, sha256Hex } from './nativeCrypto';
import { STORAGE_KEYS } from '../../infrastructure/persistence/storageKeys';
import { getSafeLocalStorage } from '../../infrastructure/persistence/safeStorage';
import { indexedDBService } from '../../infrastructure/database/IndexedDBService';

export type LicenseStatus = 'ACTIVE' | 'INACTIVE' | 'REVOKED';

/**
 * LOGIN-LICENSE-P0: Local Commercial License Record (SSOT for Gate Key 1).
 * Never stores the raw license key (`Clé de licence`) in plaintext.
 */
export interface ILicenseRecord {
  version: 1;
  /** Non-reversible public fingerprint (e.g. LIC-FPR-8F3A-19C0-4B12) */
  licenseKeyId: string;
  licenseStatus: LicenseStatus;
  activatedAt: string;
  /** Per-installation 16-byte random hex salt */
  installSalt: string;
  /** PBKDF2-HMAC-SHA256 verifier derived from installSalt + licenseKey */
  licenseVerifier: string;
  organizationLabel?: string;
  seatsHint?: string;
  lastAuthAt?: string;
  rotatedAt?: string;
}

export interface ILicenseFilePayload {
  licenseKey: string;
  organizationLabel?: string;
  seatsHint?: string;
}

const PROHIBITED_WEAK_LICENSE_KEYS = new Set([
  '000000',
  '111111',
  '222222',
  '333333',
  '444444',
  '555555',
  '666666',
  '777777',
  '888888',
  '999999',
  '123456',
  '654321',
  '12345678',
  '87654321',
  '00000000',
  '1234',
  '0000',
  'admin',
  'magasinier',
  'viewer',
  'tech',
  'password',
  'licence',
  'license',
]);

/**
 * Detects whether a user-supplied secret looks like a stored cryptographic artifact
 * (PBKDF2 hash envelope, AES-GCM envelope, or legacy hex digest) to prevent
 * pass-the-hash / copy-paste attacks from local storage dumps.
 */
export function looksLikeStoredVerifierOrHash(candidate: unknown): boolean {
  const clean = String(candidate ?? '').trim();
  if (!clean) return false;
  if (clean.startsWith('pbkdf2:v1:')) return true;
  if (clean.startsWith('AG1:')) return true;
  if (/^\$2[aby]\$\d+\$/.test(clean)) return true;
  if (/^[0-9a-fA-F]{64}$/.test(clean)) return true;
  return false;
}

/**
 * Validates the commercial license key (`Clé de licence / PIN licence`) format and strength.
 */
export function validateLicenseKeyPolicy(rawKey: unknown): string {
  const clean = String(rawKey ?? '').trim();
  if (!clean) {
    throw new Error('Veuillez saisir la clé de licence commerciale.');
  }

  if (looksLikeStoredVerifierOrHash(clean)) {
    throw new Error(
      'Format de clé de licence invalide : les empreintes cryptographiques stockées ne peuvent pas être utilisées comme clé.'
    );
  }

  if (PROHIBITED_WEAK_LICENSE_KEYS.has(clean.toLowerCase())) {
    throw new Error(
      'Clé de licence trop faible ou interdite (ex: 123456, 000000, admin). Choisissez une clé de licence commerciale robuste.'
    );
  }

  if (/^(.)\1+$/.test(clean)) {
    throw new Error(
      'Clé de licence invalide : les séquences composées d’un seul caractère répété sont interdites.'
    );
  }

  const isNumericOnly = /^\d+$/.test(clean);
  if (isNumericOnly) {
    if (clean.length < 6 || clean.length > 16) {
      throw new Error(
        'Un code clé de licence numérique doit comporter entre 6 et 16 chiffres.'
      );
    }
    return clean;
  }

  if (clean.length < 6 || clean.length > 64) {
    throw new Error(
      'La clé de licence commerciale doit comporter entre 6 et 64 caractères.'
    );
  }

  return clean;
}

function buildVerifierMaterial(installSalt: string, cleanLicenseKey: string): string {
  return `ciob-lic-v1:${installSalt}:${cleanLicenseKey}`;
}

function computeLicenseKeyFingerprint(installSalt: string, cleanLicenseKey: string): string {
  const rawDigest = sha256Hex(
    `ciob-lic-fpr-v1:${installSalt}:${cleanLicenseKey}`
  ).toUpperCase();
  return `LIC-FPR-${rawDigest.slice(0, 4)}-${rawDigest.slice(4, 8)}-${rawDigest.slice(8, 12)}`;
}

const LICENSE_RECORD_KEY = STORAGE_KEYS.LICENSE_RECORD || 'gmao_license_record_v1';
const REMEMBERED_LICENSE_KEY =
  STORAGE_KEYS.REMEMBERED_LICENSE_KEY || 'gmao_workshop_remembered_license_v1';

class LicenseGateServiceClass {
  private _lastRawCipher: string | null = null;
  private _cachedRecord: ILicenseRecord | null = null;

  getLicenseRecord(): ILicenseRecord | null {
    try {
      const ls = getSafeLocalStorage();
      if (ls) {
        const raw = ls.getItem(LICENSE_RECORD_KEY);
        if (!raw) {
          const fallbackRecord = SecurityService.getSecure(LICENSE_RECORD_KEY);
          if (!fallbackRecord) {
            this._lastRawCipher = null;
            this._cachedRecord = null;
            return null;
          }
        } else if (this._lastRawCipher === raw && this._cachedRecord) {
          return this._cachedRecord;
        }
      }
      const record = SecurityService.getSecure(LICENSE_RECORD_KEY);
      if (
        record &&
        typeof record === 'object' &&
        record.version === 1 &&
        typeof record.licenseKeyId === 'string' &&
        typeof record.installSalt === 'string' &&
        typeof record.licenseVerifier === 'string' &&
        typeof record.licenseStatus === 'string'
      ) {
        this._lastRawCipher = ls ? ls.getItem(LICENSE_RECORD_KEY) : null;
        this._cachedRecord = record as ILicenseRecord;
        return this._cachedRecord;
      }
      return null;
    } catch {
      return null;
    }
  }

  saveLicenseRecord(record: ILicenseRecord, emitEvent = true): ILicenseRecord {
    SecurityService.saveSecure(LICENSE_RECORD_KEY, record);
    const ls = getSafeLocalStorage();
    try {
      this._lastRawCipher = ls ? ls.getItem(LICENSE_RECORD_KEY) : null;
    } catch {
      this._lastRawCipher = null;
    }
    this._cachedRecord = record;
    indexedDBService.setItem(LICENSE_RECORD_KEY, record).catch(() => {});
    if (emitEvent && typeof window !== 'undefined') {
      window.dispatchEvent(new Event('storage'));
      window.dispatchEvent(
        new CustomEvent('gmao_license_record_updated', { detail: record })
      );
    }
    return record;
  }

  isLicenseActive(): boolean {
    const record = this.getLicenseRecord();
    return Boolean(
      record &&
        record.licenseStatus === 'ACTIVE' &&
        record.installSalt &&
        record.licenseVerifier &&
        record.licenseVerifier.startsWith('pbkdf2:v1:')
    );
  }

  async activateLicense(params: {
    licenseKey: string;
    organizationLabel?: string;
    seatsHint?: string;
  }): Promise<ILicenseRecord> {
    const cleanKey = validateLicenseKeyPolicy(params.licenseKey);
    const installSalt = SecurityService.generateRandomHex(16);
    const verifierMaterial = buildVerifierMaterial(installSalt, cleanKey);
    const licenseVerifier = await SecurityService.hashPassword(
      verifierMaterial,
      installSalt,
      PBKDF2_STANDARD_ITERATIONS
    );
    const licenseKeyId = computeLicenseKeyFingerprint(installSalt, cleanKey);
    const nowIso = new Date().toISOString();

    const record: ILicenseRecord = {
      version: 1,
      licenseKeyId,
      licenseStatus: 'ACTIVE',
      activatedAt: nowIso,
      installSalt,
      licenseVerifier,
      organizationLabel: params.organizationLabel?.trim() || 'Atelier Industriel CIOB',
      seatsHint: params.seatsHint?.trim() || 'Poste / LAN Atelier',
      lastAuthAt: nowIso,
    };

    return this.saveLicenseRecord(record, true);
  }

  async verifyLicenseKey(
    candidateKey: unknown,
    options: { touchLastAuth?: boolean; persistTouch?: boolean } = {
      touchLastAuth: true,
      persistTouch: false,
    }
  ): Promise<boolean> {
    const cleanKey = String(candidateKey ?? '').trim();
    if (!cleanKey) return false;
    if (looksLikeStoredVerifierOrHash(cleanKey)) return false;

    const record = this.getLicenseRecord();
    if (!record || record.licenseStatus !== 'ACTIVE') {
      return false;
    }

    const verifierMaterial = buildVerifierMaterial(record.installSalt, cleanKey);
    const isMatch = await SecurityService.comparePassword(
      verifierMaterial,
      record.licenseVerifier
    );

    if (isMatch && options.touchLastAuth !== false) {
      const updated: ILicenseRecord = {
        ...record,
        lastAuthAt: new Date().toISOString(),
      };
      this._cachedRecord = updated;
      if (options.persistTouch) {
        this.saveLicenseRecord(updated, false);
      }
    }

    return isMatch;
  }

  async rotateLicenseKey(params: {
    currentLicenseKey: string;
    newLicenseKey: string;
    organizationLabel?: string;
    seatsHint?: string;
  }): Promise<ILicenseRecord> {
    const currentRecord = this.getLicenseRecord();
    if (!currentRecord || currentRecord.licenseStatus !== 'ACTIVE') {
      throw new Error("Aucune licence active n'est configurée sur ce système.");
    }

    const isCurrentValid = await this.verifyLicenseKey(params.currentLicenseKey, {
      touchLastAuth: false,
    });
    if (!isCurrentValid) {
      throw new Error('La clé de licence actuelle est incorrecte.');
    }

    const cleanNewKey = validateLicenseKeyPolicy(params.newLicenseKey);
    const installSalt = SecurityService.generateRandomHex(16);
    const verifierMaterial = buildVerifierMaterial(installSalt, cleanNewKey);
    const licenseVerifier = await SecurityService.hashPassword(
      verifierMaterial,
      installSalt,
      PBKDF2_STANDARD_ITERATIONS
    );
    const licenseKeyId = computeLicenseKeyFingerprint(installSalt, cleanNewKey);
    const nowIso = new Date().toISOString();

    const nextRecord: ILicenseRecord = {
      version: 1,
      licenseKeyId,
      licenseStatus: 'ACTIVE',
      activatedAt: currentRecord.activatedAt || nowIso,
      rotatedAt: nowIso,
      installSalt,
      licenseVerifier,
      organizationLabel:
        params.organizationLabel?.trim() ||
        currentRecord.organizationLabel ||
        'Atelier Industriel CIOB',
      seatsHint:
        params.seatsHint?.trim() || currentRecord.seatsHint || 'Poste / LAN Atelier',
      lastAuthAt: nowIso,
    };

    this.clearRememberedLicenseKey();

    return this.saveLicenseRecord(nextRecord, true);
  }

  parseLicenseFilePayload(rawContent: string): ILicenseFilePayload {
    const trimmed = String(rawContent ?? '').trim();
    if (!trimmed) {
      throw new Error('Le fichier de licence sélectionné est vide.');
    }

    if (trimmed.startsWith('{')) {
      try {
        const parsed = JSON.parse(trimmed);
        const keyCandidate = String(
          parsed.licenseKey || parsed.key || parsed.code || parsed.pin || ''
        ).trim();
        const validKey = validateLicenseKeyPolicy(keyCandidate);
        return {
          licenseKey: validKey,
          organizationLabel:
            typeof parsed.organizationLabel === 'string'
              ? parsed.organizationLabel.trim()
              : typeof parsed.organization === 'string'
                ? parsed.organization.trim()
                : undefined,
          seatsHint:
            typeof parsed.seatsHint === 'string'
              ? parsed.seatsHint.trim()
              : undefined,
        };
      } catch (err: any) {
        throw new Error(
          err?.message?.includes('clé de licence')
            ? err.message
            : 'Fichier de licence JSON invalide.'
        );
      }
    }

    const lines = trimmed
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#') && !l.startsWith('//'));

    let extractedKey = '';
    let organizationLabel: string | undefined;
    let seatsHint: string | undefined;

    for (const line of lines) {
      const kvMatch = line.match(/^([A-Za-z0-9_.-]+)\s*[:=]\s*(.+)$/);
      if (kvMatch) {
        const k = kvMatch[1].toLowerCase();
        const v = kvMatch[2].trim();
        if (k === 'license_key' || k === 'licensekey' || k === 'key' || k === 'cle') {
          extractedKey = v;
        } else if (k === 'organization' || k === 'organization_label' || k === 'atelier') {
          organizationLabel = v;
        } else if (k === 'seats' || k === 'seats_hint') {
          seatsHint = v;
        }
      } else if (!extractedKey) {
        extractedKey = line;
      }
    }

    const validKey = validateLicenseKeyPolicy(extractedKey);
    return {
      licenseKey: validKey,
      organizationLabel,
      seatsHint,
    };
  }

  getRememberedLicenseKey(): string {
    try {
      const saved = SecurityService.getSecure(REMEMBERED_LICENSE_KEY);
      if (saved && typeof saved === 'object' && typeof saved.licenseKey === 'string') {
        return saved.licenseKey;
      }
      return '';
    } catch {
      return '';
    }
  }

  setRememberedLicenseKey(licenseKey: string, remember: boolean): void {
    if (!remember || !licenseKey) {
      this.clearRememberedLicenseKey();
      return;
    }
    SecurityService.saveSecure(REMEMBERED_LICENSE_KEY, {
      licenseKey: String(licenseKey).trim(),
      savedAt: new Date().toISOString(),
    });
  }

  clearRememberedLicenseKey(): void {
    SecurityService.removeSecure(REMEMBERED_LICENSE_KEY);
  }

  clearLicenseRecord(): void {
    this._lastRawCipher = null;
    this._cachedRecord = null;
    SecurityService.removeSecure(LICENSE_RECORD_KEY);
    this.clearRememberedLicenseKey();
    indexedDBService.removeItem(LICENSE_RECORD_KEY).catch(() => {});
  }
}

export const LicenseGateService = new LicenseGateServiceClass();
export default LicenseGateService;
