import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Lightbulb } from 'lucide-react';
import { getAdaptiveGlassStyleBlur } from '@/app/lib/adaptiveGlassStyle';
import { createWidgetStyleHelpers, shouldSkipBrightnessSampling } from './index';
import { WidgetHeader } from './WidgetHeader';
import { useElementBackgroundBrightness } from '@/app/hooks/useBackgroundBrightness';

interface RandomFactWidgetProps {
  isDarkMode: boolean;
  isBackgroundDark: boolean;
  isEditMode?: boolean;
  widgetId?: string;
  isFullscreen?: boolean;
}

interface RandomFactData {
  text: string;
  date?: string; // YYYY-MM-DD format
}

export function RandomFactWidget({ 
  isDarkMode, 
  isBackgroundDark, 
  isEditMode = false,
  widgetId,
  isFullscreen = false,
}: RandomFactWidgetProps) {
  const [fact, setFact] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Refs for cleanup
  const abortControllerRef = useRef<AbortController | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const dateCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Get today's date in YYYY-MM-DD format (UTC)
  const getTodayDateStr = useCallback(() => {
    const today = new Date();
    return today.toISOString().split('T')[0]; // YYYY-MM-DD
  }, []);
  
  const lastFetchedDateRef = useRef<string | null>(null);

  const fetchData = useCallback(async (retry: number = 0) => {
    // Cancel previous request if exists
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    // Create new AbortController
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    
    try {
      setIsLoading(true);
      setError(null);
      
      const todayStr = getTodayDateStr();
      
      // Update last fetched date
      lastFetchedDateRef.current = todayStr;
      
      const response = await fetch(
        '/api/uselessfacts',
        { signal: abortController.signal }
      );
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }
      
      const result: RandomFactData = await response.json();
      
      // Only update state if component is still mounted and not aborted
      if (!abortController.signal.aborted) {
        setFact(result.text || 'No fact available');
      }
    } catch (err: any) {
      // Ignore abort errors
      if (err.name === 'AbortError') {
        return;
      }
      
      console.error('Error fetching random fact:', err);
      
      // Only update error state if component is still mounted
      if (!abortController.signal.aborted) {
        setError(err.message || 'Failed to load random fact');
        
        // Exponential backoff retry (max 3 retries, automatic, no UI)
        if (retry < 3) {
          const delay = Math.min(1000 * Math.pow(2, retry), 5000);
          timeoutRef.current = setTimeout(() => {
            if (!abortController.signal.aborted) {
              fetchData(retry + 1);
            }
          }, delay);
        }
      }
    } finally {
      if (!abortController.signal.aborted) {
        setIsLoading(false);
      }
    }
  }, [getTodayDateStr]);

  // Initial fetch on mount and date change check
  useEffect(() => {
    fetchData();
    
    // Check for date change every minute
    dateCheckIntervalRef.current = setInterval(() => {
      const currentDateStr = getTodayDateStr();
      
      if (currentDateStr !== lastFetchedDateRef.current) {
        lastFetchedDateRef.current = currentDateStr;
        fetchData();
      }
    }, 60000); // Check every minute
    
    return () => {
      if (dateCheckIntervalRef.current) {
        clearInterval(dateCheckIntervalRef.current);
      }
    };
  }, [fetchData, getTodayDateStr]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (dateCheckIntervalRef.current) {
        clearInterval(dateCheckIntervalRef.current);
      }
    };
  }, []);

  // Separate brightness sampling for header and content
  const headerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const shouldSample = !shouldSkipBrightnessSampling(widgetId);
  
  const { isDark: isHeaderDark } = useElementBackgroundBrightness(headerRef, shouldSample);
  const { isDark: isContentDark } = useElementBackgroundBrightness(contentRef, shouldSample);
  
  const { 
    getHeaderTextStyle, 
    getHeaderIconClassName, 
    getContentTextStyle 
  } = createWidgetStyleHelpers(
    isDarkMode,
    isBackgroundDark,
    widgetId,
    isHeaderDark,
    isContentDark
  );

  const getWidgetContainerStyle = () => {
    return getAdaptiveGlassStyleBlur();
  };

  // 모바일 여부 판단 (풀스크린 레이아웃 정렬용)
  const getIsMobile = useCallback(() => {
    if (typeof window === 'undefined') return false;
    const minDim = Math.min(window.innerWidth, window.innerHeight);
    return minDim < 768;
  }, []);
  const [isMobile, setIsMobile] = useState(getIsMobile);

  useEffect(() => {
    const handleResize = () => setIsMobile(getIsMobile());
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [getIsMobile]);

  return (
    <div 
      className="w-full h-full transition-all duration-200 p-0 overflow-visible flex flex-col relative"
      style={getWidgetContainerStyle()}
    >
      {/* Header */}
      {isFullscreen ? (
        <div className="pt-20 px-4 pb-0">
          <div className="mb-2 shrink-0 text-center">
            <WidgetHeader
              ref={headerRef}
              className="bg-transparent border-none justify-center"
              style={{
                background: 'transparent',
                border: 'none',
                backdropFilter: 'none',
                WebkitBackdropFilter: 'none',
                padding: 0,
              }}
              icon={null}
              title="Daily Did You Know? 🤔"
              titleStyle={{ fontSize: '1.75rem', fontWeight: 800, lineHeight: 1.1, ...getHeaderTextStyle() }}
              titleClassName="leading-tight text-center"
              actions={null}
            />
          </div>
        </div>
      ) : (
        <WidgetHeader
          ref={headerRef}
          className="mb-2 shrink-0"
          icon={<Lightbulb className={`w-4 h-4 ${getHeaderIconClassName()}`} />}
          title="Daily Did You Know? 🤔"
          titleStyle={getHeaderTextStyle()}
        />
      )}

      <div className={`flex-1 min-h-0 flex flex-col px-4 ${isFullscreen ? 'mt-4' : ''}`}>
        {/* Content */}
        <div ref={contentRef} className="flex-1 min-h-0 overflow-y-auto flex items-start justify-center">
          {isLoading ? (
            isFullscreen ? (
              <div className="flex items-center justify-center py-8 w-full">
                <p className="text-sm opacity-60 text-center animate-pulse" style={getContentTextStyle()}>
                  Loading...
                </p>
              </div>
            ) : (
              <div className="w-full space-y-3 pt-2">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div 
                    key={index} 
                    className="h-6 bg-white/10 rounded-lg animate-pulse" 
                  />
                ))}
              </div>
            )
          ) : error && !fact ? (
            <div className="flex items-center justify-center py-4 w-full">
              <p className="text-sm opacity-70 text-center" style={getContentTextStyle()}>
                {error}
              </p>
            </div>
          ) : !fact ? (
            <div className="flex items-center justify-center py-4 w-full">
              <p className="text-sm opacity-70 text-center" style={getContentTextStyle()}>
                No fact available
              </p>
            </div>
          ) : (
            <div className="w-full py-4">
              <p 
                className="text-base sm:text-md opacity-95 leading-relaxed font-medium text-center"
                style={getContentTextStyle()}
              >
                {fact}
              </p>
            </div>
          )}
        </div>
        {/* 하단 여백: 겉에서 공간 확보 (스크롤 영역과 분리) */}
        <div className="shrink-0 min-h-6 sm:min-h-8" aria-hidden="true" />
      </div>
    </div>
  );
}

