import { describe, it, expect, vi } from 'vitest';
import {
  confirmAction,
  resolveConfirm,
  subscribeConfirm,
  type ConfirmState,
} from '../../utils/confirmAction';

describe('Unified ConfirmAction Dialog Utility', () => {
  it('correctly notifies subscribers with dialog options', async () => {
    let capturedState: ConfirmState | null = null;
    const unsubscribe = subscribeConfirm((state) => {
      capturedState = state;
    });

    const confirmPromise = confirmAction({
      title: 'Action Critique',
      message: 'Voulez-vous supprimer cet élément ?',
      confirmText: 'Oui, Supprimer',
      cancelText: 'Non, Annuler',
      variant: 'danger',
    });

    expect(capturedState).not.toBeNull();
    expect(capturedState?.isOpen).toBe(true);
    expect(capturedState?.options.title).toBe('Action Critique');
    expect(capturedState?.options.message).toBe('Voulez-vous supprimer cet élément ?');
    expect(capturedState?.options.isDestructive).toBe(true);

    // Resolve as confirmed
    resolveConfirm(true);
    const result = await confirmPromise;
    expect(result).toBe(true);
    expect(capturedState?.isOpen).toBe(false);

    unsubscribe();
  });

  it('correctly resolves to false on cancellation', async () => {
    let capturedState: ConfirmState | null = null;
    const unsubscribe = subscribeConfirm((state) => {
      capturedState = state;
    });

    const confirmPromise = confirmAction('Simple confirmation message');

    expect(capturedState?.isOpen).toBe(true);
    expect(capturedState?.options.message).toBe('Simple confirmation message');

    // Resolve as cancelled
    resolveConfirm(false);
    const result = await confirmPromise;
    expect(result).toBe(false);
    expect(capturedState?.isOpen).toBe(false);

    unsubscribe();
  });

  it('automatically flags destructive keywords in message string', async () => {
    let capturedState: ConfirmState | null = null;
    const unsubscribe = subscribeConfirm((state) => {
      capturedState = state;
    });

    const promise = confirmAction('Supprimer la tâche définitivement');
    expect(capturedState?.options.isDestructive).toBe(true);
    resolveConfirm(false);
    await promise;

    unsubscribe();
  });
});
