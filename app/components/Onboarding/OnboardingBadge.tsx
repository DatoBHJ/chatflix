/**
 * Onboarding Badge Component
 * 
 * Badge displayed when new features are added
 */

import React, { useEffect, useState } from 'react';
import { OnboardingFeature } from '@/app/types/OnboardingFeature';

interface OnboardingBadgeProps {
  feature: OnboardingFeature;
  onDismiss?: () => void;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  className?: string;
}

export function OnboardingBadge({
  feature,
  onDismiss,
  position = 'top-right',
  className = '',
}: OnboardingBadgeProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    // Entrance animation
    setIsAnimating(true);
    const timer = setTimeout(() => {
      setIsVisible(true);
      setIsAnimating(false);
    }, 50);

    return () => clearTimeout(timer);
  }, []);

  const positionClasses = {
    'top-right': 'top-0 right-0 -translate-y-1/2 translate-x-1/2',
    'top-left': 'top-0 left-0 -translate-y-1/2 -translate-x-1/2',
    'bottom-right': 'bottom-0 right-0 translate-y-1/2 translate-x-1/2',
    'bottom-left': 'bottom-0 left-0 translate-y-1/2 -translate-x-1/2',
  };

  const badgeColor = feature.badgeColor || 'blue-500';
  const badgeText = feature.badgeText || 'NEW';

  // Get color classes based on badgeColor
  const getBadgeColorClasses = (color: string) => {
    const colorMap: Record<string, string> = {
      'blue-500': 'bg-blue-500 dark:bg-blue-500',
      'green-500': 'bg-green-500 dark:bg-green-500',
      'purple-500': 'bg-purple-500 dark:bg-purple-500',
      'orange-500': 'bg-orange-500 dark:bg-orange-500',
      'red-500': 'bg-red-500 dark:bg-red-500',
    };
    return colorMap[color] || colorMap['blue-500'];
  };

  return (
    <div
      className={`absolute ${positionClasses[position]} z-30 ${className}`}
      style={{
        opacity: isVisible ? 1 : 0,
        transform: isVisible
          ? 'scale(1) translate(var(--tw-translate-x), var(--tw-translate-y))'
          : 'scale(0.8) translate(var(--tw-translate-x), var(--tw-translate-y))',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      <div
        className={`
          ${getBadgeColorClasses(badgeColor)}
          text-white text-[10px] font-bold leading-none
          px-2 py-1 rounded-full
          flex items-center justify-center
          min-w-[1.5rem] h-6
          shadow-lg
          ${isAnimating ? 'animate-pulse' : ''}
          transition-all duration-300 ease-out
          hover:scale-110
        `}
        style={{
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2), 0 0 0 2px rgba(255, 255, 255, 0.1)',
        }}
        title={feature.title}
      >
        {badgeText}
      </div>
      
      {/* Pulse animation ring */}
      <div
        className={`
          absolute inset-0 ${getBadgeColorClasses(badgeColor)}
          rounded-full opacity-50
          animate-ping
        `}
        style={{
          animation: 'ping 2s cubic-bezier(0, 0, 0.2, 1) infinite',
        }}
      />
    </div>
  );
}

