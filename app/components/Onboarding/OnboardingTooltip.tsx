/**
 * Onboarding Tooltip Component
 * 
 * Tooltip that displays descriptions for new features
 */

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { OnboardingFeature } from '@/app/types/OnboardingFeature';
import { useOnboardingTooltipStyles } from './OnboardingTooltipStyles';

interface OnboardingTooltipProps {
  feature: OnboardingFeature;
  onDismiss?: () => void;
  onNext?: () => void; // Move to next step
  hasNext?: boolean; // Whether there is a next step
  targetElement?: HTMLElement | null;
  position?: 'top' | 'bottom' | 'left' | 'right' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  className?: string;
  currentStep?: number; // Current step number (e.g., 1)
  totalSteps?: number; // Total number of steps (e.g., 2)
  /** When true, use z-index above fullscreen widget overlay (z-200) so tooltip is visible */
  elevateForOverlay?: boolean;
}

export function OnboardingTooltip({
  feature,
  onDismiss,
  onNext,
  hasNext = false,
  targetElement,
  position = 'top',
  className = '',
  currentStep,
  totalSteps,
  elevateForOverlay = false,
}: OnboardingTooltipProps) {
  const router = useRouter();
  const [isVisible, setIsVisible] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
  const [isCornerPosition, setIsCornerPosition] = useState(false);
  const [currentPosition, setCurrentPosition] = useState<'top' | 'bottom' | 'left' | 'right' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'>(position);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [deviceType, setDeviceType] = useState<'mobile' | 'tablet' | 'desktop' | 'large'>('desktop');
  const [tooltipWidth, setTooltipWidth] = useState(320);
  const [tooltipPadding, setTooltipPadding] = useState(16);

  // Apply styles
  useOnboardingTooltipStyles();

  // Device type breakpoints
  const BREAKPOINTS = {
    mobile: 640,
    tablet: 1024,
    desktop: 1920,
  };

  // Size constraints
  const SIZE_CONSTRAINTS = {
    minWidth: 240,
    maxWidth: 320,
    mobile: { min: 240, max: 280 },
    tablet: { min: 260, max: 300 },
    desktop: { min: 280, max: 320 },
    large: { min: 300, max: 320 },
  };

  // Padding by device type
  const PADDING = {
    mobile: 12,
    tablet: 16,
    desktop: 20,
    large: 24,
  };

  // Detect theme and device type
  useEffect(() => {
    const checkTheme = () => {
      const theme = document.documentElement.getAttribute('data-theme');
      const isDark = theme === 'dark' || 
        (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      setIsDarkMode(isDark);
    };
    
    const checkDeviceType = () => {
      const width = window.innerWidth;
      let type: 'mobile' | 'tablet' | 'desktop' | 'large';
      
      if (width <= BREAKPOINTS.mobile) {
        type = 'mobile';
      } else if (width <= BREAKPOINTS.tablet) {
        type = 'tablet';
      } else if (width <= BREAKPOINTS.desktop) {
        type = 'desktop';
      } else {
        type = 'large';
      }
      
      setDeviceType(type);
      setTooltipPadding(PADDING[type]);
      
      // Calculate optimal width for device type
      const constraints = SIZE_CONSTRAINTS[type];
      const viewportWidth = window.innerWidth;
      const availableWidth = viewportWidth - (PADDING[type] * 2) - 32; // padding on both sides + margin
      const optimalWidth = Math.min(
        Math.max(constraints.min, availableWidth),
        Math.min(constraints.max, SIZE_CONSTRAINTS.maxWidth)
      );
      setTooltipWidth(Math.max(SIZE_CONSTRAINTS.minWidth, Math.min(optimalWidth, SIZE_CONSTRAINTS.maxWidth)));
    };
    
    checkTheme();
    checkDeviceType();
    
    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme']
    });
    
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', checkTheme);
    window.addEventListener('resize', checkDeviceType);
    
    return () => {
      observer.disconnect();
      mediaQuery.removeEventListener('change', checkTheme);
      window.removeEventListener('resize', checkDeviceType);
    };
  }, []);

  useEffect(() => {
    // Entrance animation
    setIsVisible(true);
    setMounted(true);

    // Calculate position if target element is provided
    const clamp = (val: number, min: number, max: number) => Math.max(min, Math.min(max, val));

    const updatePosition = () => {
      if (!targetElement) return;
      const rect = targetElement.getBoundingClientRect();
      const tooltipRect = tooltipRef.current?.getBoundingClientRect();

      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      
      // Dynamic margin based on device type (16px-24px)
      const margin = deviceType === 'mobile' ? 16 : deviceType === 'tablet' ? 20 : deviceType === 'desktop' ? 22 : 24;
      const gap = deviceType === 'mobile' ? 8 : 12; // Gap between tooltip and target

      let top = 0;
      let left = 0;
      let pos = position;

      // Calculate initial position based on preferred position
      switch (pos) {
        case 'top':
          top = rect.top - (tooltipRect?.height || 0) - gap;
          left = rect.left + rect.width / 2;
          break;
        case 'bottom':
          top = rect.bottom + gap;
          left = rect.left + rect.width / 2;
          break;
        case 'left':
          top = rect.top + rect.height / 2;
          left = rect.left - (tooltipRect?.width || 0) - gap;
          break;
        case 'right':
          top = rect.top + rect.height / 2;
          left = rect.right + gap;
          break;
        case 'top-left':
          top = rect.top - (tooltipRect?.height || 0) - gap;
          // For launchpad tooltips, move to the right; for others, move to the left
          const isLaunchpadTooltip = feature.key === 'quick_access_add_app_step1' || feature.key === 'quick_access_edit_instruction_step2';
          left = isLaunchpadTooltip ? rect.left + 6 : rect.left - 12;
          break;
        case 'top-right':
          top = rect.top - (tooltipRect?.height || 0) - gap;
          left = rect.right - (tooltipRect?.width || 0);
          break;
        case 'bottom-left':
          top = rect.bottom + gap;
          // Move further left from target element
          left = rect.left - 12;
          break;
        case 'bottom-right':
          top = rect.bottom + gap;
          left = rect.right - (tooltipRect?.width || 0);
          break;
      }

      if (tooltipRect) {
        // For corner positions, skip center alignment
        const isCorner = pos === 'top-left' || pos === 'top-right' || pos === 'bottom-left' || pos === 'bottom-right';
        setIsCornerPosition(isCorner);
        setCurrentPosition(pos);
        
        if (!isCorner) {
          // Enhanced horizontal positioning with edge detection (for centered positions)
        const tooltipHalfWidth = tooltipRect.width / 2;
        const minLeft = tooltipHalfWidth + margin;
        const maxLeft = viewportWidth - tooltipHalfWidth - margin;
        
        // If tooltip would overflow, adjust position
        if (left < minLeft) {
          left = minLeft;
        } else if (left > maxLeft) {
          left = maxLeft;
        } else {
          // Keep centered if there's enough space
          left = clamp(left, minLeft, maxLeft);
          }
        }

        // Enhanced vertical positioning with edge detection
        const minTop = margin;
        const maxTop = viewportHeight - tooltipRect.height - margin;
        
        // Check if preferred position has enough space (only for centered top/bottom positions)
        if (!isCorner) {
        let needsReposition = false;
        if (pos === 'top' && top < minTop) {
          needsReposition = true;
          // Try bottom
          const bottomTop = rect.bottom + gap;
          if (bottomTop + tooltipRect.height <= viewportHeight - margin) {
            pos = 'bottom';
            top = bottomTop;
          } else {
            // Both top and bottom don't fit, use the one with more space
            const spaceAbove = rect.top;
            const spaceBelow = viewportHeight - rect.bottom;
            if (spaceAbove > spaceBelow) {
              pos = 'top';
              top = Math.max(minTop, rect.top - tooltipRect.height - gap);
            } else {
              pos = 'bottom';
              top = Math.min(maxTop, rect.bottom + gap);
            }
          }
        } else if (pos === 'bottom' && top + tooltipRect.height > viewportHeight - margin) {
          needsReposition = true;
          // Try top
          const topTop = rect.top - tooltipRect.height - gap;
          if (topTop >= minTop) {
            pos = 'top';
            top = topTop;
          } else {
            // Both don't fit, use the one with more space
            const spaceAbove = rect.top;
            const spaceBelow = viewportHeight - rect.bottom;
            if (spaceAbove > spaceBelow) {
              pos = 'top';
              top = Math.max(minTop, rect.top - tooltipRect.height - gap);
            } else {
              pos = 'bottom';
              top = Math.min(maxTop, rect.bottom + gap);
            }
          }
        }

        // Clamp vertical position to ensure it's always visible
        top = clamp(top, minTop, maxTop);
        }

        // Mobile keyboard heuristic: prefer top if bottom likely overlapped
        const vv = (window as any).visualViewport as VisualViewport | undefined;
        const effHeight = vv ? vv.height : viewportHeight;
        if (deviceType === 'mobile' && pos === 'bottom' && top + tooltipRect.height > effHeight * 0.75) {
          const topAlternative = rect.top - tooltipRect.height - gap;
          if (topAlternative >= minTop) {
            pos = 'top';
            top = topAlternative;
          }
        }

        // For corner positions (top-left, top-right, bottom-left, bottom-right), ensure they don't overflow
        if (isCorner) {
          // Ensure horizontal position doesn't overflow
          if (pos === 'top-left' || pos === 'bottom-left') {
            // For left-aligned corners, ensure tooltip doesn't go off-screen
            if (left < margin) {
              left = margin;
            }
            // If tooltip extends beyond right edge, adjust
            if (left + tooltipRect.width > viewportWidth - margin) {
              left = Math.max(margin, viewportWidth - tooltipRect.width - margin);
            }
          } else if (pos === 'top-right' || pos === 'bottom-right') {
            // For right-aligned corners, tooltip's right edge aligns with target's right edge
            // But we need to ensure it doesn't go off-screen
            if (left + tooltipRect.width > viewportWidth - margin) {
              left = viewportWidth - tooltipRect.width - margin;
            }
            if (left < margin) {
              left = margin;
            }
          }
          
          // Ensure vertical position doesn't overflow
          if (pos === 'top-left' || pos === 'top-right') {
            if (top < minTop) {
              // If top doesn't fit, try bottom
              const bottomTop = rect.bottom + gap;
              if (bottomTop + tooltipRect.height <= viewportHeight - margin) {
                top = bottomTop;
                pos = pos === 'top-left' ? 'bottom-left' : 'bottom-right';
              } else {
                top = minTop;
              }
            } else {
              // Clamp to ensure it's visible
              top = Math.max(minTop, top);
            }
          } else if (pos === 'bottom-left' || pos === 'bottom-right') {
            if (top + tooltipRect.height > viewportHeight - margin) {
              // If bottom doesn't fit, try top
              const topTop = rect.top - tooltipRect.height - gap;
              if (topTop >= minTop) {
                top = topTop;
                pos = pos === 'bottom-left' ? 'top-left' : 'top-right';
              } else {
                top = Math.max(minTop, viewportHeight - tooltipRect.height - margin);
              }
            } else {
              // Clamp to ensure it's visible
              top = Math.min(top, viewportHeight - tooltipRect.height - margin);
            }
          }
        }

        // For left/right positions, ensure vertical centering doesn't cause overflow
        if (pos === 'left' || pos === 'right') {
          const centeredTop = rect.top + rect.height / 2 - tooltipRect.height / 2;
          if (centeredTop < minTop) {
            top = minTop;
          } else if (centeredTop + tooltipRect.height > viewportHeight - margin) {
            top = Math.max(minTop, viewportHeight - tooltipRect.height - margin);
          } else {
            top = centeredTop;
          }
          
          // Also ensure horizontal position doesn't overflow
          if (pos === 'left' && left < margin) {
            // If left position overflows, try right
            const rightLeft = rect.right + gap;
            if (rightLeft + tooltipRect.width <= viewportWidth - margin) {
              pos = 'right';
              left = rightLeft;
            } else {
              // Neither fits, use the one with more space
              const spaceLeft = rect.left;
              const spaceRight = viewportWidth - rect.right;
              if (spaceLeft > spaceRight) {
                pos = 'left';
                left = Math.max(margin, rect.left - tooltipRect.width - gap);
              } else {
                pos = 'right';
                left = Math.min(viewportWidth - tooltipRect.width - margin, rect.right + gap);
              }
            }
          } else if (pos === 'right' && left + tooltipRect.width > viewportWidth - margin) {
            // If right position overflows, try left
            const leftLeft = rect.left - tooltipRect.width - gap;
            if (leftLeft >= margin) {
              pos = 'left';
              left = leftLeft;
            } else {
              // Neither fits, use the one with more space
              const spaceLeft = rect.left;
              const spaceRight = viewportWidth - rect.right;
              if (spaceLeft > spaceRight) {
                pos = 'left';
                left = Math.max(margin, rect.left - tooltipRect.width - gap);
              } else {
                pos = 'right';
                left = Math.min(viewportWidth - tooltipRect.width - margin, rect.right + gap);
              }
            }
          }
        }
      }

      setTooltipPosition({ top, left });
    };

    updatePosition();

    const throttled = (() => {
      let ticking = false;
      return () => {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(() => {
          updatePosition();
          ticking = false;
        });
      };
    })();

    const ro = new ResizeObserver(throttled);
    if (tooltipRef.current) ro.observe(tooltipRef.current);
    if (targetElement) ro.observe(targetElement);

    window.addEventListener('resize', throttled);
    window.addEventListener('scroll', throttled, true);
    const vv: VisualViewport | null = typeof visualViewport !== 'undefined' ? visualViewport : null;
    if (vv) {
      vv.addEventListener('resize', throttled);
    }

    return () => {
      window.removeEventListener('resize', throttled);
      window.removeEventListener('scroll', throttled, true);
      if (vv) {
        vv.removeEventListener('resize', throttled);
      }
      ro.disconnect();
    };
  }, [targetElement, position, deviceType]);

  // ESC to dismiss
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        handleDismiss();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const handleDismiss = () => {
    setIsVisible(false);
    setTimeout(() => {
      onDismiss?.();
    }, 300);
  };
  
  // Handle Overview tab click for memory_overview_step2 and photo_overview_step4
  const handleOverviewClick = useCallback(() => {
    if (feature.key === 'memory_overview_step2') {
      router.push('/memory');
    } 
    // Overview onboarding - temporarily disabled
    // else if (feature.key === 'photo_overview_step4') {
    //   router.push('/photo');
    // }
    onDismiss?.();
  }, [router, onDismiss, feature.key]);
  
  // Parse description to render links
  const renderDescription = () => {
    // Overview onboarding - temporarily disabled
    if (feature.key === 'memory_overview_step2' /* || feature.key === 'photo_overview_step4' */) {
      // Special handling for Overview tab link
      const parts = feature.description.split('Overview');
      if (parts.length === 2) {
        return (
          <>
            {parts[0]}
            <button
              onClick={handleOverviewClick}
              className="text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 underline cursor-pointer font-medium"
            >
              Overview
            </button>
            {parts[1]}
          </>
        );
      }
    }
    return feature.description;
  };

  // Set higher z-index for chat location to appear above quick-access; above overlay (z-200) when fullscreen
  const zIndexClass = elevateForOverlay ? 'z-[210]' : (feature.location === 'chat' ? 'z-[75]' : 'z-[70]');

  const tooltipEl = (
    <div
      ref={tooltipRef}
      className={`
        fixed ${zIndexClass}
        ${isVisible ? 'opacity-100' : 'opacity-0'}
        transition-all duration-300 ease-out
        ${className}
      `}
      style={{
        top: tooltipPosition.top || 'auto',
        left: tooltipPosition.left || 'auto',
        width: `${tooltipWidth}px`,
        minWidth: '240px',
        maxWidth: '320px',
        transform: isCornerPosition
          ? (isVisible ? 'scale(1)' : 'scale(0.95)')
          : (isVisible
          ? 'translate(-50%, 0) scale(1)'
              : 'translate(-50%, -10px) scale(0.95)'),
      }}
      role="tooltip"
      aria-hidden={!isVisible}
      id={targetElement ? `onboarding-tooltip-${targetElement.id || 'add-app-button'}` : undefined}
    >
      <div
        className="onboarding-tooltip-backdrop relative"
        style={{
          width: '100%',
          padding: `${tooltipPadding}px`,
        }}
      >
        {/* Tooltip Arrow/Tail with Glass Effect */}
        {(() => {
          const arrowSize = 8;
          const arrowOffset = 20;
          const overlap = 1; // Overlap with main body to hide border gap
          
          // Glass effect styles matching the tooltip backdrop (no border on arrow)
          const glassStyles = {
            backgroundColor: isDarkMode 
              ? 'rgba(0, 0, 0, 0.7)' 
              : 'rgba(255, 255, 255, 0.95)',
            backdropFilter: deviceType === 'mobile' 
              ? 'blur(20px)' 
              : deviceType === 'tablet' 
                ? 'blur(10px)' 
                : 'blur(10px)',
            WebkitBackdropFilter: deviceType === 'mobile' 
              ? 'blur(20px)' 
              : deviceType === 'tablet' 
                ? 'blur(10px)' 
                : 'blur(10px)',
            // No border on arrow - it will be covered by main body's border
            boxShadow: isDarkMode
              ? '0 2px 8px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.05)'
              : '0 2px 8px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.15)',
          };
          
          // Determine arrow position based on current position
          if (currentPosition === 'top' || currentPosition === 'top-left' || currentPosition === 'top-right') {
            // Arrow pointing down (at bottom of tooltip, overlapping to hide border gap)
            const isLeft = currentPosition === 'top-left';
            const isRight = currentPosition === 'top-right';
            const leftPos = isLeft ? arrowOffset : isRight ? 'auto' : '50%';
            const rightPos = isRight ? arrowOffset : undefined;
            
            return (
              <div
                className="absolute"
                style={{
                  bottom: `-${arrowSize - overlap}px`, // Overlap with main body
                  left: leftPos,
                  right: rightPos,
                  transform: isLeft || isRight ? 'none' : 'translateX(-50%)',
                  width: `${arrowSize * 2}px`,
                  height: `${arrowSize}px`,
                  clipPath: 'polygon(50% 100%, 0% 0%, 100% 0%)',
                  zIndex: -1, // Behind the main body to hide border gap
                  ...glassStyles,
                }}
              />
            );
          } else if (currentPosition === 'bottom' || currentPosition === 'bottom-left' || currentPosition === 'bottom-right') {
            // Arrow pointing up (at top of tooltip, overlapping to hide border gap)
            const isLeft = currentPosition === 'bottom-left';
            const isRight = currentPosition === 'bottom-right';
            const leftPos = isLeft ? arrowOffset : isRight ? 'auto' : '50%';
            const rightPos = isRight ? arrowOffset : undefined;
            
            return (
              <div
                className="absolute"
                style={{
                  top: `-${arrowSize - overlap}px`, // Overlap with main body
                  left: leftPos,
                  right: rightPos,
                  transform: isLeft || isRight ? 'none' : 'translateX(-50%)',
                  width: `${arrowSize * 2}px`,
                  height: `${arrowSize}px`,
                  clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)',
                  zIndex: -1, // Behind the main body to hide border gap
                  ...glassStyles,
                }}
              />
            );
          } else if (currentPosition === 'left') {
            // Arrow pointing right (at right side of tooltip, overlapping to hide border gap)
            return (
              <div
                className="absolute"
                style={{
                  right: `-${arrowSize - overlap}px`, // Overlap with main body
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: `${arrowSize}px`,
                  height: `${arrowSize * 2}px`,
                  clipPath: 'polygon(0% 50%, 100% 0%, 100% 100%)',
                  zIndex: -1, // Behind the main body to hide border gap
                  ...glassStyles,
                }}
              />
            );
          } else if (currentPosition === 'right') {
            // Arrow pointing left (at left side of tooltip, overlapping to hide border gap)
            return (
              <div
                className="absolute"
                style={{
                  left: `-${arrowSize - overlap}px`, // Overlap with main body
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: `${arrowSize}px`,
                  height: `${arrowSize * 2}px`,
                  clipPath: 'polygon(100% 50%, 0% 0%, 0% 100%)',
                  zIndex: -1, // Behind the main body to hide border gap
                  ...glassStyles,
                }}
              />
            );
          }
          return null;
        })()}
        {/* Progress indicator - replaces close button */}
        {currentStep !== undefined && totalSteps !== undefined && totalSteps > 1 && (
          <div
            className="absolute top-3 right-3 flex items-center justify-center"
          >
            <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
              {currentStep}/{totalSteps}
            </span>
          </div>
        )}

        {/* Title */}
        <h3 className="text-base font-semibold mb-1 text-gray-900 dark:text-white pr-0">
          {feature.title}
        </h3>

        {/* Description */}
        {feature.description && (
        <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed mb-2">
          {renderDescription()}
        </p>
        )}

        {/* Edit instruction */}
        {feature.editInstruction && (
          <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
              <span className="font-semibold text-gray-700 dark:text-gray-300">How to edit:</span>{' '}
              {feature.editInstruction}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 mt-4">
          {hasNext && onNext && (
            <button
              onClick={onNext}
              className="
                px-4 py-2
                text-xs font-semibold
                rounded-lg
                transition-all duration-200
                hover:scale-[1.02] active:scale-[0.98] cursor-pointer
              "
              style={{
                backgroundColor: '#007AFF',
                color: '#ffffff',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#0056CC';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#007AFF';
              }}
              aria-label="Next step"
            >
              Next
            </button>
          )}
          {onDismiss && (
            <button
              onClick={handleDismiss}
              className="
                px-4 py-2
                text-xs font-medium
                rounded-lg
                transition-all duration-200
                hover:scale-[1.02] active:scale-[0.98] cursor-pointer
              "
              style={{
                backgroundColor: isDarkMode 
                  ? 'rgba(255, 255, 255, 0.1)' 
                  : 'rgba(0, 0, 0, 0.05)',
                color: isDarkMode ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.8)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = isDarkMode 
                  ? 'rgba(255, 255, 255, 0.15)' 
                  : 'rgba(0, 0, 0, 0.08)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = isDarkMode 
                  ? 'rgba(255, 255, 255, 0.1)' 
                  : 'rgba(0, 0, 0, 0.05)';
              }}
              aria-label={hasNext ? 'Skip onboarding' : 'Close tooltip'}
            >
              {hasNext ? 'Skip' : 'Close'}
            </button>
          )}
        </div>
      </div>
    </div>
  );

  if (!mounted) return tooltipEl;
  const portalTarget = typeof window !== 'undefined' ? document.body : null;
  return portalTarget ? createPortal(tooltipEl, portalTarget) : tooltipEl;
}

