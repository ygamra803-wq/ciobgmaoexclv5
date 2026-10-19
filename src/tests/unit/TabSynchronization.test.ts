import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TabSyncService, SYNC_CHANNELS, SYNC_MESSAGE_TYPES } from '../../services/TabSyncService';
import { STORAGE_KEYS } from '../../infrastructure/persistence/storageKeys';

describe('TabSynchronization (Multi-Tab & Multi-Window Sync Architecture)', () => {
  let originalBroadcastChannel: any;

  beforeEach(() => {
    originalBroadcastChannel = globalThis.BroadcastChannel;
  });

  afterEach(() => {
    globalThis.BroadcastChannel = originalBroadcastChannel;
    vi.restoreAllMocks();
  });

  it('generates distinct unique tab IDs for separate tab sessions', () => {
    const serviceA = new TabSyncService();
    const serviceB = new TabSyncService();

    expect(serviceA.getTabId()).toBeDefined();
    expect(serviceB.getTabId()).toBeDefined();
    expect(serviceA.getTabId()).not.toBe('');

    serviceA.dispose();
    serviceB.dispose();
  });

  it('broadcasts state to primary and legacy channels', () => {
    const postMessageSpy = vi.fn();

    class MockChannel {
      name: string;
      onmessage: any = null;
      constructor(name: string) {
        this.name = name;
      }
      postMessage(data: any) {
        postMessageSpy(this.name, data);
      }
      close() {}
    }

    globalThis.BroadcastChannel = MockChannel as any;

    const service = new TabSyncService();
    const mockState = {
      machines: [{ id: 'M-101', nom: 'Presse 100T' }],
      rawStock: [{ id: 'S-1', ref: 'ROUL-01', stockActuel: 50 }],
    };

    service.broadcastState(mockState);

    expect(postMessageSpy).toHaveBeenCalledWith(
      SYNC_CHANNELS.PRIMARY,
      expect.objectContaining({
        type: SYNC_MESSAGE_TYPES.STATE_UPDATE,
        senderTabId: service.getTabId(),
        payload: mockState,
      })
    );

    expect(postMessageSpy).toHaveBeenCalledWith(
      SYNC_CHANNELS.LEGACY,
      expect.objectContaining({
        type: SYNC_MESSAGE_TYPES.LEGACY_STATE_UPDATE,
        senderTabId: service.getTabId(),
        state: mockState,
      })
    );

    service.dispose();
  });

  it('performs echo suppression when receiving messages from self tabId', () => {
    let messageHandler: any;

    class MockChannel {
      name: string;
      constructor(name: string) {
        this.name = name;
      }
      set onmessage(fn: any) {
        if (this.name === SYNC_CHANNELS.PRIMARY) {
          messageHandler = fn;
        }
      }
      postMessage() {}
      close() {}
    }

    globalThis.BroadcastChannel = MockChannel as any;

    const service = new TabSyncService();
    const subscriberSpy = vi.fn();
    service.subscribe(subscriberSpy);

    // 1. Message from SELF -> must be suppressed
    messageHandler({
      data: {
        type: SYNC_MESSAGE_TYPES.STATE_UPDATE,
        senderTabId: service.getTabId(), // SAME TAB
        timestamp: Date.now(),
        payload: { machines: [{ id: 'ECHO_TEST' }] },
      },
    });

    expect(subscriberSpy).not.toHaveBeenCalled();

    // 2. Message from ANOTHER TAB -> must be delivered
    const remotePayload = { machines: [{ id: 'REMOTE_MACHINE_1' }] };
    messageHandler({
      data: {
        type: SYNC_MESSAGE_TYPES.STATE_UPDATE,
        senderTabId: 'other_tab_xyz',
        timestamp: Date.now(),
        payload: remotePayload,
      },
    });

    expect(subscriberSpy).toHaveBeenCalledTimes(1);
    expect(subscriberSpy).toHaveBeenCalledWith(
      remotePayload,
      true,
      expect.objectContaining({ senderTabId: 'other_tab_xyz' })
    );

    service.dispose();
  });

  it('delivers granular slice broadcasts cleanly', () => {
    let messageHandler: any;

    class MockChannel {
      name: string;
      constructor(name: string) {
        this.name = name;
      }
      set onmessage(fn: any) {
        if (this.name === SYNC_CHANNELS.PRIMARY) {
          messageHandler = fn;
        }
      }
      postMessage() {}
      close() {}
    }

    globalThis.BroadcastChannel = MockChannel as any;

    const service = new TabSyncService();
    const subscriberSpy = vi.fn();
    service.subscribe(subscriberSpy);

    messageHandler({
      data: {
        type: SYNC_MESSAGE_TYPES.SLICE_UPDATE,
        senderTabId: 'tab_external_2',
        timestamp: Date.now(),
        slice: 'preventiveTasks',
        payload: [{ id: 'P-1', titre: 'Graissage Mensuel' }],
      },
    });

    expect(subscriberSpy).toHaveBeenCalledWith(
      { preventiveTasks: [{ id: 'P-1', titre: 'Graissage Mensuel' }] },
      true,
      expect.anything()
    );

    service.dispose();
  });

  it('handles StorageEvent fallback for full state and granular domain keys', () => {
    const service = new TabSyncService();
    const subscriberSpy = vi.fn();
    service.subscribe(subscriberSpy);

    // 1. Granular storage key change (e.g. machines updated in another tab)
    const remoteMachines = [{ id: 'M-50', nom: 'Compresseur Atlas' }];
    const storageEvent = new StorageEvent('storage', {
      key: STORAGE_KEYS.MACHINES,
      newValue: JSON.stringify(remoteMachines),
    });

    window.dispatchEvent(storageEvent);

    expect(subscriberSpy).toHaveBeenCalledWith(
      { machines: remoteMachines },
      false,
      expect.objectContaining({ type: 'STORAGE_EVENT' })
    );

    // 2. Full state snapshot key change
    const fullSnapshot = {
      types: ['MECANIQUE', 'ELECTRIQUE'],
      rawStock: [{ id: 'S-99' }],
    };
    const fullSnapshotEvent = new StorageEvent('storage', {
      key: STORAGE_KEYS.FULL_STATE_SNAPSHOT,
      newValue: JSON.stringify(fullSnapshot),
    });

    window.dispatchEvent(fullSnapshotEvent);

    expect(subscriberSpy).toHaveBeenCalledWith(
      fullSnapshot,
      false,
      expect.objectContaining({ type: 'STORAGE_EVENT' })
    );

    service.dispose();
  });

  it('stops receiving updates after unsubscribe', () => {
    const service = new TabSyncService();
    const subscriberSpy = vi.fn();
    const unsubscribe = service.subscribe(subscriberSpy);

    unsubscribe();

    const storageEvent = new StorageEvent('storage', {
      key: STORAGE_KEYS.MACHINES,
      newValue: JSON.stringify([{ id: 'M-1' }]),
    });
    window.dispatchEvent(storageEvent);

    expect(subscriberSpy).not.toHaveBeenCalled();

    service.dispose();
  });
});
