/**
 * Onboarding Provider Component
 * 
 * Context provider that manages global state for onboarding features
 */

'use client';

import React, { createContext, useContext, ReactNode } from 'react';
import { useOnboardingFeatures } from '@/app/hooks/useOnboardingFeatures';
import { OnboardingLocation, OnboardingFeature } from '@/app/types/OnboardingFeature';

interface OnboardingContextType {
  seenFeatureKeys: Set<string>;
  isLoaded: boolean;
  markFeatureAsSeen: (featureKey: string) => Promise<void>;
  hasSeenFeature: (featureKey: string) => boolean;
  getUnseenFeatures: (location: OnboardingLocation, context?: any) => OnboardingFeature[];
}

const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined);

interface OnboardingProviderProps {
  children: ReactNode;
}

export function OnboardingProvider({ children }: OnboardingProviderProps) {
  const onboardingFeatures = useOnboardingFeatures();

  return (
    <OnboardingContext.Provider value={onboardingFeatures}>
      {children}
    </OnboardingContext.Provider>
  );
}

/**
 * Hook to use onboarding context
 */
export function useOnboarding() {
  const context = useContext(OnboardingContext);
  if (context === undefined) {
    throw new Error('useOnboarding must be used within an OnboardingProvider');
  }
  return context;
}

