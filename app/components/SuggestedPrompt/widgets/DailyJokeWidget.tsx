import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Smile } from 'lucide-react';
import { getAdaptiveGlassStyleBlur } from '@/app/lib/adaptiveGlassStyle';
import { createWidgetStyleHelpers, shouldSkipBrightnessSampling } from './index';
import { useElementBackgroundBrightness } from '@/app/hooks/useBackgroundBrightness';
import { useOnboarding } from '@/app/components/Onboarding/OnboardingProvider';
import { WidgetHeader } from './WidgetHeader';

interface DailyJokeWidgetProps {
  isDarkMode: boolean;
  isBackgroundDark: boolean;
  isEditMode?: boolean;
  widgetId?: string;
  isFullscreen?: boolean;
}

interface JokeData {
  type: 'single' | 'twopart';
  text?: string;
  setup?: string;
  delivery?: string;
  date?: string; // YYYY-MM-DD format
  category?: string;
}

export function DailyJokeWidget({ 
  isDarkMode, 
  isBackgroundDark, 
  isEditMode = false,
  widgetId,
  isFullscreen = false,
}: DailyJokeWidgetProps) {
  const [joke, setJoke] = useState<JokeData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPunchlineRevealed, setIsPunchlineRevealed] = useState(false);
  
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
  
  // Load reveal state from localStorage
  const loadRevealState = useCallback(() => {
    try {
      const todayStr = getTodayDateStr();
      const key = `daily-joke-revealed-${todayStr}`;
      const saved = localStorage.getItem(key);
      if (saved === 'true') {
        setIsPunchlineRevealed(true);
      } else {
        setIsPunchlineRevealed(false);
      }
    } catch (error) {
      console.warn('Failed to load reveal state:', error);
      setIsPunchlineRevealed(false);
    }
  }, [getTodayDateStr]);
  
  // Save reveal state to localStorage
  const saveRevealState = useCallback((revealed: boolean) => {
    try {
      const todayStr = getTodayDateStr();
      const key = `daily-joke-revealed-${todayStr}`;
      localStorage.setItem(key, revealed ? 'true' : 'false');
    } catch (error) {
      console.warn('Failed to save reveal state:', error);
    }
  }, [getTodayDateStr]);
  
  // Handle reveal button click
  const handleRevealPunchline = useCallback(() => {
    setIsPunchlineRevealed(true);
    saveRevealState(true);
  }, [saveRevealState]);

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
        '/api/jokeapi',
        { signal: abortController.signal }
      );
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }
      
      const result: JokeData = await response.json();
      
      // Only update state if component is still mounted and not aborted
      if (!abortController.signal.aborted) {
        setJoke(result);
      }
    } catch (err: any) {
      // Ignore abort errors
      if (err.name === 'AbortError') {
        return;
      }
      
      console.error('Error fetching joke:', err);
      
      // Only update error state if component is still mounted
      if (!abortController.signal.aborted) {
        setError(err.message || 'Failed to load joke');
        
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

  // Load reveal state on mount and when date changes
  useEffect(() => {
    loadRevealState();
  }, [loadRevealState]);

  // Initial fetch on mount and date change check
  useEffect(() => {
    fetchData();
    
    // Check for date change every minute
    dateCheckIntervalRef.current = setInterval(() => {
      const currentDateStr = getTodayDateStr();
      
      if (currentDateStr !== lastFetchedDateRef.current) {
        lastFetchedDateRef.current = currentDateStr;
        fetchData();
        // Reset reveal state when date changes
        loadRevealState();
      }
    }, 60000); // Check every minute
    
    return () => {
      if (dateCheckIntervalRef.current) {
        clearInterval(dateCheckIntervalRef.current);
      }
    };
  }, [fetchData, getTodayDateStr, loadRevealState]);

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

  // Onboarding check for content warning
  const { getUnseenFeatures, markFeatureAsSeen } = useOnboarding();
  const unseenFeatures = useMemo(() => {
    return getUnseenFeatures('quick-access', { widgetId: 'daily-joke-widget' });
  }, [getUnseenFeatures]);
  const shouldShowWarning = unseenFeatures.some(f => f.key === 'daily_joke_widget_content_warning');
  const contentWarningFeature = unseenFeatures.find(f => f.key === 'daily_joke_widget_content_warning');
  
  // Handle dismiss warning
  const handleDismissWarning = useCallback(async () => {
    if (contentWarningFeature) {
      await markFeatureAsSeen(contentWarningFeature.key);
    }
  }, [contentWarningFeature, markFeatureAsSeen]);
  
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
      data-onboarding-target="daily-joke-widget"
      className="w-full h-full transition-all duration-200 p-0 overflow-visible flex flex-col relative"
      style={getWidgetContainerStyle()}
    >
      {/* Header */}
      {isFullscreen ? (
        <div className="pt-20 px-4 pb-0">
          <div className="mb-2 flex-shrink-0 text-center">
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
              title="Daily Joke 😂"
              titleStyle={{ fontSize: '1.75rem', fontWeight: 800, lineHeight: 1.1, ...getHeaderTextStyle() }}
              titleClassName="leading-tight text-center"
              actions={null}
            />
          </div>
        </div>
      ) : (
        <WidgetHeader
          ref={headerRef}
          className="mb-2 flex-shrink-0"
          icon={<Smile className={`w-4 h-4 ${getHeaderIconClassName()}`} />}
          title="Daily Joke 😂"
          titleStyle={getHeaderTextStyle()}
        />
      )}

      <div className={`flex-1 min-h-0 flex flex-col px-4 pb-4 ${isFullscreen ? 'mt-4' : ''}`}>
        {/* Content - Show warning overlay or joke content */}
        {shouldShowWarning ? (
          // Warning overlay
          <div ref={contentRef} className="flex-1 min-h-0 flex flex-col overflow-hidden">
            <div className="w-full flex-1 min-h-0 overflow-y-auto flex flex-col items-center justify-start px-4 py-4">
              <p 
                className="text-base sm:text-md opacity-95 leading-relaxed font-medium text-center"
                style={getContentTextStyle()}
              >
                {contentWarningFeature?.description}
              </p>
            </div>
            {/* Got it button - fixed at bottom */}
            <div className="w-full pt-5 sm:pt-6 flex-shrink-0">
              <button
                onClick={handleDismissWarning}
                className="w-full py-3.5 px-7 sm:py-4 sm:px-8 rounded-full font-semibold text-base transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                style={{
                  ...getAdaptiveGlassStyleBlur(),
                  ...getContentTextStyle(),
                }}
              >
                Got it
              </button>
            </div>
          </div>
        ) : (
          // Normal joke content
          <div ref={contentRef} className="flex-1 min-h-0 overflow-y-auto flex items-start justify-center">
            {isLoading ? (
              <div className="w-full space-y-3 pt-2">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div 
                    key={index} 
                    className="h-6 bg-white/10 rounded-lg animate-pulse" 
                  />
                ))}
              </div>
            ) : error && !joke ? (
              <div className="flex items-center justify-center py-4 w-full">
                <p className="text-sm opacity-70 text-center" style={getContentTextStyle()}>
                  {error}
                </p>
              </div>
            ) : !joke ? (
              <div className="flex items-center justify-center py-4 w-full">
                <p className="text-sm opacity-70 text-center" style={getContentTextStyle()}>
                  No joke available
                </p>
              </div>
            ) : joke.type === 'single' ? (
              // Single joke display
              <div className="w-full py-4">
                <p 
                  className="text-base sm:text-md opacity-95 leading-relaxed font-medium text-center"
                  style={getContentTextStyle()}
                >
                  {joke.text || 'No joke available'}
                </p>
              </div>
            ) : (
              // Twopart joke display
              <div className="w-full space-y-3 py-4">
                <p 
                  className="text-base sm:text-md opacity-95 leading-relaxed font-medium text-center"
                  style={getContentTextStyle()}
                >
                  {joke.setup || ''}
                </p>
                {isPunchlineRevealed ? (
                  <p 
                    className="text-base sm:text-md opacity-95 leading-relaxed font-medium text-center transition-opacity duration-300"
                    style={getContentTextStyle()}
                  >
                    {joke.delivery || ''}
                  </p>
                ) : (
                  <div className="flex items-center justify-center pt-2">
                    <button
                      onClick={handleRevealPunchline}
                      className="group relative px-6 py-3 rounded-full font-semibold text-base transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer"
                      style={{
                        ...getAdaptiveGlassStyleBlur(),
                        ...getContentTextStyle(),
                        border: `1px solid ${isDarkMode ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)'}`,
                        cursor: 'pointer',
                      }}
                    >
                      <span className="flex items-center gap-2">
                        <span className="text-lg">💥</span>
                        <span>Punchline</span>
                        <span className="text-lg group-hover:translate-x-1 transition-transform duration-300">👀</span>
                      </span>
                      <span 
                        className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-20 transition-opacity duration-300 blur-xl"
                        style={{
                          background: isDarkMode ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.2)',
                        }}
                      />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

