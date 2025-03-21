import { useState, useCallback, useEffect } from 'react';

interface AnnouncementState {
  message: string;
  type: 'info' | 'warning' | 'error';
  id?: string; // Optional ID to identify specific announcements
  isVisible?: boolean; // Whether this announcement is visible
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
  const [announcements, setAnnouncements] = useState<AnnouncementState[]>([]);

  // Check localStorage on mount to see if announcements should be hidden
  useEffect(() => {
    // Update visibility of each announcement based on localStorage
    setAnnouncements(current => 
      current.map(announcement => {
        const announcementId = announcement.id || `announcement-${announcement.message}`;
        const dismissedKey = `dismissed-${announcementId}`;
        const dismissedTime = safeLocalStorage.getItem(dismissedKey);
        
        if (dismissedTime) {
          const dismissedAt = parseInt(dismissedTime, 10);
          const currentTime = Date.now();
          const hoursPassed = (currentTime - dismissedAt) / (1000 * 60 * 60);
          
          // If less than 24 hours have passed, keep it hidden
          if (hoursPassed < 24) {
            return { ...announcement, isVisible: false };
          } else {
            // More than 24 hours passed, show it again and remove the stored timestamp
            safeLocalStorage.removeItem(dismissedKey);
            return { ...announcement, isVisible: true };
          }
        } else {
          // Not dismissed before, show it
          return { ...announcement, isVisible: true };
        }
      })
    );
  }, []);

  const showAnnouncement = useCallback((
    message: string, 
    type: 'info' | 'warning' | 'error' = 'info',
    id?: string
  ) => {
    const announcementId = id || `announcement-${message}`;
    const dismissedKey = `dismissed-${announcementId}`;
    const dismissedTime = safeLocalStorage.getItem(dismissedKey);
    
    // Check if this announcement was dismissed recently
    if (dismissedTime) {
      const dismissedAt = parseInt(dismissedTime, 10);
      const currentTime = Date.now();
      const hoursPassed = (currentTime - dismissedAt) / (1000 * 60 * 60);
      
      // If less than 24 hours have passed, don't show it
      if (hoursPassed < 24) {
        return;
      } else {
        // More than 24 hours passed, remove the stored timestamp
        safeLocalStorage.removeItem(dismissedKey);
      }
    }
    
    // Check if this announcement is already in the list
    setAnnouncements(current => {
      const exists = current.some(a => (a.id || `announcement-${a.message}`) === announcementId);
      if (exists) return current;
      return [...current, { message, type, id: announcementId, isVisible: true }];
    });
  }, []);

  const hideAnnouncement = useCallback((id?: string) => {
    if (!id) {
      // Hide all announcements if no ID provided
      setAnnouncements(current => {
        current.forEach(announcement => {
          const announcementId = announcement.id || `announcement-${announcement.message}`;
          safeLocalStorage.setItem(`dismissed-${announcementId}`, Date.now().toString());
        });
        return [];
      });
      return;
    }
    
    // Store the dismissal time in localStorage for the specific announcement
    safeLocalStorage.setItem(`dismissed-${id}`, Date.now().toString());
    
    // Remove the specific announcement
    setAnnouncements(current => current.filter(a => (a.id || `announcement-${a.message}`) !== id));
  }, []);

  return {
    announcements,
    showAnnouncement,
    hideAnnouncement,
  };
};

export default useAnnouncement; 