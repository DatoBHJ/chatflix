import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useUser } from '@/app/lib/UserContext';

export const useLastSeenUpdate = () => {
  const [lastSeenUpdateId, setLastSeenUpdateId] = useState<string | null>(null);
  const [lastSeenTimestamp, setLastSeenTimestamp] = useState<number>(0);
  const [isLoaded, setIsLoaded] = useState(false);
  const supabase = createClient();
  const { user } = useUser();

  // Load from Supabase on mount and when user changes
  useEffect(() => {
    const fetchLastSeen = async () => {
      if (!user?.id) {
        // Use localStorage as fallback for non-authenticated users
        try {
          const storedUpdateId = localStorage.getItem('lastSeenUpdateId');
          const storedTimestamp = localStorage.getItem('lastSeenUpdateTimestamp');
          
          if (storedUpdateId) setLastSeenUpdateId(storedUpdateId);
          if (storedTimestamp) setLastSeenTimestamp(parseInt(storedTimestamp, 10));
        } catch (error) {
          console.error('Error reading from localStorage:', error);
        }
        setIsLoaded(true);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('user_last_seen')
          .select('last_seen_update_id, last_seen_timestamp')
          .eq('user_id', user.id)
          .single();
        
        if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows returned"
          console.error('Error fetching last seen data:', error);
        }
        
        if (data) {
          setLastSeenUpdateId(data.last_seen_update_id);
          setLastSeenTimestamp(data.last_seen_timestamp);
        }
      } catch (error) {
        console.error('Error fetching from Supabase:', error);
      } finally {
        setIsLoaded(true);
      }
    };

    fetchLastSeen();
  }, [user]);

  // Function to update the last seen update
  const updateLastSeen = async (updateId: string, timestamp?: number) => {
    const updateTimestamp = timestamp || Date.now();
    
    setLastSeenUpdateId(updateId);
    setLastSeenTimestamp(updateTimestamp);
    
    if (!user?.id) {
      // Use localStorage as fallback for non-authenticated users
      try {
        localStorage.setItem('lastSeenUpdateId', updateId);
        localStorage.setItem('lastSeenUpdateTimestamp', updateTimestamp.toString());
      } catch (error) {
        console.error('Error saving to localStorage:', error);
      }
      return;
    }
    
    try {
      const { error } = await supabase
        .from('user_last_seen')
        .upsert({
          user_id: user.id,
          last_seen_update_id: updateId,
          last_seen_timestamp: updateTimestamp,
        }, { onConflict: 'user_id' });
      
      if (error) {
        console.error('Error updating last seen data:', error);
      }
    } catch (error) {
      console.error('Error updating Supabase:', error);
    }
  };

  return {
    lastSeenUpdateId,
    lastSeenTimestamp,
    updateLastSeen,
    isLoaded
  };
}; 