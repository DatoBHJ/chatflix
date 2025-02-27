import { useState, useCallback } from 'react';

interface AnnouncementState {
  message: string;
  type: 'info' | 'warning' | 'error';
}

export const useAnnouncement = () => {
  const [announcement, setAnnouncement] = useState<AnnouncementState | null>(null);

  const showAnnouncement = useCallback((message: string, type: 'info' | 'warning' | 'error' = 'info') => {
    setAnnouncement({ message, type });
  }, []);

  const hideAnnouncement = useCallback(() => {
    setAnnouncement(null);
  }, []);

  return {
    announcement,
    showAnnouncement,
    hideAnnouncement,
    isVisible: !!announcement,
  };
};

export default useAnnouncement; 