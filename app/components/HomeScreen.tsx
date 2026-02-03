'use client'

import { useEffect, useMemo, useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/lib/AuthContext';
import { QuickAccessApps, getEnvironmentDeviceType } from '@/app/components/SuggestedPrompt/QuickAccessApps';
import { useDarkMode } from '@/app/hooks/useDarkMode';
import { ChatflixLoadingScreen } from './ChatflixLoadingScreen';
import { useBackgroundImage } from '@/app/hooks/useBackgroundImage';
import { useBackgroundImageBrightness } from '@/app/hooks/useBackgroundImageBrightness';
import { useLoading } from '@/app/lib/LoadingContext';
import type { StoredApp } from '@/lib/quick-access-apps';

export default function HomeScreen() {
  const { user } = useAuth();
  const isDarkMode = useDarkMode();
  const router = useRouter();
  const [quickAccessAppsData, setQuickAccessAppsData] = useState<{ apps: StoredApp[] } | null>(null);

  // Prefetch quick-access-apps so layout is ready before first paint (no layout shift)
  useEffect(() => {
    const deviceType = getEnvironmentDeviceType();
    let cancelled = false;
    fetch(`/api/quick-access-apps?deviceType=${deviceType}`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) {
          setQuickAccessAppsData({ apps: Array.isArray(data?.apps) ? data.apps : [] });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setQuickAccessAppsData({ apps: [] });
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // 위젯에서 프롬프트 클릭 시 /chat으로 리디렉션
  const handlePromptClick = useCallback((prompt: string) => {
    const encodedPrompt = encodeURIComponent(prompt);
    router.push(`/chat?prompt=${encodedPrompt}`);
  }, [router]);

  // Background management using shared hook
  const {
    currentBackground,
    backgroundType,
    isBackgroundLoading
  } = useBackgroundImage(user?.id, {
    refreshOnMount: true,
    preload: true,
    useSupabase: false
  });

  // Update global loading state
  const { setIsLoading } = useLoading();

  useEffect(() => {
    setIsLoading(isBackgroundLoading);
  }, [isBackgroundLoading, setIsLoading]);

  // Calculate background image brightness for overlay
  const { isVeryDark, isVeryBright, brightness } = useBackgroundImageBrightness(
    currentBackground
  );

  const overlayColor = useMemo(() => {
    if (isVeryDark) {
      return 'rgba(255, 255, 255, 0.125)';
    }
    if (isVeryBright || brightness > 100) {
      const opacity = Math.min(0.15 + (brightness - 100) / 155 * 0.2, 0.35);
      return `rgba(0, 0, 0, ${opacity})`;
    }
    return undefined;
  }, [isVeryDark, isVeryBright, brightness]);

  // Show loading until both background and quick-access-apps are ready (prevents layout shift)
  if (isBackgroundLoading || quickAccessAppsData === null) {
    return <ChatflixLoadingScreen />;
  }

  return (
    <main className="flex-1 relative h-screen flex flex-col">
      {/* Background Image with Glass Effect */}
      <div 
        className="fixed inset-0 bg-cover bg-center bg-no-repeat min-h-screen w-full"
        style={{
          backgroundImage: currentBackground ? `url("${currentBackground.replace(/"/g, '\\"')}")` : undefined,
          zIndex: 0
        }}
      />
      
      {/* image-based color overlay on background image */}
      {overlayColor && (
        <div 
          className="fixed inset-0 min-h-screen w-full pointer-events-none"
          style={{
            backgroundColor: overlayColor,
            zIndex: 0.5
          }}
        />
      )}
      
      {/* Background Tag - Show only for default backgrounds */}
      {backgroundType === 'default' && (
        <div className="fixed bottom-8 right-8 z-10 bg-black/60 backdrop-blur-sm text-white text-sm px-4 py-2 rounded-full pointer-events-none hidden sm:block">
          Generated with Chatflix
        </div>
      )}

      {/* Content wrapper - flex layout to push QuickAccessApps to bottom */}
      <div className="flex-1 flex flex-col">
        {/* Spacer for desktop - pushes content down on desktop if needed */}
        <div className="hidden sm:block sm:flex-1" />
        
        {/* Quick Access Apps - iOS 스타일 그리드 (initialApps로 레이아웃 시프트 방지) */}
        {(user?.id || !user) && (
          <div className="flex-1 sm:flex-initial pb-0 sm:pb-16 pt-4 sm:pt-0">
            <QuickAccessApps
              isDarkMode={isDarkMode}
              user={user || undefined}
              onPromptClick={handlePromptClick}
              verticalOffset={16}
              initialApps={quickAccessAppsData.apps}
            />
          </div>
        )}
      </div>
    </main>
  );
}

