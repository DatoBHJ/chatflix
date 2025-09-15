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
  const [isInitialized, setIsInitialized] = useState(false);
  const [hasEverBeenOpened, setHasEverBeenOpened] = useState(false);
  const [showBadge, setShowBadge] = useState(false); // 배지 표시 상태 추가
  const [badgeReady, setBadgeReady] = useState(false); // 배지 준비 상태 추가
  const { lastSeenUpdateId, lastSeenTimestamp, updateLastSeen, isLoaded } = useLastSeenUpdate();
  const supabase = createClient();
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Check if user has ever opened the panel before
  useEffect(() => {
    try {
      const hasOpened = localStorage.getItem('hasOpenedWhatsNew');
      setHasEverBeenOpened(hasOpened === 'true');
    } catch (error) {
      console.error('Error reading hasOpenedWhatsNew from localStorage:', error);
    }
  }, []);

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
    // 모든 데이터가 로드될 때까지 기다림
    if (!isLoaded || isLoading) return;

    const checkForNewUpdates = () => {
      console.log('WhatsNewContainer: Checking for new updates', {
        isLoaded,
        isLoading,
        updatesLength: updates.length,
        lastSeenUpdateId,
        lastSeenTimestamp,
        isInitialized
      });

      // 업데이트가 없는 경우
      if (updates.length === 0) {
        console.log('WhatsNewContainer: No updates available');
        setNewUpdatesCount(0);
        setHasNewUpdates(false);
        setShowBadge(false);
        setIsInitialized(true);
        return;
      }

      // localStorage에서 익명 사용자의 마지막 확인 시간을 가져옴
      let anonymousLastSeen = 0;
      try {
        const stored = localStorage.getItem('lastSeenUpdateTimestamp');
        if (stored) {
          anonymousLastSeen = parseInt(stored, 10);
        }
      } catch (error) {
        console.error('Error reading localStorage:', error);
      }

      // 로그인된 사용자와 익명 사용자 모두 고려
      const effectiveLastSeenTimestamp = Math.max(lastSeenTimestamp, anonymousLastSeen);
      
      console.log('WhatsNewContainer: Effective timestamps', {
        lastSeenTimestamp,
        anonymousLastSeen,
        effectiveLastSeenTimestamp
      });
      
      if (!lastSeenUpdateId && effectiveLastSeenTimestamp === 0 && !hasEverBeenOpened) {
        // 첫 방문자 - 모든 업데이트를 새 것으로 표시하지 않음 (사용자 경험 개선)
        console.log('WhatsNewContainer: First time visitor - no notifications');
        setNewUpdatesCount(0);
        setHasNewUpdates(false);
        setShowBadge(false);
      } else {
        const lastSeenUpdate = updates.find(update => update.id === lastSeenUpdateId);
        
        if (!lastSeenUpdate) {
          const newUpdates = updates.filter(update => update.timestamp > effectiveLastSeenTimestamp);
          console.log('WhatsNewContainer: New updates found by timestamp', {
            newUpdatesCount: newUpdates.length,
            totalUpdates: updates.length
          });
          setNewUpdatesCount(newUpdates.length);
          const hasUpdates = newUpdates.length > 0;
          setHasNewUpdates(hasUpdates);
          setShowBadge(hasUpdates);
        } else {
          const newUpdates = updates.filter(
            update => update.timestamp > lastSeenUpdate.timestamp
          );
          console.log('WhatsNewContainer: New updates found by update ID', {
            newUpdatesCount: newUpdates.length,
            totalUpdates: updates.length
          });
          setNewUpdatesCount(newUpdates.length);
          const hasUpdates = newUpdates.length > 0;
          setHasNewUpdates(hasUpdates);
          setShowBadge(hasUpdates);
        }
      }
      
      // 초기화 완료 표시
      setIsInitialized(true);
      
      // 배지 준비 상태를 약간 지연시켜 깜빡임 방지
      setTimeout(() => {
        setBadgeReady(true);
      }, 100);
      
      console.log('WhatsNewContainer: Initialization complete');
    };

    checkForNewUpdates();
  }, [lastSeenUpdateId, lastSeenTimestamp, isLoaded, updates, isLoading, hasEverBeenOpened]);
  
  const handleOpen = () => {
    openPanel();
    
    // 사용자가 패널을 열었다는 것을 기록
    try {
      localStorage.setItem('hasOpenedWhatsNew', 'true');
      setHasEverBeenOpened(true);
    } catch (error) {
      console.error('Error saving hasOpenedWhatsNew to localStorage:', error);
    }
    
    if (updates.length > 0) {
      const newestUpdate = updates[0];
      updateLastSeen(newestUpdate.id, newestUpdate.timestamp);
      
      setHasNewUpdates(false);
      setNewUpdatesCount(0);
      setShowBadge(false);
    }
  };
  
  // 로딩 중이거나 초기화가 완료되지 않았을 때는 알림 배지 없이 렌더링
  if (isLoading || !isInitialized) {
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
        {showBadge && badgeReady && (
          <span className={`absolute top-0.5 h-[12px] bg-blue-500 rounded-full flex items-center justify-center transition-all duration-300 ease-out ${
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