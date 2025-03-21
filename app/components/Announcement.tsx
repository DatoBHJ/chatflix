import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export interface AnnouncementItem {
  message: string;
  type: 'info' | 'warning' | 'error';
  id?: string;
  isVisible?: boolean;
}

export interface AnnouncementProps {
  announcements: AnnouncementItem[];
  onClose: (id: string) => void;
}

const Announcement: React.FC<AnnouncementProps> = ({
  announcements,
  onClose,
}) => {
  return (
    <div className="fixed top-0 left-0 right-0 z-50 flex flex-col">
      <AnimatePresence>
        {announcements.map((announcement, index) => {
          const bgColor = {
            info: 'bg-blue-500',
            warning: 'bg-yellow-500',
            error: 'bg-red-500',
          }[announcement.type];

          const id = announcement.id || `announcement-${announcement.message}`;
          const isVisible = announcement.isVisible !== false; // Default to true if undefined
          
          return isVisible ? (
            <motion.div
              key={id}
              initial={{ opacity: 0, y: -50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -50 }}
              transition={{ delay: index * 0.1 }}
              className={`${bgColor} text-white px-4 py-3 shadow-lg`}
              style={{ zIndex: 100 - index }}
            >
              <div className="container mx-auto flex justify-between items-center">
                <div className="flex-1">{announcement.message}</div>
                <button
                  onClick={() => onClose(id)}
                  className="ml-4 text-white hover:text-gray-200 focus:outline-none"
                >
                  ✕
                </button>
              </div>
            </motion.div>
          ) : null;
        })}
      </AnimatePresence>
    </div>
  );
};

export default Announcement; 