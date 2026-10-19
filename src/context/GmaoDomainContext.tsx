import { createContext, useContext } from 'react';

// Domain Contexts to eliminate deep prop-drilling
export const PreventiveContext = createContext(null);
export const SortieExterneContext = createContext(null);
export const StockContext = createContext(null);
export const WarehouseContext = createContext(null);
export const MachinesContext = createContext(null);
export const CorrectiveContext = createContext(null);

export function usePreventiveContext() {
  const ctx = useContext(PreventiveContext);
  return ctx;
}

export function useSortieExterneContext() {
  const ctx = useContext(SortieExterneContext);
  return ctx;
}

export function useStockContext() {
  const ctx = useContext(StockContext);
  return ctx;
}

export function useWarehouseContext() {
  const ctx = useContext(WarehouseContext);
  return ctx;
}

export function useMachinesContext() {
  const ctx = useContext(MachinesContext);
  return ctx;
}

export function useCorrectiveContext() {
  const ctx = useContext(CorrectiveContext);
  return ctx;
}
