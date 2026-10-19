/**
 * Access Logs & Session Tracking Service
 * Tracks user logins, logouts, session duration, device fingerprint, simulated/resolved client IP, OS, browser, screen resolution.
 */
import { storageService } from './storageService';

const LOGS_STORAGE_KEY = 'gmao_access_logs_v1';
const CURRENT_SESSION_KEY = 'gmao_active_session_tracking';
const MAX_LOGS = 500;

export const accessLogService = {
  /**
   * Get device and environment metadata
   */
  getDeviceDetails() {
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown';
    let browser = 'Navigateur Web';
    let os = 'Système Inconnu';

    // Detect OS
    if (ua.includes('Win')) os = 'Windows PC';
    else if (ua.includes('Mac')) os = 'macOS';
    else if (ua.includes('Linux')) os = 'Linux';
    else if (ua.includes('Android')) os = 'Android Mobile';
    else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS Device';

    // Detect Browser
    if (ua.includes('Edg/')) browser = 'Microsoft Edge';
    else if (ua.includes('Chrome/')) browser = 'Google Chrome';
    else if (ua.includes('Firefox/')) browser = 'Mozilla Firefox';
    else if (ua.includes('Safari/') && !ua.includes('Chrome/')) browser = 'Apple Safari';
    else if (ua.includes('OPR/') || ua.includes('Opera/')) browser = 'Opera';

    // Device screen and language
    const screenRes = typeof window !== 'undefined' ? `${window.screen.width}x${window.screen.height}` : 'N/A';
    const lang = typeof navigator !== 'undefined' ? navigator.language || 'fr' : 'fr';

    // Persistent Device Identifier (Fingerprint ID)
    let deviceId = storageService.getItem('gmao_device_uuid');
    if (!deviceId) {
      deviceId = 'DEV-' + Math.random().toString(36).substring(2, 9).toUpperCase();
      storageService.setItem('gmao_device_uuid', deviceId);
    }

    // Client Hostname/Station Name
    let stationName = storageService.getItem('gmao_station_name');
    if (!stationName) {
      stationName = `Station-${os.split(' ')[0]}-${deviceId.substring(4, 8)}`;
      storageService.setItem('gmao_station_name', stationName);
    }

    return {
      os,
      browser,
      screenRes,
      lang,
      deviceId,
      stationName,
      userAgent: ua,
    };
  },

  /**
   * Record a login event
   */
  async recordLogin(user) {
    const device = this.getDeviceDetails();
    const sessionId = 'SESS-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();
    const loginTime = new Date().toISOString();

    // Best-effort local/public IP fetch (with fallback)
    let clientIp = '127.0.0.1 (Local / Intranet)';
    try {
      // Fast timeout fetch for IP
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1200);
      const res = await fetch('https://api.ipify.org?format=json', { signal: controller.signal }).catch(() => null);
      clearTimeout(timeoutId);
      if (res && res.ok) {
        const data = await res.json();
        if (data && data.ip) {
          clientIp = data.ip;
        }
      }
    } catch {
      // offline fallback
      clientIp = '192.168.1.' + Math.floor(Math.random() * 200 + 10) + ' (Réseau Interne)';
    }

    const logEntry = {
      id: sessionId,
      userId: user?.id || 'store_manager',
      userName: user?.name || 'Responsable du Magasin',
      userRole: user?.role || 'Gestionnaire Principal',
      action: 'LOGIN', // 'LOGIN' | 'LOGOUT' | 'ACTIVE'
      loginTime,
      logoutTime: null,
      durationMinutes: 0,
      ip: clientIp,
      deviceId: device.deviceId,
      stationName: device.stationName,
      os: device.os,
      browser: device.browser,
      screenRes: device.screenRes,
      status: 'En cours',
    };

    // Store active session tracker
    try {
      sessionStorage.setItem(CURRENT_SESSION_KEY, JSON.stringify({
        sessionId,
        loginTime: Date.now(),
        userId: logEntry.userId,
        userName: logEntry.userName,
      }));
    } catch {}

    const logs = this.getLogs();
    logs.unshift(logEntry);
    this.saveLogs(logs);

    return sessionId;
  },

  /**
   * Record a logout event and calculate duration
   */
  recordLogout() {
    let activeSession = null;
    try {
      const raw = sessionStorage.getItem(CURRENT_SESSION_KEY);
      if (raw) activeSession = JSON.parse(raw);
    } catch {}

    const logoutTime = new Date().toISOString();
    const logs = this.getLogs();

    if (activeSession && activeSession.sessionId) {
      const targetIndex = logs.findIndex((l) => l.id === activeSession.sessionId);
      if (targetIndex !== -1) {
        const start = new Date(logs[targetIndex].loginTime).getTime();
        const end = Date.now();
        const durationMin = Math.max(1, Math.round((end - start) / 60000));

        logs[targetIndex].logoutTime = logoutTime;
        logs[targetIndex].durationMinutes = durationMin;
        logs[targetIndex].status = 'Déconnecté';
      }
    } else if (logs.length > 0 && logs[0].status === 'En cours') {
      const start = new Date(logs[0].loginTime).getTime();
      const end = Date.now();
      const durationMin = Math.max(1, Math.round((end - start) / 60000));
      logs[0].logoutTime = logoutTime;
      logs[0].durationMinutes = durationMin;
      logs[0].status = 'Déconnecté';
    }

    try {
      sessionStorage.removeItem(CURRENT_SESSION_KEY);
    } catch {}

    this.saveLogs(logs);
  },

  /**
   * Get all access logs
   */
  getLogs() {
    return storageService.getItem(LOGS_STORAGE_KEY) || [];
  },

  /**
   * Save logs
   */
  saveLogs(logs) {
    const trimmed = (logs || []).slice(0, MAX_LOGS);
    storageService.setItem(LOGS_STORAGE_KEY, trimmed);
  },

  /**
   * Clear all access logs
   */
  clearLogs() {
    storageService.removeItem(LOGS_STORAGE_KEY);
  },
};
