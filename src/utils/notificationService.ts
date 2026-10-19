/**
 * Service de gestion des notifications Web & Push PWA pour CIOB GMAO v4.
 * Fonctionne de manière sécurisée avec dégradation gracieuse si les notifications
 * ne sont pas supportées par le navigateur ou bloquées dans un contexte iFrame.
 */
export interface GmaoNotificationOptions {
  title: string;
  body: string;
  icon?: string;
  data?: Record<string, any>;
}

export class NotificationService {
  static isSupported(): boolean {
    return typeof window !== 'undefined' && 'Notification' in window;
  }

  static async requestPermission(): Promise<boolean> {
    if (!this.isSupported()) return false;
    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied') return false;
    try {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    } catch {
      return false;
    }
  }

  static async showNotification(options: GmaoNotificationOptions): Promise<boolean> {
    if (!this.isSupported()) return false;
    const permitted = await this.requestPermission();
    if (!permitted) return false;

    try {
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg && typeof reg.showNotification === 'function') {
          await reg.showNotification(options.title, {
            body: options.body,
            icon: options.icon || '/pwa-192x192.png',
            badge: '/pwa-192x192.png',
            data: options.data || {},
          });
          return true;
        }
      }

      new Notification(options.title, {
        body: options.body,
        icon: options.icon || '/pwa-192x192.png',
        data: options.data || {},
      });
      return true;
    } catch {
      return false;
    }
  }

  static async subscribeToPushNotifications(): Promise<PushSubscription | null> {
    if (
      typeof window === 'undefined' ||
      !('serviceWorker' in navigator) ||
      !('PushManager' in window)
    ) {
      return null;
    }

    try {
      const registration = await navigator.serviceWorker.getRegistration();
      if (!registration) return null;

      const applicationServerKey = this.getApplicationServerKey();
      if (!applicationServerKey) return null;

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      });
      return subscription;
    } catch {
      return null;
    }
  }

  static async triggerBackgroundSync(tag = 'sync-gmao-data'): Promise<boolean> {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return false;
    }
    try {
      const registration: any = await navigator.serviceWorker.ready;
      if (registration && registration.sync && typeof registration.sync.register === 'function') {
        await registration.sync.register(tag);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  private static getApplicationServerKey(): Uint8Array | null {
    try {
      const vapidPublicKey = import.meta.env?.VITE_VAPID_PUBLIC_KEY;
      if (!vapidPublicKey) return null;
      return this.urlBase64ToUint8Array(vapidPublicKey);
    } catch {
      return null;
    }
  }

  public static urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = atob(base64);
    return new Uint8Array([...rawData].map((c) => c.charCodeAt(0)));
  }
}

export default NotificationService;
