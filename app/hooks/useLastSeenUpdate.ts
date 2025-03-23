import { useState, useEffect } from 'react';

const LOCAL_STORAGE_KEY = 'lastSeenUpdateId';

export function useLastSeenUpdate() {
  const [lastSeenUpdateId, setLastSeenUpdateId] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const storedId = localStorage.getItem(LOCAL_STORAGE_KEY);
      setLastSeenUpdateId(storedId);
    } catch (error) {
      console.error('Failed to load last seen update from localStorage:', error);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  // Update localStorage when state changes
  const updateLastSeen = (updateId: string) => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, updateId);
      setLastSeenUpdateId(updateId);
    } catch (error) {
      console.error('Failed to save last seen update to localStorage:', error);
    }
  };

  return {
    lastSeenUpdateId,
    updateLastSeen,
    isLoaded,
  };
} 