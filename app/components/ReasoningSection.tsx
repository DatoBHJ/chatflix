import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { MarkdownContent } from './MarkdownContent';

interface ReasoningSectionProps {
  content: string;
  isComplete?: boolean;
  startTime?: number | null;
  hideToggle?: boolean;
  onModalClose?: () => void;
}

function ReasoningSectionComponent({ 
  content, 
  isComplete = false, 
  startTime = null,
  hideToggle = false,
  onModalClose
}: ReasoningSectionProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [modalElements, setModalElements] = useState({
    background: false,
    content: false
  });
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Auto-open modal when hideToggle is true (for UnifiedInfoPanel)
  useEffect(() => {
    if (hideToggle) {
      setIsModalOpen(true);
    }
  }, [hideToggle]);

  // Disable body scroll when modal is visible and add ESC listener
  useEffect(() => {
    if (isModalVisible) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      const onKey = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          setIsModalOpen(false);
        }
      };
      window.addEventListener('keydown', onKey);
      return () => {
        document.body.style.overflow = originalOverflow;
        window.removeEventListener('keydown', onKey);
      };
    }
  }, [isModalVisible]);

  // Stage mount/unmount for smooth enter/exit with staggered animation
  useEffect(() => {
    if (isModalOpen) {
      // ensure visible when opening
      setIsModalVisible(true);
      
      // Staggered sequence - background first, then content (like Header battery panel)
      const timeouts = [
        setTimeout(() => setModalElements(prev => ({ ...prev, background: true })), 20),
        setTimeout(() => setModalElements(prev => ({ ...prev, content: true })), 300)
      ];
      
      return () => {
        timeouts.forEach(timeout => clearTimeout(timeout));
      };
    } else if (isModalVisible) {
      // closing: reverse sequence
      setModalElements({ background: false, content: false });
      const timeoutId = setTimeout(() => {
        setIsModalVisible(false);
        // Call onModalClose after animation is complete
        if (onModalClose) {
          onModalClose();
        }
      }, 500);
      return () => clearTimeout(timeoutId);
    }
  }, [isModalOpen, isModalVisible, onModalClose]);


  // Auto scroll when content changes
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [content]);

  const handleToggle = useCallback(() => {
    setIsModalOpen(!isModalOpen);
  }, [isModalOpen]);


  const closeModal = useCallback(() => {
    setIsModalOpen(false);
    // Don't call onModalClose immediately - let the animation finish first
    // onModalClose will be called after the modal is fully closed
  }, []);

  return (
    <div className="my-0 text-sm font-sans max-w-[85%] md:max-w-[75%] lg:max-w-[65%] xl:max-w-[60%]">
       {!hideToggle && (
         <div className="pt-12 sm:pt-30 pb-8">
           <div className="flex items-center gap-3">
             {!isComplete && (
               <div className="w-2 h-2 bg-gradient-to-r from-amber-400 to-amber-600 rounded-full animate-pulse"></div>
             )}

             <h2 className="text-3xl sm:text-3xl md:text-4xl font-semibold tracking-tight">
               Thinking
             </h2>
           </div>
           
           <div className="mt-10 text-base text-[var(--muted)]">
             <button
               onClick={handleToggle}
               className="mb-5 text-base font-normal text-[var(--muted)] pl-1.5 cursor-pointer hover:text-[var(--foreground)] transition-colors"
             >
               Reasoning Process
             </button>
           </div>
         </div>
       )}


      {/* Modal */}
      {isModalVisible && createPortal(
        <div className={`fixed inset-0 z-[70] text-[var(--foreground)] pointer-events-auto transition-all duration-500 ease-out ${
          modalElements.background ? 'opacity-100' : 'opacity-0'
        }`}
          style={{ backgroundColor: 'var(--background)' }}
        >
          <div className="absolute inset-0" onClick={closeModal} />
          <div 
            className={`relative h-full w-full flex flex-col transform-gpu transition-all duration-400 ease-out ${
              modalElements.content ? 'opacity-100 translate-y-0 scale-y-100' : 'opacity-0 -translate-y-4 scale-y-[0.95]'
            }`} 
            style={{ transformOrigin: 'top center' }}
          >
            <button
              aria-label="Close"
              className="absolute top-3 right-3 p-2 rounded-full z-10 cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                closeModal();
              }}
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
            <div className={`flex-grow overflow-y-auto px-12 sm:px-16 md:px-20 lg:px-32 xl:px-40 2xl:px-48 pt-12 sm:pt-30 pb-8 transform-gpu transition-all duration-400 ease-out ${
              modalElements.content ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-6'
            }`}>
              <h2 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-medium tracking-tight pl-0.5">
                {isComplete ? 'Thinking' : 'Thinking...'}
              </h2>
              <div className={`sm:mt-20 mt-10 text-base text-[var(--muted)] transform-gpu transition-all duration-400 ease-out ${
                modalElements.content ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'
              }`}>
                <div className="mb-5 text-base font-normal text-[var(--muted)] pl-0 sm:pl-3.5">Reasoning Process</div>
                <div 
                  ref={scrollContainerRef}
                  className="text-[var(--foreground)]/80 leading-relaxed px-0 sm:px-4"
                  style={{
                    wordBreak: 'break-word',
                    overflowWrap: 'break-word'
                  }}
                >
                  <div className="overflow-x-auto">
                    <MarkdownContent 
                      content={content}
                      enableSegmentation={false}
                      variant="clean"
                      isReasoningSection={true}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

export const ReasoningSection = React.memo(ReasoningSectionComponent);
