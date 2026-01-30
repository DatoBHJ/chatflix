// Styles for OnboardingTooltip component
import { useEffect } from 'react';

export function useOnboardingTooltipStyles() {
  useEffect(() => {
    const styleId = 'onboarding-tooltip-styles';
    
    if (!document.getElementById(styleId)) {
      const styleEl = document.createElement('style');
      styleEl.id = styleId;
      styleEl.textContent = `
        /* Light mode default styles */
        /* Padding is now controlled dynamically via inline styles */
        .onboarding-tooltip-backdrop {
          background-color: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.3);
          border-radius: 16px;
          box-shadow: 0 8px 40px rgba(0, 0, 0, 0.06), 0 4px 20px rgba(0, 0, 0, 0.04), 0 2px 8px rgba(0, 0, 0, 0.025), inset 0 1px 0 rgba(255, 255, 255, 0.15);
          box-sizing: border-box;
        }
        
        /* Mobile: enhanced blur and smaller border radius */
        @media (max-width: 640px) {
          .onboarding-tooltip-backdrop {
            background-color: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            border-radius: 12px;
          }
        }
        
        /* Tablet: medium blur */
        @media (min-width: 641px) and (max-width: 1024px) {
          .onboarding-tooltip-backdrop {
            border-radius: 14px;
          }
        }
        
        /* Desktop: use glass distortion if available */
        @media (min-width: 1025px) {
          .onboarding-tooltip-backdrop {
            backdrop-filter: url(#glass-distortion) blur(1px);
            -webkit-backdrop-filter: url(#glass-distortion) blur(1px);
          }
          
          /* Safari fallback */
          @supports (-webkit-touch-callout: none) {
            .onboarding-tooltip-backdrop {
              backdrop-filter: blur(10px);
              -webkit-backdrop-filter: blur(10px);
            }
          }
        }
        
        /* Dark mode styles */
        :root[data-theme="dark"] .onboarding-tooltip-backdrop,
        :root[data-theme="system"] .onboarding-tooltip-backdrop {
          background-color: rgba(0, 0, 0, 0.7);
          border: 1px solid rgba(255, 255, 255, 0.15);
          box-shadow: 0 8px 40px rgba(0, 0, 0, 0.15), 0 4px 20px rgba(0, 0, 0, 0.1), 0 2px 8px rgba(0, 0, 0, 0.05), inset 0 1px 0 rgba(255, 255, 255, 0.05);
        }
        
        @media (min-width: 769px) {
          :root[data-theme="dark"] .onboarding-tooltip-backdrop,
          :root[data-theme="system"] .onboarding-tooltip-backdrop {
            backdrop-filter: url(#glass-distortion-dark) blur(1px);
            -webkit-backdrop-filter: url(#glass-distortion-dark) blur(1px);
          }
          
          @supports (-webkit-touch-callout: none) {
            :root[data-theme="dark"] .onboarding-tooltip-backdrop,
            :root[data-theme="system"] .onboarding-tooltip-backdrop {
              backdrop-filter: blur(10px);
              -webkit-backdrop-filter: blur(10px);
            }
          }
        }
        
        @media (max-width: 640px) {
          :root[data-theme="dark"] .onboarding-tooltip-backdrop,
          :root[data-theme="system"] .onboarding-tooltip-backdrop {
            background-color: rgba(0, 0, 0, 0.9);
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
          }
        }
        
        /* Tablet dark mode */
        @media (min-width: 641px) and (max-width: 1024px) {
          :root[data-theme="dark"] .onboarding-tooltip-backdrop,
          :root[data-theme="system"] .onboarding-tooltip-backdrop {
            border-radius: 14px;
          }
        }
        
        /* System theme dark mode */
        @media (prefers-color-scheme: dark) {
          :root[data-theme="system"] .onboarding-tooltip-backdrop {
            background-color: rgba(0, 0, 0, 0.7);
            border: 1px solid rgba(255, 255, 255, 0.15);
            box-shadow: 0 8px 40px rgba(0, 0, 0, 0.15), 0 4px 20px rgba(0, 0, 0, 0.1), 0 2px 8px rgba(0, 0, 0, 0.05), inset 0 1px 0 rgba(255, 255, 255, 0.05);
          }
          
          @media (min-width: 769px) {
            :root[data-theme="system"] .onboarding-tooltip-backdrop {
              backdrop-filter: url(#glass-distortion-dark) blur(1px);
              -webkit-backdrop-filter: url(#glass-distortion-dark) blur(1px);
            }
          }
          
          @media (max-width: 640px) {
            :root[data-theme="system"] .onboarding-tooltip-backdrop {
              background-color: rgba(0, 0, 0, 0.9);
              backdrop-filter: blur(20px);
              -webkit-backdrop-filter: blur(20px);
            }
          }
        }
      `;
      document.head.appendChild(styleEl);
    }
    
    return () => {
      // Cleanup would be handled by React, but we keep the style element
      // as it's shared across all tooltip instances
    };
  }, []);
}

