'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/utils/supabase/client';
import Image from 'next/image';
import { useLastSeenUpdate } from '../hooks/useLastSeenUpdate';
import { MarkdownContent } from '../components/MarkdownContent';
import WhatsNewNavigationWrapper from './components/WhatsNewNavigationWrapper';
import { ChatflixLoadingScreen } from '../components/ChatflixLoadingScreen';

interface FeatureUpdate {
  id: string;
  title: string;
  description: string;
  created_at: string; 
  images?: string[];
}

interface ImageModalProps {
  images: string[];
  selectedIndex: number;
  onClose: () => void;
  onNext: () => void;
  onPrev: () => void;
}

const ImageModal: React.FC<ImageModalProps> = ({ 
  images, 
  selectedIndex, 
  onClose, 
  onNext, 
  onPrev 
}) => {
  // Prevent scrolling of body when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, []);

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-80 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      <div className="absolute top-4 right-4">
        <button 
          onClick={onClose}
          className="text-white p-2 rounded-full hover:bg-white hover:bg-opacity-20 transition-colors"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      
      <button 
        onClick={(e) => {
          e.stopPropagation();
          onPrev();
        }}
        className="absolute left-4 text-white p-2 rounded-full hover:bg-white hover:bg-opacity-20 transition-colors"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="15 18 9 12 15 6"></polyline>
        </svg>
      </button>
      
      <div 
        className="max-w-4xl max-h-[90vh] relative"
        onClick={(e) => e.stopPropagation()}
      >
        <Image 
          src={images[selectedIndex]}
          alt={`Image ${selectedIndex + 1}`}
          width={1200}
          height={900}
          className="max-h-[90vh] max-w-full h-auto object-contain"
        />
      </div>
      
      <button 
        onClick={(e) => {
          e.stopPropagation();
          onNext();
        }}
        className="absolute right-4 text-white p-2 rounded-full hover:bg-white hover:bg-opacity-20 transition-colors"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="9 18 15 12 9 6"></polyline>
        </svg>
      </button>
      
      <div className="absolute bottom-4 text-white text-sm">
        {selectedIndex + 1} / {images.length}
      </div>
    </div>
  );
};


export default function WhatsNewPage() {
  const [updates, setUpdates] = useState<FeatureUpdate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { updateLastSeen } = useLastSeenUpdate();
  const [selectedImages, setSelectedImages] = useState<string[] | null>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [expandedUpdates, setExpandedUpdates] = useState<Set<string>>(new Set());
  const [allExpanded, setAllExpanded] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);
  
  const supabase = createClient();

  // Accordion functionality
  const toggleUpdate = useCallback((updateId: string) => {
    setExpandedUpdates(prev => {
      const newSet = new Set(prev);
      if (newSet.has(updateId)) {
        newSet.delete(updateId);
      } else {
        newSet.add(updateId);
      }
      return newSet;
    });
  }, []);

  const toggleAllUpdates = useCallback(() => {
    if (allExpanded) {
      setExpandedUpdates(new Set());
      setAllExpanded(false);
    } else {
      setExpandedUpdates(new Set(updates.map(update => update.id)));
      setAllExpanded(true);
    }
  }, [allExpanded, updates]);

  useEffect(() => {
    const fetchUpdates = async () => {
      try {
        const { data, error } = await supabase
          .from('feature_updates')
          .select('*')
          .order('created_at', { ascending: false });
        
        if (error) {
          console.error('Error fetching updates:', error);
          return;
        }

        // Transform data to match FeatureUpdate interface
        const formattedUpdates: FeatureUpdate[] = data.map((update: any) => ({
          id: update.id,
          title: update.title,
          description: update.description,
          created_at: update.created_at,
          images: update.images || [],
        }));
        
        setUpdates(formattedUpdates);

        // Auto-expand the latest update ONLY on first initialization
        if (!hasInitialized && formattedUpdates.length > 0) {
          const latestUpdate = formattedUpdates[0];
          setExpandedUpdates(new Set([latestUpdate.id]));
          updateLastSeen(latestUpdate.id, new Date(latestUpdate.created_at).getTime());
          setHasInitialized(true);
        }
      } catch (error) {
        console.error('Error in fetchUpdates:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUpdates();
    
    // 게시물에 대한 실시간 변경사항 구독
    const featureChannel = supabase
      .channel('public:feature_updates')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'feature_updates' }, 
        () => {
          fetchUpdates();
        }
      )
      .subscribe();
      
    return () => {
      featureChannel.unsubscribe();
    };
  }, [supabase, updateLastSeen, hasInitialized]);
  

  const handleImageClick = (images: string[], index: number) => {
    setSelectedImages(images);
    setSelectedImageIndex(index);
  };

  const closeImageModal = () => {
    setSelectedImages(null);
  };

  const nextImage = () => {
    if (!selectedImages) return;
    setSelectedImageIndex((prev) => (prev + 1) % selectedImages.length);
  };

  const prevImage = () => {
    if (!selectedImages) return;
    setSelectedImageIndex((prev) => (prev - 1 + selectedImages.length) % selectedImages.length);
  };



  if (isLoading) {
    return <ChatflixLoadingScreen />
  }

  return (
    <div className="min-h-screen text-[var(--foreground)] relative z-70" style={{ backgroundColor: 'var(--background)', overscrollBehaviorY: 'none' }}>
      <div className="px-8 sm:px-8 pt-8 sm:pt-24 md:pt-28 pb-8" style={{ overscrollBehaviorY: 'none' }}>
        <div className="max-w-4xl mx-auto">
          {/* Header Navigation - Apple Style */}
          <WhatsNewNavigationWrapper activeSection="overview" />
          
          {/* Content Section */}
          <div className="text-base text-[var(--muted)]">
            <>
              {/* Section Header with Toggle Button */}
              <div className="flex items-center justify-between mb-6">
                <div className="text-base font-normal text-[var(--muted)] pl-0">Changelog</div>
                {updates.length > 0 && (
                  <button
                    onClick={toggleAllUpdates}
                    className="text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors cursor-pointer pr-1"
                  >
                    {allExpanded ? 'Collapse All' : 'Expand All'}
                  </button>
                )}
              </div>

              <div>
                {updates.map((update, index) => {
                  const isExpanded = expandedUpdates.has(update.id);
                  return (
                    <div key={update.id}>
                      <button
                        onClick={() => toggleUpdate(update.id)}
                        className="w-full text-left py-4 group cursor-pointer"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <span className="text-base font-semibold text-[var(--foreground)]">
                              {update.title}
                            </span>
                            <p className="text-xs text-[var(--muted)] font-light mt-0.5">
                              {new Date(update.created_at).toLocaleDateString('en-US', {
                                day: 'numeric',
                                month: 'long',
                                year: 'numeric'
                              })}
                            </p>
                          </div>
                        </div>
                      </button>
                      
                      {/* Expanded Content */}
                      <div className={`transition-all duration-500 ease-out ${
                        isExpanded ? 'max-h-[2000px] opacity-100 overflow-visible' : 'max-h-0 opacity-0 overflow-hidden'
                      }`}>
                        <div className="pb-6 pt-2">
                          {/* Images and Description with iMessage bubble style */}
                          <div className="mb-6 pl-2">
                            {/* Images first */}
                            {update.images && update.images.length > 0 && (
                              <div className="mb-4">
                                {update.images.length === 1 ? (
                                  <div 
                                    className="rounded-xl overflow-hidden cursor-pointer hover:opacity-90 transition-opacity"
                                    onClick={() => handleImageClick(update.images!, 0)}
                                  >
                                    <Image 
                                      src={update.images[0]}
                                      alt={update.title}
                                      width={800}
                                      height={400}
                                      className="w-full h-auto object-cover"
                                    />
                                  </div>
                                ) : (
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {update.images.map((img, i) => (
                                      <div 
                                        key={i} 
                                        className="rounded-xl overflow-hidden cursor-pointer hover:opacity-90 transition-opacity"
                                        onClick={() => handleImageClick(update.images!, i)}
                                      >
                                        <Image 
                                          src={img}
                                          alt={`${update.title} image ${i+1}`}
                                          width={400}
                                          height={300}
                                          className="w-full h-auto object-cover"
                                        />
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                            
                            {/* Description with segmentation */}
                            <div className="text-[var(--foreground)] -ml-2">
                              <MarkdownContent 
                                content={update.description} 
                                enableSegmentation={true}
                                messageType="assistant"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          </div>
        </div>
      </div>
      
      {selectedImages && (
        <ImageModal
          images={selectedImages}
          selectedIndex={selectedImageIndex}
          onClose={closeImageModal}
          onNext={nextImage}
          onPrev={prevImage}
        />
      )}
    </div>
  );
} 