import { stockIndexStore } from './StockIndexStore';
import type { MovementDelta } from './IncrementalStockIndex';
import { storageService } from '../utils/storageService';
import { Logger } from '../core/logger/LoggerService';
import { STORAGE_KEYS } from '../infrastructure/persistence/storageKeys';

export interface MovementEntity {
  id?: string | number;
  code_bon?: string;
  ref: string;
  quantite: number | string;
  type: string;
  date?: string;
  technicien?: string;
  id_zone?: string;
  id_machine_registered?: string;
  operation?: string;
}

interface RawMovementShape {
  ref?: unknown;
  code_article?: unknown;
  'Référence'?: unknown;
  Reference?: unknown;
  type?: unknown;
  'Type (Entrée/Sortie)'?: unknown;
  quantite?: unknown;
  quantity?: unknown;
  'Quantité'?: unknown;
}

function toMovementDelta(raw: RawMovementShape | null | undefined): MovementDelta {
  const ref = String(raw?.ref ?? raw?.code_article ?? raw?.['Référence'] ?? raw?.Reference ?? '');
  const type = String(raw?.type ?? raw?.['Type (Entrée/Sortie)'] ?? '');
  const rawQty =
    raw?.quantite != null ? raw.quantite : raw?.quantity != null ? raw.quantity : raw?.['Quantité'];
  return {
    ref,
    type,
    quantity: Number(rawQty) || 0,
  };
}

const channel =
  typeof BroadcastChannel !== 'undefined'
    ? new BroadcastChannel('gmao_cache_sync')
    : null;

/**
 * Incremental stock ledger coordinator and multi-tab `BroadcastChannel` synchronizer.
 * Routes delta additions/edits/rollbacks exclusively through `stockIndexStore.index`
 * to uphold `stockActuel = stockInitial + entrees - sorties`.
 */
export class MovementRepository {
  private static channelBound = false;

  constructor() {
    if (!MovementRepository.channelBound && channel) {
      channel.addEventListener('message', this.onRemoteDelta);
      MovementRepository.channelBound = true;
    }
  }

  dispose(): void {
    if (MovementRepository.channelBound && channel) {
      channel.removeEventListener('message', this.onRemoteDelta);
      MovementRepository.channelBound = false;
    }
  }

  add(m: MovementEntity): void {
    const delta: MovementDelta = {
      ref: m.ref,
      type: m.type,
      quantity: Number(m.quantite) || 0,
    };
    stockIndexStore.index.applyDelta(delta);
    stockIndexStore.notifyRef(m.ref);
    stockIndexStore.notifyAll();

    channel?.postMessage({
      kind: 'DELTA',
      ref: m.ref,
      type: m.type,
      qty: delta.quantity,
      sign: 1,
    });
  }

  edit(oldM: MovementEntity, newM: MovementEntity): void {
    const oldQty = Number(oldM.quantite) || 0;
    const newQty = Number(newM.quantite) || 0;

    if (oldM.ref === newM.ref) {
      stockIndexStore.index.updateDelta({
        ref: oldM.ref,
        oldType: oldM.type,
        oldQty,
        newType: newM.type,
        newQty,
      });
    } else {
      // Ref changed: rollback old ref and apply to new ref
      stockIndexStore.index.rollbackDelta({
        ref: oldM.ref,
        type: oldM.type,
        quantity: oldQty,
      });
      stockIndexStore.index.applyDelta({
        ref: newM.ref,
        type: newM.type,
        quantity: newQty,
      });
    }

    stockIndexStore.notifyRef(oldM.ref);
    if (oldM.ref !== newM.ref) {
      stockIndexStore.notifyRef(newM.ref);
    }
    stockIndexStore.notifyAll();

    channel?.postMessage({
      kind: 'UPDATE',
      ref: oldM.ref,
      newRef: newM.ref,
      oldType: oldM.type,
      oldQty,
      newType: newM.type,
      newQty,
    });
  }

  remove(m: MovementEntity): void {
    const delta: MovementDelta = {
      ref: m.ref,
      type: m.type,
      quantity: Number(m.quantite) || 0,
    };
    stockIndexStore.index.rollbackDelta(delta);
    stockIndexStore.notifyRef(m.ref);
    stockIndexStore.notifyAll();

    channel?.postMessage({
      kind: 'DELTA',
      ref: m.ref,
      type: m.type,
      qty: delta.quantity,
      sign: -1,
    });
  }

  /** Rebuilds the entire in-memory stock index from authoritative persisted movements and initial balances. */
  bulkReplace(movements: ReadonlyArray<MovementEntity | RawMovementShape>, initialStocks?: Map<string, number>): void {
    const list = Array.isArray(movements) ? movements : [];
    const deltas: MovementDelta[] = list.map((m) => toMovementDelta(m as RawMovementShape));
    stockIndexStore.index.rebuild(deltas, initialStocks);
    stockIndexStore.markHydrated();
    stockIndexStore.notifyAll();

    channel?.postMessage({ kind: 'REBUILD' });
  }

  private onRemoteDelta = async (e: MessageEvent) => {
    const msg = e.data;
    if (!msg) return;

    if (msg.kind === 'DELTA') {
      stockIndexStore.index.applyDelta({
        ref: msg.ref,
        type: msg.type,
        quantity: msg.qty * msg.sign,
      });
      stockIndexStore.notifyRef(msg.ref);
      stockIndexStore.notifyAll();
    } else if (msg.kind === 'UPDATE') {
      const newRef = msg.newRef || msg.ref;
      if (msg.ref === newRef) {
        stockIndexStore.index.updateDelta(msg);
      } else {
        stockIndexStore.index.rollbackDelta({
          ref: msg.ref,
          type: msg.oldType,
          quantity: msg.oldQty,
        });
        stockIndexStore.index.applyDelta({
          ref: newRef,
          type: msg.newType,
          quantity: msg.newQty,
        });
      }
      stockIndexStore.notifyRef(msg.ref);
      if (msg.ref !== newRef) {
        stockIndexStore.notifyRef(newRef);
      }
      stockIndexStore.notifyAll();
    } else if (msg.kind === 'REBUILD') {
      try {
        const rawMovements = storageService.getItem(STORAGE_KEYS.MOUVEMENTS);
        const savedMovements = Array.isArray(rawMovements) ? rawMovements : [];
        const deltas: MovementDelta[] = savedMovements.map((m) =>
          toMovementDelta(m as RawMovementShape)
        );
        const rawStockList = storageService.getItem(STORAGE_KEYS.RAW_STOCK);
        let initialStockMap: Map<string, number> | undefined;
        if (Array.isArray(rawStockList)) {
          initialStockMap = new Map<string, number>();
          for (const s of rawStockList) {
            const sRef = String(s?.ref || s?.Ref || '').trim();
            if (sRef) {
              initialStockMap.set(sRef, Number(s.stockInitial) || 0);
            }
          }
        }
        stockIndexStore.index.rebuild(deltas, initialStockMap);
        stockIndexStore.markHydrated();
        stockIndexStore.notifyAll();
      } catch (err) {
        Logger.error('[MovementRepository] Failed to handle remote REBUILD message:', err);
      }
    }
  };
}

export const movementRepository = new MovementRepository();
