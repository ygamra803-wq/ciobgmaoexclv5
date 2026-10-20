import { storageService } from '../utils/storageService';

export type NetworkNodeMode = 'HOST' | 'LAN_CLIENT';

export interface NetworkInterfaceInfo {
  name: string;
  address: string;
  netmask: string;
  family: string;
}

export interface NetworkHostInfo {
  online: boolean;
  hostname: string;
  platform?: string;
  port: number;
  primaryIp: string;
  interfaces: NetworkInterfaceInfo[];
  urls: {
    desktop: string;
    mobile: string;
  };
  version: number;
  updatedAt: string | null;
  connectedClients: number;
}

export interface RevisionEventPayload {
  type: 'CONNECTED' | 'STATE_UPDATED';
  version: number;
  updatedAt: string;
  actor?: string;
  action?: string;
  entity?: string;
}

const NODE_MODE_STORAGE_KEY = 'gmao_network_node_mode';
const CUSTOM_HOST_IP_STORAGE_KEY = 'gmao_custom_lan_host_ip';

export const networkConfigService = {
  /**
   * Automatically detects whether the current browser instance is running on the Host machine
   * (`localhost` / `127.0.0.1`) or connecting as a LAN Client (`192.168.x.x`, mobile, etc.),
   * while respecting an explicit user override if set.
   */
  detectDefaultNodeMode(hostname?: string): NetworkNodeMode {
    const host =
      hostname ??
      (typeof window !== 'undefined' && window.location ? window.location.hostname : 'localhost');
    const clean = String(host || '').trim().toLowerCase();
    if (!clean || clean === 'localhost' || clean === '127.0.0.1' || clean === '::1') {
      return 'HOST';
    }
    return 'LAN_CLIENT';
  },

  getNodeMode(): NetworkNodeMode {
    const saved = storageService.getItem(NODE_MODE_STORAGE_KEY);
    if (saved === 'HOST' || saved === 'LAN_CLIENT') {
      return saved;
    }
    return this.detectDefaultNodeMode();
  },

  setNodeMode(mode: NetworkNodeMode): void {
    if (mode !== 'HOST' && mode !== 'LAN_CLIENT') return;
    storageService.setItem(NODE_MODE_STORAGE_KEY, mode);
  },

  getCustomHostIp(): string {
    const saved = storageService.getItem(CUSTOM_HOST_IP_STORAGE_KEY);
    return typeof saved === 'string' ? saved.trim() : '';
  },

  setCustomHostIp(ipOrHost: string): void {
    const clean = String(ipOrHost || '').trim();
    storageService.setItem(CUSTOM_HOST_IP_STORAGE_KEY, clean);
  },

  /**
   * Normalizes and stores a remote host URL or IP:port for LAN_CLIENT mode.
   */
  setRemoteHostUrl(urlOrHost: string, defaultPort = 3000): string {
    const clean = String(urlOrHost || '')
      .trim()
      .replace(/\/+$/, '');
    if (!clean) {
      this.setCustomHostIp('');
      return '';
    }
    const withoutProto = clean.replace(/^https?:\/\//i, '');
    const hasPort = /:\d+$/.test(withoutProto);
    const normalized = /^https?:\/\//i.test(clean)
      ? hasPort
        ? clean
        : `${clean}:${defaultPort}`
      : hasPort
      ? `http://${withoutProto}`
      : `http://${withoutProto}:${defaultPort}`;
    this.setCustomHostIp(normalized);
    return normalized;
  },

  getRemoteHostUrl(): string {
    const custom = this.getCustomHostIp();
    if (!custom) return '';
    return this.buildShareUrls(custom).desktop;
  },

  /**
   * Resolves an API path (e.g. `/api/gmao/state`).
   * In HOST mode (or when no custom remote host is configured), returns the relative path `/api/...`.
   * In LAN_CLIENT mode with a configured remote host, prefixes the remote host base URL.
   */
  resolveApiUrl(apiPath: string): string {
    const cleanPath = apiPath.startsWith('/') ? apiPath : `/${apiPath}`;
    if (this.getNodeMode() === 'LAN_CLIENT') {
      const remoteBase = this.getRemoteHostUrl();
      if (remoteBase) {
        return `${remoteBase.replace(/\/+$/, '')}${cleanPath}`;
      }
    }
    return cleanPath;
  },

  /**
   * Builds canonical Desktop & Mobile URLs for a given IPv4/host and port.
   */
  buildShareUrls(ipOrHost: string, port = 3000): { desktop: string; mobile: string } {
    const cleanHost = String(ipOrHost || '127.0.0.1')
      .trim()
      .replace(/^https?:\/\//i, '')
      .replace(/\/+$/, '');
    const hasPort = /:\d+$/.test(cleanHost);
    const baseUrl = hasPort ? `http://${cleanHost}` : `http://${cleanHost}:${port}`;
    return {
      desktop: baseUrl,
      mobile: `${baseUrl}/#mobile`,
    };
  },

  /**
   * Queries `/api/network/info` on the backend server to obtain real LAN IPv4 addresses,
   * hostname, active SSE client count, and state revision.
   */
  async fetchNetworkHostInfo(): Promise<NetworkHostInfo> {
    const customIp = this.getCustomHostIp();
    try {
      const response = await fetch(this.resolveApiUrl('/api/network/info'), {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'x-gmao-client-origin': 'gmao-web-client',
        },
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = await response.json();
      const cleanCustomIp = customIp.replace(/^https?:\/\//i, '').replace(/:\d+$/, '');
      const effectiveIp =
        (this.getNodeMode() === 'LAN_CLIENT' && cleanCustomIp) ||
        (data.primaryIp && data.primaryIp !== '127.0.0.1' ? data.primaryIp : '') ||
        cleanCustomIp ||
        data.primaryIp ||
        '127.0.0.1';
      const port = Number(data.port) || 3000;
      const urls = this.buildShareUrls(effectiveIp, port);

      return {
        online: true,
        hostname: data.hostname || 'CIOB-HOST-SERVER',
        platform: data.platform || 'linux',
        port,
        primaryIp: effectiveIp,
        interfaces: Array.isArray(data.interfaces) ? data.interfaces : [],
        urls,
        version: typeof data.version === 'number' ? data.version : 1,
        updatedAt: data.updatedAt || null,
        connectedClients: typeof data.connectedClients === 'number' ? data.connectedClients : 0,
      };
    } catch {
      const fallbackHost =
        customIp ||
        (typeof window !== 'undefined' && window.location?.hostname
          ? window.location.hostname
          : '192.168.1.100');
      const fallbackPort =
        typeof window !== 'undefined' && window.location?.port
          ? Number(window.location.port) || 3000
          : 3000;
      return {
        online: false,
        hostname: 'Poste-Local-Autonome',
        port: fallbackPort,
        primaryIp: fallbackHost,
        interfaces: [],
        urls: this.buildShareUrls(fallbackHost, fallbackPort),
        version: 1,
        updatedAt: null,
        connectedClients: 0,
      };
    }
  },

  async fetchHostNetworkInfo(): Promise<NetworkHostInfo> {
    return this.fetchNetworkHostInfo();
  },

  /**
   * Lightweight revision poll (`/api/gmao/revision`) used on window focus or fallback timer.
   */
  async fetchServerRevision(): Promise<{ online: boolean; version: number; updatedAt: string | null }> {
    try {
      const res = await fetch(this.resolveApiUrl('/api/gmao/revision'), {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'x-gmao-client-origin': 'gmao-web-client',
        },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      return {
        online: true,
        version: typeof json?.version === 'number' ? json.version : 1,
        updatedAt: json?.updatedAt || null,
      };
    } catch {
      return { online: false, version: 0, updatedAt: null };
    }
  },

  async checkServerRevision(): Promise<{ online: boolean; version: number; updatedAt: string | null }> {
    return this.fetchServerRevision();
  },

  /**
   * Subscribes to real-time revision updates from the Host via SSE (`/api/gmao/events`)
   * and window focus checks (`P3.4`). Returns an unsubscribe function.
   */
  subscribeToRevisionStream(
    onRevisionUpdate: (event: RevisionEventPayload) => void
  ): () => void {
    if (typeof window === 'undefined') {
      return () => {};
    }

    let eventSource: EventSource | null = null;
    if (typeof EventSource !== 'undefined') {
      try {
        eventSource = new EventSource('/api/gmao/events');
        eventSource.onmessage = (evt) => {
          try {
            const parsed = JSON.parse(evt.data);
            if (parsed && typeof parsed.version === 'number') {
              onRevisionUpdate(parsed);
            }
          } catch {
            // ignore malformed frame
          }
        };
      } catch {
        eventSource = null;
      }
    }

    const handleWindowFocus = async () => {
      const rev = await this.fetchServerRevision();
      if (rev.online && rev.version > 0) {
        onRevisionUpdate({
          type: 'STATE_UPDATED',
          version: rev.version,
          updatedAt: rev.updatedAt || new Date().toISOString(),
        });
      }
    };

    window.addEventListener('focus', handleWindowFocus);

    return () => {
      if (eventSource) {
        try {
          eventSource.close();
        } catch {
          // ignore
        }
      }
      window.removeEventListener('focus', handleWindowFocus);
    };
  },

  /**
   * Generates a deterministic 21x21 QR-like SVG matrix with standard finder patterns,
   * timing patterns, and encoded payload bits for 100% offline LAN URL display.
   */
  generateQrMatrix(payload: string): boolean[][] {
    const size = 21;
    const matrix: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));
    const reserved: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));

    const placeFinderPattern = (rowOffset: number, colOffset: number) => {
      for (let r = -1; r <= 7; r++) {
        for (let c = -1; c <= 7; c++) {
          const rr = rowOffset + r;
          const cc = colOffset + c;
          if (rr < 0 || rr >= size || cc < 0 || cc >= size) continue;
          reserved[rr][cc] = true;
          const inOuter = r >= 0 && r <= 6 && c >= 0 && c <= 6 && (r === 0 || r === 6 || c === 0 || c === 6);
          const inInner = r >= 2 && r <= 4 && c >= 2 && c <= 4;
          matrix[rr][cc] = inOuter || inInner;
        }
      }
    };

    placeFinderPattern(0, 0);
    placeFinderPattern(0, size - 7);
    placeFinderPattern(size - 7, 0);

    // Timing patterns on row 6 and col 6
    for (let i = 8; i < size - 8; i++) {
      reserved[6][i] = true;
      reserved[i][6] = true;
      matrix[6][i] = i % 2 === 0;
      matrix[i][6] = i % 2 === 0;
    }

    // Dark module
    reserved[size - 8][8] = true;
    matrix[size - 8][8] = true;

    // Deterministic bit stream from payload bytes + FNV-1a rolling hash
    const cleanText = String(payload || 'http://127.0.0.1:3000');
    const bits: boolean[] = [];
    let hash = 2166136261;
    for (let i = 0; i < cleanText.length; i++) {
      const code = cleanText.charCodeAt(i);
      hash ^= code;
      hash = Math.imul(hash, 16777619);
      for (let b = 7; b >= 0; b--) {
        bits.push(((code >> b) & 1) === 1);
      }
    }
    for (let extra = 0; extra < 64; extra++) {
      hash ^= extra + cleanText.length;
      hash = Math.imul(hash, 16777619);
      bits.push(((hash >>> (extra % 31)) & 1) === 1);
    }

    let bitIdx = 0;
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (reserved[r][c]) continue;
        const bit = bits[bitIdx % bits.length];
        // Mask pattern ((r + c) % 2 === 0) to prevent large blank areas
        matrix[r][c] = (r + c) % 2 === 0 ? !bit : bit;
        bitIdx++;
      }
    }

    return matrix;
  },

  generateDeterministicQrMatrix(payload: string): boolean[][] {
    return this.generateQrMatrix(payload);
  },
};

export default networkConfigService;
