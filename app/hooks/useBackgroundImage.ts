'use client'

import { useState, useEffect, useRef, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { DEFAULT_BACKGROUNDS, getDefaultBackground } from '@/app/photo/constants/backgrounds';
import { hasBackgroundImageByRoute } from '@/app/lib/adaptiveGlassStyle';

/**
 * Preload an image and wait for it to be fully loaded
 * @param url - The image URL to preload
 * @returns Promise that resolves when the image is loaded
 */
export function preloadBackgroundImage(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // Check if image is already cached
    const img = new Image();
    
    img.onload = () => {
      resolve();
    };
    
    img.onerror = () => {
      // Even if image fails to load, resolve to prevent blocking
      console.warn('Failed to preload background image:', url);
      resolve();
    };
    
    img.src = url;
  });
}

interface BackgroundImageResult {
  currentBackground: string;
  backgroundType: 'default' | 'custom';
  backgroundId: string | undefined;
  isBackgroundLoading: boolean;
  refreshBackground: (force?: boolean) => Promise<void>;
}

interface UseBackgroundImageOptions {
  refreshOnMount?: boolean;
  preload?: boolean;
  useSupabase?: boolean;
  supabaseClient?: any;
}

/**
 * Hook to load and manage background images with preloading
 * Supports both API-based loading (refresh-url) and Supabase direct loading
 */
export function useBackgroundImage(
  userId?: string,
  options: UseBackgroundImageOptions = {}
): BackgroundImageResult {
  const {
    refreshOnMount = true,
    preload = true,
    useSupabase = false,
    supabaseClient
  } = options;

  const [currentBackground, setCurrentBackground] = useState(getDefaultBackground().url);
  const [backgroundType, setBackgroundType] = useState<'default' | 'custom'>('default');
  const [backgroundId, setBackgroundId] = useState<string | undefined>(undefined);
  const [isBackgroundLoading, setIsBackgroundLoading] = useState(true);
  
  // Track last loaded background to prevent duplicate loads
  const lastLoadedBackgroundIdRef = useRef<string | undefined>(undefined);
  const isLoadingRef = useRef(false);

  const loadUserBackground = useCallback(async (force?: boolean) => {
    // Prevent duplicate loads (skip when force=true, e.g. from backgroundImageChanged event)
    if (!force && isLoadingRef.current) {
      return;
    }

    if (!userId) {
      // Anonymous users use default background - ensure it's set
      const defaultBg = getDefaultBackground().url;
      if (currentBackground !== defaultBg) {
        setCurrentBackground(defaultBg);
        setBackgroundType('default');
        setBackgroundId(undefined);
      }
      setIsBackgroundLoading(false);
      return;
    }

    isLoadingRef.current = true;
    // force일 때는 로딩 화면을 띄우지 않음(이미 메인을 보고 있을 수 있음)
    if (!force) {
      setIsBackgroundLoading(true);
    }

    try {
      let backgroundData: {
        backgroundType: 'default' | 'custom';
        backgroundId?: string;
        backgroundUrl?: string;
      } | null = null;

      if (useSupabase && supabaseClient) {
        // Load from Supabase directly
        const { data: bgData, error } = await supabaseClient
          .from('user_background_settings')
          .select('*')
          .eq('user_id', userId)
          .eq('is_active', true)
          .single();

        if (bgData && !error) {
          backgroundData = {
            backgroundType: bgData.background_type,
            backgroundId: bgData.id,
            backgroundUrl: bgData.background_url
          };
        }
      } else {
        // Load from API
        const response = await fetch('/api/background/refresh-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId })
        });

        if (response.ok) {
          backgroundData = await response.json();
        }
      }

      if (backgroundData) {
        let finalBackgroundUrl: string;
        let finalBackgroundType: 'default' | 'custom';
        let finalBackgroundId: string | undefined;

        if (backgroundData.backgroundType === 'default') {
          // Find matching default background from code
          const defaultBg = DEFAULT_BACKGROUNDS.find(bg => bg.id === backgroundData.backgroundId);
          if (defaultBg) {
            finalBackgroundUrl = defaultBg.url;
            finalBackgroundType = 'default';
            finalBackgroundId = backgroundData.backgroundId;
          } else {
            // Fallback to default
            finalBackgroundUrl = getDefaultBackground().url;
            finalBackgroundType = 'default';
            finalBackgroundId = undefined;
          }
        } else {
          // Custom background with URL from API
          finalBackgroundUrl = backgroundData.backgroundUrl || getDefaultBackground().url;
          finalBackgroundType = 'custom';
          finalBackgroundId = backgroundData.backgroundId;
        }

        // Check if this is the same background we already loaded
        if (lastLoadedBackgroundIdRef.current === finalBackgroundId) {
          setIsBackgroundLoading(false);
          isLoadingRef.current = false;
          return;
        }

        // Preload image if enabled
        if (preload) {
          await preloadBackgroundImage(finalBackgroundUrl);
        }

        // Update state after image is preloaded
        setCurrentBackground(finalBackgroundUrl);
        setBackgroundType(finalBackgroundType);
        setBackgroundId(finalBackgroundId);
        lastLoadedBackgroundIdRef.current = finalBackgroundId;
      } else {
        // No background data found, ensure default is set
        const defaultBg = getDefaultBackground().url;
        if (currentBackground !== defaultBg) {
          setCurrentBackground(defaultBg);
          setBackgroundType('default');
          setBackgroundId(undefined);
        }
      }
    } catch (error) {
      console.error('Failed to load user background:', error);
      // On error, ensure default background is set
      const defaultBg = getDefaultBackground().url;
      if (currentBackground !== defaultBg) {
        setCurrentBackground(defaultBg);
        setBackgroundType('default');
        setBackgroundId(undefined);
      }
    } finally {
      setIsBackgroundLoading(false);
      isLoadingRef.current = false;
    }
  }, [userId, useSupabase, supabaseClient, preload]);

  // Load background on mount or when userId changes
  useEffect(() => {
    if (refreshOnMount) {
      loadUserBackground();
    }
  }, [loadUserBackground, refreshOnMount]);

  // Listen for backgroundImageChanged (user set wallpaper from Settings or Photo app) to refresh
  useEffect(() => {
    const handler = () => loadUserBackground(true);
    window.addEventListener('backgroundImageChanged', handler);
    return () => window.removeEventListener('backgroundImageChanged', handler);
  }, [loadUserBackground]);

  return {
    currentBackground,
    backgroundType,
    backgroundId,
    isBackgroundLoading,
    refreshBackground: loadUserBackground
  };
}

/**
 * Hook to determine if background image should be present based on route or actual background image
 * @param userId - Optional user ID to check actual background image
 * @param options - Options for useBackgroundImage
 * @returns boolean indicating if background image exists
 */
export function useHasBackgroundImage(
  userId?: string,
  options?: UseBackgroundImageOptions
): boolean {
  const pathname = usePathname();
  
  // First check route-based logic
  const routeBased = hasBackgroundImageByRoute(pathname);
  
  // If route says no background image, return false immediately
  if (!routeBased) {
    return false;
  }
  
  // For home route, check if actual background image is loaded
  // This is useful for cases where we want to verify the image actually exists
  if (userId && options) {
    const { currentBackground, isBackgroundLoading } = useBackgroundImage(userId, options);
    // If background is loading, assume it exists (optimistic)
    // If loaded, check if it's not just the default placeholder
    if (!isBackgroundLoading && currentBackground) {
      return true;
    }
    return !isBackgroundLoading;
  }
  
  // Default: route says background image exists
  return routeBased;
}

