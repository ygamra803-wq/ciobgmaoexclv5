import { describe, it, expect, beforeEach } from 'vitest';
import { errorTracker } from '../../services/ErrorTrackingService';
import { analytics } from '../../services/AnalyticsService';

describe('Phase 3: Error Tracking & Usage Analytics Systems', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    errorTracker.clearReports();
    analytics.clearEvents();
  });

  describe('ErrorTrackingService (Offline Error Tracking)', () => {
    it('should initialize and capture breadcrumbs', () => {
      errorTracker.addBreadcrumb('ui', 'Clicked export button', 'info', { format: 'xlsx' });
      const report = errorTracker.captureException(new Error('Simulated network error'), {
        context: 'DirectSave',
      });

      expect(report).toBeDefined();
      expect(report.name).toBe('Error');
      expect(report.message).toBe('Simulated network error');
      expect(report.metadata?.context).toBe('DirectSave');
      expect(report.breadcrumbs.length).toBeGreaterThanOrEqual(1);
      expect(report.breadcrumbs.some((b) => b.message === 'Clicked export button')).toBe(true);
    });

    it('should persist and retrieve error reports from localStorage', () => {
      errorTracker.captureException(new TypeError('Invalid stock reference: null'));
      errorTracker.captureException(new RangeError('Quantity out of bounds'));

      const reports = errorTracker.getReports();
      expect(reports.length).toBe(2);
      expect(reports[0].name).toBe('RangeError');
      expect(reports[1].name).toBe('TypeError');
    });

    it('should export reports as formatted JSON and allow clearing', () => {
      errorTracker.captureException(new Error('Syntax failure'));
      const jsonOutput = errorTracker.exportReportsAsJson();
      const parsed = JSON.parse(jsonOutput);

      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed[0].message).toBe('Syntax failure');

      errorTracker.clearReports();
      expect(errorTracker.getReports().length).toBe(0);
    });
  });

  describe('AnalyticsService (Offline Usage Telemetry)', () => {
    it('should track business actions with persistent session IDs', () => {
      analytics.track('app_started', 'system', { mode: 'standalone' });
      analytics.track('navigation_tab_changed', 'navigation', { fromTab: 'dashboard', toTab: 'stock' });
      analytics.track('excel_exported', 'excel', { rows: 120 });

      const events = analytics.getEvents();
      expect(events.length).toBe(3);
      expect(events[0].name).toBe('excel_exported');
      expect(events[1].name).toBe('navigation_tab_changed');
      expect(events[2].name).toBe('app_started');

      // Check session ID consistency
      expect(events[0].sessionId).toBeDefined();
      expect(events[0].sessionId).toBe(events[1].sessionId);
    });

    it('should aggregate event counts by category', () => {
      analytics.track('stock_added', 'stock');
      analytics.track('stock_alert_triggered', 'stock');
      analytics.track('excel_direct_save', 'excel');
      analytics.track('tab_viewed', 'navigation');

      const counts = analytics.getEventCountsByCategory();
      expect(counts.stock).toBe(2);
      expect(counts.excel).toBe(1);
      expect(counts.navigation).toBe(1);
    });

    it('should allow clearing telemetry events', () => {
      analytics.track('test_action', 'system');
      expect(analytics.getEvents().length).toBe(1);

      analytics.clearEvents();
      expect(analytics.getEvents().length).toBe(0);
    });
  });
});
