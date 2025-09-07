import React, { useState, useEffect, useRef } from 'react';
import { useLastSeenUpdate } from '../hooks/useLastSeenUpdate';
import { createClient } from '@/utils/supabase/client';
import { FeatureUpdate } from '../types/FeatureUpdate';

interface WhatsNewContainerProps {
  openPanel: () => void;
}

const WhatsNewContainer: React.FC<WhatsNewContainerProps> = ({ openPanel }) => {
  const [hasNewUpdates, setHasNewUpdates] = useState(false);
  const [newUpdatesCount, setNewUpdatesCount] = useState(0);
  const [updates, setUpdates] = useState<FeatureUpdate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { lastSeenUpdateId, lastSeenTimestamp, updateLastSeen, isLoaded } = useLastSeenUpdate();
  const supabase = createClient();
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Fetch updates from Supabase
  useEffect(() => {
    const fetchUpdates = async () => {
      try {
        const { data, error } = await supabase
          .from('feature_updates')
          .select('id, created_at')
          .order('created_at', { ascending: false });
        
        if (error) {
          console.error('Error fetching updates:', error);
          return;
        }

        const formattedUpdates: FeatureUpdate[] = data.map(update => ({
          id: update.id,
          title: '', // Not needed for count
          description: '', // Not needed for count
          date: '', // Not needed for count
          timestamp: new Date(update.created_at).getTime(),
          images: [],
        }));
        
        setUpdates(formattedUpdates);
      } catch (error) {
        console.error('Error in fetchUpdates:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUpdates();
  }, [supabase]);
  
  // Check if there are updates the user hasn't seen
  useEffect(() => {
    if (!isLoaded || !updates.length || isLoading) return;

    const checkForNewUpdates = () => {
      if (!lastSeenUpdateId && lastSeenTimestamp === 0) {
        setNewUpdatesCount(updates.length);
        setHasNewUpdates(updates.length > 0);
        return;
      }

      const lastSeenUpdate = updates.find(update => update.id === lastSeenUpdateId);
      
      if (!lastSeenUpdate) {
        const newUpdates = updates.filter(update => update.timestamp > lastSeenTimestamp);
        setNewUpdatesCount(newUpdates.length);
        setHasNewUpdates(newUpdates.length > 0);
      } else {
        const newUpdates = updates.filter(
          update => update.timestamp > lastSeenUpdate.timestamp
        );
        setNewUpdatesCount(newUpdates.length);
        setHasNewUpdates(newUpdates.length > 0);
      }
    };

    checkForNewUpdates();
  }, [lastSeenUpdateId, lastSeenTimestamp, isLoaded, updates, isLoading]);
  
  const handleOpen = () => {
    openPanel();
    
    if (updates.length > 0) {
      const newestUpdate = updates[0];
      updateLastSeen(newestUpdate.id, newestUpdate.timestamp);
      
      setHasNewUpdates(false);
      setNewUpdatesCount(0);
    }
  };
  
  if (isLoading) {
    return (
      <div className="inline-flex items-center">
        <button
          className="relative flex items-center justify-center text-[var(--foreground)] transition-all duration-200 cursor-pointer p-2.5 md:p-2 rounded-lg"
          aria-label="What's New"
          disabled
        >
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            className="w-4 h-4 md:w-4 md:h-4 animate-pulse"
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round"
          >
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
          </svg>
        </button>
      </div>
    );
  }
  
  return (
    <div className="inline-flex items-center">
      <button
        onClick={handleOpen}
        className="relative flex items-center justify-center text-[var(--foreground)] transition-all duration-200 cursor-pointer p-2.5 md:p-2 rounded-lg"
        aria-label="What's New"
        ref={buttonRef}
      >
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          className="w-4 h-4 md:w-4 md:h-4"
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2" 
          strokeLinecap="round" 
          strokeLinejoin="round"
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
        </svg>
        {hasNewUpdates && (
          <span className={`absolute top-0.5 h-[12px] bg-blue-500 rounded-full flex items-center justify-center ${
            newUpdatesCount > 10 ? 'right-0.5 min-w-[18px] px-1' : 'right-1 min-w-[12px]'
          }`}>
            <span className="text-white text-[8px] font-bold leading-none">
              {newUpdatesCount > 10 ? '10+' : newUpdatesCount}
            </span>
          </span>
        )}
      </button>
    </div>
  );
};

export default WhatsNewContainer;