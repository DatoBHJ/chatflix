import { useState, useCallback, useEffect } from 'react';

interface AnnouncementState {
  message: string;
  type: 'info' | 'warning' | 'error';
  id?: string; // Optional ID to identify specific announcements
}

// Helper to safely access localStorage (handles SSR)
const safeLocalStorage = {
  getItem: (key: string): string | null => {
    if (typeof window === 'undefined') return null;
    try {
      return localStorage.getItem(key);
    } catch (error) {
      console.error('Error accessing localStorage:', error);
      return null;
    }
  },
  setItem: (key: string, value: string): void => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(key, value);
    } catch (error) {
      console.error('Error setting localStorage:', error);
    }
  },
  removeItem: (key: string): void => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error('Error removing from localStorage:', error);
    }
  }
};

export const useAnnouncement = () => {
  const [announcement, setAnnouncement] = useState<AnnouncementState | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  // Check localStorage on mount to see if announcement should be hidden
  useEffect(() => {
    if (!announcement) return;
    
    // Create a unique ID for the announcement if not provided
    const announcementId = announcement.id || `announcement-${announcement.message}`;
    const dismissedKey = `dismissed-${announcementId}`;
    
    // Check if this announcement was dismissed and when
    const dismissedTime = safeLocalStorage.getItem(dismissedKey);
    
    if (dismissedTime) {
      const dismissedAt = parseInt(dismissedTime, 10);
      const currentTime = Date.now();
      const hoursPassed = (currentTime - dismissedAt) / (1000 * 60 * 60);
      
      // If less than 24 hours have passed, keep it hidden
      if (hoursPassed < 24) {
        setIsVisible(false);
      } else {
        // More than 24 hours passed, show it again and remove the stored timestamp
        safeLocalStorage.removeItem(dismissedKey);
        setIsVisible(true);
      }
    } else {
      // Not dismissed before, show it
      setIsVisible(true);
    }
  }, [announcement]);

  const showAnnouncement = useCallback((
    message: string, 
    type: 'info' | 'warning' | 'error' = 'info',
    id?: string
  ) => {
    setAnnouncement({ message, type, id });
  }, []);

  const hideAnnouncement = useCallback(() => {
    if (announcement) {
      // Store the dismissal time in localStorage
      const announcementId = announcement.id || `announcement-${announcement.message}`;
      safeLocalStorage.setItem(`dismissed-${announcementId}`, Date.now().toString());
    }
    setIsVisible(false);
  }, [announcement]);

  return {
    announcement,
    showAnnouncement,
    hideAnnouncement,
    isVisible,
  };
};

export default useAnnouncement; 