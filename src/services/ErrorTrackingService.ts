/**
 * Offline-First Error Tracking Service
 * Captures, buffers, and persists runtime errors and diagnostic reports
 * Designed for offline Windows & PWA operation with optional remote syncing
 */
import { Logger } from '../core/logger/LoggerService';

export interface Breadcrumb {
  timestamp: string;
  category: string;
  message: string;
  level?: 'info' | 'warning' | 'error';
  data?: Record<string, any>;
}

export interface ErrorReport {
  id: string;
  timestamp: string;
  message: string;
  name: string;
  stack?: string;
  componentStack?: string;
  url: string;
  userAgent: string;
  breadcrumbs: Breadcrumb[];
  metadata?: Record<string, any>;
  appVersion: string;
}

export class ErrorTrackingService {
  private static instance: ErrorTrackingService;
  private readonly storageKey = 'gmao_error_reports';
  private readonly maxReports = 50;
  private readonly maxBreadcrumbs = 25;
  private breadcrumbs: Breadcrumb[] = [];
  private isInitialized = false;

  private constructor() {}

  public static getInstance(): ErrorTrackingService {
    if (!ErrorTrackingService.instance) {
      ErrorTrackingService.instance = new ErrorTrackingService();
    }
    return ErrorTrackingService.instance;
  }

  public init(): void {
    if (this.isInitialized || typeof window === 'undefined') return;
    this.isInitialized = true;

    // Global uncaught error listener
    window.addEventListener('error', (event: ErrorEvent) => {
      this.captureException(event.error || new Error(event.message), {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      });
    });

    // Global unhandled promise rejection listener
    window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const error = reason instanceof Error ? reason : new Error(String(reason || 'Unhandled Promise Rejection'));
      this.captureException(error, { type: 'unhandledrejection' });
    });

    this.addBreadcrumb('system', 'ErrorTrackingService initialized', 'info');
  }

  public addBreadcrumb(category: string, message: string, level: Breadcrumb['level'] = 'info', data?: Record<string, any>): void {
    const breadcrumb: Breadcrumb = {
      timestamp: new Date().toISOString(),
      category,
      message,
      level,
      data,
    };

    this.breadcrumbs.push(breadcrumb);
    if (this.breadcrumbs.length > this.maxBreadcrumbs) {
      this.breadcrumbs.shift();
    }
  }

  public captureException(error: Error | any, metadata: Record<string, any> = {}): ErrorReport {
    const report: ErrorReport = {
      id: `err-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      name: error?.name || 'Error',
      message: error?.message || String(error),
      stack: error?.stack,
      componentStack: metadata?.componentStack,
      url: typeof window !== 'undefined' ? window.location.href : '',
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      breadcrumbs: [...this.breadcrumbs],
      metadata,
      appVersion: '1.0.0',
    };

    this.saveReport(report);
    Logger.error(`[ErrorTracking] Captured ${report.name}: ${report.message}`, { id: report.id });
    return report;
  }

  public captureMessage(message: string, level: Breadcrumb['level'] = 'info', metadata: Record<string, any> = {}): void {
    this.addBreadcrumb('manual', message, level, metadata);
  }

  public getReports(): ErrorReport[] {
    try {
      const data = localStorage.getItem(this.storageKey);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  public clearReports(): void {
    try {
      localStorage.removeItem(this.storageKey);
      this.breadcrumbs = [];
    } catch {
      /* ignore */
    }
  }

  public exportReportsAsJson(): string {
    const reports = this.getReports();
    return JSON.stringify(reports, null, 2);
  }

  private saveReport(report: ErrorReport): void {
    try {
      const reports = this.getReports();
      reports.unshift(report);
      const trimmed = reports.slice(0, this.maxReports);
      localStorage.setItem(this.storageKey, JSON.stringify(trimmed));
    } catch (e) {
      Logger.warn('Failed to save error report to localStorage', e);
    }
  }
}

export const errorTracker = ErrorTrackingService.getInstance();
