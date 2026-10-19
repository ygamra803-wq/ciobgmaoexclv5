export interface ContextMenuItem {
  id: string;
  label: string;
  icon?: string;
  shortcut?: string;
  disabled?: boolean;
  danger?: boolean;
  separator?: boolean;
  onClick?: () => void;
}

import { Logger } from '../core/logger/LoggerService';

export interface ContextMenuState {
  isOpen: boolean;
  x: number;
  y: number;
  title?: string;
  items: ContextMenuItem[];
}

type ContextMenuListener = (state: ContextMenuState) => void;

export class ContextMenuService {
  private static state: ContextMenuState = {
    isOpen: false,
    x: 0,
    y: 0,
    items: [],
  };

  private static listeners: ContextMenuListener[] = [];

  static show = (
    event: MouseEvent | React.MouseEvent,
    items: ContextMenuItem[],
    title?: string
  ): void => {
    event.preventDefault();
    event.stopPropagation();

    // Prevent rendering out of bounds
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const menuWidth = 220;
    const menuHeight = items.length * 36 + 40;

    let x = event.clientX;
    let y = event.clientY;

    if (x + menuWidth > viewportWidth) {
      x = Math.max(10, viewportWidth - menuWidth - 10);
    }
    if (y + menuHeight > viewportHeight) {
      y = Math.max(10, viewportHeight - menuHeight - 10);
    }

    ContextMenuService.state = {
      isOpen: true,
      x,
      y,
      title,
      items,
    };

    ContextMenuService.notify();
  };

  static hide = (): void => {
    if (!ContextMenuService.state?.isOpen) return;

    ContextMenuService.state = {
      ...ContextMenuService.state,
      isOpen: false,
    };
    ContextMenuService.notify();
  };

  static subscribe = (listener: ContextMenuListener): (() => void) => {
    ContextMenuService.listeners.push(listener);
    listener(ContextMenuService.state);

    return () => {
      ContextMenuService.listeners = ContextMenuService.listeners.filter((l) => l !== listener);
    };
  };

  private static notify = (): void => {
    ContextMenuService.listeners.forEach((listener) => {
      try {
        listener(ContextMenuService.state);
      } catch (err) {
        Logger.error('Error in ContextMenu listener:', err);
      }
    });
  };
}

export const contextMenu = ContextMenuService;
