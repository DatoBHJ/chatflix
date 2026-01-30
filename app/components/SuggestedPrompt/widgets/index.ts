import { OnThisDayWidget } from './OnThisDayWidget';
import { RandomFactWidget } from './RandomFactWidget';
import { DailyJokeWidget } from './DailyJokeWidget';
import { GlassTrendsWidget } from './GlassTrendsWidget';
import React from 'react';

export type WidgetBaseProps = {
  isDarkMode: boolean;
  isBackgroundDark: boolean;
  isEditMode?: boolean;
  widgetId?: string; // Widget ID for automatic style mode determination
};

export type WidgetStyleMode = 'background' | 'theme' | 'custom';

/**
 * Widget configuration - single source of truth for all widgets
 * Add new widgets here with component and optional styleMode (defaults to 'background')
 * - 'background': Uses background brightness sampling (default)
 * - 'theme': Uses isDarkMode (no sampling needed)
 * - 'custom': Custom styling, no sampling needed
 */
const WIDGET_CONFIG: Record<string, {
  component: React.ComponentType<any>;
  styleMode?: WidgetStyleMode; // Optional, defaults to 'background'
}> = {
  'onthisday-widget': { component: OnThisDayWidget, styleMode: 'custom' },
  'random-fact-widget': { component: RandomFactWidget },
  'daily-joke-widget': { component: DailyJokeWidget },
  'glass-trends-widget': { component: GlassTrendsWidget, styleMode: 'custom' },
};

/**
 * Determines if brightness sampling should be performed for a widget
 * @param widgetId - Widget ID to check
 * @returns true if sampling should be skipped, false otherwise
 */
export function shouldSkipBrightnessSampling(widgetId?: string): boolean {
  if (!widgetId) return false;
  const config = WIDGET_CONFIG[widgetId];
  const mode = config?.styleMode || 'background';
  // Only 'background' mode needs sampling, 'theme' and 'custom' modes skip it
  return mode !== 'background';
}

/**
 * Creates centralized style helpers for widgets
 * @param isDarkMode - Whether dark theme is active
 * @param isBackgroundDark - Whether background is dark (fallback for background mode)
 * @param widgetId - Widget ID to automatically determine style mode from WIDGET_CONFIG
 * @param isHeaderDark - Optional header brightness (from sampling)
 * @param isContentDark - Optional content brightness (from sampling)
 * @returns Object with style helper functions
 */
export function createWidgetStyleHelpers(
  isDarkMode: boolean,
  isBackgroundDark: boolean,
  widgetId?: string,
  isHeaderDark?: boolean,
  isContentDark?: boolean
): {
  getTextStyle: () => React.CSSProperties; // 기존 호환성 (전체 위젯 밝기)
  getIconClassName: () => string; // 기존 호환성 (전체 위젯 밝기)
  getHeaderTextStyle: () => React.CSSProperties;
  getHeaderIconClassName: () => string;
  getContentTextStyle: () => React.CSSProperties;
} {
  // Determine mode from widgetId if provided, otherwise default to 'background'
  const config = widgetId ? WIDGET_CONFIG[widgetId] : undefined;
  const mode: WidgetStyleMode = config?.styleMode || 'background';
  
  // For 'theme' mode, always use isDarkMode
  // For 'background' mode, use sampled values if provided, otherwise fallback to isBackgroundDark
  // For 'custom' mode, fallback to isBackgroundDark (though custom widgets typically don't use these helpers)
  const headerShouldUseDark = mode === 'theme' 
    ? isDarkMode 
    : (isHeaderDark !== undefined ? isHeaderDark : isBackgroundDark);
  
  const contentShouldUseDark = mode === 'theme'
    ? isDarkMode
    : (isContentDark !== undefined ? isContentDark : isBackgroundDark);
  
  const overallShouldUseDark = mode === 'theme' ? isDarkMode : isBackgroundDark;

  return {
    // TODO: Restore adaptive helper usage when brightness-based styling stabilizes.
    // getTextStyle: () => getAdaptiveTextStyle(overallShouldUseDark),
    // getIconClassName: () => getAdaptiveIconClassName(overallShouldUseDark),
    // getHeaderTextStyle: () => getAdaptiveTextStyle(headerShouldUseDark),
    // getHeaderIconClassName: () => getAdaptiveIconClassName(headerShouldUseDark),
    // getContentTextStyle: () => getAdaptiveTextStyle(contentShouldUseDark),
    getTextStyle: () => ({ color: 'rgba(255, 255, 255)', textShadow: 'none' }),
    getIconClassName: () => 'text-white',
    getHeaderTextStyle: () => ({ color: 'rgba(255, 255, 255)', textShadow: 'none' }),
    getHeaderIconClassName: () => 'text-white',
    getContentTextStyle: () => ({ color: 'rgba(255, 255, 255)', textShadow: 'none' }),
  };
}

// Derived exports - automatically generated from WIDGET_CONFIG
export const WIDGET_COMPONENTS: Record<string, React.ComponentType<any>> = Object.fromEntries(
  Object.entries(WIDGET_CONFIG).map(([id, config]) => [id, config.component])
);

export const WIDGET_STYLE_MODES: Record<string, WidgetStyleMode> = Object.fromEntries(
  Object.entries(WIDGET_CONFIG).map(([id, config]) => [id, config.styleMode || 'background'])
);


