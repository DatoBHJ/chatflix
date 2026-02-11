/**
 * Onboarding Feature Registry
 * 
 * Define new onboarding features here when adding new functionality.
 */

import { OnboardingFeature, OnboardingLocation } from '@/app/types/OnboardingFeature';

/**
 * All onboarding features definition
 * 
 * When adding a new feature:
 * 1. key: Add a unique key (e.g., 'quick_access_new_widget_2024')
 * 2. location: Specify where to display
 * 3. displayType: Choose display type
 * 4. title, description: Write the content to display
 */
export const ONBOARDING_FEATURES: OnboardingFeature[] = [

  // Agent Mode - Step 1: Introduction
  {
    key: 'agent_mode_introduction_step1',
    location: 'chat',
    displayType: 'tooltip',
    title: 'Welcome to Chatflix 👋',
    description: 'We\'ve gathered the world\'s most powerful tools in one place!!! 🎉 Search without limits, create beautiful visuals or just ask anything ',
    tooltipPosition: 'top-left',
    step: 1,
    condition: (context?: any) => {
      // 에이전트 모드가 활성화되어 있고, 도구 선택창이 닫혀있는 상태
      return context?.isAgentEnabled === true && !context?.showToolSelector;
    },
  },

  // Agent Mode - Step 2: Control and Modes
  {
    key: 'agent_mode_introduction_step2',
    location: 'chat',
    displayType: 'tooltip',
    title: 'Choose your workflow',
    description: 'Toggle Agent Mode to let AI handle the tools, or pick a specific tool to focus on one task. You can always turn it off to talk to the model directly! ⚡️',
    tooltipPosition: 'top-left',
    step: 2,
    condition: (context?: any) => {
      // 에이전트 모드가 활성화되어 있고, 도구 선택창이 닫혀있는 상태
      return context?.isAgentEnabled === true && !context?.showToolSelector;
    },
  },

  // Agent Mode - Step 3: Model Tip
  {
    key: 'agent_mode_three_states_step3',
    location: 'chat',
    displayType: 'tooltip',
    title: 'Each model brings something different to the table 💡  ',
    description: 'Try sending messages to different models to find your favorite, or review their responses to see which works best for you!',
    tooltipPosition: 'top-left',
    step: 3,
    condition: (context?: any) => {
      // 에이전트 모드 활성화 + 도구 선택창 닫힌 상태
      return context?.isAgentEnabled === true && 
             !context?.showToolSelector;
    },
  },


  // Quick Access - Launchpad introduction (Step 1)
  {
    key: 'quick_access_add_app_step1',
    location: 'quick-access',
    displayType: 'tooltip',
    title: 'Launchpad',
    description: 'Open Launchpad to add apps and widgets.',
    tooltipPosition: 'top-left',
    step: 1,
    condition: (context?: any) => {
      return context?.appId === 'add-app';
    },
  },

  // Quick Access - Edit instructions (Step 2)
  {
    key: 'quick_access_edit_instruction_step2',
    location: 'quick-access',
    displayType: 'tooltip',
    title: 'Arrange and Edit',
    description: 'Right‑click or long‑press apps and widgets to move or remove them. You can also resize widgets to fit your preferred size.',
    tooltipPosition: 'top-left',
    step: 2,
    condition: (context?: any) => {
      return context?.appId === 'add-app';
    },
  },

  // Quick Access - Trending Widget Chatflix Explain
  {
    key: 'glass_trends_chatflix_explain',
    location: 'quick-access',
    displayType: 'tooltip',
    title: 'Ask Chatflix to explain this trending',
    description: '',
    tooltipPosition: 'top-right',
    selector: '[data-onboarding-target="glass-trends-chatflix-button"]',
    condition: (context?: any) => {
      return context?.widgetId === 'glass-trends-widget';
    },
  },

  // Quick Access - Trending Widget Filter Explore
  {
    key: 'glass_trends_filter_explore',
    location: 'quick-access',
    displayType: 'tooltip',
    title: 'Explore Global Trends',
    description: 'Change countries and time ranges to discover what\'s trending in different regions around the world.',
    tooltipPosition: 'bottom-right',
    selector: '[data-onboarding-target="glass-trends-filter-button"]',
    condition: (context?: any) => {
      return context?.widgetId === 'glass-trends-widget';
    },
  },

  // Memory - Step 1: Memory Bank Introduction
  {
    key: 'memory_introduction_step1',
    location: 'memory',
    displayType: 'tooltip',
    title: 'Your Memory Bank',
    description: 'Chatflix remembers your personal core, primary interests, and active context to personalize every interaction.',
    tooltipPosition: 'bottom',
    step: 1,
    condition: (context?: any) => {
      return context?.pathname === '/memory/memory';
    },
  },

  // Memory - Step 2: Overview Tab Guide
  {
    key: 'memory_overview_step2',
    location: 'memory',
    displayType: 'tooltip',
    title: 'Explore More Details',
    description: 'Visit the Overview tab to learn more about Memory',
    tooltipPosition: 'bottom',
    step: 2,
    condition: (context?: any) => {
      return context?.pathname === '/memory/memory';
    },
  },

  // Photo - Step 1: Photo Gallery Introduction
  {
    key: 'photo_introduction_step1',
    location: 'photo',
    displayType: 'tooltip',
    title: 'Everything Visual',
    description: 'Photos brings together everything visual in Chatflix. Your saved and uploaded images in one gallery.',
    tooltipPosition: 'bottom',
    step: 1,
    condition: (context?: any) => {
      return context?.pathname === '/photo';
    },
  },

  // Photo - Step 2: Set as Wallpaper
  {
    key: 'photo_wallpaper_step3',
    location: 'photo',
    displayType: 'tooltip',
    title: 'Set as Wallpaper',
    description: 'You can turn any saved image into your Chatflix wallpaper. Just open an image and tap the Set as Wallpaper button.',
    tooltipPosition: 'bottom',
    step: 2,
    condition: (context?: any) => {
      return context?.pathname === '/photo';
    },
  },

  // Photo - Step 3: Overview Tab Guide - temporarily disabled
  /*
  {
    key: 'photo_overview_step4',
    location: 'photo',
    displayType: 'tooltip',
    title: 'Explore More Details',
    description: 'Visit the Overview tab to learn more about Photos',
    tooltipPosition: 'bottom',
    step: 3,
    condition: (context?: any) => {
      return context?.pathname === '/photo';
    },
  },
  */
];

/**
 * Get onboarding features for a specific location
 * @param location - Display location
 * @returns List of onboarding features for that location
 */
export function getFeaturesByLocation(location: OnboardingLocation): OnboardingFeature[] {
  return ONBOARDING_FEATURES.filter(feature => feature.location === location);
}

/**
 * Get onboarding feature by key
 * @param key - Feature key
 * @returns Onboarding feature or undefined
 */
export function getFeatureByKey(key: string): OnboardingFeature | undefined {
  return ONBOARDING_FEATURES.find(feature => feature.key === key);
}

/**
 * Get features that should be shown at a specific location
 * (Filters only features that meet the conditions)
 * @param location - Display location
 * @param context - Context (used for condition checking)
 * @returns Filtered list of onboarding features
 */
export function getActiveFeaturesByLocation(
  location: OnboardingLocation,
  context?: any
): OnboardingFeature[] {
  return ONBOARDING_FEATURES.filter(feature => {
    if (feature.location !== location) return false;
    if (feature.condition && !feature.condition(context)) return false;
    return true;
  });
}

