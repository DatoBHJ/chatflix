'use client'

import { useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/lib/AuthContext';
import { QuickAccessApps } from '@/app/components/SuggestedPrompt/QuickAccessApps';
import { useDarkMode } from '@/app/hooks/useDarkMode';
import { ChatflixLoadingScreen } from './ChatflixLoadingScreen';
import { useBackgroundImage } from '@/app/hooks/useBackgroundImage';
import { useBackgroundImageBrightness } from '@/app/hooks/useBackgroundImageBrightness';
import { useLoading } from '@/app/lib/LoadingContext';

export default function HomeScreen() {
  const { user } = useAuth();
  const isDarkMode = useDarkMode();
  const router = useRouter();
  
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

  // Show loading screen while background is loading
  if (isBackgroundLoading) {
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
        
        {/* Quick Access Apps - iOS 스타일 그리드 (내부에서 레이아웃 관리) */}
        {(user?.id || !user) && (
          <div className="flex-1 sm:flex-initial pb-0 sm:pb-16 pt-4 sm:pt-0">
            <QuickAccessApps 
              isDarkMode={isDarkMode}
              user={user || undefined}
              onPromptClick={handlePromptClick}
              verticalOffset={16} // pt-4 (16px) 에 대응
            />
          </div>
        )}
      </div>
    </main>
  );
}

