import { Logger } from '../core/logger/LoggerService';

export interface NotificationOptions {
  body?: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: Record<string, unknown>;
  requireInteraction?: boolean;
  silent?: boolean;
  onClick?: (event: Event) => void;
  onClose?: (event: Event) => void;
}

export class NotificationService {
  private static permission: NotificationPermission =
    typeof window !== 'undefined' && 'Notification' in window
      ? Notification.permission
      : 'default';

  static isSupported(): boolean {
    return typeof window !== 'undefined' && 'Notification' in window;
  }

  static async requestPermission(): Promise<NotificationPermission> {
    if (!this.isSupported()) {
      Logger.warn('Web Notifications API is not supported in this environment.', 'NotificationService');
      return 'denied';
    }

    try {
      const perm = await Notification.requestPermission();
      this.permission = perm;
      Logger.info(`Notification permission status: ${perm}`, 'NotificationService');
      return perm;
    } catch (err) {
      Logger.error('Failed to request notification permission:', 'NotificationService', err);
      return 'denied';
    }
  }

  static canNotify(): boolean {
    return this.isSupported() && Notification.permission === 'granted';
  }

  static notify(title: string, options: NotificationOptions = {}): boolean {
    if (!this.canNotify()) {
      Logger.debug(`Notification suppressed (Permission: ${this.permission}): ${title}`, 'NotificationService');
      return false;
    }

    try {
      const notification = new Notification(title, {
        body: options.body || '',
        icon: options.icon || '/favicon.ico',
        badge: options.badge || '/favicon.ico',
        tag: options.tag,
        data: options.data,
        requireInteraction: options.requireInteraction || false,
        silent: options.silent || false,
      });

      if (options.onClick) {
        notification.onclick = (e) => {
          window.focus();
          options.onClick?.(e);
          notification.close();
        };
      }

      if (options.onClose) {
        notification.onclose = options.onClose;
      }

      return true;
    } catch (err) {
      Logger.error('Error triggering notification:', 'NotificationService', err);
      return false;
    }
  }

  static notifyStockAlert(item: { ref?: string; designation?: string; stockActuel?: number; seuil?: number }): boolean {
    const name = item.designation || item.ref || 'Article';
    return this.notify('⚠️ Alerte Seuil Critique de Stock', {
      body: `L'article [${item.ref || ''}] ${name} a un stock actuel de ${item.stockActuel ?? 0} (Seuil: ${item.seuil ?? 0}).`,
      tag: `stock-alert-${item.ref || 'item'}`,
      requireInteraction: true,
      data: { type: 'stock_alert', item },
    });
  }

  static notifyBackupSuccess(): boolean {
    return this.notify('💾 Sauvegarde Automatique GMAO', {
      body: `Sauvegarde de sécurité locale effectuée avec succès à ${new Date().toLocaleTimeString()}.`,
      tag: 'backup-success',
      silent: true,
    });
  }

  static notifyExcelExported(fileName: string): boolean {
    return this.notify('📊 Export Excel Terminé', {
      body: `Le classeur GMAO "${fileName}" a été généré et téléchargé avec succès.`,
      tag: 'excel-export',
    });
  }

  static notifySyncSuccess(count: number): boolean {
    return this.notify('🔄 Synchronisation Terminée', {
      body: `${count} élément(s) ont été synchronisés avec la base de données locale.`,
      tag: 'sync-complete',
    });
  }
}

export const notificationService = NotificationService;
