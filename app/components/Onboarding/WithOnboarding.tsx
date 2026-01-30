/**
 * WithOnboarding Wrapper Component
 * 
 * Wraps children and automatically renders onboarding features for the specified location.
 * Simplifies onboarding by handling all logic internally.
 */

'use client';

import React, { ReactNode, useRef, useEffect, useState } from 'react';
import { OnboardingLocation } from '@/app/types/OnboardingFeature';
import { OnboardingRenderer } from './OnboardingRenderer';

interface WithOnboardingProps {
  /**
   * Location where onboarding should be displayed
   */
  location: OnboardingLocation;

  /**
   * Context object for condition checking
   */
  context?: any;

  /**
   * Children to wrap
   */
  children: ReactNode;

  /**
   * Target element identifier
   * Can be a string (data-onboarding-target attribute) or null for auto-detection
   */
  target?: string | null;

  /**
   * Hide onboarding when condition is true
   */
  hideWhen?: boolean;

  /**
   * Custom condition to determine if onboarding should show
   */
  shouldShow?: (unseenFeatures: any[]) => boolean;

  /**
   * Display only specific types
   */
  displayTypes?: Array<'tooltip' | 'badge' | 'highlight' | 'pulse'>;
}

/**
 * Wrapper component that automatically handles onboarding for children
 * 
 * @example
 * ```tsx
 * <WithOnboarding location="quick-access" context={{ appId: 'add-app' }} target="add-app">
 *   <div data-onboarding-target="add-app">
 *     <AppIcon />
 *   </div>
 * </WithOnboarding>
 * ```
 */
export function WithOnboarding({
  location,
  context,
  children,
  target = null,
  hideWhen = false,
  shouldShow,
  displayTypes,
}: WithOnboardingProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [targetElement, setTargetElement] = useState<HTMLElement | null>(null);
  const [targetMap, setTargetMap] = useState<Map<string, HTMLElement>>(new Map());

  // Auto-detect target element
  useEffect(() => {
    if (!containerRef.current) return;

    // If target is specified, find it
    if (target) {
      const element = containerRef.current.querySelector(
        `[data-onboarding-target="${target}"]`
      ) as HTMLElement;
      if (element) {
        setTargetElement(element);
        const newMap = new Map();
        newMap.set(target, element);
        setTargetMap(newMap);
      }
    } else {
      // Auto-detect all elements with data-onboarding-target
      const elements = containerRef.current.querySelectorAll('[data-onboarding-target]');
      const newMap = new Map<string, HTMLElement>();
      elements.forEach((el) => {
        const targetId = el.getAttribute('data-onboarding-target');
        if (targetId && el instanceof HTMLElement) {
          newMap.set(targetId, el);
        }
      });
      if (newMap.size > 0) {
        setTargetMap(newMap);
        // Use first element as default target
        setTargetElement(Array.from(newMap.values())[0]);
      }
    }
  }, [target, children]);

  // Determine what target to pass to OnboardingRenderer
  const rendererTarget = target
    ? (targetElement || (targetMap.size > 0 ? targetMap : target))
    : (targetMap.size > 0 ? targetMap : targetElement);

  return (
    <div ref={containerRef} className="relative">
      {children}
      <OnboardingRenderer
        location={location}
        context={context}
        target={rendererTarget}
        hideWhen={hideWhen}
        shouldShow={shouldShow}
        displayTypes={displayTypes}
      />
    </div>
  );
}

