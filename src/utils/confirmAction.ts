export interface ConfirmDialogOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
  isDestructive?: boolean;
}

type ConfirmResolver = (confirmed: boolean) => void;

export interface ConfirmState {
  isOpen: boolean;
  options: ConfirmDialogOptions;
  resolve: ConfirmResolver | null;
}

let currentState: ConfirmState = {
  isOpen: false,
  options: { message: '' },
  resolve: null,
};

const listeners = new Set<(state: ConfirmState) => void>();

export function subscribeConfirm(listener: (state: ConfirmState) => void): () => void {
  listeners.add(listener);
  listener(currentState);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Unified UI-Safe Confirmation Action (iFrame safe, Promise-based).
 * Replaces native window.confirm with an accessible, in-app modal dialog.
 */
export function confirmAction(
  optionsOrMessage: ConfirmDialogOptions | string
): Promise<boolean> {
  const options: ConfirmDialogOptions =
    typeof optionsOrMessage === 'string'
      ? {
          message: optionsOrMessage,
          isDestructive:
            optionsOrMessage.toLowerCase().includes('supprimer') ||
            optionsOrMessage.toLowerCase().includes('vider') ||
            optionsOrMessage.toLowerCase().includes('effacer') ||
            optionsOrMessage.toLowerCase().includes('écraser') ||
            optionsOrMessage.toLowerCase().includes('réinitialiser'),
        }
      : {
          ...optionsOrMessage,
          isDestructive:
            optionsOrMessage.isDestructive ??
            (optionsOrMessage.variant === 'danger' ||
              optionsOrMessage.message.toLowerCase().includes('supprimer') ||
              optionsOrMessage.message.toLowerCase().includes('vider') ||
              optionsOrMessage.message.toLowerCase().includes('effacer') ||
              optionsOrMessage.message.toLowerCase().includes('écraser') ||
              optionsOrMessage.message.toLowerCase().includes('réinitialiser')),
        };

  // Headless / non-browser test environment fallback:
  // If no React ConfirmDialog is mounted (e.g. unit tests running in Node/jsdom without mounting the full App tree)
  if (listeners.size === 0) {
    if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
      try {
        return Promise.resolve(window.confirm(options.message));
      } catch {
        return Promise.resolve(true);
      }
    }
    return Promise.resolve(true);
  }

  return new Promise<boolean>((resolve) => {
    if (currentState.resolve) {
      currentState.resolve(false);
    }

    currentState = {
      isOpen: true,
      options,
      resolve,
    };

    listeners.forEach((listener) => {
      try {
        listener(currentState);
      } catch (err) {
        console.error('[confirmAction] listener error:', err);
      }
    });
  });
}

export function resolveConfirm(confirmed: boolean): void {
  if (currentState.resolve) {
    currentState.resolve(confirmed);
  }
  currentState = {
    isOpen: false,
    options: { message: '' },
    resolve: null,
  };
  listeners.forEach((listener) => {
    try {
      listener(currentState);
    } catch (err) {
      console.error('[confirmAction] listener error:', err);
    }
  });
}

export function useConfirm() {
  return { confirm: confirmAction };
}
