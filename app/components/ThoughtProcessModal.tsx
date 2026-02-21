'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import ReactMarkdown from 'react-markdown';
import { X } from 'lucide-react';
import { getAdaptiveGlassStyleBlur } from '@/app/lib/adaptiveGlassStyle';

interface ThoughtProcessModalProps {
  isOpen: boolean;
  isMobile: boolean;
  content: string;
  isComplete: boolean;
  onClose: () => void;
}

export function ThoughtProcessModal({
  isOpen,
  isMobile,
  content,
  isComplete,
  onClose,
}: ThoughtProcessModalProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const shouldAutoScrollRef = useRef(true);

  const [isDragging, setIsDragging] = useState(false);
  const [dragStartY, setDragStartY] = useState(0);
  const [currentTranslateY, setCurrentTranslateY] = useState(0);

  const handleClose = useCallback(() => {
    if (isMobile) {
      setTimeout(() => onClose(), 300);
    } else {
      onClose();
    }
  }, [isMobile, onClose]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!isMobile) return;
    setIsDragging(true);
    setDragStartY(e.touches[0].clientY);
    setCurrentTranslateY(0);
  }, [isMobile]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isMobile || !isDragging) return;
    e.preventDefault();
    const currentY = e.touches[0].clientY;
    const diff = currentY - dragStartY;
    if (diff > 0) setCurrentTranslateY(diff);
  }, [isMobile, isDragging, dragStartY]);

  const handleTouchEnd = useCallback(() => {
    if (!isMobile || !isDragging) return;
    setIsDragging(false);
    if (currentTranslateY > 100) {
      handleClose();
    } else {
      setCurrentTranslateY(0);
    }
  }, [isMobile, isDragging, currentTranslateY, handleClose]);

  useEffect(() => {
    if (!isOpen) {
      setIsDragging(false);
      setCurrentTranslateY(0);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && scrollContainerRef.current) {
      shouldAutoScrollRef.current = true;
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && shouldAutoScrollRef.current && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [content, isOpen]);

  useEffect(() => {
    if (!isOpen || !scrollContainerRef.current) return;
    const container = scrollContainerRef.current;
    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const isNearBottom = scrollHeight - (scrollTop + clientHeight) < 32;
      shouldAutoScrollRef.current = isNearBottom;
    };
    container.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => container.removeEventListener('scroll', handleScroll);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  const handleBackdropClick = () => handleClose();

  if (!isOpen) return null;

  const markdownComponents = {
    p: ({ children }: { children?: React.ReactNode }) => <p className="mb-4">{children}</p>,
    h1: ({ children }: { children?: React.ReactNode }) => <h1 className="text-2xl font-bold mb-4 mt-6">{children}</h1>,
    h2: ({ children }: { children?: React.ReactNode }) => <h2 className="text-xl font-semibold mb-3 mt-5">{children}</h2>,
    h3: ({ children }: { children?: React.ReactNode }) => <h3 className="text-lg font-medium mb-3 mt-4">{children}</h3>,
    strong: ({ children }: { children?: React.ReactNode }) => <strong className="font-semibold text-lg">{children}</strong>,
    em: ({ children }: { children?: React.ReactNode }) => <em className="italic">{children}</em>,
    ul: ({ children }: { children?: React.ReactNode }) => <ul className="list-disc pl-5 mb-4 mt-2">{children}</ul>,
    ol: ({ children }: { children?: React.ReactNode }) => <ol className="list-decimal pl-5 mb-4 mt-2">{children}</ol>,
    li: ({ children }: { children?: React.ReactNode }) => <li className="mb-1">{children}</li>,
    blockquote: ({ children }: { children?: React.ReactNode }) => <blockquote className="border-l-4 border-[var(--accent)] pl-4 my-4 italic">{children}</blockquote>,
    hr: () => <hr className="my-6 border-[var(--accent)]" />,
  };

  const contentArea = (
    <div
      ref={scrollContainerRef}
      className="text-[var(--foreground)]/80 leading-relaxed overflow-y-auto overflow-x-hidden flex-1 min-h-0"
      style={{
        wordBreak: 'break-word',
        overflowWrap: 'break-word',
        WebkitUserSelect: 'text',
        userSelect: 'text',
      }}
    >
      <div className="overflow-x-auto">
        <ReactMarkdown components={markdownComponents}>{content || ''}</ReactMarkdown>
      </div>
    </div>
  );

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] transition-opacity duration-75"
      style={{ touchAction: 'none', overflow: 'hidden', pointerEvents: 'auto' }}
    >
      {isMobile ? (
        <>
          <div className="fixed inset-0 bg-transparent" onClick={handleBackdropClick} style={{ touchAction: 'none' }} />
          <div
            className="fixed inset-x-0 bottom-0 w-full flex flex-col overflow-hidden rounded-t-3xl"
            style={{
              height: 'calc(100vh - 120px)',
              maxHeight: 'calc(100vh - 120px)',
              transform: `translateY(${currentTranslateY}px)`,
              transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.25, 0.1, 0.25, 1)',
              ...getAdaptiveGlassStyleBlur(),
              backgroundColor:
                typeof window !== 'undefined' &&
                (document.documentElement.getAttribute('data-theme') === 'dark' ||
                  (document.documentElement.getAttribute('data-theme') === 'system' &&
                    window.matchMedia('(prefers-color-scheme: dark)').matches))
                  ? 'rgba(30, 30, 30, 0.6)'
                  : 'rgba(240, 240, 240, 0.6)',
              backdropFilter: 'blur(40px)',
              WebkitBackdropFilter: 'blur(40px)',
              zIndex: 9999,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="text-center pt-4 pb-2 shrink-0"
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              style={{ touchAction: 'none', cursor: 'grab' }}
            >
              <div className="w-12 h-1.5 rounded-full mx-auto transition-colors duration-200" style={{ backgroundColor: isDragging ? 'rgba(156, 163, 175, 0.4)' : 'rgba(209, 213, 219, 0.3)' }} />
            </div>
            <div className="relative flex items-center justify-center py-6 px-6 shrink-0">
              <h2 className="text-2xl font-bold truncate" style={{ color: 'var(--foreground)', maxWidth: 'calc(100vw - 48px)' }}>
                Thought Process
              </h2>
            </div>
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden px-4 pb-6">
              <div className="flex-1 min-h-0 overflow-hidden flex flex-col" style={{ touchAction: 'pan-y' }}>
                {contentArea}
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="fixed inset-0 text-(--foreground) pointer-events-auto" style={{ zIndex: 9999 }}>
          <div
            className="fixed inset-0 min-h-screen w-full pointer-events-none"
            style={{ backdropFilter: 'blur(40px)', WebkitBackdropFilter: 'blur(40px)', zIndex: 0.5 }}
          />
          <div className="absolute inset-0 pointer-events-auto" style={{ backgroundColor: 'transparent', zIndex: 1 }} onClick={handleBackdropClick} />
          <div className="relative h-full w-full flex flex-col transform-gpu" style={{ zIndex: 2 }} onClick={(e) => e.stopPropagation()}>
            <button
              aria-label="Close"
              className="absolute top-3 right-3 rounded-full p-2 z-10 cursor-pointer transition-all duration-200 hover:scale-105 active:scale-95"
              onClick={handleBackdropClick}
              style={{ outline: '0 !important', WebkitTapHighlightColor: 'transparent', ...getAdaptiveGlassStyleBlur(), color: 'var(--foreground)' }}
            >
              <X size={20} />
            </button>
            <div className="px-12 sm:px-16 md:px-20 lg:px-28 pt-12 sm:pt-30 pb-24 overflow-y-auto">
              <div className="flex items-center justify-between">
                <h2 className="text-3xl sm:text-3xl md:text-4xl font-semibold tracking-tight truncate min-w-0" style={{ color: 'var(--foreground)' }}>
                  Thought Process
                </h2>
                {!isComplete && (
                  <div className="w-2 h-2 bg-linear-to-r from-amber-400 to-amber-600 rounded-full animate-pulse ml-3" />
                )}
              </div>
              <div className="mt-12 ml-1">
                <div ref={scrollContainerRef} className="min-h-[200px] overflow-y-auto overflow-x-hidden text-(--foreground)/80 leading-relaxed" style={{ wordBreak: 'break-word', overflowWrap: 'break-word', WebkitUserSelect: 'text', userSelect: 'text' }}>
                  <div className="overflow-x-auto">
                    <ReactMarkdown components={markdownComponents}>{content || ''}</ReactMarkdown>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}
