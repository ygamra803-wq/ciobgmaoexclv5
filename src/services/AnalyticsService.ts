/**
 * Offline-First Usage Analytics Service
 * Tracks application metrics, navigation flow, and business actions
 * Persists locally in localStorage without relying on external network servers
 */
import { Logger } from '../core/logger/LoggerService';

export interface AnalyticsEvent {
  id: string;
  name: string;
  category: 'navigation' | 'stock' | 'excel' | 'system' | 'auth';
  timestamp: string;
  sessionId: string;
  properties: Record<string, any>;
}

export class AnalyticsService {
  private static instance: AnalyticsService;
  private readonly storageKey = 'gmao_analytics_events';
  private readonly maxStoredEvents = 200;
  private sessionId: string;
  private isEnabled = true;

  private constructor() {
    this.sessionId = this.getOrCreateSessionId();
  }

  public static getInstance(): AnalyticsService {
    if (!AnalyticsService.instance) {
      AnalyticsService.instance = new AnalyticsService();
    }
    return AnalyticsService.instance;
  }

  private getOrCreateSessionId(): string {
    try {
      let id = sessionStorage.getItem('gmao_session_id');
      if (!id) {
        id = `sess-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
        sessionStorage.setItem('gmao_session_id', id);
      }
      return id;
    } catch {
      return `sess-${Date.now()}`;
    }
  }

  public track(
    name: string,
    category: AnalyticsEvent['category'] = 'system',
    properties: Record<string, any> = {}
  ): void {
    if (!this.isEnabled) return;

    const event: AnalyticsEvent = {
      id: `ev-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name,
      category,
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
      properties,
    };

    this.saveEvent(event);
    Logger.debug(`[Analytics] ${category}:${name}`, properties);
  }

  public getEvents(): AnalyticsEvent[] {
    try {
      const data = localStorage.getItem(this.storageKey);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  public getEventCountsByCategory(): Record<string, number> {
    const events = this.getEvents();
    const counts: Record<string, number> = {
      navigation: 0,
      stock: 0,
      excel: 0,
      system: 0,
      auth: 0,
    };

    for (const ev of events) {
      counts[ev.category] = (counts[ev.category] || 0) + 1;
    }

    return counts;
  }

  public clearEvents(): void {
    try {
      localStorage.removeItem(this.storageKey);
    } catch {
      /* ignore */
    }
  }

  public setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
  }

  private saveEvent(event: AnalyticsEvent): void {
    try {
      const events = this.getEvents();
      events.unshift(event);
      const trimmed = events.slice(0, this.maxStoredEvents);
      localStorage.setItem(this.storageKey, JSON.stringify(trimmed));
    } catch (e) {
      Logger.warn('Failed to save analytics event', e);
    }
  }
}

export const analytics = AnalyticsService.getInstance();
