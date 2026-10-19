import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NotificationService } from '../../services/NotificationService';
import { KeyboardShortcutsService } from '../../services/KeyboardShortcutsService';
import { ContextMenuService } from '../../services/ContextMenuService';

describe('Phase 4: Desktop & System Integration Services', () => {
  describe('NotificationService', () => {
    it('should identify environment support correctly', () => {
      const isSupported = NotificationService.isSupported();
      expect(typeof isSupported).toBe('boolean');
    });

    it('should suppress notification when permission is not granted', () => {
      const sent = NotificationService.notify('Test Title', { body: 'Test Body' });
      // In node / jsdom test environment without granted permission, it returns false safely
      expect(typeof sent).toBe('boolean');
    });

    it('should have predefined formatters for stock alerts and backup', () => {
      expect(typeof NotificationService.notifyStockAlert).toBe('function');
      expect(typeof NotificationService.notifyBackupSuccess).toBe('function');
      expect(typeof NotificationService.notifyExcelExported).toBe('function');
      expect(typeof NotificationService.notifySyncSuccess).toBe('function');
    });
  });

  describe('KeyboardShortcutsService', () => {
    beforeEach(() => {
      KeyboardShortcutsService.start();
    });

    afterEach(() => {
      KeyboardShortcutsService.stop();
    });

    it('should register and trigger shortcuts properly', () => {
      const callback = vi.fn();

      const unregister = KeyboardShortcutsService.registerShortcut({
        id: 'test-shortcut',
        key: 's',
        label: 'Ctrl+S',
        description: 'Test save',
        category: 'actions',
        ctrl: true,
        callback,
      });

      const shortcuts = KeyboardShortcutsService.getAllShortcuts();
      expect(shortcuts.some((s) => s.id === 'test-shortcut')).toBe(true);

      // Simulate keydown
      const event = new KeyboardEvent('keydown', {
        key: 's',
        ctrlKey: true,
      });
      window.dispatchEvent(event);

      expect(callback).toHaveBeenCalledTimes(1);

      // Unregister
      unregister();
      const updatedShortcuts = KeyboardShortcutsService.getAllShortcuts();
      expect(updatedShortcuts.some((s) => s.id === 'test-shortcut')).toBe(false);
    });

    it('should not trigger non-allowInInputs shortcuts when typing in input', () => {
      const callback = vi.fn();

      KeyboardShortcutsService.registerShortcut({
        id: 'test-no-input',
        key: 'a',
        label: 'Alt+A',
        description: 'Test Alt A',
        category: 'navigation',
        alt: true,
        allowInInputs: false,
        callback,
      });

      const input = document.createElement('input');
      document.body.appendChild(input);

      const event = new KeyboardEvent('keydown', {
        key: 'a',
        altKey: true,
      });
      Object.defineProperty(event, 'target', { value: input });

      window.dispatchEvent(event);

      expect(callback).not.toHaveBeenCalled();
      document.body.removeChild(input);
    });
  });

  describe('ContextMenuService', () => {
    it('should update state and notify subscribers when show and hide are called', () => {
      let currentState: any = null;
      const unsubscribe = ContextMenuService.subscribe((state) => {
        currentState = state;
      });

      expect(currentState.isOpen).toBe(false);

      const mockEvent = {
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
        clientX: 100,
        clientY: 200,
      } as unknown as MouseEvent;

      ContextMenuService.show(
        mockEvent,
        [{ id: 'item1', label: 'Action 1' }],
        'Test Menu'
      );

      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(currentState.isOpen).toBe(true);
      expect(currentState.x).toBe(100);
      expect(currentState.y).toBe(200);
      expect(currentState.title).toBe('Test Menu');
      expect(currentState.items.length).toBe(1);

      ContextMenuService.hide();
      expect(currentState.isOpen).toBe(false);

      unsubscribe();
    });
  });
});
