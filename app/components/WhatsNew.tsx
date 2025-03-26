import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import styles from './WhatsNew.module.css';

export interface FeatureUpdate {
  id: string;
  title: string;
  description: string;
  date: string;
  images?: string[];
  highlights?: string[];
  instructions?: string[];
}

// 이미지 갤러리 컴포넌트
interface ImageGalleryProps {
  images: string[];
  title: string;
}

const ImageGallery: React.FC<ImageGalleryProps> = ({ images, title }) => {
  const [activeIndex, setActiveIndex] = useState(0);

  const nextImage = () => {
    setActiveIndex((prev) => (prev + 1) % images.length);
  };

  const prevImage = () => {
    setActiveIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  // 이미지가 하나밖에 없으면 일반 이미지로 표시
  if (images.length === 1) {
    return (
      <div className={styles.updateImage}>
        <Image
          src={images[0]}
          alt={title}
          width={700}
          height={394}
          className="w-full object-cover"
        />
      </div>
    );
  }

  return (
    <div className={styles.updateImage}>
      <div className={styles.galleryContainer}>
        <div className={styles.galleryImageWrapper}>
          <Image
            src={images[activeIndex]}
            alt={`${title} - Image ${activeIndex + 1}`}
            width={700}
            height={394}
            className="w-full object-cover"
          />
          
          {/* 네비게이션 컨트롤 */}
          <div className={styles.galleryControls}>
            <button onClick={prevImage} className={styles.galleryButton} aria-label="Previous image">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="15 18 9 12 15 6"></polyline>
              </svg>
            </button>
            <div className={styles.galleryCounter}>
              {activeIndex + 1} / {images.length}
            </div>
            <button onClick={nextImage} className={styles.galleryButton} aria-label="Next image">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
            </button>
          </div>
        </div>
        
        {/* 썸네일 줄 */}
        <div className={`${styles.galleryThumbnails} ${styles.hideScrollbar}`}>
          {images.map((img, idx) => (
            <div 
              key={idx}
              className={`${styles.galleryThumbnail} ${idx === activeIndex ? styles.activeThumbnail : ''}`}
              onClick={() => setActiveIndex(idx)}
            >
              <Image
                src={img}
                alt={`Thumbnail ${idx + 1}`}
                width={100}
                height={60}
                className="w-full h-full object-cover"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export interface WhatsNewProps {
  isOpen: boolean;
  onClose: () => void;
  updates: FeatureUpdate[];
}

const WhatsNew: React.FC<WhatsNewProps> = ({
  isOpen,
  onClose,
  updates,
}) => {
  const [selectedUpdate, setSelectedUpdate] = useState<string | null>(
    updates.length > 0 ? updates[0].id : null
  );
  const contentWrapperRef = useRef<HTMLDivElement>(null);
  const mainContentRef = useRef<HTMLDivElement>(null);

  // Reset selected update when updates change
  useEffect(() => {
    if (updates.length > 0) {
      setSelectedUpdate(updates[0].id);
    }
  }, [updates]);

  // Handle update selection
  const handleUpdateSelect = (updateId: string) => {
    setSelectedUpdate(updateId);
    
    // On mobile, scroll to the content section
    if (window.innerWidth < 768 && contentWrapperRef.current) {
      // Get the height of the sidebar
      const sidebar = contentWrapperRef.current.querySelector(`.${styles.sidebar}`);
      const sidebarHeight = sidebar?.getBoundingClientRect().height || 0;
      
      // Scroll down past the sidebar with a small delay to let state update
      setTimeout(() => {
        contentWrapperRef.current?.scrollTo({
          top: sidebarHeight,
          behavior: 'smooth'
        });
      }, 50);
    }
  };

  const currentUpdate = updates.find(update => update.id === selectedUpdate);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className={styles.whatsNewModal}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className={styles.modalContent}
          >
            {/* Header */}
            <div className={styles.header}>
              <h2 className={styles.updateTitle}>What's New</h2>
              <button
                onClick={onClose}
                className={styles.closeButton}
                aria-label="Close"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>

            {/* Content */}
            <div ref={contentWrapperRef} className={`${styles.contentWrapper} ${styles.hideScrollbar}`}>
              {/* Sidebar */}
              <div className={styles.sidebar}>
                <div className={`${styles.sidebarScroller} ${styles.hideScrollbar}`}>
                  {updates.map((update) => (
                    <div key={update.id} className={styles.sidebarItem}>
                      <button
                        onClick={() => handleUpdateSelect(update.id)}
                        className={`${styles.sidebarButton} ${
                          selectedUpdate === update.id
                            ? styles.sidebarButtonActive
                            : styles.sidebarButtonInactive
                        }`}
                      >
                        <div className="max-w-[140px] sm:max-w-full truncate text-left" title={update.title}>{update.title}</div>
                        <div className="text-xs text-[var(--muted)] mt-1 truncate max-w-[140px] sm:max-w-full">{update.date}</div>
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Main content */}
              <div ref={mainContentRef} className={`${styles.mainContent} ${styles.hideScrollbar}`}>
                {currentUpdate && (
                  <div className="animate-fade-in">
                    <h3 className={styles.updateTitle}>{currentUpdate.title}</h3>
                    <div className={styles.updateDate}>{currentUpdate.date}</div>
                    
                    {currentUpdate.images && currentUpdate.images.length > 0 && (
                      <ImageGallery images={currentUpdate.images} title={currentUpdate.title} />
                    )}
                    
                    <div className={styles.updateDescription}>
                      {currentUpdate.description}
                    </div>
                    
                    {currentUpdate.highlights && currentUpdate.highlights.length > 0 && (
                      <div className={styles.highlightsList}>
                        <h4 className={styles.sectionTitle}>Highlights</h4>
                        <ul>
                          {currentUpdate.highlights.map((highlight, index) => (
                            <li key={index} className={styles.listItem}>
                              <span className={styles.listNumber}>{index + 1}</span>
                              <span>{highlight}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    
                    {currentUpdate.instructions && currentUpdate.instructions.length > 0 && (
                      <div className={styles.instructionsList}>
                        <h4 className={styles.sectionTitle}>How to use</h4>
                        <ol>
                          {currentUpdate.instructions.map((instruction, index) => (
                            <li key={index} className={styles.listItem}>
                              <span className={styles.listNumber}>{index + 1}</span>
                              <span>{instruction}</span>
                            </li>
                          ))}
                        </ol>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default WhatsNew; 