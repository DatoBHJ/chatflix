/**
 * Hook for getting onboarding feature for a specific element
 * 
 * Simplifies onboarding usage in individual components by providing
 * just the essential information needed to display onboarding.
 */

import { useMemo } from 'react';
import { OnboardingLocation, OnboardingFeature } from '@/app/types/OnboardingFeature';
import { useOnboarding } from '@/app/components/Onboarding/OnboardingProvider';
import { getActiveFeaturesByLocation } from '@/app/lib/onboardingRegistry';

interface UseOnboardingForElementResult {
  /**
   * The current feature to display (if any)
   */
  feature: OnboardingFeature | undefined;

  /**
   * Whether there is a feature to show
   */
  hasFeature: boolean;

  /**
   * Whether to show tooltip
   */
  showTooltip: boolean;

  /**
   * Whether to show badge
   */
  showBadge: boolean;

  /**
   * Whether to show highlight
   */
  showHighlight: boolean;

  /**
   * All unseen features for this location
   */
  unseenFeatures: OnboardingFeature[];

  /**
   * Current step number (if tooltip)
   */
  currentStep: number | undefined;

  /**
   * Total steps (if tooltip)
   */
  totalSteps: number | undefined;

  /**
   * Whether there's a next step
   */
  hasNext: boolean;

  /**
   * Mark feature as seen
   */
  markAsSeen: () => void;

  /**
   * Mark feature as seen and move to next
   */
  markAsSeenAndNext: () => void;
}

/**
 * Hook to get onboarding feature for a specific location and context
 * 
 * @param location - Onboarding location
 * @param context - Context object for condition checking
 * @param options - Additional options
 * @returns Onboarding information and helper functions
 * 
 * @example
 * ```tsx
 * const { feature, showTooltip, markAsSeen } = useOnboardingForElement(
 *   'quick-access',
 *   { appId: 'add-app' }
 * );
 * 
 * return (
 *   <div>
 *     {showTooltip && feature && (
 *       <OnboardingTooltip feature={feature} onDismiss={markAsSeen} />
 *     )}
 *   </div>
 * );
 * ```
 */
export function useOnboardingForElement(
  location: OnboardingLocation,
  context?: any,
  options?: {
    /**
     * Filter by display types
     */
    displayTypes?: Array<'tooltip' | 'badge' | 'highlight' | 'pulse'>;
    
    /**
     * Custom feature filter
     */
    filter?: (features: OnboardingFeature[]) => OnboardingFeature[];
    
    /**
     * Hide condition
     */
    hideWhen?: boolean;
  }
): UseOnboardingForElementResult {
  const { getUnseenFeatures, markFeatureAsSeen, isLoaded } = useOnboarding();

  // Get unseen features
  const unseenFeatures = useMemo(() => {
    if (!isLoaded) return [];
    
    let features = getUnseenFeatures(location, context);
    
    // Filter by display types if specified
    if (options?.displayTypes) {
      features = features.filter(f => options.displayTypes!.includes(f.displayType));
    }
    
    // Apply custom filter if provided
    if (options?.filter) {
      features = options.filter(features);
    }
    
    // Sort by step
    return features.sort((a, b) => (a.step || 0) - (b.step || 0));
  }, [isLoaded, location, context, getUnseenFeatures, options?.displayTypes, options?.filter]);

  // Get current feature (first unseen feature)
  const feature = useMemo(() => {
    if (options?.hideWhen) return undefined;
    return unseenFeatures[0];
  }, [unseenFeatures, options?.hideWhen]);

  // Calculate step info for tooltips
  const stepInfo = useMemo(() => {
    if (!feature || feature.displayType !== 'tooltip') {
      return { currentStep: undefined, totalSteps: undefined };
    }

    const allActiveFeatures = getActiveFeaturesByLocation(location, context);
    const allTooltipFeatures = allActiveFeatures
      .filter(f => f.displayType === 'tooltip')
      .sort((a, b) => (a.step || 0) - (b.step || 0));

    const currentStepIndex = allTooltipFeatures.findIndex(f => f.key === feature.key);
    const currentStep = currentStepIndex >= 0 ? currentStepIndex + 1 : (feature.step || 1);
    const totalSteps = allTooltipFeatures.length;

    return { currentStep, totalSteps };
  }, [feature, location, context]);

  // Check if there's next step
  const hasNext = useMemo(() => {
    return unseenFeatures.length > 1;
  }, [unseenFeatures]);

  // Helper functions
  const markAsSeen = () => {
    if (feature) {
      markFeatureAsSeen(feature.key);
    }
  };

  const markAsSeenAndNext = () => {
    if (feature) {
      markFeatureAsSeen(feature.key);
      // Next feature will automatically show
    }
  };

  return {
    feature,
    hasFeature: !!feature && !options?.hideWhen,
    showTooltip: !!feature && feature.displayType === 'tooltip' && !options?.hideWhen,
    showBadge: !!feature && feature.displayType === 'badge' && !options?.hideWhen,
    showHighlight: !!feature && feature.displayType === 'highlight' && !options?.hideWhen,
    unseenFeatures,
    currentStep: stepInfo.currentStep,
    totalSteps: stepInfo.totalSteps,
    hasNext,
    markAsSeen,
    markAsSeenAndNext,
  };
}

