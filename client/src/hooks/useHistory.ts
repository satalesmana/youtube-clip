import { useCallback, useEffect, useState } from 'react';
import { api } from '../services/api';
import type { HistoryItem } from '../types';

export function useHistory() {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const items = await api.fetchHistory();
      setHistory(items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat riwayat');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { history, loading, error, refresh };
}
