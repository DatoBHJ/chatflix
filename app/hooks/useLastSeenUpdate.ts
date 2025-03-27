import { useState, useEffect } from 'react';

export const useLastSeenUpdate = () => {
  const [lastSeenUpdateId, setLastSeenUpdateId] = useState<string | null>(null);
  const [lastSeenTimestamp, setLastSeenTimestamp] = useState<number>(0);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const storedUpdateId = localStorage.getItem('lastSeenUpdateId');
      const storedTimestamp = localStorage.getItem('lastSeenUpdateTimestamp');
      
      if (storedUpdateId) {
        setLastSeenUpdateId(storedUpdateId);
      }
      
      if (storedTimestamp) {
        setLastSeenTimestamp(parseInt(storedTimestamp, 10));
      }
    } catch (error) {
      console.error('Error reading from localStorage:', error);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  // Function to update the last seen update
  const updateLastSeen = (updateId: string, timestamp?: number) => {
    // Default to current time if timestamp not provided
    const updateTimestamp = timestamp || Date.now();
    
    try {
      localStorage.setItem('lastSeenUpdateId', updateId);
      localStorage.setItem('lastSeenUpdateTimestamp', updateTimestamp.toString());
      
      setLastSeenUpdateId(updateId);
      setLastSeenTimestamp(updateTimestamp);
    } catch (error) {
      console.error('Error saving to localStorage:', error);
    }
  };

  return {
    lastSeenUpdateId,
    lastSeenTimestamp,
    updateLastSeen,
    isLoaded
  };
}; 