/**
 * Onboarding Renderer Component
 * 
 * Centralized component that automatically handles all onboarding features for a location.
 * Automatically detects unseen features, manages steps, handles target elements, and renders
 * the appropriate UI components (tooltip, badge, highlight, etc.)
 */

'use client';

import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { OnboardingLocation, OnboardingFeature } from '@/app/types/OnboardingFeature';
import { getActiveFeaturesByLocation } from '@/app/lib/onboardingRegistry';
import { useOnboarding } from './OnboardingProvider';
import { OnboardingTooltip } from './OnboardingTooltip';
import { OnboardingBadge } from './OnboardingBadge';
import { OnboardingHighlight } from './OnboardingHighlight';

interface OnboardingRendererProps {
  /**
   * Location where onboarding features should be displayed
   */
  location: OnboardingLocation;

  /**
   * Context object passed to condition functions
   * Example: { appId: 'add-app' }
   */
  context?: any;

  /**
   * Target element identifier (optional)
   * Can be:
   * - A string: used to find element via data-onboarding-target={id}
   * - An HTMLElement: direct reference
   * - A Map<string, HTMLElement>: multiple targets by key
   */
  target?: string | HTMLElement | Map<string, HTMLElement> | null;

  /**
   * Custom condition function to determine if onboarding should be shown
   * Return false to hide all onboarding for this renderer
   */
  shouldShow?: (unseenFeatures: OnboardingFeature[]) => boolean;

  /**
   * Custom filter for features
   * Can be used to filter which features to show
   */
  filterFeatures?: (features: OnboardingFeature[]) => OnboardingFeature[];

  /**
   * Display only specific display types
   * If undefined, shows all types
   */
  displayTypes?: Array<'tooltip' | 'badge' | 'highlight' | 'pulse'>;

  /**
   * Hide in specific conditions (e.g., edit mode)
   */
  hideWhen?: boolean;

  /**
   * Optional ref to scope selector lookups to a container (e.g. widget root).
   * When set, target elements are found via scopeRef.current.querySelector(selector)
   * instead of document.querySelector, so each instance finds targets within its own subtree.
   */
  scopeRef?: React.RefObject<HTMLElement | null>;

  /**
   * Optional container element (e.g. from parent state) to scope selector lookups.
   * When provided, used before scopeRef so target resolution works after ref callback triggers re-render.
   */
  scopeElement?: HTMLElement | null;

  /** When true, tooltip uses z-index above fullscreen widget overlay so it is visible */
  elevateForOverlay?: boolean;
}

export function OnboardingRenderer({
  location,
  context,
  target,
  shouldShow,
  filterFeatures,
  displayTypes,
  hideWhen = false,
  scopeRef,
  scopeElement,
  elevateForOverlay = false,
}: OnboardingRendererProps) {
  const { getUnseenFeatures, markFeatureAsSeen, isLoaded, hasSeenFeature } = useOnboarding();
  
  // Add hasSeenFeature to context so condition functions can check if other features have been seen
  const enhancedContext = useMemo(() => ({
    ...context,
    hasSeenFeature,
  }), [context, hasSeenFeature]);
  const [targetElements, setTargetElements] = useState<Map<string, HTMLElement>>(new Map());
  const targetElementsRef = useRef<Map<string, HTMLElement>>(new Map());

  // Update target elements ref when target prop changes
  useEffect(() => {
    const updateTargets = () => {
      if (!target) {
        targetElementsRef.current = new Map();
        setTargetElements(new Map());
        return;
      }

      const newMap = new Map<string, HTMLElement>();

      if (typeof target === 'string') {
        // Find element by data-onboarding-target attribute
        const element = document.querySelector(`[data-onboarding-target="${target}"]`) as HTMLElement;
        if (element) {
          newMap.set(target, element);
        }
      } else if (target instanceof HTMLElement) {
        // Direct element reference
        newMap.set('default', target);
      } else if (target instanceof Map) {
        // Multiple targets map - copy current contents
        target.forEach((element, key) => {
          if (element) {
            newMap.set(key, element);
          }
        });
      }

      // Only update if contents changed
      const currentKeys = Array.from(targetElementsRef.current.keys()).sort().join(',');
      const newKeys = Array.from(newMap.keys()).sort().join(',');
      if (currentKeys !== newKeys || target instanceof Map) {
        targetElementsRef.current = newMap;
        setTargetElements(new Map(newMap));
      }
    };

    updateTargets();

    // For Map targets, also check periodically in case contents change
    if (target instanceof Map) {
      const interval = setInterval(updateTargets, 100);
      return () => clearInterval(interval);
    }
  }, [target]);

  // Find target elements by selector; when scope is set, search only within that container
  const findTargetBySelector = useCallback((selector: string, scope?: HTMLElement | null): HTMLElement | null => {
    try {
      const root = scope ?? scopeElement ?? scopeRef?.current ?? document;
      const element = (root === document ? document.querySelector(selector) : root.querySelector(selector)) as HTMLElement;
      return element || null;
    } catch (error) {
      console.warn(`Invalid selector for onboarding target: ${selector}`, error);
      return null;
    }
  }, [scopeRef, scopeElement]);

  // Get unseen features for this location
  const unseenFeatures = useMemo(() => {
    if (!isLoaded) return [];
    
    const features = getUnseenFeatures(location, enhancedContext);
    
    // Filter by display types if specified
    let filtered = displayTypes
      ? features.filter(f => displayTypes.includes(f.displayType))
      : features;

    // Apply custom filter if provided
    if (filterFeatures) {
      filtered = filterFeatures(filtered);
    }

    // Sort by step number
    return filtered.sort((a, b) => (a.step || 0) - (b.step || 0));
  }, [isLoaded, location, context, getUnseenFeatures, displayTypes, filterFeatures]);

  // Get features to display
  // Features without step are shown simultaneously (independent tooltips)
  // Features with step are shown one at a time (sequential tooltips)
  const featuresToDisplay = useMemo(() => {
    if (unseenFeatures.length === 0) return [];
    
    // Separate features with and without steps
    const featuresWithSteps = unseenFeatures.filter(f => f.step !== undefined);
    const featuresWithoutSteps = unseenFeatures.filter(f => f.step === undefined);
    
    // If there are features with steps, show only the first one (sequential)
    if (featuresWithSteps.length > 0) {
      return [featuresWithSteps[0]];
    }
    
    // If there are only features without steps, show all of them (simultaneous)
    return featuresWithoutSteps;
  }, [unseenFeatures]);

  // For backward compatibility, keep currentFeature as first feature
  const currentFeature = useMemo(() => {
    return featuresToDisplay[0];
  }, [featuresToDisplay]);

  // Check if should show onboarding
  const showOnboarding = useMemo(() => {
    if (hideWhen) return false;
    if (!isLoaded) return false;
    if (featuresToDisplay.length === 0) return false;
    
    // Custom condition check
    if (shouldShow && !shouldShow(unseenFeatures)) return false;
    
    return true;
  }, [hideWhen, isLoaded, featuresToDisplay, unseenFeatures, shouldShow]);

  // Get all active features for step calculation
  const allActiveFeatures = useMemo(() => {
    return getActiveFeaturesByLocation(location, context);
  }, [location, context]);

  // Calculate current step and total steps for tooltips
  const stepInfo = useMemo(() => {
    if (!currentFeature || currentFeature.displayType !== 'tooltip') {
      return { currentStep: undefined, totalSteps: undefined };
    }

    // Only calculate steps for features that have steps (sequential tooltips)
    if (currentFeature.step === undefined) {
      return { currentStep: undefined, totalSteps: undefined };
    }

    const allTooltipFeatures = allActiveFeatures
      .filter(f => f.displayType === 'tooltip' && f.step !== undefined)
      .sort((a, b) => (a.step || 0) - (b.step || 0));

    const currentStepIndex = allTooltipFeatures.findIndex(f => f.key === currentFeature.key);
    const currentStep = currentStepIndex >= 0 ? currentStepIndex + 1 : (currentFeature.step || 1);
    const totalSteps = allTooltipFeatures.length;

    return { currentStep, totalSteps };
  }, [currentFeature, allActiveFeatures]);

  // Check if there's a next step (only for sequential tooltips with steps)
  const hasNextStep = useMemo(() => {
    if (!currentFeature || currentFeature.step === undefined) return false;
    const featuresWithSteps = unseenFeatures.filter(f => f.step !== undefined);
    return featuresWithSteps.length > 1;
  }, [currentFeature, unseenFeatures]);

  // Get target element for current feature
  const getTargetElement = useCallback((feature: OnboardingFeature): HTMLElement | null => {
    // First try: Use target prop if provided
    if (target instanceof HTMLElement) {
      return target;
    } else if (typeof target === 'string') {
      const element = targetElementsRef.current.get(target);
      if (element) return element;
    } else if (target instanceof Map) {
      // Try to find by context appId first (most common case)
      if (context?.appId) {
        const element = targetElementsRef.current.get(context.appId);
        if (element) return element;
      }
      // Fallback: Try to find by feature key
      const element = targetElementsRef.current.get(feature.key);
      if (element) return element;
      // If map has only one element, use that
      if (targetElementsRef.current.size === 1) {
        return Array.from(targetElementsRef.current.values())[0];
      }
    }

    // Second try: Use selector from feature (scoped to scopeElement/scopeRef when provided)
    if (feature.selector) {
      const scope = scopeElement ?? scopeRef?.current ?? undefined;
      const element = findTargetBySelector(feature.selector, scope);
      if (element) return element;
    }

    // Third try: Find by context (e.g., appId) via DOM query
    if (context?.appId) {
      const element = document.querySelector(`[data-onboarding-target="${context.appId}"]`) as HTMLElement;
      if (element) return element;
    }

    return null;
  }, [target, context, scopeRef, scopeElement, findTargetBySelector]);

  // Handle dismiss
  // If hasNextStep is true (Skip button), mark all unseen features as seen
  // Otherwise (Close button), only mark current feature
  const handleDismiss = useCallback(() => {
    if (hasNextStep) {
      // Skip button: Mark all unseen features as seen
      unseenFeatures.forEach(feature => {
        markFeatureAsSeen(feature.key);
      });
    } else {
      // Close button: Only mark current feature
      if (currentFeature) {
        markFeatureAsSeen(currentFeature.key);
      }
    }
  }, [currentFeature, hasNextStep, unseenFeatures, markFeatureAsSeen]);

  // Handle next step
  const handleNext = useCallback(() => {
    if (currentFeature) {
      markFeatureAsSeen(currentFeature.key);
      // Next feature will automatically show
    }
  }, [currentFeature, markFeatureAsSeen]);

  // Don't render anything if onboarding shouldn't be shown
  if (!showOnboarding || featuresToDisplay.length === 0) {
    return null;
  }

  // If we have a feature with steps, use the original sequential logic
  if (currentFeature && currentFeature.step !== undefined) {
    const targetElement = getTargetElement(currentFeature);
    
    // Don't render if no target element (tooltip needs a target)
    if (!targetElement && currentFeature.displayType === 'tooltip') {
      return null;
    }

    // Render based on display type using original logic
    switch (currentFeature.displayType) {
      case 'tooltip':
        return (
          <OnboardingTooltip
            feature={currentFeature}
            targetElement={targetElement}
            position={currentFeature.tooltipPosition || 'top'}
            hasNext={hasNextStep}
            currentStep={stepInfo.currentStep}
            totalSteps={stepInfo.totalSteps}
            onDismiss={handleDismiss}
            onNext={hasNextStep ? handleNext : undefined}
            elevateForOverlay={elevateForOverlay}
          />
        );

      case 'badge':
        return targetElement ? (
          <OnboardingBadge
            feature={currentFeature}
            onDismiss={handleDismiss}
            position="top-right"
          />
        ) : null;

      case 'highlight':
        // Highlight needs to wrap children, so this will be handled by WithOnboarding wrapper
        return null;

      case 'pulse':
        // Pulse is typically handled via CSS classes on the target element
        return null;

      default:
        return null;
    }
  }

  // For features without steps, render all simultaneously (independent tooltips)
  return (
    <>
      {featuresToDisplay.map((feature) => {
        const targetElement = getTargetElement(feature);
        
        // Don't render if no target element (tooltip needs a target)
        if (!targetElement && feature.displayType === 'tooltip') {
          return null;
        }

        // Render based on display type (no steps, so no Next/Skip buttons)
        switch (feature.displayType) {
          case 'tooltip':
            return (
              <OnboardingTooltip
                key={feature.key}
                feature={feature}
                targetElement={targetElement}
                position={feature.tooltipPosition || 'top'}
                hasNext={false}
                currentStep={undefined}
                totalSteps={undefined}
                onDismiss={() => {
                  markFeatureAsSeen(feature.key);
                }}
                onNext={undefined}
                elevateForOverlay={elevateForOverlay}
              />
            );
          case 'badge':
            return targetElement ? (
              <OnboardingBadge
                key={feature.key}
                feature={feature}
                onDismiss={() => {
                  markFeatureAsSeen(feature.key);
                }}
                position="top-right"
              />
            ) : null;
          case 'highlight':
            // Highlight needs to wrap children, so this will be handled by WithOnboarding wrapper
            return null;
          case 'pulse':
            // Pulse is typically handled via CSS classes on the target element
            return null;
          default:
            return null;
        }
      })}
    </>
  );
}

