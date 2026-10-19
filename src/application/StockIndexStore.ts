import { IncrementalStockIndex } from './IncrementalStockIndex';

type Listener = () => void;

export class StockIndexStore {
  readonly index = new IncrementalStockIndex();

  private globalVersion = 0;
  private perRefVersion = new Map<string, number>();
  private globalListeners = new Set<Listener>();
  private refListeners = new Map<string, Set<Listener>>();

  // ---- Read side ----
  getGlobalVersion = (): number => this.globalVersion;
  getRefVersion = (ref: string): number => this.perRefVersion.get(this._key(ref)) ?? 0;
  isHydrated = (): boolean => this.index.isHydrated();

  // ---- Write side (called by MovementRepository) ----
  markHydrated(value = true): void {
    this.index.markHydrated(value);
  }

  subscribeAll = (cb: Listener): (() => void) => {
    this.globalListeners.add(cb);
    return () => {
      this.globalListeners.delete(cb);
    };
  };

  subscribeRef = (ref: string, cb: Listener): (() => void) => {
    const k = this._key(ref);
    let set = this.refListeners.get(k);
    if (!set) {
      set = new Set();
      this.refListeners.set(k, set);
    }
    set.add(cb);
    return () => {
      set!.delete(cb);
      if (set!.size === 0) {
        this.refListeners.delete(k);
      }
    };
  };

  // ---- Write side (called by MovementRepository) ----
  notifyRef(ref: string): void {
    const k = this._key(ref);
    this.perRefVersion.set(k, (this.perRefVersion.get(k) ?? 0) + 1);
    this.refListeners.get(k)?.forEach((cb) => cb());
  }

  notifyAll(): void {
    this.globalVersion++;
    this.globalListeners.forEach((cb) => cb());
  }

  reset(): void {
    this.index.rebuild([]);
    this.index.markHydrated(false);
    this.perRefVersion.clear();
    this.globalVersion = 0;
    this.globalListeners.clear();
    this.refListeners.clear();
  }

  private _key(ref: string): string {
    return String(ref ?? '').trim().toUpperCase();
  }
}

export const stockIndexStore = new StockIndexStore();
