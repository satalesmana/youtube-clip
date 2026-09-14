import { useCallback, useEffect, useState } from 'react';
import { api } from '../services/api';

export function useHealth(pollIntervalMs = 30000) {
  const [isOnline, setIsOnline] = useState<boolean | null>(null);

  const checkStatus = useCallback(async () => {
    const ok = await api.checkHealth();
    setIsOnline(ok);
  }, []);

  useEffect(() => {
    checkStatus();
    if (pollIntervalMs > 0) {
      const timer = setInterval(checkStatus, pollIntervalMs);
      return () => clearInterval(timer);
    }
  }, [checkStatus, pollIntervalMs]);

  return { isOnline, checkStatus };
}
