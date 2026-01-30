/**
 * Onboarding Highlight Component
 * 
 * Component that highlights elements for new features
 */

import React, { useEffect, useState } from 'react';
import { OnboardingFeature } from '@/app/types/OnboardingFeature';

interface OnboardingHighlightProps {
  feature: OnboardingFeature;
  children: React.ReactNode;
  className?: string;
}

export function OnboardingHighlight({
  feature,
  children,
  className = '',
}: OnboardingHighlightProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Entrance animation
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      className={`relative ${className}`}
      style={{
        position: 'relative',
      }}
    >
      {/* Highlight ring */}
      <div
        className={`
          absolute inset-0
          rounded-2xl
          pointer-events-none
          ${isVisible ? 'opacity-100' : 'opacity-0'}
          transition-all duration-500 ease-out
        `}
        style={{
          boxShadow: isVisible
            ? '0 0 0 2px rgba(59, 130, 246, 0.5), 0 0 20px rgba(59, 130, 246, 0.3)'
            : '0 0 0 2px transparent',
          animation: isVisible ? 'pulse-ring 2s ease-in-out infinite' : 'none',
        }}
      />

      {/* Content */}
      <div className="relative z-10">
        {children}
      </div>

      <style jsx>{`
        @keyframes pulse-ring {
          0% {
            box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.5), 0 0 20px rgba(59, 130, 246, 0.3);
          }
          50% {
            box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.3), 0 0 30px rgba(59, 130, 246, 0.2);
          }
          100% {
            box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.5), 0 0 20px rgba(59, 130, 246, 0.3);
          }
        }
      `}</style>
    </div>
  );
}
