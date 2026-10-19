import { useState, useEffect, useCallback, useRef } from 'react';

export interface UseInfiniteScrollOptions<T> {
  fetchMore: (page: number, pageSize: number) => Promise<T[]> | T[];
  initialData?: T[];
  pageSize?: number;
  threshold?: number;
}

/**
 * Hook d'Infinite Scroll haute performance pour les grands ensembles de données GMAO.
 * Supporte à la fois le chargement asynchrone (API/IndexedDB) et le découpage progressif en mémoire.
 */
export function useInfiniteScroll<T>({
  fetchMore,
  initialData = [],
  pageSize = 50,
  threshold = 0.8,
}: UseInfiniteScrollOptions<T>) {
  const [data, setData] = useState<T[]>(initialData);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setData(initialData);
    setPage(1);
    setHasMore(true);
  }, [initialData]);

  const loadMore = useCallback(async () => {
    if (!hasMore || loading) return;
    setLoading(true);
    try {
      const newData = await fetchMore(page, pageSize);
      if (!newData || newData.length === 0) {
        setHasMore(false);
      } else {
        setData((prev) => [...prev, ...newData]);
        setPage((prev) => prev + 1);
        if (newData.length < pageSize) {
          setHasMore(false);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [fetchMore, hasMore, loading, page, pageSize]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const maxScroll = scrollHeight - clientHeight;
      if (maxScroll <= 0) return;
      const scrollPercentage = scrollTop / maxScroll;
      if (scrollPercentage >= threshold) {
        loadMore();
      }
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [loadMore, threshold]);

  const reset = useCallback(
    (newInitialData: T[] = []) => {
      setData(newInitialData);
      setPage(1);
      setHasMore(true);
    },
    []
  );

  return { data, loading, hasMore, page, loadMore, reset, containerRef };
}

export default useInfiniteScroll;
