import { Logger } from '../core/logger/LoggerService';

export interface ShortcutDefinition {
  id: string;
  key: string; // e.g. 's', 'n', 'f', '1', 'Escape'
  label: string;
  description: string;
  category: 'navigation' | 'actions' | 'system';
  ctrl?: boolean;
  alt?: boolean;
  shift?: boolean;
  meta?: boolean;
  preventDefault?: boolean;
  allowInInputs?: boolean;
  callback: (event: KeyboardEvent) => void;
}

export class KeyboardShortcutsService {
  private static shortcuts: Map<string, ShortcutDefinition> = new Map();
  private static isListening = false;
  private static listeners: Array<(shortcuts: ShortcutDefinition[]) => void> = [];

  static start(): void {
    if (this.isListening || typeof window === 'undefined') return;

    window.addEventListener('keydown', this.handleKeyDown);
    this.isListening = true;
    Logger.debug('KeyboardShortcutsService event listener active.', 'KeyboardShortcuts');
  }

  static stop(): void {
    if (!this.isListening || typeof window === 'undefined') return;

    window.removeEventListener('keydown', this.handleKeyDown);
    this.isListening = false;
  }

  static registerShortcut(shortcut: ShortcutDefinition): () => void {
    const shortcutId = shortcut.id;
    this.shortcuts.set(shortcutId, shortcut);
    this.notifyListeners();

    if (!this.isListening) {
      this.start();
    }

    return () => this.unregisterShortcut(shortcutId);
  }

  static unregisterShortcut(shortcutId: string): void {
    if (this.shortcuts.has(shortcutId)) {
      this.shortcuts.delete(shortcutId);
      this.notifyListeners();
    }
  }

  static getAllShortcuts(): ShortcutDefinition[] {
    return Array.from(this.shortcuts.values());
  }

  static subscribe(callback: (shortcuts: ShortcutDefinition[]) => void): () => void {
    this.listeners.push(callback);
    callback(this.getAllShortcuts());

    return () => {
      this.listeners = this.listeners.filter((l) => l !== callback);
    };
  }

  private static notifyListeners(): void {
    const list = this.getAllShortcuts();
    this.listeners.forEach((listener) => {
      try {
        listener(list);
      } catch (err) {
        Logger.error('Error notifying shortcut listener:', 'KeyboardShortcuts', err);
      }
    });
  }

  private static handleKeyDown = (event: KeyboardEvent): void => {
    // Check if target is an editable input
    const target = event.target as HTMLElement | null;
    const isEditingInput =
      target &&
      (target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable);

    const pressedKey = event.key.toLowerCase();
    const ctrlOrMeta = event.ctrlKey || event.metaKey;

    for (const shortcut of this.shortcuts.values()) {
      const matchKey = shortcut.key.toLowerCase() === pressedKey;
      const matchCtrl = (shortcut.ctrl ?? false) === ctrlOrMeta;
      const matchAlt = (shortcut.alt ?? false) === event.altKey;
      const matchShift = (shortcut.shift ?? false) === event.shiftKey;

      if (matchKey && matchCtrl && matchAlt && matchShift) {
        // If typing in an input and this shortcut doesn't explicitly allow inputs (like Escape or Ctrl+S), skip
        if (isEditingInput && !shortcut.allowInInputs) {
          continue;
        }

        if (shortcut.preventDefault !== false) {
          event.preventDefault();
        }

        try {
          shortcut.callback(event);
        } catch (err) {
          Logger.error(`Error executing shortcut callback [${shortcut.id}]:`, 'KeyboardShortcuts', err);
        }
        break;
      }
    }
  };
}

export const keyboardShortcuts = KeyboardShortcutsService;
