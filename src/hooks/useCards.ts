import { useState, useEffect } from 'react';
import { initializeCards } from '@/lib/data';

export function useCards() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    initializeCards()
      .then(() => setLoading(false))
      .catch((e) => {
        setError(e instanceof Error ? e.message : 'Failed to load cards');
        setLoading(false);
      });
  }, []);

  return { loading, error };
}
