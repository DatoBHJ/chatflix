import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export interface AnnouncementProps {
  message: string;
  type?: 'info' | 'warning' | 'error';
  isVisible: boolean;
  onClose: () => void;
}

const Announcement: React.FC<AnnouncementProps> = ({
  message,
  type = 'info',
  isVisible,
  onClose,
}) => {
  const bgColor = {
    info: 'bg-blue-500',
    warning: 'bg-yellow-500',
    error: 'bg-red-500',
  }[type];

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -50 }}
          className={`fixed top-0 left-0 right-0 z-50 ${bgColor} text-white px-4 py-3 shadow-lg`}
        >
          <div className="container mx-auto flex justify-between items-center">
            <div className="flex-1">{message}</div>
            <button
              onClick={onClose}
              className="ml-4 text-white hover:text-gray-200 focus:outline-none"
            >
              ✕
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default Announcement; 